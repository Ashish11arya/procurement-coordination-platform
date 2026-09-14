import { TelemetryLog } from '../types';

type TelemetryListener = (log: TelemetryLog) => void;

class TelemetryService {
  private listeners: TelemetryListener[] = [];
  private logs: TelemetryLog[] = [];

  subscribe(listener: TelemetryListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getLogs(): TelemetryLog[] {
    return [...this.logs];
  }

  logHttp(method: string, endpoint: string, status: number | string, durationMs: string, success: boolean) {
    const entry: TelemetryLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type: 'HTTP',
      method,
      endpoint,
      status,
      durationMs,
      success,
    };
    this.addEntry(entry);
  }

  logWs(event: string, channel: string, payload: any) {
    const entry: TelemetryLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type: 'WS',
      event,
      channel,
      payload,
      success: true,
    };
    this.addEntry(entry);
  }

  private addEntry(entry: TelemetryLog) {
    this.logs.unshift(entry);
    if (this.logs.length > 50) {
      this.logs.pop();
    }
    this.listeners.forEach((l) => l(entry));
  }
}

export const telemetry = new TelemetryService();
