import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';
import { CounterStage, CounterStatus } from '../schemas/counter.schema';

export class CreateCounterDto {
  @IsString()
  @IsNotEmpty()
  counterId: string;

  @IsNumber()
  @Min(1)
  counterNumber: number;

  @IsEnum(CounterStage)
  stage: CounterStage;

  @IsNumber()
  @Min(1)
  capacityPerHourQuintals: number;

  @IsEnum(CounterStatus)
  @IsOptional()
  status?: CounterStatus;
}
