import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum ServiceSessionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ABORTED = 'ABORTED',
}

export type ServiceSessionDocument = ServiceSession & Document;

@Schema({ timestamps: true, collection: 'service_sessions' })
export class ServiceSession {
  @Prop({ required: true, index: true })
  bookingId: string;

  @Prop({ required: true, index: true })
  centreId: string;

  @Prop({ required: true })
  counterId: string;

  @Prop({ required: true })
  stage: string;

  @Prop({ required: true })
  operatorId: string;

  @Prop({ required: true })
  startedAt: Date;

  @Prop()
  completedAt?: Date;

  @Prop({ required: true, enum: ServiceSessionStatus, default: ServiceSessionStatus.IN_PROGRESS })
  status: ServiceSessionStatus;

  @Prop()
  durationSeconds?: number;

  @Prop()
  notes?: string;
}

export const ServiceSessionSchema = SchemaFactory.createForClass(ServiceSession);
ServiceSessionSchema.index({ centreId: 1, stage: 1, startedAt: -1 });
