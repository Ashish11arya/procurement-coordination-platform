export interface BookingScheduleRequest {
  bookingId?: string;
  farmerId: string;
  centreId: string;
  commodityCode: string;
  quantityQuintals: number;
  bookingDate: string; // 'YYYY-MM-DD'
  preferredSlotIndex?: number;
  vehicleCount?: number;
  correlationId?: string;
}

export interface OperatingSlot {
  index: number;
  startTime: string;
  endTime: string;
  durationHours: number;
}

export interface StageCapacityMetric {
  stage: string;
  hourlyCapacityQuintals: number;
  activeCounterCount: number;
  slotMaxCapacityQuintals: number;
  currentBookedQuintals: number;
  remainingCapacityQuintals: number;
  isBottleneck: boolean;
}

export interface SchedulingEvaluationResult {
  isFeasible: boolean;
  assignedWindow?: OperatingSlot;
  estimatedDurationMinutes: number;
  rejectionReason?: string;
  failedConstraint?: string;
  stageMetrics: StageCapacityMetric[];
  dailySanctionedCapacity: number;
  currentDailyBooked: number;
}

export interface CandidateAdaptationResult {
  candidateBookingId: string;
  farmerId: string;
  originalSlotIndex: number;
  targetSlotIndex: number;
  quantityQuintals: number;
  decision: 'MOVED_FORWARD' | 'UNALTERED';
  reason: string;
  evaluatedConstraints: {
    quantityFit: boolean;
    transitReachability: boolean;
    stageCompatibility: boolean;
    scheduleStability: boolean;
  };
}

export interface AdaptationReport {
  triggerEvent: string;
  centreId: string;
  date: string;
  freedSlotIndex: number;
  freedQuantityQuintals: number;
  candidatesEvaluatedCount: number;
  candidatesMovedCount: number;
  remainingFreedQuantityQuintals: number;
  evaluations: CandidateAdaptationResult[];
}
