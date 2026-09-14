import {
  IsNotEmpty,
  Matches,
  IsString,
  MinLength,
  IsOptional,
  IsNumber,
  IsBoolean,
  Equals,
  IsArray,
} from 'class-validator';

export class RegisterFarmerDto {
  @IsNotEmpty({ message: 'Mobile number is required' })
  @Matches(/^[6-9]\d{9}$/, { message: 'Must be a valid 10-digit Indian mobile number' })
  mobile: string;

  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  name: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  subDistrict?: string;

  @IsOptional()
  @IsString()
  village?: string;

  @IsOptional()
  @IsNumber()
  landAreaAcres?: number;

  /**
   * DPDP Act 2023 Explicit Consent Requirement
   * Must be explicitly confirmed (checkbox cannot be pre-selected)
   */
  @IsNotEmpty({ message: 'Consent confirmation is required' })
  @IsBoolean({ message: 'Consent must be a boolean flag' })
  @Equals(true, {
    message: 'Explicit consent to data sharing with government coordination systems under the DPDP Act 2023 is mandatory to register.',
  })
  consentToDataSharing: boolean;

  @IsOptional()
  @IsString()
  consentVersion?: string;

  @IsOptional()
  @IsArray()
  consentScopes?: string[];
}
