import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PredictionsService } from './predictions.service';
import {
  ServiceTimeFeatures,
  ArrivalPatternFeatures,
  NoShowRiskFeatures,
} from './interfaces/prediction.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Role } from '../../shared/enums/roles.enum';

@Controller('predictions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Post('service-time')
  async predictServiceTime(@Body() features: ServiceTimeFeatures) {
    const result = await this.predictionsService.predictServiceTime(features);
    return {
      success: true,
      result,
    };
  }

  @Post('arrival-pattern')
  async predictArrivalPattern(@Body() features: ArrivalPatternFeatures) {
    const result = await this.predictionsService.predictArrivalPattern(features);
    return {
      success: true,
      result,
    };
  }

  @Post('no-show-risk')
  async predictNoShowRisk(@Body() features: NoShowRiskFeatures) {
    const result = await this.predictionsService.predictNoShowRisk(features);
    return {
      success: true,
      result,
    };
  }

  @Get('logs')
  @Roles(
    Role.CENTRE_ADMIN,
    Role.DISTRICT_ADMIN,
    Role.STATE_ADMIN,
    Role.GOVERNMENT_ADMIN,
    Role.AUDITOR,
    Role.SYSTEM_ADMIN,
  )
  async getPredictionLogs(
    @Query('centreId') centreId?: string,
    @Query('limit') limit?: number,
  ) {
    const logs = await this.predictionsService.getPredictionLogs(centreId, limit ? Number(limit) : 50);
    return {
      success: true,
      count: logs.length,
      logs,
    };
  }
}
