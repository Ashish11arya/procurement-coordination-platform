# Government Integration: Canonical Data Mapping

> [!IMPORTANT]
> **Production Integration Notice (Section 39)**
> Field mappings detailed below define transformations between external government portal schemas (e-Samridhi, Central Food Procurement Portal - CFPP, State Land Records) and the coordination platform's domain models. Real portal schemas will be mapped upon final API specification handover.

---

## 1. Farmer Identity & Land Record Mapping

| Government Portal Field (CFPP / e-Samridhi) | Platform Domain Field (`FarmerProfile`) | Transformation / Validation Rule |
| :--- | :--- | :--- |
| `reg_no` / `farmer_id_govt` | `farmerId` | String, e.g. `FARMER-MP-IND-001` (Canonical unique key) |
| `aadhaar_vault_ref` | *Not Stored* | Excluded per Data Minimisation (Section 38); only verification flag retained |
| `farmer_name` | `name` | Sanitized Unicode string |
| `registered_mobile` | `mobile` | 10-digit Indian phone format (`/^[6-9]\d{9}$/`) |
| `state_code` / `state_name` | `state` | Standardized ISO-3166-2:IN state name |
| `district_code` / `district_name` | `district` | Canonical district string matching mandi jurisdictional mapping |
| `total_cultivable_area_hectares` | `landHoldingHectares` | Number, validated $> 0.0$ |
| `verified_bank_account_flag` | `bankAccount.isVerified` | Boolean |
| `bank_ifsc` | `bankAccount.ifscCode` | 11-character regex format (`/^[A-Z]{4}0[A-Z0-9]{6}$/`) |
| `bank_account_masked` | `bankAccount.accountNumberMasked` | Masked format (`XXXXXX1234`), raw account number never stored |

---

## 2. Centre Master & Daily Capacity Mapping

| Government Portal Field | Platform Domain Field (`Centre` & `Capacity`) | Transformation / Validation Rule |
| :--- | :--- | :--- |
| `mandi_code` / `centre_code` | `centreId` | Uppercase alphanumeric (e.g. `CENTRE-MP-IND-01`) |
| `mandi_name` | `name` | Name of the Krishi Upaj Mandi |
| `daily_sanctioned_quota_qtl` | `dailyCapacityQuintals` | Maximum daily limit sanctioned by government (Section 6 & 15) |
| `max_yard_vehicles` | `maxSimultaneousVehicles` | Physical safety constraint on simultaneous vehicles in yard |
| `permitted_commodities` | `supportedCommodities` | Array of mapped commodity codes (`['WHEAT', 'PADDY']`) |
| `operational_status` | `isActive` | `ACTIVE` $\to$ `true`, `SUSPENDED`/`CLOSED` $\to$ `false` |

---

## 3. Commodity Standardization Matrix

| Crop Type | Government Portal Code | Platform Canonical Code (`commodityCode`) | Official MSP (2025-26 Ref) |
| :--- | :--- | :--- | :--- |
| Wheat (Gehun) | `WHT-FAQ-01` | `WHEAT` | ₹2,275 / Quintal |
| Paddy Common (Dhan) | `PDY-COM-01` | `PADDY_COMMON` | ₹2,300 / Quintal |
| Paddy Grade A | `PDY-GRA-02` | `PADDY_GRADE_A` | ₹2,320 / Quintal |
| Mustard (Sarson) | `MST-OIL-01` | `MUSTARD` | ₹5,650 / Quintal |
| Gram (Chana) | `GRM-PUL-01` | `GRAM` | ₹5,440 / Quintal |
| Soybean (Yellow) | `SOY-YEL-01` | `SOYBEAN` | ₹4,892 / Quintal |
| Maize (Makka) | `MAZ-FAQ-01` | `MAIZE` | ₹2,090 / Quintal |

---

## 4. Physical Procurement & Quality Assay Mapping

Submitted from physical Mandi counter to Government Portal upon completion:

| Platform Field (`ProcurementRecord` / `QualityRecord`) | Government Portal Field (`ProcurementUpdatePayload`) | Description |
| :--- | :--- | :--- |
| `booking.bookingId` | `externalBookingId` | Idempotent transaction reference |
| `booking.farmerId` | `farmerId` | Official farmer ID |
| `weighingRecord.netWeightQuintals` | `netWeightQuintals` | Net weight certified by calibrated electronic weighbridge |
| `qualityRecord.moisturePercentage` | `moisturePercentage` | Digital moisture meter reading (Standard: $\le 12.0\%$) |
| `qualityRecord.foreignMatterPercentage` | `foreignMatterPercentage` | Impurities & foreign matter percentage (Standard: $\le 0.75\%$) |
| `qualityRecord.assignedGrade` | `qualityGrade` | `GRADE_A` or `STANDARD` |
| `operatorUser.userId` | `operatorUserId` | Operator biometric / badge ID responsible for the assay |
| `now.toISOString()` | `timestamp` | UTC ISO-8601 transaction timestamp |
