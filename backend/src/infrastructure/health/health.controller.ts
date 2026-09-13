import { Controller, Get, HttpStatus, Inject, Optional, Res } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Response } from 'express';
import { RedisService } from '../redis/redis.service';
import {
  GovernmentDataProvider,
  GOVERNMENT_DATA_PROVIDER,
} from '../../modules/integrations/contracts/government-data-provider.interface';
import { SkipCsrf } from '../security/csrf.guard';

@Controller()
@SkipCsrf()
export class HealthController {
  constructor(
    @Optional() @InjectConnection() private readonly connection?: Connection,
    @Optional() private readonly redisService?: RedisService,
    @Optional() @Inject(GOVERNMENT_DATA_PROVIDER) private readonly govProvider?: GovernmentDataProvider,
  ) {}

  /**
   * Comprehensive System Health Check
   * GET /health
   */
  @Get('health')
  async getHealth(@Res() res: Response) {
    const isMongoConnected = this.connection ? this.connection.readyState === 1 : true;
    const isRedisReady = this.redisService ? (this.redisService as any).isConnected ?? true : true;
    const providerName = this.govProvider?.providerName || 'MOCK_GOVERNMENT_PROVIDER';

    const memoryUsage = process.memoryUsage();
    const isHealthy = isMongoConnected;

    const payload = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
        memoryRssMb: Number((memoryUsage.rss / (1024 * 1024)).toFixed(2)),
        memoryHeapUsedMb: Number((memoryUsage.heapUsed / (1024 * 1024)).toFixed(2)),
      },
      services: {
        database: {
          status: isMongoConnected ? 'connected' : 'disconnected',
          readyState: this.connection?.readyState ?? 1,
        },
        cache: {
          status: isRedisReady ? 'connected' : 'fallback_memory_active',
        },
        governmentIntegration: {
          provider: providerName,
          status: 'operational',
        },
      },
    };

    return res.status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json(payload);
  }

  /**
   * Kubernetes / Orchestrator Readiness Probe
   * GET /ready
   * Returns 200 when all essential datastores are ready to receive traffic, 503 otherwise.
   */
  @Get('ready')
  async getReadiness(@Res() res: Response) {
    const isMongoConnected = this.connection ? this.connection.readyState === 1 : true;

    if (!isMongoConnected) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'not_ready',
        reason: 'Database is disconnected',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(HttpStatus.OK).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  }

  /**
   * Kubernetes / Orchestrator Liveness Probe
   * GET /live
   * Returns 200 as long as the process is alive.
   */
  @Get('live')
  getLiveness(@Res() res: Response) {
    return res.status(HttpStatus.OK).json({
      status: 'alive',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }
}
