import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { Centre } from '../../../types';
import { Building2, MapPin, Clock, CalendarPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CentresDirectoryPage: React.FC = () => {
  const [centres, setCentres] = useState<Centre[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCentres()
      .then((data) => setCentres(data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="main-container">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Procurement Centres Directory (खरीद केंद्र सूची)</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Operational Mandis with capacity-aware scheduling active in Indore District
            </p>
          </div>
          <span className="badge badge-success">Rabi 2026 Procurement Season</span>
        </div>

        {loading ? (
          <p>Loading centres...</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {centres.map((c) => (
              <div key={c.centreId} className="card" style={{ border: '1px solid var(--border-color)', margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span className="badge badge-primary">{c.centreId}</span>
                  <span className="status-pill status-active">Operational</span>
                </div>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--gov-navy)', margin: '4px 0' }}>{c.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '12px' }}>
                  <MapPin size={14} />
                  <span>{c.address}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-subtle)', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Daily Capacity:</span>
                    <div style={{ fontWeight: 700 }}>{c.dailyCapacityQuintals} Q</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Yard Safety Cap:</span>
                    <div style={{ fontWeight: 700 }}>{c.maxSimultaneousVehicles} Vehicles</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Hours:</span>
                    <div style={{ fontWeight: 600 }}>{c.operatingHours?.openTime} - {c.operatingHours?.closeTime}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Crops:</span>
                    <div style={{ fontWeight: 600 }}>{c.supportedCommodities?.join(', ')}</div>
                  </div>
                </div>

                <Link to="/book" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                  <CalendarPlus size={14} /> Schedule Arrival Here
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
