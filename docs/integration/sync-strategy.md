# Government Integration: Synchronization Strategy

> [!IMPORTANT]
> **Production Integration Notice (Section 39)**
> The dual-mode push/pull synchronization architecture documented below defines how live physical mandi events and master government quotas are synchronized. Live production sync bridges will be activated upon official portal credential provisioning.

---

## 1. Dual-Mode Synchronization Architecture

The platform operates on a **hybrid dual-mode synchronization model** balancing real-time operational speed at mandis with the asynchronous batch nature of central government mainframes.

```
                           +-------------------------------------+
                           |   Authoritative Government Portals  |
                           |       (e-Samridhi / CFPP)           |
                           +------------------+------------------+
                                              |
                   +--------------------------+--------------------------+
                   | (Pull: Master Data)                                 | (Push: Transactions)
                   v                                                     ^
+------------------------------------+                 +------------------------------------+
| Batch / Polling Worker             |                 | Real-Time Event Bus Worker         |
| - Daily Sanctioned Capacity        |                 | - Event: PROCUREMENT_COMPLETED     |
| - Seasonal MSP Master Rates        |                 | - Immediate Payload Transmission   |
| - Farmer Eligibility Updates       |                 | - Exponential Backoff on Failure   |
+------------------+-----------------+                 +-----------------+------------------+
                   |                                                     |
                   +--------------------------+--------------------------+
                                              |
                                              v
                           +-------------------------------------+
                           |    Coordination Platform Core       |
                           |   (MongoDB Authoritative Store)     |
                           +-------------------------------------+
```

---

## 2. Synchronization Patterns

### 2.1 Real-Time Push (Event-Driven Ingestion)
- **Trigger**: Emitted whenever a farmer successfully completes weighing and quality testing, and the procurement operator clicks **Complete Procurement** (`DomainEventType.PROCUREMENT_COMPLETED`).
- **SLA**: Sent to government gateway within $\le 3,000\text{ ms}$.
- **Idempotency Guarantee**: Every push includes `externalBookingId` (e.g. `BK-20260330-IND01-0004`). If a transient network glitch causes a retry, the government gateway detects the duplicate ID and returns the existing acknowledgment without double-counting physical grain.
- **Durable Local State**: Physical procurement is **immediately committed to MongoDB locally** prior to the network call. If the external government gateway is slow or down, the farmer is not delayed; the record is marked `govSyncStatus: PENDING` or `FAILED` for background asynchronous retry.

### 2.2 Scheduled Pull (Batch Master Ingestion)
- **Schedule**: Every night at 02:00 IST (Off-peak hours).
- **Scope**:
  - Daily sanctioned capacity quotas for all mandis in the state.
  - Active procurement seasons, start/end dates, and official MSP revisions.
  - Farmer eligibility deltas (newly registered land parcels or updated crop declarations).
- **Cache Warming**: Master records are synchronized into MongoDB and cached into Redis with a 24-hour TTL.

### 2.3 Incremental On-Demand Verification
- When a farmer requests a new booking:
  - System invokes `getFarmerEligibility(farmerId, commodityCode)`.
  - Result is cached for 15 minutes to allow the farmer to evaluate feasible slots without bombarding the government portal with duplicate identity lookups.

---

## 3. Conflict Resolution Policy (Section 4)

1. **Official Quota & MSP Rates**: Government portal is strictly authoritative. The platform never overrides a farmer's sanctioned quota.
2. **Physical Mandi Events**: The platform is strictly authoritative for physical yard arrival timestamps, digital scale gross/tare weight readings, and token queue sequence.
3. **Audit Trail**: Every synchronization attempt (successful, retried, or failed) logs a timestamped entry in the `AuditService` with response payload hashes for end-of-day reconciliation.
