from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel

from app.config import settings
from app.services.auth import authenticate, create_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(payload: LoginRequest, response: Response) -> dict:
    if not authenticate(payload.username, payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")
    token = create_token(payload.username)
    response.set_cookie(
        key=settings.session_cookie,
        value=token,
        max_age=settings.session_max_age,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return {"username": payload.username}


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(settings.session_cookie, path="/")
    return {"ok": True}


@router.get("/me")
def me(username: str = Depends(get_current_user)) -> dict:
    return {"username": username}
