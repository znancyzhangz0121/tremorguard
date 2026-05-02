import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Bell,
  BatteryMedium,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Link2,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  User,
  Watch,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buildApiUrl, readApiJson } from './lib/api'

const authStorageKey = 'tremor-guard-auth'

function loadStoredSession() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(authStorageKey) || 'null')
    return stored?.token && stored?.user ? stored : null
  } catch {
    return null
  }
}

function App() {
  const [session, setSession] = useState(loadStoredSession)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', age: '', password: '' })
  const [profile, setProfile] = useState(null)
  const [device, setDevice] = useState(null)
  const [summary, setSummary] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [medications, setMedications] = useState([])
  const [archives, setArchives] = useState([])
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [onboardingForm, setOnboardingForm] = useState({
    sex: '',
    diagnosisYear: '',
    primarySymptom: '',
    mobilityLevel: '',
    emergencyContact: '',
    consentAccepted: true,
  })
  const [deviceForm, setDeviceForm] = useState({
    deviceName: '我的震颤卫士手环',
    serialNumber: '',
    verificationCode: '',
    wearSide: 'right',
  })
  const [archiveForm, setArchiveForm] = useState({
    title: '',
    patientName: '',
    description: '',
    consentAccepted: true,
  })
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: '登录并同步设备数据后，我可以帮助解读趋势、整理复诊沟通重点和生成康复计划。' },
  ])
  const [currentPlan, setCurrentPlan] = useState(null)
  const [reports, setReports] = useState([])

  const token = session?.token
  const headers = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token],
  )

  useEffect(() => {
    if (!session) return
    void loadSessionState()
    // The session token is the only intended trigger for this data bootstrap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token])

  async function api(path, options = {}) {
    const response = await fetch(buildApiUrl(path), {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    })
    const data = await readApiJson(response, '请求失败')
    if (!response.ok) {
      throw new Error(data.detail || data.message || '请求失败')
    }
    return data
  }

  async function loadSessionState() {
    setLoading(true)
    setError('')
    try {
      const [patientData, deviceData] = await Promise.all([
        api('/patients/me'),
        api('/devices/me'),
      ])
      setProfile(patientData)
      setDevice(deviceData.binding)

      if (patientData.onboardingCompleted && deviceData.binding?.connected) {
        await loadWorkspaceData()
      }
    } catch (err) {
      setError(err.message || '状态加载失败')
      if (String(err.message).includes('token')) {
        logout()
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadWorkspaceData() {
    const [summaryData, timelineData, planData, reportData, medicationData, archiveData] = await Promise.all([
      api('/dashboard/summary'),
      api('/tremor/timeline'),
      api('/rehab-plans/current'),
      api('/health-reports'),
      api('/medication/records'),
      api('/medical-records/archives'),
    ])
    setSummary(summaryData)
    setTimeline(timelineData)
    setCurrentPlan(planData.plan)
    setReports(reportData.reports || [])
    setMedications(medicationData || [])
    setArchives(archiveData.archives || [])
  }

  async function submitAuth(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload =
        authMode === 'login'
          ? { email: authForm.email, password: authForm.password }
          : {
              name: authForm.name,
              email: authForm.email,
              age: authForm.age ? Number(authForm.age) : null,
              password: authForm.password,
            }
      const data = await api(authMode === 'login' ? '/auth/login' : '/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      window.localStorage.setItem(authStorageKey, JSON.stringify(data))
      setSession(data)
    } catch (err) {
      setError(err.message || '账号请求失败')
    } finally {
      setLoading(false)
    }
  }

  async function submitOnboarding(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/patients/me/onboarding', {
        method: 'PUT',
        body: JSON.stringify({
          ...onboardingForm,
          diagnosisYear: onboardingForm.diagnosisYear ? Number(onboardingForm.diagnosisYear) : null,
        }),
      })
      await loadSessionState()
    } catch (err) {
      setError(err.message || '档案保存失败')
    } finally {
      setLoading(false)
    }
  }

  async function submitDevice(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await api('/devices/bind', {
        method: 'POST',
        body: JSON.stringify({
          ...deviceForm,
          serialNumber: deviceForm.serialNumber.trim().toUpperCase(),
        }),
      })
      setDevice(data.binding)
      await loadWorkspaceData()
    } catch (err) {
      setError(err.message || '设备绑定失败')
    } finally {
      setLoading(false)
    }
  }

  async function submitArchive(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await api('/medical-records/archives', {
        method: 'POST',
        body: JSON.stringify({
          ...archiveForm,
          patientName: archiveForm.patientName || session?.user?.name || '患者',
        }),
      })
      setArchives((items) => [data.archive, ...items.filter((item) => item.id !== data.archive.id)])
      setArchiveForm({ title: '', patientName: '', description: '', consentAccepted: true })
    } catch (err) {
      setError(err.message || '病历保存失败')
    } finally {
      setLoading(false)
    }
  }

  async function checkInMedication() {
    setError('')
    try {
      await api('/medication/check-in', {
        method: 'POST',
        body: JSON.stringify({ medication: '患者记录用药' }),
      })
      await loadWorkspaceData()
    } catch (err) {
      setError(err.message || '用药记录失败')
    }
  }

  async function sendChat(event) {
    event.preventDefault()
    const message = chatInput.trim()
    if (!message) return
    setChatInput('')
    setChatMessages((items) => [...items, { role: 'user', text: message }])
    try {
      const data = await api('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      })
      setChatMessages((items) => [
        ...items,
        { role: 'ai', text: data.text, meta: `${data.providerName || 'local'} · ${data.providerStatus || 'unknown'}` },
      ])
    } catch (err) {
      setChatMessages((items) => [...items, { role: 'ai', text: err.message || 'AI 服务暂不可用。' }])
    }
  }

  async function generatePlan() {
    setError('')
    try {
      const data = await api('/rehab-plans', { method: 'POST', body: JSON.stringify({}) })
      setCurrentPlan(data.plan)
      setActiveTab('rehab')
    } catch (err) {
      setError(err.message || '康复计划生成失败')
    }
  }

  async function confirmPlan() {
    if (!currentPlan) return
    setError('')
    try {
      const data = await api(`/rehab-plans/${currentPlan.id}/confirm`, { method: 'POST' })
      setCurrentPlan(data.plan)
    } catch (err) {
      setError(err.message || '确认计划失败')
    }
  }

  async function generateReport() {
    setError('')
    try {
      const data = await api('/health-reports', { method: 'POST' })
      setReports((items) => [data.report, ...items.filter((item) => item.id !== data.report.id)])
      setActiveTab('reports')
    } catch (err) {
      setError(err.message || '报告生成失败')
    }
  }

  async function downloadReport(reportId) {
    const response = await fetch(buildApiUrl(`/health-reports/${reportId}/pdf`), {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      setError('PDF 下载失败')
      return
    }
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `health-report-${reportId}.pdf`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  function logout() {
    window.localStorage.removeItem(authStorageKey)
    setSession(null)
    setProfile(null)
    setDevice(null)
    setSummary(null)
    setTimeline([])
    setMedications([])
    setArchives([])
    setActiveTab('dashboard')
  }

  if (!session) {
    return (
      <AuthScreen
        authMode={authMode}
        form={authForm}
        loading={loading}
        error={error}
        onMode={setAuthMode}
        onChange={(field, value) => setAuthForm((prev) => ({ ...prev, [field]: value }))}
        onSubmit={submitAuth}
      />
    )
  }

  if (!profile?.onboardingCompleted) {
    return (
      <AppShell user={session.user} activeTab="onboarding" device={device} onLogout={logout}>
        <TopBar user={session.user} device={device} />
        <OnboardingScreen
          form={onboardingForm}
          loading={loading}
          error={error}
          onChange={(field, value) => setOnboardingForm((prev) => ({ ...prev, [field]: value }))}
          onSubmit={submitOnboarding}
        />
      </AppShell>
    )
  }

  if (!device?.connected) {
    return (
      <AppShell user={session.user} activeTab="device" device={device} onLogout={logout}>
        <TopBar user={session.user} device={device} />
        <DeviceScreen
          form={deviceForm}
          loading={loading}
          error={error}
          onChange={(field, value) => setDeviceForm((prev) => ({ ...prev, [field]: value }))}
          onSubmit={submitDevice}
        />
      </AppShell>
    )
  }

  return (
    <AppShell
      user={session.user}
      activeTab={activeTab}
      onTab={setActiveTab}
      onLogout={logout}
      device={device}
    >
      <TopBar user={session.user} device={device} />
      {error ? (
        <div className="tg-page tg-page-narrow tg-page-alert">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      {activeTab === 'dashboard' ? (
        <Dashboard
          user={session.user}
          summary={summary}
          timeline={timeline}
          medications={medications}
          device={device}
          onNav={setActiveTab}
          onRefresh={loadWorkspaceData}
          onMedication={checkInMedication}
          onPlan={generatePlan}
          onReport={generateReport}
        />
      ) : null}
      {activeTab === 'chat' ? (
        <Chat messages={chatMessages} input={chatInput} onInput={setChatInput} onSubmit={sendChat} />
      ) : null}
      {activeTab === 'records' ? (
        <Records
          archives={archives}
          form={archiveForm}
          loading={loading}
          onChange={(field, value) => setArchiveForm((prev) => ({ ...prev, [field]: value }))}
          onSubmit={submitArchive}
        />
      ) : null}
      {activeTab === 'rehab' ? (
        <RehabPlan plan={currentPlan} onGenerate={generatePlan} onConfirm={confirmPlan} />
      ) : null}
      {activeTab === 'reports' ? (
        <Reports reports={reports} onGenerate={generateReport} onDownload={downloadReport} />
      ) : null}
      {activeTab === 'account' ? <Account user={session.user} device={device} onLogout={logout} /> : null}
    </AppShell>
  )
}

function AuthScreen({ authMode, form, loading, error, onMode, onChange, onSubmit }) {
  const steps = ['登录账号', '完善患者档案', '绑定设备', '进入工作台']
  return (
    <main className="tg-auth">
      <section className="tg-auth-brand">
        <Brand />
        <div className="tg-auth-copy">
          <Eyebrow>欢迎回来</Eyebrow>
          <h1>
            先登录账号，
            <br />
            再接入设备。
          </h1>
          <p>完成账号访问后，系统会引导您完善患者档案、绑定已登记手环、查看健康看板并生成纵向报告。</p>
        </div>
        <ol className="tg-step-list">
          {steps.map((step, index) => (
            <li key={step} className={index === 0 ? 'is-active' : ''}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="tg-auth-form-wrap">
        <form onSubmit={onSubmit} className="tg-auth-form">
          <div className="tg-tabs" aria-label="账号入口">
            {[
              ['login', '登录'],
              ['register', '创建账号'],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={authMode === mode ? 'is-active' : ''}
                onClick={() => onMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="tg-field-stack">
            {authMode === 'register' ? (
              <>
                <Field label="姓名" value={form.name} onChange={(value) => onChange('name', value)} required />
                <Field label="年龄" type="number" value={form.age} onChange={(value) => onChange('age', value)} />
              </>
            ) : null}
            <Field label="邮箱" type="email" value={form.email} onChange={(value) => onChange('email', value)} required />
            <Field label="密码" type="password" value={form.password} onChange={(value) => onChange('password', value)} required />
          </div>

          {error ? <Notice tone="error">{error}</Notice> : null}
          <PillButton type="submit" primary disabled={loading}>
            {loading ? '处理中...' : authMode === 'login' ? '登录并继续' : '创建账号并继续'}
            <ChevronRight size={15} />
          </PillButton>
        </form>
      </section>
    </main>
  )
}

function AppShell({ user, activeTab, onTab, onLogout, device, children }) {
  const tabs = [
    ['dashboard', LayoutDashboard, '看板'],
    ['chat', MessageSquare, 'AI'],
    ['records', Clock3, '病历'],
    ['rehab', HeartPulse, '康复'],
    ['reports', FileText, '报告'],
    ['account', User, '我的'],
  ]
  const initial = user?.name?.slice(0, 1) || user?.email?.slice(0, 1)?.toUpperCase() || '患'
  const battery = device?.batteryPercent ?? 0

  return (
    <div className="tg-shell">
      <aside className="tg-rail">
        <button className="tg-mark-button" onClick={() => onTab?.('dashboard')} title="震颤卫士">
          <Activity size={18} />
        </button>
        <nav className="tg-rail-nav" aria-label="主导航">
          {tabs.map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              title={label}
              disabled={!onTab}
              onClick={() => onTab?.(id)}
              className={activeTab === id ? 'is-active' : ''}
            >
              {React.createElement(Icon, { size: 18 })}
            </button>
          ))}
        </nav>
        <div className="tg-rail-bottom">
          <div className="tg-battery" title={`电量 ${battery}%`}>
            <span style={{ height: `${battery}%` }} />
          </div>
          <div className="tg-avatar">{initial}</div>
          <button type="button" className="tg-rail-logout" onClick={onLogout} title="退出登录">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="tg-main">{children}</main>
      <nav className="tg-mobile-nav" aria-label="移动端导航">
        {tabs.map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            disabled={!onTab}
            onClick={() => onTab?.(id)}
            className={activeTab === id ? 'is-active' : ''}
          >
            {React.createElement(Icon, { size: 17 })}
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function TopBar({ user, device }) {
  return (
    <header className="tg-topbar">
      <div>辅助监测平台 · 不可替代专业医师诊断</div>
      <div className="tg-topbar-meta">
        <span>
          <Dot tone="good" />
          {device?.deviceName || '等待绑定'} · {device?.batteryPercent ?? 0}%
        </span>
        <button type="button" title="通知">
          <Bell size={16} />
          <i />
        </button>
        <span>{user?.name || user?.email}</span>
      </div>
    </header>
  )
}

function OnboardingScreen({ form, loading, error, onChange, onSubmit }) {
  return (
    <PageWrap>
      <PageTitle eyebrow="步骤 2 / 4" sub="这些信息用于限定 AI 解读和报告上下文。新账号不会带入任何预置业务数据。">
        完善患者档案
      </PageTitle>
      <form onSubmit={onSubmit} className="tg-editor-form">
        <Field label="主要症状" value={form.primarySymptom} onChange={(value) => onChange('primarySymptom', value)} required />
        <Field label="确诊年份" type="number" value={form.diagnosisYear} onChange={(value) => onChange('diagnosisYear', value)} />
        <Field label="行动能力" value={form.mobilityLevel} onChange={(value) => onChange('mobilityLevel', value)} />
        <Field label="紧急联系人" value={form.emergencyContact} onChange={(value) => onChange('emergencyContact', value)} />
        <label className="tg-checkline">
          <input type="checkbox" checked={form.consentAccepted} onChange={(event) => onChange('consentAccepted', event.target.checked)} />
          我确认数据仅用于个人健康管理和复诊沟通
        </label>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <PillButton type="submit" primary disabled={loading || !form.consentAccepted}>
          保存档案
          <ChevronRight size={15} />
        </PillButton>
      </form>
    </PageWrap>
  )
}

function DeviceScreen({ form, loading, error, onChange, onSubmit }) {
  return (
    <PageWrap>
      <PageTitle eyebrow="步骤 3 / 4" sub="设备必须先在后端登记，绑定时会校验序列号和校验码。">
        绑定已登记设备
      </PageTitle>
      <form onSubmit={onSubmit} className="tg-editor-form">
        <Field label="设备名称" value={form.deviceName} onChange={(value) => onChange('deviceName', value)} required />
        <Field label="设备序列号" value={form.serialNumber} onChange={(value) => onChange('serialNumber', value)} required />
        <Field label="设备校验码" value={form.verificationCode} onChange={(value) => onChange('verificationCode', value)} required />
        <label className="tg-field">
          <span>佩戴侧</span>
          <select value={form.wearSide} onChange={(event) => onChange('wearSide', event.target.value)}>
            <option value="right">右手</option>
            <option value="left">左手</option>
          </select>
        </label>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <PillButton type="submit" primary disabled={loading}>
          绑定设备
          <ChevronRight size={15} />
        </PillButton>
      </form>
    </PageWrap>
  )
}

function Dashboard({ user, summary, timeline, medications, device, onNav, onRefresh, onMedication, onPlan, onReport }) {
  const today = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())
  const hasData = summary?.hasMonitoringData

  return (
    <PageWrap>
      <section className="tg-hero">
        <Eyebrow muted>{today}</Eyebrow>
        <h1>{summary?.header?.greeting || `你好，${user?.name || '患者'}。`}</h1>
        <p>{summary?.header?.statusText || '正在同步工作台状态。'}</p>
      </section>

      <section className="tg-stat-strip">
        {(summary?.stats || []).map((item) => (
          <Stat key={item.label} label={item.label} value={item.value} unit={item.unit} />
        ))}
      </section>

      <section className="tg-chart-section">
        <div className="tg-section-head">
          <h2>过去 24 小时</h2>
          <div>
            <span>
              <Dot tone="accent" /> 震颤 RMS
            </span>
            <span>
              <Dot tone="good" /> 服药
            </span>
          </div>
        </div>
        <div className="tg-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="tgTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(15, 23, 42, 0.08)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#737373' }} interval={3} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#737373' }} axisLine={false} tickLine={false} width={34} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid rgba(15, 23, 42, 0.12)' }} />
              <Area type="monotone" dataKey="intensity" stroke="#1d4ed8" strokeWidth={2} fill="url(#tgTrendFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {!hasData ? <EmptyLine>暂无真实监测数据。设备上传后这里会显示趋势。</EmptyLine> : null}
      </section>

      <QuoteBlock
        eyebrow="智能洞察"
        title={summary?.insights?.summary || '暂无足够数据生成趋势解读。'}
        body={summary?.insights?.clinicalSuggestion || '完成设备采集后，AI 解读会基于当前用户数据生成。'}
      />

      <section className="tg-list-section">
        <h2>今日服药</h2>
        {medications.length ? (
          <div className="tg-line-list">
            {medications.map((item, index) => (
              <div key={`${item.time}-${index}`} className="tg-line-row">
                <div>
                  <Dot tone={item.status === 'done' ? 'good' : 'warn'} />
                  <span>
                    <strong>{item.medication}</strong>
                    <small>{item.dosage || '未填写剂量'}</small>
                  </span>
                </div>
                <span>
                  已记录 · {item.time}
                  <Check size={14} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyLine>暂无今日用药记录。</EmptyLine>
        )}
      </section>

      <div className="tg-action-row">
        <PillButton primary onClick={() => onNav('chat')}>
          与 AI 医生沟通
          <Sparkles size={14} />
        </PillButton>
        <PillButton onClick={onMedication}>
          服药打卡
          <Plus size={14} />
        </PillButton>
        <PillButton onClick={onPlan}>
          生成康复计划
          <HeartPulse size={14} />
        </PillButton>
        <PillButton onClick={onReport}>
          生成报告
          <FileText size={14} />
        </PillButton>
        <button className="tg-refresh" type="button" onClick={onRefresh} title="刷新数据">
          <RefreshCcw size={16} />
        </button>
        <span className="tg-device-state">
          <Dot tone={device?.connected ? 'good' : 'warn'} />
          {device?.connected ? '设备已连接' : '设备未连接'}
        </span>
      </div>
    </PageWrap>
  )
}

function Chat({ messages, input, onInput, onSubmit }) {
  return (
    <PageWrap>
      <PageTitle eyebrow="AI 医生" sub="回答基于当前账号的监测、用药和档案数据。无足够数据时，系统会明确说明数据不足。">
        数据解读入口
      </PageTitle>
      <div className="tg-chat">
        {messages.map((item, index) => (
          <div key={index} className={item.role === 'user' ? 'is-user' : 'is-ai'}>
            {item.text}
            {item.meta ? <small>{item.meta}</small> : null}
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit} className="tg-chat-form">
        <input value={input} onChange={(event) => onInput(event.target.value)} placeholder="询问今天的趋势、复诊重点或训练建议" />
        <button type="submit" title="发送">
          <Send size={18} />
        </button>
      </form>
    </PageWrap>
  )
}

function Records({ archives, form, loading, onChange, onSubmit }) {
  return (
    <PageWrap wide>
      <PageTitle eyebrow="病历档案" sub="保存病历摘要和复诊资料，用于后续 AI 解读与健康报告。">
        病历档案
      </PageTitle>
      <div className="tg-two-col">
        <form onSubmit={onSubmit} className="tg-editor-form">
          <Field label="档案标题" value={form.title} onChange={(value) => onChange('title', value)} required />
          <Field label="患者姓名" value={form.patientName} onChange={(value) => onChange('patientName', value)} />
          <Field label="备注说明" value={form.description} onChange={(value) => onChange('description', value)} multiline />
          <label className="tg-checkline">
            <input type="checkbox" checked={form.consentAccepted} onChange={(event) => onChange('consentAccepted', event.target.checked)} />
            我确认资料仅用于健康档案和复诊沟通
          </label>
          <PillButton type="submit" primary disabled={loading || !form.title || !form.consentAccepted}>
            保存档案
            <Plus size={14} />
          </PillButton>
        </form>
        <section className="tg-list-section">
          <h2>已保存档案</h2>
          {archives.length ? (
            <div className="tg-line-list">
              {archives.map((item) => (
                <div key={item.id} className="tg-line-row tg-line-row-tall">
                  <div>
                    <Dot tone="accent" />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.description || '无备注'}</small>
                    </span>
                  </div>
                  <span>{formatDate(item.updatedAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine>暂无病历档案。保存后会显示在这里。</EmptyLine>
          )}
        </section>
      </div>
    </PageWrap>
  )
}

function RehabPlan({ plan, onGenerate, onConfirm }) {
  const source = plan?.content?.generatedFrom
  return (
    <PageWrap>
      <PageTitle eyebrow="康复计划" sub="计划由当前数据生成，确认后才进入执行状态。">
        居家训练安排
      </PageTitle>
      {!plan ? (
        <EmptyBlock icon={HeartPulse} title="还没有康复计划" action="生成康复计划" onAction={onGenerate} />
      ) : (
        <section className="tg-rehab">
          <div className="tg-section-head">
            <div>
              <h2>{plan.title}</h2>
              <p>状态：{plan.status === 'confirmed' ? '已确认执行' : '待确认'}</p>
            </div>
            {plan.status !== 'confirmed' ? (
              <PillButton onClick={onConfirm}>
                确认执行
                <ClipboardCheck size={14} />
              </PillButton>
            ) : null}
          </div>
          <QuoteBlock eyebrow="安全提示" title={plan.content.safetyNote} />
          {source ? (
            <section className="tg-source-strip">
              <Stat label="峰值时段" value={source.peakTime || '暂无'} />
              <Stat label="峰值强度" value={source.peakRms ?? 0} unit="RMS" />
              <Stat label="有效佩戴" value={source.wearingHours ?? 0} unit="小时" />
              <Stat label="用药记录" value={source.medicationCount ?? 0} unit="次" />
            </section>
          ) : null}
          <div className="tg-plan-grid">
            {plan.content.items.map((item) => (
              <article key={item.title} className="tg-plan-item">
                <span>{item.durationMin} 分钟</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </PageWrap>
  )
}

function Reports({ reports, onGenerate, onDownload }) {
  return (
    <PageWrap wide>
      <PageTitle eyebrow="健康报告" sub="报告由当前用户数据、康复计划和监测摘要生成。">
        报告中心
      </PageTitle>
      <div className="tg-action-row tg-action-row-top">
        <PillButton primary onClick={onGenerate}>
          生成健康报告
          <FileText size={14} />
        </PillButton>
      </div>
      {reports.length === 0 ? (
        <EmptyBlock icon={FileText} title="暂无健康报告" />
      ) : (
        <div className="tg-report-list">
          {reports.map((report) => (
            <article key={report.id} className="tg-report-row">
              <div>
                <Eyebrow muted>{formatDate(report.generatedAt)}</Eyebrow>
                <h2>{report.title}</h2>
                <p>{report.content?.disclaimer || '本报告仅用于健康管理和复诊沟通。'}</p>
                <ReportContent report={report} />
              </div>
              <PillButton onClick={() => onDownload(report.id)}>
                下载 PDF
                <FileText size={14} />
              </PillButton>
            </article>
          ))}
        </div>
      )}
    </PageWrap>
  )
}

function ReportContent({ report }) {
  const sections = report.content?.sections || []
  const stats = report.content?.summary?.stats || []

  return (
    <div className="tg-report-content">
      {stats.length ? (
        <div className="tg-report-metrics">
          {stats.map((item) => (
            <Stat key={item.label} label={item.label} value={item.value} unit={item.unit} />
          ))}
        </div>
      ) : null}
      {sections.map((section) => (
        <section key={section.title} className="tg-report-section">
          <h3>{section.title}</h3>
          <p>{section.body}</p>
          {section.metrics?.length ? (
            <div className="tg-report-mini-metrics">
              {section.metrics.map((metric) => (
                <span key={metric.label}>
                  {metric.label}：{metric.value}{metric.unit}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  )
}

function Account({ user, device, onLogout }) {
  return (
    <PageWrap>
      <PageTitle eyebrow="个人资料" sub="账号信息、设备绑定与同步状态。">
        我的账号
      </PageTitle>
      <section className="tg-account-grid">
        <InfoLine icon={User} label="账号" value={user.email} />
        <InfoLine icon={Watch} label="设备" value={device?.serialNumber || '未绑定'} />
        <InfoLine icon={BatteryMedium} label="电量" value={`${device?.batteryPercent ?? 0}%`} />
        <InfoLine icon={Link2} label="最后同步" value={device?.lastHeartbeatAt ? formatDate(device.lastHeartbeatAt, true) : '暂无'} />
      </section>
      <div className="tg-action-row">
        <PillButton onClick={onLogout}>
          退出登录
          <LogOut size={14} />
        </PillButton>
      </div>
    </PageWrap>
  )
}

function Brand() {
  return (
    <div className="tg-brand">
      <div>
        <Activity size={18} />
      </div>
      <span>
        <strong>震颤卫士</strong>
        <small>TREMOR GUARD</small>
      </span>
    </div>
  )
}

function PageWrap({ children, wide }) {
  return <div className={wide ? 'tg-page tg-page-wide' : 'tg-page tg-page-narrow'}>{children}</div>
}

function PageTitle({ children, eyebrow, sub }) {
  return (
    <header className="tg-page-title">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h1>{children}</h1>
      {sub ? <p>{sub}</p> : null}
    </header>
  )
}

function Eyebrow({ children, muted }) {
  return <div className={muted ? 'tg-eyebrow is-muted' : 'tg-eyebrow'}>{children}</div>
}

function Stat({ label, value, unit }) {
  return (
    <div className="tg-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {unit ? <small>{unit}</small> : null}
    </div>
  )
}

function QuoteBlock({ eyebrow, title, body }) {
  return (
    <section className="tg-quote">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {title ? <h2>{title}</h2> : null}
      {body ? <p>{body}</p> : null}
    </section>
  )
}

function Field({ label, type = 'text', value, onChange, required, multiline }) {
  const Input = multiline ? 'textarea' : 'input'
  return (
    <label className="tg-field">
      <span>{label}</span>
      <Input
        type={multiline ? undefined : type}
        value={value || ''}
        required={required}
        rows={multiline ? 4 : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function PillButton({ children, onClick, primary, type = 'button', disabled }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={primary ? 'tg-pill is-primary' : 'tg-pill'}
    >
      {children}
    </button>
  )
}

function Notice({ tone, children }) {
  return <div className={tone === 'error' ? 'tg-notice is-error' : 'tg-notice'}>{children}</div>
}

function EmptyLine({ children }) {
  return <p className="tg-empty-line">{children}</p>
}

function EmptyBlock({ icon: Icon, title, action, onAction }) {
  return (
    <section className="tg-empty-block">
      {React.createElement(Icon, { size: 30 })}
      <p>{title}</p>
      {action ? (
        <PillButton primary onClick={onAction}>
          {action}
        </PillButton>
      ) : null}
    </section>
  )
}

function InfoLine({ icon: Icon, label, value }) {
  return (
    <div className="tg-info-line">
      <span>
        {React.createElement(Icon, { size: 16 })}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  )
}

function Dot({ tone = 'neutral' }) {
  return <i className={`tg-dot tg-dot-${tone}`} />
}

function formatDate(value, withTime = false) {
  if (!value) return '暂无'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

export default App
