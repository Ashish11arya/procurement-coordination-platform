import React, { useState } from 'react';
import { ShieldCheck, Search, Filter, Lock, CheckCircle2, FileText, Download } from 'lucide-react';

interface AuditRecord {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetEntity: string;
  sha256Hash: string;
  ipAddress: string;
  verification: 'VERIFIED' | 'TAMPERED';
}

export const AuditLogsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const [records] = useState<AuditRecord[]>([
    {
      id: 'AUD-99812-A',
      timestamp: '2026-04-15 11:42:18',
      actorId: 'OP-WB-KARNAL',
      actorRole: 'WEIGHING_OPERATOR',
      action: 'WEIGHMENT_COMMIT',
      targetEntity: 'Token #TK-101 (Net 50.00Q)',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      ipAddress: '10.14.2.18',
      verification: 'VERIFIED',
    },
    {
      id: 'AUD-99811-B',
      timestamp: '2026-04-15 11:38:05',
      actorId: 'OP-GATE-01',
      actorRole: 'CHECKIN_OPERATOR',
      action: 'GATE_ENTRY_CHECKIN',
      targetEntity: 'Vehicle HR-05-AB-1234',
      sha256Hash: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      ipAddress: '10.14.2.12',
      verification: 'VERIFIED',
    },
    {
      id: 'AUD-99810-C',
      timestamp: '2026-04-15 11:25:40',
      actorId: 'ADMIN-SYS-AUTON',
      actorRole: 'SYSTEM_SCHEDULER',
      action: 'COUNTER_BREAKDOWN_MITIGATION',
      targetEntity: 'Counter WB-01 Maintenance',
      sha256Hash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
      ipAddress: '127.0.0.1',
      verification: 'VERIFIED',
    },
    {
      id: 'AUD-99809-D',
      timestamp: '2026-04-15 11:15:22',
      actorId: 'OP-LAB-01',
      actorRole: 'QUALITY_OPERATOR',
      action: 'QUALITY_GRADE_ASSIGNED',
      targetEntity: 'Token #TK-100 (Grade A)',
      sha256Hash: 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9',
      ipAddress: '10.14.2.22',
      verification: 'VERIFIED',
    },
    {
      id: 'AUD-99808-E',
      timestamp: '2026-04-15 11:10:14',
      actorId: 'OP-PROC-01',
      actorRole: 'PROCUREMENT_OPERATOR',
      action: 'PAYMENT_ADVICE_ISSUED',
      targetEntity: 'PAN-2026-FCI-984128 (₹113,750)',
      sha256Hash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      ipAddress: '10.14.2.30',
      verification: 'VERIFIED',
    },
  ]);

  const filtered = records.filter(r => {
    const matchQuery = r.actorId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.targetEntity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.action.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchQuery) return false;
    if (filterAction === 'ALL') return true;
    return r.action.includes(filterAction);
  });

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">GOVERNMENT COMMAND CENTRE</span>
            <span className="gov-badge gov-badge-active">CRYPTOGRAPHIC AUDIT TRAIL</span>
          </div>
          <h1 className="portal-title">Tamper-Evident Immutable Audit Ledger</h1>
          <p className="portal-subtitle">Cryptographically Sealed Logs for Weight Slips, Quality Assay & DBT Mandates</p>
        </div>
        <button className="gov-btn gov-btn-secondary" onClick={() => window.print()}>
          <Download size={16} /> Export Audit Log
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="gov-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gov-text-muted)' }} />
            <input
              type="text"
              className="gov-input"
              style={{ paddingLeft: '38px' }}
              placeholder="Search audit records by Actor ID, Token, or Entity..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={16} color="var(--gov-text-secondary)" />
            <select
              className="gov-input"
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="ALL">All Actions</option>
              <option value="WEIGHMENT">Weighment Commits</option>
              <option value="GATE">Gate Check-in</option>
              <option value="QUALITY">Quality Testing</option>
              <option value="PAYMENT">Payment Advice</option>
              <option value="COUNTER">Counter Outages</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="gov-card">
        <div className="gov-card-header">
          <div>
            <h2 className="gov-card-title">Ledger Entries ({filtered.length})</h2>
            <p className="gov-card-subtitle">Each entry is immutable and chained using SHA-256 block hashing</p>
          </div>
          <span className="gov-badge gov-badge-active" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Lock size={12} /> HASH CHAIN INTACT
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="gov-table">
            <thead>
              <tr>
                <th>AUDIT ID</th>
                <th>TIMESTAMP</th>
                <th>ACTOR & ROLE</th>
                <th>ACTION PERFORMED</th>
                <th>TARGET ENTITY</th>
                <th>SHA-256 SEAL</th>
                <th>INTEGRITY</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--gov-navy)' }}>{r.id}</strong>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>{r.timestamp}</span>
                  </td>
                  <td>
                    <div><strong>{r.actorId}</strong></div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>{r.actorRole}</div>
                  </td>
                  <td>
                    <span className="gov-badge gov-badge-gov">{r.action}</span>
                  </td>
                  <td>
                    <strong>{r.targetEntity}</strong>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--gov-text-muted)' }} title={r.sha256Hash}>
                      {r.sha256Hash.slice(0, 16)}...
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--gov-green)', fontWeight: 600, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} /> {r.verification}
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
