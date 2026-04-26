export const MEDICAL_RECORDS_DISCLAIMER =
  '本档案与报告仅用于健康管理和复诊沟通参考，不能替代神经内科医生的诊断、分期、处方或药量调整。'

export const MEDICAL_RECORDS_POLICY = {
  consentPolicy:
    '上传历史病例图片前，患者需确认这些资料将仅用于个人健康档案、后续纵向报告生成和复诊准备，不会作为自动诊断结论。',
  retentionPolicy:
    '首期采用私有本地文件存储与结构化索引，当前不提供自助删除入口；如需删除或导出，请联系内部处理路径。',
  exportPolicy:
    'PDF 导出仅覆盖当前报告版本，不等于完整病历档案导出。',
  auditPolicy:
    '系统保留档案创建、文件追加、抽取结果和报告版本的时间线，便于后续追溯生成依据。',
  disclaimerVersion: 'medical-records-v1',
} as const

export type ReportMetricCard = {
  label: string
  value: string
  helper: string
}

export type ReportDistributionBucket = {
  label: string
  count: number
  averageAmplitude: number
}

export type ReportSeverityBand = {
  label: string
  threshold: string
  count: number
  share: string
}

export type ReportMedicationTimelineItem = {
  time: string
  medication: string
  dosage: string
  status: string
}

export type ReportGapItem = {
  title: string
  whyItMatters: string
  nextAction: string
  followUpQuestion: string
}

export type ReportSvgPoint = {
  label: string
  value: number
}

export type ReportScatterPoint = {
  label: string
  x: number
  y: number
}

export type LongitudinalReportContent = {
  cover: {
    reportNumber: string
    reportTypeLabel: string
    generatedDateLabel: string
    patientName: string
    patientAge: string
    patientGender: string
    archiveTitle: string
    logoLabel: string
    purpose: string
  }
  executiveSummary: {
    narrative: string
    highlights: string[]
    cautionFlags: string[]
  }
  patientBasicInfo: {
    cards: Array<{ label: string; value: string }>
  }
  historicalRecordSummary: {
    narrative: string
    sourceHighlights: string[]
  }
  monitoringKpis: {
    cards: ReportMetricCard[]
  }
  tremorTimeDistribution: {
    summary: string
    buckets: ReportDistributionBucket[]
  }
  tremorSeverity: {
    summary: string
    bands: ReportSeverityBand[]
  }
  medicationAnalysis: {
    summary: string
    totalDailyDose: string
    adherenceRate: string
    timeline: ReportMedicationTimelineItem[]
    safetyNotes: string[]
  }
  symptomMedicationInterpretation: {
    summary: string
    observations: string[]
    caution: string
  }
  informationGaps: {
    summary: string
    items: ReportGapItem[]
  }
  followUpChecklist: {
    visitChecklist: string[]
    homeObservationChecklist: string[]
    clinicianQuestions: string[]
  }
  disclaimerBlocks: {
    cover: string
    footer: string
    conclusion: string
  }
  visualization: {
    trendSeries: ReportSvgPoint[]
    histogram: ReportSvgPoint[]
    medicationScatter: ReportScatterPoint[]
  }
  conclusion: string
  patientSummary: string
  historicalCaseSummary: string
  monitoringTrendSummary: string
  medicationObservation: string
  informationGapsLegacy: string[]
  followUpTopics: string[]
  disclaimer: string
}

export type MedicalRecordArchive = {
  id: string
  userEmail: string
  title: string
  patientName: string
  description: string
  consentAccepted: boolean
  reportWindow: string
  monitoringWindow: string
  medicationWindow: string
  createdAt: string
  updatedAt: string
}

export type MedicalRecordFileStatus = 'queued' | 'processing' | 'succeeded' | 'failed'
export type MedicalRecordReportStatus = 'queued' | 'processing' | 'succeeded' | 'failed'

export type MedicalRecordFile = {
  id: string
  archiveId: string
  userEmail: string
  fileName: string
  mimeType: string
  storedFileName: string
  relativePath: string
  note: string
  sizeBytes: number
  status: MedicalRecordFileStatus
  errorSummary: string | null
  uploadedAt: string
  updatedAt: string
}

export type MedicalRecordExtraction = {
  id: string
  archiveId: string
  fileId: string
  status: MedicalRecordFileStatus
  summaryTitle: string
  documentType: string
  extractedFacts: string[]
  uncertaintyNotes: string[]
  structuredSummary: Record<string, unknown>
  rawNarrative: string
  errorSummary: string | null
  createdAt: string
  updatedAt: string
}

export type LongitudinalReport = {
  id: string
  archiveId: string
  userEmail: string
  version: number
  status: MedicalRecordReportStatus
  title: string
  generatedAt: string
  updatedAt: string
  errorSummary: string | null
  content: LongitudinalReportContent
  contextSnapshot: {
    reportWindow: string
    monitoringWindow: string
    medicationWindow: string
    selectedFileIds: string[]
    selectedExtractionIds: string[]
    promptModelVersion: string
    disclaimerVersion: string
  }
  pdfRelativePath: string | null
  pdfFileName: string | null
  htmlRelativePath: string | null
  htmlFileName: string | null
}

export type MedicalRecordsStore = {
  archives: MedicalRecordArchive[]
  files: MedicalRecordFile[]
  extractions: MedicalRecordExtraction[]
  reports: LongitudinalReport[]
}
