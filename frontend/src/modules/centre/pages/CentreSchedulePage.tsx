import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { socketService } from '../../../realtime/socket';
import { CentreDashboardData } from '../../../types';
import { Calendar, Clock, RefreshCw, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

export const CentreSchedulePage: React.FC = () => {
  const [centreId, setCentreId] = useState<string>('c-karnal-01');
  const [dashboard, setDashboard] = useState<CentreDashboardData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('2026-04-15');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = async () => {
    try {
      setError(null);
      const data = await api.getCentreDashboard(centreId);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch centre scheduling data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
    const unsubscribe = socketService.onQueueUpdated(() => {
      fetchSchedule();
    });
    return () => unsubscribe();
  }, [centreId]);

  const slots = [
    { id: 'SLOT-1', time: '08:00 - 10:00', label: 'Morning Early Wave', maxQ: 100, maxVehicles: 15 },
    { id: 'SLOT-2', time: '10:00 - 12:00', label: 'Peak Midday Influx', maxQ: 120, maxVehicles: 18 },
    { id: 'SLOT-3', time: '12:00 - 14:00', label: 'Afternoon Wave 1', maxQ: 100, maxVehicles: 15 },
    { id: 'SLOT-4', time: '14:00 - 16:00', label: 'Afternoon Wave 2', maxQ: 100, maxVehicles: 15 },
    { id: 'SLOT-5', time: '16:00 - 18:00', label: 'Evening Closing Wave', maxQ: 80, maxVehicles: 12 },
  ];

  const roster = dashboard?.roster || [];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">CENTRE OPERATIONS</span>
            <span className="gov-badge gov-badge-active">CAPACITY ALLOTMENT</span>
          </div>
          <h1 className="portal-title">Procurement Scheduling & Slot Allocation</h1>
          <p className="portal-subtitle">Capacity-Aware Slot Quotas, Arrival Windows & Dynamic Intake Balancing</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="date"
            className="gov-input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ width: '160px' }}
          />
          <select 
            className="gov-input"
            value={centreId} 
            onChange={e => setCentreId(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="c-karnal-01">Karnal Central Mandi (c-karnal-01)</option>
            <option value="c-rohtak-01">Rohtak Grain Yard (c-rohtak-01)</option>
          </select>
          <button className="gov-btn gov-btn-secondary" onClick={fetchSchedule}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="gov-alert gov-alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Daily Target & Capacity Summary Banner */}
      <div className="gov-card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #0A2540 0%, #1E3A8A 100%)', color: 'white' }}>
        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.8125rem', textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.05em' }}>
              SANCTIONED DAILY GRAIN INTAKE LIMIT
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px' }}>
              {dashboard?.metrics.bookedQuantityQuintals || 0} / {dashboard?.metrics.dailyCapacityQuintals || 500} Quintals
            </div>
          </div>
          <div style={{ display: 'flex', gap: '2rem', textAlign: 'right' }}>
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>TOTAL REGISTERED ARRIVALS</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{roster.length} Trucks</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>YARD DERATING FACTOR</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#86EFAC' }}>100% (Normal)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Slot Allocation Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {slots.map(slot => {
          // Find bookings assigned to this time slot
          const slotBookings = roster.filter(b => b.timeSlot === slot.time || b.timeSlot?.includes(slot.time.split(' - ')[0]));
          const bookedQ = slotBookings.reduce((sum, b) => sum + (b.allocatedQuantityQuintals || 0), 0);
          const percentBooked = Math.min(100, Math.round((bookedQ / slot.maxQ) * 100));

          return (
            <div key={slot.id} className="gov-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    padding: '8px 12px',
                    background: '#F1F5F9',
                    borderRadius: '6px',
                    fontWeight: 700,
                    color: 'var(--gov-navy)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <Clock size={16} />
                    {slot.time}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-navy)', margin: 0 }}>{slot.label}</h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>
                      Max Quota: {slot.maxQ} Quintals • Max Inflow: {slot.maxVehicles} Vehicles
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: percentBooked > 90 ? 'var(--gov-red)' : percentBooked > 75 ? 'var(--gov-amber)' : 'var(--gov-navy)' }}>
                    {bookedQ} / {slot.maxQ} Q ({percentBooked}%)
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>
                    {slotBookings.length} Vehicles Allotted
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${percentBooked}%`,
                    background: percentBooked > 90 ? 'var(--gov-red)' : percentBooked > 75 ? 'var(--gov-amber)' : 'var(--gov-green)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {/* Vehicle Pill Badges in this slot */}
              {slotBookings.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '0.5rem' }}>
                  {slotBookings.map(b => (
                    <span
                      key={b.bookingId}
                      style={{
                        fontSize: '0.75rem',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: '#F8FAFC',
                        border: '1px solid var(--gov-border)',
                        color: 'var(--gov-text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <strong>{b.tokenNumber}</strong>: {b.vehicleNumber} ({b.allocatedQuantityQuintals}Q)
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
