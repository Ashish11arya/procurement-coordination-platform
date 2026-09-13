import { IsOptional, IsString } from 'class-validator';

export class CommandCentreFilterDto {
  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  centreId?: string;

  @IsOptional()
  @IsString()
  date?: string;
}
