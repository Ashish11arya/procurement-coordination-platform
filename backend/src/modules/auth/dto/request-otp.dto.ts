import { IsNotEmpty, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsNotEmpty({ message: 'Mobile number is required' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Must be a valid 10-digit Indian mobile number' })
  mobile: string;
}
