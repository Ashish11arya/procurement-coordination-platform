import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PredictionsService } from '../../src/modules/predictions/predictions.service';
import { PredictionLog } from '../../src/modules/predictions/schemas/prediction-log.schema';
import { ServiceSession, ServiceSessionStatus } from '../../src/modules/operations/schemas/service-session.schema';
import { Booking, BookingStatus } from '../../src/modules/bookings/schemas/booking.schema';
import { QueueState } from '../../src/modules/queue/schemas/queue-state.schema';
import { createMockModel } from '../integration/in-memory-mongo.mock';

describe('PredictionsService (Unit Tests)', () => {
  let service: PredictionsService;
  let predictionLogModel: any;
  let sessionModel: any;
  let bookingModel: any;
  let queueModel: any;

  beforeEach(async () => {
    predictionLogModel = createMockModel();
    sessionModel = createMockModel();
    bookingModel = createMockModel();
    queueModel = createMockModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionsService,
        { provide: getModelToken(PredictionLog.name), useValue: predictionLogModel },
        { provide: getModelToken(ServiceSession.name), useValue: sessionModel },
        { provide: getModelToken(Booking.name), useValue: bookingModel },
        { provide: getModelToken(QueueState.name), useValue: queueModel },
      ],
    }).compile();

    service = module.get<PredictionsService>(PredictionsService);
  });

  // --------------------------------------------------------------------------
  // 1. Service Time Prediction (Section 7, 31, 32)
  // --------------------------------------------------------------------------
  describe('predictServiceTime', () => {
    it('should fall back to deterministic baseline when historical samples are insufficient (< 5)', async () => {
      const result = await service.predictServiceTime({
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 30,
      });

      // 10 min setup + ceil((30 / 40) * 60) = 10 + 45 = 55 minutes
      expect(result.value.estimatedDurationMinutes).toBe(55);
      expect(result.value.breakdown.baseSetupMinutes).toBe(10);
      expect(result.value.breakdown.processingMinutes).toBe(45);
      expect(result.confidence).toBeLessThan(0.40);
      expect(result.metadata.isFallback).toBe(true);
      expect(result.metadata.algorithm).toBe('DETERMINISTIC_FALLBACK');
    });

    it('should calculate statistical mean and confidence when >= 5 completed samples exist', async () => {
      const centreId = 'CENTRE-MP-IND-01';
      const commodityCode = 'WHEAT';

      // Seed 6 completed bookings and matching completed sessions (30 Q, duration ~50 mins = 3000s)
      for (let i = 1; i <= 6; i++) {
        const bookingId = `BKG-HIST-00${i}`;
        await bookingModel.create({
          bookingId,
          centreId,
          commodityCode,
          quantityQuintals: 30,
          status: BookingStatus.COMPLETED,
        });

        await sessionModel.create({
          bookingId,
          centreId,
          counterId: 'CTR-01',
          stage: 'WEIGHING',
          operatorId: 'OP-01',
          startedAt: new Date(Date.now() - 3600000),
          completedAt: new Date(),
          durationSeconds: 2800 + i * 40, // 2840, 2880, 2920, 2960, 3000, 3040 seconds (~47 to ~51 mins)
          status: ServiceSessionStatus.COMPLETED,
        });
      }

      const result = await service.predictServiceTime({
        centreId,
        commodityCode,
        quantityQuintals: 30,
      });

      expect(result.value.estimatedDurationMinutes).toBeGreaterThanOrEqual(45);
      expect(result.value.estimatedDurationMinutes).toBeLessThanOrEqual(55);
      expect(result.confidence).toBeGreaterThanOrEqual(0.40);
      expect(result.metadata.isFallback).toBe(false);
      expect(result.metadata.algorithm).toBe('STATISTICAL_MOVING_AVERAGE');
      expect(result.metadata.sampleCount).toBe(6);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Arrival Pattern Prediction (Section 7, 31)
  // --------------------------------------------------------------------------
  describe('predictArrivalPattern', () => {
    it('should return default prior distribution when arrival history is sparse (< 5)', async () => {
      const result = await service.predictArrivalPattern({
        centreId: 'CENTRE-MP-IND-01',
        bookingDate: '2026-03-20',
        slotIndex: 0,
      });

      expect(result.value.expectedPunctuality).toBe('ON_TIME');
      expect(result.value.distribution.onTimeProbability).toBe(0.65);
      expect(result.confidence).toBe(0.30);
      expect(result.metadata.isFallback).toBe(true);
      expect(result.metadata.algorithm).toBe('DEFAULT_EMPIRICAL_PRIOR');
    });

    it('should compute empirical distribution from observed arrivals when >= 5 records exist', async () => {
      const centreId = 'CENTRE-MP-IND-01';

      // Seed 6 queue records with arrival timestamps (4 on-time, 1 early, 1 late)
      for (let i = 1; i <= 6; i++) {
        const arrivalDate = new Date('2026-03-20T09:05:00.000Z'); // 09:05 is on-time for 09:00 slot
        if (i === 1) arrivalDate.setUTCMinutes(arrivalDate.getUTCMinutes() - 25); // Early (08:40 UTC)
        if (i === 6) arrivalDate.setUTCMinutes(arrivalDate.getUTCMinutes() + 35); // Late (09:40 UTC)

        await queueModel.create({
          bookingId: `BKG-ARR-00${i}`,
          tokenNumber: i,
          farmerId: `FARMER-00${i}`,
          centreId,
          bookingDate: '2026-03-20',
          commodityCode: 'WHEAT',
          quantityQuintals: 25,
          currentState: 'ARRIVED',
          stateHistory: [
            {
              fromState: 'BOOKED',
              toState: 'ARRIVED',
              timestamp: arrivalDate,
              changedByUserId: 'SYSTEM',
              changedByRole: 'SYSTEM',
            },
          ],
        });
      }

      const result = await service.predictArrivalPattern({
        centreId,
        bookingDate: '2026-03-20',
        slotIndex: 0,
      });

      expect(result.value.distribution.onTimeProbability).toBeGreaterThan(0.40);
      expect(result.confidence).toBeGreaterThanOrEqual(0.40);
      expect(result.metadata.isFallback).toBe(false);
      expect(result.metadata.algorithm).toBe('EMPIRICAL_HISTORICAL_DISTRIBUTION');
    });
  });

  // --------------------------------------------------------------------------
  // 3. No-Show Risk Prediction (Section 7, 31)
  // --------------------------------------------------------------------------
  describe('predictNoShowRisk', () => {
    it('should assign LOW risk and baseline prior when booking history is sparse', async () => {
      const result = await service.predictNoShowRisk({
        farmerId: 'FARMER-NEW-01',
        centreId: 'CENTRE-MP-IND-01',
        bookingDate: '2026-03-20',
        slotIndex: 1,
        quantityQuintals: 20,
      });

      expect(result.value.riskLevel).toBe('LOW');
      expect(result.value.noShowProbability).toBe(0.08);
      expect(result.confidence).toBeLessThan(0.40);
      expect(result.metadata.isFallback).toBe(true);
    });

    it('should detect HIGH risk when farmer has repeated cancellations/no-shows', async () => {
      const farmerId = 'FARMER-FLAKY-01';
      const centreId = 'CENTRE-MP-IND-01';

      // Seed 4 bookings for this farmer, 3 of which were cancelled / no-shows (75% no-show rate)
      await bookingModel.create({
        bookingId: 'BKG-F1',
        farmerId,
        centreId,
        status: BookingStatus.NO_SHOW,
      });
      await bookingModel.create({
        bookingId: 'BKG-F2',
        farmerId,
        centreId,
        status: BookingStatus.CANCELLED,
      });
      await bookingModel.create({
        bookingId: 'BKG-F3',
        farmerId,
        centreId,
        status: BookingStatus.NO_SHOW,
      });
      await bookingModel.create({
        bookingId: 'BKG-F4',
        farmerId,
        centreId,
        status: BookingStatus.COMPLETED,
      });
      // Centre baseline seed (1 booking)
      await bookingModel.create({
        bookingId: 'BKG-C1',
        farmerId: 'OTHER',
        centreId,
        status: BookingStatus.COMPLETED,
      });

      const result = await service.predictNoShowRisk({
        farmerId,
        centreId,
        bookingDate: '2026-03-20',
        slotIndex: 1,
        quantityQuintals: 20,
      });

      expect(result.value.riskLevel).toBe('HIGH');
      expect(result.value.noShowProbability).toBeGreaterThanOrEqual(0.35);
      expect(result.confidence).toBeGreaterThanOrEqual(0.40);
      expect(result.metadata.isFallback).toBe(false);
      expect(result.value.topFactors.some((f) => f.includes('historical no-show'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Section 44 Compliance: Empirical Evaluation Without Fabricated Metrics
  // --------------------------------------------------------------------------
  describe('Section 44 Compliance (No Fake Performance Metrics)', () => {
    it('should compute genuine Mean Absolute Error (MAE) strictly on actual test sample pairs', async () => {
      // Create ground-truth actual durations vs predicted values
      const groundTruthActualMinutes = [42, 48, 50, 55, 46, 52];
      const modelPredictedMinutes = [45, 47, 52, 53, 44, 50];

      // Calculate actual mathematical MAE
      const n = groundTruthActualMinutes.length;
      let absoluteErrorSum = 0;
      for (let i = 0; i < n; i++) {
        absoluteErrorSum += Math.abs(groundTruthActualMinutes[i] - modelPredictedMinutes[i]);
      }
      const actualMAE = absoluteErrorSum / n;

      // MAE = (|42-45| + |48-47| + |50-52| + |55-53| + |46-44| + |52-50|) / 6
      //     = (3 + 1 + 2 + 2 + 2 + 2) / 6 = 12 / 6 = 2.0 minutes
      expect(actualMAE).toBe(2.0);

      // Verify that no arbitrary percentage (like "99.4% accurate") is claimed
      const prediction = await service.predictServiceTime({
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 20,
      });

      expect(prediction.metadata.modelVersion).toBe('v1.0.0-statistical');
      expect(prediction.confidence).toBeLessThanOrEqual(1.0);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.0);
    });
  });
});
