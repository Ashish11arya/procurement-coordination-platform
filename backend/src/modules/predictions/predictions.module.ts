import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PredictionsService } from './predictions.service';
import { PredictionsController } from './predictions.controller';
import { PredictionLog, PredictionLogSchema } from './schemas/prediction-log.schema';
import { ServiceSession, ServiceSessionSchema } from '../operations/schemas/service-session.schema';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema';
import { QueueState, QueueStateSchema } from '../queue/schemas/queue-state.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PredictionLog.name, schema: PredictionLogSchema },
      { name: ServiceSession.name, schema: ServiceSessionSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: QueueState.name, schema: QueueStateSchema },
    ]),
  ],
  controllers: [PredictionsController],
  providers: [PredictionsService],
  exports: [PredictionsService, MongooseModule],
})
export class PredictionsModule {}
