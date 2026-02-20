/**
 * UI2 Demo Fixtures - Realistic Trading Terminal Data
 * For showcasing premium components in all workspaces
 */

import type { Insight } from '../components/InsightsPanel';
import type { KPIItem } from '../components/KPIStrip';

/* ===================================================================
   KPI STRIP DATA
   =================================================================== */

export const DEMO_KPIS: KPIItem[] = [
  {
    id: 'portfolio-value',
    label: 'Portfolio Value',
    value: '$1,247,589',
    change: { direction: 'up', value: '+2.34%', label: '+2.34%' },
    status: 'success',
    description: 'Total account value',
  },
  {
    id: 'daily-pnl',
    label: 'Daily P&L',
    value: '+$12,450',
    change: { direction: 'up', value: '+1.02%', label: '+1.02%' },
    status: 'success',
    description: 'Today profit/loss',
  },
  {
    id: 'open-positions',
    label: 'Open Positions',
    value: '18',
    change: { direction: 'neutral', value: '0', label: 'Unchanged' },
    status: 'neutral',
    description: 'Active holdings',
  },
  {
    id: 'options-delta',
    label: 'Portfolio Delta',
    value: '+145.2',
    change: { direction: 'up', value: '+8.5', label: '+8.5' },
    status: 'warning',
    description: 'Net directional exposure',
  },
  {
    id: 'theta-decay',
    label: 'Daily Theta',
    value: '+$324',
    change: { direction: 'up', value: '$324', label: 'Collecting' },
    status: 'success',
    description: 'Time decay income',
  },
  {
    id: 'win-rate',
    label: 'Win Rate (30d)',
    value: '68.5%',
    change: { direction: 'up', value: '+3.2%', label: '+3.2%' },
    status: 'success',
    description: 'Profitable trades ratio',
  },
];

/* ===================================================================
   ORDERS TABLE DATA
   =================================================================== */

export interface Order {
  id: string;
  timestamp: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'market' | 'stop';
  quantity: number;
  price: number | null;
  filled: number;
  status: 'queued' | 'working' | 'filled' | 'rejected' | 'canceled';
}

export const DEMO_ORDERS: Order[] = [
  {
    id: 'ORD-2024-001',
    timestamp: '2024-02-08 09:30:15',
    symbol: 'AAPL',
    side: 'buy',
    type: 'limit',
    quantity: 100,
    price: 175.25,
    filled: 100,
    status: 'filled',
  },
  {
    id: 'ORD-2024-002',
    timestamp: '2024-02-08 10:15:42',
    symbol: 'TSLA',
    side: 'sell',
    type: 'market',
    quantity: 50,
    price: null,
    filled: 50,
    status: 'filled',
  },
  {
    id: 'ORD-2024-003',
    timestamp: '2024-02-08 13:45:18',
    symbol: 'SPY',
    side: 'buy',
    type: 'limit',
    quantity: 200,
    price: 485.50,
    filled: 150,
    status: 'working',
  },
  {
    id: 'ORD-2024-004',
    timestamp: '2024-02-08 14:22:33',
    symbol: 'MSFT',
    side: 'buy',
    type: 'limit',
    quantity: 75,
    price: 420.00,
    filled: 0,
    status: 'queued',
  },
  {
    id: 'ORD-2024-005',
    timestamp: '2024-02-08 11:05:09',
    symbol: 'NVDA',
    side: 'sell',
    type: 'stop',
    quantity: 30,
    price: 895.00,
    filled: 0,
    status: 'canceled',
  },
];

/* ===================================================================
   POSITIONS TABLE DATA
   =================================================================== */

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  marketPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

export const DEMO_POSITIONS: Position[] = [
  {
    symbol: 'AAPL',
    quantity: 100,
    avgPrice: 172.50,
    marketPrice: 175.25,
    marketValue: 17525,
    pnl: 275,
    pnlPercent: 1.59,
    dayChange: 125,
    dayChangePercent: 0.72,
  },
  {
    symbol: 'TSLA',
    quantity: -50,
    avgPrice: 256.75,
    marketPrice: 250.25,
    marketValue: -12512.50,
    pnl: 325,
    pnlPercent: 2.65,
    dayChange: -187.50,
    dayChangePercent: -1.52,
  },
  {
    symbol: 'SPY',
    quantity: 200,
    avgPrice: 482.00,
    marketPrice: 485.50,
    marketValue: 97100,
    pnl: 700,
    pnlPercent: 0.72,
    dayChange: 400,
    dayChangePercent: 0.41,
  },
  {
    symbol: 'NVDA',
    quantity: 50,
    avgPrice: 880.00,
    marketPrice: 895.00,
    marketValue: 44750,
    pnl: 750,
    pnlPercent: 1.70,
    dayChange: 625,
    dayChangePercent: 1.41,
  },
];

/* ===================================================================
   AI INSIGHTS PANEL DATA
   =================================================================== */

export const DEMO_INSIGHTS: Insight[] = [
  {
    id: 'insight-001',
    title: 'High IV Opportunity Detected',
    description: 'AAPL implied volatility trading at 95th percentile vs 30-day average. Consider selling premium via covered calls or credit spreads to capture elevated premiums.',
    urgency: 'high',
    confidence: 0.82,
    actions: [
      { label: 'View Chain', onClick: () => console.log('View AAPL options chain') },
      { label: 'Build Strategy', onClick: () => console.log('Open strategy builder') },
    ],
    timestamp: new Date('2024-02-08T14:30:00'),
    category: 'volatility',
  },
  {
    id: 'insight-002',
    title: 'Portfolio Delta Imbalance',
    description: 'Net delta exposure at +145 suggests bullish bias. Consider adding SPY puts or selling calls to reduce directional risk and improve gamma scalping opportunities.',
    urgency: 'medium',
    confidence: 0.72,
    actions: [
      { label: 'Review Greeks', onClick: () => console.log('Show Greeks dashboard') },
      { label: 'Add Hedge', onClick: () => console.log('Open hedge builder') },
    ],
    timestamp: new Date('2024-02-08T13:15:00'),
    category: 'risk',
  },
  {
    id: 'insight-003',
    title: 'Mean Reversion Signal: TSLA',
    description: 'TSLA trading 2.5 standard deviations below 20-day moving average. Historical back-tests show 78% win rate for long entries at this level with 3-5 day holding period.',
    urgency: 'medium',
    confidence: 0.68,
    actions: [
      { label: 'Place Order', onClick: () => console.log('Create TSLA order') },
      { label: 'View Chart', onClick: () => console.log('Open TSLA chart') },
    ],
    timestamp: new Date('2024-02-08T11:45:00'),
    category: 'strategy',
  },
  {
    id: 'insight-004',
    title: 'Theta Decay Optimization',
    description: 'Daily theta collection at $324 represents 0.026% of portfolio value. With current IV levels, could increase to 0.040% by adding 2-3 additional short positions at 30-45 DTE.',
    urgency: 'low',
    confidence: 0.91,
    actions: [
      { label: 'Roll Positions', onClick: () => console.log('Open roll tool') },
      { label: 'View Expirations', onClick: () => console.log('Show expiration calendar') },
    ],
    timestamp: new Date('2024-02-08T09:00:00'),
    category: 'income',
  },
];

/* ===================================================================
   OPTIONS CHAIN DATA (Mock)
   =================================================================== */

export interface OptionQuote {
  strike: number;
  callBid: number;
  callAsk: number;
  callVolume: number;
  callOI: number;
  callDelta: number;
  callGamma: number;
  callTheta: number;
  callVega: number;
  putBid: number;
  putAsk: number;
  putVolume: number;
  putOI: number;
  putDelta: number;
  putGamma: number;
  putTheta: number;
  putVega: number;
}

export const DEMO_OPTIONS_CHAIN: OptionQuote[] = [
  {
    strike: 170,
    callBid: 5.80,
    callAsk: 5.90,
    callVolume: 1250,
    callOI: 8940,
    callDelta: 0.68,
    callGamma: 0.024,
    callTheta: -0.08,
    callVega: 0.12,
    putBid: 0.45,
    putAsk: 0.50,
    putVolume: 420,
    putOI: 3210,
    putDelta: -0.32,
    putGamma: 0.024,
    putTheta: -0.05,
    putVega: 0.12,
  },
  {
    strike: 175,
    callBid: 2.15,
    callAsk: 2.25,
    callVolume: 3840,
    callOI: 15620,
    callDelta: 0.52,
    callGamma: 0.032,
    callTheta: -0.12,
    callVega: 0.18,
    putBid: 1.90,
    putAsk: 2.00,
    putVolume: 2970,
    putOI: 12840,
    putDelta: -0.48,
    putGamma: 0.032,
    putTheta: -0.11,
    putVega: 0.18,
  },
  {
    strike: 180,
    callBid: 0.65,
    callAsk: 0.70,
    callVolume: 1920,
    callOI: 9560,
    callDelta: 0.35,
    callGamma: 0.028,
    callTheta: -0.09,
    callVega: 0.15,
    putBid: 5.30,
    putAsk: 5.45,
    putVolume: 890,
    putOI: 6730,
    putDelta: -0.65,
    putGamma: 0.028,
    putTheta: -0.07,
    putVega: 0.15,
  },
];
