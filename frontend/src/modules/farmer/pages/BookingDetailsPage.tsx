import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../../services/api.service';
import { Booking, BookingStatus } from '../../../types';
import { ArrowLeft, Printer, AlertTriangle, CheckCircle } from 'lucide-react';

export const BookingDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.getBookingById(id);
      if (res && res.booking) {
        setBooking(res.booking);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleCancel = async () => {
    if (!booking) return;
    const ok = window.confirm(`Cancel booking ${booking.bookingId}?`);
    if (!ok) return;

    setCancelling(true);
    try {
      await api.cancelBooking(booking.bookingId, 'Farmer cancelled from booking receipt');
      alert('Booking cancelled.');
      await fetchDetails();
    } catch (err: any) {
      alert(`Cancel failed: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <div className="main-container"><p>Loading booking details from database...</p></div>;
  }

  if (error || !booking) {
    return (
      <div className="main-container">
        <div className="card" style={{ borderLeft: '4px solid var(--gov-red)' }}>
          <p style={{ color: 'var(--gov-red)' }}>{error || 'Booking not found'}</p>
          <Link to="/dashboard" className="btn btn-outline btn-xs" style={{ marginTop: '10px' }}>
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="main-container" style={{ maxWidth: '720px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Link to="/dashboard" className="btn btn-outline btn-xs">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
        <button onClick={() => window.print()} className="btn btn-outline btn-xs">
          <Printer size={14} /> Print Receipt
        </button>
      </div>

      <div className="card" style={{ borderTop: '5px solid var(--gov-navy)' }}>
        <div style={{ textAlign: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Department of Agriculture & Farmers Welfare
          </span>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--gov-navy)', margin: '4px 0' }}>
            Official Grain Arrival Token Receipt
          </h2>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--gov-saffron)', margin: '8px 0' }}>
            {booking.tokenNumber}
          </div>
          <span className={`status-pill ${booking.status === BookingStatus.COMPLETED ? 'status-completed' : booking.status === BookingStatus.CANCELLED ? 'status-danger' : 'status-active'}`}>
            Status: {booking.status}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>Booking Identifier</span>
            <div style={{ fontWeight: 700 }}>{booking.bookingId}</div>
          </div>
          <div>
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>Procurement Centre</span>
            <div style={{ fontWeight: 700 }}>{booking.centreId}</div>
          </div>
          <div>
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>Allocated Arrival Window</span>
            <div style={{ fontWeight: 700, color: 'var(--gov-saffron)' }}>
              {booking.arrivalWindow?.startTime} - {booking.arrivalWindow?.endTime} (Slot {booking.arrivalWindow?.slotIndex})
            </div>
          </div>
          <div>
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>Scheduled Date</span>
            <div style={{ fontWeight: 700 }}>{booking.bookingDate}</div>
          </div>
          <div>
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>Commodity & Quantity</span>
            <div style={{ fontWeight: 700 }}>{booking.commodityCode} - {booking.quantityQuintals} Quintals</div>
          </div>
          <div>
            <span className="detail-label" style={{ color: 'var(--text-muted)' }}>Registered Farmer ID</span>
            <div style={{ fontWeight: 700 }}>{booking.farmerId}</div>
          </div>
        </div>

        {/* Barcode representation */}
        <div className="barcode-card" style={{ border: '1px solid var(--border-color)', margin: '1rem 0' }}>
          <div className="barcode-lines" style={{ width: '80%', height: '40px' }}></div>
          <span className="barcode-text">{booking.bookingId} - {booking.tokenNumber}</span>
        </div>

        {booking.status !== BookingStatus.CANCELLED && booking.status !== BookingStatus.COMPLETED && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <button onClick={handleCancel} disabled={cancelling} className="btn btn-danger btn-sm">
              {cancelling ? 'Cancelling...' : 'Cancel This Booking'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
