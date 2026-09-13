import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

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
  app.use(helmet());

  // Cookie Parser for HttpOnly Refresh Tokens
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'],
  });

  // Global Prefix
  app.setGlobalPrefix(apiPrefix);

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

  await app.listen(port);
  logger.log(`================================================================`);
  logger.log(`[GOV-PROCUREMENT PLATFORM] Backend started on port: ${port}`);
  logger.log(`[GOV-PROCUREMENT PLATFORM] API Root: http://localhost:${port}/${apiPrefix}`);
  logger.log(`[GOV-PROCUREMENT PLATFORM] Active Provider: ${configService.get('GOVERNMENT_PROVIDER', 'MOCK')}`);
  logger.log(`================================================================`);
}

bootstrap();
