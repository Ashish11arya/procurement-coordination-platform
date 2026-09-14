import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserCheck, AlertCircle, ArrowLeft } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { registerFarmer } = useAuth();
  const navigate = useNavigate();

  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState('Madhya Pradesh');
  const [district, setDistrict] = useState('Indore');
  const [subDistrict, setSubDistrict] = useState('Sanwer');
  const [village, setVillage] = useState('Dharampuri');
  const [landAreaAcres, setLandAreaAcres] = useState('5.5');
  const [consentToDataSharing, setConsentToDataSharing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!consentToDataSharing) {
      setError('Under the Digital Personal Data Protection (DPDP) Act 2023, explicit consent to data sharing with government procurement systems is mandatory to register.');
      return;
    }

    setLoading(true);
    try {
      await registerFarmer({
        mobile,
        name,
        state,
        district,
        subDistrict,
        village,
        landAreaAcres: parseFloat(landAreaAcres) || 0,
        consentToDataSharing: true,
        consentVersion: '1.0',
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-container" style={{ paddingTop: '2.5rem', maxWidth: '580px' }}>
      <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '8px' }}>
            <ArrowLeft size={14} /> Back to Sign-in
          </Link>
          <h2 style={{ fontSize: '1.35rem', color: 'var(--gov-navy)', marginBottom: '4px' }}>
            Farmer Self-Registration (किसान पंजीकरण)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Register to schedule arrival windows for grain procurement under Minimum Support Price (MSP)
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--gov-red-light)', border: '1px solid var(--gov-red)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '1.25rem', color: '#991B1B', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Mobile Number (मोबाइल नंबर)</label>
            <input
              type="tel"
              className="form-control"
              placeholder="10-digit mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Full Name as per Aadhaar / Land Records (किसान का पूरा नाम)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Ramesh Kumar Verma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>State (राज्य)</label>
              <input
                type="text"
                className="form-control"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>District (जिला)</label>
              <input
                type="text"
                className="form-control"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Tehsil / Block (तहसील)</label>
              <input
                type="text"
                className="form-control"
                value={subDistrict}
                onChange={(e) => setSubDistrict(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Village (ग्राम)</label>
              <input
                type="text"
                className="form-control"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Verified Cultivated Landholding in Acres (कृषि भूमि एकड़ में)</label>
            <input
              type="number"
              step="0.1"
              className="form-control"
              value={landAreaAcres}
              onChange={(e) => setLandAreaAcres(e.target.value)}
              required
            />
          </div>

          {/* Statutory DPDP Act 2023 Explicit Consent Field */}
          <div
            style={{
              margin: '1.25rem 0',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                fontSize: '0.84rem',
                fontWeight: 500,
                lineHeight: 1.45,
                color: 'var(--text-main)',
              }}
            >
              <input
                type="checkbox"
                checked={consentToDataSharing}
                onChange={(e) => setConsentToDataSharing(e.target.checked)}
                style={{
                  marginTop: '3px',
                  accentColor: 'var(--gov-green)',
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                }}
                required
              />
              <span>
                I hereby provide explicit, informed consent under the{' '}
                <strong>Digital Personal Data Protection (DPDP) Act, 2023 (Section 6)</strong> for my personal and agricultural data to be processed and shared with government coordination systems (FCI, State Civil Supplies, PFMS/DBT) solely for procurement scheduling, MSP payments, and statutory auditing.{' '}
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
                    gap: '2px',
                  }}
                >
                  Read Statutory Privacy Policy & DPDP Data Rights ↗
                </Link>
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading || !consentToDataSharing}
          >
            {loading ? 'Submitting Registration...' : 'Complete Registration & Open Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};
