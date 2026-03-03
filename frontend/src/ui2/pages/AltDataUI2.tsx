/**
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │  APEX TERMINAL — Alternative Data (UI2)                              │
 * │  Satellite imagery sentiment, web traffic, app downloads,            │
 * │  social media signals, job listings, credit card spend, patent       │
 * │  filings — all alternative data in one professional view             │
 * └───────────────────────────────────────────────────────────────────────┘
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const T = {
  bg0: '#0C0E12', bg1: '#131722', bg2: '#1E222D', bg3: '#2A2E39',
  border: '#1E222D', border2: '#2A2E39',
  tx0: '#FFF', tx1: '#D1D4DC', tx2: '#787B86', tx3: '#50535E',
  brand: '#2962FF', up: '#26A69A', dn: '#EF5350',
  warn: '#FF9800', info: '#42A5F5', purple: '#AB47BC', pink: '#EC407A',
  mono: "'JetBrains Mono','Fira Code',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
  r: '4px',
};

/* ── Types ───────────────────────────────────────────────────────────── */
interface SatelliteData {
  ticker: string;
  location: string;
  date: string;
  parkingLotFill: number;
  changeWoW: number;
  footTrafficIdx: number;
  storeCountAffected: number;
  signalStrength: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
}

interface WebTrafficData {
  domain: string;
  ticker: string;
  uniqueVisitors: number;
  changeWoW: number;
  changeMoM: number;
  bounceRate: number;
  avgSessionDuration: number;
  pagesPerSession: number;
  mobileShare: number;
}

interface AppDownloads {
  app: string;
  ticker: string;
  platform: 'iOS' | 'Android' | 'Both';
  downloads7d: number;
  change7d: number;
  rating: number;
  reviews7d: number;
  dau: number;
  mau: number;
  retention30d: number;
}

interface JobPostings {
  company: string;
  ticker: string;
  totalOpenings: number;
  changeWoW: number;
  engineeringPct: number;
  newRoles7d: number;
  recruitmentVelocity: number;
  topCategories: string[];
}

interface CreditCardData {
  merchant: string;
  ticker: string;
  spendGrowthYoY: number;
  transactionGrowthYoY: number;
  avgTicket: number;
  avgTicketChange: number;
  marketShare: number;
  marketShareChange: number;
}

interface PatentData {
  company: string;
  ticker: string;
  filings90d: number;
  granted90d: number;
  changePriorPeriod: number;
  topCategories: string[];
  citationImpact: number;
  rdIntensity: number;
}

interface SocialSignal {
  ticker: string;
  platform: string;
  mentions24h: number;
  change24h: number;
  sentiment: number;
  volume7dAvg: number;
  influencerMentions: number;
  viralScore: number;
}

/* ── Mock Generators ─────────────────────────────────────────────────── */
function generateSatelliteData(): SatelliteData[] {
  const data: SatelliteData[] = [
    { ticker: 'WMT', location: 'US National (4,700 stores)', date: '2024-01-15', parkingLotFill: 78, changeWoW: 3.2, footTrafficIdx: 112, storeCountAffected: 4200, signalStrength: 'buy' },
    { ticker: 'TGT', location: 'US National (1,900 stores)', date: '2024-01-15', parkingLotFill: 65, changeWoW: -2.1, footTrafficIdx: 95, storeCountAffected: 1700, signalStrength: 'sell' },
    { ticker: 'COST', location: 'US National (591 stores)', date: '2024-01-15', parkingLotFill: 82, changeWoW: 5.4, footTrafficIdx: 118, storeCountAffected: 580, signalStrength: 'strong_buy' },
    { ticker: 'HD', location: 'US National (2,300 stores)', date: '2024-01-15', parkingLotFill: 71, changeWoW: 1.8, footTrafficIdx: 104, storeCountAffected: 2100, signalStrength: 'neutral' },
    { ticker: 'LOW', location: 'US National (1,700 stores)', date: '2024-01-15', parkingLotFill: 58, changeWoW: -4.5, footTrafficIdx: 88, storeCountAffected: 1400, signalStrength: 'strong_sell' },
    { ticker: 'SBUX', location: 'US National (16,000 stores)', date: '2024-01-15', parkingLotFill: 74, changeWoW: 2.0, footTrafficIdx: 108, storeCountAffected: 14500, signalStrength: 'buy' },
    { ticker: 'MCD', location: 'US National (13,000 stores)', date: '2024-01-15', parkingLotFill: 69, changeWoW: 0.5, footTrafficIdx: 101, storeCountAffected: 12000, signalStrength: 'neutral' },
    { ticker: 'DG', location: 'US National (19,000 stores)', date: '2024-01-15', parkingLotFill: 62, changeWoW: -1.3, footTrafficIdx: 93, storeCountAffected: 17000, signalStrength: 'sell' },
  ];
  return data;
}

function generateWebTrafficData(): WebTrafficData[] {
  return [
    { domain: 'amazon.com', ticker: 'AMZN', uniqueVisitors: 2800000000, changeWoW: 2.1, changeMoM: 5.3, bounceRate: 28.5, avgSessionDuration: 8.2, pagesPerSession: 6.3, mobileShare: 58.2 },
    { domain: 'apple.com', ticker: 'AAPL', uniqueVisitors: 520000000, changeWoW: 12.5, changeMoM: 18.2, bounceRate: 42.1, avgSessionDuration: 4.5, pagesPerSession: 3.8, mobileShare: 61.5 },
    { domain: 'netflix.com', ticker: 'NFLX', uniqueVisitors: 1100000000, changeWoW: -1.8, changeMoM: 3.2, bounceRate: 15.2, avgSessionDuration: 45.0, pagesPerSession: 2.1, mobileShare: 42.8 },
    { domain: 'tesla.com', ticker: 'TSLA', uniqueVisitors: 180000000, changeWoW: 8.3, changeMoM: 15.7, bounceRate: 38.5, avgSessionDuration: 5.2, pagesPerSession: 4.1, mobileShare: 55.0 },
    { domain: 'shopify.com', ticker: 'SHOP', uniqueVisitors: 95000000, changeWoW: 3.5, changeMoM: 7.8, bounceRate: 35.2, avgSessionDuration: 6.1, pagesPerSession: 4.5, mobileShare: 48.3 },
    { domain: 'meta.com', ticker: 'META', uniqueVisitors: 3200000000, changeWoW: 0.8, changeMoM: 2.1, bounceRate: 22.1, avgSessionDuration: 35.0, pagesPerSession: 15.2, mobileShare: 78.5 },
  ];
}

function generateAppDownloads(): AppDownloads[] {
  return [
    { app: 'Instagram', ticker: 'META', platform: 'Both', downloads7d: 12500000, change7d: 3.2, rating: 4.5, reviews7d: 85000, dau: 2100000000, mau: 2400000000, retention30d: 78 },
    { app: 'TikTok', ticker: 'PRIVATE', platform: 'Both', downloads7d: 18000000, change7d: 5.8, rating: 4.6, reviews7d: 120000, dau: 1500000000, mau: 1800000000, retention30d: 72 },
    { app: 'Spotify', ticker: 'SPOT', platform: 'Both', downloads7d: 5200000, change7d: -1.5, rating: 4.3, reviews7d: 45000, dau: 380000000, mau: 600000000, retention30d: 65 },
    { app: 'Uber', ticker: 'UBER', platform: 'Both', downloads7d: 3800000, change7d: 8.2, rating: 4.1, reviews7d: 32000, dau: 130000000, mau: 150000000, retention30d: 55 },
    { app: 'DoorDash', ticker: 'DASH', platform: 'Both', downloads7d: 2100000, change7d: 12.5, rating: 4.2, reviews7d: 18000, dau: 45000000, mau: 68000000, retention30d: 48 },
    { app: 'Coinbase', ticker: 'COIN', platform: 'Both', downloads7d: 1800000, change7d: 25.0, rating: 3.9, reviews7d: 15000, dau: 12000000, mau: 25000000, retention30d: 38 },
    { app: 'Roblox', ticker: 'RBLX', platform: 'Both', downloads7d: 4500000, change7d: 2.1, rating: 4.4, reviews7d: 55000, dau: 70000000, mau: 200000000, retention30d: 62 },
  ];
}

function generateJobPostings(): JobPostings[] {
  return [
    { company: 'Apple', ticker: 'AAPL', totalOpenings: 2800, changeWoW: 5.2, engineeringPct: 62, newRoles7d: 145, recruitmentVelocity: 1.15, topCategories: ['ML/AI', 'Hardware', 'Software'] },
    { company: 'Google', ticker: 'GOOGL', totalOpenings: 3200, changeWoW: -8.5, engineeringPct: 71, newRoles7d: 82, recruitmentVelocity: 0.85, topCategories: ['Cloud', 'AI', 'Search'] },
    { company: 'Meta', ticker: 'META', totalOpenings: 1500, changeWoW: 12.3, engineeringPct: 68, newRoles7d: 185, recruitmentVelocity: 1.42, topCategories: ['Reality Labs', 'AI', 'Infra'] },
    { company: 'Amazon', ticker: 'AMZN', totalOpenings: 8500, changeWoW: 3.1, engineeringPct: 45, newRoles7d: 265, recruitmentVelocity: 1.08, topCategories: ['AWS', 'Logistics', 'ML'] },
    { company: 'NVIDIA', ticker: 'NVDA', totalOpenings: 1200, changeWoW: 18.5, engineeringPct: 78, newRoles7d: 220, recruitmentVelocity: 1.65, topCategories: ['CUDA', 'AI', 'Datacenter'] },
    { company: 'Tesla', ticker: 'TSLA', totalOpenings: 2100, changeWoW: -2.5, engineeringPct: 55, newRoles7d: 95, recruitmentVelocity: 0.92, topCategories: ['Autopilot', 'Energy', 'Manufacturing'] },
  ];
}

function generateCreditCardData(): CreditCardData[] {
  return [
    { merchant: 'Amazon', ticker: 'AMZN', spendGrowthYoY: 12.5, transactionGrowthYoY: 8.2, avgTicket: 52.30, avgTicketChange: 3.8, marketShare: 38.1, marketShareChange: 1.2 },
    { merchant: 'Walmart', ticker: 'WMT', spendGrowthYoY: 5.8, transactionGrowthYoY: 4.2, avgTicket: 78.50, avgTicketChange: 1.5, marketShare: 12.5, marketShareChange: -0.3 },
    { merchant: 'Costco', ticker: 'COST', spendGrowthYoY: 9.2, transactionGrowthYoY: 6.5, avgTicket: 125.00, avgTicketChange: 2.5, marketShare: 8.2, marketShareChange: 0.8 },
    { merchant: 'Starbucks', ticker: 'SBUX', spendGrowthYoY: 3.5, transactionGrowthYoY: 1.8, avgTicket: 6.85, avgTicketChange: 1.7, marketShare: 42.0, marketShareChange: -0.5 },
    { merchant: 'McDonald\'s', ticker: 'MCD', spendGrowthYoY: 7.8, transactionGrowthYoY: 5.2, avgTicket: 11.20, avgTicketChange: 2.5, marketShare: 35.0, marketShareChange: 0.2 },
    { merchant: 'Home Depot', ticker: 'HD', spendGrowthYoY: -2.5, transactionGrowthYoY: -4.1, avgTicket: 85.00, avgTicketChange: 1.7, marketShare: 28.5, marketShareChange: -1.0 },
    { merchant: 'Nike', ticker: 'NKE', spendGrowthYoY: -5.2, transactionGrowthYoY: -7.8, avgTicket: 95.00, avgTicketChange: 2.8, marketShare: 18.0, marketShareChange: -2.1 },
  ];
}

function generatePatentData(): PatentData[] {
  return [
    { company: 'Apple', ticker: 'AAPL', filings90d: 285, granted90d: 142, changePriorPeriod: 8.5, topCategories: ['Display', 'Biometric', 'Wireless'], citationImpact: 4.2, rdIntensity: 7.8 },
    { company: 'Google', ticker: 'GOOGL', filings90d: 320, granted90d: 185, changePriorPeriod: 12.1, topCategories: ['ML/AI', 'Cloud', 'NLP'], citationImpact: 5.1, rdIntensity: 15.2 },
    { company: 'NVIDIA', ticker: 'NVDA', filings90d: 195, granted90d: 98, changePriorPeriod: 25.5, topCategories: ['GPU', 'AI Accel.', 'Networking'], citationImpact: 6.8, rdIntensity: 27.5 },
    { company: 'Tesla', ticker: 'TSLA', filings90d: 82, granted90d: 45, changePriorPeriod: -5.2, topCategories: ['Battery', 'FSD', 'Manufacturing'], citationImpact: 3.5, rdIntensity: 8.2 },
    { company: 'Microsoft', ticker: 'MSFT', filings90d: 350, granted90d: 210, changePriorPeriod: 15.8, topCategories: ['Cloud', 'AI', 'Security'], citationImpact: 4.8, rdIntensity: 13.1 },
    { company: 'Amazon', ticker: 'AMZN', filings90d: 280, granted90d: 155, changePriorPeriod: 6.2, topCategories: ['Logistics', 'AWS', 'Alexa'], citationImpact: 3.9, rdIntensity: 14.5 },
  ];
}

function generateSocialSignals(): SocialSignal[] {
  return [
    { ticker: 'NVDA', platform: 'Twitter/X', mentions24h: 185000, change24h: 45.2, sentiment: 0.78, volume7dAvg: 125000, influencerMentions: 85, viralScore: 92 },
    { ticker: 'TSLA', platform: 'Reddit', mentions24h: 95000, change24h: -12.5, sentiment: 0.42, volume7dAvg: 110000, influencerMentions: 45, viralScore: 78 },
    { ticker: 'AAPL', platform: 'Twitter/X', mentions24h: 142000, change24h: 8.5, sentiment: 0.65, volume7dAvg: 130000, influencerMentions: 92, viralScore: 85 },
    { ticker: 'GME', platform: 'Reddit', mentions24h: 28000, change24h: 125.0, sentiment: 0.85, volume7dAvg: 12000, influencerMentions: 15, viralScore: 95 },
    { ticker: 'AMZN', platform: 'Twitter/X', mentions24h: 78000, change24h: 3.2, sentiment: 0.58, volume7dAvg: 75000, influencerMentions: 52, viralScore: 62 },
    { ticker: 'META', platform: 'StockTwits', mentions24h: 45000, change24h: 18.5, sentiment: 0.72, volume7dAvg: 38000, influencerMentions: 28, viralScore: 74 },
    { ticker: 'COIN', platform: 'Reddit', mentions24h: 35000, change24h: 65.0, sentiment: 0.68, volume7dAvg: 18000, influencerMentions: 22, viralScore: 88 },
    { ticker: 'PLTR', platform: 'StockTwits', mentions24h: 22000, change24h: 22.5, sentiment: 0.75, volume7dAvg: 18000, influencerMentions: 18, viralScore: 71 },
  ];
}

/* ── Sub-Components ──────────────────────────────────────────────────── */
function SignalBadge({ signal }: { signal: string }) {
  const colors: Record<string, string> = { strong_buy: T.up, buy: '#4CAF50', neutral: T.tx3, sell: T.warn, strong_sell: T.dn };
  const labels: Record<string, string> = { strong_buy: 'STRONG BUY', buy: 'BUY', neutral: 'NEUTRAL', sell: 'SELL', strong_sell: 'STRONG SELL' };
  return (
    <span style={{ fontSize: '7px', fontWeight: 800, color: colors[signal] ?? T.tx3, background: `${colors[signal] ?? T.tx3}18`, padding: '1px 4px', borderRadius: '2px', letterSpacing: '0.3px' }}>
      {labels[signal] ?? signal}
    </span>
  );
}

function SparkLineCanvas({ data, color, width = 80, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    c.width = width * 2; c.height = height * 2;
    ctx.scale(2, 2); ctx.clearRect(0, 0, width, height);
    const mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
    ctx.strokeStyle = color; ctx.lineWidth = 1.2;
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - mn) / rng) * (height - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, color + '30'); grad.addColorStop(1, color + '00');
    ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
  }, [data, color, width, height]);
  return <canvas ref={ref} style={{ width, height }} />;
}

function SatellitePanel({ data }: { data: SatelliteData[] }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '6px' }}>🛰️ Satellite / Foot Traffic</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['Ticker', 'Location', 'Lot Fill%', 'WoW Δ', 'Traffic Idx', 'Stores', 'Signal'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.ticker} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: T.brand, fontWeight: 700, textAlign: 'left' }}>{d.ticker}</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right', fontSize: '7px' }}>{d.location}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  <div style={{ width: '40px', height: '4px', background: T.bg3, borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${d.parkingLotFill}%`, height: '100%', background: d.parkingLotFill > 75 ? T.up : d.parkingLotFill > 50 ? T.warn : T.dn, borderRadius: '2px' }} />
                  </div>
                  <span style={{ color: T.tx1 }}>{d.parkingLotFill}%</span>
                </div>
              </td>
              <td style={{ padding: '3px 4px', color: d.changeWoW >= 0 ? T.up : T.dn, textAlign: 'right' }}>
                {d.changeWoW >= 0 ? '+' : ''}{d.changeWoW.toFixed(1)}%
              </td>
              <td style={{ padding: '3px 4px', color: d.footTrafficIdx >= 100 ? T.up : T.dn, textAlign: 'right' }}>{d.footTrafficIdx}</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{d.storeCountAffected.toLocaleString()}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right' }}><SignalBadge signal={d.signalStrength} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WebTrafficPanel({ data }: { data: WebTrafficData[] }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '6px' }}>🌐 Web Traffic Analytics</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['Domain', 'Ticker', 'Visitors', 'WoW Δ', 'MoM Δ', 'Bounce%', 'Avg Sess', 'Mobile%'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.domain} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: T.tx0, fontWeight: 600, textAlign: 'left' }}>{d.domain}</td>
              <td style={{ padding: '3px 4px', color: T.brand, textAlign: 'right' }}>{d.ticker}</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{(d.uniqueVisitors / 1e6).toFixed(0)}M</td>
              <td style={{ padding: '3px 4px', color: d.changeWoW >= 0 ? T.up : T.dn, textAlign: 'right' }}>{d.changeWoW >= 0 ? '+' : ''}{d.changeWoW.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: d.changeMoM >= 0 ? T.up : T.dn, textAlign: 'right' }}>{d.changeMoM >= 0 ? '+' : ''}{d.changeMoM.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: d.bounceRate > 40 ? T.warn : T.tx1, textAlign: 'right' }}>{d.bounceRate.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{d.avgSessionDuration.toFixed(1)}m</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{d.mobileShare.toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AppDownloadsPanel({ data }: { data: AppDownloads[] }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '6px' }}>📱 App Intelligence</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
        {data.map(d => (
          <div key={d.app} style={{ background: T.bg2, borderRadius: T.r, padding: '8px', border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: T.tx0 }}>{d.app}</span>
              <span style={{ fontSize: '8px', color: T.brand, fontFamily: T.mono }}>{d.ticker}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '8px', fontFamily: T.mono }}>
              <div><span style={{ color: T.tx3 }}>DL 7d: </span><span style={{ color: T.tx1 }}>{(d.downloads7d / 1e6).toFixed(1)}M</span></div>
              <div><span style={{ color: T.tx3 }}>Δ7d: </span><span style={{ color: d.change7d >= 0 ? T.up : T.dn }}>{d.change7d >= 0 ? '+' : ''}{d.change7d.toFixed(1)}%</span></div>
              <div><span style={{ color: T.tx3 }}>DAU: </span><span style={{ color: T.tx1 }}>{(d.dau / 1e6).toFixed(0)}M</span></div>
              <div><span style={{ color: T.tx3 }}>MAU: </span><span style={{ color: T.tx1 }}>{(d.mau / 1e6).toFixed(0)}M</span></div>
              <div><span style={{ color: T.tx3 }}>Rating: </span><span style={{ color: d.rating >= 4.3 ? T.up : T.warn }}>★ {d.rating}</span></div>
              <div><span style={{ color: T.tx3 }}>Ret30: </span><span style={{ color: d.retention30d >= 60 ? T.up : T.warn }}>{d.retention30d}%</span></div>
            </div>
            <SparkLineCanvas data={Array.from({ length: 30 }, (_, i) => d.downloads7d / 7 * (0.8 + Math.random() * 0.4))} color={d.change7d >= 0 ? T.up : T.dn} width={180} height={20} />
          </div>
        ))}
      </div>
    </div>
  );
}

function JobPostingsPanel({ data }: { data: JobPostings[] }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '6px' }}>💼 Job Postings Intelligence</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['Company', 'Ticker', 'Openings', 'WoW Δ', 'Eng%', 'New 7d', 'Velocity', 'Top Areas'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: h === 'Top Areas' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.ticker} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: T.tx0, fontWeight: 600, textAlign: 'left' }}>{d.company}</td>
              <td style={{ padding: '3px 4px', color: T.brand, textAlign: 'right' }}>{d.ticker}</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{d.totalOpenings.toLocaleString()}</td>
              <td style={{ padding: '3px 4px', color: d.changeWoW >= 0 ? T.up : T.dn, textAlign: 'right' }}>{d.changeWoW >= 0 ? '+' : ''}{d.changeWoW.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: d.engineeringPct > 60 ? T.info : T.tx1, textAlign: 'right' }}>{d.engineeringPct}%</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{d.newRoles7d}</td>
              <td style={{ padding: '3px 4px', color: d.recruitmentVelocity > 1 ? T.up : T.dn, textAlign: 'right' }}>{d.recruitmentVelocity.toFixed(2)}x</td>
              <td style={{ padding: '3px 4px', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                  {d.topCategories.map(c => (
                    <span key={c} style={{ fontSize: '6px', background: T.bg3, color: T.tx2, padding: '1px 3px', borderRadius: '2px' }}>{c}</span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreditCardPanel({ data }: { data: CreditCardData[] }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '6px' }}>💳 Credit/Debit Card Spend</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['Merchant', 'Ticker', 'Spend YoY', 'Txn YoY', 'Avg Ticket', 'Ticket Δ', 'Mkt Share', 'Share Δ'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.merchant} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: T.tx0, fontWeight: 600, textAlign: 'left' }}>{d.merchant}</td>
              <td style={{ padding: '3px 4px', color: T.brand, textAlign: 'right' }}>{d.ticker}</td>
              <td style={{ padding: '3px 4px', color: d.spendGrowthYoY >= 0 ? T.up : T.dn, textAlign: 'right' }}>{d.spendGrowthYoY >= 0 ? '+' : ''}{d.spendGrowthYoY.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: d.transactionGrowthYoY >= 0 ? T.up : T.dn, textAlign: 'right' }}>{d.transactionGrowthYoY >= 0 ? '+' : ''}{d.transactionGrowthYoY.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>${d.avgTicket.toFixed(2)}</td>
              <td style={{ padding: '3px 4px', color: d.avgTicketChange >= 0 ? T.up : T.dn, textAlign: 'right' }}>{d.avgTicketChange >= 0 ? '+' : ''}{d.avgTicketChange.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{d.marketShare.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: d.marketShareChange >= 0 ? T.up : T.dn, textAlign: 'right' }}>{d.marketShareChange >= 0 ? '+' : ''}{d.marketShareChange.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PatentPanel({ data }: { data: PatentData[] }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '6px' }}>📄 Patent Filings Analytics</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', fontFamily: T.mono }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border2}` }}>
            {['Company', 'Ticker', 'Filed 90d', 'Granted', 'Δ Prior', 'Citation', 'R&D Int.', 'Focus Areas'].map(h => (
              <th key={h} style={{ padding: '3px 4px', color: T.tx3, textAlign: h === 'Focus Areas' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.ticker} style={{ borderBottom: `1px solid ${T.border}` }}>
              <td style={{ padding: '3px 4px', color: T.tx0, fontWeight: 600, textAlign: 'left' }}>{d.company}</td>
              <td style={{ padding: '3px 4px', color: T.brand, textAlign: 'right' }}>{d.ticker}</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{d.filings90d}</td>
              <td style={{ padding: '3px 4px', color: T.tx1, textAlign: 'right' }}>{d.granted90d}</td>
              <td style={{ padding: '3px 4px', color: d.changePriorPeriod >= 0 ? T.up : T.dn, textAlign: 'right' }}>{d.changePriorPeriod >= 0 ? '+' : ''}{d.changePriorPeriod.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', color: d.citationImpact >= 5 ? T.up : T.tx1, textAlign: 'right' }}>{d.citationImpact.toFixed(1)}</td>
              <td style={{ padding: '3px 4px', color: T.tx2, textAlign: 'right' }}>{d.rdIntensity.toFixed(1)}%</td>
              <td style={{ padding: '3px 4px', textAlign: 'left' }}>
                {d.topCategories.map(c => (
                  <span key={c} style={{ fontSize: '6px', background: T.bg3, color: T.tx2, padding: '1px 3px', borderRadius: '2px', marginRight: '2px' }}>{c}</span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SocialSignalsPanel({ data }: { data: SocialSignal[] }) {
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '6px' }}>📣 Social Signals</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
        {data.map(d => (
          <div key={`${d.ticker}-${d.platform}`} style={{ background: T.bg2, borderRadius: T.r, padding: '8px', border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: T.brand }}>{d.ticker}</span>
              <span style={{ fontSize: '7px', color: T.tx3, background: T.bg3, padding: '1px 4px', borderRadius: '2px' }}>{d.platform}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', fontSize: '8px', fontFamily: T.mono }}>
              <div><span style={{ color: T.tx3 }}>24h: </span><span style={{ color: T.tx1 }}>{(d.mentions24h / 1000).toFixed(0)}K</span></div>
              <div><span style={{ color: T.tx3 }}>Δ24h: </span><span style={{ color: d.change24h >= 0 ? T.up : T.dn }}>{d.change24h >= 0 ? '+' : ''}{d.change24h.toFixed(0)}%</span></div>
              <div><span style={{ color: T.tx3 }}>Sent: </span>
                <span style={{ color: d.sentiment > 0.6 ? T.up : d.sentiment > 0.4 ? T.warn : T.dn }}>{(d.sentiment * 100).toFixed(0)}%</span>
              </div>
              <div><span style={{ color: T.tx3 }}>Viral: </span><span style={{ color: d.viralScore >= 80 ? T.up : T.tx1 }}>{d.viralScore}</span></div>
            </div>
            {/* Sentiment bar */}
            <div style={{ marginTop: '4px', height: '3px', background: T.bg3, borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${d.sentiment * 100}%`, height: '100%', background: d.sentiment > 0.6 ? T.up : d.sentiment > 0.4 ? T.warn : T.dn, borderRadius: '2px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AltDataComposite({ satellite, social }: { satellite: SatelliteData[]; social: SocialSignal[] }) {
  // Aggregate composite scores for tickers that appear in both
  const tickers = new Set([...satellite.map(s => s.ticker), ...social.map(s => s.ticker)]);
  const scores = Array.from(tickers).map(t => {
    const sat = satellite.find(s => s.ticker === t);
    const soc = social.find(s => s.ticker === t);
    const satScore = sat ? (sat.parkingLotFill / 100 * 0.4 + (sat.footTrafficIdx / 120) * 0.3 + (sat.changeWoW > 0 ? 0.3 : 0)) : 0.5;
    const socScore = soc ? (soc.sentiment * 0.4 + Math.min(soc.viralScore / 100, 1) * 0.3 + (soc.change24h > 0 ? 0.3 : 0)) : 0.5;
    const composite = ((satScore + socScore) / 2 * 100).toFixed(0);
    return { ticker: t, satScore: (satScore * 100).toFixed(0), socScore: (socScore * 100).toFixed(0), composite };
  }).sort((a, b) => +b.composite - +a.composite);

  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r, padding: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: T.tx0, marginBottom: '6px' }}>🎯 Composite Alt-Data Score</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '6px' }}>
        {scores.map(s => {
          const c = +s.composite;
          const color = c >= 70 ? T.up : c >= 40 ? T.warn : T.dn;
          return (
            <div key={s.ticker} style={{ background: T.bg2, borderRadius: T.r, padding: '8px', border: `1px solid ${T.border}`, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: T.brand, marginBottom: '4px' }}>{s.ticker}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color, fontFamily: T.mono }}>{s.composite}</div>
              <div style={{ fontSize: '7px', color: T.tx3, marginTop: '2px' }}>
                SAT:{s.satScore} | SOC:{s.socScore}
              </div>
              <div style={{ height: '3px', background: T.bg3, borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                <div style={{ width: `${c}%`, height: '100%', background: color, borderRadius: '2px' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */
const TABS = ['satellite', 'webtraffic', 'appdata', 'jobs', 'creditcard', 'patents', 'social', 'composite'] as const;
type Tab = typeof TABS[number];
const TAB_LABELS: Record<Tab, string> = {
  satellite: '🛰️ Satellite', webtraffic: '🌐 Web Traffic', appdata: '📱 App Intel',
  jobs: '💼 Jobs', creditcard: '💳 Card Spend', patents: '📄 Patents',
  social: '📣 Social', composite: '🎯 Composite',
};

export default function AltDataUI2() {
  const [tab, setTab] = useState<Tab>('satellite');
  const satellite = useMemo(() => generateSatelliteData(), []);
  const webTraffic = useMemo(() => generateWebTrafficData(), []);
  const appDownloads = useMemo(() => generateAppDownloads(), []);
  const jobPostings = useMemo(() => generateJobPostings(), []);
  const creditCard = useMemo(() => generateCreditCardData(), []);
  const patents = useMemo(() => generatePatentData(), []);
  const socialSignals = useMemo(() => generateSocialSignals(), []);

  return (
    <div data-testid="alt-data-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg0, fontFamily: T.sans, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', gap: '8px', background: T.bg1, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.tx0 }}>ALTERNATIVE DATA</span>
        <div style={{ height: 14, width: 1, background: T.border2 }} />
        <span style={{ fontSize: '9px', color: T.tx2 }}>Real-time non-traditional data signals</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '8px', color: T.tx3 }}>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1px', background: T.bg1, borderBottom: `1px solid ${T.border}`, overflowX: 'auto', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? T.bg3 : 'transparent', color: tab === t ? T.tx0 : T.tx3,
            border: 'none', padding: '6px 12px', fontSize: '9px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            borderBottom: tab === t ? `2px solid ${T.brand}` : '2px solid transparent',
          }}>{TAB_LABELS[t]}</button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {tab === 'satellite' && <SatellitePanel data={satellite} />}
        {tab === 'webtraffic' && <WebTrafficPanel data={webTraffic} />}
        {tab === 'appdata' && <AppDownloadsPanel data={appDownloads} />}
        {tab === 'jobs' && <JobPostingsPanel data={jobPostings} />}
        {tab === 'creditcard' && <CreditCardPanel data={creditCard} />}
        {tab === 'patents' && <PatentPanel data={patents} />}
        {tab === 'social' && <SocialSignalsPanel data={socialSignals} />}
        {tab === 'composite' && <AltDataComposite satellite={satellite} social={socialSignals} />}
      </div>
    </div>
  );
}

export { AltDataUI2 };
