import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';

export class UpdateFarmerProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contactAddress?: string;

  @IsOptional()
  @IsIn(['hi', 'en'], { message: 'Preferred language must be either "hi" or "en"' })
  preferredLanguage?: string;
}
