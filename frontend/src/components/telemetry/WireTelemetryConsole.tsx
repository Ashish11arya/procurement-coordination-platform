import React, { useState, useEffect } from 'react';
import { telemetry } from '../../services/telemetry';
import { TelemetryLog } from '../../types';
import { Radio, Terminal } from 'lucide-react';

export const WireTelemetryConsole: React.FC = () => {
  const [logs, setLogs] = useState<TelemetryLog[]>(() => telemetry.getLogs());

  useEffect(() => {
    const unsub = telemetry.subscribe(() => {
      setLogs(telemetry.getLogs());
    });
    return () => unsub();
  }, []);

  return (
    <aside className="main-container" style={{ paddingTop: 0, paddingBottom: '2rem' }}>
      <div className="telemetry-console">
        <div className="telemetry-console-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} />
            <span>Live REST API & WebSocket Wire Telemetry</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#4ADE80' }}>
            <Radio size={12} className="pulse-dot" />
            <span>Monitoring Port 3000 Events</span>
          </div>
        </div>
        <div className="telemetry-console-body">
          {logs.length === 0 ? (
            <div style={{ color: '#64748B' }}>[System] Awaiting outbound REST requests and WebSocket push frames...</div>
          ) : (
            logs.slice(0, 15).map((log) => (
              <div key={log.id} className="log-entry">
                <span className="log-time">{log.timestamp}</span>
                {log.type === 'HTTP' ? (
                  <>
                    <span className="badge badge-primary">{log.method}</span>
                    <span className="log-url">{log.endpoint}</span>
                    <span className={`log-status ${log.success ? '' : 'error'}`}>
                      {log.status} {log.durationMs ? `(${log.durationMs}ms)` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="badge badge-success">WS: {log.event}</span>
                    <span className="log-url">[{log.channel}]</span>
                    <span className="log-status">
                      {log.payload ? JSON.stringify(log.payload).substring(0, 60) : 'OK'}
                    </span>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};
