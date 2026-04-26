import { Inject, Injectable } from '@nestjs/common';
import { BindDeviceDto } from './dto/bind-device.dto';
import { DeviceStoreService } from './device-store.service';

@Injectable()
export class DevicesService {
  constructor(
    @Inject(DeviceStoreService)
    private readonly deviceStoreService: DeviceStoreService,
  ) {}

  async getMine(email: string) {
    const binding = await this.deviceStoreService.findByEmail(email);

    return {
      binding,
    };
  }

  async bind(email: string, body: BindDeviceDto) {
    const now = new Date().toISOString();
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.deviceStoreService.findByEmail(normalizedEmail);

    const binding = await this.deviceStoreService.upsert({
      email: normalizedEmail,
      deviceName: body.deviceName.trim(),
      serialNumber: body.serialNumber.trim().toUpperCase(),
      verificationCode: body.verificationCode.trim(),
      wearSide: body.wearSide,
      connected: true,
      boundAt: existing?.boundAt ?? now,
      updatedAt: now,
    });

    return {
      success: true,
      binding,
    };
  }

  async disconnect(email: string) {
    const binding = await this.deviceStoreService.disconnect(email);

    return {
      success: true,
      binding,
    };
  }
}
