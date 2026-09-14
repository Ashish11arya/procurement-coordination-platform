import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import * as crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { SecurityModule } from './infrastructure/security/security.module';
import { AuditModule } from './modules/audit/audit.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AuthModule } from './modules/auth/auth.module';
import { FarmersModule } from './modules/farmers/farmers.module';
import { CentresModule } from './modules/centres/centres.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { QueueModule } from './modules/queue/queue.module';
import { OperationsModule } from './modules/operations/operations.module';
import { CommandCentreModule } from './modules/command-centre/command-centre.module';
import { EventsModule } from './infrastructure/events/events.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { PredictionsModule } from './modules/predictions/predictions.module';
import { HealthModule } from './infrastructure/health/health.module';
import { DemoModule } from './modules/demo/demo.module';
import { ComplianceModule } from './modules/compliance/compliance.module';

import { CsrfGuard } from './infrastructure/security/csrf.guard';
import { RateLimitGuard } from './infrastructure/security/rate-limit.guard';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { MongoSanitizeMiddleware } from './infrastructure/security/mongo-sanitize.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    DatabaseModule,
    RedisModule,
    EventsModule,
    SecurityModule,
    AuditModule,
    ComplianceModule,
    IntegrationsModule,
    AuthModule,
    FarmersModule,
    CentresModule,
    BookingsModule,
    SchedulingModule,
    QueueModule,
    OperationsModule,
    CommandCentreModule,
    NotificationsModule,
    RealtimeModule,
    PredictionsModule,
    HealthModule,
    DemoModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 1. Request correlation ID middleware (Section 19 & 26)
    consumer
      .apply((req: Request, res: Response, next: NextFunction) => {
        const correlationId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
        req.headers['x-request-id'] = correlationId;
        res.setHeader('X-Request-ID', correlationId);
        next();
      })
      .forRoutes('*');

    // 2. NoSQL injection sanitizer middleware (Section 19)
    consumer.apply(MongoSanitizeMiddleware).forRoutes('*');
  }
}
