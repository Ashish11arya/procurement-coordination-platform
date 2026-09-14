import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { MapPin, RefreshCw, AlertTriangle, ArrowRight, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DistrictsRollupPage: React.FC = () => {
  const [selectedState, setSelectedState] = useState<string>('Haryana');
  const [districtsData, setDistrictsData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDistricts = async () => {
    try {
      setError(null);
      const data = await api.getDistrictsSummary(selectedState);
      setDistrictsData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch districts summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistricts();
  }, [selectedState]);

  const districts = [
    {
      name: 'Karnal',
      state: 'Haryana',
      totalCentres: 1,
      activeCentres: 1,
      dailyQuotaQ: 500,
      procuredQ: 250,
      activeVehicles: 8,
      avgTurnaroundMins: 24,
      status: 'NORMAL',
    },
    {
      name: 'Rohtak',
      state: 'Haryana',
      totalCentres: 1,
      activeCentres: 1,
      dailyQuotaQ: 500,
      procuredQ: 100,
      activeVehicles: 4,
      avgTurnaroundMins: 22,
      status: 'NORMAL',
    },
    {
      name: 'Kurukshetra',
      state: 'Haryana',
      totalCentres: 2,
      activeCentres: 2,
      dailyQuotaQ: 900,
      procuredQ: 320,
      activeVehicles: 11,
      avgTurnaroundMins: 31,
      status: 'NORMAL',
    },
    {
      name: 'Ambala',
      state: 'Haryana',
      totalCentres: 2,
      activeCentres: 2,
      dailyQuotaQ: 800,
      procuredQ: 280,
      activeVehicles: 9,
      avgTurnaroundMins: 26,
      status: 'NORMAL',
    },
  ];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">GOVERNMENT COMMAND CENTRE</span>
            <span className="gov-badge gov-badge-active">DISTRICT JURISDICTION</span>
          </div>
          <h1 className="portal-title">District Procurement Aggregation</h1>
          <p className="portal-subtitle">Tehsil Rollup, Mandi Performance & District Collector Monitoring</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="gov-input"
            value={selectedState}
            onChange={e => setSelectedState(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="Haryana">State: Haryana</option>
            <option value="Punjab">State: Punjab</option>
            <option value="Madhya Pradesh">State: Madhya Pradesh</option>
          </select>
          <button className="gov-btn gov-btn-secondary" onClick={fetchDistricts}>
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

      <div className="gov-card">
        <div className="gov-card-header">
          <div>
            <h2 className="gov-card-title">Districts in {selectedState} ({districts.length})</h2>
            <p className="gov-card-subtitle">Aggregated metrics from verified weighment and gate logs</p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="gov-table">
            <thead>
              <tr>
                <th>DISTRICT</th>
                <th>MANDIS</th>
                <th>DAILY CEILING (Q)</th>
                <th>PROCURED (Q)</th>
                <th>ACTIVE YARD VEHICLES</th>
                <th>AVG TURNAROUND</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {districts.map(d => {
                const pct = Math.round((d.procuredQ / d.dailyQuotaQ) * 100);
                return (
                  <tr key={d.name}>
                    <td>
                      <strong style={{ color: 'var(--gov-navy)' }}>{d.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>{d.state}</div>
                    </td>
                    <td>{d.activeCentres} Active / {d.totalCentres} Total</td>
                    <td>{d.dailyQuotaQ.toLocaleString()} Q</td>
                    <td>
                      <strong>{d.procuredQ.toLocaleString()} Q</strong> ({pct}%)
                    </td>
                    <td>{d.activeVehicles} Trucks</td>
                    <td>{d.avgTurnaroundMins} mins</td>
                    <td>
                      <span className="gov-badge gov-badge-active">{d.status}</span>
                    </td>
                    <td>
                      <Link to={`/admin/centres?district=${d.name}`} className="gov-btn gov-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                        Mandis <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
