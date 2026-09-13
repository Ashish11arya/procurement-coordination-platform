import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export const SKIP_CSRF_KEY = 'skipCsrf';
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: string[];

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    const rawOrigins = this.configService.get<string>(
      'CORS_ORIGIN',
      'http://localhost:3000,http://localhost:5173',
    );
    this.allowedOrigins = rawOrigins.split(',').map((o) => o.trim().toLowerCase());
  }

  canActivate(context: ExecutionContext): boolean {
    const isSkipped = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isSkipped) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();

    // Safe read-only HTTP methods are exempt from CSRF
    if (SAFE_METHODS.has(method)) {
      return true;
    }

    // 1. Check for Anti-CSRF Custom Headers (browsers block cross-site setting of custom headers)
    const customHeader =
      req.headers['x-requested-with'] ||
      req.headers['x-csrf-protection'] ||
      req.headers['idempotency-key'];

    if (customHeader) {
      return true;
    }

    // 2. Check Origin header
    const origin = req.headers['origin'] as string | undefined;
    if (origin) {
      const normalizedOrigin = origin.trim().toLowerCase();
      const isAllowed = this.allowedOrigins.some(
        (allowed) => allowed === '*' || normalizedOrigin === allowed || normalizedOrigin.startsWith(allowed),
      );
      if (isAllowed) {
        return true;
      }
      throw new ForbiddenException(`CSRF verification failed: Origin '${origin}' is not permitted.`);
    }

    // 3. Check Referer header as fallback
    const referer = req.headers['referer'] as string | undefined;
    if (referer) {
      const normalizedReferer = referer.trim().toLowerCase();
      const isAllowed = this.allowedOrigins.some(
        (allowed) => allowed === '*' || normalizedReferer.startsWith(allowed),
      );
      if (isAllowed) {
        return true;
      }
      throw new ForbiddenException(`CSRF verification failed: Referer '${referer}' is not permitted.`);
    }

    // If both Origin/Referer and custom headers are missing on mutating requests:
    // Allow in test environment for direct supertest calls unless explicitly testing CSRF
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-csrf-enforce']) {
      return true;
    }

    throw new ForbiddenException('CSRF verification failed: Missing origin or anti-forgery headers.');
  }
}
