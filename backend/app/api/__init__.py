from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api import analysis, auth, data_status, imports
from app.services.auth import get_current_user

# 公开路由（登录）
public_router = APIRouter()
public_router.include_router(auth.router)

# 其余接口一律要求登录（httpOnly JWT cookie）
protected_router = APIRouter(dependencies=[Depends(get_current_user)])
protected_router.include_router(analysis.router)
protected_router.include_router(imports.router)
protected_router.include_router(data_status.router)


@protected_router.get("/ping")
def ping() -> dict[str, str]:
    return {"pong": "pong"}


__all__ = ["public_router", "protected_router"]
