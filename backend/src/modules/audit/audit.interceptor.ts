import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditAction, AuditSource } from './schemas/audit-log.schema';
import { AuthenticatedUser } from '../../shared/types/auth.types';
import { Role } from '../../shared/enums/roles.enum';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit state-mutating requests (POST, PUT, PATCH, DELETE)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const startTime = Date.now();
    const requestId = request.headers['x-request-id'] || `req-${Date.now()}`;
    const user: AuthenticatedUser | undefined = request.user;
    const ipAddress = request.ip || request.connection.remoteAddress || '127.0.0.1';
    const userAgent = request.headers['user-agent'] || 'unknown';

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Asynchronously record audit log without blocking the response
          if (user) {
            this.auditService
              .logAction({
                requestId,
                action: this.deriveAction(request.path, method),
                who: {
                  userId: user.userId,
                  role: user.role,
                  mobile: user.mobile,
                  email: user.email,
                  ipAddress,
                  userAgent,
                },
                target: {
                  entityType: this.deriveEntityType(request.path),
                  entityId: data?.id || data?._id || request.params?.id || 'UNKNOWN',
                },
                scope: user.scope,
                previousValue: null,
                newValue: data,
                source: AuditSource.HTTP_API,
                reason: request.body?.reason || undefined,
                status: 'SUCCESS',
              })
              .catch((err) => {
                this.logger.error(`Audit logging failed: ${err.message}`);
              });
          }
        },
      }),
    );
  }

  private deriveAction(path: string, method: string): AuditAction {
    if (path.includes('/auth/login')) return AuditAction.AUTH_LOGIN_PASSWORD;
    if (path.includes('/auth/otp/verify')) return AuditAction.AUTH_OTP_VERIFIED;
    if (path.includes('/auth/refresh')) return AuditAction.AUTH_TOKEN_REFRESHED;
    if (path.includes('/auth/operators')) return AuditAction.OPERATOR_CREATED;
    return AuditAction.ROLE_ASSIGNED;
  }

  private deriveEntityType(path: string): string {
    if (path.includes('/auth/operators') || path.includes('/auth/farmer')) return 'User';
    if (path.includes('/centres')) return 'Centre';
    if (path.includes('/bookings')) return 'Booking';
    return 'Resource';
  }
}
