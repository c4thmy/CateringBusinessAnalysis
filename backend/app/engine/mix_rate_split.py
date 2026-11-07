"""结构影响与单项影响拆分（factor-analysis-engine spec）。

综合率 = Σ(各项占比 × 各项率)：
- 结构影响 = Σ((本期占比 − 基期占比) × 基期率)
- 单项率影响 = Σ(本期占比 × (本期率 − 基期率))
两者之和 = 综合率变动。
"""

from __future__ import annotations

from collections.abc import Mapping

TOLERANCE = 0.01


def mix_rate_split(
    share_base: Mapping[str, float],
    rate_base: Mapping[str, float],
    share_cur: Mapping[str, float],
    rate_cur: Mapping[str, float],
) -> dict:
    keys = list(dict.fromkeys(list(share_base) + list(share_cur)))

    rows: dict[str, dict] = {}
    structure_impact = 0.0
    rate_impact = 0.0
    composite_base = 0.0
    composite_cur = 0.0
    for key in keys:
        sb = float(share_base.get(key, 0.0))
        rb = float(rate_base.get(key, 0.0))
        sc = float(share_cur.get(key, 0.0))
        rc = float(rate_cur.get(key, 0.0))
        structure = (sc - sb) * rb
        single = sc * (rc - rb)
        rows[key] = {
            "share_base": sb,
            "rate_base": rb,
            "share_cur": sc,
            "rate_cur": rc,
            "structure_impact": structure,
            "rate_impact": single,
            "total_impact": structure + single,
        }
        structure_impact += structure
        rate_impact += single
        composite_base += sb * rb
        composite_cur += sc * rc

    total_diff = composite_cur - composite_base
    residual = total_diff - (structure_impact + rate_impact)
    return {
        "structure_impact": structure_impact,
        "rate_impact": rate_impact,
        "total_impact": structure_impact + rate_impact,
        "composite_base": composite_base,
        "composite_cur": composite_cur,
        "total_diff": total_diff,
        "residual": residual,
        "closed": abs(residual) <= TOLERANCE,
        "rows": rows,
    }
