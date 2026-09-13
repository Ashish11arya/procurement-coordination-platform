import { Controller, Get, Patch, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(@Request() req: any, @Query('limit') limit?: string) {
    const userId = req.user?.id || req.user?.sub;
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.notificationsService.getNotificationsForUser(userId, parsedLimit);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { unreadCount: count };
  }

  @Patch(':id/read')
  async markAsRead(@Request() req: any, @Param('id') notificationId: string) {
    const userId = req.user?.id || req.user?.sub;
    return this.notificationsService.markAsRead(notificationId, userId);
  }

  @Post('mark-all-read')
  async markAllAsRead(@Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }
}
