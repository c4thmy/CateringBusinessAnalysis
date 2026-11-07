"""计算引擎单测：全部用 shared/fixtures/*.json 断言（design.md 第 14 节）。"""

from __future__ import annotations

import math

import pytest

from app.engine import (
    chain_substitution,
    compare,
    compare_rate,
    funnel,
    mix_rate_split,
    percentiles,
    product_volume_price,
    profit_bridge,
    roi,
    same_store,
    structure,
)
from app.engine.revenue import channel_split
from conftest import load_fixture


def _close(actual, expected, tolerance=0.02) -> bool:
    if expected is None:
        return actual is None
    if actual is None:
        return False
    return abs(actual - expected) <= tolerance


# ---------------------------------------------------------------------------
# compare
# ---------------------------------------------------------------------------
def test_compare_revenue_yoy() -> None:
    fixture = load_fixture("compare_chain_2509")
    case = fixture["input"]["revenue"]
    result = compare(case["current"], case["base"])
    assert result["diff"] == pytest.approx(240.0)
    assert result["rate"] == pytest.approx(0.3158, abs=1e-4)


def test_compare_zero_base_returns_none() -> None:
    fixture = load_fixture("compare_chain_2509")
    case = fixture["input"]["new_store_revenue"]
    result = compare(case["current"], case["base"])
    assert result["diff"] == pytest.approx(143.0)
    assert result["rate"] is None
    assert compare_rate(0.2670, 0.2566)["pp"] == pytest.approx(1.04, abs=1e-9)


# ---------------------------------------------------------------------------
# chain_substitution
# ---------------------------------------------------------------------------
def test_chain_substitution_closes() -> None:
    fixture = load_fixture("compare_chain_2509")
    factors = fixture["input"]["gross_profit_factors"]
    result = chain_substitution(
        ["qty", "price"],
        factors["base"],
        factors["current"],
        lambda v: v["qty"] * v["price"] / 10000,
    )
    expected = fixture["expected"]["gross_profit"]
    assert result["closed"] is True
    assert result["total_change"] == pytest.approx(expected["total_change"], abs=0.05)
    assert abs(result["residual"]) <= 0.01


def test_chain_substitution_revenue_two_factors() -> None:
    # 单店（门店1）：客流 4750→5617.886、客单 122→123
    # 客流影响 = 867.886 × 122 = 10.59 万；客单影响 = 5617.886 × 1 = 0.56 万
    result = chain_substitution(
        ["traffic", "ticket"],
        {"traffic": 4750, "ticket": 122},
        {"traffic": 5617.88617886177, "ticket": 123},
        lambda v: v["traffic"] * v["ticket"] / 10000,
    )
    assert result["items"][0]["factor"] == "traffic"
    assert result["items"][0]["impact"] == pytest.approx(10.59, abs=0.02)
    assert result["items"][1]["impact"] == pytest.approx(0.56, abs=0.02)
    assert result["closed"] is True
    # 汇总层直接相乘会得到 92.48（与逐店加总的 92.07 差 0.41），因此同店页面按门店逐店计算再汇总
    aggregate = chain_substitution(
        ["traffic", "ticket"],
        {"traffic": 59344.75, "ticket": 128.078},
        {"traffic": 66566.29, "ticket": 128.778},
        lambda v: v["traffic"] * v["ticket"] / 10000,
    )
    assert aggregate["items"][0]["impact"] == pytest.approx(92.49, abs=0.02)


# ---------------------------------------------------------------------------
# profit_bridge
# ---------------------------------------------------------------------------
def test_profit_bridge_matches_excel() -> None:
    fixture = load_fixture("profit_bridge_2509")
    result = profit_bridge(fixture["input"]["base"], fixture["input"]["current"])
    expected = fixture["expected"]
    assert result["start"] == pytest.approx(expected["start"], abs=0.02)
    assert result["end"] == pytest.approx(expected["end"], abs=0.02)
    by_key = {item["key"]: item for item in result["items"]}
    assert len(by_key) == 9
    for key, value in expected["items"].items():
        assert by_key[key]["impact"] == pytest.approx(value, abs=0.02), key
    assert result["closed"] is True
    assert result["base_marginal_contribution_rate"] == pytest.approx(
        expected["base_marginal_contribution_rate"], abs=1e-4
    )
    assert by_key["revenue_scale"]["note"].startswith("收入增长 240.00 万")


# ---------------------------------------------------------------------------
# mix_rate_split / percentiles
# ---------------------------------------------------------------------------
def test_mix_rate_split_closes() -> None:
    result = mix_rate_split(
        share_base={"肉类": 0.5105, "涮品": 0.1855},
        rate_base={"肉类": 0.7326, "涮品": 0.8006},
        share_cur={"肉类": 0.5460, "涮品": 0.2108},
        rate_cur={"肉类": 0.7200, "涮品": 0.8492},
    )
    assert result["closed"] is True
    assert result["total_impact"] == pytest.approx(result["total_diff"], abs=0.001)
    assert result["structure_impact"] + result["rate_impact"] == pytest.approx(
        result["total_impact"], abs=1e-9
    )


def test_percentiles_linear_and_guard() -> None:
    assert percentiles([1.0, 2.0]) is None
    pct = percentiles([0.70, 0.72, 0.74, 0.76])
    assert pct is not None
    assert pct["p50"] == pytest.approx(0.73)
    assert pct["p25"] == pytest.approx(0.715)
    assert pct["p75"] == pytest.approx(0.745)
    assert math.isclose(pct["n"], 4)


# ---------------------------------------------------------------------------
# 收入结构
# ---------------------------------------------------------------------------
def test_structure_channel() -> None:
    fixture = load_fixture("revenue_structure_2509")
    result = structure(fixture["input"]["channel"], "channel", "渠道")
    expected = fixture["expected"]["channel"]
    assert result["total"]["current"] == pytest.approx(expected["total"]["current"], abs=0.02)
    assert result["total"]["base"] == pytest.approx(expected["total"]["base"], abs=0.02)
    assert result["total"]["diff"] == pytest.approx(expected["total"]["diff"], abs=0.02)
    assert result["total"]["rate"] == pytest.approx(expected["total"]["rate"], abs=1e-3)
    meituan = next(row for row in result["rows"] if row["key"] == "meituan_dazhong")
    assert meituan["current"] == pytest.approx(460.0)
    assert meituan["diff"] == pytest.approx(124.0)
    assert meituan["rate"] == pytest.approx(0.3690, abs=1e-4)
    assert sum(row["current"] for row in result["rows"]) == pytest.approx(1000.0)


def test_structure_same_new_store() -> None:
    fixture = load_fixture("revenue_structure_2509")
    result = structure(fixture["input"]["same_new"], "store_type", "门店类型")
    expected = fixture["expected"]["same_new"]
    same = next(row for row in result["rows"] if row["key"] == "same_store")
    new = next(row for row in result["rows"] if row["key"] == "new_store")
    assert same["current"] == pytest.approx(857.23, abs=0.02)
    assert same["base"] == pytest.approx(759.95, abs=0.02)
    assert same["rate"] == pytest.approx(0.1280, abs=1e-4)
    assert new["current"] == pytest.approx(143.0)
    assert new["rate"] is None
    assert result["total"]["current"] == pytest.approx(1000.23, abs=0.02)


# ---------------------------------------------------------------------------
# 同店
# ---------------------------------------------------------------------------
def test_same_store_summary() -> None:
    fixture = load_fixture("same_store_2509")
    result = same_store(fixture["input"]["stores"])
    summary = result["summary"]
    expected = fixture["expected"]["summary"]
    assert summary["current"] == pytest.approx(expected["current"], abs=0.02)
    assert summary["base"] == pytest.approx(expected["base"], abs=0.02)
    assert summary["diff"] == pytest.approx(expected["diff"], abs=0.02)
    assert summary["rate"] == pytest.approx(expected["rate"], abs=1e-3)
    assert summary["traffic"]["current"] == pytest.approx(expected["traffic"]["current"], abs=0.05)
    assert summary["traffic"]["base"] == pytest.approx(expected["traffic"]["base"], abs=0.05)
    assert summary["traffic"]["diff"] == pytest.approx(expected["traffic"]["diff"], abs=0.05)
    assert summary["ticket"]["current"] == pytest.approx(expected["ticket"]["current"], abs=0.02)
    assert summary["ticket"]["base"] == pytest.approx(expected["ticket"]["base"], abs=0.02)
    assert summary["ticket"]["diff"] == pytest.approx(expected["ticket"]["diff"], abs=0.02)
    assert summary["traffic_impact"] == pytest.approx(expected["traffic_impact"], abs=0.02)
    assert summary["ticket_impact"] == pytest.approx(expected["ticket_impact"], abs=0.02)
    assert summary["impact_sum"] == pytest.approx(expected["impact_sum"], abs=0.02)
    assert "0.12" in (summary["variance_note"] or "")
    assert len(result["stores"]) == 13


def test_same_store_store12_drilldown() -> None:
    fixture = load_fixture("same_store_2509")
    result = same_store(fixture["input"]["stores"])
    store12 = next(row for row in result["stores"] if row["store_id"] == 12)
    expected = fixture["expected"]["store_12"]
    assert store12["traffic"]["current"] == pytest.approx(4276.24, abs=0.02)
    assert store12["traffic"]["base"] == pytest.approx(4556.15, abs=0.02)
    assert store12["revenue"]["current"] == pytest.approx(56.10, abs=0.02)
    assert store12["revenue"]["base"] == pytest.approx(59.23, abs=0.02)
    assert store12["traffic_impact"] == pytest.approx(-3.64, abs=0.02)
    assert store12["ticket_impact"] == pytest.approx(0.51, abs=0.02)
    assert store12["diff"] == pytest.approx(-3.13, abs=0.02)


# ---------------------------------------------------------------------------
# 渠道同店分摊
# ---------------------------------------------------------------------------
def test_channel_split() -> None:
    fixture = load_fixture("channel_split_2509")
    case = fixture["input"]
    result = channel_split(
        case["channels"],
        case["same_store_revenue"],
        case["new_store_revenue"],
        case["total_store_revenue"],
    )
    expected = fixture["expected"]
    meituan = result["rows"][0]
    assert meituan["same_store"] == pytest.approx(expected["meituan_dazhong"]["same_store"], abs=0.02)
    assert meituan["new_store"] == pytest.approx(expected["meituan_dazhong"]["new_store"], abs=0.02)
    assert meituan["diff"] == pytest.approx(expected["meituan_dazhong"]["diff"], abs=0.02)
    assert meituan["rate"] == pytest.approx(expected["meituan_dazhong"]["rate"], abs=1e-3)
    assert result["total"]["same_store"] == pytest.approx(expected["total"]["same_store"], abs=0.02)
    assert result["total"]["new_store"] == pytest.approx(expected["total"]["new_store"], abs=0.02)
    assert result["total"]["diff"] == pytest.approx(expected["total"]["diff"], abs=0.02)
    for row in result["rows"]:
        assert row["same_store"] + row["new_store"] == pytest.approx(row["current"], abs=1e-9)


# ---------------------------------------------------------------------------
# 产品量价
# ---------------------------------------------------------------------------
def test_product_volume_price_same_store() -> None:
    fixture = load_fixture("product_volume_price_2509")
    case = fixture["input"]
    result = product_volume_price(
        case["series_current"],
        case["series_base"],
        same_store_ratio=case["same_store_ratio"],
        scope="same_store",
    )
    expected = fixture["expected"]["same_store"]
    assert result["total"]["current"] == pytest.approx(expected["total"]["current"], abs=0.02)
    assert result["total"]["base"] == pytest.approx(expected["total"]["base"], abs=0.02)
    assert result["total"]["diff"] == pytest.approx(expected["total"]["diff"], abs=0.02)
    qty_impact = sum(row["qty_impact"] for row in result["series"])
    price_impact = sum(row["price_impact"] for row in result["series"])
    assert qty_impact == pytest.approx(expected["qty_impact"], abs=0.02)
    assert price_impact == pytest.approx(expected["price_impact"], abs=0.02)
    meat = next(row for row in result["series"] if row["name"] == "肉类")
    assert meat["qty"]["current"] == pytest.approx(130377.84, abs=0.5)
    assert meat["price"]["current"] == pytest.approx(35.90, abs=0.01)


def test_product_volume_price_all_store_and_sets() -> None:
    fixture = load_fixture("product_volume_price_2509")
    case = fixture["input"]
    result = product_volume_price(
        case["series_current"],
        case["series_base"],
        sets_current=case["sets_current"],
        sets_base=case["sets_base"],
        scope="all",
    )
    expected = fixture["expected"]
    assert sum(row["qty_impact"] for row in result["series"]) == pytest.approx(
        expected["all_store"]["qty_impact"], abs=0.02
    )
    assert result["sets"]["qty_impact"] == pytest.approx(expected["sets"]["qty_impact"], abs=0.05)
    assert result["sets"]["price_impact"] == pytest.approx(expected["sets"]["price_impact"], abs=0.05)
    assert result["sets"]["diff"] == pytest.approx(expected["sets"]["diff"], abs=0.05)
    assert result["sets"]["current"]["avg_price"] == pytest.approx(81.18, abs=0.01)
    assert result["sets"]["base"]["avg_price"] == pytest.approx(152.96, abs=0.01)


# ---------------------------------------------------------------------------
# 漏斗 / ROI
# ---------------------------------------------------------------------------
def test_funnel_rates() -> None:
    fixture = load_fixture("funnel_2509")
    result = funnel(fixture["input"])
    expected = fixture["expected"]
    for key in ("exposure_visit", "visit_pay", "pay_consume", "exposure_pay"):
        assert result[key] == pytest.approx(expected[key], abs=0.0005), key
    assert result["brand_customers"] == 69298
    assert result["new_customers"] == 59703
    assert result["old_customers"] == 9595


def test_funnel_missing_values_are_none_not_zero() -> None:
    result = funnel({"exposure": 1000, "visits": None, "payers": 10, "consumers": None})
    assert result["exposure_visit"] is None
    assert result["visit_pay"] is None
    assert result["pay_consume"] is None


def test_roi_thresholds() -> None:
    fixture = load_fixture("roi_2509")
    case = fixture["input"]
    result = roi(case["meituan_dazhong"]["revenue"], case["meituan_dazhong"]["platform_fee"], case["meituan_dazhong"]["gross_margin"], case["thresholds"])
    expected = fixture["expected"]["meituan_dazhong"]
    assert result["fee_rate"] == pytest.approx(expected["fee_rate"], abs=0.001)
    assert result["gross_roi"] == pytest.approx(expected["gross_roi"], abs=0.01)
    assert result["sales_roi"] == pytest.approx(expected["sales_roi"], abs=0.01)
    assert result["status"]["fee_rate"] == "risk"
    assert result["status"]["gross_roi"] == "ok"
    assert result["status"]["sales_roi"] == "warning"

    takeaway = roi(
        case["takeaway_budget"]["revenue"],
        case["takeaway_budget"]["platform_fee"],
        case["takeaway_budget"]["gross_margin"],
        case["thresholds"],
    )
    assert takeaway["gross_roi"] == pytest.approx(1.20, abs=0.01)
