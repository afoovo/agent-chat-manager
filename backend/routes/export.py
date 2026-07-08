import json, os, re, io, zipfile, sqlite3, tempfile, datetime, socket
from urllib.parse import quote
from fastapi import APIRouter, Query
from fastapi.responses import Response

import db
import state

router = APIRouter()


def _safe_filename(title: str, ext: str) -> str:
    safe = re.sub(r'[\\/*?:"<>|]', '_', title)[:50].strip()
    return f"{safe}.{ext}"


def _frontmatter(session: dict, tags: list[str], starred: bool) -> str:
    lines = [
        "---",
        f"title: {session.get('title','')}",
        f"project: {session.get('directory','')}",
        f"model: {session.get('model_id','')}",
        f"agent: {session.get('agent','')}",
        f"date: {_ts_to_str(session.get('time_created',0))}",
        f"tags: {json.dumps(tags)}",
        f"starred: {str(starred).lower()}",
        "---",
        "",
    ]
    return "\n".join(lines)


def _ts_to_str(ts: int) -> str:
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _fmt_time(ts: int) -> str:
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%H:%M")


def _md_user(msg: dict, parts: list[dict]) -> str:
    texts = [p["text"] for p in parts if p.get("type") == "text" and p.get("text")]
    content = "\n\n".join(texts) if texts else ""
    t = _fmt_time(msg.get("time_created", 0))
    return f"\n## User ({t})\n\n{content}\n"


def _md_parts(parts: list[dict]) -> str:
    lines: list[str] = []
    for p in parts:
        pt = p.get("type", "")
        if pt == "text":
            if p.get("text"):
                lines.append(f"\n{p['text']}\n")
        elif pt == "reasoning":
            if p.get("text"):
                lines.append(f"\n<details>\n<summary>思考过程 (展开)</summary>\n\n{p['text']}\n\n</details>\n")
        elif pt == "tool":
            tool = p.get("tool", "unknown")
            state_data = p.get("state") or {}
            inp = state_data.get("input", {})
            if isinstance(inp, dict) and tool == "bash":
                cmd = inp.get("command", "")
                desc = inp.get("description", "")
                code = cmd
                if desc:
                    code = f"# {desc}\n{cmd}"
            else:
                code = json.dumps(inp, indent=2, ensure_ascii=False) if isinstance(inp, (dict, list)) else str(inp)
            output = state_data.get("output", "")
            lines.append(f"\n### Tool: {tool} ({state_data.get('title', '')})\n")
            lines.append(f"\n**命令：**\n```{_lang(tool)}\n{code}\n```\n")
            if output:
                lines.append(f"\n<details>\n<summary>输出</summary>\n\n```\n{output}\n```\n\n</details>\n")
            meta = state_data.get("metadata") or {}
            exit_code = meta.get("exit")
            if exit_code is not None:
                lines.append(f"\n_exit: {exit_code}_\n")
        elif pt == "step-finish":
            tokens = p.get("tokens") or {}
            cost = p.get("cost")
            reason = p.get("reason", "")
            parts = []
            if tokens:
                parts.append(f"{tokens.get('input', 0)}+{tokens.get('output', 0)}")
            if cost is not None:
                parts.append(f"cost: ${cost}")
            if reason:
                parts.append(reason)
            if parts:
                lines.append(f"\n_{' · '.join(parts)}_\n")
        elif pt == "patch":
            files = p.get("files") or []
            if files:
                names = [f.split("/")[-1] for f in files[:5]]
                more = f" (+{len(files) - 5})" if len(files) > 5 else ""
                lines.append(f"\n**修改文件：** {', '.join(names)}{more}\n")
        elif pt == "compaction":
            auto = "(自动)" if p.get("auto") else ""
            lines.append(f"\n--- 对话上下文已压缩 {auto}---\n")
        elif pt == "file":
            fn = p.get("filename", "附件")
            url = p.get("url", "#")
            lines.append(f"\n📎 [{fn}]({url})\n")
    return "\n".join(lines)


def _lang(tool: str) -> str:
    mapping = {"bash": "bash", "read": "text", "write": "text", "edit": "text",
               "grep": "text", "glob": "text", "task": "", "question": "", "webfetch": "text"}
    return mapping.get(tool, "")


def generate_markdown(session_id: str) -> tuple[str, str]:
    conn = db.connect(state.db_path)
    try:
        session = db.get_session_by_id(conn, session_id)
        if not session:
            raise ValueError("会话不存在")
        messages_result = db.get_messages(conn, session_id, 1, 9999)

        from datetime import datetime, timezone
        date_str = datetime.fromtimestamp(session["time_created"] / 1000, tz=timezone.utc).strftime("%Y-%m-%d")

        tags: list[str] = []
        starred = False
        try:
            bm_conn = db.connect(_bookmark_db_path(), readonly=True)
            bm = bm_conn.execute("SELECT * FROM bookmarks WHERE session_id = ?", (session_id,)).fetchone()
            if bm:
                starred = bool(bm["starred"])
                tags = json.loads(bm["tags"]) if bm["tags"] else []
            bm_conn.close()
        except Exception:
            pass

        lines = [_frontmatter(session, tags, starred)]
        lines.append(f"# {session['title']}\n")
        lines.append(f"**项目：** {session.get('directory','')}")
        lines.append(f"**模型：** {session.get('model_id','')} ({session.get('provider_id','')})")
        start = _ts_to_str(session["time_created"])
        end = _ts_to_str(session.get("time_updated", session["time_created"]))
        lines.append(f"**时间：** {start} - {end}")
        lines.append(f"**Token：** 输入 {session['tokens_input']:,} | 输出 {session['tokens_output']:,} | 推理 {session['tokens_reasoning']:,}")
        if session.get("cost"):
            lines.append(f"**成本：** ${session['cost']:.2f}")
        lines.append("")

        for msg in messages_result["rows"]:
            parts = msg.get("parts", [])
            if msg.get("role") == "user":
                lines.append(_md_user(msg, parts))
            else:
                t = _fmt_time(msg.get("time_created", 0))
                lines.append(f"\n---\n\n## Assistant ({t})")
                lines.append(_md_parts(parts))

        content = "\n".join(lines)
        fname = f"{date_str}_{_safe_filename(session['title'], 'md')}"
        return content, fname
    finally:
        conn.close()


def generate_html(session_id: str) -> tuple[str, str]:
    md_content, fname = generate_markdown(session_id)
    html_fname = fname.replace(".md", ".html")
    import markdown
    body = markdown.markdown(md_content, extensions=["fenced_code", "tables", "codehilite"])
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
:root {{
  --bg: #f8f9fb; --surface: #fff; --fg: #1e293b; --fg-muted: #64748b; --fg-dim: #94a3b8;
  --primary: #3b82f6; --border: #e2e8f0; --font: system-ui, sans-serif; --font-mono: 'JetBrains Mono', monospace;
  --r: 8px;
}}
body {{ font: 14px/1.7 var(--font); color: var(--fg); background: var(--bg); max-width: 860px; margin: 0 auto; padding: 40px 24px; }}
h1 {{ font-size: 24px; margin-bottom: 4px; }}
h2 {{ font-size: 18px; border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-top: 32px; }}
h3 {{ font-size: 15px; color: var(--fg-muted); }}
code {{ font-family: var(--font-mono); font-size: 13px; background: var(--surface); border-radius: 4px; padding: 1px 5px; }}
pre {{ background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 16px; overflow-x: auto; }}
pre code {{ background: none; padding: 0; }}
em {{ color: var(--fg-dim); font-style: normal; }}
details {{ margin: 12px 0; padding: 8px 16px; border-left: 3px solid var(--primary); background: var(--surface); border-radius: 4px; }}
summary {{ cursor: pointer; color: var(--fg-muted); }}
a {{ color: var(--primary); }}
</style>
</head>
<body>{body}</body>
</html>"""
    return html, html_fname


def _bookmark_db_path() -> str:
    import os
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    return os.path.join(data_dir, "bookmarks.db")


def export_single(session_id: str, fmt: str) -> tuple[bytes, str, str]:
    if fmt == "html":
        content, fname = generate_html(session_id)
    else:
        content, fname = generate_markdown(session_id)
    data = content.encode("utf-8")
    mime = "text/html" if fmt == "html" else "text/markdown"
    return data, fname, mime


def export_multi(session_ids: list[str], fmt: str) -> tuple[bytes, str]:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for sid in session_ids:
            content, fname, _ = export_single(sid, fmt)
            zf.writestr(fname, content)
    buf.seek(0)
    return buf.read(), "sessions_export.zip"


@router.get("/sessions/{session_id}/export")
def route_export_single(session_id: str, format: str = Query("md", pattern="^(md|html)$")):
    data, fname, mime = export_single(session_id, format)
    encoded = quote(fname)
    return Response(
        content=data,
        media_type=f"{mime}; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )


@router.post("/sessions/export")
def route_export_multi(body: dict):
    session_ids = body.get("session_ids", [])
    fmt = body.get("format", "md")
    if not session_ids:
        return {"code": 400, "msg": "请选择要导出的会话", "data": None}
    data, fname = export_multi(session_ids, fmt)
    encoded = quote(fname)
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )


def _export_all_sqlite() -> tuple[bytes, str]:
    machine = os.environ.get("COMPUTERNAME", socket.gethostname())
    src = db.connect(state.db_path)

    fd, tmp = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    dest = sqlite3.connect(tmp)

    dest.execute("ATTACH DATABASE ? AS src", (state.db_path,))
    for table in ("session", "message", "part"):
        dest.execute(f"CREATE TABLE IF NOT EXISTS {table} AS SELECT * FROM src.{table}")
    dest.execute("DETACH src")

    count = dest.execute("SELECT COUNT(*) FROM session").fetchone()[0]
    dest.execute("CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT)")
    dest.execute("INSERT INTO _meta VALUES ('machine', ?)", (machine,))
    dest.execute("INSERT INTO _meta VALUES ('export_date', ?)",
                  (datetime.datetime.now().isoformat(),))
    dest.execute("INSERT INTO _meta VALUES ('session_count', ?)", (str(count),))
    dest.commit()
    dest.close()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(tmp, "export.db")
        manifest = json.dumps({
            "machine": machine,
            "export_date": datetime.datetime.now().isoformat(),
            "session_count": count,
        }, indent=2, ensure_ascii=False)
        zf.writestr("manifest.json", manifest)

    os.unlink(tmp)
    buf.seek(0)
    today = datetime.date.today().isoformat()
    fname = f"opencode-export_{machine}_{today}.zip"
    return buf.read(), fname


@router.post("/export")
def route_export_all():
    try:
        data, fname = _export_all_sqlite()
    except Exception as e:
        return {"code": 500, "msg": f"导出失败: {e}", "data": None}
    encoded = quote(fname)
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded}"},
    )
