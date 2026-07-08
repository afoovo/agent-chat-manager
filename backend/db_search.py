import os
import sqlite3
import logging
import hashlib
import re

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "search_cache")


def _hash_path(p: str) -> str:
    return hashlib.md5(p.encode()).hexdigest()[:12]


def _get_cache_path(source_db: str) -> str:
    return os.path.join(CACHE_DIR, f"{_hash_path(source_db)}.db")


def _build_fts(cache_conn: sqlite3.Connection, source_db: str, source_mtime: float):
    logger.info("Building FTS index for %s", source_db)
    cache_conn.execute("DROP TABLE IF EXISTS search_idx")
    cache_conn.execute("DROP TABLE IF EXISTS search_doc")

    cache_conn.execute("""
        CREATE TABLE search_doc (
            rowid INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            session_title TEXT,
            message_id TEXT,
            part_id TEXT,
            body TEXT,
            project_id TEXT,
            part_type TEXT,
            time_created INTEGER
        )
    """)
    cache_conn.execute("""
        CREATE VIRTUAL TABLE search_idx USING fts5(
            session_id,
            session_title,
            message_id,
            part_id,
            body,
            project_id,
            part_type,
            content=search_doc,
            content_rowid=rowid,
            tokenize='unicode61'
        )
    """)

    src = sqlite3.connect(source_db)
    src.row_factory = sqlite3.Row
    src.execute("PRAGMA query_only = ON")

    rows = src.execute("""
        SELECT
            p.session_id,
            COALESCE(s.title, '') AS session_title,
            p.message_id,
            p.id AS part_id,
            COALESCE(json_extract(p.data, '$.text'), '') || ' \n ' ||
            COALESCE(json_extract(p.data, '$.state.output'), '') || ' \n ' ||
            COALESCE(json_extract(p.data, '$.state.input'), '') || ' \n ' ||
            COALESCE(json_extract(p.data, '$.state.title'), '') || ' ' ||
            COALESCE(json_extract(p.data, '$.tool'), '') AS content,
            COALESCE(s.project_id, '') AS project_id,
            json_extract(p.data, '$.type') AS part_type,
            m.time_created
        FROM part p
        JOIN message m ON m.id = p.message_id
        JOIN session s ON s.id = p.session_id
        WHERE
            json_extract(p.data, '$.text') != '' OR
            json_extract(p.data, '$.state.output') != '' OR
            json_extract(p.data, '$.state.input') != '' OR
            json_extract(p.data, '$.tool') != '' OR
            json_extract(p.data, '$.state.title') != ''
    """).fetchall()

    insert_doc = """
        INSERT INTO search_doc
            (session_id, session_title, message_id, part_id, body,
             project_id, part_type, time_created)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    insert_idx = """
        INSERT INTO search_idx
            (rowid, session_title, body)
        VALUES (?, ?, ?)
    """
    batch = []
    rowid = 1
    for r in rows:
        c = r["content"]
        if not c or not c.strip():
            continue
        if not r["part_id"] or not r["session_id"]:
            continue
        batch.append((
            r["session_id"], r["session_title"], r["message_id"], r["part_id"],
            c, r["project_id"], r["part_type"], r["time_created"],
        ))
        cache_conn.execute(insert_idx, (rowid, r["session_title"], c))
        rowid += 1
        if len(batch) >= 500:
            cache_conn.executemany(insert_doc, batch)
            batch = []
    if batch:
        cache_conn.executemany(insert_doc, batch)

    src.close()

    cache_conn.execute("CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT)")
    cache_conn.execute("INSERT OR REPLACE INTO _meta VALUES ('source_mtime', ?)", (str(source_mtime),))
    cache_conn.execute("INSERT OR REPLACE INTO _meta VALUES ('source_path', ?)", (source_db,))
    cache_conn.commit()

    count = cache_conn.execute("SELECT COUNT(*) FROM search_doc").fetchone()[0]
    logger.info("FTS index built: %d rows", count)


def get_search_cache(source_db: str) -> sqlite3.Connection | None:
    if not os.path.isfile(source_db):
        return None

    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_path = _get_cache_path(source_db)
    source_mtime = os.path.getmtime(source_db)

    need_rebuild = True
    if os.path.isfile(cache_path):
        try:
            conn = sqlite3.connect(cache_path)
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT value FROM _meta WHERE key='source_mtime'").fetchone()
            if row and float(row[0]) == source_mtime:
                need_rebuild = False
            else:
                conn.close()
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
            need_rebuild = True

    if need_rebuild:
        conn = sqlite3.connect(cache_path)
        conn.row_factory = sqlite3.Row
        try:
            _build_fts(conn, source_db, source_mtime)
        except Exception as e:
            logger.warning("FTS build failed: %s, falling back to LIKE", e)
            conn.close()
            return None

    return conn


def _sanitize_fts5(q: str) -> str:
    q = re.sub(r'["*^()]', ' ', q)
    q = re.sub(r'\b(AND|OR|NOT|NEAR)\b', ' ', q, flags=re.IGNORECASE)
    q = re.sub(r'\s+', ' ', q).strip()
    return f'"{q}"' if q else q


def search_fts(
    cache_conn: sqlite3.Connection,
    q: str,
    project_id: str | None = None,
    part_type: str | None = None,
    date_from: int | None = None,
    date_to: int | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    conditions = []
    params: list = []

    if project_id:
        conditions.append("project_id = ?")
        params.append(project_id)
    if part_type:
        conditions.append("part_type = ?")
        params.append(part_type)
    if date_from:
        conditions.append("time_created >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("time_created <= ?")
        params.append(date_to)

    where = " AND ".join(conditions) if conditions else "1=1"
    q_clean = _sanitize_fts5(q)

    match_sql = f"""
        SELECT
            d.session_id,
            d.session_title,
            d.message_id,
            d.part_id,
            snippet(search_idx, 4, '<mark>', '</mark>', '...', 36) AS snippet,
            d.project_id,
            d.part_type,
            d.time_created
        FROM search_doc d
        JOIN search_idx ON search_idx.rowid = d.rowid
        WHERE search_idx MATCH ? AND {where}
        ORDER BY rank
        LIMIT ? OFFSET ?
    """
    query_params = [q_clean] + params + [per_page, (page - 1) * per_page]
    rows = cache_conn.execute(match_sql, query_params).fetchall()

    count_sql = f"""
        SELECT COUNT(*)
        FROM search_doc d
        JOIN search_idx ON search_idx.rowid = d.rowid
        WHERE search_idx MATCH ? AND {where}
    """
    total = cache_conn.execute(count_sql, [q_clean] + params).fetchone()[0]

    return {
        "total": total,
        "rows": [
            {
                "session_id": r["session_id"],
                "session_title": r["session_title"],
                "project_name": None,
                "project_id": r["project_id"],
                "message_id": r["message_id"],
                "part_id": r["part_id"],
                "part_type": r["part_type"],
                "snippet": r["snippet"] or "",
                "time_created": r["time_created"],
            }
            for r in rows
        ],
    }
