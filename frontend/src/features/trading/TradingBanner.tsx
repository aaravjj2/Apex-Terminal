// Bloomberg TB — Trading Banner
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useState, useEffect } from 'react';
import React from 'react';

interface AccountInfo {
  account_id: string;
  status: string;
  equity: number;
  buying_power: number;
  is_paper: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

export function TradingBanner() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [mode, setMode] = useState<'paper'|'live'>('paper');

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/v1/account');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAccount(data);
        setMode(data.is_paper ? 'paper' : 'live');
      } catch { setAccount(null); }
    };
    fetch_();
    const iv = setInterval(fetch_, 30000);
    return () => clearInterval(iv);
  }, []);

  const bannerColor = mode === 'paper' ? AMBER : RED;
  const liveMode    = mode === 'live';

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, zIndex:90,
      height:24, display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 12px', fontFamily:MONO,
      background: bannerColor + '22',
      borderBottom:`1px solid ${bannerColor}`,
    }}>
      {/* Left */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ color:bannerColor, fontSize:9, fontWeight:700, letterSpacing:1 }}>
          {liveMode ? '● LIVE TRADING' : '▢ PAPER TRADING'}
        </span>
        {liveMode && (
          <span style={{ color: RED, fontSize:8, letterSpacing:0.5 }}>⚠ REAL MONEY AT RISK</span>
        )}
      </div>

      {/* Right */}
      {account && (
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:SUBTLE, fontSize:9 }}>◦ {account.account_id}</span>
          <span style={{ color:TEXT, fontSize:9, fontWeight:700 }}>{formatCurrency(account.equity)}</span>
          <span style={{ color:TEXT, fontSize:8 }}>BP: {formatCurrency(account.buying_power)}</span>
          <span style={{
            padding:'0 5px', borderRadius:2, fontSize:8,
            background: account.status === 'ACTIVE' ? GREEN+'22' : RED+'22',
            border:`1px solid ${account.status === 'ACTIVE' ? GREEN : RED}`,
            color: account.status === 'ACTIVE' ? GREEN : RED,
          }}>{account.status}</span>
        </div>
      )}
    </div>
  );
}
