import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';

import { BookingsService } from '../../src/modules/bookings/bookings.service';
import { Booking, BookingStatus } from '../../src/modules/bookings/schemas/booking.schema';
import { BookingVehicle, VehicleType } from '../../src/modules/bookings/schemas/booking-vehicle.schema';
import { ArrivalWindow } from '../../src/modules/bookings/schemas/arrival-window.schema';
import { Centre } from '../../src/modules/centres/schemas/centre.schema';
import { Counter } from '../../src/modules/centres/schemas/counter.schema';
import { SchedulingDecision } from '../../src/modules/scheduling/schemas/scheduling-decision.schema';
import { FarmersService } from '../../src/modules/farmers/farmers.service';
import { CentresService } from '../../src/modules/centres/centres.service';
import { IdempotencyService } from '../../src/infrastructure/security/idempotency.service';
import { SecurityService } from '../../src/infrastructure/security/security.service';
import { RedisService } from '../../src/infrastructure/redis/redis.service';
import { OperationsService } from '../../src/modules/operations/operations.service';
import { WeighingRecord } from '../../src/modules/operations/schemas/weighing-record.schema';
import { QualityRecord, QualityVerdict, QualityGrade } from '../../src/modules/operations/schemas/quality-record.schema';
import { ProcurementRecord, GovSyncStatus } from '../../src/modules/operations/schemas/procurement-record.schema';
import { ServiceSession } from '../../src/modules/operations/schemas/service-session.schema';
import { QueueState } from '../../src/modules/queue/schemas/queue-state.schema';
import { QueueService } from '../../src/modules/queue/queue.service';
import { AuditService } from '../../src/modules/audit/audit.service';
import { EventBusService } from '../../src/infrastructure/events/event-bus.service';
import { Role } from '../../src/shared/enums/roles.enum';
import { GOVERNMENT_DATA_PROVIDER } from '../../src/modules/integrations/contracts/government-data-provider.interface';
import { MockGovernmentProvider } from '../../src/modules/integrations/providers/mock-government.provider';
import { createMockModel } from './in-memory-mongo.mock';

describe('Phase 7: Failure Recovery & Concurrency Resilience Tests (Section 21, 24, 33)', () => {
  let bookingsService: BookingsService;
  let operationsService: OperationsService;
  let govProvider: MockGovernmentProvider;
  let redisService: RedisService;

  let bookingModel: any;
  let vehicleModel: any;
  let windowModel: any;
  let centreModel: any;
  let counterModel: any;
  let decisionModel: any;
  let weighingModel: any;
  let qualityModel: any;
  let procurementModel: any;
  let sessionModel: any;
  let queueModel: any;

  const mockCentre = {
    centreId: 'CENTRE-MP-IND-01',
    name: 'Sanwer Krishi Upaj Mandi',
    state: 'Madhya Pradesh',
    district: 'Indore',
    dailyCapacityQuintals: 500,
    maxSimultaneousVehicles: 5,
    operatingHours: { openTime: '09:00', closeTime: '18:00' },
    supportedCommodities: ['WHEAT'],
    isActive: true,
  };

  const mockFarmerProfile = {
    farmerId: 'FARMER-MP-IND-001',
    name: 'Ramesh Kumar',
    mobile: '9876543210',
    state: 'Madhya Pradesh',
    district: 'Indore',
    landHoldingHectares: 4.5,
    verifiedCommodities: ['WHEAT'],
    bankAccount: {
      accountNumberMasked: 'XXXXXX1234',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank of India',
      isVerified: true,
    },
    isActive: true,
  };

  beforeEach(async () => {
    bookingModel = createMockModel();
    vehicleModel = createMockModel();
    windowModel = createMockModel();
    centreModel = createMockModel([mockCentre]);
    counterModel = createMockModel();
    decisionModel = createMockModel();
    weighingModel = createMockModel();
    qualityModel = createMockModel();
    procurementModel = createMockModel();
    sessionModel = createMockModel();
    queueModel = createMockModel();

    govProvider = new MockGovernmentProvider();
    redisService = new RedisService({ get: () => null } as any);

    const farmersServiceMock = {
      getProfile: jest.fn().mockResolvedValue(mockFarmerProfile),
    };

    const centresServiceMock = {
      findByCentreId: jest.fn().mockResolvedValue(mockCentre),
    };

    const queueServiceMock = {
      transitionState: jest.fn().mockResolvedValue({}),
      initializeQueueState: jest.fn().mockResolvedValue({}),
    };

    const auditServiceMock = {
      logAction: jest.fn().mockResolvedValue({}),
    };

    const idempotencyService = new IdempotencyService(createMockModel() as any);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        OperationsService,
        SecurityService,
        EventBusService,
        { provide: IdempotencyService, useValue: idempotencyService },
        { provide: RedisService, useValue: redisService },
        { provide: FarmersService, useValue: farmersServiceMock },
        { provide: CentresService, useValue: centresServiceMock },
        { provide: QueueService, useValue: queueServiceMock },
        { provide: AuditService, useValue: auditServiceMock },
        { provide: GOVERNMENT_DATA_PROVIDER, useValue: govProvider },
        { provide: getModelToken(Booking.name), useValue: bookingModel },
        { provide: getModelToken(BookingVehicle.name), useValue: vehicleModel },
        { provide: getModelToken(ArrivalWindow.name), useValue: windowModel },
        { provide: getModelToken(Centre.name), useValue: centreModel },
        { provide: getModelToken(Counter.name), useValue: counterModel },
        { provide: getModelToken(SchedulingDecision.name), useValue: decisionModel },
        { provide: getModelToken(WeighingRecord.name), useValue: weighingModel },
        { provide: getModelToken(QualityRecord.name), useValue: qualityModel },
        { provide: getModelToken(ProcurementRecord.name), useValue: procurementModel },
        { provide: getModelToken(ServiceSession.name), useValue: sessionModel },
        { provide: getModelToken(QueueState.name), useValue: queueModel },
      ],
    }).compile();

    bookingsService = moduleFixture.get<BookingsService>(BookingsService);
    operationsService = moduleFixture.get<OperationsService>(OperationsService);
  });

  // --------------------------------------------------------------------------
  // 1. True Concurrency: Simultaneous Bookings for the Last Available Capacity
  // --------------------------------------------------------------------------
  describe('1. True Concurrency: Last Available Capacity Unit (Section 33)', () => {
    it('should strictly allow exactly ONE booking and reject the other when two requests compete for the final 30Q', async () => {
      // 1. Seed existing bookings taking 470Q of 500Q daily sanctioned capacity (30Q left)
      await bookingModel.create({
        bookingId: 'BKG-PREV-01',
        centreId: 'CENTRE-MP-IND-01',
        bookingDate: '2026-03-30',
        commodityCode: 'WHEAT',
        quantityQuintals: 470,
        status: BookingStatus.BOOKED,
      });

      // 2. Prepare two competing 25Q booking requests from different farmers
      const bookingDto1 = {
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 25,
        bookingDate: '2026-03-30',
        preferredSlotIndex: 0,
        vehicles: [{ vehicleType: VehicleType.TRACTOR_TROLLEY, vehicleNumber: 'MP-09-AB-1111', allocatedQuantityQuintals: 25 }],
      };

      const bookingDto2 = {
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 25,
        bookingDate: '2026-03-30',
        preferredSlotIndex: 0,
        vehicles: [{ vehicleType: VehicleType.TRACTOR_TROLLEY, vehicleNumber: 'MP-09-AB-2222', allocatedQuantityQuintals: 25 }],
      };

      // 3. Fire both simultaneously via Promise.allSettled
      const [res1, res2] = await Promise.allSettled([
        bookingsService.createBooking('user-001', bookingDto1),
        bookingsService.createBooking('user-002', bookingDto2),
      ]);

      // Exactly ONE request must succeed (fulfilled) and exactly ONE must fail (rejected with ConflictException)
      const successCount = [res1, res2].filter((r) => r.status === 'fulfilled').length;
      const failureCount = [res1, res2].filter((r) => r.status === 'rejected').length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Verify the rejection was due to capacity conflict
      const rejectedResult: any = res1.status === 'rejected' ? res1 : res2;
      expect(rejectedResult.reason).toBeInstanceOf(ConflictException);
      expect(rejectedResult.reason.message).toContain('daily capacity exceeded');

      // Verify that total booked quantity in DB strictly never exceeded 500Q (470 + 25 = 495Q, NOT 520Q)
      const allActiveBookings = await bookingModel.find({
        centreId: 'CENTRE-MP-IND-01',
        bookingDate: '2026-03-30',
      }).exec();

      const totalBookedQ = allActiveBookings.reduce((sum: number, b: any) => sum + b.quantityQuintals, 0);
      expect(totalBookedQ).toBe(495);
      expect(totalBookedQ).toBeLessThanOrEqual(500);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Database Failure Mid-Transaction / Rollback Consistency
  // --------------------------------------------------------------------------
  describe('2. Database Failure Mid-Transaction Consistency (Section 24)', () => {
    it('should cleanly abort without corrupted records if booking persistence fails', async () => {
      // Mock bookingModel.create to simulate an abrupt database disconnect
      jest.spyOn(bookingModel.prototype, 'save').mockRejectedValueOnce(
        new Error('MONGO_SOCKET_EXCEPTION: Connection closed unexpectedly'),
      );

      const bookingDto = {
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 20,
        bookingDate: '2026-03-30',
        preferredSlotIndex: 0,
        vehicles: [{ vehicleType: VehicleType.TRACTOR_TROLLEY, vehicleNumber: 'MP-09-AB-3333', allocatedQuantityQuintals: 20 }],
      };

      // Execution must fail cleanly with the caught database error
      await expect(
        bookingsService.createBooking('user-003', bookingDto),
      ).rejects.toThrow('MONGO_SOCKET_EXCEPTION');

      // Check that no corrupted booking was persisted
      const bookings = await bookingModel.find({ centreId: 'CENTRE-MP-IND-01' }).exec();
      expect(bookings.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Government API Failure During Active Operations (Section 21)
  // --------------------------------------------------------------------------
  describe('3. Government API Failure Resilience (Section 21)', () => {
    it('should complete physical ground procurement and mark sync as FAILED for async retry when external gov API is down', async () => {
      const bookingId = 'BKG-GOV-FAIL-01';

      // Seed prior operational stages
      await bookingModel.create({
        bookingId,
        centreId: 'CENTRE-MP-IND-01',
        farmerId: 'FARMER-MP-IND-001',
        commodityCode: 'WHEAT',
        quantityQuintals: 40,
        status: BookingStatus.ARRIVED,
      });

      await weighingModel.create({
        bookingId,
        centreId: 'CENTRE-MP-IND-01',
        netWeightQuintals: 40,
        isFinalized: true,
      });

      await qualityModel.create({
        bookingId,
        centreId: 'CENTRE-MP-IND-01',
        verdict: QualityVerdict.ACCEPTED,
        assignedGrade: QualityGrade.GRADE_A,
        moisturePercentage: 11.2,
        foreignMatterPercentage: 0.4,
      });

      // Simulate external government system outage (503 Service Unavailable / Timeout)
      jest.spyOn(govProvider, 'submitProcurementUpdate').mockRejectedValueOnce(
        new Error('CFPP_GATEWAY_TIMEOUT: Government central portal not responding'),
      );

      const operatorUser = {
        userId: 'OP-PROC-01',
        role: Role.PROCUREMENT_OPERATOR,
        email: 'proc@procure.gov.in',
        scope: { centreId: 'CENTRE-MP-IND-01' },
      };

      // Ground procurement finalization MUST NOT crash or reject the farmer's physical grain
      const result = await operationsService.recordProcurement(
        {
          bookingId,
          counterId: 'CTR-01',
          finalQuantityQuintals: 40,
          mspRatePerQuintal: 2275,
        },
        operatorUser as any,
      );

      // 1. Physical procurement is finalized locally in authoritative MongoDB
      expect(result.success).toBe(true);
      expect(result.finalQuantityQuintals).toBe(40);
      expect(result.totalPayoutEstimated).toBe(91000);
      expect(result.govSyncStatus).toBe(GovSyncStatus.FAILED);
      expect(result.status).toBe(BookingStatus.COMPLETED);

      // 2. Government sync status is marked as FAILED for background retry
      const record = await procurementModel.findOne({ bookingId }).exec();
      expect(record).toBeDefined();
      expect(record.finalQuantityQuintals).toBe(40);
      expect(record.totalPayoutEstimated).toBe(91000);
      expect(record.govSyncStatus).toBe(GovSyncStatus.FAILED);
      expect(record.govSyncError).toContain('CFPP_GATEWAY_TIMEOUT');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Network / Redis Interruption Simulation
  // --------------------------------------------------------------------------
  describe('4. Network & Cache Interruption Simulation (Section 24)', () => {
    it('should seamlessly fall back to in-memory caching when Redis experiences a connection fault', async () => {
      // RedisService initialized without a running Redis server automatically operates via memoryStore
      const brokenRedis = new RedisService({ get: () => null } as any);
      (brokenRedis as any).isConnected = false;

      // Rate limit / counter operation should still work in-memory without throwing
      const count1 = await brokenRedis.incr('test_network_fail_key', 60);
      const count2 = await brokenRedis.incr('test_network_fail_key', 60);

      expect(count1).toBe(1);
      expect(count2).toBe(2);

      // Lock acquisition should safely succeed via in-memory lock
      const lockToken = await brokenRedis.acquireLock('test_lock', 10000);
      expect(lockToken).toBeDefined();

      const secondLockAttempt = await brokenRedis.acquireLock('test_lock', 10000);
      expect(secondLockAttempt).toBeNull(); // Mutex lock held

      await brokenRedis.releaseLock('test_lock', lockToken!);
      const lockAcquiredAgain = await brokenRedis.acquireLock('test_lock', 10000);
      expect(lockAcquiredAgain).toBeDefined();
    });
  });
});
