import { DomainEvent, DomainEventType } from './domain-events';

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(
    eventType: DomainEventType | string,
    handler: (event: DomainEvent) => Promise<void> | void,
  ): void;
  unsubscribe(
    eventType: DomainEventType | string,
    handler: (event: DomainEvent) => Promise<void> | void,
  ): void;
}
