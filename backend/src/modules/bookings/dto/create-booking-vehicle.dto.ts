import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';
import { VehicleType } from '../schemas/booking-vehicle.schema';

export class CreateBookingVehicleDto {
  @IsString()
  @IsNotEmpty()
  vehicleNumber: string;

  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  @IsNumber()
  @Min(0.1)
  allocatedQuantityQuintals: number;

  @IsString()
  @IsOptional()
  driverName?: string;

  @IsString()
  @IsOptional()
  driverMobile?: string;
}
