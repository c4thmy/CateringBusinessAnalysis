#!/usr/bin/env bash
# 一期冒烟：后端 pytest + 前端构建 + 关键接口数字断言
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACK="$ROOT/backend"
FRONT="$ROOT/frontend"
PORT="${SMOKE_PORT:-8010}"
BASE="http://127.0.0.1:$PORT"

cleanup() { [[ -n "${PID:-}" ]] && kill "$PID" 2>/dev/null || true; [[ -n "${SMOKE_DIR:-}" ]] && rm -rf "$SMOKE_DIR"; }
trap cleanup EXIT INT TERM

echo "== 后端测试 =="
(cd "$BACK" && .venv/bin/python -m pytest)

echo "== 前端构建 =="
(cd "$FRONT" && npm run build)

echo "== 空库加载示例数据（临时库，不碰演示库 backend/data/cba.db） =="
SMOKE_DIR="$(mktemp -d)"
export CBA_DATABASE_URL="sqlite:///$SMOKE_DIR/cba_smoke.db"
rm -f "$SMOKE_DIR/cba_smoke.db"
(cd "$BACK" && CBA_DATABASE_URL="$CBA_DATABASE_URL" .venv/bin/python -m app.seeds.load_seed)

echo "== 起后端并断言 =="
(cd "$BACK" && CBA_DATABASE_URL="$CBA_DATABASE_URL" .venv/bin/python -m uvicorn app.main:app --port "$PORT" >/tmp/cba_smoke.log 2>&1) &
PID=$!
for _ in $(seq 1 30); do curl -sf "$BASE/api/health" >/dev/null && break; sleep 0.5; done

COOKIE=/tmp/cba_smoke_cookie
curl -sf -c "$COOKIE" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' >/dev/null || { echo "FAIL 登录失败"; exit 1; }
echo "OK 登录 admin"

check() {
  local path="$1" expect="$2"
  local body
  body="$(curl -sf -b "$COOKIE" "$BASE$path")" || { echo "FAIL $path 请求失败"; exit 1; }
  echo "$body" | grep -q "$expect" || { echo "FAIL $path 未包含 $expect"; echo "$body" | head -c 500; exit 1; }
  echo "OK $path 包含 $expect"
}

check "/api/health" 'ok'
check "/api/analysis/overview" '1000'
check "/api/analysis/revenue/same-store" '857.23'
check "/api/analysis/revenue/channel" '394.23'
check "/api/analysis/revenue/product?scope=all" '770933.33'

echo "== 前端构建产物存在 =="
test -f "$FRONT/dist/index.html" || { echo "FAIL 缺少 frontend/dist/index.html"; exit 1; }
echo "SMOKE PASS"
