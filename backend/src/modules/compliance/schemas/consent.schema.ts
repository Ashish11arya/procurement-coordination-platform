import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConsentRecordDocument = ConsentRecord & Document;

export enum ConsentStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

@Schema({ timestamps: { createdAt: 'grantedAt', updatedAt: 'updatedAt' }, collection: 'farmer_consents' })
export class ConsentRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  farmerId: string; // e.g. 'FARMER-MP-IND-001'

  @Prop({ required: true, default: 'DPDP-2023-V1.0' })
  consentVersion: string;

  @Prop({
    type: [String],
    default: [
      'MSP_PROCUREMENT_COORDINATION',
      'YARD_SCHEDULING_AND_ENTRY',
      'DIRECT_BENEFIT_TRANSFER_PAYMENT',
      'SMS_NOTIFICATION_DISPATCH',
    ],
    required: true,
  })
  purposes: string[];

  @Prop({ required: true })
  ipAddress: string;

  @Prop()
  userAgent?: string;

  @Prop({ default: 'DPDP-2023-V1.0' })
  privacyPolicyVersion: string;

  @Prop({ default: '/docs/legal/PRIVACY_POLICY.md' })
  privacyPolicyUrl: string;

  @Prop({ required: true, enum: ConsentStatus, default: ConsentStatus.ACTIVE, index: true })
  status: ConsentStatus;

  @Prop()
  revokedAt?: Date;

  @Prop()
  revocationReason?: string;

  @Prop({ default: Date.now, index: true })
  grantedAt: Date;

  @Prop()
  updatedAt?: Date;
}

export const ConsentRecordSchema = SchemaFactory.createForClass(ConsentRecord);

ConsentRecordSchema.index({ farmerId: 1, status: 1 });
ConsentRecordSchema.index({ userId: 1, status: 1 });
