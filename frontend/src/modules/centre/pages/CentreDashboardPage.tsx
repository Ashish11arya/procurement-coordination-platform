import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { realtime } from '../../../realtime/socket';
import { CentreDashboardData, Counter } from '../../../types';
import {
  Building2,
  Sliders,
  Layers,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export const CentreDashboardPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<CentreDashboardData | null>(null);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoActionRunning, setDemoActionRunning] = useState(false);

  const fetchCentreData = async () => {
    try {
      setLoading(true);
      const [dashRes, rosterRes] = await Promise.all([
        api.getCentreDashboard('CENTRE-MP-IND-01'),
        api.getLiveDemoRoster(),
      ]);
      if (dashRes) setDashboard(dashRes);
      if (rosterRes && rosterRes.success) {
        setCounters(rosterRes.counters || []);
        setRoster(rosterRes.roster || []);
      }
    } catch (err: any) {
      console.warn('Failed to load centre dashboard:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCentreData();

    // Listen to real-time events to update dashboard automatically
    const unsubEvent = realtime.on('CENTRE_CAPACITY_CHANGED', () => fetchCentreData());
    const unsubRoster = realtime.on('SCHEDULING_UPDATED', () => fetchCentreData());
    const unsubWeigh = realtime.on('WEIGHMENT_COMPLETED', () => fetchCentreData());
    const unsubQuality = realtime.on('QUALITY_COMPLETED', () => fetchCentreData());
    const unsubProc = realtime.on('PROCUREMENT_COMPLETED', () => fetchCentreData());

    return () => {
      unsubEvent();
      unsubRoster();
      unsubWeigh();
      unsubQuality();
      unsubProc();
    };
  }, []);

  // Demo step actions
  const runDemoStep = async (step: string | number) => {
    setDemoActionRunning(true);
    try {
      const res = await api.executeDemoStep(step);
      alert(`Step ${step} executed successfully: ${res.message || 'Updated'}`);
      await fetchCentreData();
    } catch (err: any) {
      alert(`Step ${step} failed: ${err.message}`);
    } finally {
      setDemoActionRunning(false);
    }
  };

  const handleResetDemo = async () => {
    setDemoActionRunning(true);
    try {
      const res = await api.resetAndSeedDemo();
      alert(`Mandi Reset & Seeded: ${res.message} (${res.bookingsCount} demo bookings created in MongoDB)`);
      await fetchCentreData();
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setDemoActionRunning(false);
    }
  };

  const handleRunFullScenario = async () => {
    setDemoActionRunning(true);
    try {
      const res = await api.runFullDemoScenario();
      alert(`Full Section 42 Demo Scenario Completed! Executed ${res.steps?.length} sequential events.`);
      await fetchCentreData();
    } catch (err: any) {
      alert(`Scenario failed: ${err.message}`);
    } finally {
      setDemoActionRunning(false);
    }
  };

  const handleToggleCounter = async (counterId: string) => {
    try {
      const res = await api.triggerCounterBreakdown('CENTRE-MP-IND-01', counterId, '2026-04-15');
      alert(`Counter status updated: ${res.message}`);
      await fetchCentreData();
    } catch (err: any) {
      alert(`Failed to update counter: ${err.message}`);
    }
  };

  const bookedPct = dashboard?.capacityUtilizationPercentage || 0;
  const hasBottleneck = dashboard?.bottlenecks?.hasBottleneck || false;

  return (
    <div className="main-container">
      {/* Centre Header */}
      <div className="card" style={{ borderLeft: '5px solid var(--gov-navy)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-primary">CENTRE-MP-IND-01</span>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--gov-navy)', margin: '4px 0' }}>
              Sanwer Krishi Upaj Mandi (सांवेर कृषि उपज मंडी)
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Khandwa-Ujjain Highway, Sanwer, Indore District, Madhya Pradesh
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className={`status-pill ${hasBottleneck ? 'status-maintenance' : 'status-active'}`}>
              {hasBottleneck ? '⚠️ Bottleneck Alert' : 'Operational (Optimal Flow)'}
            </span>
            <button onClick={fetchCentreData} className="btn btn-outline btn-xs">
              <RotateCcw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Bottleneck Warning Banner */}
      {hasBottleneck && (
        <div className="alert-banner alert-warning">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">
            <strong>BOTTLENECK DETECTED: Weighbridge Scale 2 Under Maintenance!</strong>
            <p>Weighing stage throughput derated from 55 Q/hr to 30 Q/hr. Dynamic adaptation has added +10m arrival buffers and logged audit records.</p>
          </div>
        </div>
      )}

      {/* Yard Telemetry Meters */}
      <div className="yard-meters-grid">
        <div className="meter-card">
          <div className="meter-header">
            <span>DAILY SANCTIONED CAPACITY</span>
            <strong>{bookedPct}% Booked</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill fill-blue" style={{ width: `${Math.min(bookedPct, 100)}%` }}></div>
          </div>
          <div className="meter-footer">
            <span>Booked: <strong>{dashboard?.bookedQuantityQuintals || 0} Q</strong></span>
            <span>Capacity: <strong>{dashboard?.sanctionedDailyCapacityQuintals || 500} Q</strong></span>
            <span>Remaining: <strong className="text-success">{dashboard?.remainingCapacityQuintals || 500} Q</strong></span>
          </div>
        </div>

        <div className="meter-card">
          <div className="meter-header">
            <span>YARD VEHICLE INTAKE CAPACITY</span>
            <strong>{dashboard?.queueSummary?.waiting || 2} / 8 Vehicles</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill fill-amber" style={{ width: `${Math.min(((dashboard?.queueSummary?.waiting || 2) / 8) * 100, 100)}%` }}></div>
          </div>
          <div className="meter-footer">
            <span>Yard Safety Cap: <strong>8 Vehicles</strong></span>
            <span>Status: <strong>Yard Active</strong></span>
          </div>
        </div>

        <div className="meter-card">
          <div className="meter-header">
            <span>PROCESSING THROUGHPUT RATE</span>
            <strong>{hasBottleneck ? '30 Q / hr' : '55 Q / hr'}</strong>
          </div>
          <div className="progress-track">
            <div className={`progress-fill ${hasBottleneck ? 'fill-amber' : 'fill-green'}`} style={{ width: hasBottleneck ? '55%' : '90%' }}></div>
          </div>
          <div className="meter-footer">
            <span>Bottleneck Stage: <strong>{dashboard?.bottlenecks?.bottleneckStage || 'NONE'}</strong></span>
            <span>Flow: <strong style={{ color: hasBottleneck ? 'var(--gov-amber)' : 'var(--gov-green)' }}>{hasBottleneck ? 'Throttled' : 'Optimal'}</strong></span>
          </div>
        </div>
      </div>

      {/* Section 42 Real Backend Demonstration Controller */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#FFFFFF', border: '1px solid #334155' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="var(--gov-saffron)" />
            <span>Section 42 Real Backend Engine Demo Controller</span>
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '2px' }}>
            Executes real REST API calls against the live NestJS backend and writes to MongoDB. Events broadcast over WebSockets directly to connected clients.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleResetDemo} disabled={demoActionRunning} className="btn btn-outline btn-xs" style={{ color: '#FFFFFF', borderColor: '#475569' }}>
            ↺ Reset & Seed Mandi
          </button>
          <button onClick={() => runDemoStep(1)} disabled={demoActionRunning} className="btn btn-primary btn-xs">
            Step 1: Check-in F1
          </button>
          <button onClick={() => runDemoStep(2)} disabled={demoActionRunning} className="btn btn-primary btn-xs">
            Step 2: F2 Late (+35m)
          </button>
          <button onClick={() => runDemoStep(3)} disabled={demoActionRunning} className="btn btn-primary btn-xs">
            Step 3: F3 Processed
          </button>
          <button onClick={() => runDemoStep(4)} disabled={demoActionRunning} className="btn btn-warning btn-xs" style={{ background: 'var(--gov-amber)', color: '#FFFFFF' }}>
            Step 4: F4 Cancel & Adapt
          </button>
          <button onClick={() => runDemoStep(5)} disabled={demoActionRunning} className="btn btn-primary btn-xs">
            Step 5: F5 No-Show
          </button>
          <button onClick={() => runDemoStep(6)} disabled={demoActionRunning} className="btn btn-danger btn-xs">
            Step 6: Counter 2 Breakdown
          </button>
          <button onClick={handleRunFullScenario} disabled={demoActionRunning} className="btn btn-success btn-xs">
            ⚡ Run Full Scenario End-to-End
          </button>
        </div>
      </div>

      {/* Operational Mandi Counters Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Operational Physical Counters (भौतिक कांटे व जांच पटल)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Multi-counter physical pipeline status and individual fault injection controls
            </p>
          </div>
          <span className="badge badge-info">
            {counters.filter((c) => c.status === 'ACTIVE').length} / {counters.length} Counters Operational
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Counter ID</th>
                <th>Counter Name</th>
                <th>Physical Stage</th>
                <th>Rated Capacity</th>
                <th>Queue Depth</th>
                <th>Current Status</th>
                <th>Operator Maintenance Action</th>
              </tr>
            </thead>
            <tbody>
              {counters.map((c) => (
                <tr key={c.counterId}>
                  <td><strong>{c.counterId}</strong></td>
                  <td>{c.name || `Counter ${c.counterNumber}`}</td>
                  <td><span className="badge badge-primary">{c.stage}</span></td>
                  <td>{c.capacityPerHourQuintals} Q/hr</td>
                  <td>{c.currentQueueLength || 0} Vehicles</td>
                  <td>
                    <span className={`status-pill ${c.status === 'ACTIVE' ? 'status-active' : 'status-maintenance'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleCounter(c.counterId)}
                      className={`btn btn-xs ${c.status === 'ACTIVE' ? 'btn-danger' : 'btn-primary'}`}
                    >
                      {c.status === 'ACTIVE' ? 'Mark Fault (खराबी)' : 'Restore Counter (बहाल करें)'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Yard Roster & Token Sequence Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Live Yard Roster & Token Sequence (Section 9 Queue)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Live tokens scheduled in MongoDB for today's procurement season
            </p>
          </div>
          <span className="badge badge-neutral">{roster.length} Scheduled Bookings</span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Farmer Name / ID</th>
                <th>Commodity & Quantity</th>
                <th>Arrival Window</th>
                <th>Yard Status</th>
                <th>Physical Stage</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.bookingId || r.token}>
                  <td><strong style={{ color: 'var(--gov-navy)', fontSize: '1rem' }}>{r.token}</strong></td>
                  <td><strong>{r.farmerName || r.farmerId}</strong></td>
                  <td>{r.qty}</td>
                  <td>{r.window}</td>
                  <td>
                    <span className={`status-pill ${r.status === 'COMPLETED' ? 'status-completed' : r.status === 'CANCELLED' ? 'status-maintenance' : 'status-active'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td><small style={{ color: 'var(--text-secondary)' }}>{r.stage || r.status}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
