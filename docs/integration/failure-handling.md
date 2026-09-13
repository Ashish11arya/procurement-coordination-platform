# Government Integration: Failure Handling & Circuit Breaker Architecture

> [!IMPORTANT]
> **Production Integration Notice (Section 39)**
> Resilient failure handling protocols described here ensure continuous mandi operations regardless of external government portal downtime. Real portal retry intervals and fallback queues will be calibrated based on official gateway SLAs.

---

## 1. Zero-Disruption Core Rule (Section 21 & 24)

> **Golden Rule**: **A failure of an external government portal must NEVER halt physical operations at the procurement centre, cancel a farmer's arrival window, or refuse acceptance of physical grain.**

Physical grain unloading, calibrated weighing, moisture assaying, and receipt printing continue with 100% functionality locally. Digital synchronization is degraded to asynchronous retries.

---

## 2. Failure Recovery Mechanisms

### 2.1 Circuit Breaker Pattern

To prevent thread exhaustion and cascading HTTP connection pool starvation when an external government portal experiences latency spikes or HTTP 500/503 errors:

```
        Successes > Threshold
       +-----------------------+
       |                       |
       v                       |
  +----------+   Failure Rate   +----------+   Cooldown Timer   +-----------+
  |  CLOSED  | ---------------> |   OPEN   | -----------------> | HALF-OPEN |
  | (Normal) |   > 50% (10 req) | (Bypassed)|      (60s wait)    |  (Trial)  |
  +----------+                  +----------+                    +-----------+
       ^                                                              |
       +--------------------------------------------------------------+
                         Single Success in Trial Mode
```

- **CLOSED State**: Requests flow normally. Round-trip latencies tracked.
- **OPEN State**: When $> 50\%$ of calls fail or timeout over a 10-request sliding window, the breaker trips to OPEN. Subsequent calls bypass network execution immediately, marking records as `GovSyncStatus.FAILED` with reason `CIRCUIT_BREAKER_OPEN`.
- **HALF-OPEN State**: After 60 seconds, a single test canary probe is dispatched. If successful, the breaker resets to CLOSED; if it fails, the breaker returns to OPEN for another 120 seconds.

### 2.2 Exponential Backoff with Jitter

For transient failures (HTTP 429 Too Many Requests, 502 Bad Gateway, 504 Gateway Timeout):

$$T_{\text{wait}} = \min\left(T_{\text{max}},\, T_{\text{base}} \times 2^{\text{attempt}}\right) \pm \text{Jitter}$$

- $T_{\text{base}} = 2.0\text{ seconds}$
- Factor = 2
- $T_{\text{max}} = 300\text{ seconds}$ (5 minutes)
- Jitter = Random variation $\pm 20\%$ to eliminate "thundering herd" spikes against government servers.

### 2.3 Dead-Letter Queue (DLQ) & Offline Buffer

- Records that fail 5 consecutive automated retry attempts transition to `GovSyncStatus.FAILED` and enter the Dead-Letter Queue.
- Stored permanently in MongoDB with full diagnostic stack trace:
  - `govSyncError`: Error message from government portal (e.g. `CFPP_GATEWAY_TIMEOUT`).
  - `lastSyncAttemptAt`: Timestamp of final attempt.
  - `syncAttempts`: Counter incremented per attempt.
- Operators and State IT Administrators can view and trigger bulk re-synchronization from the **Government Command Centre Integration Health Dashboard** (`/admin/integrations`).
