import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Role } from '../../shared/enums/roles.enum';
import { AuthenticatedUser } from '../../shared/types/auth.types';
import { OperationsService } from './operations.service';
import {
  CheckInDto,
  StartWeighingDto,
  CompleteWeighingDto,
  QualityAssessmentDto,
  ProcurementCompletionDto,
} from './dto/operations.dto';

@Controller('operations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  // 1. Check-In Operator Endpoint
  @Post('check-in')
  @Roles(Role.CHECKIN_OPERATOR, Role.CENTRE_ADMIN, Role.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async checkIn(@Body() dto: CheckInDto, @CurrentUser() user: AuthenticatedUser) {
    return this.operationsService.checkIn(dto, user);
  }

  // 2. Weighing Operator Endpoints
  @Post('weighing/start')
  @Roles(Role.WEIGHING_OPERATOR, Role.CENTRE_ADMIN, Role.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.OK)
  async startWeighing(
    @Body() dto: StartWeighingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operationsService.startWeighing(dto, user);
  }

  @Post('weighing/complete')
  @Roles(Role.WEIGHING_OPERATOR, Role.CENTRE_ADMIN, Role.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async completeWeighing(
    @Body() dto: CompleteWeighingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operationsService.completeWeighing(dto, user);
  }

  // 3. Quality Operator Endpoint
  @Post('quality')
  @Roles(Role.QUALITY_OPERATOR, Role.CENTRE_ADMIN, Role.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async recordQuality(
    @Body() dto: QualityAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operationsService.recordQuality(dto, user);
  }

  // 4. Procurement Operator Endpoint
  @Post('procurement')
  @Roles(Role.PROCUREMENT_OPERATOR, Role.CENTRE_ADMIN, Role.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async recordProcurement(
    @Body() dto: ProcurementCompletionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operationsService.recordProcurement(dto, user);
  }

  // 5. Centre Live Operational Dashboard (Section 29)
  @Get('centres/:centreId/dashboard')
  @Roles(
    Role.CENTRE_ADMIN,
    Role.DISTRICT_ADMIN,
    Role.STATE_ADMIN,
    Role.GOVERNMENT_ADMIN,
    Role.AUDITOR,
    Role.SYSTEM_ADMIN,
  )
  async getCentreDashboard(
    @Param('centreId') centreId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.operationsService.getCentreDashboard(centreId, user);
  }
}
