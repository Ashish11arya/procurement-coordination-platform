import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { IEventBus } from './event-bus.interface';
import { DomainEvent, DomainEventType } from './domain-events';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class EventBusService implements IEventBus, OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlers: Map<string, Set<(event: DomainEvent) => Promise<void> | void>> = new Map();
  private readonly instanceId = 'node-' + Math.random().toString(36).substring(2, 9);
  private readonly redisChannel = 'eventbus:domain_events';

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit() {
    // Subscribe to cross-instance Redis event stream
    await this.redisService.subscribe(this.redisChannel, (channel, message) => {
      try {
        const payload = JSON.parse(message);
        // Ignore events originally published by this instance to avoid double-handling
        if (payload._sourceInstanceId === this.instanceId) {
          return;
        }
        this.dispatchLocal(payload.event, false);
      } catch (err: any) {
        this.logger.error(`Failed to parse cross-instance event message: ${err.message}`);
      }
    });
  }

  async publish(event: DomainEvent): Promise<void> {
    this.logger.debug(`[EventBus] Publishing ${event.eventType} (ID: ${event.eventId})`);

    // 1. Dispatch locally to all registered in-process handlers
    await this.dispatchLocal(event, true);

    // 2. Broadcast across pods via Redis Pub/Sub
    try {
      const message = JSON.stringify({
        _sourceInstanceId: this.instanceId,
        event,
      });
      await this.redisService.publish(this.redisChannel, message);
    } catch (err: any) {
      this.logger.warn(`Failed to broadcast event to Redis Pub/Sub: ${err.message}`);
    }
  }

  subscribe(
    eventType: DomainEventType | string,
    handler: (event: DomainEvent) => Promise<void> | void,
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    this.logger.debug(`[EventBus] Subscribed handler to ${eventType}`);
  }

  unsubscribe(
    eventType: DomainEventType | string,
    handler: (event: DomainEvent) => Promise<void> | void,
  ): void {
    if (this.handlers.has(eventType)) {
      this.handlers.get(eventType)!.delete(handler);
    }
  }

  private async dispatchLocal(event: DomainEvent, isLocalPublish: boolean): Promise<void> {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const promises: Promise<any>[] = [];
    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          promises.push(
            result.catch((err) => {
              this.logger.error(
                `[EventBus] Error in subscriber for ${event.eventType} (Event: ${event.eventId}): ${err.message}`,
                err.stack,
              );
            }),
          );
        }
      } catch (err: any) {
        this.logger.error(
          `[EventBus] Synchronous error in subscriber for ${event.eventType}: ${err.message}`,
          err.stack,
        );
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }
}
