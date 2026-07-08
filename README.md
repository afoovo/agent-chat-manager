# ChatManager

AI 编程助手对话记录浏览与管理工具。在本地查看、搜索、分析你的 OpenCode 对话历史，所有数据留在你的机器上。

## 功能

- **对话浏览** — 按会话列表查看完整对话，支持代码差异对比、消息折叠展开
- **全文搜索** — FTS5 搜索引擎，支持按 Agent、时间范围筛选
- **数据仪表盘** — 使用统计、成本追踪、Token 用量、模型/Agent 分布
- **导出导入** — 导出会话为 `.db` 文件，也支持从其他机器导入
- **书签标注** — 为重要会话添加书签和自定义标签
- **暗色模式** — 明暗主题切换，自动跟随系统设置

## 快速开始

### 一键启动（Windows）

1. 下载项目
2. 双击 `首次安装.bat`（首次运行，自动安装依赖）
3. 双击 `一键启动.bat` — 浏览器自动打开 http://localhost:5173

### 手动安装

**前置要求：** Python 3.11+，Node.js 18+

```bash
# 后端
cd backend
python -m venv venv
venv\Scripts\activate          # Linux/macOS 用: source venv/bin/activate
pip install -r requirements.txt
python main.py                 # 自动探测 opencode.db 位置

# 前端
cd frontend
npm install
npm run dev:all                # 单窗口同时启动前后端
```

## 项目结构

```
├── backend/
│   ├── main.py                # FastAPI 入口（端口 8000）
│   ├── db.py                  # SQLite 查询层（只读）
│   ├── db_search.py           # FTS5 全文搜索引擎
│   ├── db_import.py           # 多机数据导入管理
│   └── routes/                # API 接口
├── frontend/
│   ├── src/
│   │   ├── components/        # React 组件（侧边栏、会话列表、仪表盘等）
│   │   ├── hooks/             # 自定义 hooks
│   │   └── lib/               # API 客户端、类型定义、工具函数
│   ├── package.json
│   └── vite.config.ts         # Vite 开发服务器（端口 5173，/api 代理到后端）
├── 首次安装.bat                # 一键环境安装
└── 一键启动.bat                # 一键启动服务
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python, FastAPI, SQLite3, uvicorn |
| 前端 | React 19, TypeScript, Vite, Tailwind CSS v4 |
| 搜索 | SQLite FTS5 外部内容表 |
| 图表 | Recharts |
| 数据获取 | TanStack React Query v5 |

## 数据来源

程序以只读方式连接 OpenCode 本地数据库，默认位置：

| 系统 | 路径 |
|------|------|
| Windows | `%LOCALAPPDATA%\opencode\opencode.db` |
| Linux | `~/.local/share/opencode/opencode.db` |
| macOS | `~/Library/Application Support/opencode/opencode.db` |

## 许可证

MIT
