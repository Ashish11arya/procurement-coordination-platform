import * as path from 'path';
import * as fs from 'fs';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { Role } from './shared/enums/roles.enum';
import { SecurityService } from './infrastructure/security/security.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const allowedOrigins = configService
    .get<string>('CORS_ORIGIN', 'http://localhost:3000,http://localhost:5173')
    .split(',');

  // Security Headers (Section 19)
  app.use(
    helmet({
      contentSecurityPolicy: false, // Permissive for local static assets and Google Fonts
    }),
  );

  // Serve static frontend assets
  const candidateFrontendDirs = [
    path.resolve(process.cwd(), 'frontend'),
    path.resolve(process.cwd(), '../frontend'),
    path.resolve(__dirname, '../../frontend'),
    path.resolve(__dirname, '../../../frontend'),
  ];
  const frontendDir = candidateFrontendDirs.find((dir) => fs.existsSync(dir));
  if (frontendDir) {
    app.use(express.static(frontendDir));
    logger.log(`[Static] Serving frontend UI from: ${frontendDir}`);
  }

  // Cookie Parser for HttpOnly Refresh Tokens
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'],
  });

  // Global Prefix with root health/ready/live probes
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health', 'ready', 'live'],
  });

  // Strict Validation Pipe (Section 19)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Auto-seed demo centre if database is freshly initialized
  try {
    const centreModel = app.get('CentreModel', { strict: false });
    const counterModel = app.get('CounterModel', { strict: false });
    if (centreModel) {
      const count = await centreModel.countDocuments().exec();
      if (count === 0) {
        logger.log('[AutoSeed] Populating initial demo mandi and operational counters...');
        await centreModel.create({
          centreId: 'CENTRE-MP-IND-01',
          name: 'Sanwer Krishi Upaj Mandi',
          agencyName: 'MP State Civil Supplies Corporation',
          operatingSeason: 'RABI_2026',
          state: 'Madhya Pradesh',
          district: 'Indore',
          address: 'Khandwa-Ujjain Highway, Sanwer, Madhya Pradesh 453551',
          coordinates: { latitude: 22.9734, longitude: 75.8234 },
          dailyCapacityQuintals: 500,
          maxSimultaneousVehicles: 8,
          operatingHours: { openTime: '09:00', closeTime: '18:00' },
          supportedCommodities: ['WHEAT', 'MUSTARD', 'GRAM'],
          isActive: true,
        });
        if (counterModel) {
          const demoCounters = [
            { counterId: 'CTR-CHK-01', centreId: 'CENTRE-MP-IND-01', counterNumber: 1, stage: 'CHECKIN', status: 'ACTIVE', capacityPerHourQuintals: 50 },
            { counterId: 'CTR-WEIGH-01', centreId: 'CENTRE-MP-IND-01', counterNumber: 2, stage: 'WEIGHING', status: 'ACTIVE', capacityPerHourQuintals: 30 },
            { counterId: 'CTR-WEIGH-02', centreId: 'CENTRE-MP-IND-01', counterNumber: 3, stage: 'WEIGHING', status: 'ACTIVE', capacityPerHourQuintals: 25 },
            { counterId: 'CTR-QUAL-01', centreId: 'CENTRE-MP-IND-01', counterNumber: 4, stage: 'QUALITY', status: 'ACTIVE', capacityPerHourQuintals: 40 },
            { counterId: 'CTR-PROC-01', centreId: 'CENTRE-MP-IND-01', counterNumber: 5, stage: 'PROCUREMENT', status: 'ACTIVE', capacityPerHourQuintals: 50 },
          ];
          for (const c of demoCounters) {
            await counterModel.create(c);
          }
        }
        logger.log('[AutoSeed] Mandi and operational counters seeded successfully.');
      }
    }

    const userModel = app.get(getModelToken('User'), { strict: false });
    if (userModel) {
      const existingOperator = await userModel.findOne({ username: 'operator' });
      if (!existingOperator) {
        const securityService = app.get(SecurityService);
        const operatorHash = await securityService.hashPassword('Operator@123');
        await userModel.create({
          username: 'operator',
          email: 'operator@sanwer.gov.in',
          name: 'Sanwer Mandi In-Charge',
          passwordHash: operatorHash,
          role: Role.CENTRE_ADMIN,
          centreId: 'CENTRE-MP-IND-01',
          isActive: true,
        });

        const adminHash = await securityService.hashPassword('Admin@123');
        await userModel.create({
          username: 'admin',
          email: 'admin@gov.in',
          name: 'Central Control Officer',
          passwordHash: adminHash,
          role: Role.GOVERNMENT_ADMIN,
          isActive: true,
        });
        logger.log('[AutoSeed] Default admin and operator users created.');
      }
    }
  } catch (err: any) {
    logger.warn(`[AutoSeed] Skipped or failed: ${err.message}`);
  }

  await app.listen(port);
  logger.log(`================================================================`);
  logger.log(`[GOV-PROCUREMENT PLATFORM] Backend & UI running at: http://localhost:${port}`);
  logger.log(`[GOV-PROCUREMENT PLATFORM] API Root: http://localhost:${port}/${apiPrefix}`);
  logger.log(`[GOV-PROCUREMENT PLATFORM] Active Provider: ${configService.get('GOVERNMENT_PROVIDER', 'MOCK')}`);
  logger.log(`================================================================`);
}

bootstrap();
