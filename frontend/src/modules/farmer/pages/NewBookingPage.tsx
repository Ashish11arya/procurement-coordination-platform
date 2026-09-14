import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api.service';
import { Centre } from '../../../types';
import { CalendarPlus, AlertCircle, ArrowLeft } from 'lucide-react';

export const NewBookingPage: React.FC = () => {
  const navigate = useNavigate();
  const [centres, setCentres] = useState<Centre[]>([]);
  const [centreId, setCentreId] = useState('CENTRE-MP-IND-01');
  const [commodityCode, setCommodityCode] = useState('WHEAT');
  const [quantityQuintals, setQuantityQuintals] = useState('30');
  const [bookingDate, setBookingDate] = useState('2026-04-15');
  const [preferredSlotIndex, setPreferredSlotIndex] = useState(1);
  const [vehicleNumber, setVehicleNumber] = useState('MP-09-AB-1234');
  const [vehicleType, setVehicleType] = useState('TRACTOR_TROLLEY');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCentres()
      .then((data) => {
        if (data && data.length > 0) {
          setCentres(data);
          setCentreId(data[0].centreId);
        }
      })
      .catch((err) => console.warn('Failed to load centres:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const qty = parseFloat(quantityQuintals);
    if (!qty || qty <= 0) {
      setError('Quantity must be greater than 0');
      setLoading(false);
      return;
    }

    const payload = {
      centreId,
      commodityCode,
      quantityQuintals: qty,
      bookingDate,
      preferredSlotIndex: Number(preferredSlotIndex),
      vehicles: [
        {
          vehicleNumber,
          vehicleType,
          allocatedQuantityQuintals: qty,
        },
      ],
    };

    try {
      const res = await api.createBooking(payload);
      alert(`Booking Successful! Issued Token: ${res.booking.tokenNumber} (ID: ${res.booking.bookingId})`);
      navigate(`/booking/${res.booking.bookingId}`);
    } catch (err: any) {
      setError(err.message || 'Booking creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-container" style={{ maxWidth: '640px' }}>
      <div className="card">
        <div style={{ marginBottom: '1.5rem' }}>
          <button onClick={() => navigate(-1)} className="btn btn-outline btn-xs" style={{ marginBottom: '10px' }}>
            <ArrowLeft size={14} /> Back
          </button>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--gov-navy)' }}>
            Schedule New Grain Procurement Arrival
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Capacity-aware slot allocation evaluated against physical Mandi constraints
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
            <label>Select Procurement Centre (खरीद केंद्र)</label>
            <select
              className="form-control"
              value={centreId}
              onChange={(e) => setCentreId(e.target.value)}
              required
            >
              {centres.length > 0 ? (
                centres.map((c) => (
                  <option key={c.centreId} value={c.centreId}>
                    {c.name} ({c.district}) - Daily Cap: {c.dailyCapacityQuintals} Q
                  </option>
                ))
              ) : (
                <option value="CENTRE-MP-IND-01">Sanwer Krishi Upaj Mandi (Indore) - 500 Q Cap</option>
              )}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Commodity (फसल)</label>
              <select
                className="form-control"
                value={commodityCode}
                onChange={(e) => setCommodityCode(e.target.value)}
                required
              >
                <option value="WHEAT">Wheat (गेहूं) - MSP ₹2,275/Q</option>
                <option value="MUSTARD">Mustard (सरसों) - MSP ₹5,650/Q</option>
                <option value="GRAM">Gram (चना) - MSP ₹5,440/Q</option>
              </select>
            </div>

            <div className="form-group">
              <label>Quantity in Quintals (मात्रा क्विंटल में)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="100"
                className="form-control"
                value={quantityQuintals}
                onChange={(e) => setQuantityQuintals(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Procurement Date (दिनांक)</label>
              <input
                type="date"
                className="form-control"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Preferred Arrival Window (समय स्लॉट)</label>
              <select
                className="form-control"
                value={preferredSlotIndex}
                onChange={(e) => setPreferredSlotIndex(Number(e.target.value))}
                required
              >
                <option value={1}>Slot 1: 10:00 AM - 11:00 AM (Available)</option>
                <option value={2}>Slot 2: 11:00 AM - 12:00 PM (Available)</option>
                <option value={3}>Slot 3: 12:00 PM - 01:00 PM (Available)</option>
                <option value={4}>Slot 4: 02:00 PM - 03:00 PM (Available)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Vehicle Registration Number (वाहन संख्या)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. MP-09-AB-1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Vehicle Type</label>
              <select
                className="form-control"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
              >
                <option value="TRACTOR_TROLLEY">Tractor Trolley</option>
                <option value="MINI_TRUCK">Mini Truck (Pickup)</option>
                <option value="MEDIUM_TRUCK">Medium Commercial Vehicle</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
            <CalendarPlus size={16} />
            {loading ? 'Validating Constraints & Booking...' : 'Confirm Arrival Window (बुकिंग सुरक्षित करें)'}
          </button>
        </form>
      </div>
    </div>
  );
};
