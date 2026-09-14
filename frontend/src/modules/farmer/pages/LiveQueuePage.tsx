import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/api.service';
import { realtime } from '../../../realtime/socket';
import { Booking, BookingStatus } from '../../../types';
import { Clock, Truck, ShieldAlert, CheckCircle2, CalendarPlus } from 'lucide-react';

export const LiveQueuePage: React.FC = () => {
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [liveEta, setLiveEta] = useState<string | null>(null);
  const [queueLength, setQueueLength] = useState<number>(0);
  const [isDelayed, setIsDelayed] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchQueueData = async () => {
    try {
      setLoading(true);
      const res = await api.getFarmerBookings();
      if (res && res.bookings && res.bookings.length > 0) {
        const active = res.bookings.find(
          (b) => b.status !== BookingStatus.CANCELLED && b.status !== BookingStatus.COMPLETED
        ) || res.bookings[0];
        setActiveBooking(active);
        if (active) {
          setLiveEta(active.arrivalWindow?.endTime || '11:00 AM');
        }
      } else {
        setActiveBooking(null);
        setLiveEta(null);
      }

      const dash = await api.getCentreDashboard('CENTRE-MP-IND-01').catch(() => null);
      if (dash) {
        setQueueLength(dash.queueSummary?.waiting || 0);
        setIsDelayed(dash.bottlenecks?.hasBottleneck || false);
      }
    } catch (err) {
      console.warn('Queue data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
    const unsubEta = realtime.on('ETA_UPDATED', (data) => {
      if (data?.newEta) setLiveEta(data.newEta);
    });
    const unsubCap = realtime.on('CENTRE_CAPACITY_CHANGED', () => fetchQueueData());
    return () => {
      unsubEta();
      unsubCap();
    };
  }, []);

  if (loading) {
    return <div className="main-container" style={{ padding: '3rem', textAlign: 'center' }}>Loading yard queue...</div>;
  }

  if (!activeBooking) {
    return (
      <div className="main-container" style={{ maxWidth: '800px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <Truck size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <h3 style={{ color: 'var(--gov-navy)', marginBottom: '8px' }}>No Active Booking in Yard Queue</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Live weighbridge and gate queue monitoring is activated once you schedule an arrival token.
          </p>
          <Link to="/book" className="btn btn-primary">
            <CalendarPlus size={16} /> Schedule Grain Arrival
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="main-container" style={{ maxWidth: '800px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Real-Time Mandi Yard Queue Position</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Live physical queue monitor for Token #{activeBooking.tokenNumber}
            </p>
          </div>
          <span className="badge badge-primary">Token {activeBooking.tokenNumber}</span>
        </div>

        {isDelayed && (
          <div style={{ background: 'var(--gov-amber-light)', border: '1px solid var(--gov-amber)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ShieldAlert size={20} color="var(--gov-amber)" />
            <span style={{ fontSize: '0.85rem', color: '#92400E' }}>
              <strong>Mandi Advisory:</strong> Counter capacity adjustments active. Arrival windows buffered by +10m.
            </span>
          </div>
        )}

        <div className="telemetry-grid">
          <div className="telemetry-card">
            <div className="telemetry-icon">⏱️</div>
            <div className="telemetry-content">
              <span className="telemetry-label">Designated Arrival Window</span>
              <span className="telemetry-value">
                {activeBooking.arrivalWindow?.startTime} - {activeBooking.arrivalWindow?.endTime}
              </span>
              <span className="telemetry-sub">Slot Index: {activeBooking.arrivalWindow?.slotIndex}</span>
            </div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-icon">🚛</div>
            <div className="telemetry-content">
              <span className="telemetry-label">Yard Waiting Queue</span>
              <span className="telemetry-value">{queueLength} Vehicles</span>
              <span className="telemetry-sub">Status: {activeBooking.status}</span>
            </div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-icon">🎯</div>
            <div className="telemetry-content">
              <span className="telemetry-label">Estimated Completion ETA</span>
              <span className="telemetry-value">{liveEta || activeBooking.arrivalWindow?.endTime}</span>
              <span className="telemetry-sub">Dynamic weighment buffer</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
