import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../../src/infrastructure/redis/redis.service';
import { SecurityService } from '../../src/infrastructure/security/security.service';
import { CsrfGuard } from '../../src/infrastructure/security/csrf.guard';
import { RateLimitGuard, Throttle } from '../../src/infrastructure/security/rate-limit.guard';
import { MongoSanitizeMiddleware } from '../../src/infrastructure/security/mongo-sanitize.middleware';
import { AuthService } from '../../src/modules/auth/services/auth.service';
import { OtpService } from '../../src/modules/auth/services/otp.service';
import { AuditService } from '../../src/modules/audit/audit.service';
import { User } from '../../src/modules/auth/schemas/user.schema';
import { RefreshToken } from '../../src/modules/auth/schemas/refresh-token.schema';
import { AuditLog } from '../../src/modules/audit/schemas/audit-log.schema';
import { Role } from '../../src/shared/enums/roles.enum';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';
import { Roles } from '../../src/shared/decorators/roles.decorator';
import { GOVERNMENT_DATA_PROVIDER } from '../../src/modules/integrations/contracts/government-data-provider.interface';
import { MockGovernmentProvider } from '../../src/modules/integrations/providers/mock-government.provider';
import { createMockModel } from './in-memory-mongo.mock';

import * as express from 'express';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../../src/modules/auth/strategies/jwt.strategy';

@Controller('test-security')
export class TestSecurityController {
  @Get('echo-query')
  echoQuery(@Query() q: any) {
    return { query: q };
  }

  @Post('echo-body')
  echoBody(@Body() b: any) {
    return { body: b };
  }

  @Post('rate-limited')
  @Throttle(3, 60) // Max 3 requests per 60 seconds
  rateLimited() {
    return { success: true };
  }

  @Get('admin-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SYSTEM_ADMIN)
  adminOnly() {
    return { authorized: true };
  }
}

describe('Phase 7: Security Hardening & Penetration Defense Tests', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authService: AuthService;
  let securityService: SecurityService;

  let userModel: any;
  let refreshTokenModel: any;
  let auditLogModel: any;

  const JWT_SECRET = 'test_security_secret_super_secure_32chars';

  beforeAll(async () => {
    userModel = createMockModel();
    refreshTokenModel = createMockModel();
    auditLogModel = createMockModel();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [TestSecurityController],
      providers: [
        AuthService,
        OtpService,
        AuditService,
        SecurityService,
        RedisService,
        JwtService,
        JwtStrategy,
        CsrfGuard,
        RateLimitGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultVal: any) => {
              if (key === 'JWT_ACCESS_SECRET') return JWT_SECRET;
              if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
              if (key === 'CORS_ORIGIN') return 'http://localhost:3000,http://localhost:5173,https://procure.gov.in';
              if (key === 'NODE_ENV') return 'test';
              return defaultVal;
            },
          },
        },
        {
          provide: GOVERNMENT_DATA_PROVIDER,
          useClass: MockGovernmentProvider,
        },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(RefreshToken.name), useValue: refreshTokenModel },
        { provide: getModelToken(AuditLog.name), useValue: auditLogModel },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(express.json());
    app.use(new MongoSanitizeMiddleware().use);
    app.useGlobalGuards(moduleFixture.get(CsrfGuard));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    authService = moduleFixture.get<AuthService>(AuthService);
    securityService = moduleFixture.get<SecurityService>(SecurityService);
  });

  afterAll(async () => {
    await app.close();
  });

  // --------------------------------------------------------------------------
  // 1. NoSQL Injection Neutralization
  // --------------------------------------------------------------------------
  describe('1. NoSQL Injection Neutralization (MongoSanitizeMiddleware)', () => {
    it('should strip $ operator keys from JSON body payloads', async () => {
      const maliciousBody = {
        username: 'operator01',
        password: { $gt: '' }, // NoSQL operator injection attempt
        $where: 'sleep(5000)',
      };

      const res = await request(app.getHttpServer())
        .post('/test-security/echo-body')
        .send(maliciousBody)
        .expect(201);

      // The $gt and $where keys must be stripped cleanly
      expect(res.body.body.username).toBe('operator01');
      expect(res.body.body.$where).toBeUndefined();
      expect(res.body.body.password).toEqual({});
    });

    it('should strip $ operator keys from URL query parameters', async () => {
      const res = await request(app.getHttpServer())
        .get('/test-security/echo-query?centreId[$ne]=null&filter=active')
        .expect(200);

      expect(res.body.query.filter).toBe('active');
      expect(res.body.query.centreId).toEqual({});
    });
  });

  // --------------------------------------------------------------------------
  // 2. JWT Tampering & Signature Validation
  // --------------------------------------------------------------------------
  describe('2. JWT Tampering & Role Elevation Defense', () => {
    it('should reject tokens with forged signatures', async () => {
      // Create a valid token signed with an unauthorized secret
      const forgedToken = jwtService.sign(
        { sub: 'usr-attacker', role: Role.SYSTEM_ADMIN },
        { secret: 'attacker_wrong_secret_cannot_forge_signature' },
      );

      await request(app.getHttpServer())
        .get('/test-security/admin-only')
        .set('Authorization', `Bearer ${forgedToken}`)
        .expect(401);
    });

    it('should reject tokens with algorithm none attacks', async () => {
      // Header: {"alg":"none","typ":"JWT"} -> eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0
      // Payload: {"sub":"usr-hacker","role":"SYSTEM_ADMIN"} -> eyJzdWIiOiJ1c3ItaGFja2VyIiwicm9sZSI6IlNZU1RFTV9BRE1JTiJ9
      const algNoneToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c3ItaGFja2VyIiwicm9sZSI6IlNZU1RFTV9BRE1JTiJ9.';

      await request(app.getHttpServer())
        .get('/test-security/admin-only')
        .set('Authorization', `Bearer ${algNoneToken}`)
        .expect(401);
    });

    it('should reject expired access tokens', async () => {
      const expiredToken = jwtService.sign(
        { sub: 'usr-expired', role: Role.SYSTEM_ADMIN },
        { secret: JWT_SECRET, expiresIn: '-10s' }, // Expired 10 seconds ago
      );

      await request(app.getHttpServer())
        .get('/test-security/admin-only')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Refresh Token Replay Defense & Family Invalidation
  // --------------------------------------------------------------------------
  describe('3. Refresh Token Replay & Reuse Detection (Section 19)', () => {
    it('should invalidate the entire token family when a revoked refresh token is presented', async () => {
      // Seed user
      const user = await userModel.create({
        username: 'farmer_sec_01',
        mobile: '9876543219',
        role: Role.FARMER,
        tokenVersion: 1,
        isActive: true,
      });

      const familyId = 'family-sec-101';
      const rawToken1 = 'raw_refresh_token_step_1';
      const rawToken2 = 'raw_refresh_token_step_2';

      // First token is already revoked (used)
      await refreshTokenModel.create({
        tokenHash: securityService.hashToken(rawToken1),
        userId: user._id.toString(),
        familyId,
        isRevoked: true, // Already used and rotated
        expiresAt: new Date(Date.now() + 86400000),
      });

      // Second token is currently active
      const activeTokenDoc = await refreshTokenModel.create({
        tokenHash: securityService.hashToken(rawToken2),
        userId: user._id.toString(),
        familyId,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 86400000),
      });

      // Attacker replays rawToken1
      await expect(
        authService.rotateRefreshToken(rawToken1, { ipAddress: '127.0.0.1' }),
      ).rejects.toThrow('Invalid session. Token reuse detected. Please log in again.');

      // Family Invalidation Check: activeTokenDoc must now be REVOKED as well
      const updatedActiveToken = await refreshTokenModel.findById(activeTokenDoc._id);
      expect(updatedActiveToken.isRevoked).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. CSRF & Origin Validation
  // --------------------------------------------------------------------------
  describe('4. CSRF Protection on Mutating State Endpoints', () => {
    it('should block mutating POST requests originating from an unauthorized origin', async () => {
      await request(app.getHttpServer())
        .post('/test-security/echo-body')
        .set('Origin', 'http://malicious-phishing-site.com')
        .send({ test: 'attack' })
        .expect(403);
    });

    it('should allow mutating POST requests originating from authorized CORS origins', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-security/echo-body')
        .set('Origin', 'https://procure.gov.in')
        .send({ test: 'legitimate' })
        .expect(201);

      expect(res.body.body.test).toBe('legitimate');
    });

    it('should allow mutating POST requests containing custom anti-forgery headers', async () => {
      const res = await request(app.getHttpServer())
        .post('/test-security/echo-body')
        .set('x-csrf-protection', '1')
        .send({ test: 'anti-forgery-header-present' })
        .expect(201);

      expect(res.body.body.test).toBe('anti-forgery-header-present');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Distributed Rate Limiting & Burst Defense
  // --------------------------------------------------------------------------
  describe('5. Distributed Rate Limiting (RateLimitGuard)', () => {
    it('should allow requests within limit and block bursts with HTTP 429', async () => {
      const rateLimitApp = (await Test.createTestingModule({
        controllers: [TestSecurityController],
        providers: [
          RateLimitGuard,
          RedisService,
          ConfigService,
        ],
      }).compile()).createNestApplication();

      rateLimitApp.useGlobalGuards(rateLimitApp.get(RateLimitGuard));
      await rateLimitApp.init();

      // Requests 1, 2, 3 should succeed (limit is 3 per 60s)
      await request(rateLimitApp.getHttpServer()).post('/test-security/rate-limited').expect(201);
      await request(rateLimitApp.getHttpServer()).post('/test-security/rate-limited').expect(201);
      await request(rateLimitApp.getHttpServer()).post('/test-security/rate-limited').expect(201);

      // Request 4 MUST fail with 429 Too Many Requests
      const blockedRes = await request(rateLimitApp.getHttpServer())
        .post('/test-security/rate-limited')
        .expect(429);

      expect(blockedRes.body.error).toBe('Too Many Requests');
      expect(blockedRes.headers['x-ratelimit-remaining']).toBe('0');

      await rateLimitApp.close();
    });
  });
});
