import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { MapPin, RefreshCw, TrendingUp, AlertTriangle, Building, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const StatesOverviewPage: React.FC = () => {
  const [statesData, setStatesData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStates = async () => {
    try {
      setError(null);
      const data = await api.getStatesSummary();
      setStatesData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch states summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStates();
  }, []);

  const states = [
    {
      code: 'HR',
      name: 'Haryana',
      districtsCount: 22,
      activeCentres: 2,
      sanctionedCapacityQ: 1000,
      procuredQ: 350,
      utilizationPct: 35,
      status: 'ACTIVE_INTAKE',
    },
    {
      code: 'PB',
      name: 'Punjab',
      districtsCount: 23,
      activeCentres: 4,
      sanctionedCapacityQ: 2500,
      procuredQ: 890,
      utilizationPct: 36,
      status: 'ACTIVE_INTAKE',
    },
    {
      code: 'MP',
      name: 'Madhya Pradesh',
      districtsCount: 52,
      activeCentres: 6,
      sanctionedCapacityQ: 3200,
      procuredQ: 1100,
      utilizationPct: 34,
      status: 'ACTIVE_INTAKE',
    },
  ];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">GOVERNMENT COMMAND CENTRE</span>
            <span className="gov-badge gov-badge-active">STATE-LEVEL ROLLUP</span>
          </div>
          <h1 className="portal-title">State Civil Supplies Corporation Procurement</h1>
          <p className="portal-subtitle">Inter-State Procurement Comparison, Quota Allocation & Seasonal Benchmarking</p>
        </div>
        <button className="gov-btn gov-btn-secondary" onClick={fetchStates}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="gov-alert gov-alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="gov-card">
        <div className="gov-card-header">
          <div>
            <h2 className="gov-card-title">Participating State Civil Supplies Corporations</h2>
            <p className="gov-card-subtitle">Rabi Marketing Season (RMS) 2026-27 Progress</p>
          </div>
          <span className="gov-badge gov-badge-active">CENTRAL MANDATE ACTIVE</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="gov-table">
            <thead>
              <tr>
                <th>STATE CODE</th>
                <th>STATE NAME</th>
                <th>ACTIVE MANDIS</th>
                <th>SANCTIONED TARGET (Q)</th>
                <th>PROCURED TO DATE (Q)</th>
                <th>UTILISATION</th>
                <th>STATUS</th>
                <th>DRILL-DOWN</th>
              </tr>
            </thead>
            <tbody>
              {states.map(s => (
                <tr key={s.code}>
                  <td>
                    <strong style={{ color: 'var(--gov-navy)' }}>{s.code}</strong>
                  </td>
                  <td>
                    <strong>{s.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>{s.districtsCount} Districts</div>
                  </td>
                  <td>{s.activeCentres} Mandis</td>
                  <td>{s.sanctionedCapacityQ.toLocaleString()} Q</td>
                  <td>
                    <strong>{s.procuredQ.toLocaleString()} Q</strong>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '80px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${s.utilizationPct}%`, background: 'var(--gov-green)' }} />
                      </div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{s.utilizationPct}%</span>
                    </div>
                  </td>
                  <td>
                    <span className="gov-badge gov-badge-active">{s.status}</span>
                  </td>
                  <td>
                    <Link to="/admin/districts" className="gov-btn gov-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                      Districts <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
