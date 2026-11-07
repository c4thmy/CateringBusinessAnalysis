"""pytest 全局配置：把数据库指向临时 SQLite，并提供 shared/fixtures 读取工具。"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

# 必须在导入 app.* 之前设置，app.config 在 import 时读取环境变量
_TMP_DIR = tempfile.mkdtemp(prefix="cba-test-")
os.environ["CBA_DATABASE_URL"] = f"sqlite:///{_TMP_DIR}/cba.db"
os.environ["CBA_SESSION_SECRET"] = "test-secret-32bytes-minimum-for-hs256"
os.environ["CBA_ADMIN_USERNAME"] = "admin"
os.environ["CBA_ADMIN_PASSWORD"] = "admin123"

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = REPO_ROOT / "shared" / "fixtures"


def load_fixture(name: str) -> dict:
    with open(FIXTURES_DIR / f"{name}.json", encoding="utf-8") as fh:
        return json.load(fh)
