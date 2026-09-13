import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';

import { RedisModule } from '../../src/infrastructure/redis/redis.module';
import { SecurityModule } from '../../src/infrastructure/security/security.module';
import { AuditModule } from '../../src/modules/audit/audit.module';
import { IntegrationsModule } from '../../src/modules/integrations/integrations.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { FarmersModule } from '../../src/modules/farmers/farmers.module';
import { CentresModule } from '../../src/modules/centres/centres.module';
import { BookingsModule } from '../../src/modules/bookings/bookings.module';
import { SchedulingModule } from '../../src/modules/scheduling/scheduling.module';
import { QueueModule } from '../../src/modules/queue/queue.module';
import { OperationsModule } from '../../src/modules/operations/operations.module';
import { CommandCentreModule } from '../../src/modules/command-centre/command-centre.module';

import { Role } from '../../src/shared/enums/roles.enum';
import { User } from '../../src/modules/auth/schemas/user.schema';
import { RefreshToken } from '../../src/modules/auth/schemas/refresh-token.schema';
import { AuditLog } from '../../src/modules/audit/schemas/audit-log.schema';
import { IdempotencyRecord } from '../../src/infrastructure/security/schemas/idempotency-record.schema';
import { Farmer } from '../../src/modules/farmers/schemas/farmer.schema';
import { Centre } from '../../src/modules/centres/schemas/centre.schema';
import { Counter, CounterStatus } from '../../src/modules/centres/schemas/counter.schema';
import { Commodity } from '../../src/modules/centres/schemas/commodity.schema';
import { Booking, BookingStatus } from '../../src/modules/bookings/schemas/booking.schema';
import { BookingVehicle } from '../../src/modules/bookings/schemas/booking-vehicle.schema';
import { ArrivalWindow } from '../../src/modules/bookings/schemas/arrival-window.schema';
import { QueueState, QueueStatus } from '../../src/modules/queue/schemas/queue-state.schema';
import { SchedulingDecision } from '../../src/modules/scheduling/schemas/scheduling-decision.schema';
import { WeighingRecord } from '../../src/modules/operations/schemas/weighing-record.schema';
import { QualityRecord, QualityGrade, QualityVerdict } from '../../src/modules/operations/schemas/quality-record.schema';
import { ProcurementRecord, GovSyncStatus } from '../../src/modules/operations/schemas/procurement-record.schema';
import { ServiceSession } from '../../src/modules/operations/schemas/service-session.schema';

import { createMockModel } from './in-memory-mongo.mock';

describe('Phase 4: Centre Operations + Government Command Centre (Integration Tests)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  // Mock Models
  let userModel: any;
  let refreshTokenModel: any;
  let auditLogModel: any;
  let idempotencyModel: any;
  let farmerModel: any;
  let centreModel: any;
  let counterModel: any;
  let commodityModel: any;
  let bookingModel: any;
  let vehicleModel: any;
  let windowModel: any;
  let queueModel: any;
  let schedulingModel: any;
  let weighingModel: any;
  let qualityModel: any;
  let procurementModel: any;
  let sessionModel: any;

  // Tokens for all 11 roles
  let farmerToken: string;
  let checkinOpToken: string;
  let weighingOpToken: string;
  let qualityOpToken: string;
  let procurementOpToken: string;
  let centreAdminToken: string;
  let districtAdminIndoreToken: string;
  let districtAdminUjjainToken: string;
  let stateAdminMPToken: string;
  let stateAdminRJToken: string;
  let govAdminToken: string;
  let auditorToken: string;
  let systemAdminToken: string;

  const TODAY = new Date().toISOString().split('T')[0];

  beforeAll(async () => {
    userModel = createMockModel();
    refreshTokenModel = createMockModel();
    auditLogModel = createMockModel();
    idempotencyModel = createMockModel();
    farmerModel = createMockModel();
    centreModel = createMockModel();
    counterModel = createMockModel();
    commodityModel = createMockModel();
    bookingModel = createMockModel();
    vehicleModel = createMockModel();
    windowModel = createMockModel();
    queueModel = createMockModel();
    schedulingModel = createMockModel();
    weighingModel = createMockModel();
    qualityModel = createMockModel();
    procurementModel = createMockModel();
    sessionModel = createMockModel();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              JWT_ACCESS_SECRET: 'test_jwt_access_secret_super_secure_32chars',
              JWT_ACCESS_EXPIRES_IN: '15m',
              JWT_REFRESH_SECRET: 'test_jwt_refresh_secret_super_secure_32chars',
              OTP_TTL_SECONDS: 300,
              OTP_MAX_ATTEMPTS: 3,
            }),
          ],
        }),
        RedisModule,
        SecurityModule,
        AuditModule,
        IntegrationsModule,
        AuthModule,
        FarmersModule,
        CentresModule,
        BookingsModule,
        SchedulingModule,
        QueueModule,
        OperationsModule,
        CommandCentreModule,
      ],
    })
      .overrideProvider(getModelToken(User.name)).useValue(userModel)
      .overrideProvider(getModelToken(RefreshToken.name)).useValue(refreshTokenModel)
      .overrideProvider(getModelToken(AuditLog.name)).useValue(auditLogModel)
      .overrideProvider(getModelToken(IdempotencyRecord.name)).useValue(idempotencyModel)
      .overrideProvider(getModelToken(Farmer.name)).useValue(farmerModel)
      .overrideProvider(getModelToken(Centre.name)).useValue(centreModel)
      .overrideProvider(getModelToken(Counter.name)).useValue(counterModel)
      .overrideProvider(getModelToken(Commodity.name)).useValue(commodityModel)
      .overrideProvider(getModelToken(Booking.name)).useValue(bookingModel)
      .overrideProvider(getModelToken(BookingVehicle.name)).useValue(vehicleModel)
      .overrideProvider(getModelToken(ArrivalWindow.name)).useValue(windowModel)
      .overrideProvider(getModelToken(QueueState.name)).useValue(queueModel)
      .overrideProvider(getModelToken(SchedulingDecision.name)).useValue(schedulingModel)
      .overrideProvider(getModelToken(WeighingRecord.name)).useValue(weighingModel)
      .overrideProvider(getModelToken(QualityRecord.name)).useValue(qualityModel)
      .overrideProvider(getModelToken(ProcurementRecord.name)).useValue(procurementModel)
      .overrideProvider(getModelToken(ServiceSession.name)).useValue(sessionModel)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Helper to issue JWT tokens and seed user in userModel
    const createAndIssueToken = async (userIdStr: string, name: string, role: Role, scope: any = {}) => {
      const _id = new Types.ObjectId();
      await userModel.create({
        _id,
        name,
        email: `${userIdStr}@procure.gov.in`,
        role,
        scope,
        tokenVersion: 1,
        isActive: true,
      });
      return jwtService.sign({
        sub: _id.toString(),
        role,
        scope,
        tokenVersion: 1,
      });
    };

    // Generate tokens and seed users for all 11 roles
    farmerToken = await createAndIssueToken('user-farmer', 'Ramesh Farmer', Role.FARMER, {});
    checkinOpToken = await createAndIssueToken('user-checkin', 'Checkin Op', Role.CHECKIN_OPERATOR, { centreId: 'CENTRE-MP-IND-01' });
    weighingOpToken = await createAndIssueToken('user-weighing', 'Weighing Op', Role.WEIGHING_OPERATOR, { centreId: 'CENTRE-MP-IND-01' });
    qualityOpToken = await createAndIssueToken('user-quality', 'Quality Op', Role.QUALITY_OPERATOR, { centreId: 'CENTRE-MP-IND-01' });
    procurementOpToken = await createAndIssueToken('user-procurement', 'Procurement Op', Role.PROCUREMENT_OPERATOR, { centreId: 'CENTRE-MP-IND-01' });
    centreAdminToken = await createAndIssueToken('user-cadm', 'Centre Admin', Role.CENTRE_ADMIN, { centreId: 'CENTRE-MP-IND-01' });
    districtAdminIndoreToken = await createAndIssueToken('user-dadm-ind', 'District Admin Indore', Role.DISTRICT_ADMIN, { stateId: 'Madhya Pradesh', districtId: 'Indore' });
    districtAdminUjjainToken = await createAndIssueToken('user-dadm-ujj', 'District Admin Ujjain', Role.DISTRICT_ADMIN, { stateId: 'Madhya Pradesh', districtId: 'Ujjain' });
    stateAdminMPToken = await createAndIssueToken('user-sadm-mp', 'State Admin MP', Role.STATE_ADMIN, { stateId: 'Madhya Pradesh' });
    stateAdminRJToken = await createAndIssueToken('user-sadm-rj', 'State Admin RJ', Role.STATE_ADMIN, { stateId: 'Rajasthan' });
    govAdminToken = await createAndIssueToken('user-govadm', 'Gov Admin', Role.GOVERNMENT_ADMIN, {});
    auditorToken = await createAndIssueToken('user-auditor', 'Auditor User', Role.AUDITOR, {});
    systemAdminToken = await createAndIssueToken('user-sysadm', 'System Admin', Role.SYSTEM_ADMIN, {});

    // Seed centres across hierarchy
    await centreModel.create([
      {
        centreId: 'CENTRE-MP-IND-01',
        name: 'Sanwer Mandi Centre',
        agencyName: 'NAFED',
        state: 'Madhya Pradesh',
        district: 'Indore',
        address: 'Sanwer, Indore',
        coordinates: { latitude: 22.9, longitude: 75.8 },
        operatingSeason: 'RABI_2026',
        supportedCommodities: ['WHEAT'],
        dailyCapacityQuintals: 500,
        maxSimultaneousVehicles: 15,
        isActive: true,
      },
      {
        centreId: 'CENTRE-MP-IND-02',
        name: 'Depalpur Mandi Centre',
        agencyName: 'MP CSC',
        state: 'Madhya Pradesh',
        district: 'Indore',
        address: 'Depalpur, Indore',
        coordinates: { latitude: 22.8, longitude: 75.5 },
        operatingSeason: 'RABI_2026',
        supportedCommodities: ['WHEAT'],
        dailyCapacityQuintals: 300,
        maxSimultaneousVehicles: 10,
        isActive: true,
      },
      {
        centreId: 'CENTRE-MP-UJJ-01',
        name: 'Ujjain Main Mandi Centre',
        agencyName: 'NAFED',
        state: 'Madhya Pradesh',
        district: 'Ujjain',
        address: 'Agar Road, Ujjain',
        coordinates: { latitude: 23.1, longitude: 75.7 },
        operatingSeason: 'RABI_2026',
        supportedCommodities: ['WHEAT', 'CHANA'],
        dailyCapacityQuintals: 400,
        maxSimultaneousVehicles: 12,
        isActive: true,
      },
      {
        centreId: 'CENTRE-RJ-KOT-01',
        name: 'Kota Bhamashah Mandi Centre',
        agencyName: 'RAJFED',
        state: 'Rajasthan',
        district: 'Kota',
        address: 'Anantpura, Kota',
        coordinates: { latitude: 25.1, longitude: 75.8 },
        operatingSeason: 'RABI_2026',
        supportedCommodities: ['MUSTARD'],
        dailyCapacityQuintals: 600,
        maxSimultaneousVehicles: 20,
        isActive: true,
      },
    ]);

    // Seed counters for CENTRE-MP-IND-01
    await counterModel.create([
      { counterId: 'CTR-IND01-CK1', centreId: 'CENTRE-MP-IND-01', counterNumber: 1, stage: 'CHECKIN', capacityPerHourQuintals: 50, status: CounterStatus.ACTIVE },
      { counterId: 'CTR-IND01-WB1', centreId: 'CENTRE-MP-IND-01', counterNumber: 1, stage: 'WEIGHING', capacityPerHourQuintals: 60, status: CounterStatus.ACTIVE },
      { counterId: 'CTR-IND01-QL1', centreId: 'CENTRE-MP-IND-01', counterNumber: 1, stage: 'QUALITY', capacityPerHourQuintals: 40, status: CounterStatus.ACTIVE },
      { counterId: 'CTR-IND01-PR1', centreId: 'CENTRE-MP-IND-01', counterNumber: 1, stage: 'PROCUREMENT', capacityPerHourQuintals: 50, status: CounterStatus.ACTIVE },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  // --------------------------------------------------------------------------
  // 1. Role-Boundary Tests (Section 5 & Section 18)
  // --------------------------------------------------------------------------
  describe('1. Role-Boundary Enforcement & RBAC Violations', () => {
    it('should return 403 Forbidden when QUALITY_OPERATOR hits weighing endpoint', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/operations/weighing/complete')
        .set('Authorization', `Bearer ${qualityOpToken}`)
        .send({
          bookingId: 'BK-ROLE-01',
          counterId: 'CTR-IND01-WB1',
          vehicleNumber: 'MP-09-AB-1234',
          grossWeightQuintals: 50,
          tareWeightQuintals: 10,
        })
        .expect(403);
    });

    it('should return 403 Forbidden when CHECKIN_OPERATOR hits quality endpoint', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/operations/quality')
        .set('Authorization', `Bearer ${checkinOpToken}`)
        .send({
          bookingId: 'BK-ROLE-01',
          counterId: 'CTR-IND01-QL1',
          moisturePercentage: 11.5,
          foreignMatterPercentage: 1.0,
          damagedGrainsPercentage: 0.5,
          assignedGrade: QualityGrade.GRADE_A,
          verdict: QualityVerdict.ACCEPTED,
        })
        .expect(403);
    });

    it('should return 403 Forbidden when WEIGHING_OPERATOR hits procurement endpoint', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/operations/procurement')
        .set('Authorization', `Bearer ${weighingOpToken}`)
        .send({
          bookingId: 'BK-ROLE-01',
          counterId: 'CTR-IND01-PR1',
          finalQuantityQuintals: 40,
          mspRatePerQuintal: 2275,
        })
        .expect(403);
    });

    it('should return 403 Forbidden when PROCUREMENT_OPERATOR hits check-in endpoint', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/operations/check-in')
        .set('Authorization', `Bearer ${procurementOpToken}`)
        .send({
          bookingId: 'BK-ROLE-01',
          tokenNumber: 'T-001',
          vehicleNumber: 'MP-09-AB-1234',
        })
        .expect(403);
    });

    it('should return 403 Forbidden when FARMER hits operations check-in endpoint', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/operations/check-in')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          bookingId: 'BK-ROLE-01',
          tokenNumber: 'T-001',
          vehicleNumber: 'MP-09-AB-1234',
        })
        .expect(403);
    });

    it('should return 403 Forbidden when FARMER hits command-centre states endpoint', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/command-centre/states')
        .set('Authorization', `Bearer ${farmerToken}`)
        .expect(403);
    });

    it('should return 403 Forbidden when AUDITOR attempts a state mutation (POST /operations/procurement)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/operations/procurement')
        .set('Authorization', `Bearer ${auditorToken}`)
        .send({
          bookingId: 'BK-ROLE-01',
          counterId: 'CTR-IND01-PR1',
          finalQuantityQuintals: 40,
          mspRatePerQuintal: 2275,
        })
        .expect(403);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Jurisdictional Scoping Tests (Section 18 & Section 30)
  // --------------------------------------------------------------------------
  describe('2. Jurisdictional Scoping at Command Centre Endpoints', () => {
    it('DISTRICT_ADMIN should return 403 Forbidden when attempting to drill down into another district', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/command-centre/centres?district=Ujjain')
        .set('Authorization', `Bearer ${districtAdminIndoreToken}`)
        .expect(403);
    });

    it('DISTRICT_ADMIN should return 403 Forbidden when requesting state-level overview', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/command-centre/states')
        .set('Authorization', `Bearer ${districtAdminIndoreToken}`)
        .expect(403);
    });

    it('DISTRICT_ADMIN should only receive centres within their assigned district', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/command-centre/centres')
        .set('Authorization', `Bearer ${districtAdminIndoreToken}`)
        .expect(200);

      expect(res.body.totalCentres).toBe(2);
      expect(res.body.centres.every((c: any) => c.district === 'Indore')).toBe(true);
    });

    it('STATE_ADMIN should return 403 Forbidden when attempting to access another state', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/command-centre/districts?state=Rajasthan')
        .set('Authorization', `Bearer ${stateAdminMPToken}`)
        .expect(403);
    });

    it('STATE_ADMIN should view their own state rollups and all districts within it', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/command-centre/districts')
        .set('Authorization', `Bearer ${stateAdminMPToken}`)
        .expect(200);

      expect(res.body.totalDistricts).toBe(2); // Indore and Ujjain
      expect(res.body.districts.every((d: any) => d.state === 'Madhya Pradesh')).toBe(true);
    });

    it('GOVERNMENT_ADMIN should view all states nationally without restriction', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/command-centre/states')
        .set('Authorization', `Bearer ${govAdminToken}`)
        .expect(200);

      expect(res.body.totalStates).toBe(2); // Madhya Pradesh and Rajasthan
    });

    it('AUDITOR should have read-only access across command-centre endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/command-centre/states')
        .set('Authorization', `Bearer ${auditorToken}`)
        .expect(200);

      expect(res.body.totalStates).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Ground Operations Complete End-to-End Workflow (Section 5 & 29)
  // --------------------------------------------------------------------------
  describe('3. Ground Operations Complete Stage Progression', () => {
    const testBookingId = 'BK-OPS-E2E-001';

    beforeAll(async () => {
      await bookingModel.create({
        bookingId: testBookingId,
        centreId: 'CENTRE-MP-IND-01',
        farmerId: 'FARMER-MP-IND-001',
        commodityCode: 'WHEAT',
        quantityQuintals: 40,
        bookingDate: TODAY,
        tokenNumber: 'T-101',
        status: BookingStatus.CONFIRMED,
        arrivalWindow: { slotIndex: 1, startTime: '10:00', endTime: '11:00' },
      });
    });

    it('Stage 1: Check-in operator verifies token and vehicle at gate', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/operations/check-in')
        .set('Authorization', `Bearer ${checkinOpToken}`)
        .send({
          bookingId: testBookingId,
          tokenNumber: 'T-101',
          vehicleNumber: 'MP-09-AB-1234',
          notes: 'Driver documents verified',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe(BookingStatus.CHECKED_IN);
      expect(res.body.queueState).toBe(QueueStatus.WAITING);
    });

    it('Stage 2: Weighing operator records gross and tare weight, issuing weighment slip', async () => {
      // Start weighing
      await request(app.getHttpServer())
        .post('/api/v1/operations/weighing/start')
        .set('Authorization', `Bearer ${weighingOpToken}`)
        .send({
          bookingId: testBookingId,
          counterId: 'CTR-IND01-WB1',
          vehicleNumber: 'MP-09-AB-1234',
        })
        .expect(200);

      // Complete weighing
      const res = await request(app.getHttpServer())
        .post('/api/v1/operations/weighing/complete')
        .set('Authorization', `Bearer ${weighingOpToken}`)
        .send({
          bookingId: testBookingId,
          counterId: 'CTR-IND01-WB1',
          vehicleNumber: 'MP-09-AB-1234',
          grossWeightQuintals: 52.5,
          tareWeightQuintals: 12.5,
          notes: 'Tractor trolley gross weight verified',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.netWeightQuintals).toBe(40);
      expect(res.body.weighmentSlipNumber).toBeDefined();
    });

    it('Stage 3: Quality operator tests grain parameters and issues ACCEPTED verdict', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/operations/quality')
        .set('Authorization', `Bearer ${qualityOpToken}`)
        .send({
          bookingId: testBookingId,
          counterId: 'CTR-IND01-QL1',
          moisturePercentage: 11.2,
          foreignMatterPercentage: 0.8,
          damagedGrainsPercentage: 0.4,
          assignedGrade: QualityGrade.GRADE_A,
          verdict: QualityVerdict.ACCEPTED,
          notes: 'Moisture well below 12% standard threshold',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.verdict).toBe(QualityVerdict.ACCEPTED);
      expect(res.body.assignedGrade).toBe(QualityGrade.GRADE_A);
      expect(res.body.nextStage).toBe('PROCUREMENT');
    });

    it('Stage 4: Procurement operator finalizes quantity and initiates authoritative gov sync', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/operations/procurement')
        .set('Authorization', `Bearer ${procurementOpToken}`)
        .send({
          bookingId: testBookingId,
          counterId: 'CTR-IND01-PR1',
          finalQuantityQuintals: 40,
          mspRatePerQuintal: 2275,
          notes: 'Procurement complete, gunny bags tagged',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.receiptNumber).toBeDefined();
      expect(res.body.totalPayoutEstimated).toBe(91000);
      expect(res.body.govSyncStatus).toBe(GovSyncStatus.SYNCED);
      expect(res.body.status).toBe(BookingStatus.COMPLETED);
    });

    it('Stage 5: Centre dashboard reflects live operations state (Section 29)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/operations/centres/CENTRE-MP-IND-01/dashboard')
        .set('Authorization', `Bearer ${centreAdminToken}`)
        .expect(200);

      expect(res.body.centreId).toBe('CENTRE-MP-IND-01');
      expect(res.body.sanctionedDailyCapacityQuintals).toBe(500);
      expect(res.body.bookedQuantityQuintals).toBe(40);
      expect(res.body.procuredQuantityQuintals).toBe(40);
      expect(res.body.remainingCapacityQuintals).toBe(460);
      expect(res.body.counters.length).toBe(4);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Drill-Down Data Consistency (Section 30)
  // --------------------------------------------------------------------------
  describe('4. Drill-Down Data Consistency Across Hierarchy', () => {
    beforeAll(async () => {
      // Seed additional completed bookings in Ujjain and Kota to verify rollups
      await bookingModel.create([
        {
          bookingId: 'BK-CONS-UJJ-01',
          centreId: 'CENTRE-MP-UJJ-01',
          farmerId: 'FARMER-UJJ-01',
          commodityCode: 'WHEAT',
          quantityQuintals: 50,
          bookingDate: TODAY,
          tokenNumber: 'T-201',
          status: BookingStatus.COMPLETED,
        },
        {
          bookingId: 'BK-CONS-KOT-01',
          centreId: 'CENTRE-RJ-KOT-01',
          farmerId: 'FARMER-RJ-01',
          commodityCode: 'MUSTARD',
          quantityQuintals: 75,
          bookingDate: TODAY,
          tokenNumber: 'T-301',
          status: BookingStatus.COMPLETED,
        },
      ]);
    });

    it('State totals must exactly match the sum of District totals, which must match the sum of Centre totals', async () => {
      const stateRes = await request(app.getHttpServer())
        .get('/api/v1/command-centre/states')
        .set('Authorization', `Bearer ${govAdminToken}`)
        .expect(200);

      const districtRes = await request(app.getHttpServer())
        .get('/api/v1/command-centre/districts')
        .set('Authorization', `Bearer ${govAdminToken}`)
        .expect(200);

      const centreRes = await request(app.getHttpServer())
        .get('/api/v1/command-centre/centres')
        .set('Authorization', `Bearer ${govAdminToken}`)
        .expect(200);

      // Verify Madhya Pradesh rollups
      const mpState = stateRes.body.states.find((s: any) => s.state === 'Madhya Pradesh');
      const mpDistricts = districtRes.body.districts.filter((d: any) => d.state === 'Madhya Pradesh');
      const mpCentres = centreRes.body.centres.filter((c: any) => c.state === 'Madhya Pradesh');

      // 1. Sanctioned Capacity: 500 (IND-01) + 300 (IND-02) + 400 (UJJ-01) = 1200Q
      const distSanctionedSum = mpDistricts.reduce((sum: number, d: any) => sum + d.sanctionedCapacityQuintals, 0);
      const centreSanctionedSum = mpCentres.reduce((sum: number, c: any) => sum + c.sanctionedCapacityQuintals, 0);
      expect(mpState.sanctionedCapacityQuintals).toBe(1200);
      expect(distSanctionedSum).toBe(1200);
      expect(centreSanctionedSum).toBe(1200);

      // 2. Booked Quantity: 40 (IND-01) + 50 (UJJ-01) = 90Q
      const distBookedSum = mpDistricts.reduce((sum: number, d: any) => sum + d.bookedQuantityQuintals, 0);
      const centreBookedSum = mpCentres.reduce((sum: number, c: any) => sum + c.bookedQuantityQuintals, 0);
      expect(mpState.bookedQuantityQuintals).toBe(90);
      expect(distBookedSum).toBe(90);
      expect(centreBookedSum).toBe(90);

      // 3. Procured Quantity: 40 (IND-01) + 50 (UJJ-01) = 90Q
      const distProcuredSum = mpDistricts.reduce((sum: number, d: any) => sum + d.procuredQuantityQuintals, 0);
      const centreProcuredSum = mpCentres.reduce((sum: number, c: any) => sum + c.procuredQuantityQuintals, 0);
      expect(mpState.procuredQuantityQuintals).toBe(90);
      expect(distProcuredSum).toBe(90);
      expect(centreProcuredSum).toBe(90);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Integration Health Monitoring & Failure Resilience (Section 30)
  // --------------------------------------------------------------------------
  describe('5. Integration Health Monitoring & Sync Failure Tracking', () => {
    it('should report HEALTHY integration status when sync succeeds', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/command-centre/integration-health')
        .set('Authorization', `Bearer ${govAdminToken}`)
        .expect(200);

      expect(res.body.provider).toBeDefined();
      expect(res.body.isProviderConnected).toBe(true);
      expect(res.body.successfulSyncCount).toBeGreaterThanOrEqual(1);
    });

    it('should accurately detect and report DEGRADED status when sync failures occur', async () => {
      // Seed a failed procurement sync record
      await procurementModel.create({
        bookingId: 'BK-FAILED-SYNC-01',
        centreId: 'CENTRE-MP-IND-01',
        farmerId: 'FARMER-TEST-01',
        commodityCode: 'WHEAT',
        finalQuantityQuintals: 30,
        mspRatePerQuintal: 2275,
        totalPayoutEstimated: 68250,
        receiptNumber: 'PR-FAIL-001',
        operatorId: 'user-procurement',
        govSyncStatus: GovSyncStatus.FAILED,
        govSyncError: 'Government gateway connection timeout (HTTP 504)',
        procuredAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/command-centre/integration-health')
        .set('Authorization', `Bearer ${govAdminToken}`)
        .expect(200);

      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.failedSyncCount).toBeGreaterThanOrEqual(1);
      expect(res.body.failureRatePercentage).toBeGreaterThan(0);
    });
  });
});
