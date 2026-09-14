import React from 'react';
import { Bell, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  return (
    <div className="main-container" style={{ maxWidth: '780px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2>SMS & Official System Notifications (सूचनाएं)</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Official SMS alerts and arrival window confirmations sent to your registered mobile
            </p>
          </div>
          <span className="badge badge-primary">Carrier Gateway Active</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '1rem' }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--gov-green)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <strong style={{ color: 'var(--gov-navy)', fontSize: '0.9rem' }}>Arrival Window Confirmed - Token T-001</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Today, 08:30 AM</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Dear Farmer Ramesh Verma, your procurement arrival window for Wheat (30.0 Q) at Sanwer Krishi Upaj Mandi is confirmed for Today between 10:00 AM - 11:00 AM. Please arrive at Gate 1.
            </p>
          </div>

          <div style={{ padding: '12px 16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--gov-saffron)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <strong style={{ color: 'var(--gov-navy)', fontSize: '0.9rem' }}>Weighment Verified - Scale 1</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Today, 10:15 AM</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Gross weighment recorded for vehicle MP-09-AB-1234. Please proceed towards Quality Assay Lab Counter 4 for sampling and moisture inspection.
            </p>
          </div>

          <div style={{ padding: '12px 16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--gov-blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <strong style={{ color: 'var(--gov-navy)', fontSize: '0.9rem' }}>Quality Assay Approved - Grade A</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Today, 10:28 AM</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Wheat lot tested compliant (11.4% moisture, &lt; 1% foreign matter). Final procurement receipt and DBT payment advice PA-MP-IND-2026-00412 dispatched to PFMS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
