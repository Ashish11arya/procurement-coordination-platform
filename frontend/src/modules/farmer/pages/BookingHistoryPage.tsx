import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/api.service';
import { Booking, BookingStatus } from '../../../types';
import { History, Eye, CalendarPlus } from 'lucide-react';

export const BookingHistoryPage: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFarmerBookings()
      .then((res) => {
        if (res && res.bookings) setBookings(res.bookings);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="main-container">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Farmer Procurement Booking History (बुकिंग इतिहास)</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Historical and active grain procurement arrival tokens issued by the platform
            </p>
          </div>
          <Link to="/book" className="btn btn-primary btn-sm">
            <CalendarPlus size={15} /> Book New Arrival
          </Link>
        </div>

        {loading ? (
          <p>Loading booking records...</p>
        ) : bookings.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No previous booking records found.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Token Number</th>
                  <th>Booking ID</th>
                  <th>Centre</th>
                  <th>Commodity & Quantity</th>
                  <th>Arrival Slot</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b._id || b.bookingId}>
                    <td><strong style={{ color: 'var(--gov-navy)' }}>{b.tokenNumber}</strong></td>
                    <td>{b.bookingId}</td>
                    <td>{b.centreId}</td>
                    <td>{b.commodityCode} - {b.quantityQuintals} Q</td>
                    <td>{b.arrivalWindow?.startTime} - {b.arrivalWindow?.endTime}</td>
                    <td>
                      <span className={`status-pill ${b.status === BookingStatus.COMPLETED ? 'status-completed' : b.status === BookingStatus.CANCELLED ? 'status-danger' : 'status-active'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td>
                      <Link to={`/booking/${b.bookingId}`} className="btn btn-outline btn-xs">
                        <Eye size={12} /> View Receipt
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
