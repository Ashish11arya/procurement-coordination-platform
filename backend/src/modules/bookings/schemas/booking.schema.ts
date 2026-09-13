import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BookingDocument = Booking & Document;

export enum BookingStatus {
  BOOKED = 'BOOKED',
  CONFIRMED = 'CONFIRMED',
  ARRIVED = 'ARRIVED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

@Schema({ _id: false })
export class ArrivalWindowDetails {
  @Prop({ required: true })
  slotIndex: number;

  @Prop({ required: true })
  startTime: string; // e.g. '09:00'

  @Prop({ required: true })
  endTime: string; // e.g. '10:00'
}

@Schema({ timestamps: true, collection: 'bookings' })
export class Booking {
  @Prop({ required: true, unique: true, index: true })
  bookingId: string; // e.g. 'BK-20260913-IND01-0001'

  @Prop({ required: true, index: true })
  tokenNumber: string; // Daily sequence token e.g. 'T-001'

  @Prop({ required: true, index: true })
  farmerId: string; // References Farmer.farmerId

  @Prop({ required: true, index: true })
  centreId: string; // References Centre.centreId

  @Prop({ required: true, index: true, uppercase: true })
  commodityCode: string; // e.g. 'WHEAT'

  @Prop({ required: true, min: 0.1 })
  quantityQuintals: number;

  @Prop({ required: true, index: true })
  bookingDate: string; // 'YYYY-MM-DD'

  @Prop({ type: ArrivalWindowDetails, required: true })
  arrivalWindow: ArrivalWindowDetails;

  @Prop({ required: true, min: 1, default: 1 })
  vehicleCount: number;

  @Prop({
    required: true,
    enum: Object.values(BookingStatus),
    default: BookingStatus.BOOKED,
    index: true,
  })
  status: BookingStatus;

  @Prop({ type: String, default: null, index: { sparse: true } })
  idempotencyKey?: string | null;

  @Prop({ type: String, default: null })
  cancellationReason?: string | null;

  @Prop({ type: Date, default: null })
  cancelledAt?: Date | null;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

BookingSchema.index({ centreId: 1, bookingDate: 1, status: 1 });
BookingSchema.index({ farmerId: 1, bookingDate: 1 });
