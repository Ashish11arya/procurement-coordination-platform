import {
  IsNotEmpty,
  IsString,
  IsEmail,
  MinLength,
  IsEnum,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../../../shared/enums/roles.enum';

export class ScopeDto {
  @IsOptional()
  @IsString()
  centreId?: string;

  @IsOptional()
  @IsString()
  districtId?: string;

  @IsOptional()
  @IsString()
  stateId?: string;
}

export class CreateOperatorDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Username is required' })
  @IsString()
  @MinLength(3)
  username: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail()
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(Role, { message: 'Must be a valid system role' })
  role: Role;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScopeDto)
  scope?: ScopeDto;
}
