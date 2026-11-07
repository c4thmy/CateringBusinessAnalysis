# shared/fixtures 用例格式

前后端共用同一组 JSON 用例：后端 pytest 与前端 vitest 都读同一份文件，保证同一指标在两端算出来一致。

## 目录

```
shared/fixtures/
  index.json                 用例清单（name → file）
  profit_bridge_2509.json    利润桥 2024-09 → 2025-09
  revenue_structure_2509.json 渠道 / 同店新店 / 区域结构
  same_store_2509.json       同店 13 店客流×客单
  channel_split_2509.json    渠道同店/新店分摊
  product_volume_price_2509.json 系列 + 套餐量价
  funnel_2509.json           曝光→访问→支付→消费
  roi_2509.json              平台费用率与 ROI
  compare_chain_2509.json    对比差异 + 连环替代闭合
  sandbox_*.json             二期
```

## 单文件格式

```json
{
  "name": "profit_bridge_2509",
  "source": "docs/利润桥及毛利率分析-高维第二期261003.xlsx#第一步-2509餐饮利润桥",
  "unit": "万元",
  "input": {
    "base": { "revenue": 760, "food_cost": 195, "discount_fee": 188.4, "utilities": 32, "marketing": 26.4,
              "salary": 135, "dorm_rent": 15.5, "store_rent": 56.1, "other": 47 },
    "current": { "revenue": 1000, "food_cost": 267, "discount_fee": 234.96, "utilities": 39.94, "marketing": 27.35,
                 "salary": 147.03, "dorm_rent": 17.16, "store_rent": 69.86, "other": 84 }
  },
  "expected": {
    "start": 64.60,
    "items": { "revenue_scale": 100.48, "food_cost_rate": -10.42, "discount_fee_rate": 12.93,
               "utilities_rate": 2.17, "marketing_rate": 7.39, "salary": -12.03,
               "dorm_rent": -1.66, "store_rent": -13.76, "other": -37.00 },
    "end": 112.70,
    "tolerance": 0.02
  }
}
```

## 规则

- `expected` 只放**可断言**的最终值，不放中间过程；容差默认 `0.02`（万元/元按数量级调整）。
- 每个用例的 `source` 必须能定位到 Excel 工作表（必要时到单元格区域）。
- 新增指标先加 fixture，再改代码；不允许只改代码不交用例。
- 前端 vitest 读取同一份 JSON，`import` 时用 `fs`/`import.meta.glob` 均可，路径从仓库根算。

## 已落地用例（后端 pytest 已消费）

| 文件 | 引擎函数 | 关键断言 |
|---|---|---|
| `profit_bridge_2509.json` | `profit_bridge` | 64.60 → 112.70，9 项影响 +100.48 / -10.42 / +12.93 / +2.17 / +7.39 / -12.03 / -1.66 / -13.76 / -37.00 |
| `revenue_structure_2509.json` | `structure` | 渠道 1000/759.56、同店 857.23/759.95、新店 143/0 |
| `same_store_2509.json` | `same_store` | 857.23/759.95、66,566.29/59,344.75、128.78/128.08、92.07/5.08、尾差 0.12 |
| `channel_split_2509.json` | `channel_split` | 美团大众同店 394.23 / 新店 65.77 / 差额 +58.24 |
| `product_volume_price_2509.json` | `product_volume_price` | 同店 +91.50/+5.67、全店 +233.54/+6.62、套餐 +770,933.33/-392,795.79 |
| `funnel_2509.json` | `funnel` | 14.63% / 11.44% / 88.18% |
| `roi_2509.json` | `roi` | 费用率 30%、毛利 ROI 2.00、销售 ROI 3.33；外卖目标 ROI 1.20 |
| `compare_chain_2509.json` | `compare` / `chain_substitution` | 差异率 +31.58%、新店差异率 null、连环替代闭合 |
