import { CounterStage } from '../../centres/schemas/counter.schema';

export interface PredictionMetadata {
  modelVersion: string;
  algorithm: string;
  inputFeatures: Record<string, any>;
  predictedAt: Date;
  sampleCount: number;
  isFallback: boolean;
  notes?: string;
}

export interface PredictionResult<T> {
  value: T;
  confidence: number; // 0.0 to 1.0 based on empirical sample size & variance
  uncertaintyMargin: number; // Error margin (e.g. ± minutes, ± probability)
  metadata: PredictionMetadata;
}

// 1. Service Duration Prediction Features & Result
export interface ServiceTimeFeatures {
  centreId: string;
  commodityCode: string;
  quantityQuintals: number;
  vehicleCount?: number;
  counterStage?: CounterStage;
  timeOfDayHour?: number;
}

export interface ServiceTimePrediction {
  estimatedDurationMinutes: number;
  breakdown: {
    baseSetupMinutes: number;
    processingMinutes: number;
  };
}

// 2. Arrival Pattern & Punctuality Features & Result
export interface ArrivalPatternFeatures {
  centreId: string;
  bookingDate: string;
  slotIndex: number;
  transitDistanceKm?: number;
}

export interface ArrivalPatternPrediction {
  expectedPunctuality: 'EARLY' | 'ON_TIME' | 'LATE';
  expectedDeviationMinutes: number; // e.g. -10 min = 10m early, +15 min = 15m late
  distribution: {
    earlyProbability: number;
    onTimeProbability: number;
    lateProbability: number;
  };
}

// 3. No-Show & Cancellation Risk Features & Result
export interface NoShowRiskFeatures {
  farmerId: string;
  centreId: string;
  bookingDate: string;
  slotIndex: number;
  quantityQuintals: number;
  transitDistanceKm?: number;
}

export interface NoShowRiskPrediction {
  noShowProbability: number; // 0.0 to 1.0
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  topFactors: string[];
}

export interface IPredictionEngine {
  predictServiceTime(features: ServiceTimeFeatures): Promise<PredictionResult<ServiceTimePrediction>>;
  predictArrivalPattern(features: ArrivalPatternFeatures): Promise<PredictionResult<ArrivalPatternPrediction>>;
  predictNoShowRisk(features: NoShowRiskFeatures): Promise<PredictionResult<NoShowRiskPrediction>>;
}
