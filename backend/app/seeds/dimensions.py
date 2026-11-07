"""维度种子：品牌、门店、科目、渠道、产品系列、期间。

门店的区域/经营模式/店型/面积/座位来自示例数据演示设定（Excel 只给了区域与门店收入），
写入 backend/seed/README.md 说明；科目 cost_behavior 与 Excel 利润桥分类一致。
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Account, Brand, Channel, Period, ProductSeries, Store

BRAND_NAME = "示例餐饮品牌"

# id 顺序即 门店1..门店13、新店1、新店2
STORE_SEED: list[dict] = [
    {"code": "S01", "name": "门店1", "region": "区域一", "business_model": "直营", "store_type": "MALL", "opened_on": date(2019, 3, 1), "area_m2": 320, "seats": 120},
    {"code": "S02", "name": "门店2", "region": "区域一", "business_model": "直营", "store_type": "社区街边", "opened_on": date(2019, 9, 1), "area_m2": 260, "seats": 96},
    {"code": "S03", "name": "门店3", "region": "区域一", "business_model": "直营", "store_type": "写字楼", "opened_on": date(2020, 5, 1), "area_m2": 400, "seats": 150},
    {"code": "S04", "name": "门店4", "region": "区域一", "business_model": "加盟", "store_type": "MALL", "opened_on": date(2020, 11, 1), "area_m2": 300, "seats": 110},
    {"code": "S05", "name": "门店5", "region": "区域一", "business_model": "直营", "store_type": "交通枢纽", "opened_on": date(2021, 4, 1), "area_m2": 220, "seats": 80},
    {"code": "S06", "name": "门店6", "region": "区域二", "business_model": "直营", "store_type": "社区街边", "opened_on": date(2021, 7, 1), "area_m2": 240, "seats": 90},
    {"code": "S07", "name": "门店7", "region": "区域二", "business_model": "加盟", "store_type": "MALL", "opened_on": date(2021, 12, 1), "area_m2": 360, "seats": 132},
    {"code": "S08", "name": "门店8", "region": "区域二", "business_model": "直营", "store_type": "写字楼", "opened_on": date(2022, 3, 1), "area_m2": 280, "seats": 100},
    {"code": "S09", "name": "门店9", "region": "区域二", "business_model": "直营", "store_type": "社区街边", "opened_on": date(2022, 8, 1), "area_m2": 230, "seats": 88},
    {"code": "S10", "name": "门店10", "region": "区域二", "business_model": "联营", "store_type": "MALL", "opened_on": date(2023, 1, 1), "area_m2": 310, "seats": 116},
    {"code": "S11", "name": "门店11", "region": "区域三", "business_model": "直营", "store_type": "交通枢纽", "opened_on": date(2023, 6, 1), "area_m2": 200, "seats": 76},
    {"code": "S12", "name": "门店12", "region": "区域三", "business_model": "直营", "store_type": "社区街边", "opened_on": date(2023, 10, 1), "area_m2": 250, "seats": 92},
    {"code": "S13", "name": "门店13", "region": "区域三", "business_model": "加盟", "store_type": "MALL", "opened_on": date(2024, 2, 1), "area_m2": 340, "seats": 126},
    # 新店：2024-09 尚未开业（无收入），2025-09 在营
    {"code": "S14", "name": "新店1", "region": "区域三", "business_model": "直营", "store_type": "MALL", "opened_on": date(2025, 1, 18), "area_m2": 320, "seats": 120},
    {"code": "S15", "name": "新店2", "region": "区域三", "business_model": "直营", "store_type": "社区街边", "opened_on": date(2025, 3, 8), "area_m2": 240, "seats": 90},
]

ACCOUNT_SEED: list[dict] = [
    {"name": "营业收入", "cost_behavior": "revenue", "sort_order": 1},
    {"name": "食材成本", "cost_behavior": "variable", "sort_order": 2},
    {"name": "优惠及手续费", "cost_behavior": "variable", "sort_order": 3},
    {"name": "水电气低值", "cost_behavior": "variable", "sort_order": 4},
    {"name": "宣传费用", "cost_behavior": "variable", "sort_order": 5},
    {"name": "工资奖金", "cost_behavior": "fixed", "sort_order": 6},
    {"name": "宿舍房租", "cost_behavior": "fixed", "sort_order": 7},
    {"name": "店铺房租", "cost_behavior": "fixed", "sort_order": 8},
    {"name": "其它费用", "cost_behavior": "fixed", "sort_order": 9},
    {"name": "税金及附加", "cost_behavior": "fixed", "sort_order": 10},
]

# Excel 原始顺序；堂食 = 美团大众+扫码支付+线上活动优惠+抖音+会员储值消费+堂食现金+招商银行，
# 外卖 = 京东外卖+美团外卖+饿了外卖（见 data-caliber-notes 第 3 节）
CHANNEL_SEED: list[dict] = [
    {"name": "美团大众", "category": "堂食", "sort_order": 1},
    {"name": "扫码支付", "category": "堂食", "sort_order": 2},
    {"name": "线上活动优惠", "category": "堂食", "sort_order": 3},
    {"name": "抖音", "category": "堂食", "sort_order": 4},
    {"name": "会员储值消费", "category": "堂食", "sort_order": 5},
    {"name": "堂食现金", "category": "堂食", "sort_order": 6},
    {"name": "招商银行", "category": "堂食", "sort_order": 7},
    {"name": "京东外卖", "category": "外卖", "sort_order": 8},
    {"name": "美团外卖", "category": "外卖", "sort_order": 9},
    {"name": "饿了外卖", "category": "外卖", "sort_order": 10},
]

SERIES_SEED: list[dict] = [
    {"name": "肉类", "sort_order": 1},
    {"name": "锅底类", "sort_order": 2},
    {"name": "涮品类", "sort_order": 3},
    {"name": "主食类", "sort_order": 4},
    {"name": "凉菜类", "sort_order": 5},
    {"name": "小料类", "sort_order": 6},
    {"name": "饮品", "sort_order": 7},
    {"name": "其它", "sort_order": 8},
]

PERIODS: list[str] = [f"{year}-{month:02d}" for year in (2024, 2025) for month in range(1, 13)]


def seed_dimensions(session: Session) -> dict[str, int]:
    """写入维度数据（幂等：已存在则跳过）。返回各维度条数。"""
    brand = session.scalar(select(Brand).where(Brand.name == BRAND_NAME))
    if brand is None:
        brand = Brand(name=BRAND_NAME)
        session.add(brand)
        session.flush()

    for row in STORE_SEED:
        if session.scalar(select(Store).where(Store.name == row["name"])) is None:
            session.add(Store(brand_id=brand.id, **row))
    for row in ACCOUNT_SEED:
        if session.scalar(select(Account).where(Account.name == row["name"])) is None:
            session.add(Account(**row))
    for row in CHANNEL_SEED:
        if session.scalar(select(Channel).where(Channel.name == row["name"])) is None:
            session.add(Channel(**row))
    for row in SERIES_SEED:
        if session.scalar(select(ProductSeries).where(ProductSeries.name == row["name"])) is None:
            session.add(ProductSeries(**row))
    for period in PERIODS:
        if session.get(Period, period) is None:
            year, month = period.split("-")
            session.add(Period(id=period, year=int(year), month=int(month)))
    session.flush()
    return {
        "brand": 1,
        "store": len(STORE_SEED),
        "account": len(ACCOUNT_SEED),
        "channel": len(CHANNEL_SEED),
        "series": len(SERIES_SEED),
        "period": len(PERIODS),
    }
