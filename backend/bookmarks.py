import json
import os
import sqlite3
import time
import logging

logger = logging.getLogger(__name__)

BOOKMARKS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "bookmarks.db")


def _ensure_db():
    os.makedirs(os.path.dirname(BOOKMARKS_PATH), exist_ok=True)
    conn = sqlite3.connect(BOOKMARKS_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bookmarks (
            session_id TEXT PRIMARY KEY,
            starred INTEGER DEFAULT 0,
            tags TEXT DEFAULT '[]',
            note TEXT DEFAULT '',
            time_updated INTEGER
        )
    """)
    conn.commit()
    return conn


def get_all_bookmarks() -> list[dict]:
    conn = _ensure_db()
    try:
        rows = conn.execute("SELECT * FROM bookmarks").fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def get_bookmark(session_id: str) -> dict | None:
    conn = _ensure_db()
    try:
        row = conn.execute("SELECT * FROM bookmarks WHERE session_id = ?", (session_id,)).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def upsert_bookmark(session_id: str, starred: bool = False, tags: list[str] | None = None, note: str = ""):
    conn = _ensure_db()
    try:
        existing = conn.execute("SELECT * FROM bookmarks WHERE session_id = ?", (session_id,)).fetchone()
        ts = int(time.time() * 1000)
        if existing:
            updates = ["time_updated = ?"]
            params: list = [ts]
            if starred is not None:
                updates.append("starred = ?")
                params.append(1 if starred else 0)
            if tags is not None:
                updates.append("tags = ?")
                params.append(json.dumps(tags, ensure_ascii=False))
            if note:
                updates.append("note = ?")
                params.append(note)
            params.append(session_id)
            conn.execute(f"UPDATE bookmarks SET {', '.join(updates)} WHERE session_id = ?", params)
        else:
            conn.execute(
                "INSERT INTO bookmarks (session_id, starred, tags, note, time_updated) VALUES (?, ?, ?, ?, ?)",
                (session_id, 1 if starred else 0, json.dumps(tags or [], ensure_ascii=False), note, ts),
            )
        conn.commit()
    finally:
        conn.close()


def delete_bookmark(session_id: str):
    conn = _ensure_db()
    try:
        conn.execute("DELETE FROM bookmarks WHERE session_id = ?", (session_id,))
        conn.commit()
    finally:
        conn.close()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "session_id": row["session_id"],
        "starred": bool(row["starred"]),
        "tags": json.loads(row["tags"]) if row["tags"] else [],
        "note": row["note"] or "",
        "time_updated": row["time_updated"],
    }
