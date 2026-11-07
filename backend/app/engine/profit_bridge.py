"""营业利润桥（factor-analysis-engine spec / design.md 第 14 节）。

规则（与 Excel「第一步-2509餐饮利润桥」一致）：
- 收入规模影响 =（本期收入 − 基期收入）× 基期边际贡献率；
  基期边际贡献率 = 1 − 基期变动成本四项费率（食材 / 优惠及手续费 / 水电气低值 / 宣传费用）；
- 每个变动成本科目的费率影响 =（基期费率 − 本期费率）× 本期收入；
- 每个固定费用科目的影响 = 基期金额 − 本期金额；
- 基期营业利润 + 各项影响 = 本期营业利润（误差 ≤ 0.01 万元）。
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

# 与 Excel 利润表科目一一对应；cost_behavior 可在 account 表里调整。
DEFAULT_ACCOUNTS: tuple[dict, ...] = (
    {"name": "营业收入", "key": "revenue", "cost_behavior": "revenue", "sort_order": 1},
    {"name": "食材成本", "key": "food_cost", "cost_behavior": "variable", "sort_order": 2},
    {"name": "优惠及手续费", "key": "discount_fee", "cost_behavior": "variable", "sort_order": 3},
    {"name": "水电气低值", "key": "utilities", "cost_behavior": "variable", "sort_order": 4},
    {"name": "宣传费用", "key": "marketing", "cost_behavior": "variable", "sort_order": 5},
    {"name": "工资奖金", "key": "salary", "cost_behavior": "fixed", "sort_order": 6},
    {"name": "宿舍房租", "key": "dorm_rent", "cost_behavior": "fixed", "sort_order": 7},
    {"name": "店铺房租", "key": "store_rent", "cost_behavior": "fixed", "sort_order": 8},
    {"name": "其它费用", "key": "other", "cost_behavior": "fixed", "sort_order": 9},
    {"name": "税金及附加", "key": "tax_surcharge", "cost_behavior": "fixed", "sort_order": 10},
)

REVENUE_ACCOUNT = "营业收入"
TOLERANCE = 0.01


def _rate(amount: float, revenue: float) -> float:
    return amount / revenue if revenue else 0.0


def profit_bridge(
    pl_base: Mapping[str, float],
    pl_cur: Mapping[str, float],
    accounts: Sequence[Mapping] = DEFAULT_ACCOUNTS,
) -> dict:
    """计算营业利润同比桥。

    :param pl_base: 基期利润表 {科目名: 万元}
    :param pl_cur: 本期利润表 {科目名: 万元}
    :param accounts: 科目定义，含 name / key / cost_behavior / sort_order
    """
    revenue_base = float(pl_base.get(REVENUE_ACCOUNT, 0.0))
    revenue_cur = float(pl_cur.get(REVENUE_ACCOUNT, 0.0))

    ordered = sorted(accounts, key=lambda a: a.get("sort_order", 0))
    expense_accounts = [a for a in ordered if a.get("cost_behavior") != "revenue"]
    variable = [a for a in expense_accounts if a.get("cost_behavior") == "variable"]
    fixed = [a for a in expense_accounts if a.get("cost_behavior") != "variable"]

    base_expense = sum(float(pl_base.get(a["name"], 0.0)) for a in expense_accounts)
    cur_expense = sum(float(pl_cur.get(a["name"], 0.0)) for a in expense_accounts)
    start = revenue_base - base_expense
    end = revenue_cur - cur_expense

    base_variable_rate = sum(
        _rate(float(pl_base.get(a["name"], 0.0)), revenue_base) for a in variable
    )
    cur_variable_rate = sum(
        _rate(float(pl_cur.get(a["name"], 0.0)), revenue_cur) for a in variable
    )
    base_mcr = 1.0 - base_variable_rate
    cur_mcr = 1.0 - cur_variable_rate

    items: list[dict] = []
    revenue_diff = revenue_cur - revenue_base
    items.append(
        {
            "key": "revenue_scale",
            "name": "收入规模",
            "impact": revenue_diff * base_mcr,
            "kind": "positive" if revenue_diff > 0 else ("negative" if revenue_diff < 0 else "info"),
            "note": (
                f"收入{'增长' if revenue_diff >= 0 else '下降'} {abs(revenue_diff):.2f} 万"
                f" × 基期边际贡献率 {base_mcr * 100:.2f}%"
            ),
        }
    )

    for account in variable:
        name = account["name"]
        amount_base = float(pl_base.get(name, 0.0))
        amount_cur = float(pl_cur.get(name, 0.0))
        rate_base = _rate(amount_base, revenue_base)
        rate_cur = _rate(amount_cur, revenue_cur)
        impact = -revenue_cur * (rate_cur - rate_base)
        items.append(
            {
                "key": account.get("key", name),
                "name": name,
                "impact": impact,
                "kind": "positive" if impact > 0 else ("negative" if impact < 0 else "info"),
                "note": f"费率 {rate_cur * 100:.2f}% ← {rate_base * 100:.2f}%",
            }
        )

    for account in fixed:
        name = account["name"]
        amount_base = float(pl_base.get(name, 0.0))
        amount_cur = float(pl_cur.get(name, 0.0))
        impact = amount_base - amount_cur
        if name == "税金及附加" and amount_base == 0 and amount_cur == 0:
            continue  # 税金为 0 时不单独占一格，保持与 Excel 一致的 9 项利润桥
        items.append(
            {
                "key": account.get("key", name),
                "name": name,
                "impact": impact,
                "kind": "positive" if impact > 0 else ("negative" if impact < 0 else "info"),
                "note": f"固定费用绝对额 {amount_base:.2f} → {amount_cur:.2f} 万",
            }
        )

    impact_sum = sum(item["impact"] for item in items)
    residual = (end - start) - impact_sum
    return {
        "start": start,
        "end": end,
        "items": items,
        "total_change": end - start,
        "impact_sum": impact_sum,
        "residual": residual,
        "closed": abs(residual) <= TOLERANCE,
        "base_revenue": revenue_base,
        "cur_revenue": revenue_cur,
        "base_profit": start,
        "cur_profit": end,
        "base_marginal_contribution_rate": base_mcr,
        "cur_marginal_contribution_rate": cur_mcr,
    }
