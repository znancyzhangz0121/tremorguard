import React, { useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BatteryMedium,
  Bell,
  ClipboardCheck,
  ChevronRight,
  Download,
  FileText,
  HeartPulse,
  History,
  ImageUp,
  LayoutDashboard,
  Link2,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCcw,
  Send,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  Users,
  Watch,
  User,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buildApiUrl, readApiJson } from './lib/api'

const placeholderCards = {
  reports: {
    title: 'Legacy 监测摘要报告',
    description:
      '这里继续保留原有的监测摘要报告中心。新的长期病历档案与联合健康报告请前往“病历档案”页查看。',
    points: ['保留既有监测摘要能力', '不与病历联合报告混用', '继续附带合规免责声明'],
  },
}

const defaultCaseForm = {
  patientName: '',
  caseTitle: '',
  chiefComplaint: '',
  courseOfIllness: '',
  medicationHistory: '',
  visitHistory: '',
  currentConcerns: '',
}

const exampleCaseForm = {
  patientName: '张老先生',
  caseTitle: '近半年门诊复诊摘要',
  chiefComplaint: '近半年右手静止性震颤较前加重，下午 3 点后明显，步态变慢。',
  courseOfIllness:
    '3 年前确诊帕金森病，近 6 个月出现更明显的日内波动，午后药效维持时间缩短，偶有起步困难和夜间翻身费力。',
  medicationHistory:
    '目前服用左旋多巴/苄丝肼每日 3 次，服药后约 1 小时症状改善，下午 15:00 后再次出现震颤和动作迟缓。',
  visitHistory:
    '近 2 次门诊均建议继续记录波动期和步态冻结表现，家属观察到近一个月转身更慢，外出时需要更多陪护。',
  currentConcerns:
    '家属担心近期冻结发作变多，想整理复诊前重点问题，并判断下午症状回潮是否与药效消退有关。',
}

const defaultSummary = {
  patient: {
    name: '当前用户',
    displayName: '当前用户',
    id: 'TG-882910',
  },
  header: {
    greeting: '正在加载用户数据...',
    statusText: '正在从后端同步今日状态。',
  },
  stats: [],
  insights: {
    summary: '系统正在同步今日震颤分析结果。',
    clinicalSuggestion: '同步完成后将展示今日的主要观察结论。',
  },
  device: {
    status: '未连接',
    batteryLevel: 0,
  },
}

const authStorageKey = 'tremor-guard-auth'
const rememberedEmailKey = 'tremor-guard-remembered-email'

const parseStoredAuthSession = () => {
  const raw = window.localStorage.getItem(authStorageKey)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)

    if (!parsed?.token || !parsed?.user?.email) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

const defaultBindingForm = {
  deviceName: '我的震颤卫士手环',
  serialNumber: '',
  verificationCode: '',
  wearSide: 'right',
}

const defaultArchiveForm = {
  title: '',
  patientName: '',
  description: '',
  consentAccepted: true,
}

const ReportsCenterPanel = ({
  archives,
  isGeneratingReport,
  onCreatePdfReport,
  onDownloadReportPdf,
  onOpenArchive,
  onSelectReport,
  reportsCenterError,
  reportsCenterLoading,
  reportsCenterReports,
  selectedReportDetail,
}) => (
  <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">PDF Center</p>
        <h2 className="mt-2 text-2xl font-black text-slate-900">PDF 导出与报告中心</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
          这里集中展示长期病历档案生成的纵向健康报告与 PDF 下载入口。legacy
          监测摘要报告仍保留原有边界，不和这里的病历联合报告混用。
        </p>
      </div>
      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
        已生成报告 {reportsCenterReports.length} 份
      </div>
    </div>

    {reportsCenterError ? (
      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
        {reportsCenterError}
      </div>
    ) : null}

    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Output PDF</h3>
            <p className="text-xs text-slate-400">从已有病历档案直接生成新版纵向报告并准备 PDF。</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-600">
            Create PDF
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {archives.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              还没有可用档案。请先去“病历档案”页创建档案并上传病例图片。
            </div>
          ) : null}

          {archives.map((archive) => (
            <div key={archive.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{archive.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {archive.patientName} · {archive.fileCount} 张病例图片 · {archive.reportCount} 份报告
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenArchive(archive.id)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    查看档案
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreatePdfReport(archive.id)}
                    disabled={isGeneratingReport}
                    className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isGeneratingReport ? '生成中...' : '生成 PDF 报告'}
                  </button>
                </div>
              </div>

              {archive.latestReport ? (
                <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-700">
                  最新版本：{archive.latestReport.title} · {formatTimestamp(archive.latestReport.generatedAt)}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-3 text-sm text-slate-500">
                  当前还没有历史报告，首次生成后这里会显示最新 PDF 版本。
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Output PDF Files</h3>
            <p className="text-xs text-slate-400">按生成时间倒序展示所有联合健康报告。</p>
          </div>
          {reportsCenterLoading ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
              加载中
            </span>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {reportsCenterReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              还没有已生成的 PDF 报告。先从左侧选择档案创建一份。
            </div>
          ) : null}

          {reportsCenterReports.map((report) => (
            <div key={report.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{report.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {report.patientName} · {report.archiveTitle} · 生成于 {formatTimestamp(report.generatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectReport(report.id)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    查看详情
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenArchive(report.archiveId)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    查看来源档案
                  </button>
                  {report.hasPdf ? (
                    <button
                      type="button"
                      onClick={() => onDownloadReportPdf(report.id)}
                      className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Download size={14} /> 下载 PDF
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>

    {selectedReportDetail ? (
      <LongitudinalReportDetailPanel reportDetail={selectedReportDetail} />
    ) : null}
  </div>
)

const LongitudinalReportDetailPanel = ({ reportDetail }) => {
  const { report } = reportDetail
  const { content } = report

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">
              Report Detail
            </p>
            <h4 className="mt-2 text-xl font-black text-slate-900">{report.title}</h4>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              {content.cover.reportTypeLabel} · 报告编号 {content.cover.reportNumber}
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-600">
            v{report.version}
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {content.patientBasicInfo.cards.map((card) => (
            <div key={`${card.label}-${card.value}`} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                {card.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-sm font-black text-slate-900">执行摘要</h4>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm leading-7 text-slate-700">{content.executiveSummary.narrative}</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">监测亮点</p>
            <div className="mt-3 space-y-2">
              {content.executiveSummary.highlights.map((item) => (
                <div key={item} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">重点提醒</p>
            <div className="mt-3 space-y-2">
              {content.executiveSummary.cautionFlags.map((item) => (
                <div key={item} className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-amber-800">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-black text-slate-900">历史病例整理摘要</h4>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {content.historicalRecordSummary.narrative}
          </div>
          <div className="mt-4 space-y-2">
            {content.historicalRecordSummary.sourceHighlights.map((item) => (
              <div key={item} className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-black text-slate-900">监测 KPI</h4>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {content.monitoringKpis.cards.map((card) => (
              <div key={card.label} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  {card.label}
                </p>
                <p className="mt-2 text-xl font-black text-blue-700">{card.value}</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">{card.helper}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-black text-slate-900">震颤时间分布分析</h4>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {content.tremorTimeDistribution.summary}
          </div>
          <div className="mt-4 space-y-2">
            {content.tremorTimeDistribution.buckets.map((bucket) => (
              <div key={bucket.label} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                <strong>{bucket.label}</strong> · {bucket.count} 次 · 平均幅度{' '}
                {bucket.averageAmplitude.toFixed(3)}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-black text-slate-900">震颤强度分层</h4>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {content.tremorSeverity.summary}
          </div>
          <div className="mt-4 space-y-2">
            {content.tremorSeverity.bands.map((band) => (
              <div key={band.label} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                <strong>{band.label}</strong> · 阈值 {band.threshold} · {band.count} 次 · {band.share}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-black text-slate-900">用药执行与时机分析</h4>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {content.medicationAnalysis.summary}
          </div>
          <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
            总日剂量 {content.medicationAnalysis.totalDailyDose} · 用药依从率{' '}
            {content.medicationAnalysis.adherenceRate}
          </div>
          <div className="mt-4 space-y-2">
            {content.medicationAnalysis.timeline.map((item) => (
              <div key={`${item.time}-${item.status}`} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                <strong>{item.time}</strong> · {item.medication} · {item.dosage} · {item.status}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-black text-slate-900">症状-用药关联性观察</h4>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {content.symptomMedicationInterpretation.summary}
          </div>
          <div className="mt-4 space-y-2">
            {content.symptomMedicationInterpretation.observations.map((item) => (
              <div key={item} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {content.symptomMedicationInterpretation.caution}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-black text-slate-900">信息缺口与建议补充项</h4>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {content.informationGaps.summary}
          </div>
          <div className="mt-4 space-y-3">
            {content.informationGaps.items.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.whyItMatters}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">建议补充：{item.nextAction}</p>
                <p className="mt-2 text-sm leading-6 text-blue-700">复诊提问：{item.followUpQuestion}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-sm font-black text-slate-900">复诊准备清单</h4>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">复诊携带与沟通重点</p>
              <div className="mt-2 space-y-2">
                {content.followUpChecklist.visitChecklist.map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">居家继续观察</p>
              <div className="mt-2 space-y-2">
                {content.followUpChecklist.homeObservationChecklist.map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">建议主动提问</p>
              <div className="mt-2 space-y-2">
                {content.followUpChecklist.clinicianQuestions.map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-sm font-black text-slate-900">结论</h4>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
          {content.conclusion}
        </div>
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-700">
          {content.disclaimerBlocks.conclusion}
        </div>
      </div>
    </div>
  )
}

const formatTimestamp = (value) => {
  if (!value) {
    return '暂无'
  }

  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const readFileAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = String(reader.result ?? '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }

    reader.onerror = () => reject(new Error(`${file.name} 读取失败`))
    reader.readAsDataURL(file)
  })

const MedicalRecordsPanel = ({
  archiveDetail,
  archiveForm,
  archives,
  defaultPatientName,
  isCreatingArchive,
  isGeneratingReport,
  isUploadingFiles,
  onArchiveFieldChange,
  onCreateArchive,
  onDownloadReportPdf,
  onGenerateReport,
  onRefreshArchives,
  onSelectArchive,
  onSelectReport,
  onUploadFiles,
  recordsError,
  recordsLoading,
  recordsPolicy,
  selectedArchiveId,
  selectedReportDetail,
}) => (
  <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">
          Medical Records
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-900">长期病历档案与纵向健康报告</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
          这里保存历史病例图片、抽取摘要和纵向报告版本。它和 legacy
          的监测摘要报告中心严格分离，主要服务于复诊前的长期资料整理。
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRefreshArchives}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <span className="inline-flex items-center gap-2">
            <RefreshCcw size={16} /> 刷新档案
          </span>
        </button>
        <button
          type="button"
          onClick={onCreateArchive}
          disabled={isCreatingArchive}
          className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="inline-flex items-center gap-2">
            <Plus size={16} /> {isCreatingArchive ? '创建中...' : '创建新档案'}
          </span>
        </button>
      </div>
    </div>

    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">新建病历档案</h3>
              <p className="text-xs text-slate-400">
                首期采用私有本地文件存储。上传前需确认资料仅用于健康档案和复诊沟通。
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500">
              Brownfield V1
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">档案标题</span>
              <input
                type="text"
                value={archiveForm.title}
                onChange={(event) => onArchiveFieldChange('title', event.target.value)}
                placeholder="例如：父亲历史病例档案"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">患者称呼</span>
              <input
                type="text"
                value={archiveForm.patientName}
                onChange={(event) => onArchiveFieldChange('patientName', event.target.value)}
                placeholder={defaultPatientName || '请输入患者姓名'}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">档案说明</span>
              <textarea
                rows={4}
                value={archiveForm.description}
                onChange={(event) => onArchiveFieldChange('description', event.target.value)}
                placeholder="补充这些图片来自哪段病程、准备整理哪些材料，以及这次复诊最想澄清什么。"
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              <input
                type="checkbox"
                checked={archiveForm.consentAccepted}
                onChange={(event) => onArchiveFieldChange('consentAccepted', event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-amber-300"
              />
              <span>
                我确认这些历史病例图片仅用于个人健康档案、纵向报告生成和复诊沟通，
                不会被系统包装成诊断、分期、处方或药量调整结论。
              </span>
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">档案列表</h3>
              <p className="text-xs text-slate-400">点击任一档案查看图片摘要、报告历史和导出入口。</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-600">
              {archives.length} 份档案
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {archives.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                还没有病历档案。先在上方创建一个长期档案，再上传历史病例图片。
              </div>
            ) : null}

            {archives.map((archive) => (
              <button
                key={archive.id}
                type="button"
                onClick={() => onSelectArchive(archive.id)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  selectedArchiveId === archive.id
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{archive.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {archive.patientName} · 创建于 {formatTimestamp(archive.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500">
                    {archive.fileCount} 图 / {archive.reportCount} 报告
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {archive.description || '当前未补充档案说明。'}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">
            Governance
          </p>
          <h3 className="mt-3 text-xl font-black">非诊断边界与数据治理</h3>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <p>{recordsPolicy?.consentPolicy}</p>
            <p>{recordsPolicy?.retentionPolicy}</p>
            <p>{recordsPolicy?.exportPolicy}</p>
          </div>
        </div>

        {recordsError ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {recordsError}
          </div>
        ) : null}

        {recordsLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
            正在同步长期病历档案...
          </div>
        ) : null}

        {!recordsLoading && !archiveDetail ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm leading-7 text-slate-500 shadow-sm">
            从左侧选择一个档案后，这里会展示病例图片摘要、抽取状态、纵向报告版本和 PDF 导出入口。
          </div>
        ) : null}

        {archiveDetail ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">
                    Archive Detail
                  </p>
                  <h3 className="mt-2 text-xl font-black text-slate-900">
                    {archiveDetail.archive.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {archiveDetail.archive.description || '当前未补充档案说明。'}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">患者</p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {archiveDetail.archive.patientName}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">最后更新</p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {formatTimestamp(archiveDetail.archive.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  <ImageUp size={16} />
                  {isUploadingFiles ? '上传中...' : '追加病例图片'}
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      onUploadFiles(event.target.files)
                      event.target.value = ''
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={onGenerateReport}
                  disabled={isGeneratingReport}
                  className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isGeneratingReport ? '生成中...' : '生成新版纵向报告'}
                </button>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h4 className="text-sm font-black text-slate-900">病例图片与抽取状态</h4>
                <div className="mt-4 space-y-3">
                  {archiveDetail.files.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      当前还没有病例图片。上传后这里会显示抽取摘要、失败原因和后续可复用线索。
                    </div>
                  ) : null}

                  {archiveDetail.files.map((file) => (
                    <div key={file.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{file.fileName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {file.mimeType} · {Math.round(file.sizeBytes / 1024)} KB · 上传于{' '}
                            {formatTimestamp(file.uploadedAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            file.status === 'succeeded'
                              ? 'bg-emerald-100 text-emerald-700'
                              : file.status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {file.status}
                        </span>
                      </div>

                      {file.extraction ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                            {file.extraction.summaryTitle}
                          </p>
                          <div className="space-y-2">
                            {file.extraction.extractedFacts.map((item) => (
                              <div
                                key={item}
                                className="rounded-2xl bg-white px-3 py-2 text-sm leading-6 text-slate-700"
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                          {file.extraction.uncertaintyNotes.length > 0 ? (
                            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-3 text-xs leading-6 text-amber-700">
                              {file.extraction.uncertaintyNotes.join(' ')}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {file.errorSummary ? (
                        <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-600">
                          {file.errorSummary}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h4 className="text-sm font-black text-slate-900">纵向报告版本历史</h4>
                  <div className="mt-4 space-y-3">
                    {archiveDetail.reports.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        当前还没有纵向报告。上传历史病例图片后，点击“生成新版纵向报告”即可创建第一版。
                      </div>
                    ) : null}

                    {archiveDetail.reports.map((report) => (
                      <div
                        key={report.id}
                        className={`rounded-2xl border p-4 ${
                          selectedReportDetail?.report?.id === report.id
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-slate-100 bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{report.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              版本 v{report.version} · {formatTimestamp(report.generatedAt)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onSelectReport(report.id)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                            >
                              查看详情
                            </button>
                            {report.hasPdf ? (
                              <button
                                type="button"
                                onClick={() => onDownloadReportPdf(report.id)}
                                className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Download size={14} /> PDF
                                </span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedReportDetail ? (
                  <LongitudinalReportDetailPanel reportDetail={selectedReportDetail} />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  </div>
)

const RehabPlanPanel = () => (
  <div className="mx-auto max-w-6xl space-y-6">
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">
        Rehab Program
      </p>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">康复计划</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
            这份计划以“轻量、规律、居家可执行”为主，帮助患者稳定完成上肢活动、步态训练与呼吸放松。建议在症状相对平稳、家属可陪同的时间段进行。
          </p>
        </div>
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          今日建议训练总时长：20 到 30 分钟
        </div>
      </div>
    </div>

    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <HeartPulse size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">今日训练安排</h3>
            <p className="text-xs text-slate-400">建议按顺序完成，动作之间休息 30 到 60 秒。</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            {
              title: '热身与关节激活',
              duration: '5 分钟',
              detail: '坐姿或站姿做肩颈放松、腕关节绕环、肘关节屈伸和深呼吸，让身体先进入稳定节奏。',
            },
            {
              title: '上肢幅度训练',
              duration: '6 分钟',
              detail: '双手做大幅度抬臂、前伸、开合和握拳伸指，重点关注动作做大、做慢、做完整。',
            },
            {
              title: '步态与转身训练',
              duration: '8 分钟',
              detail: '在安全空间中练习抬腿迈步、刻意摆臂、原地转身和跨步启动，必要时家属在侧旁保护。',
            },
            {
              title: '平衡与放松收尾',
              duration: '5 分钟',
              detail: '靠近墙面完成站立重心转移、脚跟脚尖交替和呼吸放松，避免训练结束后突然坐下。',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-500">
                  {item.duration}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Weekly Focus</p>
          <h3 className="mt-3 text-xl font-black">本周目标</h3>
          <div className="mt-5 space-y-3">
            {[
              '本周至少完成 5 天训练，每次不低于 20 分钟。',
              '重点观察下午药效回落前后的步态变化和疲劳程度。',
              '训练前后各记录一次震颤、僵硬或动作迟缓的主观感受。',
              '如出现明显头晕、胸闷、跌倒风险增高，立即停止训练。',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900">每周安排建议</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ['周一', '上肢幅度 + 步态训练'],
              ['周二', '平衡训练 + 呼吸放松'],
              ['周三', '上肢幅度 + 转身启动'],
              ['周四', '轻量步行 + 放松恢复'],
              ['周五', '步态训练 + 平衡巩固'],
              ['周末', '家属陪同复盘一周表现'],
            ].map(([day, task]) => (
              <div key={day} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{day}</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">{task}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-700">
          康复计划仅用于居家训练参考。若近期频繁跌倒、冻结明显加重、血压波动或训练后不适，请暂停训练并咨询医生或康复治疗师。
        </div>
      </section>
    </div>
  </div>
)

const AccountPanel = ({
  bindingError,
  bindingForm,
  currentUser,
  deviceBinding,
  isBindingDevice,
  onBindingFieldChange,
  onDisconnectDevice,
  onSaveDevice,
}) => (
  <div className="mx-auto max-w-6xl space-y-6">
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">User Center</p>
        <h2 className="mt-2 text-2xl font-black text-slate-900">账号与设备</h2>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          登录用户会默认读取当前账号下已经保存的设备绑定信息。如果需要更换手环、断开连接或重新绑定，都可以在这里处理。
        </p>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">账号姓名</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{currentUser?.name || '未登录用户'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">账号邮箱</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{currentUser?.email || '-'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">账号年龄</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {currentUser?.age ? `${currentUser.age} 岁` : '未填写'}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">当前设备状态</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {deviceBinding?.connected
                ? `已连接 · ${deviceBinding.deviceName}`
                : '当前账号暂未连接设备'}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">设备管理</h3>
            <p className="text-xs text-slate-400">这里支持首次绑定、换绑、重连和断开当前账号设备。</p>
          </div>
          {deviceBinding ? (
            <button
              type="button"
              onClick={onDisconnectDevice}
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100"
            >
              断开设备
            </button>
          ) : null}
        </div>

        <form className="mt-6 space-y-5" onSubmit={onSaveDevice}>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">设备名称</span>
            <input
              type="text"
              value={bindingForm.deviceName}
              onChange={(event) => onBindingFieldChange('deviceName', event.target.value)}
              placeholder="例如：父亲的震颤卫士手环"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">设备序列号</span>
            <input
              type="text"
              value={bindingForm.serialNumber}
              onChange={(event) => onBindingFieldChange('serialNumber', event.target.value)}
              placeholder="例如：TG-ESP-240618"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm uppercase outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">设备校验码</span>
            <input
              type="text"
              value={bindingForm.verificationCode}
              onChange={(event) => onBindingFieldChange('verificationCode', event.target.value)}
              placeholder="例如：638214"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">佩戴侧</span>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '右手佩戴', value: 'right' },
                { label: '左手佩戴', value: 'left' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onBindingFieldChange('wearSide', option.value)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    bindingForm.wearSide === option.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </label>

          {bindingError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {bindingError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isBindingDevice}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isBindingDevice
              ? '保存中...'
              : deviceBinding?.connected
                ? '保存并更新设备'
                : '绑定设备'}
            <Link2 size={18} />
          </button>
        </form>
      </section>
    </div>
  </div>
)

const renderInlineMarkdown = (text, keyPrefix) => {
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g).filter(Boolean)

  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`

    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={key}>{token.slice(2, -2)}</strong>
    }

    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={key}
          className="rounded bg-slate-900/10 px-1.5 py-0.5 font-mono text-[0.95em]"
        >
          {token.slice(1, -1)}
        </code>
      )
    }

    const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/)
    if (linkMatch) {
      return (
        <a
          key={key}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-600 underline underline-offset-2"
        >
          {linkMatch[1]}
        </a>
      )
    }

    return <React.Fragment key={key}>{token}</React.Fragment>
  })
}

const renderMarkdownMessage = (text) => {
  const segments = text.split(/(```[\s\S]*?```)/g).filter(Boolean)

  return segments.map((segment, segmentIndex) => {
    const codeMatch = segment.match(/^```(\w+)?\n?([\s\S]*?)```$/)

    if (codeMatch) {
      return (
        <pre
          key={`code-${segmentIndex}`}
          className="my-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-100"
        >
          <code>{codeMatch[2].trim()}</code>
        </pre>
      )
    }

    const lines = segment.split('\n')
    const blocks = []
    let index = 0

    while (index < lines.length) {
      const line = lines[index].trimEnd()

      if (!line.trim()) {
        index += 1
        continue
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
      if (headingMatch) {
        const level = Math.min(headingMatch[1].length, 6)
        const HeadingTag = `h${level}`
        blocks.push(
          <HeadingTag
            key={`heading-${segmentIndex}-${index}`}
            className="mt-3 text-sm font-black text-slate-900"
          >
            {renderInlineMarkdown(headingMatch[2], `heading-${segmentIndex}-${index}`)}
          </HeadingTag>,
        )
        index += 1
        continue
      }

      if (/^[-*]\s+/.test(line)) {
        const items = []

        while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
          const itemText = lines[index].trim().replace(/^[-*]\s+/, '')
          items.push(
            <li key={`ul-${segmentIndex}-${index}`} className="ml-5 list-disc">
              {renderInlineMarkdown(itemText, `ul-${segmentIndex}-${index}`)}
            </li>,
          )
          index += 1
        }

        blocks.push(
          <ul key={`ul-wrap-${segmentIndex}-${index}`} className="my-2 space-y-1">
            {items}
          </ul>,
        )
        continue
      }

      if (/^\d+\.\s+/.test(line)) {
        const items = []

        while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
          const itemText = lines[index].trim().replace(/^\d+\.\s+/, '')
          items.push(
            <li key={`ol-${segmentIndex}-${index}`} className="ml-5 list-decimal">
              {renderInlineMarkdown(itemText, `ol-${segmentIndex}-${index}`)}
            </li>,
          )
          index += 1
        }

        blocks.push(
          <ol key={`ol-wrap-${segmentIndex}-${index}`} className="my-2 space-y-1">
            {items}
          </ol>,
        )
        continue
      }

      const paragraphLines = [line.trim()]
      index += 1

      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^(#{1,6})\s+/.test(lines[index].trim()) &&
        !/^[-*]\s+/.test(lines[index].trim()) &&
        !/^\d+\.\s+/.test(lines[index].trim())
      ) {
        paragraphLines.push(lines[index].trim())
        index += 1
      }

      blocks.push(
        <p
          key={`p-${segmentIndex}-${index}`}
          className="my-2 whitespace-pre-wrap text-sm leading-7"
        >
          {renderInlineMarkdown(paragraphLines.join(' '), `p-${segmentIndex}-${index}`)}
        </p>,
      )
    }

    return <React.Fragment key={`segment-${segmentIndex}`}>{blocks}</React.Fragment>
  })
}

const SidebarItem = ({ activeTab, icon, id, label, onClick }) => {
  const IconComponent = icon

  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
        activeTab === id
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <IconComponent size={20} />
      <span className="font-medium">{label}</span>
    </button>
  )
}

const PlaceholderPanel = ({ description, points, title }) => (
  <div className="mx-auto max-w-4xl">
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
          <FileText size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500">当前版本先保留占位，避免导航点击后空白。</p>
        </div>
      </div>

      <p className="mb-6 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        {points.map((point) => (
          <div key={point} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-700">{point}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
)

const CaseAnalysisPanel = ({
  analysisResult,
  caseAnalysisError,
  caseForm,
  defaultPatientName,
  isAnalyzingCase,
  onAnalyzeCase,
  onCaseFieldChange,
  onLoadExampleCase,
}) => (
  <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Records Insight</p>
        <h2 className="mt-2 text-2xl font-black text-slate-900">历史病例分析</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
          把既往门诊摘要、病程变化、用药史和家属观察整理成结构化病例，系统会结合当天震颤监测结果输出复诊前重点。
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onLoadExampleCase}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          载入示例病例
        </button>
        <button
          type="button"
          onClick={onAnalyzeCase}
          disabled={isAnalyzingCase}
          className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isAnalyzingCase ? '分析中...' : '开始病例分析'}
        </button>
      </div>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">病例输入</h3>
            <p className="text-xs text-slate-400">至少填写主诉和病程经过，其他信息越完整，分析越聚焦。</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500">
            结构化整理
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">患者称呼</span>
            <input
              type="text"
              value={caseForm.patientName}
              onChange={(event) => onCaseFieldChange('patientName', event.target.value)}
              placeholder={defaultPatientName || '请输入患者姓名'}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">病例标题</span>
            <input
              type="text"
              value={caseForm.caseTitle}
              onChange={(event) => onCaseFieldChange('caseTitle', event.target.value)}
              placeholder="如：近半年门诊复诊摘要"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="mt-4 space-y-4">
          {[
            {
              id: 'chiefComplaint',
              label: '主诉',
              placeholder: '填写主要症状、明显加重时段和当前最影响生活的表现。',
            },
            {
              id: 'courseOfIllness',
              label: '病程经过',
              placeholder: '补充确诊时间、近半年变化、是否出现波动期、步态或非运动症状变化。',
            },
            {
              id: 'medicationHistory',
              label: '用药史',
              placeholder: '记录当前主要用药、每日次数、服药后改善时段和回潮时间。',
            },
            {
              id: 'visitHistory',
              label: '既往就诊记录',
              placeholder: '补充近几次门诊结论、医生提醒和家属观察到的新变化。',
            },
            {
              id: 'currentConcerns',
              label: '当前最担心的问题',
              placeholder: '例如：跌倒风险、冻结、夜间睡眠、复诊想问医生的问题等。',
            },
          ].map((field) => (
            <label key={field.id} className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">{field.label}</span>
              <textarea
                rows={field.id === 'chiefComplaint' ? 3 : 4}
                value={caseForm[field.id]}
                onChange={(event) => onCaseFieldChange(field.id, event.target.value)}
                placeholder={field.placeholder}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </label>
          ))}
        </div>

        {caseAnalysisError ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {caseAnalysisError}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">AI Follow-up</p>
          <h3 className="mt-3 text-xl font-black">复诊准备重点</h3>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            分析结果会把病例里真正值得和医生沟通的线索拎出来，减少复诊时只讲“最近更抖了”这种模糊描述。
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {['药效波动识别', '步态风险整理', '非运动症状归纳', '医生提问清单'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {analysisResult ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">Analysis Result</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900">{analysisResult.title}</h3>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-600">
                  {analysisResult.caseSnapshot.patientName}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">综合判断</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{analysisResult.overview}</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-500">病程评估</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{analysisResult.progressionAssessment}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">与监测数据的对应</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">{analysisResult.timelineCorrelation}</p>
                </div>
                {analysisResult.providerSummary ? (
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">AI 概述</p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{analysisResult.providerSummary}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-black text-slate-900">风险信号</h4>
                <div className="mt-4 space-y-3">
                  {analysisResult.riskSignals.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-sm font-bold text-slate-800">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-black text-slate-900">监测对应点</h4>
                <div className="mt-4 space-y-3">
                  {analysisResult.matchedDataPoints.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-black text-slate-900">接下来重点记录</h4>
                <div className="mt-4 space-y-3">
                  {analysisResult.monitoringFocus.map((item) => (
                    <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-black text-slate-900">复诊建议提问</h4>
                <div className="mt-4 space-y-3">
                  {analysisResult.doctorQuestions.map((item) => (
                    <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-700">
              {analysisResult.disclaimer}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm leading-7 text-slate-500 shadow-sm">
            录入或载入一份历史病例后，点击“开始病例分析”，这里会展示病程评估、风险信号、监测重点和复诊问题清单。
          </div>
        )}
      </section>
    </div>
  </div>
)

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [summary, setSummary] = useState(defaultSummary)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [authSession, setAuthSession] = useState(null)
  const [deviceBinding, setDeviceBinding] = useState(null)
  const [authStep, setAuthStep] = useState('choice')
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  })
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    age: '',
    password: '',
    confirmPassword: '',
  })
  const [bindingForm, setBindingForm] = useState(defaultBindingForm)
  const [loginError, setLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [createError, setCreateError] = useState('')
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [bindingError, setBindingError] = useState('')
  const [isBindingDevice, setIsBindingDevice] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'system',
      text: '您好，我是震颤卫士AI助手。请直接告诉我您想了解的症状变化，我会结合今天的监测数据为您解释。',
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [caseForm, setCaseForm] = useState(defaultCaseForm)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [caseAnalysisError, setCaseAnalysisError] = useState('')
  const [isAnalyzingCase, setIsAnalyzingCase] = useState(false)
  const [archiveForm, setArchiveForm] = useState(defaultArchiveForm)
  const [archives, setArchives] = useState([])
  const [recordsPolicy, setRecordsPolicy] = useState(null)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsError, setRecordsError] = useState('')
  const [reportsCenterReports, setReportsCenterReports] = useState([])
  const [reportsCenterLoading, setReportsCenterLoading] = useState(false)
  const [reportsCenterError, setReportsCenterError] = useState('')
  const [selectedArchiveId, setSelectedArchiveId] = useState('')
  const [archiveDetail, setArchiveDetail] = useState(null)
  const [selectedReportDetail, setSelectedReportDetail] = useState(null)
  const [isCreatingArchive, setIsCreatingArchive] = useState(false)
  const [isUploadingFiles, setIsUploadingFiles] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(rememberedEmailKey) ?? ''
    const storedSession = parseStoredAuthSession()

    setLoginForm((prev) => ({ ...prev, email: rememberedEmail }))
    setCreateForm((prev) => ({ ...prev, email: '' }))

    if (storedSession) {
      setAuthSession(storedSession)
      setCurrentUser(storedSession.user)
      setIsAuthenticated(true)
      setAuthStep('login')
    } else {
      window.localStorage.removeItem(authStorageKey)
      setAuthSession(null)
      setIsAuthenticated(false)
      setCurrentUser(null)
    }

    setDeviceBinding(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    const loadDashboard = async () => {
      setLoading(true)

      try {
        const authHeaders = authSession?.token
          ? { Authorization: `Bearer ${authSession.token}` }
          : {}

        const [summaryResponse, timelineResponse, deviceResponse] = await Promise.all([
          fetch(buildApiUrl('/dashboard/summary'), {
            headers: authHeaders,
          }),
          fetch(buildApiUrl('/tremor/timeline')),
          fetch(buildApiUrl('/devices/me'), {
            headers: authHeaders,
          }),
        ])

        const isUnauthorized =
          [summaryResponse.status, deviceResponse.status].some((status) =>
            [401, 403].includes(status),
          )

        if (isUnauthorized) {
          clearAuthState()
          setMessages((prev) => [
            ...prev,
            {
              role: 'system',
              text: '登录状态已失效，请重新登录后继续。',
            },
          ])
          return
        }

        if (!summaryResponse.ok || !timelineResponse.ok || !deviceResponse.ok) {
          throw new Error('dashboard-load-failed')
        }

        const summaryJson = await summaryResponse.json()
        const timelineJson = await timelineResponse.json()
        const deviceJson = await deviceResponse.json()

        setSummary(summaryJson)
        setTimeline(timelineJson)
        setDeviceBinding(deviceJson.binding ?? null)
        setBindingForm(
          deviceJson.binding
            ? {
                deviceName: deviceJson.binding.deviceName,
                serialNumber: deviceJson.binding.serialNumber,
                verificationCode: deviceJson.binding.verificationCode,
                wearSide: deviceJson.binding.wearSide,
              }
            : defaultBindingForm,
        )
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            text: '后端连接失败，当前展示的内容可能不是最新数据。',
          },
        ])
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [authSession, currentUser, isAuthenticated])

  useEffect(() => {
    if (!currentUser?.name) return

    setSummary((prev) => ({
      ...prev,
      patient: {
        ...prev.patient,
        name: currentUser.name,
        displayName: currentUser.name,
      },
      header: {
        ...prev.header,
        greeting: `你好，${currentUser.name}`,
      },
    }))
  }, [currentUser])

  useEffect(() => {
    setSummary((prev) => ({
      ...prev,
      device: {
        ...prev.device,
        status: deviceBinding?.connected
          ? `已连接 · ${deviceBinding.deviceName}`
          : '未连接',
        batteryLevel: deviceBinding?.connected ? 85 : 0,
      },
    }))
  }, [deviceBinding])

  useEffect(() => {
    if (!isAuthenticated || loading) return

    setMessages((prev) => {
      if (prev.length !== 1 || prev[0].role !== 'system') {
        return prev
      }

      return [
        {
          role: 'system',
          text: `您好，${summary.patient.displayName || '用户'}。我是震颤卫士AI助手，您可以直接问我今天的震颤波动、用药时段变化，或者想让我帮您怎么整理复诊重点。`,
        },
      ]
    })
  }, [isAuthenticated, loading, summary.patient.displayName])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getAuthHeaders = (includeJson = false) => ({
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(authSession?.token ? { Authorization: `Bearer ${authSession.token}` } : {}),
  })

  const clearAuthState = () => {
    window.localStorage.removeItem(authStorageKey)
    setAuthSession(null)
    setIsAuthenticated(false)
    setCurrentUser(null)
    setDeviceBinding(null)
  }

  const loadArchives = async (preferredArchiveId) => {
    if (!authSession?.token) {
      return
    }

    setRecordsLoading(true)
    setRecordsError('')

    try {
      const response = await fetch(buildApiUrl('/medical-records/archives'), {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('病历档案列表加载失败')
      }

      const data = await readApiJson(response, '登录失败')
      setArchives(data.archives ?? [])
      setRecordsPolicy(data.policy ?? null)

      const nextArchiveId =
        preferredArchiveId ??
        (data.archives ?? []).find((archive) => archive.id === selectedArchiveId)?.id ??
        data.archives?.[0]?.id ??
        ''

      setSelectedArchiveId(nextArchiveId)

      if (nextArchiveId) {
        await loadArchiveDetail(nextArchiveId)
      } else {
        setArchiveDetail(null)
        setSelectedReportDetail(null)
      }
    } catch (error) {
      setRecordsError(error.message || '病历档案加载失败，请稍后重试。')
    } finally {
      setRecordsLoading(false)
    }
  }

  const loadReportsCenter = async () => {
    if (!authSession?.token) {
      return
    }

    setReportsCenterLoading(true)
    setReportsCenterError('')

    try {
      const response = await fetch(buildApiUrl('/medical-records/reports'), {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('报告中心加载失败')
      }

      const data = await readApiJson(response, '创建账号失败')
      setReportsCenterReports(data.reports ?? [])
      setRecordsPolicy((previous) => previous ?? data.policy ?? null)
    } catch (error) {
      setReportsCenterError(error.message || '报告中心加载失败，请稍后重试。')
    } finally {
      setReportsCenterLoading(false)
    }
  }

  const loadArchiveDetail = async (archiveId, preferredReportId) => {
    if (!authSession?.token || !archiveId) {
      return
    }

    try {
      const response = await fetch(buildApiUrl(`/medical-records/archives/${archiveId}`), {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('档案详情加载失败')
      }

      const data = await response.json()
      setArchiveDetail(data)
      setSelectedArchiveId(archiveId)
      setRecordsPolicy(data.policy ?? null)

      const nextReportId = preferredReportId ?? data.reports?.[0]?.id ?? ''
      if (nextReportId) {
        await loadReportDetail(nextReportId)
      } else {
        setSelectedReportDetail(null)
      }
    } catch (error) {
      setRecordsError(error.message || '档案详情加载失败，请稍后重试。')
    }
  }

  const loadReportDetail = async (reportId) => {
    if (!authSession?.token || !reportId) {
      return
    }

    try {
      const response = await fetch(buildApiUrl(`/medical-records/reports/${reportId}`), {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('报告详情加载失败')
      }

      const data = await response.json()
      setSelectedReportDetail(data)
    } catch (error) {
      const message = error.message || '报告详情加载失败，请稍后重试。'
      setRecordsError(message)
      setReportsCenterError(message)
    }
  }

  useEffect(() => {
    if (activeTab !== 'records' || !isAuthenticated) return

    loadArchives()
    // loadArchives intentionally stays outside the dependency list so records
    // refresh is tied to auth/tab changes instead of every local state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, authSession?.token, isAuthenticated])

  useEffect(() => {
    if (activeTab !== 'reports' || !isAuthenticated) return

    loadArchives()
    loadReportsCenter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, authSession?.token, isAuthenticated])

  const handleSendMessage = async () => {
    const message = inputValue.trim()

    if (!message || isSending) return

    setMessages((prev) => [...prev, { role: 'user', text: message }])
    setInputValue('')
    setIsSending(true)

    try {
      const response = await fetch(buildApiUrl('/ai/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      })

      const data = await response.json()
      setMessages((prev) => [...prev, { role: 'ai', text: data.text }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: '当前无法连接后端 AI 服务，请稍后重试。' },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleMedicationCheckIn = async () => {
    if (isCheckingIn) return

    setIsCheckingIn(true)

    try {
      const response = await fetch(buildApiUrl('/medication/check-in'), {
        method: 'POST',
        headers: authSession?.token
          ? { Authorization: `Bearer ${authSession.token}` }
          : {},
      })
      const data = await response.json()

      setMessages((prev) => [
        ...prev,
        { role: 'system', text: data.message ?? '服药打卡已提交。' },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'system', text: '服药打卡提交失败，请检查后端服务是否运行。' },
      ])
    } finally {
      setIsCheckingIn(false)
    }
  }

  const handleCaseFieldChange = (field, value) => {
    setCaseForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleLoadExampleCase = () => {
    setCaseAnalysisError('')
    setCaseForm(exampleCaseForm)
  }

  const handleAnalyzeCase = async () => {
    if (isAnalyzingCase) return

    if (!caseForm.chiefComplaint.trim() || !caseForm.courseOfIllness.trim()) {
      setCaseAnalysisError('请至少填写主诉和病程经过后再开始分析。')
      return
    }

    setIsAnalyzingCase(true)
    setCaseAnalysisError('')

    try {
      const response = await fetch(buildApiUrl('/ai/case-analysis'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caseForm),
      })

      if (!response.ok) {
        throw new Error('病例分析接口调用失败')
      }

      const data = await response.json()
      setAnalysisResult(data)
      setActiveTab('records')
    } catch {
      setCaseAnalysisError('当前无法完成病例分析，请确认后端服务已启动后重试。')
    } finally {
      setIsAnalyzingCase(false)
    }
  }

  const handleArchiveFieldChange = (field, value) => {
    setArchiveForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreateArchive = async () => {
    if (isCreatingArchive) return

    if (!archiveForm.title.trim() || !archiveForm.patientName.trim()) {
      setRecordsError('请先填写档案标题和患者称呼。')
      return
    }

    if (!archiveForm.consentAccepted) {
      setRecordsError('创建档案前请先确认历史病例上传授权说明。')
      return
    }

    setIsCreatingArchive(true)
    setRecordsError('')

    try {
      const response = await fetch(buildApiUrl('/medical-records/archives'), {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(archiveForm),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '创建病历档案失败')
      }

      setArchiveForm(defaultArchiveForm)
      await loadArchives(data.archive.id)
    } catch (error) {
      setRecordsError(error.message || '创建病历档案失败，请稍后重试。')
    } finally {
      setIsCreatingArchive(false)
    }
  }

  const handleSelectArchive = async (archiveId) => {
    setRecordsError('')
    await loadArchiveDetail(archiveId)
  }

  const handleUploadArchiveFiles = async (fileList) => {
    if (isUploadingFiles || !selectedArchiveId) return

    const files = Array.from(fileList ?? [])

    if (files.length === 0) {
      return
    }

    setIsUploadingFiles(true)
    setRecordsError('')

    try {
      const payloadFiles = await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          mimeType: file.type || 'image/jpeg',
          contentBase64: await readFileAsBase64(file),
          note: '',
        })),
      )

      const response = await fetch(
        buildApiUrl(`/medical-records/archives/${selectedArchiveId}/files`),
        {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            files: payloadFiles,
          }),
        },
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '病例图片上传失败')
      }

      await loadArchiveDetail(selectedArchiveId)
    } catch (error) {
      setRecordsError(error.message || '病例图片上传失败，请稍后重试。')
    } finally {
      setIsUploadingFiles(false)
    }
  }

  const handleGenerateLongitudinalReport = async () => {
    if (isGeneratingReport || !selectedArchiveId) return

    setIsGeneratingReport(true)
    setRecordsError('')

    try {
      const response = await fetch(
        buildApiUrl(`/medical-records/archives/${selectedArchiveId}/reports`),
        {
          method: 'POST',
          headers: getAuthHeaders(true),
          body: JSON.stringify({}),
        },
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '纵向报告生成失败')
      }

      await loadArchiveDetail(selectedArchiveId, data.report?.id)
    } catch (error) {
      setRecordsError(error.message || '纵向报告生成失败，请稍后重试。')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleGenerateLongitudinalReportForArchive = async (archiveId) => {
    if (isGeneratingReport || !archiveId) return

    setIsGeneratingReport(true)
    setReportsCenterError('')
    setRecordsError('')

    try {
      const response = await fetch(buildApiUrl(`/medical-records/archives/${archiveId}/reports`), {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({}),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? 'PDF 报告生成失败')
      }

      await Promise.all([loadArchives(archiveId), loadReportsCenter()])
    } catch (error) {
      const message = error.message || 'PDF 报告生成失败，请稍后重试。'
      setReportsCenterError(message)
      setRecordsError(message)
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleOpenArchiveFromReports = async (archiveId) => {
    setActiveTab('records')
    await loadArchives(archiveId)
  }

  const handleDownloadReportPdf = async (reportId) => {
    if (!authSession?.token) return

    try {
      const response = await fetch(buildApiUrl(`/medical-records/reports/${reportId}/pdf`), {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error('PDF 下载失败')
      }

      const blob = await response.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = `longitudinal-report-${reportId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)
    } catch (error) {
      const message = error.message || 'PDF 下载失败，请稍后重试。'
      setRecordsError(message)
      setReportsCenterError(message)
    }
  }

  const handleLoginSubmit = async (event) => {
    event.preventDefault()

    const email = loginForm.email.trim()
    const password = loginForm.password.trim()

    if (!email || !password) {
      setLoginError('请输入邮箱和密码后再登录。')
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setLoginError('请输入有效的邮箱地址。')
      return
    }

    if (password.length < 6) {
      setLoginError('密码长度至少需要 6 位。')
      return
    }

    setIsLoggingIn(true)
    setLoginError('')

    try {
      const response = await fetch(buildApiUrl('/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '登录失败')
      }

      const nextSession = {
        token: data.token,
        user: data.user,
      }

      window.localStorage.setItem(authStorageKey, JSON.stringify(nextSession))
      window.localStorage.setItem(rememberedEmailKey, email)
      setAuthSession(nextSession)
      setCurrentUser(data.user)
      setIsAuthenticated(true)
      setLoginForm({ email, password: '' })
    } catch (error) {
      setLoginError(error.message || '登录失败，请稍后重试。')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleCreateAccount = async (event) => {
    event.preventDefault()

    const name = createForm.name.trim()
    const email = createForm.email.trim()
    const age = Number(createForm.age)
    const password = createForm.password.trim()
    const confirmPassword = createForm.confirmPassword.trim()

    if (!name || !email || !createForm.age || !password || !confirmPassword) {
      setCreateError('请先完整填写姓名、邮箱、年龄和密码。')
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setCreateError('请输入有效的邮箱地址。')
      return
    }

    if (password.length < 6) {
      setCreateError('密码长度至少需要 6 位。')
      return
    }

    if (!Number.isInteger(age) || age < 1 || age > 120) {
      setCreateError('请选择有效年龄后再继续。')
      return
    }

    if (password !== confirmPassword) {
      setCreateError('两次输入的密码不一致。')
      return
    }

    const serialNumber = bindingForm.serialNumber.trim().toUpperCase()
    const verificationCode = bindingForm.verificationCode.trim()

    if (!serialNumber || serialNumber.length < 6) {
      setCreateError('创建账号时请一并填写有效的设备序列号。')
      return
    }

    if (!verificationCode) {
      setCreateError('创建账号时请填写设备校验码。')
      return
    }

    setCreateError('')
    setIsCreatingAccount(true)

    try {
      const response = await fetch(buildApiUrl('/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, age, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '创建账号失败')
      }

      const nextSession = {
        token: data.token,
        user: data.user,
      }

      window.localStorage.setItem(authStorageKey, JSON.stringify(nextSession))
      window.localStorage.setItem(rememberedEmailKey, email)
      setAuthSession(nextSession)
      setCurrentUser(data.user)
      const bindResponse = await fetch(buildApiUrl('/devices/bind'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({
          deviceName: bindingForm.deviceName.trim() || '我的震颤卫士手环',
          serialNumber,
          verificationCode,
          wearSide: bindingForm.wearSide,
        }),
      })
      const bindData = await readApiJson(bindResponse, '账号创建成功，但设备绑定失败')

      if (!bindResponse.ok) {
        throw new Error(bindData.message ?? '账号创建成功，但设备绑定失败')
      }

      setDeviceBinding(bindData.binding)
      setLoginForm({ email, password: '' })
      setCreateForm({
        name: '',
        email: '',
        age: '',
        password: '',
        confirmPassword: '',
      })
      setIsAuthenticated(true)
    } catch (error) {
      window.localStorage.removeItem(authStorageKey)
      setAuthSession(null)
      setCurrentUser(null)
      setDeviceBinding(null)
      setCreateError(error.message || '创建账号失败，请稍后重试。')
    } finally {
      setIsCreatingAccount(false)
    }
  }

  const handleBindingFieldChange = (field, value) => {
    setBindingForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleBindDevice = async (event) => {
    event.preventDefault()

    if (!currentUser?.email) {
      setBindingError('当前未识别到登录账号，请重新登录后再绑定设备。')
      return
    }

    const serialNumber = bindingForm.serialNumber.trim().toUpperCase()
    const verificationCode = bindingForm.verificationCode.trim()

    if (!serialNumber) {
      setBindingError('请输入设备序列号后再继续。')
      return
    }

    if (serialNumber.length < 6) {
      setBindingError('设备序列号至少需要 6 位。')
      return
    }

    if (!verificationCode) {
      setBindingError('请输入设备校验码。')
      return
    }

    setIsBindingDevice(true)
    setBindingError('')

    try {
      const response = await fetch(buildApiUrl('/devices/bind'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authSession?.token
            ? { Authorization: `Bearer ${authSession.token}` }
            : {}),
        },
        body: JSON.stringify({
          deviceName: bindingForm.deviceName.trim() || '我的震颤卫士手环',
          serialNumber,
          verificationCode,
          wearSide: bindingForm.wearSide,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '设备绑定失败')
      }

      setDeviceBinding(data.binding)
    } catch (error) {
      setBindingError(error.message || '设备绑定失败，请稍后重试。')
    } finally {
      setIsBindingDevice(false)
    }
  }

  const handleDisconnectDevice = async () => {
    if (!currentUser?.email) return

    setIsBindingDevice(true)
    setBindingError('')

    try {
      const response = await fetch(buildApiUrl('/devices/disconnect'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authSession?.token
            ? { Authorization: `Bearer ${authSession.token}` }
            : {}),
        },
        body: JSON.stringify({}),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message ?? '设备断开失败')
      }

      setDeviceBinding(data.binding ?? null)
      setBindingForm(defaultBindingForm)
    } catch (error) {
      setBindingError(error.message || '设备断开失败，请稍后重试。')
    } finally {
      setIsBindingDevice(false)
    }
  }

  const handleLogout = () => {
    clearAuthState()
    setActiveTab('dashboard')
    setLoading(false)
    setSummary(defaultSummary)
    setTimeline([])
    setInputValue('')
    setLoginError('')
    setCreateError('')
    setIsCreatingAccount(false)
    setAuthStep('choice')
    setCaseForm(defaultCaseForm)
    setAnalysisResult(null)
    setCaseAnalysisError('')
    setArchiveForm(defaultArchiveForm)
    setArchives([])
    setRecordsPolicy(null)
    setRecordsLoading(false)
    setRecordsError('')
    setReportsCenterReports([])
    setReportsCenterLoading(false)
    setReportsCenterError('')
    setSelectedArchiveId('')
    setArchiveDetail(null)
    setSelectedReportDetail(null)
    setIsCreatingArchive(false)
    setIsUploadingFiles(false)
    setIsGeneratingReport(false)
    setBindingError('')
    setIsBindingDevice(false)
    setBindingForm(defaultBindingForm)
    setMessages([
      {
        role: 'system',
        text: '您好，我是震颤卫士AI助手。当前消息已通过后端服务接管，您可以直接开始咨询。',
      },
    ])
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-900">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute left-[-8rem] top-[-6rem] h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute bottom-[-8rem] right-[-4rem] h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />
        </div>

        <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.15fr_0.85fr]">
          <section className="bg-slate-950 px-8 py-10 text-white md:px-12 md:py-14">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-900/40">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-lg font-bold">震颤卫士</p>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tremor Guard</p>
              </div>
            </div>

            <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              Account Access
            </span>
            <h1 className="mt-5 max-w-lg text-4xl font-black leading-tight md:text-5xl">
              先创建账号或登录，然后再进入设备绑定流程
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300">
              现在的入口顺序已经调整为先完成账号访问，再连接您的腕带设备，最后进入健康看板和 AI 工作台。
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                'Create / Login 账号入口',
                '登录后进入设备绑定',
                '绑定完成进入工作台',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-sm font-semibold text-white">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={18} />
                <p>
                  <strong>合规提示：</strong> 本系统为辅助监测平台，所有图表、建议与报告仅供健康管理参考，
                  不能替代执业医师诊断、处方或治疗方案。
                </p>
              </div>
            </div>
          </section>

          <section className="bg-white px-8 py-10 md:px-10 md:py-14">
            <div className="mx-auto max-w-md">
              {authStep === 'choice' ? (
                <>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
                    Access
                  </p>
                  <h2 className="mt-3 text-3xl font-black text-slate-900">先选择创建账号或登录</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    第一步先进入账号入口，完成后系统才会继续引导您绑定设备。
                  </p>

                  <div className="mt-8 space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthStep('create')
                        setLoginError('')
                      }}
                      className="flex w-full items-center justify-between rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-900">Create Account</p>
                        <p className="mt-1 text-sm text-slate-500">首次使用时先创建账号，再继续绑定设备。</p>
                      </div>
                      <UserPlus size={20} className="text-blue-600" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthStep('login')
                        setCreateError('')
                      }}
                      className="flex w-full items-center justify-between rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-900">Login</p>
                        <p className="mt-1 text-sm text-slate-500">已有账号时从这里登录，然后进入绑定或工作台。</p>
                      </div>
                      <ChevronRight size={20} className="text-slate-500" />
                    </button>
                  </div>
                </>
              ) : null}

              {authStep === 'login' ? (
                <>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
                    Sign In
                  </p>
                  <h2 className="mt-3 text-3xl font-black text-slate-900">输入邮箱和密码登录</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    登录后会自动读取当前账号已保存的设备连接状态，并直接进入工作台。
                  </p>

                  <form className="mt-8 space-y-5" onSubmit={handleLoginSubmit}>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">邮箱地址</span>
                      <input
                        type="email"
                        autoComplete="email"
                        value={loginForm.email}
                        onChange={(event) => {
                          setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                        }}
                        placeholder="name@example.com"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">密码</span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={loginForm.password}
                        onChange={(event) => {
                          setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                        }}
                        placeholder="请输入密码"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </label>

                    {loginError ? (
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {loginError}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isLoggingIn ? '登录中...' : '登录并继续'}
                      <ChevronRight size={18} />
                    </button>
                  </form>
                </>
              ) : null}

              {authStep === 'create' ? (
                <>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">
                    Create Account
                  </p>
                  <h2 className="mt-3 text-3xl font-black text-slate-900">先创建一个账号</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    创建账号时请一并填写设备信息。完成后系统会直接把设备绑定到这个新账号下。
                  </p>

                  <form className="mt-8 space-y-5" onSubmit={handleCreateAccount}>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">姓名</span>
                      <input
                        type="text"
                        autoComplete="name"
                        value={createForm.name}
                        onChange={(event) => {
                          setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                        }}
                        placeholder="请输入您的真实姓名"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">年龄</span>
                      <select
                        value={createForm.age}
                        onChange={(event) => {
                          setCreateForm((prev) => ({ ...prev, age: event.target.value }))
                        }}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      >
                        <option value="">请选择年龄</option>
                        {Array.from({ length: 120 }, (_, index) => index + 1).map((ageOption) => (
                          <option key={ageOption} value={String(ageOption)}>
                            {ageOption} 岁
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">邮箱地址</span>
                      <input
                        type="email"
                        autoComplete="email"
                        value={createForm.email}
                        onChange={(event) => {
                          setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                        }}
                        placeholder="name@example.com"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">密码</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={createForm.password}
                        onChange={(event) => {
                          setCreateForm((prev) => ({ ...prev, password: event.target.value }))
                        }}
                        placeholder="至少 6 位密码"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-700">确认密码</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={createForm.confirmPassword}
                        onChange={(event) => {
                          setCreateForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                        }}
                        placeholder="再次输入密码"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>

                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">
                        Device Setup
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        新账号需要在创建时同步录入手环信息，后续登录会自动带出当前绑定设备。
                      </p>

                      <div className="mt-4 space-y-4">
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-700">设备名称</span>
                          <input
                            type="text"
                            value={bindingForm.deviceName}
                            onChange={(event) => handleBindingFieldChange('deviceName', event.target.value)}
                            placeholder="例如：妈妈的震颤卫士手环"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-700">设备序列号</span>
                          <input
                            type="text"
                            value={bindingForm.serialNumber}
                            onChange={(event) => handleBindingFieldChange('serialNumber', event.target.value)}
                            placeholder="例如：TG-ESP-240618"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-700">设备校验码</span>
                          <input
                            type="text"
                            value={bindingForm.verificationCode}
                            onChange={(event) => handleBindingFieldChange('verificationCode', event.target.value)}
                            placeholder="例如：638214"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-700">佩戴侧</span>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: '右手佩戴', value: 'right' },
                              { label: '左手佩戴', value: 'left' },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => handleBindingFieldChange('wearSide', option.value)}
                                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                                  bindingForm.wearSide === option.value
                                    ? 'border-emerald-500 bg-emerald-100 text-emerald-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </label>
                      </div>
                    </div>

                    {createError ? (
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {createError}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isCreatingAccount}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isCreatingAccount ? '创建中...' : '创建账号并继续'}
                      <ChevronRight size={18} />
                    </button>
                  </form>
                </>
              ) : null}

              <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Quick Access
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  登录用户会自动读取设备状态；新建账号时则会同步完成设备绑定。之后设备的更换、断开和重连，都统一在用户中心处理。
                </p>
                {authStep !== 'choice' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep('choice')
                      setLoginError('')
                      setCreateError('')
                    }}
                    className="mt-4 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                  >
                    返回 Create / Login 选择页
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

  const renderMainContent = () => {
    if (activeTab === 'dashboard') {
      return (
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{summary.header.greeting}</h2>
              <p className="text-sm text-slate-500">{summary.header.statusText}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('rehab')}
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <HeartPulse size={14} /> 康复计划
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('records')}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <History size={14} /> 病历档案
              </button>
              <button
                type="button"
                onClick={handleMedicationCheckIn}
                className="flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-green-100 transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isCheckingIn}
              >
                <ClipboardCheck size={14} /> {isCheckingIn ? '提交中...' : '服药打卡'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summary.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <p className="mb-1 text-xs font-medium text-slate-400">{stat.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-black ${stat.color}`}>{stat.value}</span>
                  <span className="text-xs font-normal text-slate-400">{stat.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
              <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 font-bold text-slate-800">
                    <Activity size={18} className="text-blue-600" />
                    震颤-药效联动时序分析
                  </h3>
                  <p className="text-[10px] text-slate-400">基于近24小时持续监测数据</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500" /> 震颤(RMS)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-green-500" /> 用药打卡
                  </span>
                </div>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline}>
                    <defs>
                      <linearGradient id="colorIntensity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      interval={2}
                    />
                    <YAxis hide domain={[0, 12]} />
                    <Tooltip
                      contentStyle={{
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="intensity"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      fill="url(#colorIntensity)"
                    />
                    {timeline.map((entry) =>
                      entry.isMedication ? (
                        <ReferenceLine
                          key={entry.time}
                          x={entry.time}
                          stroke="#22c55e"
                          strokeDasharray="4 4"
                          label={{ position: 'top', value: '💊', fontSize: 12 }}
                        />
                      ) : null,
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col rounded-3xl bg-blue-600 p-6 text-white shadow-xl shadow-blue-100">
              <div className="mb-6 flex items-center gap-2">
                <Zap size={20} />
                <h3 className="font-bold">智能评估洞察</h3>
              </div>
              <div className="flex-1 space-y-6">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-80">关键规律发现</p>
                  <p className="text-sm leading-relaxed">{summary.insights.summary}</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest opacity-80">临床建议建议</p>
                  <p className="text-sm leading-relaxed">{summary.insights.clinicalSuggestion}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-bold text-blue-600 shadow-lg transition-colors hover:bg-blue-50"
              >
                与 AI 医生详细沟通
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (activeTab === 'chat') {
      return (
        <div className="mx-auto flex h-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Stethoscope size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold">AI 专家坐诊</h3>
                <p className="text-[10px] font-bold uppercase text-green-500">
                  已接入后端服务
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'rounded-tr-none bg-blue-600 text-white'
                      : 'rounded-tl-none border border-slate-100 bg-slate-50 text-slate-800'
                  }`}
                >
                  {renderMarkdownMessage(msg.text)}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50 p-4">
            <div className="mx-auto flex max-w-2xl gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage()
                }}
                placeholder="输入您想咨询的问题（如：为什么下午手抖加剧？）"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-blue-400"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={isSending}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 font-bold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSending ? '发送中' : '发送'} <Send size={16} />
              </button>
            </div>
            <p className="mt-3 text-center text-[10px] text-slate-400">
              AI 生成内容仅供参考。紧急医疗情况请直接拨打 120 或前往急诊。
            </p>
          </div>
        </div>
      )
    }

    if (activeTab === 'records') {
      return (
        <div className="space-y-10">
          <MedicalRecordsPanel
            archiveDetail={archiveDetail}
            archiveForm={archiveForm}
            archives={archives}
            defaultPatientName={currentUser?.name || ''}
            isCreatingArchive={isCreatingArchive}
            isGeneratingReport={isGeneratingReport}
            isUploadingFiles={isUploadingFiles}
            onArchiveFieldChange={handleArchiveFieldChange}
            onCreateArchive={handleCreateArchive}
            onDownloadReportPdf={handleDownloadReportPdf}
            onGenerateReport={handleGenerateLongitudinalReport}
            onRefreshArchives={() => loadArchives(selectedArchiveId)}
            onSelectArchive={handleSelectArchive}
            onSelectReport={loadReportDetail}
            onUploadFiles={handleUploadArchiveFiles}
            recordsError={recordsError}
            recordsLoading={recordsLoading}
            recordsPolicy={recordsPolicy}
            selectedArchiveId={selectedArchiveId}
            selectedReportDetail={selectedReportDetail}
          />

          <CaseAnalysisPanel
            analysisResult={analysisResult}
            caseAnalysisError={caseAnalysisError}
            caseForm={caseForm}
            defaultPatientName={currentUser?.name || ''}
            isAnalyzingCase={isAnalyzingCase}
            onAnalyzeCase={handleAnalyzeCase}
            onCaseFieldChange={handleCaseFieldChange}
            onLoadExampleCase={handleLoadExampleCase}
          />
        </div>
      )
    }

    if (activeTab === 'reports') {
      return (
        <ReportsCenterPanel
          archives={archives}
          isGeneratingReport={isGeneratingReport}
          onCreatePdfReport={handleGenerateLongitudinalReportForArchive}
          onDownloadReportPdf={handleDownloadReportPdf}
          onOpenArchive={handleOpenArchiveFromReports}
          onSelectReport={loadReportDetail}
          reportsCenterError={reportsCenterError}
          reportsCenterLoading={reportsCenterLoading}
          reportsCenterReports={reportsCenterReports}
          selectedReportDetail={selectedReportDetail}
        />
      )
    }

    if (activeTab === 'rehab') {
      return <RehabPlanPanel />
    }

    if (activeTab === 'account') {
      return (
        <AccountPanel
          bindingError={bindingError}
          bindingForm={bindingForm}
          currentUser={currentUser}
          deviceBinding={deviceBinding}
          isBindingDevice={isBindingDevice}
          onBindingFieldChange={handleBindingFieldChange}
          onDisconnectDevice={handleDisconnectDevice}
          onSaveDevice={handleBindDevice}
        />
      )
    }

    return <PlaceholderPanel {...placeholderCards[activeTab]} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="p-6">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-inner">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-blue-900">震颤卫士</h1>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Tremor Guard
              </p>
            </div>
          </div>

          <nav className="space-y-2">
            <SidebarItem
              id="dashboard"
              icon={LayoutDashboard}
              label="健康看板"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <SidebarItem
              id="chat"
              icon={MessageSquare}
              label="AI 助手"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <SidebarItem
              id="records"
              icon={History}
              label="病历档案"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <SidebarItem
              id="rehab"
              icon={HeartPulse}
              label="康复计划"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <SidebarItem
              id="reports"
              icon={FileText}
              label="Legacy 报告"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <SidebarItem
              id="account"
              icon={Users}
              label="用户中心"
              activeTab={activeTab}
              onClick={setActiveTab}
            />
          </nav>
        </div>

        <div className="mt-auto border-t border-slate-100 p-4">
          <div className="mb-4 rounded-2xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">设备状态</span>
              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-600">
                {summary.device.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BatteryMedium size={14} className="text-blue-500" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${summary.device.batteryLevel}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-600">
                {summary.device.batteryLevel}%
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-400 transition-colors hover:text-red-500"
          >
            <LogOut size={18} />
            <span>注销登录</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
          <div className="flex flex-1 items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white md:hidden">
              <Activity size={18} />
            </div>
            <div className="flex max-w-2xl items-center gap-2 overflow-hidden rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5">
              <AlertTriangle className="shrink-0 text-amber-500" size={14} />
              <p className="truncate text-[10px] leading-none text-amber-700">
                <strong>合规性提示：</strong> 辅助监测非诊断设备。输出建议不可替代专业医师诊断。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <button type="button" className="relative text-slate-400 transition-colors hover:text-blue-600">
              <Bell size={20} />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className="flex items-center gap-3 border-l border-slate-100 pl-4 transition hover:text-blue-600 md:pl-6"
            >
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold text-slate-900">
                  {currentUser?.name || summary.patient.name}
                </p>
                <p className="text-[10px] text-slate-400">
                  {currentUser?.email || `ID: ${summary.patient.id}`}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-blue-100 text-blue-600 shadow-sm">
                <User size={20} />
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 pb-24 md:p-6 md:pb-6">
          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
              正在连接后端并同步仪表盘数据...
            </div>
          ) : (
            renderMainContent()
          )}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white px-4 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`p-2 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <LayoutDashboard size={24} />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          className={`p-2 ${activeTab === 'records' ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <History size={24} />
        </button>
        <button
          type="button"
          onClick={handleMedicationCheckIn}
          className="relative -top-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white shadow-lg"
        >
          <ClipboardCheck size={24} />
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`p-2 ${activeTab === 'chat' ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <MessageSquare size={24} />
        </button>
      </nav>
    </div>
  )
}

export default App
