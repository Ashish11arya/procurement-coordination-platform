import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FarmersService } from './farmers.service';
import { UpdateFarmerProfileDto } from './dto/update-farmer-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Role } from '../../shared/enums/roles.enum';
import { AuthenticatedUser } from '../../shared/types/auth.types';

@Controller('farmers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FarmersController {
  constructor(private readonly farmersService: FarmersService) {}

  @Get('profile')
  @Roles(Role.FARMER)
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.farmersService.getProfile(user.userId);
    return {
      success: true,
      profile,
    };
  }

  @Patch('profile')
  @Roles(Role.FARMER)
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFarmerProfileDto,
  ) {
    const updated = await this.farmersService.updateProfile(user.userId, dto);
    return {
      success: true,
      message: 'Farmer preferences updated successfully',
      profile: updated,
    };
  }

  @Get('eligibility')
  @Roles(Role.FARMER)
  async getEligibility(
    @CurrentUser() user: AuthenticatedUser,
    @Query('commodity') commodity: string,
  ) {
    if (!commodity) {
      throw new BadRequestException('Query parameter "commodity" is required (e.g. WHEAT, CHANA).');
    }
    const eligibility = await this.farmersService.getEligibility(user.userId, commodity);
    return {
      success: true,
      eligibility,
    };
  }
}
