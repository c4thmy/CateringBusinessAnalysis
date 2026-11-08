# CateringBusinessAnalysis · 餐饮经营分析系统

> 把高维学堂的 Excel 经营分析体系（利润桥、收入结构、收入异动下钻）做成可交互的 Web 系统。
> 一期目标：2026-11-15 培训课演示「收入分析模块」；二期补齐毛利、费用、顾客 & 竞争、总结 & 计划、沙盘预演与结果方案。

- 远程仓库（双远程）：
  - `origin`：https://github.com/cfmypian/CateringBusinessAnalysis-dshSA.git（历史与实验记录）
  - `target`：https://github.com/c4thmy/CateringBusinessAnalysis.git（演示与商用主仓库）
- 技术栈：后端 Python（FastAPI + SQLAlchemy + SQLite + openpyxl + pytest）；前端 React 19 + TypeScript 7 + Vite 8 + Ant Design 6 + ECharts 6；AI 洞察按规则生成，暂不接大模型。
- 需求与规格唯一真相：`openspec/changes/build-catering-analysis-platform/`（proposal → specs → design → tasks）。

## 当前状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| 规划 | OpenSpec change 10 个能力规格 + 设计 + 任务 | 已批准并实现 |
| 一期 | 登录 + 框架 + 数据导入 + 收入分析完整 + 总览利润桥 + 6 模块骨架 | 已完成，待演示 |
| 二期 | 毛利 / 费用 / 顾客 & 竞争 / 总结 & 计划 / 沙盘 / 报告导出 | 规格已列，未开始 |

## 目录

```
docs/                  业务与过程文档
  webUI.md             界面风格参考（Profit Pilot）
  architecture.md      一人指挥多角色 Agent 的系统设计
  agents/roles.md      角色定义、写入范围与分派规则
  sprint-7d.md         7 天冲刺计划
  domain/              业务口径与数据差异（data-caliber-notes.md）
  research/            Excel / PPT 完整提取报告与样例数据
  demo/                演示脚本与截图（一期产出）
  engineering/         软件工程文档集 01–18（需求/产品/概要/详细/数据库/接口/测试/部署/验收/安全/规范等）
openspec/              规格驱动开发（proposal → specs → design → tasks → archive）
backend/               一期新增：FastAPI 服务、引擎、导入器、测试、seed
frontend/              一期新增：React 看板
shared/fixtures/       前后端共用的验收用例
scripts/               启动、加载示例数据、冒烟
```

## 文档索引

- 业务口径与差异：`docs/domain/data-caliber-notes.md`
- Excel 模型提取：`docs/research/excel-model-extract.md`、`docs/research/excel-sample-data.json`
- PPT 课件提取：`docs/research/ppt-course-extract.md`
- 方案与验收：`openspec/changes/build-catering-analysis-platform/{proposal,design,tasks}.md`
- 开发流程：`docs/architecture.md`、`docs/agents/roles.md`、`docs/sprint-7d.md`
- 软件工程文档集（维护/交接先读）：`docs/engineering/`（01 需求 → 02 产品 → 03 概要 → 04 详细 → 05/13/14 测试 → 06 用户 → 07 维护 → 08 可行性 → 09 计划 → 10 数据库 → 11 接口 → 12 部署 → 15 验收 → 16 评审配置 → 17 安全 → 18 开发规范）

## 快速开始（已实测）

```bash
# 1) 后端：Python 3.12 venv（仓库已带 backend/.venv；换机时用 uv venv --python 3.12 重建）
cd backend && .venv/bin/python -m uvicorn app.main:app --port 8000     # http://127.0.0.1:8000/docs
.venv/bin/python -m app.seeds.load_seed                                # 空库首次：加载 Excel 示例数据

# 2) 前端（Vite 8；dev 已把 /api 代理到 8000）
cd frontend && npm install
VITE_API_MODE=real npm run dev -- --port 5173                          # 真后端演示；默认 mock 可离线看
# 演示账号 admin / admin123

# 3) 测试与冒烟
cd backend && .venv/bin/python -m pytest                               # 63 passed
cd frontend && npm test && VITE_API_MODE=real npm run build           # 45 passed / 构建（real 模式用于 FastAPI 托管演示）
bash scripts/smoke.sh                                                  # 一键：pytest + 构建 + 灌数 + 接口数字断言

# 4) 一键起两个服务
bash scripts/dev.sh      # 后端 8000 + 前端 5173（默认 real）
```

> 演示用 `VITE_API_MODE=real`；mock 模式内置同一套数字，断网也能讲。
> 重新灌数：`cd backend && rm -f data/cba.db && .venv/bin/python -m app.seeds.load_seed`。

## git opt

```bash
git remote -v        # 应有 origin 与 target 两个远程
git pull --rebase origin main
git add <本次改动的文件>     # 不要 git add -A，避免卷入其他 Agent 的改动
git commit -m "docs: 说明"
git push origin main
git push target main
```

//…or create a new repository on the command line
echo "# CateringBusinessAnalysis" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/c4thmy/CateringBusinessAnalysis.git
git push -u origin main

//…or push an existing repository from the command line
git remote add origin https://github.com/c4thmy/CateringBusinessAnalysis.git
git branch -M main
git push -u origin main

//change
git pull
git add .
git commit -m "docs"
git push -u origin main 

git status

//tag：给当前工程状态打标签，方便之后查找
git tag -a v0.1.0 -m "说明这个版本的状态"   # 在当前提交上打附注标签
git push origin v0.1.0                        # 推送标签到 GitHub（git push 默认不推标签）
git push target v0.1.0

git tag -n                  # 列出所有标签及说明
git show v0.1.0             # 查看标签对应的提交内容
git diff v0.1.0 main        # 对比标签时的状态和现在的差异
git checkout v0.1.0         # 临时切回该状态查看，看完用 git checkout main 回来

已有标签：
- v0.1.0：初始基线，业务参考资料(docs) + OpenSpec 脚手架 + CLAUDE.md，尚无源代码
- v0.2.0：经营分析系统 OpenSpec 规划完成（change: build-catering-analysis-platform），待审批，尚无源代码
- v0.3.0：一期 Demo 完成（2026-11-08）——收入分析全链路 + 数据导入 + 应用框架 + 6 模块骨架，57 pytest / 45 vitest / 冒烟通过
- v0.3.1：一期演示收口（2026-11-08）——标签清单与实测命令修正，演示环境验证通过
- v0.3.2：软件工程过程文档集发布（2026-11-08）——需求/产品/概要/详细/测试/用户/维护 7 份文档；系统代码与 v0.3.1 一致
- v0.3.3：维护修复（2026-11-08）——导入接口 {data}、DataPage 默认 key、模板下载、GBK CSV、未知 API 404、渠道/口径字段、去演示硬编码、移除 pandas；63 pytest
- v0.3.4：安全补丁 + 文档集 v2.0（2026-11-08）——SPA 路径穿越修复、预览内部键脱敏；01–18 全量软件工程文档


## openspec opt
OpenSpec 是 Fission AI 出品的规格驱动开发（SDD）框架，项目地址：https://github.com/Fission-AI/OpenSpec
npm install -g @fission-ai/openspec@1.16.0   # 固定版本；想装最新版改成 @latest

openspec --version
openspec list                  # 进行中的 change
openspec show build-catering-analysis-platform
openspec validate build-catering-analysis-platform --strict
openspec archive build-catering-analysis-platform

npm install -g @fission-ai/openspec@latest
cd your-project
openspec update 

cd your-project
openspec init
