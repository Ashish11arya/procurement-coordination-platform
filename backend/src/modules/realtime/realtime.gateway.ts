import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RealtimeService } from './realtime.service';
import { Booking, BookingDocument } from '../bookings/schemas/booking.schema';
import { Role } from '../../shared/enums/roles.enum';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
  ) {}

  afterInit(server: Server) {
    this.logger.log('RealtimeGateway initialized on namespace /realtime');
    this.realtimeService.setLocalSocketEmitter((channel, event, data) => {
      if (this.server) {
        this.server.to(channel).emit(event, data);
      }
    });
  }

  async handleConnection(client: Socket) {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!rawToken) {
        this.logger.warn(`Connection rejected: No token provided (Client: ${client.id})`);
        client.disconnect();
        return;
      }

      const secret =
        this.configService.get<string>('JWT_ACCESS_SECRET') ||
        this.configService.get<string>('JWT_SECRET') ||
        'dev_jwt_access_secret_change_in_production_min32chars';
      const payload: any = this.jwtService.verify(rawToken, { secret });
      payload.userId = payload.sub || payload.id;
      payload.id = payload.userId;
      client.data.user = payload;
      this.logger.log(`Client connected: ${client.id} (User: ${payload.userId}, Role: ${payload.role})`);
    } catch (err: any) {
      this.logger.warn(`Connection rejected: Invalid token - ${err.message} (Client: ${client.id})`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_channel')
  async handleJoinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channel: string },
  ) {
    const user = client.data?.user;
    if (!user) {
      return { status: 'ERROR', message: 'Unauthenticated socket session' };
    }

    const channel = data?.channel;
    if (!channel) {
      return { status: 'ERROR', message: 'Channel name required' };
    }

    const isAuthorized = await this.validateChannelAccess(user, channel);
    if (!isAuthorized) {
      this.logger.warn(`Join channel rejected: User ${user.id || user.sub} (${user.role}) denied for ${channel}`);
      return { status: 'FORBIDDEN', message: `Unauthorized to join channel: ${channel}` };
    }

    client.join(channel);
    this.logger.log(`Client ${client.id} joined channel: ${channel}`);
    return { status: 'JOINED', channel };
  }

  @SubscribeMessage('leave_channel')
  handleLeaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channel: string },
  ) {
    const channel = data?.channel;
    if (channel) {
      client.leave(channel);
      this.logger.log(`Client ${client.id} left channel: ${channel}`);
      return { status: 'LEFT', channel };
    }
    return { status: 'ERROR', message: 'Channel name required' };
  }

  /**
   * Scoped Authorization Enforcer (Section 23 of PROJECT_SPEC.md)
   * Strictly verifies channel membership according to user role and ownership.
   */
  async validateChannelAccess(user: any, channel: string): Promise<boolean> {
    const role: Role = user.role;
    const userId = user.id || user.sub;

    // Super-admins and auditors have cross-cutting read access
    if (role === Role.SYSTEM_ADMIN || role === Role.AUDITOR) {
      return true;
    }

    // 1. Farmer booking-specific channel: booking:{bookingId}
    if (channel.startsWith('booking:')) {
      const bookingId = channel.split(':')[1];
      if (!bookingId) return false;

      // Farmers can ONLY join their own booking channel
      if (role === Role.FARMER) {
        const booking = await this.bookingModel.findOne({ bookingId }).select('farmerId').exec();
        if (!booking) return false;
        return booking.farmerId === userId;
      }

      // Operators and Admins can monitor bookings
      return true;
    }

    // 2. Centre-specific channel: centre:{centreId}
    if (channel.startsWith('centre:')) {
      const centreId = channel.split(':')[1];
      if (!centreId) return false;

      // Farmers are strictly forbidden from centre operational channels
      if (role === Role.FARMER) {
        return false;
      }

      // High-level government admins can inspect any centre
      if (role === Role.GOVERNMENT_ADMIN || role === Role.STATE_ADMIN) {
        return true;
      }

      // Centre operators and centre admins can only join their assigned centre
      return user.centreId === centreId;
    }

    // 3. District-specific channel: government:district:{districtId}
    if (channel.startsWith('government:district:')) {
      const districtId = channel.split(':')[2];
      if (!districtId) return false;

      if (role === Role.GOVERNMENT_ADMIN) return true;
      if (role === Role.STATE_ADMIN) return true; // State admin can inspect districts in state
      if (role === Role.DISTRICT_ADMIN) {
        return user.districtId === districtId;
      }
      return false;
    }

    // 4. State-specific channel: government:state:{stateId}
    if (channel.startsWith('government:state:')) {
      const stateId = channel.split(':')[2];
      if (!stateId) return false;

      if (role === Role.GOVERNMENT_ADMIN) return true;
      if (role === Role.STATE_ADMIN) {
        return user.stateId === stateId;
      }
      return false;
    }

    // 5. National government channel: government:national
    if (channel === 'government:national') {
      return role === Role.GOVERNMENT_ADMIN;
    }

    return false;
  }
}
