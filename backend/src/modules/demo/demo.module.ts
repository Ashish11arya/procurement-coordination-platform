import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DemoService } from './demo.service';
import { DemoController } from './demo.controller';
import { Centre, CentreSchema } from '../centres/schemas/centre.schema';
import { Counter, CounterSchema } from '../centres/schemas/counter.schema';
import { ArrivalWindow, ArrivalWindowSchema } from '../bookings/schemas/arrival-window.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { BookingVehicle, BookingVehicleSchema } from '../bookings/schemas/booking-vehicle.schema';
import { QueueState, QueueStateSchema } from '../queue/schemas/queue-state.schema';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { EventsModule } from '../../infrastructure/events/events.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Centre.name, schema: CentreSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: ArrivalWindow.name, schema: ArrivalWindowSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: BookingVehicle.name, schema: BookingVehicleSchema },
      { name: QueueState.name, schema: QueueStateSchema },
    ]),
    SchedulingModule,
    EventsModule,
  ],
  controllers: [DemoController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
