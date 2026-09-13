import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueStatus } from './schemas/queue-state.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/types/auth.types';

export class TransitionStateDto {
  toState: QueueStatus;
  notes?: string;
  stage?: string;
  counterId?: string;
}

@Controller('queue')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Patch(':bookingId/transition')
  async transitionState(
    @Param('bookingId') bookingId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: TransitionStateDto,
  ) {
    const result = await this.queueService.transitionState(
      bookingId,
      dto.toState,
      actor,
      dto.notes,
      dto.stage,
      dto.counterId,
    );
    return {
      success: true,
      message: `Queue state updated to '${dto.toState}'`,
      ...result,
    };
  }

  @Get('centre/:centreId')
  async getCentreLiveQueue(
    @Param('centreId') centreId: string,
    @Query('date') date?: string,
  ) {
    const liveQueue = await this.queueService.getCentreLiveQueue(centreId, date);
    return {
      success: true,
      ...liveQueue,
    };
  }

  @Get('farmer/status')
  async getFarmerStatus(@CurrentUser() user: AuthenticatedUser) {
    const status = await this.queueService.getFarmerQueueStatus(user.userId);
    return {
      success: true,
      status,
    };
  }
}
