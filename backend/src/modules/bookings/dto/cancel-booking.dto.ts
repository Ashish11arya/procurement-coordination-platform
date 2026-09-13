import { IsString, IsNotEmpty } from 'class-validator';

export class CancelBookingDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
