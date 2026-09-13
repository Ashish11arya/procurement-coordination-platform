import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BookingVehicleDocument = BookingVehicle & Document;

export enum VehicleType {
  TRACTOR_TROLLEY = 'TRACTOR_TROLLEY',
  MINI_TRUCK = 'MINI_TRUCK',
  TRUCK_6W = 'TRUCK_6W',
  TRUCK_10W = 'TRUCK_10W',
  CART = 'CART',
  OTHER = 'OTHER',
}

export enum VehicleCheckInStatus {
  PENDING = 'PENDING',
  ARRIVED = 'ARRIVED',
  CHECKED_IN = 'CHECKED_IN',
}

@Schema({ timestamps: true, collection: 'booking_vehicles' })
export class BookingVehicle {
  @Prop({ required: true, index: true })
  bookingId: string; // References Booking.bookingId

  @Prop({ required: true, uppercase: true })
  vehicleNumber: string; // Registration plate e.g. 'MP-09-AB-1234'

  @Prop({
    required: true,
    enum: Object.values(VehicleType),
    default: VehicleType.TRACTOR_TROLLEY,
  })
  vehicleType: VehicleType;

  @Prop({ required: true, min: 0.1 })
  allocatedQuantityQuintals: number;

  @Prop({ type: String, default: null })
  driverName?: string | null;

  @Prop({ type: String, default: null })
  driverMobile?: string | null;

  @Prop({
    required: true,
    enum: Object.values(VehicleCheckInStatus),
    default: VehicleCheckInStatus.PENDING,
  })
  checkInStatus: VehicleCheckInStatus;
}

export const BookingVehicleSchema = SchemaFactory.createForClass(BookingVehicle);

BookingVehicleSchema.index({ bookingId: 1, vehicleNumber: 1 });
