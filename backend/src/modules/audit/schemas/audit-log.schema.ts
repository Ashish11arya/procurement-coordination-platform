import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Role } from '../../../shared/enums/roles.enum';

export type AuditLogDocument = AuditLog & Document;

export enum AuditAction {
  // Auth actions
  AUTH_OTP_REQUESTED = 'AUTH_OTP_REQUESTED',
  AUTH_OTP_VERIFIED = 'AUTH_OTP_VERIFIED',
  AUTH_LOGIN_PASSWORD = 'AUTH_LOGIN_PASSWORD',
  AUTH_TOKEN_REFRESHED = 'AUTH_TOKEN_REFRESHED',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  AUTH_SUSPICIOUS_ATTEMPT = 'AUTH_SUSPICIOUS_ATTEMPT',
  AUTH_ACCOUNT_LOCKED = 'AUTH_ACCOUNT_LOCKED',

  // Administrative & RBAC actions
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  OPERATOR_CREATED = 'OPERATOR_CREATED',
  USER_DISABLED = 'USER_DISABLED',

  // Operations actions
  CHECKIN_RECORDED = 'CHECKIN_RECORDED',
  WEIGHING_SUBMITTED = 'WEIGHING_SUBMITTED',
  QUALITY_ASSESSED = 'QUALITY_ASSESSED',
  PROCUREMENT_FINALIZED = 'PROCUREMENT_FINALIZED',
  BOOKING_OVERRIDDEN = 'BOOKING_OVERRIDDEN',
  CAPACITY_ADJUSTED = 'CAPACITY_ADJUSTED',

  // Integration actions
  GOVERNMENT_SYNC_TRIGGERED = 'GOVERNMENT_SYNC_TRIGGERED',
  GOVERNMENT_SYNC_FAILED = 'GOVERNMENT_SYNC_FAILED',
}

export enum AuditSource {
  HTTP_API = 'HTTP_API',
  BACKGROUND_JOB = 'BACKGROUND_JOB',
  SYSTEM_SCHEDULER = 'SYSTEM_SCHEDULER',
  CLI_TOOL = 'CLI_TOOL',
}

@Schema({ timestamps: { createdAt: 'timestamp', updatedAt: false }, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ required: true, index: true })
  requestId: string;

  @Prop({ required: true, index: true, enum: AuditAction })
  action: AuditAction;

  @Prop({
    type: {
      userId: { type: String, required: true, index: true },
      role: { type: String, enum: Role, required: true },
      mobile: String,
      email: String,
      impersonatorId: String,
      ipAddress: { type: String, required: true },
      userAgent: String,
    },
    required: true,
  })
  who: {
    userId: string;
    role: Role;
    mobile?: string;
    email?: string;
    impersonatorId?: string;
    ipAddress: string;
    userAgent?: string;
  };

  @Prop({
    type: {
      entityType: { type: String, required: true, index: true },
      entityId: { type: String, required: true, index: true },
    },
    required: true,
  })
  target: {
    entityType: string;
    entityId: string;
  };

  @Prop({
    type: {
      centreId: { type: String, index: true },
      districtId: { type: String, index: true },
      stateId: { type: String, index: true },
    },
  })
  scope?: {
    centreId?: string;
    districtId?: string;
    stateId?: string;
  };

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  previousValue?: Record<string, any> | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  newValue?: Record<string, any> | null;

  @Prop({ enum: AuditSource, default: AuditSource.HTTP_API, required: true })
  source: AuditSource;

  @Prop({ type: String })
  reason?: string;

  @Prop({ type: String, enum: ['SUCCESS', 'FAILED', 'REJECTED'], default: 'SUCCESS' })
  status: 'SUCCESS' | 'FAILED' | 'REJECTED';

  @Prop({ default: Date.now, index: true })
  timestamp: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ 'target.entityType': 1, 'target.entityId': 1, timestamp: -1 });
AuditLogSchema.index({ 'who.userId': 1, timestamp: -1 });
AuditLogSchema.index({ 'scope.centreId': 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
