import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { socketService } from '../../../realtime/socket';
import { Counter, CentreDashboardData } from '../../../types';
import { Cpu, AlertTriangle, CheckCircle, Wrench, RefreshCw, Power, Zap } from 'lucide-react';

export const CountersManagementPage: React.FC = () => {
  const [centreId, setCentreId] = useState<string>('c-karnal-01');
  const [dashboard, setDashboard] = useState<CentreDashboardData | null>(null);
  const [selectedCounterId, setSelectedCounterId] = useState<string>('');
  const [breakdownDate, setBreakdownDate] = useState<string>('2026-04-15');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [breakdownResult, setBreakdownResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCounters = async () => {
    try {
      setError(null);
      const data = await api.getCentreDashboard(centreId);
      setDashboard(data);
      if (data.counters && data.counters.length > 0 && !selectedCounterId) {
        setSelectedCounterId(data.counters[0].counterId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch counters inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounters();
    const unsubscribe = socketService.onQueueUpdated(() => {
      fetchCounters();
    });
    return () => unsubscribe();
  }, [centreId]);

  const handleSimulateBreakdown = async () => {
    if (!selectedCounterId) return;
    setIsSimulating(true);
    setError(null);
    setBreakdownResult(null);
    try {
      const res = await api.triggerCounterBreakdown(centreId, selectedCounterId, breakdownDate);
      setBreakdownResult(res);
      await fetchCounters();
    } catch (err: any) {
      setError(err.message || 'Failed to trigger counter breakdown');
    } finally {
      setIsSimulating(false);
    }
  };

  const counters = dashboard?.counters || [];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">CENTRE OPERATIONS</span>
            <span className="gov-badge gov-badge-active">HARDWARE INFRASTRUCTURE</span>
          </div>
          <h1 className="portal-title">Physical Counter Management & Redundancy</h1>
          <p className="portal-subtitle">Lane Hardware Status, Throughput Capacities & Automated Breakdown Recovery</p>
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
          <button className="gov-btn gov-btn-secondary" onClick={fetchCounters}>
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

      {/* Section 30 Counter Breakdown Simulation Console */}
      <div className="gov-card" style={{ marginBottom: '2rem', border: '2px solid #F59E0B', background: '#FFFBEB' }}>
        <div className="gov-card-header" style={{ borderBottom: '1px solid #FDE68A' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={20} color="#D97706" />
            <div>
              <h2 className="gov-card-title" style={{ color: '#92400E' }}>Hardware Outage & Dynamic Rescheduling Console (Section 30)</h2>
              <p className="gov-card-subtitle" style={{ color: '#B45309' }}>
                Simulate a physical weighbridge/gate breakdown to trigger automatic re-routing and buffer adaptations.
              </p>
            </div>
          </div>
          <span className="gov-badge gov-badge-warning">HIGH-IMPACT TEST</span>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
            <div>
              <label className="gov-label" style={{ color: '#92400E' }}>Select Target Counter</label>
              <select
                className="gov-input"
                value={selectedCounterId}
                onChange={e => setSelectedCounterId(e.target.value)}
              >
                {counters.map(c => (
                  <option key={c.counterId} value={c.counterId}>
                    {c.name} ({c.type}) — Currently: {c.status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="gov-label" style={{ color: '#92400E' }}>Impact Date</label>
              <input
                type="date"
                className="gov-input"
                value={breakdownDate}
                onChange={e => setBreakdownDate(e.target.value)}
              />
            </div>

            <button
              className="gov-btn"
              onClick={handleSimulateBreakdown}
              disabled={isSimulating || !selectedCounterId}
              style={{ background: '#DC2626', color: 'white', borderColor: '#DC2626', padding: '0.625rem 1.25rem' }}
            >
              <Zap size={16} />
              {isSimulating ? 'Executing Outage Engine...' : 'Trigger Counter Breakdown'}
            </button>
          </div>

          {/* Breakdown API Execution Result */}
          {breakdownResult && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                <CheckCircle size={18} color="#DC2626" />
                <strong style={{ color: '#991B1B' }}>Automated Failure Mitigation Plan Activated</strong>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#B91C1C', margin: 0 }}>
                {breakdownResult.message || 'Counter set to MAINTENANCE. Affected vehicles dynamically reassigned to active parallel lanes. Real-time SMS and queue delay broadcasted.'}
              </p>
              {breakdownResult.reroutedCount !== undefined && (
                <div style={{ marginTop: '6px', fontSize: '0.8125rem', color: '#7F1D1D' }}>
                  Vehicles Rerouted: <strong>{breakdownResult.reroutedCount}</strong> • Delay Buffer: <strong>+{breakdownResult.delayMinutes || 15} mins</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Physical Counters Table */}
      <div className="gov-card">
        <div className="gov-card-header">
          <div>
            <h2 className="gov-card-title">Physical Counters ({counters.length})</h2>
            <p className="gov-card-subtitle">Active operational hardware lanes at this procurement centre</p>
          </div>
          <span className="gov-badge gov-badge-active">TELEMETRY STREAM CONNECTED</span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading hardware inventory...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="gov-table">
              <thead>
                <tr>
                  <th>COUNTER ID</th>
                  <th>HARDWARE NAME</th>
                  <th>STAGE TYPE</th>
                  <th>CURRENT STATUS</th>
                  <th>CAPACITY / HOUR</th>
                  <th>HEALTH CHECK</th>
                </tr>
              </thead>
              <tbody>
                {counters.map(counter => (
                  <tr key={counter.counterId}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: 'var(--gov-navy)' }}>
                        {counter.counterId}
                      </strong>
                    </td>
                    <td>
                      <strong>{counter.name}</strong>
                    </td>
                    <td>
                      <span className="gov-badge gov-badge-gov">{counter.type}</span>
                    </td>
                    <td>
                      <span className={`gov-badge ${counter.status === 'ACTIVE' ? 'gov-badge-active' : 'gov-badge-error'}`}>
                        {counter.status}
                      </span>
                    </td>
                    <td>
                      <strong>{counter.capacityPerHour}</strong> vehicles / hr
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: counter.status === 'ACTIVE' ? 'var(--gov-green)' : 'var(--gov-red)', fontWeight: 600 }}>
                        {counter.status === 'ACTIVE' ? '● Operational (Normal)' : '▲ Offline / Servicing'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
