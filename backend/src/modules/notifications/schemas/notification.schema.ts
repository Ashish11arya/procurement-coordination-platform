import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationChannel {
  SMS = 'SMS',
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ required: true, unique: true, index: true })
  notificationId: string; // e.g. 'NOTIF-UUID'

  @Prop({ required: true, index: true })
  recipientUserId: string;

  @Prop({ required: true, index: true })
  recipientType: string; // 'FARMER' | 'OPERATOR' | 'ADMIN'

  @Prop({ required: true, index: true })
  eventType: string; // e.g. 'BOOKING_CONFIRMED', 'SCHEDULING_UPDATED'

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({
    required: true,
    enum: Object.values(NotificationChannel),
    default: NotificationChannel.IN_APP,
  })
  channel: NotificationChannel;

  @Prop({
    required: true,
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.DELIVERED,
  })
  status: NotificationStatus;

  @Prop({ default: false, index: true })
  read: boolean;

  @Prop({ index: true })
  bookingId?: string;

  @Prop({ index: true })
  centreId?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ recipientUserId: 1, createdAt: -1 });
