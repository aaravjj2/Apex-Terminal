/**
 * Apex Terminal — StatusBar Component
 * Matches demo/index.html exactly:
 * Live dot | Market status | NAV | Leverage | Scrolling ticker tape | Version
 */
import { useState, useEffect } from 'react';

interface StatusBarProps {
  marketOpen: boolean;
  marketSession: string;
  connectionStatus: string;
}

interface TickerItem {
  sym: string;
  val: string;
  change: string;
  up: boolean;
}

const TICKER_DATA: TickerItem[] = [
  { sym: 'SPX', val: '5,021.84', change: '+0.62%', up: true },
  { sym: 'NDX', val: '17,698.32', change: '+0.89%', up: true },
  { sym: 'DJI', val: '38,996.39', change: '+0.23%', up: true },
  { sym: 'RUT', val: '2,048.52', change: '-0.34%', up: false },
  { sym: 'VIX', val: '13.42', change: '-2.18%', up: false },
  { sym: 'TNX', val: '4.285%', change: '+0.02', up: true },
  { sym: 'DXY', val: '104.82', change: '+0.15%', up: true },
  { sym: 'CL1', val: '78.42', change: '+1.87%', up: true },
  { sym: 'GC1', val: '2,342.50', change: '+0.45%', up: true },
  { sym: 'BTC', val: '64,250', change: '+1.98%', up: true },
  { sym: 'ETH', val: '3,485', change: '-1.20%', up: false },
  { sym: 'EUR', val: '1.0842', change: '-0.08%', up: false },
  { sym: 'GBP', val: '1.2685', change: '+0.12%', up: true },
  { sym: 'JPY', val: '150.42', change: '+0.28%', up: true },
];

export function StatusBar({ marketOpen, marketSession, connectionStatus }: StatusBarProps) {
  return (
    <div className="apex-statusbar" data-testid="ui2-status-bar">
      {/* Connection status */}
      <div className="sb-item">
        <div className={`sb-dot ${connectionStatus === 'connected' ? 'ok' : connectionStatus === 'connecting' ? 'warn' : 'err'}`} />
        <span>{connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}</span>
      </div>

      {/* Market status */}
      <div className="sb-item" data-testid="ui2-market-status">
        <div className={`sb-dot ${marketOpen ? 'ok' : 'warn'}`} />
        <span>
          {marketOpen ? 'Market Open' : marketSession === 'pre' ? 'Pre-Market' : marketSession === 'post' ? 'After Hours' : 'Closed'}
        </span>
      </div>

      {/* NAV */}
      <div className="sb-item" style={{ fontFamily: 'var(--mono)' }}>
        <span style={{ color: 'var(--tx2)' }}>NAV</span>
        <span style={{ color: 'var(--up)' }}>$248,392.41</span>
      </div>

      {/* Leverage */}
      <div className="sb-item" style={{ fontFamily: 'var(--mono)' }}>
        <span style={{ color: 'var(--tx2)' }}>Lev</span>
        <span>1.2×</span>
      </div>

      {/* Scrolling ticker tape */}
      <div className="sb-ticker">
        <div className="sb-tape">
          {[...TICKER_DATA, ...TICKER_DATA].map((item, i) => (
            <div key={i} className="tape-item">
              <span className="tape-sym">{item.sym}</span>
              <span className="tape-val">{item.val}</span>
              <span className={`tape-chg ${item.up ? 'up' : 'dn'}`}>{item.change}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Version */}
      <div className="sb-item" style={{ fontFamily: 'var(--mono)', flexShrink: 0 }}>
        v2.0.0
      </div>
    </div>
  );
}
