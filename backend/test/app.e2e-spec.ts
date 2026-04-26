import { ExecutionContext, INestApplicationContext, UnauthorizedException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppModule } from '../src/app.module';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthGuard, AuthenticatedRequest } from '../src/modules/auth/auth.guard';
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DevicesController } from '../src/modules/devices/devices.controller';
import { HealthController } from '../src/modules/health/health.controller';
import { MedicationController } from '../src/modules/medication/medication.controller';
import { UsersController } from '../src/modules/users/users.controller';

describe('App integration', () => {
  let app: INestApplicationContext;
  let originalCwd: string;
  let tempDir: string;
  let authController: AuthController;
  let authGuard: AuthGuard;
  let dashboardController: DashboardController;
  let devicesController: DevicesController;
  let healthController: HealthController;
  let medicationController: MedicationController;
  let usersController: UsersController;

  beforeAll(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(join(tmpdir(), 'tremor-guard-e2e-'));
    process.chdir(tempDir);
    process.env.JWT_SECRET = 'e2e-secret';

    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });

    authController = app.get(AuthController);
    authGuard = app.get(AuthGuard);
    dashboardController = app.get(DashboardController);
    devicesController = app.get(DevicesController);
    healthController = app.get(HealthController);
    medicationController = app.get(MedicationController);
    usersController = app.get(UsersController);
  });

  afterAll(async () => {
    await app.close();
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('serves the health payload', () => {
    expect(healthController.getHealth()).toMatchObject({
      status: 'ok',
      service: 'tremor-guard-backend',
    });
  });

  it('registers, authenticates, and uses protected controllers', async () => {
    const registerResponse = await authController.register({
      name: 'E2E User',
      email: 'e2e@example.com',
      age: 66,
      password: 'secret123',
    });

    expect(registerResponse.user).toMatchObject({
      name: 'E2E User',
      email: 'e2e@example.com',
      age: 66,
    });
    expect(registerResponse.token).toEqual(expect.any(String));

    const loginResponse = await authController.login({
      email: 'e2e@example.com',
      password: 'secret123',
    });

    const request = buildAuthenticatedRequest(loginResponse.token);

    expect(() => authGuard.canActivate(buildExecutionContext({ headers: {} }))).toThrow(
      UnauthorizedException,
    );

    expect(authGuard.canActivate(buildExecutionContext(request))).toBe(true);

    const summary = await dashboardController.getSummary(request);
    expect(summary.patient).toMatchObject({
      displayName: 'E2E User',
      email: 'e2e@example.com',
    });

    const bindResponse = await devicesController.bind(request, {
      deviceName: '测试手环',
      serialNumber: 'TG-TEST-001',
      verificationCode: '246810',
      wearSide: 'right',
    });
    expect(bindResponse.binding).toMatchObject({
      email: 'e2e@example.com',
      deviceName: '测试手环',
      serialNumber: 'TG-TEST-001',
      connected: true,
    });

    const deviceResponse = await devicesController.getMine(request);
    expect(deviceResponse.binding).toMatchObject({
      email: 'e2e@example.com',
      serialNumber: 'TG-TEST-001',
    });

    const userResponse = await usersController.getMe(request);
    expect(userResponse).toMatchObject({
      email: 'e2e@example.com',
      name: 'E2E User',
      age: 66,
    });

    const checkInResponse = medicationController.checkIn();
    expect(checkInResponse.success).toBe(true);

    const disconnectResponse = await devicesController.disconnect(request, {});
    expect(disconnectResponse.binding).toMatchObject({
      email: 'e2e@example.com',
      connected: false,
    });
  });
});

function buildAuthenticatedRequest(token: string): AuthenticatedRequest {
  return {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };
}

function buildExecutionContext(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}
