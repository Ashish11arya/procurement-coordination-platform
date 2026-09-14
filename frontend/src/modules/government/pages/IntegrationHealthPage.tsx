import React, { useState } from 'react';
import { Server, CheckCircle2, RefreshCw, Activity, ArrowUpRight, Zap, ShieldCheck } from 'lucide-react';

interface GatewayStatus {
  id: string;
  name: string;
  protocol: string;
  endpoint: string;
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  uptimePercent: number;
  latencyMs: number;
  lastSync: string;
  recordsSyncedToday: number;
}

export const IntegrationHealthPage: React.FC = () => {
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [gateways, setGateways] = useState<GatewayStatus[]>([
    {
      id: 'CFPP',
      name: 'Central Foodgrain Procurement Portal (CFPP - FCI)',
      protocol: 'HTTPS / REST mTLS',
      endpoint: 'https://cfpp.gov.in/api/v2/procurement/ingest',
      status: 'HEALTHY',
      uptimePercent: 99.98,
      latencyMs: 142,
      lastSync: 'Just now',
      recordsSyncedToday: 1420,
    },
    {
      id: 'ESAMRIDHI',
      name: 'e-Samridhi (NAFED Co-operative Registry)',
      protocol: 'gRPC / TLS 1.3',
      endpoint: 'grpc.esamridhi.gov.in:443',
      status: 'HEALTHY',
      uptimePercent: 99.95,
      latencyMs: 189,
      lastSync: '2 mins ago',
      recordsSyncedToday: 890,
    },
    {
      id: 'PFMS',
      name: 'Public Financial Management System (PFMS DBT Gateway)',
      protocol: 'ISO 20022 XML / SFTP',
      endpoint: 'sftp.pfms.nic.in:22/dbt/advice',
      status: 'HEALTHY',
      uptimePercent: 99.99,
      latencyMs: 88,
      lastSync: 'Just now',
      recordsSyncedToday: 420,
    },
    {
      id: 'MFMB',
      name: 'Meri Fasal Mera Byora (State Land Records & Sowing API)',
      protocol: 'REST / HMAC-SHA256',
      endpoint: 'https://fasal.haryana.gov.in/api/v1/farmer/verify',
      status: 'HEALTHY',
      uptimePercent: 99.91,
      latencyMs: 215,
      lastSync: '4 mins ago',
      recordsSyncedToday: 312,
    },
  ]);

  const handleTestGateways = async () => {
    setIsTesting(true);
    setTimeout(() => {
      setGateways(prev => prev.map(g => ({
        ...g,
        latencyMs: Math.floor(Math.random() * 60) + 70,
        lastSync: 'Just now',
      })));
      setIsTesting(false);
    }, 1000);
  };

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">GOVERNMENT COMMAND CENTRE</span>
            <span className="gov-badge gov-badge-active">INTEROPERABILITY GATEWAYS</span>
          </div>
          <h1 className="portal-title">Interoperability & Central Integration Health</h1>
          <p className="portal-subtitle">Status of Central Foodgrain Portal (CFPP), e-Samridhi, PFMS DBT & Land Records</p>
        </div>
        <button className="gov-btn gov-btn-secondary" onClick={handleTestGateways} disabled={isTesting}>
          <RefreshCw size={16} />
          {isTesting ? 'Pinging Gateway Mesh...' : 'Ping Interoperability Mesh'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
        {gateways.map(g => (
          <div key={g.id} className="gov-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Server size={18} color="var(--gov-navy)" />
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gov-navy)', margin: 0 }}>{g.name}</h2>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>
                  {g.protocol} • {g.endpoint}
                </div>
              </div>
              <span className="gov-badge gov-badge-active">{g.status}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1rem 0', borderTop: '1px solid var(--gov-border)', borderBottom: '1px solid var(--gov-border)', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>AVAILABILITY</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gov-green)' }}>{g.uptimePercent}%</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>ROUNDTRIP LATENCY</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gov-navy)' }}>{g.latencyMs} ms</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>SYNCED RECORDS</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--gov-navy)' }}>{g.recordsSyncedToday.toLocaleString()}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--gov-text-secondary)' }}>
              <div>Last Handshake: <strong>{g.lastSync}</strong></div>
              <div style={{ color: 'var(--gov-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} /> Mutual TLS 1.3 Certified
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
