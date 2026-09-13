import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueueState, QueueStateDocument, QueueStatus } from './schemas/queue-state.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schemas/booking.schema';
import { QueueStateMachine } from './queue-state-machine';
import { SchedulingService } from '../scheduling/scheduling.service';
import { AuthenticatedUser } from '../../shared/types/auth.types';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectModel(QueueState.name)
    private readonly queueModel: Model<QueueStateDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    private readonly schedulingService: SchedulingService,
  ) {}

  /**
   * Initialize queue tracking upon booking creation
   */
  async initializeQueueState(booking: BookingDocument): Promise<QueueStateDocument> {
    const existing = await this.queueModel.findOne({ bookingId: booking.bookingId }).exec();
    if (existing) return existing;

    const queueDoc = new this.queueModel({
      bookingId: booking.bookingId,
      tokenNumber: booking.tokenNumber,
      farmerId: booking.farmerId,
      centreId: booking.centreId,
      bookingDate: booking.bookingDate,
      commodityCode: booking.commodityCode,
      quantityQuintals: booking.quantityQuintals,
      vehicleCount: booking.vehicleCount || 1,
      currentState: QueueStatus.BOOKED,
      stateHistory: [
        {
          fromState: QueueStatus.BOOKED,
          toState: QueueStatus.BOOKED,
          timestamp: new Date(),
          changedByUserId: 'SYSTEM',
          changedByRole: 'SYSTEM',
          notes: 'Initial booking created',
        },
      ],
    });

    await queueDoc.save();
    return queueDoc;
  }

  /**
   * Execute state transition with strict State Machine & RBAC validation
   */
  async transitionState(
    bookingId: string,
    toState: QueueStatus,
    actor: AuthenticatedUser,
    notes?: string,
    stage?: string,
    counterId?: string,
  ): Promise<{ queueState: QueueStateDocument; dynamicAdaptation?: any }> {
    const queueState = await this.queueModel.findOne({ bookingId }).exec();
    if (!queueState) {
      throw new NotFoundException(`Queue record for booking '${bookingId}' not found.`);
    }

    const booking = await this.bookingModel.findOne({ bookingId }).exec();
    if (!booking) {
      throw new NotFoundException(`Booking '${bookingId}' not found.`);
    }

    const fromState = queueState.currentState;

    // 1. Enforce State Machine Valid Transitions (Section 9)
    QueueStateMachine.validateTransition(fromState, toState);

    // 2. Enforce Role Authorization for Transition
    QueueStateMachine.checkRoleAuthorization(actor.role, toState);

    // 3. Apply state mutation
    const now = new Date();
    queueState.currentState = toState;
    queueState.stateHistory.push({
      fromState,
      toState,
      timestamp: now,
      changedByUserId: actor.userId,
      changedByRole: actor.role,
      notes: notes || null,
    });

    if (toState === QueueStatus.ARRIVED) {
      queueState.arrivedAt = now;
      booking.status = BookingStatus.ARRIVED;
    } else if (toState === QueueStatus.CHECKED_IN) {
      queueState.checkedInAt = now;
      queueState.currentStage = 'CHECKIN';
      booking.status = BookingStatus.CHECKED_IN;
    } else if (toState === QueueStatus.WAITING) {
      queueState.currentStage = null;
      queueState.activeCounterId = null;
    } else if (toState === QueueStatus.PROCESSING) {
      queueState.processingStartedAt = now;
      queueState.currentStage = stage || 'WEIGHING';
      queueState.activeCounterId = counterId || null;
      booking.status = BookingStatus.IN_PROGRESS;
    } else if (toState === QueueStatus.COMPLETED) {
      queueState.completedAt = now;
      queueState.currentStage = null;
      queueState.activeCounterId = null;
      booking.status = BookingStatus.COMPLETED;
    } else if (toState === QueueStatus.CANCELLED) {
      booking.status = BookingStatus.CANCELLED;
      booking.cancellationReason = notes || 'Cancelled by user';
    } else if (toState === QueueStatus.NO_SHOW) {
      booking.status = BookingStatus.NO_SHOW;
    }

    await queueState.save();
    await booking.save();

    this.logger.log(
      `[QUEUE_TRANSITION] Booking ${bookingId}: '${fromState}' -> '${toState}' by ${actor.role} (${actor.userId})`,
    );

    // 4. Dynamic Adaptation on Freed Capacity (Section 10)
    let adaptationReport: any = null;
    if (toState === QueueStatus.CANCELLED || toState === QueueStatus.NO_SHOW) {
      adaptationReport = await this.schedulingService.recomputeScheduleOnFreedCapacity(
        booking,
        toState,
      );
    }

    return {
      queueState,
      dynamicAdaptation: adaptationReport,
    };
  }

  /**
   * Centre Live Operational Queue View
   */
  async getCentreLiveQueue(centreId: string, date?: string): Promise<{
    centreId: string;
    date: string;
    counts: Record<string, number>;
    activeQueue: QueueStateDocument[];
  }> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const queueRecords = await this.queueModel
      .find({ centreId, bookingDate: targetDate })
      .sort({ tokenNumber: 1 })
      .exec();

    const counts: Record<string, number> = {
      BOOKED: 0,
      CONFIRMED: 0,
      ARRIVED: 0,
      CHECKED_IN: 0,
      WAITING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      NO_SHOW: 0,
      REJECTED: 0,
      HELD: 0,
    };

    queueRecords.forEach((r) => {
      counts[r.currentState] = (counts[r.currentState] || 0) + 1;
    });

    return {
      centreId,
      date: targetDate,
      counts,
      activeQueue: queueRecords,
    };
  }

  /**
   * Farmer Queue Status View (Personal Dashboard)
   */
  async getFarmerQueueStatus(farmerId: string): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    const queueDoc = await this.queueModel
      .findOne({
        farmerId,
        bookingDate: today,
        currentState: {
          $in: [
            QueueStatus.BOOKED,
            QueueStatus.CONFIRMED,
            QueueStatus.ARRIVED,
            QueueStatus.CHECKED_IN,
            QueueStatus.WAITING,
            QueueStatus.PROCESSING,
          ],
        },
      })
      .exec();

    if (!queueDoc) {
      return {
        hasActiveBookingToday: false,
        message: 'No active queue booking found for today.',
      };
    }

    // Calculate queue depth ahead
    const aheadCount = await this.queueModel.countDocuments({
      centreId: queueDoc.centreId,
      bookingDate: today,
      currentState: {
        $in: [QueueStatus.WAITING, QueueStatus.CHECKED_IN, QueueStatus.PROCESSING],
      },
      tokenNumber: { $lt: queueDoc.tokenNumber },
    }).exec();

    // Section 11: Realistic estimated wait time (~12 mins per vehicle ahead)
    const estimatedWaitMinutes = aheadCount * 12;

    return {
      hasActiveBookingToday: true,
      bookingId: queueDoc.bookingId,
      tokenNumber: queueDoc.tokenNumber,
      centreId: queueDoc.centreId,
      currentState: queueDoc.currentState,
      currentStage: queueDoc.currentStage,
      queuePosition: aheadCount + 1,
      estimatedWaitMinutes,
      commodityCode: queueDoc.commodityCode,
      quantityQuintals: queueDoc.quantityQuintals,
    };
  }
}
