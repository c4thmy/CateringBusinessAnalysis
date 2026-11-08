import {
  App as AntApp,
  Alert,
  Button,
  Card,
  Col,
  Popconfirm,
  Row,
  Select,
  Steps,
  Tag,
  Tooltip,
  Upload,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import {
  useBatches,
  useCommitImport,
  useDataStatus,
  useLoadSeeds,
  useRollbackImport,
  useTemplates,
  useUploadImport,
} from '../../api/hooks'
import { errorMessage } from '../../api/errors'
import { apiMode } from '../../api/client'
import type { ImportBatch, ImportErrorRow, ImportPreviewRow } from '../../api/types'
import { DataTable } from '../../components/DataTable'
import { CaliberNote, Footnote } from '../../components/Notes'
import { useFilters } from '../../filters/FilterContext'
import { formatInteger } from '../../utils/format'

const STATUS_META: Record<ImportBatch['status'], { color: string; text: string }> = {
  draft: { color: 'blue', text: '草稿' },
  committed: { color: 'green', text: '已入库' },
  rolled_back: { color: 'default', text: '已回滚' },
}

const errorColumns: TableColumnsType<ImportErrorRow> = [
  { title: '行号', dataIndex: 'row', key: 'row', width: 80 },
  { title: '列名', dataIndex: 'column', key: 'column', width: 140 },
  { title: '问题', dataIndex: 'message', key: 'message' },
  {
    title: '级别',
    dataIndex: 'severity',
    key: 'severity',
    width: 90,
    render: (value: ImportErrorRow['severity']) =>
      value === 'error' ? <Tag color="red">错误</Tag> : <Tag color="orange">警告</Tag>,
  },
]

const batchColumns: TableColumnsType<ImportBatch> = [
  { title: '批次 ID', dataIndex: 'id', key: 'id', width: 170 },
  { title: '数据集', dataIndex: 'dataset_name', key: 'dataset_name', width: 120 },
  { title: '文件名', dataIndex: 'filename', key: 'filename', width: 220 },
  { title: '期间', dataIndex: 'period', key: 'period', width: 100 },
  {
    title: '行数',
    dataIndex: 'row_count',
    key: 'row_count',
    width: 80,
    align: 'right',
    render: (value: number) => formatInteger(value),
  },
  { title: '操作人', dataIndex: 'operator', key: 'operator', width: 90 },
  { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (value: ImportBatch['status']) => (
      <Tag color={STATUS_META[value].color}>{STATUS_META[value].text}</Tag>
    ),
  },
]

export function DataPage() {
  const { filters } = useFilters()
  const { message } = AntApp.useApp()
  const [dataset, setDataset] = useState('')
  const [draft, setDraft] = useState<ImportBatch | null>(null)

  const templatesQuery = useTemplates()
  const batchesQuery = useBatches()
  const statusQuery = useDataStatus(filters)
  const upload = useUploadImport()
  const commit = useCommitImport()
  const rollback = useRollbackImport()
  const loadSeeds = useLoadSeeds()

  const templates = templatesQuery.data?.data ?? []
  const currentTemplate = templates.find((item) => item.key === dataset)

  // 数据集 key 以接口返回为准（real/mock 的 key 命名不同，不能写死）
  useEffect(() => {
    if (!dataset && templates.length > 0) setDataset(templates[0].key)
  }, [dataset, templates])
  const batches = batchesQuery.data?.data ?? []
  const status = statusQuery.data?.data
  const datasets = status?.datasets ?? []

  const errors = draft?.errors ?? []
  const errorCount = errors.filter((item) => item.severity === 'error').length
  const warningCount = errors.filter((item) => item.severity === 'warning').length
  const previewRows = useMemo<ImportPreviewRow[]>(() => draft?.preview ?? [], [draft])
  const canCommit = draft?.status === 'draft' && errorCount === 0

  const previewColumns = useMemo<TableColumnsType<ImportPreviewRow>>(() => {
    const first = previewRows[0]
    if (!first) return []
    return Object.keys(first).map((key) => ({
      title: key,
      dataIndex: key,
      key,
      width: 130,
      align: key.includes('收入') || key.includes('金额') || key.includes('成本') ? 'right' : 'left',
    }))
  }, [previewRows])

  const handleUpload = (file: File) => {
    upload.mutate(
      { dataset, file },
      {
        onSuccess: (result) => {
          setDraft(result.data)
          const errorRows = (result.data.errors ?? []).filter((item) => item.severity === 'error')
          if (errorRows.length > 0) {
            message.error(`校验未通过：${errorRows.length} 行错误，请修正后重新上传`)
          } else {
            message.success(`校验通过：${result.data.preview?.length ?? 0} 行预览，可确认入库`)
          }
        },
        onError: (error) => message.error(errorMessage(error)),
      },
    )
  }

  const handleCommit = () => {
    if (!draft) return
    commit.mutate(draft.id, {
      onSuccess: (result) => {
        setDraft(result.data)
        message.success(`已确认入库：${result.data.row_count} 行（批次 ${result.data.id}）`)
      },
      onError: (error) => message.error(errorMessage(error)),
    })
  }

  const handleRollback = (id: string) => {
    rollback.mutate(id, {
      onSuccess: (result) => {
        if (draft?.id === result.data.id) setDraft(result.data)
        message.success(`已回滚批次 ${id}（旧数据恢复）`)
      },
      onError: (error) => message.error(errorMessage(error)),
    })
  }

  const stepCurrent = draft ? (draft.status === 'committed' ? 3 : errorCount > 0 ? 1 : 2) : 0

  return (
    <div className="page-stack">
      <Card styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>数据就绪状态 · {filters.period}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              8 类数据集：{datasets.filter((item) => item.ready).length} 类已就绪、
              {datasets.filter((item) => !item.ready).length} 类未导入（缺失时页面显示「—」，不显示 0）
            </div>
          </div>
          <Button
            type="primary"
            loading={loadSeeds.isPending}
            onClick={() =>
              loadSeeds.mutate(undefined, {
                onSuccess: (result) => {
                  message.success(result.data.message)
                  void statusQuery.refetch()
                },
                onError: (error) => message.error(errorMessage(error)),
              })
            }
          >
            加载示例数据
          </Button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {datasets.map((item) => (
            <Tag key={item.key} color={item.ready ? 'green' : 'orange'}>
              {item.name}：{item.ready ? `已就绪 · ${item.rows} 行` : '未导入'}
            </Tag>
          ))}
        </div>
        {status ? (
          <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#6B7280' }}>
            {Object.entries(status.modules).map(([key, module]) => (
              <span key={key}>
                模块 {key}：{module.ready ? <Tag color="green">就绪</Tag> : <Tag color="orange">缺 {module.missing.join('、')}</Tag>}
              </span>
            ))}
          </div>
        ) : null}
      </Card>

      <Card styles={{ body: { padding: 16 } }}>
        <Steps
          size="small"
          current={stepCurrent}
          items={[
            { title: '选择数据集' },
            { title: '上传并校验' },
            { title: '预览确认' },
            { title: '入库 / 可回滚' },
          ]}
        />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card title="上传与校验（两阶段提交）" styles={{ body: { padding: 16 } }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
              <Select
                value={dataset}
                options={templates.map((item) => ({ value: item.key, label: item.name }))}
                onChange={(value) => setDataset(value)}
                style={{ width: 190 }}
                placeholder="选择数据集"
              />
              <Button
                disabled={!dataset}
                onClick={() => {
                  if (!dataset) return
                  if (apiMode === 'mock') {
                    message.info('mock 模式下不下载文件；切到 real 模式或直接用后端地址下载')
                    return
                  }
                  void (async () => {
                    try {
                      const response = await fetch(`/api/imports/templates/${dataset}.xlsx`, {
                        credentials: 'include',
                      })
                      if (!response.ok) throw new Error(`HTTP ${response.status}`)
                      const blob = await response.blob()
                      const url = URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = `${currentTemplate?.name ?? dataset}.xlsx`
                      link.click()
                      URL.revokeObjectURL(url)
                      message.success('模板已开始下载')
                    } catch (error) {
                      message.error(`模板下载失败：${errorMessage(error)}`)
                    }
                  })()
                }}
              >
                下载模板
              </Button>
              {currentTemplate ? (
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  必填列：{currentTemplate.columns.slice(0, 6).join('、')}…
                </span>
              ) : null}
            </div>

            <Upload.Dragger
              accept=".xlsx,.xlsm,.csv,.txt"
              showUploadList={false}
              beforeUpload={(file) => {
                handleUpload(file as File)
                return false
              }}
              disabled={upload.isPending}
            >
              <div className="upload-drop">
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1F2430' }}>点击或拖拽文件到此区域上传</span>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  支持 .xlsx / .xlsm / .csv / .txt（旧 .xls 请另存为 .xlsx）；上传后先校验并预览，确认后才写入数据库
                </span>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                  演示提示：文件名包含「error」或「错误」时会模拟校验失败（错误表 → 确认按钮禁用）
                </span>
              </div>
            </Upload.Dragger>

            {draft ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{draft.filename}</span>
                  <Tag color={STATUS_META[draft.status].color}>{STATUS_META[draft.status].text}</Tag>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                    数据集 {draft.dataset_name} · 期间 {draft.period} · 预览 {previewRows.length} 行
                  </span>
                  {errorCount > 0 ? <Tag color="red">{errorCount} 行错误</Tag> : null}
                  {warningCount > 0 ? <Tag color="orange">{warningCount} 行警告</Tag> : null}
                </div>

                {errors.length > 0 ? (
                  <div style={{ marginBottom: 12 }}>
                    <Alert
                      type={errorCount > 0 ? 'error' : 'warning'}
                      showIcon
                      title={errorCount > 0 ? '校验未通过：存在错误行，确认按钮已禁用' : '校验通过，存在警告项'}
                      description="错误行列号、列名与原因如下；修正原文件后重新上传。"
                      style={{ marginBottom: 8 }}
                    />
                    <DataTable<ImportErrorRow>
                      columns={errorColumns}
                      rows={errors}
                      rowKey={(row) => `${row.row}-${row.column}-${row.message}`}
                    />
                  </div>
                ) : (
                  <Alert type="success" showIcon title="校验通过，无错误行" style={{ marginBottom: 12 }} />
                )}

                <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>数据预览（前 50 行）</div>
                {previewRows.length > 0 ? (
                  <DataTable<ImportPreviewRow>
                    columns={previewColumns}
                    rows={previewRows}
                    rowKey={(row) => JSON.stringify(row)}
                    scrollX={Math.max(600, previewColumns.length * 130)}
                    emptyText="该数据集示例尚未提供预览行"
                  />
                ) : (
                  <CaliberNote>
                    该数据集在演示 mock 中没有预览行（单品销售未导入）；真实环境上传后返回前 50 行与按期间/门店汇总。
                  </CaliberNote>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' }}>
                  <Tooltip title={canCommit ? '' : errorCount > 0 ? '存在错误行，请修正后重新上传' : '当前批次不可重复确认'}>
                    <Button
                      type="primary"
                      disabled={!canCommit}
                      loading={commit.isPending}
                      onClick={handleCommit}
                    >
                      确认入库
                    </Button>
                  </Tooltip>
                  <Button onClick={() => setDraft(null)}>清除本次上传</Button>
                  {draft.status === 'committed' ? (
                    <Popconfirm
                      title="回滚该批次？"
                      description="回滚后恢复导入前的旧数据，本批次数据不再生效。"
                      onConfirm={() => handleRollback(draft.id)}
                      okText="确认回滚"
                      cancelText="取消"
                    >
                      <Button danger loading={rollback.isPending}>
                        回滚本批次
                      </Button>
                    </Popconfirm>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Card title="导入规则与口径" styles={{ body: { padding: 16 } }}>
            <div style={{ fontSize: 12, lineHeight: 1.9, color: '#6B7280' }}>
              <div>· 8 类数据集：月度利润表、门店收入、渠道收入、产品系列销售、单品销售、线上漏斗、时段客流、预算与目标。</div>
              <div>· 流程：上传 → 解析 → 校验（行号 + 列名 + 原因）→ 预览（前 50 行 + 汇总）→ 确认入库 → 覆盖提示 → 批次回滚。</div>
              <div>· 每行事实数据都带导入批次 ID；覆盖导入时旧行标记 superseded_by，不做物理删除，回滚只恢复旧行。</div>
              <div>· 单位约定：利润表/门店收入/渠道收入为万元；产品销售额为元；客流为人次。</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <CaliberNote>
                示例数据通过同一个导入流程写入（backend/seed），因此「加载示例数据」本身也验证导入链路；
                口径差异与待确认项记录在 backend/seed/README.md 与 docs/domain/data-caliber-notes.md。
              </CaliberNote>
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title="导入批次（支持回滚）"
        extra={<span style={{ fontSize: 12, color: '#9CA3AF' }}>共 {batches.length} 个批次</span>}
        styles={{ body: { padding: 0 } }}
      >
        <DataTable<ImportBatch>
          columns={[
            ...batchColumns,
            {
              title: '操作',
              key: 'action',
              width: 110,
              render: (_value, row) =>
                row.status === 'committed' ? (
                  <Popconfirm
                    title="回滚该批次？"
                    description="回滚后恢复旧数据，本批次不再生效。"
                    onConfirm={() => handleRollback(row.id)}
                    okText="确认回滚"
                    cancelText="取消"
                  >
                    <Button size="small" danger type="link">
                      回滚
                    </Button>
                  </Popconfirm>
                ) : (
                  <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>
                ),
            },
          ]}
          rows={batches}
          rowKey={(row) => row.id}
          loading={batchesQuery.isLoading}
          scrollX={1200}
        />
      </Card>

      <Footnote title="说明">
        当前为 mock 模式（VITE_API_MODE=mock）：上传/确认/回滚只改内存批次，不写数据库；切换 VITE_API_MODE=real 后接口指向
        http://127.0.0.1:8000/api，401 自动跳转登录。批次列表显示的金额单位与页面脚注一致，缺失数据以「—」展示。
        导入的错误行不会写入事实表；预览表头与模板中文列名一致。
      </Footnote>
    </div>
  )
}
