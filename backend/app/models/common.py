"""模型层公共工具。"""

from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    """当前 UTC 时间（去掉 tzinfo，兼容 SQLite / 可换 PostgreSQL 时再改 TIMESTAMPTZ）。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)
