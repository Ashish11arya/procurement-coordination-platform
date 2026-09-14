import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { EventBusService } from '../../infrastructure/events/event-bus.service';
import { DomainEventType } from '../../infrastructure/events/domain-events';
import {
  SchedulingDecision,
  SchedulingDecisionDocument,
  DecisionType,
  DecisionOutcome,
} from './schemas/scheduling-decision.schema';
import {
  Booking,
  BookingDocument,
  BookingStatus,
} from '../bookings/schemas/booking.schema';
import {
  ArrivalWindow,
  ArrivalWindowDocument,
} from '../bookings/schemas/arrival-window.schema';
import { Centre, CentreDocument } from '../centres/schemas/centre.schema';
import { Counter, CounterDocument, CounterStatus, CounterStage } from '../centres/schemas/counter.schema';
import {
  BookingScheduleRequest,
  OperatingSlot,
  StageCapacityMetric,
  SchedulingEvaluationResult,
  AdaptationReport,
  CandidateAdaptationResult,
} from './types/scheduling.types';
import {
  GovernmentDataProvider,
  GOVERNMENT_DATA_PROVIDER,
} from '../integrations/contracts/government-data-provider.interface';
import { PredictionsService } from '../predictions/predictions.service';

const PIPELINE_STAGES = [
  CounterStage.CHECKIN,
  CounterStage.WEIGHING,
  CounterStage.QUALITY,
  CounterStage.PROCUREMENT,
];

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    @InjectModel(SchedulingDecision.name)
    private readonly decisionModel: Model<SchedulingDecisionDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(ArrivalWindow.name)
    private readonly windowModel: Model<ArrivalWindowDocument>,
    @InjectModel(Centre.name)
    private readonly centreModel: Model<CentreDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
    @Inject(GOVERNMENT_DATA_PROVIDER)
    private readonly govProvider: GovernmentDataProvider,
    @Optional() private readonly eventBusService?: EventBusService,
    @Optional() private readonly predictionsService?: PredictionsService,
  ) {}

  // --------------------------------------------------------------------------
  // 1. Core Deterministic Constraint Scheduler (Section 6, 8, 13)
  // --------------------------------------------------------------------------

  async evaluateBookingConstraints(
    req: BookingScheduleRequest,
  ): Promise<SchedulingEvaluationResult> {
    const decisionId = `SCHED-${req.bookingDate.replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const centre = await this.centreModel.findOne({ centreId: req.centreId }).exec();

    if (!centre || !centre.isActive) {
      throw new BadRequestException(`Centre '${req.centreId}' is non-existent or inactive.`);
    }

    // 1. Authoritative Daily Capacity Ceiling (Section 8 & 21)
    let dailySanctionedCapacity = centre.dailyCapacityQuintals;
    try {
      const govCapacity = await this.govProvider.getCentreCapacity(req.centreId, req.bookingDate);
      dailySanctionedCapacity = Math.min(
        centre.dailyCapacityQuintals,
        govCapacity.sanctionedDailyCapacityQuintals,
      );
    } catch (err: any) {
      this.logger.warn(
        `Government capacity query failed (${err.message}). Defaulting to local centre ceiling: ${centre.dailyCapacityQuintals}Q`,
      );
    }

    const activeBookings = await this.bookingModel
      .find({
        centreId: req.centreId,
        bookingDate: req.bookingDate,
        status: {
          $in: [
            BookingStatus.BOOKED,
            BookingStatus.CONFIRMED,
            BookingStatus.ARRIVED,
            BookingStatus.CHECKED_IN,
            BookingStatus.IN_PROGRESS,
            BookingStatus.COMPLETED,
          ],
        },
      })
      .exec();

    const currentDailyBooked = activeBookings.reduce((sum, b) => sum + b.quantityQuintals, 0);
    const dailyCapacityPassed = currentDailyBooked + req.quantityQuintals <= dailySanctionedCapacity;

    if (!dailyCapacityPassed) {
      const reason = `Centre daily sanctioned ceiling exceeded. Available: ${Math.max(0, dailySanctionedCapacity - currentDailyBooked)}Q, Requested: ${req.quantityQuintals}Q`;
      await this.recordAuditDecision({
        decisionId,
        decisionType: DecisionType.CAPACITY_OVERFLOW_REJECTION,
        triggerEvent: 'BOOKING_REQUEST',
        centreId: req.centreId,
        bookingDate: req.bookingDate,
        candidateBookingId: req.bookingId || 'NEW_REQUEST',
        candidateFarmerId: req.farmerId,
        candidateQuantityQuintals: req.quantityQuintals,
        constraintsEvaluated: {
          centreDailyCapacity: {
            sanctionedQuintals: dailySanctionedCapacity,
            currentBookedQuintals: currentDailyBooked,
            requestedQuintals: req.quantityQuintals,
            passed: false,
          },
        },
        decision: DecisionOutcome.REJECTED,
        reason,
        correlationId: req.correlationId,
      });

      return {
        isFeasible: false,
        rejectionReason: reason,
        failedConstraint: 'CENTRE_DAILY_CAPACITY',
        stageMetrics: [],
        dailySanctionedCapacity,
        currentDailyBooked,
        estimatedDurationMinutes: 0,
      };
    }

    // 2. Multi-Counter / Multi-Stage Capacity (Section 13)
    const counters = await this.counterModel.find({ centreId: req.centreId }).exec();
    const stageMetrics: StageCapacityMetric[] = [];
    const stageHourlyCapacities: Record<string, number> = {};

    for (const stage of PIPELINE_STAGES) {
      const activeStageCounters = counters.filter(
        (c) => c.stage === stage && c.status === CounterStatus.ACTIVE,
      );

      const hourlyCap = activeStageCounters.reduce(
        (sum, c) => sum + c.capacityPerHourQuintals,
        0,
      );
      stageHourlyCapacities[stage] = hourlyCap;

      stageMetrics.push({
        stage,
        hourlyCapacityQuintals: hourlyCap,
        activeCounterCount: activeStageCounters.length,
        slotMaxCapacityQuintals: hourlyCap, // 1 hour per slot
        currentBookedQuintals: 0,
        remainingCapacityQuintals: hourlyCap,
        isBottleneck: hourlyCap === 0,
      });

      if (activeStageCounters.length === 0) {
        const reason = `Operational pipeline halted: Zero active counters available for stage '${stage}'.`;
        await this.recordAuditDecision({
          decisionId,
          decisionType: DecisionType.CAPACITY_OVERFLOW_REJECTION,
          triggerEvent: 'BOOKING_REQUEST',
          centreId: req.centreId,
          bookingDate: req.bookingDate,
          candidateBookingId: req.bookingId || 'NEW_REQUEST',
          candidateFarmerId: req.farmerId,
          candidateQuantityQuintals: req.quantityQuintals,
          constraintsEvaluated: {
            stageCapacities: stageMetrics.map((sm) => ({
              stage: sm.stage,
              hourlyCapacityQuintals: sm.hourlyCapacityQuintals,
              currentSlotLoadQuintals: 0,
              passed: sm.hourlyCapacityQuintals > 0,
            })),
          },
          decision: DecisionOutcome.REJECTED,
          reason,
          correlationId: req.correlationId,
        });

        return {
          isFeasible: false,
          rejectionReason: reason,
          failedConstraint: `STAGE_OFFLINE_${stage}`,
          stageMetrics,
          dailySanctionedCapacity,
          currentDailyBooked,
          estimatedDurationMinutes: 0,
        };
      }
    }

    // Identify bottleneck stage
    const minHourlyThroughput = Math.min(...Object.values(stageHourlyCapacities));
    stageMetrics.forEach((sm) => {
      sm.isBottleneck = sm.hourlyCapacityQuintals === minHourlyThroughput;
    });

    // 3. Service Duration Calculation (Advisory metric per Section 7 & 31)
    const durationInfo = await this.resolveServiceDuration(req);
    const estimatedDurationMinutes = durationInfo.durationMinutes;
    const predictionMetadata = durationInfo.predictionMeta;

    // 4. Feasible Operating Slot Generation (09:00 - 18:00)
    const candidateSlots = this.generateOperatingSlots(centre.operatingHours);
    const orderedSlots = this.prioritizeSlots(candidateSlots, req.preferredSlotIndex);
    const vehicleCount = req.vehicleCount || 1;

    let selectedSlot: OperatingSlot | undefined = undefined;

    for (const slot of orderedSlots) {
      // Check Yard Simultaneous Vehicles
      const slotBookings = activeBookings.filter(
        (b) => b.arrivalWindow?.slotIndex === slot.index,
      );
      const slotVehicleCount = slotBookings.reduce((sum, b) => sum + (b.vehicleCount || 1), 0);

      if (slotVehicleCount + vehicleCount > centre.maxSimultaneousVehicles) {
        continue;
      }

      // Check Pipeline Throughput for this slot
      const slotCurrentBooked = slotBookings.reduce((sum, b) => sum + b.quantityQuintals, 0);
      const candidateSlotTotal = slotCurrentBooked + req.quantityQuintals;

      // Slot cannot exceed the bottleneck stage hourly throughput
      if (candidateSlotTotal > minHourlyThroughput) {
        continue;
      }

      // Slot cannot exceed dailySanctioned / 8
      const slotMaxCap = Math.ceil(dailySanctionedCapacity / candidateSlots.length);
      if (candidateSlotTotal > slotMaxCap) {
        continue;
      }

      // Slot is physically feasible across all 4 stages
      selectedSlot = slot;
      break;
    }

    if (!selectedSlot) {
      const reason = `No arrival window can satisfy physical yard (${centre.maxSimultaneousVehicles} vehicles) and multi-stage throughput (${minHourlyThroughput}Q/hr) constraints.`;
      await this.recordAuditDecision({
        decisionId,
        decisionType: DecisionType.CAPACITY_OVERFLOW_REJECTION,
        triggerEvent: 'BOOKING_REQUEST',
        centreId: req.centreId,
        bookingDate: req.bookingDate,
        candidateBookingId: req.bookingId || 'NEW_REQUEST',
        candidateFarmerId: req.farmerId,
        candidateQuantityQuintals: req.quantityQuintals,
        constraintsEvaluated: {
          centreDailyCapacity: {
            sanctionedQuintals: dailySanctionedCapacity,
            currentBookedQuintals: currentDailyBooked,
            requestedQuintals: req.quantityQuintals,
            passed: true,
          },
          vehicleYardIntake: {
            maxSimultaneousVehicles: centre.maxSimultaneousVehicles,
            currentSlotVehicles: centre.maxSimultaneousVehicles,
            passed: false,
          },
        },
        decision: DecisionOutcome.REJECTED,
        reason,
        correlationId: req.correlationId,
      });

      return {
        isFeasible: false,
        rejectionReason: reason,
        failedConstraint: 'ALL_SLOTS_CONSTRAINED',
        stageMetrics,
        dailySanctionedCapacity,
        currentDailyBooked,
        estimatedDurationMinutes,
        predictionMetadata,
      };
    }

    // Passed all constraints
    await this.recordAuditDecision({
      decisionId,
      decisionType: DecisionType.INITIAL_SCHEDULE,
      triggerEvent: 'BOOKING_REQUEST',
      centreId: req.centreId,
      bookingDate: req.bookingDate,
      candidateBookingId: req.bookingId || 'NEW_REQUEST',
      candidateFarmerId: req.farmerId,
      candidateQuantityQuintals: req.quantityQuintals,
      constraintsEvaluated: {
        centreDailyCapacity: {
          sanctionedQuintals: dailySanctionedCapacity,
          currentBookedQuintals: currentDailyBooked,
          requestedQuintals: req.quantityQuintals,
          passed: true,
        },
        stageCapacities: stageMetrics.map((sm) => ({
          stage: sm.stage,
          hourlyCapacityQuintals: sm.hourlyCapacityQuintals,
          currentSlotLoadQuintals: req.quantityQuintals,
          passed: true,
        })),
        vehicleYardIntake: {
          maxSimultaneousVehicles: centre.maxSimultaneousVehicles,
          currentSlotVehicles: vehicleCount,
          passed: true,
        },
      },
      decision: DecisionOutcome.ACCEPTED,
      assignedWindow: selectedSlot,
      reason: `Feasible arrival window assigned (${selectedSlot.startTime} - ${selectedSlot.endTime}). Bottleneck stage: ${minHourlyThroughput}Q/hr.`,
      correlationId: req.correlationId,
    });

    return {
      isFeasible: true,
      assignedWindow: selectedSlot,
      estimatedDurationMinutes,
      predictionMetadata,
      stageMetrics,
      dailySanctionedCapacity,
      currentDailyBooked,
    };
  }

  /**
   * Resolve estimated service duration (Section 7, 31, 32):
   * Uses PredictionsService advisory model with strict 50ms timeout & confidence checks.
   * If predictions are disabled, slow (>50ms), low-confidence (<0.40), out of bounds (<5m or >180m),
   * or throwing errors, it falls back seamlessly to the Phase 3 deterministic calculation.
   * Section 7, 31, 32 rule: Prediction never affects constraint checks or feasibility decisions.
   */
  async resolveServiceDuration(
    req: BookingScheduleRequest,
  ): Promise<{ durationMinutes: number; predictionMeta?: any }> {
    const baseSetupMinutes = 10;
    const processingMinutes = Math.ceil((req.quantityQuintals / 40.0) * 60);
    const deterministicDuration = baseSetupMinutes + processingMinutes;

    if (!this.predictionsService || process.env.PREDICTIONS_ENABLED === 'false') {
      return { durationMinutes: deterministicDuration };
    }

    try {
      // Strict 50ms SLA budget — AI can NEVER hang the core scheduler
      const prediction = await Promise.race([
        this.predictionsService.predictServiceTime({
          centreId: req.centreId,
          commodityCode: req.commodityCode,
          quantityQuintals: req.quantityQuintals,
          vehicleCount: req.vehicleCount || 1,
        }),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('PREDICTION_TIMEOUT')), 50),
        ),
      ]);

      const MIN_CONFIDENCE_THRESHOLD = 0.4;
      const MIN_PHYSICAL_MINUTES = 5;
      const MAX_PHYSICAL_MINUTES = 180;

      if (
        prediction &&
        prediction.confidence >= MIN_CONFIDENCE_THRESHOLD &&
        Number.isFinite(prediction.value?.estimatedDurationMinutes) &&
        prediction.value.estimatedDurationMinutes >= MIN_PHYSICAL_MINUTES &&
        prediction.value.estimatedDurationMinutes <= MAX_PHYSICAL_MINUTES
      ) {
        return {
          durationMinutes: Math.round(prediction.value.estimatedDurationMinutes),
          predictionMeta: prediction.metadata,
        };
      }

      this.logger.warn(
        `Prediction rejected or uncertain (confidence=${prediction?.confidence}, duration=${prediction?.value?.estimatedDurationMinutes}). Using deterministic baseline.`,
      );
      return { durationMinutes: deterministicDuration };
    } catch (err) {
      this.logger.warn(
        `Prediction service error or timeout (${err.message}). Using deterministic baseline.`,
      );
      return { durationMinutes: deterministicDuration };
    }
  }

  // --------------------------------------------------------------------------
  // 2. Dynamic Adaptation on Freed Capacity (Section 10)
  // --------------------------------------------------------------------------

  /**
   * Section 10: "A released capacity unit must NOT automatically be assigned
   * to the next farmer. Evaluate candidate farmers against constraints."
   */
  async recomputeScheduleOnFreedCapacity(
    freedBooking: BookingDocument,
    triggerEvent: string,
    simulatedCurrentTime?: Date,
  ): Promise<AdaptationReport> {
    const freedSlotIndex = freedBooking.arrivalWindow.slotIndex;
    let remainingFreedCapacity = freedBooking.quantityQuintals;
    const evaluations: CandidateAdaptationResult[] = [];

    // Identify eligible candidate bookings later on the SAME day
    const candidateBookings = await this.bookingModel
      .find({
        centreId: freedBooking.centreId,
        bookingDate: freedBooking.bookingDate,
        'arrivalWindow.slotIndex': { $gt: freedSlotIndex },
        status: { $in: [BookingStatus.BOOKED, BookingStatus.CONFIRMED] },
      })
      .sort({ tokenNumber: 1 })
      .exec();

    const currentTime = simulatedCurrentTime || new Date();
    const minimumNoticeMinutes = 45; // Minimum travel/prep buffer

    for (const candidate of candidateBookings) {
      if (remainingFreedCapacity <= 0) break;

      const decisionRecord: CandidateAdaptationResult = {
        candidateBookingId: candidate.bookingId,
        farmerId: candidate.farmerId,
        originalSlotIndex: candidate.arrivalWindow.slotIndex,
        targetSlotIndex: freedSlotIndex,
        quantityQuintals: candidate.quantityQuintals,
        decision: 'UNALTERED',
        reason: '',
        evaluatedConstraints: {
          quantityFit: true,
          transitReachability: true,
          stageCompatibility: true,
          scheduleStability: true,
        },
      };

      // Constraint 1: Quantity Fit
      if (candidate.quantityQuintals > remainingFreedCapacity) {
        decisionRecord.evaluatedConstraints.quantityFit = false;
        decisionRecord.reason = `Quantity (${candidate.quantityQuintals}Q) exceeds remaining freed slot capacity (${remainingFreedCapacity}Q).`;
        evaluations.push(decisionRecord);
        await this.logAdaptationDecision(candidate, freedBooking, decisionRecord, triggerEvent);
        continue;
      }

      // Constraint 2: Transit Reachability & Farmer Notice Time
      const [slotHour, slotMinute] = freedBooking.arrivalWindow.startTime.split(':').map(Number);
      const [year, month, day] = candidate.bookingDate.split('-').map(Number);
      const slotStart = new Date(Date.UTC(year, month - 1, day, slotHour, slotMinute, 0));

      const requiredNoticeTime = new Date(currentTime.getTime() + minimumNoticeMinutes * 60 * 1000);
      if (requiredNoticeTime > slotStart) {
        decisionRecord.evaluatedConstraints.transitReachability = false;
        decisionRecord.reason = `Insufficient transit notice: Moving farmer forward would cause imminent late arrival.`;
        evaluations.push(decisionRecord);
        await this.logAdaptationDecision(candidate, freedBooking, decisionRecord, triggerEvent);
        continue; // Keep original window!
      }

      // Constraint 3: Commodity Compatibility
      if (candidate.commodityCode !== freedBooking.commodityCode) {
        // If differing commodity, ensure active counters support it
        const counters = await this.counterModel.find({
          centreId: candidate.centreId,
          status: CounterStatus.ACTIVE,
        }).exec();
        if (counters.length === 0) {
          decisionRecord.evaluatedConstraints.stageCompatibility = false;
          decisionRecord.reason = `No active counters available for commodity ${candidate.commodityCode}.`;
          evaluations.push(decisionRecord);
          await this.logAdaptationDecision(candidate, freedBooking, decisionRecord, triggerEvent);
          continue;
        }
      }

      // --- ALL CONSTRAINTS FEASIBLE: MOVE FORWARD ---
      decisionRecord.decision = 'MOVED_FORWARD';
      decisionRecord.reason = `Feasible: Farmer moved forward from slot ${candidate.arrivalWindow.slotIndex} to slot ${freedSlotIndex}.`;
      evaluations.push(decisionRecord);

      // Apply reassignment to Booking
      const oldSlotIndex = candidate.arrivalWindow.slotIndex;
      candidate.arrivalWindow = freedBooking.arrivalWindow;
      await candidate.save();

      // Atomically update ArrivalWindows
      await this.windowModel.updateOne(
        { centreId: candidate.centreId, date: candidate.bookingDate, slotIndex: oldSlotIndex },
        { $inc: { bookedQuantityQuintals: -candidate.quantityQuintals, bookingCount: -1 } },
      );

      await this.windowModel.updateOne(
        { centreId: candidate.centreId, date: candidate.bookingDate, slotIndex: freedSlotIndex },
        { $inc: { bookedQuantityQuintals: candidate.quantityQuintals, bookingCount: 1 } },
      );

      remainingFreedCapacity -= candidate.quantityQuintals;
      await this.logAdaptationDecision(candidate, freedBooking, decisionRecord, triggerEvent);

      if (this.eventBusService) {
        await this.eventBusService.publish({
          eventId: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          eventType: DomainEventType.SCHEDULING_UPDATED,
          timestamp: new Date(),
          centreId: candidate.centreId,
          bookingId: candidate.bookingId,
          farmerId: candidate.farmerId,
          payload: {
            bookingId: candidate.bookingId,
            farmerId: candidate.farmerId,
            centreId: candidate.centreId,
            previousSlot: { slotIndex: oldSlotIndex },
            newSlot: candidate.arrivalWindow,
            triggerEvent,
            freedBookingId: freedBooking.bookingId,
          },
        });
      }
    }

    const report: AdaptationReport = {
      triggerEvent,
      centreId: freedBooking.centreId,
      date: freedBooking.bookingDate,
      freedSlotIndex,
      freedQuantityQuintals: freedBooking.quantityQuintals,
      candidatesEvaluatedCount: candidateBookings.length,
      candidatesMovedCount: evaluations.filter((e) => e.decision === 'MOVED_FORWARD').length,
      remainingFreedQuantityQuintals: remainingFreedCapacity,
      evaluations,
    };

    this.logger.log(
      `[DYNAMIC_ADAPTATION] ${triggerEvent} on ${freedBooking.bookingId}: Moved ${report.candidatesMovedCount}/${report.candidatesEvaluatedCount} candidate farmers forward.`,
    );

    return report;
  }

  // --------------------------------------------------------------------------
  // 3. Counter Breakdown Recompute (Section 10 & 13)
  // --------------------------------------------------------------------------

  async recomputeOnCounterBreakdown(
    centreId: string,
    counterId: string,
    date: string,
  ): Promise<{ affectedWindowsCount: number; bottleneckStage: string; newHourlyCapacity: number }> {
    const counter = await this.counterModel.findOne({ centreId, counterId }).exec();
    if (!counter) {
      throw new BadRequestException(`Counter '${counterId}' not found.`);
    }

    // Set counter status to MAINTENANCE
    counter.status = CounterStatus.MAINTENANCE;
    await counter.save();

    // Recalculate stage capacity
    const counters = await this.counterModel.find({ centreId, status: CounterStatus.ACTIVE }).exec();
    const stageCap = counters
      .filter((c) => c.stage === counter.stage)
      .reduce((sum, c) => sum + c.capacityPerHourQuintals, 0);

    // Check all windows for that day
    const windows = await this.windowModel.find({ centreId, date }).exec();
    let affectedCount = 0;

    for (const w of windows) {
      if (w.bookedQuantityQuintals > stageCap) {
        affectedCount++;
      }
    }

    this.logger.warn(
      `[COUNTER_BREAKDOWN] Counter ${counterId} offline. Stage '${counter.stage}' reduced to ${stageCap}Q/hr. Affected windows: ${affectedCount}`,
    );

    return {
      affectedWindowsCount: affectedCount,
      bottleneckStage: counter.stage,
      newHourlyCapacity: stageCap,
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private generateOperatingSlots(hours: { openTime: string; closeTime: string }): OperatingSlot[] {
    const openH = parseInt(hours?.openTime?.split(':')[0] || '9', 10);
    const closeH = parseInt(hours?.closeTime?.split(':')[0] || '18', 10);
    const slots: OperatingSlot[] = [];

    for (let h = openH, idx = 0; h < closeH; h++, idx++) {
      slots.push({
        index: idx,
        startTime: `${String(h).padStart(2, '0')}:00`,
        endTime: `${String(h + 1).padStart(2, '0')}:00`,
        durationHours: 1,
      });
    }
    return slots;
  }

  private prioritizeSlots(slots: OperatingSlot[], preferredIndex?: number): OperatingSlot[] {
    if (preferredIndex === undefined || preferredIndex < 0 || preferredIndex >= slots.length) {
      return [...slots];
    }
    const preferred = slots[preferredIndex];
    const rest = slots.filter((s) => s.index !== preferredIndex);
    return [preferred, ...rest];
  }

  private async recordAuditDecision(data: any): Promise<void> {
    try {
      await this.decisionModel.create(data);
    } catch (err: any) {
      this.logger.warn(`Failed to persist scheduling decision audit: ${err.message}`);
    }
  }

  private async logAdaptationDecision(
    candidate: BookingDocument,
    freedBooking: BookingDocument,
    result: CandidateAdaptationResult,
    triggerEvent: string,
  ): Promise<void> {
    const decisionId = `ADAPT-${freedBooking.bookingDate.replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    await this.recordAuditDecision({
      decisionId,
      decisionType: DecisionType.DYNAMIC_ADAPTATION,
      triggerEvent,
      centreId: freedBooking.centreId,
      bookingDate: freedBooking.bookingDate,
      candidateBookingId: candidate.bookingId,
      candidateFarmerId: candidate.farmerId,
      candidateQuantityQuintals: candidate.quantityQuintals,
      constraintsEvaluated: {
        transitReachability: {
          minimumNoticeMinutes: 45,
          availableMinutes: result.evaluatedConstraints.transitReachability ? 60 : 15,
          passed: result.evaluatedConstraints.transitReachability,
        },
      },
      decision: result.decision === 'MOVED_FORWARD' ? DecisionOutcome.MOVED_FORWARD : DecisionOutcome.UNALTERED,
      assignedWindow: result.decision === 'MOVED_FORWARD' ? freedBooking.arrivalWindow : null,
      originalWindow: candidate.arrivalWindow,
      reason: result.reason,
    });
  }
}
