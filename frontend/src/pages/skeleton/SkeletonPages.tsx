import { Button, Card, Slider, Space, Tag } from 'antd'
import { SkeletonPage } from '../../components/SkeletonPage'
import {
  CustomerIcon,
  ExpenseIcon,
  GrossIcon,
  ReportIcon,
  SandboxIcon,
  SummaryIcon,
} from '../../components/icons'

export function GrossSkeletonPage() {
  return (
    <SkeletonPage
      title="毛利分析"
      icon={<GrossIcon size={22} />}
      description="毛利率与毛利额的本期/同期/预算对比，把毛利率变动拆成「产品销售结构影响 + 单品毛利率影响」，并对比实际成本与理论成本。"
      planned={[
        '毛利额 / 毛利率本期、同期、预算对比与差异率、百分点变化',
        '毛利率变动拆分：产品销售结构影响 + 单品毛利率影响（mix_rate_split）',
        '毛利额三因素连环替代：销量 → 单价 → 单位成本',
        '实际成本 vs 理论成本的损益排行与超耗门店标记',
        '折扣率对成本率的影响（优惠 ÷ 收入 = 23.5%，两义口径页面注明）',
        '门店毛利率分位（P25 / P50 / P75）与达标率',
      ]}
    />
  )
}

export function ExpenseSkeletonPage() {
  return (
    <SkeletonPage
      title="费用分析"
      icon={<ExpenseIcon size={22} />}
      description="费用科目本期与同期/预算对比、变动费用与固定费用小计，以及人效、坪效、租售比等效率指标与模型值对比。"
      planned={[
        '费用科目对比：金额、占收入比、增减率与占比变动（pp）',
        '变动费用 / 固定费用小计（分类可在科目表调整）',
        '人效 = 收入 ÷ 人数、人工成本率；缺人数/面积时显示「—」并给出原因',
        '坪效 = 收入 ÷ 面积、租售比 = 房租 ÷ 收入、上座次数',
        '营销投产比与预算值/模型值对比、门店达标率与排行',
        '缺失基础数据时的空态与「数据不完整」提示',
      ]}
    />
  )
}

export function CustomerSkeletonPage() {
  return (
    <SkeletonPage
      title="顾客 & 竞争分析"
      icon={<CustomerIcon size={22} />}
      description="多渠道加权满意度、评价词频与原文检索、会员与储值指标，以及竞对监测对比。"
      planned={[
        '多渠道加权满意度（权重合计必须为 100%，否则拒绝保存）',
        '分项评分（口味 / 服务 / 环境 / 性价比）与历史趋势',
        '好评 / 差评词频（jieba 分词）与原文检索抽屉',
        '会员数、储值余额、会员消费占比与复购',
        '竞对监测表：竞对均值、我方排名与差距',
        '门店分位与达标率',
      ]}
    />
  )
}

export function SummarySkeletonPage() {
  return (
    <SkeletonPage
      title="总结 & 计划"
      icon={<SummaryIcon size={22} />}
      description="自动汇总各模块结论，形成月度总结、下月目标与待办整改清单，并支持导出为 Excel。"
      planned={[
        '月度总结草稿：自动汇总经营总览、收入、毛利、费用、顾客各模块结论，可编辑保存',
        '下月目标：收入 / 营业利润 / 毛利率 / 满意度/ 客单等目标值与达成路径',
        '待办整改清单：维度、事项、目标、方案、期限、部门、责任人、状态（CRUD）',
        '时段营业额预估（Excel「时段客单预估营业额」口径）',
        '导出 xlsx（三个工作表，列同 Excel 待办清单）',
        '权限与审批流：一期只做单管理员，二期预留',
      ]}
    />
  )
}

export function SandboxSkeletonPage() {
  const sandboxPreview = (
    <Card title="布局示意（不可计算）" styles={{ body: { padding: 16 } }}>
      <div className="sandbox-preview">
        <div className="sandbox-panel">
          <div className="sandbox-panel-title">驱动因子（二期可调）</div>
          {['客流', '客单价', '渠道结构', '毛利率', '平台费用率', '固定费用'].map((label) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{label}</div>
              <Slider disabled defaultValue={40} />
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#9CA3AF' }}>一期为布局示意，滑块不可用。</div>
        </div>
        <div className="sandbox-placeholder">二期开放：实时利润表 + 利润桥 + 多方案对比</div>
      </div>
    </Card>
  )

  return (
    <SkeletonPage
      title="沙盘预演"
      icon={<SandboxIcon size={22} />}
      description="在基期数据上调整驱动因子，实时算出利润表与利润桥；多方案对比后保存，并输出「结果方案」转成下月计划。"
      planned={[
        '因子面板：客流、客单、渠道结构、毛利率/折扣率、费率、固定费用、时段上座与客单',
        '前端实时复算（1 秒内出结果）：因子 → 利润表 → 利润桥',
        '单因子目标反推：给定目标利润，反推所需客流/客单（不可达时提示）',
        '多方案保存与 2–4 方案对比',
        '结果方案：目标分解 + 建议整改项 + 导出',
        '一键转成下月计划（打通总结 & 计划）',
      ]}
      preview={sandboxPreview}
    />
  )
}

export function ReportsSkeletonPage() {
  const reportsPreview = (
    <Card title="报告模板与导出（占位）" styles={{ body: { padding: 16 } }}>
      <div className="sandbox-preview">
        <div className="sandbox-panel">
          <div className="sandbox-panel-title">报告目录（二期）</div>
          <div style={{ fontSize: 12, lineHeight: 2, color: '#6B7280' }}>
            <div>1. 封面与期间</div>
            <div>2. 经营结论（规则生成）</div>
            <div>3. 利润桥与营业利润对比</div>
            <div>4. 收入结构与异动下钻</div>
            <div>5. 行动计划与责任部门</div>
          </div>
        </div>
        <div className="sandbox-placeholder">二期开放：选择方案与期间生成报告并导出</div>
      </div>
      <Space style={{ marginTop: 12 }} wrap>
        <Button disabled>生成报告</Button>
        <Button disabled>导出 HTML</Button>
        <Button disabled>导出 PDF</Button>
        <Button disabled>导出 PPT</Button>
        <Tag color="orange">二期开放</Tag>
      </Space>
    </Card>
  )

  return (
    <SkeletonPage
      title="结果方案报告"
      icon={<ReportIcon size={22} />}
      description="把沙盘预演选定的方案生成结果方案报告：结论、图表、行动计划，支持 HTML / PDF / PPT 导出与归档分享。"
      planned={[
        '报告模板：结论 / 图表 / 行动计划（按模块章节组织）',
        '选择方案与期间生成报告（与沙盘、总结 & 计划联动）',
        'HTML / PDF / PPT 三种导出格式',
        '报告归档、版本记录与分享链接',
        '一键转成下月计划',
      ]}
      preview={reportsPreview}
    />
  )
}
