import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { DashboardModule } from '../dashboard/dashboard.module'
import { MedicationModule } from '../medication/medication.module'
import { TremorModule } from '../tremor/tremor.module'
import { MedicalRecordsController } from './medical-records.controller'
import { MedicalRecordsReportPdfService } from './medical-records.report-pdf.service'
import { MedicalRecordsReportTemplateService } from './medical-records.report-template.service'
import { MedicalRecordsService } from './medical-records.service'
import { MedicalRecordsStoreService } from './medical-records.store.service'

@Module({
  imports: [AuthModule, DashboardModule, TremorModule, MedicationModule],
  controllers: [MedicalRecordsController],
  providers: [
    MedicalRecordsStoreService,
    MedicalRecordsReportTemplateService,
    MedicalRecordsReportPdfService,
    MedicalRecordsService,
  ],
  exports: [MedicalRecordsService],
})
export class MedicalRecordsModule {}
