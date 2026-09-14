import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { Booking } from '../../../types';
import { CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';

export const PaymentStatusPage: React.FC = () => {
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    api.getFarmerBookings().then((res) => {
      if (res && res.bookings && res.bookings.length > 0) {
        setBooking(res.bookings[0]);
      }
    });
  }, []);

  const rate = 2275;
  const qty = booking?.quantityQuintals || 30;
  const totalAmount = (qty * rate).toLocaleString('en-IN');

  return (
    <div className="main-container" style={{ maxWidth: '800px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Direct Benefit Transfer (DBT) Payment Status</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Integrated with Public Financial Management System (PFMS) and State Civil Supplies Corporation
            </p>
          </div>
          <span className="badge badge-success">Aadhaar Seeded</span>
        </div>

        <div className="telemetry-grid">
          <div className="telemetry-card">
            <div className="telemetry-icon">🌾</div>
            <div className="telemetry-content">
              <span className="telemetry-label">Procured Commodity</span>
              <span className="telemetry-value">Wheat (गेहूं)</span>
              <span className="telemetry-sub">MSP Rate: ₹2,275 / Quintal</span>
            </div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-icon">💰</div>
            <div className="telemetry-content">
              <span className="telemetry-label">Total Payment Advice</span>
              <span className="telemetry-value">₹{totalAmount}</span>
              <span className="telemetry-sub">{qty} Quintals × ₹{rate}</span>
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginTop: '1rem' }}>
          <h4 style={{ color: 'var(--gov-navy)', marginBottom: '12px', fontSize: '0.95rem' }}>Disbursement Tracking</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Payment Advice Number:</span>
              <div style={{ fontWeight: 600 }}>PA-MP-IND-2026-00412</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Bank Account (Masked):</span>
              <div style={{ fontWeight: 600 }}>State Bank of India (••• 9102)</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>IFSC Code:</span>
              <div style={{ fontWeight: 600 }}>SBIN0001234 (Sanwer Branch)</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Payment Status:</span>
              <div>
                <span className="status-pill status-completed">Advice Dispatched</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
