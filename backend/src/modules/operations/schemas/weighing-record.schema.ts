import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WeighingRecordDocument = WeighingRecord & Document;

@Schema({ timestamps: true, collection: 'weighing_records' })
export class WeighingRecord {
  @Prop({ required: true, index: true })
  bookingId: string;

  @Prop({ required: true, index: true })
  centreId: string;

  @Prop({ required: true })
  counterId: string;

  @Prop({ required: true })
  vehicleNumber: string;

  @Prop({ required: true })
  grossWeightQuintals: number;

  @Prop({ required: true })
  tareWeightQuintals: number;

  @Prop({ required: true })
  netWeightQuintals: number;

  @Prop({ required: true, unique: true, index: true })
  weighmentSlipNumber: string;

  @Prop({ required: true })
  operatorId: string;

  @Prop({ required: true })
  weighedAt: Date;

  @Prop()
  notes?: string;
}

export const WeighingRecordSchema = SchemaFactory.createForClass(WeighingRecord);
WeighingRecordSchema.index({ centreId: 1, weighedAt: -1 });
