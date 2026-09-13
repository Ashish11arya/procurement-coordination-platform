import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type IdempotencyRecordDocument = IdempotencyRecord & Document;

@Schema({ timestamps: true, collection: 'idempotency_records' })
export class IdempotencyRecord {
  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop({ required: true })
  endpoint: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  requestHash: string; // SHA-256 of request payload

  @Prop({ required: true })
  statusCode: number;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  responseBody: any;

  @Prop({ default: Date.now, expires: 86400 }) // Auto-removed after 24 hours
  createdAt: Date;
}

export const IdempotencyRecordSchema = SchemaFactory.createForClass(IdempotencyRecord);
