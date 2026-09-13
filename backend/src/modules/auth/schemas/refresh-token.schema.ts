import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema({ timestamps: true, collection: 'refresh_tokens' })
export class RefreshToken {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  tokenHash: string; // SHA-256 hash of the refresh token

  @Prop({ required: true, index: true })
  familyId: string; // Token family UUID for rotation and reuse detection

  @Prop({ default: false })
  isRevoked: boolean;

  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date; // TTL index: MongoDB auto-removes expired records

  @Prop()
  createdByIp?: string;

  @Prop()
  userAgent?: string;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ userId: 1, familyId: 1 });
