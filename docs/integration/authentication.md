# Government Integration: Authentication & Security Architecture

> [!IMPORTANT]
> **Production Integration Notice (Section 39)**
> Real government authentication gateways (mTLS, OAuth2 Client Credentials, and API Gateway HMAC keys) will be configured and deployed once nodal procurement authorities issue official credentials and staging certificates.

---

## 1. Authentication Topology

All cross-system communication between the Real-Time Coordination Platform and Authoritative Government Gateways (e-Samridhi, CFPP, State MSP Portals) is secured via a multi-layered defense model:

```
+--------------------------+                     +---------------------------+
|  Coordination Platform   |                     |  Government Gateway (NIC) |
|  [MeitY Cloud / Backend] |                     |  [e-Samridhi / CFPP]      |
+------------+-------------+                     +-------------+-------------+
             |                                                 |
             | 1. Mutual TLS Handshake (X.509 Certificate)     |
             |================================================>|
             |                                                 |
             | 2. OAuth2 Client Credentials (JWT Assertion)    |
             |------------------------------------------------>|
             |    Response: Scoped Bearer Token (TTL 3600s)    |
             |<------------------------------------------------|
             |                                                 |
             | 3. Authenticated Request + HMAC-SHA256 Payload  |
             |    Headers: Authorization, X-Gov-Signature     |
             |------------------------------------------------>|
             |    Response: HTTP 200 / Signed Acknowledgment   |
             |<------------------------------------------------|
```

---

## 2. Security Requirements (Section 19 & 39)

### 2.1 Mutual Transport Layer Security (mTLS)
- **Protocol**: TLS v1.3 strictly enforced (TLS 1.0, 1.1, and 1.2 deprecated).
- **Client Identity**: The coordination platform presents an X.509 client certificate issued by a recognized Government Certifying Authority (e.g. NIC-CA / CCA India).
- **Server Verification**: The client validates the server's public certificate and hostname against the official national trust store.

### 2.2 OAuth 2.0 Client Credentials Flow
For transactional endpoints:
- **Token URL**: `https://auth.cfpp.gov.in/oauth2/token`
- **Grant Type**: `client_credentials`
- **Client ID & Secret**: Provisioned per state/agency and injected via Cloud Secret Manager.
- **Token Caching**: Access tokens are cached in Redis with an automated refresh triggered 5 minutes prior to expiry (`expires_in - 300s`) to prevent mid-flight token expiration during peak mandi hours.

### 2.3 Message Integrity & Non-Repudiation (HMAC-SHA256)
All mutating state updates (e.g. `submitProcurementUpdate`) must include request signing headers:
- `X-Gov-Client-ID`: Registered application ID.
- `X-Gov-Timestamp`: ISO 8601 UTC timestamp (rejected if clock drift exceeds $\pm 60$ seconds).
- `X-Gov-Nonce`: Cryptographically random UUID v4 to prevent replay attacks.
- `X-Gov-Signature`: Hex-encoded HMAC-SHA256 digest of `Client-ID + Timestamp + Nonce + Request-Body-JSON` computed using the shared secret key.

---

## 3. Secret Management & Key Rotation Policy (Section 36)

1. **Zero Plaintext Secrets**: Private keys, client secrets, and certificates are **never** committed to version control (`.gitignore` enforces exclusions).
2. **Runtime Injection**: Secrets are mounted into container environments as files or read dynamically from cloud secret managers (AWS Secrets Manager / GCP Secret Manager / Azure Key Vault / HashiCorp Vault).
3. **Rotation Windows**:
   - OAuth 2.0 Client Secrets: Rotated every 90 days.
   - mTLS Certificates: Renewed 30 days prior to annual expiration.
   - Symmetric HMAC Keys: Rotated on semi-annual schedule.
