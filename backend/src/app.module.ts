import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DevicesModule } from './modules/devices/devices.module';
import { HealthModule } from './modules/health/health.module';
import { MedicationModule } from './modules/medication/medication.module';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module';
import { TremorModule } from './modules/tremor/tremor.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AiModule,
    AuthModule,
    DashboardModule,
    DevicesModule,
    HealthModule,
    MedicationModule,
    MedicalRecordsModule,
    TremorModule,
    UsersModule,
  ],
})
export class AppModule {}
