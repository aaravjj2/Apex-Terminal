import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Shell } from './features/layout/shell/Shell';
import { ClockClient } from './data/ClockClient';
import { WebSocketClient } from './data/WebSocketClient';
import { UI2Routes } from './ui2/routes';
import './ui2/ui2-tokens.css';

function App() {
  useEffect(() => {
    // Check for deterministic E2E mode
    const params = new URLSearchParams(window.location.search);
    if (params.get('e2e') === '1') {
      console.log('ENTERED E2E MODE');
      document.body.classList.add('e2e-mode');

      // Force virtual clock to ensure time is deterministic
      // Use injected time from helpers.ts or fallback to Jan 15 2025 (matching CSV)
      // @ts-ignore
      const timestamp = window.__E2E_FROZEN_TIME__ || 1736942400000;
      ClockClient.setMode('virtual', timestamp).catch(console.error);

      // Fast-fail WebSockets for E2E speed
      WebSocketClient.overrideThresholds(2000, 3000);
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* UI v2 routes */}
        <Route path="/ui2/*" element={<UI2Routes />} />
        
        {/* Default route: existing Shell app */}
        <Route path="*" element={<Shell />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

