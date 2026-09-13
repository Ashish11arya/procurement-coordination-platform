import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument, AuditAction, AuditSource } from './schemas/audit-log.schema';
import { Role } from '../../shared/enums/roles.enum';

export interface CreateAuditLogParams {
  requestId: string;
  action: AuditAction;
  who: {
    userId: string;
    role: Role;
    mobile?: string;
    email?: string;
    impersonatorId?: string;
    ipAddress: string;
    userAgent?: string;
  };
  target: {
    entityType: string;
    entityId: string;
  };
  scope?: {
    centreId?: string;
    districtId?: string;
    stateId?: string;
  };
  previousValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  source?: AuditSource;
  reason?: string;
  status?: 'SUCCESS' | 'FAILED' | 'REJECTED';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly sensitiveKeys = new Set([
    'password',
    'passwordhash',
    'refreshtoken',
    'token',
    'otp',
    'secret',
    'authorization',
  ]);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  async logAction(params: CreateAuditLogParams): Promise<AuditLogDocument> {
    try {
      const sanitizedPrevious = this.sanitizeObject(params.previousValue);
      const sanitizedNew = this.sanitizeObject(params.newValue);

      const entry = new this.auditLogModel({
        requestId: params.requestId || 'UNKNOWN_REQ',
        action: params.action,
        who: params.who,
        target: params.target,
        scope: params.scope,
        previousValue: sanitizedPrevious,
        newValue: sanitizedNew,
        source: params.source || AuditSource.HTTP_API,
        reason: params.reason,
        status: params.status || 'SUCCESS',
        timestamp: new Date(),
      });

      const saved = await entry.save();
      this.logger.log(
        `[AUDIT] Action: ${params.action} by User: ${params.who.userId} (${params.who.role}) on ${params.target.entityType}:${params.target.entityId} [Req: ${params.requestId}]`,
      );
      return saved;
    } catch (err: any) {
      this.logger.error(`Failed to persist audit log: ${err.message}`, err.stack);
      // Non-blocking for business flow, but logged as critical error
      throw err;
    }
  }

  async queryLogs(filter: {
    userId?: string;
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    centreId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    skip?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const query: any = {};
    if (filter.userId) query['who.userId'] = filter.userId;
    if (filter.action) query.action = filter.action;
    if (filter.entityType) query['target.entityType'] = filter.entityType;
    if (filter.entityId) query['target.entityId'] = filter.entityId;
    if (filter.centreId) query['scope.centreId'] = filter.centreId;
    if (filter.from || filter.to) {
      query.timestamp = {};
      if (filter.from) query.timestamp.$gte = filter.from;
      if (filter.to) query.timestamp.$lte = filter.to;
    }

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(filter.skip || 0)
        .limit(filter.limit || 50)
        .exec(),
      this.auditLogModel.countDocuments(query).exec(),
    ]);

    return { logs, total };
  }

  private sanitizeObject(obj?: Record<string, any> | null): Record<string, any> | null {
    if (!obj || typeof obj !== 'object') return null;
    const sanitized: Record<string, any> = {};

    for (const [key, val] of Object.entries(obj)) {
      if (this.sensitiveKeys.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        sanitized[key] = this.sanitizeObject(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
}
