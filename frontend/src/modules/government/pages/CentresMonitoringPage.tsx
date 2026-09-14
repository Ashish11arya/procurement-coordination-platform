import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { Building2, Search, Filter, RefreshCw, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

export const CentresMonitoringPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialDistrict = searchParams.get('district') || '';

  const [district, setDistrict] = useState<string>(initialDistrict);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [centres, setCentres] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCentres = async () => {
    try {
      setError(null);
      const res = await api.getCentresSummary(district || undefined);
      setCentres(res.centres || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch centres monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCentres();
  }, [district]);

  const filteredCentres = centres.filter(c => {
    const query = searchQuery.toLowerCase();
    return (
      c.centreId?.toLowerCase().includes(query) ||
      c.name?.toLowerCase().includes(query) ||
      c.district?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">GOVERNMENT COMMAND CENTRE</span>
            <span className="gov-badge gov-badge-active">MANDI DIRECTORY</span>
          </div>
          <h1 className="portal-title">Procurement Centre Monitoring Directory</h1>
          <p className="portal-subtitle">Live Capacity, Yard Occupancy & Infrastructure Status Across All Mandis</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="gov-input"
            value={district}
            onChange={e => setDistrict(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="">All Districts</option>
            <option value="Karnal">Karnal</option>
            <option value="Rohtak">Rohtak</option>
          </select>
          <button className="gov-btn gov-btn-secondary" onClick={fetchCentres}>
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

      {/* Search Bar */}
      <div className="gov-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gov-text-muted)' }} />
          <input
            type="text"
            className="gov-input"
            style={{ paddingLeft: '38px' }}
            placeholder="Search mandi by name, ID, or district..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Centres Directory Table */}
      <div className="gov-card">
        <div className="gov-card-header">
          <h2 className="gov-card-title">Procurement Centres ({filteredCentres.length})</h2>
          <span className="gov-badge gov-badge-active">TELEMETRY POLLING ACTIVE</span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading centres directory...</div>
        ) : filteredCentres.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gov-text-muted)' }}>
            <Building2 size={40} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p>No centres found matching search criteria.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="gov-table">
              <thead>
                <tr>
                  <th>CENTRE ID</th>
                  <th>MANDI NAME</th>
                  <th>LOCATION</th>
                  <th>DAILY CEILING (Q)</th>
                  <th>BOOKED INTAKE (Q)</th>
                  <th>AVAILABLE (Q)</th>
                  <th>YARD CONGESTION</th>
                  <th>OPERATING STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredCentres.map(c => {
                  const cap = c.dailyCapacityQuintals || 500;
                  const booked = c.bookedQuantityQuintals || 0;
                  const avail = Math.max(0, cap - booked);
                  const pct = Math.min(100, Math.round((booked / cap) * 100));

                  return (
                    <tr key={c.centreId}>
                      <td>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--gov-navy)' }}>
                          {c.centreId}
                        </strong>
                      </td>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>
                        <div>{c.district || 'Karnal'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>{c.state || 'Haryana'}</div>
                      </td>
                      <td>{cap} Quintals</td>
                      <td>
                        <div><strong>{booked} Q</strong> ({pct}%)</div>
                        <div style={{ height: '4px', width: '80px', background: '#E2E8F0', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct > 85 ? 'var(--gov-red)' : 'var(--gov-green)' }} />
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--gov-green)' }}>{avail} Q</strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{c.activeYardVehicles || 0} / {c.maxSimultaneousVehicles || 20}</span>
                      </td>
                      <td>
                        <span className="gov-badge gov-badge-active">ONLINE</span>
                      </td>
                      <td>
                        <Link to={`/centre/dashboard`} className="gov-btn gov-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                          Terminal <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
