import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SchedulingService } from '../../src/modules/scheduling/scheduling.service';
import { SchedulingDecision, DecisionOutcome } from '../../src/modules/scheduling/schemas/scheduling-decision.schema';
import { Booking, BookingStatus } from '../../src/modules/bookings/schemas/booking.schema';
import { ArrivalWindow } from '../../src/modules/bookings/schemas/arrival-window.schema';
import { Centre } from '../../src/modules/centres/schemas/centre.schema';
import { Counter, CounterStage, CounterStatus } from '../../src/modules/centres/schemas/counter.schema';
import { GOVERNMENT_DATA_PROVIDER } from '../../src/modules/integrations/contracts/government-data-provider.interface';
import { MockGovernmentProvider } from '../../src/modules/integrations/providers/mock-government.provider';
import { createMockModel } from '../integration/in-memory-mongo.mock';

describe('SchedulingService (Unit Tests)', () => {
  let service: SchedulingService;
  let decisionModel: any;
  let bookingModel: any;
  let windowModel: any;
  let centreModel: any;
  let counterModel: any;
  let govProvider: MockGovernmentProvider;

  const mockCentre = {
    centreId: 'CENTRE-MP-IND-01',
    name: 'Sanwer Krishi Upaj Mandi',
    state: 'Madhya Pradesh',
    district: 'Indore',
    dailyCapacityQuintals: 500,
    maxSimultaneousVehicles: 15,
    operatingHours: { openTime: '09:00', closeTime: '18:00' },
    supportedCommodities: ['WHEAT', 'CHANA'],
    isActive: true,
  };

  const mockCounters = [
    {
      counterId: 'CTR-CK1',
      centreId: 'CENTRE-MP-IND-01',
      counterNumber: 1,
      stage: CounterStage.CHECKIN,
      capacityPerHourQuintals: 60,
      status: CounterStatus.ACTIVE,
    },
    {
      counterId: 'CTR-WT1',
      centreId: 'CENTRE-MP-IND-01',
      counterNumber: 1,
      stage: CounterStage.WEIGHING,
      capacityPerHourQuintals: 50,
      status: CounterStatus.ACTIVE,
    },
    {
      counterId: 'CTR-QL1',
      centreId: 'CENTRE-MP-IND-01',
      counterNumber: 1,
      stage: CounterStage.QUALITY,
      capacityPerHourQuintals: 45, // Narrowest bottleneck stage
      status: CounterStatus.ACTIVE,
    },
    {
      counterId: 'CTR-PR1',
      centreId: 'CENTRE-MP-IND-01',
      counterNumber: 1,
      stage: CounterStage.PROCUREMENT,
      capacityPerHourQuintals: 60,
      status: CounterStatus.ACTIVE,
    },
  ];

  beforeEach(async () => {
    decisionModel = createMockModel();
    bookingModel = createMockModel();
    windowModel = createMockModel();
    centreModel = createMockModel([mockCentre]);
    counterModel = createMockModel(mockCounters);
    govProvider = new MockGovernmentProvider();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulingService,
        { provide: getModelToken(SchedulingDecision.name), useValue: decisionModel },
        { provide: getModelToken(Booking.name), useValue: bookingModel },
        { provide: getModelToken(ArrivalWindow.name), useValue: windowModel },
        { provide: getModelToken(Centre.name), useValue: centreModel },
        { provide: getModelToken(Counter.name), useValue: counterModel },
        { provide: GOVERNMENT_DATA_PROVIDER, useValue: govProvider },
      ],
    }).compile();

    service = module.get<SchedulingService>(SchedulingService);
  });

  // --------------------------------------------------------------------------
  // 1. Normal Booking Within Capacity (Section 6, 8, 13)
  // --------------------------------------------------------------------------
  describe('Normal Booking Within Capacity', () => {
    it('should assign a feasible arrival window across all 4 operational stages', async () => {
      const result = await service.evaluateBookingConstraints({
        farmerId: 'FARMER-MP-IND-001',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 30,
        bookingDate: '2026-09-25',
        preferredSlotIndex: 0,
        vehicleCount: 1,
      });

      expect(result.isFeasible).toBe(true);
      expect(result.assignedWindow).toBeDefined();
      expect(result.assignedWindow!.startTime).toBe('09:00');
      expect(result.assignedWindow!.endTime).toBe('10:00');
      expect(result.estimatedDurationMinutes).toBeGreaterThan(10);
      expect(result.stageMetrics.length).toBe(4);

      // Verify bottleneck stage identified correctly (Quality at 45Q/hr)
      const bottleneck = result.stageMetrics.find((s) => s.isBottleneck);
      expect(bottleneck).toBeDefined();
      expect(bottleneck!.stage).toBe('QUALITY');
      expect(bottleneck!.hourlyCapacityQuintals).toBe(45);

      // Verify audit decision logged
      const auditLog = await decisionModel.findOne({ candidateFarmerId: 'FARMER-MP-IND-001' }).exec();
      expect(auditLog).toBeDefined();
      expect(auditLog.decision).toBe(DecisionOutcome.ACCEPTED);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Booking Rejected When Centre Is Full / Bottlenecked
  // --------------------------------------------------------------------------
  describe('Booking Rejection On Capacity Limits', () => {
    it('should reject booking when centre daily sanctioned limit is exceeded', async () => {
      // Seed bookings bringing centre to 480Q (out of 500Q daily limit)
      await bookingModel.create({
        bookingId: 'BK-PREV-001',
        centreId: 'CENTRE-MP-IND-01',
        farmerId: 'FARMER-OTHER',
        bookingDate: '2026-09-25',
        quantityQuintals: 480,
        status: BookingStatus.BOOKED,
        arrivalWindow: { slotIndex: 0, startTime: '09:00', endTime: '10:00' },
      });

      // Request 30Q more (480 + 30 = 510 > 500)
      const result = await service.evaluateBookingConstraints({
        farmerId: 'FARMER-EXCESS',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 30,
        bookingDate: '2026-09-25',
        preferredSlotIndex: 0,
        vehicleCount: 1,
      });

      expect(result.isFeasible).toBe(false);
      expect(result.failedConstraint).toBe('CENTRE_DAILY_CAPACITY');
      expect(result.rejectionReason).toContain('Centre daily sanctioned ceiling exceeded');

      // Verify rejection audit log
      const auditLog = await decisionModel.findOne({ candidateFarmerId: 'FARMER-EXCESS' }).exec();
      expect(auditLog.decision).toBe(DecisionOutcome.REJECTED);
    });

    it('should reject booking if any critical stage has zero operational counters', async () => {
      // Mark Quality stage counter as MAINTENANCE
      await counterModel.updateOne(
        { stage: CounterStage.QUALITY },
        { $set: { status: CounterStatus.MAINTENANCE } },
      );

      const result = await service.evaluateBookingConstraints({
        farmerId: 'FARMER-STAGE-FAIL',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 20,
        bookingDate: '2026-09-25',
        preferredSlotIndex: 0,
      });

      expect(result.isFeasible).toBe(false);
      expect(result.failedConstraint).toBe('STAGE_OFFLINE_QUALITY');
      expect(result.rejectionReason).toContain("Zero active counters available for stage 'QUALITY'");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Dynamic Adaptation On No-Show / Cancellation (Section 10)
  // --------------------------------------------------------------------------
  describe('Dynamic Adaptation Engine (Section 10)', () => {
    let freedBooking: any;

    beforeEach(async () => {
      // Farmer 2: Booked at Slot 1 (10:00 - 11:00) with 40Q
      freedBooking = await bookingModel.create({
        bookingId: 'BK-F2-NOSHOW',
        centreId: 'CENTRE-MP-IND-01',
        farmerId: 'FARMER-F2',
        commodityCode: 'WHEAT',
        quantityQuintals: 40,
        bookingDate: '2026-09-25',
        tokenNumber: 'T-002',
        status: BookingStatus.NO_SHOW,
        arrivalWindow: { slotIndex: 1, startTime: '10:00', endTime: '11:00' },
      });

      // Initialize ArrivalWindows
      await windowModel.create([
        { centreId: 'CENTRE-MP-IND-01', date: '2026-09-25', slotIndex: 1, maxCapacityQuintals: 60, bookedQuantityQuintals: 40, bookingCount: 1 },
        { centreId: 'CENTRE-MP-IND-01', date: '2026-09-25', slotIndex: 3, maxCapacityQuintals: 60, bookedQuantityQuintals: 25, bookingCount: 1 },
        { centreId: 'CENTRE-MP-IND-01', date: '2026-09-25', slotIndex: 4, maxCapacityQuintals: 60, bookedQuantityQuintals: 50, bookingCount: 1 },
        { centreId: 'CENTRE-MP-IND-01', date: '2026-09-25', slotIndex: 5, maxCapacityQuintals: 60, bookedQuantityQuintals: 15, bookingCount: 1 },
      ]);
    });

    it('should move candidate forward when genuinely feasible (Farmer 3)', async () => {
      // Farmer 3: Booked at Slot 3 (12:00 - 13:00) with 25Q
      const candidateF3 = await bookingModel.create({
        bookingId: 'BK-F3-FEASIBLE',
        centreId: 'CENTRE-MP-IND-01',
        farmerId: 'FARMER-F3',
        commodityCode: 'WHEAT',
        quantityQuintals: 25, // 25Q <= 40Q freed
        bookingDate: '2026-09-25',
        tokenNumber: 'T-003',
        status: BookingStatus.CONFIRMED,
        arrivalWindow: { slotIndex: 3, startTime: '12:00', endTime: '13:00' },
      });

      // Simulated current time: 08:30 AM (Slot 1 starts at 10:00 AM -> 90 mins notice > 45 mins required)
      const simulatedTime = new Date('2026-09-25T08:30:00Z');

      const report = await service.recomputeScheduleOnFreedCapacity(
        freedBooking,
        'BOOKING_NO_SHOW',
        simulatedTime,
      );

      expect(report.candidatesEvaluatedCount).toBeGreaterThanOrEqual(1);
      expect(report.candidatesMovedCount).toBe(1);

      // Verify F3 moved forward to Slot 1
      const updatedF3 = await bookingModel.findOne({ bookingId: 'BK-F3-FEASIBLE' }).exec();
      expect(updatedF3.arrivalWindow.slotIndex).toBe(1);
      expect(updatedF3.arrivalWindow.startTime).toBe('10:00');

      // Verify remaining freed capacity: 40 - 25 = 15Q
      expect(report.remainingFreedQuantityQuintals).toBe(15);
    });

    it('should NOT move candidate forward if quantity exceeds freed capacity, keeping original window (Farmer 4)', async () => {
      // Farmer 4: 50Q at Slot 4 (50Q > 40Q freed capacity)
      await bookingModel.create({
        bookingId: 'BK-F4-OVERWEIGHT',
        centreId: 'CENTRE-MP-IND-01',
        farmerId: 'FARMER-F4',
        commodityCode: 'WHEAT',
        quantityQuintals: 50,
        bookingDate: '2026-09-25',
        tokenNumber: 'T-004',
        status: BookingStatus.BOOKED,
        arrivalWindow: { slotIndex: 4, startTime: '13:00', endTime: '14:00' },
      });

      const simulatedTime = new Date('2026-09-25T08:30:00Z');
      const report = await service.recomputeScheduleOnFreedCapacity(
        freedBooking,
        'BOOKING_NO_SHOW',
        simulatedTime,
      );

      const f4Evaluation = report.evaluations.find((e) => e.candidateBookingId === 'BK-F4-OVERWEIGHT');
      expect(f4Evaluation).toBeDefined();
      expect(f4Evaluation!.decision).toBe('UNALTERED');
      expect(f4Evaluation!.reason).toContain('exceeds remaining freed slot capacity');

      // Confirm F4 strictly remains in Slot 4
      const f4Booking = await bookingModel.findOne({ bookingId: 'BK-F4-OVERWEIGHT' }).exec();
      expect(f4Booking.arrivalWindow.slotIndex).toBe(4);
    });

    it('should NOT move candidate forward if insufficient transit notice, keeping original window (Farmer 5)', async () => {
      // Farmer 5: 15Q at Slot 5, but current time is 09:40 AM (Slot 1 is at 10:00 AM -> only 20m notice < 45m min)
      await bookingModel.create({
        bookingId: 'BK-F5-LATE-NOTICE',
        centreId: 'CENTRE-MP-IND-01',
        farmerId: 'FARMER-F5',
        commodityCode: 'WHEAT',
        quantityQuintals: 15,
        bookingDate: '2026-09-25',
        tokenNumber: 'T-005',
        status: BookingStatus.BOOKED,
        arrivalWindow: { slotIndex: 5, startTime: '14:00', endTime: '15:00' },
      });

      const lateTime = new Date('2026-09-25T09:40:00Z'); // Only 20 mins before 10:00 AM slot
      const report = await service.recomputeScheduleOnFreedCapacity(
        freedBooking,
        'BOOKING_NO_SHOW',
        lateTime,
      );

      const f5Eval = report.evaluations.find((e) => e.candidateBookingId === 'BK-F5-LATE-NOTICE');
      expect(f5Eval).toBeDefined();
      expect(f5Eval!.decision).toBe('UNALTERED');
      expect(f5Eval!.reason).toContain('Insufficient transit notice');

      // Confirm F5 stays in Slot 5
      const f5Booking = await bookingModel.findOne({ bookingId: 'BK-F5-LATE-NOTICE' }).exec();
      expect(f5Booking.arrivalWindow.slotIndex).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Counter Breakdown Recomputation (Section 10 & 13)
  // --------------------------------------------------------------------------
  describe('Counter Breakdown Recompute', () => {
    it('should recalculate capacity and identify affected slots when counter fails', async () => {
      // Slot 0 has 50Q booked
      await windowModel.create({
        centreId: 'CENTRE-MP-IND-01',
        date: '2026-09-25',
        slotIndex: 0,
        maxCapacityQuintals: 60,
        bookedQuantityQuintals: 50,
      });

      // Weighing counter goes to MAINTENANCE
      const result = await service.recomputeOnCounterBreakdown(
        'CENTRE-MP-IND-01',
        'CTR-WT1',
        '2026-09-25',
      );

      expect(result.bottleneckStage).toBe(CounterStage.WEIGHING);
      expect(result.newHourlyCapacity).toBe(0); // Only 1 weighing counter, now down to 0
      expect(result.affectedWindowsCount).toBeGreaterThanOrEqual(1);

      // Verify counter marked as MAINTENANCE
      const counter = await counterModel.findOne({ counterId: 'CTR-WT1' }).exec();
      expect(counter.status).toBe(CounterStatus.MAINTENANCE);
    });
  });
});
