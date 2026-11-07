"""门店分位数（factor-analysis-engine spec）。

线性插值（与 numpy.percentile 默认方法一致）；门店少于 3 家不输出。
"""

from __future__ import annotations

from collections.abc import Sequence

MIN_STORES = 3


def _quantile(sorted_values: Sequence[float], q: float) -> float:
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    pos = (len(sorted_values) - 1) * q
    lower = int(pos)
    upper = min(lower + 1, len(sorted_values) - 1)
    frac = pos - lower
    return float(sorted_values[lower]) * (1 - frac) + float(sorted_values[upper]) * frac


def percentiles(values: Sequence[float]) -> dict | None:
    """返回 P25 / P50 / P75；少于 3 个值返回 None。"""
    clean = [float(v) for v in values if v is not None]
    if len(clean) < MIN_STORES:
        return None
    clean.sort()
    return {
        "p25": _quantile(clean, 0.25),
        "p50": _quantile(clean, 0.50),
        "p75": _quantile(clean, 0.75),
        "n": len(clean),
    }


def bucket_of(value: float | None, pct: dict | None) -> str | None:
    """当前值所处分位区间，如「P25–P50」「P50–P75」「>P75」「<P25」。"""
    if value is None or not pct:
        return None
    if value < pct["p25"]:
        return "<P25"
    if value < pct["p50"]:
        return "P25–P50"
    if value < pct["p75"]:
        return "P50–P75"
    return ">P75"
