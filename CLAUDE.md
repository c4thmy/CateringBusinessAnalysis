# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言

中文回答；OpenSpec 产出物（proposal / design / specs / tasks）也使用中文撰写。

## 项目现状

一期代码已落地并通过自测（`backend/` + `frontend/`），目标 2026-11-15 演示。技术栈：

- 后端：Python 3.12 + FastAPI + SQLAlchemy 2 + Alembic + SQLite + pandas/openpyxl + pytest
- 前端：React 19 + TypeScript 7 + Vite 8 + Ant Design 6 + ECharts 6 + react-router 7 + @tanstack/react-query 5 + vitest 5（版本见 `frontend/package.json` 与 lock 文件）
- 计算引擎：`backend/app/engine/` 纯函数，与页面解耦，用 `shared/fixtures/*.json` 做前后端回归
- AI 洞察：按规则生成，暂不接大模型

业务资料（只读，用 xlsx / pptx skill 读取，不要直接改写原件）：

- `docs/利润桥及毛利率分析-高维第二期261003.xlsx`：16 张工作表，分析模型的计算逻辑（函数公式、营业利润连环替代法公式、2025 年月利润表数据、利润分析总看板、当月和累计数据对比分析、总利润表、第一步 2509 餐饮利润桥、第二步 餐饮收入结构分析 / 收入异动分析、标杆品牌点评曝光转化数据、第三步 毛利异动分析、第四步 产品毛利率 / 重点产品成本损益率、第五步 折扣率影响毛利率、待办事项计划清单、时段客单预估营业额）。
- `docs/高维学堂经营分析与科学决策月度分析模版20261002.pptx`（80 页）：章节为 财务指标 → 收入 → 毛利 → 费用 → 顾客 & 竞争 → 总结 & 计划；第 67–79 页是知识库（指标 → 原因假设库），是规则化洞察的来源。

配套文档：

- `openspec/changes/build-catering-analysis-platform/` — 唯一的方案与验收来源（10 个能力规格 + design + tasks）
- `docs/research/excel-model-extract.md`、`excel-sample-data.json`、`ppt-course-extract.md` — 源文件的完整提取与差异清单
- `docs/domain/data-caliber-notes.md` — 口径差异与默认取数规则（**做数之前先读**）
- `docs/architecture.md`、`docs/agents/roles.md`、`docs/sprint-7d.md` — 一人指挥多角色 Agent 的生产方式、角色写入范围、7 天冲刺
- `docs/engineering/` — 软件工程过程文档集（需求分析 / 产品设计 / 概要设计 / 详细设计 / 测试文档 / 用户手册 / 维护与版本记录），维护与交接先读这里

## 一期范围（2026-11-15 Demo）

- 可用：登录、应用框架、全局筛选、数据导入（8 类模板）、经营总览（利润桥）、营业利润对比、收入分析全链路（结构 / 同店 / 门店下钻 / 时段 / 渠道 / 漏斗 / 产品 / 结论）。
- 骨架：毛利、费用、顾客 & 竞争、总结 & 计划、沙盘预演、报告导出（可见、可导航、标注二期）。
- 数字以 Excel 为准；PPT 只作讲解案例；四套收入合计口径与尾差在页面标注（见 `docs/domain/data-caliber-notes.md`）。
- 双远程：`origin`（cfmypian/…-dshSA）+ `target`（c4thmy/CateringBusinessAnalysis），提交后双推。

## 核心分析方法（理解业务的关键）

- 分析 = 对比找差异：实际值 vs 预算值 / 同期 / 上期 / 模型值 / 竞对。
- 连环替代法（因素分析）：按固定顺序逐项替换，每步影响 = 替换后 − 替换前，顺序不能乱。例如毛利额 = 销量 ×（单价 − 单位成本），依次替换 销量 → 单价 → 单位成本。
- 利润桥：把营业利润的同比变化拆成收入、毛利率、销售费率、固定费用等因素的贡献。
- 收入拆解维度：经营模式（直营/加盟/联营）、同店/新店/闭店、区域、渠道（堂食、外卖、美团大众、扫码等）、菜品系列/单品；同店收入异动再拆为客流 × 客单。
- 毛利率变动拆为 产品销售结构影响 + 单品毛利率影响，并对比实际成本与理论成本。

## 构建与测试（已实测）

```bash
# 后端（venv 已在 backend/.venv，Python 3.12）
cd backend && .venv/bin/python -m uvicorn app.main:app --port 8000   # http://127.0.0.1:8000/docs
cd backend && .venv/bin/python -m pytest                              # 57 passed
cd backend && .venv/bin/python -m app.seeds.load_seed                 # 空库首次加载示例数据
cd backend && rm -f data/cba.db && .venv/bin/python -m app.seeds.load_seed   # 重新灌数

# 前端（Vite 8；dev 已把 /api 代理到 8000）
cd frontend && npm install
cd frontend && npm run dev -- --port 5173                             # mock 模式
cd frontend && VITE_API_MODE=real npm run dev -- --port 5173          # 真后端联调/演示
cd frontend && npm test && VITE_API_MODE=real npm run build          # 45 passed / 构建（real 模式供 FastAPI 托管）

# 一键
bash scripts/dev.sh      # 后端 8000 + 前端 5173（前端默认 mock；真后端请用上面的 VITE_API_MODE=real）
bash scripts/smoke.sh    # pytest + 前端构建 + 空库灌数 + 登录 + 关键接口数字断言
```

演示账号：`admin / admin123`（环境变量 `CBA_ADMIN_USERNAME` / `CBA_ADMIN_PASSWORD` 可覆盖）。
前端数据模式：`VITE_API_MODE=mock|real`；真实演示用 `real`。

## 开发约定

- 角色写入范围见 `docs/agents/roles.md`；同一文件范围只允许一个 Agent 写。
- 提交信息中文，格式 `type: 说明`（feat / fix / docs / chore / test / refactor）。
- 提交前先 `git status`，只 add 自己改的文件，不要 `git add -A`。
- 推送双远程：`git push origin main && git push target main`。
- 任何口径争议先查 `docs/domain/data-caliber-notes.md`；仍不确定的写入 proposal 待用户确认，不自行发明。

## OpenSpec 命令

```bash
openspec list                 # 列出进行中的 change（--specs 列出规格）
openspec show <名称>
openspec validate <名称> --strict
openspec archive <名称>       # 完成后归档，规格进入 openspec/specs/
```

日常使用 `/opsx:propose`、`/opsx:apply`、`/opsx:archive` 等斜杠命令驱动流程。

所有SDD类开发，在代码实现前都需要暂停等我审批文档，不可以未经审核就开始编码实现