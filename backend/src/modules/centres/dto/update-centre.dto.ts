import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsBoolean,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CoordinatesDto, OperatingHoursDto } from './create-centre.dto';

export class UpdateCentreDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  agencyName?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @ValidateNested()
  @Type(() => CoordinatesDto)
  @IsOptional()
  coordinates?: CoordinatesDto;

  @IsString()
  @IsOptional()
  operatingSeason?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  supportedCommodities?: string[];

  @IsNumber()
  @Min(1)
  @IsOptional()
  dailyCapacityQuintals?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxSimultaneousVehicles?: number;

  @ValidateNested()
  @Type(() => OperatingHoursDto)
  @IsOptional()
  operatingHours?: OperatingHoursDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
