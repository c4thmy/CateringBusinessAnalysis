#!/usr/bin/env bash
# 一键加载示例数据（走与正式导入完全相同的两阶段导入链路）。
#
#   bash scripts/load_seed.sh            # 删除本地 SQLite 后重新加载
#   bash scripts/load_seed.sh --force    # 不删库，覆盖已有示例数据
set -euo pipefail

cd "$(dirname "$0")/../backend"

if [ -x .venv/bin/python ]; then
  PY=.venv/bin/python
else
  PY=python3
fi

if [ "${1:-}" = "--force" ]; then
  "$PY" -m app.seeds.load_seed --force
else
  rm -f data/cba.db
  "$PY" -m app.seeds.load_seed
fi
