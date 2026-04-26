import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceStoreService } from './device-store.service';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [AuthModule],
  controllers: [DevicesController],
  providers: [DevicesService, DeviceStoreService],
  exports: [DevicesService, DeviceStoreService],
})
export class DevicesModule {}
