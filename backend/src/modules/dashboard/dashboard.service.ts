import { Inject, Injectable } from '@nestjs/common';
import { UserStoreService } from '../users/user-store.service';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(UserStoreService)
    private readonly userStoreService: UserStoreService,
  ) {}

  async getSummary(email?: string) {
    const storedUser = email ? await this.userStoreService.findByEmail(email) : null;
    const patientName = this.normalizeDisplayName(storedUser?.name) ?? '用户';
    const patientDisplayName = patientName;

    return {
      patient: {
        name: patientName,
        displayName: patientDisplayName,
        id: 'TG-882910',
        email: storedUser?.email ?? '',
        age: storedUser?.age ?? null,
      },
      header: {
        greeting: `你好，${patientDisplayName}`,
        statusText: '今日震颤状态平稳，用药依从性良好。',
      },
      stats: [
        { label: '平均震颤强度', value: '2.8', unit: 'RMS', color: 'text-blue-600' },
        { label: '峰值震颤强度', value: '8.2', unit: 'RMS', color: 'text-slate-800' },
        { label: '用药完成度', value: '100%', unit: '3/3次', color: 'text-green-600' },
        { label: '有效佩戴时长', value: '18.5', unit: '小时', color: 'text-slate-800' },
      ],
      insights: {
        summary:
          '系统检测到您的震颤在午后 15:30 达到峰值 (8.2 RMS)，此时距离您中午 13:00 的服药已过去 2.5 小时。',
        clinicalSuggestion:
          '目前的震颤主频保持在 5.2Hz，属于典型帕金森静止性震颤。建议复诊时告知医生“下午药效消退较快”的观察结果。',
      },
      device: {
        status: '已连接',
        batteryLevel: 85,
      },
    };
  }

  private normalizeDisplayName(name?: string | null) {
    const trimmedName = name?.trim();

    if (!trimmedName) {
      return null;
    }

    return trimmedName;
  }
}
