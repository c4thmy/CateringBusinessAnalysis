from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import protected_router, public_router
from app.config import settings
from app.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # 幂等建表；正式迁移用 alembic upgrade head
    yield


app = FastAPI(title=settings.app_name, version="0.3.4", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public_router, prefix="/api")
app.include_router(protected_router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def api_not_found(rest: str) -> None:
    raise HTTPException(status_code=404, detail=f"未知接口：/api/{rest}")



def _resolve_dist_file(full_path: str) -> Path | None:
    root = settings.frontend_dist.resolve()
    try:
        target = (root / full_path).resolve()
    except (OSError, ValueError):
        return None
    if not target.is_relative_to(root) or not target.is_file():
        return None
    return target

# 生产：前端构建产物由 FastAPI 托管；开发时用 vite dev server。
_dist = Path(settings.frontend_dist)
if _dist.exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str) -> FileResponse:
        # 防路径穿越：只允许 dist 目录内的真实文件，其余回到 index.html
        target = _resolve_dist_file(full_path)
        if target is not None:
            return FileResponse(target)
        return FileResponse(_dist / "index.html")
