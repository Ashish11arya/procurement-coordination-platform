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

/**
 * MockGovernmentProvider (PROTOTYPE / DEMO ENVIRONMENT)
 * Clearly marked as synthetic / mock data implementation per Section 3 & Section 35 of the Specification.
 * Simulates authoritative responses from e-Samridhi / CFPP / State Portals.
 */
@Injectable()
export class MockGovernmentProvider implements GovernmentDataProvider {
  readonly providerName = 'MOCK_GOVERNMENT_PROVIDER';
  private readonly logger = new Logger(MockGovernmentProvider.name);

  // Realistic synthetic farmers database (in-memory store for mock operations)
  private readonly syntheticFarmers: Map<string, GovernmentFarmerRecord> = new Map([
    [
      '9876543210',
      {
        farmerId: 'FARMER-MP-IND-001',
        registrationNumber: 'REG-2026-MP-00192',
        name: 'Ramesh Kumar Verma',
        mobile: '9876543210',
        state: 'Madhya Pradesh',
        district: 'Indore',
        subDistrict: 'Sanwer',
        village: 'Dharampuri',
        landAreaAcres: 5.5,
        bankAccountVerified: true,
      },
    ],
    [
      '9811223344',
      {
        farmerId: 'FARMER-MP-UJJ-002',
        registrationNumber: 'REG-2026-MP-00843',
        name: 'Suresh Patel',
        mobile: '9811223344',
        state: 'Madhya Pradesh',
        district: 'Ujjain',
        subDistrict: 'Tarana',
        village: 'Kalyanpura',
        landAreaAcres: 8.2,
        bankAccountVerified: true,
      },
    ],
    [
      '9123456780',
      {
        farmerId: 'FARMER-MP-SEH-003',
        registrationNumber: 'REG-2026-MP-00511',
        name: 'Anita Devi Sharma',
        mobile: '9123456780',
        state: 'Madhya Pradesh',
        district: 'Sehore',
        subDistrict: 'Ashta',
        village: 'Brijisnagar',
        landAreaAcres: 3.0,
        bankAccountVerified: true,
      },
    ],
  ]);

  // Synthetic procurement centres
  private readonly syntheticCentres: GovernmentCentreRecord[] = [
    {
      centreId: 'CENTRE-MP-IND-01',
      name: 'Sanwer Krishi Upaj Mandi Procurement Centre',
      agencyName: 'MP State Civil Supplies Corporation / NAFED',
      state: 'Madhya Pradesh',
      district: 'Indore',
      latitude: 22.9774,
      longitude: 75.8236,
      address: 'Mandi Yard, Sanwer Road, Indore, MP 453551',
      operatingSeason: 'RABI_2026',
      supportedCommodities: ['WHEAT', 'CHANA', 'MUSTARD'],
      isActive: true,
    },
    {
      centreId: 'CENTRE-MP-UJJ-02',
      name: 'Ujjain Primary Co-op Society Centre',
      agencyName: 'NAFED / Co-operative Federation',
      state: 'Madhya Pradesh',
      district: 'Ujjain',
      latitude: 23.1765,
      longitude: 75.7885,
      address: 'Near Old Bus Stand, Ujjain, MP 456001',
      operatingSeason: 'RABI_2026',
      supportedCommodities: ['WHEAT', 'CHANA'],
      isActive: true,
    },
    {
      centreId: 'CENTRE-MP-SEH-03',
      name: 'Ashta Grain Procurement Sub-Centre',
      agencyName: 'State Food Corporation',
      state: 'Madhya Pradesh',
      district: 'Sehore',
      latitude: 23.0183,
      longitude: 76.5412,
      address: 'Warehouse Complex, Ashta Bypass, MP 466116',
      operatingSeason: 'RABI_2026',
      supportedCommodities: ['WHEAT', 'GRAM'],
      isActive: true,
    },
  ];

  constructor() {
    this.logger.log('MockGovernmentProvider initialized with synthetic data.');
  }

  async getFarmer(farmerIdOrMobile: string): Promise<GovernmentFarmerRecord | null> {
    this.logger.debug(`[MOCK_GOV] getFarmer called with: ${farmerIdOrMobile}`);
    // Check by mobile
    if (this.syntheticFarmers.has(farmerIdOrMobile)) {
      return this.syntheticFarmers.get(farmerIdOrMobile)!;
    }
    // Check by farmerId
    for (const farmer of this.syntheticFarmers.values()) {
      if (farmer.farmerId === farmerIdOrMobile) {
        return farmer;
      }
    }
    // If phone number is valid 10-digit, dynamically synthesize for frictionless demo
    if (/^[6-9]\d{9}$/.test(farmerIdOrMobile)) {
      const syntheticFarmer: GovernmentFarmerRecord = {
        farmerId: `FARMER-SYNTH-${farmerIdOrMobile.slice(-4)}`,
        registrationNumber: `REG-2026-DEMO-${farmerIdOrMobile.slice(-5)}`,
        name: `Farmer ${farmerIdOrMobile.slice(-4)}`,
        mobile: farmerIdOrMobile,
        state: 'Madhya Pradesh',
        district: 'Indore',
        subDistrict: 'Sanwer',
        village: 'Demo Village',
        landAreaAcres: 4.0,
        bankAccountVerified: true,
      };
      this.syntheticFarmers.set(farmerIdOrMobile, syntheticFarmer);
      return syntheticFarmer;
    }
    return null;
  }

  async getFarmerEligibility(
    farmerId: string,
    commodityCode: string,
  ): Promise<FarmerEligibilityRecord> {
    this.logger.debug(
      `[MOCK_GOV] getFarmerEligibility called for farmer: ${farmerId}, commodity: ${commodityCode}`,
    );
    return {
      farmerId,
      commodityCode: commodityCode.toUpperCase(),
      sanctionedQuantityQuintals: 100,
      alreadyProcuredQuantityQuintals: 15,
      remainingEligibleQuantityQuintals: 85,
      season: 'RABI',
      year: 2026,
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      isEligible: true,
    };
  }

  async getCentres(filter?: CentreQueryFilter): Promise<GovernmentCentreRecord[]> {
    this.logger.debug(`[MOCK_GOV] getCentres called with filter: ${JSON.stringify(filter || {})}`);
    return this.syntheticCentres.filter((centre) => {
      if (filter?.state && centre.state.toLowerCase() !== filter.state.toLowerCase()) return false;
      if (filter?.district && centre.district.toLowerCase() !== filter.district.toLowerCase())
        return false;
      if (filter?.commodityCode && !centre.supportedCommodities.includes(filter.commodityCode))
        return false;
      if (filter?.isActive !== undefined && centre.isActive !== filter.isActive) return false;
      return true;
    });
  }

  async getCentreCapacity(centreId: string, date: string): Promise<GovernmentCentreCapacityRecord> {
    this.logger.debug(
      `[MOCK_GOV] getCentreCapacity called for centre: ${centreId}, date: ${date}`,
    );
    return {
      centreId,
      date,
      sanctionedDailyCapacityQuintals: 500,
      allocatedCapacityQuintals: 180,
      availableCapacityQuintals: 320,
      maxSimultaneousVehicles: 15,
    };
  }

  async getExistingBookings(centreId: string, date: string): Promise<GovernmentBookingRecord[]> {
    this.logger.debug(
      `[MOCK_GOV] getExistingBookings called for centre: ${centreId}, date: ${date}`,
    );
    return [];
  }

  async getProcurementStatus(
    bookingOrProcurementId: string,
  ): Promise<GovernmentProcurementStatusRecord> {
    this.logger.debug(
      `[MOCK_GOV] getProcurementStatus called for: ${bookingOrProcurementId}`,
    );
    return {
      procurementId: `PROC-MOCK-${bookingOrProcurementId}`,
      externalBookingId: bookingOrProcurementId,
      farmerId: 'FARMER-MP-IND-001',
      centreId: 'CENTRE-MP-IND-01',
      commodityCode: 'WHEAT',
      netWeightQuintals: 45.5,
      qualityGrade: 'GRADE_A',
      officialReceiptNumber: `REC-${Date.now()}`,
      completedAt: new Date().toISOString(),
    };
  }

  async submitProcurementUpdate(payload: ProcurementUpdatePayload): Promise<ProcurementUpdateResult> {
    this.logger.debug(
      `[MOCK_GOV] submitProcurementUpdate received for booking: ${payload.externalBookingId}`,
    );
    return {
      success: true,
      officialAcknowledgementId: `GOV-ACK-${Date.now()}`,
      syncedAt: new Date().toISOString(),
      statusCode: '200_OK',
    };
  }

  async getPaymentStatus(
    farmerId: string,
    procurementRecordId: string,
  ): Promise<GovernmentPaymentStatusRecord> {
    this.logger.debug(
      `[MOCK_GOV] getPaymentStatus for farmer: ${farmerId}, record: ${procurementRecordId}`,
    );
    return {
      paymentId: `PAY-MOCK-${farmerId.slice(-4)}-${Date.now()}`,
      farmerId,
      officialReceiptNumber: `REC-${procurementRecordId}`,
      amountRupees: 103500, // 45 Quintals * ~2300 MSP
      status: 'INITIATED',
      utrNumber: `SBIN${Date.now().toString().slice(-8)}`,
      disbursedAt: new Date().toISOString(),
    };
  }

  async syncStatus(centreId: string): Promise<GovernmentSyncStatusResult> {
    this.logger.debug(`[MOCK_GOV] syncStatus called for centre: ${centreId}`);
    return {
      centreId,
      lastSyncTimestamp: new Date().toISOString(),
      pendingRecordsCount: 0,
      isHealthy: true,
    };
  }
}
