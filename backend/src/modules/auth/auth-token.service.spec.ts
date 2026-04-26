import { ConfigService } from '@nestjs/config';
import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService', () => {
  const service = new AuthTokenService(
    new ConfigService({
      JWT_SECRET: 'unit-test-secret',
    }),
  );

  it('signs and verifies a token payload', () => {
    const token = service.signToken({
      sub: 'user-1',
      email: 'TeSt@example.com',
      name: 'Test User',
    });

    expect(service.verifyToken(token)).toMatchObject({
      sub: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    });
  });

  it('rejects a tampered token', () => {
    const token = service.signToken({
      sub: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    });
    const [payload] = token.split('.');

    expect(() => service.verifyToken(`${payload}.tampered`)).toThrow(
      '登录状态已失效，请重新登录',
    );
  });
});
