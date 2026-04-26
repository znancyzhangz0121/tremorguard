import { Injectable } from '@nestjs/common'
import {
  LongitudinalReport,
  ReportDistributionBucket,
  ReportMedicationTimelineItem,
  ReportScatterPoint,
  ReportSeverityBand,
  ReportSvgPoint,
} from './medical-records.types'

@Injectable()
export class MedicalRecordsReportTemplateService {
  buildHtml(report: LongitudinalReport) {
    const { content } = report

    return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>${this.escape(report.title)}</title>
    <style>
      @page {
        size: A4;
        margin: 22mm 16mm 20mm 16mm;
      }
      :root {
        --medical-blue: #1e5f8c;
        --deep-green: #2c5f4a;
        --soft-blue: #eaf4fb;
        --line: #d7e3ed;
        --text: #1f2937;
        --muted: #64748b;
        --warning: #b45309;
        --warning-bg: #fff7ed;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--text);
        font-family: "Source Han Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
        line-height: 1.75;
        background: white;
      }
      .page-break { break-before: page; page-break-before: always; }
      .cover {
        min-height: 1000px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .cover-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .logo-box {
        border: 1px dashed var(--line);
        color: var(--muted);
        padding: 16px 18px;
        border-radius: 16px;
        font-size: 12px;
      }
      .report-type {
        display: inline-block;
        margin-top: 18px;
        background: var(--soft-blue);
        color: var(--medical-blue);
        border-radius: 999px;
        padding: 6px 14px;
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.08em;
      }
      h1 {
        margin: 18px 0 10px;
        font-size: 32px;
        line-height: 1.3;
        text-align: center;
        color: var(--medical-blue);
      }
      .cover-subtitle {
        text-align: center;
        font-size: 14px;
        color: var(--muted);
      }
      .patient-card {
        margin: 32px auto 0;
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 24px;
        background: linear-gradient(180deg, #f9fbfd 0%, #ffffff 100%);
      }
      .patient-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .meta-card {
        border-radius: 18px;
        padding: 16px;
        background: white;
        border: 1px solid var(--line);
      }
      .meta-label {
        font-size: 11px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--muted);
        font-weight: 700;
      }
      .meta-value {
        margin-top: 8px;
        font-size: 18px;
        font-weight: 800;
        color: var(--text);
      }
      .disclaimer-box {
        margin-top: 24px;
        border-left: 5px solid var(--medical-blue);
        padding: 16px 18px;
        border-radius: 14px;
        background: #f8fafc;
        font-size: 13px;
        color: var(--muted);
      }
      .section-title {
        margin: 28px 0 14px;
        padding-bottom: 10px;
        border-bottom: 2px solid var(--medical-blue);
        color: var(--medical-blue);
        font-size: 22px;
        font-weight: 900;
      }
      .subsection {
        margin-top: 18px;
        padding: 12px 16px;
        background: #f8fbfe;
        border-left: 4px solid var(--medical-blue);
        border-radius: 12px;
      }
      .subsection h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 800;
        color: var(--text);
      }
      .subsection p {
        margin: 10px 0 0;
      }
      .toc-list {
        margin: 18px 0 0;
        padding: 0;
        list-style: none;
      }
      .toc-item {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px dashed var(--line);
        padding: 10px 0;
        font-size: 14px;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin: 18px 0;
      }
      .kpi-card {
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 16px;
        background: white;
      }
      .kpi-value {
        font-size: 24px;
        font-weight: 900;
        color: var(--medical-blue);
      }
      .kpi-label {
        font-size: 12px;
        color: var(--muted);
        font-weight: 700;
      }
      .kpi-helper {
        margin-top: 6px;
        font-size: 12px;
        color: var(--muted);
      }
      .chart-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
        margin: 18px 0;
      }
      .chart-card {
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 16px;
        background: white;
      }
      .chart-card h4 {
        margin: 0 0 12px;
        font-size: 14px;
        font-weight: 800;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 14px;
        font-size: 13px;
      }
      .table th, .table td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
      }
      .table th {
        background: #eff6fb;
        font-weight: 800;
      }
      .table tr:nth-child(even) td {
        background: #fafcfe;
      }
      .timeline {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .timeline-item {
        display: grid;
        grid-template-columns: 92px 1fr;
        gap: 14px;
        align-items: start;
      }
      .timeline-time {
        font-weight: 800;
        color: var(--deep-green);
      }
      .timeline-body {
        border-left: 4px solid #9bd4b0;
        background: #f3fbf6;
        padding: 10px 14px;
        border-radius: 10px;
      }
      .callout {
        margin-top: 16px;
        padding: 14px 16px;
        border-left: 4px solid var(--warning);
        background: var(--warning-bg);
        border-radius: 12px;
        color: #7c2d12;
      }
      ul {
        margin: 10px 0 0;
        padding-left: 20px;
      }
      li { margin: 6px 0; }
      .two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
      }
      .footer-note {
        margin-top: 22px;
        padding: 16px 18px;
        border-radius: 14px;
        background: #f8fafc;
        color: var(--muted);
        font-size: 13px;
      }
      .conclusion {
        margin-top: 18px;
        padding: 18px;
        border-radius: 18px;
        background: linear-gradient(180deg, #eff6fb 0%, #ffffff 100%);
        border: 1px solid var(--line);
      }
      svg {
        width: 100%;
        height: auto;
        display: block;
      }
    </style>
  </head>
  <body>
    <section class="cover">
      <div>
        <div class="cover-header">
          <div class="logo-box">${this.escape(content.cover.logoLabel)}</div>
          <div class="report-type">${this.escape(content.cover.reportTypeLabel)}</div>
        </div>
        <h1>${this.escape(report.title)}</h1>
        <p class="cover-subtitle">${this.escape(content.cover.purpose)}</p>
        <div class="patient-card">
          <div class="patient-grid">
            ${content.patientBasicInfo.cards
              .map(
                (card) => `
              <div class="meta-card">
                <div class="meta-label">${this.escape(card.label)}</div>
                <div class="meta-value">${this.escape(card.value)}</div>
              </div>`,
              )
              .join('')}
          </div>
          <div class="disclaimer-box">${this.escape(content.disclaimerBlocks.cover)}</div>
        </div>
      </div>
      <div class="disclaimer-box">${this.escape(content.disclaimerBlocks.footer)}</div>
    </section>

    <section class="page-break">
      <h2 class="section-title">目录</h2>
      <ul class="toc-list">
        ${[
          '1. 执行摘要',
          '2. 患者基础信息',
          '3. 历史病例整理摘要',
          '4. 近期 TremorGuard 监测概览',
          '5. 震颤事件时间分布分析',
          '6. 震颤强度分层分析',
          '7. 用药执行与时机分析',
          '8. 症状-用药关联性观察',
          '9. 信息缺口与建议补充项',
          '10. 复诊准备清单',
          '11. 结论与免责声明',
        ]
          .map(
            (item, index) => `
          <li class="toc-item">
            <span>${this.escape(item)}</span>
            <span>${index + 2}</span>
          </li>`,
          )
          .join('')}
      </ul>
    </section>

    <section class="page-break">
      <h2 class="section-title">1. 执行摘要</h2>
      <div class="subsection">
        <h3>综合判断</h3>
        <p>${this.escape(content.executiveSummary.narrative)}</p>
      </div>
      <div class="two-col">
        <div class="chart-card">
          <h4>本次监测亮点</h4>
          <ul>${content.executiveSummary.highlights.map((item) => `<li>${this.escape(item)}</li>`).join('')}</ul>
        </div>
        <div class="chart-card">
          <h4>需要重点留意</h4>
          <ul>${content.executiveSummary.cautionFlags.map((item) => `<li>${this.escape(item)}</li>`).join('')}</ul>
        </div>
      </div>

      <h2 class="section-title">2. 患者基础信息</h2>
      <table class="table">
        <thead><tr><th>字段</th><th>内容</th></tr></thead>
        <tbody>
          ${content.patientBasicInfo.cards
            .map(
              (card) => `
            <tr><td>${this.escape(card.label)}</td><td>${this.escape(card.value)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <h2 class="section-title">3. 历史病例整理摘要</h2>
      <div class="subsection">
        <h3>档案归纳</h3>
        <p>${this.escape(content.historicalRecordSummary.narrative)}</p>
      </div>
      <div class="chart-card">
        <h4>已整理的关键资料线索</h4>
        <ul>${content.historicalRecordSummary.sourceHighlights
          .map((item) => `<li>${this.escape(item)}</li>`)
          .join('')}</ul>
      </div>

      <h2 class="section-title">4. 近期 TremorGuard 监测概览</h2>
      <div class="kpi-grid">
        ${content.monitoringKpis.cards
          .map(
            (card) => `
          <div class="kpi-card">
            <div class="kpi-label">${this.escape(card.label)}</div>
            <div class="kpi-value">${this.escape(card.value)}</div>
            <div class="kpi-helper">${this.escape(card.helper)}</div>
          </div>`,
          )
          .join('')}
      </div>

      <div class="chart-grid">
        <div class="chart-card">
          <h4>震颤事件频率折线图</h4>
          ${this.buildLineChart(content.visualization.trendSeries)}
        </div>
        <div class="chart-card">
          <h4>震颤幅度分布直方图</h4>
          ${this.buildHistogram(content.visualization.histogram)}
        </div>
      </div>

      <h2 class="section-title">5. 震颤事件时间分布分析</h2>
      <div class="subsection">
        <h3>时间窗解读</h3>
        <p>${this.escape(content.tremorTimeDistribution.summary)}</p>
      </div>
      <table class="table">
        <thead><tr><th>时间窗</th><th>事件数</th><th>平均幅度</th></tr></thead>
        <tbody>
          ${content.tremorTimeDistribution.buckets
            .map(
              (bucket) => `
            <tr>
              <td>${this.escape(bucket.label)}</td>
              <td>${bucket.count}</td>
              <td>${bucket.averageAmplitude.toFixed(3)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <h2 class="section-title">6. 震颤强度分层分析</h2>
      <div class="subsection">
        <h3>强度分层结论</h3>
        <p>${this.escape(content.tremorSeverity.summary)}</p>
      </div>
      <table class="table">
        <thead><tr><th>级别</th><th>阈值</th><th>事件数</th><th>占比</th></tr></thead>
        <tbody>
          ${content.tremorSeverity.bands
            .map(
              (band) => `
            <tr>
              <td>${this.escape(band.label)}</td>
              <td>${this.escape(band.threshold)}</td>
              <td>${band.count}</td>
              <td>${this.escape(band.share)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <h2 class="section-title">7. 用药执行与时机分析</h2>
      <div class="subsection">
        <h3>用药评估</h3>
        <p>${this.escape(content.medicationAnalysis.summary)}</p>
      </div>
      <div class="two-col">
        <div class="chart-card">
          <h4>用药执行时间轴</h4>
          <div class="timeline">
            ${content.medicationAnalysis.timeline
              .map((item) => this.buildTimelineItem(item))
              .join('')}
          </div>
        </div>
        <div class="chart-card">
          <h4>用药执行 KPI</h4>
          <ul>
            <li>总日剂量：${this.escape(content.medicationAnalysis.totalDailyDose)}</li>
            <li>依从率：${this.escape(content.medicationAnalysis.adherenceRate)}</li>
          </ul>
          <div class="callout">
            ${content.medicationAnalysis.safetyNotes.map((item) => this.escape(item)).join(' ')}
          </div>
        </div>
      </div>

      <h2 class="section-title">8. 症状-用药关联性观察</h2>
      <div class="subsection">
        <h3>关联性解读</h3>
        <p>${this.escape(content.symptomMedicationInterpretation.summary)}</p>
      </div>
      <div class="chart-grid">
        <div class="chart-card">
          <h4>症状-用药关联散点图</h4>
          ${this.buildScatter(content.visualization.medicationScatter)}
        </div>
        <div class="chart-card">
          <h4>关键观察</h4>
          <ul>${content.symptomMedicationInterpretation.observations
            .map((item) => `<li>${this.escape(item)}</li>`)
            .join('')}</ul>
          <div class="callout">${this.escape(content.symptomMedicationInterpretation.caution)}</div>
        </div>
      </div>

      <h2 class="section-title">9. 信息缺口与建议补充项</h2>
      <div class="subsection">
        <h3>为什么仍需补充</h3>
        <p>${this.escape(content.informationGaps.summary)}</p>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>评估项</th>
            <th>临床意义</th>
            <th>建议补充</th>
            <th>复诊建议提问</th>
          </tr>
        </thead>
        <tbody>
          ${content.informationGaps.items
            .map(
              (item) => `
            <tr>
              <td>${this.escape(item.title)}</td>
              <td>${this.escape(item.whyItMatters)}</td>
              <td>${this.escape(item.nextAction)}</td>
              <td>${this.escape(item.followUpQuestion)}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <h2 class="section-title">10. 复诊准备清单</h2>
      <div class="two-col">
        <div class="chart-card">
          <h4>复诊携带与沟通重点</h4>
          <ul>${content.followUpChecklist.visitChecklist
            .map((item) => `<li>${this.escape(item)}</li>`)
            .join('')}</ul>
        </div>
        <div class="chart-card">
          <h4>居家继续观察</h4>
          <ul>${content.followUpChecklist.homeObservationChecklist
            .map((item) => `<li>${this.escape(item)}</li>`)
            .join('')}</ul>
        </div>
      </div>
      <div class="chart-card">
        <h4>建议主动向医生提问</h4>
        <ul>${content.followUpChecklist.clinicianQuestions
          .map((item) => `<li>${this.escape(item)}</li>`)
          .join('')}</ul>
      </div>

      <h2 class="section-title">11. 结论与免责声明</h2>
      <div class="conclusion">
        <p>${this.escape(content.conclusion)}</p>
      </div>
      <div class="footer-note">${this.escape(content.disclaimerBlocks.conclusion)}</div>
    </section>
  </body>
</html>`
  }

  private buildLineChart(points: ReportSvgPoint[]) {
    const width = 520
    const height = 220
    const padding = 28
    const maxValue = Math.max(...points.map((point) => point.value), 1)
    const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0

    const polyline = points
      .map((point, index) => {
        const x = padding + stepX * index
        const y = height - padding - ((height - padding * 2) * point.value) / maxValue
        return `${x},${y}`
      })
      .join(' ')

    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="震颤事件频率折线图">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#d7e3ed" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#d7e3ed" />
      <polyline fill="none" stroke="#1e5f8c" stroke-width="3" points="${polyline}" />
      ${points
        .map((point, index) => {
          const x = padding + stepX * index
          const y = height - padding - ((height - padding * 2) * point.value) / maxValue
          return `
            <circle cx="${x}" cy="${y}" r="4" fill="#1e5f8c" />
            <text x="${x}" y="${height - 8}" font-size="10" text-anchor="middle" fill="#64748b">${this.escape(
              point.label,
            )}</text>
          `
        })
        .join('')}
    </svg>`
  }

  private buildHistogram(points: ReportSvgPoint[]) {
    const width = 520
    const height = 220
    const padding = 28
    const barWidth = (width - padding * 2) / Math.max(points.length, 1) - 12
    const maxValue = Math.max(...points.map((point) => point.value), 1)

    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="震颤幅度分布直方图">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#d7e3ed" />
      ${points
        .map((point, index) => {
          const x = padding + index * ((width - padding * 2) / Math.max(points.length, 1)) + 6
          const barHeight = ((height - padding * 2) * point.value) / maxValue
          const y = height - padding - barHeight
          return `
            <rect x="${x}" y="${y}" width="${Math.max(barWidth, 18)}" height="${barHeight}" rx="6" fill="#2c5f4a" opacity="0.9" />
            <text x="${x + Math.max(barWidth, 18) / 2}" y="${height - 8}" font-size="10" text-anchor="middle" fill="#64748b">${this.escape(point.label)}</text>
          `
        })
        .join('')}
    </svg>`
  }

  private buildScatter(points: ReportScatterPoint[]) {
    const width = 520
    const height = 220
    const padding = 28
    const maxX = Math.max(...points.map((point) => point.x), 1)
    const maxY = Math.max(...points.map((point) => point.y), 1)

    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="症状-用药关联散点图">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#d7e3ed" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#d7e3ed" />
      ${points
        .map((point) => {
          const x = padding + ((width - padding * 2) * point.x) / maxX
          const y = height - padding - ((height - padding * 2) * point.y) / maxY
          return `
            <circle cx="${x}" cy="${y}" r="5" fill="#d97706" opacity="0.85" />
            <text x="${x + 8}" y="${y - 8}" font-size="9" fill="#64748b">${this.escape(point.label)}</text>
          `
        })
        .join('')}
    </svg>`
  }

  private buildTimelineItem(item: ReportMedicationTimelineItem) {
    return `<div class="timeline-item">
      <div class="timeline-time">${this.escape(item.time)}</div>
      <div class="timeline-body">
        <strong>${this.escape(item.medication)}</strong> · ${this.escape(item.dosage)} · ${this.escape(item.status)}
      </div>
    </div>`
  }

  private escape(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }
}
