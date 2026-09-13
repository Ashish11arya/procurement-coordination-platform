import { Controller, Get, Query, Sse, MessageEvent, UseGuards, Request, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RealtimeService } from './realtime.service';
import { RealtimeGateway } from './realtime.gateway';

@Controller('realtime')
export class RealtimeController {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  @Get('sse')
  @UseGuards(JwtAuthGuard)
  @Sse()
  async streamChannelUpdates(
    @Request() req: any,
    @Query('channel') channel: string,
  ): Promise<Observable<MessageEvent>> {
    if (!channel) {
      throw new BadRequestException('Query parameter "channel" is required for SSE subscription');
    }

    const user = req.user;
    const isAuthorized = await this.realtimeGateway.validateChannelAccess(user, channel);
    if (!isAuthorized) {
      throw new ForbiddenException(`Unauthorized to subscribe to channel: ${channel}`);
    }

    return this.realtimeService.getChannelStream(channel).pipe(
      map((msg) => ({
        type: msg.event,
        data: {
          channel: msg.channel,
          event: msg.event,
          data: msg.data,
          timestamp: msg.timestamp,
        },
      })),
    );
  }
}
