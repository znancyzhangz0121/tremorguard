import { Injectable } from '@nestjs/common'
import { chromium } from 'playwright-core'
import { LongitudinalReport } from './medical-records.types'
import { MedicalRecordsReportTemplateService } from './medical-records.report-template.service'

@Injectable()
export class MedicalRecordsReportPdfService {
  constructor(
    private readonly templateService: MedicalRecordsReportTemplateService,
  ) {}

  async generateReportAssets(report: LongitudinalReport) {
    const html = this.templateService.buildHtml(report)
    const browser = await chromium.launch({
      executablePath: this.resolveExecutablePath(),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    let page: Awaited<ReturnType<typeof browser.newPage>> | null = null

    try {
      page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'load' })
      const pdfBuffer = await page.pdf({
        format: 'A4',
        displayHeaderFooter: true,
        margin: {
          top: '26mm',
          bottom: '18mm',
          left: '14mm',
          right: '14mm',
        },
        headerTemplate: this.buildHeaderTemplate(report),
        footerTemplate: this.buildFooterTemplate(report),
        printBackground: true,
      })

      return {
        html,
        pdfBuffer,
      }
    } finally {
      if (page) {
        await page.close()
      }
      await browser.close()
    }
  }

  private resolveExecutablePath() {
    return (
      process.env.CHROME_EXECUTABLE_PATH ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    )
  }

  private buildHeaderTemplate(report: LongitudinalReport) {
    return `
      <div style="width: 100%; font-size: 9px; padding: 0 16px; color: #475569; display: flex; justify-content: space-between; align-items: center;">
        <span>${this.escape(report.title)}</span>
        <span>${this.escape(report.content.cover.patientName)}</span>
      </div>
    `
  }

  private buildFooterTemplate(report: LongitudinalReport) {
    return `
      <div style="width: 100%; font-size: 8px; padding: 0 16px; color: #64748b; display: flex; justify-content: space-between; align-items: center;">
        <span>${this.escape(report.content.disclaimerBlocks.footer)}</span>
        <span class="pageNumber"></span>/<span class="totalPages"></span>
      </div>
    `
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
