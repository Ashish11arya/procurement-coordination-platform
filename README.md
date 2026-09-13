# Government-Grade Real-Time Procurement Coordination Platform

> A resilient, high-throughput, multi-stage procurement coordination and arrival window scheduling system built for agricultural mandis under government Minimum Support Price (MSP) operations.

---

## 1. Overview & Architecture

This platform provides end-to-end coordination between farmers, procurement centres (mandis), physical yard operations, and state/central government agricultural portals.

### Core Architectural Principles
- **Physical Reality Respected (Section 11)**: The system strictly prevents phantom capacity allocation. Bookings are matched against multi-stage operational bottlenecks (`CHECKIN`, `WEIGHING`, `QUALITY`, `PROCUREMENT`), physical yard vehicle capacity limits (`maxSimultaneousVehicles`), and authoritative daily sanctioned ceilings.
- **AI Advisory Boundary (Section 31 & 32)**: Predictive models (moving average, regression) provide estimated service durations and arrival pattern advisories. Machine learning models **never** override physical constraints, yard safety caps, or scheduler decisions.
- **Fail-Safe Operation (Section 21 & 24)**: Physical yard procurement continues without halting even if central government APIs timeout or Redis cache goes offline.
- **Auditability & Traceability (Section 26)**: All scheduling and adaptation decisions are permanently logged into an immutable `scheduling_decisions` collection.

---

## 2. Testing & Verification

### Running the Full Test Suite
To run all 17 unit, integration, and failure-recovery test suites:

```bash
cd backend
npm test -- --runInBand
```

This runs all 169 tests covering:
- OTP authentication, JWT issuing, and refresh-token rotation family tracking
- RBAC guards (Farmer, Weighing Operator, Quality Assayer, Centre Admin, State Admin)
- Deterministic constraint scheduling and physical yard limits
- Queue state machine (11 operational states)
- Real-time Redis pub/sub and WebSocket failover
- Prediction Engine and advisory metadata persistence
- Security defenses (CSRF, Helmet, rate limiting, token reuse defense)
- Failure recovery (concurrency race conditions, database disconnects, government gateway timeouts)
- Container health probes (`/health`, `/ready`, `/live`)

---

## 3. Load Testing Strategy (Section 34 & 44)

Per Section 44 (*"No fake performance metrics or misrepresentation"*), the platform provides two distinct, purpose-built benchmark suites with clear separation of scope:

### A. In-Process Algorithm / Logic Benchmark
```bash
cd backend
npm run test:load
```
- **File**: [`backend/tests/load/load-test-benchmark.ts`](backend/tests/load/load-test-benchmark.ts)
- **What It Measures**:
  - Pure CPU constraint scheduling calculation rate (`SchedulingService`)
  - In-memory capacity contention and race-condition prevention across 50 simulated Virtual Users (VUs)
  - Queue state machine transition logic throughput (`QueueStateMachine`)
  - In-process event bus broadcast fanout latency
- **Execution Context**: Runs directly in Node.js memory using mock models without network serialization or disk I/O. Measures raw algorithmic performance and memory transition ceilings.
- **Measured Results on AMD Ryzen 7 7735HS (16 cores, 16GB RAM)**:
  - Scheduler Calculation Throughput: **~2,736 to 5,593 evaluations/sec** (p50: 0.17ms - 0.31ms)
  - In-Memory Contention Intake: **~84,800 to 196,800 req/sec**
  - Queue State Machine Validations: **~1,919,000 to 2,940,000 updates/sec**

---

### B. Genuine HTTP Network & Real MongoDB Wire Load Test
```bash
cd backend
npm run test:load:http
```
- **File**: [`backend/tests/load/http-load-test.ts`](backend/tests/load/http-load-test.ts)
- **What It Measures**:
  - Real HTTP network server listening on TCP loopback port (`http://127.0.0.1:3333`)
  - Real, official MongoDB server process (`mongod.exe` v6.0.14) spawned over TCP wire protocol (`mongodb://127.0.0.1:<port>/`)
  - Full production HTTP middleware stack:
    - Express routing
    - `helmet()` security headers
    - `cookieParser()`
    - CORS origin validation
    - `ValidationPipe` (class-validator DTO parsing and validation)
    - `RateLimitGuard`
    - `JwtAuthGuard` & `RolesGuard`
    - `AuditInterceptor`
    - Mongoose connection pool communicating with `mongod` over TCP socket wire
  - Real concurrent HTTP clients with Keep-Alive connection pooling
  - Real Socket.IO client connected over TCP WebSocket (`ws://127.0.0.1:3333`)
- **Measured Results on AMD Ryzen 7 7735HS (16 cores, 16GB RAM)**:
  - **Authenticated Booking Intake (`POST /api/v1/bookings`)**:
    - Real HTTP Throughput: **247.8 req/sec**
    - Round-Trip HTTP Latency: **p50 = 31.47 ms**, **p95 = 105.36 ms**, **p99 = 106.04 ms**
    - Unexpected Errors: **0.00%**
  - **Health Probes with Live DB Ping (`GET /health`)**:
    - Real HTTP Throughput: **1,202.3 req/sec**
    - Round-Trip HTTP Latency: **p50 = 14.83 ms**, **p95 = 26.43 ms**, **p99 = 54.96 ms**
  - **Socket.IO TCP WebSocket Latency**: **62.21 ms**

---

## 4. Real-World Demonstration Scenario (Section 42)

To run the automated, end-to-end 6-step mandi scenario:

```bash
cd backend
npm run demo:sih
```

### Scenario Sequence:
1. **F1 (On-Time Arrival)**: Farmer 1 checked in at Gate 1; Token `T-001` issued; status set to `CHECKED_IN`.
2. **F2 (Late Arrival)**: Farmer 2 arrives 35 minutes late. Booking is preserved under grace period protocols; downstream arrival buffer incremented (+35m dynamic ETA update).
3. **F3 (Physical Yard Processing)**: Gross vehicle weighing (40.0Q on Scale 1) $\to$ Quality lab assay (Grade A, moisture 11.4%) $\to$ Procurement finalized (`COMPLETED`).
4. **F4 (Farmer Cancellation)**: 40Q capacity freed up in Slot 1 (10:00 - 11:00 AM).
5. **F5 (No-Show)**: Grace window expires; marked `NO_SHOW`; capacity returned to Slot 1 pool.
6. **Counter 2 (Mechanical Breakdown)**: Weighbridge 2 marked `MAINTENANCE`; stage hourly throughput derated from 55Q/hr to 30Q/hr; affected windows flagged.
7. **Dynamic Downstream Adaptation**:
   - **Candidate A (`BK-CAND-A`, 25Q)**: Fits freed slot capacity & satisfies 45m transit notice $\to$ **`MOVED_FORWARD`** into Slot 1.
   - **Candidate B (`BK-CAND-B`, 50Q)**: Exceeds remaining freed capacity (15Q) $\to$ **`UNALTERED`** in Slot 3.
   - **Audit Trail**: Full decision records permanently stored in `scheduling_decisions`.

---

## 5. Deployment & Containerization (Section 36 & 37)

| Configuration | File | Purpose |
| :--- | :--- | :--- |
| **Dockerfile** | [`backend/Dockerfile`](backend/Dockerfile) | Multi-stage production build (non-root `node` user, dumb-init, curl healthcheck) |
| **Dev Compose** | [`docker-compose.yml`](docker-compose.yml) | Local development stack (Backend + MongoDB 7.0 + Redis 7.0) |
| **Prod Compose** | [`docker-compose.prod.yml`](docker-compose.prod.yml) | Hardened production template with resource limits, healthchecks, and log rotation |
| **Env Templates** | `backend/.env.development`<br>`backend/.env.staging`<br>`backend/.env.production` | Pre-configured environment variables for dev, staging, and production |

### Health Endpoints
- `GET /health`: Comprehensive status (uptime, memory, MongoDB ping, Redis state)
- `GET /ready`: Container traffic readiness check (HTTP 200 or 503)
- `GET /live`: Container liveness probe

---

## 6. Government Integration Documentation (Section 39)

Specifications located in [`docs/integration/`](docs/integration/):
- [`government-api-contract.md`](docs/integration/government-api-contract.md): `GovernmentDataProvider` interface specification
- [`authentication.md`](docs/integration/authentication.md): mTLS, OAuth2 client credentials, HMAC-SHA256 signatures
- [`data-mapping.md`](docs/integration/data-mapping.md): Field crosswalk between state portals and platform schema
- [`sync-strategy.md`](docs/integration/sync-strategy.md): Webhook push notifications vs scheduled reconciliation
- [`failure-handling.md`](docs/integration/failure-handling.md): Circuit breaker, exponential backoff, DLQ, zero physical disruption
- [`reconciliation.md`](docs/integration/reconciliation.md): Daily 3-way reconciliation ledger and variance resolution
