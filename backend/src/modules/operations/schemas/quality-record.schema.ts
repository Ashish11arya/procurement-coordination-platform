import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum QualityGrade {
  GRADE_A = 'GRADE_A',
  GRADE_B = 'GRADE_B',
  GRADE_C = 'GRADE_C',
  BELOW_FAQ = 'BELOW_FAQ', // Fair Average Quality
}

export enum QualityVerdict {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  HELD = 'HELD',
}

export type QualityRecordDocument = QualityRecord & Document;

@Schema({ timestamps: true, collection: 'quality_records' })
export class QualityRecord {
  @Prop({ required: true, index: true })
  bookingId: string;

  @Prop({ required: true, index: true })
  centreId: string;

  @Prop({ required: true })
  counterId: string;

  @Prop({ required: true })
  commodityCode: string;

  @Prop({ required: true })
  moisturePercentage: number;

  @Prop({ required: true })
  foreignMatterPercentage: number;

  @Prop({ required: true })
  damagedGrainsPercentage: number;

  @Prop({ required: true, enum: QualityGrade })
  assignedGrade: QualityGrade;

  @Prop({ required: true, enum: QualityVerdict, index: true })
  verdict: QualityVerdict;

  @Prop()
  rejectionReason?: string;

  @Prop({ required: true })
  operatorId: string;

  @Prop({ required: true })
  assessedAt: Date;

  @Prop()
  notes?: string;
}

export const QualityRecordSchema = SchemaFactory.createForClass(QualityRecord);
QualityRecordSchema.index({ centreId: 1, assessedAt: -1 });
