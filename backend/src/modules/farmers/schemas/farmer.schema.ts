import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FarmerDocument = Farmer & Document;

@Schema({ timestamps: true, collection: 'farmers' })
export class Farmer {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: Types.ObjectId;

  // Authoritative Government Identity (Read-only; sourced from GovernmentDataProvider)
  @Prop({ required: true, unique: true, index: true })
  farmerId: string; // e.g. 'FARMER-MP-IND-001'

  @Prop({ required: true, index: true })
  registrationNumber: string;

  @Prop({ required: true, index: true })
  mobile: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true, index: true })
  district: string;

  @Prop()
  subDistrict: string;

  @Prop()
  village: string;

  @Prop({ required: true, default: 0 })
  landAreaAcres: number;

  @Prop({ default: true })
  bankAccountVerified: boolean;

  // Farmer-Editable Preference Fields
  @Prop()
  contactAddress?: string;

  @Prop({ default: 'hi', enum: ['hi', 'en'] })
  preferredLanguage: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const FarmerSchema = SchemaFactory.createForClass(Farmer);

FarmerSchema.index({ state: 1, district: 1 });
