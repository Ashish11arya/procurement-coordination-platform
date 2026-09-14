import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { QrCode, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';

export const CheckInOperatorPage: React.FC = () => {
  const [bookingId, setBookingId] = useState('BK-DEMO-001');
  const [tokenNumber, setTokenNumber] = useState('T-001');
  const [vehicleNumber, setVehicleNumber] = useState('MP-09-AB-1234');
  const [notes, setNotes] = useState('Verified via Gate 1 Automated Boom Barrier');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await api.checkInVehicle({
        bookingId,
        tokenNumber,
        vehicleNumber,
        notes,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-container" style={{ maxWidth: '680px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Gate Check-In Operator Station (गेट प्रवेश पटल)</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Verify farmer arrival token and admit vehicle into Mandi yard holding bay
            </p>
          </div>
          <span className="badge badge-primary">Gate 1 Active</span>
        </div>

        {error && (
          <div style={{ background: 'var(--gov-red-light)', border: '1px solid var(--gov-red)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '1.25rem', color: '#991B1B', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div style={{ background: 'var(--gov-green-light)', border: '1px solid var(--gov-green)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '1.25rem', color: '#065F46' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '4px' }}>
              <CheckCircle2 size={18} color="var(--gov-green)" />
              <span>Gate Check-In Successful!</span>
            </div>
            <p style={{ fontSize: '0.82rem' }}>
              Token: <strong>{result.tokenNumber}</strong> | Queue State: <strong>{result.queueState}</strong> | {result.message}
            </p>
          </div>
        )}

        <form onSubmit={handleCheckIn}>
          <div className="form-group">
            <label>Booking ID (बुकिंग पहचान संख्या)</label>
            <input
              type="text"
              className="form-control"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Token Number (टोकन संख्या)</label>
              <input
                type="text"
                className="form-control"
                value={tokenNumber}
                onChange={(e) => setTokenNumber(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Vehicle Number (वाहन पंजीकरण)</label>
              <input
                type="text"
                className="form-control"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Operator Check-in Remarks</label>
            <input
              type="text"
              className="form-control"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            <QrCode size={16} />
            {loading ? 'Recording Gate Entry...' : 'Admit Vehicle to Yard (गेट प्रवेश दर्ज करें)'}
          </button>
        </form>
      </div>
    </div>
  );
};
