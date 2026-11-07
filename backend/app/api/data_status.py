from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.analysis import AnalysisError, data_status

router = APIRouter(tags=["data-status"])


@router.get("/data-status")
def get_data_status(
    period: str = Query("2025-09"),
    store: str = Query("all"),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return data_status(db, period, store)
    except AnalysisError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
