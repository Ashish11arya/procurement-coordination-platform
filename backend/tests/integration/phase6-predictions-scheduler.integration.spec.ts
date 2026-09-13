import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';

import { PredictionsService } from '../../src/modules/predictions/predictions.service';
import { PredictionsController } from '../../src/modules/predictions/predictions.controller';
import { PredictionLog } from '../../src/modules/predictions/schemas/prediction-log.schema';
import { ServiceSession, ServiceSessionStatus } from '../../src/modules/operations/schemas/service-session.schema';
import { Booking, BookingStatus } from '../../src/modules/bookings/schemas/booking.schema';
import { QueueState } from '../../src/modules/queue/schemas/queue-state.schema';
import { ArrivalWindow } from '../../src/modules/bookings/schemas/arrival-window.schema';
import { Centre } from '../../src/modules/centres/schemas/centre.schema';
import { Counter, CounterStatus, CounterStage } from '../../src/modules/centres/schemas/counter.schema';
import { SchedulingDecision } from '../../src/modules/scheduling/schemas/scheduling-decision.schema';
import { SchedulingService } from '../../src/modules/scheduling/scheduling.service';
import { SchedulingController } from '../../src/modules/scheduling/scheduling.controller';
import { Role } from '../../src/shared/enums/roles.enum';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';
import { GOVERNMENT_DATA_PROVIDER } from '../../src/modules/integrations/contracts/government-data-provider.interface';
import { MockGovernmentProvider } from '../../src/modules/integrations/providers/mock-government.provider';
import { createMockModel } from './in-memory-mongo.mock';

describe('Phase 6: Prediction Engine & Constraint Scheduler Integration', () => {
  let app: INestApplication;
  let schedulingService: SchedulingService;
  let predictionsService: PredictionsService;

  let predictionLogModel: any;
  let sessionModel: any;
  let bookingModel: any;
  let queueModel: any;
  let windowModel: any;
  let centreModel: any;
  let counterModel: any;
  let decisionModel: any;

  let activeTestUser: any = {
    userId: 'USR-OPERATOR-01',
    role: Role.CENTRE_ADMIN,
    assignedCentres: ['CENTRE-MP-IND-01'],
  };

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
      capacityPerHourQuintals: 80,
      status: CounterStatus.ACTIVE,
    },
    {
      counterId: 'CTR-WT1',
      centreId: 'CENTRE-MP-IND-01',
      counterNumber: 1,
      stage: CounterStage.WEIGHING,
      capacityPerHourQuintals: 60,
      status: CounterStatus.ACTIVE,
    },
    {
      counterId: 'CTR-QL1',
      centreId: 'CENTRE-MP-IND-01',
      counterNumber: 1,
      stage: CounterStage.QUALITY,
      capacityPerHourQuintals: 45, // Bottleneck stage: 45 Q/hr
      status: CounterStatus.ACTIVE,
    },
    {
      counterId: 'CTR-PR1',
      centreId: 'CENTRE-MP-IND-01',
      counterNumber: 1,
      stage: CounterStage.PROCUREMENT,
      capacityPerHourQuintals: 70,
      status: CounterStatus.ACTIVE,
    },
  ];

  beforeAll(async () => {
    predictionLogModel = createMockModel();
    sessionModel = createMockModel();
    bookingModel = createMockModel();
    queueModel = createMockModel();
    windowModel = createMockModel();
    centreModel = createMockModel([mockCentre]);
    counterModel = createMockModel(mockCounters);
    decisionModel = createMockModel();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PredictionsController, SchedulingController],
      providers: [
        SchedulingService,
        PredictionsService,
        ConfigService,
        {
          provide: GOVERNMENT_DATA_PROVIDER,
          useClass: MockGovernmentProvider,
        },
        { provide: getModelToken(PredictionLog.name), useValue: predictionLogModel },
        { provide: getModelToken(ServiceSession.name), useValue: sessionModel },
        { provide: getModelToken(Booking.name), useValue: bookingModel },
        { provide: getModelToken(QueueState.name), useValue: queueModel },
        { provide: getModelToken(ArrivalWindow.name), useValue: windowModel },
        { provide: getModelToken(Centre.name), useValue: centreModel },
        { provide: getModelToken(Counter.name), useValue: counterModel },
        { provide: getModelToken(SchedulingDecision.name), useValue: decisionModel },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = activeTestUser;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    schedulingService = moduleFixture.get<SchedulingService>(SchedulingService);
    predictionsService = moduleFixture.get<PredictionsService>(PredictionsService);
  });

  afterAll(async () => {
    await app.close();
  });

  // --------------------------------------------------------------------------
  // TEST 1: Feasibility Invariance (Section 7, 31)
  // Scheduler produces the SAME feasibility decision with prediction enabled vs disabled
  // --------------------------------------------------------------------------
  describe('Test 1: Feasibility Invariance (Section 7 & 31)', () => {
    it('should produce the exact SAME feasibility decision when prediction is enabled vs disabled', async () => {
      const scheduleRequest = {
        farmerId: 'FARMER-MP-IND-001',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 30,
        bookingDate: '2026-03-25',
        preferredSlotIndex: 0,
        vehicleCount: 1,
      };

      // 1. Evaluate with prediction DISABLED via environment flag
      process.env.PREDICTIONS_ENABLED = 'false';
      const deterministicResult = await schedulingService.evaluateBookingConstraints(scheduleRequest);

      // 2. Evaluate with prediction ENABLED
      process.env.PREDICTIONS_ENABLED = 'true';

      // Mock prediction service to return an advisory service time (40 mins vs 55 mins deterministic)
      jest.spyOn(predictionsService, 'predictServiceTime').mockResolvedValueOnce({
        value: {
          estimatedDurationMinutes: 40,
          breakdown: { baseSetupMinutes: 10, processingMinutes: 30 },
        },
        confidence: 0.85,
        uncertaintyMargin: 3.5,
        metadata: {
          modelVersion: 'v1.0.0-statistical',
          algorithm: 'STATISTICAL_MOVING_AVERAGE',
          inputFeatures: scheduleRequest,
          predictedAt: new Date(),
          sampleCount: 20,
          isFallback: false,
        },
      });

      const predictedResult = await schedulingService.evaluateBookingConstraints(scheduleRequest);

      // Core Invariants:
      // A) Both must agree 100% on feasibility
      expect(deterministicResult.isFeasible).toBe(true);
      expect(predictedResult.isFeasible).toBe(true);

      // B) Both must assign the exact same arrival window slot
      expect(deterministicResult.assignedWindow?.index).toBe(predictedResult.assignedWindow?.index);
      expect(deterministicResult.assignedWindow?.startTime).toBe(predictedResult.assignedWindow?.startTime);
      expect(deterministicResult.assignedWindow?.endTime).toBe(predictedResult.assignedWindow?.endTime);

      // C) Both must record the exact same stage throughput capacities
      expect(deterministicResult.stageMetrics.length).toBe(predictedResult.stageMetrics.length);
      expect(deterministicResult.dailySanctionedCapacity).toBe(predictedResult.dailySanctionedCapacity);

      // D) ONLY the advisory estimated duration differs
      expect(deterministicResult.estimatedDurationMinutes).toBe(55); // 10 + ceil((30/40)*60) = 55 min
      expect(predictedResult.estimatedDurationMinutes).toBe(40);     // Advisory prediction
      expect(predictedResult.predictionMetadata?.algorithm).toBe('STATISTICAL_MOVING_AVERAGE');
    });

    it('should REJECT an overflow booking identically regardless of what prediction says', async () => {
      process.env.PREDICTIONS_ENABLED = 'true';

      // Request exceeding centre sanctioned daily capacity (600Q > 500Q)
      const overflowRequest = {
        farmerId: 'FARMER-MP-IND-002',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 600,
        bookingDate: '2026-03-25',
        preferredSlotIndex: 0,
      };

      const result = await schedulingService.evaluateBookingConstraints(overflowRequest);

      // Hard constraint MUST reject — AI is never even allowed to approve overflow
      expect(result.isFeasible).toBe(false);
      expect(result.failedConstraint).toBe('CENTRE_DAILY_CAPACITY');
      expect(result.rejectionReason).toContain('sanctioned ceiling exceeded');
    });
  });

  // --------------------------------------------------------------------------
  // TEST 2: Prediction Service Failure / Timeout Triggers Fallback (Section 32)
  // --------------------------------------------------------------------------
  describe('Test 2: Prediction Failure / Timeout Resilience (Section 32)', () => {
    it('should fall back to deterministic service time without affecting booking feasibility when prediction throws error', async () => {
      process.env.PREDICTIONS_ENABLED = 'true';

      // Mock prediction service throwing an unhandled error / database failure
      jest.spyOn(predictionsService, 'predictServiceTime').mockRejectedValueOnce(
        new Error('PREDICTION_ENGINE_DB_OUTAGE'),
      );

      const scheduleRequest = {
        farmerId: 'FARMER-MP-IND-003',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 20,
        bookingDate: '2026-03-25',
        preferredSlotIndex: 1,
      };

      const result = await schedulingService.evaluateBookingConstraints(scheduleRequest);

      // Booking MUST still succeed
      expect(result.isFeasible).toBe(true);
      expect(result.assignedWindow).toBeDefined();

      // Service time MUST fall back to deterministic baseline: 10 + ceil((20/40)*60) = 40 minutes
      expect(result.estimatedDurationMinutes).toBe(40);
    });

    it('should fall back to deterministic service time when prediction times out (> 50ms SLA budget)', async () => {
      process.env.PREDICTIONS_ENABLED = 'true';

      // Mock prediction service hanging for 200ms (exceeding the 50ms scheduler timeout budget)
      jest.spyOn(predictionsService, 'predictServiceTime').mockImplementationOnce(async () => {
        await new Promise((r) => setTimeout(r, 200));
        return {
          value: { estimatedDurationMinutes: 15, breakdown: { baseSetupMinutes: 5, processingMinutes: 10 } },
          confidence: 0.9,
          uncertaintyMargin: 1,
          metadata: {} as any,
        };
      });

      const scheduleRequest = {
        farmerId: 'FARMER-MP-IND-004',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 20,
        bookingDate: '2026-03-25',
        preferredSlotIndex: 1,
      };

      const result = await schedulingService.evaluateBookingConstraints(scheduleRequest);

      // Fast fallback: booking is NOT blocked or delayed by the hanging AI
      expect(result.isFeasible).toBe(true);
      expect(result.estimatedDurationMinutes).toBe(40); // Deterministic baseline
    });
  });

  // --------------------------------------------------------------------------
  // TEST 3: Absurd Prediction Immunity (Section 7, 31, 32)
  // Negative or huge duration predictions cannot corrupt the scheduler
  // --------------------------------------------------------------------------
  describe('Test 3: Absurd Prediction Immunity', () => {
    it('should reject negative duration prediction and fall back to physical baseline', async () => {
      process.env.PREDICTIONS_ENABLED = 'true';

      // Mock an absurd negative prediction
      jest.spyOn(predictionsService, 'predictServiceTime').mockResolvedValueOnce({
        value: {
          estimatedDurationMinutes: -50, // Deliberately absurd
          breakdown: { baseSetupMinutes: -10, processingMinutes: -40 },
        },
        confidence: 0.95,
        uncertaintyMargin: 1,
        metadata: {} as any,
      });

      const scheduleRequest = {
        farmerId: 'FARMER-MP-IND-005',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 20,
        bookingDate: '2026-03-25',
        preferredSlotIndex: 2,
      };

      const result = await schedulingService.evaluateBookingConstraints(scheduleRequest);

      // Bounds validation MUST catch and discard negative duration
      expect(result.isFeasible).toBe(true);
      expect(result.estimatedDurationMinutes).toBe(40); // Clean deterministic baseline
    });

    it('should reject near-infinite duration prediction (> 180 min) and fall back to physical baseline', async () => {
      process.env.PREDICTIONS_ENABLED = 'true';

      // Mock an absurd 99,999 minute prediction
      jest.spyOn(predictionsService, 'predictServiceTime').mockResolvedValueOnce({
        value: {
          estimatedDurationMinutes: 99999, // Exceeds physical operational bounds
          breakdown: { baseSetupMinutes: 100, processingMinutes: 99899 },
        },
        confidence: 0.95,
        uncertaintyMargin: 1,
        metadata: {} as any,
      });

      const scheduleRequest = {
        farmerId: 'FARMER-MP-IND-006',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 20,
        bookingDate: '2026-03-25',
        preferredSlotIndex: 2,
      };

      const result = await schedulingService.evaluateBookingConstraints(scheduleRequest);

      expect(result.isFeasible).toBe(true);
      expect(result.estimatedDurationMinutes).toBe(40); // Clean deterministic baseline
    });
  });

  // --------------------------------------------------------------------------
  // TEST 4: Low-Confidence Fallback (Section 32)
  // --------------------------------------------------------------------------
  describe('Test 4: Low-Confidence Fallback (Section 32)', () => {
    it('should discard predictions with confidence below threshold (< 0.40)', async () => {
      process.env.PREDICTIONS_ENABLED = 'true';

      // Low confidence prediction (0.25 < 0.40)
      jest.spyOn(predictionsService, 'predictServiceTime').mockResolvedValueOnce({
        value: {
          estimatedDurationMinutes: 25,
          breakdown: { baseSetupMinutes: 5, processingMinutes: 20 },
        },
        confidence: 0.25, // Below MIN_CONFIDENCE_THRESHOLD (0.40)
        uncertaintyMargin: 12,
        metadata: {} as any,
      });

      const scheduleRequest = {
        farmerId: 'FARMER-MP-IND-007',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 30,
        bookingDate: '2026-03-25',
        preferredSlotIndex: 0,
      };

      const result = await schedulingService.evaluateBookingConstraints(scheduleRequest);

      // Low confidence discarded, deterministic baseline used
      expect(result.isFeasible).toBe(true);
      expect(result.estimatedDurationMinutes).toBe(55); // 10 + ceil((30/40)*60)
    });
  });

  // --------------------------------------------------------------------------
  // TEST 5: REST API Endpoints for Advisory Predictions & Auditing
  // --------------------------------------------------------------------------
  describe('Test 5: REST API Endpoints (Advisory & Auditing)', () => {
    it('POST /predictions/service-time should return advisory duration and metadata', async () => {
      const res = await request(app.getHttpServer())
        .post('/predictions/service-time')
        .send({
          centreId: 'CENTRE-MP-IND-01',
          commodityCode: 'WHEAT',
          quantityQuintals: 40,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.result).toBeDefined();
      expect(res.body.result.value.estimatedDurationMinutes).toBeGreaterThan(0);
      expect(res.body.result.confidence).toBeDefined();
      expect(res.body.result.metadata.modelVersion).toBe('v1.0.0-statistical');
    });

    it('POST /predictions/arrival-pattern should return punctuality probabilities', async () => {
      const res = await request(app.getHttpServer())
        .post('/predictions/arrival-pattern')
        .send({
          centreId: 'CENTRE-MP-IND-01',
          bookingDate: '2026-03-25',
          slotIndex: 0,
          transitDistanceKm: 15,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.result.value.distribution).toBeDefined();
      expect(res.body.result.value.distribution.onTimeProbability).toBeGreaterThan(0);
    });

    it('POST /predictions/no-show-risk should return risk scoring', async () => {
      const res = await request(app.getHttpServer())
        .post('/predictions/no-show-risk')
        .send({
          farmerId: 'FARMER-MP-IND-001',
          centreId: 'CENTRE-MP-IND-01',
          bookingDate: '2026-03-25',
          slotIndex: 0,
          quantityQuintals: 30,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(res.body.result.value.riskLevel);
      expect(res.body.result.value.noShowProbability).toBeGreaterThanOrEqual(0);
      expect(res.body.result.value.noShowProbability).toBeLessThanOrEqual(1);
    });

    it('GET /predictions/logs should return persisted audit trails', async () => {
      // Seed a prediction log
      await predictionLogModel.create({
        predictionId: 'PRED-AUDIT-001',
        predictionType: 'SERVICE_TIME',
        modelVersion: 'v1.0.0-statistical',
        algorithm: 'STATISTICAL_MOVING_AVERAGE',
        inputFeatures: { centreId: 'CENTRE-MP-IND-01' },
        predictedValue: { estimatedDurationMinutes: 45 },
        confidence: 0.85,
        uncertaintyMargin: 2.5,
        isFallback: false,
        centreId: 'CENTRE-MP-IND-01',
        predictedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/predictions/logs?centreId=CENTRE-MP-IND-01')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      expect(res.body.logs.some((l: any) => l.predictionId === 'PRED-AUDIT-001')).toBe(true);
    });
  });
});
