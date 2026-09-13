import { IsNotEmpty, IsString, MinLength, IsOptional, Length } from 'class-validator';

export class LoginOperatorDto {
  @IsNotEmpty({ message: 'Username or Email is required' })
  @IsString()
  identifier: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsOptional()
  @Length(6, 6, { message: 'MFA Code must be 6 digits' })
  mfaCode?: string;
}
