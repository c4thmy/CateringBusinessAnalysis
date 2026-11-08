# 前后端接口契约（一期）

> 唯一依据：`openspec/changes/build-catering-analysis-platform/design.md` 第 12 节。
> 后端按此实现；前端在此之前先用同形状的 mock，联调时只换 base URL。
> 所有金额单位：总览/利润/结构/渠道为 **万元**；产品/套餐为 **元**；客流为 **人次**；比率为 0–1 小数，展示时转百分比。

## 通用约定

- Base URL：`/api`
- 认证：登录后 `httpOnly` cookie `cba_session`（JWT）。未登录返回 401，前端跳 `/login`。
- 响应：成功 `200`，业务错误 `4xx` + `{ "detail": "..." }`。
- 统一包装（分析类）：
```json
{
  "data": {},
  "meta": { "brand": "all", "store": "all", "period": "2025-09", "baseline": "2024-09", "unit": "万元" },
  "insights": [ { "level": "positive|negative|info", "title": "收入规模", "text": "收入增加 240.00 万，按基期边际贡献率 41.87% 贡献利润 100.48 万", "evidence": "利润桥·收入规模" } ]
}
```
- 空值：无法计算（除零、缺数据）一律返回 `null`，前端显示「—」，禁止返回 0 冒充。
- 预算基准：`budget_fact` 缺少任一标准科目时视为「预算未导入/不完整」，`profit_bridge`、`kpis.profit.base`、`kpis.gross_margin.base` 返回 `null`，不按 0 计算。
- 对比基准 `baseline`：`yoy`（同期，默认）/ `budget`（预算）/ `mom`（上期）。

## 1. 认证

| 方法 | 路径 | 入参 | 出参 |
|---|---|---|---|
| POST | `/auth/login` | `{ "username": "...", "password": "..." }` | `{ "username": "admin" }` + Set-Cookie |
| POST | `/auth/logout` | — | `{ "ok": true }` |
| GET | `/auth/me` | — | `{ "username": "admin" }`，未登录 401 |

## 2. 数据状态与导入

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/data-status?period=2025-09&store=all` | 各模块所需数据集是否齐全 |
| GET | `/imports/templates` | 8 类模板清单，`{ "data": [{key,name,columns:[...]}] }` |
| GET | `/imports/templates/{key}.xlsx` | 下载模板 |
| POST | `/imports` | multipart：`dataset`、`file`；返回 `{ "data": {id, status:"draft", errors:[...], preview:[...]} }` |
| POST | `/imports/{id}/commit` | 确认入库，返回 `{ "data": {id, status:"committed", row_count} }` |
| POST | `/imports/{id}/rollback` | 回滚批次，返回 `{ "data": batch }` |
| GET | `/imports?limit=20` | 批次列表 |
| POST | `/seeds/load` | 加载示例数据（仅空库或强制覆盖） |

`data-status` 出参示例：
```json
{ "data": {
  "period": "2025-09", "store": "all", "baseline": "2024-09", "baseline_ready": true,
  "modules": {
    "dashboard": { "ready": true, "missing": [] },
    "revenue": { "ready": true, "missing": [] },
    "profit": { "ready": true, "missing": [] } },
  "datasets": [ { "key": "pl_monthly", "name": "月度利润表", "ready": true, "rows": 10 } ],
  "baseline_datasets": [ { "key": "pl_monthly", "name": "月度利润表", "ready": true, "rows": 10 } ]
} }
```

## 3. 总览与利润

### GET `/analysis/overview`
```json
{ "data": {
  "kpis": {
    "revenue":      { "value": 1000.00, "base": 760.00, "diff": 240.00, "rate": 0.3158, "unit": "万元" },
    "profit":       { "value": 112.70, "base": 64.60, "diff": 48.10, "rate": 0.7446, "unit": "万元" },
    "gross_margin": { "value": 0.7330, "base": 0.7434, "diff": -0.0104, "unit": "pp" },
    "same_store_growth": { "value": 0.1280, "base": null, "diff": null, "unit": "%" }
  },
  "profit_bridge": {
    "start": 64.60, "end": 112.70,
    "items": [
      { "key": "revenue_scale", "name": "收入规模", "impact": 100.48, "kind": "positive", "note": "收入增长 240.00 万 × 基期边际贡献率 41.87%" },
      { "key": "food_cost", "name": "食材成本", "impact": -10.42, "kind": "negative", "note": "费率 26.70% ← 25.66%" },
      { "key": "discount_fee", "name": "优惠及手续费", "impact": 12.93, "kind": "positive", "note": "费率 23.50% ← 24.79%" },
      { "key": "utilities", "name": "水电气低值", "impact": 2.17, "kind": "positive", "note": "费率 3.99% ← 4.21%" },
      { "key": "marketing", "name": "宣传费用", "impact": 7.39, "kind": "positive", "note": "费率 2.74% ← 3.47%" },
      { "key": "salary", "name": "工资奖金", "impact": -12.03, "kind": "negative", "note": "固定费用绝对额 135.00 → 147.03 万" },
      { "key": "dorm_rent", "name": "宿舍房租", "impact": -1.66, "kind": "negative", "note": "固定费用绝对额 15.50 → 17.16 万" },
      { "key": "store_rent", "name": "店铺房租", "impact": -13.76, "kind": "negative", "note": "固定费用绝对额 56.10 → 69.86 万" },
      { "key": "other", "name": "其它费用", "impact": -37.00, "kind": "negative", "note": "固定费用绝对额 47.00 → 84.00 万" }
    ]
  },
  "percentiles": {
    "revenue": { "p25": 42.08, "p50": 62.39, "p75": 82.19, "current": null, "bucket": null, "n": 13 },
    "profit": null,
    "gross_margin": null,
    "same_store_growth": { "p25": 0.079, "p50": 0.102, "p75": 0.191, "current": 0.128, "bucket": "P50–P75", "n": 13 },
    "percentile_hints": {
      "revenue": "门店收入分位（13 家同店）",
      "profit": "门店级营业利润明细未导入，暂不展示分位",
      "gross_margin": "示例数据只有品牌级利润表，门店毛利率分位暂缺",
      "same_store_growth": "同店收入增速分位（13 家同店）"
    }
  },
  "summary": "收入增长 240.00 万元，按基期边际贡献率 41.87% 贡献利润 100.48 万元；……"
} }
```

### GET `/analysis/profit?mode=month|ytd`
```json
{ "data": {
  "rows": [
    { "account": "营业收入", "current": 1000.00, "current_ratio": 1, "base": 760.00, "base_ratio": 1, "diff": 240.00, "rate": 0.3158, "ratio_pp": 0 },
    { "account": "食材成本", "current": 267.00, "current_ratio": 0.267, "base": 195.00, "base_ratio": 0.2566, "diff": 72.00, "rate": 0.3692, "ratio_pp": 0.0104 }
  ],
  "profit": { "current": 112.70, "base": 64.60, "diff": 48.10 },
  "profit_bridge": { "start": 64.60, "end": 112.70, "items": [] },
  "budget": null
} }
```

## 4. 收入分析

### GET `/revenue/structure?dimension=business_model|store_type|region|channel|channel_category|series`
```json
{ "data": {
  "dimension": "channel", "dimension_name": "渠道",
  "total": { "current": 1000.00, "base": 759.56, "diff": 240.44, "rate": 0.3166 },
  "rows": [
    { "key": "meituan_dazhong", "name": "美团大众", "current": 460.00, "current_share": 0.46,
      "base": 336.00, "base_share": 0.4424, "diff": 124.00, "rate": 0.3690 }
  ]
} }
```

### GET `/revenue/same-store`
```json
{ "data": {
  "summary": { "current": 857.23, "base": 759.95, "diff": 97.28, "rate": 0.1280,
               "traffic": { "current": 66566.29, "base": 59344.75, "diff": 7221.54, "rate": 0.1217 },
               "ticket":  { "current": 128.78, "base": 128.08, "diff": 0.70, "rate": 0.0055 },
               "traffic_impact": 92.07, "ticket_impact": 5.08, "impact_sum": 97.16,
               "variance_note": "两项影响合计 97.16 万，与同店收入变动 97.28 万相差 0.12 万，为源表取整尾差" },
  "stores": [ { "store_id": 1, "store_name": "门店1", "region": "区域一",
                "traffic": {"current":5617.89,"base":4750}, "ticket": {"current":123,"base":122},
                "revenue": {"current":69.10,"base":58.00}, "traffic_impact": 10.59, "ticket_impact": 0.56, "diff": 11.10 } ],
  "new_stores": [ { "store_id": 14, "store_name": "新店1", "revenue": 80.00 } ]
} }
```

### GET `/revenue/store/{store_id}`
```json
{ "data": { "store": { "id": 12, "name": "门店12", "region": "区域三" },
  "summary": { "traffic": {"current":4276,"base":4556}, "ticket": {"current":131.19,"base":130},
               "revenue": {"current":56.10,"base":59.23}, "traffic_impact": -3.64, "ticket_impact": 0.51, "diff": -3.13 },
  "dayparts": [ { "day_type": "工作日", "daypart": "9:00-14:00", "current": 794, "base": 950, "diff": -156, "rate": -0.1642 } ] } }
```

### GET `/revenue/channel`
```json
{ "data": {
  "total": { "current": 1000.00, "base": 759.56, "diff": 240.44 },
  "rows": [ { "channel_id": 1, "name": "美团大众", "current": 460.00, "base": 336.00,
              "same_store": 394.23, "new_store": 65.77, "diff": 58.24, "rate": 0.1733 } ],
  "categories": [ { "name": "堂食", "current": 906.58, "base": 685.00, "diff": 221.58, "rate": 0.3235 } ]
} }
```

### GET `/revenue/channel/{channel_id}`
```json
{ "data": {
  "channel": { "id": 1, "name": "美团大众" },
  "funnel": { "exposure": 4367174, "visits": 639025, "payers": 73113, "consumers": 64468,
              "exposure_visit": 0.1463, "visit_pay": 0.1144, "pay_consume": 0.8818,
              "mom_change": { "visit_pay": -0.012 } },
  "economics": { "revenue": 460.00, "platform_fee": 138.00, "fee_rate": 0.30,
                 "gross_profit": 276.00, "gross_roi": 2.00, "sales_roi": 3.33,
                 "thresholds": { "fee_rate": 0.15, "gross_roi": 1.0, "sales_roi": 4.0 },
                 "status": { "fee_rate": "risk", "gross_roi": "ok", "sales_roi": "warning" } }
} }
```

### GET `/revenue/product?scope=all|same_store`
```json
{ "data": {
  "scope": "same_store",
  "total": { "current": 857.17, "base": 760.00, "diff": 97.17 },
  "series": [ { "name": "肉类", "qty": {"current":130377.84,"base":113280}, "price": {"current":35.90,"base":34.25},
                "qty_impact": 58.56, "price_impact": 21.44, "diff": 80.00 } ],
  "sets": { "current": { "qty": 5472, "amount": 444217.54, "avg_price": 81.18 },
            "base":    { "qty": 432,  "amount": 66080.00,  "avg_price": 152.96 },
            "qty_impact": 770933.33, "price_impact": -392795.79, "diff": 378137.54 }
} }
```

### GET `/revenue/conclusion`
```json
{ "data": {
  "summary": { "new_store": 143.00, "same_store_traffic": 92.07, "same_store_ticket": 5.08,
               "closed_store": 0, "total_diff": 240.28,
               "variance_note": "四项合计 240.15 万，与收入变动 240.28 万相差 0.13 万，为源表取整尾差" },
  "conclusions": [ "收入贡献主要来自新开店 143 万；同店增收 97 万主要来自客流增加（92 万）" ],
  "actions": [ { "title": "巩固线上放量", "detail": "...", "owner": "市场部/运营部" } ]
} }
```

## 5. 洞察规则（后端返回 `insights[]`）

按影响绝对值排序取前 3；`level` 取 `positive|negative|info`；文本必须带数字与证据。
规则清单见 `design.md` 第 15 节，阈值放 `backend/app/config.py`：
`PLATFORM_FEE_RATE_MAX=0.15`、`GROSS_ROI_MIN=1.0`、`SALES_ROI_MIN=4.0`、`FUNNEL_CVR_DROP=0.01`、`TOP_N=3`。

## 6. 前端 mock 约定

前端在 `src/api/mock/` 放同形状 JSON；`VITE_API_MODE=mock|real` 切换。联调时 `real` 指向 `http://127.0.0.1:8000/api`。
所有 mock 数字必须与 `design.md` 第 14 节一致，不允许自造。
