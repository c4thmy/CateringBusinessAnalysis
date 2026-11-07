"""从 docs/research 的 Excel 提取结果生成 8 类示例 CSV。

用法（在 backend/ 下执行）：
    .venv/bin/python seed/build_seed_csv.py

只读 docs/research 下的 JSON（Excel 只读提取物），输出到 backend/seed/*.csv。
生成后的 CSV 即示例数据的唯一来源，load_seed 会走正式导入链路把它们写进数据库。
每一列的单位、取整与口径差异见 backend/seed/README.md。
"""

from __future__ import annotations

import csv
import html
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent
RESEARCH = REPO_ROOT / "docs" / "research"
OUT_DIR = Path(__file__).resolve().parent

sys.path.insert(0, str(BACKEND_DIR))
from app.seeds.dimensions import STORE_SEED  # noqa: E402

SAMPLE = json.load(open(RESEARCH / "excel-sample-data.json", encoding="utf-8"))


def _load_raw(name: str) -> dict:
    return json.load(open(RESEARCH / "raw" / f"wide-{name}.json", encoding="utf-8"))


def _fmt(value) -> str:
    if value is None or value == "":
        return ""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if number == int(number) and abs(number) < 1e15:
        return str(int(number))
    text = f"{number:.6f}".rstrip("0").rstrip(".")
    return text


def _write(name: str, header: list[str], rows: list[list]) -> None:
    path = OUT_DIR / name
    with open(path, "w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(header)
        for row in rows:
            writer.writerow([_fmt(cell) for cell in row])
    print(f"wrote {path} ({len(rows)} 行)")


# ---------------------------------------------------------------------------
# 1) 月度利润表：2024-01 ~ 2025-12（宽表转长表）
# ---------------------------------------------------------------------------
def build_pl() -> None:
    raw = _load_raw("2025年月利润表数据")
    grid = {(cell["r"], cell["c"]): cell.get("v") for cell in raw["cells"]}
    # 行 2..11：营业收入 / 食材成本 / 优惠及手续费 / 水电气低值 / 宣传费用 /
    #           工资奖金 / 宿舍房租 / 店铺房租 / 其它费用 / 税金及附加
    account_rows = list(range(2, 12))
    accounts = [
        "营业收入",
        "食材成本",
        "优惠及手续费",
        "水电气低值",
        "宣传费用",
        "工资奖金",
        "宿舍房租",
        "店铺房租",
        "其它费用",
        "税金及附加",
    ]
    # 2025 月列 D..O = 4..15；2024 月列 R..AC = 18..29（V1 表头是坏文本，但数值正常）
    columns = {"2024": list(range(18, 30)), "2025": list(range(4, 16))}
    rows: list[list] = []
    for year in ("2024", "2025"):
        for month, col in enumerate(columns[year], start=1):
            values = []
            for r in account_rows:
                value = grid.get((r, col))
                values.append(float(value) if value not in (None, "") else 0.0)
            rows.append([f"{year}-{month:02d}", "全部", *values])
    header = ["期间", "门店", *accounts]
    _write("01_月度利润表.csv", header, rows)


# ---------------------------------------------------------------------------
# 2) 门店收入：13 家同店 + 2 家新店
# ---------------------------------------------------------------------------
def build_store_revenue() -> None:
    stores = SAMPLE["revenue_structure_2025_09"]["table2_region_store"]["stores"]
    traffic = {row["store"]: row for row in SAMPLE["revenue_variance_2025_09"]["table6_store_traffic_avg_ticket"]["stores"]}
    traffic["新店1"] = {"store": "新店1", "traffic2025": 6400, "ticket2025": 125, "traffic2024": 0, "ticket2024": 0}
    traffic["新店2"] = {"store": "新店2", "traffic2025": 4756.51189127971, "ticket2025": 132.45, "traffic2024": 0, "ticket2024": 0}
    dims = {row["name"]: row for row in STORE_SEED}

    rows: list[list] = []
    for store in stores:
        name = store["store"]
        dim = dims[name]
        flag = "新店" if name.startswith("新店") else "同店"
        rows.append(
            [
                "2024-09",
                name,
                dim["region"],
                dim["business_model"],
                dim["store_type"],
                store["r2024"],
                traffic[name]["traffic2024"],
                traffic[name]["ticket2024"] if traffic[name]["traffic2024"] else "",
                flag if store["r2024"] else "新店",
            ]
        )
        rows.append(
            [
                "2025-09",
                name,
                dim["region"],
                dim["business_model"],
                dim["store_type"],
                store["r2025"],
                traffic[name]["traffic2025"],
                traffic[name]["ticket2025"],
                flag,
            ]
        )
    header = ["期间", "门店", "区域", "经营模式", "店型", "营业收入（万元）", "客流（人次）", "客单价（元）", "同店/新店/闭店"]
    _write("02_门店收入.csv", header, rows)


# ---------------------------------------------------------------------------
# 3) 渠道收入：10 个渠道 × 2 期
# ---------------------------------------------------------------------------
def build_channel_revenue() -> None:
    channels = SAMPLE["revenue_structure_2025_09"]["table1_channel"]["rows"]
    # 堂食 / 外卖 归组与 data-caliber-notes 第 3 节一致
    takeaway = {"京东外卖", "美团外卖", "饿了外卖"}
    rows: list[list] = []
    for channel in channels:
        name = channel["channel"]
        cat = "外卖" if name in takeaway else "堂食"
        rows.append(["2024-09", "全部", name, cat, channel["r2024"]])
        rows.append(["2025-09", "全部", name, cat, channel["r2025"]])
    header = ["期间", "门店", "渠道", "渠道大类", "收入（万元）"]
    _write("03_渠道收入.csv", header, rows)


# ---------------------------------------------------------------------------
# 4) 产品系列销售：8 个系列 × 2 期
# ---------------------------------------------------------------------------
def build_product_series() -> None:
    categories = SAMPLE["revenue_variance_2025_09"]["table3_category_price_volume"]["rows"]
    gross = {row["category"]: row for row in SAMPLE["gross_margin_2025_09"]["table2_product_series"]["rows"]}
    unit = {row["category"]: row for row in SAMPLE["product_unit_economics"]["table1_theory_vs_actual"]["rows"]}

    # 2024 菜品收入/优惠结构（第三步右侧「菜品数据」块 L55:U80，原价口径）
    raw = _load_raw("第三步-毛利异动分析")
    grid = {(cell["r"], cell["c"]): cell.get("v") for cell in raw["cells"]}
    name_map = {
        "牛肉+套餐": "肉类",
        "锅底类": "锅底类",
        "涮品类": "涮品类",
        "主食类": "主食类",
        "凉菜类": "凉菜类",
        "小料类/调料类": "小料类",
        "饮品类": "饮品",
        "其它": "其它",
    }
    dish_ratio: dict[str, dict] = {}
    for r in range(56, 64):
        label = grid.get((r, 12))
        gmv = float(grid.get((r, 15)) or 0)
        dish_revenue = float(grid.get((r, 18)) or 0)
        discount = float(grid.get((r, 20)) or 0)
        if label in name_map and gmv:
            dish_ratio[name_map[label]] = {"dish": dish_revenue / gmv, "discount": discount / gmv}

    rows: list[list] = []
    for row in categories:
        name = row["category"]
        cost = gross[name]
        for period, qty, revenue_wan, cost_wan in (
            ("2024-09", row["volume2024"], row["revenue2024"], cost["cost2024"]),
            ("2025-09", row["volume2025"], row["revenue2025"], cost["cost2025"]),
        ):
            amount = round(revenue_wan * 10000, 2)
            ratio = dish_ratio.get(name, {"dish": 1.0, "discount": 0.0})
            dish_revenue = round(amount * ratio["dish"], 2)
            discount = round(amount - dish_revenue, 2)
            std_cost = unit.get(name, {}).get("stdUnitCost")
            rows.append(
                [
                    period,
                    "全部",
                    name,
                    qty,
                    amount,
                    dish_revenue,
                    discount,
                    cost_wan,
                    std_cost if std_cost is not None else "",
                ]
            )
    header = ["期间", "门店", "产品系列", "销售数量", "销售额（元）", "菜品收入（元）", "菜品优惠（元）", "实际成本（万元）", "理论单位成本（元）"]
    _write("04_产品系列销售.csv", header, rows)


# ---------------------------------------------------------------------------
# 5) 单品销售：线上套餐汇总（表4）+ 套餐菜品明细（结构页 B93:L127 / O93:Y127）
# ---------------------------------------------------------------------------
def _clean_name(value: str) -> str:
    """Excel 里部分名称被 HTML 转义过（&amp;quot; 等），统一还原为正常字符。"""
    text = str(value or "").strip()
    for _ in range(3):
        unescaped = html.unescape(text)
        if unescaped == text:
            break
        text = unescaped
    return text


def _is_subtotal(name: str) -> bool:
    return any(name.endswith(suffix) for suffix in ("合计", "小计"))


def _item_rows_from_raw() -> list[dict]:
    """从「第二步-餐饮收入结构分析」套餐明细块提取 2024-09 / 2025-09 的套餐菜品。"""
    raw = _load_raw("第二步-餐饮收入结构分析")
    grid = {(cell["r"], cell["c"]): cell.get("v") for cell in raw["cells"]}
    rows: list[dict] = []

    # 左块 B93:L127：2024-09（B 名称、C 人数、E 销量、G 销售额、I 菜品收入、K 优惠）
    for r in list(range(94, 100)) + list(range(101, 106)) + [107]:
        name = grid.get((r, 2))
        if not name:
            continue
        rows.append(
            {
                "period": "2024-09",
                "name": _clean_name(name),
                "qty": float(grid.get((r, 5)) or 0),
                "amount": float(grid.get((r, 7)) or 0),
                "dish_revenue": float(grid.get((r, 9)) or 0),
                "discount": float(grid.get((r, 11)) or 0),
            }
        )

    # 右块 O93:Y127：2025-09（O 名称、P 人数、R 销量、T 销售额、V 菜品收入、X 优惠）
    skip_rows = {120, 125, 127}  # 小计/合计行
    for r in list(range(94, 117)) + list(range(117, 120)) + list(range(121, 125)) + [126]:
        if r in skip_rows:
            continue
        name = grid.get((r, 15))
        if not name:
            continue
        cleaned = _clean_name(name)
        if _is_subtotal(cleaned):
            continue
        rows.append(
            {
                "period": "2025-09",
                "name": cleaned,
                "qty": float(grid.get((r, 18)) or 0),
                "amount": float(grid.get((r, 20)) or 0),
                "dish_revenue": float(grid.get((r, 22)) or 0),
                "discount": float(grid.get((r, 24)) or 0),
            }
        )

    # 同期间同名（含 HTML 转义造成的重复行）合并，避免导入器判重复键
    merged: dict[tuple[str, str], dict] = {}
    for row in rows:
        key = (row["period"], row["name"])
        bucket = merged.setdefault(key, {**row, "qty": 0.0, "amount": 0.0, "dish_revenue": 0.0, "discount": 0.0})
        for field in ("qty", "amount", "dish_revenue", "discount"):
            bucket[field] += row[field]
    order = {(row["period"], row["name"]): index for index, row in enumerate(rows)}
    return sorted(merged.values(), key=lambda row: (row["period"], order[(row["period"], row["name"])]))


def build_product_items() -> None:
    rows: list[list] = []
    # 方案 A：表4「线上套餐」汇总行——产品页套餐量价（432/5,472 单、66,080/444,217.54 元）只用这 2 行
    mapping = {"2024年9月套餐": "2024-09", "2025年9月套餐": "2025-09"}
    for row in SAMPLE["revenue_variance_2025_09"]["table4_online_set_meal"]["rows"]:
        period = mapping.get(row["period"])
        if period is None:
            continue
        rows.append(
            [
                period,
                "全部",
                "",
                "线上套餐",
                row["orders"],
                row["gmv"],
                row["dishRevenue"],
                row["discount"],
                "是",
            ]
        )
    # 方案 B：套餐菜品明细（结构页），用于「单品排行」，与表4 不是同一快照，量价汇总仍以表4 汇总行为准
    for item in _item_rows_from_raw():
        rows.append(
            [
                item["period"],
                "全部",
                "",
                item["name"],
                item["qty"],
                item["amount"],
                item["dish_revenue"],
                item["discount"],
                "是",
            ]
        )
    header = ["期间", "门店", "产品系列", "产品名称", "销售数量", "销售额（元）", "菜品收入（元）", "菜品优惠（元）", "是否套餐"]
    _write("05_单品销售.csv", header, rows)


# ---------------------------------------------------------------------------
# 6) 线上漏斗：PPT p28 品牌合计（Excel 标杆品牌表合计为另一套，见 README）
# ---------------------------------------------------------------------------
def build_funnel() -> None:
    # 以 Excel「标杆品牌点评曝光转化数据」25 店合计为准（用户已确认 Excel 优先）：
    # 曝光 4,367,174 / 访问 639,025 / 支付 73,113 / 消费 64,468 / 品牌顾客 69,298 / 新客 59,703 / 老客 9,595。
    # PPT p28 的 4,567,196 / 673,686 是另一份快照，不采用（见 seed/README.md）。
    rows = [
        [
            "2025-09",
            "全部",
            "美团大众",
            4367174,
            639025,
            73113,
            64468,
            69298,
            59703,
            9595,
            1380000,  # 平台费用 138 万元（渠道收入 460 × 30%）
        ]
    ]
    header = ["期间", "门店", "渠道", "曝光人数", "访问人数", "支付人数", "消费人数", "品牌顾客", "新客", "老客", "平台费用（元）"]
    _write("06_线上漏斗.csv", header, rows)


# ---------------------------------------------------------------------------
# 7) 时段客流：门店12（表7 口径）
# ---------------------------------------------------------------------------
def build_daypart() -> None:
    rows_data = SAMPLE["revenue_variance_2025_09"]["table7_traffic_by_daypart"]["rows"]
    rows: list[list] = []
    for row in rows_data:
        if row["dayType"] == "总合计":
            continue
        if row["part"] != "正常段" and row["part"] != "夜宵":
            continue  # 跳过小计行，避免重复计入
        rows.append(["2024-09", "门店12", row["dayType"], row["slot"], row["c2024"]])
        rows.append(["2025-09", "门店12", row["dayType"], row["slot"], row["c2025"]])
    header = ["期间", "门店", "日类型", "时段", "客流"]
    _write("07_时段客流.csv", header, rows)


# ---------------------------------------------------------------------------
# 8) 预算与目标：示例预算（收入 1500 万）+ 表8 增收提价目标
# ---------------------------------------------------------------------------
def build_budget_target() -> None:
    rows: list[list] = [
        # 期间, 门店, 科目, 预算值（万元）, 渠道, 新客量, 曝光转化率, 客单价, 毛利率, 新客成本, 目标ROI
        ["2025-09", "全部", "营业收入", 1500, "", "", "", "", "", "", ""],
        ["2025-09", "全部", "", "", "大众点评", 820, 0.015, 100, 0.60, 30, 2],
        ["2025-09", "全部", "", "", "外卖", 1000, 0.014, 40, 0.60, 20, 1],
    ]
    header = ["期间", "门店", "科目", "预算值（万元）", "渠道", "新客量", "曝光转化率", "客单价", "毛利率", "新客成本", "目标ROI"]
    _write("08_预算与目标.csv", header, rows)


def main() -> None:
    build_pl()
    build_store_revenue()
    build_channel_revenue()
    build_product_series()
    build_product_items()
    build_funnel()
    build_daypart()
    build_budget_target()


if __name__ == "__main__":
    main()
