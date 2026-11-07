# Design

## Context

- 仓库里没有代码，从零搭建。业务口径以 `docs/` 中的 Excel 模型和 PPT 模版为准，界面风格以 `docs/webUI.md` 为准。
- Excel 模型的数据组织方式是"科目为行、月份为列"的宽表，跨表用 OFFSET 取当月或累计数据。系统需要改成以长表存储，再按筛选条件聚合。
- 需求范围和验收口径见 proposal.md 与各 `specs/*/spec.md`，这里只写怎么实现。

## Goals / Non-Goals

**Goals:**
- 计算逻辑只实现一份，分析页面和沙盘共用，并用 Excel 示例数据做回归测试。
- 沙盘调整因子后在 1 秒内出结果。
- 单机就能部署起来（一个后端进程加静态前端），方便演示。

**Non-Goals:**
- 不做实时流式数据，也不对接第三方平台 API。
- 不做多租户和细粒度权限，只做单管理员账号。
- 不接大模型，洞察结论全部按规则生成。

## Decisions

### 1. 前后端分离：React + Ant Design 6 + ECharts / FastAPI
- 前端：React 19 + TypeScript 7 + Vite 8 + Ant Design 6 + ECharts 6（echarts-for-react）+ react-router 7 + @tanstack/react-query 5。Ant Design 的布局、表格和表单最接近 Profit Pilot 风格，ECharts 原生支持瀑布图（堆叠柱）、双轴、漏斗和词云（echarts-wordcloud）。
- 后端：Python 3.12 + FastAPI 0.162 + SQLAlchemy 2.1 + Alembic 1.20 + pandas 3.1 + openpyxl 3.1。选 Python 的原因是 Excel 解析、校验和导出用 pandas / openpyxl 最省事，因素分析写成纯函数也方便测试。
- 备选方案：纯前端加 IndexedDB。这样就没有后端，但数据只存在浏览器里，导入批次、回滚和多人共享都不好做，所以不选。备选方案：Node/NestJS。生态也可以，但 Excel 处理和数值计算不如 pandas 顺手。

### 2. 目录结构
```
backend/   app/{api,models,services,engine,importers,exporters}, tests/
frontend/  src/{layouts,pages/<模块>,components/{KpiCard,ChartCard,Waterfall,...},api,theme}
```
`engine/` 是不依赖数据库和框架的纯函数模块：compare、chain_substitution、profit_bridge、mix_rate_split、percentiles、sandbox。

### 3. 数据模型：长表加维度
- 维度表：brand、store（经营模式、区域、开店日期、闭店日期、面积、座位数）、account（利润表科目，带 `cost_behavior`：variable / fixed、排序和展示名）、channel（含大类：堂食 / 外卖）、product_series、product。
- 事实表：`pl_fact(store, period, scenario[actual|budget], account, amount)`、`channel_revenue_fact`、`store_traffic_fact(客流、客单)`、`product_sales_fact(销量、收入、优惠、实际成本、理论单位成本)`、`funnel_fact`、`satisfaction_fact`、`review_text`、`member_fact`、`competitor_fact`、`daypart_fact`、`efficiency_base_fact`（人数、面积、天数、营销费用）。
- 每个事实行都带 `import_batch_id`。覆盖导入时把旧行标记为 `superseded_by`，不做物理删除，这样回滚时只需恢复旧行、删除新行。
- 同店 / 新店 / 闭店按门店的开店和闭店日期与对比期计算，不靠导入时手工打标；如果导入文件里提供了标识，就以导入的为准。
- 备选方案：沿用宽表结构。导入简单，但做累计、按门店分组和切换对比基准都很麻烦，所以不选。

### 4. 计算放在后端，沙盘在前端复算
- 分析页面调用后端接口，例如 `GET /api/analysis/profit?brand&store&period&mode&baseline`，由后端从数据库聚合后调用 `engine` 计算。
- 沙盘：创建方案时后端返回基期快照（各科目金额、客流、客单、渠道和系列结构）。因子调整由前端用同一套公式的 TypeScript 实现实时复算，保证 1 秒内出结果；保存和生成结果方案时再由后端用 Python 引擎重算一遍作为权威结果。
- 两套实现可能不一致，所以用同一组 JSON 测试用例（`shared/fixtures/*.json`，输入和期望输出）同时跑 pytest 和 vitest。
- 备选方案：每次调整都请求后端。实现只有一份，但拖动滑块时请求太频繁，体验差。

### 5. 利润桥的科目分类可配置
默认分类与 Excel 一致：食材成本、优惠及手续费、水电气低值、宣传费用为变动成本，工资奖金、宿舍房租、店铺房租、其它费用为固定费用。分类存在 `account.cost_behavior` 里，管理员可以修改。收入规模影响用基期边际贡献率 = 1 − 基期变动成本率。

### 6. 导入流程：两阶段提交
`POST /api/imports`（上传，解析，校验，生成 draft 批次，返回错误和预览）→ `POST /api/imports/{id}/commit`（检测覆盖，写入）→ `POST /api/imports/{id}/rollback`。每类数据集各写一个 importer，声明列定义、类型、校验规则和目标表。示例数据通过一个 seed 脚本，把从 Excel 整理出的 CSV 走同样的导入流程写入，所以示例数据本身也能验证导入链路。

### 7. 洞察和建议用规则库
- 洞察：每个分析接口除了数据之外，还返回 `insights[]`，由规则函数生成，例如取影响绝对值最大的前 3 项，或标出超出阈值的指标。
- 结果方案的建议整改项来自 `suggestion_rule` 表（驱动因子 → 建议文本、默认部门），初始内容取自 Excel"待办事项计划清单"和 PPT 知识库页，可以在界面上维护。

### 8. 主题与组件
用 Ant Design 的 ConfigProvider 设置主色 #2F54EB、圆角 6、深色 Sider。封装 KpiCard（数值、差异、语义色、分位行、洞察入口）、ChartCard（标题、分段选择器、洞察按钮）、Waterfall、FilterBar 这几个组件，所有页面都复用。指标的好坏方向（越高越好或越低越好）在前端的指标元数据中统一定义。为了满足色弱用户，门店对比图不用红绿区分门店，涨跌除了颜色还要带箭头符号。

### 9. 认证
单管理员账号，密码用 bcrypt 哈希，JWT 放在 httpOnly cookie 中，除了 `/api/auth/login` 以外的接口都要求登录。账号通过环境变量初始化，不写进代码。

## Risks / Trade-offs

- [Excel 模型里有少量硬编码值和外部链接（如 `[1]利润表分析`、`[2]产品明细`），无法完全还原] → 示例数据以工作表里缓存的数值为准，验收时只比对 spec 中列出的关键数字，遇到不一致的口径记录在示例数据说明里。
- [前端和后端各有一份计算公式，可能不一致] → 共用 JSON 测试用例，CI 同时运行两边的测试。
- [Excel 的科目说明列与科目名错位（如"工资奖金"后面写的是租金说明）] → 只用科目名和数值，不使用说明列。
- [连环替代法的结果依赖替换顺序] → 顺序在引擎里固定，并在界面上标明顺序，不允许用户修改。
- [SQLite 不适合并发写入] → 当前场景是单管理员，够用。SQLAlchemy 的写法保持与数据库无关，以后可以换 PostgreSQL。

## Migration Plan

新系统，不涉及迁移。部署方式：后端用 `uvicorn` 启动，前端 `vite build` 后的静态文件由 FastAPI 托管。数据库文件放在 `backend/data/`，加入 .gitignore。回滚就是部署上一个版本，数据库用 Alembic 迁移管理。

## Open Questions

- 门店以外的业务板块（电商、中央厨房等）的数据格式，先按"板块级利润表"导入，等真实数据到了再细化。
- 洞察规则的阈值（如转化率下降多少算异常）先用 spec 里的默认值，上线后再根据使用反馈调整。

## 一期实施方案（Demo 2026-11-15）

> 本节只写一期怎么落地，是把上面的通用设计收敛到可实施的程度；二期沿用同一套骨架。
> 业务数字一律以 `docs/research/excel-model-extract.md` 与 `docs/research/excel-sample-data.json` 为准。

### 9. 一期目录结构

```
backend/
  app/
    main.py                FastAPI 入口，挂载 /api 与前端静态文件
    config.py              环境变量（DB 路径、管理员账号、阈值）
    engine/                纯函数：compare / chain_substitution / profit_bridge /
                           mix_rate_split / percentiles / revenue / funnel / insights
    importers/             每个数据集一个 importer（列定义、类型、校验、映射）
    models/                SQLAlchemy 模型与维度/事实表
    services/              聚合查询 → 调 engine → 组装响应（含 insights）
    api/                   路由：auth / imports / analysis / data-status
    seeds/                 示例数据加载命令
  seed/                    从 Excel 整理出的 CSV + README.md（口径差异清单）
  tests/                   pytest：engine 纯函数、importer 校验、API 场景
  alembic/                 迁移
frontend/
  src/
    layouts/AppLayout.tsx  深色 Sider + 白色顶栏 + 内容区
    pages/                 dashboard / profit / revenue/* / gross / expense /
                           customer / summary / sandbox / data / login
    components/            KpiCard / ChartCard / Waterfall / FilterBar /
                           InsightPopover / DataTable / EmptyState / SkeletonPage
    api/                   typed fetch 封装
    theme.ts               颜色、字号、间距、语义色（唯一来源）
    engine/                需要前端实时复算的部分（一期只用于沙盘占位，暂为空）
shared/fixtures/           {input, expected} JSON，pytest 与 vitest 共用
scripts/                   load_seed.sh / dev.sh / smoke.sh
docs/                      architecture / agents / sprint-7d / demo / domain
```

### 10. 数据模型（一期）

维度表：

| 表 | 关键字段 |
|---|---|
| `brand` | id, name |
| `store` | id, code, name, brand_id, region, business_model（直营/加盟/联营）, store_type（MALL/社区街边/写字楼/交通枢纽）, opened_on, closed_on, area_m2, seats |
| `account` | id, name（营业收入/食材成本/优惠及手续费/水电气低值/宣传费用/工资奖金/宿舍房租/店铺房租/其它费用/税金及附加）, cost_behavior（variable/fixed）, sort_order |
| `channel` | id, name, category（堂食/外卖）, sort_order |
| `product_series` | id, name, sort_order |
| `product` | id, series_id, name, is_set（套餐） |
| `period` | id（YYYY-MM）, year, month |
| `import_batch` | id, dataset, filename, period_from, period_to, row_count, operator, created_at, status |

事实表（每行都带 `import_batch_id`、`superseded_by`）：

| 表 | 粒度 | 度量 |
|---|---|---|
| `pl_fact` | brand/period/account/scenario(actual/budget) | amount（万元） |
| `store_revenue_fact` | store/period | revenue（万元）, traffic（人次） |
| `channel_revenue_fact` | store/period/channel | revenue（万元） |
| `product_sales_fact` | store/period/product_series/product | qty, amount（元）, dish_revenue, discount, actual_cost, std_unit_cost |
| `funnel_fact` | store/period/channel | exposure, visits, payers, consumers, brand_customers, new_customers, old_customers, platform_fee |
| `daypart_fact` | store/period/day_type(工作日/节假日)/daypart | traffic |
| `budget_fact` | brand/store/period/account | amount |
| `target_fact` | period/channel | new_customers, exposure_cvr, avg_ticket, gross_margin, cac, target_roi |

单位约定：`pl_fact`、`store_revenue_fact`、`channel_revenue_fact`、`budget_fact` 为**万元**；
`product_sales_fact` 的金额为**元**；`traffic` 为人次；客单价为元/人次（由收入 ÷ 客流 × 10000 计算，不单独入库）。
同店/新店/闭店不靠导入打标，按 `store.opened_on` / `closed_on` 与对比期推算；导入文件提供的标识优先。

### 11. 导入模板（一期 8 类，中文表头与 Excel 对齐）

| 数据集 | 必填列 | 可选列 | 校验要点 |
|---|---|---|---|
| 月度利润表 | 期间、门店（品牌填「全部」）、营业收入、食材成本、优惠及手续费、水电气低值、宣传费用、工资奖金、宿舍房租、店铺房租、其它费用 | 税金及附加 | 期间 YYYY-MM；金额 ≥ 0；9 个科目齐全（缺项给警告）；未知科目要求映射 |
| 门店收入 | 期间、门店、区域、经营模式、店型、营业收入（万元）、客流（人次） | 同店/新店/闭店标识 | 收入 ≥ 0；客流 ≥ 0；收入 ÷ 客流 反算客单价，与申报客单价差异 > 1% 给警告 |
| 渠道收入 | 期间、门店、渠道、渠道大类、收入（万元） | — | 渠道在通道清单内；同期间同门店渠道合计与门店收入差 > 1% 给警告 |
| 产品系列销售 | 期间、门店、产品系列、销售数量、销售额（元）、菜品收入（元）、菜品优惠（元） | 实际成本、理论单位成本 | 数量/金额 ≥ 0；单品之和与系列合计差 > 1% 给警告 |
| 单品销售 | 期间、门店、产品系列、产品名称、销售数量、销售额（元）、菜品收入（元）、菜品优惠（元） | 是否套餐 | 产品系列必须已存在；套餐与单品分开统计 |
| 线上漏斗 | 期间、门店、渠道、曝光人数、访问人数、支付人数、消费人数、平台费用（元） | 品牌顾客、新客、老客 | 逐级递减（曝光 ≥ 访问 ≥ 支付 ≥ 消费）；缺失值留空不补 0 |
| 时段客流 | 期间、门店、日类型（工作日/节假日）、时段、客流 | — | 日类型二选一；时段文本统一为 `9:00-14:00` 这类格式；同日类型合计与门店客流差 > 1% 给警告 |
| 预算与目标 | 期间、门店、科目、预算值（万元）；渠道、新客量、曝光转化率、客单价、毛利率、新客成本、目标 ROI | — | 预算科目在标准科目表内；目标值区间合理（转化率 0–1、毛利率 0–1、ROI > 0） |

流程：上传 → 解析 → 校验（错误行号 + 列名 + 原因）→ 预览（前 50 行 + 按期间/门店汇总）→ 确认入库（生成批次）→ 覆盖提示 → 批次回滚。
模板用 `openpyxl` 生成，表头与上述中文列名一致；模板里带一行填写说明与一行示例。

### 12. 收入分析接口契约（一期）

统一响应：

```json
{
  "data": { },
  "meta": { "period": "2025-09", "baseline": "2024-09", "unit": "万元", "store": "all", "brand": "all" },
  "insights": [ { "level": "positive|negative|info", "title": "...", "text": "...", "evidence": "..." } ]
}
```

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/analysis/overview` | 总览：收入、营业利润、毛利率、同店增速、门店分位、利润桥 9 因素、一句话结论 |
| GET | `/api/analysis/profit` | 利润表对比、利润桥因素明细（一期只做总览所需部分） |
| GET | `/api/analysis/revenue/structure?dimension=business_model\|store_type\|region\|channel\|channel_category\|series` | 结构表：本期、占比、对比值、对比占比、同比差额、增减率；`sum(分项)=总收入` |
| GET | `/api/analysis/revenue/same-store` | 同店/新店汇总 + 13 家门店客流×客单拆解 + 客流/客单影响 |
| GET | `/api/analysis/revenue/store/{store_id}` | 单店：本期/同期客流、客单、收入，以及时段下钻 |
| GET | `/api/analysis/revenue/channel` | 渠道本期/同期/同店/新店/差额/增减率 + 渠道大类汇总 |
| GET | `/api/analysis/revenue/channel/{channel_id}` | 单渠道：漏斗、转化率、平台费用率、毛利 ROI、销售 ROI、阈值对比 |
| GET | `/api/analysis/revenue/product?scope=all\|same_store` | 系列/单品量价拆解、套餐量价、影响额排序 |
| GET | `/api/analysis/revenue/conclusion` | 异动汇总（新店/同店客流/同店客单/闭店）+ 规则化结论与建议 |
| GET | `/api/data-status` | 按期间/门店列出各模块所需数据集是否齐全 |
| POST | `/api/imports` / `POST /api/imports/{id}/commit` / `POST /api/imports/{id}/rollback` | 两阶段导入与回滚 |

### 13. 页面矩阵（一期）

| 路由 | 页面 | 一期状态 | 核心内容 |
|---|---|---|---|
| `/login` | 登录 | 可用 | 单管理员账号，httpOnly JWT cookie |
| `/` | 经营总览（数据看板） | 可用 | 4 张 KPI 卡 + 利润桥瀑布图 + 一句话结论 + 数据来源脚注 |
| `/profit` | 营业利润分析 | 半可用 | 利润表对比 + 利润桥；预算达成、评分、板块汇总显示「二期」占位 |
| `/revenue/structure` | 收入结构 | 可用 | 维度切换（经营模式/同店新店/区域/渠道/渠道大类/系列）+ 结构表 + 柱图 |
| `/revenue/same-store` | 同店异动 | 可用 | 汇总卡 + 客流×客单拆解条 + 13 店明细表 + 门店下钻 |
| `/revenue/store/:id` | 门店详情 | 可用 | 三项对比 + 同店横向比较 + 时段客流表 |
| `/revenue/channel` | 渠道下钻 | 可用 | 渠道结构表 + 同店渠道异动 + 渠道卡片 |
| `/revenue/channel/:id` | 单渠道详情 | 可用 | 曝光→访问→支付→消费漏斗 + 转化率 + 费用率/ROI + 趋势 |
| `/revenue/product` | 产品下钻 | 可用 | 系列量价表 + 单品排行 + 套餐量价 + 影响额排序 |
| `/revenue/conclusion` | 结论与计划 | 可用 | 异动汇总 + 自动结论 + 三条建议动作 |
| `/gross` | 毛利分析 | 骨架 | 标题 + 规划能力清单 + 「二期开放」 |
| `/expense` | 费用分析 | 骨架 | 同上 |
| `/customer` | 顾客 & 竞争 | 骨架 | 同上 |
| `/summary` | 总结 & 计划 | 骨架 | 同上 |
| `/sandbox` | 沙盘预演 | 骨架 | 因子面板与结果区布局示意（不可计算） |
| `/reports` | 结果方案报告 | 骨架 | 报告模板与导出按钮占位 |
| `/data` | 数据导入 | 可用 | 数据集切换、模板下载、上传、错误表、预览、确认、批次列表与回滚、加载示例数据 |

骨架页必须：显示页面标题、说明「一期为框架展示，二期开放」、列出该模块已规划的核心分析项，并给一个「回到收入分析」的入口。
导航顺序：数据看板、营业利润分析、收入分析（含子菜单：收入结构/同店异动/渠道下钻/产品下钻/结论与计划）、毛利分析、费用分析、顾客 & 竞争分析、总结 & 计划、沙盘预演、数据导入。

### 14. 计算引擎与验收数字（一期）

engine 纯函数（`backend/app/engine/`）：

- `compare(cur, base)` → 差异额、差异率（base=0 返回 null）、pp；
- `chain_substitution(factors, base_values, cur_values)` → 逐因素影响，校验影响之和 = 总变动（误差 ≤ 0.01）；
- `profit_bridge(pl_base, pl_cur)` → 9 项因素影响；
- `mix_rate_split(share_base, rate_base, share_cur, rate_cur)` → 结构影响 + 单项率影响；
- `percentiles(values)` → P25/P50/P75（线性插值，少于 3 个不输出）；
- `revenue.structure(...)`、`same_store(...)`、`channel_split(...)`、`product_volume_price(...)`、`funnel(...)`、`roi(...)`。

验收数字（2025-09 vs 2024-09，万元/人次/元）：

| 指标 | 本期 | 对比 | 差异 |
|---|---|---|---|
| 营业收入（利润表口径） | 1000.00 | 760.00 | +240.00（+31.58%） |
| 营业利润 | 112.70 | 64.60 | +48.10（+74.46%） |
| 综合毛利率 | 73.30% | 74.34% | -1.04pp |
| 同店收入 | 857.23 | 759.95 | +97.28（+12.80%） |
| 新店收入 | 143.00 | 0 | +143.00 |
| 同店客流 | 66,566.29 | 59,344.75 | +7,221.54（+12.17%） |
| 同店客单 | 128.78 | 128.08 | +0.70（+0.55%） |
| 客流影响 / 客单影响 | +92.07 / +5.08 | — | 合计 97.16（与 97.28 差 0.12，元表取整尾差） |
| 美团大众渠道 | 460.00 | 336.00 | +124.00（+36.9%） |
| 堂食 / 外卖 | 906.58 / 93.42 | 685.00 / 74.56 | +221.58 / +18.86 |
| 同店渠道·美团大众 | 394.23 | 336.00 | +58.24（+17.3%）；新店分摊 65.77 |
| 系列量价（同店） | 销量影响 +91.50、单价影响 +5.67 | — | 合计 97.17 |
| 套餐量价 | 5,472 单 / 444,217.54 元 / 81.18 元 | 432 / 66,080 / 152.96 | 量差 +770,933.33、价差 -392,795.79、合计 +378,137.54 |
| 漏斗 | 曝光 4,367,174 → 访问 639,025（14.63%）→ 支付 73,113（11.44%）→ 消费 64,468（88.18%） | — | 曝光-支付 1.67% |
| 平台 ROI | 大众点评：费用率 30%、产投比 3.33、毛利 ROI 2.00 | 目标 ROI 2 | 达标；外卖毛利 ROI 1.20，目标 1，达标 |

利润桥 9 项：收入规模 +100.48、食材成本率 -10.42、优惠及手续费 +12.93、水电气低值 +2.17、宣传费用 +7.39、工资奖金 -12.03、宿舍房租 -1.66、店铺房租 -13.76、其它费用 -37.00，合计 +48.10。
每一行数字都要在 `shared/fixtures/*.json` 与 pytest 中出现；前端展示与后端计算不一致时以 pytest 为准。

**收入三种合计口径（页面必须分别标注）**：

- 利润表口径：2024-09=760、2025-09=1000（总览、利润桥、毛利率用这套）；
- 渠道口径：759.56 / 1000.00（收入结构页与渠道页用这套，同比 +240.44）；
- 门店口径：759.95 / 1000.23（同店异动页用这套，同比 +240.28）；
- 品类口径：760 / 1000.16（产品页量价汇总用这套）。
四套之间的 0.05–0.23 万差异是源表取整与不同表汇总范围造成的，页面脚注说明，不强行对齐、不改写源数字。

### 15. 规则化洞察（一期）

洞察不是自由文本，统一结构：`{level, title, text, evidence}`，由规则函数生成，按影响绝对值排序取前 3。
一期规则（来源：PPT p16/p22/p26/p28/p30 与知识库 p68，阈值见 `config.py`）：

1. **利润桥前三因素**：收入规模、最大负向成本率、最大负向固定费用；
2. **收入结构**：增长贡献最大的 3 个渠道/门店，下降最大的 1–2 个；
3. **同店**：客流影响与客单影响谁主导（占比 ≥ 80% 判为主导）；
4. **门店异动**：收入下降且客流下降的门店点名（如门店 12）；
5. **渠道**：同店渠道增长前三；漏斗任一层转化率环比下降 > 1pp 标异常；
6. **线上效率**：平台费用率 > 15%、毛利 ROI < 1、销售 ROI < 4 分别给风险提示；
7. **产品**：系列销量影响与单价影响拆分，主食类单价下降这类「降价换量」单独提示；
8. **结论汇总**：新店/同店客流/同店客单/闭店四项之和 = 总收入变动，生成一句话总结与 3 条行动建议。

### 16. 示例数据与口径差异

- 示例数据放 `backend/seed/`（CSV + 加载脚本），按导入流程进入系统，因此示例数据本身也验证导入链路。
- 加载后必须能复现第 14 节全部验收数字。
- `backend/seed/README.md` 记录：数据来源工作表/单元格、单位、取整方式，以及所有与 Excel 口径不一致或需要用户确认的地方（清单见 `docs/domain/data-caliber-notes.md`）。
- 同店渠道分摊口径：一期采用**本期渠道占比**分摊新店（与 PPT p26 一致）；Excel「第二步-餐饮收入结构分析」另有一版按同期占比分摊的结果，差异在页脚注明。

### 17. 测试与验收

- 后端：`pytest`，覆盖 engine 全部函数、8 类 importer 校验、收入分析接口场景；关键数字用 `shared/fixtures` 断言。
- 前端：`vitest` 覆盖格式化、语义色、KpiCard/Waterfall/FilterBar 关键行为；页面用浏览器手动走查 + 截图。
- 冒烟：`scripts/smoke.sh` 起后端 + 构建前端 + 断言核心页面 200 与关键文案。
- 演示前检查：断网可用、示例数据一键加载、15 分钟动线可走完。

### 18. 一期开放问题（写进 seed README，不阻塞开发）

- PPT p12 的预算达成 85%/80% 没有绝对值，一期总览不展示预算达成；预算数据集保留导入能力。
- PPT p18/p24 的示意数字（850+200+50=1100、907+73=980）与总收入不闭合，按 Excel 为准。
- PPT p27 套餐数据与 Excel 表 4 不同源，按 Excel 表 4 展示，课件数字只用于讲。
- 同店/新店/闭店判定门槛、客流口径（人次 vs 下单人数）、收入含税与佣金扣除，Excel 未写明；一期按 Excel 明细直接导入，不做二次换算，页脚标注「口径以导入数据为准」。
