import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../../../services/api.service';
import { Tractor, Building2, KeyRound, Phone, UserCheck, AlertCircle } from 'lucide-react';
import { Role } from '../../../types';

export const LoginPage: React.FC = () => {
  const { loginFarmer, loginOperator } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<'farmer' | 'operator'>('farmer');

  // Farmer OTP state
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [mockOtpHint, setMockOtpHint] = useState<string | null>(null);

  // Operator state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  // Status & Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectAfterLogin = (userRole: Role) => {
    const from = (location.state as any)?.from?.pathname;
    if (from && from !== '/login') {
      navigate(from, { replace: true });
      return;
    }

    if (userRole === Role.FARMER) {
      navigate('/dashboard', { replace: true });
    } else if (
      [
        Role.CENTRE_ADMIN,
        Role.CHECKIN_OPERATOR,
        Role.WEIGHING_OPERATOR,
        Role.QUALITY_OPERATOR,
        Role.PROCUREMENT_OPERATOR,
      ].includes(userRole)
    ) {
      navigate('/centre/dashboard', { replace: true });
    } else {
      navigate('/admin/dashboard', { replace: true });
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.requestFarmerOtp(mobile);
      setOtpSent(true);
      if (res.mockOtp) {
        setMockOtpHint(res.mockOtp);
        setOtp(res.mockOtp);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await loginFarmer(mobile, otp);
      redirectAfterLogin(user.role);
    } catch (err: any) {
      setError(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOperatorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await loginOperator(identifier, password, mfaCode || undefined);
      redirectAfterLogin(user.role);
    } catch (err: any) {
      setError(err.message || 'Operator login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoFarmer = () => {
    setMobile('9876543210');
    setError(null);
  };

  const fillDemoOperator = () => {
    setIdentifier('operator');
    setPassword('Operator@123');
    setError(null);
  };

  const fillDemoAdmin = () => {
    setIdentifier('admin');
    setPassword('Admin@123');
    setError(null);
  };

  return (
    <div className="main-container" style={{ paddingTop: '2.5rem', maxWidth: '520px' }}>
      <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', color: 'var(--gov-navy)', marginBottom: '4px' }}>
            National Procurement Portal Sign-in
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Official Access for Farmers, Mandi Staff & Government Administrators
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1.5rem' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'farmer' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => { setActiveTab('farmer'); setError(null); }}
          >
            <Tractor size={16} />
            Farmer (किसान)
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'operator' ? 'btn-navy' : 'btn-outline'}`}
            onClick={() => { setActiveTab('operator'); setError(null); }}
          >
            <Building2 size={16} />
            Staff / Admin (कर्मचारी)
          </button>
        </div>

        {error && (
          <div style={{ background: 'var(--gov-red-light)', border: '1px solid var(--gov-red)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '1.25rem', color: '#991B1B', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Farmer Tab */}
        {activeTab === 'farmer' && (
          <div>
            {!otpSent ? (
              <form onSubmit={handleRequestOtp}>
                <div className="form-group">
                  <label>Mobile Number (पंजीकृत मोबाइल नंबर)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="e.g. 9876543210"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      required
                    />
                  </div>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Must match mobile number linked in Farmer Registry / e-Samridhi
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
                  <button type="button" className="btn btn-outline btn-xs" onClick={fillDemoFarmer}>
                    ⚡ Use Demo Farmer (9876543210)
                  </button>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Requesting OTP...' : 'Send OTP (ओटीपी प्राप्त करें)'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <div className="form-group">
                  <label>Enter 6-Digit Verification Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter OTP (e.g. 123456)"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                  {mockOtpHint && (
                    <small style={{ color: 'var(--gov-green)', fontSize: '0.8rem', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                      ✓ Generated SMS OTP: {mockOtpHint}
                    </small>
                  )}
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify & Enter Farmer Portal'}
                </button>
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button type="button" className="btn btn-outline btn-xs" onClick={() => setOtpSent(false)}>
                    Change Mobile Number
                  </button>
                </div>
              </form>
            )}

            <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>New farmer to the platform? </span>
              <a href="/register" style={{ fontSize: '0.85rem', color: 'var(--gov-saffron)', fontWeight: 600, textDecoration: 'none' }}>
                Register Here
              </a>
            </div>
          </div>
        )}

        {/* Operator / Government Tab */}
        {activeTab === 'operator' && (
          <form onSubmit={handleOperatorLogin}>
            <div className="form-group">
              <label>Staff Username or Official Email</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. operator or admin"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline btn-xs" onClick={fillDemoOperator}>
                ⚡ Demo Mandi Operator
              </button>
              <button type="button" className="btn btn-outline btn-xs" onClick={fillDemoAdmin}>
                ⚡ Demo Government Admin
              </button>
            </div>

            <button type="submit" className="btn btn-navy" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign in to Operational Terminal'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
