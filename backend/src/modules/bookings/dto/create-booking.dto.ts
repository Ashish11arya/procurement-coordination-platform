import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  Matches,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBookingVehicleDto } from './create-booking-vehicle.dto';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  centreId: string;

  @IsString()
  @IsNotEmpty()
  commodityCode: string;

  @IsNumber()
  @Min(0.1)
  quantityQuintals: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'bookingDate must be in format YYYY-MM-DD',
  })
  bookingDate: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  preferredSlotIndex?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one vehicle must be registered for the booking.' })
  @ValidateNested({ each: true })
  @Type(() => CreateBookingVehicleDto)
  vehicles: CreateBookingVehicleDto[];
}
