from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.importers import (
    DATASET_ORDER,
    ImportError_,
    batch_to_dict,
    commit_import,
    list_batches,
    render_template,
    rollback_import,
    stage_import,
    template_list,
)
from app.seeds.load_seed import load_seed

router = APIRouter(tags=["imports"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.get("/imports/templates")
def templates() -> list[dict]:
    return template_list()


@router.get("/imports/templates/{key}.xlsx")
def download_template(key: str) -> Response:
    if key not in DATASET_ORDER:
        raise HTTPException(status_code=404, detail=f"未知数据集：{key}")
    content = render_template(key)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{key}.xlsx"'},
    )


@router.post("/imports")
async def upload_import(
    dataset: str = Form(...),
    file: UploadFile = File(...),
    account_mapping: str | None = Form(default=None),
    operator: str = Form(default="admin"),
    db: Session = Depends(get_db),
) -> dict:
    if dataset not in DATASET_ORDER:
        raise HTTPException(status_code=400, detail=f"未知数据集：{dataset}")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件超过 10MB 上限")
    if not content:
        raise HTTPException(status_code=400, detail="文件为空")
    mapping = None
    if account_mapping:
        try:
            mapping = json.loads(account_mapping)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="account_mapping 必须是 JSON 对象") from exc
        if not isinstance(mapping, dict):
            raise HTTPException(status_code=400, detail="account_mapping 必须是 JSON 对象")
    try:
        batch = stage_import(db, dataset, file.filename or f"{dataset}.csv", content, operator, mapping)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return batch_to_dict(batch)


@router.post("/imports/{batch_id}/commit")
def commit(batch_id: int, db: Session = Depends(get_db)) -> dict:
    try:
        batch = commit_import(db, batch_id)
    except ImportError_ as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return batch_to_dict(batch)


@router.post("/imports/{batch_id}/rollback")
def rollback(batch_id: int, db: Session = Depends(get_db)) -> dict:
    try:
        batch = rollback_import(db, batch_id)
    except ImportError_ as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return batch_to_dict(batch)


@router.get("/imports")
def batches(limit: int = Query(20, ge=1, le=200), db: Session = Depends(get_db)) -> dict:
    items = [batch_to_dict(batch) for batch in list_batches(db, limit)]
    return {"data": items, "total": len(items)}


@router.post("/seeds/load")
def seeds_load(force: bool = Query(False), db: Session = Depends(get_db)) -> dict:
    try:
        result = load_seed(force=force)
    except ImportError_ as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"data": result}
