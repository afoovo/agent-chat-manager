import json
import os
import re
import sqlite3
import zipfile
import tempfile
import datetime
import logging
from collections import defaultdict

import config as app_config

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _get_imports_dir() -> str:
    cfg = app_config.load()
    return app_config.get_import_dir(cfg)


def _registry_file() -> str:
    return os.path.join(_get_imports_dir(), "registry.json")


def _ensure_dirs():
    os.makedirs(_get_imports_dir(), exist_ok=True)


def connect_import(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only = ON")
    return conn


def _load_registry() -> dict:
    reg_file = _registry_file()
    if not os.path.isfile(reg_file):
        return {}
    try:
        with open(reg_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def _save_registry(reg: dict):
    _ensure_dirs()
    with open(_registry_file(), "w", encoding="utf-8") as f:
        json.dump(reg, f, ensure_ascii=False, indent=2)


def get_imports() -> list[dict]:
    reg = _load_registry()
    result = []
    dirty = False
    for machine, info in list(reg.items()):
        db_file = info.get("file", "")
        if os.path.isfile(db_file):
            result.append({
                "machine": machine,
                "file": db_file,
                "session_count": info.get("session_count", 0),
                "imported_at": info.get("imported_at", ""),
            })
        else:
            dirty = True
    if dirty:
        _save_registry({
            m: v for m, v in reg.items()
            if os.path.isfile(v.get("file", ""))
        })
    return result


def _read_meta(db_path: str) -> dict:
    conn = connect_import(db_path)
    try:
        rows = conn.execute("SELECT key, value FROM _meta").fetchall()
        return {r["key"]: r["value"] for r in rows}
    finally:
        conn.close()


def save_import(zip_bytes: bytes) -> dict:
    _ensure_dirs()

    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    tmp.write(zip_bytes)
    tmp.close()
    tmp_zip = tmp.name

    try:
        with zipfile.ZipFile(tmp_zip, "r") as zf:
            if "export.db" not in zf.namelist():
                raise ValueError("无效的导出文件：缺少 export.db")
            db_data = zf.read("export.db")

        db_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        db_tmp.write(db_data)
        db_tmp.close()
        db_tmp_path = db_tmp.name

        try:
            meta = _read_meta(db_tmp_path)
        except Exception:
            raise ValueError("无效的导出文件：_meta 表损坏或缺失")

        machine = meta.get("machine", "unknown")
        session_count = int(meta.get("session_count", 0))

        reg = _load_registry()
        if machine in reg:
            old_file = reg[machine].get("file", "")
            if old_file and os.path.isfile(old_file):
                os.unlink(old_file)

        dest = os.path.join(_get_imports_dir(), f"{machine}.db")
        with open(dest, "wb") as f:
            f.write(db_data)

        reg[machine] = {
            "file": dest,
            "session_count": session_count,
            "imported_at": datetime.datetime.now().isoformat(),
        }
        _save_registry(reg)

        return {"machine": machine, "session_count": session_count, "imported_at": reg[machine]["imported_at"]}

    finally:
        if os.path.isfile(tmp_zip):
            os.unlink(tmp_zip)
        if "db_tmp_path" in dir() and os.path.isfile(db_tmp_path):
            os.unlink(db_tmp_path)


def delete_import(machine: str) -> dict | None:
    reg = _load_registry()
    if machine not in reg:
        return None

    info = reg[machine]
    db_file = info.get("file", "")
    if db_file and os.path.isfile(db_file):
        os.unlink(db_file)

    result = {"machine": machine, "session_count": info.get("session_count", 0)}
    del reg[machine]
    _save_registry(reg)
    return result


def resolve_import_path(machine: str) -> str | None:
    reg = _load_registry()
    info = reg.get(machine)
    if not info:
        return None
    path = info.get("file", "")
    return path if os.path.isfile(path) else None


def discover_imports(import_dir: str = None) -> int:
    if import_dir is None:
        import_dir = _get_imports_dir()
    if not os.path.isdir(import_dir):
        return 0

    reg = _load_registry()
    known = {info.get("file") for info in reg.values()}
    added = 0

    for fname in os.listdir(import_dir):
        if not fname.endswith(".db"):
            continue
        full = os.path.join(import_dir, fname)
        if full in known:
            continue
        try:
            meta = _read_meta(full)
            machine = meta.get("machine", os.path.splitext(fname)[0])
            session_count = int(meta.get("session_count", 0))
            reg[machine] = {
                "file": os.path.abspath(full),
                "session_count": session_count,
                "imported_at": datetime.datetime.now().isoformat(),
            }
            logger.info("Discovered import: %s → %s (%d sessions)", fname, machine, session_count)
            added += 1
        except Exception:
            continue

    if added:
        _save_registry(reg)
    return added


def get_import_projects(db_path: str) -> list[dict]:
    conn = connect_import(db_path)
    try:
        result = []

        # 尝试从 project 表读取（如果导出时包含了）
        try:
            proj_rows = conn.execute("SELECT * FROM project ORDER BY time_created DESC").fetchall()
            for p in proj_rows:
                if p["id"] == "global":
                    continue
                session_count = conn.execute(
                    "SELECT COUNT(*) FROM session WHERE project_id = ?", (p["id"],)
                ).fetchone()[0]
                name = p["name"] or (os.path.basename(p["worktree"].rstrip("/\\")) if p["worktree"] else "")
                result.append({
                    "id": p["id"],
                    "worktree": p["worktree"],
                    "name": name,
                    "session_count": session_count,
                    "directories": [],
                    "time_created": p["time_created"],
                })
        except sqlite3.OperationalError:
            pass  # project 表不存在，从 session 推导

        # 从 session 表按 worktree/directory 分组
        dir_rows = conn.execute(
            "SELECT COALESCE(worktree, directory) as dir, "
            "project_id, COUNT(*) as cnt FROM session "
            "WHERE COALESCE(worktree, directory) IS NOT NULL "
            "GROUP BY dir ORDER BY cnt DESC"
        ).fetchall()

        for dr in dir_rows:
            wd = dr["dir"]
            pid = dr["project_id"]
            cnt = dr["cnt"]
            if pid and len(pid) == 40:
                # git 项目 — 如果已经在 result 中则跳过
                if any(p["id"] == pid for p in result):
                    # 更新计数
                    for p in result:
                        if p["id"] == pid:
                            p["session_count"] = cnt
                    continue
                result.append({
                    "id": pid,
                    "worktree": wd,
                    "name": os.path.basename(wd.rstrip("/\\")) or wd,
                    "session_count": cnt,
                    "directories": [],
                    "time_created": 0,
                })
            else:
                result.append({
                    "id": f"import:{wd}",
                    "worktree": wd,
                    "name": os.path.basename(wd.rstrip("/\\")) or wd,
                    "session_count": cnt,
                    "directories": [],
                    "time_created": 0,
                })

        return result
    finally:
        conn.close()
