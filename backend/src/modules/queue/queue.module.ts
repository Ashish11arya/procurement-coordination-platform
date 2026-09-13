import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QueueState, QueueStateSchema } from './schemas/queue-state.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { SchedulingModule } from '../scheduling/scheduling.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QueueState.name, schema: QueueStateSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
    SchedulingModule,
  ],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService, MongooseModule],
})
export class QueueModule {}
