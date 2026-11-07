import { Button, Card, Skeleton } from 'antd'
import { errorMessage } from '../api/errors'
import { EmptyState } from './EmptyState'

/** 页面加载态：保持卡片骨架，避免布局跳动 */
export function PageLoading() {
  return (
    <div className="page-stack">
      <Card styles={{ body: { padding: 16 } }}>
        <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 2 }} />
        <div style={{ marginTop: 16 }}>
          <Skeleton active title={{ width: '22%' }} paragraph={{ rows: 6 }} />
        </div>
      </Card>
    </div>
  )
}

/** 页面错误态：接口 404（期间未导入）或网络异常 */
export function PageError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      title="暂时无法加载数据"
      description={errorMessage(error)}
      action={
        <Button type="primary" onClick={onRetry} style={{ marginTop: 12 }}>
          重试
        </Button>
      }
    />
  )
}
