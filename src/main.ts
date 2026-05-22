import { existsSync } from 'fs';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

/** Serve Vite build for GET only; never intercept POST /api (fixes empty 200 on auth). */
function attachSpaFallback(app: NestExpressApplication): void {
  const clientPath = join(process.cwd(), 'client');
  const indexHtml = join(clientPath, 'index.html');
  if (!existsSync(indexHtml)) {
    return;
  }
  app.useStaticAssets(clientPath, { index: false });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    if (req.path.startsWith('/api')) {
      return next();
    }
    if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
      return next();
    }
    res.sendFile(indexHtml, (err: Error | null) => {
      if (err) {
        next();
      }
    });
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.setGlobalPrefix('api');
  const defaultCorsOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];
  const extraOrigins =
    process.env.CORS_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? [];
  app.enableCors({
    origin: [...defaultCorsOrigins, ...extraOrigins],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  attachSpaFallback(app);
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
