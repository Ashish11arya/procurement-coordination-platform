import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument, NotificationChannel, NotificationStatus } from './schemas/notification.schema';
import { EventBusService } from '../../infrastructure/events/event-bus.service';
import { DomainEvent, DomainEventType } from '../../infrastructure/events/domain-events';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    private readonly eventBusService: EventBusService,
  ) {}

  onModuleInit() {
    this.registerEventSubscriptions();
  }

  private registerEventSubscriptions() {
    // 1. BOOKING_CONFIRMED
    this.eventBusService.subscribe(DomainEventType.BOOKING_CONFIRMED, async (event: DomainEvent) => {
      await this.handleBookingConfirmed(event);
    });

    // 2. TOKEN_ASSIGNED (At gate check-in)
    this.eventBusService.subscribe(DomainEventType.TOKEN_ASSIGNED, async (event: DomainEvent) => {
      await this.handleTokenAssigned(event);
    });

    // 3. SCHEDULING_UPDATED (Dynamic adaptation - moved forward)
    this.eventBusService.subscribe(DomainEventType.SCHEDULING_UPDATED, async (event: DomainEvent) => {
      await this.handleSchedulingUpdated(event);
    });

    // 4. WEIGHMENT_COMPLETED
    this.eventBusService.subscribe(DomainEventType.WEIGHMENT_COMPLETED, async (event: DomainEvent) => {
      await this.handleWeighmentCompleted(event);
    });

    // 5. QUALITY_COMPLETED
    this.eventBusService.subscribe(DomainEventType.QUALITY_COMPLETED, async (event: DomainEvent) => {
      await this.handleQualityCompleted(event);
    });

    // 6. PROCUREMENT_COMPLETED
    this.eventBusService.subscribe(DomainEventType.PROCUREMENT_COMPLETED, async (event: DomainEvent) => {
      await this.handleProcurementCompleted(event);
    });

    // 7. PAYMENT_STATUS_UPDATED
    this.eventBusService.subscribe(DomainEventType.PAYMENT_STATUS_UPDATED, async (event: DomainEvent) => {
      await this.handlePaymentStatusUpdated(event);
    });

    // 8. FARMER_NO_SHOW
    this.eventBusService.subscribe(DomainEventType.FARMER_NO_SHOW, async (event: DomainEvent) => {
      await this.handleFarmerNoShow(event);
    });
  }

  async createNotification(data: {
    recipientUserId: string;
    recipientType?: string;
    eventType: string;
    title: string;
    body: string;
    channel?: NotificationChannel;
    bookingId?: string;
    centreId?: string;
    metadata?: Record<string, any>;
  }): Promise<NotificationDocument> {
    const notif = await this.notificationModel.create({
      notificationId: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      recipientUserId: data.recipientUserId,
      recipientType: data.recipientType || 'FARMER',
      eventType: data.eventType,
      title: data.title,
      body: data.body,
      channel: data.channel || NotificationChannel.IN_APP,
      status: NotificationStatus.DELIVERED,
      read: false,
      bookingId: data.bookingId,
      centreId: data.centreId,
      metadata: data.metadata,
    });

    this.logger.log(`[Notification Dispatch] Sent ${data.eventType} to user ${data.recipientUserId}: "${data.title}"`);
    return notif;
  }

  async getNotificationsForUser(userId: string, limit: number = 50): Promise<NotificationDocument[]> {
    return this.notificationModel
      .find({ recipientUserId: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async markAsRead(notificationId: string, userId: string): Promise<NotificationDocument> {
    const notif = await this.notificationModel.findOne({ notificationId, recipientUserId: userId }).exec();
    if (!notif) {
      throw new NotFoundException(`Notification with ID ${notificationId} not found`);
    }
    notif.read = true;
    return notif.save();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany({ recipientUserId: userId, read: false }, { read: true }).exec();
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({ recipientUserId: userId, read: false }).exec();
  }

  // ==================== Domain Event Handlers ====================

  private async handleBookingConfirmed(event: DomainEvent) {
    const { bookingId, farmerId, centreId, arrivalWindow, commodityCode, quantityQuintals } = event.payload || {};
    if (!farmerId) return;

    await this.createNotification({
      recipientUserId: farmerId,
      eventType: DomainEventType.BOOKING_CONFIRMED,
      title: 'Procurement Booking Confirmed',
      body: `Your booking for ${quantityQuintals}Q of ${commodityCode} has been confirmed for slot ${arrivalWindow?.startTime || ''}-${arrivalWindow?.endTime || ''} at centre ${centreId}.`,
      bookingId,
      centreId,
      metadata: event.payload,
    });
  }

  private async handleTokenAssigned(event: DomainEvent) {
    const { bookingId, farmerId, centreId, tokenNumber } = event.payload || {};
    if (!farmerId) return;

    await this.createNotification({
      recipientUserId: farmerId,
      eventType: DomainEventType.TOKEN_ASSIGNED,
      title: `Token ${tokenNumber} Assigned`,
      body: `You are checked in at centre ${centreId}. Your queue token is ${tokenNumber}. Please proceed to the weighbridge counter when called.`,
      bookingId,
      centreId,
      metadata: event.payload,
    });
  }

  private async handleSchedulingUpdated(event: DomainEvent) {
    const { bookingId, farmerId, centreId, previousSlot, newSlot, reason } = event.payload || {};
    if (!farmerId) return;

    await this.createNotification({
      recipientUserId: farmerId,
      eventType: DomainEventType.SCHEDULING_UPDATED,
      title: 'Slot Moved Forward (Dynamic Adaptation)',
      body: `Capacity opened up! Your arrival window at centre ${centreId} has been moved forward to ${newSlot?.startTime}-${newSlot?.endTime} (previously ${previousSlot?.startTime}-${previousSlot?.endTime}).`,
      bookingId,
      centreId,
      metadata: event.payload,
    });
  }

  private async handleWeighmentCompleted(event: DomainEvent) {
    const { bookingId, farmerId, centreId, grossWeightKg, tareWeightKg, netWeightQuintals } = event.payload || {};
    if (!farmerId) return;

    await this.createNotification({
      recipientUserId: farmerId,
      eventType: DomainEventType.WEIGHMENT_COMPLETED,
      title: 'Weighment Slip Recorded',
      body: `Gross Weight: ${grossWeightKg}kg, Tare: ${tareWeightKg}kg, Net Weight: ${netWeightQuintals}Q. Please move to Quality Testing Counter.`,
      bookingId,
      centreId,
      metadata: event.payload,
    });
  }

  private async handleQualityCompleted(event: DomainEvent) {
    const { bookingId, farmerId, centreId, verdict, moisturePercentage } = event.payload || {};
    if (!farmerId) return;

    await this.createNotification({
      recipientUserId: farmerId,
      eventType: DomainEventType.QUALITY_COMPLETED,
      title: `Quality Inspection: ${verdict}`,
      body: `Your produce quality test was marked as ${verdict} (Moisture: ${moisturePercentage}%).`,
      bookingId,
      centreId,
      metadata: event.payload,
    });
  }

  private async handleProcurementCompleted(event: DomainEvent) {
    const { bookingId, farmerId, centreId, quantityProcuredQuintals } = event.payload || {};
    if (!farmerId) return;

    await this.createNotification({
      recipientUserId: farmerId,
      eventType: DomainEventType.PROCUREMENT_COMPLETED,
      title: 'Procurement Finalized',
      body: `Successfully procured ${quantityProcuredQuintals}Q. Authoritative procurement receipt generated. Payment processing is now in progress.`,
      bookingId,
      centreId,
      metadata: event.payload,
    });
  }

  private async handlePaymentStatusUpdated(event: DomainEvent) {
    const { bookingId, farmerId, centreId, paymentStatus, transactionRef } = event.payload || {};
    if (!farmerId) return;

    await this.createNotification({
      recipientUserId: farmerId,
      eventType: DomainEventType.PAYMENT_STATUS_UPDATED,
      title: `Payment Update: ${paymentStatus}`,
      body: `Payment status for booking ${bookingId} is now ${paymentStatus}. Transaction Ref: ${transactionRef || 'N/A'}.`,
      bookingId,
      centreId,
      metadata: event.payload,
    });
  }

  private async handleFarmerNoShow(event: DomainEvent) {
    const { bookingId, farmerId, centreId } = event.payload || {};
    if (!farmerId) return;

    await this.createNotification({
      recipientUserId: farmerId,
      eventType: DomainEventType.FARMER_NO_SHOW,
      title: 'Missed Arrival Window (No-Show)',
      body: `Your arrival window for booking ${bookingId} at centre ${centreId} has expired. Please contact centre admin or request a new booking.`,
      bookingId,
      centreId,
      metadata: event.payload,
    });
  }
}
