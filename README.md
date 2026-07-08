# ChatManager

Local chat history viewer for AI coding agents. Browse, search, and visualize your OpenCode conversation history — all data stays on your machine.

## Features

- **Conversation Browser** — Browse all chat sessions with session list, message view, inline code diffs
- **Full-Text Search** — Search across all conversations via FTS5, with agent/time filters
- **Dashboard Analytics** — Usage stats, cost tracking, token usage, model/agent breakdowns
- **Export & Import** — Export sessions to portable `.db` files, import from other machines
- **Bookmarks & Tags** — Bookmark important sessions, add custom tags
- **Dark Mode** — Light/dark theme with system preference auto-detect

## Quick Start

### One-Click (Windows)

1. Download the project
2. Double-click `首次安装.bat` to install dependencies (first time only)
3. Double-click `一键启动.bat` to launch — browser opens at http://localhost:5173

### Manual Setup

**Prerequisites:** Python 3.11+, Node.js 18+

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate        # or `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
python main.py               # auto-detects opencode.db location

# Frontend
cd frontend
npm install
npm run dev:all              # starts backend + frontend in one terminal
```

## Architecture

```
├── backend/
│   ├── main.py              # FastAPI entry (port 8000)
│   ├── db.py                # SQLite query layer (read-only)
│   ├── db_search.py         # FTS5 search engine + cache
│   ├── db_import.py         # Imported machine DB manager
│   └── routes/              # API endpoints
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # useTheme, useBookmarks
│   │   └── lib/             # API client, types, utilities
│   ├── package.json
│   └── vite.config.ts       # Vite (port 5173, proxies /api to :8000)
├── 首次安装.bat              # One-click setup (Windows)
└── 一键启动.bat              # One-click launch (Windows)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, SQLite3, uvicorn |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Search | SQLite FTS5 |
| Charts | Recharts |
| Data | TanStack React Query v5 |

## Data Source

Reads from OpenCode's local database (read-only). Default locations:

| Platform | Path |
|----------|------|
| Windows | `%LOCALAPPDATA%\opencode\opencode.db` |
| Linux | `~/.local/share/opencode/opencode.db` |
| macOS | `~/Library/Application Support/opencode/opencode.db` |

## License

MIT
