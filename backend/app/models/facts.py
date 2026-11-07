"""事实表（design.md 第 10 节）。

覆盖导入语义：每个事实行有 import_batch_id；被更新批次覆盖的旧行写 superseded_by = 新批次 id，
查询时统一过滤 superseded_by IS NULL；回滚批次时删除该批次写入的行，并把 superseded_by 指回它的旧行恢复。
"""

from __future__ import annotations

from datetime import datetime


from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.common import utcnow


from app.db import Base


class _FactMixin:
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    import_batch_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    superseded_by: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PLFact(_FactMixin, Base):
    """利润表事实：万元。store_id 为空表示品牌/全部门店口径。"""

    __tablename__ = "pl_fact"

    brand_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    store_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period: Mapped[str] = mapped_column(String(7), index=True)
    # actual / budget
    scenario: Mapped[str] = mapped_column(String(16), default="actual", index=True)
    account_id: Mapped[int] = mapped_column(Integer, index=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)


class StoreRevenueFact(_FactMixin, Base):
    """门店收入与客流；revenue 万元、traffic 人次、avg_ticket 元/人次（可空，空则反算）。"""

    __tablename__ = "store_revenue_fact"

    store_id: Mapped[int] = mapped_column(Integer, index=True)
    period: Mapped[str] = mapped_column(String(7), index=True)
    revenue: Mapped[float] = mapped_column(Float, default=0.0)
    traffic: Mapped[float] = mapped_column(Float, default=0.0)
    avg_ticket: Mapped[float | None] = mapped_column(Float, nullable=True)
    # 导入文件提供的同店/新店/闭店标识（优先于按开业日期推算），可为空
    store_flag: Mapped[str | None] = mapped_column(String(16), nullable=True)


class ChannelRevenueFact(_FactMixin, Base):
    """渠道收入：万元。store_id 为空表示全部/品牌口径（示例数据的渠道表是公司口径）。"""

    __tablename__ = "channel_revenue_fact"

    store_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period: Mapped[str] = mapped_column(String(7), index=True)
    channel_id: Mapped[int] = mapped_column(Integer, index=True)
    revenue: Mapped[float] = mapped_column(Float, default=0.0)


class ProductSalesFact(_FactMixin, Base):
    """产品销售：金额为元。产品系列汇总行 product_id 为空；单品/套餐行 product_id 有值。"""

    __tablename__ = "product_sales_fact"

    store_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period: Mapped[str] = mapped_column(String(7), index=True)
    product_series_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    product_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    qty: Mapped[float] = mapped_column(Float, default=0.0)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    dish_revenue: Mapped[float] = mapped_column(Float, default=0.0)
    discount: Mapped[float] = mapped_column(Float, default=0.0)
    actual_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    std_unit_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_set: Mapped[bool] = mapped_column(Boolean, default=False)


class FunnelFact(_FactMixin, Base):
    """线上漏斗：人数为人次；platform_fee 为元；缺失值存 NULL，不补 0。"""

    __tablename__ = "funnel_fact"

    store_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period: Mapped[str] = mapped_column(String(7), index=True)
    channel_id: Mapped[int] = mapped_column(Integer, index=True)
    exposure: Mapped[float | None] = mapped_column(Float, nullable=True)
    visits: Mapped[float | None] = mapped_column(Float, nullable=True)
    payers: Mapped[float | None] = mapped_column(Float, nullable=True)
    consumers: Mapped[float | None] = mapped_column(Float, nullable=True)
    brand_customers: Mapped[float | None] = mapped_column(Float, nullable=True)
    new_customers: Mapped[float | None] = mapped_column(Float, nullable=True)
    old_customers: Mapped[float | None] = mapped_column(Float, nullable=True)
    platform_fee: Mapped[float | None] = mapped_column(Float, nullable=True)


class DaypartFact(_FactMixin, Base):
    """时段客流：人次。"""

    __tablename__ = "daypart_fact"

    store_id: Mapped[int] = mapped_column(Integer, index=True)
    period: Mapped[str] = mapped_column(String(7), index=True)
    day_type: Mapped[str] = mapped_column(String(16))  # 工作日 / 节假日
    daypart: Mapped[str] = mapped_column(String(32))  # 9:00-14:00 等
    traffic: Mapped[float] = mapped_column(Float, default=0.0)


class BudgetFact(_FactMixin, Base):
    """预算：万元。"""

    __tablename__ = "budget_fact"

    brand_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    store_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period: Mapped[str] = mapped_column(String(7), index=True)
    account_id: Mapped[int] = mapped_column(Integer, index=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)


class TargetFact(_FactMixin, Base):
    """渠道增收提价目标（第二步-收入异动分析 表8）。"""

    __tablename__ = "target_fact"

    period: Mapped[str] = mapped_column(String(7), index=True)
    channel_id: Mapped[int] = mapped_column(Integer, index=True)
    new_customers: Mapped[float | None] = mapped_column(Float, nullable=True)
    exposure_cvr: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_ticket: Mapped[float | None] = mapped_column(Float, nullable=True)
    gross_margin: Mapped[float | None] = mapped_column(Float, nullable=True)
    cac: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_roi: Mapped[float | None] = mapped_column(Float, nullable=True)
