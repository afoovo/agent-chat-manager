from fastapi import APIRouter, Query, UploadFile, File
from fastapi.responses import JSONResponse
import os
import db
import db_import
import config as app_config
import bookmarks

router = APIRouter()


@router.get("/imports/config")
def get_import_config():
    cfg = app_config.load()
    return {
        "code": 200, "msg": "ok",
        "data": {
            "db_path": cfg.get("db_path"),
            "import_dir": app_config.get_import_dir(cfg),
        }
    }


@router.put("/imports/config")
def update_import_config(body: dict):
    import_dir = body.get("import_dir", "").strip()
    if not import_dir:
        return JSONResponse(status_code=400, content={"code": 400, "msg": "import_dir 不能为空", "data": None})

    cfg = app_config.load()
    old_dir = app_config.get_import_dir(cfg)

    cfg["import_dir"] = import_dir
    app_config.save(cfg)
    new_dir = app_config.get_import_dir(cfg)

    if os.path.isdir(old_dir) and old_dir != new_dir:
        reg_file = os.path.join(old_dir, "registry.json")
        if os.path.isfile(reg_file):
            try:
                import shutil
                shutil.copy2(reg_file, os.path.join(new_dir, "registry.json"))
            except Exception:
                pass

    db_import.discover_imports(new_dir)
    imports = db_import.get_imports()
    return {"code": 200, "msg": "已更新", "data": {"import_dir": new_dir, "imports": imports}}


@router.get("/imports")
def list_imports():
    return {"code": 200, "msg": "ok", "data": db_import.get_imports()}


@router.post("/imports")
def create_import(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        return JSONResponse(status_code=400, content={"code": 400, "msg": "请上传 .zip 文件", "data": None})
    try:
        zip_bytes = file.file.read()
        result = db_import.save_import(zip_bytes)
        return {"code": 200, "msg": "导入成功", "data": result}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"code": 400, "msg": str(e), "data": None})
    except Exception as e:
        return JSONResponse(status_code=500, content={"code": 500, "msg": f"导入失败: {e}", "data": None})


@router.delete("/imports/{machine}")
def delete_import(machine: str):
    result = db_import.delete_import(machine)
    if result is None:
        return {"code": 404, "msg": "未找到该导入", "data": None}
    return {"code": 200, "msg": "已删除", "data": result}


def _import_conn(machine: str):
    """获取导入 DB 的连接，不存在则抛 404"""
    path = db_import.resolve_import_path(machine)
    if not path:
        raise ValueError("导入不存在或文件已丢失")
    return db_import.connect_import(path)


@router.get("/imports/{machine}/sessions")
def import_sessions(
    machine: str,
    project_id: str | None = Query(None),
    agent: str | None = Query(None),
    date_from: int | None = Query(None),
    date_to: int | None = Query(None),
    q: str | None = Query(None),
    starred: bool | None = Query(None),
    tag: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    try:
        conn = _import_conn(machine)
    except ValueError as e:
        return JSONResponse(status_code=404, content={"code": 404, "msg": str(e), "data": None, "total": 0, "rows": []})
    try:
        result = db.get_sessions(conn, project_id, agent, date_from, date_to, q, page, per_page)
        for s in result["rows"]:
            s["starred"] = False
            s["tags"] = []
        return {"code": 200, "msg": "ok", "total": result["total"], "rows": result["rows"]}
    finally:
        conn.close()


@router.get("/imports/{machine}/sessions/{session_id}")
def import_session_detail(machine: str, session_id: str):
    try:
        conn = _import_conn(machine)
    except ValueError as e:
        return JSONResponse(status_code=404, content={"code": 404, "msg": str(e), "data": None})
    try:
        session = db.get_session_by_id(conn, session_id)
        if not session:
            return {"code": 404, "msg": "会话不存在", "data": None}
        return {"code": 200, "msg": "ok", "data": session}
    finally:
        conn.close()


@router.get("/imports/{machine}/sessions/{session_id}/messages")
def import_messages(
    machine: str,
    session_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    try:
        conn = _import_conn(machine)
    except ValueError as e:
        return JSONResponse(status_code=404, content={"code": 404, "msg": str(e), "data": None, "total": 0, "rows": []})
    try:
        result = db.get_messages(conn, session_id, page, per_page)
        return {"code": 200, "msg": "ok", "total": result["total"], "rows": result["rows"]}
    finally:
        conn.close()


@router.get("/imports/{machine}/projects")
def import_projects(machine: str):
    path = db_import.resolve_import_path(machine)
    if not path:
        return JSONResponse(status_code=404, content={"code": 404, "msg": "导入不存在", "data": []})
    try:
        projects = db_import.get_import_projects(path)
        return {"code": 200, "msg": "ok", "data": projects}
    except Exception as e:
        return JSONResponse(status_code=500, content={"code": 500, "msg": str(e), "data": []})


@router.get("/imports/{machine}/sessions/{session_id}/preview")
def import_preview(machine: str, session_id: str):
    try:
        conn = _import_conn(machine)
    except ValueError as e:
        return JSONResponse(status_code=404, content={"code": 404, "msg": str(e), "data": None})
    try:
        preview = db.get_session_preview(conn, session_id)
        return {"code": 200, "msg": "ok", "data": preview}
    finally:
        conn.close()
