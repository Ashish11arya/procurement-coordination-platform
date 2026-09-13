import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import {
  IPredictionEngine,
  PredictionResult,
  ServiceTimeFeatures,
  ServiceTimePrediction,
  ArrivalPatternFeatures,
  ArrivalPatternPrediction,
  NoShowRiskFeatures,
  NoShowRiskPrediction,
} from './interfaces/prediction.interface';
import { PredictionLog, PredictionLogDocument } from './schemas/prediction-log.schema';
import { ServiceSession, ServiceSessionDocument, ServiceSessionStatus } from '../operations/schemas/service-session.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schemas/booking.schema';
import { QueueState, QueueStateDocument } from '../queue/schemas/queue-state.schema';

const MODEL_VERSION = 'v1.0.0-statistical';
const MIN_SAMPLES_FOR_CONFIDENCE = 5;

@Injectable()
export class PredictionsService implements IPredictionEngine {
  private readonly logger = new Logger(PredictionsService.name);

  constructor(
    @InjectModel(PredictionLog.name)
    private readonly predictionLogModel: Model<PredictionLogDocument>,
    @InjectModel(ServiceSession.name)
    private readonly sessionModel: Model<ServiceSessionDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(QueueState.name)
    private readonly queueModel: Model<QueueStateDocument>,
  ) {}

  /**
   * 1. Service Duration Prediction (Section 7, 31)
   * Uses statistical moving average over completed historical sessions.
   * If sample count < 5, falls back to deterministic calculation with low confidence.
   */
  async predictServiceTime(
    features: ServiceTimeFeatures,
  ): Promise<PredictionResult<ServiceTimePrediction>> {
    const predictionId = `PRED-SRV-${crypto.randomUUID()}`;
    const startTime = new Date();

    // Deterministic baseline
    const baseSetupMinutes = 10;
    const deterministicProcessingMinutes = Math.ceil((features.quantityQuintals / 40.0) * 60);
    const deterministicDuration = baseSetupMinutes + deterministicProcessingMinutes;

    try {
      // Find completed sessions for this centre
      const completedSessions = await this.sessionModel
        .find({
          centreId: features.centreId,
          status: ServiceSessionStatus.COMPLETED,
          durationSeconds: { $gt: 60 }, // Valid sessions > 1 minute
        })
        .limit(100)
        .exec();

      // Find completed bookings for commodity/quantity alignment
      const completedBookings = await this.bookingModel
        .find({
          centreId: features.centreId,
          commodityCode: features.commodityCode,
          status: BookingStatus.COMPLETED,
        })
        .limit(100)
        .exec();

      // Correlate sessions with bookings of similar quantity (within +/- 30%)
      const relevantDurations: number[] = [];

      for (const b of completedBookings) {
        const qtyRatio = b.quantityQuintals / (features.quantityQuintals || 1);
        if (qtyRatio >= 0.7 && qtyRatio <= 1.3) {
          const sessions = completedSessions.filter((s) => s.bookingId === b.bookingId);
          if (sessions.length > 0) {
            const totalDurationSec = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
            relevantDurations.push(Math.round(totalDurationSec / 60));
          }
        }
      }

      const sampleCount = relevantDurations.length;

      if (sampleCount >= MIN_SAMPLES_FOR_CONFIDENCE) {
        // Calculate empirical mean & standard deviation
        const sum = relevantDurations.reduce((acc, val) => acc + val, 0);
        const mean = sum / sampleCount;
        const variance =
          relevantDurations.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / sampleCount;
        const stdDev = Math.sqrt(variance);

        // Standard error of the mean
        const stdError = stdDev / Math.sqrt(sampleCount);
        const uncertaintyMargin = Number(Math.max(2, 1.96 * stdError).toFixed(1));

        // Statistical power scaling: confidence scales from 0.50 to 0.95 as sample grows to 50
        const confidence = Number(
          Math.min(0.95, 0.40 + (Math.min(sampleCount, 50) / 50) * 0.55).toFixed(2),
        );

        const estimatedDurationMinutes = Math.max(5, Math.round(mean));
        const setupEstimate = Math.min(15, Math.max(5, Math.round(estimatedDurationMinutes * 0.2)));
        const procEstimate = estimatedDurationMinutes - setupEstimate;

        const result: PredictionResult<ServiceTimePrediction> = {
          value: {
            estimatedDurationMinutes,
            breakdown: {
              baseSetupMinutes: setupEstimate,
              processingMinutes: procEstimate,
            },
          },
          confidence,
          uncertaintyMargin,
          metadata: {
            modelVersion: MODEL_VERSION,
            algorithm: 'STATISTICAL_MOVING_AVERAGE',
            inputFeatures: features,
            predictedAt: startTime,
            sampleCount,
            isFallback: false,
          },
        };

        this.logPredictionAsync(predictionId, 'SERVICE_TIME', result, features.centreId);
        return result;
      }

      // Fallback: Insufficient sample size
      const fallbackConfidence = Number(
        ((sampleCount / MIN_SAMPLES_FOR_CONFIDENCE) * 0.35).toFixed(2),
      );
      const fallbackResult: PredictionResult<ServiceTimePrediction> = {
        value: {
          estimatedDurationMinutes: deterministicDuration,
          breakdown: {
            baseSetupMinutes,
            processingMinutes: deterministicProcessingMinutes,
          },
        },
        confidence: fallbackConfidence,
        uncertaintyMargin: 10,
        metadata: {
          modelVersion: MODEL_VERSION,
          algorithm: 'DETERMINISTIC_FALLBACK',
          inputFeatures: features,
          predictedAt: startTime,
          sampleCount,
          isFallback: true,
          notes: `Insufficient historical samples (${sampleCount} < ${MIN_SAMPLES_FOR_CONFIDENCE}). Used deterministic baseline.`,
        },
      };

      this.logPredictionAsync(
        predictionId,
        'SERVICE_TIME',
        fallbackResult,
        features.centreId,
        'Insufficient samples',
      );
      return fallbackResult;
    } catch (err) {
      this.logger.error(`Error during service time prediction: ${err.message}`);
      return {
        value: {
          estimatedDurationMinutes: deterministicDuration,
          breakdown: {
            baseSetupMinutes,
            processingMinutes: deterministicProcessingMinutes,
          },
        },
        confidence: 0.1,
        uncertaintyMargin: 15,
        metadata: {
          modelVersion: MODEL_VERSION,
          algorithm: 'ERROR_FALLBACK',
          inputFeatures: features,
          predictedAt: startTime,
          sampleCount: 0,
          isFallback: true,
          notes: `Exception encountered: ${err.message}`,
        },
      };
    }
  }

  /**
   * 2. Arrival Pattern Prediction (Section 7, 31)
   * Predicts early/on-time/late distribution based on empirical check-in logs.
   */
  async predictArrivalPattern(
    features: ArrivalPatternFeatures,
  ): Promise<PredictionResult<ArrivalPatternPrediction>> {
    const predictionId = `PRED-ARR-${crypto.randomUUID()}`;
    const startTime = new Date();

    try {
      // Inspect historical queue arrivals at this centre
      const pastQueueRecords = await this.queueModel
        .find({
          centreId: features.centreId,
        })
        .limit(100)
        .exec();

      let earlyCount = 0;
      let onTimeCount = 0;
      let lateCount = 0;
      const deviationMinutesList: number[] = [];

      for (const q of pastQueueRecords) {
        const arrivalStep = q.stateHistory.find(
          (h) => h.toState === 'ARRIVED' || h.toState === 'CHECKED_IN',
        );
        if (!arrivalStep) continue;

        // Arrival timestamp relative to 09:00 + (slotIndex * 1h) in UTC
        const arrivalTime = new Date(arrivalStep.timestamp);
        const targetHour = 9 + (features.slotIndex % 8);
        const scheduledHour = arrivalTime.getUTCHours();
        const diffMinutes = (scheduledHour - targetHour) * 60 + arrivalTime.getUTCMinutes();

        deviationMinutesList.push(diffMinutes);

        if (diffMinutes < -15) {
          earlyCount++;
        } else if (diffMinutes <= 15) {
          onTimeCount++;
        } else {
          lateCount++;
        }
      }

      const sampleCount = deviationMinutesList.length;

      if (sampleCount >= MIN_SAMPLES_FOR_CONFIDENCE) {
        let earlyProb = earlyCount / sampleCount;
        let onTimeProb = onTimeCount / sampleCount;
        let lateProb = lateCount / sampleCount;

        // Distance factor: farmers travelling > 30km tend to experience higher delay
        if (features.transitDistanceKm && features.transitDistanceKm > 30) {
          const shift = Math.min(0.15, (features.transitDistanceKm - 30) * 0.005);
          lateProb += shift;
          onTimeProb = Math.max(0.1, onTimeProb - shift);
        }

        const totalProb = earlyProb + onTimeProb + lateProb;
        earlyProb = Number((earlyProb / totalProb).toFixed(2));
        onTimeProb = Number((onTimeProb / totalProb).toFixed(2));
        lateProb = Number((lateProb / totalProb).toFixed(2));

        let expectedPunctuality: 'EARLY' | 'ON_TIME' | 'LATE' = 'ON_TIME';
        if (earlyProb > onTimeProb && earlyProb > lateProb) expectedPunctuality = 'EARLY';
        if (lateProb > onTimeProb && lateProb > earlyProb) expectedPunctuality = 'LATE';

        const avgDeviation = Math.round(
          deviationMinutesList.reduce((a, b) => a + b, 0) / sampleCount,
        );

        const confidence = Number(
          Math.min(0.9, 0.4 + (Math.min(sampleCount, 40) / 40) * 0.5).toFixed(2),
        );

        const result: PredictionResult<ArrivalPatternPrediction> = {
          value: {
            expectedPunctuality,
            expectedDeviationMinutes: avgDeviation,
            distribution: {
              earlyProbability: earlyProb,
              onTimeProbability: onTimeProb,
              lateProbability: lateProb,
            },
          },
          confidence,
          uncertaintyMargin: Number((1 / Math.sqrt(sampleCount)).toFixed(2)),
          metadata: {
            modelVersion: MODEL_VERSION,
            algorithm: 'EMPIRICAL_HISTORICAL_DISTRIBUTION',
            inputFeatures: features,
            predictedAt: startTime,
            sampleCount,
            isFallback: false,
          },
        };

        this.logPredictionAsync(predictionId, 'ARRIVAL_PATTERN', result, features.centreId);
        return result;
      }

      // Fallback
      const fallbackResult: PredictionResult<ArrivalPatternPrediction> = {
        value: {
          expectedPunctuality: 'ON_TIME',
          expectedDeviationMinutes: 0,
          distribution: {
            earlyProbability: 0.2,
            onTimeProbability: 0.65,
            lateProbability: 0.15,
          },
        },
        confidence: 0.3,
        uncertaintyMargin: 0.25,
        metadata: {
          modelVersion: MODEL_VERSION,
          algorithm: 'DEFAULT_EMPIRICAL_PRIOR',
          inputFeatures: features,
          predictedAt: startTime,
          sampleCount,
          isFallback: true,
          notes: `Insufficient arrival samples (${sampleCount} < ${MIN_SAMPLES_FOR_CONFIDENCE}). Used default prior.`,
        },
      };

      this.logPredictionAsync(
        predictionId,
        'ARRIVAL_PATTERN',
        fallbackResult,
        features.centreId,
        'Insufficient samples',
      );
      return fallbackResult;
    } catch (err) {
      this.logger.error(`Error during arrival pattern prediction: ${err.message}`);
      return {
        value: {
          expectedPunctuality: 'ON_TIME',
          expectedDeviationMinutes: 0,
          distribution: {
            earlyProbability: 0.2,
            onTimeProbability: 0.65,
            lateProbability: 0.15,
          },
        },
        confidence: 0.1,
        uncertaintyMargin: 0.3,
        metadata: {
          modelVersion: MODEL_VERSION,
          algorithm: 'ERROR_FALLBACK',
          inputFeatures: features,
          predictedAt: startTime,
          sampleCount: 0,
          isFallback: true,
          notes: `Exception encountered: ${err.message}`,
        },
      };
    }
  }

  /**
   * 3. No-Show Risk Prediction (Section 7, 31)
   * Evaluates historical cancellation/no-show ratio for farmer and centre.
   */
  async predictNoShowRisk(
    features: NoShowRiskFeatures,
  ): Promise<PredictionResult<NoShowRiskPrediction>> {
    const predictionId = `PRED-NS-${crypto.randomUUID()}`;
    const startTime = new Date();

    try {
      // 1. Farmer individual history
      const farmerBookings = await this.bookingModel
        .find({ farmerId: features.farmerId })
        .limit(50)
        .exec();

      // 2. Centre aggregate history
      const centreBookings = await this.bookingModel
        .find({ centreId: features.centreId })
        .limit(100)
        .exec();

      const totalSamples = farmerBookings.length + centreBookings.length;
      const topFactors: string[] = [];

      if (totalSamples >= MIN_SAMPLES_FOR_CONFIDENCE) {
        let farmerNoShowRate = 0;
        if (farmerBookings.length >= 3) {
          const farmerNoShows = farmerBookings.filter(
            (b) => b.status === BookingStatus.NO_SHOW || b.status === BookingStatus.CANCELLED,
          ).length;
          farmerNoShowRate = farmerNoShows / farmerBookings.length;
          if (farmerNoShowRate > 0.3) {
            topFactors.push(`Farmer has ${Math.round(farmerNoShowRate * 100)}% historical no-show/cancellation rate`);
          }
        }

        const centreNoShows = centreBookings.filter(
          (b) => b.status === BookingStatus.NO_SHOW || b.status === BookingStatus.CANCELLED,
        ).length;
        const centreNoShowRate = centreBookings.length > 0 ? centreNoShows / centreBookings.length : 0.08;

        // Blended rate (70% farmer if known, 30% centre baseline)
        let blendedRate =
          farmerBookings.length >= 3
            ? 0.7 * farmerNoShowRate + 0.3 * centreNoShowRate
            : centreNoShowRate;

        // Transit distance factor
        if (features.transitDistanceKm && features.transitDistanceKm > 40) {
          blendedRate += 0.05;
          topFactors.push(`High transit distance (${features.transitDistanceKm}km) increases cancellation probability`);
        }

        const noShowProbability = Number(Math.min(0.95, Math.max(0.02, blendedRate)).toFixed(2));

        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (noShowProbability >= 0.35) {
          riskLevel = 'HIGH';
        } else if (noShowProbability >= 0.15) {
          riskLevel = 'MEDIUM';
        }

        if (topFactors.length === 0) {
          topFactors.push('Consistent historical attendance pattern');
        }

        const confidence = Number(
          Math.min(0.9, 0.4 + (Math.min(totalSamples, 30) / 30) * 0.5).toFixed(2),
        );

        const result: PredictionResult<NoShowRiskPrediction> = {
          value: {
            noShowProbability,
            riskLevel,
            topFactors,
          },
          confidence,
          uncertaintyMargin: 0.05,
          metadata: {
            modelVersion: MODEL_VERSION,
            algorithm: 'HISTORICAL_FREQUENCY_WEIGHTED',
            inputFeatures: features,
            predictedAt: startTime,
            sampleCount: totalSamples,
            isFallback: false,
          },
        };

        this.logPredictionAsync(
          predictionId,
          'NO_SHOW_RISK',
          result,
          features.centreId,
          undefined,
          features.farmerId,
        );
        return result;
      }

      // Fallback
      const fallbackResult: PredictionResult<NoShowRiskPrediction> = {
        value: {
          noShowProbability: 0.08,
          riskLevel: 'LOW',
          topFactors: ['Baseline regional attendance rate applied (insufficient farmer history)'],
        },
        confidence: 0.25,
        uncertaintyMargin: 0.1,
        metadata: {
          modelVersion: MODEL_VERSION,
          algorithm: 'BASELINE_REGIONAL_PRIOR',
          inputFeatures: features,
          predictedAt: startTime,
          sampleCount: totalSamples,
          isFallback: true,
          notes: `Insufficient historical records (${totalSamples} < ${MIN_SAMPLES_FOR_CONFIDENCE}). Used baseline prior.`,
        },
      };

      this.logPredictionAsync(
        predictionId,
        'NO_SHOW_RISK',
        fallbackResult,
        features.centreId,
        'Insufficient samples',
        features.farmerId,
      );
      return fallbackResult;
    } catch (err) {
      this.logger.error(`Error during no-show risk prediction: ${err.message}`);
      return {
        value: {
          noShowProbability: 0.08,
          riskLevel: 'LOW',
          topFactors: ['Default baseline applied due to temporary prediction error'],
        },
        confidence: 0.1,
        uncertaintyMargin: 0.15,
        metadata: {
          modelVersion: MODEL_VERSION,
          algorithm: 'ERROR_FALLBACK',
          inputFeatures: features,
          predictedAt: startTime,
          sampleCount: 0,
          isFallback: true,
          notes: `Exception encountered: ${err.message}`,
        },
      };
    }
  }

  /**
   * Asynchronous non-blocking persistence of prediction metadata for auditing (Section 31)
   */
  private logPredictionAsync(
    predictionId: string,
    predictionType: string,
    result: PredictionResult<any>,
    centreId?: string,
    fallbackReason?: string,
    farmerId?: string,
  ): void {
    Promise.resolve().then(async () => {
      try {
        await this.predictionLogModel.create({
          predictionId,
          predictionType,
          modelVersion: result.metadata.modelVersion,
          algorithm: result.metadata.algorithm,
          inputFeatures: result.metadata.inputFeatures,
          predictedValue: result.value,
          confidence: result.confidence,
          uncertaintyMargin: result.uncertaintyMargin,
          isFallback: result.metadata.isFallback,
          fallbackReason: fallbackReason || result.metadata.notes,
          centreId,
          farmerId,
          predictedAt: result.metadata.predictedAt,
        });
      } catch (err) {
        this.logger.warn(`Failed to persist prediction audit log: ${err.message}`);
      }
    });
  }

  /**
   * Query prediction audit logs (Section 31)
   */
  async getPredictionLogs(centreId?: string, limit = 50): Promise<PredictionLog[]> {
    const filter = centreId ? { centreId } : {};
    return this.predictionLogModel.find(filter).sort({ predictedAt: -1 }).limit(limit).exec();
  }
}
