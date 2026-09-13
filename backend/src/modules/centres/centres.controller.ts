import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CentresService } from './centres.service';
import { CreateCentreDto } from './dto/create-centre.dto';
import { UpdateCentreDto } from './dto/update-centre.dto';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { CreateCommodityDto } from './dto/create-commodity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Role } from '../../shared/enums/roles.enum';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CentresController {
  constructor(private readonly centresService: CentresService) {}

  // --------------------------------------------------------------------------
  // Centre Endpoints
  // --------------------------------------------------------------------------

  @Post('centres')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_ADMIN, Role.DISTRICT_ADMIN, Role.CENTRE_ADMIN)
  async createCentre(@Body() dto: CreateCentreDto) {
    const centre = await this.centresService.createCentre(dto);
    return {
      success: true,
      message: 'Procurement centre created successfully',
      centre,
    };
  }

  @Get('centres')
  async listCentres(
    @Query('state') state?: string,
    @Query('district') district?: string,
    @Query('commodity') commodityCode?: string,
    @Query('isActive') isActive?: string,
  ) {
    const centres = await this.centresService.findAllCentres({
      state,
      district,
      commodityCode,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
    return {
      success: true,
      count: centres.length,
      centres,
    };
  }

  @Get('centres/:centreId')
  async getCentre(@Param('centreId') centreId: string) {
    const centre = await this.centresService.findByCentreId(centreId);
    return {
      success: true,
      centre,
    };
  }

  @Patch('centres/:centreId')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_ADMIN, Role.CENTRE_ADMIN)
  async updateCentre(
    @Param('centreId') centreId: string,
    @Body() dto: UpdateCentreDto,
  ) {
    const updated = await this.centresService.updateCentre(centreId, dto);
    return {
      success: true,
      message: 'Centre updated successfully',
      centre: updated,
    };
  }

  @Get('centres/:centreId/capacity')
  async getCentreCapacity(
    @Param('centreId') centreId: string,
    @Query('date') date: string,
  ) {
    if (!date) {
      throw new BadRequestException("Query parameter 'date' (YYYY-MM-DD) is required.");
    }
    const capacity = await this.centresService.getCentreCapacity(centreId, date);
    return {
      success: true,
      capacity,
    };
  }

  // --------------------------------------------------------------------------
  // Counter Endpoints (Multi-counter model Section 13)
  // --------------------------------------------------------------------------

  @Post('centres/:centreId/counters')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_ADMIN, Role.CENTRE_ADMIN)
  async addCounter(
    @Param('centreId') centreId: string,
    @Body() dto: CreateCounterDto,
  ) {
    const counter = await this.centresService.addCounter(centreId, dto);
    return {
      success: true,
      message: 'Operational counter added successfully',
      counter,
    };
  }

  @Get('centres/:centreId/counters')
  async getCounters(@Param('centreId') centreId: string) {
    const counters = await this.centresService.getCounters(centreId);
    return {
      success: true,
      count: counters.length,
      counters,
    };
  }

  @Patch('centres/:centreId/counters/:counterId')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_ADMIN, Role.CENTRE_ADMIN)
  async updateCounter(
    @Param('centreId') centreId: string,
    @Param('counterId') counterId: string,
    @Body() dto: UpdateCounterDto,
  ) {
    const updated = await this.centresService.updateCounter(centreId, counterId, dto);
    return {
      success: true,
      message: 'Counter updated successfully',
      counter: updated,
    };
  }

  // --------------------------------------------------------------------------
  // Commodity Endpoints
  // --------------------------------------------------------------------------

  @Get('commodities')
  async listCommodities() {
    const commodities = await this.centresService.findAllCommodities();
    return {
      success: true,
      count: commodities.length,
      commodities,
    };
  }

  @Post('commodities')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_ADMIN)
  async createCommodity(@Body() dto: CreateCommodityDto) {
    const commodity = await this.centresService.createCommodity(dto);
    return {
      success: true,
      message: 'Commodity registered successfully',
      commodity,
    };
  }
}
