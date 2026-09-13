import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { RedisModule } from '../../src/infrastructure/redis/redis.module';
import { SecurityModule } from '../../src/infrastructure/security/security.module';
import { AuditModule } from '../../src/modules/audit/audit.module';
import { IntegrationsModule } from '../../src/modules/integrations/integrations.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { FarmersModule } from '../../src/modules/farmers/farmers.module';
import { CentresModule } from '../../src/modules/centres/centres.module';
import { BookingsModule } from '../../src/modules/bookings/bookings.module';
import { Role } from '../../src/shared/enums/roles.enum';
import { SecurityService } from '../../src/infrastructure/security/security.service';
import { User } from '../../src/modules/auth/schemas/user.schema';
import { RefreshToken } from '../../src/modules/auth/schemas/refresh-token.schema';
import { AuditLog } from '../../src/modules/audit/schemas/audit-log.schema';
import { IdempotencyRecord } from '../../src/infrastructure/security/schemas/idempotency-record.schema';
import { Farmer } from '../../src/modules/farmers/schemas/farmer.schema';
import { Centre } from '../../src/modules/centres/schemas/centre.schema';
import { Counter } from '../../src/modules/centres/schemas/counter.schema';
import { Commodity } from '../../src/modules/centres/schemas/commodity.schema';
import { Booking, BookingStatus } from '../../src/modules/bookings/schemas/booking.schema';
import { BookingVehicle, VehicleType } from '../../src/modules/bookings/schemas/booking-vehicle.schema';
import { ArrivalWindow } from '../../src/modules/bookings/schemas/arrival-window.schema';
import { createMockModel } from './in-memory-mongo.mock';

import { JwtService } from '@nestjs/jwt';

describe('Phase 2: Farmer + Centre + Booking + Capacity (Integration Tests)', () => {
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

  // Test identities & tokens
  let farmerUser: any;
  let adminUser: any;
  let farmerJwtToken: string;
  let adminJwtToken: string;

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

    // Seed test users
    const farmerUserId = new Types.ObjectId();
    farmerUser = {
      _id: farmerUserId,
      mobile: '9876543210',
      name: 'Ramesh Kumar Verma',
      role: Role.FARMER,
      farmerId: 'FARMER-MP-IND-001',
      tokenVersion: 1,
      isActive: true,
    };
    await userModel.create(farmerUser);

    const adminUserId = new Types.ObjectId();
    adminUser = {
      _id: adminUserId,
      email: 'admin@procure.gov.in',
      name: 'District Admin',
      role: Role.SYSTEM_ADMIN,
      tokenVersion: 1,
      isActive: true,
    };
    await userModel.create(adminUser);

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
      ],
    })
      .overrideProvider(getModelToken(User.name))
      .useValue(userModel)
      .overrideProvider(getModelToken(RefreshToken.name))
      .useValue(refreshTokenModel)
      .overrideProvider(getModelToken(AuditLog.name))
      .useValue(auditLogModel)
      .overrideProvider(getModelToken(IdempotencyRecord.name))
      .useValue(idempotencyModel)
      .overrideProvider(getModelToken(Farmer.name))
      .useValue(farmerModel)
      .overrideProvider(getModelToken(Centre.name))
      .useValue(centreModel)
      .overrideProvider(getModelToken(Counter.name))
      .useValue(counterModel)
      .overrideProvider(getModelToken(Commodity.name))
      .useValue(commodityModel)
      .overrideProvider(getModelToken(Booking.name))
      .useValue(bookingModel)
      .overrideProvider(getModelToken(BookingVehicle.name))
      .useValue(vehicleModel)
      .overrideProvider(getModelToken(ArrivalWindow.name))
      .useValue(windowModel)
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

    // Generate authenticated JWT tokens
    farmerJwtToken = jwtService.sign({
      sub: farmerUserId.toString(),
      role: Role.FARMER,
      tokenVersion: 1,
    });

    adminJwtToken = jwtService.sign({
      sub: adminUserId.toString(),
      role: Role.SYSTEM_ADMIN,
      tokenVersion: 1,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // --------------------------------------------------------------------------
  // 1. Farmer Profile & Read-Only Government Integrity
  // --------------------------------------------------------------------------
  describe('1. Farmer Profile Management & Government Data Integrity', () => {
    it('GET /api/v1/farmers/profile - should view profile synchronized from GovernmentDataProvider', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/farmers/profile')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.profile).toBeDefined();
      expect(res.body.profile.farmerId).toBe('FARMER-MP-IND-001');
      expect(res.body.profile.state).toBe('Madhya Pradesh');
      expect(res.body.profile.district).toBe('Indore');
      expect(res.body.profile.landAreaAcres).toBe(5.5);
    });

    it('PATCH /api/v1/farmers/profile - should allow updating preferences (address, language)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/farmers/profile')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .send({
          contactAddress: 'Gram Panchayat Bhawan, Dharampuri',
          preferredLanguage: 'hi',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.profile.contactAddress).toBe('Gram Panchayat Bhawan, Dharampuri');
      expect(res.body.profile.preferredLanguage).toBe('hi');
    });

    it('PATCH /api/v1/farmers/profile - should reject attempts to alter official records (read-only protection)', async () => {
      // White-listing ValidationPipe will reject unauthorized fields (forbidNonWhitelisted)
      await request(app.getHttpServer())
        .patch('/api/v1/farmers/profile')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .send({
          landAreaAcres: 50.0, // Fraudulent attempt to inflate land area
          farmerId: 'FARMER-HACKED',
        })
        .expect(400);

      // Verify profile in DB remains unaltered
      const profile = await farmerModel.findOne({ mobile: '9876543210' }).exec();
      expect(profile.landAreaAcres).toBe(5.5);
      expect(profile.farmerId).toBe('FARMER-MP-IND-001');
    });

    it('GET /api/v1/farmers/eligibility - should return authoritative quota from MockGovernmentProvider', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/farmers/eligibility?commodity=WHEAT')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.eligibility.commodityCode).toBe('WHEAT');
      expect(res.body.eligibility.isEligible).toBe(true);
      expect(res.body.eligibility.sanctionedQuantityQuintals).toBe(100);
      expect(res.body.eligibility.remainingEligibleQuantityQuintals).toBe(85);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Centre + Counter CRUD & RBAC Enforcement
  // --------------------------------------------------------------------------
  describe('2. Centre + Counter Management & RBAC', () => {
    it('POST /api/v1/centres - should reject farmer role with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/centres')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .send({
          centreId: 'CENTRE-ILLEGAL-01',
          name: 'Unauthorized Centre',
          agencyName: 'NAFED',
          state: 'Madhya Pradesh',
          district: 'Indore',
          address: 'Anywhere',
          coordinates: { latitude: 22.7, longitude: 75.8 },
          operatingSeason: 'RABI_2026',
          supportedCommodities: ['WHEAT'],
          dailyCapacityQuintals: 500,
        })
        .expect(403);
    });

    it('POST /api/v1/centres - should allow SYSTEM_ADMIN to create procurement centre', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/centres')
        .set('Authorization', `Bearer ${adminJwtToken}`)
        .send({
          centreId: 'CENTRE-MP-IND-01',
          name: 'Sanwer Krishi Upaj Mandi Procurement Centre',
          agencyName: 'MP State Civil Supplies Corporation',
          state: 'Madhya Pradesh',
          district: 'Indore',
          address: 'Mandi Yard, Sanwer Road, Indore, MP 453551',
          coordinates: { latitude: 22.9774, longitude: 75.8236 },
          operatingSeason: 'RABI_2026',
          supportedCommodities: ['WHEAT', 'CHANA', 'MUSTARD'],
          dailyCapacityQuintals: 500,
          maxSimultaneousVehicles: 15,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.centre.centreId).toBe('CENTRE-MP-IND-01');
    });

    it('POST /api/v1/centres/:centreId/counters - should allow admin to add operational counters', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/centres/CENTRE-MP-IND-01/counters')
        .set('Authorization', `Bearer ${adminJwtToken}`)
        .send({
          counterId: 'CTR-IND01-CK1',
          counterNumber: 1,
          stage: 'CHECKIN',
          capacityPerHourQuintals: 50,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.counter.stage).toBe('CHECKIN');
    });

    it('GET /api/v1/centres/:centreId/capacity - should return capacity tracking overview', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/centres/CENTRE-MP-IND-01/capacity?date=2026-09-25')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.capacity.sanctionedDailyCapacityQuintals).toBe(500);
      expect(res.body.capacity.remainingCapacityQuintals).toBe(500);
      expect(res.body.capacity.utilizationPercentage).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Booking Creation with Idempotency-Key (Section 6 & 20)
  // --------------------------------------------------------------------------
  describe('3. Booking Creation & Idempotency Enforcement', () => {
    const bookingPayload = {
      centreId: 'CENTRE-MP-IND-01',
      commodityCode: 'WHEAT',
      quantityQuintals: 40,
      bookingDate: '2026-09-25',
      preferredSlotIndex: 1,
      vehicles: [
        {
          vehicleNumber: 'MP-09-AB-1234',
          vehicleType: VehicleType.TRACTOR_TROLLEY,
          allocatedQuantityQuintals: 40,
          driverName: 'Ramesh Verma',
          driverMobile: '9876543210',
        },
      ],
    };

    let createdBookingId: string;

    it('POST /api/v1/bookings - should create a procurement booking with daily token T-001', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .set('Idempotency-Key', 'idemp-key-uuid-001')
        .send(bookingPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.booking).toBeDefined();
      expect(res.body.booking.tokenNumber).toBe('T-001');
      expect(res.body.booking.quantityQuintals).toBe(40);
      expect(res.body.vehicles.length).toBe(1);
      expect(res.body.vehicles[0].vehicleNumber).toBe('MP-09-AB-1234');

      createdBookingId = res.body.booking.bookingId;
    });

    it('POST /api/v1/bookings - should replay cached response when same Idempotency-Key is sent', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .set('Idempotency-Key', 'idemp-key-uuid-001')
        .send(bookingPayload)
        .expect(201);

      expect(res.body.isIdempotentReplay).toBe(true);
      expect(res.body.booking.bookingId).toBe(createdBookingId);
      expect(res.body.booking.tokenNumber).toBe('T-001');

      // Verify no duplicate bookings were created in the database
      const count = await bookingModel.countDocuments().exec();
      expect(count).toBe(1);
    });

    it('POST /api/v1/bookings - should reject Idempotency-Key collision with 409 Conflict', async () => {
      // Reusing 'idemp-key-uuid-001' with differing payload (quantity: 45 instead of 40)
      const alteredPayload = {
        ...bookingPayload,
        quantityQuintals: 45,
        vehicles: [
          {
            vehicleNumber: 'MP-09-AB-1234',
            allocatedQuantityQuintals: 45,
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .set('Idempotency-Key', 'idemp-key-uuid-001')
        .send(alteredPayload)
        .expect(409);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Overbooking Prevention & Quota Control
  // --------------------------------------------------------------------------
  describe('4. Overbooking Prevention & Quota Control', () => {
    it('POST /api/v1/bookings - should reject booking exceeding farmer government quota with 400 Bad Request', async () => {
      // Farmer remaining quota is 85Q
      await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .send({
          centreId: 'CENTRE-MP-IND-01',
          commodityCode: 'WHEAT',
          quantityQuintals: 90, // 90 > 85
          bookingDate: '2026-09-26',
          preferredSlotIndex: 0,
          vehicles: [
            {
              vehicleNumber: 'MP-09-CD-5678',
              allocatedQuantityQuintals: 90,
            },
          ],
        })
        .expect(400);
    });

    it('POST /api/v1/bookings - should reject booking exceeding centre daily sanctioned capacity with 409 Conflict', async () => {
      // Sanctioned daily capacity is 500Q
      // Seed bookings bringing total to 490Q
      await bookingModel.create({
        bookingId: 'BK-EXISTING-01',
        tokenNumber: 'T-002',
        centreId: 'CENTRE-MP-IND-01',
        farmerId: 'FARMER-OTHER-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 490,
        bookingDate: '2026-09-27',
        status: BookingStatus.BOOKED,
      });

      // Farmer attempts booking of 30Q (490 + 30 = 520 > 500Q)
      await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .send({
          centreId: 'CENTRE-MP-IND-01',
          commodityCode: 'WHEAT',
          quantityQuintals: 30,
          bookingDate: '2026-09-27',
          preferredSlotIndex: 0,
          vehicles: [
            {
              vehicleNumber: 'MP-09-CD-9999',
              allocatedQuantityQuintals: 30,
            },
          ],
        })
        .expect(409);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Booking Listing & Cancellation Flow
  // --------------------------------------------------------------------------
  describe('5. Booking Listing and Cancellation', () => {
    let bookingToCancelId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .send({
          centreId: 'CENTRE-MP-IND-01',
          commodityCode: 'WHEAT',
          quantityQuintals: 20,
          bookingDate: '2026-09-28',
          preferredSlotIndex: 0,
          vehicles: [
            {
              vehicleNumber: 'MP-09-KL-1111',
              allocatedQuantityQuintals: 20,
            },
          ],
        });

      bookingToCancelId = res.body.booking.bookingId;
    });

    it('GET /api/v1/bookings - farmer should list their bookings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.bookings.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/bookings/:id/cancel - farmer should cancel their booking', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingToCancelId}/cancel`)
        .set('Authorization', `Bearer ${farmerJwtToken}`)
        .send({
          reason: 'Severe rain and road closure',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.booking.status).toBe(BookingStatus.CANCELLED);
      expect(res.body.booking.cancellationReason).toBe('Severe rain and road closure');
    });
  });
});
