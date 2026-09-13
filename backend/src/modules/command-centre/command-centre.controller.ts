import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Role } from '../../shared/enums/roles.enum';
import { AuthenticatedUser } from '../../shared/types/auth.types';
import { CommandCentreService } from './command-centre.service';
import { CommandCentreFilterDto } from './dto/command-centre.dto';

@Controller('command-centre')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommandCentreController {
  constructor(private readonly commandCentreService: CommandCentreService) {}

  // 1. National & State-Level Overview
  @Get('states')
  @Roles(Role.STATE_ADMIN, Role.GOVERNMENT_ADMIN, Role.AUDITOR, Role.SYSTEM_ADMIN)
  async getStates(
    @Query() query: CommandCentreFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandCentreService.getStatesSummary(user, query);
  }

  // 2. District-Level Rollup & Drill-Down
  @Get('districts')
  @Roles(
    Role.DISTRICT_ADMIN,
    Role.STATE_ADMIN,
    Role.GOVERNMENT_ADMIN,
    Role.AUDITOR,
    Role.SYSTEM_ADMIN,
  )
  async getDistricts(
    @Query() query: CommandCentreFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandCentreService.getDistrictsSummary(user, query);
  }

  // 3. Centre-Level Operational Monitoring
  @Get('centres')
  @Roles(
    Role.CENTRE_ADMIN,
    Role.DISTRICT_ADMIN,
    Role.STATE_ADMIN,
    Role.GOVERNMENT_ADMIN,
    Role.AUDITOR,
    Role.SYSTEM_ADMIN,
  )
  async getCentres(
    @Query() query: CommandCentreFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandCentreService.getCentresSummary(user, query);
  }

  // 4. Bottlenecks & Anomaly Detection
  @Get('bottlenecks')
  @Roles(
    Role.CENTRE_ADMIN,
    Role.DISTRICT_ADMIN,
    Role.STATE_ADMIN,
    Role.GOVERNMENT_ADMIN,
    Role.AUDITOR,
    Role.SYSTEM_ADMIN,
  )
  async getBottlenecks(
    @Query() query: CommandCentreFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.commandCentreService.getBottlenecks(user, query);
  }

  // 5. Government Integration Health Monitoring
  @Get('integration-health')
  @Roles(Role.GOVERNMENT_ADMIN, Role.AUDITOR, Role.SYSTEM_ADMIN)
  async getIntegrationHealth(@CurrentUser() user: AuthenticatedUser) {
    return this.commandCentreService.getIntegrationHealth(user);
  }
}
