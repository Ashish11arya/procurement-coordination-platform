# Authoritative Government API Contract Specification

> [!IMPORTANT]
> **Production Integration Notice (Section 39)**
> Real government production endpoints (e-Samridhi, Central Food Procurement Portal - CFPP, and State Procurement Portals) will be configured and activated **only after official API documentation, gateway certificates, and production credentials are formally issued by the designated nodal government agencies**.
> During prototype and local testing phases, the platform runs against the authoritative `MockGovernmentProvider` implementing this identical contract with realistic synthetic agricultural data.

---

## 1. Contract Overview

The platform acts as a real-time coordination and scheduling layer that works **with** existing government procurement portals, not in place of them. The `GovernmentDataProvider` interface encapsulates all interactions across eligibility verification, master centre quotas, and official procurement records.

```
+-----------------------------------------------------------------------+
|              Coordination Platform (NestJS Backend)                   |
+-----------------------------------+-----------------------------------+
                                    |
                    implements GovernmentDataProvider
                                    |
       +----------------------------+----------------------------+
       |                                                         |
[PROTOTYPE / DEMO]                                         [PRODUCTION]
MockGovernmentProvider                                     Authoritative Government Adapters
- Realistic synthetic farmers                              - e-Samridhi Adapter (NAFED)
- Sanctioned district quotas                               - CFPP Portal Adapter (DFPD/FCI)
- Offline fallback simulator                               - State Portal Adapters (e-Uparjan, etc.)
```

---

## 2. Core API Methods

### 2.1 `getFarmer(farmerIdOrMobile: string)`
Retrieves authoritative government identity, registration number, village, and bank verification status.
- **Input**: Farmer ID or registered 10-digit mobile number.
- **Returns**: `GovernmentFarmerRecord | null`
- **Output Schema**:
  ```typescript
  interface GovernmentFarmerRecord {
    farmerId: string;              // e.g. "FARMER-MP-IND-001"
    registrationNumber: string;    // e.g. "REG-2026-MP-00192"
    name: string;
    mobile: string;
    state: string;
    district: string;
    subDistrict: string;
    village: string;
    landAreaAcres: number;
    bankAccountVerified: boolean;
  }
  ```

### 2.2 `getFarmerEligibility(farmerId: string, commodityCode: string)`
Validates that the farmer has official government quota remaining for the specified crop season.
- **Input**: `farmerId: string`, `commodityCode: string`
- **Returns**: `FarmerEligibilityRecord`
- **Output Schema**:
  ```typescript
  interface FarmerEligibilityRecord {
    farmerId: string;
    commodityCode: string;
    isEligible: boolean;
    sanctionedQuantityQuintals: number;
    alreadyProcuredQuantityQuintals: number;
    remainingEligibleQuantityQuintals: number;
    season: 'KHARIF' | 'RABI' | 'ZAID';
    year: number;
    validUntil: string;
  }
  ```

### 2.3 `getCentres(filter: CentreQueryFilter)`
Lists all registered, active government procurement centres matching geographical or commodity criteria.
- **Input**: `{ state?: string; district?: string; commodityCode?: string }`
- **Returns**: `GovernmentCentreRecord[]`

### 2.4 `getCentreCapacity(centreId: string, date: string)`
Fetches the official government daily sanctioned procurement capacity limit for a specific centre and calendar date.
- **Input**: `centreId: string`, `date: string` (YYYY-MM-DD)
- **Returns**:
  ```typescript
  interface GovernmentCentreCapacityRecord {
    centreId: string;
    date: string;
    sanctionedDailyCapacityQuintals: number;
    allocatedCapacityQuintals: number;
    availableCapacityQuintals: number;
    maxSimultaneousVehicles: number;
  }
  ```

### 2.5 `submitProcurementUpdate(payload: ProcurementUpdatePayload)`
Submits the ground-level physical procurement completion record to the official central government registry upon completion of weighing and assaying.
- **Input Payload**:
  ```typescript
  interface ProcurementUpdatePayload {
    externalBookingId: string;
    centreId: string;
    farmerId: string;
    commodityCode: string;
    netWeightQuintals: number;
    moisturePercentage: number;
    foreignMatterPercentage: number;
    qualityGrade: 'GRADE_A' | 'STANDARD' | 'BELOW_FAQ';
    counterId: string;
    operatorUserId: string;
    timestamp: string;
  }
  ```
- **Returns**:
  ```typescript
  interface ProcurementUpdateResult {
    success: boolean;
    officialAcknowledgementId?: string; // e.g. "CFPP-ACK-2026-98124"
    status: 'RECORDED' | 'REJECTED' | 'DUPLICATE';
    errorMessage?: string;
  }
  ```

### 2.6 `getPaymentStatus(farmerId: string, bookingOrProcurementId: string)`
Queries official Direct Benefit Transfer (DBT) / Public Financial Management System (PFMS) payout status.
- **Returns**:
  ```typescript
  interface GovernmentPaymentStatusRecord {
    paymentReferenceId: string;
    status: 'PROCESSING' | 'CREDITED' | 'FAILED' | 'ON_HOLD';
    amountPaid: number;
    transactionTimestamp?: string;
    utrNumber?: string;
  }
  ```

### 2.7 `syncStatus()`
Pings the remote government gateway to ascertain connectivity, round-trip latency, and scheduled maintenance windows.
- **Returns**:
  ```typescript
  interface GovernmentSyncStatusResult {
    gatewayStatus: 'ONLINE' | 'DEGRADED' | 'MAINTENANCE' | 'OFFLINE';
    latencyMs: number;
    lastSuccessfulSync: string;
    pendingSyncCount: number;
  }
  ```

---

## 3. Provider Pluggability Rule (Section 3 & 35)

The application domain services (`BookingsService`, `OperationsService`, `CommandCentreService`) interact **strictly** through the `GovernmentDataProvider` token. Neither business logic nor controllers contain direct HTTP calls to proprietary third-party portals, ensuring that swapping from `MockGovernmentProvider` to a live production gateway requires zero edits to scheduling or queue engines.
