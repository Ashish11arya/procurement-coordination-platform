import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';
import { api } from '../../../services/api.service';
import {
  ShieldCheck,
  Download,
  Trash2,
  Lock,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export const FarmerProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [exportLoading, setExportLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [erasureModalOpen, setErasureModalOpen] = useState(false);
  const [erasureReason, setErasureReason] = useState('Farmer requested self-erasure under DPDP Section 12');
  const [erasureLoading, setErasureLoading] = useState(false);
  const [erasureError, setErasureError] = useState<string | null>(null);

  const handleExportData = async () => {
    setExportLoading(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      const response = await api.exportFarmerData();
      const exportData = response.data || response;

      // Trigger automatic browser file download
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(exportData, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `DPDP_Data_Dump_${exportData.exportMetadata?.dataSubjectId || 'FARMER'}_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setExportSuccess(
        `Data dump generated successfully! Integrity Hash: ${exportData.integrity?.sha256Checksum?.slice(0, 16)}... (${exportData.exportMetadata?.recordCounts?.procurementBookings || 0} procurement records exported)`
      );
    } catch (err: any) {
      setExportError(err.message || 'Failed to export personal data dump.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleConfirmErasure = async () => {
    setErasureLoading(true);
    setErasureError(null);

    try {
      const res = await api.deleteFarmerAccount(erasureReason);
      setErasureModalOpen(false);
      alert(
        `Account Anonymized Successfully!\n\nStatutory Notice:\n${res.statutoryRetentionNotice || 'Personal PII was anonymized. Procurement financial records are held under 7-year statutory hold per GFR 2017 Rule 290.'}`
      );
      logout();
      navigate('/login');
    } catch (err: any) {
      setErasureError(err.message || 'Failed to process account erasure request.');
      setErasureLoading(false);
    }
  };

  return (
    <div className="main-container" style={{ maxWidth: '820px', paddingBottom: '3rem' }}>
      {/* Profile Overview Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div>
            <h2>Verified Farmer Profile (किसान विवरण)</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Official details fetched from State Land Records and Government Farmer Registry
            </p>
          </div>
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} /> Aadhaar / Registry Verified
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1rem' }}>
          <div className="form-group">
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>Registered Name</span>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--gov-navy)' }}>{user?.name}</div>
          </div>
          <div className="form-group">
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>Mobile Number</span>
            <div style={{ fontWeight: 600 }}>{user?.mobile}</div>
          </div>
          <div className="form-group">
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>Farmer Registration Number</span>
            <div style={{ fontWeight: 600 }}>{user?.registrationNumber || 'REG-2026-MP-00192'}</div>
          </div>
          <div className="form-group">
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>Cultivated Landholding</span>
            <div style={{ fontWeight: 600 }}>{user?.landAreaAcres || 5.5} Acres</div>
          </div>
          <div className="form-group">
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>State & District</span>
            <div style={{ fontWeight: 600 }}>{user?.state || 'Madhya Pradesh'}, {user?.district || 'Indore'}</div>
          </div>
          <div className="form-group">
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>Tehsil & Village</span>
            <div style={{ fontWeight: 600 }}>{user?.subDistrict || 'Sanwer'}, {user?.village || 'Dharampuri'}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)', marginTop: '1rem' }}>
          <h4 style={{ color: 'var(--gov-navy)', fontSize: '0.9rem', marginBottom: '6px' }}>
            Direct Benefit Transfer (DBT) Bank Account
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            ✓ Account verified with National Payments Corporation of India (NPCI) Aadhaar-bridge for direct credit of Minimum Support Price (MSP) disbursements.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DPDP Act 2023 Data Privacy & Subject Rights Card                           */}
      {/* ========================================================================= */}
      <div className="card" style={{ border: '1px solid #cbd5e1', boxShadow: 'var(--shadow-md)' }}>
        <div className="card-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Lock size={18} color="var(--gov-navy)" />
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--gov-navy)' }}>
                Data Privacy & DPDP Act 2023 Statutory Rights
              </h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: 0 }}>
              Under India's Digital Personal Data Protection Act 2023 (Act No. 22 of 2023), you hold guaranteed rights to your personal data.
            </p>
          </div>
          <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <FileCheck size={13} /> Active Consent (Sec 6)
          </span>
        </div>

        {/* Notifications */}
        {exportSuccess && (
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #10b981',
              borderRadius: '6px',
              padding: '10px 14px',
              marginTop: '1rem',
              color: '#065f46',
              fontSize: '0.85rem',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <CheckCircle size={16} />
            <span>{exportSuccess}</span>
          </div>
        )}

        {exportError && (
          <div
            style={{
              background: 'var(--gov-red-light)',
              border: '1px solid var(--gov-red)',
              borderRadius: '6px',
              padding: '10px 14px',
              marginTop: '1rem',
              color: '#991b1b',
              fontSize: '0.85rem',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <AlertTriangle size={16} />
            <span>{exportError}</span>
          </div>
        )}

        {/* Interactive Rights Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.25rem' }}>
          {/* Action 1: Export Data Dump */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Download size={18} color="var(--gov-navy)" />
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--gov-navy)' }}>
                  Data Portability & Full Dump
                </h4>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Export an authoritative, portable JSON file containing your identity details, consent trail, booking history, and access audit logs with cryptographic SHA-256 verification (Section 11).
              </p>
            </div>
            <button
              onClick={handleExportData}
              disabled={exportLoading}
              className="btn btn-outline"
              style={{
                marginTop: '12px',
                width: '100%',
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
              }}
            >
              <Download size={14} />
              {exportLoading ? 'Compiling Portable Dump...' : 'Download My Data (JSON)'}
            </button>
          </div>

          {/* Action 2: Right to Erasure */}
          <div
            style={{
              border: '1px solid #fee2e2',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              background: '#fffafb',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Trash2 size={18} color="#b91c1c" />
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#991b1b' }}>
                  Right to Erasure (Sec 12)
                </h4>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                Request permanent erasure and pseudonymization of personal identifiers. Historical financial disbursement logs remain protected under mandatory 7-year GFR Rule 290 legal holds.
              </p>
            </div>
            <button
              onClick={() => setErasureModalOpen(true)}
              className="btn btn-outline"
              style={{
                marginTop: '12px',
                width: '100%',
                borderColor: '#fca5a5',
                color: '#b91c1c',
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
              }}
            >
              <Trash2 size={14} />
              Request Account Erasure
            </button>
          </div>
        </div>

        {/* DPDP Legal Transparency Footer */}
        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
          }}
        >
          <div>
            Data Protection Officer: <code>dpo-agriculture@gov.in</code> (Turnaround: 72 hrs)
          </div>
          <Link
            to="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--gov-navy)',
              textDecoration: 'underline',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            View Complete Privacy Policy & Retention Rules <ExternalLink size={12} />
          </Link>
        </div>
      </div>

      {/* Erasure Confirmation Modal */}
      {erasureModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '100%',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '2rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <AlertTriangle size={24} color="#dc2626" />
              <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.25rem' }}>
                Confirm Account Erasure Request
              </h3>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Under <strong>Section 12 of the DPDP Act 2023</strong>, exercising your right to erasure will:
            </p>
            <ul style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, paddingLeft: '1.25rem' }}>
              <li>Permanently pseudonymize and wipe your phone, name, and residential coordinates.</li>
              <li>Revoke all active authentication sessions and consent records.</li>
              <li>Cancel any scheduled future procurement bookings.</li>
            </ul>

            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '6px',
                padding: '10px 12px',
                fontSize: '0.82rem',
                color: '#78350f',
                marginBottom: '1rem',
              }}
            >
              <strong>Statutory Legal Retention Hold:</strong> Weighment receipts, MSP payment disbursal records, and CAG audit trails cannot be expunged for 7 years pursuant to Rule 290 of the General Financial Rules (GFR 2017).
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.85rem' }}>Reason for Erasure (Optional)</label>
              <input
                type="text"
                className="form-control"
                value={erasureReason}
                onChange={(e) => setErasureReason(e.target.value)}
              />
            </div>

            {erasureError && (
              <div
                style={{
                  background: 'var(--gov-red-light)',
                  border: '1px solid var(--gov-red)',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  color: '#991b1b',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                }}
              >
                {erasureError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setErasureModalOpen(false)}
                className="btn btn-outline"
                disabled={erasureLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmErasure}
                className="btn"
                style={{ background: '#dc2626', color: '#ffffff', border: 'none' }}
                disabled={erasureLoading}
              >
                {erasureLoading ? 'Processing Erasure...' : 'Confirm Permanent Erasure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
