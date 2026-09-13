import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../../src/infrastructure/redis/redis.service';
import { EventBusService } from '../../src/infrastructure/events/event-bus.service';
import { DomainEvent, DomainEventType } from '../../src/infrastructure/events/domain-events';
import { RealtimeService } from '../../src/modules/realtime/realtime.service';
import { RealtimeGateway } from '../../src/modules/realtime/realtime.gateway';
import { RealtimeController } from '../../src/modules/realtime/realtime.controller';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { NotificationsController } from '../../src/modules/notifications/notifications.controller';
import { Notification } from '../../src/modules/notifications/schemas/notification.schema';
import { Booking, BookingStatus } from '../../src/modules/bookings/schemas/booking.schema';
import { ArrivalWindow } from '../../src/modules/bookings/schemas/arrival-window.schema';
import { Centre } from '../../src/modules/centres/schemas/centre.schema';
import { Counter, CounterStatus, CounterStage } from '../../src/modules/centres/schemas/counter.schema';
import { SchedulingDecision } from '../../src/modules/scheduling/schemas/scheduling-decision.schema';
import { SchedulingService } from '../../src/modules/scheduling/scheduling.service';
import { Role } from '../../src/shared/enums/roles.enum';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { GOVERNMENT_DATA_PROVIDER } from '../../src/modules/integrations/contracts/government-data-provider.interface';
import { MockGovernmentProvider } from '../../src/modules/integrations/providers/mock-government.provider';
import { createMockModel } from './in-memory-mongo.mock';

describe('Phase 5: Redis + WebSockets + Event Bus + Notifications (Integration Tests)', () => {
  let app: INestApplication;
  let redisService: RedisService;
  let eventBusService: EventBusService;
  let realtimeService: RealtimeService;
  let realtimeGateway: RealtimeGateway;
  let notificationsService: NotificationsService;
  let schedulingService: SchedulingService;

  let notificationModel: any;
  let bookingModel: any;
  let windowModel: any;
  let centreModel: any;
  let counterModel: any;
  let decisionModel: any;

  // Track the authenticated user for request-level mocking
  let activeTestUser: any = null;

  beforeAll(async () => {
    notificationModel = createMockModel();
    bookingModel = createMockModel();
    windowModel = createMockModel();
    centreModel = createMockModel();
    counterModel = createMockModel();
    decisionModel = createMockModel();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController, RealtimeController],
      providers: [
        RedisService,
        EventBusService,
        RealtimeService,
        RealtimeGateway,
        NotificationsService,
        SchedulingService,
        JwtService,
        ConfigService,
        {
          provide: GOVERNMENT_DATA_PROVIDER,
          useClass: MockGovernmentProvider,
        },
        { provide: getModelToken(Notification.name), useValue: notificationModel },
        { provide: getModelToken(Booking.name), useValue: bookingModel },
        { provide: getModelToken(ArrivalWindow.name), useValue: windowModel },
        { provide: getModelToken(Centre.name), useValue: centreModel },
        { provide: getModelToken(Counter.name), useValue: counterModel },
        { provide: getModelToken(SchedulingDecision.name), useValue: decisionModel },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = activeTestUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    redisService = moduleFixture.get<RedisService>(RedisService);
    eventBusService = moduleFixture.get<EventBusService>(EventBusService);
    realtimeService = moduleFixture.get<RealtimeService>(RealtimeService);
    realtimeGateway = moduleFixture.get<RealtimeGateway>(RealtimeGateway);
    notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);
    schedulingService = moduleFixture.get<SchedulingService>(SchedulingService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    notificationModel._getStore().length = 0;
    bookingModel._getStore().length = 0;
    windowModel._getStore().length = 0;
    centreModel._getStore().length = 0;
    counterModel._getStore().length = 0;
    decisionModel._getStore().length = 0;
    activeTestUser = null;
  });

  // ==========================================================================
  // 1. Redis Caching, Live-State & Distributed Locking (Section 16)
  // ==========================================================================
  describe('1. Redis Caching, Live State & Distributed Locks', () => {
    it('should set, retrieve and delete live queue state with TTL', async () => {
      const centreId = 'CENTRE-MP-IND-01';
      const liveQueueData = {
        centreId,
        activeTokensInYard: ['T-001', 'T-002'],
        stageWaitCounts: { CHECKIN: 0, WEIGHING: 2, QUALITY: 1, PROCUREMENT: 0 },
        bottleneckStage: 'WEIGHING',
        updatedAt: new Date().toISOString(),
      };

      await redisService.setLiveQueueState(centreId, liveQueueData, 3600);
      const cached = await redisService.getLiveQueueState(centreId);

      expect(cached).toBeDefined();
      expect(cached.centreId).toBe(centreId);
      expect(cached.activeTokensInYard).toHaveLength(2);
      expect(cached.bottleneckStage).toBe('WEIGHING');

      await redisService.delLiveQueueState(centreId);
      const afterDel = await redisService.getLiveQueueState(centreId);
      expect(afterDel).toBeNull();
    });

    it('should set and retrieve live ETA cache for farmer mobile apps', async () => {
      const bookingId = 'BK-20260913-IND01-001';
      const etaPayload = {
        bookingId,
        currentStage: 'WEIGHING',
        estimatedWaitMinutes: 18,
        estimatedServiceStart: '10:35',
        confidenceScore: 0.94,
      };

      await redisService.setLiveEta(bookingId, etaPayload, 1800);
      const cachedEta = await redisService.getLiveEta(bookingId);

      expect(cachedEta).toBeDefined();
      expect(cachedEta.bookingId).toBe(bookingId);
      expect(cachedEta.estimatedWaitMinutes).toBe(18);
    });

    it('should acquire distributed lock and prevent concurrent race conditions', async () => {
      const resource = 'centre:CENTRE-MP-IND-01:scheduler';

      // First caller acquires lock
      const token1 = await redisService.acquireLock(resource, 5000);
      expect(token1).toBeTruthy();

      // Second concurrent caller tries to acquire the same resource
      const token2 = await redisService.acquireLock(resource, 5000);
      expect(token2).toBeNull(); // Must be rejected!

      // Releasing with wrong token must fail
      const wrongRelease = await redisService.releaseLock(resource, 'invalid-token-123');
      expect(wrongRelease).toBe(false);

      // Releasing with correct token must succeed
      const correctRelease = await redisService.releaseLock(resource, token1!);
      expect(correctRelease).toBe(true);

      // Now another caller can successfully acquire
      const token3 = await redisService.acquireLock(resource, 5000);
      expect(token3).toBeTruthy();
      await redisService.releaseLock(resource, token3!);
    });
  });

  // ==========================================================================
  // 2. Domain Event Bus (Section 14)
  // ==========================================================================
  describe('2. Event Bus Wiring & Decoupled Dispatch', () => {
    it('should publish domain events to all registered subscribers', async () => {
      const receivedEvents: DomainEvent[] = [];
      const testHandler = (event: DomainEvent) => {
        receivedEvents.push(event);
      };

      eventBusService.subscribe(DomainEventType.COUNTER_AVAILABLE, testHandler);

      const testEvent: DomainEvent = {
        eventId: 'EVT-TEST-001',
        eventType: DomainEventType.COUNTER_AVAILABLE,
        timestamp: new Date(),
        centreId: 'CENTRE-MP-IND-01',
        payload: { counterId: 'WGH-01', stage: 'WEIGHING' },
      };

      await eventBusService.publish(testEvent);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].eventId).toBe('EVT-TEST-001');
      expect(receivedEvents[0].payload.counterId).toBe('WGH-01');

      eventBusService.unsubscribe(DomainEventType.COUNTER_AVAILABLE, testHandler);
    });

    it('should ensure failure in one subscriber does not crash other subscribers', async () => {
      let healthySubscriberExecuted = false;

      const failingHandler = () => {
        throw new Error('Subscriber intentional explosion');
      };
      const healthyHandler = () => {
        healthySubscriberExecuted = true;
      };

      eventBusService.subscribe(DomainEventType.COUNTER_BUSY, failingHandler);
      eventBusService.subscribe(DomainEventType.COUNTER_BUSY, healthyHandler);

      await eventBusService.publish({
        eventId: 'EVT-FAIL-TEST',
        eventType: DomainEventType.COUNTER_BUSY,
        timestamp: new Date(),
        centreId: 'CENTRE-01',
        payload: { counterId: 'WGH-02' },
      });

      expect(healthySubscriberExecuted).toBe(true);

      eventBusService.unsubscribe(DomainEventType.COUNTER_BUSY, failingHandler);
      eventBusService.unsubscribe(DomainEventType.COUNTER_BUSY, healthyHandler);
    });
  });

  // ==========================================================================
  // 3. Scoped Real-Time Channels & Channel Authorization (Section 23)
  // ==========================================================================
  describe('3. Scoped WebSocket Channels & Authorization Guards', () => {
    beforeEach(async () => {
      await bookingModel.create({
        bookingId: 'BK-FARMER-01',
        farmerId: 'FARMER-IND-100',
        centreId: 'CENTRE-MP-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 50,
        bookingDate: '2026-09-13',
        status: BookingStatus.CONFIRMED,
        tokenNumber: 'T-001',
        arrivalWindow: { slotIndex: 1, startTime: '10:00', endTime: '11:00' },
      });
    });

    it('FARMER should ONLY be allowed to join their own booking channel', async () => {
      const farmerUser = { id: 'FARMER-IND-100', role: Role.FARMER };

      // Own booking channel -> Allowed
      const allowed = await realtimeGateway.validateChannelAccess(farmerUser, 'booking:BK-FARMER-01');
      expect(allowed).toBe(true);

      // Other farmer's booking channel -> FORBIDDEN
      const deniedOtherBooking = await realtimeGateway.validateChannelAccess(
        farmerUser,
        'booking:BK-FARMER-999',
      );
      expect(deniedOtherBooking).toBe(false);

      // Internal operator channel -> FORBIDDEN
      const deniedCentreChannel = await realtimeGateway.validateChannelAccess(
        farmerUser,
        'centre:CENTRE-MP-IND-01',
      );
      expect(deniedCentreChannel).toBe(false);
    });

    it('OPERATOR should ONLY be allowed to join their assigned centre channel', async () => {
      const operatorUser = {
        id: 'OP-001',
        role: Role.WEIGHING_OPERATOR,
        centreId: 'CENTRE-MP-IND-01',
      };

      // Assigned centre -> Allowed
      const allowed = await realtimeGateway.validateChannelAccess(operatorUser, 'centre:CENTRE-MP-IND-01');
      expect(allowed).toBe(true);

      // Other centre channel -> FORBIDDEN
      const denied = await realtimeGateway.validateChannelAccess(operatorUser, 'centre:CENTRE-RJ-KOT-01');
      expect(denied).toBe(false);
    });

    it('DISTRICT_ADMIN should ONLY be allowed to join their assigned district channel', async () => {
      const districtAdmin = {
        id: 'DA-IND-01',
        role: Role.DISTRICT_ADMIN,
        districtId: 'Indore',
      };

      const allowedOwn = await realtimeGateway.validateChannelAccess(
        districtAdmin,
        'government:district:Indore',
      );
      expect(allowedOwn).toBe(true);

      const deniedOther = await realtimeGateway.validateChannelAccess(
        districtAdmin,
        'government:district:Ujjain',
      );
      expect(deniedOther).toBe(false);
    });

    it('STATE_ADMIN should ONLY be allowed to join their assigned state channel', async () => {
      const stateAdmin = {
        id: 'SA-MP-01',
        role: Role.STATE_ADMIN,
        stateId: 'Madhya Pradesh',
      };

      const allowedOwn = await realtimeGateway.validateChannelAccess(
        stateAdmin,
        'government:state:Madhya Pradesh',
      );
      expect(allowedOwn).toBe(true);

      const deniedOther = await realtimeGateway.validateChannelAccess(
        stateAdmin,
        'government:state:Rajasthan',
      );
      expect(deniedOther).toBe(false);
    });

    it('GOVERNMENT_ADMIN should have access to national government channel', async () => {
      const govtAdmin = { id: 'GOV-ADMIN-01', role: Role.GOVERNMENT_ADMIN };
      const farmer = { id: 'FARMER-IND-100', role: Role.FARMER };

      expect(await realtimeGateway.validateChannelAccess(govtAdmin, 'government:national')).toBe(true);
      expect(await realtimeGateway.validateChannelAccess(farmer, 'government:national')).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Cross-Pod Redis Pub/Sub Simulation (Section 23)
  // ==========================================================================
  describe('4. Cross-Instance Pub/Sub Distribution', () => {
    it('should propagate messages across simulated instances via Redis Pub/Sub', async () => {
      const receivedMessages: any[] = [];
      const testChannel = 'ws:test:cross_instance';

      await redisService.subscribe(testChannel, (ch, msg) => {
        receivedMessages.push({ channel: ch, content: JSON.parse(msg) });
      });

      const payload = { event: 'WEIGHMENT_COMPLETED', netWeight: 45.2 };
      await redisService.publish(testChannel, JSON.stringify(payload));

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].channel).toBe(testChannel);
      expect(receivedMessages[0].content.event).toBe('WEIGHMENT_COMPLETED');
      expect(receivedMessages[0].content.netWeight).toBe(45.2);

      await redisService.unsubscribe(testChannel);
    });
  });

  // ==========================================================================
  // 5. Dynamic Adaptation End-to-End Live Notification Flow
  // ==========================================================================
  describe('5. Dynamic Adaptation -> EventBus -> Notification Pipeline', () => {
    it('should trigger SCHEDULING_UPDATED on no-show and persist notification for moved farmer', async () => {
      const centreId = 'CENTRE-MP-IND-01';
      const date = '2026-09-13';

      // 1. Setup Centre
      await centreModel.create({
        centreId,
        name: 'Indore Central Mandi',
        district: 'Indore',
        state: 'Madhya Pradesh',
        status: 'ACTIVE',
        maxSimultaneousVehicles: 20,
        operatingHours: { open: '09:00', close: '18:00' },
      });

      // 2. Setup Active Counters
      await counterModel.create([
        { centreId, counterId: 'C-01', stage: CounterStage.CHECKIN, status: CounterStatus.ACTIVE },
        { centreId, counterId: 'W-01', stage: CounterStage.WEIGHING, status: CounterStatus.ACTIVE },
        { centreId, counterId: 'Q-01', stage: CounterStage.QUALITY, status: CounterStatus.ACTIVE },
        { centreId, counterId: 'P-01', stage: CounterStage.PROCUREMENT, status: CounterStatus.ACTIVE },
      ]);

      // 3. Setup Arrival Windows
      await windowModel.create([
        {
          centreId,
          date,
          slotIndex: 0,
          startTime: '09:00',
          endTime: '10:00',
          bookedQuantityQuintals: 40,
          bookingCount: 1,
        },
        {
          centreId,
          date,
          slotIndex: 3,
          startTime: '12:00',
          endTime: '13:00',
          bookedQuantityQuintals: 30,
          bookingCount: 1,
        },
      ]);

      // 4. Create Bookings:
      // Booking 1: Slot 0 (09:00 - 10:00), 40Q -> Will be NO_SHOW
      const freedBooking = await bookingModel.create({
        bookingId: 'BK-NO-SHOW-01',
        tokenNumber: 'T-001',
        farmerId: 'FARMER-001',
        centreId,
        commodityCode: 'WHEAT',
        quantityQuintals: 40,
        bookingDate: date,
        arrivalWindow: { slotIndex: 0, startTime: '09:00', endTime: '10:00' },
        status: BookingStatus.CONFIRMED,
        vehicleCount: 1,
      });

      // Booking 2: Slot 3 (12:00 - 13:00), 30Q -> Candidate to move forward
      const candidateBooking = await bookingModel.create({
        bookingId: 'BK-CANDIDATE-02',
        tokenNumber: 'T-002',
        farmerId: 'FARMER-002',
        centreId,
        commodityCode: 'WHEAT',
        quantityQuintals: 30,
        bookingDate: date,
        arrivalWindow: { slotIndex: 3, startTime: '12:00', endTime: '13:00' },
        status: BookingStatus.BOOKED,
        vehicleCount: 1,
      });

      // 5. Execute Dynamic Adaptation triggered by No-Show
      // Simulated time: 07:30 AM (Plenty of notice time before 09:00 AM slot)
      const simulatedTime = new Date('2026-09-13T07:30:00Z');
      const adaptationReport = await schedulingService.recomputeScheduleOnFreedCapacity(
        freedBooking,
        'NO_SHOW',
        simulatedTime,
      );

      // Verify adaptation decision
      expect(adaptationReport.candidatesMovedCount).toBe(1);
      expect(adaptationReport.evaluations[0].decision).toBe('MOVED_FORWARD');
      expect(adaptationReport.evaluations[0].targetSlotIndex).toBe(0);

      // 6. Verify that Notification was created for candidate farmer
      const notifications = await notificationsService.getNotificationsForUser('FARMER-002');
      expect(notifications.length).toBeGreaterThanOrEqual(1);

      const forwardNotif = notifications.find(
        (n) => n.eventType === DomainEventType.SCHEDULING_UPDATED,
      );
      expect(forwardNotif).toBeDefined();
      expect(forwardNotif?.title).toContain('Slot Moved Forward');
      expect(forwardNotif?.recipientUserId).toBe('FARMER-002');
      expect(forwardNotif?.bookingId).toBe('BK-CANDIDATE-02');
    });
  });

  // ==========================================================================
  // 6. Notifications REST API
  // ==========================================================================
  describe('6. Notifications REST API Endpoints', () => {
    beforeEach(async () => {
      activeTestUser = { id: 'FARMER-REST-01', role: Role.FARMER };

      // Seed 2 notifications
      await notificationModel.create([
        {
          notificationId: 'NOTIF-01',
          recipientUserId: 'FARMER-REST-01',
          recipientType: 'FARMER',
          eventType: 'BOOKING_CONFIRMED',
          title: 'Booking Confirmed',
          body: 'Your booking has been confirmed.',
          channel: 'IN_APP',
          read: false,
        },
        {
          notificationId: 'NOTIF-02',
          recipientUserId: 'FARMER-REST-01',
          recipientType: 'FARMER',
          eventType: 'TOKEN_ASSIGNED',
          title: 'Token Assigned',
          body: 'Your token is T-005.',
          channel: 'IN_APP',
          read: false,
        },
      ]);
    });

    it('GET /notifications should return user notifications', async () => {
      const res = await request(app.getHttpServer()).get('/notifications').expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });

    it('GET /notifications/unread-count should return accurate unread badge count', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .expect(200);

      expect(res.body.unreadCount).toBe(2);
    });

    it('PATCH /notifications/:id/read should mark a notification as read', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/NOTIF-01/read')
        .expect(200);

      const countRes = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .expect(200);

      expect(countRes.body.unreadCount).toBe(1);
    });

    it('POST /notifications/mark-all-read should mark all notifications as read', async () => {
      await request(app.getHttpServer())
        .post('/notifications/mark-all-read')
        .expect(201);

      const countRes = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .expect(200);

      expect(countRes.body.unreadCount).toBe(0);
    });
  });

  // ==========================================================================
  // 7. Server-Sent Events (SSE) Authorization Guard (Section 23)
  // ==========================================================================
  describe('7. SSE Scoped Channel Streaming Guard', () => {
    it('should return 400 Bad Request if channel query parameter is missing', async () => {
      activeTestUser = { id: 'FARMER-01', role: Role.FARMER };
      await request(app.getHttpServer()).get('/realtime/sse').expect(400);
    });

    it('should return 403 Forbidden if user is unauthorized for channel', async () => {
      activeTestUser = { id: 'FARMER-01', role: Role.FARMER };
      // Farmer attempting to access centre operator channel
      await request(app.getHttpServer())
        .get('/realtime/sse?channel=centre:CENTRE-MP-IND-01')
        .expect(403);
    });
  });
});
