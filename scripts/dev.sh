#!/usr/bin/env bash
# 一期开发环境：后端 8000 + 前端 5173
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  [[ -n "${BACK_PID:-}" ]] && kill "$BACK_PID" 2>/dev/null || true
  [[ -n "${FRONT_PID:-}" ]] && kill "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [[ ! -x "$ROOT/backend/.venv/bin/python" ]]; then
  echo "缺少 backend/.venv，请先创建虚拟环境并安装 backend/requirements.txt" >&2
  exit 1
fi

(cd "$ROOT/backend" && .venv/bin/python -m uvicorn app.main:app --reload --port 8000) &
BACK_PID=$!

if [[ -d "$ROOT/frontend/node_modules" ]]; then
  (cd "$ROOT/frontend" && VITE_API_MODE="${VITE_API_MODE:-real}" npm run dev -- --port 5173) &
  FRONT_PID=$!
else
  echo "前端依赖未安装，跳过前端启动（cd frontend && npm install）" >&2
fi

echo "后端 http://127.0.0.1:8000/docs ｜ 前端 http://127.0.0.1:5173 ｜ Ctrl+C 退出"
wait
