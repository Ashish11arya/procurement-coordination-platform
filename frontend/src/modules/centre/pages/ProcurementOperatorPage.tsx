import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { socketService } from '../../../realtime/socket';
import { Booking, Counter } from '../../../types';
import { CreditCard, CheckCircle2, AlertTriangle, Printer, RefreshCw, Clock, IndianRupee, FileText } from 'lucide-react';

export const ProcurementOperatorPage: React.FC = () => {
  const [centreId, setCentreId] = useState<string>('c-karnal-01');
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounterId, setSelectedCounterId] = useState<string>('');
  const [activeQueue, setActiveQueue] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Procurement form state
  const [quantity, setQuantity] = useState<string>('50.0');
  const [mspRate, setMspRate] = useState<string>('2275');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAdvice, setLastAdvice] = useState<any | null>(null);

  const totalPayout = (Number(quantity) || 0) * (Number(mspRate) || 0);

  const fetchCentreData = async () => {
    try {
      setError(null);
      const data = await api.getCentreDashboard(centreId);
      const desks = (data.counters || []).filter(c => c.type === 'PROCUREMENT_DESK');
      setCounters(desks);
      if (desks.length > 0 && !selectedCounterId) {
        setSelectedCounterId(desks[0].counterId);
      }

      // Filter bookings that passed quality or in procurement
      const readyForProcurement = (data.roster || []).filter(
        b => b.queueStatus === 'QUALITY_CHECK' || b.queueStatus === 'PROCUREMENT_IN_PROGRESS' || b.queueStatus === 'WEIGHING_COMPLETED'
      );
      setActiveQueue(readyForProcurement);

      if (selectedBooking) {
        const updated = readyForProcurement.find(b => b.bookingId === selectedBooking.bookingId);
        if (updated) setSelectedBooking(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch procurement desk queue');
    }
  };

  useEffect(() => {
    fetchCentreData();
    const unsubscribe = socketService.onQueueUpdated(() => {
      fetchCentreData();
    });
    return () => unsubscribe();
  }, [centreId]);

  // When selected booking changes, set default quantity
  useEffect(() => {
    if (selectedBooking) {
      setQuantity(selectedBooking.allocatedQuantityQuintals.toString());
    }
  }, [selectedBooking]);

  const handleRecordProcurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !selectedCounterId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.recordProcurement({
        bookingId: selectedBooking.bookingId,
        counterId: selectedCounterId,
        finalQuantityQuintals: Number(quantity),
        mspRatePerQuintal: Number(mspRate),
        notes: notes || 'Procurement intake verified and DBT order generated',
      });

      setLastAdvice({
        token: selectedBooking.tokenNumber,
        bookingId: selectedBooking.bookingId,
        quantity: Number(quantity),
        rate: Number(mspRate),
        total: totalPayout,
        panNumber: `PAN-2026-FCI-${Date.now().toString().slice(-7)}`,
        timestamp: new Date().toLocaleTimeString(),
      });

      setSelectedBooking(null);
      await fetchCentreData();
    } catch (err: any) {
      setError(err.message || 'Procurement authorization failed');
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
            <span className="gov-badge gov-badge-active">STATION: PROCUREMENT & DBT</span>
          </div>
          <h1 className="portal-title">Procurement Authorization & Payment Advice</h1>
          <p className="portal-subtitle">Final Grain Intake, MSP Ledger Entry & Direct Benefit Transfer Trigger</p>
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
        {/* Left Column: Vehicles Ready for Final Procurement */}
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <h2 className="gov-card-title">Eligible for Intake ({activeQueue.length})</h2>
              <p className="gov-card-subtitle">Inspected loads ready for MSP purchase</p>
            </div>
          </div>

          <div style={{ padding: '1rem', borderBottom: '1px solid var(--gov-border)' }}>
            <label className="gov-label" style={{ fontSize: '0.75rem' }}>PROCUREMENT DESK</label>
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
                <p>No loads awaiting procurement intake.</p>
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
                    <span className="gov-badge gov-badge-active">{b.queueStatus}</span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--gov-text-secondary)' }}>
                    <div>Vehicle: <strong>{b.vehicleNumber}</strong></div>
                    <div>Intake: <strong>{b.allocatedQuantityQuintals} Q</strong> • {b.commodity}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Procurement Desk Form */}
        <div>
          {selectedBooking ? (
            <div className="gov-card">
              <div className="gov-card-header" style={{ borderBottom: '1px solid var(--gov-border)' }}>
                <div>
                  <h2 className="gov-card-title">Procurement Authorization: Token {selectedBooking.tokenNumber}</h2>
                  <p className="gov-card-subtitle">
                    Beneficiary: Farmer ID {selectedBooking.farmerId} • Commodity: {selectedBooking.commodity}
                  </p>
                </div>
                <span className="gov-badge gov-badge-gov">DESK: {selectedCounterId || 'PD-01'}</span>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <form onSubmit={handleRecordProcurement}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    <div>
                      <label className="gov-label">Accepted Net Quantity (Quintals)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="gov-input"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        required
                        autoFocus
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>
                        Net weight verified from weighbridge slip
                      </span>
                    </div>

                    <div>
                      <label className="gov-label">Official MSP Rate (₹ / Quintal)</label>
                      <input
                        type="number"
                        className="gov-input"
                        value={mspRate}
                        onChange={e => setMspRate(e.target.value)}
                        required
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>
                        Central Government Gazetted MSP 2026-27
                      </span>
                    </div>
                  </div>

                  {/* Calculated Payout Card */}
                  <div style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #0A2540 0%, #1E3A8A 100%)',
                    borderRadius: '8px',
                    color: 'white',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.85 }}>
                        Total Direct Benefit Transfer Payout
                      </div>
                      <div style={{ fontSize: '2.25rem', fontWeight: 800, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IndianRupee size={28} />
                        {totalPayout.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8125rem', opacity: 0.9 }}>
                      <div>{quantity} Quintals @ ₹{mspRate}/Q</div>
                      <div>SLA: Credit within 48 Hours via PFMS</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="gov-label">Procurement Officer Remarks</label>
                    <input
                      type="text"
                      className="gov-input"
                      placeholder="e.g. Silo bay #3 allotted, warehouse receipt generated"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="gov-btn gov-btn-primary"
                    style={{ width: '100%', padding: '0.875rem' }}
                    disabled={isSubmitting || totalPayout <= 0}
                  >
                    <CreditCard size={18} />
                    {isSubmitting ? 'Generating Payment Advice & DBT Order...' : 'Authorize Purchase & Generate Payment Advice'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="gov-card" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--gov-text-muted)' }}>
              <CreditCard size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <h3>Select a vehicle to initiate procurement payout</h3>
              <p>Choose an arrival on the left queue to verify MSP calculation and dispatch payment advice.</p>
            </div>
          )}

          {/* Last Generated Payment Advice */}
          {lastAdvice && (
            <div className="gov-card" style={{ marginTop: '1.5rem', border: '2px solid #86EFAC', background: '#F0FDF4' }}>
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <CheckCircle2 size={20} color="var(--gov-green)" />
                    <strong style={{ color: 'var(--gov-green)', fontSize: '1.125rem' }}>PAYMENT ADVICE ISSUED</strong>
                    <span className="gov-badge gov-badge-gov">{lastAdvice.panNumber}</span>
                  </div>
                  <button className="gov-btn gov-btn-secondary" onClick={() => window.print()}>
                    <Printer size={16} /> Print Receipt
                  </button>
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--gov-text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>Token Number: <strong>#{lastAdvice.token}</strong></div>
                  <div>Final Quantity: <strong>{lastAdvice.quantity} Quintals</strong></div>
                  <div>Total Payable: <strong style={{ color: 'var(--gov-green)' }}>₹{lastAdvice.total.toLocaleString('en-IN')}</strong></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
