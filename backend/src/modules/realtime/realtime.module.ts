import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { RealtimeController } from './realtime.controller';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { EventsModule } from '../../infrastructure/events/events.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    RedisModule,
    EventsModule,
    BookingsModule,
  ],
  controllers: [RealtimeController],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeGateway, RealtimeService],
})
export class RealtimeModule {}
