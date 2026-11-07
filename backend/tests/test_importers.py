"""导入器测试：合法/非法文件、未知科目映射、跨表校验、两阶段提交与模板。"""

from __future__ import annotations

import csv
import io

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.db import SessionLocal
from app.importers.registry import DATASETS
from app.models import PLFact, StoreRevenueFact
from app.seeds.load_seed import load_seed


@pytest.fixture(scope="session")
def seeded() -> dict:
    from app.db import init_db

    init_db()
    return load_seed(force=True)


@pytest.fixture()
def client(seeded) -> TestClient:
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth(client: TestClient) -> TestClient:
    assert client.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).status_code == 200
    return client


def csv_bytes(header: list[str], rows: list[list]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def upload(client: TestClient, dataset: str, filename: str, content: bytes, mapping: str | None = None) -> dict:
    data = {"dataset": dataset}
    if mapping:
        data["account_mapping"] = mapping
    response = client.post("/api/imports", data=data, files={"file": (filename, content, "text/csv")})
    assert response.status_code == 200, response.text
    return response.json()


PL_HEADER = ["期间", "门店", "营业收入", "食材成本", "优惠及手续费", "水电气低值", "宣传费用", "工资奖金", "宿舍房租", "店铺房租", "其它费用", "税金及附加"]


def pl_row(period: str, revenue: float = 1000, **overrides) -> list:
    values = {
        "营业收入": revenue,
        "食材成本": 267,
        "优惠及手续费": 234.96,
        "水电气低值": 39.94,
        "宣传费用": 27.35,
        "工资奖金": 147.03,
        "宿舍房租": 17.16,
        "店铺房租": 69.86,
        "其它费用": 84,
        "税金及附加": 0,
    }
    values.update(overrides)
    return [period, "全部", *[values[name] for name in PL_HEADER[2:]]]


# ---------------------------------------------------------------------------
# 合法文件：草稿 → 确认 → 回滚
# ---------------------------------------------------------------------------
def test_stage_does_not_write_commit_does(auth: TestClient) -> None:
    session = SessionLocal()
    try:
        before = session.scalar(select(func.count(PLFact.id)).where(PLFact.period == "2030-01"))
    finally:
        session.close()
    assert before == 0

    batch = upload(auth, "pl_monthly", "pl.csv", csv_bytes(PL_HEADER, [pl_row("2030-01", 1234)]))
    assert batch["status"] == "draft"
    assert batch["errors"] == []
    assert batch["row_count"] == 0
    assert batch["preview"][0]["期间"] == "2030-01"
    assert batch["period_from"] == "2030-01"

    session = SessionLocal()
    try:
        during = session.scalar(select(func.count(PLFact.id)).where(PLFact.period == "2030-01"))
    finally:
        session.close()
    assert during == 0  # draft 不写事实表

    commit = auth.post(f"/api/imports/{batch['id']}/commit")
    assert commit.status_code == 200
    assert commit.json()["status"] == "committed"
    assert commit.json()["row_count"] == 10  # 营业收入 + 9 个成本费用科目

    session = SessionLocal()
    try:
        after = session.scalar(select(func.count(PLFact.id)).where(PLFact.period == "2030-01"))
    finally:
        session.close()
    assert after == 10

    rollback = auth.post(f"/api/imports/{batch['id']}/rollback")
    assert rollback.status_code == 200
    assert rollback.json()["status"] == "rolled_back"
    session = SessionLocal()
    try:
        final = session.scalar(select(func.count(PLFact.id)).where(PLFact.period == "2030-01"))
    finally:
        session.close()
    assert final == 0


def test_reimport_supersedes_old_rows(auth: TestClient) -> None:
    session = SessionLocal()
    try:
        before = session.scalar(
            select(func.count(StoreRevenueFact.id)).where(
                StoreRevenueFact.period == "2025-09", StoreRevenueFact.superseded_by.is_(None)
            )
        )
    finally:
        session.close()
    assert before == 15

    header = ["期间", "门店", "营业收入（万元）", "客流（人次）", "客单价（元）"]
    row = ["2025-09", "门店1", 70.00, 5600, 125]
    batch = upload(auth, "store_revenue", "store.csv", csv_bytes(header, [row]))
    assert batch["errors"] == []
    assert batch["coverage"][0]["period"] == "2025-09"
    assert "门店1" in batch["coverage"][0]["message"]
    commit = auth.post(f"/api/imports/{batch['id']}/commit")
    assert commit.status_code == 200

    session = SessionLocal()
    try:
        active = session.scalars(
            select(StoreRevenueFact).where(
                StoreRevenueFact.period == "2025-09",
                StoreRevenueFact.store_id == 1,
                StoreRevenueFact.superseded_by.is_(None),
            )
        ).all()
    finally:
        session.close()
    assert len(active) == 1
    assert active[0].revenue == 70.00

    # 回滚：新行删除、旧行恢复
    assert auth.post(f"/api/imports/{batch['id']}/rollback").status_code == 200
    session = SessionLocal()
    try:
        restored = session.scalars(
            select(StoreRevenueFact).where(
                StoreRevenueFact.period == "2025-09",
                StoreRevenueFact.store_id == 1,
                StoreRevenueFact.superseded_by.is_(None),
            )
        ).all()
    finally:
        session.close()
    assert len(restored) == 1
    assert restored[0].revenue == 69.10


# ---------------------------------------------------------------------------
# 非法文件
# ---------------------------------------------------------------------------
def test_invalid_period_and_negative_amount(auth: TestClient) -> None:
    rows = [
        pl_row("2025/9"),
        pl_row("2025-09", 食材成本=-267),
    ]
    batch = upload(auth, "pl_monthly", "bad.csv", csv_bytes(PL_HEADER, rows))
    assert batch["status"] == "draft"
    assert batch["errors"], "非法文件必须返回错误"
    messages = "\n".join(f"{item['row']}|{item['column']}|{item['message']}" for item in batch["errors"])
    assert "2025/9" in messages and "期间格式必须为 YYYY-MM" in messages
    assert "不能为负数" in messages
    commit = auth.post(f"/api/imports/{batch['id']}/commit")
    assert commit.status_code == 400


def test_unknown_account_requires_mapping(auth: TestClient) -> None:
    header = PL_HEADER + ["装修费"]
    row = pl_row("2031-01") + [12.5]
    batch = upload(auth, "pl_monthly", "pl.csv", csv_bytes(header, [row]))
    assert batch["errors"]
    message = batch["errors"][0]["message"]
    assert "装修费" in message
    assert "最接近" in message
    assert "其它费用" in message

    mapped = upload(
        auth,
        "pl_monthly",
        "pl.csv",
        csv_bytes(header, [row]),
        mapping='{"装修费": "其它费用"}',
    )
    assert mapped["errors"] == []
    preview = mapped["preview"][0]
    assert preview["其它费用"] == 84 or preview["其它费用"] == 12.5
    commit = auth.post(f"/api/imports/{mapped['id']}/commit")
    assert commit.status_code == 200
    # 清理
    auth.post(f"/api/imports/{mapped['id']}/rollback")


def test_unknown_store_and_channel(auth: TestClient) -> None:
    header = ["期间", "门店", "营业收入（万元）", "客流（人次）"]
    batch = upload(auth, "store_revenue", "s.csv", csv_bytes(header, [["2025-09", "不存在的店", 10, 100]]))
    assert any("不存在" in item["message"] for item in batch["errors"])

    channel_header = ["期间", "门店", "渠道", "收入（万元）"]
    channel_batch = upload(auth, "channel_revenue", "c.csv", csv_bytes(channel_header, [["2025-09", "全部", "某某渠道", 10]]))
    assert any("不在渠道清单内" in item["message"] for item in channel_batch["errors"])


def test_funnel_must_decrease(auth: TestClient) -> None:
    header = ["期间", "门店", "渠道", "曝光人数", "访问人数", "支付人数", "消费人数"]
    batch = upload(auth, "funnel", "f.csv", csv_bytes(header, [["2025-09", "全部", "美团大众", 1000, 2000, 3000, 4000]]))
    assert any("逐级递减" in item["message"] for item in batch["errors"])


def test_channel_cross_check_warning(auth: TestClient) -> None:
    header = ["期间", "门店", "渠道", "渠道大类", "收入（万元）"]
    batch = upload(auth, "channel_revenue", "c.csv", csv_bytes(header, [["2025-09", "全部", "美团大众", "堂食", 100]]))
    assert batch["errors"] == []
    warnings = "\n".join(item["message"] for item in batch["warnings"])
    assert "渠道合计" in warnings and "相差" in warnings


def test_daypart_time_format_and_budget_rules(auth: TestClient) -> None:
    header = ["期间", "门店", "日类型", "时段", "客流"]
    batch = upload(auth, "daypart", "d.csv", csv_bytes(header, [["2025-09", "门店12", "工作日", "9点-14点", 100]]))
    assert any("时段格式" in item["message"] for item in batch["errors"])

    budget_header = ["期间", "门店", "科目", "预算值（万元）", "渠道", "目标ROI"]
    batch = upload(auth, "budget_target", "b.csv", csv_bytes(budget_header, [["2025-09", "全部", "装修费", 10, "", ""]]))
    assert any("不在标准科目表内" in item["message"] for item in batch["errors"])
    target_batch = upload(auth, "budget_target", "b.csv", csv_bytes(budget_header, [["2025-09", "全部", "", "", "大众点评", ""]]))
    assert any("目标 ROI" in item["message"] for item in target_batch["errors"])


def test_duplicate_rows_rejected(auth: TestClient) -> None:
    rows = [pl_row("2032-01"), pl_row("2032-01")]
    batch = upload(auth, "pl_monthly", "dup.csv", csv_bytes(PL_HEADER, rows))
    assert any("重复" in item["message"] for item in batch["errors"])


# ---------------------------------------------------------------------------
# 模板
# ---------------------------------------------------------------------------
def test_every_template_parses_cleanly(auth: TestClient) -> None:
    for key in DATASETS:
        download = auth.get(f"/api/imports/templates/{key}.xlsx")
        assert download.status_code == 200
        response = auth.post(
            "/api/imports",
            data={"dataset": key},
            files={
                "file": (
                    f"{key}.xlsx",
                    download.content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["errors"] == [], f"{key} 模板示例行校验失败：{body['errors']}"
        assert len(body["preview"]) == 1


def test_rollback_rules(auth: TestClient) -> None:
    # 未 committed 的批次不能回滚；不存在的批次 404
    batch = upload(auth, "pl_monthly", "pl.csv", csv_bytes(PL_HEADER, [pl_row("2033-01")]))
    assert auth.post(f"/api/imports/{batch['id']}/rollback").status_code == 400
    assert auth.post("/api/imports/999999/commit").status_code == 400
