import { IsOptional, IsString, IsEnum } from 'class-validator';
import { BookingStatus } from '../schemas/booking.schema';

export class BookingFilterDto {
  @IsOptional()
  @IsString()
  centreId?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  commodity?: string;
}
