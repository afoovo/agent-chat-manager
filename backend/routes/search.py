from fastapi import APIRouter, Query
import db
import db_import
import db_search
import state

router = APIRouter()


def _conn():
    return db.connect(state.db_path)


@router.get("/search")
def search(
    q: str = Query(..., min_length=1),
    project_id: str | None = Query(None),
    agent: str | None = Query(None),
    part_type: str | None = Query(None),
    date_from: int | None = Query(None),
    date_to: int | None = Query(None),
    source: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    # 确定查询的 DB 路径
    if source:
        db_path = db_import.resolve_import_path(source)
        if not db_path:
            return {"code": 404, "msg": "导入不存在", "data": None}
    else:
        db_path = state.db_path

    # 尝试 FTS5
    cache_conn = db_search.get_search_cache(db_path)
    if cache_conn:
        try:
            result = db_search.search_fts(
                cache_conn, q, project_id, part_type,
                date_from, date_to, page, per_page,
            )
            cache_conn.close()
            return {"code": 200, "msg": "ok", "total": result["total"], "rows": result["rows"]}
        except Exception:
            cache_conn.close()

    # 回退 LIKE
    conn = db.connect(db_path)
    try:
        result = db.search_fulltext(conn, q, project_id, agent, part_type,
                                    date_from, date_to, page, per_page)
        return {"code": 200, "msg": "ok", "total": result["total"], "rows": result["rows"]}
    finally:
        conn.close()
