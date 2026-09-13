import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from './schemas/booking.schema';
import {
  BookingVehicle,
  BookingVehicleSchema,
} from './schemas/booking-vehicle.schema';
import {
  ArrivalWindow,
  ArrivalWindowSchema,
} from './schemas/arrival-window.schema';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { FarmersModule } from '../farmers/farmers.module';
import { CentresModule } from '../centres/centres.module';
import { SecurityModule } from '../../infrastructure/security/security.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: BookingVehicle.name, schema: BookingVehicleSchema },
      { name: ArrivalWindow.name, schema: ArrivalWindowSchema },
    ]),
    FarmersModule,
    CentresModule,
    SecurityModule,
    IntegrationsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService, MongooseModule],
})
export class BookingsModule {}
