import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { socketService } from '../../../realtime/socket';
import { Booking, Counter } from '../../../types';
import { FlaskConical, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Clock, Award, ShieldCheck } from 'lucide-react';

export const QualityOperatorPage: React.FC = () => {
  const [centreId, setCentreId] = useState<string>('c-karnal-01');
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounterId, setSelectedCounterId] = useState<string>('');
  const [activeQueue, setActiveQueue] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Assay form state
  const [moisture, setMoisture] = useState<string>('11.5');
  const [foreignMatter, setForeignMatter] = useState<string>('0.4');
  const [damagedGrains, setDamagedGrains] = useState<string>('0.8');
  const [assignedGrade, setAssignedGrade] = useState<string>('Grade A');
  const [verdict, setVerdict] = useState<string>('ACCEPTED');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAssay, setLastAssay] = useState<any | null>(null);

  const fetchCentreData = async () => {
    try {
      setError(null);
      const data = await api.getCentreDashboard(centreId);
      const labs = (data.counters || []).filter(c => c.type === 'QUALITY_LAB');
      setCounters(labs);
      if (labs.length > 0 && !selectedCounterId) {
        setSelectedCounterId(labs[0].counterId);
      }

      // Filter bookings that have finished weighing or in quality
      const readyForQuality = (data.roster || []).filter(
        b => b.queueStatus === 'WEIGHING_COMPLETED' || b.queueStatus === 'QUALITY_CHECK'
      );
      setActiveQueue(readyForQuality);

      if (selectedBooking) {
        const updated = readyForQuality.find(b => b.bookingId === selectedBooking.bookingId);
        if (updated) setSelectedBooking(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch quality lab queue');
    }
  };

  useEffect(() => {
    fetchCentreData();
    const unsubscribe = socketService.onQueueUpdated(() => {
      fetchCentreData();
    });
    return () => unsubscribe();
  }, [centreId]);

  const handleRecordQuality = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !selectedCounterId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.recordQuality({
        bookingId: selectedBooking.bookingId,
        counterId: selectedCounterId,
        moisturePercentage: Number(moisture),
        foreignMatterPercentage: Number(foreignMatter),
        damagedGrainsPercentage: Number(damagedGrains),
        assignedGrade,
        verdict,
        notes: notes || 'Assay conducted per FAQ standards',
      });

      setLastAssay({
        token: selectedBooking.tokenNumber,
        bookingId: selectedBooking.bookingId,
        moisture: Number(moisture),
        foreignMatter: Number(foreignMatter),
        grade: assignedGrade,
        verdict,
        timestamp: new Date().toLocaleTimeString(),
        certNo: `QAC-${Date.now().toString().slice(-6)}`,
      });

      setSelectedBooking(null);
      await fetchCentreData();
    } catch (err: any) {
      setError(err.message || 'Failed to record quality assay');
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
            <span className="gov-badge gov-badge-active">STATION: QUALITY ASSAY LAB</span>
          </div>
          <h1 className="portal-title">Grain Quality Assay & Grading</h1>
          <p className="portal-subtitle">Moisture, Foreign Matter & FAQ Conformance Testing</p>
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
        {/* Left Column: Vehicles Ready for Quality Check */}
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <h2 className="gov-card-title">Pending Assay ({activeQueue.length})</h2>
              <p className="gov-card-subtitle">Weighed loads awaiting quality verdict</p>
            </div>
          </div>

          <div style={{ padding: '1rem', borderBottom: '1px solid var(--gov-border)' }}>
            <label className="gov-label" style={{ fontSize: '0.75rem' }}>ASSAY LAB BENCH</label>
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
                <p>No vehicles awaiting quality inspection.</p>
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
                    <div>Net Weight: <strong>{b.allocatedQuantityQuintals} Q</strong> • {b.commodity}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Quality Testing Form */}
        <div>
          {selectedBooking ? (
            <div className="gov-card">
              <div className="gov-card-header" style={{ borderBottom: '1px solid var(--gov-border)' }}>
                <div>
                  <h2 className="gov-card-title">Quality Assay: Token {selectedBooking.tokenNumber}</h2>
                  <p className="gov-card-subtitle">
                    Commodity: {selectedBooking.commodity} • Net Batch: {selectedBooking.allocatedQuantityQuintals} Q
                  </p>
                </div>
                <span className="gov-badge gov-badge-gov">STATION: {selectedCounterId || 'QL-01'}</span>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <form onSubmit={handleRecordQuality}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <label className="gov-label">Moisture Content (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="gov-input"
                        value={moisture}
                        onChange={e => setMoisture(e.target.value)}
                        required
                        autoFocus
                      />
                      <span style={{ fontSize: '0.75rem', color: Number(moisture) <= 12 ? 'var(--gov-green)' : 'var(--gov-amber)' }}>
                        {Number(moisture) <= 12 ? '✓ Within FAQ limit (≤12%)' : '⚠ High moisture'}
                      </span>
                    </div>

                    <div>
                      <label className="gov-label">Foreign Matter (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="gov-input"
                        value={foreignMatter}
                        onChange={e => setForeignMatter(e.target.value)}
                        required
                      />
                      <span style={{ fontSize: '0.75rem', color: Number(foreignMatter) <= 0.75 ? 'var(--gov-green)' : 'var(--gov-amber)' }}>
                        {Number(foreignMatter) <= 0.75 ? '✓ Clean sample (≤0.75%)' : '⚠ Exceeds standard'}
                      </span>
                    </div>

                    <div>
                      <label className="gov-label">Damaged Grains (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="gov-input"
                        value={damagedGrains}
                        onChange={e => setDamagedGrains(e.target.value)}
                        required
                      />
                      <span style={{ fontSize: '0.75rem', color: Number(damagedGrains) <= 2.0 ? 'var(--gov-green)' : 'var(--gov-amber)' }}>
                        {Number(damagedGrains) <= 2.0 ? '✓ Within permissible limit' : '⚠ Excessive damage'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    <div>
                      <label className="gov-label">Assigned Quality Grade</label>
                      <select
                        className="gov-input"
                        value={assignedGrade}
                        onChange={e => setAssignedGrade(e.target.value)}
                      >
                        <option value="Grade A">Grade A (FAQ Standard - Full MSP)</option>
                        <option value="Grade B">Grade B (Marginal Variation)</option>
                        <option value="Grade C">Grade C (Sub-standard with Deduction)</option>
                      </select>
                    </div>

                    <div>
                      <label className="gov-label">Final Acceptance Verdict</label>
                      <select
                        className="gov-input"
                        value={verdict}
                        onChange={e => setVerdict(e.target.value)}
                        style={{
                          fontWeight: 700,
                          color: verdict === 'ACCEPTED' ? 'var(--gov-green)' : 'var(--gov-red)',
                        }}
                      >
                        <option value="ACCEPTED">ACCEPTED (Passes Conformance Standards)</option>
                        <option value="REJECTED">REJECTED (Exceeds Tolerance Limits)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="gov-label">Assay Lab Remarks</label>
                    <input
                      type="text"
                      className="gov-input"
                      placeholder="e.g. Clean golden grains, moisture meter serial #MM-8841"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="gov-btn gov-btn-primary"
                    style={{ width: '100%', padding: '0.875rem' }}
                    disabled={isSubmitting}
                  >
                    <ShieldCheck size={18} />
                    {isSubmitting ? 'Recording Quality Certificate...' : 'Authorize Quality Clearance'}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="gov-card" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--gov-text-muted)' }}>
              <FlaskConical size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <h3>Select a vehicle from the assay queue</h3>
              <p>Choose an arrival on the left queue to conduct quality analysis and assign procurement grade.</p>
            </div>
          )}

          {/* Last Generated Certificate */}
          {lastAssay && (
            <div className="gov-card" style={{ marginTop: '1.5rem', border: '2px solid #86EFAC', background: '#F0FDF4' }}>
              <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <Award size={18} color="var(--gov-green)" />
                    <strong style={{ color: 'var(--gov-green)' }}>QUALITY CLEARANCE CERTIFIED</strong>
                    <span className="gov-badge gov-badge-gov">{lastAssay.certNo}</span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gov-text-secondary)' }}>
                    Token #{lastAssay.token} • {lastAssay.grade} ({lastAssay.verdict}) • Moisture: <strong>{lastAssay.moisture}%</strong> • Foreign Matter: {lastAssay.foreignMatter}%
                  </div>
                </div>
                <span className="gov-badge gov-badge-active">CLEARED FOR PROCUREMENT</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
