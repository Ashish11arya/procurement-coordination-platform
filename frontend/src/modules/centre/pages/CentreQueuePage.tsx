import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api.service';
import { socketService } from '../../../realtime/socket';
import { Booking, CentreDashboardData } from '../../../types';
import { Truck, Search, Filter, RefreshCw, AlertTriangle, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CentreQueuePage: React.FC = () => {
  const [centreId, setCentreId] = useState<string>('c-karnal-01');
  const [dashboard, setDashboard] = useState<CentreDashboardData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStage, setFilterStage] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = async () => {
    try {
      setError(null);
      const data = await api.getCentreDashboard(centreId);
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch centre queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const unsubscribe = socketService.onQueueUpdated(() => {
      fetchQueue();
    });
    return () => unsubscribe();
  }, [centreId]);

  const roster = dashboard?.roster || [];

  const filteredRoster = roster.filter(b => {
    const matchesSearch = 
      b.tokenNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.commodity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.farmerId?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStage === 'ALL') return true;
    if (filterStage === 'GATE' && (b.queueStatus === 'BOOKED' || b.queueStatus === 'ARRIVED')) return true;
    if (filterStage === 'WEIGHBRIDGE' && (b.queueStatus === 'CHECKED_IN' || b.queueStatus === 'WEIGHING_IN_PROGRESS')) return true;
    if (filterStage === 'QUALITY' && (b.queueStatus === 'WEIGHING_COMPLETED' || b.queueStatus === 'QUALITY_CHECK')) return true;
    if (filterStage === 'PROCUREMENT' && (b.queueStatus === 'PROCUREMENT_IN_PROGRESS')) return true;
    if (filterStage === 'COMPLETED' && (b.queueStatus === 'COMPLETED')) return true;
    return true;
  });

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <div className="gov-badge-group">
            <span className="gov-badge gov-badge-gov">CENTRE OPERATIONS</span>
            <span className="gov-badge gov-badge-active">LIVE YARD ROSTER</span>
          </div>
          <h1 className="portal-title">Yard Queue & Vehicle Movement Roster</h1>
          <p className="portal-subtitle">Real-Time Stage Progression Tracking across Gate, Weighbridge, Quality & Procurement</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select 
            className="gov-input"
            value={centreId} 
            onChange={e => setCentreId(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="c-karnal-01">Karnal Central Mandi (c-karnal-01)</option>
            <option value="c-rohtak-01">Rohtak Grain Yard (c-rohtak-01)</option>
          </select>
          <button className="gov-btn gov-btn-secondary" onClick={fetchQueue}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && (
        <div className="gov-alert gov-alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Stage Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div 
          className="gov-card" 
          onClick={() => setFilterStage('ALL')}
          style={{ padding: '1rem', cursor: 'pointer', border: filterStage === 'ALL' ? '2px solid var(--gov-navy)' : '1px solid var(--gov-border)' }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>Total Today</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gov-navy)' }}>{roster.length}</div>
        </div>

        <div 
          className="gov-card" 
          onClick={() => setFilterStage('GATE')}
          style={{ padding: '1rem', cursor: 'pointer', border: filterStage === 'GATE' ? '2px solid var(--gov-navy)' : '1px solid var(--gov-border)' }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>1. Gate Entry</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gov-blue)' }}>
            {roster.filter(b => b.queueStatus === 'BOOKED' || b.queueStatus === 'ARRIVED').length}
          </div>
        </div>

        <div 
          className="gov-card" 
          onClick={() => setFilterStage('WEIGHBRIDGE')}
          style={{ padding: '1rem', cursor: 'pointer', border: filterStage === 'WEIGHBRIDGE' ? '2px solid var(--gov-navy)' : '1px solid var(--gov-border)' }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>2. Weighbridge</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gov-amber)' }}>
            {roster.filter(b => b.queueStatus === 'CHECKED_IN' || b.queueStatus === 'WEIGHING_IN_PROGRESS').length}
          </div>
        </div>

        <div 
          className="gov-card" 
          onClick={() => setFilterStage('QUALITY')}
          style={{ padding: '1rem', cursor: 'pointer', border: filterStage === 'QUALITY' ? '2px solid var(--gov-navy)' : '1px solid var(--gov-border)' }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>3. Quality Lab</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gov-purple, #7C3AED)' }}>
            {roster.filter(b => b.queueStatus === 'WEIGHING_COMPLETED' || b.queueStatus === 'QUALITY_CHECK').length}
          </div>
        </div>

        <div 
          className="gov-card" 
          onClick={() => setFilterStage('COMPLETED')}
          style={{ padding: '1rem', cursor: 'pointer', border: filterStage === 'COMPLETED' ? '2px solid var(--gov-navy)' : '1px solid var(--gov-border)' }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)', textTransform: 'uppercase' }}>4. Completed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gov-green)' }}>
            {roster.filter(b => b.queueStatus === 'COMPLETED').length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="gov-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gov-text-muted)' }} />
            <input
              type="text"
              className="gov-input"
              style={{ paddingLeft: '38px' }}
              placeholder="Search by Token Number, Vehicle Reg Number, Farmer ID, or Crop..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={16} color="var(--gov-text-secondary)" />
            <select
              className="gov-input"
              value={filterStage}
              onChange={e => setFilterStage(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="ALL">All Stages</option>
              <option value="GATE">Gate Queue</option>
              <option value="WEIGHBRIDGE">Weighbridge Queue</option>
              <option value="QUALITY">Quality Queue</option>
              <option value="PROCUREMENT">Procurement Queue</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Roster Table */}
      <div className="gov-card">
        <div className="gov-card-header">
          <h2 className="gov-card-title">Live Roster ({filteredRoster.length} Vehicles)</h2>
          <span className="gov-badge gov-badge-active">REALTIME STREAM ACTIVE</span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading queue roster...</div>
        ) : filteredRoster.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gov-text-muted)' }}>
            <Truck size={40} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p>No vehicles found matching current filter criteria.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="gov-table">
              <thead>
                <tr>
                  <th>TOKEN</th>
                  <th>VEHICLE</th>
                  <th>FARMER ID</th>
                  <th>COMMODITY & QTY</th>
                  <th>SLOT / WINDOW</th>
                  <th>QUEUE STATUS</th>
                  <th>ASSIGNED COUNTER</th>
                  <th>OPERATIONS ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoster.map(b => (
                  <tr key={b.bookingId}>
                    <td>
                      <strong style={{ color: 'var(--gov-navy)' }}>{b.tokenNumber}</strong>
                    </td>
                    <td>
                      <div><strong>{b.vehicleNumber}</strong></div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>{b.vehicleType}</div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace' }}>{b.farmerId?.slice(-8) || 'FARMER-1'}</span>
                    </td>
                    <td>
                      <div><strong>{b.commodity}</strong></div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-secondary)' }}>{b.allocatedQuantityQuintals} Quintals</div>
                    </td>
                    <td>
                      <div>{b.timeSlot || '08:00 - 10:00'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gov-text-muted)' }}>{b.bookingDate}</div>
                    </td>
                    <td>
                      <span className={`gov-badge ${
                        b.queueStatus === 'COMPLETED' ? 'gov-badge-active' :
                        b.queueStatus === 'WEIGHING_IN_PROGRESS' || b.queueStatus === 'QUALITY_CHECK' ? 'gov-badge-warning' :
                        'gov-badge-gov'
                      }`}>
                        {b.queueStatus}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        {b.assignedCounterId || 'Unassigned'}
                      </span>
                    </td>
                    <td>
                      {b.queueStatus === 'BOOKED' || b.queueStatus === 'ARRIVED' ? (
                        <Link to="/centre/check-in" className="gov-btn gov-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8125rem' }}>
                          Check In <ArrowRight size={14} />
                        </Link>
                      ) : b.queueStatus === 'CHECKED_IN' || b.queueStatus === 'WEIGHING_IN_PROGRESS' ? (
                        <Link to="/centre/weighing" className="gov-btn gov-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8125rem' }}>
                          Weigh <ArrowRight size={14} />
                        </Link>
                      ) : b.queueStatus === 'WEIGHING_COMPLETED' || b.queueStatus === 'QUALITY_CHECK' ? (
                        <Link to="/centre/quality" className="gov-btn gov-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8125rem' }}>
                          Assay <ArrowRight size={14} />
                        </Link>
                      ) : b.queueStatus === 'PROCUREMENT_IN_PROGRESS' ? (
                        <Link to="/centre/procurement" className="gov-btn gov-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8125rem' }}>
                          Payout <ArrowRight size={14} />
                        </Link>
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--gov-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={14} /> Dispatched
                        </span>
                      )}
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
