"""维度表（design.md 第 10 节）。"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.common import utcnow


from app.db import Base


class Brand(Base):
    __tablename__ = "brand"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)


class Store(Base):
    __tablename__ = "store"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    brand_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    region: Mapped[str] = mapped_column(String(32))
    # 直营 / 加盟 / 联营
    business_model: Mapped[str] = mapped_column(String(16))
    # MALL / 社区街边 / 写字楼 / 交通枢纽
    store_type: Mapped[str] = mapped_column(String(16))
    opened_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    closed_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    area_m2: Mapped[float | None] = mapped_column(Float, nullable=True)
    seats: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Account(Base):
    __tablename__ = "account"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    # variable / fixed / revenue
    cost_behavior: Mapped[str] = mapped_column(String(16), default="fixed")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Channel(Base):
    __tablename__ = "channel"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    # 堂食 / 外卖
    category: Mapped[str] = mapped_column(String(16))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class ProductSeries(Base):
    __tablename__ = "product_series"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Product(Base):
    __tablename__ = "product"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    series_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    is_set: Mapped[bool] = mapped_column(Boolean, default=False)


class Period(Base):
    __tablename__ = "period"

    id: Mapped[str] = mapped_column(String(7), primary_key=True)  # YYYY-MM
    year: Mapped[int] = mapped_column(Integer)
    month: Mapped[int] = mapped_column(Integer)


class ImportBatch(Base):
    """导入批次。draft 阶段把解析结果放在 payload_json，commit 后写事实表。"""

    __tablename__ = "import_batch"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dataset: Mapped[str] = mapped_column(String(32), index=True)
    dataset_name: Mapped[str] = mapped_column(String(64), default="")
    filename: Mapped[str] = mapped_column(String(255), default="")
    period_from: Mapped[str | None] = mapped_column(String(7), nullable=True)
    period_to: Mapped[str | None] = mapped_column(String(7), nullable=True)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    operator: Mapped[str] = mapped_column(String(64), default="admin")
    # draft / committed / rolled_back
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    committed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rolled_back_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    errors_json: Mapped[str] = mapped_column(Text, default="[]")
    warnings_json: Mapped[str] = mapped_column(Text, default="[]")
    preview_json: Mapped[str] = mapped_column(Text, default="[]")
    payload_json: Mapped[str] = mapped_column(Text, default="[]")
    coverage_json: Mapped[str] = mapped_column(Text, default="[]")
