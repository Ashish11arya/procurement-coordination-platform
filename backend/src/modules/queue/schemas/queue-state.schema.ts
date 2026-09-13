import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../../shared/enums/roles.enum';

export type QueueStateDocument = QueueState & Document;

export enum QueueStatus {
  BOOKED = 'BOOKED',
  CONFIRMED = 'CONFIRMED',
  ARRIVED = 'ARRIVED',
  CHECKED_IN = 'CHECKED_IN',
  WAITING = 'WAITING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  REJECTED = 'REJECTED',
  HELD = 'HELD',
}

@Schema({ _id: false })
export class StateTransitionRecord {
  @Prop({ required: true, enum: Object.values(QueueStatus) })
  fromState: QueueStatus;

  @Prop({ required: true, enum: Object.values(QueueStatus) })
  toState: QueueStatus;

  @Prop({ required: true, default: () => new Date() })
  timestamp: Date;

  @Prop({ type: String, default: null })
  changedByUserId?: string | null;

  @Prop({ type: String, default: null })
  changedByRole?: Role | string | null;

  @Prop({ type: String, default: null })
  notes?: string | null;
}

@Schema({ timestamps: true, collection: 'queue_states' })
export class QueueState {
  @Prop({ required: true, unique: true, index: true })
  bookingId: string; // References Booking.bookingId

  @Prop({ required: true, index: true })
  tokenNumber: string; // e.g. 'T-001'

  @Prop({ required: true, index: true })
  farmerId: string;

  @Prop({ required: true, index: true })
  centreId: string;

  @Prop({ required: true, index: true })
  bookingDate: string; // 'YYYY-MM-DD'

  @Prop({ required: true })
  commodityCode: string;

  @Prop({ required: true, min: 0.1 })
  quantityQuintals: number;

  @Prop({ required: true, min: 1, default: 1 })
  vehicleCount: number;

  @Prop({
    required: true,
    enum: Object.values(QueueStatus),
    default: QueueStatus.BOOKED,
    index: true,
  })
  currentState: QueueStatus;

  @Prop({ type: String, default: null, index: true })
  currentStage?: string | null; // 'CHECKIN', 'WEIGHING', 'QUALITY', 'PROCUREMENT'

  @Prop({ type: String, default: null })
  activeCounterId?: string | null; // ID of counter currently servicing

  @Prop({ type: Number, default: 0 })
  queuePosition: number; // Dynamic yard position

  @Prop({ type: Number, default: 0 })
  estimatedWaitMinutes: number; // Realistic estimated wait

  @Prop({ type: [StateTransitionRecord], default: [] })
  stateHistory: StateTransitionRecord[];

  @Prop({ type: Date, default: null })
  arrivedAt?: Date | null;

  @Prop({ type: Date, default: null })
  checkedInAt?: Date | null;

  @Prop({ type: Date, default: null })
  processingStartedAt?: Date | null;

  @Prop({ type: Date, default: null })
  completedAt?: Date | null;
}

export const QueueStateSchema = SchemaFactory.createForClass(QueueState);

QueueStateSchema.index({ centreId: 1, bookingDate: 1, currentState: 1 });
QueueStateSchema.index({ centreId: 1, currentState: 1, tokenNumber: 1 });
