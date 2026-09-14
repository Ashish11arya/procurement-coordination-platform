# e-Samridhi Government Integration & Data Mapping Specification

## 1. Executive Summary & Statutory Framework

This document defines the complete technical data mapping between our **National Minimum Support Price (MSP) Real-Time Procurement Coordination Platform** and the central **e-Samridhi portal** operated by **NAFED** (National Agricultural Cooperative Marketing Federation of India) under the aegis of the **Ministry of Agriculture & Farmers Welfare (MoAFW)** and the **Ministry of Consumer Affairs, Food & Public Distribution**, Government of India.

The e-Samridhi platform is India's authoritative digital registry for farmers cultivating pulses (Tur/Arhar, Urad, Masoor, Chana) and oilseeds (Mustard, Groundnut, Soybean) eligible for procurement under the:
1. **Price Support Scheme (PSS)**
2. **Price Stabilisation Fund (PSF)**
3. **Pradhan Mantri Annadata Aay Sanraksan Abhiyan (PM-AASHA)**

Our platform sits as a **coordination and operational optimization layer** between the farmer, the physical Mandi yard/PACS, and the central e-Samridhi ledger.

---

## 2. The Real-World Farmer Journey on e-Samridhi

The integration reflects the real-world operational workflow established across Indian states (such as Madhya Pradesh e-Uparjan, Maharashtra e-Kharid, and Haryana Meri Fasal Mera Byora federating into e-Samridhi):

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                             AUTHORITATIVE GOVERNMENT SYSTEMS                                │
│          e-Samridhi (NAFED)  •  State Bhulekh / AgriStack  •  PFMS / NPCI DBT               │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
             ┌─────────────────────────────────┴─────────────────────────────────┐
             │                                                                   │
             ▼                                                                   ▼
┌─────────────────────────┐                                           ┌───────────────────────┐
│ Phase 1: Registration   │                                           │ Phase 2: Sowing & Quota│
│ • Aadhaar e-KYC         │                                           │ • Crop area (Hectares)│
│ • Bank NPCI DBT link    │                                           │ • Sanctioned PSS cap  │
│ • Khasra land seeding   │                                           │ • Sowing verification │
└────────────┬────────────┘                                           └───────────┬───────────┘
             │                                                                    │
             └─────────────────────────────────┬──────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          OUR PROCUREMENT COORDINATION PLATFORM                              │
│                                (Section 3 & 4 Architecture)                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Phase 3: Arrival Scheduling & Token Issuance                                                │
│ • Queries e-Samridhi for remaining quota & sanctioned daily mandi intake                    │
│ • Assigns 2-hour arrival window (e.g. 10:00 - 12:00) based on vehicle class & road travel   │
│ • Real-time traffic & yard capacity balancing to eliminate 8-hour mandi tractor queues      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Phase 4: Mandi Gate & Electronic Weighment                                                  │
│ • QR/Token gate entry & driver license validation                                           │
│ • Automated Gross & Tare weighment capture from digital weighbridge scales                   │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Phase 5: Quality Assay & Fair Average Quality (FAQ) Grading                                 │
│ • Digital moisture meter reading (e.g. Wheat max 12%, Mustard max 9%)                       │
│ • Foreign matter & damaged grains inspection                                                │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                               BACK TO CENTRAL GOVERNMENT                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Phase 6: Procurement Transaction Submission (submitProcurementUpdate)                       │
│ • Mandi submits official weighment slip, quality assay, and operator digital certificate    │
│ • e-Samridhi creates immutable official procurement voucher (J-Form / Procurement Receipt)  │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Phase 7: Direct Benefit Transfer (DBT) Settlement                                           │
│ • Government generates DBT payment batch via PFMS directly to farmer Aadhaar-linked account │
│ • Target turnaround: 48-72 hours without intermediaries                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Source of Truth Matrix (Section 4 Compliance)

Strict adherence to Section 4 of `PROJECT_SPEC.md` ensures that our coordination platform never overwrites government-authoritative data:

| Data Domain | Authoritative Master | Our Platform Responsibility |
| :--- | :--- | :--- |
| **Farmer Identity & KYC** | e-Samridhi / AgriStack / UIDAI | Read-only cache; local profile preferences (language, notifications) |
| **Landholding & Sown Area** | State Bhulekh / Land Records Registry | Read-only validation of acreage |
| **Sanctioned Procurement Cap** | e-Samridhi PSS Quota Engine | Read-only ceiling check; prevents over-booking |
| **Mandi Arrival Scheduling** | **Our Platform (Coordination Engine)** | Computes arrival windows, queue sequence, ETAs, and counter allocation |
| **Live Yard & Queue State** | **Our Platform (Realtime Engine)** | Ephemeral live state; WebSocket events, vehicle positions, delays |
| **Official Weighment & Receipt** | e-Samridhi Central Procurement Ledger | Collects electronic scale telemetry; submits transaction update |
| **MSP Disbursement & Payment** | PFMS / NPCI Aadhaar Payment Bridge | Read-only transaction status tracking (UTR, credit date, failure codes) |

---

## 4. Exhaustive Method-by-Method Data Mapping

The `GovernmentDataProvider` interface exposes 9 contract methods. The tables below map each method to the corresponding e-Samridhi REST/gRPC endpoints and schema models:

---

### Method 1: `getFarmer(farmerIdOrMobile: string)`
- **e-Samridhi API Target:** `GET /api/v1/farmers/search`
- **Query Parameters:** `mobile={mobile}` OR `farmer_id={farmerId}`
- **Purpose:** Verifies farmer identity and retrieves authoritative land records and DBT bank status.

| Platform Interface Field (`GovernmentFarmerRecord`) | e-Samridhi Field Name | Data Type | Transformation / Business Rule |
| :--- | :--- | :--- | :--- |
| `farmerId` | `data.esamridhi_farmer_id` | String | e.g. `FMR-MP-IND-2026-00192` |
| `registrationNumber` | `data.reg_number_aadhaar_seed` | String | Official state registration or AgriStack reference |
| `name` | `data.farmer_name` | String | Full name as verified against Land Records / Aadhaar |
| `mobile` | `data.primary_mobile` | String | 10-digit Indian mobile number (`^[6-9]\d{9}$`) |
| `state` | `data.residential_state` | String | Standardized state name |
| `district` | `data.residential_district` | String | District administrative unit |
| `subDistrict` | `data.residential_tehsil` | String | Tehsil / Taluka administrative division |
| `village` | `data.residential_village` | String | Revenue village name |
| `landAreaAcres` | `data.verified_cultivable_acres` | Number | Total verified arable acreage |
| `bankAccountVerified` | `data.npci_dbt_status` | Boolean | `true` if `npci_dbt_status === 'VERIFIED_ACTIVE'` |

---

### Method 2: `getFarmerEligibility(farmerId: string, commodityCode: string)`
- **e-Samridhi API Target:** `GET /api/v1/farmers/{farmerId}/eligibility`
- **Query Parameters:** `commodity={commodityCode}&marketing_season=CURRENT`
- **Purpose:** Validates that the farmer has active sown acreage for the commodity and calculates remaining quota under Price Support Scheme (PSS) yield norms.

| Platform Interface Field (`FarmerEligibilityRecord`) | e-Samridhi Field Name | Data Type | Transformation / Business Rule |
| :--- | :--- | :--- | :--- |
| `farmerId` | `data.farmer_id` | String | Authoritative farmer identifier |
| `commodityCode` | `data.commodity_code` | String | `WHEAT`, `MUSTARD`, `GRAM`, `TUR`, `URAD`, `SOYABEAN` |
| `sanctionedQuantityQuintals` | `data.pss_sanctioned_ceiling_qtl` | Number | Notified productivity norm × verified sown hectares |
| `alreadyProcuredQuantityQuintals`| `data.procured_to_date_qtl` | Number | Cumulative procurement across all centres this season |
| `remainingEligibleQuantityQuintals`| `data.balance_eligible_qtl` | Number | `sanctionedQuantityQuintals - alreadyProcuredQuantityQuintals` |
| `season` | `data.season_identifier` | String | e.g. `RABI_2025_26` |
| `year` | `data.marketing_year` | Number | e.g. `2026` |
| `validUntil` | `data.procurement_end_date` | String | ISO 8601 Date string (mandi closing deadline) |
| `isEligible` | `data.eligibility_status` | Boolean | `true` if status is `ELIGIBLE` and `balance > 0` |
| `rejectionReason` | `data.ineligibility_remarks` | String (Opt) | Human-readable explanation if quota is exhausted |

---

### Method 3: `getCentres(filter?: CentreQueryFilter)`
- **e-Samridhi API Target:** `GET /api/v1/centres`
- **Query Parameters:** `state={state}&district={district}&commodity={commodityCode}&active_only=true`
- **Purpose:** Retrieves official list of active NAFED, FCI, and State Agency procurement centres and PACS branches.

| Platform Interface Field (`GovernmentCentreRecord`) | e-Samridhi Field Name | Data Type | Transformation / Business Rule |
| :--- | :--- | :--- | :--- |
| `centreId` | `data[].centre_code` | String | Authoritative centre code (e.g. `CENTRE-MP-IND-01`) |
| `name` | `data[].centre_name` | String | e.g. `Sanwer Krishi Upaj Mandi` |
| `agencyName` | `data[].procurement_agency` | String | `NAFED`, `FCI`, `MP-MARKFED`, `HAFED` |
| `state` | `data[].state_name` | String | Mandi location state |
| `district` | `data[].district_name` | String | Mandi location district |
| `latitude` | `data[].coordinates.latitude` | Number | Geo-coordinates for ETA and distance calculations |
| `longitude` | `data[].coordinates.longitude`| Number | Geo-coordinates for ETA and distance calculations |
| `address` | `data[].full_postal_address` | String | Physical address for farmer directions |
| `operatingSeason` | `data[].operating_season` | String | e.g. `RABI_2025_26` |
| `supportedCommodities` | `data[].handled_commodities` | String[] | Commodities equipped for intake at this centre |
| `isActive` | `data[].operational_status` | Boolean | `true` if centre is open for physical delivery |

---

### Method 4: `getCentreCapacity(centreId: string, date: string)`
- **e-Samridhi API Target:** `GET /api/v1/centres/{centreId}/daily-capacity`
- **Query Parameters:** `target_date={YYYY-MM-DD}`
- **Purpose:** Enforces government physical intake ceilings to prevent mandi overcrowding.

| Platform Interface Field (`GovernmentCentreCapacityRecord`) | e-Samridhi Field Name | Data Type | Transformation / Business Rule |
| :--- | :--- | :--- | :--- |
| `centreId` | `data.centre_code` | String | Target procurement centre code |
| `date` | `data.allocation_date` | String | `YYYY-MM-DD` |
| `sanctionedDailyCapacityQuintals` | `data.sanctioned_intake_qtl` | Number | Max physical limit sanctioned by Mandi Board |
| `allocatedCapacityQuintals` | `data.reserved_central_qtl` | Number | Quota reserved by government / cooperative agencies |
| `availableCapacityQuintals` | `data.available_for_booking_qtl` | Number | Free capacity available for our scheduler to allocate |
| `maxSimultaneousVehicles` | `data.yard_vehicle_capacity` | Number | Max tractors/trucks permitted in yard concurrently |

---

### Method 5: `getExistingBookings(centreId: string, date: string)`
- **e-Samridhi API Target:** `GET /api/v1/centres/{centreId}/scheduled-tokens`
- **Query Parameters:** `scheduled_date={YYYY-MM-DD}`
- **Purpose:** Synchronizes bookings made through state portals or CSC kiosks into our queue model.

| Platform Interface Field (`GovernmentBookingRecord`) | e-Samridhi Field Name | Data Type | Transformation / Business Rule |
| :--- | :--- | :--- | :--- |
| `externalBookingId` | `data[].central_token_id` | String | e.g. `GOV-TOK-20260415-0912` |
| `farmerId` | `data[].farmer_id` | String | Authoritative farmer identifier |
| `centreId` | `data[].centre_code` | String | Assigned Mandi code |
| `commodityCode` | `data[].commodity_code` | String | Commodity scheduled for delivery |
| `quantityQuintals` | `data[].expected_quantity_qtl` | Number | Expected grain weight |
| `scheduledDate` | `data[].scheduled_arrival_date` | String | `YYYY-MM-DD` |
| `status` | `data[].token_status` | String | Maps to `SCHEDULED`, `CANCELLED`, `COMPLETED` |

---

### Method 6: `getProcurementStatus(bookingOrProcurementId: string)`
- **e-Samridhi API Target:** `GET /api/v1/procurement/records/{id}`
- **Purpose:** Verifies whether physical weighment, quality testing, and procurement have been recorded in the central ledger.

| Platform Interface Field (`GovernmentProcurementStatusRecord`) | e-Samridhi Field Name | Data Type | Transformation / Business Rule |
| :--- | :--- | :--- | :--- |
| `procurementId` | `data.procurement_record_id` | String | Central procurement voucher identifier |
| `externalBookingId` | `data.booking_reference_no` | String | Correlating scheduling token |
| `farmerId` | `data.farmer_id` | String | Authoritative farmer identifier |
| `centreId` | `data.centre_code` | String | Procurement centre code |
| `commodityCode` | `data.commodity_code` | String | e.g. `WHEAT` |
| `netWeightQuintals` | `data.net_accepted_weight_qtl`| Number | Gross scale weight minus tare weight |
| `qualityGrade` | `data.assigned_quality_grade` | String | `GRADE_A`, `STANDARD`, `REJECTED` |
| `officialReceiptNumber` | `data.official_j_form_no` | String | Statutory receipt number issued to farmer |
| `completedAt` | `data.procurement_timestamp` | String | ISO 8601 timestamp |

---

### Method 7: `submitProcurementUpdate(payload: ProcurementUpdatePayload)`
- **e-Samridhi API Target:** `POST /api/v1/procurement/ingest-transaction`
- **Headers:** `Authorization: Bearer <TOKEN>`, `X-Signature: HMAC-SHA256(...)`, `X-Operator-Id: {operatorUserId}`
- **Purpose:** Mandi operator pushes confirmed weighbridge tickets and moisture assays to create official government records.

| Inbound Payload Field (`ProcurementUpdatePayload`) | Outbound e-Samridhi Payload Field | Data Type | Validation Rule |
| :--- | :--- | :--- | :--- |
| `externalBookingId` | `booking_reference` | String | Must match active scheduled booking |
| `farmerId` | `farmer_identifier` | String | Authoritative farmer ID |
| `centreId` | `centre_code` | String | Assigned centre code |
| `commodityCode` | `commodity_code` | String | Permitted commodity code |
| `netWeightQuintals` | `net_weight_quintals` | Number | Must be > 0 and ≤ sanctioned quota |
| `moisturePercentage` | `moisture_pct` | Number | Recorded via electronic moisture assay |
| `foreignMatterPercentage` | `foreign_matter_pct` | Number | Percentage of chaff, dust, and stones |
| `qualityGrade` | `quality_grade` | String | Fair Average Quality (`GRADE_A`, `STANDARD`, `REJECTED`) |
| `counterId` | `intake_counter_id` | String | Electronic scale or assay bench ID |
| `operatorUserId` | `operator_id` | String | Authenticated operator employee badge ID |
| `timestamp` | `event_timestamp` | String | ISO 8601 timestamp of transaction |

**Expected Outbound Response (`ProcurementUpdateResult`):**
```json
{
  "success": true,
  "officialAcknowledgementId": "ACK-NAFED-2026-0415-883921",
  "syncedAt": "2026-04-15T11:42:10.000Z",
  "statusCode": "GOV_SYNC_ACKNOWLEDGED"
}
```

---

### Method 8: `getPaymentStatus(farmerId: string, procurementRecordId: string)`
- **e-Samridhi API Target:** `GET /api/v1/dbt/disbursements`
- **Query Parameters:** `farmer_id={farmerId}&procurement_receipt={procurementRecordId}`
- **Purpose:** Tracks real-time Public Financial Management System (PFMS) / NPCI Aadhaar Payment Bridge status.

| Platform Interface Field (`GovernmentPaymentStatusRecord`) | e-Samridhi Field Name | Data Type | Transformation / Business Rule |
| :--- | :--- | :--- | :--- |
| `paymentId` | `data.dbt_transaction_id` | String | PFMS / Treasury batch transaction ID |
| `farmerId` | `data.farmer_id` | String | Beneficiary farmer ID |
| `officialReceiptNumber` | `data.j_form_receipt_no` | String | Correlating procurement receipt |
| `amountRupees` | `data.disbursed_amount_inr` | Number | Total MSP payout = (Net Quintals × MSP Rate) |
| `status` | `data.payment_status` | String | `PENDING` → `INITIATED` → `CREDITED` / `FAILED` |
| `utrNumber` | `data.bank_utr_reference` | String (Opt) | Bank Unique Transaction Reference number |
| `disbursedAt` | `data.credit_timestamp` | String (Opt) | ISO 8601 timestamp of bank credit |
| `failureReason` | `data.npc_error_description`| String (Opt) | e.g. "Aadhaar not seeded in beneficiary account" |

---

### Method 9: `syncStatus(centreId: string)`
- **e-Samridhi API Target:** `GET /api/v1/health/gateway?centre={centreId}`
- **Purpose:** Mandi edge heartbeat probe validating gateway latency and pending offline queue sync.

| Platform Interface Field (`GovernmentSyncStatusResult`) | e-Samridhi Field Name | Data Type | Business Rule |
| :--- | :--- | :--- | :--- |
| `centreId` | `centre_code` | String | Mandi identifier |
| `lastSyncTimestamp` | `last_successful_ping` | String | ISO 8601 timestamp |
| `pendingRecordsCount` | `outbox_backlog_count` | Number | Offline weighment transactions waiting for sync |
| `isHealthy` | `gateway_reachable` | Boolean | `true` if round-trip latency < 2000ms and active |
| `lastError` | `diagnostic_message` | String (Opt) | Description if connection degraded or unauthorized |

---

## 5. Authentication, Network & Security Protocols

When credentials are provisioned for Pilot / Production deployment, the following security standards apply:

1. **OAuth 2.0 Client Credentials Grant**:
   - Token Endpoint: `POST https://auth.esamridhi.gov.in/oauth/v2/token`
   - Grant Type: `client_credentials`
   - Scope: `read:farmer read:quota write:procurement read:dbt`
   - Token TTL: 3600 seconds with automated refresh 5 minutes prior to expiry.
2. **Mutual TLS (mTLS)**:
   - Client Certificate issued by National Informatics Centre (NIC) or NAFED Root CA.
   - Configured via `ESAMRIDHI_MTLS_CERT_PATH` and `ESAMRIDHI_MTLS_KEY_PATH`.
3. **Payload Signing**:
   - Ingestion payloads to `submitProcurementUpdate` must include an `X-Signature` header computed using HMAC-SHA256 with the assigned shared secret.
4. **Data Privacy & DPDP Act 2023 Compliance**:
   - All farmer telephone numbers are masked in transit logs (`98****3210`).
   - Sourced land records are cached in memory with a 15-minute TTL and never written to permanent disk without active farmer consent.

---

## 6. How to Switch Providers (Zero Code Changes)

The system is configured with an environment feature flag:

```bash
# In backend/.env

# Use simulated data for local development & demonstration:
GOVERNMENT_PROVIDER=mock

# Switch to official e-Samridhi integration for pilot / production:
GOVERNMENT_PROVIDER=esamridhi
ESAMRIDHI_API_BASE_URL=https://api.esamridhi.gov.in/v1
ESAMRIDHI_CLIENT_ID=your_nafed_client_id
ESAMRIDHI_CLIENT_SECRET=your_nafed_client_secret
ESAMRIDHI_API_KEY=your_nafed_api_key
```

When `GOVERNMENT_PROVIDER=esamridhi` is selected without valid credentials, every external method throws `ESamridhiNotYetAuthorizedException` (HTTP 503 Service Unavailable) with clear instructions on which credentials need to be provisioned.
