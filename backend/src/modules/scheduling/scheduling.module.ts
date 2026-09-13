import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SchedulingDecision,
  SchedulingDecisionSchema,
} from './schemas/scheduling-decision.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { ArrivalWindow, ArrivalWindowSchema } from '../bookings/schemas/arrival-window.schema';
import { Centre, CentreSchema } from '../centres/schemas/centre.schema';
import { Counter, CounterSchema } from '../centres/schemas/counter.schema';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SchedulingDecision.name, schema: SchedulingDecisionSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: ArrivalWindow.name, schema: ArrivalWindowSchema },
      { name: Centre.name, schema: CentreSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
    IntegrationsModule,
  ],
  controllers: [SchedulingController],
  providers: [SchedulingService],
  exports: [SchedulingService, MongooseModule],
})
export class SchedulingModule {}
