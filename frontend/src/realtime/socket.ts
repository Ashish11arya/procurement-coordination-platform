import { io, Socket } from 'socket.io-client';
import { telemetry } from '../services/telemetry';

type EventHandler = (data: any) => void;

class RealtimeManager {
  private socket: Socket | null = null;
  private handlers = new Map<string, EventHandler[]>();
  private isConnected = false;
  private currentToken: string | null = null;

  connect(token?: string) {
    const activeToken = token || localStorage.getItem('procurement_auth_token');
    if (!activeToken) {
      console.log('[Realtime] No auth token available; skipping WebSocket connection until authenticated.');
      this.isConnected = false;
      this.triggerHandlers('CONNECT_STATE', { isConnected: false });
      return;
    }

    if (this.socket && this.currentToken === activeToken && this.isConnected) {
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.currentToken = activeToken;
    const baseUrl = (import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const wsTarget = baseUrl ? `${baseUrl}/realtime` : '/realtime';
    console.log(`[Realtime] Connecting to WebSocket gateway at ${wsTarget} with JWT...`);

    this.socket = io(wsTarget, {
      auth: { token: activeToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log(`[Realtime] WebSocket connected! Socket ID: ${this.socket?.id}`);
      telemetry.logWs('CONNECT', 'system', { socketId: this.socket?.id });

      // Join authorized channels based on stored role
      const userStr = localStorage.getItem('procurement_auth_user');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.role === 'GOVERNMENT_ADMIN' || u.role === 'STATE_ADMIN') {
            this.joinChannel('government:national');
          } else if (u.centreId && u.role !== 'FARMER') {
            this.joinChannel(`centre:${u.centreId}`);
          }
        } catch {
          // ignore parsing error
        }
      }

      this.triggerHandlers('CONNECT_STATE', { isConnected: true });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.warn(`[Realtime] WebSocket disconnected: ${reason}`);
      telemetry.logWs('DISCONNECT', 'system', { reason });
      this.triggerHandlers('CONNECT_STATE', { isConnected: false });
    });

    this.socket.on('connect_error', (err) => {
      this.isConnected = false;
      console.warn(`[Realtime] Connection error: ${err.message}`);
      telemetry.logWs('ERROR', 'system', { error: err.message });
      this.triggerHandlers('CONNECT_STATE', { isConnected: false, error: err.message });
    });

    // Domain events per Section 14
    const domainEvents = [
      'TOKEN_ASSIGNED',
      'FARMER_ARRIVED',
      'WEIGHMENT_STARTED',
      'WEIGHMENT_COMPLETED',
      'QUALITY_COMPLETED',
      'PROCUREMENT_COMPLETED',
      'SCHEDULING_UPDATED',
      'ETA_UPDATED',
      'CENTRE_CAPACITY_CHANGED',
      'BOOKING_CANCELLED',
      'FARMER_NO_SHOW',
    ];

    domainEvents.forEach((eventName) => {
      this.socket?.on(eventName, (data) => {
        console.log(`[Realtime EVENT: ${eventName}]`, data);
        telemetry.logWs(eventName, data?.centreId ? `centre:${data.centreId}` : 'centre:CENTRE-MP-IND-01', data);
        this.triggerHandlers(eventName, data);
      });
    });
  }

  joinChannel(channel: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_channel', { channel });
      console.log(`[Realtime] Subscribed to channel: ${channel}`);
    }
  }

  on(eventName: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);

    return () => {
      const list = this.handlers.get(eventName) || [];
      this.handlers.set(
        eventName,
        list.filter((h) => h !== handler)
      );
    };
  }

  private triggerHandlers(eventName: string, data: any) {
    const list = this.handlers.get(eventName) || [];
    list.forEach((h) => {
      try {
        h(data);
      } catch (err) {
        console.error(`Error in event handler for ${eventName}:`, err);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getConnectionState() {
    return this.isConnected;
  }
}

export const realtime = new RealtimeManager();

export const socketService = {
  connect: (token?: string) => realtime.connect(token),
  disconnect: () => realtime.disconnect(),
  joinChannel: (channel: string) => realtime.joinChannel(channel),
  on: (eventName: string, handler: EventHandler) => realtime.on(eventName, handler),
  getConnectionState: () => realtime.getConnectionState(),
  onQueueUpdated: (handler: EventHandler) => {
    const unsub1 = realtime.on('TOKEN_ASSIGNED', handler);
    const unsub2 = realtime.on('FARMER_ARRIVED', handler);
    const unsub3 = realtime.on('WEIGHMENT_STARTED', handler);
    const unsub4 = realtime.on('WEIGHMENT_COMPLETED', handler);
    const unsub5 = realtime.on('QUALITY_COMPLETED', handler);
    const unsub6 = realtime.on('PROCUREMENT_COMPLETED', handler);
    const unsub7 = realtime.on('SCHEDULING_UPDATED', handler);
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
      unsub6();
      unsub7();
    };
  },
};
