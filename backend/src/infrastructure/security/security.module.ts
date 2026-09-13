import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityService } from './security.service';
import { IdempotencyService } from './idempotency.service';
import { CsrfGuard } from './csrf.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { MongoSanitizeMiddleware } from './mongo-sanitize.middleware';
import {
  IdempotencyRecord,
  IdempotencyRecordSchema,
} from './schemas/idempotency-record.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IdempotencyRecord.name, schema: IdempotencyRecordSchema },
    ]),
  ],
  providers: [
    SecurityService,
    IdempotencyService,
    CsrfGuard,
    RateLimitGuard,
    MongoSanitizeMiddleware,
  ],
  exports: [
    SecurityService,
    IdempotencyService,
    CsrfGuard,
    RateLimitGuard,
    MongoSanitizeMiddleware,
  ],
})
export class SecurityModule {}

