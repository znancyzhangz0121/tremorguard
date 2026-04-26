import { INestApplicationContext } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AppModule } from '../src/app.module'
import { AuthController } from '../src/modules/auth/auth.controller'
import { AuthenticatedRequest } from '../src/modules/auth/auth.guard'
import { MedicalRecordsController } from '../src/modules/medical-records/medical-records.controller'
import { MedicalRecordsService } from '../src/modules/medical-records/medical-records.service'

jest.setTimeout(30000)

describe('Medical records integration', () => {
  let app: INestApplicationContext
  let originalCwd: string
  let tempDir: string
  let authController: AuthController
  let medicalRecordsController: MedicalRecordsController
  let medicalRecordsService: MedicalRecordsService

  beforeAll(async () => {
    originalCwd = process.cwd()
    tempDir = await mkdtemp(join(tmpdir(), 'tremor-guard-records-'))
    process.chdir(tempDir)
    process.env.JWT_SECRET = 'medical-records-secret'

    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    })

    authController = app.get(AuthController)
    medicalRecordsController = app.get(MedicalRecordsController)
    medicalRecordsService = app.get(MedicalRecordsService)
  })

  afterAll(async () => {
    await app.close()
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  })

  it('creates archives, uploads files, generates reports, and exports pdf', async () => {
    const registerResponse = await authController.register({
      name: 'Archive User',
      email: 'archive@example.com',
      age: 72,
      password: 'secret123',
    })
    const request = buildAuthenticatedRequest(registerResponse.token, registerResponse.user)

    const createArchiveResponse = await medicalRecordsController.createArchive(request, {
      title: '父亲历史病例档案',
      patientName: '张老先生',
      description: '整理最近几年的门诊病历图片',
      consentAccepted: true,
    })

    expect(createArchiveResponse.archive.title).toBe('父亲历史病例档案')
    expect(createArchiveResponse.archive.fileCount).toBe(0)

    const uploadResponse = await medicalRecordsController.uploadArchiveFiles(
      request,
      createArchiveResponse.archive.id,
      {
        files: [
          {
            fileName: '2024-03-门诊记录.png',
            mimeType: 'image/png',
            contentBase64: Buffer.from('fake-png-image').toString('base64'),
            note: '门诊记录提到午后药效回潮和步态变慢。',
          },
        ],
      },
    )

    expect(uploadResponse.files).toHaveLength(1)
    expect(uploadResponse.files[0].status).toBe('succeeded')
    expect(uploadResponse.files[0].extraction?.status).toBe('succeeded')

    const reportResponse = await medicalRecordsController.createReport(
      request,
      createArchiveResponse.archive.id,
      {},
    )

    expect(reportResponse.created).toBe(true)
    expect(reportResponse.report.status).toBe('succeeded')
    expect(reportResponse.report.hasPdf).toBe(true)
    expect(reportResponse.report.hasHtml).toBe(true)

    const archiveDetail = await medicalRecordsController.getArchive(
      request,
      createArchiveResponse.archive.id,
    )
    expect(archiveDetail.files).toHaveLength(1)
    expect(archiveDetail.reports).toHaveLength(1)

    const reportDetail = await medicalRecordsController.getReport(request, reportResponse.report.id)
    expect(reportDetail.report.content.disclaimer).toContain('不能替代神经内科医生')
    expect(reportDetail.report.contextSnapshot.selectedFileIds).toHaveLength(1)
    expect(reportDetail.report.content.cover.reportTypeLabel).toBe('TremorGuard 监测周期分析报告')
    expect(reportDetail.report.content.monitoringKpis.cards.length).toBeGreaterThan(0)

    const reportList = await medicalRecordsController.listAllReports(request)
    expect(reportList.reports).toHaveLength(1)
    expect(reportList.reports[0]).toMatchObject({
      id: reportResponse.report.id,
      archiveTitle: '父亲历史病例档案',
      patientName: '张老先生',
      hasPdf: true,
      hasHtml: true,
    })

    const pdf = await medicalRecordsService.getReportPdf('archive@example.com', reportResponse.report.id)
    expect(pdf.fileName.endsWith('.pdf')).toBe(true)
    expect(pdf.buffer.toString('utf8', 0, 8)).toContain('%PDF-1.4')
  })
})

function buildAuthenticatedRequest(token: string, user: { id: string; email: string; name: string }): AuthenticatedRequest {
  return {
    headers: {
      authorization: `Bearer ${token}`,
    },
    authUser: {
      sub: user.id,
      email: user.email,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    },
  }
}
