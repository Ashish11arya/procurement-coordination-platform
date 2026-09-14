import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';
import { api } from '../../../services/api.service';
import { realtime } from '../../../realtime/socket';
import { Booking, BookingStatus } from '../../../types';
import {
  CalendarPlus,
  Clock,
  Truck,
  IndianRupee,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export const FarmerDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [liveEta, setLiveEta] = useState<string | null>(null);
  const [vehiclesAhead, setVehiclesAhead] = useState<string | null>(null);

  const getMspRate = (commodityCode?: string) => {
    switch (commodityCode) {
      case 'MUSTARD': return 5650;
      case 'GRAM': return 5440;
      case 'BARLEY': return 1850;
      case 'WHEAT':
      default:
        return 2275;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getFarmerBookings();
      if (res && res.bookings) {
        setBookings(res.bookings);
        // Find active booking: in-progress first, then latest non-cancelled
        const inProgress = res.bookings.find(
          (b) => b.status !== BookingStatus.CANCELLED && b.status !== BookingStatus.COMPLETED
        );
        const active = inProgress || res.bookings.find((b) => b.status !== BookingStatus.CANCELLED) || null;
        setActiveBooking(active);

        if (active) {
          const windowEnd = active.arrivalWindow?.endTime || '11:00 AM';
          setLiveEta(windowEnd);

          if (active.status === BookingStatus.CHECKED_IN) {
            setVehiclesAhead('1 Tractor ahead at scale');
          } else if (active.status === BookingStatus.IN_PROGRESS) {
            setVehiclesAhead('Vehicle on Weighbridge Scale');
          } else if (active.status === BookingStatus.COMPLETED) {
            setVehiclesAhead('0 (Procurement Completed)');
          } else {
            setVehiclesAhead('Awaiting Gate 1 Arrival');
          }
        } else {
          setLiveEta(null);
          setVehiclesAhead(null);
        }
      } else {
        setActiveBooking(null);
        setLiveEta(null);
        setVehiclesAhead(null);
      }
    } catch (err: any) {
      console.warn('[FarmerDashboard] Failed to fetch bookings:', err.message);
      setActiveBooking(null);
      setLiveEta(null);
      setVehiclesAhead(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to real-time events
    const unsubToken = realtime.on('TOKEN_ASSIGNED', () => loadData());
    const unsubWeigh = realtime.on('WEIGHMENT_COMPLETED', () => loadData());
    const unsubQual = realtime.on('QUALITY_COMPLETED', () => loadData());
    const unsubProc = realtime.on('PROCUREMENT_COMPLETED', () => loadData());
    const unsubSched = realtime.on('SCHEDULING_UPDATED', () => loadData());
    const unsubEta = realtime.on('ETA_UPDATED', (data: any) => {
      if (data?.newEta) setLiveEta(data.newEta);
    });

    return () => {
      unsubToken();
      unsubWeigh();
      unsubQual();
      unsubProc();
      unsubSched();
      unsubEta();
    };
  }, []);

  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    const confirmCancel = window.confirm(
      `Are you sure you want to cancel booking ${activeBooking.bookingId}? Dynamic Adaptation will adjust the yard queue and pull forward waiting farmers.`
    );
    if (!confirmCancel) return;

    setCancelling(true);
    try {
      await api.cancelBooking(activeBooking.bookingId, 'Farmer voluntary cancellation from Portal');
      alert(`Booking ${activeBooking.bookingId} cancelled successfully.`);
      await loadData();
    } catch (err: any) {
      alert(`Failed to cancel booking: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  // Determine active stage (1 to 4)
  const getActiveStage = (status?: BookingStatus) => {
    if (!status || status === BookingStatus.BOOKED || status === BookingStatus.CONFIRMED) return 1;
    if (status === BookingStatus.CHECKED_IN) return 2;
    if (status === BookingStatus.IN_PROGRESS) return 3;
    if (status === BookingStatus.COMPLETED) return 4;
    return 1;
  };

  const currentStage = getActiveStage(activeBooking?.status);
  const mspRate = getMspRate(activeBooking?.commodityCode);
  const estimatedPayout = activeBooking ? (activeBooking.quantityQuintals * mspRate).toLocaleString('en-IN') : null;

  return (
    <div className="main-container">
      {/* Greeting Banner */}
      <div className="farmer-greeting-card">
        <div className="farmer-info">
          <div className="avatar-badge">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : 'RV'}
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--gov-navy)' }}>
              Namaste, {user?.name || 'Ramesh Verma'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Registration: <strong>{user?.registrationNumber || 'REG-2026-MP-00192'}</strong> | Mobile: {user?.mobile || '+91-9876543210'}
            </p>
            <span className="badge badge-success" style={{ marginTop: '4px' }}>
              ✓ Verified Landholding: {user?.landAreaAcres || 5.5} Acres ({user?.district || 'Indore'}, {user?.state || 'MP'})
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={loadData} className="btn btn-outline btn-sm" title="Refresh data">
            <RotateCcw size={14} /> Refresh
          </button>
          <Link to="/book" className="btn btn-primary btn-sm">
            <CalendarPlus size={16} /> Book Arrival (नई बुकिंग)
          </Link>
        </div>
      </div>

      {/* Active Token Hero Card */}
      {activeBooking ? (
        <div className="token-hero-card">
          <div className="token-meta">
            <span className="token-label">TODAY'S PROCUREMENT TOKEN</span>
            <div className="token-number">{activeBooking.tokenNumber || 'T-001'}</div>
            <div className="token-subtext">Booking ID: {activeBooking.bookingId}</div>
          </div>

          <div className="token-details-grid">
            <div className="token-detail-item">
              <span className="detail-label">Procurement Centre</span>
              <span className="detail-value">
                {activeBooking.centreName || (activeBooking.centreId === 'CENTRE-MP-IND-01' ? 'Sanwer Krishi Upaj Mandi' : activeBooking.centreId)}
              </span>
            </div>
            <div className="token-detail-item">
              <span className="detail-label">Arrival Window</span>
              <span className="detail-value highlight">
                {activeBooking.bookingDate}, {activeBooking.arrivalWindow?.startTime || '10:00'} - {activeBooking.arrivalWindow?.endTime || '11:00'}
              </span>
            </div>
            <div className="token-detail-item">
              <span className="detail-label">Commodity & Quantity</span>
              <span className="detail-value">
                {activeBooking.commodityCode || activeBooking.commodity} - {activeBooking.quantityQuintals} Quintals
              </span>
            </div>
            <div className="token-detail-item">
              <span className="detail-label">Current Yard Status</span>
              <span className="detail-value">
                <span className={`status-pill ${activeBooking.status === BookingStatus.COMPLETED ? 'status-completed' : activeBooking.status === BookingStatus.CANCELLED ? 'status-danger' : 'status-active'}`}>
                  {activeBooking.status}
                </span>
              </span>
            </div>
          </div>

          <div>
            <div className="barcode-card">
              <div className="barcode-lines"></div>
              <span className="barcode-text">SCAN AT GATE 1 ENTRANCE</span>
            </div>
            {activeBooking.status !== BookingStatus.CANCELLED && activeBooking.status !== BookingStatus.COMPLETED && (
              <button
                onClick={handleCancelBooking}
                disabled={cancelling}
                className="btn btn-danger btn-xs"
                style={{ width: '100%', marginTop: '8px' }}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Booking'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <CalendarPlus size={28} color="var(--gov-navy)" />
          </div>
          <h3 style={{ color: 'var(--gov-navy)', marginBottom: '6px' }}>No Active Procurement Tokens Scheduled</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            You do not have a grain delivery token scheduled for today. Book an arrival window in advance to guarantee fast-track entry and avoid yard congestion.
          </p>
          <Link to="/book" className="btn btn-primary">
            <CalendarPlus size={16} /> Schedule Grain Arrival (नई बुकिंग करें)
          </Link>
        </div>
      )}

      {/* 4-Stage Physical Yard Tracker - Only shown when active booking exists */}
      {activeBooking && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Live 4-Stage Yard Processing Tracker</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Physical progress of vehicle inside Mandi yard (Real-time WebSocket feed)
              </p>
            </div>
            <span className="badge badge-primary">Slot {activeBooking.arrivalWindow?.slotIndex || 1}</span>
          </div>

          <div className="stages-stepper">
            <div className={`stage-step ${currentStage > 1 ? 'completed' : currentStage === 1 ? 'in-progress' : ''}`}>
              <div className="step-circle">{currentStage > 1 ? '✓' : '1'}</div>
              <div className="step-content">
                <strong>Gate Check-in</strong>
                <span className="step-desc">Token & Document Verification</span>
              </div>
            </div>

            <div className={`stage-connector ${currentStage >= 2 ? 'active' : ''}`}></div>

            <div className={`stage-step ${currentStage > 2 ? 'completed' : currentStage === 2 ? 'in-progress' : ''}`}>
              <div className="step-circle">{currentStage > 2 ? '✓' : '2'}</div>
              <div className="step-content">
                <strong>Weighbridge</strong>
                <span className="step-desc">Gross & Tare Weighing</span>
              </div>
            </div>

            <div className={`stage-connector ${currentStage >= 3 ? 'active' : ''}`}></div>

            <div className={`stage-step ${currentStage > 3 ? 'completed' : currentStage === 3 ? 'in-progress' : ''}`}>
              <div className="step-circle">{currentStage > 3 ? '✓' : '3'}</div>
              <div className="step-content">
                <strong>Quality Assay</strong>
                <span className="step-desc">Moisture & Foreign Matter Lab</span>
              </div>
            </div>

            <div className={`stage-connector ${currentStage >= 4 ? 'active' : ''}`}></div>

            <div className={`stage-step ${currentStage === 4 ? 'completed' : ''}`}>
              <div className="step-circle">{currentStage === 4 ? '✓' : '4'}</div>
              <div className="step-content">
                <strong>Procurement & Payment</strong>
                <span className="step-desc">DBT Advice Dispatched</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Telemetry Cards - ONLY shown when active booking exists */}
      {activeBooking && (
        <div className="telemetry-grid">
          <div className="telemetry-card">
            <div className="telemetry-icon">⏱️</div>
            <div className="telemetry-content">
              <span className="telemetry-label">Current Estimated Finish ETA</span>
              <span className="telemetry-value">{liveEta || 'Calculating...'}</span>
              <span className="telemetry-sub">Slot Window: {activeBooking.arrivalWindow?.startTime} - {activeBooking.arrivalWindow?.endTime}</span>
            </div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-icon">🚛</div>
            <div className="telemetry-content">
              <span className="telemetry-label">Weighbridge Yard Status</span>
              <span className="telemetry-value">{vehiclesAhead || 'In Queue'}</span>
              <span className="telemetry-sub">Current State: {activeBooking.status}</span>
            </div>
          </div>

          <div className="telemetry-card">
            <div className="telemetry-icon">💰</div>
            <div className="telemetry-content">
              <span className="telemetry-label">Estimated MSP Payout</span>
              <span className="telemetry-value">₹{estimatedPayout}</span>
              <span className="telemetry-sub">{activeBooking.quantityQuintals} Q @ ₹{mspRate.toLocaleString('en-IN')} / Q ({activeBooking.commodityCode})</span>
            </div>
          </div>
        </div>
      )}

      {/* Guide section when no active booking exists */}
      {!activeBooking && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <div>
              <h3>How Physical Procurement Works</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Guaranteed MSP purchase process at sanctioned government mandis
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1rem 0' }}>
            <div style={{ padding: '1.25rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gov-navy)', marginBottom: '6px' }}>1. Reserve Slot</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                Select commodity, quantity, and preferred arrival window.
              </p>
            </div>
            <div style={{ padding: '1.25rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gov-navy)', marginBottom: '6px' }}>2. Gate Entry</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                Arrive during window; scan digital barcode at Gate 1 boom barrier.
              </p>
            </div>
            <div style={{ padding: '1.25rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gov-navy)', marginBottom: '6px' }}>3. Weigh & Assay</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                Gross and tare weighment followed by moisture & grain quality test.
              </p>
            </div>
            <div style={{ padding: '1.25rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gov-navy)', marginBottom: '6px' }}>4. Direct Payment</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                Electronic Payment Advice issued; MSP credited directly to bank account via DBT.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Bookings List if any exist */}
      {bookings.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <div>
              <h3>All Registered Bookings ({bookings.length})</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Historical and active procurement deliveries</p>
            </div>
            <Link to="/history" className="btn btn-outline btn-xs">View Full History →</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="gov-table">
              <thead>
                <tr>
                  <th>TOKEN</th>
                  <th>DATE & WINDOW</th>
                  <th>COMMODITY</th>
                  <th>QUANTITY</th>
                  <th>CENTRE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.bookingId}>
                    <td><strong>{b.tokenNumber}</strong></td>
                    <td>{b.bookingDate} ({b.arrivalWindow?.startTime} - {b.arrivalWindow?.endTime})</td>
                    <td>{b.commodityCode}</td>
                    <td>{b.quantityQuintals} Q</td>
                    <td>{b.centreName || b.centreId}</td>
                    <td>
                      <span className={`status-pill ${b.status === BookingStatus.COMPLETED ? 'status-completed' : b.status === BookingStatus.CANCELLED ? 'status-danger' : 'status-active'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <Link to={`/booking/${b.bookingId}`} className="btn btn-outline btn-xs">
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
