import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CounterDocument = Counter & Document;

export enum CounterStage {
  CHECKIN = 'CHECKIN',
  WEIGHING = 'WEIGHING',
  QUALITY = 'QUALITY',
  PROCUREMENT = 'PROCUREMENT',
}

export enum CounterStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  INACTIVE = 'INACTIVE',
}

@Schema({ timestamps: true, collection: 'counters' })
export class Counter {
  @Prop({ required: true, unique: true, index: true })
  counterId: string; // e.g. 'CTR-IND01-W1'

  @Prop({ required: true, index: true })
  centreId: string; // References Centre.centreId

  @Prop({ required: true })
  counterNumber: number; // e.g. 1, 2, 3

  @Prop({
    required: true,
    enum: Object.values(CounterStage),
    index: true,
  })
  stage: CounterStage;

  @Prop({ required: true, min: 1, default: 25 })
  capacityPerHourQuintals: number;

  @Prop({
    required: true,
    enum: Object.values(CounterStatus),
    default: CounterStatus.ACTIVE,
    index: true,
  })
  status: CounterStatus;

  @Prop({ type: String, default: null })
  currentAssignedStaffId: string | null;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);

CounterSchema.index({ centreId: 1, stage: 1, status: 1 });
