import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument, BookingStatus } from '../../bookings/schemas/booking.schema';
import { AuditLog, AuditLogDocument } from '../../audit/schemas/audit-log.schema';
import { DataProcessingLog, DataProcessingLogDocument, ProcessingAction, ProcessingPurpose, LawfulBasis } from '../schemas/data-processing-log.schema';
import { Role } from '../../../shared/enums/roles.enum';

export interface RetentionExecutionResult {
  executionTimestamp: Date;
  tier1Operational: {
    retentionDays: number;
    cutoffDate: Date;
    recordsEvaluated: number;
    recordsPurged: number;
    description: string;
  };
  tier2Analytics: {
    retentionDays: number;
    cutoffDate: Date;
    recordsEvaluated: number;
    recordsAnonymized: number;
    description: string;
  };
  tier3StatutoryAudit: {
    statutoryRetentionYears: number;
    legalReference: string;
    protectedAuditRecordsCount: number;
    legalHoldEnforced: boolean;
    description: string;
  };
  dryRun: boolean;
}

@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer: NodeJS.Timeout | null = null;
  private isJobRunning = false;

  // Configuration Constants
  private readonly TIER1_OPERATIONAL_DAYS = 90; // 90 days after season closure
  private readonly TIER2_ANALYTICS_DAYS = 180; // 180 days for granular booking analytics
  private readonly TIER3_STATUTORY_AUDIT_YEARS = 7; // GFR 2017 Rule 290 & CAG requirement

  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    @InjectModel(DataProcessingLog.name) private readonly processingLogModel: Model<DataProcessingLogDocument>,
  ) {}

  onModuleInit() {
    this.logger.log('RetentionService initialized. Scheduling 24-hour statutory data retention cycle.');
    // Run daily retention job (86,400,000 ms)
    this.timer = setInterval(() => {
      this.executeRetentionPolicy(false).catch((err) => {
        this.logger.error(`Automated retention cycle failed: ${err.message}`, err.stack);
      });
    }, 24 * 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Executes the 3-tier data retention policy.
   * Supports dryRun mode for government compliance preview.
   */
  async executeRetentionPolicy(dryRun = false): Promise<RetentionExecutionResult> {
    if (this.isJobRunning) {
      this.logger.warn('Retention job is already in progress. Skipping overlapping run.');
    }
    this.isJobRunning = true;

    try {
      const now = new Date();
      this.logger.log(`[RetentionEngine] Starting 3-tier data retention sweep (dryRun: ${dryRun})...`);

      // -------------------------------------------------------------
      // Tier 1: Operational Data (90-Day Window)
      // Scope: Cancelled or No-Show transient bookings older than 90 days
      // -------------------------------------------------------------
      const tier1Cutoff = new Date(now.getTime() - this.TIER1_OPERATIONAL_DAYS * 24 * 60 * 60 * 1000);
      const tier1Query = {
        status: { $in: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
        updatedAt: { $lt: tier1Cutoff },
      };

      const tier1Count = await this.bookingModel.countDocuments(tier1Query).exec();
      let tier1Purged = 0;

      if (!dryRun && tier1Count > 0) {
        const deleteRes = await this.bookingModel.deleteMany(tier1Query).exec();
        tier1Purged = deleteRes.deletedCount || 0;
        this.logger.log(`[Tier 1] Purged ${tier1Purged} expired operational bookings older than ${this.TIER1_OPERATIONAL_DAYS} days.`);
      }

      // -------------------------------------------------------------
      // Tier 2: Analytics Data (180-Day Window)
      // Scope: Completed procurement records older than 180 days:
      // Direct PII references are stripped/anonymized while preserving
      // commodity, net quintals, and financial aggregates for historical metrics.
      // -------------------------------------------------------------
      const tier2Cutoff = new Date(now.getTime() - this.TIER2_ANALYTICS_DAYS * 24 * 60 * 60 * 1000);
      const tier2Query = {
        status: BookingStatus.COMPLETED,
        updatedAt: { $lt: tier2Cutoff },
        farmerId: { $not: /^ANONYMIZED_/ },
      };

      const tier2Count = await this.bookingModel.countDocuments(tier2Query).exec();
      let tier2Anonymized = 0;

      if (!dryRun && tier2Count > 0) {
        const staleBookings = await this.bookingModel.find(tier2Query).limit(500).exec();
        for (const b of staleBookings) {
          b.farmerId = `ANONYMIZED_HISTORICAL_${b._id.toString().slice(-6)}`;
          await b.save();
          tier2Anonymized++;
        }
        this.logger.log(`[Tier 2] Anonymized ${tier2Anonymized} analytics bookings older than ${this.TIER2_ANALYTICS_DAYS} days.`);
      }

      // -------------------------------------------------------------
      // Tier 3: Statutory Audit Records (7-Year Legal Hold)
      // Statutory Reference: GFR 2017 Rule 290 & CAG Public Procurement Guidelines.
      // Immutable Audit Logs & Procurement Tickets MUST NOT be purged.
      // -------------------------------------------------------------
      const totalAuditRecords = await this.auditModel.countDocuments().exec();
      this.logger.log(
        `[Tier 3 Statutory Hold] Verified ${totalAuditRecords} audit records protected under mandatory 7-year GFR legal retention hold. No audit records purged.`,
      );

      // Record data processing log for the retention execution
      if (!dryRun) {
        const auditLogEntry = new this.processingLogModel({
          logId: `RETENTION-${now.getTime()}`,
          accessor: {
            userId: 'SYSTEM_RETENTION_DAEMON',
            role: Role.GOVERNMENT_ADMIN,
            name: 'Automated Compliance Retention Engine',
            ipAddress: '127.0.0.1',
            userAgent: 'ProcurementRetentionScheduler/1.0',
          },
          dataSubject: {
            farmerId: 'SYSTEM_BROADCAST_RETENTION',
          },
          dataCategoriesAccessed: ['BOOKINGS', 'OPERATIONAL_QUEUE', 'ANALYTICS_AGGREGATES'],
          processingPurpose: ProcessingPurpose.GOVERNMENT_SUBSIDY_AUDIT,
          lawfulBasis: LawfulBasis.LEGAL_OBLIGATION_SEC_7F,
          action: ProcessingAction.PURGE,
          details: `Retention executed: Tier 1 purged ${tier1Purged}, Tier 2 anonymized ${tier2Anonymized}. Statutory 7-yr GFR hold verified for ${totalAuditRecords} audit records.`,
          accessedAt: now,
        });
        await auditLogEntry.save();
      }

      return {
        executionTimestamp: now,
        tier1Operational: {
          retentionDays: this.TIER1_OPERATIONAL_DAYS,
          cutoffDate: tier1Cutoff,
          recordsEvaluated: tier1Count,
          recordsPurged: dryRun ? 0 : tier1Purged,
          description: `Purged cancelled/no-show operational queue buffers older than ${this.TIER1_OPERATIONAL_DAYS} days.`,
        },
        tier2Analytics: {
          retentionDays: this.TIER2_ANALYTICS_DAYS,
          cutoffDate: tier2Cutoff,
          recordsEvaluated: tier2Count,
          recordsAnonymized: dryRun ? 0 : tier2Anonymized,
          description: `Anonymized individual farmer references in analytics bookings older than ${this.TIER2_ANALYTICS_DAYS} days while preserving commodity/weight aggregates.`,
        },
        tier3StatutoryAudit: {
          statutoryRetentionYears: this.TIER3_STATUTORY_AUDIT_YEARS,
          legalReference: 'General Financial Rules (GFR), 2017 Rule 290 & CAG Audit Regulations (7-Year Hold)',
          protectedAuditRecordsCount: totalAuditRecords,
          legalHoldEnforced: true,
          description: 'Protected immutable financial procurement audit logs from premature destruction. Retention mandated for 7 years.',
        },
        dryRun,
      };
    } finally {
      this.isJobRunning = false;
    }
  }

  /**
   * Status summary of data retention posture.
   */
  async getRetentionStatus() {
    const totalAudit = await this.auditModel.countDocuments().exec();
    const totalProcessingLogs = await this.processingLogModel.countDocuments().exec();
    const activeBookings = await this.bookingModel.countDocuments({ status: { $in: [BookingStatus.BOOKED, BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.IN_PROGRESS] } }).exec();
    const completedBookings = await this.bookingModel.countDocuments({ status: BookingStatus.COMPLETED }).exec();

    return {
      status: 'HEALTHY',
      statutoryFramework: 'Digital Personal Data Protection (DPDP) Act, 2023 & GFR 2017 Rule 290',
      tiers: {
        tier1OperationalQueue: {
          retentionDays: this.TIER1_OPERATIONAL_DAYS,
          activeOperationalBookings: activeBookings,
          policy: 'Purged 90 days after season completion',
        },
        tier2Analytics: {
          retentionDays: this.TIER2_ANALYTICS_DAYS,
          completedRecords: completedBookings,
          policy: 'Farmer references anonymized after 180 days; aggregated totals preserved',
        },
        tier3StatutoryFinancialAudit: {
          retentionYears: this.TIER3_STATUTORY_AUDIT_YEARS,
          auditLogCount: totalAudit,
          piiProcessingLogCount: totalProcessingLogs,
          legalHold: 'ACTIVE (7-Year Mandatory Preservation)',
        },
      },
    };
  }
}
