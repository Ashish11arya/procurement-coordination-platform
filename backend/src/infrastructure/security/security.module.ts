import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityService } from './security.service';
import { IdempotencyService } from './idempotency.service';
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
  providers: [SecurityService, IdempotencyService],
  exports: [SecurityService, IdempotencyService],
})
export class SecurityModule {}
