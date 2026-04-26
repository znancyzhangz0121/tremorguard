import { Injectable } from '@nestjs/common';

@Injectable()
export class TremorService {
  getTimeline() {
    return Array.from({ length: 24 }, (_, hour) => {
      const time = `${String(hour).padStart(2, '0')}:00`;
      const isMedication = [8, 13, 18].includes(hour);
      const intensity =
        hour === 10 || hour === 11 || hour === 15 || hour === 16
          ? Number((6.2 + (hour % 2) * 1.1).toFixed(2))
          : Number((0.9 + ((hour * 7) % 12) * 0.12).toFixed(2));

      return {
        time,
        intensity,
        isMedication,
        frequency: intensity > 4 ? '5.2' : '1.1',
      };
    });
  }
}
