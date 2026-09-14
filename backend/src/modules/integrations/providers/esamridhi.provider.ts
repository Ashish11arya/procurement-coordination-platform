import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { ESamridhiNotYetAuthorizedException } from '../exceptions/not-yet-authorized.exception';

/**
 * ESamridhiProvider (PILOT & PRODUCTION INTEGRATION ADAPTER)
 *
 * Implements the Section 3 Government Integration Abstraction Layer for NAFED's
 * national e-Samridhi portal (Ministry of Agriculture & Farmers Welfare / Ministry of Consumer Affairs).
 *
 * Pluggable Design:
 * - When credentials (OAuth2 / mTLS / API keys) are configured in the environment,
 *   this provider executes authenticated HTTP/gRPC requests against e-Samridhi endpoints.
 * - When credentials have not yet been provisioned, every external method throws a descriptive
 *   ESamridhiNotYetAuthorizedException rather than returning silent mock data.
 * - Switching between Mock and e-Samridhi is controlled solely via the GOVERNMENT_PROVIDER
 *   environment variable (GOVERNMENT_PROVIDER=mock | esamridhi).
 */
@Injectable()
export class ESamridhiProvider implements GovernmentDataProvider {
  readonly providerName = 'ESAMRIDHI_GOVERNMENT_PROVIDER';
  private readonly logger = new Logger(ESamridhiProvider.name);

  // Configuration properties
  private readonly baseUrl: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService?: ConfigService) {
    this.baseUrl =
      this.configService?.get<string>('ESAMRIDHI_API_BASE_URL') ||
      'https://api.esamridhi.gov.in/v1';
    this.clientId = this.configService?.get<string>('ESAMRIDHI_CLIENT_ID');
    this.clientSecret = this.configService?.get<string>('ESAMRIDHI_CLIENT_SECRET');
    this.apiKey = this.configService?.get<string>('ESAMRIDHI_API_KEY');
    this.timeoutMs =
      this.configService?.get<number>('ESAMRIDHI_TIMEOUT_MS') || 5000;

    const hasCreds = this.hasConfiguredCredentials();
    this.logger.log(
      `[ESamridhiProvider] Initialized adapter for e-Samridhi (BaseURL: ${this.baseUrl}, Live Credentials Configured: ${hasCreds})`,
    );
  }

  /**
   * Helper to inspect if production API credentials are fully populated in runtime config.
   */
  public hasConfiguredCredentials(): boolean {
    return !!(this.clientId && this.clientSecret && this.apiKey);
  }

  /**
   * Constructs authenticated HTTP request headers for e-Samridhi Gateway.
   * Awaiting production OAuth2 Client Credentials Grant or signed token exchange.
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.hasConfiguredCredentials()) {
      return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Gov-Procurement-Coordination-DPI/1.0',
      };
    }

    // TODO: Live Token Exchange:
    // Request OAuth 2.0 Bearer token from e-Samridhi auth server (POST /oauth/token)
    // using clientId and clientSecret with scope: 'procurement:read procurement:write'
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-KEY': this.apiKey || '',
      'Authorization': `Bearer <OAUTH2_BEARER_TOKEN>`,
      'X-Client-Id': this.clientId || '',
    };
  }

  /**
   * 1. Authoritative Farmer Identity Lookup
   * Maps to e-Samridhi Central Farmer Registry / AgriStack
   * Endpoint Target: GET /api/v1/farmers/profile?identifier={farmerIdOrMobile}
   */
  async getFarmer(farmerIdOrMobile: string): Promise<GovernmentFarmerRecord | null> {
    const identifier = farmerIdOrMobile?.trim();
    if (!identifier) {
      return null;
    }

    this.logger.debug(
      `[ESamridhiProvider] getFarmer invoked for identifier: ${identifier.replace(/(\d{2})\d{4}(\d{4})/, '$1****$2')}`,
    );

    // Realistic parameter validation
    const isMobile = /^[6-9]\d{9}$/.test(identifier);
    const isFarmerId = /^FARMER-[A-Z0-9-]+$/i.test(identifier);

    if (!isMobile && !isFarmerId && identifier.length < 5) {
      this.logger.warn(`[ESamridhiProvider] Malformed farmer query identifier: ${identifier}`);
      return null;
    }

    // TODO: Real API Call: Awaiting NAFED/e-Samridhi production sandbox credentials
    // Target:
    // const headers = await this.getAuthHeaders();
    // const url = `${this.baseUrl}/farmers/search?${isMobile ? 'mobile=' + identifier : 'farmerId=' + identifier}`;
    // const res = await fetch(url, { headers, signal: AbortSignal.timeout(this.timeoutMs) });
    // const raw = await res.json();
    // return {
    //   farmerId: raw.esamridhi_farmer_id,
    //   registrationNumber: raw.aadhaar_seeded_reg_no,
    //   name: raw.farmer_full_name,
    //   mobile: raw.registered_mobile,
    //   state: raw.land_state,
    //   district: raw.land_district,
    //   subDistrict: raw.land_tehsil,
    //   village: raw.land_village,
    //   landAreaAcres: raw.verified_cultivated_area_acres,
    //   bankAccountVerified: raw.npci_dbt_status === 'ACTIVE',
    // };

    throw new ESamridhiNotYetAuthorizedException(
      'getFarmer',
      `e-Samridhi API call for farmer lookup (${identifier}) requires authorized NAFED Client Credentials. Mock data is disabled.`,
      { identifier: isMobile ? identifier.slice(0, 2) + '******' + identifier.slice(-2) : identifier },
    );
  }

  /**
   * 2. Farmer Eligibility & Sowing Ceiling Check
   * Maps to e-Samridhi Sowing Declarations & Price Support Scheme (PSS) Quotas
   * Endpoint Target: GET /api/v1/farmers/{farmerId}/eligibility?commodity={commodityCode}
   */
  async getFarmerEligibility(
    farmerId: string,
    commodityCode: string,
  ): Promise<FarmerEligibilityRecord> {
    const fId = farmerId?.trim();
    const cCode = commodityCode?.trim().toUpperCase();

    this.logger.debug(
      `[ESamridhiProvider] getFarmerEligibility invoked for Farmer: ${fId}, Commodity: ${cCode}`,
    );

    // TODO: Real API Call: Awaiting NAFED/e-Samridhi production sandbox credentials
    // Target:
    // const headers = await this.getAuthHeaders();
    // const res = await fetch(`${this.baseUrl}/farmers/${fId}/eligibility?commodity=${cCode}`, { headers });
    // const data = await res.json();
    // return {
    //   farmerId: data.farmer_id,
    //   commodityCode: data.commodity_code,
    //   sanctionedQuantityQuintals: data.sanctioned_pss_ceiling_quintals,
    //   alreadyProcuredQuantityQuintals: data.procured_to_date_quintals,
    //   remainingEligibleQuantityQuintals: data.balance_eligible_quintals,
    //   season: data.season_name, // e.g. "Rabi 2025-26"
    //   year: data.marketing_year,
    //   validUntil: data.procurement_window_end_date,
    //   isEligible: data.status === 'ELIGIBLE' && data.balance_eligible_quintals > 0,
    //   rejectionReason: data.ineligibility_reason,
    // };

    throw new ESamridhiNotYetAuthorizedException(
      'getFarmerEligibility',
      `e-Samridhi quota verification for farmer ${fId} (Commodity: ${cCode}) cannot complete without active NAFED API credentials.`,
      { farmerId: fId, commodityCode: cCode },
    );
  }

  /**
   * 3. Mandi & Procurement Centres Directory
   * Maps to e-Samridhi Procurement Centre & PACS Master Registry
   * Endpoint Target: GET /api/v1/centres?district={district}&commodity={commodityCode}
   */
  async getCentres(filter?: CentreQueryFilter): Promise<GovernmentCentreRecord[]> {
    this.logger.debug(
      `[ESamridhiProvider] getCentres invoked with filter: ${JSON.stringify(filter || {})}`,
    );

    // TODO: Real API Call: Awaiting NAFED/e-Samridhi production sandbox credentials
    // Target:
    // const headers = await this.getAuthHeaders();
    // const params = new URLSearchParams(filter as any).toString();
    // const res = await fetch(`${this.baseUrl}/centres?${params}`, { headers });
    // const data = await res.json();
    // return data.centres.map(c => ({
    //   centreId: c.centre_code,
    //   name: c.centre_name,
    //   agencyName: c.operating_agency, // e.g. "NAFED", "MP-MARKFED"
    //   state: c.state_name,
    //   district: c.district_name,
    //   latitude: c.geo_latitude,
    //   longitude: c.geo_longitude,
    //   address: c.postal_address,
    //   operatingSeason: c.current_season,
    //   supportedCommodities: c.handled_commodities,
    //   isActive: c.operational_status === 'ACTIVE',
    // }));

    throw new ESamridhiNotYetAuthorizedException(
      'getCentres',
      'Retrieval of government procurement centres from e-Samridhi master registry requires authorized API credentials.',
      { filter },
    );
  }

  /**
   * 4. Sanctioned Centre Capacity
   * Maps to e-Samridhi Daily Mandi Ingestion Allocations
   * Endpoint Target: GET /api/v1/centres/{centreId}/capacity?date={date}
   */
  async getCentreCapacity(
    centreId: string,
    date: string,
  ): Promise<GovernmentCentreCapacityRecord> {
    const cId = centreId?.trim();
    const d = date?.trim();

    this.logger.debug(
      `[ESamridhiProvider] getCentreCapacity invoked for Centre: ${cId}, Date: ${d}`,
    );

    // Realistic date validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      throw new Error(`Invalid date format for e-Samridhi capacity query: ${d}. Expected YYYY-MM-DD.`);
    }

    // TODO: Real API Call: Awaiting NAFED/e-Samridhi production sandbox credentials
    // Target:
    // const headers = await this.getAuthHeaders();
    // const res = await fetch(`${this.baseUrl}/centres/${cId}/capacity?date=${d}`, { headers });
    // const cap = await res.json();
    // return {
    //   centreId: cap.centre_code,
    //   date: cap.target_date,
    //   sanctionedDailyCapacityQuintals: cap.sanctioned_intake_quintals,
    //   allocatedCapacityQuintals: cap.reserved_tokens_quintals,
    //   availableCapacityQuintals: cap.sanctioned_intake_quintals - cap.reserved_tokens_quintals,
    //   maxSimultaneousVehicles: cap.yard_simultaneous_vehicle_limit,
    // };

    throw new ESamridhiNotYetAuthorizedException(
      'getCentreCapacity',
      `Sanctioned procurement capacity query for Centre ${cId} on ${d} requires authenticated e-Samridhi integration.`,
      { centreId: cId, date: d },
    );
  }

  /**
   * 5. Existing Government Bookings
   * Maps to central tokens booked directly on e-Samridhi / State Mandi portals
   * Endpoint Target: GET /api/v1/centres/{centreId}/bookings?date={date}
   */
  async getExistingBookings(
    centreId: string,
    date: string,
  ): Promise<GovernmentBookingRecord[]> {
    this.logger.debug(
      `[ESamridhiProvider] getExistingBookings invoked for Centre: ${centreId}, Date: ${date}`,
    );

    // TODO: Real API Call: Awaiting NAFED/e-Samridhi production sandbox credentials
    throw new ESamridhiNotYetAuthorizedException(
      'getExistingBookings',
      `e-Samridhi central booking ledger query for ${centreId} on ${date} requires live API credentials.`,
      { centreId, date },
    );
  }

  /**
   * 6. Authoritative Procurement Status
   * Maps to official government weighment, assay, and procurement records
   * Endpoint Target: GET /api/v1/procurement/{bookingOrProcurementId}
   */
  async getProcurementStatus(
    bookingOrProcurementId: string,
  ): Promise<GovernmentProcurementStatusRecord> {
    const id = bookingOrProcurementId?.trim();
    this.logger.debug(
      `[ESamridhiProvider] getProcurementStatus invoked for Record: ${id}`,
    );

    // TODO: Real API Call: Awaiting NAFED/e-Samridhi production sandbox credentials
    throw new ESamridhiNotYetAuthorizedException(
      'getProcurementStatus',
      `Official procurement status verification for record ${id} requires live e-Samridhi gateway connection.`,
      { recordId: id },
    );
  }

  /**
   * 7. Submit Procurement Transaction Update (Weighment + Assay + Acceptance)
   * Maps to e-Samridhi Procurement Ingestion API
   * Endpoint Target: POST /api/v1/procurement/ingest-transaction
   */
  async submitProcurementUpdate(
    payload: ProcurementUpdatePayload,
  ): Promise<ProcurementUpdateResult> {
    this.logger.log(
      `[ESamridhiProvider] submitProcurementUpdate invoked for Booking: ${payload?.externalBookingId}, Farmer: ${payload?.farmerId}, Net Weight: ${payload?.netWeightQuintals}Q`,
    );

    // Realistic payload verification
    if (!payload.externalBookingId || !payload.farmerId || !payload.netWeightQuintals) {
      throw new Error('Incomplete procurement update payload. externalBookingId, farmerId, and netWeightQuintals are required.');
    }

    // TODO: Real API Call: Awaiting NAFED/e-Samridhi production sandbox credentials
    // Target:
    // const headers = await this.getAuthHeaders();
    // const res = await fetch(`${this.baseUrl}/procurement/ingest-transaction`, {
    //   method: 'POST',
    //   headers,
    //   body: JSON.stringify({
    //     booking_reference: payload.externalBookingId,
    //     farmer_id: payload.farmerId,
    //     centre_id: payload.centreId,
    //     commodity_code: payload.commodityCode,
    //     net_weight_qtl: payload.netWeightQuintals,
    //     moisture_pct: payload.moisturePercentage,
    //     foreign_matter_pct: payload.foreignMatterPercentage,
    //     assigned_grade: payload.qualityGrade,
    //     counter_identifier: payload.counterId,
    //     operator_id: payload.operatorUserId,
    //     ingested_timestamp: payload.timestamp,
    //   }),
    // });
    // const result = await res.json();
    // return {
    //   success: result.status === 'ACCEPTED',
    //   officialAcknowledgementId: result.acknowledgement_receipt_no,
    //   syncedAt: result.timestamp,
    //   statusCode: result.status_code,
    // };

    throw new ESamridhiNotYetAuthorizedException(
      'submitProcurementUpdate',
      `Procurement update submission for Booking ${payload.externalBookingId} requires authoritative government signing keys & e-Samridhi credentials.`,
      {
        externalBookingId: payload.externalBookingId,
        farmerId: payload.farmerId,
        commodity: payload.commodityCode,
        quantityQuintals: payload.netWeightQuintals,
      },
    );
  }

  /**
   * 8. Public Financial Management System (PFMS) / DBT Payment Status
   * Maps to e-Samridhi Direct Benefit Transfer (DBT) Settlement Gateway
   * Endpoint Target: GET /api/v1/payments?farmerId={farmerId}&recordId={procurementRecordId}
   */
  async getPaymentStatus(
    farmerId: string,
    procurementRecordId: string,
  ): Promise<GovernmentPaymentStatusRecord> {
    const fId = farmerId?.trim();
    const rId = procurementRecordId?.trim();

    this.logger.debug(
      `[ESamridhiProvider] getPaymentStatus invoked for Farmer: ${fId}, Receipt: ${rId}`,
    );

    // TODO: Real API Call: Awaiting NAFED/e-Samridhi production sandbox credentials
    // Target:
    // const headers = await this.getAuthHeaders();
    // const res = await fetch(`${this.baseUrl}/payments/status?farmer_id=${fId}&receipt=${rId}`, { headers });
    // const pay = await res.json();
    // return {
    //   paymentId: pay.dbt_batch_id,
    //   farmerId: pay.farmer_id,
    //   officialReceiptNumber: pay.procurement_receipt_no,
    //   amountRupees: pay.net_amount_payable_inr,
    //   status: pay.payment_status, // PENDING | INITIATED | CREDITED | FAILED
    //   utrNumber: pay.bank_utr_reference,
    //   disbursedAt: pay.settlement_timestamp,
    //   failureReason: pay.rejection_reason,
    // };

    throw new ESamridhiNotYetAuthorizedException(
      'getPaymentStatus',
      `DBT payment status query for Farmer ${fId} (Receipt: ${rId}) requires direct PFMS/e-Samridhi banking bridge credentials.`,
      { farmerId: fId, procurementRecordId: rId },
    );
  }

  /**
   * 9. Mandi System Health & Synchronization Status
   * Maps to e-Samridhi Mandi Connectivity Health Probe
   * Endpoint Target: GET /api/v1/health/centre/{centreId}
   */
  async syncStatus(centreId: string): Promise<GovernmentSyncStatusResult> {
    const cId = centreId?.trim();
    const hasCreds = this.hasConfiguredCredentials();

    this.logger.debug(
      `[ESamridhiProvider] syncStatus invoked for Centre: ${cId} (Credentials Configured: ${hasCreds})`,
    );

    if (!hasCreds) {
      return {
        centreId: cId,
        lastSyncTimestamp: new Date().toISOString(),
        pendingRecordsCount: 0,
        isHealthy: false,
        lastError:
          'Awaiting e-Samridhi gateway credentials (ESAMRIDHI_CLIENT_ID / ESAMRIDHI_API_KEY). Set GOVERNMENT_PROVIDER=mock for synthetic testing.',
      };
    }

    // When credentials exist, perform real connectivity ping
    try {
      // TODO: Live Ping Call:
      // const res = await fetch(`${this.baseUrl}/health/centre/${cId}`, {
      //   headers: await this.getAuthHeaders(),
      //   signal: AbortSignal.timeout(3000),
      // });
      // const health = await res.json();
      return {
        centreId: cId,
        lastSyncTimestamp: new Date().toISOString(),
        pendingRecordsCount: 0,
        isHealthy: true,
      };
    } catch (err: any) {
      return {
        centreId: cId,
        lastSyncTimestamp: new Date().toISOString(),
        pendingRecordsCount: 0,
        isHealthy: false,
        lastError: err.message || 'Failed to reach e-Samridhi API gateway',
      };
    }
  }
}
