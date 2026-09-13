import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthModule } from '../../src/infrastructure/health/health.module';
import { HealthController } from '../../src/infrastructure/health/health.controller';
import { getConnectionToken } from '@nestjs/mongoose';
import { RedisService } from '../../src/infrastructure/redis/redis.service';
import { GOVERNMENT_DATA_PROVIDER } from '../../src/modules/integrations/contracts/government-data-provider.interface';
import { MockGovernmentProvider } from '../../src/modules/integrations/providers/mock-government.provider';

describe('Phase 7 (Part B): Health & Observability Probes (Section 25 & 37)', () => {
  let app: INestApplication;
  let mockConnection: any;
  let mockRedis: any;
  let mockGovProvider: any;

  beforeEach(async () => {
    mockConnection = {
      readyState: 1, // Connected
    };

    mockRedis = {
      isConnected: true,
      get: jest.fn().mockResolvedValue(null),
    };

    mockGovProvider = new MockGovernmentProvider();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: getConnectionToken(), useValue: mockConnection },
        { provide: RedisService, useValue: mockRedis },
        { provide: GOVERNMENT_DATA_PROVIDER, useValue: mockGovProvider },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /health (Comprehensive Health Report)', () => {
    it('should return 200 with healthy state, memory usage, and service metrics', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(res.body.system).toBeDefined();
      expect(res.body.system.nodeVersion).toBe(process.version);
      expect(res.body.system.memoryRssMb).toBeGreaterThan(0);
      expect(res.body.services.database.status).toBe('connected');
      expect(res.body.services.cache.status).toBe('connected');
      expect(res.body.services.governmentIntegration.provider).toBe('MOCK_GOVERNMENT_PROVIDER');
    });

    it('should report degraded status and 503 when primary database is disconnected', async () => {
      mockConnection.readyState = 0; // Disconnected

      const res = await request(app.getHttpServer())
        .get('/health')
        .expect(503);

      expect(res.body.status).toBe('degraded');
      expect(res.body.services.database.status).toBe('disconnected');
    });
  });

  describe('GET /ready (Orchestrator Readiness Probe)', () => {
    it('should return 200 OK when database is connected', async () => {
      mockConnection.readyState = 1;

      const res = await request(app.getHttpServer())
        .get('/ready')
        .expect(200);

      expect(res.body.status).toBe('ready');
      expect(res.body.timestamp).toBeDefined();
    });

    it('should return 503 Service Unavailable when database connection is dropped', async () => {
      mockConnection.readyState = 0;

      const res = await request(app.getHttpServer())
        .get('/ready')
        .expect(503);

      expect(res.body.status).toBe('not_ready');
      expect(res.body.reason).toContain('Database is disconnected');
    });
  });

  describe('GET /live (Process Heartbeat Liveness Probe)', () => {
    it('should return 200 OK with alive status and process uptime', async () => {
      const res = await request(app.getHttpServer())
        .get('/live')
        .expect(200);

      expect(res.body.status).toBe('alive');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });
  });
});
