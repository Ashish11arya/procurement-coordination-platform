import React, { useState, useEffect } from 'react';
import { socketService } from '../../../realtime/socket';
import { Activity, Play, Pause, Trash2, Radio, CheckCircle, Clock, Truck, Scale, FlaskConical, CreditCard } from 'lucide-react';

interface LiveEvent {
  id: string;
  timestamp: string;
  centreId: string;
  eventType: string;
  tokenNumber?: string;
  summary: string;
  rawPayload: any;
}

export const LiveMonitoringPage: React.FC = () => {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    // Initial seed events
    const initial: LiveEvent[] = [
      {
        id: 'INIT-1',
        timestamp: new Date().toLocaleTimeString(),
        centreId: 'c-karnal-01',
        eventType: 'SOCKET_CONNECTED',
        tokenNumber: 'SYSTEM',
        summary: 'WebSocket real-time telemetry stream established to gateway /realtime',
        rawPayload: { transport: 'websocket', status: 'connected' },
      },
    ];
    setEvents(initial);

    // Listen to queue updates from socket
    const unsubQueue = socketService.onQueueUpdated((data: any) => {
      if (isPaused) return;
      const newEvt: LiveEvent = {
        id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString(),
        centreId: data?.centreId || 'c-karnal-01',
        eventType: data?.eventType || 'QUEUE_UPDATED',
        tokenNumber: data?.tokenNumber || data?.bookingId || 'ROSTER',
        summary: `Yard queue transition broadcasted: ${data?.status || 'Active stage movement'}`,
        rawPayload: data,
      };
      setEvents(prev => [newEvt, ...prev.slice(0, 99)]);
    });

    return () => {
      unsubQueue();
    };
  }, [isPaused]);

  const filteredEvents = events.filter(e => {
    if (filterType === 'ALL') return true;
    return e.eventType.includes(filterType);
  });

  const getEventIcon = (type: string) => {
    if (type.includes('WEIGH')) return <Scale size={16} color="var(--gov-amber)" />;
    if (type.includes('QUALITY')) return <FlaskConical size={16} color="var(--gov-purple, #7C3AED)" />;
    if (type.includes('PROCUREMENT') || type.includes('PAYMENT')) return <CreditCard size={16} color="var(--gov-green)" />;
    if (type.includes('CHECKIN') || type.includes('QUEUE')) return <Truck size={16} color="var(--gov-blue)" />;
    return <Radio size={16} color="var(--gov-navy)" />;
  };

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">GOVERNMENT COMMAND CENTRE</span>
            <span className="gov-badge gov-badge-active">REAL-TIME TELEMETRY</span>
          </div>
          <h1 className="portal-title">Statewide Real-Time Operational Event Feed</h1>
          <p className="portal-subtitle">Live Ingest of Physical Lane Transitions, Scale Commits & Gate Movements</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="gov-btn gov-btn-secondary"
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
            {isPaused ? 'Resume Stream' : 'Pause Stream'}
          </button>
          <button
            className="gov-btn gov-btn-secondary"
            onClick={() => setEvents([])}
          >
            <Trash2 size={16} /> Clear Feed
          </button>
        </div>
      </div>

      {/* Live Stream Status Bar */}
      <div className="gov-card" style={{ marginBottom: '1.5rem', background: '#0F172A', color: 'white' }}>
        <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="gov-pulse" style={{ background: isPaused ? 'var(--gov-amber)' : 'var(--gov-green)' }} />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                {isPaused ? 'STREAM BUFFERED (PAUSED)' : 'LIVE WEBSOCKET STREAM ACTIVE'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                Channel: /realtime • Protocol: Engine.IO v4 • Subscribed: Statewide
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="gov-input"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ background: '#1E293B', color: 'white', borderColor: '#334155', width: '180px' }}
            >
              <option value="ALL">All Event Types</option>
              <option value="QUEUE">Queue & Gate Events</option>
              <option value="WEIGH">Weighbridge Events</option>
              <option value="QUALITY">Quality Lab Events</option>
              <option value="PROCUREMENT">Procurement & DBT</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="gov-card">
        <div className="gov-card-header">
          <h2 className="gov-card-title">Live Events Log ({filteredEvents.length})</h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--gov-text-muted)' }}>Auto-scrolling real-time stream</span>
        </div>

        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {filteredEvents.length === 0 ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--gov-text-muted)' }}>
              <Radio size={40} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p>Waiting for real-time gateway broadcasts...</p>
            </div>
          ) : (
            filteredEvents.map(evt => (
              <div
                key={evt.id}
                style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid var(--gov-border)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <div style={{ marginTop: '2px' }}>{getEventIcon(evt.eventType)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--gov-navy)' }}>{evt.eventType}</span>
                      <span className="gov-badge gov-badge-gov">{evt.centreId}</span>
                      {evt.tokenNumber && <span className="gov-badge gov-badge-active">#{evt.tokenNumber}</span>}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)', fontFamily: 'monospace' }}>
                      {evt.timestamp}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--gov-text-secondary)', margin: '0 0 6px 0' }}>
                    {evt.summary}
                  </p>
                  <pre
                    style={{
                      margin: 0,
                      padding: '6px 10px',
                      background: '#F8FAFC',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      color: '#475569',
                      overflowX: 'auto',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    {JSON.stringify(evt.rawPayload, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
