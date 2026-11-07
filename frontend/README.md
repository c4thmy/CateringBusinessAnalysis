# 餐饮经营分析系统 · 前端（一期）

React 19 + TypeScript 7 + Vite 8 + Ant Design 6 + ECharts 6 + react-router 7 + @tanstack/react-query 5 + vitest 5。

视觉基准：`docs/webUI.md`（深色藏青侧边导航、白色顶栏、浅灰内容区、白卡片、主色 #2F54EB、红负向/绿正向、KPI 卡带 P25/P50/P75 分位）。
方案与验收数字：`openspec/changes/build-catering-analysis-platform/design.md` 第 13/14 节、`shared/api-contract.md`。

## 命令

```bash
cd frontend
npm run dev        # http://127.0.0.1:5173 （默认 mock 模式，无需后端）
npm run build      # tsc -b + vite build
npm test           # vitest run（format / 语义色 / Waterfall / KpiCard / 页面冒烟）
npm run typecheck  # 只跑 tsc -b
npm run lint       # oxlint
```

## 接口模式

| 变量 | 说明 |
|---|---|
| `VITE_API_MODE` | `mock`（默认，前端内置同形状数据，数字与 design.md 第 14 节一致）；`real` 请求后端 |
| `VITE_API_BASE` | 默认 `/api`；`real` 时由 Vite 代理到 `http://127.0.0.1:8000/api` |

复制 `.env.example` 为 `.env.local` 可覆盖。真实环境登录后由后端 httpOnly Cookie（JWT）维持会话，401 自动跳 `/login`。

## 目录

```
src/
  api/            client（fetch 封装 + 401 跳登录）、hooks（react-query）、types、mock/*
  auth/           AuthContext（/auth/me、登录/退出）、RequireAuth 路由守卫
  components/     AppLayout 用的通用组件
                  KpiCard / ChartCard / Waterfall / BarChart / FilterBar / InsightPopover /
                  DataTable / EmptyState / SkeletonPage / ThresholdBar / ImpactBar / ChangeTag /
                  ScopeNotice / PageState / Notes（Footnote、CaliberNote）/ AiAssistantFab / icons
  config/         全局筛选选项（品牌 / 门店 / 期间 / 口径 / 对比基准）
  filters/        FilterProvider：筛选写入 URL（刷新后保留）
  layouts/        AppLayout（深色 Sider + 白色顶栏 + 内容区 + 右下角 AI 洞察）
  pages/
    dashboard/    经营总览（4 KPI + 利润桥 + 一句话结论 + 数据来源脚注）
    profit/       营业利润（利润表对比 + 利润桥；预算达成/评分/板块显示「二期」）
    revenue/      收入结构 / 同店异动 / 门店详情 / 渠道下钻 / 单渠道漏斗 / 产品下钻 / 结论与计划
    data/         数据导入（数据集切换、模板下载占位、上传、错误表、预览、确认、批次回滚、加载示例）
    skeleton/     毛利 / 费用 / 顾客 & 竞争 / 总结 & 计划 / 沙盘预演 / 结果方案报告（骨架页）
    login/        登录
  utils/          format（万元/百分比/pp/缺失「—」）、metrics（好坏方向与语义色）、
                  waterfall（利润桥数据转换）、routes（标题与菜单映射）
  theme.ts        设计常量唯一来源（颜色、字号、间距、圆角、antd 主题）
```

## 一期页面

| 路由 | 状态 | 内容 |
|---|---|---|
| `/login` | 可用 | 演示账号 `admin / admin123` |
| `/` | 可用 | 收入 1,000.00 / +240.00；利润 112.70 / +48.10；毛利率 73.3% / -1.04pp；同店增速 12.8%；利润桥 64.60 → 112.70（9 因素） |
| `/profit` | 半可用 | 利润表对比（同比/占比/pp）、利润桥；预算达成、评分、板块汇总显示「二期」 |
| `/revenue/structure` | 可用 | 6 维度切换 + 结构表 + 柱图 |
| `/revenue/same-store` | 可用 | 汇总卡 + 客流/客单拆解条（92.07 / 5.08 + 尾差说明）+ 13 店明细 + 行点击下钻 |
| `/revenue/store/:id` | 可用 | 三项对比 + 同店横向排名 + 时段客流表（门店 12：工作日 -465 / 节假日 +185） |
| `/revenue/channel` | 可用 | 渠道结构表 + 同店渠道异动表（美团大众 460 / 336 / +124 / +36.9%；同店 394.23 / 新店 65.77） |
| `/revenue/channel/:id` | 可用 | 曝光→访问→支付→消费漏斗 + 转化率 + 费用率/ROI + 阈值线（美团大众） |
| `/revenue/product` | 可用 | 系列量价表 + 影响额排行（系列级，单品明细待导入）+ 套餐量价（+770,933.33 / -392,795.79） |
| `/revenue/conclusion` | 可用 | 异动汇总（新店 143 / 同店客流 92.07 / 同店客单 5.08）+ 自动结论 + 3 条建议动作 |
| `/data` | 可用 | mock 两阶段导入流：上传 → 错误表/预览 → 确认入库 → 批次回滚、加载示例数据 |
| `/gross`、`/expense`、`/customer`、`/summary`、`/sandbox`、`/reports` | 骨架 | 统一 SkeletonPage：标题 +「一期为框架展示，二期开放」+ 规划能力清单 + 返回收入分析 |

## 数字来源与口径

- mock 数字来自 `design.md` 第 14 节验收数字与 `shared/api-contract.md`；13 店明细、渠道、系列量价、时段客流、漏斗/ROI 来自 `docs/research/excel-sample-data.json`（Excel 明细提取），不自行编造。
- 四套收入合计在页面分别标注：利润表 1,000.00 / 760.00；渠道 1,000.00 / 759.56；门店 1,000.23 / 759.95；品类 1,000.16 / 760.00，差异 0.05–0.23 万为源表取整，不做对齐。
- 格式统一：万元 2 位、百分比 1 位、pp 2 位、缺失「—」；涨跌除颜色外必须带 ↑/↓ 与正负号（色弱友好）。
- 「经营模式」维度示例数据未提供，为演示占位分摊（合计等于门店口径），页面脚注已注明。

## 已知缺口

- 单品级排行：示例数据未导入「单品销售」数据集，产品页按系列级影响额排行展示，已标注待导入。
- 预算 / 上期基准、累计口径下的门店分位：二期数据；页面显示提示或「—」。
- 非「美团大众」渠道详情页没有漏斗数据（示例数据只导入大众点评），显示空态说明。
- `src/App.css` 与 `src/assets/*` 为 Vite 脚手架残留、未被引用（保留以避免改动范围外的清理）。
