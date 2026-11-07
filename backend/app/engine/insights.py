"""规则化洞察（design.md 第 15 节）。

统一结构 {level, title, text, evidence}；level ∈ positive | negative | info；
内部先用 _impact 排序，输出前 top_n 条（默认 3，见 config.top_n）。
所有文本都带数字与证据，不允许自由生成。
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

DEFAULT_TOP_N = 3


def _insight(level: str, title: str, text: str, evidence: str, impact: float = 0.0) -> dict:
    return {
        "level": level,
        "title": title,
        "text": text,
        "evidence": evidence,
        "_impact": impact,
    }


def finalize(insights: Sequence[Mapping], top_n: int = DEFAULT_TOP_N) -> list[dict]:
    """按 |影响| 倒序取前 top_n，去掉内部排序字段。"""
    ordered = sorted(insights, key=lambda item: abs(item.get("_impact", 0.0)), reverse=True)
    out: list[dict] = []
    for item in ordered[:top_n]:
        row = dict(item)
        row.pop("_impact", None)
        out.append(row)
    return out


# ---------------------------------------------------------------------------
# 1) 利润桥
# ---------------------------------------------------------------------------
def profit_bridge_insights(bridge: Mapping) -> list[dict]:
    items = bridge.get("items") or []
    if not items:
        return []
    by_key = {item.get("key"): item for item in items}
    picked: list[Mapping] = []
    revenue_scale = by_key.get("revenue_scale")
    if revenue_scale is not None:
        picked.append(revenue_scale)

    variable = [
        item
        for item in items
        if item.get("key") not in ("revenue_scale", "salary", "dorm_rent", "store_rent", "other", "tax_surcharge")
    ]
    fixed = [
        item
        for item in items
        if item.get("key") in ("salary", "dorm_rent", "store_rent", "other", "tax_surcharge")
    ]
    worst_variable = min(variable, key=lambda item: item["impact"], default=None)
    if worst_variable is not None and worst_variable["impact"] < 0:
        picked.append(worst_variable)
    worst_fixed = min(fixed, key=lambda item: item["impact"], default=None)
    if worst_fixed is not None and worst_fixed["impact"] < 0:
        picked.append(worst_fixed)

    insights: list[dict] = []
    for item in picked:
        impact = item["impact"]
        level = "positive" if impact >= 0 else "negative"
        insights.append(
            _insight(
                level,
                item["name"],
                f"{item['name']}影响营业利润 {impact:+.2f} 万元（{item.get('note', '')}）",
                f"利润桥·{item['name']}",
                impact,
            )
        )
    return finalize(insights, len(insights))


# ---------------------------------------------------------------------------
# 2) 收入结构
# ---------------------------------------------------------------------------
def structure_insights(structure: Mapping, dimension_name: str = "渠道") -> list[dict]:
    rows = [row for row in structure.get("rows") or [] if row.get("diff") is not None]
    if not rows:
        return []
    rises = sorted(rows, key=lambda row: row["diff"], reverse=True)[:3]
    falls = sorted(rows, key=lambda row: row["diff"])[:2]
    insights: list[dict] = []
    for row in rises:
        if row["diff"] <= 0:
            continue
        insights.append(
            _insight(
                "positive",
                f"{row['name']}增长",
                f"{dimension_name}「{row['name']}」同比增加 {row['diff']:+.2f} 万元，"
                f"增幅 {_pct(row.get('rate'))}",
                f"收入结构·{dimension_name}·{row['name']}",
                row["diff"],
            )
        )
    for row in falls:
        if row["diff"] >= 0:
            continue
        insights.append(
            _insight(
                "negative",
                f"{row['name']}下降",
                f"{dimension_name}「{row['name']}」同比减少 {abs(row['diff']):.2f} 万元，"
                f"降幅 {_pct(row.get('rate'))}",
                f"收入结构·{dimension_name}·{row['name']}",
                row["diff"],
            )
        )
    return finalize(insights, len(insights))


# ---------------------------------------------------------------------------
# 3) 同店客流 / 客单
# ---------------------------------------------------------------------------
def same_store_insights(summary: Mapping, dominance: float = 0.8) -> list[dict]:
    traffic_impact = summary.get("traffic_impact") or 0.0
    ticket_impact = summary.get("ticket_impact") or 0.0
    total = abs(traffic_impact) + abs(ticket_impact)
    if total == 0:
        return []
    traffic_share = abs(traffic_impact) / total
    ticket_share = abs(ticket_impact) / total
    if traffic_share >= dominance:
        level, lead = "positive" if traffic_impact >= 0 else "negative", "客流"
        text = (
            f"同店收入变动 {summary.get('diff', 0):+.2f} 万元中，客流影响 "
            f"{traffic_impact:+.2f} 万元（占比 {traffic_share * 100:.1f}%），由客流主导"
        )
    elif ticket_share >= dominance:
        level, lead = "positive" if ticket_impact >= 0 else "negative", "客单价"
        text = (
            f"同店收入变动 {summary.get('diff', 0):+.2f} 万元中，客单影响 "
            f"{ticket_impact:+.2f} 万元（占比 {ticket_share * 100:.1f}%），由客单价主导"
        )
    else:
        level, lead = "info", "客流与客单"
        text = (
            f"同店收入变动 {summary.get('diff', 0):+.2f} 万元，客流影响 {traffic_impact:+.2f} 万元、"
            f"客单影响 {ticket_impact:+.2f} 万元，两者共同作用"
        )
    return finalize(
        [
            _insight(
                level,
                f"同店由{lead}主导",
                text,
                "同店异动·客流×客单",
                max(abs(traffic_impact), abs(ticket_impact)),
            )
        ]
    )


# ---------------------------------------------------------------------------
# 4) 门店异动
# ---------------------------------------------------------------------------
def store_anomaly_insights(stores: Sequence[Mapping]) -> list[dict]:
    insights: list[dict] = []
    for store in stores:
        revenue_diff = (store.get("revenue") or {}).get("diff")
        traffic_diff = (store.get("traffic") or {}).get("diff")
        if revenue_diff is None or traffic_diff is None:
            continue
        if revenue_diff < 0 and traffic_diff < 0:
            name = store.get("store_name")
            insights.append(
                _insight(
                    "negative",
                    f"{name}收入与客流双降",
                    f"{name}收入 {revenue_diff:+.2f} 万元、客流 {traffic_diff:+.0f} 人次，"
                    f"同比分别 {_pct(store['revenue'].get('rate'))} / {_pct(store['traffic'].get('rate'))}，需下钻时段与渠道",
                    f"门店异动·{name}",
                    revenue_diff,
                )
            )
    return finalize(insights, len(insights))


# ---------------------------------------------------------------------------
# 5) 渠道
# ---------------------------------------------------------------------------
def channel_insights(rows: Sequence[Mapping]) -> list[dict]:
    ranked = [row for row in rows if row.get("diff") is not None]
    ranked.sort(key=lambda row: row["diff"], reverse=True)
    insights: list[dict] = []
    for row in ranked[:3]:
        if row["diff"] <= 0:
            continue
        insights.append(
            _insight(
                "positive",
                f"{row['name']}同店增长",
                f"渠道「{row['name']}」同店同比增加 {row['diff']:+.2f} 万元（{_pct(row.get('rate'))}），"
                f"本期同店 {row.get('same_store', 0):.2f} 万元、新店分摊 {row.get('new_store', 0):.2f} 万元",
                f"渠道下钻·{row['name']}",
                row["diff"],
            )
        )
    return finalize(insights, len(insights))


def funnel_insights(funnel: Mapping, threshold: float = 0.01) -> list[dict]:
    changes = funnel.get("mom_change") or {}
    labels = {
        "exposure_visit": "曝光-访问转化",
        "visit_pay": "访问-支付转化",
        "pay_consume": "支付-消费转化",
    }
    insights: list[dict] = []
    for key, label in labels.items():
        change = changes.get(key)
        if change is not None and change < -threshold:
            insights.append(
                _insight(
                    "negative",
                    f"{label}下降",
                    f"{label}环比下降 {abs(change) * 100:.2f} 个百分点（当前 {_pct(funnel.get(key))}），超过 {threshold * 100:.0f}pp 阈值",
                    f"线上漏斗·{label}",
                    -abs(change) * 100,
                )
            )
    return finalize(insights, len(insights))


# ---------------------------------------------------------------------------
# 6) 线上效率
# ---------------------------------------------------------------------------
def online_efficiency_insights(economics: Mapping, thresholds: Mapping | None = None) -> list[dict]:
    thresholds = thresholds or economics.get("thresholds") or {}
    insights: list[dict] = []
    fee_rate = economics.get("fee_rate")
    fee_max = thresholds.get("fee_rate", 0.15)
    if fee_rate is not None and fee_rate > fee_max:
        insights.append(
            _insight(
                "negative",
                "平台费用率超阈值",
                f"平台费用率 {fee_rate * 100:.2f}% 高于阈值 {fee_max * 100:.0f}%，平台费用 "
                f"{economics.get('platform_fee')} 万元需重点谈判",
                "线上效率·费用率",
                (fee_rate - fee_max) * 100,
            )
        )
    gross_roi = economics.get("gross_roi")
    gross_min = thresholds.get("gross_roi", 1.0)
    if gross_roi is not None and gross_roi < gross_min:
        insights.append(
            _insight(
                "negative",
                "毛利 ROI 不达标",
                f"毛利 ROI {gross_roi:.2f} 低于阈值 {gross_min:.1f}，平台投入未换回足够毛利",
                "线上效率·毛利 ROI",
                (gross_min - gross_roi) * 10,
            )
        )
    sales_roi = economics.get("sales_roi")
    sales_min = thresholds.get("sales_roi", 4.0)
    if sales_roi is not None and sales_roi < sales_min:
        insights.append(
            _insight(
                "info",
                "销售 ROI 未达阈值",
                f"销售 ROI {sales_roi:.2f} 低于阈值 {sales_min:.1f}，投放效率仍有提升空间",
                "线上效率·销售 ROI",
                (sales_min - sales_roi),
            )
        )
    return finalize(insights, len(insights))


# ---------------------------------------------------------------------------
# 7) 产品
# ---------------------------------------------------------------------------
def product_insights(product: Mapping) -> list[dict]:
    series = product.get("series") or []
    insights: list[dict] = []
    if series:
        top_qty = max(series, key=lambda row: abs(row.get("qty_impact") or 0))
        if top_qty.get("qty_impact") is not None:
            impact = top_qty["qty_impact"]
            insights.append(
                _insight(
                    "positive" if impact >= 0 else "negative",
                    f"{top_qty['name']}销量影响最大",
                    f"「{top_qty['name']}」销量影响 {impact:+.2f} 万元、单价影响 "
                    f"{(top_qty.get('price_impact') or 0):+.2f} 万元，是量价拆解中影响最大的系列",
                    f"产品下钻·{top_qty['name']}",
                    impact,
                )
            )
        for row in series:
            qty_impact = row.get("qty_impact") or 0.0
            price_impact = row.get("price_impact") or 0.0
            if qty_impact > 0 and price_impact < 0 and abs(price_impact) > 1:
                insights.append(
                    _insight(
                        "info",
                        f"{row['name']}降价换量",
                        f"「{row['name']}」销量影响 {qty_impact:+.2f} 万元、单价影响 {price_impact:+.2f} 万元，"
                        f"属于降价换量；客单从 {row['price'].get('base', 0):.2f} 元降到 "
                        f"{row['price'].get('current', 0):.2f} 元",
                        f"产品下钻·{row['name']}·量价",
                        price_impact,
                    )
                )
    sets = product.get("sets")
    if sets and sets.get("diff") is not None:
        insights.append(
            _insight(
                "info",
                "套餐增收来自量增价降",
                f"套餐量差 {sets['qty_impact']:+.2f} 元、价差 {sets['price_impact']:+.2f} 元，"
                f"合计 {sets['diff']:+.2f} 元；单量 {sets['base']['qty']:.0f} → {sets['current']['qty']:.0f}、"
                f"客单 {sets['base']['avg_price']:.2f} → {sets['current']['avg_price']:.2f} 元",
                "产品下钻·套餐量价",
                abs(sets["diff"]) / 10000.0,
            )
        )
    return finalize(insights, len(insights))


# ---------------------------------------------------------------------------
# 8) 结论汇总
# ---------------------------------------------------------------------------
def conclusion_insights(summary: Mapping) -> list[dict]:
    new_store = summary.get("new_store") or 0.0
    traffic = summary.get("same_store_traffic") or 0.0
    ticket = summary.get("same_store_ticket") or 0.0
    closed = summary.get("closed_store") or 0.0
    total_diff = summary.get("total_diff") or 0.0
    insights = [
        _insight(
            "positive" if total_diff >= 0 else "negative",
            "收入异动汇总",
            f"收入同比 {total_diff:+.2f} 万元：新店贡献 {new_store:+.2f} 万元、同店客流 "
            f"{traffic:+.2f} 万元、同店客单 {ticket:+.2f} 万元、闭店 {closed:+.2f} 万元",
            "结论·收入异动汇总",
            total_diff,
        )
    ]
    if new_store > 0:
        insights.append(
            _insight(
                "positive",
                "新店是主要增量",
                f"新店贡献 {new_store:+.2f} 万元，占总变动 "
                f"{(new_store / total_diff * 100) if total_diff else 0:.1f}%",
                "结论·新店贡献",
                new_store,
            )
        )
    if abs(traffic) >= abs(ticket):
        insights.append(
            _insight(
                "info",
                "同店增长靠客流",
                f"同店客流影响 {traffic:+.2f} 万元，高于客单影响 {ticket:+.2f} 万元，"
                "下一步优先复购与到店客流，而非提价",
                "结论·同店驱动",
                abs(traffic),
            )
        )
    else:
        insights.append(
            _insight(
                "info",
                "同店增长靠客单",
                f"同店客单影响 {ticket:+.2f} 万元，高于客流影响 {traffic:+.2f} 万元",
                "结论·同店驱动",
                abs(ticket),
            )
        )
    return finalize(insights, len(insights))


def _pct(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value * 100:+.1f}%"
