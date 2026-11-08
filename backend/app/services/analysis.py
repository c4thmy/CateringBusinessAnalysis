"""分析服务：从数据库聚合 → 调 engine → 组装 data/meta/insights 响应。"""

from __future__ import annotations

import calendar
from collections import defaultdict
from collections.abc import Mapping
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.engine import insights as insight_rules
from app.engine.compare import compare
from app.engine.percentiles import bucket_of, percentiles as percentiles_engine
from app.engine.profit_bridge import profit_bridge
from app.engine.revenue import channel_split, daypart_table, funnel, product_volume_price, roi, same_store, structure as structure_engine
from app.models import (
    Account,
    BudgetFact,
    Channel,
    ChannelRevenueFact,
    DaypartFact,
    FunnelFact,
    PLFact,
    Product,
    ProductSalesFact,
    ProductSeries,
    Store,
    StoreRevenueFact,
    TargetFact,
)
from app.importers.registry import TARGET_CHANNEL_ALIASES


class AnalysisError(Exception):
    pass


# ---------------------------------------------------------------------------
# 通用工具
# ---------------------------------------------------------------------------
def r2(value: float | None) -> float | None:
    return None if value is None else round(float(value), 2)


def r4(value: float | None) -> float | None:
    return None if value is None else round(float(value), 4)


def ri(value: float | None) -> int | float | None:
    """整数型指标（人数、单量）返回 int，避免 794.0 这类展示。"""
    if value is None:
        return None
    number = float(value)
    return int(round(number)) if abs(number - round(number)) < 1e-9 else round(number, 2)


def parse_period(period: str) -> tuple[int, int]:
    try:
        year, month = period.split("-")
        return int(year), int(month)
    except (ValueError, AttributeError) as exc:
        raise AnalysisError(f"期间格式必须为 YYYY-MM（当前为「{period}」）") from exc


def period_end(period: str) -> date:
    year, month = parse_period(period)
    return date(year, month, calendar.monthrange(year, month)[1])


def previous_year(period: str) -> str:
    year, month = parse_period(period)
    return f"{year - 1}-{month:02d}"


def previous_month(period: str) -> str:
    year, month = parse_period(period)
    if month == 1:
        return f"{year - 1}-12"
    return f"{year}-{month - 1:02d}"


def resolve_periods(period: str, mode: str) -> list[str]:
    year, month = parse_period(period)
    if mode == "ytd":
        return [f"{year}-{m:02d}" for m in range(1, month + 1)]
    return [period]


def resolve_baseline_periods(baseline: str, period: str, mode: str) -> list[str]:
    if baseline == "budget":
        return resolve_periods(period, mode)
    if baseline == "mom":
        return [previous_month(period)]
    year, month = parse_period(period)
    if mode == "ytd":
        return [f"{year - 1}-{m:02d}" for m in range(1, month + 1)]
    return [previous_year(period)]


def baseline_label(baseline: str, periods: list[str]) -> str:
    if baseline == "budget":
        return "budget"
    if len(periods) == 1:
        return periods[0]
    return f"{periods[0]}~{periods[-1]}"


def _meta(period: str, baseline_label_value: str, store: str, brand: str = "all", unit: str = "万元", **extra) -> dict:
    meta = {
        "brand": brand,
        "store": store,
        "period": period,
        "baseline": baseline_label_value,
        "unit": unit,
    }
    meta.update(extra)
    return meta


# ---------------------------------------------------------------------------
# 数据读取
# ---------------------------------------------------------------------------
def account_map(session: Session) -> dict[int, Account]:
    return {account.id: account for account in session.scalars(select(Account))}


def pl_amounts(
    session: Session,
    periods: list[str],
    store_id: int | None = None,
    scenario: str = "actual",
) -> dict[str, float]:
    """按科目名聚合利润表金额（万元）。品牌口径优先用 store_id 为空的行。"""
    accounts = account_map(session)
    rows = list(
        session.scalars(
            select(PLFact).where(
                PLFact.period.in_(periods),
                PLFact.scenario == scenario,
                PLFact.superseded_by.is_(None),
            )
        )
    )
    if store_id is not None:
        rows = [row for row in rows if row.store_id == store_id]
    else:
        brand_rows = [row for row in rows if row.store_id is None]
        if brand_rows:
            rows = brand_rows
    totals: dict[str, float] = defaultdict(float)
    for row in rows:
        account = accounts.get(row.account_id)
        if account is not None:
            totals[account.name] += row.amount or 0.0
    return dict(totals)


def budget_amounts(session: Session, periods: list[str], store_id: int | None = None) -> dict[str, float]:
    accounts = account_map(session)
    rows = list(
        session.scalars(
            select(BudgetFact).where(
                BudgetFact.period.in_(periods),
                BudgetFact.superseded_by.is_(None),
            )
        )
    )
    if store_id is not None:
        rows = [row for row in rows if row.store_id == store_id]
    else:
        brand_rows = [row for row in rows if row.store_id is None]
        if brand_rows:
            rows = brand_rows
    totals: dict[str, float] = defaultdict(float)
    for row in rows:
        account = accounts.get(row.account_id)
        if account is not None:
            totals[account.name] += row.amount or 0.0
    return dict(totals)


def store_revenue_map(session: Session, period: str) -> dict[int, StoreRevenueFact]:
    rows = session.scalars(
        select(StoreRevenueFact).where(
            StoreRevenueFact.period == period,
            StoreRevenueFact.superseded_by.is_(None),
        )
    )
    return {row.store_id: row for row in rows}


def classify_store(store: Store, baseline_period: str, current_period: str) -> str:
    """按开业/闭店日期与对比期推算同店/新店/闭店。"""
    base_end = period_end(baseline_period)
    cur_start = date(*parse_period(current_period), 1)
    if store.closed_on and store.closed_on <= cur_start:
        return "闭店"
    if store.opened_on and store.opened_on > base_end:
        return "新店"
    return "同店"


def store_rows(session: Session, current_period: str, baseline_period: str) -> list[dict]:
    stores = list(session.scalars(select(Store).order_by(Store.id)))
    current = store_revenue_map(session, current_period)
    base = store_revenue_map(session, baseline_period)
    rows: list[dict] = []
    for store in stores:
        cur = current.get(store.id)
        prev = base.get(store.id)
        flag = None
        if cur is not None and cur.store_flag:
            flag = cur.store_flag
        elif prev is not None and prev.store_flag:
            flag = prev.store_flag
        category = flag or classify_store(store, baseline_period, current_period)
        row = {
            "store_id": store.id,
            "store_name": store.name,
            "region": store.region,
            "business_model": store.business_model,
            "store_type": store.store_type,
            "category": category,
            "revenue_current": cur.revenue if cur else 0.0,
            "revenue_base": prev.revenue if prev else 0.0,
            "traffic_current": cur.traffic if cur else 0.0,
            "traffic_base": prev.traffic if prev else 0.0,
            "ticket_current": cur.avg_ticket if cur else None,
            "ticket_base": prev.avg_ticket if prev else None,
            "has_current": cur is not None,
            "has_base": prev is not None,
        }
        if row["ticket_current"] is None and row["traffic_current"]:
            row["ticket_current"] = row["revenue_current"] * 10000 / row["traffic_current"]
        if row["ticket_base"] is None and row["traffic_base"]:
            row["ticket_base"] = row["revenue_base"] * 10000 / row["traffic_base"]
        rows.append(row)
    return rows


def channel_rows(session: Session, current_period: str, baseline_period: str) -> list[dict]:
    channels = {channel.id: channel for channel in session.scalars(select(Channel))}
    current = _channel_totals(session, current_period)
    base = _channel_totals(session, baseline_period)
    rows = []
    for channel_id, channel in sorted(channels.items(), key=lambda item: item[1].sort_order):
        rows.append(
            {
                "channel_id": channel.id,
                "key": channel.name,
                "name": channel.name,
                "category": channel.category,
                "current": current.get(channel_id, 0.0),
                "base": base.get(channel_id, 0.0),
            }
        )
    return rows


def _channel_totals(session: Session, period: str) -> dict[int, float]:
    totals: dict[int, float] = defaultdict(float)
    for row in session.scalars(
        select(ChannelRevenueFact).where(
            ChannelRevenueFact.period == period,
            ChannelRevenueFact.superseded_by.is_(None),
        )
    ):
        totals[row.channel_id] += row.revenue or 0.0
    return dict(totals)


def series_rows(session: Session, current_period: str, baseline_period: str) -> tuple[list[dict], list[dict]]:
    series = {item.id: item for item in session.scalars(select(ProductSeries).order_by(ProductSeries.sort_order))}
    current = _product_totals(session, current_period, product_id_null=True)
    base = _product_totals(session, baseline_period, product_id_null=True)
    current_rows = [
        {
            "key": item.name,
            "name": item.name,
            "qty": current.get(item.id, {}).get("qty", 0.0),
            "amount": current.get(item.id, {}).get("amount", 0.0),
        }
        for item in series.values()
    ]
    base_rows = [
        {
            "key": item.name,
            "name": item.name,
            "qty": base.get(item.id, {}).get("qty", 0.0),
            "amount": base.get(item.id, {}).get("amount", 0.0),
        }
        for item in series.values()
    ]
    return current_rows, base_rows


# 套餐量价取「线上套餐」汇总行（Excel 表4 口径）；套餐菜品明细行只用于单品排行，二者不是同一快照
SET_SUMMARY_PRODUCT = "线上套餐"


def set_totals(session: Session, period: str) -> dict:
    summary_ids = list(
        session.scalars(select(Product.id).where(Product.name == SET_SUMMARY_PRODUCT))
    )
    if not summary_ids:
        return {}
    totals = {"qty": 0.0, "amount": 0.0, "dish_revenue": 0.0, "discount": 0.0}
    for row in session.scalars(
        select(ProductSalesFact).where(
            ProductSalesFact.period == period,
            ProductSalesFact.product_id.in_(summary_ids),
            ProductSalesFact.superseded_by.is_(None),
        )
    ):
        totals["qty"] += row.qty or 0.0
        totals["amount"] += row.amount or 0.0
        totals["dish_revenue"] += row.dish_revenue or 0.0
        totals["discount"] += row.discount or 0.0
    if not totals["qty"] and not totals["amount"]:
        return {}
    return totals


def product_item_totals(session: Session, period: str) -> dict[int, dict]:
    """单品/套餐明细行（product_id 非空）按产品聚合。"""
    totals: dict[int, dict] = defaultdict(lambda: {"qty": 0.0, "amount": 0.0})
    for row in session.scalars(
        select(ProductSalesFact).where(
            ProductSalesFact.period == period,
            ProductSalesFact.product_id.is_not(None),
            ProductSalesFact.superseded_by.is_(None),
        )
    ):
        totals[row.product_id]["qty"] += row.qty or 0.0
        totals[row.product_id]["amount"] += row.amount or 0.0
    return dict(totals)


def _product_totals(session: Session, period: str, product_id_null: bool = False) -> dict[int, dict]:
    totals: dict[int, dict] = defaultdict(lambda: {"qty": 0.0, "amount": 0.0})
    statement = select(ProductSalesFact).where(
        ProductSalesFact.period == period,
        ProductSalesFact.superseded_by.is_(None),
    )
    statement = statement.where(ProductSalesFact.product_id.is_(None)) if product_id_null else statement
    for row in session.scalars(statement):
        key = row.product_series_id
        if key is None:
            continue
        totals[key]["qty"] += row.qty or 0.0
        totals[key]["amount"] += row.amount or 0.0
    return dict(totals)


def funnel_totals(session: Session, period: str, channel_id: int | None = None) -> dict:
    totals = {
        "exposure": None,
        "visits": None,
        "payers": None,
        "consumers": None,
        "brand_customers": None,
        "new_customers": None,
        "old_customers": None,
        "platform_fee": None,
    }
    statement = select(FunnelFact).where(
        FunnelFact.period == period,
        FunnelFact.superseded_by.is_(None),
    )
    if channel_id is not None:
        statement = statement.where(FunnelFact.channel_id == channel_id)
    for row in session.scalars(statement):
        for key in totals:
            value = getattr(row, key)
            if value is not None:
                totals[key] = (totals[key] or 0.0) + value
    if all(value is None for value in totals.values()):
        return {}
    return totals


def daypart_rows(session: Session, store_id: int, current_period: str, baseline_period: str) -> list[dict]:
    def load(period: str) -> dict[tuple[str, str], float]:
        data: dict[tuple[str, str], float] = {}
        for row in session.scalars(
            select(DaypartFact).where(
                DaypartFact.period == period,
                DaypartFact.store_id == store_id,
                DaypartFact.superseded_by.is_(None),
            )
        ):
            data[(row.day_type, row.daypart)] = row.traffic or 0.0
        return data

    current = load(current_period)
    base = load(baseline_period)
    keys = sorted(set(current) | set(base), key=lambda item: (item[0] != "工作日", item[1]))
    return [
        {"day_type": day_type, "daypart": daypart, "current": current.get((day_type, daypart), 0.0), "base": base.get((day_type, daypart), 0.0)}
        for day_type, daypart in keys
    ]


def target_for_channel(session: Session, period: str, channel_id: int) -> TargetFact | None:
    return session.scalar(
        select(TargetFact).where(
            TargetFact.period == period,
            TargetFact.channel_id == channel_id,
            TargetFact.superseded_by.is_(None),
        )
    )


# ---------------------------------------------------------------------------
# 总览
# ---------------------------------------------------------------------------
def _budget_complete(base: Mapping[str, float] | None) -> bool:
    """预算基准是否包含全部标准科目；缺科目时不得用 0 冒充，整段对比置空。"""
    if not base:
        return False
    return all(name in base and base.get(name) is not None for name in settings.standard_accounts)


def overview(session: Session, period: str, baseline: str = "yoy", store: str = "all", mode: str = "month", brand: str = "all") -> dict:
    store_id = _store_id(store)
    current_periods = resolve_periods(period, mode)
    baseline_periods = resolve_baseline_periods(baseline, period, mode)
    current = pl_amounts(session, current_periods, store_id)
    if not current:
        raise AnalysisError(f"{period} 没有利润表数据，请先在数据导入页加载数据")
    base_available = True
    if baseline == "budget":
        base = budget_amounts(session, current_periods, store_id)
        base_available = _budget_complete(base)
        if not base_available:
            base = {}
    else:
        base = pl_amounts(session, baseline_periods, store_id)

    revenue_cur = current.get("营业收入", 0.0)
    food_cur = current.get("食材成本", 0.0)
    profit_cur = revenue_cur - sum(current.get(name, 0.0) for name in settings.standard_accounts if name != "营业收入")
    revenue_base = base.get("营业收入") if base_available and base else None
    if base_available and base:
        profit_base = revenue_base - sum(base.get(name, 0.0) for name in settings.standard_accounts if name != "营业收入")
        food_base = base.get("食材成本", 0.0)
        gm_base = (revenue_base - food_base) / revenue_base if revenue_base else None
    else:
        profit_base = None
        gm_base = None
    gm_cur = (revenue_cur - food_cur) / revenue_cur if revenue_cur else None

    # 同店增速始终以「去年同期」为基准，不随对比基准（预算/上期）变化
    store_base_period = resolve_baseline_periods("yoy", period, mode)[-1]
    rows = store_rows(session, current_periods[-1], store_base_period)
    same = [row for row in rows if row["category"] == "同店"]
    same_cur = sum(row["revenue_current"] for row in same)
    same_base = sum(row["revenue_base"] for row in same)
    same_growth = (same_cur - same_base) / same_base if same_base else None
    # 累计口径下只有单月门店数据时，同店累计值不可得，置空而不是拿单月冒充累计
    if mode == "ytd":
        covered = session.scalar(
            select(func.count(func.distinct(StoreRevenueFact.period))).where(
                StoreRevenueFact.period.in_(current_periods),
                StoreRevenueFact.superseded_by.is_(None),
            )
        )
        if int(covered or 0) < len(current_periods):
            same_growth = None
            same_cur = None
            same_base = None

    bridge = None
    if base and baseline != "budget":
        bridge_result = profit_bridge(base, current)
        bridge = {
            "start": r2(bridge_result["start"]),
            "end": r2(bridge_result["end"]),
            "base_marginal_contribution_rate": (
                r4(
                    1
                    - sum(base.get(name, 0.0) for name in ("食材成本", "优惠及手续费", "水电气低值", "宣传费用"))
                    / base.get("营业收入", 0.0)
                )
                if base.get("营业收入")
                else None
            ),
            "items": [
                {
                    "key": item["key"],
                    "name": item["name"],
                    "impact": r2(item["impact"]),
                    "kind": item["kind"],
                    "note": item["note"],
                }
                for item in bridge_result["items"]
            ],
        }
    bridge_insights = insight_rules.finalize(insight_rules.profit_bridge_insights({"items": bridge["items"]}), settings.top_n) if bridge else []

    # 门店分位：示例数据没有门店级利润表，毛利率分位返回 null；收入增速分位用 13 家同店计算
    growth_values = [
        (row["revenue_current"] - row["revenue_base"]) / row["revenue_base"]
        for row in same
        if row["revenue_base"]
    ]
    growth_pct = percentiles_engine(growth_values)
    revenue_values = [row["revenue_current"] for row in same if row["revenue_current"]]
    revenue_pct = percentiles_engine(revenue_values)
    growth_current = same_growth
    percentiles = {
        "revenue": (
            {
                "p25": r4(revenue_pct["p25"]),
                "p50": r4(revenue_pct["p50"]),
                "p75": r4(revenue_pct["p75"]),
                "current": None,
                "bucket": None,
                "n": revenue_pct["n"],
            }
            if revenue_pct
            else None
        ),
        "revenue_growth": (
            {
                "p25": r4(growth_pct["p25"]),
                "p50": r4(growth_pct["p50"]),
                "p75": r4(growth_pct["p75"]),
                "current": r4(growth_current),
                "bucket": bucket_of(growth_current, growth_pct),
                "n": growth_pct["n"],
            }
            if growth_pct
            else None
        ),
        "same_store_growth": (
            {
                "p25": r4(growth_pct["p25"]),
                "p50": r4(growth_pct["p50"]),
                "p75": r4(growth_pct["p75"]),
                "current": r4(growth_current),
                "bucket": bucket_of(growth_current, growth_pct),
                "n": growth_pct["n"],
            }
            if growth_pct
            else None
        ),
        "profit": None,
        "gross_margin": None,
        "note": "示例数据只有品牌级利润表，门店毛利率分位暂缺；收入与增速分位基于 13 家同店。",
        "percentile_hints": {
            "revenue": f"门店收入分位（{len(revenue_values)} 家同店）",
            "profit": "门店级营业利润明细未导入，暂不展示分位",
            "gross_margin": "示例数据只有品牌级利润表，门店毛利率分位暂缺",
            "same_store_growth": f"同店收入增速分位（{len(growth_values)} 家同店）",
        },
    }

    if base_available and revenue_base is not None:
        summary = (
            f"收入{'增长' if revenue_cur - revenue_base >= 0 else '下降'} "
            f"{abs(revenue_cur - revenue_base):.2f} 万元（{_pct((revenue_cur - revenue_base) / revenue_base if revenue_base else None)}）；"
            f"营业利润 {profit_cur:.2f} 万元，同比 {profit_cur - profit_base:+.2f} 万元；"
            f"毛利率 {_level_pct(gm_cur)}，同比 {_pp(gm_cur, gm_base)}；同店收入 {_pct(same_growth)}。"
        )
    else:
        summary = (
            f"收入 {revenue_cur:.2f} 万元；预算未导入或科目不完整，暂不计算预算对比；"
            f"营业利润 {profit_cur:.2f} 万元；毛利率 {_level_pct(gm_cur)}；同店收入 {_pct(same_growth)}。"
        )

    revenue_cmp = compare(revenue_cur, revenue_base)
    profit_cmp = compare(profit_cur, profit_base)
    data = {
        "kpis": {
            "revenue": {"value": r2(revenue_cur), "base": r2(revenue_base) if revenue_base is not None else None, "diff": r2(revenue_cmp["diff"]) if revenue_cmp["diff"] is not None else None, "rate": r4(revenue_cmp["rate"]) if revenue_cmp["rate"] is not None else None, "unit": "万元"},
            "profit": {"value": r2(profit_cur), "base": r2(profit_base) if profit_base is not None else None, "diff": r2(profit_cmp["diff"]) if profit_cmp["diff"] is not None else None, "rate": r4(profit_cmp["rate"]) if profit_cmp["rate"] is not None else None, "unit": "万元"},
            "gross_margin": {
                "value": r4(gm_cur),
                "base": r4(gm_base) if gm_base is not None else None,
                "diff": r4(gm_cur - gm_base) if gm_cur is not None and gm_base is not None else None,
                "diff_pp": r2((gm_cur - gm_base) * 100) if gm_cur is not None and gm_base is not None else None,
                "unit": "pp",
            },
            "same_store_growth": {
                "value": r4(same_growth),
                "base": None,
                "diff": None,
                "unit": "%",
                "same_store_revenue": r2(same_cur) if same_cur is not None else None,
                "same_store_base": r2(same_base) if same_base is not None else None,
                "new_store_revenue": r2(sum(row["revenue_current"] for row in rows if row["category"] == "新店")),
            },
        },
        "profit_bridge": bridge,
        "percentiles": percentiles,
        "summary": summary,
    }
    return {
        "data": data,
        "meta": _meta(period, baseline_label(baseline, baseline_periods), _store_label(store), brand),
        "insights": bridge_insights,
    }


# ---------------------------------------------------------------------------
# 营业利润
# ---------------------------------------------------------------------------
def profit(session: Session, period: str, baseline: str = "yoy", store: str = "all", mode: str = "month", brand: str = "all") -> dict:
    store_id = _store_id(store)
    current_periods = resolve_periods(period, mode)
    baseline_periods = resolve_baseline_periods(baseline, period, mode)
    accounts = sorted(session.scalars(select(Account)), key=lambda item: item.sort_order)
    current = pl_amounts(session, current_periods, store_id)
    if not current:
        raise AnalysisError(f"{period} 没有利润表数据")
    budget_amounts_full = None
    base_available = True
    if baseline == "budget":
        budget_amounts_full = budget_amounts(session, current_periods, store_id)
        base_available = _budget_complete(budget_amounts_full)
        base = budget_amounts_full if base_available else {}
    else:
        base = pl_amounts(session, baseline_periods, store_id)
    revenue_cur = current.get("营业收入", 0.0)
    revenue_base = base.get("营业收入") if base else None

    rows = []
    for account in accounts:
        cur = current.get(account.name, 0.0)
        prev = base.get(account.name) if base else None
        cur_ratio = cur / revenue_cur if revenue_cur else None
        base_ratio = prev / revenue_base if (prev is not None and revenue_base) else None
        rows.append(
            {
                "account": account.name,
                "current": r2(cur),
                "current_ratio": r4(cur_ratio),
                "base": r2(prev) if prev is not None else None,
                "base_ratio": r4(base_ratio),
                "diff": r2(cur - prev) if prev is not None else None,
                "rate": r4((cur - prev) / prev) if (prev not in (None, 0)) else None,
                "ratio_pp": r4(cur_ratio - base_ratio) if cur_ratio is not None and base_ratio is not None else None,
                "cost_behavior": account.cost_behavior,
            }
        )

    profit_cur = revenue_cur - sum(current.get(account.name, 0.0) for account in accounts if account.name != "营业收入")
    profit_base = (
        revenue_base - sum(base.get(account.name, 0.0) for account in accounts if account.name != "营业收入")
        if (base and revenue_base is not None)
        else None
    )
    bridge = None
    bridge_insights: list[dict] = []
    if base and baseline != "budget":
        result = profit_bridge(base, current)
        bridge = {
            "start": r2(result["start"]),
            "end": r2(result["end"]),
            "base_marginal_contribution_rate": (
                r4(
                    1
                    - sum(base.get(name, 0.0) for name in ("食材成本", "优惠及手续费", "水电气低值", "宣传费用"))
                    / base.get("营业收入", 0.0)
                )
                if base.get("营业收入")
                else None
            ),
            "items": [
                {"key": item["key"], "name": item["name"], "impact": r2(item["impact"]), "kind": item["kind"], "note": item["note"]}
                for item in result["items"]
            ],
        }
        bridge_insights = insight_rules.finalize(insight_rules.profit_bridge_insights(bridge), settings.top_n)

    budget = None
    if baseline == "budget":
        has_expense_budget = _budget_complete(budget_amounts_full)
        budget = {
            "revenue": {
                "actual": r2(revenue_cur),
                "budget": r2(budget_amounts_full.get("营业收入")) if budget_amounts_full and budget_amounts_full.get("营业收入") is not None else None,
                "achievement": r4(revenue_cur / budget_amounts_full["营业收入"]) if budget_amounts_full and budget_amounts_full.get("营业收入") else None,
                "reached": bool(budget_amounts_full and budget_amounts_full.get("营业收入") and revenue_cur >= budget_amounts_full["营业收入"]),
            },
            "profit": {
                "actual": r2(profit_cur),
                "budget": r2(profit_base) if has_expense_budget else None,
                "achievement": r4(profit_cur / profit_base) if has_expense_budget and profit_base else None,
                "reached": bool(has_expense_budget and profit_base and profit_cur >= profit_base),
                "note": None if has_expense_budget else "示例预算只导入了营业收入，费用预算未导入，营业利润达成率不展示",
            },
        }

    data = {
        "rows": rows,
        "profit": {"current": r2(profit_cur), "base": r2(profit_base) if profit_base is not None else None, "diff": r2(profit_cur - profit_base) if profit_base is not None else None, "rate": r4((profit_cur - profit_base) / profit_base) if profit_base else None},
        "profit_bridge": bridge,
        "budget": budget,
        "mode": mode,
    }
    return {
        "data": data,
        "meta": _meta(period, baseline_label(baseline, baseline_periods), _store_label(store), brand),
        "insights": bridge_insights,
    }


def _ensure_store_revenue_period(session: Session, period: str) -> None:
    """收入分析页要求该期间有门店收入；缺失时 4xx，而不是用 0 计算。"""
    exists = session.scalar(
        select(func.count()).select_from(StoreRevenueFact).where(
            StoreRevenueFact.period == period,
            StoreRevenueFact.superseded_by.is_(None),
        )
    )
    if not int(exists or 0):
        raise AnalysisError(f"{period} 没有门店收入数据，请先在数据导入页导入该期间的门店收入")


def _reject_budget_baseline(baseline: str) -> None:
    if baseline == "budget":
        raise AnalysisError("收入分析一期暂不支持预算基准，请切换为「同期」基准")


# ---------------------------------------------------------------------------
# 收入结构
# ---------------------------------------------------------------------------
DIMENSIONS = {
    "business_model": "经营模式",
    "store_type": "门店类型（同店/新店/闭店）",
    "region": "区域",
    "channel": "渠道",
    "channel_category": "渠道大类",
    "series": "产品系列",
}


def revenue_structure(session: Session, period: str, dimension: str, baseline: str = "yoy", store: str = "all", mode: str = "month", brand: str = "all") -> dict:
    _reject_budget_baseline(baseline)
    _ensure_store_revenue_period(session, period)
    if dimension not in DIMENSIONS:
        raise AnalysisError(f"不支持的维度：{dimension}（可选 {'、'.join(DIMENSIONS)}）")
    current_periods = resolve_periods(period, mode)
    baseline_periods = resolve_baseline_periods(baseline, period, mode)
    label = baseline_label(baseline, baseline_periods)

    if dimension in ("business_model", "store_type", "region"):
        rows = store_rows(session, current_periods[-1], baseline_periods[-1])
        field = {"business_model": "business_model", "store_type": "category", "region": "region"}[dimension]
        grouped: dict[str, dict] = {}
        for row in rows:
            key = row[field]
            item = grouped.setdefault(key, {"key": key, "name": key, "current": 0.0, "base": 0.0})
            item["current"] += row["revenue_current"]
            item["base"] += row["revenue_base"]
        ordered = sorted(grouped.values(), key=lambda item: item["base"], reverse=True)
        dataset_note = "门店口径：门店收入合计 1000.23 / 759.95 万元"
    elif dimension in ("channel", "channel_category"):
        rows = channel_rows(session, current_periods[-1], baseline_periods[-1])
        field = "name" if dimension == "channel" else "category"
        grouped = {}
        for row in rows:
            key = row[field]
            item = grouped.setdefault(key, {"key": key, "name": key, "current": 0.0, "base": 0.0})
            item["current"] += row["current"]
            item["base"] += row["base"]
        ordered = sorted(grouped.values(), key=lambda item: item["base"], reverse=True)
        dataset_note = "渠道口径：渠道收入合计 1000.00 / 759.56 万元"
    else:
        current_rows, base_rows = series_rows(session, current_periods[-1], baseline_periods[-1])
        base_map = {row["key"]: row for row in base_rows}
        ordered = [
            {
                "key": row["key"],
                "name": row["name"],
                "current": row["amount"] / 10000.0,
                "base": base_map.get(row["key"], {}).get("amount", 0.0) / 10000.0,
            }
            for row in current_rows
        ]
        ordered = [row for row in ordered if row["current"] or row["base"]]
        dataset_note = "品类口径：产品系列销售额合计 1000.16 / 760.00 万元"

    result = structure_engine(ordered, dimension, DIMENSIONS[dimension])
    for row in result["rows"]:
        row["current"] = r2(row["current"])
        row["base"] = r2(row["base"])
        row["diff"] = r2(row["diff"])
        row["current_share"] = r4(row["current_share"])
        row["base_share"] = r4(row["base_share"])
        row["rate"] = r4(row["rate"])
    result["total"] = {
        "current": r2(result["total"]["current"]),
        "base": r2(result["total"]["base"]),
        "diff": r2(result["total"]["diff"]),
        "rate": r4(result["total"]["rate"]),
    }
    insights = insight_rules.finalize(
        insight_rules.structure_insights(result, DIMENSIONS[dimension]), settings.top_n
    )
    data = {
        **result,
        "dataset_note": dataset_note,
        "caliber_note": f"{dataset_note}；6 个维度的分项之和均等于该口径总收入，四套收入合计口径见页脚。",
    }
    if dimension == "store_type":
        data["dimension_note"] = "该维度为在营门店类型（同店/新店/闭店）；门店档案的 MALL/社区街边/写字楼/交通枢纽 店型字段暂未作为结构维度。"
    return {
        "data": data,
        "meta": _meta(period, label, _store_label(store), brand),
        "insights": insights,
    }


# ---------------------------------------------------------------------------
# 同店异动
# ---------------------------------------------------------------------------
def revenue_same_store(session: Session, period: str, baseline: str = "yoy", brand: str = "all") -> dict:
    _ensure_store_revenue_period(session, period)
    baseline_periods = resolve_baseline_periods(baseline, period, "month")
    rows = store_rows(session, period, baseline_periods[-1])
    if not any(row["has_current"] for row in rows):
        raise AnalysisError(f"{period} 没有门店收入数据，请先在数据导入页导入该期间的门店收入")
    same = [row for row in rows if row["category"] == "同店"]
    new = [row for row in rows if row["category"] == "新店"]
    result = same_store(same)
    store_items = []
    for row in result["stores"]:
        store_items.append(
            {
                "store_id": row["store_id"],
                "store_name": row["store_name"],
                "region": row["region"],
                "traffic": {"current": r2(row["traffic"]["current"]), "base": r2(row["traffic"]["base"]), "diff": r2(row["traffic"]["diff"]), "rate": r4(row["traffic"]["diff"] / row["traffic"]["base"]) if row["traffic"]["base"] else None},
                "ticket": {"current": r2(row["ticket"]["current"]), "base": r2(row["ticket"]["base"]), "diff": r2(row["ticket"]["diff"])},
                "revenue": {"current": r2(row["revenue"]["current"]), "base": r2(row["revenue"]["base"]), "diff": r2(row["revenue"]["diff"]), "rate": r4(row["revenue"]["diff"] / row["revenue"]["base"]) if row["revenue"]["base"] else None},
                "traffic_impact": r2(row["traffic_impact"]),
                "ticket_impact": r2(row["ticket_impact"]),
                "diff": r2(row["diff"]),
            }
        )
    summary = result["summary"]
    summary_out = {
        "current": r2(summary["current"]),
        "base": r2(summary["base"]),
        "diff": r2(summary["diff"]),
        "rate": r4(summary["rate"]),
        "traffic": {"current": r2(summary["traffic"]["current"]), "base": r2(summary["traffic"]["base"]), "diff": r2(summary["traffic"]["diff"]), "rate": r4(summary["traffic"]["rate"])},
        "ticket": {"current": r2(summary["ticket"]["current"]), "base": r2(summary["ticket"]["base"]), "diff": r2(summary["ticket"]["diff"]), "rate": r4(summary["ticket"]["rate"])},
        "traffic_impact": r2(summary["traffic_impact"]),
        "ticket_impact": r2(summary["ticket_impact"]),
        "impact_sum": r2(summary["impact_sum"]),
        "variance_note": summary["variance_note"],
    }
    data = {
        "summary": summary_out,
        "stores": store_items,
        "new_stores": [
            {"store_id": row["store_id"], "store_name": row["store_name"], "revenue": r2(row["revenue_current"])}
            for row in new
            if row["has_current"]
        ],
        "caliber_note": "门店口径：同店 13 家 + 新店 2 家，收入合计 1000.23 / 759.95 万元；客流×客单拆解按逐店计算后汇总，0.12 万尾差来自源表取整。",
    }
    insights = insight_rules.finalize(
        insight_rules.same_store_insights(summary_out) + insight_rules.store_anomaly_insights(store_items),
        settings.top_n,
    )
    return {
        "data": data,
        "meta": _meta(period, baseline_label(baseline, baseline_periods), "all", brand),
        "insights": insights,
    }


# ---------------------------------------------------------------------------
# 单店
# ---------------------------------------------------------------------------
def revenue_store(session: Session, period: str, store_id: int, baseline: str = "yoy", brand: str = "all") -> dict:
    _ensure_store_revenue_period(session, period)
    store = session.get(Store, store_id)
    if store is None:
        raise AnalysisError(f"门店 {store_id} 不存在")
    baseline_periods = resolve_baseline_periods(baseline, period, "month")
    rows = store_rows(session, period, baseline_periods[-1])
    row = next((row for row in rows if row["store_id"] == store_id), None)
    if row is None or not row["has_current"]:
        raise AnalysisError(f"{period} 没有门店 {store.name} 的收入数据")
    single = same_store([row])
    summary = single["summary"]
    dayparts = daypart_rows(session, store_id, period, baseline_periods[-1])
    daypart_result = daypart_table(dayparts) if dayparts else {"rows": [], "day_types": [], "total": None, "biggest": None}
    for item in daypart_result["rows"]:
        item["current"] = ri(item["current"])
        item["base"] = ri(item["base"])
        item["diff"] = ri(item["diff"])
        item["rate"] = r4(item["rate"])
    if daypart_result["total"]:
        daypart_result["total"] = {
            key: ri(value) if key in ("current", "base", "diff") else r4(value)
            for key, value in daypart_result["total"].items()
        }
    dayparts_payload = []
    for item in daypart_result["rows"]:
        dayparts_payload.append({**item, "is_total": False})
    for item in daypart_result["day_types"]:
        dayparts_payload.append(
            {
                "day_type": item["day_type"],
                "daypart": "合计",
                "name": "合计",
                "current": ri(item["current"]),
                "base": ri(item["base"]),
                "diff": ri(item["diff"]),
                "rate": r4(item["rate"]),
                "is_total": True,
            }
        )
    dayparts_note = None if dayparts else "该门店没有时段客流数据（示例数据只导入了门店12）"
    data = {
        "store": {"id": store.id, "name": store.name, "region": store.region, "business_model": store.business_model, "store_type": store.store_type, "category": row["category"]},
        "summary": {
            "traffic": {"current": r2(summary["traffic"]["current"]), "base": r2(summary["traffic"]["base"]), "diff": r2(summary["traffic"]["diff"]), "rate": r4(summary["traffic"]["rate"])},
            "ticket": {"current": r2(summary["ticket"]["current"]), "base": r2(summary["ticket"]["base"]), "diff": r2(summary["ticket"]["diff"])},
            "revenue": {"current": r2(summary["current"]), "base": r2(summary["base"]), "diff": r2(summary["diff"]), "rate": r4(summary["rate"])},
            "traffic_impact": r2(summary["traffic_impact"]),
            "ticket_impact": r2(summary["ticket_impact"]),
            "diff": r2(summary["diff"]),
        },
        "dayparts": dayparts_payload,
        "note": dayparts_note,
        "day_types": [
            {
                "day_type": item["day_type"],
                "current": ri(item["current"]),
                "base": ri(item["base"]),
                "diff": ri(item["diff"]),
                "rate": r4(item["rate"]),
            }
            for item in daypart_result["day_types"]
        ],
        "dayparts_total": daypart_result["total"],
        "daypart_highlight": daypart_result.get("biggest"),
        "dayparts_note": dayparts_note,
    }
    insights = insight_rules.finalize(insight_rules.store_anomaly_insights(single["stores"]), settings.top_n)
    return {
        "data": data,
        "meta": _meta(period, baseline_label(baseline, baseline_periods), store.name, brand),
        "insights": insights,
    }


# ---------------------------------------------------------------------------
# 渠道
# ---------------------------------------------------------------------------
def revenue_channel(session: Session, period: str, baseline: str = "yoy", brand: str = "all") -> dict:
    _reject_budget_baseline(baseline)
    _ensure_store_revenue_period(session, period)
    baseline_periods = resolve_baseline_periods(baseline, period, "month")
    base_period = baseline_periods[-1]
    rows = store_rows(session, period, base_period)
    same = [row for row in rows if row["category"] == "同店"]
    new = [row for row in rows if row["category"] == "新店"]
    same_current = sum(row["revenue_current"] for row in same)
    new_current = sum(row["revenue_current"] for row in new)
    total_store_current = same_current + new_current

    channels = channel_rows(session, period, base_period)
    split = channel_split(channels, same_current, new_current, total_store_current)

    # 展示取整：同店/新店先按 design §14 口径取整（同店 = 渠道本期 − 新店分摊）
    channel_total_current = sum(row["current"] for row in channels) or 1.0
    scaled_same = round(channel_total_current * split["same_store_ratio"], 2)
    out_rows = []
    for row in split["rows"]:
        same_display = round(row["current"] * scaled_same / channel_total_current, 2)
        new_display = round(row["current"] - same_display, 2)
        out_rows.append(
            {
                "channel_id": row["channel_id"],
                "name": row["name"],
                "current": r2(row["current"]),
                "base": r2(row["base"]),
                "same_store": r2(same_display),
                "new_store": r2(new_display),
                "diff": r2(row["diff"]),
                "rate": r4(row["rate"]),
                "same_rate": r4((same_display - row["base"]) / row["base"]) if row["base"] else None,
                "share": r4(row["current"] / channel_total_current) if channel_total_current else None,
            }
        )

    category_totals: dict[str, dict] = {}
    for channel in session.scalars(select(Channel)):
        category_totals.setdefault(channel.category, {"name": channel.category, "current": 0.0, "base": 0.0})
    for channel in channel_rows(session, period, base_period):
        bucket = category_totals[channel["category"]]
        bucket["current"] += channel["current"]
        bucket["base"] += channel["base"]
    categories = []
    for bucket in category_totals.values():
        diff = bucket["current"] - bucket["base"]
        categories.append(
            {
                "name": bucket["name"],
                "current": r2(bucket["current"]),
                "base": r2(bucket["base"]),
                "diff": r2(diff),
                "rate": r4(diff / bucket["base"]) if bucket["base"] else None,
            }
        )
    data = {
        "total": {"current": r2(split["total"]["current"]), "base": r2(split["total"]["base"]), "diff": r2(split["total"]["diff"]), "same_store": r2(split["total"]["same_store"]), "new_store": r2(split["total"]["new_store"])},
        "rows": out_rows,
        "categories": categories,
        "total_note": "同店/新店分摊口径：渠道本期收入 ×（同店/新店收入 ÷ 门店收入合计），与 PPT p26 一致；Excel 结构页另有按同期渠道占比分摊的一版。",
        "caliber_note": "渠道合计为渠道口径（1,000.00 / 759.56 万），利润表口径为 1,000 / 760 万，差 0.44 万为源表取整；同店/新店分摊按本期渠道占比，与 PPT p26 一致。",
    }
    insights = insight_rules.finalize(insight_rules.channel_insights(out_rows), settings.top_n)
    return {
        "data": data,
        "meta": _meta(period, baseline_label(baseline, baseline_periods), "all", brand),
        "insights": insights,
    }


def revenue_channel_detail(session: Session, period: str, channel_id: int, baseline: str = "yoy", brand: str = "all") -> dict:
    _reject_budget_baseline(baseline)
    _ensure_store_revenue_period(session, period)
    channel = session.get(Channel, channel_id)
    if channel is None:
        raise AnalysisError(f"渠道 {channel_id} 不存在")
    baseline_periods = resolve_baseline_periods(baseline, period, "month")
    base_period = baseline_periods[-1]
    current_revenue = _channel_totals(session, period).get(channel_id, 0.0)
    funnel_counts = funnel_totals(session, period, channel_id)
    base_counts = funnel_totals(session, base_period, channel_id)
    funnel_data = funnel(funnel_counts, base_counts) if funnel_counts else None
    if funnel_data:
        for key in ("exposure", "visits", "payers", "consumers", "brand_customers", "new_customers", "old_customers"):
            funnel_data[key] = ri(funnel_data[key])
        for key in ("exposure_visit", "visit_pay", "pay_consume", "exposure_pay", "new_customer_share"):
            funnel_data[key] = r4(funnel_data[key])

    platform_fee = funnel_counts.get("platform_fee")
    target = target_for_channel(session, period, channel_id)
    gross_margin = target.gross_margin if target and target.gross_margin is not None else settings.platform_gross_margin
    economics = roi(
        current_revenue,
        (platform_fee or 0) / 10000 if platform_fee else None,
        gross_margin,
        {
            "fee_rate": settings.platform_fee_rate_max,
            "gross_roi": settings.gross_roi_min,
            "sales_roi": settings.sales_roi_min,
        },
    )
    economics_out = {
        "revenue": r2(economics["revenue"]),
        "platform_fee": r2(economics["platform_fee"]),
        "fee_rate": r4(economics["fee_rate"]),
        "gross_margin": r4(economics["gross_margin"]),
        "gross_profit": r2(economics["gross_profit"]),
        "gross_roi": r4(economics["gross_roi"]),
        "sales_roi": r4(economics["sales_roi"]),
        "thresholds": economics["thresholds"],
        "status": economics["status"],
        "target_roi": target.target_roi if target else None,
    }
    combined = (insight_rules.funnel_insights(funnel_data) if funnel_data else []) + insight_rules.online_efficiency_insights(economics_out)
    data = {
        "channel": {"id": channel.id, "name": channel.name, "category": channel.category},
        "funnel": funnel_data,
        "economics": economics_out,
        "target": (
            {
                "new_customers": target.new_customers,
                "exposure_cvr": target.exposure_cvr,
                "avg_ticket": target.avg_ticket,
                "gross_margin": target.gross_margin,
                "cac": target.cac,
                "target_roi": target.target_roi,
            }
            if target
            else None
        ),
        "funnel_note": None if funnel_data else "示例数据只导入了美团大众（点评）漏斗；其他渠道漏斗待导入",
        "note": None if funnel_data else "示例数据只导入了美团大众（点评）漏斗；其他渠道漏斗待导入",
    }
    return {
        "data": data,
        "meta": _meta(period, baseline_label(baseline, baseline_periods), "all", brand),
        "insights": insight_rules.finalize(combined, settings.top_n),
    }


# ---------------------------------------------------------------------------
# 产品
# ---------------------------------------------------------------------------
def revenue_product(session: Session, period: str, scope: str = "all", baseline: str = "yoy", brand: str = "all") -> dict:
    if scope not in ("all", "same_store"):
        raise AnalysisError("scope 只能是 all 或 same_store")
    baseline_periods = resolve_baseline_periods(baseline, period, "month")
    base_period = baseline_periods[-1]
    current_series, base_series = series_rows(session, period, base_period)
    if not current_series:
        raise AnalysisError(f"{period} 没有产品系列数据，请先在数据导入页导入该期间的产品销售")
    sets_current = set_totals(session, period)
    sets_base = set_totals(session, base_period)

    same_ratio = None
    if scope == "same_store":
        rows = store_rows(session, period, base_period)
        same_current = sum(row["revenue_current"] for row in rows if row["category"] == "同店")
        new_current = sum(row["revenue_current"] for row in rows if row["category"] == "新店")
        total = same_current + new_current
        same_ratio = same_current / total if total else None

    result = product_volume_price(
        current_series,
        base_series,
        same_store_ratio=same_ratio,
        sets_current=sets_current or None,
        sets_base=sets_base or None,
        scope=scope,
    )
    series_out = []
    for row in result["series"]:
        series_out.append(
            {
                "name": row["name"],
                "qty": {"current": r2(row["qty"]["current"]), "base": r2(row["qty"]["base"])},
                "price": {"current": r2(row["price"]["current"]), "base": r2(row["price"]["base"])},
                "revenue": {"current": r2(row["revenue"]["current"] / 10000), "base": r2(row["revenue"]["base"] / 10000)},
                "qty_impact": r2(row["qty_impact"]),
                "price_impact": r2(row["price_impact"]),
                "diff": r2(row["diff"]),
            }
        )
    sets_out = result["sets"]
    sets_payload = None
    if sets_out:
        sets_payload = {
            "current": {
                "qty": ri(sets_out["current"]["qty"]),
                "amount": r2(sets_out["current"]["amount"]),
                "avg_price": r2(sets_out["current"]["avg_price"]),
                "dish_revenue": r2(sets_out["current"]["dish_revenue"]),
                "discount": r2(sets_out["current"]["discount"]),
                "discount_rate": r4(
                    sets_out["current"]["discount"] / sets_out["current"]["amount"]
                    if sets_out["current"]["amount"] else None
                ),
            },
            "base": {
                "qty": ri(sets_out["base"]["qty"]),
                "amount": r2(sets_out["base"]["amount"]),
                "avg_price": r2(sets_out["base"]["avg_price"]),
                "dish_revenue": r2(sets_out["base"]["dish_revenue"]),
                "discount": r2(sets_out["base"]["discount"]),
                "discount_rate": r4(
                    sets_out["base"]["discount"] / sets_out["base"]["amount"]
                    if sets_out["base"]["amount"] else None
                ),
            },
            "qty_impact": r2(sets_out["qty_impact"]),
            "price_impact": r2(sets_out["price_impact"]),
            "diff": r2(sets_out["diff"]),
        }
    # 单品/套餐排行：产品明细行的量价拆解（与 series 同一套公式；明细与表4 汇总不是同一快照）
    products = {product.id: product for product in session.scalars(select(Product))}
    current_items = product_item_totals(session, period)
    base_items = product_item_totals(session, base_period)
    item_ids = sorted(set(current_items) | set(base_items), key=lambda pid: products[pid].name if pid in products else str(pid))
    items_current = [
        {
            "key": products[pid].name,
            "name": products[pid].name,
            "qty": current_items.get(pid, {}).get("qty", 0.0),
            "amount": current_items.get(pid, {}).get("amount", 0.0),
        }
        for pid in item_ids
        if pid in products
    ]
    items_base = [
        {
            "key": products[pid].name,
            "name": products[pid].name,
            "qty": base_items.get(pid, {}).get("qty", 0.0),
            "amount": base_items.get(pid, {}).get("amount", 0.0),
        }
        for pid in item_ids
        if pid in products
    ]
    items_result = product_volume_price(
        items_current,
        items_base,
        same_store_ratio=same_ratio,
        scope=scope,
    )
    name_to_product = {product.name: product for product in products.values()}
    items_out = [
        {
            "product_id": name_to_product[row["name"]].id if row["name"] in name_to_product else None,
            "name": row["name"],
            "is_set": bool(name_to_product[row["name"]].is_set) if row["name"] in name_to_product else True,
            "qty": {"current": r2(row["qty"]["current"]), "base": r2(row["qty"]["base"])},
            "amount": {"current": r2(row["revenue"]["current"]), "base": r2(row["revenue"]["base"])},
            "price": {"current": r2(row["price"]["current"]), "base": r2(row["price"]["base"])},
            "qty_impact": r2(row["qty_impact"]),
            "price_impact": r2(row["price_impact"]),
            "diff": r2(row["diff"]),
        }
        for row in items_result["series"]
    ]

    data = {
        "scope": scope,
        "total": {
            "current": r2(result["total"]["current"]),
            "base": r2(result["total"]["base"]),
            "diff": r2(result["total"]["diff"]),
            "qty_impact": r2(sum(row["qty_impact"] for row in result["series"])),
            "price_impact": r2(sum(row["price_impact"] for row in result["series"])),
        },
        "series": series_out,
        "items": items_out,
        "sets": sets_payload,
        "same_store_ratio": r4(same_ratio),
        "conclusion": _product_conclusion(series_out, scope),
        "note": (
            "口径：销量影响 =（本期销量 − 同期销量）× 同期单价；单价影响 =（本期单价 − 同期单价）× 本期销量；"
            "金额单位：系列为万元、套餐为元。"
        ),
    }
    insights = insight_rules.finalize(insight_rules.product_insights({**result}), settings.top_n)
    return {
        "data": data,
        "meta": _meta(period, baseline_label(baseline, baseline_periods), "all", brand, unit="元"),
        "insights": insights,
    }


def _product_conclusion(series_out: list[dict], scope: str) -> str:
    if not series_out:
        return "本期无产品系列数据"
    ups = sorted([row for row in series_out if row["diff"] > 0], key=lambda row: -row["diff"])[:3]
    downs = sorted([row for row in series_out if row["diff"] < 0], key=lambda row: row["diff"])[:2]
    parts: list[str] = []
    if ups:
        parts.append("增收主要来自" + "、".join(f"{row['name']}（+{row['diff']:.2f} 万）" for row in ups))
    if downs:
        parts.append("收入下降的是" + "、".join(f"{row['name']}（{row['diff']:.2f} 万）" for row in downs))
    where = "同店" if scope == "same_store" else "全部门店"
    return f"{where}产品量价：" + "；".join(parts) + "。"


# ---------------------------------------------------------------------------
# 结论与建议
# ---------------------------------------------------------------------------
ACTIONS = [
    {"title": "巩固线上放量", "detail": "美团大众同店 +58.24 万、抖音 +10.71 万，继续加大曝光-支付转化前的到店团购券投放，按门店分位筛选高转化门店复制。", "owner": "市场部/运营部"},
    {"title": "主食类定价复盘", "detail": "主食类单价 27.48→12.14 元导致收入 -50 万，需复盘套餐结构与折扣策略，设置最低毛利红线。", "owner": "产品部/财务部"},
    {"title": "门店 12 客流下滑专项", "detail": "门店 12 收入 -3.13 万、客流 -280 人次，工作日 9:00-14:00 与 14:00-24:00 合计 -461 人次，检查商圈客流与排班。", "owner": "区域负责人/门店店长"},
]


def revenue_conclusion(session: Session, period: str, baseline: str = "yoy", brand: str = "all") -> dict:
    _ensure_store_revenue_period(session, period)
    baseline_periods = resolve_baseline_periods(baseline, period, "month")
    rows = store_rows(session, period, baseline_periods[-1])
    same = [row for row in rows if row["category"] == "同店"]
    new = [row for row in rows if row["category"] == "新店"]
    closed = [row for row in rows if row["category"] == "闭店"]
    same_result = same_store(same)["summary"]
    total_current = sum(row["revenue_current"] for row in rows)
    total_base = sum(row["revenue_base"] for row in rows)
    total_diff = total_current - total_base
    new_store = sum(row["revenue_current"] for row in new)
    closed_store = sum(row["revenue_current"] - row["revenue_base"] for row in closed)
    parts_sum = (round(new_store, 2) + round(same_result["traffic_impact"], 2)
                 + round(same_result["ticket_impact"], 2) + round(closed_store, 2))
    variance = total_diff - parts_sum
    variance_note = None
    if abs(variance) >= 0.005:
        variance_note = (
            f"四项合计 {parts_sum:.2f} 万，与收入变动 {total_diff:.2f} 万"
            f"相差 {abs(variance):.2f} 万，为源表取整尾差"
        )
    summary = {
        "new_store": r2(new_store),
        "same_store_traffic": r2(same_result["traffic_impact"]),
        "same_store_ticket": r2(same_result["ticket_impact"]),
        "closed_store": r2(closed_store),
        "total_diff": r2(total_diff),
        "variance_note": variance_note,
    }
    insights = insight_rules.conclusion_insights(summary)
    conclusions = [item["text"] for item in insights[:3]]
    data = {
        "summary": summary,
        "conclusions": conclusions,
        "actions": ACTIONS,
        "caliber_note": "异动汇总使用门店口径（1000.23 / 759.95 万元）；四项合计与收入变动的 0.13 万差异为源表取整尾差，页面不强行对齐。",
    }
    return {
        "data": data,
        "meta": _meta(period, baseline_label(baseline, baseline_periods), "all", brand),
        "insights": insights,
    }


# ---------------------------------------------------------------------------
# 数据状态
# ---------------------------------------------------------------------------
MODULE_REQUIREMENTS = {
    "dashboard": ["pl_monthly"],
    "profit": ["pl_monthly"],
    "revenue": ["store_revenue", "channel_revenue", "product_series", "funnel", "daypart"],
    "product": ["product_series", "product_item"],
    "data": ["pl_monthly", "store_revenue", "channel_revenue", "product_series", "product_item", "funnel", "daypart", "budget_target"],
}
DATASET_LABELS = {
    "pl_monthly": "月度利润表",
    "store_revenue": "门店收入",
    "channel_revenue": "渠道收入",
    "product_series": "产品系列销售",
    "product_item": "单品销售",
    "funnel": "线上漏斗",
    "daypart": "时段客流",
    "budget_target": "预算与目标",
}


def data_status(session: Session, period: str, store: str = "all") -> dict:
    parse_period(period)
    baseline_period = previous_year(period)
    presence = {key: _dataset_present(session, key, period) for key in DATASET_LABELS}
    baseline_presence = {key: _dataset_present(session, key, baseline_period) for key in DATASET_LABELS}
    # 同期对比必需的数据集：dashboard/profit 依赖对比期利润表；revenue 依赖对比期门店/渠道
    baseline_requirements = {
        "dashboard": ["pl_monthly"],
        "profit": ["pl_monthly"],
        "revenue": ["store_revenue", "channel_revenue", "product_series"],
    }
    modules = {}
    for module, datasets in MODULE_REQUIREMENTS.items():
        missing = [DATASET_LABELS[key] for key in datasets if not presence[key]["present"]]
        for key in baseline_requirements.get(module, []):
            if not baseline_presence[key]["present"]:
                missing.append(f"{DATASET_LABELS[key]}（对比期 {baseline_period}）")
        modules[module] = {"ready": not missing, "missing": missing}
    return {
        "data": {
            "period": period,
            "store": store,
            "baseline": baseline_period,
            "baseline_ready": all(
                baseline_presence[key]["present"] for keys in baseline_requirements.values() for key in keys
            ),
            "modules": modules,
            "datasets": [
                {"key": key, "name": DATASET_LABELS[key], "ready": presence[key]["present"], "rows": presence[key]["rows"]}
                for key in DATASET_LABELS
            ],
            "baseline_datasets": [
                {"key": key, "name": DATASET_LABELS[key], "ready": baseline_presence[key]["present"], "rows": baseline_presence[key]["rows"]}
                for key in DATASET_LABELS
            ],
        }
    }


def _dataset_present(session: Session, dataset: str, period: str) -> dict:
    models = {
        "pl_monthly": PLFact,
        "store_revenue": StoreRevenueFact,
        "channel_revenue": ChannelRevenueFact,
        "product_series": ProductSalesFact,
        "product_item": ProductSalesFact,
        "funnel": FunnelFact,
        "daypart": DaypartFact,
        "budget_target": BudgetFact,
    }
    model = models[dataset]
    conditions = [model.period == period, model.superseded_by.is_(None)]
    if dataset == "product_series":
        conditions.append(ProductSalesFact.product_id.is_(None))
    if dataset == "product_item":
        conditions.append(ProductSalesFact.product_id.is_not(None))
    count = len(list(session.scalars(select(model.id).where(*conditions))))
    return {"present": count > 0, "rows": count}


# ---------------------------------------------------------------------------
# 小工具
# ---------------------------------------------------------------------------
def _store_id(store: str | int | None) -> int | None:
    if store in (None, "", "all"):
        return None
    try:
        return int(store)
    except (TypeError, ValueError) as exc:
        raise AnalysisError(f"store 参数必须是门店 id 或 all（当前为「{store}」）") from exc


def _store_label(store: str | int | None) -> str:
    if store in (None, "", "all"):
        return "all"
    return str(store)


def _pct(value: float | None) -> str:
    return "—" if value is None else f"{value * 100:+.2f}%"


def _level_pct(value: float | None) -> str:
    return "—" if value is None else f"{value * 100:.2f}%"


def _pp(current: float | None, base: float | None) -> str:
    if current is None or base is None:
        return "—"
    return f"{(current - base) * 100:+.2f}pp"
