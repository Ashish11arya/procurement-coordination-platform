import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { socketService } from '../../../realtime/socket';
import { Play, RotateCcw, CheckCircle, AlertTriangle, FastForward, Activity, ChevronRight, Scale, Truck, FlaskConical, CreditCard, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DemoRunnerPage: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [rosterData, setRosterData] = useState<any | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    {
      id: '1',
      code: 'F1',
      title: 'Farmer Booking & Token Generation',
      desc: 'Generates 50Q Wheat booking for Farmer 1 with dynamic arrival window',
      icon: <Truck size={18} />,
    },
    {
      id: '2',
      code: 'F2',
      title: 'Gate Check-in & Yard Entry',
      desc: 'Verifies vehicle arrival, scans barcode, and admits into yard',
      icon: <CheckCircle size={18} />,
    },
    {
      id: '3',
      code: 'F3',
      title: 'Electronic Weighbridge Capture',
      desc: 'Records 74.50Q gross, 24.50Q tare, net 50.00Q on scale WB-01',
      icon: <Scale size={18} />,
    },
    {
      id: '4',
      code: 'F4',
      title: 'Quality Lab Assay & MSP Payment',
      desc: 'Assigns Grade A (11.5% moisture) and triggers ₹1,13,750 DBT advice',
      icon: <CreditCard size={18} />,
    },
    {
      id: '5',
      code: 'F5',
      title: 'Hardware Breakdown & Rescheduling',
      desc: 'Simulates WB-01 failure, dynamically re-routing waiting vehicles to WB-02',
      icon: <Wrench size={18} />,
    },
  ];

  const fetchRoster = async () => {
    try {
      const res = await api.getLiveDemoRoster();
      setRosterData(res);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRoster();
    const unsub = socketService.onQueueUpdated(() => {
      fetchRoster();
    });
    return () => unsub();
  }, []);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const handleResetAndSeed = async () => {
    setIsRunning(true);
    setError(null);
    try {
      addLog('Calling POST /api/v1/demo/reset-and-seed...');
      const res = await api.resetAndSeedDemo();
      addLog(`Reset complete: ${res.message || 'Mandi Karnal seeded with baseline counters & farmers'}`);
      await fetchRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to reset demo');
      addLog(`ERROR: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunStep = async (stepNumber: string) => {
    setIsRunning(true);
    setActiveStep(stepNumber);
    setError(null);
    try {
      addLog(`Executing Step F${stepNumber}...`);
      const res = await api.executeDemoStep(stepNumber);
      addLog(`Step F${stepNumber} SUCCESS: ${res.message || 'Stage executed successfully'}`);
      await fetchRoster();
    } catch (err: any) {
      setError(err.message || `Failed to execute Step ${stepNumber}`);
      addLog(`ERROR: ${err.message}`);
    } finally {
      setIsRunning(false);
      setActiveStep(null);
    }
  };

  const handleRunFullScenario = async () => {
    setIsRunning(true);
    setError(null);
    try {
      addLog('Initiating full autonomous Section 42 workflow (F1 -> F5)...');
      const res = await api.runFullDemoScenario();
      addLog(`Full scenario complete: ${res.message || 'All stages executed with zero errors'}`);
      await fetchRoster();
    } catch (err: any) {
      setError(err.message || 'Failed to run scenario');
      addLog(`ERROR: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const roster = rosterData?.roster || [];
  const counters = rosterData?.counters || [];

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">SPECIFICATION SECTION 42</span>
            <span className="gov-badge gov-badge-active">INTERACTIVE DEMONSTRATOR</span>
          </div>
          <h1 className="portal-title">Procurement Demonstration Runner</h1>
          <p className="portal-subtitle">Execute Real End-to-End API Calls & Observe Live WebSocket State Transitions</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="gov-btn gov-btn-secondary"
            onClick={handleResetAndSeed}
            disabled={isRunning}
          >
            <RotateCcw size={16} />
            Reset & Seed Database
          </button>
          <button
            className="gov-btn gov-btn-primary"
            onClick={handleRunFullScenario}
            disabled={isRunning}
          >
            <FastForward size={16} />
            Run Full Scenario (F1–F5)
          </button>
        </div>
      </div>

      {error && (
        <div className="gov-alert gov-alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Step Buttons Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {steps.map(step => (
          <div
            key={step.id}
            className="gov-card"
            style={{
              padding: '1.25rem',
              border: activeStep === step.id ? '2px solid var(--gov-navy)' : '1px solid var(--gov-border)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="gov-badge gov-badge-gov" style={{ fontWeight: 800 }}>{step.code}</span>
                <div style={{ color: 'var(--gov-navy)' }}>{step.icon}</div>
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--gov-navy)', margin: '0 0 4px 0' }}>
                {step.title}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--gov-text-secondary)', margin: '0 0 1rem 0' }}>
                {step.desc}
              </p>
            </div>

            <button
              className="gov-btn gov-btn-secondary"
              style={{ width: '100%', fontSize: '0.8125rem', padding: '6px' }}
              onClick={() => handleRunStep(step.id)}
              disabled={isRunning}
            >
              <Play size={14} /> Run {step.code}
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Live Yard Roster Table */}
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <h2 className="gov-card-title">Live Mandi Yard Roster ({roster.length} Vehicles)</h2>
              <p className="gov-card-subtitle">Karnal Central Mandi (c-karnal-01) real database records</p>
            </div>
            <span className="gov-badge gov-badge-active">STREAMING REALTIME</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="gov-table">
              <thead>
                <tr>
                  <th>TOKEN</th>
                  <th>VEHICLE</th>
                  <th>COMMODITY & QTY</th>
                  <th>QUEUE STATUS</th>
                  <th>ASSIGNED COUNTER</th>
                </tr>
              </thead>
              <tbody>
                {roster.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--gov-text-muted)' }}>
                      Yard empty. Click "Reset & Seed Database" or run Step F1.
                    </td>
                  </tr>
                ) : (
                  roster.map((b: any) => (
                    <tr key={b.bookingId}>
                      <td>
                        <strong style={{ color: 'var(--gov-navy)' }}>{b.tokenNumber}</strong>
                      </td>
                      <td>
                        <div><strong>{b.vehicleNumber}</strong></div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>{b.vehicleType}</div>
                      </td>
                      <td>
                        <div><strong>{b.commodity}</strong></div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-secondary)' }}>{b.allocatedQuantityQuintals} Q</div>
                      </td>
                      <td>
                        <span className={`gov-badge ${
                          b.queueStatus === 'COMPLETED' ? 'gov-badge-active' :
                          b.queueStatus === 'WEIGHING_IN_PROGRESS' || b.queueStatus === 'QUALITY_CHECK' ? 'gov-badge-warning' :
                          'gov-badge-gov'
                        }`}>
                          {b.queueStatus}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                          {b.assignedCounterId || 'GATE-01'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Execution Logs Console */}
        <div className="gov-card">
          <div className="gov-card-header">
            <h2 className="gov-card-title">Execution Console</h2>
            <Activity size={18} color="var(--gov-green)" />
          </div>

          <div
            style={{
              padding: '1rem',
              background: '#0F172A',
              color: '#86EFAC',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              height: '420px',
              overflowY: 'auto',
              borderRadius: '0 0 8px 8px',
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: '#64748B' }}>Ready. Trigger steps to inspect API responses and telemetry...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ marginBottom: '4px', lineHeight: '1.4' }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
