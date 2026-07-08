import sqlite3
import json
import os
import time
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def resolve_db_path(cli_arg: str | None = None) -> str:
    if cli_arg and os.path.isfile(cli_arg):
        return cli_arg
    env = os.environ.get("OPENCODE_DB_PATH")
    if env and os.path.isfile(env):
        return env
    candidates = [
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "opencode", "opencode.db"),
        os.path.join(Path.home(), ".local", "share", "opencode", "opencode.db"),
        os.path.join(Path.home(), "Library", "Application Support", "opencode", "opencode.db"),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    raise FileNotFoundError("opencode.db 未找到，请通过 --db 参数指定路径")


def resolve_session_diff_dir(db_path: str) -> str:
    base = os.path.dirname(os.path.dirname(db_path))
    d = os.path.join(base, "storage", "session_diff")
    return d if os.path.isdir(d) else ""


def connect(db_path: str, readonly: bool = True) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    if readonly:
        conn.execute("PRAGMA query_only = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def check_schema(db_path: str) -> dict:
    result = {"ok": True, "tables": {}, "issues": []}
    try:
        conn = connect(db_path)
        required = ["session", "message", "part", "project", "todo", "event"]
        for t in required:
            try:
                cols = conn.execute(f"PRAGMA table_info({t})").fetchall()
                result["tables"][t] = [c[1] for c in cols]
            except Exception:
                result["issues"].append(f"表 {t} 不存在")
                result["ok"] = False

        critical_cols = {
            "session": ["id", "title", "project_id", "model", "agent", "time_created"],
            "message": ["id", "session_id", "data", "time_created"],
            "part": ["id", "message_id", "session_id", "data", "time_created"],
        }
        for tbl, cols in critical_cols.items():
            if tbl in result["tables"]:
                for c in cols:
                    if c not in result["tables"][tbl]:
                        result["issues"].append(f"表 {tbl} 缺少列 {c}")

        for tbl in result["tables"]:
            cnt = conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
            result["tables"][tbl] = {"columns": result["tables"][tbl], "rows": cnt}

        migrations = conn.execute(
            "SELECT name, applied_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 3"
        ).fetchall()
        result["latest_migrations"] = [{"name": m[0], "applied_at": m[1]} for m in migrations]

        conn.close()
    except Exception as e:
        result["ok"] = False
        result["issues"].append(str(e))
    return result


def safe_json_parse(text: str | None, default=None):
    if not text:
        return default
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning("JSON parse failed: %s, raw[:200]=%s", e, str(text)[:200])
        return default


# ── 通用查询基类 ──────────────────────────────────────────

def list_paginated(
    conn: sqlite3.Connection,
    table: str,
    columns: str = "*",
    where: str = "1=1",
    params: tuple = (),
    order_by: str = "time_created DESC",
    page: int = 1,
    per_page: int = 50,
) -> dict:
    offset = (page - 1) * per_page
    total = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}", params).fetchone()[0]
    rows = conn.execute(
        f"SELECT {columns} FROM {table} WHERE {where} ORDER BY {order_by} LIMIT ? OFFSET ?",
        (*params, per_page, offset),
    ).fetchall()
    return {"total": total, "rows": [dict(r) for r in rows]}


def get_by_id(conn: sqlite3.Connection, table: str, id_value: str, id_col: str = "id") -> dict | None:
    row = conn.execute(f"SELECT * FROM {table} WHERE {id_col} = ?", (id_value,)).fetchone()
    return dict(row) if row else None


# ── 业务查询 ──────────────────────────────────────────────

def get_projects(conn: sqlite3.Connection) -> list[dict]:
    projects = conn.execute("SELECT * FROM project ORDER BY time_created DESC").fetchall()
    result = []
    for p in projects:
        if p["id"] == "global":
            continue  # 后面单独处理
        pd_rows = conn.execute(
            "SELECT * FROM project_directory WHERE project_id = ?", (p["id"],)
        ).fetchall()
        session_count = conn.execute(
            "SELECT COUNT(*) FROM session WHERE project_id = ?", (p["id"],)
        ).fetchone()[0]
        name = p["name"] or (os.path.basename(p["worktree"].rstrip("/\\")) if p["worktree"] else "global")
        result.append({
            "id": p["id"],
            "worktree": p["worktree"],
            "name": name,
            "session_count": session_count,
            "directories": [dict(d) for d in pd_rows],
            "time_created": p["time_created"],
        })

    # global 项目按 session.directory 拆分为多个虚拟项目
    dir_rows = conn.execute(
        "SELECT directory, COUNT(*) as cnt FROM session "
        "WHERE project_id = 'global' AND directory IS NOT NULL "
        "GROUP BY directory ORDER BY cnt DESC"
    ).fetchall()
    for dr in dir_rows:
        wd = dr["directory"]
        result.append({
            "id": f"global:{wd}",
            "worktree": wd,
            "name": os.path.basename(wd.rstrip("/\\")) or wd,
            "session_count": dr["cnt"],
            "directories": [],
            "time_created": 0,
        })
    return result


def get_sessions(
    conn: sqlite3.Connection,
    project_id: str | None = None,
    agent: str | None = None,
    date_from: int | None = None,
    date_to: int | None = None,
    q: str | None = None,
    session_ids: list[str] | None = None,
    page: int = 1,
    per_page: int = 50,
) -> dict:
    where = "1=1"
    params: list = []

    if project_id:
        if project_id.startswith("global:"):
            where += " AND project_id = 'global' AND directory = ?"
            params.append(project_id[7:])
        else:
            where += " AND project_id = ?"
            params.append(project_id)
    if agent:
        where += " AND agent = ?"
        params.append(agent)
    if date_from:
        where += " AND time_created >= ?"
        params.append(date_from)
    if date_to:
        where += " AND time_created <= ?"
        params.append(date_to)
    if q:
        where += " AND title LIKE ?"
        params.append(f"%{q}%")
    if session_ids:
        placeholders = ",".join(["?"] * len(session_ids))
        where += f" AND id IN ({placeholders})"
        params.extend(session_ids)

    columns = (
        "id, title, directory, project_id, agent, model, cost, "
        "tokens_input, tokens_output, tokens_reasoning, "
        "time_created, time_updated"
    )
    result = list_paginated(conn, "session", columns, where, tuple(params),
                            "time_created DESC", page, per_page)
    for s in result["rows"]:
        model_raw = safe_json_parse(s.get("model"), {})
        s["model_id"] = model_raw.get("id", "") if isinstance(model_raw, dict) else ""
        s["provider_id"] = model_raw.get("providerID", "") if isinstance(model_raw, dict) else ""
        s["variant"] = model_raw.get("variant", "") if isinstance(model_raw, dict) else ""
        s["starred"] = False
        s["tags"] = []
        # preview: first user message
        first_msg = conn.execute(
            "SELECT data FROM message WHERE session_id = ? AND json_extract(data, '$.role') = 'user' ORDER BY time_created LIMIT 1",
            (s["id"],),
        ).fetchone()
        if first_msg:
            msg_data = safe_json_parse(first_msg["data"], {})
            preview = str(msg_data) if msg_data else ""
            s["preview"] = preview[:200]
        else:
            s["preview"] = ""
    return result


def get_session_by_id(conn: sqlite3.Connection, session_id: str) -> dict | None:
    session = get_by_id(conn, "session", session_id)
    if not session:
        return None
    model_raw = safe_json_parse(session.get("model"), {})
    session["model_id"] = model_raw.get("id", "") if isinstance(model_raw, dict) else ""
    session["provider_id"] = model_raw.get("providerID", "") if isinstance(model_raw, dict) else ""
    session["variant"] = model_raw.get("variant", "") if isinstance(model_raw, dict) else ""

    todos = conn.execute(
        "SELECT * FROM todo WHERE session_id = ? ORDER BY position", (session_id,)
    ).fetchall()
    session["todos"] = [dict(t) for t in todos]

    switches = conn.execute(
        "SELECT * FROM session_message WHERE session_id = ? ORDER BY time_created", (session_id,)
    ).fetchall()
    session["switches"] = [dict(s) for s in switches]

    return session


def get_session_preview(conn: sqlite3.Connection, session_id: str) -> str:
    first_msg = conn.execute(
        "SELECT data FROM message WHERE session_id = ? "
        "AND json_extract(data, '$.role') = 'user' ORDER BY time_created LIMIT 1",
        (session_id,),
    ).fetchone()
    if not first_msg:
        return ""
    msg_data = safe_json_parse(first_msg["data"], {})
    return str(msg_data)[:200]


def get_messages(
    conn: sqlite3.Connection, session_id: str, page: int = 1, per_page: int = 50
) -> dict:
    total = conn.execute(
        "SELECT COUNT(*) FROM message WHERE session_id = ?", (session_id,)
    ).fetchone()[0]
    offset = (page - 1) * per_page
    msgs = conn.execute(
        "SELECT * FROM message WHERE session_id = ? ORDER BY time_created LIMIT ? OFFSET ?",
        (session_id, per_page, offset),
    ).fetchall()

    items = []
    for m in msgs:
        msg_data = safe_json_parse(m["data"], {})
        msg_dict = dict(m)
        msg_dict["role"] = msg_data.get("role", "unknown")
        msg_dict["agent"] = msg_data.get("agent")
        msg_dict["model_id"] = msg_data.get("modelID", "")
        msg_dict["provider_id"] = msg_data.get("providerID", "")
        msg_dict["variant"] = ""
        msg_dict["tokens"] = msg_data.get("tokens")
        msg_dict["cost"] = msg_data.get("cost")

        parts = conn.execute(
            "SELECT * FROM part WHERE message_id = ? ORDER BY time_created", (m["id"],)
        ).fetchall()
        part_list = []
        for p in parts:
            pd = safe_json_parse(p["data"], {})
            if not isinstance(pd, dict):
                pd = {}
            pi = {
                "id": p["id"],
                "type": pd.get("type", "unknown"),
                "text": pd.get("text"),
                "tool": pd.get("tool"),
                "callID": pd.get("callID"),
                "state": pd.get("state"),
                "time": pd.get("time"),
                "time_created": p["time_created"],
                "snapshot": pd.get("snapshot"),
                "tokens": pd.get("tokens"),
                "cost": pd.get("cost"),
                "reason": pd.get("reason"),
                "hash": pd.get("hash"),
                "files": pd.get("files"),
                "auto": pd.get("auto"),
                "tail_start_id": pd.get("tail_start_id"),
            }
            part_list.append(pi)
        msg_dict["parts"] = part_list
        items.append(msg_dict)

    return {"total": total, "rows": items}


def get_session_diff(session_id: str, diff_dir: str) -> list[dict]:
    if not diff_dir:
        return []
    path = os.path.join(diff_dir, f"{session_id}.json")
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, IOError):
        return []
    if not data or data == []:
        return []
    return data if isinstance(data, list) else []


def search_fulltext(
    conn: sqlite3.Connection,
    q: str,
    project_id: str | None = None,
    agent: str | None = None,
    part_type: str | None = None,
    date_from: int | None = None,
    date_to: int | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    keyword = f"%{q}%"
    conditions = ["(s.title LIKE ? OR pt_content LIKE ?)"]
    params: list = [keyword, keyword]

    if project_id:
        conditions.append("s.project_id = ?")
        params.append(project_id)
    if agent:
        conditions.append("s.agent = ?")
        params.append(agent)
    if date_from:
        conditions.append("m.time_created >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("m.time_created <= ?")
        params.append(date_to)

    where = " AND ".join(conditions)
    part_where = f"WHERE json_extract(data, '$.type') = ?" if part_type else ""
    if part_type:
        params.insert(0, part_type)

    sql = f"""
    SELECT DISTINCT
      s.id AS session_id, s.title AS session_title,
      p.worktree AS project_name,
      s.project_id,
      m.id AS message_id, pt.id AS part_id,
      pt.part_type,
      pt.pt_content AS raw_content,
      m.time_created
    FROM session s
    LEFT JOIN project p ON s.project_id = p.id
    JOIN message m ON m.session_id = s.id
    JOIN (
      SELECT id, message_id, session_id, data,
        json_extract(data, '$.type') AS part_type,
        COALESCE(json_extract(data, '$.text'), '') || ' ' ||
        COALESCE(json_extract(data, '$.state.output'), '') || ' ' ||
        COALESCE(json_extract(data, '$.state.input'), '') || ' ' ||
        COALESCE(json_extract(data, '$.state.title'), '') || ' ' ||
        COALESCE(json_extract(data, '$.tool'), '') AS pt_content
      FROM part
      {part_where}
    ) pt ON pt.message_id = m.id
    WHERE {where}
    ORDER BY m.time_created DESC
    LIMIT ? OFFSET ?
    """
    query_params = tuple(params) + (per_page, (page - 1) * per_page)
    rows = conn.execute(sql, query_params).fetchall()

    count_sql = f"""
    SELECT COUNT(DISTINCT pt.id)
    FROM session s
    JOIN message m ON m.session_id = s.id
    JOIN (
      SELECT id, message_id, session_id, data,
        COALESCE(json_extract(data, '$.text'), '') || ' ' ||
        COALESCE(json_extract(data, '$.state.output'), '') || ' ' ||
        COALESCE(json_extract(data, '$.state.input'), '') || ' ' ||
        COALESCE(json_extract(data, '$.state.title'), '') || ' ' ||
        COALESCE(json_extract(data, '$.tool'), '') AS pt_content
      FROM part
      {part_where}
    ) pt ON pt.message_id = m.id
    WHERE {where}
    """
    total = conn.execute(count_sql, tuple(params)).fetchone()[0]

    def extract_snippet(raw: str, kw: str, ctx: int = 80) -> str:
        if not raw:
            return ""
        idx = raw.lower().find(kw.lower())
        if idx < 0:
            return raw[:ctx * 2 + len(kw)]
        start = max(0, idx - ctx)
        end = min(len(raw), idx + len(kw) + ctx)
        snip = raw[start:end]
        if start > 0:
            snip = "..." + snip
        if end < len(raw):
            snip = snip + "..."
        return snip

    return {
        "total": total,
        "rows": [
            {
                "session_id": r["session_id"],
                "session_title": r["session_title"],
                "project_name": r["project_name"],
                "project_id": r["project_id"],
                "message_id": r["message_id"],
                "part_id": r["part_id"],
                "part_type": r["part_type"],
                "snippet": extract_snippet(r["raw_content"] or "", q),
                "time_created": r["time_created"],
            }
            for r in rows
        ],
    }


def get_stats_overview(conn: sqlite3.Connection) -> dict:
    row = conn.execute("""
        SELECT
          COUNT(*) AS total_sessions,
          COALESCE(SUM(cost), 0) AS total_cost,
          COALESCE(SUM(tokens_input), 0) AS total_tokens_input,
          COALESCE(SUM(tokens_output), 0) AS total_tokens_output,
          COALESCE(SUM(tokens_reasoning), 0) AS total_tokens_reasoning,
          MIN(time_created) AS first_session,
          MAX(time_created) AS last_session
        FROM session
        WHERE time_archived IS NULL
    """).fetchone()
    d = dict(row)
    active_days = conn.execute("""
        SELECT COUNT(DISTINCT date(time_created / 1000, 'unixepoch')) FROM session
    """).fetchone()[0]
    d["active_days"] = active_days
    d["avg_daily_sessions"] = round(d["total_sessions"] / max(active_days, 1), 1)
    d["avg_daily_cost"] = round(d["total_cost"] / max(active_days, 1), 4)
    return d


def get_stats_by_project(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("""
        SELECT p.id AS project_id, p.worktree,
          COUNT(s.id) AS session_count,
          COALESCE(SUM(s.cost), 0) AS total_cost,
          COALESCE(SUM(s.tokens_input + s.tokens_output + s.tokens_reasoning), 0) AS total_tokens
        FROM project p
        LEFT JOIN session s ON s.project_id = p.id AND s.time_archived IS NULL
        GROUP BY p.id
        ORDER BY session_count DESC
    """).fetchall()
    return [dict(r) for r in rows]


def get_stats_by_model(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("""
        SELECT
          json_extract(model, '$.providerID') AS provider_id,
          json_extract(model, '$.id') AS model_id,
          COUNT(*) AS session_count,
          ROUND(AVG(cost), 6) AS avg_cost,
          ROUND(AVG(tokens_input + tokens_output + tokens_reasoning), 0) AS avg_tokens,
          COALESCE(SUM(cost), 0) AS total_cost,
          COALESCE(SUM(tokens_input + tokens_output + tokens_reasoning), 0) AS total_tokens
        FROM session
        WHERE model IS NOT NULL AND time_archived IS NULL
        GROUP BY provider_id, model_id
        ORDER BY session_count DESC
    """).fetchall()
    return [dict(r) for r in rows]


def get_stats_by_agent(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("""
        SELECT
          agent,
          COUNT(*) AS session_count,
          ROUND(AVG(cost), 6) AS avg_cost,
          ROUND(AVG(tokens_input + tokens_output + tokens_reasoning), 0) AS avg_tokens,
          COALESCE(SUM(cost), 0) AS total_cost,
          COALESCE(SUM(tokens_input + tokens_output + tokens_reasoning), 0) AS total_tokens
        FROM session
        WHERE agent IS NOT NULL AND time_archived IS NULL
        GROUP BY agent
        ORDER BY session_count DESC
    """).fetchall()
    return [dict(r) for r in rows]


def get_stats_token_trend(
    conn: sqlite3.Connection, granularity: str = "day"
) -> list[dict]:
    fmt = "%Y-%m-%d" if granularity == "day" else "%Y-%W"
    rows = conn.execute(f"""
        SELECT
          strftime('{fmt}', time_created / 1000, 'unixepoch') AS date_label,
          COALESCE(SUM(tokens_input), 0) AS tokens_input,
          COALESCE(SUM(tokens_output), 0) AS tokens_output,
          COUNT(*) AS sessions
        FROM session
        WHERE time_archived IS NULL
        GROUP BY date_label
        ORDER BY date_label
    """).fetchall()
    return [dict(r) for r in rows]


def get_stats_heatmap(conn: sqlite3.Connection, year: int) -> list[dict]:
    rows = conn.execute(f"""
        SELECT
          date(time_created / 1000, 'unixepoch') AS date_label,
          COUNT(*) AS sessions,
          COALESCE(SUM(tokens_input + tokens_output + tokens_reasoning), 0) AS tokens
        FROM session
        WHERE time_archived IS NULL
          AND strftime('%Y', time_created / 1000, 'unixepoch') = ?
        GROUP BY date_label
        ORDER BY date_label
    """, (str(year),)).fetchall()
    return [dict(r) for r in rows]


def get_stats_tool_usage(conn: sqlite3.Connection) -> list[dict]:
    parts = conn.execute("""
        SELECT data FROM part WHERE json_extract(data, '$.type') = 'tool'
    """).fetchall()
    from collections import Counter
    tool_counter: Counter = Counter()
    tool_sessions: dict[str, set] = {}
    for (d,) in parts:
        pd = safe_json_parse(d, {})
        tool = pd.get("tool", "unknown") if isinstance(pd, dict) else "unknown"
        tool_counter[tool] += 1
    return [{"tool": t, "count": c} for t, c in tool_counter.most_common()]


def get_stats_hourly_distribution(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("""
        SELECT
          CAST(strftime('%H', time_created / 1000, 'unixepoch') AS INTEGER) AS hour,
          COUNT(*) AS sessions,
          COALESCE(SUM(tokens_input + tokens_output + tokens_reasoning), 0) AS tokens
        FROM session
        WHERE time_archived IS NULL
        GROUP BY hour
        ORDER BY hour
    """).fetchall()
    return [dict(r) for r in rows]


def delete_session(conn: sqlite3.Connection, session_id: str, diff_dir: str) -> bool:
    session = get_by_id(conn, "session", session_id)
    if not session:
        return False
    _backup_session(conn, session_id, diff_dir)
    conn.execute("DELETE FROM todo WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM event WHERE aggregate_id = ?", (session_id,))
    conn.execute("DELETE FROM part WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM message WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM session WHERE id = ?", (session_id,))
    diff_path = os.path.join(diff_dir, f"{session_id}.json") if diff_dir else ""
    if diff_path and os.path.isfile(diff_path):
        os.remove(diff_path)
    return True


def _backup_session(conn: sqlite3.Connection, session_id: str, diff_dir: str):
    backup_dir = os.path.join(os.path.dirname(diff_dir), "backups") if diff_dir else ""
    if not backup_dir:
        return
    os.makedirs(backup_dir, exist_ok=True)
    backup = {
        "deleted_at": int(time.time() * 1000),
        "session": get_by_id(conn, "session", session_id),
        "messages": [dict(m) for m in conn.execute(
            "SELECT * FROM message WHERE session_id = ? ORDER BY time_created", (session_id,)
        ).fetchall()],
        "parts": [dict(p) for p in conn.execute(
            "SELECT * FROM part WHERE session_id = ? ORDER BY time_created", (session_id,)
        ).fetchall()],
        "todos": [dict(t) for t in conn.execute(
            "SELECT * FROM todo WHERE session_id = ? ORDER BY position", (session_id,)
        ).fetchall()],
    }
    diff_path = os.path.join(diff_dir, f"{session_id}.json") if diff_dir else ""
    if diff_path and os.path.isfile(diff_path):
        with open(diff_path, "r", encoding="utf-8") as f:
            backup["diff"] = f.read()
    backup_path = os.path.join(backup_dir, f"{session_id}.json")
    with open(backup_path, "w", encoding="utf-8") as f:
        json.dump(backup, f, ensure_ascii=False, indent=2)


def archive_session(conn: sqlite3.Connection, session_id: str) -> bool:
    session = get_by_id(conn, "session", session_id)
    if not session:
        return False
    import time
    conn.execute(
        "UPDATE session SET time_archived = ? WHERE id = ?",
        (int(time.time() * 1000), session_id),
    )
    return True


def cleanup_orphans(conn: sqlite3.Connection) -> dict:
    orphan_msgs = conn.execute("""
        SELECT COUNT(*) FROM message WHERE session_id NOT IN (SELECT id FROM session)
    """).fetchone()[0]
    orphan_parts = conn.execute("""
        SELECT COUNT(*) FROM part WHERE message_id NOT IN (SELECT id FROM message)
    """).fetchone()[0]
    conn.execute("DELETE FROM part WHERE message_id NOT IN (SELECT id FROM message)")
    conn.execute("DELETE FROM message WHERE session_id NOT IN (SELECT id FROM session)")
    return {"orphan_messages_deleted": orphan_msgs, "orphan_parts_deleted": orphan_parts}
