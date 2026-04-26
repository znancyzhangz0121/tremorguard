import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      service: 'tremor-guard-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
