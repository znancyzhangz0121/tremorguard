import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'reflect-metadata';
import { AppModule } from './app.module';

const localOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
]);

function parseConfiguredOrigins(value: string | undefined) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function isAllowedOrigin(origin: string, configuredOrigins: Set<string>) {
  if (localOrigins.has(origin) || configuredOrigins.has(origin)) {
    return true;
  }

  try {
    const hostname = new URL(origin).hostname;
    return hostname === 'localhost' || hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

export async function createNestApp() {
  const app = await NestFactory.create(AppModule);
  const configuredOrigins = parseConfiguredOrigins(process.env.CORS_ORIGINS);

  app.enableCors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || isAllowedOrigin(origin, configuredOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tremor Guard Backend')
    .setDescription('Backend APIs for Tremor Guard')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  return app;
}

export async function createExpressApp() {
  const app = await createNestApp();
  await app.init();
  return app.getHttpAdapter().getInstance();
}

async function bootstrap() {
  const app = await createNestApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

if (require.main === module) {
  void bootstrap();
}
