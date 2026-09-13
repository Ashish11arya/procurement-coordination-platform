import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  // In-memory fallback map if Redis server is not running (enables seamless local tests and dev)
  private readonly memoryStore: Map<string, { value: string; expiresAt?: number }> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;

    try {
      this.client = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Don't crash if Redis is unavailable
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Connected to Redis at ${host}:${port}`);
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          this.logger.warn(`Redis connection error: ${err.message}. Falling back to memory store.`);
        }
        this.isConnected = false;
      });

      await this.client.connect().catch((err) => {
        this.logger.warn(
          `Could not connect to Redis (${err.message}). Using resilient in-memory store for rate limiting / OTP state.`,
        );
        this.isConnected = false;
      });
    } catch (err: any) {
      this.logger.warn(`Redis initialization skipped: ${err.message}. Using in-memory fallback.`);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.client && this.isConnected) {
      await this.client.quit().catch(() => {});
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.get(key);
      } catch (err) {
        this.isConnected = false;
      }
    }
    const item = this.memoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        if (ttlSeconds) {
          await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch (err) {
        this.isConnected = false;
      }
    }
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.memoryStore.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
        return;
      } catch (err) {
        this.isConnected = false;
      }
    }
    this.memoryStore.delete(key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (this.isConnected && this.client) {
      try {
        const count = await this.client.incr(key);
        if (count === 1 && ttlSeconds) {
          await this.client.expire(key, ttlSeconds);
        }
        return count;
      } catch (err) {
        this.isConnected = false;
      }
    }
    const existing = await this.get(key);
    const count = existing ? parseInt(existing, 10) + 1 : 1;
    await this.set(key, count.toString(), ttlSeconds);
    return count;
  }

  async ttl(key: string): Promise<number> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.ttl(key);
      } catch (err) {
        this.isConnected = false;
      }
    }
    const item = this.memoryStore.get(key);
    if (!item || !item.expiresAt) return -1;
    const remaining = Math.floor((item.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }
}
