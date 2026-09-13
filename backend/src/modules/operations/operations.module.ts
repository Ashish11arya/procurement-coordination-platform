import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { WeighingRecord, WeighingRecordSchema } from './schemas/weighing-record.schema';
import { QualityRecord, QualityRecordSchema } from './schemas/quality-record.schema';
import { ProcurementRecord, ProcurementRecordSchema } from './schemas/procurement-record.schema';
import { ServiceSession, ServiceSessionSchema } from './schemas/service-session.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { QueueState, QueueStateSchema } from '../queue/schemas/queue-state.schema';
import { Centre, CentreSchema } from '../centres/schemas/centre.schema';
import { Counter, CounterSchema } from '../centres/schemas/counter.schema';
import { ArrivalWindow, ArrivalWindowSchema } from '../bookings/schemas/arrival-window.schema';
import { QueueModule } from '../queue/queue.module';
import { AuditModule } from '../audit/audit.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WeighingRecord.name, schema: WeighingRecordSchema },
      { name: QualityRecord.name, schema: QualityRecordSchema },
      { name: ProcurementRecord.name, schema: ProcurementRecordSchema },
      { name: ServiceSession.name, schema: ServiceSessionSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: QueueState.name, schema: QueueStateSchema },
      { name: Centre.name, schema: CentreSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: ArrivalWindow.name, schema: ArrivalWindowSchema },
    ]),
    QueueModule,
    AuditModule,
    IntegrationsModule,
    RedisModule,
  ],
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
