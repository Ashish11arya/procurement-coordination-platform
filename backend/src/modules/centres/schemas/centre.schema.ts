import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CentreDocument = Centre & Document;

@Schema({ timestamps: true, collection: 'centres' })
export class Centre {
  @Prop({ required: true, unique: true, index: true })
  centreId: string; // e.g. 'CENTRE-MP-IND-01'

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  agencyName: string; // e.g. 'NAFED', 'MP State Civil Supplies'

  @Prop({ required: true, index: true })
  state: string;

  @Prop({ required: true, index: true })
  district: string;

  @Prop({ required: true })
  address: string;

  @Prop({
    type: { latitude: Number, longitude: Number },
    required: true,
  })
  coordinates: {
    latitude: number;
    longitude: number;
  };

  @Prop({ required: true })
  operatingSeason: string; // e.g. 'RABI_2026'

  @Prop({ type: [String], required: true, index: true })
  supportedCommodities: string[]; // e.g. ['WHEAT', 'CHANA', 'MUSTARD']

  @Prop({ required: true, min: 1 })
  dailyCapacityQuintals: number; // Physical sanctioned daily capacity

  @Prop({ required: true, min: 1, default: 15 })
  maxSimultaneousVehicles: number;

  @Prop({
    type: { openTime: String, closeTime: String },
    default: { openTime: '09:00', closeTime: '18:00' },
  })
  operatingHours: {
    openTime: string;
    closeTime: string;
  };

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const CentreSchema = SchemaFactory.createForClass(Centre);

CentreSchema.index({ state: 1, district: 1, isActive: 1 });
