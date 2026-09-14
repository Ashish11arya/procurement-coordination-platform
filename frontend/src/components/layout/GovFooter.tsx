import React from 'react';

export const GovFooter: React.FC = () => {
  return (
    <footer className="gov-footer">
      <div className="gov-footer-inner">
        <p>© 2026 Ministry of Agriculture & Farmers Welfare, Government of India. All Rights Reserved.</p>
        <div className="footer-links">
          <span>Kisan Call Centre Toll-Free: <strong>1800-180-1551</strong></span>
          <span>|</span>
          <span>Integrated with Central Foodgrain Procurement Portal (CFPP)</span>
        </div>
      </div>
    </footer>
  );
};
