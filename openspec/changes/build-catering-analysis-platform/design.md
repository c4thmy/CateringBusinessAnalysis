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

### 1. 前后端分离：React + Ant Design 5 + ECharts / FastAPI
- 前端：React 18 + TypeScript + Vite + Ant Design 5 + ECharts（echarts-for-react）+ react-router + @tanstack/react-query。Ant Design 的布局、表格和表单最接近 Profit Pilot 风格，ECharts 原生支持瀑布图（堆叠柱）、双轴、漏斗和词云（echarts-wordcloud）。
- 后端：Python 3.12 + FastAPI + SQLAlchemy 2 + pandas + openpyxl。选 Python 的原因是 Excel 解析、校验和导出用 pandas / openpyxl 最省事，因素分析写成纯函数也方便测试。
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
