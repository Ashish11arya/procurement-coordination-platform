import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { BookingScheduleRequest } from './types/scheduling.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Role } from '../../shared/enums/roles.enum';

@Controller('scheduling')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post('evaluate')
  async evaluateSchedule(@Body() req: BookingScheduleRequest) {
    const result = await this.schedulingService.evaluateBookingConstraints(req);
    return {
      success: true,
      result,
    };
  }

  @Post('centres/:centreId/counters/:counterId/breakdown')
  @Roles(Role.SYSTEM_ADMIN, Role.STATE_ADMIN, Role.CENTRE_ADMIN)
  async handleCounterBreakdown(
    @Param('centreId') centreId: string,
    @Param('counterId') counterId: string,
    @Query('date') date: string,
  ) {
    const report = await this.schedulingService.recomputeOnCounterBreakdown(
      centreId,
      counterId,
      date,
    );
    return {
      success: true,
      message: `Counter breakdown processed. Stage '${report.bottleneckStage}' capacity updated.`,
      report,
    };
  }
}
