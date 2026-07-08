from fastapi import APIRouter
import db
import state

router = APIRouter()


def _conn():
    return db.connect(state.db_path)


@router.get("/projects")
def list_projects():
    conn = _conn()
    try:
        data = db.get_projects(conn)
        return {"code": 200, "msg": "ok", "data": data}
    finally:
        conn.close()
