import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AuthModule } from '../../src/modules/auth/auth.module';
import { FarmersModule } from '../../src/modules/farmers/farmers.module';
import { ComplianceModule } from '../../src/modules/compliance/compliance.module';
import { AuditModule } from '../../src/modules/audit/audit.module';
import { IntegrationsModule } from '../../src/modules/integrations/integrations.module';
import { RedisModule } from '../../src/infrastructure/redis/redis.module';
import { SecurityModule } from '../../src/infrastructure/security/security.module';
import { Role } from '../../src/shared/enums/roles.enum';
import { User } from '../../src/modules/auth/schemas/user.schema';
import { RefreshToken } from '../../src/modules/auth/schemas/refresh-token.schema';
import { Farmer } from '../../src/modules/farmers/schemas/farmer.schema';
import { Booking } from '../../src/modules/bookings/schemas/booking.schema';
import { AuditLog } from '../../src/modules/audit/schemas/audit-log.schema';
import { ConsentRecord } from '../../src/modules/compliance/schemas/consent.schema';
import { DataProcessingLog } from '../../src/modules/compliance/schemas/data-processing-log.schema';
import { IdempotencyRecord } from '../../src/infrastructure/security/schemas/idempotency-record.schema';
import { createMockModel } from './in-memory-mongo.mock';
import { JwtService } from '@nestjs/jwt';

describe('DPDP Act 2023 Data Privacy & Statutory Compliance (Integration Tests)', () => {
  let app: INestApplication;
  let userModel: any;
  let refreshTokenModel: any;
  let farmerModel: any;
  let bookingModel: any;
  let auditLogModel: any;
  let consentModel: any;
  let processingLogModel: any;
  let idempotencyModel: any;
  let jwtService: JwtService;

  let farmerToken: string;
  let farmerUserId: string;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    userModel = createMockModel();
    refreshTokenModel = createMockModel();
    farmerModel = createMockModel();
    bookingModel = createMockModel();
    auditLogModel = createMockModel();
    consentModel = createMockModel();
    processingLogModel = createMockModel();
    idempotencyModel = createMockModel();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        RedisModule,
        SecurityModule,
        AuditModule,
        ComplianceModule,
        IntegrationsModule,
        AuthModule,
        FarmersModule,
      ],
    })
      .overrideProvider(getModelToken(User.name))
      .useValue(userModel)
      .overrideProvider(getModelToken(RefreshToken.name))
      .useValue(refreshTokenModel)
      .overrideProvider(getModelToken(Farmer.name))
      .useValue(farmerModel)
      .overrideProvider(getModelToken(Booking.name))
      .useValue(bookingModel)
      .overrideProvider(getModelToken(AuditLog.name))
      .useValue(auditLogModel)
      .overrideProvider(getModelToken(ConsentRecord.name))
      .useValue(consentModel)
      .overrideProvider(getModelToken(DataProcessingLog.name))
      .useValue(processingLogModel)
      .overrideProvider(getModelToken(IdempotencyRecord.name))
      .useValue(idempotencyModel)
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

    // Setup initial Farmer User & Profile
    farmerUserId = new Types.ObjectId().toString();
    await userModel.create({
      _id: new Types.ObjectId(farmerUserId),
      mobile: '9876543210',
      name: 'Ramesh Kumar Verma',
      role: Role.FARMER,
      farmerId: 'FARMER-MP-IND-001',
      tokenVersion: 1,
      isActive: true,
    });

    await farmerModel.create({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(farmerUserId),
      farmerId: 'FARMER-MP-IND-001',
      registrationNumber: 'REG-2026-MP-00192',
      mobile: '9876543210',
      name: 'Ramesh Kumar Verma',
      state: 'Madhya Pradesh',
      district: 'Indore',
      subDistrict: 'Sanwer',
      village: 'Dharampuri',
      landAreaAcres: 5.5,
      bankAccountVerified: true,
      preferredLanguage: 'hi',
      isActive: true,
    });

    farmerToken = jwtService.sign({
      sub: farmerUserId,
      role: Role.FARMER,
      permissions: ['booking:create', 'booking:read:self'],
      tokenVersion: 1,
    });

    // Setup Admin User & Token
    adminUserId = new Types.ObjectId().toString();
    await userModel.create({
      _id: new Types.ObjectId(adminUserId),
      username: 'gov_compliance_officer',
      email: 'dpo@gov.in',
      name: 'Central DPO',
      role: Role.GOVERNMENT_ADMIN,
      tokenVersion: 1,
      isActive: true,
    });

    adminToken = jwtService.sign({
      sub: adminUserId,
      role: Role.GOVERNMENT_ADMIN,
      permissions: ['compliance:audit:read', 'compliance:retention:run'],
      tokenVersion: 1,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Explicit Consent Flow at Farmer Registration', () => {
    it('should reject farmer registration when explicit consent is omitted (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/farmer/register')
        .send({
          mobile: '9123456789',
          name: 'Suresh Patel',
          state: 'Madhya Pradesh',
          district: 'Indore',
          // consentToDataSharing omitted
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('consent');
    });

    it('should reject farmer registration when explicit consent is false (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/farmer/register')
        .send({
          mobile: '9123456789',
          name: 'Suresh Patel',
          consentToDataSharing: false,
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('Explicit consent to data sharing');
    });

    it('should accept farmer registration when explicit affirmative consent is granted', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/farmer/register')
        .send({
          mobile: '9123456780',
          name: 'Kailash Choudhary',
          state: 'Madhya Pradesh',
          district: 'Indore',
          consentToDataSharing: true,
          consentVersion: 'DPDP-2023-V1.0',
        });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.name).toBe('Kailash Choudhary');
    });
  });

  describe('2. Data Subject Rights APIs', () => {
    it('GET /api/v1/farmers/data-export: should generate comprehensive portable data dump with sha256 checksum', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/farmers/data-export')
        .set('Authorization', `Bearer ${farmerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const dump = res.body.data;
      expect(dump.exportMetadata).toBeDefined();
      expect(dump.exportMetadata.statute).toContain('DPDP');
      expect(dump.exportMetadata.checksumSha256).toBeDefined();
      expect(dump.personalIdentity.farmerId).toBe('FARMER-MP-IND-001');
      expect(dump.personalIdentity.mobile).toBe('9876543210');
      expect(dump.personalIdentity.name).toBe('Ramesh Kumar Verma');
      expect(dump.dpdpConsentRecords).toBeInstanceOf(Array);
      expect(dump.procurementBookings).toBeInstanceOf(Array);
      expect(dump.piiProcessingAccessHistory).toBeInstanceOf(Array);
    });

    it('DELETE /api/v1/farmers/account: should anonymize PII and enforce 7-year statutory financial hold', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/farmers/account')
        .set('Authorization', `Bearer ${farmerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.erasureSummary).toBeDefined();

      const summary = res.body.erasureSummary;
      expect(summary.pseudonymizedId).toMatch(/^ANONYMIZED_FARMER_/);
      expect(summary.personalDataPurged).toContain('Full Name (replaced with anonymous identifier)');
      expect(summary.personalDataPurged).toContain('Mobile Phone Number (detached and unlinked)');
      expect(summary.statutoryAuditRetention.legalHoldEnforced).toBe(true);
      expect(summary.statutoryAuditRetention.retentionPeriodYears).toBe(7);
      expect(summary.statutoryAuditRetention.statutoryFramework).toContain('GFR');
    });
  });

  describe('3. Statutory Data Retention Engine & Policy APIs', () => {
    it('GET /api/v1/compliance/policy: should expose public privacy policy metadata', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/compliance/policy');

      expect(res.status).toBe(200);
      expect(res.body.version).toBe('DPDP-2023-V1.0');
      expect(res.body.statute).toContain('DPDP');
      expect(res.body.statutoryRetention.operationalQueue).toContain('90 days');
      expect(res.body.statutoryRetention.financialAndAuditRecords).toContain('7 years');
    });

    it('GET /api/v1/compliance/retention/status: should report health and retention tiers to Government Admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/compliance/retention/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('HEALTHY');
      expect(res.body.tiers.tier1OperationalQueue.retentionDays).toBe(90);
      expect(res.body.tiers.tier2Analytics.retentionDays).toBe(180);
      expect(res.body.tiers.tier3StatutoryFinancialAudit.retentionYears).toBe(7);
    });

    it('POST /api/v1/compliance/retention/run: should execute retention sweep with 7-year GFR legal hold', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/compliance/retention/run')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dryRun: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result.dryRun).toBe(true);
      expect(res.body.result.tier1Operational.retentionDays).toBe(90);
      expect(res.body.result.tier3StatutoryAudit.legalHoldEnforced).toBe(true);
      expect(res.body.result.tier3StatutoryAudit.statutoryRetentionYears).toBe(7);
    });
  });
});
