from fastapi import APIRouter
import db
import state

router = APIRouter()


@router.post("/maintenance/cleanup")
def cleanup():
    conn = db.connect(state.db_path, readonly=False)
    try:
        result = db.cleanup_orphans(conn)
        conn.commit()
        return {"code": 200, "msg": "清理完成", "data": result}
    finally:
        conn.close()
