import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DataProcessingLogService } from './services/data-processing-log.service';
import { RetentionService } from './services/retention.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { Role } from '../../shared/enums/roles.enum';

@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(
    private readonly processingLogService: DataProcessingLogService,
    private readonly retentionService: RetentionService,
  ) {}

  /**
   * Public endpoint to retrieve current Privacy Policy metadata
   */
  @Public()
  @Get('policy')
  getPrivacyPolicyMeta() {
    return {
      version: 'DPDP-2023-V1.0',
      statute: 'Digital Personal Data Protection (DPDP) Act, 2023 (Act No. 22 of 2023)',
      effectiveDate: '2026-09-14',
      dataFiduciary: 'Department of Agriculture & Farmers Welfare, Government of India',
      dpoContact: 'privacy.procurement@gov.in',
      kisanHelpline: '1800-180-1551',
      legalNoticeUrl: '/docs/legal/PRIVACY_POLICY.md',
      statutoryRetention: {
        operationalQueue: '90 days post-season',
        analyticsGranular: '180 days prior to aggregation',
        financialAndAuditRecords: '7 years under GFR 2017 Rule 290',
      },
    };
  }

  /**
   * View all PII Data Processing Logs (RoPA) - Government Admin / DPO Audit
   */
  @Get('processing-logs')
  @Roles(Role.GOVERNMENT_ADMIN, Role.STATE_ADMIN)
  async getProcessingLogs(
    @Query('limit') limit = '50',
    @Query('skip') skip = '0',
  ) {
    const result = await this.processingLogService.getAllLogs(
      parseInt(limit, 10) || 50,
      parseInt(skip, 10) || 0,
    );
    return {
      success: true,
      count: result.count,
      logs: result.logs,
    };
  }

  /**
   * Check Data Retention & Legal Hold status across 3 tiers
   */
  @Get('retention/status')
  @Roles(Role.GOVERNMENT_ADMIN, Role.STATE_ADMIN)
  async getRetentionStatus() {
    const status = await this.retentionService.getRetentionStatus();
    return {
      success: true,
      ...status,
    };
  }

  /**
   * Trigger statutory data retention run on-demand
   */
  @Post('retention/run')
  @Roles(Role.GOVERNMENT_ADMIN)
  @HttpCode(HttpStatus.OK)
  async runRetentionSweep(@Body('dryRun') dryRun = false) {
    const result = await this.retentionService.executeRetentionPolicy(Boolean(dryRun));
    return {
      success: true,
      message: dryRun
        ? 'Retention policy dry-run completed. No records modified.'
        : 'Retention policy executed successfully across all 3 tiers.',
      result,
    };
  }
}
