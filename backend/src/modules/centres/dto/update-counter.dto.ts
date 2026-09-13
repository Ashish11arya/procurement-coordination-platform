import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CounterStatus } from '../schemas/counter.schema';

export class UpdateCounterDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  capacityPerHourQuintals?: number;

  @IsEnum(CounterStatus)
  @IsOptional()
  status?: CounterStatus;

  @IsString()
  @IsOptional()
  currentAssignedStaffId?: string;
}
