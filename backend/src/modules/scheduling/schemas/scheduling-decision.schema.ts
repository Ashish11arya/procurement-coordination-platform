import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SchedulingDecisionDocument = SchedulingDecision & Document;

export enum DecisionType {
  INITIAL_SCHEDULE = 'INITIAL_SCHEDULE',
  DYNAMIC_ADAPTATION = 'DYNAMIC_ADAPTATION',
  COUNTER_BREAKDOWN_RECOMPUTE = 'COUNTER_BREAKDOWN_RECOMPUTE',
  CAPACITY_OVERFLOW_REJECTION = 'CAPACITY_OVERFLOW_REJECTION',
}

export enum DecisionOutcome {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  MOVED_FORWARD = 'MOVED_FORWARD',
  UNALTERED = 'UNALTERED',
}

@Schema({ timestamps: true, collection: 'scheduling_decisions' })
export class SchedulingDecision {
  @Prop({ required: true, unique: true, index: true })
  decisionId: string; // e.g. 'SCHED-20260913-IND01-0001'

  @Prop({ required: true, enum: Object.values(DecisionType), index: true })
  decisionType: DecisionType;

  @Prop({ required: true })
  triggerEvent: string; // e.g. 'BOOKING_REQUEST', 'NO_SHOW_DETECTED', 'BOOKING_CANCELLED', 'COUNTER_OFFLINE'

  @Prop({ required: true, index: true })
  centreId: string; // References Centre.centreId

  @Prop({ required: true, index: true })
  bookingDate: string; // 'YYYY-MM-DD'

  @Prop({ required: true, index: true })
  candidateBookingId: string; // Booking ID evaluated

  @Prop({ required: true, index: true })
  candidateFarmerId: string; // Farmer ID evaluated

  @Prop({ required: true, min: 0.1 })
  candidateQuantityQuintals: number;

  @Prop({ type: Object, required: true })
  constraintsEvaluated: {
    centreDailyCapacity?: {
      sanctionedQuintals: number;
      currentBookedQuintals: number;
      requestedQuintals: number;
      passed: boolean;
    };
    stageCapacities?: Array<{
      stage: string;
      hourlyCapacityQuintals: number;
      currentSlotLoadQuintals: number;
      passed: boolean;
    }>;
    vehicleYardIntake?: {
      maxSimultaneousVehicles: number;
      currentSlotVehicles: number;
      passed: boolean;
    };
    transitReachability?: {
      minimumNoticeMinutes: number;
      availableMinutes: number;
      passed: boolean;
    };
    operationalHours?: {
      openTime: string;
      closeTime: string;
      passed: boolean;
    };
  };

  @Prop({ required: true, enum: Object.values(DecisionOutcome), index: true })
  decision: DecisionOutcome;

  @Prop({ type: Object, default: null })
  assignedWindow?: {
    slotIndex: number;
    startTime: string;
    endTime: string;
  } | null;

  @Prop({ type: Object, default: null })
  originalWindow?: {
    slotIndex: number;
    startTime: string;
    endTime: string;
  } | null;

  @Prop({ required: true })
  reason: string; // Detailed human-readable justification

  @Prop({ type: String, default: null, index: true })
  correlationId?: string | null; // X-Request-ID for distributed tracing
}

export const SchedulingDecisionSchema = SchemaFactory.createForClass(SchedulingDecision);

SchedulingDecisionSchema.index({ centreId: 1, bookingDate: 1, decisionType: 1 });

