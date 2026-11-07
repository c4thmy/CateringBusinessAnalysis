import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/** 兜底错误边界：任一页面渲染异常时不至于整树卸载白屏。 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('页面渲染异常', error, info)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 64, textAlign: 'center' }}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>页面加载异常</h2>
          <p style={{ color: '#6B7280', marginBottom: 20 }}>
            请刷新页面或返回首页；如果持续出现，请把当前筛选条件反馈给管理员。
          </p>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            style={{ padding: '8px 20px', background: '#2F54EB', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}
          >
            返回首页
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
