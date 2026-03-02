# Forex Analytics

Apex Terminal's forex module in `lib/assetClasses/forex/` delivers comprehensive FX analytics — currency pair analysis, pip calculations, cross rate derivation, carry trade evaluation, correlation analysis, economic calendar integration, and trading session overlap visualization.

## Table of Contents

- [Overview](#overview)
- [Currency Pair Analysis](#currency-pair-analysis)
- [Pip Calculator](#pip-calculator)
- [Cross Rates](#cross-rates)
- [Carry Trade Analysis](#carry-trade-analysis)
- [Correlation Analysis](#correlation-analysis)
- [Economic Calendar Integration](#economic-calendar-integration)
- [Session Overlaps](#session-overlaps)
- [FX-Specific Indicators](#fx-specific-indicators)

## Overview

The forex module is tailored to the unique characteristics of the FX market — 24-hour trading across sessions, pip-based pricing, interest rate differentials, and high inter-pair correlations:

```typescript
// lib/assetClasses/forex/types.ts
export interface CurrencyPair {
  base: string;         // e.g., 'EUR'
  quote: string;        // e.g., 'USD'
  symbol: string;       // e.g., 'EUR/USD'
  pipSize: number;      // 0.0001 for most, 0.01 for JPY pairs
  lotSize: number;      // standard lot = 100,000 units
  tickValue: number;    // $ value per pip per standard lot
  marginRate: number;   // required margin percentage
  spread: number;       // typical spread in pips
  swapLong: number;     // overnight swap for long positions
  swapShort: number;    // overnight swap for short positions
}

export const MAJOR_PAIRS: CurrencyPair[] = [
  { base: 'EUR', quote: 'USD', symbol: 'EUR/USD', pipSize: 0.0001, lotSize: 100000, tickValue: 10, marginRate: 0.02, spread: 0.8, swapLong: -3.2, swapShort: 1.1 },
  { base: 'GBP', quote: 'USD', symbol: 'GBP/USD', pipSize: 0.0001, lotSize: 100000, tickValue: 10, marginRate: 0.02, spread: 1.2, swapLong: -2.8, swapShort: 0.7 },
  { base: 'USD', quote: 'JPY', symbol: 'USD/JPY', pipSize: 0.01,   lotSize: 100000, tickValue: 6.7, marginRate: 0.02, spread: 0.9, swapLong: 5.4, swapShort: -8.1 },
  // ... additional pairs
];
```

## Currency Pair Analysis

The pair analysis panel provides a comprehensive single-pair view:

- **Rate display** — real-time bid/ask with spread indicator.
- **Daily range** — high/low bar with current price marker.
- **Key levels** — daily/weekly pivots, support/resistance.
- **Sentiment gauge** — long/short positioning ratio from broker data.
- **Statistics** — daily range (pips), average daily range (20-day), 1D/1W/1M change.

```typescript
export function pairStatistics(pair: CurrencyPair, ohlcv: OHLCVData[]): PairStats {
  const latest = ohlcv[ohlcv.length - 1];
  const adr = averageDailyRange(ohlcv, 20);

  return {
    currentRate: latest.close,
    dailyHigh: latest.high,
    dailyLow: latest.low,
    dailyRangePips: (latest.high - latest.low) / pair.pipSize,
    averageDailyRange: adr / pair.pipSize,
    change1D: (latest.close - ohlcv[ohlcv.length - 2].close) / pair.pipSize,
    volatility: historicalVolatility(ohlcv, 21),
  };
}
```

## Pip Calculator

The pip calculator computes position sizing, profit/loss, and margin requirements:

```typescript
export function pipValue(pair: CurrencyPair, lotSize: number, accountCurrency: string): number {
  const pipInQuote = pair.pipSize * lotSize;
  if (pair.quote === accountCurrency) return pipInQuote;
  const conversionRate = getRate(`${pair.quote}/${accountCurrency}`);
  return pipInQuote * conversionRate;
}

export function positionPnL(
  pair: CurrencyPair, entryPrice: number, exitPrice: number,
  lots: number, side: 'buy' | 'sell'
): PnLResult {
  const priceDiff = side === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice;
  const pips = priceDiff / pair.pipSize;
  const profit = pips * pipValue(pair, pair.lotSize * lots, 'USD');

  return { pips, profit, pipsPerLot: pips, profitPerLot: profit / lots };
}

export function requiredMargin(pair: CurrencyPair, lots: number, accountCurrency: string): number {
  const notional = lots * pair.lotSize * getRate(`${pair.base}/${accountCurrency}`);
  return notional * pair.marginRate;
}
```

## Cross Rates

Cross rate calculation derives synthetic pairs through a common base currency:

```typescript
export function crossRate(base: string, quote: string, rates: RateMap): number {
  const direct = rates[`${base}/${quote}`];
  if (direct) return direct;

  const baseUsd = rates[`${base}/USD`] ?? 1 / rates[`USD/${base}`];
  const quoteUsd = rates[`${quote}/USD`] ?? 1 / rates[`USD/${quote}`];
  return baseUsd / quoteUsd;
}

export function crossRateMatrix(currencies: string[], rates: RateMap): number[][] {
  return currencies.map(base =>
    currencies.map(quote => base === quote ? 1 : crossRate(base, quote, rates))
  );
}
```

The cross rate matrix displays as an interactive table where each cell shows the exchange rate between the row and column currencies, color-coded by 24-hour change direction.

## Carry Trade Analysis

Carry trade analytics evaluate opportunities from interest rate differentials:

```typescript
export interface CarryTradeAnalysis {
  pair: string;
  longCurrency: string;
  shortCurrency: string;
  rateSpread: number;          // annualized interest rate differential
  dailyCarry: number;          // daily carry in pips
  annualizedCarry: number;     // annualized carry in account currency
  breakEvenMove: number;       // adverse price move that offsets carry (pips)
  sharpeOfCarry: number;       // carry / volatility
}

export function analyzeCarryTrade(
  pair: CurrencyPair,
  baseRate: number,
  quoteRate: number,
  volatility: number
): CarryTradeAnalysis {
  const rateSpread = baseRate - quoteRate;
  const dailyCarry = (rateSpread / 365) * pair.lotSize * pair.pipSize;
  const annualizedCarry = rateSpread * pair.lotSize;
  const breakEvenMove = annualizedCarry / (pair.lotSize * pair.pipSize);

  return {
    pair: pair.symbol,
    longCurrency: rateSpread > 0 ? pair.base : pair.quote,
    shortCurrency: rateSpread > 0 ? pair.quote : pair.base,
    rateSpread: Math.abs(rateSpread),
    dailyCarry,
    annualizedCarry,
    breakEvenMove,
    sharpeOfCarry: Math.abs(rateSpread) / volatility,
  };
}
```

A carry trade scanner ranks all pairs by carry-to-risk ratio, highlighting the most attractive opportunities.

## Correlation Analysis

FX correlation analysis measures co-movement between currency pairs over rolling windows:

```typescript
export function fxCorrelationMatrix(
  pairs: string[],
  returns: Record<string, number[]>,
  window: number = 60
): CorrelationMatrix {
  const matrix: number[][] = pairs.map((pairA) =>
    pairs.map((pairB) => {
      if (pairA === pairB) return 1;
      const rA = returns[pairA].slice(-window);
      const rB = returns[pairB].slice(-window);
      return pearsonCorrelation(rA, rB);
    })
  );
  return { pairs, matrix, window };
}
```

The correlation heatmap reveals:
- **High positive correlation** — EUR/USD and GBP/USD often move together.
- **High negative correlation** — EUR/USD and USD/CHF are natural hedges.
- **Low correlation** — diversification opportunities.

## Economic Calendar Integration

The FX economic calendar highlights high-impact events that drive currency volatility:

| Impact | Event Types | Typical Pairs Affected |
|---|---|---|
| **High** | NFP, CPI, Central bank decisions | USD pairs |
| **High** | ECB rate decisions, Eurozone GDP | EUR pairs |
| **Medium** | PMI, Retail sales, Trade balance | Respective currency |
| **Low** | Housing data, Consumer confidence | Minor moves |

```typescript
export interface EconomicEvent {
  timestamp: number;
  currency: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  forecast?: number;
  previous?: number;
  actual?: number;
}
```

Events display on the chart timeline as vertical markers and in a filterable calendar panel. High-impact events trigger spread widening alerts.

## Session Overlaps

The FX market operates 24/5 across four major sessions. The session overlap visualization shows active trading hours:

| Session | Hours (UTC) | Major Pairs |
|---|---|---|
| **Sydney** | 21:00 – 06:00 | AUD, NZD pairs |
| **Tokyo** | 00:00 – 09:00 | JPY pairs |
| **London** | 07:00 – 16:00 | EUR, GBP pairs |
| **New York** | 12:00 – 21:00 | USD pairs |

Overlapping sessions (London/NY 12:00–16:00 UTC) produce the highest liquidity and tightest spreads. The session clock widget highlights the current active sessions and displays a countdown to the next session open/close.

## FX-Specific Indicators

Beyond standard technical indicators, the forex module includes FX-specialized analytics:

- **Currency Strength Meter** — relative strength index across 8 major currencies, computed from all 28 pair combinations.
- **Commitment of Traders (COT)** — CFTC positioning data for futures-based sentiment.
- **Swap Rate Monitor** — real-time rollover rates for carry trade monitoring.
- **Pip Range Oscillator** — normalized daily range indicator for volatility regime detection.
