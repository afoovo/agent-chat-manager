from fastapi import APIRouter, Query
import db
import state

router = APIRouter()


def _conn():
    return db.connect(state.db_path)


@router.get("/stats/overview")
def overview():
    conn = _conn()
    try:
        return {"code": 200, "msg": "ok", "data": db.get_stats_overview(conn)}
    finally:
        conn.close()


@router.get("/stats/by-project")
def by_project():
    conn = _conn()
    try:
        return {"code": 200, "msg": "ok", "data": db.get_stats_by_project(conn)}
    finally:
        conn.close()


@router.get("/stats/by-model")
def by_model():
    conn = _conn()
    try:
        return {"code": 200, "msg": "ok", "data": db.get_stats_by_model(conn)}
    finally:
        conn.close()


@router.get("/stats/by-agent")
def by_agent():
    conn = _conn()
    try:
        return {"code": 200, "msg": "ok", "data": db.get_stats_by_agent(conn)}
    finally:
        conn.close()


@router.get("/stats/token-trend")
def token_trend(granularity: str = Query("day", pattern="^(day|week)$")):
    conn = _conn()
    try:
        return {"code": 200, "msg": "ok", "data": db.get_stats_token_trend(conn, granularity)}
    finally:
        conn.close()


@router.get("/stats/heatmap")
def heatmap(year: int = Query(2026)):
    conn = _conn()
    try:
        return {"code": 200, "msg": "ok", "data": db.get_stats_heatmap(conn, year)}
    finally:
        conn.close()


@router.get("/stats/tool-usage")
def tool_usage():
    conn = _conn()
    try:
        return {"code": 200, "msg": "ok", "data": db.get_stats_tool_usage(conn)}
    finally:
        conn.close()


@router.get("/stats/hourly-distribution")
def hourly():
    conn = _conn()
    try:
        return {"code": 200, "msg": "ok", "data": db.get_stats_hourly_distribution(conn)}
    finally:
        conn.close()
