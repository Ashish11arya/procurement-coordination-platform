import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { EventBusService } from '../../infrastructure/events/event-bus.service';
import { DomainEventType } from '../../infrastructure/events/domain-events';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WeighingRecord,
  WeighingRecordDocument,
} from './schemas/weighing-record.schema';
import {
  QualityRecord,
  QualityRecordDocument,
  QualityVerdict,
  QualityGrade,
} from './schemas/quality-record.schema';
import {
  ProcurementRecord,
  ProcurementRecordDocument,
  GovSyncStatus,
} from './schemas/procurement-record.schema';
import {
  ServiceSession,
  ServiceSessionDocument,
  ServiceSessionStatus,
} from './schemas/service-session.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schemas/booking.schema';
import { QueueState, QueueStateDocument, QueueStatus } from '../queue/schemas/queue-state.schema';
import { Centre, CentreDocument } from '../centres/schemas/centre.schema';
import { Counter, CounterDocument, CounterStatus } from '../centres/schemas/counter.schema';
import { ArrivalWindow, ArrivalWindowDocument } from '../bookings/schemas/arrival-window.schema';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditSource } from '../audit/schemas/audit-log.schema';
import {
  GovernmentDataProvider,
  GOVERNMENT_DATA_PROVIDER,
} from '../integrations/contracts/government-data-provider.interface';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuthenticatedUser } from '../../shared/types/auth.types';
import { Role } from '../../shared/enums/roles.enum';
import {
  CheckInDto,
  StartWeighingDto,
  CompleteWeighingDto,
  QualityAssessmentDto,
  ProcurementCompletionDto,
} from './dto/operations.dto';

@Injectable()
export class OperationsService {
  private readonly logger = new Logger(OperationsService.name);

  constructor(
    @InjectModel(WeighingRecord.name)
    private readonly weighingModel: Model<WeighingRecordDocument>,
    @InjectModel(QualityRecord.name)
    private readonly qualityModel: Model<QualityRecordDocument>,
    @InjectModel(ProcurementRecord.name)
    private readonly procurementModel: Model<ProcurementRecordDocument>,
    @InjectModel(ServiceSession.name)
    private readonly sessionModel: Model<ServiceSessionDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(QueueState.name)
    private readonly queueModel: Model<QueueStateDocument>,
    @InjectModel(Centre.name)
    private readonly centreModel: Model<CentreDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
    @InjectModel(ArrivalWindow.name)
    private readonly windowModel: Model<ArrivalWindowDocument>,
    @Inject(GOVERNMENT_DATA_PROVIDER)
    private readonly govProvider: GovernmentDataProvider,
    private readonly queueService: QueueService,
    private readonly auditService: AuditService,
    private readonly redisService: RedisService,
    @Optional() private readonly eventBusService?: EventBusService,
  ) {}

  // --------------------------------------------------------------------------
  // 1. Check-in Operator Workflow
  // --------------------------------------------------------------------------
  async checkIn(dto: CheckInDto, user: AuthenticatedUser) {
    const booking = await this.bookingModel.findOne({ bookingId: dto.bookingId }).exec();
    if (!booking) {
      throw new NotFoundException(`Booking '${dto.bookingId}' not found.`);
    }

    if (user.role === Role.CENTRE_ADMIN && user.scope?.centreId && user.scope.centreId !== booking.centreId) {
      throw new ForbiddenException(`Access denied to centre '${booking.centreId}'.`);
    }

    if (booking.tokenNumber !== dto.tokenNumber) {
      throw new BadRequestException(
        `Token mismatch. Provided '${dto.tokenNumber}', expected '${booking.tokenNumber}'.`,
      );
    }

    if (booking.status !== BookingStatus.BOOKED && booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(
        `Cannot check in booking with status '${booking.status}'. Must be BOOKED or CONFIRMED.`,
      );
    }

    // Ensure queue state exists
    await this.queueService.initializeQueueState(booking);

    // If currently BOOKED, advance to CONFIRMED
    const queue = await this.queueModel.findOne({ bookingId: booking.bookingId }).exec();
    if (queue && queue.currentState === QueueStatus.BOOKED) {
      await this.queueService.transitionState(
        booking.bookingId,
        QueueStatus.CONFIRMED,
        user,
        'Booking confirmed upon arrival verification.',
      );
    }

    // Advance state: CONFIRMED -> ARRIVED -> CHECKED_IN -> WAITING (in yard)
    await this.queueService.transitionState(
      booking.bookingId,
      QueueStatus.ARRIVED,
      user,
      'Vehicle arrived at gate.',
    );

    await this.queueService.transitionState(
      booking.bookingId,
      QueueStatus.CHECKED_IN,
      user,
      'Check-in token and vehicle verified.',
      'CHECKIN',
    );

    await this.queueService.transitionState(
      booking.bookingId,
      QueueStatus.WAITING,
      user,
      'Admitted to centre yard, waiting for weighbridge call.',
      'CHECKIN',
    );

    // Update Booking status
    booking.status = BookingStatus.CHECKED_IN;
    await booking.save();

    // Record session
    await this.sessionModel.create({
      bookingId: booking.bookingId,
      centreId: booking.centreId,
      counterId: 'GATE-CHECKIN',
      stage: 'CHECKIN',
      operatorId: user.userId,
      startedAt: new Date(),
      completedAt: new Date(),
      status: ServiceSessionStatus.COMPLETED,
      durationSeconds: 60,
      notes: dto.notes,
    });

    await this.auditService.logAction({
      requestId: `req-ck-${Date.now()}`,
      action: AuditAction.CHECKIN_RECORDED,
      who: {
        userId: user.userId,
        role: user.role,
        ipAddress: '127.0.0.1',
      },
      target: {
        entityType: 'Booking',
        entityId: booking.bookingId,
      },
      scope: { centreId: booking.centreId },
      newValue: {
        status: BookingStatus.CHECKED_IN,
        vehicleNumber: dto.vehicleNumber,
        tokenNumber: dto.tokenNumber,
      },
      source: AuditSource.HTTP_API,
    });

    if (this.eventBusService) {
      await this.eventBusService.publish({
        eventId: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        eventType: DomainEventType.TOKEN_ASSIGNED,
        timestamp: new Date(),
        centreId: booking.centreId,
        bookingId: booking.bookingId,
        farmerId: booking.farmerId,
        payload: {
          bookingId: booking.bookingId,
          farmerId: booking.farmerId,
          centreId: booking.centreId,
          tokenNumber: dto.tokenNumber,
          vehicleNumber: dto.vehicleNumber,
        },
      });
      await this.eventBusService.publish({
        eventId: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        eventType: DomainEventType.FARMER_ARRIVED,
        timestamp: new Date(),
        centreId: booking.centreId,
        bookingId: booking.bookingId,
        farmerId: booking.farmerId,
        payload: {
          bookingId: booking.bookingId,
          farmerId: booking.farmerId,
          centreId: booking.centreId,
        },
      });
    }

    return {
      success: true,
      bookingId: booking.bookingId,
      status: BookingStatus.CHECKED_IN,
      queueState: QueueStatus.WAITING,
      tokenNumber: booking.tokenNumber,
      message: 'Farmer successfully checked in and admitted to yard.',
    };
  }

  // --------------------------------------------------------------------------
  // 2. Weighing Operator Workflow
  // --------------------------------------------------------------------------
  async startWeighing(dto: StartWeighingDto, user: AuthenticatedUser) {
    const booking = await this.bookingModel.findOne({ bookingId: dto.bookingId }).exec();
    if (!booking) {
      throw new NotFoundException(`Booking '${dto.bookingId}' not found.`);
    }

    const queue = await this.queueModel.findOne({ bookingId: dto.bookingId }).exec();
    if (!queue || queue.currentState !== QueueStatus.WAITING) {
      throw new ConflictException(
        `Cannot start weighing for booking in queue state '${queue?.currentState || 'NONE'}'. Expected WAITING.`,
      );
    }

    // Advance queue: WAITING -> PROCESSING (stage: WEIGHING)
    await this.queueService.transitionState(
      booking.bookingId,
      QueueStatus.PROCESSING,
      user,
      `Weighment started at counter ${dto.counterId}`,
      'WEIGHING',
      dto.counterId,
    );

    booking.status = BookingStatus.IN_PROGRESS;
    await booking.save();

    // Create In-Progress ServiceSession
    const session = await this.sessionModel.create({
      bookingId: booking.bookingId,
      centreId: booking.centreId,
      counterId: dto.counterId,
      stage: 'WEIGHING',
      operatorId: user.userId,
      startedAt: new Date(),
      status: ServiceSessionStatus.IN_PROGRESS,
    });

    return {
      success: true,
      bookingId: booking.bookingId,
      queueState: QueueStatus.PROCESSING,
      stage: 'WEIGHING',
      sessionId: (session as any)._id,
    };
  }

  async completeWeighing(dto: CompleteWeighingDto, user: AuthenticatedUser) {
    const booking = await this.bookingModel.findOne({ bookingId: dto.bookingId }).exec();
    if (!booking) {
      throw new NotFoundException(`Booking '${dto.bookingId}' not found.`);
    }

    if (dto.grossWeightQuintals <= dto.tareWeightQuintals) {
      throw new BadRequestException(
        `Gross weight (${dto.grossWeightQuintals}Q) must exceed tare weight (${dto.tareWeightQuintals}Q).`,
      );
    }

    const netWeightQuintals = Number((dto.grossWeightQuintals - dto.tareWeightQuintals).toFixed(2));
    const now = new Date();
    const slipNumber = `WS-${booking.centreId.slice(-4)}-${Date.now().toString().slice(-6)}`;

    // Create durable WeighingRecord
    await this.weighingModel.create({
      bookingId: booking.bookingId,
      centreId: booking.centreId,
      counterId: dto.counterId,
      vehicleNumber: dto.vehicleNumber,
      grossWeightQuintals: dto.grossWeightQuintals,
      tareWeightQuintals: dto.tareWeightQuintals,
      netWeightQuintals,
      weighmentSlipNumber: slipNumber,
      operatorId: user.userId,
      weighedAt: now,
      notes: dto.notes,
    });

    // Update active service session
    await this.sessionModel.updateOne(
      {
        bookingId: booking.bookingId,
        stage: 'WEIGHING',
        status: ServiceSessionStatus.IN_PROGRESS,
      },
      {
        $set: {
          completedAt: now,
          status: ServiceSessionStatus.COMPLETED,
        },
      },
    );

    // Advance queue: PROCESSING -> WAITING (waiting for Quality stage)
    await this.queueService.transitionState(
      booking.bookingId,
      QueueStatus.WAITING,
      user,
      `Weighment completed. Net weight: ${netWeightQuintals}Q. Waiting for quality inspection.`,
      'WEIGHING',
    );

    await this.auditService.logAction({
      requestId: `req-wgh-${Date.now()}`,
      action: AuditAction.WEIGHING_SUBMITTED,
      who: {
        userId: user.userId,
        role: user.role,
        ipAddress: '127.0.0.1',
      },
      target: {
        entityType: 'WeighingRecord',
        entityId: slipNumber,
      },
      scope: { centreId: booking.centreId },
      newValue: {
        bookingId: booking.bookingId,
        gross: dto.grossWeightQuintals,
        tare: dto.tareWeightQuintals,
        net: netWeightQuintals,
      },
      source: AuditSource.HTTP_API,
    });

    if (this.eventBusService) {
      await this.eventBusService.publish({
        eventId: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        eventType: DomainEventType.WEIGHMENT_COMPLETED,
        timestamp: new Date(),
        centreId: booking.centreId,
        bookingId: booking.bookingId,
        farmerId: booking.farmerId,
        payload: {
          bookingId: booking.bookingId,
          farmerId: booking.farmerId,
          centreId: booking.centreId,
          slipNumber,
          grossWeightKg: dto.grossWeightQuintals * 100,
          tareWeightKg: dto.tareWeightQuintals * 100,
          netWeightQuintals,
        },
      });
    }

    return {
      success: true,
      bookingId: booking.bookingId,
      weighmentSlipNumber: slipNumber,
      netWeightQuintals,
      queueState: QueueStatus.WAITING,
      nextStage: 'QUALITY',
    };
  }

  // --------------------------------------------------------------------------
  // 3. Quality Operator Workflow
  // --------------------------------------------------------------------------
  async recordQuality(dto: QualityAssessmentDto, user: AuthenticatedUser) {
    const booking = await this.bookingModel.findOne({ bookingId: dto.bookingId }).exec();
    if (!booking) {
      throw new NotFoundException(`Booking '${dto.bookingId}' not found.`);
    }

    const now = new Date();

    // Persist QualityRecord
    const record = await this.qualityModel.create({
      bookingId: booking.bookingId,
      centreId: booking.centreId,
      counterId: dto.counterId,
      commodityCode: booking.commodityCode,
      moisturePercentage: dto.moisturePercentage,
      foreignMatterPercentage: dto.foreignMatterPercentage,
      damagedGrainsPercentage: dto.damagedGrainsPercentage,
      assignedGrade: dto.assignedGrade,
      verdict: dto.verdict,
      rejectionReason: dto.rejectionReason,
      operatorId: user.userId,
      assessedAt: now,
      notes: dto.notes,
    });

    // Advance queue to PROCESSING (Quality)
    await this.queueService.transitionState(
      booking.bookingId,
      QueueStatus.PROCESSING,
      user,
      `Quality inspection started at counter ${dto.counterId}`,
      'QUALITY',
      dto.counterId,
    );

    // Record session
    await this.sessionModel.create({
      bookingId: booking.bookingId,
      centreId: booking.centreId,
      counterId: dto.counterId,
      stage: 'QUALITY',
      operatorId: user.userId,
      startedAt: now,
      completedAt: now,
      status: ServiceSessionStatus.COMPLETED,
      notes: `Grade: ${dto.assignedGrade}, Verdict: ${dto.verdict}`,
    });

    // Advance to final state based on verdict
    let targetQueueStatus: QueueStatus;
    if (dto.verdict === QualityVerdict.ACCEPTED) {
      targetQueueStatus = QueueStatus.WAITING; // Waiting for Procurement stage
    } else if (dto.verdict === QualityVerdict.REJECTED) {
      targetQueueStatus = QueueStatus.REJECTED;
      booking.status = BookingStatus.CANCELLED;
      booking.cancellationReason = `Rejected in Quality: ${dto.rejectionReason || 'Quality criteria unmet'}`;
      await booking.save();
    } else {
      targetQueueStatus = QueueStatus.HELD;
    }

    await this.queueService.transitionState(
      booking.bookingId,
      targetQueueStatus,
      user,
      `Quality verdict: ${dto.verdict}. Grade: ${dto.assignedGrade}. ${dto.rejectionReason || ''}`,
      'QUALITY',
    );

    await this.auditService.logAction({
      requestId: `req-qty-${Date.now()}`,
      action: AuditAction.QUALITY_ASSESSED,
      who: {
        userId: user.userId,
        role: user.role,
        ipAddress: '127.0.0.1',
      },
      target: {
        entityType: 'QualityRecord',
        entityId: (record as any)._id?.toString(),
      },
      scope: { centreId: booking.centreId },
      newValue: {
        bookingId: booking.bookingId,
        verdict: dto.verdict,
        grade: dto.assignedGrade,
        moisture: dto.moisturePercentage,
      },
      source: AuditSource.HTTP_API,
    });

    if (this.eventBusService) {
      await this.eventBusService.publish({
        eventId: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        eventType: DomainEventType.QUALITY_COMPLETED,
        timestamp: new Date(),
        centreId: booking.centreId,
        bookingId: booking.bookingId,
        farmerId: booking.farmerId,
        payload: {
          bookingId: booking.bookingId,
          farmerId: booking.farmerId,
          centreId: booking.centreId,
          verdict: dto.verdict,
          assignedGrade: dto.assignedGrade,
          moisturePercentage: dto.moisturePercentage,
        },
      });
    }

    return {
      success: true,
      bookingId: booking.bookingId,
      verdict: dto.verdict,
      assignedGrade: dto.assignedGrade,
      queueState: targetQueueStatus,
      nextStage: dto.verdict === QualityVerdict.ACCEPTED ? 'PROCUREMENT' : 'NONE',
    };
  }

  // --------------------------------------------------------------------------
  // 4. Procurement Operator Workflow
  // --------------------------------------------------------------------------
  async recordProcurement(dto: ProcurementCompletionDto, user: AuthenticatedUser) {
    const booking = await this.bookingModel.findOne({ bookingId: dto.bookingId }).exec();
    if (!booking) {
      throw new NotFoundException(`Booking '${dto.bookingId}' not found.`);
    }

    // Verify Quality Record exists and was ACCEPTED
    const qualityRecord = await this.qualityModel.findOne({ bookingId: dto.bookingId }).exec();
    if (!qualityRecord || qualityRecord.verdict !== QualityVerdict.ACCEPTED) {
      throw new BadRequestException(
        `Cannot procure booking '${dto.bookingId}'. Quality assessment must be ACCEPTED (Current: ${qualityRecord?.verdict || 'NONE'}).`,
      );
    }

    // Verify Weighing Record
    const weighingRecord = await this.weighingModel.findOne({ bookingId: dto.bookingId }).exec();
    if (!weighingRecord) {
      throw new BadRequestException(`No weighing record found for booking '${dto.bookingId}'.`);
    }

    // Advance queue: WAITING -> PROCESSING (Procurement)
    await this.queueService.transitionState(
      booking.bookingId,
      QueueStatus.PROCESSING,
      user,
      `Procurement handoff started at counter ${dto.counterId}`,
      'PROCUREMENT',
      dto.counterId,
    );

    const totalPayout = Number((dto.finalQuantityQuintals * dto.mspRatePerQuintal).toFixed(2));
    const now = new Date();
    const receiptNumber = `PR-${booking.centreId.slice(-4)}-${Date.now().toString().slice(-6)}`;

    // Create ProcurementRecord
    const procurementRecord = new this.procurementModel({
      bookingId: booking.bookingId,
      centreId: booking.centreId,
      farmerId: booking.farmerId,
      commodityCode: booking.commodityCode,
      finalQuantityQuintals: dto.finalQuantityQuintals,
      mspRatePerQuintal: dto.mspRatePerQuintal,
      totalPayoutEstimated: totalPayout,
      receiptNumber,
      operatorId: user.userId,
      govSyncStatus: GovSyncStatus.PENDING,
      procuredAt: now,
    });

    // Authoritative Government Sync via GovernmentDataProvider
    try {
      const syncResult = await this.govProvider.submitProcurementUpdate({
        externalBookingId: booking.bookingId,
        centreId: booking.centreId,
        farmerId: booking.farmerId,
        commodityCode: booking.commodityCode,
        netWeightQuintals: dto.finalQuantityQuintals,
        moisturePercentage: qualityRecord.moisturePercentage,
        foreignMatterPercentage: qualityRecord.foreignMatterPercentage,
        qualityGrade: qualityRecord.assignedGrade === QualityGrade.GRADE_A ? 'GRADE_A' : 'STANDARD',
        counterId: dto.counterId,
        operatorUserId: user.userId,
        timestamp: now.toISOString(),
      });

      if (syncResult.success) {
        procurementRecord.govSyncStatus = GovSyncStatus.SYNCED;
        procurementRecord.govReferenceId = syncResult.officialAcknowledgementId;
      } else {
        procurementRecord.govSyncStatus = GovSyncStatus.FAILED;
        procurementRecord.govSyncError = syncResult.errorMessage;
      }
    } catch (err: any) {
      this.logger.error(`Government sync failed for booking ${booking.bookingId}: ${err.message}`);
      procurementRecord.govSyncStatus = GovSyncStatus.FAILED;
      procurementRecord.govSyncError = err.message;
    }

    await procurementRecord.save();

    // Finalize queue: PROCESSING -> COMPLETED
    await this.queueService.transitionState(
      booking.bookingId,
      QueueStatus.COMPLETED,
      user,
      `Procurement finalized. Receipt: ${receiptNumber}. Payout: ₹${totalPayout}`,
      'PROCUREMENT',
    );

    booking.status = BookingStatus.COMPLETED;
    await booking.save();

    // Invalidate Redis dashboard cache for this centre
    await this.redisService.del(`centre:${booking.centreId}:dashboard`);

    await this.auditService.logAction({
      requestId: `req-prc-${Date.now()}`,
      action: AuditAction.PROCUREMENT_FINALIZED,
      who: {
        userId: user.userId,
        role: user.role,
        ipAddress: '127.0.0.1',
      },
      target: {
        entityType: 'ProcurementRecord',
        entityId: receiptNumber,
      },
      scope: { centreId: booking.centreId },
      newValue: {
        bookingId: booking.bookingId,
        finalQuantity: dto.finalQuantityQuintals,
        msp: dto.mspRatePerQuintal,
        totalPayout,
        govSyncStatus: procurementRecord.govSyncStatus,
      },
      source: AuditSource.HTTP_API,
    });

    if (this.eventBusService) {
      await this.eventBusService.publish({
        eventId: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        eventType: DomainEventType.PROCUREMENT_COMPLETED,
        timestamp: new Date(),
        centreId: booking.centreId,
        bookingId: booking.bookingId,
        farmerId: booking.farmerId,
        payload: {
          bookingId: booking.bookingId,
          farmerId: booking.farmerId,
          centreId: booking.centreId,
          receiptNumber,
          quantityProcuredQuintals: dto.finalQuantityQuintals,
          totalPayoutEstimated: totalPayout,
        },
      });

      if (procurementRecord.govSyncStatus === GovSyncStatus.FAILED) {
        await this.eventBusService.publish({
          eventId: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          eventType: DomainEventType.GOVERNMENT_SYNC_FAILED,
          timestamp: new Date(),
          centreId: booking.centreId,
          bookingId: booking.bookingId,
          payload: {
            bookingId: booking.bookingId,
            centreId: booking.centreId,
            error: procurementRecord.govSyncError,
          },
        });
      } else if (procurementRecord.govSyncStatus === GovSyncStatus.SYNCED) {
        await this.eventBusService.publish({
          eventId: `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          eventType: DomainEventType.GOVERNMENT_SYNC_COMPLETED,
          timestamp: new Date(),
          centreId: booking.centreId,
          bookingId: booking.bookingId,
          payload: {
            bookingId: booking.bookingId,
            centreId: booking.centreId,
            govReferenceId: procurementRecord.govReferenceId,
          },
        });
      }
    }

    return {
      success: true,
      bookingId: booking.bookingId,
      receiptNumber,
      finalQuantityQuintals: dto.finalQuantityQuintals,
      totalPayoutEstimated: totalPayout,
      govSyncStatus: procurementRecord.govSyncStatus,
      status: BookingStatus.COMPLETED,
    };
  }

  // --------------------------------------------------------------------------
  // 5. Centre Dashboard (Section 29) - Durable DB with Redis Cache-Aside
  // --------------------------------------------------------------------------
  async getCentreDashboard(centreId: string, user: AuthenticatedUser) {
    if (user.role === Role.CENTRE_ADMIN && user.scope?.centreId && user.scope.centreId !== centreId) {
      throw new ForbiddenException(`Access denied to centre '${centreId}'.`);
    }

    const centre = await this.centreModel.findOne({ centreId }).exec();
    if (!centre) {
      throw new NotFoundException(`Centre '${centreId}' not found.`);
    }

    if (user.role === Role.DISTRICT_ADMIN && user.scope?.districtId && user.scope.districtId !== centre.district) {
      throw new ForbiddenException(`Access denied. Centre '${centreId}' is outside your assigned district.`);
    }

    if (user.role === Role.STATE_ADMIN && user.scope?.stateId && user.scope.stateId !== centre.state) {
      throw new ForbiddenException(`Access denied. Centre '${centreId}' is outside your assigned state.`);
    }

    // Redis Cache-Aside check
    const cacheKey = `centre:${centreId}:dashboard`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { ...parsed, isCached: true };
      } catch (e) {
        // Fallback to durable DB
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const bookings = await this.bookingModel.find({ centreId, bookingDate: today }).exec();
    const queues = await this.queueModel.find({ centreId, bookingDate: today }).exec();
    const counters = await this.counterModel.find({ centreId }).exec();
    const windows = await this.windowModel.find({ centreId, date: today }).exec();

    const bookedQuantity = bookings.reduce((sum, b) => sum + b.quantityQuintals, 0);
    const completedBookings = bookings.filter((b) => b.status === BookingStatus.COMPLETED);
    const procuredQuantity = completedBookings.reduce((sum, b) => sum + b.quantityQuintals, 0);
    const remainingCapacity = Math.max(0, centre.dailyCapacityQuintals - bookedQuantity);

    const queueCounts = {
      booked: queues.filter((q) => q.currentState === QueueStatus.BOOKED).length,
      confirmed: queues.filter((q) => q.currentState === QueueStatus.CONFIRMED).length,
      arrived: queues.filter((q) => q.currentState === QueueStatus.ARRIVED).length,
      checkedIn: queues.filter((q) => q.currentState === QueueStatus.CHECKED_IN).length,
      waiting: queues.filter((q) => q.currentState === QueueStatus.WAITING).length,
      processing: queues.filter((q) => q.currentState === QueueStatus.PROCESSING).length,
      completed: queues.filter((q) => q.currentState === QueueStatus.COMPLETED).length,
      cancelled: queues.filter((q) => q.currentState === QueueStatus.CANCELLED).length,
      noShow: queues.filter((q) => q.currentState === QueueStatus.NO_SHOW).length,
      rejected: queues.filter((q) => q.currentState === QueueStatus.REJECTED).length,
      held: queues.filter((q) => q.currentState === QueueStatus.HELD).length,
    };

    const counterBreakdown = counters.map((c) => ({
      counterId: c.counterId,
      counterNumber: c.counterNumber,
      stage: c.stage,
      status: c.status,
      capacityPerHourQuintals: c.capacityPerHourQuintals,
    }));

    // Detect bottleneck stage
    let bottleneckStage = 'NONE';
    const stageWaitingCounts: Record<string, number> = {
      CHECKIN: queues.filter((q) => q.currentStage === 'CHECKIN' && q.currentState === QueueStatus.WAITING).length,
      WEIGHING: queues.filter((q) => q.currentStage === 'WEIGHING' && q.currentState === QueueStatus.WAITING).length,
      QUALITY: queues.filter((q) => q.currentStage === 'QUALITY' && q.currentState === QueueStatus.WAITING).length,
      PROCUREMENT: queues.filter((q) => q.currentStage === 'PROCUREMENT' && q.currentState === QueueStatus.WAITING).length,
    };

    let maxDepth = 0;
    for (const [stg, depth] of Object.entries(stageWaitingCounts)) {
      if (depth > maxDepth && depth >= 3) {
        maxDepth = depth;
        bottleneckStage = stg;
      }
    }

    const payload = {
      centreId: centre.centreId,
      centreName: centre.name,
      district: centre.district,
      state: centre.state,
      date: today,
      sanctionedDailyCapacityQuintals: centre.dailyCapacityQuintals,
      bookedQuantityQuintals: bookedQuantity,
      procuredQuantityQuintals: procuredQuantity,
      remainingCapacityQuintals: remainingCapacity,
      capacityUtilizationPercentage: Number(
        ((bookedQuantity / centre.dailyCapacityQuintals) * 100).toFixed(1),
      ),
      totalBookingsCount: bookings.length,
      queueSummary: queueCounts,
      counters: counterBreakdown,
      bottlenecks: {
        hasBottleneck: bottleneckStage !== 'NONE',
        bottleneckStage,
        queueDepth: maxDepth,
      },
      alerts: windows.filter((w) => w.hasCapacityAlert).length,
      isCached: false,
    };

    await this.redisService.set(cacheKey, JSON.stringify(payload), 15);
    return payload;
  }
}
