# Installation Guide

> Complete setup instructions for Apex Terminal — frontend and backend.

This guide walks you through cloning the repository, installing dependencies, configuring the environment, and verifying that everything runs correctly.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Cloning the Repository](#cloning-the-repository)
3. [Frontend Setup](#frontend-setup)
4. [Backend Setup](#backend-setup)
5. [Environment Configuration](#environment-configuration)
6. [Starting the Dev Server](#starting-the-dev-server)
7. [Verifying the Installation](#verifying-the-installation)
8. [Common Setup Issues](#common-setup-issues)

---

## Prerequisites

Before you begin, make sure the following tools are installed:

| Tool | Minimum Version | Check Command |
|------|----------------|---------------|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Python | 3.10+ | `python --version` |
| pip | 22+ | `pip --version` |
| Git | 2.30+ | `git --version` |

> **Tip:** Use [nvm](https://github.com/nvm-sh/nvm) to manage multiple Node.js versions without conflicts.

---

## Cloning the Repository

```bash
git clone https://github.com/your-org/apex-terminal.git
cd apex-terminal
```

The repository is structured as a monorepo:

```
apex-terminal/
├── frontend/       # React 19 + TypeScript + Vite 5
├── backend/        # FastAPI + Python
├── docs/           # Documentation
└── demo/           # Standalone demo page
```

---

## Frontend Setup

```bash
cd frontend
npm install
```

This installs all dependencies including React 19, Zustand, Tailwind v4, lightweight-charts, and react-resizable-panels.

> **Note:** If you encounter peer-dependency warnings, run `npm install --legacy-peer-deps`.

---

## Backend Setup

```bash
cd ../backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

The backend uses FastAPI with uvicorn for serving REST and WebSocket endpoints.

---

## Environment Configuration

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
VITE_DEFAULT_THEME=dark
```

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=sqlite:///./apex.db
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=http://localhost:5100
DATA_PROVIDER=polygon
```

> **Warning:** Never commit `.env` files to version control. Both directories include `.env` in `.gitignore`.

---

## Starting the Dev Server

### Frontend (port 5100)

```bash
cd frontend
npm run dev
```

Vite starts on `http://localhost:5100` with hot module replacement enabled.

### Backend (port 8000)

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

![Dev Server Running](../assets/screenshots/dev-server-running.png)

---

## Verifying the Installation

1. Open `http://localhost:5100` in Chrome, Firefox, or Edge.
2. Confirm the dashboard loads with placeholder data.
3. Open DevTools → Network tab and verify WebSocket connection to `ws://localhost:8000/ws`.
4. Press `Ctrl+K` to confirm the command bar opens.
5. Navigate to a chart view and verify candlesticks render.

```bash
# Quick health check for the backend
curl http://localhost:8000/health
# Expected: {"status": "ok"}
```

---

## Common Setup Issues

| Problem | Solution |
|---------|----------|
| `npm install` fails on node-gyp | Install build tools: `npm install -g node-gyp` |
| Port 5100 already in use | Kill the process or set `VITE_PORT=5101` in `.env` |
| Python venv activation fails | Use `python3 -m venv venv` on systems where `python` points to 2.x |
| CORS errors in browser | Ensure `CORS_ORIGINS` in backend `.env` matches the frontend URL |
| WebSocket disconnects immediately | Verify both servers are running and ports match `.env` values |

> **Tip:** Run `npm run lint` and `npm run type-check` after setup to catch configuration issues early.

---

*Proceed to [Getting Started](GETTING_STARTED.md) for a walkthrough of the interface.*
