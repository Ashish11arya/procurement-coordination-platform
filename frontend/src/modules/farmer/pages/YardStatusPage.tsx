import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/api.service';
import { Booking, BookingStatus } from '../../../types';
import { Activity, CheckCircle2, Clock, CalendarPlus } from 'lucide-react';

export const YardStatusPage: React.FC = () => {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFarmerBookings()
      .then((res) => {
        if (res && res.bookings && res.bookings.length > 0) {
          const active = res.bookings.find((b) => b.status !== BookingStatus.CANCELLED && b.status !== BookingStatus.COMPLETED) || res.bookings[0];
          setBooking(active || null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const getStageIndex = (st?: BookingStatus) => {
    if (st === BookingStatus.CHECKED_IN) return 2;
    if (st === BookingStatus.IN_PROGRESS) return 3;
    if (st === BookingStatus.COMPLETED) return 4;
    return 1;
  };

  if (loading) {
    return <div className="main-container" style={{ padding: '3rem', textAlign: 'center' }}>Loading yard status...</div>;
  }

  if (!booking) {
    return (
      <div className="main-container" style={{ maxWidth: '840px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <Activity size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <h3 style={{ color: 'var(--gov-navy)', marginBottom: '8px' }}>No Active Vehicle Inside Yard</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            The 4-stage physical yard tracker activates when your grain arrival is admitted at the Mandi entry gate.
          </p>
          <Link to="/book" className="btn btn-primary">
            <CalendarPlus size={16} /> Schedule Arrival Window
          </Link>
        </div>
      </div>
    );
  }

  const stage = getStageIndex(booking?.status);

  return (
    <div className="main-container" style={{ maxWidth: '840px' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Physical Mandi Yard Progress Tracker</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Sequential 4-stage ground procurement workflow for Token #{booking.tokenNumber}
            </p>
          </div>
          <span className="badge badge-primary">Token: {booking.tokenNumber}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', padding: '1rem', background: stage >= 1 ? 'var(--gov-green-light)' : 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: stage >= 1 ? 'var(--gov-green)' : '#CBD5E1', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              1
            </div>
            <div>
              <strong style={{ color: 'var(--gov-navy)' }}>Stage 1: Mandi Gate Entry & Check-In</strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0' }}>
                Arrival verification, vehicle number validation, barcode scan at entry gate.
              </p>
              <span className="badge badge-success">Status: {stage >= 1 ? 'Verified' : 'Pending Arrival'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', padding: '1rem', background: stage >= 2 ? 'var(--gov-green-light)' : 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: stage >= 2 ? 'var(--gov-green)' : '#CBD5E1', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              2
            </div>
            <div>
              <strong style={{ color: 'var(--gov-navy)' }}>Stage 2: Electronic Weighbridge (धर्मकांटा)</strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0' }}>
                Gross weighment with laden grain load, followed by unladen tare weighment.
              </p>
              <span className={`badge ${stage >= 2 ? 'badge-success' : 'badge-primary'}`}>
                Status: {stage > 2 ? 'Weighment Completed' : stage === 2 ? 'Weighing In Progress' : 'Queued'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', padding: '1rem', background: stage >= 3 ? 'var(--gov-green-light)' : 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: stage >= 3 ? 'var(--gov-green)' : '#CBD5E1', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              3
            </div>
            <div>
              <strong style={{ color: 'var(--gov-navy)' }}>Stage 3: Quality Lab Assay & Conformance</strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0' }}>
                Automated moisture meter inspection, foreign matter percentage, grade allotment.
              </p>
              <span className={`badge ${stage >= 3 ? 'badge-success' : 'badge-primary'}`}>
                Status: {stage > 3 ? 'Quality Certified' : stage === 3 ? 'Assaying Sample' : 'Awaiting Lab'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', padding: '1rem', background: stage >= 4 ? 'var(--gov-green-light)' : 'var(--bg-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: stage >= 4 ? 'var(--gov-green)' : '#CBD5E1', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              4
            </div>
            <div>
              <strong style={{ color: 'var(--gov-navy)' }}>Stage 4: Intake Acceptance & Payment Advice</strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0' }}>
                MSP ledger commitment, digital warehouse receipt generated, DBT payment triggered.
              </p>
              <span className={`badge ${stage === 4 ? 'badge-success' : 'badge-primary'}`}>
                Status: {stage === 4 ? 'Dispatched' : 'Pending Stages 1–3'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
