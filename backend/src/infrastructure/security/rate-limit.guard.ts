import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RedisService } from '../redis/redis.service';

export const THROTTLE_KEY = 'rateLimitThrottle';
export const SKIP_THROTTLE_KEY = 'skipThrottle';

export interface ThrottleOptions {
  limit: number;
  ttlSeconds: number;
}

export const Throttle = (limit: number, ttlSeconds = 60) =>
  SetMetadata(THROTTLE_KEY, { limit, ttlSeconds });
export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE_KEY, true);

const DEFAULT_LIMIT = 100;
const DEFAULT_TTL_SECONDS = 60;

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isSkipped = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isSkipped) {
      return true;
    }

    const customThrottle = this.reflector.getAllAndOverride<ThrottleOptions>(THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const limit = customThrottle ? customThrottle.limit : DEFAULT_LIMIT;
    const ttlSeconds = customThrottle ? customThrottle.ttlSeconds : DEFAULT_TTL_SECONDS;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const routePath = req.baseUrl || req.path || '/';
    const rateLimitKey = `ratelimit:${ip}:${routePath}`;

    // Increment request count in Redis (or in-memory fallback if Redis offline)
    const current = await this.redisService.incr(rateLimitKey, ttlSeconds);
    const remaining = Math.max(0, limit - current);

    // Set standard RFC rate-limiting headers if response is available
    if (res && res.setHeader) {
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', ttlSeconds);
    }

    if (current > limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests from IP ${ip}. Rate limit exceeded (${limit} requests per ${ttlSeconds}s).`,
          error: 'Too Many Requests',
          retryAfterSeconds: ttlSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
