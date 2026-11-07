from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.services import analysis

router = APIRouter(prefix="/analysis", tags=["analysis"])

DEFAULT_PERIOD = "2025-09"


def _run(func, *args, **kwargs) -> dict:
    try:
        return func(*args, **kwargs)
    except analysis.AnalysisError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/overview")
def overview(
    period: str = Query(DEFAULT_PERIOD),
    baseline: str = Query("yoy"),
    store: str = Query("all"),
    mode: str = Query("month"),
    brand: str = Query("all"),
    db: Session = Depends(get_db),
) -> dict:
    return _run(analysis.overview, db, period, baseline, store, mode, brand)


@router.get("/profit")
def profit(
    period: str = Query(DEFAULT_PERIOD),
    baseline: str = Query("yoy"),
    store: str = Query("all"),
    mode: str = Query("month"),
    brand: str = Query("all"),
    db: Session = Depends(get_db),
) -> dict:
    return _run(analysis.profit, db, period, baseline, store, mode, brand)


@router.get("/revenue/structure")
def revenue_structure(
    dimension: str = Query("channel"),
    period: str = Query(DEFAULT_PERIOD),
    baseline: str = Query("yoy"),
    store: str = Query("all"),
    mode: str = Query("month"),
    brand: str = Query("all"),
    db: Session = Depends(get_db),
) -> dict:
    return _run(analysis.revenue_structure, db, period, dimension, baseline, store, mode, brand)


@router.get("/revenue/same-store")
def revenue_same_store(
    period: str = Query(DEFAULT_PERIOD),
    baseline: str = Query("yoy"),
    brand: str = Query("all"),
    db: Session = Depends(get_db),
) -> dict:
    return _run(analysis.revenue_same_store, db, period, baseline, brand)


@router.get("/revenue/store/{store_id}")
def revenue_store(
    store_id: int,
    period: str = Query(DEFAULT_PERIOD),
    baseline: str = Query("yoy"),
    brand: str = Query("all"),
    db: Session = Depends(get_db),
) -> dict:
    return _run(analysis.revenue_store, db, period, store_id, baseline, brand)


@router.get("/revenue/channel")
def revenue_channel(
    period: str = Query(DEFAULT_PERIOD),
    baseline: str = Query("yoy"),
    brand: str = Query("all"),
    db: Session = Depends(get_db),
) -> dict:
    return _run(analysis.revenue_channel, db, period, baseline, brand)


@router.get("/revenue/channel/{channel_id}")
def revenue_channel_detail(
    channel_id: int,
    period: str = Query(DEFAULT_PERIOD),
    baseline: str = Query("yoy"),
    brand: str = Query("all"),
    db: Session = Depends(get_db),
) -> dict:
    return _run(analysis.revenue_channel_detail, db, period, channel_id, baseline, brand)


@router.get("/revenue/product")
def revenue_product(
    scope: str = Query("all"),
    period: str = Query(DEFAULT_PERIOD),
    baseline: str = Query("yoy"),
    brand: str = Query("all"),
    db: Session = Depends(get_db),
) -> dict:
    return _run(analysis.revenue_product, db, period, scope, baseline, brand)


@router.get("/revenue/conclusion")
def revenue_conclusion(
    period: str = Query(DEFAULT_PERIOD),
    baseline: str = Query("yoy"),
    brand: str = Query("all"),
    db: Session = Depends(get_db),
) -> dict:
    return _run(analysis.revenue_conclusion, db, period, baseline, brand)


@router.get("/thresholds")
def thresholds() -> dict:
    """洞察阈值（api-contract.md 第 5 节），前端可读取展示。"""
    return {
        "data": {
            "platform_fee_rate_max": settings.platform_fee_rate_max,
            "gross_roi_min": settings.gross_roi_min,
            "sales_roi_min": settings.sales_roi_min,
            "funnel_cvr_drop": settings.funnel_cvr_drop,
            "top_n": settings.top_n,
        }
    }
