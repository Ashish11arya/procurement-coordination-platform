import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../modules/auth/context/AuthContext';
import { realtime } from '../../realtime/socket';
import { LogOut, User as UserIcon } from 'lucide-react';

export const GovMasthead: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isWsConnected, setIsWsConnected] = useState(realtime.getConnectionState());
  const [lang, setLang] = useState<'en' | 'hi'>('en');

  useEffect(() => {
    setIsWsConnected(realtime.getConnectionState());
    const unsub = realtime.on('CONNECT_STATE', (data) => {
      setIsWsConnected(data.isConnected);
    });
    return () => unsub();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="gov-masthead">
      <div className="gov-masthead-inner">
        <Link to="/" className="gov-brand">
          <div className="gov-emblem">
            <svg width="38" height="38" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="46" stroke="#E06A1B" strokeWidth="4"/>
              <circle cx="50" cy="50" r="38" stroke="#107C41" strokeWidth="3"/>
              <path d="M50 16 L56 38 L78 38 L60 51 L67 73 L50 60 L33 73 L40 51 L22 38 L44 38 Z" fill="#0A2540"/>
            </svg>
          </div>
          <div className="gov-title">
            <h1>Department of Agriculture & Farmers Welfare</h1>
            <p>Government-Grade Real-Time Procurement Coordination Platform (MSP Operations)</p>
          </div>
        </Link>

        <div className="gov-controls">
          {isAuthenticated && user && (
            <div className="persona-badge" title={`Role: ${user.role}`}>
              <UserIcon size={14} />
              <span>
                {user.name} ({user.role})
              </span>
            </div>
          )}

          <div className={`live-indicator ${isWsConnected ? '' : 'disconnected'}`}>
            <span className="pulse-dot"></span>
            <span>{isWsConnected ? 'Live Connected' : 'Disconnected'}</span>
          </div>

          <div className="lang-toggle">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'hi' ? 'active' : ''} onClick={() => setLang('hi')}>हिंदी</button>
          </div>

          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="btn btn-outline btn-xs"
              style={{ color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.3)' }}
              title="Logout"
            >
              <LogOut size={13} />
              Exit
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
