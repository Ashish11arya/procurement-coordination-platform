import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConsentRecord, ConsentRecordSchema } from './schemas/consent.schema';
import { DataProcessingLog, DataProcessingLogSchema } from './schemas/data-processing-log.schema';
import { DataProcessingLogService } from './services/data-processing-log.service';
import { RetentionService } from './services/retention.service';
import { ComplianceController } from './compliance.controller';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { AuditLog, AuditLogSchema } from '../audit/schemas/audit-log.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConsentRecord.name, schema: ConsentRecordSchema },
      { name: DataProcessingLog.name, schema: DataProcessingLogSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [ComplianceController],
  providers: [DataProcessingLogService, RetentionService],
  exports: [
    MongooseModule,
    DataProcessingLogService,
    RetentionService,
  ],
})
export class ComplianceModule {}
