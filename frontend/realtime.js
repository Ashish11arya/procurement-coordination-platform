/**
 * National Procurement Coordination Platform - Realtime WebSocket Manager
 * Connects to NestJS Socket.IO gateway at /realtime with JWT authentication
 */

class RealtimeClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.handlers = new Map();
  }

  connect(token) {
    if (this.socket) {
      this.socket.disconnect();
    }

    if (typeof io === 'undefined') {
      console.warn('[Realtime] Socket.io client library not loaded yet.');
      return;
    }

    console.log('[Realtime] Connecting to WebSocket gateway at /realtime...');
    this.socket = io('/realtime', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log(`[Realtime] WebSocket connected! Socket ID: ${this.socket.id}`);
      this.updateConnectionBadge(true);

      // Join default channels for demo
      this.joinChannel('centre:CENTRE-MP-IND-01');
      this.joinChannel('booking:BK-DEMO-001');

      if (window.onWebSocketEventLogged) {
        window.onWebSocketEventLogged({
          type: 'SOCKET_CONNECTED',
          channel: 'system',
          data: { socketId: this.socket.id },
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log(`[Realtime] WebSocket disconnected: ${reason}`);
      this.updateConnectionBadge(false);
    });

    this.socket.on('connect_error', (err) => {
      console.warn(`[Realtime] Connection error: ${err.message}`);
      this.updateConnectionBadge(false);
    });

    // Register listeners for all Section 14 domain events
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
      this.socket.on(eventName, (data) => {
        console.log(`[Realtime EVENT: ${eventName}]`, data);

        // Notify telemetry console
        if (window.onWebSocketEventLogged) {
          window.onWebSocketEventLogged({
            type: eventName,
            channel: data?.centreId ? `centre:${data.centreId}` : 'centre:CENTRE-MP-IND-01',
            data,
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        // Trigger registered application handlers
        const callbacks = this.handlers.get(eventName) || [];
        callbacks.forEach((cb) => {
          try {
            cb(data);
          } catch (e) {
            console.error(`Error in event handler for ${eventName}:`, e);
          }
        });
      });
    });
  }

  joinChannel(channel) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_channel', { channel }, (ack) => {
        console.log(`[Realtime] Channel join acknowledged: ${channel}`, ack);
      });
    }
  }

  on(eventName, callback) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName).push(callback);
  }

  updateConnectionBadge(isLive) {
    const indicator = document.getElementById('live-indicator');
    const statusText = document.getElementById('txt-conn-status');
    if (indicator && statusText) {
      if (isLive) {
        indicator.classList.add('live-active');
        statusText.textContent = 'Live Connected (WS Active)';
      } else {
        indicator.classList.remove('live-active');
        statusText.textContent = 'Disconnected (Reconnecting...)';
      }
    }
  }
}

// Global Realtime client instance
window.realtime = new RealtimeClient();
