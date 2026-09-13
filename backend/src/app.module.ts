import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
import { AuditInterceptor } from './modules/audit/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    DatabaseModule,
    RedisModule,
    SecurityModule,
    AuditModule,
    IntegrationsModule,
    AuthModule,
    FarmersModule,
    CentresModule,
    BookingsModule,
    SchedulingModule,
    QueueModule,
    OperationsModule,
    CommandCentreModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Request correlation ID middleware (Section 19 & 26)
    consumer
      .apply((req: Request, res: Response, next: NextFunction) => {
        const correlationId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
        req.headers['x-request-id'] = correlationId;
        res.setHeader('X-Request-ID', correlationId);
        next();
      })
      .forRoutes('*');
  }
}
