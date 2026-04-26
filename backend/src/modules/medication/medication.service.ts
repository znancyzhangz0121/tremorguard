import { Injectable } from '@nestjs/common';

@Injectable()
export class MedicationService {
  getRecords() {
    return [
      { time: '08:00', status: 'done' },
      { time: '13:00', status: 'done' },
      { time: '18:00', status: 'done' },
    ];
  }

  checkIn() {
    return {
      success: true,
      message: '服药打卡成功，已同步到今日记录。',
      recordedAt: new Date().toISOString(),
    };
  }
}
