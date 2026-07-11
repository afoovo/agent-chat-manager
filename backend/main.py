import argparse
import logging
import os
import socket
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import resolve_db_path, resolve_session_diff_dir, check_schema as do_check
import config as app_config
import db_import
import state

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="ChatManager")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"code": 200, "msg": "ok", "data": None}


@app.get("/api/system/info")
def system_info():
    return {"code": 200, "msg": "ok", "data": {"machine_name": os.environ.get("COMPUTERNAME", socket.gethostname())}}


from routes.projects import router as projects_router
from routes.sessions import router as sessions_router
from routes.search import router as search_router
from routes.stats import router as stats_router
from routes.export import router as export_router
from routes.maintenance import router as maintenance_router
from routes.imports import router as imports_router

app.include_router(projects_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(stats_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.include_router(maintenance_router, prefix="/api")
app.include_router(imports_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", help="Path to opencode.db (overrides config.json)")
    parser.add_argument("--check", action="store_true", help="Schema compatibility check")
    args = parser.parse_args()

    cfg = app_config.load()

    if args.db:
        state.db_path = resolve_db_path(args.db)
    elif db_path := app_config.get_db_path(cfg):
        state.db_path = resolve_db_path(db_path)
    else:
        try:
            state.db_path = resolve_db_path(None)
        except FileNotFoundError as e:
            logger.error(str(e))
            exit(1)

    state.diff_dir = resolve_session_diff_dir(state.db_path)
    logger.info("OpenCode db: %s", state.db_path)
    logger.info("Session diff dir: %s", state.diff_dir)

    import_dir = app_config.get_import_dir(cfg)
    logger.info("Import dir: %s", import_dir)
    discovered = db_import.discover_imports(import_dir)
    if discovered:
        logger.info("Auto-discovered %d import(s)", discovered)

    if args.check:
        import json
        result = do_check(state.db_path)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        exit(0)

    uvicorn.run(app, host="0.0.0.0", port=8000)
