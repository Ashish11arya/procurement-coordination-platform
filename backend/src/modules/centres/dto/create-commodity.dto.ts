import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreateCommodityDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(1)
  mspPerQuintal: number;

  @IsString()
  @IsNotEmpty()
  season: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  standardBagWeightKg?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
