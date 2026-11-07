"""API / 示例数据场景测试：用 TestClient + 临时 SQLite，断言 design.md 第 14 节数字。"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.db import SessionLocal, init_db
from app.importers.registry import DATASETS
from app.models import ChannelRevenueFact, StoreRevenueFact
from app.seeds.load_seed import load_seed
from sqlalchemy import func, select


@pytest.fixture(scope="session")
def seeded() -> dict:
    init_db()
    return load_seed(force=True)


@pytest.fixture()
def client(seeded) -> TestClient:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth(client: TestClient) -> TestClient:
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert response.status_code == 200
    return client


def get_data(client: TestClient, path: str) -> dict:
    response = client.get(path)
    assert response.status_code == 200, response.text
    return response.json()


# ---------------------------------------------------------------------------
# 认证
# ---------------------------------------------------------------------------
def test_login_me_logout(client: TestClient) -> None:
    assert client.get("/api/analysis/overview").status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"username": "admin", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).status_code == 200
    assert client.get("/api/auth/me").json() == {"username": "admin"}
    assert client.post("/api/auth/logout").json() == {"ok": True}
    assert client.get("/api/auth/me").status_code == 401


def test_login_cookie_is_httponly(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    set_cookie = response.headers.get("set-cookie", "")
    assert "cba_session=" in set_cookie
    assert "HttpOnly" in set_cookie


def test_imports_batches_list(auth: TestClient) -> None:
    data = get_data(auth, "/api/imports?limit=20")
    assert data["total"] >= 8
    datasets = {item["dataset"] for item in data["data"]}
    assert "pl_monthly" in datasets
    # 已加载示例数据时再次加载需要 force
    conflict = auth.post("/api/seeds/load")
    assert conflict.status_code == 400
    assert "已加载" in conflict.json()["detail"]


def test_health(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# 总览
# ---------------------------------------------------------------------------
def test_overview(auth: TestClient) -> None:
    payload = get_data(auth, "/api/analysis/overview")
    kpis = payload["data"]["kpis"]
    assert kpis["revenue"]["value"] == 1000.00
    assert kpis["revenue"]["base"] == 760.00
    assert kpis["revenue"]["diff"] == 240.00
    assert kpis["revenue"]["rate"] == pytest.approx(0.3158, abs=1e-4)
    assert kpis["profit"]["value"] == 112.70
    assert kpis["profit"]["base"] == 64.60
    assert kpis["profit"]["diff"] == 48.10
    assert kpis["gross_margin"]["value"] == pytest.approx(0.7330, abs=1e-4)
    assert kpis["gross_margin"]["base"] == pytest.approx(0.7434, abs=1e-4)
    assert kpis["gross_margin"]["diff_pp"] == pytest.approx(-1.04, abs=0.01)
    assert kpis["same_store_growth"]["value"] == pytest.approx(0.1280, abs=1e-4)
    assert payload["meta"]["period"] == "2025-09"
    assert payload["meta"]["baseline"] == "2024-09"

    bridge = payload["data"]["profit_bridge"]
    assert bridge["start"] == 64.60
    assert bridge["end"] == 112.70
    assert len(bridge["items"]) == 9
    by_key = {item["key"]: item["impact"] for item in bridge["items"]}
    assert by_key["revenue_scale"] == pytest.approx(100.48, abs=0.02)
    assert by_key["food_cost"] == pytest.approx(-10.42, abs=0.02)
    assert by_key["discount_fee"] == pytest.approx(12.93, abs=0.02)
    assert by_key["utilities"] == pytest.approx(2.17, abs=0.02)
    assert by_key["marketing"] == pytest.approx(7.39, abs=0.02)
    assert by_key["salary"] == pytest.approx(-12.03, abs=0.02)
    assert by_key["dorm_rent"] == pytest.approx(-1.66, abs=0.02)
    assert by_key["store_rent"] == pytest.approx(-13.76, abs=0.02)
    assert by_key["other"] == pytest.approx(-37.00, abs=0.02)
    assert len(payload["insights"]) <= 3
    assert payload["insights"][0]["level"] in ("positive", "negative", "info")
    assert "240.00" in payload["data"]["summary"]


# ---------------------------------------------------------------------------
# 营业利润
# ---------------------------------------------------------------------------
def test_profit_month(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/profit")["data"]
    rows = {row["account"]: row for row in data["rows"]}
    assert rows["营业收入"]["current"] == 1000.00
    assert rows["营业收入"]["base"] == 760.00
    assert rows["营业收入"]["rate"] == pytest.approx(0.3158, abs=1e-4)
    assert rows["食材成本"]["current"] == 267.00
    assert rows["食材成本"]["current_ratio"] == pytest.approx(0.2670, abs=1e-4)
    assert rows["食材成本"]["ratio_pp"] == pytest.approx(0.0104, abs=1e-4)
    profit = data["profit"]
    assert profit["current"] == 112.70
    assert profit["base"] == 64.60
    assert profit["diff"] == 48.10
    assert profit["rate"] == pytest.approx(0.7446, abs=1e-3)
    assert len(data["profit_bridge"]["items"]) == 9


def test_profit_ytd(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/profit?mode=ytd")["data"]
    rows = {row["account"]: row for row in data["rows"]}
    assert rows["营业收入"]["current"] == pytest.approx(7990.00, abs=0.02)
    assert rows["营业收入"]["base"] == pytest.approx(4060.00, abs=0.02)
    assert data["profit"]["current"] == pytest.approx(812.29, abs=0.05)


def test_profit_budget(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/profit?baseline=budget")["data"]
    assert data["budget"]["revenue"]["budget"] == 1500.0
    assert data["budget"]["revenue"]["achievement"] == pytest.approx(0.6667, abs=1e-4)
    assert data["budget"]["revenue"]["reached"] is False
    assert data["budget"]["profit"]["budget"] is None


# ---------------------------------------------------------------------------
# 收入结构
# ---------------------------------------------------------------------------
def test_structure_all_dimensions(auth: TestClient) -> None:
    expected_totals = {
        "business_model": (1000.23, 759.95),
        "store_type": (1000.23, 759.95),
        "region": (1000.23, 759.95),
        "channel": (1000.00, 759.56),
        "channel_category": (1000.00, 759.56),
        "series": (1000.16, 760.00),
    }
    for dimension, (current, base) in expected_totals.items():
        data = get_data(auth, f"/api/analysis/revenue/structure?dimension={dimension}")["data"]
        assert data["total"]["current"] == pytest.approx(current, abs=0.02), dimension
        assert data["total"]["base"] == pytest.approx(base, abs=0.02), dimension
        assert sum(row["current"] for row in data["rows"]) == pytest.approx(current, abs=0.02)


def test_structure_channel_rows(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/revenue/structure?dimension=channel")["data"]
    meituan = next(row for row in data["rows"] if row["name"] == "美团大众")
    assert meituan["current"] == 460.00
    assert meituan["base"] == 336.00
    assert meituan["diff"] == 124.00
    assert meituan["rate"] == pytest.approx(0.3690, abs=1e-4)
    assert meituan["current_share"] == pytest.approx(0.46, abs=1e-4)


def test_structure_same_new(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/revenue/structure?dimension=store_type")["data"]
    rows = {row["name"]: row for row in data["rows"]}
    assert rows["同店"]["current"] == pytest.approx(857.23, abs=0.02)
    assert rows["同店"]["base"] == pytest.approx(759.95, abs=0.02)
    assert rows["新店"]["current"] == pytest.approx(143.00, abs=0.02)
    assert rows["新店"]["rate"] is None


# ---------------------------------------------------------------------------
# 同店异动
# ---------------------------------------------------------------------------
def test_same_store(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/revenue/same-store")["data"]
    summary = data["summary"]
    assert summary["current"] == 857.23
    assert summary["base"] == 759.95
    assert summary["diff"] == 97.28
    assert summary["rate"] == pytest.approx(0.1280, abs=1e-4)
    assert summary["traffic"]["current"] == pytest.approx(66566.29, abs=0.02)
    assert summary["traffic"]["base"] == pytest.approx(59344.75, abs=0.02)
    assert summary["traffic"]["diff"] == pytest.approx(7221.54, abs=0.02)
    assert summary["ticket"]["current"] == pytest.approx(128.78, abs=0.01)
    assert summary["ticket"]["base"] == pytest.approx(128.08, abs=0.01)
    assert summary["ticket"]["diff"] == pytest.approx(0.70, abs=0.01)
    assert summary["traffic_impact"] == pytest.approx(92.07, abs=0.02)
    assert summary["ticket_impact"] == pytest.approx(5.08, abs=0.02)
    assert "0.12" in summary["variance_note"]
    assert len(data["stores"]) == 13
    assert {item["store_name"] for item in data["new_stores"]} == {"新店1", "新店2"}


def test_store_detail_12(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/revenue/store/12")["data"]
    summary = data["summary"]
    assert summary["traffic"]["current"] == pytest.approx(4276.24, abs=0.02)
    assert summary["traffic"]["base"] == pytest.approx(4556.15, abs=0.02)
    assert summary["revenue"]["current"] == 56.10
    assert summary["revenue"]["base"] == 59.23
    assert summary["traffic_impact"] == pytest.approx(-3.64, abs=0.02)
    assert summary["ticket_impact"] == pytest.approx(0.51, abs=0.02)
    dayparts = {(row["day_type"], row["daypart"]): row for row in data["dayparts"]}
    lunch = dayparts[("工作日", "9:00-14:00")]
    assert lunch["current"] == 794
    assert lunch["base"] == 950
    assert lunch["diff"] == -156
    assert lunch["rate"] == pytest.approx(-0.1642, abs=1e-4)
    assert data["dayparts_total"]["current"] == 4276
    assert data["dayparts_total"]["base"] == 4556
    assert data["dayparts_total"]["diff"] == -280
    day_types = {row["day_type"]: row for row in data["day_types"]}
    assert day_types["工作日"]["diff"] == -465
    assert day_types["节假日"]["diff"] == 185


# ---------------------------------------------------------------------------
# 渠道
# ---------------------------------------------------------------------------
def test_channel(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/revenue/channel")["data"]
    assert data["total"]["current"] == 1000.00
    assert data["total"]["base"] == 759.56
    assert data["total"]["diff"] == 240.44
    meituan = next(row for row in data["rows"] if row["name"] == "美团大众")
    assert meituan["current"] == 460.00
    assert meituan["base"] == 336.00
    assert meituan["same_store"] == pytest.approx(394.23, abs=0.01)
    assert meituan["new_store"] == pytest.approx(65.77, abs=0.01)
    assert meituan["diff"] == pytest.approx(58.24, abs=0.02)
    assert meituan["rate"] == pytest.approx(0.1733, abs=1e-3)
    categories = {row["name"]: row for row in data["categories"]}
    assert categories["堂食"]["current"] == pytest.approx(906.58, abs=0.02)
    assert categories["堂食"]["base"] == pytest.approx(685.00, abs=0.02)
    assert categories["外卖"]["current"] == pytest.approx(93.42, abs=0.02)
    assert categories["外卖"]["base"] == pytest.approx(74.56, abs=0.02)


def test_channel_detail(auth: TestClient) -> None:
    payload = get_data(auth, "/api/analysis/revenue/channel/1")
    data = payload["data"]
    funnel = data["funnel"]
    # 漏斗以 Excel「标杆品牌点评曝光转化数据」合计行为准（用户确认 Excel 优先）
    assert funnel["exposure"] == 4367174
    assert funnel["visits"] == 639025
    assert funnel["payers"] == 73113
    assert funnel["consumers"] == 64468
    assert funnel["brand_customers"] == 69298
    assert funnel["new_customers"] == 59703
    assert funnel["old_customers"] == 9595
    assert funnel["exposure_visit"] == pytest.approx(0.1463, abs=5e-4)
    assert funnel["visit_pay"] == pytest.approx(0.1144, abs=5e-4)
    assert funnel["pay_consume"] == pytest.approx(0.8818, abs=5e-4)
    assert funnel["exposure_pay"] == pytest.approx(0.0167, abs=5e-4)
    economics = data["economics"]
    assert economics["revenue"] == 460.00
    assert economics["platform_fee"] == 138.00
    assert economics["fee_rate"] == pytest.approx(0.30, abs=1e-4)
    # 毛利额 = 460 × 60% = 276；毛利 ROI = 276 / 138 = 2.00，与 api-contract 修正版一致
    assert economics["gross_profit"] == pytest.approx(276.00, abs=0.01)
    assert economics["gross_roi"] == pytest.approx(2.00, abs=0.01)
    assert economics["sales_roi"] == pytest.approx(3.33, abs=0.01)
    assert economics["gross_roi"] == pytest.approx(
        economics["gross_profit"] / economics["platform_fee"], abs=1e-4
    )
    assert economics["status"]["fee_rate"] == "risk"
    assert economics["status"]["gross_roi"] == "ok"
    assert len(payload["insights"]) >= 1


# ---------------------------------------------------------------------------
# 产品
# ---------------------------------------------------------------------------
def test_product_same_store(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/revenue/product?scope=same_store")["data"]
    assert data["total"]["current"] == pytest.approx(857.17, abs=0.02)
    assert data["total"]["base"] == pytest.approx(760.00, abs=0.02)
    assert data["total"]["diff"] == pytest.approx(97.17, abs=0.02)
    qty_impact = sum(row["qty_impact"] for row in data["series"])
    price_impact = sum(row["price_impact"] for row in data["series"])
    assert qty_impact == pytest.approx(91.50, abs=0.02)
    assert price_impact == pytest.approx(5.67, abs=0.02)
    meat = next(row for row in data["series"] if row["name"] == "肉类")
    assert meat["qty"]["current"] == pytest.approx(130377.84, abs=0.5)
    assert meat["diff"] == pytest.approx(80.00, abs=0.02)


def test_product_sets(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/revenue/product?scope=all")["data"]
    sets = data["sets"]
    assert sets["base"]["qty"] == 432
    assert sets["current"]["qty"] == 5472
    assert sets["base"]["amount"] == pytest.approx(66080.00, abs=0.02)
    assert sets["current"]["amount"] == pytest.approx(444217.54, abs=0.02)
    assert sets["base"]["avg_price"] == pytest.approx(152.96, abs=0.01)
    assert sets["current"]["avg_price"] == pytest.approx(81.18, abs=0.01)
    assert sets["qty_impact"] == pytest.approx(770933.33, abs=0.05)
    assert sets["price_impact"] == pytest.approx(-392795.79, abs=0.05)
    assert sets["diff"] == pytest.approx(378137.54, abs=0.05)


def test_product_items_ranking(auth: TestClient) -> None:
    """单品/套餐明细 ≥20 行（来自 Excel 套餐明细），且不影响套餐量价汇总（表4 口径）。"""
    data = get_data(auth, "/api/analysis/revenue/product?scope=all")["data"]
    items = data["items"]
    assert len(items) >= 20
    assert all(item["is_set"] for item in items)
    names = {item["name"] for item in items}
    assert "【一桌吃遍潮汕鲜】双人套餐" in names
    assert "鲜切牛肉吨吨桶" in names
    # 明细与表4 汇总不是同一快照：套餐量价仍只取「线上套餐」汇总行
    assert data["sets"]["current"]["qty"] == 5472
    assert data["sets"]["base"]["qty"] == 432
    assert data["sets"]["qty_impact"] == pytest.approx(770933.33, abs=0.05)
    assert data["sets"]["price_impact"] == pytest.approx(-392795.79, abs=0.05)


# ---------------------------------------------------------------------------
# 结论
# ---------------------------------------------------------------------------
def test_conclusion(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/revenue/conclusion")["data"]
    summary = data["summary"]
    assert summary["new_store"] == 143.00
    assert summary["same_store_traffic"] == pytest.approx(92.07, abs=0.02)
    assert summary["same_store_ticket"] == pytest.approx(5.08, abs=0.02)
    assert summary["closed_store"] == 0
    assert summary["total_diff"] == pytest.approx(240.28, abs=0.02)
    assert "0.13" in summary["variance_note"]
    assert len(data["conclusions"]) == 3
    assert len(data["actions"]) == 3
    assert "新店" in data["conclusions"][0]


# ---------------------------------------------------------------------------
# 数据状态与导入
# ---------------------------------------------------------------------------
def test_data_status(auth: TestClient) -> None:
    data = get_data(auth, "/api/data-status?period=2025-09")["data"]
    assert data["modules"]["dashboard"]["ready"] is True
    assert data["modules"]["revenue"]["ready"] is True
    assert {d["key"]: d for d in data["datasets"]}["funnel"]["rows"] == 1
    missing = get_data(auth, "/api/data-status?period=2030-01")["data"]
    assert missing["modules"]["profit"]["ready"] is False
    assert missing["baseline_ready"] is False
    joined = "；".join(missing["modules"]["profit"]["missing"])
    assert "月度利润表" in joined
    assert "对比期 2029-01" in joined
    assert missing["baseline"] == "2029-01"


def test_templates(auth: TestClient) -> None:
    templates = auth.get("/api/imports/templates")
    assert templates.status_code == 200
    items = templates.json()
    assert len(items) == 8
    assert {item["key"] for item in items} == set(DATASETS)
    download = auth.get("/api/imports/templates/pl_monthly.xlsx")
    assert download.status_code == 200
    assert download.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    from io import BytesIO

    from openpyxl import load_workbook

    workbook = load_workbook(BytesIO(download.content))
    sheet = workbook.active
    headers = [cell.value for cell in sheet[1]]
    assert headers[:3] == ["期间", "门店", "营业收入"]
    assert "税金及附加" in headers
    assert sheet.cell(row=3, column=1).value.startswith("说明：")


def test_reimport_does_not_accumulate(auth: TestClient) -> None:
    from pathlib import Path

    seed_file = Path(__file__).resolve().parent.parent / "seed" / "02_门店收入.csv"
    content = seed_file.read_bytes()
    upload = auth.post(
        "/api/imports",
        data={"dataset": "store_revenue"},
        files={"file": ("02_门店收入.csv", content, "text/csv")},
    )
    assert upload.status_code == 200, upload.text
    batch = upload.json()
    assert batch["status"] == "draft"
    assert batch["errors"] == []
    assert len(batch["coverage"]) >= 1
    assert any("门店1" in item["message"] and "2025-09" in item["message"] for item in batch["coverage"])

    commit = auth.post(f"/api/imports/{batch['id']}/commit")
    assert commit.status_code == 200, commit.text
    assert commit.json()["status"] == "committed"

    session = SessionLocal()
    try:
        active = session.scalar(
            select(func.count(StoreRevenueFact.id)).where(
                StoreRevenueFact.period == "2025-09",
                StoreRevenueFact.superseded_by.is_(None),
            )
        )
    finally:
        session.close()
    assert active == 15  # 没有累加成 30 行

    # 回滚这次重复导入后，旧数据恢复，分析结果不变
    rollback = auth.post(f"/api/imports/{batch['id']}/rollback")
    assert rollback.status_code == 200
    data = get_data(auth, "/api/analysis/revenue/same-store")["data"]
    assert data["summary"]["current"] == 857.23


def test_unauthorized_import(client: TestClient) -> None:
    assert client.get("/api/imports").status_code == 401
    assert client.get("/api/data-status").status_code == 401


def test_force_reload_is_idempotent(auth: TestClient) -> None:
    """覆盖导入不能累加：--force 重新加载后总体数字不变。"""
    before = get_data(auth, "/api/analysis/overview")["data"]["kpis"]["revenue"]
    load_seed(force=True)
    after = get_data(auth, "/api/analysis/overview")["data"]["kpis"]["revenue"]
    assert before["value"] == 1000.0
    assert after["value"] == 1000.0
    assert after["base"] == 760.0
    status = get_data(auth, "/api/data-status?period=2025-09")["data"]
    assert {d["key"]: d for d in status["datasets"]}["pl_monthly"]["rows"] == 10  # 2025-09 品牌口径 10 个科目，未累加


# ---------------------------------------------------------------------------
# 评审补充：预算基准缺失、坏文件、时段主因、分位结构
# ---------------------------------------------------------------------------
def test_budget_baseline_incomplete_is_null_not_zero(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/overview?baseline=budget")["data"]
    assert data["profit_bridge"] is None
    assert data["kpis"]["profit"]["base"] is None
    assert data["kpis"]["profit"]["diff"] is None
    assert data["kpis"]["gross_margin"]["base"] is None
    assert "预算未导入" in data["summary"]
    profit = get_data(auth, "/api/analysis/profit?baseline=budget")["data"]
    assert profit["profit_bridge"] is None
    assert profit["profit"]["base"] is None
    assert profit["rows"][1]["base"] is None


def test_invalid_xlsx_returns_row_error_not_500(auth: TestClient) -> None:
    response = auth.post(
        "/api/imports",
        data={"dataset": "pl_monthly"},
        files={"file": ("bad.xlsx", b"this is not a zip", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["errors"], body
    assert "不是有效的 xlsx" in body["errors"][0]["message"]


def test_store_daypart_highlight_and_rates(auth: TestClient) -> None:
    data = get_data(auth, "/api/analysis/revenue/store/12")["data"]
    assert data["daypart_highlight"] is not None
    highlighted = [row for row in data["dayparts"] if row.get("highlight")]
    assert len(highlighted) == 1
    insight = get_data(auth, "/api/analysis/revenue/store/12")["insights"][0]["text"]
    assert "同比分别 — / —" not in insight


def test_overview_percentile_keys_for_frontend(auth: TestClient) -> None:
    percentiles = get_data(auth, "/api/analysis/overview")["data"]["percentiles"]
    assert percentiles["revenue"] is not None
    assert percentiles["same_store_growth"] is not None
    assert percentiles["gross_margin"] is None
    assert "percentile_hints" in percentiles
    assert percentiles["revenue"]["n"] == 13
