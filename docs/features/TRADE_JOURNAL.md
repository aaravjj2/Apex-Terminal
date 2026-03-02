# Trading Journal

Comprehensive trade logging with performance analytics, emotional state tracking, strategy tagging, win/loss analysis, journal insights, and screenshot attachments.

## Table of Contents

- [Overview](#overview)
- [Trade Entry Logging](#trade-entry-logging)
- [Performance Tracking](#performance-tracking)
- [Emotional State Tracking](#emotional-state-tracking)
- [Strategy Tagging](#strategy-tagging)
- [Win/Loss Analysis](#win-loss-analysis)
- [Journal Analytics](#journal-analytics)
- [Screenshot Attachment](#screenshot-attachment)
- [Component Usage](#component-usage)

## Overview

The `TradeJournal` component (`components/trading/TradeJournal`) provides a structured system for recording, analyzing, and learning from every trade. It bridges quantitative performance data with qualitative self-assessment to improve trading discipline.

```typescript
import { TradeJournal } from '@/components/trading/TradeJournal';
import { useJournalStore } from '@/stores/journalStore';

const { addEntry, getEntries, getAnalytics } = useJournalStore();
```

## Trade Entry Logging

Record detailed trade information at entry and exit:

```typescript
interface JournalEntry {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryDate: number;
  exitDate: number | null;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  fees: number;
  pnl: number | null;
  pnlPercent: number | null;
  strategy: string;
  timeframe: string;
  setup: string;                  // description of the trade setup
  thesis: string;                 // reasoning for the trade
  execution: string;              // notes on execution quality
  mistakes: string[];
  lessons: string[];
  emotionalState: EmotionalState;
  confidence: number;             // 1-10 pre-trade confidence
  riskRewardRatio: number;
  tags: string[];
  screenshots: Screenshot[];
  status: 'open' | 'closed' | 'cancelled';
}

addEntry({
  symbol: 'NVDA',
  direction: 'long',
  entryPrice: 890,
  quantity: 50,
  strategy: 'breakout',
  thesis: 'Breaking out of 3-month consolidation with AI catalyst',
  confidence: 8,
  riskRewardRatio: 3.2,
  emotionalState: { mood: 'focused', stress: 3, fomo: 1, greed: 2 },
  tags: ['breakout', 'AI', 'momentum'],
});
```

Open positions auto-update P&L from the real-time feed. Close entries can be logged manually or auto-detected.

## Performance Tracking

Aggregate performance metrics across all journal entries:

```typescript
interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;        // gross profit / gross loss
  expectancy: number;          // avg profit per trade
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgHoldingPeriod: string;
  bestTrade: JournalEntry;
  worstTrade: JournalEntry;
  sharpeRatio: number;
  maxDrawdown: number;
  equityCurve: { date: number; equity: number }[];
}

const metrics = getAnalytics({
  period: { from: '2026-01-01', to: '2026-03-01' },
  strategies: ['breakout', 'mean-reversion'],
});
```

The equity curve chart plots cumulative P&L over time with drawdown shading.

## Emotional State Tracking

Capture psychological factors influencing trade decisions:

```typescript
interface EmotionalState {
  mood: 'focused' | 'anxious' | 'confident' | 'frustrated' | 'neutral' | 'euphoric';
  stress: number;        // 1-10 scale
  fomo: number;          // 1-10 fear of missing out
  greed: number;         // 1-10
  revenge: boolean;      // trading to recover losses
  overtrading: boolean;  // excessive position frequency
  notes: string;
}
```

Emotional data correlates with trade outcomes in the analytics dashboard, revealing patterns like "trades taken when stress > 7 have a 28% win rate" — enabling data-driven behavioral improvement.

## Strategy Tagging

Categorize trades by strategy for segmented analysis:

```typescript
const strategies = [
  'breakout', 'mean-reversion', 'trend-following', 'scalp',
  'swing', 'earnings-play', 'gap-fill', 'support-bounce',
  'momentum', 'pairs-trade', 'dividend-capture',
];

const strategyBreakdown = getAnalytics({ groupBy: 'strategy' });
// Per strategy: winRate, avgPnl, profitFactor, tradeCount, avgHoldingPeriod
// Identifies which strategies are actually profitable vs perceived
```

Custom tags can be created freely. The system suggests tags based on trade characteristics (timeframe, setup pattern, conditions).

## Win/Loss Analysis

Detailed breakdown of winning and losing trades:

```typescript
const winLossAnalysis = getAnalytics({ analysis: 'win-loss' });

// winLossAnalysis:
// {
//   wins: { count, avgSize, avgHoldTime, topStrategies, commonSetups },
//   losses: { count, avgSize, avgHoldTime, commonMistakes, avgExcessLoss },
//   breakeven: { count },
//   distributionChart: histogram of P&L per trade,
//   riskRewardActual: actual R:R vs planned R:R,
//   timeOfDayAnalysis: win rate by hour of entry,
//   dayOfWeekAnalysis: win rate by day,
// }
```

The distribution chart reveals if losses cluster around a specific size (suggesting stop discipline) or show fat tails (risk management issues).

## Journal Analytics

AI-assisted insights from journal data:

```typescript
const insights = getAnalytics({ type: 'insights' });

// insights: [
//   { type: 'pattern', message: 'Win rate drops to 31% on Mondays — consider sitting out', severity: 'warning' },
//   { type: 'behavioral', message: 'Trades with FOMO > 6 lose money 73% of the time', severity: 'critical' },
//   { type: 'positive', message: 'Breakout strategy has improved from 45% to 62% win rate over 3 months', severity: 'info' },
//   { type: 'risk', message: 'Average loss is 2.1x larger than planned — tighten stop execution', severity: 'warning' },
// ]
```

Insights generate weekly summaries highlighting behavioral patterns, strategy performance trends, and actionable improvement suggestions.

## Screenshot Attachment

Attach chart screenshots to journal entries for visual review:

```typescript
interface Screenshot {
  id: string;
  dataUrl: string;
  caption: string;
  timestamp: number;
  chartConfig: {
    symbol: string;
    timeframe: string;
    indicators: string[];
    drawings: string[];
  };
}

// Auto-capture on trade entry
addEntry({
  // ... trade details ...
  screenshots: [
    await captureChart({ chartId: 'main', annotation: 'Entry point' }),
  ],
});

// Add exit screenshot later
updateEntry(entryId, {
  screenshots: [...existing, await captureChart({ annotation: 'Exit — target hit' })],
});
```

Screenshots are stored in IndexedDB with compression. The journal viewer displays them in a lightbox gallery with before/after comparison for entry and exit.

## Component Usage

The `TradeJournal` component provides the full journaling interface:

```tsx
<TradeJournal
  defaultView="list"             // 'list' | 'calendar' | 'analytics'
  showPerformanceHeader={true}
  showInsights={true}
  enableAutoCapture={true}       // auto-screenshot on trade execution
  groupBy="date"                 // 'date' | 'strategy' | 'symbol' | 'status'
  onEntryClick={(entry) => navigateToChart(entry.symbol, entry.entryDate)}
/>
```

The calendar view displays trades on a date grid with color-coded P&L, providing a quick visual overview of trading activity and results.
