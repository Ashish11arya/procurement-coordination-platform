export interface GovernmentFarmerRecord {
  farmerId: string;
  registrationNumber: string;
  name: string;
  mobile: string;
  state: string;
  district: string;
  subDistrict: string;
  village: string;
  landAreaAcres: number;
  bankAccountVerified: boolean;
}

export interface FarmerEligibilityRecord {
  farmerId: string;
  commodityCode: string;
  sanctionedQuantityQuintals: number;
  alreadyProcuredQuantityQuintals: number;
  remainingEligibleQuantityQuintals: number;
  season: string;
  year: number;
  validUntil: string; // ISO Date string
  isEligible: boolean;
  rejectionReason?: string;
  isGovernmentVerified?: boolean;
  verificationStatus?: string;
}

export interface GovernmentCentreRecord {
  centreId: string;
  name: string;
  agencyName: string; // e.g. NAFED, FCI, State Agency
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  address: string;
  operatingSeason: string;
  supportedCommodities: string[];
  isActive: boolean;
}

export interface GovernmentCentreCapacityRecord {
  centreId: string;
  date: string; // YYYY-MM-DD
  sanctionedDailyCapacityQuintals: number;
  allocatedCapacityQuintals: number;
  availableCapacityQuintals: number;
  maxSimultaneousVehicles: number;
}

export interface GovernmentBookingRecord {
  externalBookingId: string;
  farmerId: string;
  centreId: string;
  commodityCode: string;
  quantityQuintals: number;
  scheduledDate: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
}

export interface GovernmentProcurementStatusRecord {
  procurementId: string;
  externalBookingId: string;
  farmerId: string;
  centreId: string;
  commodityCode: string;
  netWeightQuintals: number;
  qualityGrade: string;
  officialReceiptNumber: string;
  completedAt: string;
}

export interface ProcurementUpdatePayload {
  externalBookingId: string;
  farmerId: string;
  centreId: string;
  commodityCode: string;
  netWeightQuintals: number;
  moisturePercentage: number;
  foreignMatterPercentage: number;
  qualityGrade: 'GRADE_A' | 'STANDARD' | 'REJECTED';
  counterId: string;
  operatorUserId: string;
  timestamp: string;
}

export interface ProcurementUpdateResult {
  success: boolean;
  officialAcknowledgementId: string;
  syncedAt: string;
  statusCode: string;
  errorMessage?: string;
}

export interface GovernmentPaymentStatusRecord {
  paymentId: string;
  farmerId: string;
  officialReceiptNumber: string;
  amountRupees: number;
  status: 'PENDING' | 'INITIATED' | 'CREDITED' | 'FAILED';
  utrNumber?: string;
  disbursedAt?: string;
  failureReason?: string;
}

export interface GovernmentSyncStatusResult {
  centreId: string;
  lastSyncTimestamp: string;
  pendingRecordsCount: number;
  isHealthy: boolean;
  lastError?: string;
}

export interface CentreQueryFilter {
  state?: string;
  district?: string;
  commodityCode?: string;
  isActive?: boolean;
}

/**
 * Authoritative Government Data Provider Interface Contract (Section 3)
 * Isolates our coordination platform from direct external government API formats.
 */
export interface GovernmentDataProvider {
  readonly providerName: string;

  getFarmer(farmerIdOrMobile: string): Promise<GovernmentFarmerRecord | null>;
  getFarmerEligibility(farmerId: string, commodityCode: string): Promise<FarmerEligibilityRecord>;
  getCentres(filter?: CentreQueryFilter): Promise<GovernmentCentreRecord[]>;
  getCentreCapacity(centreId: string, date: string): Promise<GovernmentCentreCapacityRecord>;
  getExistingBookings(centreId: string, date: string): Promise<GovernmentBookingRecord[]>;
  getProcurementStatus(bookingOrProcurementId: string): Promise<GovernmentProcurementStatusRecord>;
  submitProcurementUpdate(payload: ProcurementUpdatePayload): Promise<ProcurementUpdateResult>;
  getPaymentStatus(farmerId: string, procurementRecordId: string): Promise<GovernmentPaymentStatusRecord>;
  syncStatus(centreId: string): Promise<GovernmentSyncStatusResult>;
}

export const GOVERNMENT_DATA_PROVIDER = 'GOVERNMENT_DATA_PROVIDER';
