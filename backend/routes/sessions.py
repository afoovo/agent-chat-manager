from fastapi import APIRouter, Query
import db
import state
import bookmarks
from models import BookmarkUpdate

router = APIRouter()


def _conn():
    return db.connect(state.db_path)


def _merge_bookmarks(rows: list[dict]) -> list[dict]:
    if not rows:
        return rows
    ids = [r["id"] for r in rows]
    all_bm = bookmarks.get_all_bookmarks()
    bm_map = {b["session_id"]: b for b in all_bm}
    for r in rows:
        bm = bm_map.get(r["id"])
        r["starred"] = bm["starred"] if bm else False
        r["tags"] = bm["tags"] if bm else []
    return rows


@router.get("/sessions")
def list_sessions(
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
    session_ids = None
    if starred or tag:
        all_bm = bookmarks.get_all_bookmarks()
        bm_ids = set()
        for bm in all_bm:
            if starred and bm["starred"]:
                bm_ids.add(bm["session_id"])
            if tag:
                tags = bm["tags"] if isinstance(bm["tags"], list) else []
                if tag in tags:
                    bm_ids.add(bm["session_id"])
        session_ids = list(bm_ids) if bm_ids else ["__none__"]

    conn = _conn()
    try:
        result = db.get_sessions(conn, project_id, agent, date_from, date_to, q, session_ids, page, per_page)
        result["rows"] = _merge_bookmarks(result["rows"])
        return {"code": 200, "msg": "ok", "total": result["total"], "rows": result["rows"]}
    finally:
        conn.close()


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    conn = _conn()
    try:
        session = db.get_session_by_id(conn, session_id)
        if not session:
            return {"code": 404, "msg": "会话不存在", "data": None}
        return {"code": 200, "msg": "ok", "data": session}
    finally:
        conn.close()


@router.get("/sessions/{session_id}/preview")
def get_preview(session_id: str):
    conn = _conn()
    try:
        preview = db.get_session_preview(conn, session_id)
        return {"code": 200, "msg": "ok", "data": preview}
    finally:
        conn.close()


@router.get("/sessions/{session_id}/messages")
def list_messages(
    session_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    conn = _conn()
    try:
        result = db.get_messages(conn, session_id, page, per_page)
        return {"code": 200, "msg": "ok", "total": result["total"], "rows": result["rows"]}
    finally:
        conn.close()


@router.get("/sessions/{session_id}/diff")
def get_diff(session_id: str):
    data = db.get_session_diff(session_id, state.diff_dir)
    return {"code": 200, "msg": "ok", "data": data}


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str):
    conn = db.connect(state.db_path, readonly=False)
    try:
        ok = db.delete_session(conn, session_id, state.diff_dir)
        if not ok:
            return {"code": 404, "msg": "会话不存在", "data": None}
        conn.commit()
        return {"code": 200, "msg": "已删除", "data": None}
    finally:
        conn.close()


@router.post("/sessions/{session_id}/archive")
def archive_session(session_id: str):
    conn = db.connect(state.db_path, readonly=False)
    try:
        ok = db.archive_session(conn, session_id)
        if not ok:
            return {"code": 404, "msg": "会话不存在", "data": None}
        conn.commit()
        return {"code": 200, "msg": "已归档", "data": None}
    finally:
        conn.close()


@router.get("/bookmarks")
def list_bookmarks():
    return {"code": 200, "msg": "ok", "data": bookmarks.get_all_bookmarks()}


@router.post("/bookmarks/{session_id}")
def update_bookmark(session_id: str, body: BookmarkUpdate):
    bookmarks.upsert_bookmark(session_id, body.starred, body.tags, body.note)
    return {"code": 200, "msg": "已更新", "data": None}
