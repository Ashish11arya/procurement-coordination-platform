import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { QualityGrade, QualityVerdict } from '../schemas/quality-record.schema';

export class CheckInDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  tokenNumber: string;

  @IsString()
  @IsNotEmpty()
  vehicleNumber: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class StartWeighingDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  counterId: string;

  @IsString()
  @IsNotEmpty()
  vehicleNumber: string;
}

export class CompleteWeighingDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  counterId: string;

  @IsString()
  @IsNotEmpty()
  vehicleNumber: string;

  @IsNumber()
  @Min(0.1)
  grossWeightQuintals: number;

  @IsNumber()
  @Min(0)
  tareWeightQuintals: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QualityAssessmentDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  counterId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  moisturePercentage: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  foreignMatterPercentage: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  damagedGrainsPercentage: number;

  @IsEnum(QualityGrade)
  assignedGrade: QualityGrade;

  @IsEnum(QualityVerdict)
  verdict: QualityVerdict;

  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ProcurementCompletionDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  counterId: string;

  @IsNumber()
  @Min(0.1)
  finalQuantityQuintals: number;

  @IsNumber()
  @Min(1)
  mspRatePerQuintal: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
