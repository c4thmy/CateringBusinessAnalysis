"""认证：bcrypt 密码校验 + httpOnly JWT cookie。"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Cookie, HTTPException, status

from app.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# 账号来自环境变量：默认用明文初始化后哈希；也支持直接给 CBA_ADMIN_PASSWORD_HASH。
_PASSWORD_HASH: str | None = None


def _admin_hash() -> str:
    global _PASSWORD_HASH
    if _PASSWORD_HASH is None:
        _PASSWORD_HASH = os.getenv("CBA_ADMIN_PASSWORD_HASH") or hash_password(settings.admin_password)
    return _PASSWORD_HASH


def authenticate(username: str, password: str) -> bool:
    if username != settings.admin_username:
        # 仍执行一次校验，避免通过时间差枚举账号
        verify_password(password, _admin_hash())
        return False
    return verify_password(password, _admin_hash())


def create_token(username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=settings.session_max_age)).timestamp()),
    }
    return jwt.encode(payload, settings.session_secret, algorithm="HS256")


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.session_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录或会话已过期") from exc
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录或会话已过期")
    return username


def get_current_user(cba_session: str | None = Cookie(default=None)) -> str:
    """FastAPI 依赖：cookie 缺失或无效返回 401。"""
    if not cba_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    return decode_token(cba_session)
