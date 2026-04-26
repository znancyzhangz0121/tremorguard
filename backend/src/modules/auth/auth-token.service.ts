import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type AuthTokenPayload = {
  sub: string;
  email: string;
  name: string;
  exp: number;
};

type SignTokenInput = {
  sub: string;
  email: string;
  name: string;
};

@Injectable()
export class AuthTokenService {
  constructor(private readonly configService: ConfigService) {}

  signToken(input: SignTokenInput) {
    const payload: AuthTokenPayload = {
      sub: input.sub,
      email: input.email.trim().toLowerCase(),
      name: input.name,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    };
    const encodedPayload = this.encode(payload);
    const signature = this.sign(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  verifyToken(token: string) {
    const [encodedPayload, receivedSignature] = token.split('.');

    if (!encodedPayload || !receivedSignature) {
      throw new UnauthorizedException('登录状态无效，请重新登录');
    }

    const expectedSignature = this.sign(encodedPayload);

    if (!this.safeEqual(receivedSignature, expectedSignature)) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    const payload = this.decode<AuthTokenPayload>(encodedPayload);

    if (!payload?.email || !payload?.sub || !payload?.exp) {
      throw new UnauthorizedException('登录状态无效，请重新登录');
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }

    return {
      ...payload,
      email: payload.email.trim().toLowerCase(),
    };
  }

  private sign(value: string) {
    return createHmac('sha256', this.getSecret()).update(value).digest('base64url');
  }

  private encode(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private decode<T>(value: string) {
    try {
      return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
    } catch {
      throw new UnauthorizedException('登录状态无效，请重新登录');
    }
  }

  private getSecret() {
    return this.configService.get<string>('JWT_SECRET')?.trim() || 'tremor-guard-dev-secret';
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
