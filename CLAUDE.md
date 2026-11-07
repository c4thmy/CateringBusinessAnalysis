# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言

中文回答；OpenSpec 产出物（proposal / design / specs / tasks）也使用中文撰写。

## 项目现状

本仓库目前没有源代码、构建、lint 或测试配置，只有业务参考资料和 OpenSpec 脚手架。新增代码时，需要先确定技术栈，再把对应的构建/测试命令补充到本文件。

- `docs/` — 业务需求的事实来源（二进制 Office 文件，用 xlsx / pptx skill 读取，不要直接改写原件）：
  - `利润桥及毛利率分析-高维第二期261003.xlsx`：分析模型的计算逻辑。工作表按分析步骤组织：函数公式、营业利润连环替代法公式、2025 年月利润表数据、利润分析总看板、当月与累计对比、总利润表，以及第一步（2509 餐饮利润桥）→ 第二步（收入结构、收入异动、标杆品牌点评曝光转化）→ 第三步（毛利异动）→ 第四步（产品毛利率、重点产品成本损益率）→ 第五步（折扣率影响毛利率），最后是待办计划清单和时段客单预估营业额。
  - `高维学堂经营分析与科学决策月度分析模版20261002.pptx`（80 页）：月度经营分析报告模版，章节为 财务指标 → 收入（流量 & 产品）→ 毛利（销量、单价 & 成本）→ 费用 → 顾客 & 竞争 → 总结 & 计划。
- `openspec/` — 规格驱动开发（`schema: spec-driven`）。`specs/` 和 `changes/` 目前为空。
- `.claude/commands/opsx/` 与 `.claude/skills/openspec-*` — OpenSpec 工作流（propose → apply → sync → archive，另有 explore / update）。

## 核心分析方法（理解业务的关键）

- 分析 = 对比找差异：实际值 vs 预算值 / 同期 / 上期 / 模型值 / 竞对。
- 连环替代法（因素分析）：按固定顺序逐项替换，每步影响 = 替换后 − 替换前，顺序不能乱。例如毛利额 = 销量 ×（单价 − 单位成本），依次替换 销量 → 单价 → 单位成本。
- 利润桥：把营业利润的同比变化拆成收入、毛利率、销售费率、固定费用等因素的贡献。
- 收入拆解维度：经营模式（直营/加盟/联营）、同店/新店/闭店、区域、渠道（堂食、外卖、美团大众、扫码等）、菜品系列/单品；同店收入异动再拆为客流 × 客单。
- 毛利率变动拆为 产品销售结构影响 + 单品毛利率影响，并对比实际成本与理论成本。

## OpenSpec 命令

```bash
openspec list                 # 列出进行中的 change（--specs 列出规格）
openspec show <名称>
openspec validate <名称>
```

日常使用 `/opsx:propose`、`/opsx:apply`、`/opsx:archive` 等斜杠命令驱动流程。
