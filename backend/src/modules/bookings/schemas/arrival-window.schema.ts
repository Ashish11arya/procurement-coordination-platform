import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ArrivalWindowDocument = ArrivalWindow & Document;

@Schema({ timestamps: true, collection: 'arrival_windows' })
export class ArrivalWindow {
  @Prop({ required: true, index: true })
  centreId: string; // References Centre.centreId

  @Prop({ required: true, index: true })
  date: string; // 'YYYY-MM-DD'

  @Prop({ required: true })
  slotIndex: number; // 0, 1, 2, ...

  @Prop({ required: true })
  startTime: string; // e.g. '09:00'

  @Prop({ required: true })
  endTime: string; // e.g. '10:00'

  @Prop({ required: true, min: 1, default: 60 })
  maxCapacityQuintals: number;

  @Prop({ required: true, min: 0, default: 0 })
  bookedQuantityQuintals: number;

  @Prop({ required: true, min: 0, default: 0 })
  bookingCount: number;
}

export const ArrivalWindowSchema = SchemaFactory.createForClass(ArrivalWindow);

ArrivalWindowSchema.index({ centreId: 1, date: 1, slotIndex: 1 }, { unique: true });
