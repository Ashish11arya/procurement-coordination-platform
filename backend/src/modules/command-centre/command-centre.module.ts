import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommandCentreController } from './command-centre.controller';
import { CommandCentreService } from './command-centre.service';
import { Centre, CentreSchema } from '../centres/schemas/centre.schema';
import { Counter, CounterSchema } from '../centres/schemas/counter.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { QueueState, QueueStateSchema } from '../queue/schemas/queue-state.schema';
import { ArrivalWindow, ArrivalWindowSchema } from '../bookings/schemas/arrival-window.schema';
import {
  ProcurementRecord,
  ProcurementRecordSchema,
} from '../operations/schemas/procurement-record.schema';
import { IntegrationsModule } from '../integrations/integrations.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Centre.name, schema: CentreSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: QueueState.name, schema: QueueStateSchema },
      { name: ArrivalWindow.name, schema: ArrivalWindowSchema },
      { name: ProcurementRecord.name, schema: ProcurementRecordSchema },
    ]),
    IntegrationsModule,
    RedisModule,
  ],
  controllers: [CommandCentreController],
  providers: [CommandCentreService],
  exports: [CommandCentreService],
})
export class CommandCentreModule {}
