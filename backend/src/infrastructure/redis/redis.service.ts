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

  // Dedicated subscriber client for Redis Pub/Sub
  private subClient: Redis | null = null;
  // Local Pub/Sub handlers map for cross-module/in-process communication and offline fallback
  private readonly localPubSub: Map<string, Set<(channel: string, message: string) => void>> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;

    try {
      const commonOptions = {
        lazyConnect: true,
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
        family: 0, // Dual-stack IPv4/IPv6 support for cloud environments
        retryStrategy: () => null, // Don't crash if Redis is unavailable
      };

      if (redisUrl) {
        this.client = new Redis(redisUrl, commonOptions);
        const maskedUrl = redisUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
        this.client.on('connect', () => {
          this.isConnected = true;
          this.logger.log(`Connected to Managed Redis via REDIS_URL (${maskedUrl})`);
        });
      } else {
        this.client = new Redis({
          host,
          port,
          password,
          ...commonOptions,
        });

        this.client.on('connect', () => {
          this.isConnected = true;
          this.logger.log(`Connected to Redis at ${host}:${port}`);
        });
      }

      this.client.on('error', (err) => {
        if (this.isConnected) {
          this.logger.warn(`Redis connection error: ${err.message}. Falling back to memory store.`);
        }
        this.isConnected = false;
      });

      await this.client.connect().catch((err) => {
        this.logger.warn(
          `Could not connect to Redis (${err.message}). Using resilient in-memory store for rate limiting / OTP / pubsub.`,
        );
        this.isConnected = false;
      });

      if (this.isConnected && this.client) {
        this.subClient = this.client.duplicate();
        this.subClient.on('message', (channel, message) => {
          const handlers = this.localPubSub.get(channel);
          if (handlers) {
            for (const handler of handlers) {
              try {
                handler(channel, message);
              } catch (e) {
                this.logger.error(`Error in pubsub message handler: ${e}`);
              }
            }
          }
        });
      }
    } catch (err: any) {
      this.logger.warn(`Redis initialization skipped: ${err.message}. Using in-memory fallback.`);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.subClient && this.isConnected) {
      await this.subClient.quit().catch(() => {});
    }
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

  // ==================== Distributed Locks (Section 16) ====================

  async acquireLock(resource: string, ttlMs: number = 5000): Promise<string | null> {
    const lockKey = `lock:${resource}`;
    const token = Math.random().toString(36).substring(2) + '-' + Date.now().toString(36);

    if (this.isConnected && this.client) {
      try {
        const result = await this.client.set(lockKey, token, 'PX', ttlMs, 'NX');
        return result === 'OK' ? token : null;
      } catch (err) {
        this.isConnected = false;
      }
    }

    // In-memory fallback
    const now = Date.now();
    const existing = this.memoryStore.get(lockKey);
    if (existing && existing.expiresAt && existing.expiresAt > now) {
      return null;
    }
    this.memoryStore.set(lockKey, { value: token, expiresAt: now + ttlMs });
    return token;
  }

  async releaseLock(resource: string, token: string): Promise<boolean> {
    const lockKey = `lock:${resource}`;

    if (this.isConnected && this.client) {
      try {
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const result = await this.client.eval(luaScript, 1, lockKey, token);
        return result === 1;
      } catch (err) {
        this.isConnected = false;
      }
    }

    // In-memory fallback
    const existing = this.memoryStore.get(lockKey);
    if (existing && existing.value === token) {
      this.memoryStore.delete(lockKey);
      return true;
    }
    return false;
  }

  // ==================== Live Queue / ETA Cache (Section 16) ====================

  async setLiveQueueState(centreId: string, state: any, ttlSeconds: number = 7200): Promise<void> {
    await this.set(`centre:${centreId}:live_queue`, JSON.stringify(state), ttlSeconds);
  }

  async getLiveQueueState<T = any>(centreId: string): Promise<T | null> {
    const data = await this.get(`centre:${centreId}:live_queue`);
    return data ? JSON.parse(data) : null;
  }

  async delLiveQueueState(centreId: string): Promise<void> {
    await this.del(`centre:${centreId}:live_queue`);
  }

  async setLiveEta(bookingId: string, etaData: any, ttlSeconds: number = 7200): Promise<void> {
    await this.set(`booking:${bookingId}:live_eta`, JSON.stringify(etaData), ttlSeconds);
  }

  async getLiveEta<T = any>(bookingId: string): Promise<T | null> {
    const data = await this.get(`booking:${bookingId}:live_eta`);
    return data ? JSON.parse(data) : null;
  }

  async setCentreLiveStatus(centreId: string, status: any, ttlSeconds: number = 7200): Promise<void> {
    await this.set(`centre:${centreId}:status`, JSON.stringify(status), ttlSeconds);
  }

  async getCentreLiveStatus<T = any>(centreId: string): Promise<T | null> {
    const data = await this.get(`centre:${centreId}:status`);
    return data ? JSON.parse(data) : null;
  }

  // ==================== Redis Pub/Sub (Section 23) ====================

  async publish(channel: string, message: string): Promise<number> {
    // Notify local in-process subscribers
    const handlers = this.localPubSub.get(channel);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(channel, message);
        } catch (e) {
          this.logger.error(`Error in local pubsub handler: ${e}`);
        }
      }
    }

    // Publish to Redis for multi-instance distribution
    if (this.isConnected && this.client) {
      try {
        return await this.client.publish(channel, message);
      } catch (err) {
        this.logger.warn(`Redis publish error: ${err}`);
      }
    }

    return handlers ? handlers.size : 0;
  }

  async subscribe(channel: string, handler: (channel: string, message: string) => void): Promise<void> {
    if (!this.localPubSub.has(channel)) {
      this.localPubSub.set(channel, new Set());
    }
    this.localPubSub.get(channel)!.add(handler);

    if (this.isConnected && this.subClient) {
      try {
        await this.subClient.subscribe(channel);
      } catch (err) {
        this.logger.warn(`Redis subscribe error: ${err}`);
      }
    }
  }

  async unsubscribe(channel: string, handler?: (channel: string, message: string) => void): Promise<void> {
    if (handler && this.localPubSub.has(channel)) {
      this.localPubSub.get(channel)!.delete(handler);
    } else {
      this.localPubSub.delete(channel);
    }

    if (this.isConnected && this.subClient && (!this.localPubSub.has(channel) || this.localPubSub.get(channel)!.size === 0)) {
      try {
        await this.subClient.unsubscribe(channel);
      } catch (err) {
        this.logger.warn(`Redis unsubscribe error: ${err}`);
      }
    }
  }
}
