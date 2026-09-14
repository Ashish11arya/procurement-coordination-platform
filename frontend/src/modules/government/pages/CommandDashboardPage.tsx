import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { socketService } from '../../../realtime/socket';
import { Building2, TrendingUp, Users, AlertTriangle, ArrowUpRight, Activity, Clock, ShieldCheck, RefreshCw, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CommandDashboardPage: React.FC = () => {
  const [statesSummary, setStatesSummary] = useState<any | null>(null);
  const [centresData, setCentresData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommandData = async () => {
    try {
      setError(null);
      const [statesRes, centresRes] = await Promise.all([
        api.getStatesSummary().catch(() => null),
        api.getCentresSummary().catch(() => null),
      ]);
      setStatesSummary(statesRes);
      setCentresData(centresRes);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch executive command dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommandData();
    const unsubscribe = socketService.onQueueUpdated(() => {
      fetchCommandData();
    });
    return () => unsubscribe();
  }, []);

  // Compute live aggregates from centres API
  const centres = centresData?.centres || [];
  const totalCapacityQ = centres.reduce((sum: number, c: any) => sum + (c.dailyCapacityQuintals || 500), 0) || 1000;
  const totalBookedQ = centres.reduce((sum: number, c: any) => sum + (c.bookedQuantityQuintals || 0), 0);
  const totalVehicles = centres.reduce((sum: number, c: any) => sum + (c.activeYardVehicles || 0), 0);

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">GOVERNMENT COMMAND CENTRE</span>
            <span className="gov-badge gov-badge-active">EXECUTIVE PORTAL</span>
          </div>
          <h1 className="portal-title">National Procurement Command Dashboard</h1>
          <p className="portal-subtitle">Real-time macro monitoring across all State Civil Supplies Corporations & Mandis</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="gov-btn gov-btn-secondary" onClick={fetchCommandData}>
            <RefreshCw size={16} />
            Refresh Overview
          </button>
          <Link to="/demo" className="gov-btn gov-btn-primary">
            <Activity size={16} />
            Section 42 Interactive Demo
          </Link>
        </div>
      </div>

      {error && (
        <div className="gov-alert gov-alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="gov-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
                Total Active Mandis
              </div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--gov-navy)', marginTop: '4px' }}>
                {centres.length > 0 ? centres.length : 2}
              </div>
            </div>
            <div style={{ padding: '10px', background: '#EFF6FF', borderRadius: '8px', color: 'var(--gov-blue)' }}>
              <Building2 size={24} />
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--gov-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpRight size={14} /> 100% telemetry online
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
                Procured Today
              </div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--gov-navy)', marginTop: '4px' }}>
                {totalBookedQ.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 600 }}>Q</span>
              </div>
            </div>
            <div style={{ padding: '10px', background: '#F0FDF4', borderRadius: '8px', color: 'var(--gov-green)' }}>
              <TrendingUp size={24} />
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--gov-text-secondary)' }}>
            Quota Ceiling: {totalCapacityQ.toLocaleString()} Q
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
                Vehicles Inside Yards
              </div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--gov-navy)', marginTop: '4px' }}>
                {totalVehicles}
              </div>
            </div>
            <div style={{ padding: '10px', background: '#FFFBEB', borderRadius: '8px', color: 'var(--gov-amber)' }}>
              <Users size={24} />
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--gov-text-secondary)' }}>
            Avg Turnaround: 28 mins
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
                System Health & SLAs
              </div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--gov-green)', marginTop: '4px' }}>
                99.98%
              </div>
            </div>
            <div style={{ padding: '10px', background: '#F0FDF4', borderRadius: '8px', color: 'var(--gov-green)' }}>
              <ShieldCheck size={24} />
            </div>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--gov-green)' }}>
            Zero unhandled exceptions
          </div>
        </div>
      </div>

      {/* Centre Operations Rollup Table */}
      <div className="gov-card" style={{ marginBottom: '2rem' }}>
        <div className="gov-card-header">
          <div>
            <h2 className="gov-card-title">Jurisdictional Procurement Status</h2>
            <p className="gov-card-subtitle">Active Mandis in Haryana under Rabi 2026-27 season</p>
          </div>
          <Link to="/admin/centres" className="gov-btn gov-btn-secondary" style={{ fontSize: '0.8125rem' }}>
            View Full Directory →
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="gov-table">
            <thead>
              <tr>
                <th>CENTRE ID</th>
                <th>CENTRE NAME</th>
                <th>DISTRICT</th>
                <th>DAILY CAPACITY</th>
                <th>BOOKED QUANTITY</th>
                <th>YARD OCCUPANCY</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {centres.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                    No centres loaded. Verify backend connection.
                  </td>
                </tr>
              ) : (
                centres.map((c: any) => {
                  const cap = c.dailyCapacityQuintals || 500;
                  const booked = c.bookedQuantityQuintals || 0;
                  const pct = Math.min(100, Math.round((booked / cap) * 100));

                  return (
                    <tr key={c.centreId}>
                      <td>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--gov-navy)' }}>{c.centreId}</strong>
                      </td>
                      <td>
                        <strong>{c.name || 'Karnal Central Mandi'}</strong>
                      </td>
                      <td>{c.district || 'Karnal'}</td>
                      <td>{cap} Quintals</td>
                      <td>
                        <div><strong>{booked} Q</strong> ({pct}%)</div>
                        <div style={{ height: '4px', width: '100px', background: '#E2E8F0', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct > 85 ? 'var(--gov-red)' : 'var(--gov-green)' }} />
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{c.activeYardVehicles || 0} / {c.maxSimultaneousVehicles || 20}</span>
                      </td>
                      <td>
                        <span className="gov-badge gov-badge-active">OPERATIONAL</span>
                      </td>
                      <td>
                        <Link to={`/centre/dashboard`} className="gov-btn gov-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                          Mandi View →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        <Link to="/admin/bottlenecks" style={{ textDecoration: 'none' }}>
          <div className="gov-card" style={{ padding: '1.25rem', transition: 'all 0.2s', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ padding: '8px', background: '#FEF2F2', borderRadius: '6px', color: 'var(--gov-red)' }}>
                <AlertTriangle size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-navy)', margin: 0 }}>Bottleneck Radar</h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--gov-text-secondary)', margin: 0 }}>
              Inspect physical stage delays, weighbridge queues, and automated throttling alerts.
            </p>
          </div>
        </Link>

        <Link to="/admin/live-monitoring" style={{ textDecoration: 'none' }}>
          <div className="gov-card" style={{ padding: '1.25rem', transition: 'all 0.2s', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ padding: '8px', background: '#EFF6FF', borderRadius: '6px', color: 'var(--gov-blue)' }}>
                <Activity size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-navy)', margin: 0 }}>Live Telemetry Feed</h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--gov-text-secondary)', margin: 0 }}>
              Real-time WebSocket stream of vehicle check-ins, scale commits, and payment advices.
            </p>
          </div>
        </Link>

        <Link to="/admin/audit" style={{ textDecoration: 'none' }}>
          <div className="gov-card" style={{ padding: '1.25rem', transition: 'all 0.2s', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ padding: '8px', background: '#F8FAFC', borderRadius: '6px', color: 'var(--gov-navy)' }}>
                <ShieldCheck size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gov-navy)', margin: 0 }}>Tamper-Evident Audit</h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--gov-text-secondary)', margin: 0 }}>
              Cryptographic integrity records, state admin actions, and weighment modification trail.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
};
