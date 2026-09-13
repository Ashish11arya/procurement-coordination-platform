import { Global, Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventsModule {}
