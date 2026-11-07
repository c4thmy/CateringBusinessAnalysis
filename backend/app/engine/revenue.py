"""收入分析公式（design.md 第 14 节 / revenue-analysis spec）。

全部为纯函数：入参是已经按筛选条件聚合好的普通 dict/list，便于用 shared/fixtures 回归。
单位约定：
- structure / same_store / channel_split 的金额为万元；
- product_volume_price 的销售额/金额为元，量价影响换算成万元；
- ticket 为元/人次；比率为 0–1 小数。
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

TOLERANCE = 0.02


# ---------------------------------------------------------------------------
# 收入结构
# ---------------------------------------------------------------------------
def structure(rows: Sequence[Mapping], dimension: str, dimension_name: str) -> dict:
    """结构表：本期、占比、对比值、对比占比、同比差额、增减率；分项之和 = 总收入。"""
    out_rows: list[dict] = []
    total_current = 0.0
    total_base = 0.0
    for row in rows:
        current = float(row.get("current") or 0.0)
        base = float(row.get("base") or 0.0)
        total_current += current
        total_base += base
        out_rows.append(
            {
                "key": row.get("key"),
                "name": row.get("name"),
                "current": current,
                "base": base,
                "diff": current - base,
            }
        )
    total = {
        "current": total_current,
        "base": total_base,
        "diff": total_current - total_base,
        "rate": (total_current - total_base) / total_base if total_base else None,
    }
    for row in out_rows:
        row["current_share"] = row["current"] / total_current if total_current else None
        row["base_share"] = row["base"] / total_base if total_base else None
        row["rate"] = row["diff"] / row["base"] if row["base"] else None
    return {
        "dimension": dimension,
        "dimension_name": dimension_name,
        "total": total,
        "rows": out_rows,
    }


# ---------------------------------------------------------------------------
# 同店客流 × 客单
# ---------------------------------------------------------------------------
def _ticket(revenue_wan: float | None, traffic: float | None, declared: float | None) -> float | None:
    """客单价：优先用导入的申报值，否则由收入 ÷ 客流 × 10000 反算。"""
    if declared is not None:
        return float(declared)
    if not revenue_wan or not traffic:
        return None
    return revenue_wan * 10000.0 / traffic


def same_store(stores: Sequence[Mapping]) -> dict:
    """同店收入按 客流 → 客单 做连环替代。

    stores 每项：store_id, store_name/name, region,
    revenue_current, revenue_base, traffic_current, traffic_base,
    ticket_current?, ticket_base?（可空，空则反算）, is_same_store(可选)。
    """
    rows: list[dict] = []
    summary_cur = 0.0
    summary_base = 0.0
    traffic_cur = 0.0
    traffic_base = 0.0
    ticket_amount_cur = 0.0  # Σ(客单 × 客流)，用于加权客单
    ticket_amount_base = 0.0
    traffic_impact = 0.0
    ticket_impact = 0.0

    for store in stores:
        revenue_cur = float(store.get("revenue_current") or 0.0)
        revenue_base = float(store.get("revenue_base") or 0.0)
        t_cur = float(store.get("traffic_current") or 0.0)
        t_base = float(store.get("traffic_base") or 0.0)
        ticket_cur = _ticket(revenue_cur, t_cur, store.get("ticket_current"))
        ticket_base = _ticket(revenue_base, t_base, store.get("ticket_base"))

        t_impact = (
            (t_cur - t_base) * ticket_base / 10000.0
            if ticket_base is not None
            else None
        )
        k_impact = (
            t_cur * (ticket_cur - ticket_base) / 10000.0
            if ticket_cur is not None and ticket_base is not None
            else None
        )

        rows.append(
            {
                "store_id": store.get("store_id"),
                "store_name": store.get("store_name") or store.get("name"),
                "region": store.get("region"),
                "revenue": {"current": revenue_cur, "base": revenue_base, "diff": revenue_cur - revenue_base},
                "traffic": {"current": t_cur, "base": t_base, "diff": t_cur - t_base},
                "ticket": {"current": ticket_cur, "base": ticket_base, "diff": (ticket_cur - ticket_base) if ticket_cur is not None and ticket_base is not None else None},
                "traffic_impact": t_impact,
                "ticket_impact": k_impact,
                "diff": revenue_cur - revenue_base,
            }
        )

        summary_cur += revenue_cur
        summary_base += revenue_base
        traffic_cur += t_cur
        traffic_base += t_base
        if ticket_cur is not None:
            ticket_amount_cur += ticket_cur * t_cur
        if ticket_base is not None:
            ticket_amount_base += ticket_base * t_base
        if t_impact is not None:
            traffic_impact += t_impact
        if k_impact is not None:
            ticket_impact += k_impact

    ticket_cur = ticket_amount_cur / traffic_cur if traffic_cur else None
    ticket_base = ticket_amount_base / traffic_base if traffic_base else None
    revenue_diff = summary_cur - summary_base
    impact_sum = traffic_impact + ticket_impact
    variance = revenue_diff - impact_sum
    variance_note = None
    if abs(variance) >= 0.005:
        variance_note = (
            f"两项影响合计 {impact_sum:.2f} 万，与同店收入变动 {revenue_diff:.2f} 万"
            f"相差 {abs(variance):.2f} 万，为源表取整尾差"
        )

    return {
        "summary": {
            "current": summary_cur,
            "base": summary_base,
            "diff": revenue_diff,
            "rate": revenue_diff / summary_base if summary_base else None,
            "traffic": {
                "current": traffic_cur,
                "base": traffic_base,
                "diff": traffic_cur - traffic_base,
                "rate": (traffic_cur - traffic_base) / traffic_base if traffic_base else None,
            },
            "ticket": {
                "current": ticket_cur,
                "base": ticket_base,
                "diff": (ticket_cur - ticket_base) if ticket_cur is not None and ticket_base is not None else None,
                "rate": ((ticket_cur - ticket_base) / ticket_base) if ticket_cur is not None and ticket_base else None,
            },
            "traffic_impact": traffic_impact,
            "ticket_impact": ticket_impact,
            "impact_sum": impact_sum,
            "variance_note": variance_note,
        },
        "stores": rows,
    }


# ---------------------------------------------------------------------------
# 渠道同店 / 新店拆分
# ---------------------------------------------------------------------------
def channel_split(
    channels: Sequence[Mapping],
    same_store_revenue: float,
    new_store_revenue: float,
    total_store_revenue: float,
) -> dict:
    """渠道本期收入按门店口径的同店占比拆成同店部分与新店部分。

    分摊公式（revenue-analysis spec）：新店分摊 = 渠道本期收入 ×（新店收入 ÷ 总收入）；
    同店部分 = 渠道本期收入 − 新店分摊。内部保留未取整值，展示层再取整。
    """
    same_ratio = same_store_revenue / total_store_revenue if total_store_revenue else 0.0
    new_ratio = new_store_revenue / total_store_revenue if total_store_revenue else 0.0

    rows: list[dict] = []
    total_current = 0.0
    total_base = 0.0
    total_same = 0.0
    total_new = 0.0
    for channel in channels:
        current = float(channel.get("current") or 0.0)
        base = float(channel.get("base") or 0.0)
        same = current * same_ratio
        new = current * new_ratio
        rows.append(
            {
                "channel_id": channel.get("channel_id"),
                "key": channel.get("key") or channel.get("channel_id"),
                "name": channel.get("name"),
                "current": current,
                "base": base,
                "same_store": same,
                "new_store": new,
                "diff": same - base,
                "rate": (same - base) / base if base else None,
            }
        )
        total_current += current
        total_base += base
        total_same += same
        total_new += new

    return {
        "same_store_ratio": same_ratio,
        "new_store_ratio": new_ratio,
        "total": {
            "current": total_current,
            "base": total_base,
            "same_store": total_same,
            "new_store": total_new,
            "diff": total_current - total_base,
            "rate": (total_current - total_base) / total_base if total_base else None,
        },
        "rows": rows,
    }


# ---------------------------------------------------------------------------
# 产品量价拆解
# ---------------------------------------------------------------------------
def _series_effects(
    qty_cur: float,
    amount_cur: float,
    qty_base: float,
    amount_base: float,
    same_store_ratio: float | None,
) -> dict:
    price_cur = amount_cur / qty_cur if qty_cur else 0.0
    price_base = amount_base / qty_base if qty_base else 0.0
    # 同店口径：Excel 表3 用「本期销量 × 同店收入占比」近似同店销量（分摊假设）
    qty_cur_eff = qty_cur * same_store_ratio if same_store_ratio is not None else qty_cur
    amount_cur_eff = qty_cur_eff * price_cur
    qty_impact = (qty_cur_eff - qty_base) * price_base / 10000.0
    price_impact = qty_cur_eff * (price_cur - price_base) / 10000.0
    return {
        "qty": {"current": qty_cur_eff, "base": qty_base},
        "price": {"current": price_cur, "base": price_base},
        "revenue": {"current": amount_cur_eff, "base": amount_base},
        "qty_impact": qty_impact,
        "price_impact": price_impact,
        "diff": qty_impact + price_impact,
    }


def product_volume_price(
    series_current: Sequence[Mapping],
    series_base: Sequence[Mapping],
    same_store_ratio: float | None = None,
    sets_current: Mapping | None = None,
    sets_base: Mapping | None = None,
    scope: str = "all",
) -> dict:
    """系列/单品 销量 → 单价 拆解；套餐单独给量价。

    series_current/series_base 每项：key/name, qty, amount（元）。
    sets_current/sets_base：{qty, amount, dish_revenue, discount}（元）。
    """
    base_by_key = {row.get("key") or row.get("name"): row for row in series_base}
    out_rows: list[dict] = []
    total_base = 0.0
    total_diff = 0.0
    for row in series_current:
        key = row.get("key") or row.get("name")
        base_row = base_by_key.get(key, {})
        qty_cur = float(row.get("qty") or 0.0)
        amount_cur = float(row.get("amount") or 0.0)
        qty_base = float(base_row.get("qty") or 0.0)
        amount_base = float(base_row.get("amount") or 0.0)
        effects = _series_effects(qty_cur, amount_cur, qty_base, amount_base, same_store_ratio)
        effects["key"] = key
        effects["name"] = row.get("name") or key
        out_rows.append(effects)
        total_base += amount_base
        total_diff += effects["diff"]
    out_rows.sort(key=lambda item: abs(item["diff"]), reverse=True)

    total = {
        "current": total_base / 10000.0 + total_diff,
        "base": total_base / 10000.0,
        "diff": total_diff,
    }

    result = {
        "scope": scope,
        "same_store_ratio": same_store_ratio,
        "total": total,
        "series": out_rows,
        "sets": None,
    }
    if sets_current is not None or sets_base is not None:
        result["sets"] = _sets_effects(sets_current or {}, sets_base or {})
    return result


def _sets_effects(sets_current: Mapping, sets_base: Mapping) -> dict:
    qty_cur = float(sets_current.get("qty") or 0.0)
    qty_base = float(sets_base.get("qty") or 0.0)
    amount_cur = float(sets_current.get("amount") or 0.0)
    amount_base = float(sets_base.get("amount") or 0.0)
    price_cur = amount_cur / qty_cur if qty_cur else None
    price_base = amount_base / qty_base if qty_base else None
    qty_impact = (qty_cur - qty_base) * (price_base or 0.0)
    price_impact = qty_cur * ((price_cur or 0.0) - (price_base or 0.0))
    return {
        "current": {
            "qty": qty_cur,
            "amount": amount_cur,
            "avg_price": price_cur,
            "dish_revenue": sets_current.get("dish_revenue"),
            "discount": sets_current.get("discount"),
        },
        "base": {
            "qty": qty_base,
            "amount": amount_base,
            "avg_price": price_base,
            "dish_revenue": sets_base.get("dish_revenue"),
            "discount": sets_base.get("discount"),
        },
        "qty_impact": qty_impact,
        "price_impact": price_impact,
        "diff": qty_impact + price_impact,
    }


# ---------------------------------------------------------------------------
# 线上漏斗
# ---------------------------------------------------------------------------
def _rate(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator in (None, 0):
        return None
    return numerator / denominator


def funnel(counts: Mapping, baseline: Mapping | None = None) -> dict:
    """曝光 → 访问 → 支付 → 消费 漏斗；缺失值保持 None，不补 0。"""
    exposure = counts.get("exposure")
    visits = counts.get("visits")
    payers = counts.get("payers")
    consumers = counts.get("consumers")
    brand = counts.get("brand_customers")
    new_customers = counts.get("new_customers")

    data = {
        "exposure": exposure,
        "visits": visits,
        "payers": payers,
        "consumers": consumers,
        "brand_customers": brand,
        "new_customers": new_customers,
        "old_customers": counts.get("old_customers"),
        "exposure_visit": _rate(visits, exposure),
        "visit_pay": _rate(payers, visits),
        "pay_consume": _rate(consumers, payers),
        "exposure_pay": _rate(payers, exposure),
        "new_customer_share": _rate(new_customers, brand),
    }
    if baseline is not None:
        base_rates = funnel(baseline)
        data["mom_change"] = {
            key: (
                data[key] - base_rates[key]
                if data.get(key) is not None and base_rates.get(key) is not None
                else None
            )
            for key in ("exposure_visit", "visit_pay", "pay_consume", "exposure_pay")
        }
    else:
        data["mom_change"] = {
            "exposure_visit": None,
            "visit_pay": None,
            "pay_consume": None,
            "exposure_pay": None,
        }
    return data


# ---------------------------------------------------------------------------
# 平台费用率与 ROI
# ---------------------------------------------------------------------------
def roi(
    revenue: float | None,
    platform_fee: float | None,
    gross_margin: float | None,
    thresholds: Mapping | None = None,
) -> dict:
    """平台费用率 / 毛利 ROI / 销售 ROI 与阈值对比。

    阈值默认：费用率 ≤ 15%、毛利 ROI ≥ 1、销售 ROI ≥ 4（PPT p28）。
    """
    thresholds = thresholds or {"fee_rate": 0.15, "gross_roi": 1.0, "sales_roi": 4.0}
    fee_rate = _rate(platform_fee, revenue)
    gross_profit = revenue * gross_margin if revenue is not None and gross_margin is not None else None
    gross_roi = _rate(gross_profit, platform_fee)
    sales_roi = _rate(revenue, platform_fee)
    return {
        "revenue": revenue,
        "platform_fee": platform_fee,
        "gross_margin": gross_margin,
        "fee_rate": fee_rate,
        "gross_profit": gross_profit,
        "gross_roi": gross_roi,
        "sales_roi": sales_roi,
        "thresholds": dict(thresholds),
        "status": {
            "fee_rate": (
                None if fee_rate is None
                else ("risk" if fee_rate > thresholds.get("fee_rate", 0.15) else "ok")
            ),
            "gross_roi": (
                None if gross_roi is None
                else ("risk" if gross_roi < thresholds.get("gross_roi", 1.0) else "ok")
            ),
            "sales_roi": (
                None if sales_roi is None
                else ("warning" if sales_roi < thresholds.get("sales_roi", 4.0) else "ok")
            ),
        },
    }


# ---------------------------------------------------------------------------
# 时段客流
# ---------------------------------------------------------------------------
def daypart_table(rows: Sequence[Mapping]) -> dict:
    """日类型 × 时段 客流对比，并给出日类型小计。"""
    detail: list[dict] = []
    day_types: dict[str, dict] = {}
    total = {"current": 0.0, "base": 0.0, "diff": 0.0}
    for row in rows:
        current = float(row.get("current") or 0.0)
        base = float(row.get("base") or 0.0)
        item = {
            "day_type": row.get("day_type"),
            "daypart": row.get("daypart"),
            "name": row.get("daypart"),
            "current": current,
            "base": base,
            "diff": current - base,
            "rate": (current - base) / base if base else None,
        }
        detail.append(item)
        sub = day_types.setdefault(
            item["day_type"], {"day_type": item["day_type"], "current": 0.0, "base": 0.0}
        )
        sub["current"] += current
        sub["base"] += base
        total["current"] += current
        total["base"] += base
    subtotals = []
    for sub in day_types.values():
        sub["diff"] = sub["current"] - sub["base"]
        sub["rate"] = sub["diff"] / sub["base"] if sub["base"] else None
        subtotals.append(sub)
    subtotals.sort(key=lambda item: item["day_type"] != "工作日")

    def _slot_start(text: str) -> int:
        try:
            return int(str(text).split(":")[0])
        except (ValueError, IndexError):
            return 99

    detail.sort(key=lambda item: (item["day_type"] != "工作日", _slot_start(item["daypart"])))
    total["diff"] = total["current"] - total["base"]
    total["rate"] = total["diff"] / total["base"] if total["base"] else None
    # 对门店客流变化贡献最大的时段（按 |diff|）
    biggest = max(detail, key=lambda item: abs(item["diff"]), default=None)
    return {"rows": detail, "day_types": subtotals, "total": total, "biggest": biggest}
