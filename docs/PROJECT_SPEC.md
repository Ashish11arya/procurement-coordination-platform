BUILD A GOVERNMENT-GRADE REAL-TIME PROCUREMENT COORDINATION PLATFORM

You are the lead architect, senior backend engineer, security engineer, DevOps engineer, frontend engineer and distributed-systems engineer.

Build a production-oriented web platform based on the following SIH solution:

A Real-Time, Capacity-Aware Procurement Coordination Platform that coordinates farmers, vehicles, procurement centres and multiple operational counters through one real-time system.

The platform is NOT intended to replace existing government procurement systems.

It is an orchestration and coordination layer that works WITH existing procurement platforms such as e-Samridhi, CFPP and state procurement portals.

The existing government systems remain authoritative for the functions they already perform. Our platform adds the missing coordination layer for:

- capacity-aware scheduling
- quantity-aware arrival windows
- live queue
- ETA
- dynamic rescheduling
- multi-counter coordination
- centre workload monitoring
- operational visibility
- predictive scheduling support
- government command-centre analytics

---

1. CORE PROBLEM

Traditional procurement operations can create:

- uncertain arrival timing
- farmer waiting
- congestion at procurement centres
- fragmented coordination between farmers, vehicles and centre operators
- poor visibility of current queue/progress
- avoidable centre idle capacity when cancellations/no-shows occur
- difficulty coordinating multiple operational counters
- limited use of historical operational data for future scheduling

The system must solve this through:

Predict → Constrain → Schedule → Monitor → Adapt

---

2. EXISTING GOVERNMENT ECOSYSTEM

The architecture MUST assume that government already has procurement infrastructure.

Examples include:

- NAFED e-Samridhi
- Central Foodgrain Procurement Portal (CFPP)
- State procurement portals
- State land-record systems
- approved farmer/identity systems
- bank/payment systems
- warehouse/inventory systems
- other authorised government systems

DO NOT recreate functionality that already exists unless required for coordination.

DO NOT present our platform as a replacement for these systems.

Instead:

Existing Government Systems
↓
Authorised Integration Layer
↓
Our Coordination Platform
↓
Farmers + Centre Operators + Government

The existing government system remains the source of truth for the data/functions it owns.

---

3. CRITICAL GOVERNMENT API RULE

At present, we DO NOT have authorised government API credentials.

Therefore:

NEVER:

- invent government APIs
- claim that real government APIs are connected
- scrape government websites
- bypass authentication
- bypass government security
- use undocumented endpoints
- fabricate government credentials
- put government credentials in frontend code

Instead build a complete:

GOVERNMENT INTEGRATION ABSTRACTION LAYER

The application must support interchangeable providers:

GovernmentDataProvider
├── MockGovernmentProvider
├── ESamridhiProvider
├── CFPPProvider
├── StateProcurementProvider
└── FutureGovernmentProvider

The prototype must use:

MockGovernmentProvider

with synthetic/realistically structured data.

The production architecture must allow authorised government APIs to be plugged in later without rewriting the scheduling, queue, frontend or business logic.

Create clear interfaces/contracts such as:

- getFarmer()
- getFarmerEligibility()
- getCentres()
- getCentreCapacity()
- getExistingBookings()
- getProcurementStatus()
- submitProcurementUpdate()
- getPaymentStatus()
- syncStatus()

The actual endpoint, authentication method and payload mapping must live inside the provider adapter.

---

4. SOURCE-OF-TRUTH POLICY

Define ownership explicitly.

Example:

Government systems:

- farmer eligibility/registration where applicable
- sanctioned procurement quantity
- official procurement records
- payment status where applicable
- official centre/master data

Our platform:

- coordination booking
- scheduling decisions
- arrival windows
- live queue state
- ETA
- operational coordination
- scheduler decisions
- temporary live operational state
- coordination analytics

Never silently overwrite government-authoritative data.

All synchronization must be auditable.

---

5. MAIN USERS

Create separate secure experiences for:

FARMER

Features:

- secure registration/login
- profile
- eligibility/status
- available procurement centres
- commodity
- quantity
- preferred procurement date
- booking request
- assigned arrival window
- token
- vehicle details
- live queue position
- live ETA
- alerts
- cancellation/reschedule request
- procurement status
- payment status
- booking history
- notifications
- help/grievance

A farmer should NOT be able to modify official procurement records.

---

CENTRE OPERATOR

Create a powerful centre dashboard.

Different operators should have role-specific access:

- Centre Administrator
- Check-in Operator
- Weighing Operator
- Quality Operator
- Procurement Operator

Do NOT give every operator access to everything.

Example:

Check-in operator:

- verify booking
- vehicle/token
- check-in

Weighing operator:

- start/end weighing
- record weight
- submit weighing record

Quality operator:

- quality parameters
- assessment
- accept/reject/hold according to configured rules

Procurement operator:

- procurement completion
- status update
- handoff/sync

Centre administrator:

- centre capacity
- counters
- staff
- queue
- exceptions
- workload

---

GOVERNMENT / ADMIN

Create command-centre dashboards:

- state overview
- district overview
- centre overview
- live workload
- active queue
- centre utilisation
- processing throughput
- bottlenecks
- delayed centres
- exception monitoring
- procurement statistics
- integration health
- synchronization failures
- audit logs
- analytics
- centre comparison

Government users should be able to monitor but must only perform actions permitted by their role.

---

6. CORE BOOKING LOGIC

A farmer requests procurement.

Inputs:

- farmer
- commodity
- quantity
- preferred date
- centre
- vehicle information where applicable

The system does NOT simply assign a rigid one-hour slot.

Instead:

1. retrieve centre capacity
2. retrieve operational counters
3. retrieve current workload
4. retrieve existing bookings
5. estimate processing requirements
6. use prediction where available
7. run constraint checks
8. generate feasible arrival window
9. issue booking/token
10. publish the booking to farmer and centre

The system must prevent overbooking.

---

7. AI ROLE

AI MUST NOT directly control physical capacity.

AI is used only where it provides genuine value.

Use historical operational data to predict:

Service time

Expected processing duration based on:

- commodity
- quantity
- centre
- counter
- historical processing patterns
- operational conditions

Arrival pattern

Predict likely arrival distribution.

No-show likelihood

Estimate probability based on historical behaviour and booking/arrival patterns.

Seasonal pattern

Identify recurring operational patterns.

AI output is only a prediction.

The final decision belongs to the constraint-based scheduler.

---

8. CONSTRAINT-BASED SCHEDULER

Build the scheduler as a deterministic business-critical component.

It must consider:

- centre physical capacity
- remaining sanctioned capacity
- farmer quantity
- commodity constraints
- operating hours
- number of counters
- counter availability
- current queue
- estimated service time
- existing bookings
- processing workload
- farmer reachability/travel feasibility where location data is available
- vehicle constraints where applicable
- operational rules
- government-configured constraints

The scheduler MUST NEVER assign capacity that physically does not exist.

AI prediction can suggest:

"F2 likely requires 20 minutes."

The scheduler decides:

"Can F2 actually be processed at this time without violating constraints?"

---

9. LIVE QUEUE

Build a real-time queue system.

Track:

- booked
- confirmed
- arrived
- checked-in
- waiting
- processing
- completed
- cancelled
- no-show
- rejected/held where applicable

Use real-time updates through WebSockets/SSE.

Farmers should see:

- current queue position
- estimated waiting time
- estimated arrival/processing window
- important alerts

Centre operators see:

- complete operational queue
- counter assignments
- delays
- bottlenecks
- exceptions

---

10. DYNAMIC ADAPTATION

This is one of the most important features.

When any of these occurs:

- cancellation
- no-show
- early arrival
- late arrival
- counter failure
- processing delay
- unusually long service
- capacity change
- operational bottleneck

the system should recompute the feasible schedule.

BUT:

A released capacity unit must NOT automatically be assigned to the next farmer.

Evaluate candidate farmers against constraints.

Example:

F2 becomes no-show.

System evaluates F3:

- already booked?
- can realistically reach?
- quantity fits?
- centre capacity available?
- counter available?
- operating window permits?
- moving F3 creates another infeasible gap?
- government/business rules permit?

If feasible:
→ move F3 forward.

If not feasible:
→ keep F3's original window.

Then evaluate subsequent farmers.

The objective is NOT simply:

"Move everyone forward."

The objective is:

Minimise avoidable waiting and idle processing capacity while respecting physical and operational constraints.

---

11. IMPORTANT: DO NOT CLAIM PERFECT UTILISATION

The system must acknowledge reality.

It cannot eliminate:

- farmer delays
- no-shows
- unpredictable processing
- transport disruptions
- equipment failure
- weather
- sudden centre restrictions
- government-system outages

Instead it:

1. detects deviations
2. updates the live state
3. recalculates feasible schedules
4. reduces avoidable waiting/idle time
5. keeps the system within physical constraints

Never claim that the system eliminates waiting or congestion completely.

---

12. MULTIPLE VEHICLES / ONE PROCUREMENT BOOKING

Support a farmer/procurement booking associated with multiple vehicles where operationally permitted.

Model:

Booking
↓
Vehicle 1
Vehicle 2
Vehicle 3
↓
Arrival/check-in events
↓
Aggregate procurement quantity

But ensure that one procurement booking cannot be duplicated or double-counted.

Every vehicle must have unique identification and auditable association with its booking.

---

13. CENTRE MULTI-COUNTER MODEL

Model multiple operational counters/stages.

Example:

Check-in
↓
Weighing
↓
Quality
↓
Procurement

There may be multiple counters per stage.

The scheduler must understand that:

- centre capacity is not just one number
- bottlenecks may occur at one stage
- one counter being free does not necessarily mean the entire procurement process can accept another farmer

Therefore calculate workload across the operational pipeline.

---

14. EVENT-DRIVEN ARCHITECTURE

Use domain events.

Examples:

FARMER_BOOKED
BOOKING_CONFIRMED
TOKEN_ASSIGNED
FARMER_ARRIVED
FARMER_NO_SHOW
BOOKING_CANCELLED
COUNTER_AVAILABLE
COUNTER_BUSY
WEIGHMENT_STARTED
WEIGHMENT_COMPLETED
QUALITY_COMPLETED
PROCUREMENT_COMPLETED
PAYMENT_STATUS_UPDATED
CENTRE_CAPACITY_CHANGED
SCHEDULING_UPDATED
ETA_UPDATED
GOVERNMENT_SYNC_FAILED
GOVERNMENT_SYNC_COMPLETED

Use an event bus/message broker architecture.

For development, a simpler implementation is acceptable.

The architecture must be ready to use Kafka/RabbitMQ or another production event broker.

---

15. DATABASE ARCHITECTURE

Use a durable transactional database for authoritative application data.

Use MongoDB if it fits the current project stack, but design schemas carefully.

Important collections/entities:

- users
- roles
- permissions
- farmers
- centres
- counters
- commodities
- bookings
- bookingVehicles
- arrivalWindows
- queueStates
- serviceSessions
- weighingRecords
- qualityRecords
- procurementRecords
- paymentStatuses
- notifications
- predictions
- schedulingDecisions
- integrationRecords
- syncJobs
- auditLogs
- idempotencyRecords

Do not store live queue state only in Redis.

Redis is a performance layer/cache/live-state mechanism.

The durable database remains authoritative.

---

16. REDIS

Use Redis for:

- live queue
- ETA cache
- centre live status
- rate limiting
- distributed locks
- short-lived data
- session/risk state where appropriate
- WebSocket scaling support
- caching

Use distributed locking/idempotency for critical operations.

---

17. AUTHENTICATION

Build serious authentication.

For farmers:

- mobile OTP or approved identity verification mechanism
- secure session/token management
- device/session management
- rate limiting
- OTP throttling
- suspicious-login detection

For operators/government users:

- strong authentication
- MFA
- role-based access
- privileged session controls

Never rely on frontend role checks.

All authorization must be enforced server-side.

---

18. AUTHORIZATION

Implement RBAC and least privilege.

Roles should include:

FARMER
CHECKIN_OPERATOR
WEIGHING_OPERATOR
QUALITY_OPERATOR
PROCUREMENT_OPERATOR
CENTRE_ADMIN
DISTRICT_ADMIN
STATE_ADMIN
GOVERNMENT_ADMIN
AUDITOR
SYSTEM_ADMIN

Permissions should be granular.

Example:

QUALITY_OPERATOR:
quality:create
quality:update
quality:view

but NOT:

procurement:override
user:delete
system:admin

Every privileged operation must be auditable.

---

19. SECURITY

Implement:

- secure password hashing where passwords are used
- short-lived access tokens
- refresh-token rotation
- secure HttpOnly cookies where appropriate
- CSRF protection where applicable
- CORS configuration
- Helmet/security headers
- input validation
- schema validation
- rate limiting
- brute-force protection
- OTP throttling
- account lock/risk controls
- authorization middleware
- audit logging
- secret management
- encryption in transit
- encryption at rest where infrastructure supports it
- secure file handling
- protection against injection
- protection against replay
- idempotency
- request correlation IDs
- security event logging

Never expose secrets in frontend.

Never commit credentials.

Never store unnecessary Aadhaar/identity information.

Where government identity verification is eventually integrated, use the authorised government mechanism rather than building an unofficial Aadhaar workflow.

---

20. API IDEMPOTENCY

Critical government/procurement operations must be idempotent.

For example:

POST /bookings

must not create two bookings if the client retries due to network failure.

Use:

Idempotency-Key

and persist the result.

Do the same for important synchronization/update operations.

---

21. GOVERNMENT API FAILURE

Government integration failure MUST NOT bring down the coordination platform.

Architecture:

Our System
↓
Integration Service
↓
Government API
│
├── Success → mark SYNCED
│
└── Failure
↓
retry queue
↓
exponential backoff
↓
circuit breaker
↓
reconciliation

Implement:

- timeout
- retry
- exponential backoff
- circuit breaker
- dead-letter queue
- idempotency
- reconciliation
- sync status
- manual retry
- audit logs

Show integration health on the government dashboard.

---

22. MILLIONS OF USERS

Design for horizontal scalability.

Architecture:

CDN/WAF
↓
Load Balancer
↓
Multiple API Instances
↓
Redis
↓
Database
↓
Read Replicas / scaling mechanism
↓
Workers / Message Broker

Do not create a single-server architecture.

Stateless API instances should be preferred.

Avoid storing local session state on a single server.

Use caching for high-read endpoints.

Use pagination everywhere.

Use indexes properly.

Use asynchronous processing for:

- notifications
- analytics
- external synchronization
- non-critical background processing
- model updates

Do NOT make all operations synchronous.

---

23. REAL-TIME SCALABILITY

Use WebSockets/SSE for live queue updates.

Do not broadcast every event to every user.

Use:

centre-specific channels
booking-specific channels
role-specific channels

Example:

centre:C001
booking:B1024
government:state:BR

Use Redis Pub/Sub or a scalable event distribution mechanism when running multiple API instances.

---

24. BREAKDOWN / DISASTER RESILIENCE

Design explicit failure handling.

API server failure

Load balancer routes to healthy instance.

Redis failure

Core durable data remains safe; live state can be reconstructed/recovered.

Database failure

Use managed replication/failover architecture.

Message broker failure

Persist/retry critical events.

Notification service failure

Booking remains successful; notification is retried.

AI service failure

Fallback to deterministic rule-based scheduling.

Government API failure

Core platform continues; synchronization becomes pending and retries later.

One counter fails

Centre dashboard marks the counter unavailable and scheduler recalculates feasible capacity.

Network failure at centre

Support controlled offline/poor-connectivity workflow where practical, then reconcile when connectivity returns.

---

25. OBSERVABILITY

Build:

- structured logs
- metrics
- traces
- health checks
- readiness checks
- liveness checks
- API latency monitoring
- queue depth monitoring
- error-rate monitoring
- database monitoring
- Redis monitoring
- integration health
- scheduler execution metrics

Every request should have a correlation/request ID.

Every important scheduling decision should be traceable.

---

26. AUDITABILITY

For government-grade operation, record:

- who performed action
- what action
- when
- previous value
- new value
- source
- request ID
- reason where applicable

Scheduling decisions should record:

- candidate farmer
- constraints evaluated
- prediction used
- decision
- reason
- timestamp

Never silently modify critical records.

---

27. FRONTEND

Build a professional government-grade responsive UI.

Avoid flashy startup-style design.

Use:

- clear typography
- accessible contrast
- Hindi + English ready architecture
- mobile-first farmer experience
- desktop/tablet operator dashboard
- responsive government command centre
- clear status indicators
- maps only where useful
- charts only where useful
- minimal animations
- clear error states
- loading states
- empty states
- offline/connection status

---

28. FARMER UX

The farmer should understand:

1. Where am I booked?
2. When should I arrive?
3. What is my token?
4. How many farmers are ahead?
5. What is my current ETA?
6. Has the centre been delayed?
7. Has my booking changed?
8. What is my procurement status?
9. What is my payment status?

Do not overwhelm the farmer with technical information.

---

29. CENTRE DASHBOARD

Build a high-quality live dashboard.

Show:

CENTRE CAPACITY
BOOKED QUANTITY
REMAINING CAPACITY
CURRENT QUEUE
PROCESSING RATE
ACTIVE COUNTERS
COUNTER STATUS
DELAYED FARMERS
NO-SHOWS
CANCELLATIONS
CURRENT ETA
BOTTLENECKS
SCHEDULING ALERTS

Show system recommendations but let authorised operators control permitted exceptions.

---

30. GOVERNMENT COMMAND CENTRE

Show:

- state → district → centre hierarchy
- live centre status
- queue
- workload
- utilisation
- procurement
- bottlenecks
- delayed centres
- integration health
- anomalies
- historical trends
- operational KPIs

Allow drill-down:

State
→ District
→ Centre
→ Queue
→ Booking
→ Event history

---

31. AI / ML IMPLEMENTATION

Do NOT add random generative AI/chatbot features.

The AI must solve actual scheduling problems.

Create prediction interfaces such as:

predictServiceTime()
predictArrivalPattern()
predictNoShowRisk()

Store prediction metadata:

- model version
- input features
- prediction
- timestamp
- confidence/uncertainty where supported

The scheduler consumes predictions but remains deterministic and constraint-driven.

---

32. FALLBACK SCHEDULER

The system MUST work without AI.

If prediction service is:

- unavailable
- slow
- uncertain
- producing invalid output

use deterministic fallback estimates/rules.

33. TESTING
Build:
Unit tests Integration tests API tests Authentication tests Authorization tests Scheduler tests Concurrency tests Idempotency tests Failure-recovery tests Load tests Security tests End-to-end tests
Create test scenarios for:
normal booking
duplicate booking request
cancellation
no-show
early arrival
late arrival
centre full
counter failure
government API failure
Redis failure
AI failure
network interruption
simultaneous bookings
concurrent capacity allocation
34. LOAD TESTING
Do not simply claim:
"Supports millions."
Create a load-testing strategy.
Measure:
requests/sec
concurrent users
booking throughput
queue-update throughput
database latency
scheduler latency
WebSocket connections
error rate
recovery time
The actual capacity must be established by testing and infrastructure sizing.
Do not fabricate performance numbers.
35. DEVELOPMENT MODE VS PRODUCTION MODE
Clearly separate:
DEMO / DEVELOPMENT
Mock Government Provider Synthetic farmer data Synthetic centre data Synthetic historical data Test payment status Test notifications
PRODUCTION
Authorised Government APIs Real government identity/eligibility mechanisms Real centre master data Real procurement data Approved notification gateways Approved payment/status integrations
Never mix these environments.

36. ENVIRONMENT CONFIGURATION
Use:
development staging production
Use environment variables/secrets manager.
Never hardcode:
API keys
JWT secrets
database passwords
government credentials
OTP provider credentials
cloud credentials
37. DEPLOYMENT
Prepare deployment for cloud infrastructure.
Use containers.
Provide:
Dockerfile docker-compose for development production deployment configuration health checks environment configuration database migration/seed strategy logging monitoring
The architecture should be compatible with:
AWS / Azure / GCP / Government-approved cloud/on-premise infrastructure.
Do not hard-code the system to one cloud provider.

38. DATA PRIVACY
Follow data minimisation.
Store only what is required.
Separate:
identity data operational data analytics data audit data
Avoid storing sensitive identity information unless explicitly required by an authorised integration.
Provide retention policies.
Do not expose farmer personal data on public dashboards.
39. GOVERNMENT INTEGRATION CONTRACT
Create documentation inside the project:
/docs/integration/
Include:
government-api-contract.md authentication.md data-mapping.md sync-strategy.md failure-handling.md reconciliation.md
Clearly document that real government endpoints will be configured only after official API documentation/credentials are supplied.
40. PROJECT STRUCTURE
Use a clean modular structure.
Example:
backend/ src/ modules/ auth/ farmers/ centres/ bookings/ scheduling/ queue/ operations/ procurement/ notifications/ analytics/ predictions/ integrations/ audit/ infrastructure/ database/ redis/ events/ logging/ security/ shared/
frontend/ src/ modules/ farmer/ centre/ government/ auth/ components/ services/ hooks/ realtime/
integration/ mock-government/ adapters/
docs/ architecture/ integration/ security/ deployment/
tests/ unit/ integration/ e2e/ load/
41. UI PAGES TO IMPLEMENT
Farmer
/login /register /dashboard /profile /centres /book /booking/:id /live-queue /status /payment-status /history /notifications
Centre
/centre/dashboard /centre/queue /centre/schedule /centre/check-in /centre/weighing /centre/quality /centre/procurement /centre/counters /centre/capacity /centre/exceptions
Government
/admin/dashboard /admin/states /admin/districts /admin/centres /admin/live-monitoring /admin/bottlenecks /admin/utilisation /admin/integrations /admin/audit /admin/analytics
42. DEMO SCENARIO
Create seed data so the complete SIH demonstration works.
Create a centre with:
multiple counters
finite capacity
multiple farmers
different quantities
different processing times
several booked arrival windows
Then demonstrate:
F1 arrives F2 arrives late F3 is processed F4 cancels F5 becomes no-show Counter 2 becomes delayed
The system should:
update live queue
update ETA
release unavailable/unused expected capacity
evaluate already-booked farmers
move only feasible farmers
avoid exceeding physical capacity
notify affected farmers
update centre dashboard
update government command centre
record every scheduling decision
This scenario is essential for the SIH prototype.

43. IMPORTANT PRODUCT POSITIONING
The application must communicate:
"We do not replace government procurement systems."
Instead:
"We coordinate the procurement ecosystem around existing government systems."
Use wording such as:
Existing Government Platforms → Official procurement/eligibility/payment/data systems
Our Platform → Real-time coordination, scheduling, queue and operational intelligence
Integration Layer → Secure authorised data exchange
44. DO NOT BUILD THESE UNNECESSARILY
Do not build:
cryptocurrency
blockchain merely for marketing
generic chatbot
unnecessary generative AI
fake Aadhaar verification
fake government API integration
unnecessary microservices
unnecessary maps
arbitrary percentage claims
fake performance metrics
fake government approval
fake government data
Every technology must solve a real problem.
45. QUALITY BAR
The result must look like a serious government digital public infrastructure product, not a college CRUD project.
Prioritize:
correctness
security
reliability
auditability
scalability
maintainability
accessibility
observability
integration readiness
UI quality
Do not sacrifice correctness for visual effects.

46. IMPLEMENTATION METHOD
Do NOT generate the entire project blindly in one step.
First:
inspect the repository
create architecture document
create database/domain model
create API contracts
create integration contracts
create authentication/RBAC design
create scheduling design
create failure-handling design
create deployment architecture
Then implement incrementally.
After every major module:
run tests
verify types
verify API contracts
verify security
verify database operations
verify error handling
Do not break existing working functionality while adding modules.
47. FIRST TASK
Before writing large amounts of code:
Create:
/docs/ARCHITECTURE.md /docs/SECURITY.md /docs/GOVERNMENT-INTEGRATION.md /docs/SCHEDULER.md /docs/SCALABILITY.md /docs/FAILURE-HANDLING.md /docs/DEPLOYMENT.md
Then show the proposed architecture and implementation phases.
After architecture approval, begin implementation with:
PHASE 1: Authentication + RBAC + database + API foundation + audit logging + Mock Government Provider.
PHASE 2: Farmer + Centre + Booking + Capacity.
PHASE 3: Constraint Scheduler + Queue + ETA + Dynamic Adaptation.
PHASE 4: Centre Operations + Government Command Centre.
PHASE 5: Redis + WebSockets + Event Bus + Notifications.
PHASE 6: Prediction Engine.
PHASE 7: Production hardening + load testing + security testing + failure testing + deployment.
FINAL RULE:
Build a system that can genuinely evolve from an SIH prototype into a production-grade coordination platform.
Never pretend that an unavailable government API is connected.
Never replace government systems unnecessarily.
Never let AI override physical constraints.
Never allow a single component failure to bring down the entire platform.
Every critical decision must be explainable and auditable.