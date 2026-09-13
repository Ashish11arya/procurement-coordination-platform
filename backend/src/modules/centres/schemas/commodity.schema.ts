import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CommodityDocument = Commodity & Document;

@Schema({ timestamps: true, collection: 'commodities' })
export class Commodity {
  @Prop({ required: true, unique: true, index: true, uppercase: true })
  code: string; // e.g. 'WHEAT', 'CHANA', 'MUSTARD', 'SOYBEAN'

  @Prop({ required: true })
  name: string; // e.g. 'Wheat (Sharbati)', 'Gram / Chana'

  @Prop({ required: true, min: 1 })
  mspPerQuintal: number; // Minimum Support Price in INR

  @Prop({ required: true, default: 'RABI_2026' })
  season: string; // e.g. 'RABI_2026', 'KHARIF_2026'

  @Prop({ required: true, default: 50 })
  standardBagWeightKg: number; // Standard jute bag weight

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const CommoditySchema = SchemaFactory.createForClass(Commodity);
