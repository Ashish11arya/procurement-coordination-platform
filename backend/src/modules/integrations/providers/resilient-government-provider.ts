import { Injectable, Logger } from '@nestjs/common';
import {
  GovernmentDataProvider,
  GovernmentFarmerRecord,
  FarmerEligibilityRecord,
  GovernmentCentreRecord,
  GovernmentCentreCapacityRecord,
  GovernmentBookingRecord,
  GovernmentProcurementStatusRecord,
  ProcurementUpdatePayload,
  ProcurementUpdateResult,
  GovernmentPaymentStatusRecord,
  GovernmentSyncStatusResult,
  CentreQueryFilter,
} from '../contracts/government-data-provider.interface';
import {
  GovernmentCircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerMetrics,
} from '../circuit-breaker/government-circuit-breaker.service';

/**
 * ResilientGovernmentProvider (Section 21 Zero-Disruption Decorator)
 *
 * Wraps the selected GovernmentDataProvider (ESamridhiProvider or MockGovernmentProvider)
 * with GovernmentCircuitBreaker. Enforces the Golden Rule from Section 21:
 * "A failure of an external government portal must NEVER halt physical operations
 * at the procurement centre, cancel a farmer's arrival window, or refuse acceptance
 * of physical grain."
 *
 * When the breaker is OPEN (due to unconfigured credentials, network timeouts, or 503s):
 * - Farmer eligibility falls back to provisional quota with PENDING_GOVERNMENT_SYNC
 * - Centre capacity falls back to local registered capacity
 * - Farmer lookup falls back to null/provisional data so local registration proceeds
 * - Procurement updates return graceful offline queue status so weighment slips print
 * - Status queries return clear degraded/down metrics without throwing 500s
 */
@Injectable()
export class ResilientGovernmentProvider implements GovernmentDataProvider {
  private readonly logger = new Logger(ResilientGovernmentProvider.name);

  constructor(
    private readonly underlyingProvider: GovernmentDataProvider,
    private readonly circuitBreaker: GovernmentCircuitBreaker,
  ) {
    this.logger.log(
      `[ResilientGovernmentProvider] Initialized zero-disruption wrapper around '${this.underlyingProvider.providerName}'`,
    );
  }

  get providerName(): string {
    return this.underlyingProvider.providerName;
  }

  getCircuitBreakerMetrics(): CircuitBreakerMetrics {
    return this.circuitBreaker.getMetrics();
  }

  getCircuitBreaker(): GovernmentCircuitBreaker {
    return this.circuitBreaker;
  }

  async getFarmer(nationalFarmerId: string): Promise<GovernmentFarmerRecord | null> {
    return this.circuitBreaker.execute(
      'getFarmer',
      () => this.underlyingProvider.getFarmer(nationalFarmerId),
      (error) => {
        this.logger.warn(
          `[CircuitBreaker Fallback] getFarmer(${nationalFarmerId}) bypassed: ${error?.message}. Returning null to allow local profile creation.`,
        );
        return null;
      },
    );
  }

  async getFarmerEligibility(
    nationalFarmerId: string,
    commodityCode: string,
  ): Promise<FarmerEligibilityRecord> {
    return this.circuitBreaker.execute(
      'getFarmerEligibility',
      () => this.underlyingProvider.getFarmerEligibility(nationalFarmerId, commodityCode),
      (error) => {
        this.logger.warn(
          `[CircuitBreaker Fallback] getFarmerEligibility(${nationalFarmerId}, ${commodityCode}) bypassed: ${error?.message}. Issuing Section 21 provisional quota.`,
        );
        return {
          farmerId: nationalFarmerId,
          commodityCode: commodityCode.toUpperCase(),
          sanctionedQuantityQuintals: 100,
          alreadyProcuredQuantityQuintals: 0,
          remainingEligibleQuantityQuintals: 100,
          season: 'RABI_2026',
          year: 2026,
          validUntil: new Date(Date.now() + 90 * 86400000).toISOString(),
          isEligible: true,
        };
      },
    );
  }

  async getCentres(filter?: CentreQueryFilter): Promise<GovernmentCentreRecord[]> {
    return this.circuitBreaker.execute(
      'getCentres',
      () => this.underlyingProvider.getCentres(filter),
      (error) => {
        this.logger.warn(
          `[CircuitBreaker Fallback] getCentres bypassed: ${error?.message}. Returning empty list to use local centre database.`,
        );
        return [];
      },
    );
  }

  async getCentreCapacity(
    centreId: string,
    date: string,
  ): Promise<GovernmentCentreCapacityRecord> {
    return this.circuitBreaker.execute(
      'getCentreCapacity',
      () => this.underlyingProvider.getCentreCapacity(centreId, date),
      (error) => {
        this.logger.warn(
          `[CircuitBreaker Fallback] getCentreCapacity(${centreId}, ${date}) bypassed: ${error?.message}. Returning local capacity ceiling (500Q).`,
        );
        return {
          centreId,
          date,
          sanctionedDailyCapacityQuintals: 500,
          allocatedCapacityQuintals: 0,
          availableCapacityQuintals: 500,
          maxSimultaneousVehicles: 15,
        };
      },
    );
  }

  async getExistingBookings(centreId: string, date: string): Promise<GovernmentBookingRecord[]> {
    return this.circuitBreaker.execute(
      'getExistingBookings',
      () => this.underlyingProvider.getExistingBookings(centreId, date),
      (error) => {
        this.logger.warn(
          `[CircuitBreaker Fallback] getExistingBookings(${centreId}, ${date}) bypassed: ${error?.message}. Returning empty list.`,
        );
        return [];
      },
    );
  }

  async getProcurementStatus(
    bookingOrProcurementId: string,
  ): Promise<GovernmentProcurementStatusRecord> {
    return this.circuitBreaker.execute(
      'getProcurementStatus',
      () => this.underlyingProvider.getProcurementStatus(bookingOrProcurementId),
      (error) => {
        this.logger.warn(
          `[CircuitBreaker Fallback] getProcurementStatus(${bookingOrProcurementId}) bypassed: ${error?.message}.`,
        );
        return {
          procurementId: `PROC-OFFLINE-${bookingOrProcurementId.slice(-6)}`,
          externalBookingId: bookingOrProcurementId,
          farmerId: 'UNKNOWN_FARMER',
          centreId: 'UNKNOWN_CENTRE',
          commodityCode: 'WHEAT',
          netWeightQuintals: 0,
          qualityGrade: 'STANDARD',
          officialReceiptNumber: `RCP-OFFLINE-${bookingOrProcurementId.slice(-6)}`,
          completedAt: new Date().toISOString(),
        };
      },
    );
  }

  async submitProcurementUpdate(
    payload: ProcurementUpdatePayload,
  ): Promise<ProcurementUpdateResult> {
    return this.circuitBreaker.execute(
      'submitProcurementUpdate',
      () => this.underlyingProvider.submitProcurementUpdate(payload),
      (error) => {
        this.logger.warn(
          `[CircuitBreaker Fallback] submitProcurementUpdate(${payload.externalBookingId}) bypassed: ${error?.message}. Marking sync as queued offline per Section 21.`,
        );
        return {
          success: false,
          officialAcknowledgementId: `OFFLINE-ACK-${Date.now()}`,
          syncedAt: new Date().toISOString(),
          statusCode: 'OFFLINE_QUEUED',
          errorMessage: `CIRCUIT_BREAKER_OPEN: Government portal update queued offline (${error?.message || 'Upstream unavailable'})`,
        };
      },
    );
  }

  async getPaymentStatus(
    farmerId: string,
    procurementRecordId: string,
  ): Promise<GovernmentPaymentStatusRecord> {
    return this.circuitBreaker.execute(
      'getPaymentStatus',
      () => this.underlyingProvider.getPaymentStatus(farmerId, procurementRecordId),
      (error) => {
        this.logger.warn(
          `[CircuitBreaker Fallback] getPaymentStatus(${farmerId}, ${procurementRecordId}) bypassed: ${error?.message}.`,
        );
        return {
          paymentId: `PAY-OFFLINE-${procurementRecordId.slice(-6)}`,
          farmerId,
          officialReceiptNumber: `RCP-${procurementRecordId.slice(-6)}`,
          amountRupees: 0,
          status: 'PENDING',
        };
      },
    );
  }

  async syncStatus(centreId: string): Promise<GovernmentSyncStatusResult> {
    const metrics = this.circuitBreaker.getMetrics();
    if (metrics.state === CircuitBreakerState.OPEN) {
      return {
        centreId,
        lastSyncTimestamp: metrics.lastStateChangeAt.toISOString(),
        pendingRecordsCount: 0,
        isHealthy: false,
        lastError: `CIRCUIT_BREAKER_OPEN: ${metrics.lastTripReason || 'Upstream unavailable'}`,
      };
    }

    return this.circuitBreaker.execute(
      'syncStatus',
      () => this.underlyingProvider.syncStatus(centreId),
      (error) => {
        return {
          centreId,
          lastSyncTimestamp: new Date().toISOString(),
          pendingRecordsCount: 0,
          isHealthy: false,
          lastError: error?.message || 'CIRCUIT_BREAKER_OPEN',
        };
      },
    );
  }
}
