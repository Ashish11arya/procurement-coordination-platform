import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { getModelToken } from '@nestjs/mongoose';

import { AuthModule } from '../../src/modules/auth/auth.module';
import { AuditModule } from '../../src/modules/audit/audit.module';
import { IntegrationsModule } from '../../src/modules/integrations/integrations.module';
import { RedisModule } from '../../src/infrastructure/redis/redis.module';
import { SecurityModule } from '../../src/infrastructure/security/security.module';
import { Role } from '../../src/shared/enums/roles.enum';
import { SecurityService } from '../../src/infrastructure/security/security.service';
import { User } from '../../src/modules/auth/schemas/user.schema';
import { RefreshToken } from '../../src/modules/auth/schemas/refresh-token.schema';
import { AuditLog } from '../../src/modules/audit/schemas/audit-log.schema';
import { IdempotencyRecord } from '../../src/infrastructure/security/schemas/idempotency-record.schema';
import { createMockModel } from './in-memory-mongo.mock';

describe('Authentication & RBAC (Integration Tests)', () => {
  let app: INestApplication;
  let userModel: any;
  let refreshTokenModel: any;
  let auditLogModel: any;
  let idempotencyRecordModel: any;
  let securityService: SecurityService;

  beforeAll(async () => {
    userModel = createMockModel();
    refreshTokenModel = createMockModel();
    auditLogModel = createMockModel();
    idempotencyRecordModel = createMockModel();

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
      ],
    })
      .overrideProvider(getModelToken(User.name))
      .useValue(userModel)
      .overrideProvider(getModelToken(RefreshToken.name))
      .useValue(refreshTokenModel)
      .overrideProvider(getModelToken(AuditLog.name))
      .useValue(auditLogModel)
      .overrideProvider(getModelToken(IdempotencyRecord.name))
      .useValue(idempotencyRecordModel)
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

    securityService = moduleFixture.get(SecurityService);

    // Seed an initial System Admin
    const passwordHash = await securityService.hashPassword('Admin@Secure123');
    await userModel.create({
      name: 'System Super Admin',
      username: 'superadmin',
      email: 'superadmin@gov.in',
      passwordHash,
      role: Role.SYSTEM_ADMIN,
      isActive: true,
      tokenVersion: 1,
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('1. Farmer Registration & OTP Authentication Flow', () => {
    let capturedOtp: string;
    let farmerAccessToken: string;
    let farmerRefreshToken: string;

    it('POST /api/v1/auth/farmer/otp/request - should request OTP successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/farmer/otp/request')
        .send({ mobile: '9876543210' })
        .expect(200);

      expect(res.body.mobile).toBe('9876543210');
      expect(res.body.expiresInSeconds).toBe(300);
      expect(res.body.mockOtp).toBeDefined();
      capturedOtp = res.body.mockOtp;
    });

    it('POST /api/v1/auth/farmer/otp/verify - should verify OTP, return access token and set HttpOnly refresh cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/farmer/otp/verify')
        .send({ mobile: '9876543210', otp: capturedOtp })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe(Role.FARMER);
      expect(res.body.user.name).toBe('Ramesh Kumar Verma'); // Auto-populated from MockGovernmentProvider

      farmerAccessToken = res.body.accessToken;

      // Check cookie
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');

      // Extract raw refresh token
      farmerRefreshToken = refreshCookie!.split(';')[0].split('=')[1];
    });

    it('GET /api/v1/auth/me - should allow access with valid Farmer JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${farmerAccessToken}`)
        .expect(200);

      expect(res.body.user.role).toBe(Role.FARMER);
      expect(res.body.user.mobile).toBe('9876543210');
    });
  });

  describe('2. Operator Login & Role-Based Provisioning Flow', () => {
    let adminToken: string;

    it('POST /api/v1/auth/operator/login - should authenticate System Admin with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/operator/login')
        .send({ identifier: 'superadmin', password: 'Admin@Secure123' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe(Role.SYSTEM_ADMIN);
      adminToken = res.body.accessToken;
    });

    it('POST /api/v1/auth/operator/create - Admin should provision a new Check-in Operator', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/operator/create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Rajesh Checkin Operator',
          username: 'checkin_rajesh',
          email: 'rajesh@mandi.gov.in',
          password: 'Operator@Pass123',
          role: Role.CHECKIN_OPERATOR,
          scope: { centreId: 'CENTRE-MP-IND-01' },
        })
        .expect(201);

      expect(res.body.operator.username).toBe('checkin_rajesh');
      expect(res.body.operator.role).toBe(Role.CHECKIN_OPERATOR);
      expect(res.body.operator.scope.centreId).toBe('CENTRE-MP-IND-01');
      expect(res.body.operator.passwordHash).toBeUndefined(); // Redacted
    });

    it('POST /api/v1/auth/operator/login - newly created operator should be able to log in', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/operator/login')
        .send({ identifier: 'checkin_rajesh', password: 'Operator@Pass123' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe(Role.CHECKIN_OPERATOR);
    });

    it('POST /api/v1/auth/operator/login - should reject invalid password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/operator/login')
        .send({ identifier: 'superadmin', password: 'WRONG_PASSWORD' })
        .expect(401);
    });
  });

  describe('3. Token Rotation & Reuse Detection Flow', () => {
    let oldRefreshToken: string;
    let newRefreshToken: string;

    it('POST /api/v1/auth/refresh - should rotate refresh token successfully', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/operator/login')
        .send({ identifier: 'superadmin', password: 'Admin@Secure123' });

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      oldRefreshToken = cookies
        .find((c: string) => c.startsWith('refresh_token='))!
        .split(';')[0]
        .split('=')[1];

      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${oldRefreshToken}`])
        .expect(200);

      expect(refreshRes.body.accessToken).toBeDefined();

      const newCookies = refreshRes.headers['set-cookie'] as unknown as string[];
      newRefreshToken = newCookies
        .find((c: string) => c.startsWith('refresh_token='))!
        .split(';')[0]
        .split('=')[1];

      expect(newRefreshToken).not.toBe(oldRefreshToken);
    });

    it('POST /api/v1/auth/refresh - REUSE DETECTION: Re-using old token must fail with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refresh_token=${oldRefreshToken}`])
        .expect(401);
    });
  });

  describe('4. RBAC & Unauthorized Access Enforcement', () => {
    let farmerToken: string;

    beforeAll(async () => {
      const otpRes = await request(app.getHttpServer())
        .post('/api/v1/auth/farmer/otp/request')
        .send({ mobile: '9123456780' });

      const verifyRes = await request(app.getHttpServer())
        .post('/api/v1/auth/farmer/otp/verify')
        .send({ mobile: '9123456780', otp: otpRes.body.mockOtp });

      farmerToken = verifyRes.body.accessToken;
    });

    it('POST /api/v1/auth/operator/create - Farmer attempting operator creation must be rejected with 403 Forbidden', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/operator/create')
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({
          name: 'Hacker',
          username: 'hacker',
          email: 'hacker@dark.net',
          password: 'Password123',
          role: Role.SYSTEM_ADMIN,
        })
        .expect(403);
    });

    it('GET /api/v1/auth/me - Missing Authorization header must be rejected with 401 Unauthorized', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('GET /api/v1/auth/me - Tampered JWT token must be rejected with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.tampered.jwttoken')
        .expect(401);
    });
  });
});
