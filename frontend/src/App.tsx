import { useEffect } from 'react';
import { Shell } from './features/layout/shell/Shell';
import { ClockClient } from './data/ClockClient';

import { WebSocketClient } from './data/WebSocketClient';

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
    <Shell />
  );
}

export default App;
