# Economic Calendar

Comprehensive economic event calendar with impact ratings, consensus vs actual tracking, historical comparisons, smart filtering, and notification triggers.

## Table of Contents

- [Overview](#overview)
- [Event Calendar](#event-calendar)
- [Impact Ratings](#impact-ratings)
- [Consensus vs Actual](#consensus-vs-actual)
- [Historical Comparison](#historical-comparison)
- [Event Filtering](#event-filtering)
- [Notification Triggers](#notification-triggers)
- [EconomicDashboard Component](#economicdashboard-component)

## Overview

The economic calendar module (`lib/marketData/economics.ts`) tracks scheduled macroeconomic releases worldwide — central bank decisions, employment reports, GDP, inflation, PMI, and more. Events are ranked by market impact and integrated with chart annotations.

```typescript
import { EconomicsCalendar } from '@/lib/marketData/economics';
import { EconomicDashboard } from '@/components/pages/EconomicDashboard';

const calendar = new EconomicsCalendar({ regions: ['US', 'EU', 'UK', 'JP', 'CN'] });
```

## Event Calendar

Structured event data with forward-looking schedules:

```typescript
interface EconomicEvent {
  id: string;
  name: string;
  country: string;
  currency: string;
  category: EventCategory;
  dateTime: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  consensus: number | null;
  previous: number | null;
  actual: number | null;
  unit: string;
  description: string;
  sourceUrl: string;
}

type EventCategory =
  | 'central-bank' | 'employment' | 'gdp' | 'inflation'
  | 'pmi' | 'retail' | 'housing' | 'trade-balance'
  | 'consumer-confidence' | 'industrial-production';

const events = await calendar.getEvents({
  dateRange: { from: '2026-03-01', to: '2026-03-07' },
  regions: ['US'],
  minImpact: 'medium',
});
```

The calendar sources data from central bank schedules, statistical agencies, and financial data providers, refreshing every 15 minutes.

## Impact Ratings

Each event receives an impact score based on historical market reaction magnitude:

```typescript
interface ImpactAnalysis {
  rating: 'low' | 'medium' | 'high' | 'critical';
  avgMoveSpx: number;           // average S&P 500 move on release
  avgMoveFx: number;            // average currency pair move (pips)
  avgMoveBonds: number;         // average 10Y yield move (bps)
  volatilityMultiple: number;   // implied vol increase around event
  historicalSurprises: number;  // % of times actual differed significantly from consensus
}

const impact = calendar.getImpactAnalysis('US Non-Farm Payrolls');
// { rating: 'critical', avgMoveSpx: 0.85, avgMoveFx: 45, ... }
```

Critical events (FOMC decisions, NFP, CPI) display a countdown timer in the status bar.

## Consensus vs Actual

Track deviations between market expectations and actual releases:

```typescript
interface ReleaseComparison {
  event: string;
  date: number;
  consensus: number;
  actual: number;
  deviation: number;           // actual - consensus
  deviationPercent: number;
  surprise: 'positive' | 'negative' | 'inline';
  marketReaction: {
    spx5min: number;
    dxy5min: number;
    vix5min: number;
    bonds10y5min: number;
  };
}

const comparison = calendar.getLatestRelease('US CPI YoY');
// { consensus: 2.8, actual: 2.6, deviation: -0.2, surprise: 'negative', ... }
```

A surprise indicator widget shows whether the release beat, missed, or matched consensus with color-coded severity.

## Historical Comparison

Compare current releases against historical data for context:

```typescript
const history = calendar.getEventHistory('US Non-Farm Payrolls', {
  periods: 24,       // last 24 releases
  includeRevisions: true,
});

// history: [{
//   date, consensus, actual, revised, deviation,
//   marketReaction: { spx, dxy, vix, bonds },
//   percentileRank: 0.75,  // where this reading falls historically
// }, ...]
```

Historical trend charts overlay actual values, consensus estimates, and market reactions on a unified timeline, highlighting regime changes and trends.

## Event Filtering

Flexible filtering for the calendar view:

```typescript
const { setCalendarFilter } = useCalendarStore();

setCalendarFilter({
  regions: ['US', 'EU'],
  categories: ['central-bank', 'inflation', 'employment'],
  impact: ['high', 'critical'],
  dateRange: { from: '2026-03-01', to: '2026-03-31' },
  searchQuery: 'fed',
  showPastEvents: true,        // include already-released events
  onlyWithSurprise: false,     // filter to only surprise outcomes
});
```

A weekly summary view condenses the most important upcoming events into a prioritized list with countdown timers.

## Notification Triggers

Automated alerts around economic events:

```typescript
const { createEventAlert } = useCalendarStore();

createEventAlert({
  eventName: 'FOMC Rate Decision',
  triggers: [
    {
      type: 'before',
      minutesBefore: 30,
      notification: { channels: ['sound', 'push'], message: 'FOMC decision in 30 minutes' },
    },
    {
      type: 'on-release',
      notification: { channels: ['sound', 'push', 'webhook'] },
      includeData: true,       // include actual vs consensus in notification
    },
    {
      type: 'surprise',
      deviationThreshold: 0.25, // trigger only if deviation exceeds threshold
      notification: { channels: ['sound', 'push'] },
    },
  ],
});
```

Surprise triggers fire only when the actual value deviates significantly from consensus, reducing noise for inline releases.

## EconomicDashboard Component

The full-featured calendar dashboard:

```tsx
<EconomicDashboard
  defaultView="week"           // 'day' | 'week' | 'month'
  showImpactFilter={true}
  showRegionTabs={true}
  showHistoricalChart={true}
  highlightUpcoming={true}
  countdownThresholdMinutes={60}
  onEventClick={(event) => navigateToChart(event)}
/>
```

The dashboard features a timeline view with event cards, impact color coding (gray/yellow/orange/red), and expandable detail panels showing historical context and market reaction data. Chart annotations automatically mark high-impact events on the active price chart.
