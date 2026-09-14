import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../../../shared/enums/roles.enum';

export type DataProcessingLogDocument = DataProcessingLog & Document;

export enum ProcessingPurpose {
  FARMER_REGISTRATION_ONBOARDING = 'FARMER_REGISTRATION_ONBOARDING',
  GATE_CHECKIN_VERIFICATION = 'GATE_CHECKIN_VERIFICATION',
  WEIGHBRIDGE_SCALE_OPERATIONS = 'WEIGHBRIDGE_SCALE_OPERATIONS',
  QUALITY_LAB_ASSAY = 'QUALITY_LAB_ASSAY',
  PAYMENT_DBT_DISPATCH = 'PAYMENT_DBT_DISPATCH',
  DATA_SUBJECT_EXPORT = 'DATA_SUBJECT_EXPORT',
  DATA_SUBJECT_ERASURE = 'DATA_SUBJECT_ERASURE',
  ADMIN_INSPECTION = 'ADMIN_INSPECTION',
  GOVERNMENT_SUBSIDY_AUDIT = 'GOVERNMENT_SUBSIDY_AUDIT',
}

export enum LawfulBasis {
  CONSENT_SEC_6 = 'CONSENT_SEC_6',
  LEGITIMATE_USE_SEC_7B = 'LEGITIMATE_USE_SEC_7B', // Provision of Government Subsidy/Benefit
  LEGAL_OBLIGATION_SEC_7F = 'LEGAL_OBLIGATION_SEC_7F', // Compliance with Law/Judicial Order
}

export enum ProcessingAction {
  READ = 'READ',
  EXPORT = 'EXPORT',
  UPDATE = 'UPDATE',
  ANONYMIZE = 'ANONYMIZE',
  PURGE = 'PURGE',
}

@Schema({ timestamps: { createdAt: 'accessedAt', updatedAt: false }, collection: 'data_processing_logs' })
export class DataProcessingLog {
  @Prop({ required: true, unique: true, index: true })
  logId: string; // UUID

  @Prop({
    type: {
      userId: { type: String, required: true, index: true },
      role: { type: String, enum: Role, required: true },
      name: { type: String, required: true },
      ipAddress: { type: String, required: true },
      userAgent: String,
    },
    required: true,
  })
  accessor: {
    userId: string;
    role: Role;
    name: string;
    ipAddress: string;
    userAgent?: string;
  };

  @Prop({
    type: {
      farmerId: { type: String, required: true, index: true },
      userId: { type: String, index: true },
      mobileMasked: String,
    },
    required: true,
  })
  dataSubject: {
    farmerId: string;
    userId?: string;
    mobileMasked?: string;
  };

  @Prop({
    type: [String],
    default: ['NAME', 'MOBILE'],
    required: true,
  })
  dataCategoriesAccessed: string[]; // e.g. ['NAME', 'MOBILE', 'LAND_RECORDS', 'BANK_VERIFIED']

  @Prop({ required: true, enum: ProcessingPurpose, index: true })
  processingPurpose: ProcessingPurpose;

  @Prop({ required: true, enum: LawfulBasis, default: LawfulBasis.LEGITIMATE_USE_SEC_7B })
  lawfulBasis: LawfulBasis;

  @Prop({ required: true, enum: ProcessingAction, default: ProcessingAction.READ })
  action: ProcessingAction;

  @Prop()
  details?: string;

  @Prop({ default: Date.now, index: true })
  accessedAt: Date;
}

export const DataProcessingLogSchema = SchemaFactory.createForClass(DataProcessingLog);

DataProcessingLogSchema.index({ 'dataSubject.farmerId': 1, accessedAt: -1 });
DataProcessingLogSchema.index({ 'accessor.userId': 1, accessedAt: -1 });
DataProcessingLogSchema.index({ processingPurpose: 1, accessedAt: -1 });
