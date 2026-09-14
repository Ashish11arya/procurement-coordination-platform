import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { IntegrationsModule } from '../../src/modules/integrations/integrations.module';
import { BookingsModule } from '../../src/modules/bookings/bookings.module';
import { FarmersModule } from '../../src/modules/farmers/farmers.module';
import { CentresModule } from '../../src/modules/centres/centres.module';
import { OperationsModule } from '../../src/modules/operations/operations.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { HealthModule } from '../../src/infrastructure/health/health.module';
import { SchedulingModule } from '../../src/modules/scheduling/scheduling.module';
import { CommandCentreModule } from '../../src/modules/command-centre/command-centre.module';
import { ComplianceModule } from '../../src/modules/compliance/compliance.module';
import { SecurityModule } from '../../src/infrastructure/security/security.module';
import { EventsModule } from '../../src/infrastructure/events/events.module';
import { BookingsService } from '../../src/modules/bookings/bookings.service';
import { CentresService } from '../../src/modules/centres/centres.service';
import { AuthService } from '../../src/modules/auth/services/auth.service';
import { SchedulingService } from '../../src/modules/scheduling/scheduling.service';
import { Booking, BookingDocument } from '../../src/modules/bookings/schemas/booking.schema';
import { Centre, CentreDocument } from '../../src/modules/centres/schemas/centre.schema';
import {
  GovernmentDataProvider,
  GOVERNMENT_DATA_PROVIDER,
} from '../../src/modules/integrations/contracts/government-data-provider.interface';
import { GovernmentCircuitBreaker, CircuitBreakerState } from '../../src/modules/integrations/circuit-breaker/government-circuit-breaker.service';

describe('Section 21 Zero-Disruption E2E: Uncredentialed e-Samridhi Integration', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let bookingsService: BookingsService;
  let centresService: CentresService;
  let authService: AuthService;
  let schedulingService: SchedulingService;
  let govProvider: GovernmentDataProvider;
  let circuitBreaker: GovernmentCircuitBreaker;
  let bookingModel: Model<BookingDocument>;
  let centreModel: Model<CentreDocument>;

  const originalEnv = process.env.GOVERNMENT_PROVIDER;

  beforeAll(async () => {
    // 1. Force GOVERNMENT_PROVIDER=esamridhi with NO credentials
    process.env.GOVERNMENT_PROVIDER = 'esamridhi';
    delete process.env.ESAMRIDHI_API_KEY;
    delete process.env.ESAMRIDHI_CLIENT_ID;
    delete process.env.ESAMRIDHI_CLIENT_SECRET;

    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              GOVERNMENT_PROVIDER: 'esamridhi',
              PORT: 3001,
              JWT_SECRET: 'test-jwt-secret-zero-disruption-key-32chars',
              JWT_ACCESS_EXPIRATION: '15m',
              REFRESH_TOKEN_SECRET: 'test-refresh-secret-zero-disruption-key-32chars',
              REFRESH_TOKEN_EXPIRATION: '7d',
            }),
          ],
        }),
        MongooseModule.forRoot(uri),
        EventsModule,
        SecurityModule,
        IntegrationsModule,
        ComplianceModule,
        AuthModule,
        FarmersModule,
        CentresModule,
        BookingsModule,
        OperationsModule,
        SchedulingModule,
        CommandCentreModule,
        HealthModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    bookingsService = moduleRef.get(BookingsService);
    centresService = moduleRef.get(CentresService);
    authService = moduleRef.get(AuthService);
    schedulingService = moduleRef.get(SchedulingService);
    govProvider = moduleRef.get(GOVERNMENT_DATA_PROVIDER);
    circuitBreaker = moduleRef.get(GovernmentCircuitBreaker);
    bookingModel = moduleRef.get(getModelToken(Booking.name));
    centreModel = moduleRef.get(getModelToken(Centre.name));
  });

  afterAll(async () => {
    if (originalEnv !== undefined) {
      process.env.GOVERNMENT_PROVIDER = originalEnv;
    } else {
      delete process.env.GOVERNMENT_PROVIDER;
    }
    await app.close();
    await mongod.stop();
  });

  it('1. Application boots cleanly under GOVERNMENT_PROVIDER=esamridhi without credentials', () => {
    expect(app).toBeDefined();
    expect(govProvider.providerName).toBe('ESAMRIDHI_GOVERNMENT_PROVIDER');
    expect(circuitBreaker).toBeDefined();
  });

  it('2. Centres discovery and local database seed succeeds gracefully without crashing', async () => {
    // Seed initial centre in MongoDB
    await centreModel.create({
      centreId: 'CENTRE-IND-01',
      name: 'Indore Central Mandi Terminal',
      agencyName: 'NAFED / MP State Civil Supplies',
      state: 'Madhya Pradesh',
      district: 'Indore',
      address: 'Indore Mandi',
      coordinates: { latitude: 22.7, longitude: 75.8 },
      operatingSeason: 'Rabi 2026',
      supportedCommodities: ['WHEAT', 'CHANA', 'MUSTARD'],
      dailyCapacityQuintals: 500,
      maxSimultaneousVehicles: 15,
      operatingHours: { openTime: '09:00', closeTime: '18:00' },
      isActive: true,
    });

    // Seed default counters for multi-counter scheduling constraint evaluation
    const counterModel = app.get(getModelToken('Counter'));
    await counterModel.create([
      { counterId: 'CTR-IND-01-CK1', centreId: 'CENTRE-IND-01', counterNumber: 1, stage: 'CHECKIN', capacityPerHourQuintals: 50, status: 'ACTIVE' },
      { counterId: 'CTR-IND-01-WT1', centreId: 'CENTRE-IND-01', counterNumber: 1, stage: 'WEIGHING', capacityPerHourQuintals: 40, status: 'ACTIVE' },
      { counterId: 'CTR-IND-01-QL1', centreId: 'CENTRE-IND-01', counterNumber: 1, stage: 'QUALITY', capacityPerHourQuintals: 35, status: 'ACTIVE' },
      { counterId: 'CTR-IND-01-PR1', centreId: 'CENTRE-IND-01', counterNumber: 1, stage: 'PROCUREMENT', capacityPerHourQuintals: 50, status: 'ACTIVE' },
    ]);

    const centres = await centresService.findAllCentres();
    expect(centres.length).toBeGreaterThanOrEqual(1);
    expect(centres[0].centreId).toBe('CENTRE-IND-01');
  });

  it('3. Farmer registration succeeds with local baseline profile despite missing government credentials', async () => {
    const regResult = await authService.registerFarmer(
      {
        mobile: '9811223344',
        name: 'Kisan Dev Sharma',
        state: 'Madhya Pradesh',
        district: 'Indore',
        subDistrict: 'Sanwer',
        village: 'Gram Pipliya',
        landAreaAcres: 4.5,
        consentToDataSharing: true,
      },
      { ipAddress: '127.0.0.1' },
    );

    expect(regResult).toBeDefined();
    expect(regResult.user.mobile).toBe('9811223344');
    expect(regResult.tokens.accessToken).toBeDefined();
  });

  it('4. Booking creation succeeds under Section 21 provisional quota, flagging govSyncStatus as PENDING', async () => {
    // Retrieve registered user
    const loginResult = await authService.requestFarmerOtp({ mobile: '9811223344' });
    expect(loginResult).toBeDefined();
    const otpToUse = loginResult.mockOtp || '123456';

    const verifyResult = await authService.verifyFarmerOtp(
      { mobile: '9811223344', otp: otpToUse },
      { ipAddress: '127.0.0.1' },
    );
    const userId = (verifyResult.user as any)._id.toString();

    // Create booking for 45 quintals of wheat
    const bookingResult = await bookingsService.createBooking(
      userId,
      {
        centreId: 'CENTRE-IND-01',
        commodityCode: 'WHEAT',
        quantityQuintals: 45,
        bookingDate: '2026-09-20',
        preferredSlotIndex: 1,
        vehicles: [
          {
            vehicleNumber: 'MP-09-AB-1234',
            vehicleType: 'TRACTOR_TROLLEY' as any,
            allocatedQuantityQuintals: 45,
          },
        ],
      },
    );

    expect(bookingResult.success).toBe(true);
    expect(bookingResult.booking.tokenNumber).toBeDefined();
    expect(bookingResult.booking.govSyncStatus).toBe('PENDING');
    expect(bookingResult.booking.isProvisionalEligibility).toBe(true);

    // Verify persisted record in MongoDB
    const persisted = await bookingModel.findOne({ bookingId: bookingResult.booking.bookingId });
    expect(persisted).toBeDefined();
    expect(persisted?.govSyncStatus).toBe('PENDING');
    expect(persisted?.govSyncError).toContain('PROVISIONAL_ELIGIBILITY_CIRCUIT_BREAKER_ACTIVE');
  });

  it('5. Scheduling evaluation succeeds without interruption using local capacity ceiling', async () => {
    const evaluation = await schedulingService.evaluateBookingConstraints({
      farmerId: 'FARMER-9811223344',
      centreId: 'CENTRE-IND-01',
      bookingDate: '2026-09-20',
      quantityQuintals: 30,
      commodityCode: 'WHEAT',
      vehicleCount: 1,
    });

    expect(evaluation).toBeDefined();
    expect(evaluation.isFeasible).toBe(true);
  });

  it('6. Circuit breaker captures unconfigured state and exposes metrics cleanly without crashing /health', () => {
    const metrics = circuitBreaker.getMetrics();
    expect(metrics.state).toBe(CircuitBreakerState.OPEN);
    expect(metrics.lastTripReason).toBeDefined();
    expect(metrics.totalFailures).toBeGreaterThanOrEqual(1);
  });
});
