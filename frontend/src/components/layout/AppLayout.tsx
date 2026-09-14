import React from 'react';
import { Outlet } from 'react-router-dom';
import { GovMasthead } from './GovMasthead';
import { PortalNavbar } from './PortalNavbar';
import { GovFooter } from './GovFooter';
import { WireTelemetryConsole } from '../telemetry/WireTelemetryConsole';

export const AppLayout: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <GovMasthead />
      <PortalNavbar />
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
      <WireTelemetryConsole />
      <GovFooter />
    </div>
  );
};
