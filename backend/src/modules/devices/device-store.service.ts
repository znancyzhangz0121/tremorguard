import { Injectable } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

export type StoredDeviceBinding = {
  email: string;
  deviceName: string;
  serialNumber: string;
  verificationCode: string;
  wearSide: 'left' | 'right';
  connected: boolean;
  boundAt: string;
  updatedAt: string;
};

type DevicesFile = {
  bindings: StoredDeviceBinding[];
};

@Injectable()
export class DeviceStoreService {
  private readonly bundledFilePath = join(process.cwd(), 'data', 'devices.json');
  private readonly writableFilePath = process.env.VERCEL
    ? join(tmpdir(), 'tremor-guard-data', 'devices.json')
    : this.bundledFilePath;

  async findByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const file = await this.readDevicesFile();
    return file.bindings.find((binding) => binding.email === normalizedEmail) ?? null;
  }

  async upsert(binding: StoredDeviceBinding) {
    const file = await this.readDevicesFile();
    const normalizedEmail = binding.email.trim().toLowerCase();
    const index = file.bindings.findIndex((item) => item.email === normalizedEmail);

    if (index >= 0) {
      file.bindings[index] = { ...binding, email: normalizedEmail };
    } else {
      file.bindings.push({ ...binding, email: normalizedEmail });
    }

    await this.writeDevicesFile(file);
    return binding;
  }

  async disconnect(email: string) {
    const existing = await this.findByEmail(email);

    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      connected: false,
      updatedAt: new Date().toISOString(),
    };

    await this.upsert(updated);
    return updated;
  }

  private async readDevicesFile(): Promise<DevicesFile> {
    try {
      const raw = await readFile(this.writableFilePath, 'utf8');
      return this.parseDevicesFile(raw);
    } catch {
      const seededFile = await this.readBundledDevicesFile();
      await this.writeDevicesFile(seededFile);
      return seededFile;
    }
  }

  private async writeDevicesFile(data: DevicesFile) {
    await mkdir(dirname(this.writableFilePath), { recursive: true });
    await writeFile(this.writableFilePath, JSON.stringify(data, null, 2), 'utf8');
  }

  private async readBundledDevicesFile(): Promise<DevicesFile> {
    try {
      const raw = await readFile(this.bundledFilePath, 'utf8');
      return this.parseDevicesFile(raw);
    } catch {
      return { bindings: [] };
    }
  }

  private parseDevicesFile(raw: string): DevicesFile {
    const parsed = JSON.parse(raw) as DevicesFile;
    return {
      bindings: Array.isArray(parsed.bindings) ? parsed.bindings : [],
    };
  }
}
