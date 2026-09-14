import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../modules/auth/context/AuthContext';
import { Role } from '../../types';
import {
  Tractor,
  Building2,
  Landmark,
  CalendarPlus,
  Activity,
  Layers,
  Clock,
  CreditCard,
  History,
  QrCode,
  Scale,
  FlaskConical,
  Receipt,
  Sliders,
  AlertTriangle,
  Globe2,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export const PortalNavbar: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  const isFarmer = user.role === Role.FARMER;
  const isCentreStaff = [
    Role.CENTRE_ADMIN,
    Role.CHECKIN_OPERATOR,
    Role.WEIGHING_OPERATOR,
    Role.QUALITY_OPERATOR,
    Role.PROCUREMENT_OPERATOR,
  ].includes(user.role);
  const isGovAdmin = [
    Role.GOVERNMENT_ADMIN,
    Role.STATE_ADMIN,
    Role.DISTRICT_ADMIN,
    Role.AUDITOR,
    Role.SYSTEM_ADMIN,
  ].includes(user.role);

  return (
    <nav className="portal-nav">
      <div className="portal-nav-inner">
        {/* FARMER LINKS */}
        {isFarmer && (
          <>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <Tractor size={16} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/book" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <CalendarPlus size={16} />
              <span>Book Arrival</span>
            </NavLink>
            <NavLink to="/status" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <Activity size={16} />
              <span>Yard Progress</span>
            </NavLink>
            <NavLink to="/live-queue" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <Clock size={16} />
              <span>Live Queue</span>
            </NavLink>
            <NavLink to="/payment-status" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <CreditCard size={16} />
              <span>DBT Payout</span>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <History size={16} />
              <span>Booking History</span>
            </NavLink>
            <NavLink to="/centres" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <Building2 size={16} />
              <span>Mandis</span>
            </NavLink>
          </>
        )}

        {/* CENTRE OPERATIONS LINKS */}
        {isCentreStaff && (
          <>
            <NavLink to="/centre/dashboard" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <Building2 size={16} />
              <span>Mandi Dashboard</span>
            </NavLink>
            <NavLink to="/centre/queue" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <Layers size={16} />
              <span>Live Yard Queue</span>
            </NavLink>
            {(user.role === Role.CHECKIN_OPERATOR || user.role === Role.CENTRE_ADMIN) && (
              <NavLink to="/centre/check-in" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                <QrCode size={16} />
                <span>Gate Check-In</span>
              </NavLink>
            )}
            {(user.role === Role.WEIGHING_OPERATOR || user.role === Role.CENTRE_ADMIN) && (
              <NavLink to="/centre/weighing" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                <Scale size={16} />
                <span>Weighbridge</span>
              </NavLink>
            )}
            {(user.role === Role.QUALITY_OPERATOR || user.role === Role.CENTRE_ADMIN) && (
              <NavLink to="/centre/quality" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                <FlaskConical size={16} />
                <span>Quality Assay</span>
              </NavLink>
            )}
            {(user.role === Role.PROCUREMENT_OPERATOR || user.role === Role.CENTRE_ADMIN) && (
              <NavLink to="/centre/procurement" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                <Receipt size={16} />
                <span>Procurement & DBT</span>
              </NavLink>
            )}
            {user.role === Role.CENTRE_ADMIN && (
              <>
                <NavLink to="/centre/counters" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                  <Sliders size={16} />
                  <span>Counters</span>
                </NavLink>
                <NavLink to="/centre/schedule" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                  <Clock size={16} />
                  <span>Slot Schedule</span>
                </NavLink>
                <NavLink to="/centre/exceptions" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
                  <AlertTriangle size={16} />
                  <span>Exceptions</span>
                </NavLink>
              </>
            )}
          </>
        )}

        {/* GOVERNMENT COMMAND CENTRE LINKS */}
        {isGovAdmin && (
          <>
            <NavLink to="/admin/dashboard" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <Landmark size={16} />
              <span>Command Hub</span>
            </NavLink>
            <NavLink to="/admin/live-monitoring" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <Activity size={16} />
              <span>Live Telemetry</span>
            </NavLink>
            <NavLink to="/admin/bottlenecks" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <AlertTriangle size={16} />
              <span>Bottlenecks</span>
            </NavLink>
            <NavLink to="/admin/centres" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <Building2 size={16} />
              <span>District Mandis</span>
            </NavLink>
            <NavLink to="/admin/states" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <Globe2 size={16} />
              <span>State Rollups</span>
            </NavLink>
            <NavLink to="/admin/integrations" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <ShieldCheck size={16} />
              <span>Gateway Sync</span>
            </NavLink>
            <NavLink to="/admin/audit" className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
              <TrendingUp size={16} />
              <span>Audit Trail</span>
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
};
