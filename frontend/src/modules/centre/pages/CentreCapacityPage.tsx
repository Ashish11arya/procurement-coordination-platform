import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { CentreDashboardData } from '../../../types';
import { Gauge, RefreshCw, AlertTriangle, ShieldCheck, Warehouse, Sliders } from 'lucide-react';

export const CentreCapacityPage: React.FC = () => {
  const [centreId, setCentreId] = useState<string>('c-karnal-01');
  const [dashboard, setDashboard] = useState<CentreDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Derating factor simulation state
  const [deratingFactor, setDeratingFactor] = useState<number>(100);
  const [maxYardVehicles, setMaxYardVehicles] = useState<number>(20);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const fetchCapacity = async () => {
    try {
      setError(null);
      const data = await api.getCentreDashboard(centreId);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load centre capacity configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCapacity();
  }, [centreId]);

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const metrics = dashboard?.metrics;
  const bookedQ = metrics?.bookedQuantityQuintals || 0;
  const dailyCap = metrics?.dailyCapacityQuintals || 500;
  const effectiveCap = Math.round((dailyCap * deratingFactor) / 100);
  const capPercent = Math.min(100, Math.round((bookedQ / effectiveCap) * 100));

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">CENTRE OPERATIONS</span>
            <span className="gov-badge gov-badge-active">CAPACITY POLICY</span>
          </div>
          <h1 className="portal-title">Centre Capacity & Yard Derating Controls</h1>
          <p className="portal-subtitle">Sanctioned Intake Quotas, Weather Derating Factors & Simultaneous Yard Thresholds</p>
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
          <button className="gov-btn gov-btn-secondary" onClick={fetchCapacity}>
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

      {/* Real-time Capacity Gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="gov-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
            Sanctioned Daily Quota
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--gov-navy)', marginTop: '4px' }}>
            {dailyCap} Quintals
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--gov-text-secondary)', marginTop: '4px' }}>
            Central gazetted seasonal ceiling
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
            Effective Intake Capacity
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--gov-green)', marginTop: '4px' }}>
            {effectiveCap} Quintals
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--gov-text-secondary)', marginTop: '4px' }}>
            Reflecting {deratingFactor}% derating factor
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
            Current Day Booked
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: capPercent > 90 ? 'var(--gov-red)' : 'var(--gov-blue)', marginTop: '4px' }}>
            {bookedQ} Q ({capPercent}%)
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--gov-text-secondary)', marginTop: '4px' }}>
            {effectiveCap - bookedQ} Quintals available
          </div>
        </div>
      </div>

      {/* Policy Settings Form */}
      <div className="gov-card">
        <div className="gov-card-header">
          <div>
            <h2 className="gov-card-title">Dynamic Yard Operational Policy</h2>
            <p className="gov-card-subtitle">Adjust safety buffers, simultaneous vehicle caps and rain deratings</p>
          </div>
          <Sliders size={20} color="var(--gov-text-secondary)" />
        </div>

        <div style={{ padding: '1.5rem' }}>
          <form onSubmit={handleSavePolicy}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label className="gov-label">Maximum Simultaneous Yard Vehicles</label>
                <input
                  type="number"
                  className="gov-input"
                  value={maxYardVehicles}
                  onChange={e => setMaxYardVehicles(Number(e.target.value))}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>
                  Physical congestion limit inside mandi boundary (default: 20)
                </span>
              </div>

              <div>
                <label className="gov-label">Operational Derating Factor (%)</label>
                <select
                  className="gov-input"
                  value={deratingFactor}
                  onChange={e => setDeratingFactor(Number(e.target.value))}
                >
                  <option value={100}>100% — Full Operational Capacity (Clear Skies)</option>
                  <option value={80}>80% — Moderate Derating (Light Rain / Shed Staging)</option>
                  <option value={60}>60% — High Derating (Heavy Downpour / Saturated Silos)</option>
                  <option value={40}>40% — Emergency Minimum Flow (Single Weighbridge)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>
                  Dynamically scales available slot quotas without cancelling confirmed tokens
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '6px', border: '1px solid var(--gov-border)' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--gov-navy)' }}>Gate Inflow SLA</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-secondary)', marginTop: '4px' }}>
                  ≤ 3 minutes per vehicle barcode scan
                </div>
              </div>

              <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '6px', border: '1px solid var(--gov-border)' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--gov-navy)' }}>Weighbridge SLA</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-secondary)', marginTop: '4px' }}>
                  ≤ 5 minutes gross & tare net capture
                </div>
              </div>

              <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '6px', border: '1px solid var(--gov-border)' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--gov-navy)' }}>Assay Lab SLA</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-secondary)', marginTop: '4px' }}>
                  ≤ 7 minutes moisture & FAQ analysis
                </div>
              </div>
            </div>

            {savedSuccess && (
              <div className="gov-alert gov-alert-success" style={{ marginBottom: '1.5rem' }}>
                <ShieldCheck size={18} />
                <span>Centre operational capacity policy updated and published to scheduling engine.</span>
              </div>
            )}

            <button type="submit" className="gov-btn gov-btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
              <ShieldCheck size={18} />
              Save & Apply Mandi Policy
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
