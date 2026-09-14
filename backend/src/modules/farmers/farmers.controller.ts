import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FarmersService, RequestClientMetadata } from './farmers.service';
import { UpdateFarmerProfileDto } from './dto/update-farmer-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
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

  private extractClientMeta(req: Request): RequestClientMetadata {
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'];
    const requestId = req.headers['x-request-id'] as string;
    return { ipAddress, userAgent, requestId };
  }

  @Get('profile')
  @Roles(Role.FARMER)
  async getProfile(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const meta = this.extractClientMeta(req);
    const profile = await this.farmersService.getProfile(user.userId, meta);
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
    @Req() req: Request,
  ) {
    const meta = this.extractClientMeta(req);
    const updated = await this.farmersService.updateProfile(user.userId, dto, meta);
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

  /**
   * DPDP Act 2023 Section 11: Data Subject Right to Access & Data Portability
   * Generates full portable data export of farmer profile, tokens, weighments, and PII logs.
   */
  @Get('data-export')
  @Roles(Role.FARMER)
  async exportFarmerData(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = this.extractClientMeta(req);
    const dataDump = await this.farmersService.exportFarmerData(user.userId, meta);

    // Provide attachment download hint header
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dpdp-farmer-export-${user.userId}-${Date.now()}.json"`,
    );
    res.setHeader('Content-Type', 'application/json');

    return {
      success: true,
      data: dataDump,
    };
  }

  /**
   * DPDP Act 2023 Section 12: Right to Erasure / Account Deletion
   * Anonymizes PII while enforcing the statutory 7-year GFR 290 legal retention hold on financial procurement records.
   */
  @Delete('account')
  @Roles(Role.FARMER)
  @HttpCode(HttpStatus.OK)
  async deleteFarmerAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Body() dto?: DeleteAccountDto,
  ) {
    const meta = this.extractClientMeta(req);
    const result = await this.farmersService.deleteFarmerAccount(user.userId, meta);
    return result;
  }
}
