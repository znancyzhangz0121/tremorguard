import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { extname, join } from 'node:path'
import { DashboardService } from '../dashboard/dashboard.service'
import { MedicationService } from '../medication/medication.service'
import { TremorService } from '../tremor/tremor.service'
import { CreateArchiveDto } from './dto/create-archive.dto'
import { CreateLongitudinalReportDto } from './dto/create-report.dto'
import { UploadArchiveFilesDto } from './dto/upload-archive-files.dto'
import { MedicalRecordsReportPdfService } from './medical-records.report-pdf.service'
import { MedicalRecordsStoreService } from './medical-records.store.service'
import {
  LongitudinalReport,
  LongitudinalReportContent,
  MEDICAL_RECORDS_DISCLAIMER,
  MEDICAL_RECORDS_POLICY,
  MedicalRecordArchive,
  MedicalRecordExtraction,
  MedicalRecordFile,
} from './medical-records.types'

@Injectable()
export class MedicalRecordsService {
  constructor(
    @Inject(MedicalRecordsStoreService)
    private readonly storeService: MedicalRecordsStoreService,
    @Inject(DashboardService)
    private readonly dashboardService: DashboardService,
    @Inject(TremorService)
    private readonly tremorService: TremorService,
    @Inject(MedicationService)
    private readonly medicationService: MedicationService,
    @Inject(MedicalRecordsReportPdfService)
    private readonly pdfService: MedicalRecordsReportPdfService,
  ) {}

  async createArchive(userEmail: string, input: CreateArchiveDto) {
    if (!input.consentAccepted) {
      throw new BadRequestException('创建档案前请先确认历史病例上传授权说明')
    }

    const store = await this.storeService.readStore()
    const now = new Date().toISOString()
    const archive: MedicalRecordArchive = {
      id: randomUUID(),
      userEmail,
      title: input.title.trim(),
      patientName: input.patientName.trim(),
      description: input.description?.trim() ?? '',
      consentAccepted: true,
      reportWindow: 'all-history',
      monitoringWindow: 'last-14-days',
      medicationWindow: 'last-14-days',
      createdAt: now,
      updatedAt: now,
    }

    store.archives.push(archive)
    await this.storeService.writeStore(store)

    return {
      archive: this.buildArchiveSummary(archive, store),
      policy: MEDICAL_RECORDS_POLICY,
    }
  }

  async listArchives(userEmail: string) {
    const store = await this.storeService.readStore()
    const archives = store.archives
      .filter((archive) => archive.userEmail === userEmail)
      .map((archive) => this.buildArchiveSummary(archive, store))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

    return {
      archives,
      policy: MEDICAL_RECORDS_POLICY,
      legacyReportsNotice: '当前 /reports 页面仍然只承载 legacy 监测摘要报告，病历联合报告请在本页查看。',
    }
  }

  async getArchive(userEmail: string, archiveId: string) {
    const store = await this.storeService.readStore()
    const archive = this.requireArchive(store.archives, archiveId, userEmail)
    const files = store.files
      .filter((file) => file.archiveId === archiveId)
      .map((file) => ({
        ...file,
        extraction:
          store.extractions.find((extraction) => extraction.fileId === file.id) ?? null,
      }))
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))

    const reports = store.reports
      .filter((report) => report.archiveId === archiveId)
      .map((report) => this.buildReportSummary(report))
      .sort((left, right) => right.version - left.version)

    return {
      archive: this.buildArchiveSummary(archive, store),
      files,
      reports,
      policy: MEDICAL_RECORDS_POLICY,
      recordsNotice:
        '此处展示的是长期病历档案与纵向健康报告，和 legacy /reports 监测摘要报告严格分离。',
    }
  }

  async listArchiveFiles(userEmail: string, archiveId: string) {
    const detail = await this.getArchive(userEmail, archiveId)
    return {
      files: detail.files,
      archive: detail.archive,
    }
  }

  async uploadArchiveFiles(userEmail: string, archiveId: string, input: UploadArchiveFilesDto) {
    if (input.files.length === 0) {
      throw new BadRequestException('请至少上传一张病例图片')
    }

    const store = await this.storeService.readStore()
    const archive = this.requireArchive(store.archives, archiveId, userEmail)
    const createdFiles: Array<MedicalRecordFile & { extraction: MedicalRecordExtraction | null }> = []

    for (const item of input.files) {
      this.validateImageFile(item.fileName, item.mimeType, item.contentBase64)

      const fileId = randomUUID()
      const extractionId = randomUUID()
      const now = new Date().toISOString()
      const extension = this.inferExtension(item.fileName, item.mimeType)
      const storedFileName = `${fileId}${extension}`
      const relativePath = join('data', 'medical-records', 'uploads', storedFileName)
      const content = Buffer.from(item.contentBase64, 'base64')

      await this.storeService.saveUploadFile(storedFileName, content)

      const fileRecord: MedicalRecordFile = {
        id: fileId,
        archiveId: archive.id,
        userEmail,
        fileName: item.fileName.trim(),
        mimeType: item.mimeType.trim(),
        storedFileName,
        relativePath,
        note: item.note?.trim() ?? '',
        sizeBytes: content.byteLength,
        status: 'processing',
        errorSummary: null,
        uploadedAt: now,
        updatedAt: now,
      }

      const extractionRecord: MedicalRecordExtraction = {
        id: extractionId,
        archiveId: archive.id,
        fileId,
        status: 'processing',
        summaryTitle: '',
        documentType: '',
        extractedFacts: [],
        uncertaintyNotes: [],
        structuredSummary: {},
        rawNarrative: '',
        errorSummary: null,
        createdAt: now,
        updatedAt: now,
      }

      store.files.push(fileRecord)
      store.extractions.push(extractionRecord)

      try {
        const extraction = this.buildExtractionSummary(archive, fileRecord)
        Object.assign(fileRecord, {
          status: 'succeeded',
          updatedAt: new Date().toISOString(),
        })
        Object.assign(extractionRecord, {
          status: 'succeeded',
          summaryTitle: extraction.summaryTitle,
          documentType: extraction.documentType,
          extractedFacts: extraction.extractedFacts,
          uncertaintyNotes: extraction.uncertaintyNotes,
          structuredSummary: extraction.structuredSummary,
          rawNarrative: extraction.rawNarrative,
          updatedAt: new Date().toISOString(),
        })
      } catch (error) {
        const errorSummary =
          error instanceof Error ? error.message : '病例抽取失败，请稍后重试'
        Object.assign(fileRecord, {
          status: 'failed',
          errorSummary,
          updatedAt: new Date().toISOString(),
        })
        Object.assign(extractionRecord, {
          status: 'failed',
          errorSummary,
          updatedAt: new Date().toISOString(),
        })
      }

      createdFiles.push({
        ...fileRecord,
        extraction: extractionRecord,
      })
    }

    archive.updatedAt = new Date().toISOString()
    await this.storeService.writeStore(store)

    return {
      archive: this.buildArchiveSummary(archive, store),
      files: createdFiles,
      policy: MEDICAL_RECORDS_POLICY,
    }
  }

  async createReport(
    userEmail: string,
    archiveId: string,
    input: CreateLongitudinalReportDto,
  ) {
    const store = await this.storeService.readStore()
    const archive = this.requireArchive(store.archives, archiveId, userEmail)
    const archiveFiles = store.files.filter((file) => file.archiveId === archiveId)
    const archiveExtractions = store.extractions.filter(
      (extraction) => extraction.archiveId === archiveId,
    )
    const successfulExtractions = archiveExtractions.filter(
      (extraction) => extraction.status === 'succeeded',
    )

    if (archiveFiles.length === 0) {
      throw new BadRequestException('请先上传至少一张历史病例图片，再生成纵向健康报告')
    }

    if (successfulExtractions.length === 0) {
      throw new BadRequestException('当前还没有可复用的抽取结果，请先检查档案文件状态')
    }

    const lastReport = store.reports
      .filter((report) => report.archiveId === archiveId)
      .sort((left, right) => right.version - left.version)[0]

    if (!input.forceRegenerate && lastReport && ['queued', 'processing'].includes(lastReport.status)) {
      return {
        report: this.buildReportSummary(lastReport),
        created: false,
      }
    }

    const version =
      store.reports
        .filter((report) => report.archiveId === archiveId)
        .reduce((maxVersion, report) => Math.max(maxVersion, report.version), 0) + 1

    const now = new Date().toISOString()
    const report: LongitudinalReport = {
      id: randomUUID(),
      archiveId: archive.id,
      userEmail,
      version,
      status: 'processing',
      title: `${archive.patientName} 纵向健康报告 v${version}`,
      generatedAt: now,
      updatedAt: now,
      errorSummary: null,
      content: this.buildEmptyReportContent(archive, version),
      contextSnapshot: {
        reportWindow: archive.reportWindow,
        monitoringWindow: archive.monitoringWindow,
        medicationWindow: archive.medicationWindow,
        selectedFileIds: archiveFiles.map((file) => file.id),
        selectedExtractionIds: successfulExtractions.map((extraction) => extraction.id),
        promptModelVersion: 'longitudinal-context-v1',
        disclaimerVersion: MEDICAL_RECORDS_POLICY.disclaimerVersion,
      },
      pdfRelativePath: null,
      pdfFileName: null,
      htmlRelativePath: null,
      htmlFileName: null,
    }

    store.reports.push(report)

    try {
      const content = await this.buildLongitudinalReportContent(
        archive,
        successfulExtractions,
        userEmail,
        version,
      )
      report.content = content
      report.status = 'succeeded'
      report.updatedAt = new Date().toISOString()
      const { html, pdfBuffer } = await this.pdfService.generateReportAssets(report)
      const fileDate = report.generatedAt.slice(0, 10).replaceAll('-', '')
      const pdfFileName = `PD_Report_${archive.id}_${fileDate}_v${version}.pdf`
      const htmlFileName = `PD_Report_${archive.id}_${fileDate}_v${version}.html`
      const pdfRelativePath = join('data', 'medical-records', 'reports', pdfFileName)
      const htmlRelativePath = join('data', 'medical-records', 'reports', htmlFileName)
      await this.storeService.savePdfFile(pdfFileName, pdfBuffer)
      await this.storeService.saveHtmlFile(htmlFileName, html)
      report.pdfFileName = pdfFileName
      report.pdfRelativePath = pdfRelativePath
      report.htmlFileName = htmlFileName
      report.htmlRelativePath = htmlRelativePath
    } catch (error) {
      report.status = 'failed'
      report.errorSummary = error instanceof Error ? error.message : '报告生成失败'
      report.updatedAt = new Date().toISOString()
    }

    archive.updatedAt = new Date().toISOString()
    await this.storeService.writeStore(store)

    return {
      report: this.buildReportSummary(report),
      created: true,
    }
  }

  async listReports(userEmail: string, archiveId: string) {
    const store = await this.storeService.readStore()
    const archive = this.requireArchive(store.archives, archiveId, userEmail)

    return {
      reports: store.reports
        .filter((report) => report.archiveId === archiveId)
        .map((report) => this.normalizeStoredReport(report, archive))
        .map((report) => this.buildReportSummary(report))
        .sort((left, right) => right.version - left.version),
      policy: MEDICAL_RECORDS_POLICY,
    }
  }

  async listAllReports(userEmail: string) {
    const store = await this.storeService.readStore()

    return {
      reports: store.reports
        .filter((report) => report.userEmail === userEmail)
        .map((report) => {
          const archive = store.archives.find((item) => item.id === report.archiveId)
          const normalizedReport = this.normalizeStoredReport(report, archive)

          return {
            ...this.buildReportSummary(normalizedReport),
            archiveTitle: archive?.title ?? '未命名档案',
            patientName: archive?.patientName ?? '当前用户',
          }
        })
        .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt)),
      policy: MEDICAL_RECORDS_POLICY,
    }
  }

  async getReport(userEmail: string, reportId: string) {
    const store = await this.storeService.readStore()
    const report = this.requireReport(store.reports, reportId, userEmail)
    const archive = this.requireArchive(store.archives, report.archiveId, userEmail)
    const normalizedReport = this.normalizeStoredReport(report, archive)

    return {
      report: normalizedReport,
      archive: this.buildArchiveSummary(archive, store),
      policy: MEDICAL_RECORDS_POLICY,
    }
  }

  async getReportPdf(userEmail: string, reportId: string) {
    const store = await this.storeService.readStore()
    const report = this.requireReport(store.reports, reportId, userEmail)

    if (!report.pdfRelativePath || !report.pdfFileName) {
      throw new NotFoundException('当前报告还没有可导出的 PDF 文件')
    }

    return {
      fileName: report.pdfFileName,
      buffer: await this.storeService.readPdfFile(report.pdfRelativePath),
    }
  }

  private buildArchiveSummary(
    archive: MedicalRecordArchive,
    store: Awaited<ReturnType<MedicalRecordsStoreService['readStore']>>,
  ) {
    const fileCount = store.files.filter((file) => file.archiveId === archive.id).length
    const reportCount = store.reports.filter((report) => report.archiveId === archive.id).length
    const latestReport = store.reports
      .filter((report) => report.archiveId === archive.id)
      .sort((left, right) => right.version - left.version)[0]

    return {
      ...archive,
      fileCount,
      reportCount,
      latestReport: latestReport ? this.buildReportSummary(this.normalizeStoredReport(latestReport, archive)) : null,
    }
  }

  private buildReportSummary(report: LongitudinalReport) {
    return {
      id: report.id,
      archiveId: report.archiveId,
      version: report.version,
      status: report.status,
      title: report.title,
      generatedAt: report.generatedAt,
      updatedAt: report.updatedAt,
      errorSummary: report.errorSummary,
      hasPdf: Boolean(report.pdfRelativePath),
      hasHtml: Boolean(report.htmlRelativePath),
      disclaimer: report.content.disclaimer,
    }
  }

  private buildEmptyReportContent(archive: MedicalRecordArchive, version: number): LongitudinalReportContent {
    const reportNumber = `TG-${archive.id.slice(0, 8).toUpperCase()}-V${version}`

    return {
      cover: {
        reportNumber,
        reportTypeLabel: 'TremorGuard 监测周期分析报告',
        generatedDateLabel: this.formatDateTime(new Date().toISOString()),
        patientName: archive.patientName,
        patientAge: '未提供',
        patientGender: '未提供',
        archiveTitle: archive.title,
        logoLabel: 'TremorGuard / Logo',
        purpose: '用于辅助健康管理与复诊沟通，不替代医生诊断。',
      },
      executiveSummary: {
        narrative: '系统正在生成纵向健康报告。',
        highlights: [],
        cautionFlags: [],
      },
      patientBasicInfo: {
        cards: [],
      },
      historicalRecordSummary: {
        narrative: '',
        sourceHighlights: [],
      },
      monitoringKpis: {
        cards: [],
      },
      tremorTimeDistribution: {
        summary: '',
        buckets: [],
      },
      tremorSeverity: {
        summary: '',
        bands: [],
      },
      medicationAnalysis: {
        summary: '',
        totalDailyDose: '',
        adherenceRate: '',
        timeline: [],
        safetyNotes: [],
      },
      symptomMedicationInterpretation: {
        summary: '',
        observations: [],
        caution: '',
      },
      informationGaps: {
        summary: '',
        items: [],
      },
      followUpChecklist: {
        visitChecklist: [],
        homeObservationChecklist: [],
        clinicianQuestions: [],
      },
      disclaimerBlocks: {
        cover: MEDICAL_RECORDS_DISCLAIMER,
        footer: '本报告仅供健康管理与复诊沟通参考，不替代医生诊断。',
        conclusion: MEDICAL_RECORDS_DISCLAIMER,
      },
      visualization: {
        trendSeries: [],
        histogram: [],
        medicationScatter: [],
      },
      conclusion: MEDICAL_RECORDS_DISCLAIMER,
      patientSummary: '',
      historicalCaseSummary: '',
      monitoringTrendSummary: '',
      medicationObservation: '',
      informationGapsLegacy: [],
      followUpTopics: [],
      disclaimer: MEDICAL_RECORDS_DISCLAIMER,
    }
  }

  private requireArchive(archives: MedicalRecordArchive[], archiveId: string, userEmail: string) {
    const archive = archives.find(
      (item) => item.id === archiveId && item.userEmail === userEmail,
    )

    if (!archive) {
      throw new NotFoundException('未找到对应的历史病例档案')
    }

    return archive
  }

  private requireReport(reports: LongitudinalReport[], reportId: string, userEmail: string) {
    const report = reports.find((item) => item.id === reportId && item.userEmail === userEmail)

    if (!report) {
      throw new NotFoundException('未找到对应的纵向健康报告')
    }

    return report
  }

  private validateImageFile(fileName: string, mimeType: string, contentBase64: string) {
    if (!fileName.trim()) {
      throw new BadRequestException('病例图片文件名不能为空')
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      throw new BadRequestException('首期仅支持 JPG、PNG、WEBP 图片格式')
    }

    const sizeBytes = Buffer.from(contentBase64, 'base64').byteLength
    if (sizeBytes > 5 * 1024 * 1024) {
      throw new BadRequestException('单张病例图片大小不能超过 5MB')
    }
  }

  private inferExtension(fileName: string, mimeType: string) {
    const existingExtension = extname(fileName).trim()
    if (existingExtension) {
      return existingExtension
    }

    if (mimeType === 'image/png') return '.png'
    if (mimeType === 'image/webp') return '.webp'
    return '.jpg'
  }

  private buildExtractionSummary(archive: MedicalRecordArchive, file: MedicalRecordFile) {
    const sourceText = `${file.fileName} ${file.note}`.toLowerCase()
    const documentType = this.inferDocumentType(sourceText)
    const timelineHints = [
      sourceText.includes('门诊') ? '来自门诊就诊材料，适合作为纵向病程节点。' : null,
      sourceText.includes('检查') ? '包含检查/化验语义，复诊时建议与近期监测趋势对照。' : null,
      sourceText.includes('药') ? '文件名或备注涉及用药信息，适合作为用药观察线索。' : null,
    ].filter(Boolean) as string[]

    const extractedFacts = [
      `档案名称：${archive.title}`,
      `患者姓名：${archive.patientName}`,
      `文档类型推断：${documentType}`,
      file.note
        ? `上传备注：${file.note}`
        : '上传时未填写额外备注，建议后续补充就诊日期、主诉和关键观察点。',
      ...timelineHints,
    ]

    const uncertaintyNotes = [
      '当前首期为图片档案基础版，若未接入云端 OCR，摘要主要依据文件名和上传备注生成。',
      '复诊前请人工核对日期、检查结论、药物名称和剂量等关键字段。',
    ]

    return {
      summaryTitle: `${documentType}摘要`,
      documentType,
      extractedFacts,
      uncertaintyNotes,
      structuredSummary: {
        documentType,
        patientName: archive.patientName,
        sourceFileName: file.fileName,
        note: file.note,
        extractedAt: new Date().toISOString(),
      },
      rawNarrative: [
        `${file.fileName} 已进入长期病历档案。`,
        file.note
          ? `上传备注提示：${file.note}`
          : '当前没有上传备注，建议后续补充就诊背景和症状变化。',
        '该摘要仅用于后续纵向健康报告的上下文整理，不构成诊断结论。',
      ].join(' '),
    }
  }

  private inferDocumentType(sourceText: string) {
    if (sourceText.includes('ct') || sourceText.includes('mr') || sourceText.includes('核磁')) {
      return '影像检查材料'
    }

    if (sourceText.includes('化验') || sourceText.includes('检验') || sourceText.includes('血')) {
      return '化验单/检验结果'
    }

    if (sourceText.includes('处方') || sourceText.includes('药')) {
      return '用药或处方材料'
    }

    if (sourceText.includes('门诊') || sourceText.includes('病历')) {
      return '门诊病历/病程记录'
    }

    return '历史病例图片'
  }

  private async buildLongitudinalReportContent(
    archive: MedicalRecordArchive,
    extractions: MedicalRecordExtraction[],
    userEmail: string,
    version: number,
  ) {
    const dashboard = await this.dashboardService.getSummary(userEmail)
    const timeline = this.tremorService.getTimeline()
    const medicationRecords = this.medicationService.getRecords()
    const numericTimeline = timeline.map((entry) => ({
      ...entry,
      intensity: Number(entry.intensity),
      hour: Number(entry.time.split(':')[0] ?? 0),
    }))
    const peakEntries = numericTimeline.filter((entry) => entry.intensity >= 6)
    const extractionLabels = extractions.map((extraction) => extraction.summaryTitle)
    const extractedFacts = extractions.flatMap((extraction) => extraction.extractedFacts).slice(0, 6)
    const uncertaintyNotes = Array.from(
      new Set(extractions.flatMap((extraction) => extraction.uncertaintyNotes)),
    )
    const eventCount = numericTimeline.length
    const averageAmplitude =
      numericTimeline.reduce((sum, entry) => sum + entry.intensity, 0) / Math.max(eventCount, 1)
    const peakAmplitude = Math.max(...numericTimeline.map((entry) => entry.intensity), 0)
    const doneMedicationCount = medicationRecords.filter((record) => record.status === 'done').length
    const adherenceRate = `${Math.round((doneMedicationCount / Math.max(medicationRecords.length, 1)) * 100)}%`
    const severityBands = this.buildSeverityBands(numericTimeline)
    const distributionBuckets = this.buildDistributionBuckets(numericTimeline)
    const histogram = severityBands.map((band) => ({
      label: band.label.replace('级', ''),
      value: band.count,
    }))
    const reportNumber = `TG-${archive.id.slice(0, 8).toUpperCase()}-V${version}`
    const sourceHighlights = extractedFacts.length > 0 ? extractedFacts : ['当前已存在历史病例图片，但有效提取要点仍较少。']
    const highSeverityShare = severityBands.find((band) => band.label === '重度')?.share ?? '0%'
    const distributionSummary = `当前监测窗口内共记录 ${eventCount} 个时段点，其中午后与傍晚时段更接近高波动区域。高峰主要集中在 ${peakEntries.map((entry) => entry.time).join('、') || '暂无显著峰值时段'}。`
    const severitySummary = `按轻度 <0.3、中度 0.3-0.6、重度 >0.6 的分层口径，本次监测以 ${
      severityBands.sort((left, right) => right.count - left.count)[0]?.label ?? '轻度'
    } 事件为主，重度事件占比 ${highSeverityShare}。`
    const medicationTimeline = medicationRecords.map((record) => ({
      time: record.time,
      medication: '多巴丝肼片（美多芭）',
      dosage: '125mg',
      status: record.status === 'done' ? '已执行' : '待执行',
    }))
    const scatter = medicationRecords.map((record) => {
      const medicationHour = Number(record.time.split(':')[0] ?? 0)
      const matchingPoint =
        numericTimeline.find((entry) => entry.hour === medicationHour) ??
        numericTimeline.reduce((closest, entry) => {
          if (!closest) return entry
          return Math.abs(entry.hour - medicationHour) < Math.abs(closest.hour - medicationHour)
            ? entry
            : closest
        }, null as (typeof numericTimeline)[number] | null)

      return {
        label: record.time,
        x: medicationHour,
        y: matchingPoint?.intensity ?? 0,
      }
    })
    const patientSummary = `${archive.patientName} 当前已沉淀 ${extractions.length} 份历史病例图片摘要，档案主题为“${archive.title}”。本次报告整合了既往图片档案、近期 TremorGuard 监测记录与用药执行信息，重点用于复诊前纵向回顾。`
    const historicalCaseSummary = `系统已归档 ${extractionLabels.join('、')} 等资料，并提炼出 ${sourceHighlights.join('；')}。这些信息更适合作为病程节点与检查背景的整理基础，不直接构成诊断结论。`
    const monitoringTrendSummary = `${dashboard.insights.summary} 平均震颤幅度 ${averageAmplitude.toFixed(3)}，峰值 ${peakAmplitude.toFixed(2)}，提示午后时段仍是需要优先关注的波动窗口。`
    const medicationObservation = `当前用药记录显示 ${medicationRecords.map((record) => `${record.time}${record.status === 'done' ? '已打卡' : '待执行'}`).join('，')}。按当前记录计算，用药依从率约为 ${adherenceRate}，适合继续对照服药后 1 至 3 小时内的症状变化。`
    const gapItems = [
      {
        title: '非运动症状资料仍不足',
        whyItMatters:
          '睡眠、便秘、焦虑、日间嗜睡等非运动症状常与总体生活质量和药物耐受性相关，仅看震颤无法完成完整评估。',
        nextAction: '建议补充近两周睡眠、情绪、排便和白天精力变化记录。',
        followUpQuestion: '近期是否需要加做 MoCA、睡眠或情绪相关量表评估？',
      },
      {
        title: '缺少标准化体格检查与量表',
        whyItMatters:
          'UPDRS、Hoehn-Yahr、步态/平衡检查可帮助区分震颤之外的运动迟缓、强直与姿势稳定性问题。',
        nextAction: '复诊时带上本报告，并请医生结合体格检查与量表进行综合判断。',
        followUpQuestion: '本次是否建议补做 UPDRS-III、Hoehn-Yahr 或步态平衡相关评估？',
      },
      {
        title: '历史病例原文关键信息仍需人工核对',
        whyItMatters:
          '当前首期抽取结果主要用于档案整理，药物名称、检查结论和日期等关键字段仍需要患者或家属校对。',
        nextAction: '后续上传时补充就诊日期、主诉摘要、医生意见和检查名称。',
        followUpQuestion: '医生是否建议补带某次影像/化验原文，帮助对照近期监测变化？',
      },
    ]

    return {
      cover: {
        reportNumber,
        reportTypeLabel: 'TremorGuard 监测周期分析报告',
        generatedDateLabel: this.formatDateTime(new Date().toISOString()),
        patientName: dashboard.patient.displayName || archive.patientName,
        patientAge: dashboard.patient.age ? `${dashboard.patient.age} 岁` : '未提供',
        patientGender: '未提供',
        archiveTitle: archive.title,
        logoLabel: 'TremorGuard / Medical Report',
        purpose: '用于辅助健康管理、病历整理与复诊沟通，不替代神经内科医生诊断。',
      },
      executiveSummary: {
        narrative: `${patientSummary} ${monitoringTrendSummary} ${medicationObservation}`,
        highlights: [
          `近期高波动时段：${peakEntries.map((entry) => entry.time).join('、') || '暂无显著峰值'}`,
          `平均幅度 ${averageAmplitude.toFixed(3)}，峰值 ${peakAmplitude.toFixed(2)}，重度事件占比 ${highSeverityShare}`,
          `当前可复用档案要点：${sourceHighlights.slice(0, 2).join('；')}`,
        ],
        cautionFlags: [
          '当前系统仅提供健康管理参考，不输出分期、处方或药量调整建议。',
          '若近期出现跌倒、冻结、明显异动或突发意识改变，应优先联系医生而非等待下次复诊。',
        ],
      },
      patientBasicInfo: {
        cards: [
          { label: '姓名', value: dashboard.patient.displayName || archive.patientName },
          { label: '年龄', value: dashboard.patient.age ? `${dashboard.patient.age} 岁` : '未提供' },
          { label: '报告编号', value: reportNumber },
          { label: '生成日期', value: this.formatDateTime(new Date().toISOString()) },
          { label: '档案主题', value: archive.title },
          { label: '评估目的', value: '辅助健康管理与复诊沟通' },
        ],
      },
      historicalRecordSummary: {
        narrative: historicalCaseSummary,
        sourceHighlights,
      },
      monitoringKpis: {
        cards: [
          { label: '累计事件数', value: String(eventCount), helper: '监测窗口内可用时段点' },
          { label: '平均幅度', value: averageAmplitude.toFixed(3), helper: '用于观察总体波动水平' },
          { label: '峰值幅度', value: peakAmplitude.toFixed(2), helper: '对应最强震颤时段' },
          { label: '用药依从率', value: adherenceRate, helper: `${doneMedicationCount}/${medicationRecords.length} 次已打卡` },
        ],
      },
      tremorTimeDistribution: {
        summary: distributionSummary,
        buckets: distributionBuckets,
      },
      tremorSeverity: {
        summary: severitySummary,
        bands: severityBands,
      },
      medicationAnalysis: {
        summary: `当前方案按美多芭 125mg × ${medicationRecords.length} 次/日记录，总日剂量约 375mg，属于居家记录里较常见的基础到中等剂量观察区间。用药时机本身不能替代医生决策，但现有数据提示仍需继续观察午间服药后 2 至 3 小时是否出现再次回潮。`,
        totalDailyDose: '375mg / 日',
        adherenceRate,
        timeline: medicationTimeline,
        safetyNotes: [
          '复诊时建议同步反馈是否出现恶心、低血压、嗜睡、异动症或夜间翻身困难等现象。',
        ],
      },
      symptomMedicationInterpretation: {
        summary: '当前监测数据与用药记录结合后，可见午后仍是症状解释的核心窗口。现有证据更适合支持“继续观察是否存在剂末现象或日内波动线索”，不支持系统直接做治疗调整结论。',
        observations: [
          `服药记录集中在 ${medicationRecords.map((record) => record.time).join('、')}，高波动时段则主要出现在 ${peakEntries.map((entry) => entry.time).join('、') || '暂无显著峰值'}。`,
          '若后续继续出现“午间服药后 2 至 3 小时再度加重”，更适合在复诊时向医生描述为“药后维持时间是否缩短”的观察线索。',
          '如果同时伴有步态拖慢、冻结或体位变化困难，说明不能只用震颤强度来解释本次波动。',
        ],
        caution: '当前关联性分析仅依据监测时点与用药记录做辅助解释，不能替代医生结合面诊和完整病史做判断。',
      },
      informationGaps: {
        summary: `当前报告已经尽量利用 TremorGuard 监测与用药记录进行深度整理，但仍有 ${gapItems.length} 类关键信息需要补齐，以便医生完成更完整的评估。`,
        items: [...gapItems, ...uncertaintyNotes.map((note, index) => ({
          title: `抽取不确定项 ${index + 1}`,
          whyItMatters: note,
          nextAction: '建议在下次上传或复诊前手工核对图片中的日期、检查结论和药物名称。',
          followUpQuestion: '这份历史材料里是否有需要重点补带原件的检查或门诊记录？',
        }))],
      },
      followUpChecklist: {
        visitChecklist: [
          '携带本次纵向健康报告 PDF 与近期最有代表性的历史病例原图或原件。',
          '按时间线整理最近 1 至 2 周最明显的一次症状回潮过程，包括开始时间、持续时长和当时活动。',
          '如有跌倒、冻结、夜间翻身困难、便秘或睡眠问题，请单独列成清单。',
        ],
        homeObservationChecklist: [
          '继续记录震颤高峰出现的具体时间、诱因、伴随症状和恢复时长。',
          '记录每次服药前后 1 小时和 3 小时的主观症状变化。',
          '补充情绪、睡眠、排便和白天疲劳等非运动症状。',
        ],
        clinicianQuestions: [
          '目前的监测变化更像药效维持时间缩短，还是整体病情节律发生变化？',
          '是否需要进一步区分震颤、动作迟缓、步态冻结或异动症成分？',
          '下一次复诊是否建议补做标准化量表、步态评估或认知筛查？',
        ],
      },
      disclaimerBlocks: {
        cover: MEDICAL_RECORDS_DISCLAIMER,
        footer: '本报告仅供健康管理与复诊沟通参考，不替代医生诊断或治疗决策。',
        conclusion: '本报告所有图表、摘要和建议均服务于健康管理与复诊沟通，不构成疾病诊断、分期或用药调整意见。',
      },
      visualization: {
        trendSeries: distributionBuckets.map((bucket) => ({
          label: bucket.label.replace('时段', ''),
          value: bucket.count,
        })),
        histogram,
        medicationScatter: scatter,
      },
      conclusion: '综合来看，当前更适合把这份报告作为“长期资料整理 + 监测波动提示”的复诊辅助材料，重点围绕午后波动、服药后维持时间、步态与非运动症状补充情况与医生沟通。',
      patientSummary,
      historicalCaseSummary,
      monitoringTrendSummary,
      medicationObservation,
      informationGapsLegacy: gapItems.map((item) => item.title),
      followUpTopics: [
        '优先说明午后高波动时段与服药后回潮的关系。',
        '补充步态、冻结和夜间翻身等对日常生活影响最大的表现。',
        '核对并带上最关键的一至两份历史门诊/检查原文。',
      ],
      disclaimer: MEDICAL_RECORDS_DISCLAIMER,
    }
  }

  private buildDistributionBuckets(
    timeline: Array<{ intensity: number; hour: number }>,
  ) {
    const buckets = [
      { label: '凌晨 00-05 时段', hours: [0, 1, 2, 3, 4, 5] },
      { label: '上午 06-11 时段', hours: [6, 7, 8, 9, 10, 11] },
      { label: '午后 12-17 时段', hours: [12, 13, 14, 15, 16, 17] },
      { label: '夜间 18-23 时段', hours: [18, 19, 20, 21, 22, 23] },
    ]

    return buckets.map((bucket) => {
      const entries = timeline.filter((entry) => bucket.hours.includes(entry.hour))
      const averageAmplitude =
        entries.reduce((sum, entry) => sum + entry.intensity, 0) / Math.max(entries.length, 1)

      return {
        label: bucket.label,
        count: entries.length,
        averageAmplitude: Number(averageAmplitude.toFixed(3)),
      }
    })
  }

  private buildSeverityBands(
    timeline: Array<{ intensity: number }>,
  ) {
    const total = Math.max(timeline.length, 1)
    const low = timeline.filter((entry) => entry.intensity < 0.3).length
    const medium = timeline.filter((entry) => entry.intensity >= 0.3 && entry.intensity <= 0.6).length
    const high = timeline.filter((entry) => entry.intensity > 0.6).length

    return [
      {
        label: '轻度',
        threshold: '< 0.3',
        count: low,
        share: `${Math.round((low / total) * 100)}%`,
      },
      {
        label: '中度',
        threshold: '0.3 - 0.6',
        count: medium,
        share: `${Math.round((medium / total) * 100)}%`,
      },
      {
        label: '重度',
        threshold: '> 0.6',
        count: high,
        share: `${Math.round((high / total) * 100)}%`,
      },
    ]
  }

  private formatDateTime(value: string) {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai',
    }).format(new Date(value))
  }

  private normalizeStoredReport(
    report: LongitudinalReport,
    archive?: MedicalRecordArchive,
  ): LongitudinalReport {
    if ('cover' in report.content && 'patientBasicInfo' in report.content) {
      return {
        ...report,
        htmlFileName: report.htmlFileName ?? null,
        htmlRelativePath: report.htmlRelativePath ?? null,
      }
    }

    const legacyContent = report.content as {
      patientSummary?: string
      historicalCaseSummary?: string
      monitoringTrendSummary?: string
      medicationObservation?: string
      informationGaps?: string[]
      followUpTopics?: string[]
      disclaimer?: string
    }

    const next = this.buildEmptyReportContent(
      archive ?? {
        id: report.archiveId,
        userEmail: report.userEmail,
        title: '既有档案',
        patientName: '当前用户',
        description: '',
        consentAccepted: true,
        reportWindow: 'all-history',
        monitoringWindow: 'last-14-days',
        medicationWindow: 'last-14-days',
        createdAt: report.generatedAt,
        updatedAt: report.updatedAt,
      },
      report.version,
    )

    next.patientSummary = legacyContent.patientSummary ?? ''
    next.historicalCaseSummary = legacyContent.historicalCaseSummary ?? ''
    next.monitoringTrendSummary = legacyContent.monitoringTrendSummary ?? ''
    next.medicationObservation = legacyContent.medicationObservation ?? ''
    next.informationGapsLegacy = legacyContent.informationGaps ?? []
    next.followUpTopics = legacyContent.followUpTopics ?? []
    next.disclaimer = legacyContent.disclaimer ?? MEDICAL_RECORDS_DISCLAIMER
    next.executiveSummary.narrative = [
      next.patientSummary,
      next.monitoringTrendSummary,
      next.medicationObservation,
    ]
      .filter(Boolean)
      .join(' ')
    next.historicalRecordSummary.narrative = next.historicalCaseSummary
    next.informationGaps.summary = '这份报告来自旧版结构，部分章节尚未补齐到新的医疗级排版模型。'
    next.informationGaps.items = (legacyContent.informationGaps ?? []).map((item, index) => ({
      title: `旧版补充项 ${index + 1}`,
      whyItMatters: item,
      nextAction: '建议重新生成新版报告以获得更完整的章节化内容。',
      followUpQuestion: '本次是否需要基于现有档案重新生成新版纵向健康报告？',
    }))
    next.followUpChecklist.clinicianQuestions = legacyContent.followUpTopics ?? []
    next.disclaimerBlocks.cover = legacyContent.disclaimer ?? MEDICAL_RECORDS_DISCLAIMER
    next.disclaimerBlocks.footer = legacyContent.disclaimer ?? MEDICAL_RECORDS_DISCLAIMER
    next.disclaimerBlocks.conclusion = legacyContent.disclaimer ?? MEDICAL_RECORDS_DISCLAIMER
    next.conclusion =
      legacyContent.monitoringTrendSummary ??
      '该旧版报告建议重新生成，以获得新的章节化结构、图表和 PDF 排版。'

    return {
      ...report,
      content: next,
      htmlFileName: report.htmlFileName ?? null,
      htmlRelativePath: report.htmlRelativePath ?? null,
    }
  }
}
