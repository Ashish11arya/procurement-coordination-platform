import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { socketService } from '../../../realtime/socket';
import { Booking, Counter } from '../../../types';
import { Scale, CheckCircle, AlertTriangle, Printer, Search, RefreshCw, Clock } from 'lucide-react';

export const WeighingOperatorPage: React.FC = () => {
  const [centreId, setCentreId] = useState<string>('c-karnal-01');
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounterId, setSelectedCounterId] = useState<string>('');
  const [activeQueue, setActiveQueue] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  
  // Weighment form state
  const [grossWeight, setGrossWeight] = useState<string>('');
  const [tareWeight, setTareWeight] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSlip, setLastSlip] = useState<any | null>(null);

  const netWeight = (Number(grossWeight) || 0) - (Number(tareWeight) || 0);

  const fetchCentreData = async () => {
    try {
      setError(null);
      const data = await api.getCentreDashboard(centreId);
      const weighbridges = (data.counters || []).filter(c => c.type === 'WEIGHBRIDGE');
      setCounters(weighbridges);
      if (weighbridges.length > 0 && !selectedCounterId) {
        setSelectedCounterId(weighbridges[0].counterId);
      }

      // Filter bookings ready for weighing or currently in weighing
      const pendingWeighing = (data.roster || []).filter(
        b => b.queueStatus === 'CHECKED_IN' || b.queueStatus === 'WEIGHING_IN_PROGRESS'
      );
      setActiveQueue(pendingWeighing);

      if (selectedBooking) {
        const updated = pendingWeighing.find(b => b.bookingId === selectedBooking.bookingId);
        if (updated) setSelectedBooking(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch weighbridge operations data');
    }
  };

  useEffect(() => {
    fetchCentreData();
    const unsubscribe = socketService.onQueueUpdated(() => {
      fetchCentreData();
    });
    return () => unsubscribe();
  }, [centreId]);

  const handleStartWeighing = async () => {
    if (!selectedBooking || !selectedCounterId) return;
    setIsStarting(true);
    setError(null);
    try {
      await api.startWeighing({
        bookingId: selectedBooking.bookingId,
        counterId: selectedCounterId,
        vehicleNumber: selectedBooking.vehicleNumber || 'HR-05-AB-1234',
      });
      await fetchCentreData();
    } catch (err: any) {
      setError(err.message || 'Failed to start weighing');
    } finally {
      setIsStarting(false);
    }
  };

  const handleCompleteWeighing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !selectedCounterId) return;
    if (netWeight <= 0) {
      setError('Tare weight cannot exceed or equal gross weight.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.completeWeighing({
        bookingId: selectedBooking.bookingId,
        counterId: selectedCounterId,
        vehicleNumber: selectedBooking.vehicleNumber || 'HR-05-AB-1234',
        grossWeightQuintals: Number(grossWeight),
        tareWeightQuintals: Number(tareWeight),
        notes,
      });
      setLastSlip({
        token: selectedBooking.tokenNumber,
        bookingId: selectedBooking.bookingId,
        gross: Number(grossWeight),
        tare: Number(tareWeight),
        net: netWeight,
        timestamp: new Date().toLocaleTimeString(),
        slipNo: `EWS-${Date.now().toString().slice(-6)}`,
      });
      setGrossWeight('');
      setTareWeight('');
      setNotes('');
      setSelectedBooking(null);
      await fetchCentreData();
    } catch (err: any) {
      setError(err.message || 'Weighment completion failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">OPERATIONAL TERMINAL</span>
            <span className="gov-badge gov-badge-active">STATION: WEIGHBRIDGE</span>
          </div>
          <h1 className="portal-title">Electronic Weighbridge Operations</h1>
          <p className="portal-subtitle">Gross, Tare & Net Weight Capture with Calibration Audit Trail</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select 
            className="gov-input"
            value={centreId} 
            onChange={e => setCentreId(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="c-karnal-01">Karnal Central Mandi (c-karnal-01)</option>
            <option value="c-rohtak-01">Rohtak Grain Yard (c-rohtak-01)</option>
          </select>
          <button className="gov-btn gov-btn-secondary" onClick={fetchCentreData}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Active Queue for Weighbridge */}
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <h2 className="gov-card-title">Checked-In Vehicles ({activeQueue.length})</h2>
              <p className="gov-card-subtitle">Select vehicle queued for weighment</p>
            </div>
          </div>

          <div style={{ padding: '1rem', borderBottom: '1px solid var(--gov-border)' }}>
            <label className="gov-label" style={{ fontSize: '0.75rem' }}>ACTIVE SCALE</label>
            <select
              className="gov-input"
              value={selectedCounterId}
              onChange={e => setSelectedCounterId(e.target.value)}
            >
              {counters.map(c => (
                <option key={c.counterId} value={c.counterId}>
                  {c.name} - ({c.status})
                </option>
              ))}
            </select>
          </div>

          <div style={{ maxHeight: '550px', overflowY: 'auto' }}>
            {activeQueue.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--gov-text-muted)' }}>
                <Clock size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p>No vehicles waiting for weighbridge.</p>
              </div>
            ) : (
              activeQueue.map(b => (
                <div
                  key={b.bookingId}
                  onClick={() => setSelectedBooking(b)}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--gov-border)',
                    cursor: 'pointer',
                    background: selectedBooking?.bookingId === b.bookingId ? '#F0FDF4' : 'transparent',
                    borderLeft: selectedBooking?.bookingId === b.bookingId ? '4px solid var(--gov-green)' : '4px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--gov-navy)' }}>{b.tokenNumber}</span>
                    <span className={`gov-badge ${b.queueStatus === 'WEIGHING_IN_PROGRESS' ? 'gov-badge-warning' : 'gov-badge-active'}`}>
                      {b.queueStatus}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--gov-text-secondary)' }}>
                    <div>Vehicle: <strong>{b.vehicleNumber}</strong> ({b.vehicleType})</div>
                    <div>Commodity: <strong>{b.commodity}</strong> • Declared: {b.allocatedQuantityQuintals}Q</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Weighbridge Console Form */}
        <div>
          {selectedBooking ? (
            <div className="gov-card">
              <div className="gov-card-header" style={{ borderBottom: '1px solid var(--gov-border)' }}>
                <div>
                  <h2 className="gov-card-title">Weighment Console: Token {selectedBooking.tokenNumber}</h2>
                  <p className="gov-card-subtitle">
                    Farmer Token #{selectedBooking.tokenNumber} • Registered Vehicle: {selectedBooking.vehicleNumber}
                  </p>
                </div>
                {selectedBooking.queueStatus === 'CHECKED_IN' && (
                  <button
                    className="gov-btn gov-btn-secondary"
                    onClick={handleStartWeighing}
                    disabled={isStarting}
                  >
                    <Scale size={16} />
                    {isStarting ? 'Engaging...' : 'Engage Weighbridge Scale'}
                  </button>
                )}
              </div>

              <div style={{ padding: '1.5rem' }}>
                <form onSubmit={handleCompleteWeighing}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    <div>
                      <label className="gov-label">Gross Weight (Quintals)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="gov-input"
                        placeholder="e.g. 74.50"
                        value={grossWeight}
                        onChange={e => setGrossWeight(e.target.value)}
                        required
                        autoFocus
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>
                        Vehicle + Grain load on weigh platform
                      </span>
                    </div>

                    <div>
                      <label className="gov-label">Tare Weight (Quintals)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="gov-input"
                        placeholder="e.g. 24.50"
                        value={tareWeight}
                        onChange={e => setTareWeight(e.target.value)}
                        required
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>
                        Empty vehicle unladen weight
                      </span>
                    </div>
                  </div>

                  {/* Net Weight Display Gauge */}
                  <div style={{
                    padding: '1.25rem',
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
                        Calculated Net Grain Weight
                      </div>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: netWeight > 0 ? 'var(--gov-green)' : 'var(--gov-navy)' }}>
                        {netWeight > 0 ? `${netWeight.toFixed(2)} Quintals` : '--'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--gov-text-secondary)' }}>
                      <div>Declared Quantity: <strong>{selectedBooking.allocatedQuantityQuintals} Q</strong></div>
                      <div>Scale Unit ID: <strong>{selectedCounterId || 'WB-01'}</strong></div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="gov-label">Operator Observations / Scale Audit Notes</label>
                    <input
                      type="text"
                      className="gov-input"
                      placeholder="e.g. Electronic load-cell calibrated, zero balance verified"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="gov-btn gov-btn-primary"
                    style={{ width: '100%', padding: '0.875rem' }}
                    disabled={isSubmitting || netWeight <= 0}
                  >
                    <CheckCircle size={18} />
                    {isSubmitting ? 'Recording Electronic Weighment...' : 'Confirm & Commit Weighment Record'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="gov-card" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--gov-text-muted)' }}>
              <Scale size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <h3>Select a vehicle from the roster</h3>
              <p>Choose an arrival on the left queue to open the weighbridge recording console.</p>
            </div>
          )}

          {/* Last Generated Electronic Weighment Slip (EWS) */}
          {lastSlip && (
            <div className="gov-card" style={{ marginTop: '1.5rem', border: '2px solid #86EFAC', background: '#F0FDF4' }}>
              <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <CheckCircle size={18} color="var(--gov-green)" />
                    <strong style={{ color: 'var(--gov-green)' }}>WEIGHMENT COMMIT SUCCESSFUL</strong>
                    <span className="gov-badge gov-badge-gov">{lastSlip.slipNo}</span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gov-text-secondary)' }}>
                    Token #{lastSlip.token} • Net Weight: <strong>{lastSlip.net} Quintals</strong> ({lastSlip.gross}Q Gross - {lastSlip.tare}Q Tare) at {lastSlip.timestamp}
                  </div>
                </div>
                <button className="gov-btn gov-btn-secondary" onClick={() => window.print()}>
                  <Printer size={16} /> Print EWS
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
