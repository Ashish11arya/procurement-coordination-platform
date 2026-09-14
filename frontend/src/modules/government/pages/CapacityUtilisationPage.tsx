import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { BarChart3, RefreshCw, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';

export const CapacityUtilisationPage: React.FC = () => {
  const [centres, setCentres] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUtilisation = async () => {
    try {
      setError(null);
      const res = await api.getCentresSummary();
      setCentres(res.centres || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch capacity utilisation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUtilisation();
  }, []);

  const timeSlots = [
    { time: '08:00 - 10:00', kUtil: 45, rUtil: 30 },
    { time: '10:00 - 12:00', kUtil: 85, rUtil: 60 },
    { time: '12:00 - 14:00', kUtil: 70, rUtil: 55 },
    { time: '14:00 - 16:00', kUtil: 50, rUtil: 40 },
    { time: '16:00 - 18:00', kUtil: 25, rUtil: 20 },
  ];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">GOVERNMENT COMMAND CENTRE</span>
            <span className="gov-badge gov-badge-active">YARD EFFICIENCY</span>
          </div>
          <h1 className="portal-title">Procurement Capacity Utilisation Heatmap</h1>
          <p className="portal-subtitle">Diurnal Influx Distribution, Quota Absorption & Idle Capacity Balancing</p>
        </div>
        <button className="gov-btn gov-btn-secondary" onClick={fetchUtilisation}>
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

      {/* Hourly Heatmap Distribution Table */}
      <div className="gov-card" style={{ marginBottom: '2rem' }}>
        <div className="gov-card-header">
          <div>
            <h2 className="gov-card-title">Hourly Slot Absorption Heatmap</h2>
            <p className="gov-card-subtitle">Peak arrivals concentrated during 10:00 - 12:00 midday slot</p>
          </div>
          <span className="gov-badge gov-badge-active">RMS 2026 BENCHMARK</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="gov-table">
            <thead>
              <tr>
                <th>OPERATIONAL TIME SLOT</th>
                <th>KARNAL MANDI (c-karnal-01)</th>
                <th>ROHTAK GRAIN YARD (c-rohtak-01)</th>
                <th>CONGESTION STATUS</th>
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(slot => (
                <tr key={slot.time}>
                  <td>
                    <strong style={{ color: 'var(--gov-navy)' }}>{slot.time}</strong>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${slot.kUtil}%`,
                            background: slot.kUtil > 80 ? 'var(--gov-red)' : slot.kUtil > 60 ? 'var(--gov-amber)' : 'var(--gov-green)',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, width: '40px' }}>{slot.kUtil}%</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${slot.rUtil}%`,
                            background: slot.rUtil > 80 ? 'var(--gov-red)' : slot.rUtil > 60 ? 'var(--gov-amber)' : 'var(--gov-green)',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, width: '40px' }}>{slot.rUtil}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`gov-badge ${slot.kUtil > 80 ? 'gov-badge-warning' : 'gov-badge-active'}`}>
                      {slot.kUtil > 80 ? 'PEAK LOAD' : 'OPTIMAL'}
                    </span>
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
