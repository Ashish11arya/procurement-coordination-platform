import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  IsBoolean,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CoordinatesDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

export class OperatingHoursDto {
  @IsString()
  @IsNotEmpty()
  openTime: string; // e.g. '09:00'

  @IsString()
  @IsNotEmpty()
  closeTime: string; // e.g. '18:00'
}

export class CreateCentreDto {
  @IsString()
  @IsNotEmpty()
  centreId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  agencyName: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates: CoordinatesDto;

  @IsString()
  @IsNotEmpty()
  operatingSeason: string;

  @IsArray()
  @IsString({ each: true })
  supportedCommodities: string[];

  @IsNumber()
  @Min(1)
  dailyCapacityQuintals: number;

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
