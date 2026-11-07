"""8 类数据集的列定义与模板配置（design.md 第 11 节）。

模板表头与 Excel 源表原始中文字段一致；单位写在括号里，解析时会自动去掉括号再匹配。
"""

from __future__ import annotations

from app.importers.base import Column, DatasetSpec

ACCOUNTS = [
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

PL_MONTHLY = DatasetSpec(
    key="pl_monthly",
    name="月度利润表",
    description="按期间导入利润表科目金额（万元）；门店填「全部」表示品牌口径。",
    allow_dynamic_accounts=True,
    columns=[
        Column("期间", "period", required=True, aliases=("月份", "期间(YYYY-MM)")),
        Column("门店", aliases=("在营门店", "门店名称")),
        Column("营业收入", "float", required=True, min_value=0),
        Column("食材成本", "float", required=True, min_value=0),
        Column("优惠及手续费", "float", required=True, min_value=0, aliases=("优惠及手续费（万元）",)),
        Column("水电气低值", "float", required=True, min_value=0, aliases=("水电气&低值", "水电气低值（万元）")),
        Column("宣传费用", "float", required=True, min_value=0),
        Column("工资奖金", "float", required=True, min_value=0),
        Column("宿舍房租", "float", required=True, min_value=0),
        Column("店铺房租", "float", required=True, min_value=0),
        Column("其它费用", "float", required=True, min_value=0, aliases=("其他费用",)),
        Column("税金及附加", "float", required=False, min_value=0),
    ],
    example={
        "期间": "2025-09",
        "门店": "全部",
        "营业收入": 1000,
        "食材成本": 267,
        "优惠及手续费": 234.96,
        "水电气低值": 39.94,
        "宣传费用": 27.35,
        "工资奖金": 147.03,
        "宿舍房租": 17.16,
        "店铺房租": 69.86,
        "其它费用": 84,
        "税金及附加": 0,
    },
)

STORE_REVENUE = DatasetSpec(
    key="store_revenue",
    name="门店收入",
    description="按门店导入营业收入（万元）与客流（人次）；客单价可由收入/客流反算。",
    columns=[
        Column("期间", "period", required=True),
        Column("门店", required=True, aliases=("在营门店", "门店名称")),
        Column("区域"),
        Column("经营模式", enum=("直营", "加盟", "联营")),
        Column("店型", enum=("MALL", "社区街边", "写字楼", "交通枢纽")),
        Column("营业收入（万元）", "float", required=True, min_value=0, aliases=("营业收入",)),
        Column("客流（人次）", "float", required=True, min_value=0, aliases=("客流",)),
        Column("客单价（元）", "float", min_value=0, aliases=("客单价",)),
        Column("同店/新店/闭店", enum=("同店", "新店", "闭店"), aliases=("同店/新店/闭店标识", "门店类型标识")),
    ],
    example={
        "期间": "2025-09",
        "门店": "门店1",
        "区域": "区域一",
        "经营模式": "直营",
        "店型": "MALL",
        "营业收入（万元）": 69.10,
        "客流（人次）": 5617.89,
        "客单价（元）": 123,
        "同店/新店/闭店": "同店",
    },
)

CHANNEL_REVENUE = DatasetSpec(
    key="channel_revenue",
    name="渠道收入",
    description="按渠道导入收入（万元）；门店填「全部」表示公司口径。",
    columns=[
        Column("期间", "period", required=True),
        Column("门店", aliases=("在营门店",)),
        Column("渠道", required=True),
        Column("渠道大类", enum=("堂食", "外卖"), aliases=("渠道分组",)),
        Column("收入（万元）", "float", required=True, min_value=0, aliases=("收入",)),
    ],
    example={
        "期间": "2025-09",
        "门店": "全部",
        "渠道": "美团大众",
        "渠道大类": "堂食",
        "收入（万元）": 460,
    },
)

PRODUCT_SERIES = DatasetSpec(
    key="product_series",
    name="产品系列销售",
    description="按产品系列导入销量、销售额（元）、菜品收入与优惠。",
    columns=[
        Column("期间", "period", required=True),
        Column("门店", aliases=("在营门店",)),
        Column("产品系列", required=True, aliases=("系列产品", "产品系列名称")),
        Column("销售数量", "float", required=True, min_value=0, aliases=("销量",)),
        Column("销售额（元）", "float", required=True, min_value=0, aliases=("销售额",)),
        Column("菜品收入（元）", "float", required=True, min_value=0),
        Column("菜品优惠（元）", "float", required=True, min_value=0, aliases=("菜品优惠",)),
        Column("实际成本（万元）", "float", min_value=0, aliases=("实际成本", "实际总成本（万元）")),
        Column("理论单位成本（元）", "float", min_value=0, aliases=("单品理论成本（元）", "理论成本（元）")),
    ],
    example={
        "期间": "2025-09",
        "门店": "全部",
        "产品系列": "肉类",
        "销售数量": 152127,
        "销售额（元）": 5460700,
        "菜品收入（元）": 4091157.57,
        "菜品优惠（元）": 1369542.43,
        "实际成本（万元）": 152.88,
        "理论单位成本（元）": 11,
    },
)

PRODUCT_ITEM = DatasetSpec(
    key="product_item",
    name="单品销售",
    description="按单品/套餐导入；套餐的「产品系列」可留空（套餐跨系列组合）。",
    columns=[
        Column("期间", "period", required=True),
        Column("门店", aliases=("在营门店",)),
        Column("产品系列", aliases=("系列产品",)),
        Column("产品名称", required=True, aliases=("菜品名称", "单品名称")),
        Column("销售数量", "float", required=True, min_value=0, aliases=("销量",)),
        Column("销售额（元）", "float", required=True, min_value=0),
        Column("菜品收入（元）", "float", required=True, min_value=0),
        Column("菜品优惠（元）", "float", required=True, min_value=0),
        Column("是否套餐", "bool", aliases=("是否套餐（是/否）", "套餐标识")),
    ],
    example={
        "期间": "2025-09",
        "门店": "全部",
        "产品系列": "",
        "产品名称": "线上套餐",
        "销售数量": 5472,
        "销售额（元）": 444217.54,
        "菜品收入（元）": 214128.87,
        "菜品优惠（元）": 230088.67,
        "是否套餐": "是",
    },
)

FUNNEL = DatasetSpec(
    key="funnel",
    name="线上漏斗",
    description="曝光→访问→支付→消费；缺失值留空，不补 0。",
    columns=[
        Column("期间", "period", required=True),
        Column("门店", aliases=("在营门店",)),
        Column("渠道", required=True),
        Column("曝光人数", "float", min_value=0, aliases=("曝光", "曝光量")),
        Column("访问人数", "float", min_value=0, aliases=("访问",)),
        Column("支付人数", "float", min_value=0, aliases=("支付",)),
        Column("消费人数", "float", min_value=0, aliases=("消费",)),
        Column("品牌顾客", "float", min_value=0, aliases=("品牌顾客数",)),
        Column("新客", "float", min_value=0, aliases=("品牌新客",)),
        Column("老客", "float", min_value=0, aliases=("品牌老客",)),
        Column("平台费用（元）", "float", min_value=0, aliases=("平台费用", "投入成本（元）")),
    ],
    example={
        "期间": "2025-09",
        "门店": "全部",
        "渠道": "美团大众",
        "曝光人数": 4367174,
        "访问人数": 639025,
        "支付人数": 73113,
        "消费人数": 64468,
        "品牌顾客": 69298,
        "新客": 59703,
        "老客": 9595,
        "平台费用（元）": 1380000,
    },
)

DAYPART = DatasetSpec(
    key="daypart",
    name="时段客流",
    description="按日类型 × 时段导入客流（人次）；日类型仅工作日/节假日。",
    columns=[
        Column("期间", "period", required=True),
        Column("门店", required=True, aliases=("在营门店",)),
        Column("日类型", required=True, enum=("工作日", "节假日")),
        Column("时段", required=True, aliases=("时段文本",)),
        Column("客流", "int", required=True, min_value=0, aliases=("客流（人次）",)),
    ],
    example={
        "期间": "2025-09",
        "门店": "门店12",
        "日类型": "工作日",
        "时段": "9:00-14:00",
        "客流": 794,
    },
)

BUDGET_TARGET = DatasetSpec(
    key="budget_target",
    name="预算与目标",
    description="预算行填「科目+预算值」；目标行填「渠道+目标 ROI」等，二者行独立。",
    columns=[
        Column("期间", "period", required=True),
        Column("门店", aliases=("在营门店",)),
        Column("科目"),
        Column("预算值（万元）", "float", min_value=0, aliases=("预算值",)),
        Column("渠道"),
        Column("新客量", "int", min_value=0, aliases=("新客数量",)),
        Column("曝光转化率", "float", min_value=0, max_value=1, aliases=("曝光转化率（%）",)),
        Column("客单价", "float", min_value=0),
        Column("毛利率", "float", min_value=0, max_value=1),
        Column("新客成本", "float", min_value=0, aliases=("新客成本（元）",)),
        Column("目标ROI", "float", min_value=0, aliases=("目标 ROI", "目标ROI（倍）")),
    ],
    example={
        "期间": "2025-09",
        "门店": "全部",
        "科目": "营业收入",
        "预算值（万元）": 1500,
        "渠道": "",
        "新客量": "",
        "曝光转化率": "",
        "客单价": "",
        "毛利率": "",
        "新客成本": "",
        "目标ROI": "",
    },
)

DATASETS: dict[str, DatasetSpec] = {
    spec.key: spec
    for spec in (
        PL_MONTHLY,
        STORE_REVENUE,
        CHANNEL_REVENUE,
        PRODUCT_SERIES,
        PRODUCT_ITEM,
        FUNNEL,
        DAYPART,
        BUDGET_TARGET,
    )
}

DATASET_ORDER = list(DATASETS)

# 目标表里的渠道名 → 系统渠道（表8 写「大众点评」「外卖」，渠道清单是「美团大众」「美团外卖」）
TARGET_CHANNEL_ALIASES = {"大众点评": "美团大众", "点评": "美团大众", "外卖": "美团外卖"}


def dataset_spec(key: str) -> DatasetSpec:
    if key not in DATASETS:
        raise KeyError(f"未知数据集：{key}")
    return DATASETS[key]
