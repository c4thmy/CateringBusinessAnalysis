"""连环替代法（factor-analysis-engine spec）。

固定顺序逐项替换：每一步影响 = 替换后结果 − 替换前结果；
所有因素影响之和必须等于本期结果 − 基期结果（误差 ≤ 0.01）。
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence

TOLERANCE = 0.01


def chain_substitution(
    factors: Sequence[str],
    base_values: Mapping[str, float],
    cur_values: Mapping[str, float],
    formula: Callable[[Mapping[str, float]], float],
) -> dict:
    """通用连环替代。

    :param factors: 固定替换顺序
    :param base_values: 各因素基期值
    :param cur_values: 各因素本期值
    :param formula: 由因素值计算目标指标的纯函数
    :return: {"base_result", "cur_result", "total_change", "items": [{factor, impact}],
              "impact_sum", "residual", "closed"}
    """
    values = dict(base_values)
    prev = float(formula(values))
    base_result = prev
    items: list[dict] = []
    for factor in factors:
        if factor not in cur_values:
            raise KeyError(f"缺少因素 {factor} 的本期值")
        values[factor] = cur_values[factor]
        cur = float(formula(values))
        items.append({"factor": factor, "impact": cur - prev})
        prev = cur
    cur_result = prev
    total_change = cur_result - base_result
    impact_sum = sum(item["impact"] for item in items)
    residual = total_change - impact_sum
    return {
        "base_result": base_result,
        "cur_result": cur_result,
        "total_change": total_change,
        "items": items,
        "impact_sum": impact_sum,
        "residual": residual,
        "closed": abs(residual) <= TOLERANCE,
    }


def revenue_qty_price(
    qty_base: float, price_base: float, qty_cur: float, price_cur: float
) -> dict:
    """收入二因素：销量 → 单价（结果单位与量价乘积一致）。"""
    return chain_substitution(
        ["qty", "price"],
        {"qty": qty_base, "price": price_base},
        {"qty": qty_cur, "price": price_cur},
        lambda v: v["qty"] * v["price"],
    )


def gross_profit_volume_price_cost(
    qty_base: float,
    price_base: float,
    cost_base: float,
    qty_cur: float,
    price_cur: float,
    cost_cur: float,
) -> dict:
    """毛利额三因素：销量 → 单价 → 单位成本（毛利额 = 销量 ×（单价 − 单位成本））。"""
    return chain_substitution(
        ["qty", "price", "cost"],
        {"qty": qty_base, "price": price_base, "cost": cost_base},
        {"qty": qty_cur, "price": price_cur, "cost": cost_cur},
        lambda v: v["qty"] * (v["price"] - v["cost"]),
    )
