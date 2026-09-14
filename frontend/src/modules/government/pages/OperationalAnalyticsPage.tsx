import React from 'react';
import { BarChart, TrendingUp, Clock, Users, Award, FileCheck, CheckCircle2 } from 'lucide-react';

export const OperationalAnalyticsPage: React.FC = () => {
  const cropAnalytics = [
    { crop: 'Wheat (PBW-550 / HD-2967)', msp: 2275, targetQ: 50000, procuredQ: 18450, avgMoisture: '11.4%', gradeAPercent: '98.2%' },
    { crop: 'Mustard (Sarson)', msp: 5650, targetQ: 15000, procuredQ: 6200, avgMoisture: '7.8%', gradeAPercent: '96.5%' },
    { crop: 'Gram (Chana)', msp: 5440, targetQ: 8000, procuredQ: 3100, avgMoisture: '9.2%', gradeAPercent: '97.0%' },
    { crop: 'Barley (Jau)', msp: 1850, targetQ: 6000, procuredQ: 2100, avgMoisture: '10.5%', gradeAPercent: '99.1%' },
  ];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">GOVERNMENT COMMAND CENTRE</span>
            <span className="gov-badge gov-badge-active">SEASONAL ANALYTICS</span>
          </div>
          <h1 className="portal-title">Procurement Intelligence & Performance Analytics</h1>
          <p className="portal-subtitle">Turnaround Velocity, Commodity Purity Ratios & Season Intake Trajectories</p>
        </div>
      </div>

      {/* Analytics Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="gov-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
            Average Turnaround Time
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--gov-navy)', marginTop: '4px' }}>
            28.4 <span style={{ fontSize: '1rem', fontWeight: 600 }}>mins</span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--gov-green)', marginTop: '4px' }}>
            ✓ 16 mins faster than 2025 baseline
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
            Slot Arrival Adherence
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--gov-navy)', marginTop: '4px' }}>
            94.2%
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--gov-text-secondary)', marginTop: '4px' }}>
            Arrived within allocated window
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
            Farmer No-Show Rate
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--gov-navy)', marginTop: '4px' }}>
            3.1%
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--gov-green)', marginTop: '4px' }}>
            Down from 18.5% unreserved baseline
          </div>
        </div>

        <div className="gov-card" style={{ padding: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>
            DBT Advice Dispatch SLA
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--gov-green)', marginTop: '4px' }}>
            100%
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--gov-green)', marginTop: '4px' }}>
            Direct payment mandate triggered &lt; 2 hrs
          </div>
        </div>
      </div>

      {/* Commodity Progress Table */}
      <div className="gov-card">
        <div className="gov-card-header">
          <div>
            <h2 className="gov-card-title">Commodity Intake & Quality Metrics (RMS 2026-27)</h2>
            <p className="gov-card-subtitle">Verified weight intake and assay lab grade allocations</p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="gov-table">
            <thead>
              <tr>
                <th>COMMODITY</th>
                <th>GAZETTED MSP (₹/Q)</th>
                <th>SEASON TARGET (Q)</th>
                <th>PROCURED TO DATE (Q)</th>
                <th>AVG MOISTURE</th>
                <th>GRADE A COMPLIANCE</th>
              </tr>
            </thead>
            <tbody>
              {cropAnalytics.map(c => {
                const pct = Math.round((c.procuredQ / c.targetQ) * 100);
                return (
                  <tr key={c.crop}>
                    <td>
                      <strong style={{ color: 'var(--gov-navy)' }}>{c.crop}</strong>
                    </td>
                    <td>
                      <strong>₹{c.msp.toLocaleString()}</strong>
                    </td>
                    <td>{c.targetQ.toLocaleString()} Q</td>
                    <td>
                      <div><strong>{c.procuredQ.toLocaleString()} Q</strong> ({pct}%)</div>
                      <div style={{ height: '4px', width: '100px', background: '#E2E8F0', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gov-green)' }} />
                      </div>
                    </td>
                    <td>{c.avgMoisture}</td>
                    <td>
                      <span className="gov-badge gov-badge-active">{c.gradeAPercent}</span>
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
