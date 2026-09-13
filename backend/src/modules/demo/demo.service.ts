import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Centre, CentreDocument } from '../centres/schemas/centre.schema';
import { Counter, CounterDocument } from '../centres/schemas/counter.schema';
import { ArrivalWindow, ArrivalWindowDocument } from '../bookings/schemas/arrival-window.schema';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { BookingVehicle, BookingVehicleDocument, VehicleType } from '../bookings/schemas/booking-vehicle.schema';
import { QueueState, QueueStateDocument, QueueStatus } from '../queue/schemas/queue-state.schema';
import { SchedulingService } from '../scheduling/scheduling.service';
import { EventBusService } from '../../infrastructure/events/event-bus.service';
import { DomainEventType, DomainEvent } from '../../infrastructure/events/domain-events';
import { DEMO_CENTRE_ID } from '../../infrastructure/database/seeds/seed-demo-data';

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private readonly centreId = DEMO_CENTRE_ID;
  private readonly targetDate = '2026-04-15';

  constructor(
    @InjectModel(Centre.name) private readonly centreModel: Model<CentreDocument>,
    @InjectModel(Counter.name) private readonly counterModel: Model<CounterDocument>,
    @InjectModel(ArrivalWindow.name) private readonly windowModel: Model<ArrivalWindowDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(BookingVehicle.name) private readonly vehicleModel: Model<BookingVehicleDocument>,
    @InjectModel(QueueState.name) private readonly queueModel: Model<QueueStateDocument>,
    private readonly schedulingService: SchedulingService,
    private readonly eventBus: EventBusService,
  ) {}

  private async publishEvent(
    eventType: DomainEventType,
    payload: any,
    opts: { centreId?: string; bookingId?: string; farmerId?: string } = {},
  ) {
    const event: DomainEvent = {
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      timestamp: new Date(),
      centreId: opts.centreId || this.centreId,
      bookingId: opts.bookingId,
      farmerId: opts.farmerId,
      payload,
    };
    await this.eventBus.publish(event);
  }

  /**
   * Resets and initializes the Section 42 demo state in MongoDB
   */
  async resetAndSeedDemo() {
    this.logger.log('[Demo] Resetting and seeding Section 42 demonstration dataset in MongoDB...');

    // 1. Clean previous demo records for this centre
    await this.bookingModel.deleteMany({ centreId: this.centreId });
    await this.vehicleModel.deleteMany({ bookingId: { $regex: /^BK-DEMO/ } });
    await this.queueModel.deleteMany({ centreId: this.centreId });
    await this.windowModel.deleteMany({ centreId: this.centreId, date: this.targetDate });

    // 2. Ensure arrival windows exist
    await this.windowModel.create({
      centreId: this.centreId,
      date: this.targetDate,
      slotIndex: 1,
      startTime: '10:00',
      endTime: '11:00',
      maxCapacityQuintals: 70,
      bookedQuantityQuintals: 40,
      bookingCount: 1,
    });

    await this.windowModel.create({
      centreId: this.centreId,
      date: this.targetDate,
      slotIndex: 3,
      startTime: '12:00',
      endTime: '13:00',
      maxCapacityQuintals: 70,
      bookedQuantityQuintals: 65,
      bookingCount: 2,
    });

    // 3. Ensure counters are set to ACTIVE
    await this.counterModel.updateMany({ centreId: this.centreId }, { $set: { status: 'ACTIVE' } });

    // 4. Pre-seed demo bookings
    const bookingsData = [
      {
        bookingId: 'BK-DEMO-001',
        tokenNumber: 'T-001',
        farmerId: 'FARMER-MP-IND-001',
        farmerName: 'Ramesh Verma',
        centreId: this.centreId,
        commodityCode: 'WHEAT',
        quantityQuintals: 30,
        bookingDate: this.targetDate,
        arrivalWindow: { slotIndex: 1, startTime: '10:00', endTime: '11:00' },
        status: 'CONFIRMED',
        vehicleNumber: 'MP-09-AB-1234',
      },
      {
        bookingId: 'BK-DEMO-002',
        tokenNumber: 'T-002',
        farmerId: 'FARMER-MP-IND-002',
        farmerName: 'Suresh Patel',
        centreId: this.centreId,
        commodityCode: 'WHEAT',
        quantityQuintals: 25,
        bookingDate: this.targetDate,
        arrivalWindow: { slotIndex: 1, startTime: '10:00', endTime: '11:00' },
        status: 'CONFIRMED',
        vehicleNumber: 'MP-09-CD-5678',
      },
      {
        bookingId: 'BK-DEMO-003',
        tokenNumber: 'T-003',
        farmerId: 'FARMER-MP-IND-003',
        farmerName: 'Anil Choudhary',
        centreId: this.centreId,
        commodityCode: 'WHEAT',
        quantityQuintals: 40,
        bookingDate: this.targetDate,
        arrivalWindow: { slotIndex: 0, startTime: '09:00', endTime: '10:00' },
        status: 'CONFIRMED',
        vehicleNumber: 'MP-09-EF-9012',
      },
      {
        bookingId: 'BK-DEMO-004',
        tokenNumber: 'T-004',
        farmerId: 'FARMER-MP-IND-004',
        farmerName: 'Vikram Singh',
        centreId: this.centreId,
        commodityCode: 'WHEAT',
        quantityQuintals: 40,
        bookingDate: this.targetDate,
        arrivalWindow: { slotIndex: 1, startTime: '10:00', endTime: '11:00' },
        status: 'CONFIRMED',
        vehicleNumber: 'MP-09-GH-3456',
      },
      {
        bookingId: 'BK-DEMO-005',
        tokenNumber: 'T-005',
        farmerId: 'FARMER-MP-IND-005',
        farmerName: 'Mukesh Sharma',
        centreId: this.centreId,
        commodityCode: 'WHEAT',
        quantityQuintals: 20,
        bookingDate: this.targetDate,
        arrivalWindow: { slotIndex: 1, startTime: '10:00', endTime: '11:00' },
        status: 'CONFIRMED',
        vehicleNumber: 'MP-09-IJ-7890',
      },
      {
        bookingId: 'BK-DEMO-010',
        tokenNumber: 'T-010',
        farmerId: 'FARMER-MP-IND-010',
        farmerName: 'Gopal Dangi',
        centreId: this.centreId,
        commodityCode: 'WHEAT',
        quantityQuintals: 25,
        bookingDate: this.targetDate,
        arrivalWindow: { slotIndex: 3, startTime: '12:00', endTime: '13:00' },
        status: 'BOOKED',
        vehicleNumber: 'MP-09-KL-1122',
      },
      {
        bookingId: 'BK-DEMO-011',
        tokenNumber: 'T-011',
        farmerId: 'FARMER-MP-IND-011',
        farmerName: 'Kailash Meena',
        centreId: this.centreId,
        commodityCode: 'WHEAT',
        quantityQuintals: 50,
        bookingDate: this.targetDate,
        arrivalWindow: { slotIndex: 3, startTime: '12:00', endTime: '13:00' },
        status: 'BOOKED',
        vehicleNumber: 'MP-09-MN-3344',
      },
    ];

    for (const b of bookingsData) {
      await this.bookingModel.create({
        bookingId: b.bookingId,
        tokenNumber: b.tokenNumber,
        farmerId: b.farmerId,
        centreId: b.centreId,
        commodityCode: b.commodityCode,
        quantityQuintals: b.quantityQuintals,
        bookingDate: b.bookingDate,
        arrivalWindow: b.arrivalWindow,
        vehicleCount: 1,
        status: b.status,
      });

      await this.vehicleModel.create({
        bookingId: b.bookingId,
        vehicleNumber: b.vehicleNumber,
        vehicleType: VehicleType.TRACTOR_TROLLEY,
        allocatedQuantityQuintals: b.quantityQuintals,
        checkInStatus: 'PENDING',
      });

      await this.queueModel.create({
        bookingId: b.bookingId,
        tokenNumber: b.tokenNumber,
        farmerId: b.farmerId,
        centreId: b.centreId,
        bookingDate: b.bookingDate,
        commodityCode: b.commodityCode,
        quantityQuintals: b.quantityQuintals,
        vehicleCount: 1,
        currentState: QueueStatus.CONFIRMED,
        queuePosition: 1,
        estimatedWaitMinutes: 15,
        stateHistory: [],
      });
    }

    // Publish WebSocket notification that centre capacity / state initialized
    await this.publishEvent(DomainEventType.CENTRE_CAPACITY_CHANGED, {
      centreId: this.centreId,
      date: this.targetDate,
      status: 'INITIALIZED',
      message: 'Section 42 demonstration dataset seeded in MongoDB.',
    }, { centreId: this.centreId });

    return {
      success: true,
      message: 'Section 42 demonstration state seeded successfully in MongoDB.',
      centreId: this.centreId,
      date: this.targetDate,
      bookingsCount: bookingsData.length,
    };
  }

  /**
   * Step 1: Farmer 1 Arrives On Time
   */
  async executeStep1() {
    const booking = await this.bookingModel.findOne({ bookingId: 'BK-DEMO-001' });
    if (!booking) await this.resetAndSeedDemo();

    await this.queueModel.updateOne(
      { bookingId: 'BK-DEMO-001' },
      {
        $set: {
          currentState: QueueStatus.CHECKED_IN,
          currentStage: 'CHECKIN',
        },
      },
    );

    await this.publishEvent(DomainEventType.TOKEN_ASSIGNED, {
      bookingId: 'BK-DEMO-001',
      tokenNumber: 'T-001',
      farmerName: 'Ramesh Verma',
      vehicleNumber: 'MP-09-AB-1234',
      centreId: this.centreId,
      stage: 'Gate Check-in',
      status: 'CHECKED_IN',
      timestamp: new Date().toISOString(),
    }, { bookingId: 'BK-DEMO-001', centreId: this.centreId });

    await this.publishEvent(DomainEventType.FARMER_ARRIVED, {
      bookingId: 'BK-DEMO-001',
      tokenNumber: 'T-001',
      centreId: this.centreId,
      isLate: false,
      timestamp: new Date().toISOString(),
    }, { bookingId: 'BK-DEMO-001', centreId: this.centreId });

    return {
      step: 1,
      title: 'Farmer 1 (Ramesh Verma) Arrived On Time',
      token: 'T-001',
      status: 'CHECKED_IN',
      event: 'FARMER_ARRIVED & TOKEN_ASSIGNED emitted to WebSocket',
    };
  }

  /**
   * Step 2: Farmer 2 Arrives Late (+35m)
   */
  async executeStep2() {
    await this.queueModel.updateOne(
      { bookingId: 'BK-DEMO-002' },
      {
        $set: {
          currentState: QueueStatus.CHECKED_IN,
          currentStage: 'CHECKIN',
          isLateArrival: true,
        },
      },
    );

    await this.publishEvent(DomainEventType.FARMER_ARRIVED, {
      bookingId: 'BK-DEMO-002',
      tokenNumber: 'T-002',
      farmerName: 'Suresh Patel',
      centreId: this.centreId,
      isLate: true,
      delayMinutes: 35,
      timestamp: new Date().toISOString(),
    }, { bookingId: 'BK-DEMO-002', centreId: this.centreId });

    await this.publishEvent(DomainEventType.ETA_UPDATED, {
      bookingId: 'BK-DEMO-001',
      centreId: this.centreId,
      newEta: '10:45 AM',
      delayMinutes: 10,
      reason: 'Late arrival buffer adjustment',
    }, { bookingId: 'BK-DEMO-001' });

    return {
      step: 2,
      title: 'Farmer 2 (Suresh Patel) Arrived Late (+35m)',
      token: 'T-002',
      status: 'CHECKED_IN (LATE)',
      event: 'ETA_UPDATED emitted to WebSocket',
    };
  }

  /**
   * Step 3: Farmer 3 Physical Ground Processing
   */
  async executeStep3() {
    await this.queueModel.updateOne(
      { bookingId: 'BK-DEMO-003' },
      {
        $set: {
          currentState: QueueStatus.COMPLETED,
          currentStage: 'PROCUREMENT',
        },
      },
    );

    await this.publishEvent(DomainEventType.WEIGHMENT_COMPLETED, {
      bookingId: 'BK-DEMO-003',
      tokenNumber: 'T-003',
      scaleId: 'CTR-WEIGH-01',
      grossWeightQuintals: 40.0,
      centreId: this.centreId,
    }, { bookingId: 'BK-DEMO-003', centreId: this.centreId });

    await this.publishEvent(DomainEventType.QUALITY_COMPLETED, {
      bookingId: 'BK-DEMO-003',
      tokenNumber: 'T-003',
      moisturePercentage: 11.4,
      grade: 'GRADE_A',
      centreId: this.centreId,
    }, { bookingId: 'BK-DEMO-003', centreId: this.centreId });

    await this.publishEvent(DomainEventType.PROCUREMENT_COMPLETED, {
      bookingId: 'BK-DEMO-003',
      tokenNumber: 'T-003',
      quantityQuintals: 40.0,
      amountInr: 91000,
      centreId: this.centreId,
    }, { bookingId: 'BK-DEMO-003', centreId: this.centreId });

    return {
      step: 3,
      title: 'Farmer 3 (Anil Choudhary) Physical Ground Processing Completed',
      token: 'T-003',
      status: 'COMPLETED',
      event: 'WEIGHMENT_COMPLETED, QUALITY_COMPLETED, PROCUREMENT_COMPLETED emitted',
    };
  }

  /**
   * Step 4: Farmer 4 Cancels Booking & Triggers Dynamic Adaptation
   */
  async executeStep4() {
    const f4 = await this.bookingModel.findOne({ bookingId: 'BK-DEMO-004' });
    if (!f4) await this.resetAndSeedDemo();

    await this.bookingModel.updateOne(
      { bookingId: 'BK-DEMO-004' },
      { $set: { status: 'CANCELLED', cancellationReason: 'Personal emergency' } },
    );

    await this.queueModel.updateOne(
      { bookingId: 'BK-DEMO-004' },
      { $set: { currentState: QueueStatus.CANCELLED } },
    );

    await this.publishEvent(DomainEventType.BOOKING_CANCELLED, {
      bookingId: 'BK-DEMO-004',
      tokenNumber: 'T-004',
      centreId: this.centreId,
      freedCapacityQuintals: 40,
      slotIndex: 1,
    }, { bookingId: 'BK-DEMO-004', centreId: this.centreId });

    // Call real Dynamic Adaptation Engine in SchedulingService
    const freedBooking = await this.bookingModel.findOne({ bookingId: 'BK-DEMO-004' });
    let adaptationReport: any = null;
    if (freedBooking) {
      adaptationReport = await this.schedulingService.recomputeScheduleOnFreedCapacity(
        freedBooking,
        'CANCELLED',
        new Date('2026-04-15T09:00:00Z'),
      );
    }

    // Move Candidate A forward in database
    await this.bookingModel.updateOne(
      { bookingId: 'BK-DEMO-010' },
      { $set: { 'arrivalWindow.slotIndex': 1, 'arrivalWindow.startTime': '10:00', 'arrivalWindow.endTime': '11:00' } },
    );

    await this.publishEvent(DomainEventType.SCHEDULING_UPDATED, {
      centreId: this.centreId,
      bookingId: 'BK-DEMO-010',
      tokenNumber: 'T-010',
      action: 'MOVED_FORWARD',
      newSlot: '10:00 - 11:00 AM (Slot 1)',
      reason: 'Capacity freed by T-004 cancellation. Candidate fits 25Q and notice constraint.',
    }, { centreId: this.centreId, bookingId: 'BK-DEMO-010' });

    return {
      step: 4,
      title: 'Farmer 4 Cancelled & Dynamic Adaptation Executed',
      adaptationReport,
      movedCandidate: 'BK-DEMO-010 (Gopal Dangi, 25Q) moved forward to Slot 1',
      unalteredCandidate: 'BK-DEMO-011 (Kailash Meena, 50Q) remains in Slot 3 (exceeds 15Q remaining)',
      event: 'BOOKING_CANCELLED & SCHEDULING_UPDATED emitted to WebSocket',
    };
  }

  /**
   * Step 5: Farmer 5 Marked No-Show
   */
  async executeStep5() {
    await this.queueModel.updateOne(
      { bookingId: 'BK-DEMO-005' },
      { $set: { currentState: QueueStatus.NO_SHOW } },
    );

    await this.publishEvent(DomainEventType.FARMER_NO_SHOW, {
      bookingId: 'BK-DEMO-005',
      tokenNumber: 'T-005',
      centreId: this.centreId,
      slotIndex: 1,
      freedCapacityQuintals: 20,
    }, { bookingId: 'BK-DEMO-005', centreId: this.centreId });

    return {
      step: 5,
      title: 'Farmer 5 (Mukesh Sharma) Grace Period Elapsed -> Marked NO_SHOW',
      token: 'T-005',
      status: 'NO_SHOW',
      event: 'FARMER_NO_SHOW emitted to WebSocket',
    };
  }

  /**
   * Step 6: Counter 2 (Weighbridge 2) Breakdown
   */
  async executeStep6() {
    const report = await this.schedulingService.recomputeOnCounterBreakdown(
      this.centreId,
      'CTR-WEIGH-02',
      this.targetDate,
    );

    await this.publishEvent(DomainEventType.CENTRE_CAPACITY_CHANGED, {
      centreId: this.centreId,
      counterId: 'CTR-WEIGH-02',
      status: 'MAINTENANCE',
      bottleneckStage: report.bottleneckStage,
      newHourlyCapacity: report.newHourlyCapacity,
      hasAlert: true,
    }, { centreId: this.centreId });

    return {
      step: 6,
      title: 'Counter 2 (Weighbridge 2) Breakdown Recomputation Completed',
      counterId: 'CTR-WEIGH-02',
      status: 'MAINTENANCE',
      report,
      event: 'CENTRE_CAPACITY_CHANGED emitted to WebSocket',
    };
  }

  /**
   * Run entire Section 42 scenario end-to-end
   */
  async runFullScenario() {
    await this.resetAndSeedDemo();
    const s1 = await this.executeStep1();
    const s2 = await this.executeStep2();
    const s3 = await this.executeStep3();
    const s4 = await this.executeStep4();
    const s5 = await this.executeStep5();
    const s6 = await this.executeStep6();

    return {
      success: true,
      scenario: 'Section 42 Comprehensive Demo Scenario',
      centreId: this.centreId,
      steps: [s1, s2, s3, s4, s5, s6],
    };
  }

  /**
   * Get current live roster directly from MongoDB
   */
  async getLiveRoster() {
    const bookings = await this.bookingModel.find({ centreId: this.centreId }).sort({ tokenNumber: 1 });
    const queues = await this.queueModel.find({ centreId: this.centreId });
    const counters = await this.counterModel.find({ centreId: this.centreId });

    const queueMap = new Map();
    queues.forEach((q) => queueMap.set(q.bookingId, q));

    const roster = bookings.map((b) => {
      const q = queueMap.get(b.bookingId);
      return {
        bookingId: b.bookingId,
        token: b.tokenNumber,
        farmerId: b.farmerId,
        qty: `${b.quantityQuintals}.0 Q (${b.commodityCode})`,
        window: `${b.arrivalWindow.startTime} - ${b.arrivalWindow.endTime}`,
        status: q ? q.currentState : b.status,
        stage: q?.currentState === 'COMPLETED' ? 'Procurement Finalized' : b.status,
      };
    });

    return {
      success: true,
      centreId: this.centreId,
      counters,
      roster,
    };
  }
}
