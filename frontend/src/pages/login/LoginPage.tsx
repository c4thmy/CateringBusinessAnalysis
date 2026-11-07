import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import { errorMessage } from '../../api/errors'
import { useAuth } from '../../auth/AuthContext'
import { color } from '../../theme'

interface LoginFormValues {
  username: string
  password: string
}

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true })
    }
  }, [loading, user, from, navigate])

  const onFinish = async (values: LoginFormValues) => {
    setSubmitting(true)
    setError('')
    try {
      await login(values.username, values.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-wrap">
        <div className="login-brand">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <span className="app-logo-mark">P</span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Profit Pilot · 餐饮经营分析</span>
            </div>
            <div className="login-brand-title">
              比差异、找问题、
              <br />
              定计划、达目标
            </div>
            <div className="login-brand-desc">
              导入经营数据后自动生成利润桥、收入结构、同店异动、渠道漏斗与产品量价分析，
              把高维学堂的月度分析模型变成可交互的 Web 系统。
            </div>
          </div>
          <div className="login-brand-points">
            <span>· 利润桥 9 因素与营业利润对比（2025-09 vs 2024-09）</span>
            <span>· 收入结构 6 维度 / 同店客流×客单 / 13 店明细下钻</span>
            <span>· 渠道漏斗与平台 ROI / 产品系列与套餐量价</span>
          </div>
        </div>

        <div className="login-form">
          <h2 className="login-form-title">登录餐饮经营分析系统</h2>
          <div className="login-form-sub">单管理员账号（演示环境为 mock 登录）</div>

          {error ? <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} /> : null}

          <Form<LoginFormValues>
            layout="vertical"
            onFinish={(values) => void onFinish(values)}
            initialValues={{ username: 'admin', password: 'admin123' }}
            requiredMark={false}
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input size="large" autoComplete="username" placeholder="admin" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password size="large" autoComplete="current-password" placeholder="admin123" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
              登录
            </Button>
          </Form>

          <div className="login-hint">
            演示账号：<strong style={{ color: color.text }}>admin</strong> / 密码：{' '}
            <strong style={{ color: color.text }}>admin123</strong>
            <br />
            真实环境由后端 httpOnly Cookie（JWT）维持会话，前端不存储密码。
          </div>
        </div>
      </div>
    </div>
  )
}
