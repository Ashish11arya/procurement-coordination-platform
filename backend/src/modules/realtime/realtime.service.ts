import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { EventBusService } from '../../infrastructure/events/event-bus.service';
import { DomainEvent, DomainEventType } from '../../infrastructure/events/domain-events';

export interface ChannelMessage {
  channel: string;
  event: string;
  data: any;
  timestamp: string;
}

@Injectable()
export class RealtimeService implements OnModuleInit {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly messageStream$ = new Subject<ChannelMessage>();
  private localSocketEmitter?: (channel: string, event: string, data: any) => void;

  constructor(
    private readonly redisService: RedisService,
    private readonly eventBusService: EventBusService,
  ) {}

  async onModuleInit() {
    // 1. Subscribe to cross-instance Redis Pub/Sub for WebSockets
    await this.redisService.subscribe('ws:broadcast', (channel, message) => {
      try {
        const payload: ChannelMessage = JSON.parse(message);
        this.dispatchToLocalSubscribers(payload.channel, payload.event, payload.data);
      } catch (err: any) {
        this.logger.error(`Error parsing Redis Pub/Sub broadcast: ${err.message}`);
      }
    });

    // 2. Wire domain events from Section 14 to scoped real-time channels
    this.registerDomainEventSubscriptions();
  }

  setLocalSocketEmitter(emitter: (channel: string, event: string, data: any) => void) {
    this.localSocketEmitter = emitter;
  }

  async emitToChannel(channel: string, event: string, data: any): Promise<void> {
    const message: ChannelMessage = {
      channel,
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    // Dispatch locally (SSE + local WebSocket sockets)
    this.dispatchToLocalSubscribers(channel, event, data);

    // Broadcast across instances via Redis Pub/Sub
    try {
      await this.redisService.publish('ws:broadcast', JSON.stringify(message));
    } catch (err: any) {
      this.logger.warn(`Failed to publish message to Redis: ${err.message}`);
    }
  }

  getChannelStream(channel: string): Observable<ChannelMessage> {
    return this.messageStream$.asObservable().pipe(
      filter((msg) => msg.channel === channel),
    );
  }

  private dispatchToLocalSubscribers(channel: string, event: string, data: any) {
    // Push to RxJS SSE stream
    this.messageStream$.next({
      channel,
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    // Push to local WebSocket clients
    if (this.localSocketEmitter) {
      try {
        this.localSocketEmitter(channel, event, data);
      } catch (err: any) {
        this.logger.error(`Error emitting to local socket room: ${err.message}`);
      }
    }
  }

  private registerDomainEventSubscriptions() {
    // 1. BOOKING_CONFIRMED -> booking:{bookingId}
    this.eventBusService.subscribe(DomainEventType.BOOKING_CONFIRMED, async (e: DomainEvent) => {
      if (e.bookingId) {
        await this.emitToChannel(`booking:${e.bookingId}`, 'BOOKING_CONFIRMED', e.payload);
      }
    });

    // 2. TOKEN_ASSIGNED -> booking:{bookingId} and centre:{centreId}
    this.eventBusService.subscribe(DomainEventType.TOKEN_ASSIGNED, async (e: DomainEvent) => {
      if (e.bookingId) {
        await this.emitToChannel(`booking:${e.bookingId}`, 'TOKEN_ASSIGNED', e.payload);
      }
      if (e.centreId) {
        await this.emitToChannel(`centre:${e.centreId}`, 'TOKEN_ASSIGNED', e.payload);
      }
    });

    // 3. WEIGHMENT_STARTED & WEIGHMENT_COMPLETED -> booking & centre
    this.eventBusService.subscribe(DomainEventType.WEIGHMENT_STARTED, async (e: DomainEvent) => {
      if (e.bookingId) await this.emitToChannel(`booking:${e.bookingId}`, 'WEIGHMENT_STARTED', e.payload);
      if (e.centreId) await this.emitToChannel(`centre:${e.centreId}`, 'WEIGHMENT_STARTED', e.payload);
    });

    this.eventBusService.subscribe(DomainEventType.WEIGHMENT_COMPLETED, async (e: DomainEvent) => {
      if (e.bookingId) await this.emitToChannel(`booking:${e.bookingId}`, 'WEIGHMENT_COMPLETED', e.payload);
      if (e.centreId) await this.emitToChannel(`centre:${e.centreId}`, 'WEIGHMENT_COMPLETED', e.payload);
    });

    // 4. QUALITY_COMPLETED -> booking & centre
    this.eventBusService.subscribe(DomainEventType.QUALITY_COMPLETED, async (e: DomainEvent) => {
      if (e.bookingId) await this.emitToChannel(`booking:${e.bookingId}`, 'QUALITY_COMPLETED', e.payload);
      if (e.centreId) await this.emitToChannel(`centre:${e.centreId}`, 'QUALITY_COMPLETED', e.payload);
    });

    // 5. PROCUREMENT_COMPLETED -> booking & centre
    this.eventBusService.subscribe(DomainEventType.PROCUREMENT_COMPLETED, async (e: DomainEvent) => {
      if (e.bookingId) await this.emitToChannel(`booking:${e.bookingId}`, 'PROCUREMENT_COMPLETED', e.payload);
      if (e.centreId) await this.emitToChannel(`centre:${e.centreId}`, 'PROCUREMENT_COMPLETED', e.payload);
    });

    // 6. SCHEDULING_UPDATED -> Dynamic adaptation forward movement
    this.eventBusService.subscribe(DomainEventType.SCHEDULING_UPDATED, async (e: DomainEvent) => {
      if (e.bookingId) await this.emitToChannel(`booking:${e.bookingId}`, 'SCHEDULING_UPDATED', e.payload);
      if (e.centreId) await this.emitToChannel(`centre:${e.centreId}`, 'SCHEDULING_UPDATED', e.payload);
    });

    // 7. ETA_UPDATED -> booking:{bookingId}
    this.eventBusService.subscribe(DomainEventType.ETA_UPDATED, async (e: DomainEvent) => {
      if (e.bookingId) {
        await this.emitToChannel(`booking:${e.bookingId}`, 'ETA_UPDATED', e.payload);
        // Also cache ETA in Redis per Section 16
        await this.redisService.setLiveEta(e.bookingId, e.payload);
      }
    });

    // 8. COUNTER_AVAILABLE & COUNTER_BUSY -> centre:{centreId}
    this.eventBusService.subscribe(DomainEventType.COUNTER_AVAILABLE, async (e: DomainEvent) => {
      if (e.centreId) await this.emitToChannel(`centre:${e.centreId}`, 'COUNTER_AVAILABLE', e.payload);
    });

    this.eventBusService.subscribe(DomainEventType.COUNTER_BUSY, async (e: DomainEvent) => {
      if (e.centreId) await this.emitToChannel(`centre:${e.centreId}`, 'COUNTER_BUSY', e.payload);
    });

    // 9. CENTRE_CAPACITY_CHANGED -> centre & government
    this.eventBusService.subscribe(DomainEventType.CENTRE_CAPACITY_CHANGED, async (e: DomainEvent) => {
      if (e.centreId) await this.emitToChannel(`centre:${e.centreId}`, 'CENTRE_CAPACITY_CHANGED', e.payload);
      if (e.metadata?.stateId) {
        await this.emitToChannel(`government:state:${e.metadata.stateId}`, 'CENTRE_CAPACITY_CHANGED', e.payload);
      }
    });

    // 10. GOVERNMENT_SYNC_FAILED & GOVERNMENT_SYNC_COMPLETED -> government:national
    this.eventBusService.subscribe(DomainEventType.GOVERNMENT_SYNC_FAILED, async (e: DomainEvent) => {
      await this.emitToChannel('government:national', 'GOVERNMENT_SYNC_FAILED', e.payload);
    });

    this.eventBusService.subscribe(DomainEventType.GOVERNMENT_SYNC_COMPLETED, async (e: DomainEvent) => {
      await this.emitToChannel('government:national', 'GOVERNMENT_SYNC_COMPLETED', e.payload);
    });
  }
}
