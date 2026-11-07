"""对比差异计算（factor-analysis-engine spec）。"""

from __future__ import annotations

Number = int | float


def diff(current: Number | None, base: Number | None) -> float | None:
    """差异额 = 本期 − 对比；任一侧缺失返回 None。"""
    if current is None or base is None:
        return None
    return current - base


def pct_rate(current: Number | None, base: Number | None) -> float | None:
    """差异率 = 差异额 / 对比值；对比值为 0 或缺失返回 None（前端显示「—」）。"""
    if current is None or base is None or base == 0:
        return None
    return (current - base) / base


def compare_rate(current: Number | None, base: Number | None) -> dict:
    """比率类指标对比：返回百分点变动（pp = 比率差 × 100）。"""
    if current is None or base is None:
        pp = None
    else:
        pp = (current - base) * 100
    return {"current": current, "base": base, "diff": diff(current, base), "pp": pp}


def compare(current: Number | None, base: Number | None, unit: str = "万元") -> dict:
    """通用对比：本期值、对比值、差异额、差异率。"""
    return {
        "current": current,
        "base": base,
        "diff": diff(current, base),
        "rate": pct_rate(current, base),
        "unit": unit,
    }


def pp_change(current_rate: Number | None, base_rate: Number | None) -> float | None:
    """占比/比率变动，单位百分点。"""
    if current_rate is None or base_rate is None:
        return None
    return (current_rate - base_rate) * 100
