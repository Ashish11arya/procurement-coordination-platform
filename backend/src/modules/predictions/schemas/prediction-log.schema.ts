import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PredictionLogDocument = PredictionLog & Document;

@Schema({ timestamps: true, collection: 'prediction_logs' })
export class PredictionLog {
  @Prop({ required: true, unique: true, index: true })
  predictionId: string;

  @Prop({ required: true, index: true })
  predictionType: string; // 'SERVICE_TIME' | 'ARRIVAL_PATTERN' | 'NO_SHOW_RISK'

  @Prop({ required: true })
  modelVersion: string;

  @Prop({ required: true })
  algorithm: string;

  @Prop({ type: Object, required: true })
  inputFeatures: Record<string, any>;

  @Prop({ type: Object, required: true })
  predictedValue: any;

  @Prop({ required: true })
  confidence: number;

  @Prop({ required: true })
  uncertaintyMargin: number;

  @Prop({ required: true, default: false })
  isFallback: boolean;

  @Prop()
  fallbackReason?: string;

  @Prop({ index: true })
  centreId?: string;

  @Prop({ index: true })
  farmerId?: string;

  @Prop({ index: true })
  bookingId?: string;

  @Prop({ required: true, default: () => new Date(), index: true })
  predictedAt: Date;
}

export const PredictionLogSchema = SchemaFactory.createForClass(PredictionLog);
PredictionLogSchema.index({ predictionType: 1, centreId: 1, predictedAt: -1 });
