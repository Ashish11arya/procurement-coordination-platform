import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../modules/auth/context/AuthContext';
import { Role } from '../../types';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: Role[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user, hasRole } = useAuth();

  if (!user || !hasRole(allowedRoles)) {
    let fallbackPath = '/dashboard';
    if (user?.role && user.role !== Role.FARMER) {
      if (
        [
          Role.CENTRE_ADMIN,
          Role.CHECKIN_OPERATOR,
          Role.WEIGHING_OPERATOR,
          Role.QUALITY_OPERATOR,
          Role.PROCUREMENT_OPERATOR,
        ].includes(user.role)
      ) {
        fallbackPath = '/centre/dashboard';
      } else {
        fallbackPath = '/admin/dashboard';
      }
    }

    return (
      <div className="main-container" style={{ paddingTop: '4rem', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: '580px', margin: '0 auto', borderTop: '5px solid var(--gov-red)' }}>
          <div style={{ color: 'var(--gov-red)', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
            <ShieldAlert size={56} />
          </div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--gov-navy)', marginBottom: '0.5rem' }}>
            403 - Access Denied (अनधिकृत पहुंच)
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Your account role (<strong>{user?.role || 'GUEST'}</strong>) does not have authorization to access this operational screen.
          </p>
          <div style={{ background: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem', textAlign: 'left' }}>
            <div><strong>Required Roles:</strong> {allowedRoles.join(', ')}</div>
            <div><strong>Assigned User:</strong> {user?.name || 'Unauthenticated'}</div>
          </div>
          <Link to={fallbackPath} className="btn btn-navy">
            <ArrowLeft size={16} />
            Return to Authorized Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
