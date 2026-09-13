import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum GovSyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export type ProcurementRecordDocument = ProcurementRecord & Document;

@Schema({ timestamps: true, collection: 'procurement_records' })
export class ProcurementRecord {
  @Prop({ required: true, unique: true, index: true })
  bookingId: string;

  @Prop({ required: true, index: true })
  centreId: string;

  @Prop({ required: true, index: true })
  farmerId: string;

  @Prop({ required: true })
  commodityCode: string;

  @Prop({ required: true })
  finalQuantityQuintals: number;

  @Prop({ required: true })
  mspRatePerQuintal: number;

  @Prop({ required: true })
  totalPayoutEstimated: number;

  @Prop({ required: true, unique: true, index: true })
  receiptNumber: string;

  @Prop({ required: true })
  operatorId: string;

  @Prop({ required: true, enum: GovSyncStatus, default: GovSyncStatus.PENDING, index: true })
  govSyncStatus: GovSyncStatus;

  @Prop()
  govReferenceId?: string;

  @Prop()
  govSyncError?: string;

  @Prop({ required: true })
  procuredAt: Date;
}

export const ProcurementRecordSchema = SchemaFactory.createForClass(ProcurementRecord);
ProcurementRecordSchema.index({ centreId: 1, procuredAt: -1 });
