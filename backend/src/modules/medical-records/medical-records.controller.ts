import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AuthenticatedRequest, AuthGuard } from '../auth/auth.guard'
import { CreateArchiveDto } from './dto/create-archive.dto'
import { CreateLongitudinalReportDto } from './dto/create-report.dto'
import { UploadArchiveFilesDto } from './dto/upload-archive-files.dto'
import { MedicalRecordsService } from './medical-records.service'

@ApiTags('medical-records')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(
    @Inject(MedicalRecordsService)
    private readonly medicalRecordsService: MedicalRecordsService,
  ) {}

  @Post('archives')
  @ApiOperation({ summary: 'Create a longitudinal medical record archive' })
  createArchive(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateArchiveDto,
  ) {
    return this.medicalRecordsService.createArchive(request.authUser?.email ?? '', body)
  }

  @Get('archives')
  @ApiOperation({ summary: 'List current user medical record archives' })
  listArchives(@Req() request: AuthenticatedRequest) {
    return this.medicalRecordsService.listArchives(request.authUser?.email ?? '')
  }

  @Get('archives/:archiveId')
  @ApiOperation({ summary: 'Get medical record archive detail' })
  getArchive(
    @Req() request: AuthenticatedRequest,
    @Param('archiveId') archiveId: string,
  ) {
    return this.medicalRecordsService.getArchive(request.authUser?.email ?? '', archiveId)
  }

  @Post('archives/:archiveId/files')
  @ApiOperation({ summary: 'Append case images to a medical record archive' })
  uploadArchiveFiles(
    @Req() request: AuthenticatedRequest,
    @Param('archiveId') archiveId: string,
    @Body() body: UploadArchiveFilesDto,
  ) {
    return this.medicalRecordsService.uploadArchiveFiles(
      request.authUser?.email ?? '',
      archiveId,
      body,
    )
  }

  @Get('archives/:archiveId/files')
  @ApiOperation({ summary: 'List files within a medical record archive' })
  listArchiveFiles(
    @Req() request: AuthenticatedRequest,
    @Param('archiveId') archiveId: string,
  ) {
    return this.medicalRecordsService.listArchiveFiles(request.authUser?.email ?? '', archiveId)
  }

  @Post('archives/:archiveId/reports')
  @ApiOperation({ summary: 'Generate a longitudinal report for an archive' })
  createReport(
    @Req() request: AuthenticatedRequest,
    @Param('archiveId') archiveId: string,
    @Body() body: CreateLongitudinalReportDto,
  ) {
    return this.medicalRecordsService.createReport(
      request.authUser?.email ?? '',
      archiveId,
      body,
    )
  }

  @Get('archives/:archiveId/reports')
  @ApiOperation({ summary: 'List longitudinal reports for an archive' })
  listReports(
    @Req() request: AuthenticatedRequest,
    @Param('archiveId') archiveId: string,
  ) {
    return this.medicalRecordsService.listReports(request.authUser?.email ?? '', archiveId)
  }

  @Get('reports/:reportId')
  @ApiOperation({ summary: 'Get a longitudinal report detail' })
  getReport(
    @Req() request: AuthenticatedRequest,
    @Param('reportId') reportId: string,
  ) {
    return this.medicalRecordsService.getReport(request.authUser?.email ?? '', reportId)
  }

  @Get('reports')
  @ApiOperation({ summary: 'List all longitudinal reports for current user' })
  listAllReports(@Req() request: AuthenticatedRequest) {
    return this.medicalRecordsService.listAllReports(request.authUser?.email ?? '')
  }

  @Get('reports/:reportId/pdf')
  @ApiOperation({ summary: 'Download a longitudinal report PDF' })
  async downloadReportPdf(
    @Req() request: AuthenticatedRequest,
    @Param('reportId') reportId: string,
  ) {
    const pdf = await this.medicalRecordsService.getReportPdf(
      request.authUser?.email ?? '',
      reportId,
    )

    return new StreamableFile(pdf.buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${pdf.fileName}"`,
    })
  }
}
