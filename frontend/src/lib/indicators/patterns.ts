export interface OHLCVCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
}

export type PatternDirection = 'bullish' | 'bearish' | 'neutral';
export type PatternReliability = 'high' | 'medium' | 'low';

export interface PatternMatch {
  index: number;
  type: string;
  reliability: PatternReliability;
  direction: PatternDirection;
}

function validCandle(c: OHLCVCandle): boolean {
  return (
    c != null &&
    typeof c.open === 'number' && !isNaN(c.open) &&
    typeof c.high === 'number' && !isNaN(c.high) &&
    typeof c.low === 'number' && !isNaN(c.low) &&
    typeof c.close === 'number' && !isNaN(c.close)
  );
}

function bodySize(c: OHLCVCandle): number {
  return Math.abs(c.close - c.open);
}

function candleRange(c: OHLCVCandle): number {
  return c.high - c.low;
}

function upperShadow(c: OHLCVCandle): number {
  return c.high - Math.max(c.open, c.close);
}

function lowerShadow(c: OHLCVCandle): number {
  return Math.min(c.open, c.close) - c.low;
}

function isBullish(c: OHLCVCandle): boolean {
  return c.close > c.open;
}

function isBearish(c: OHLCVCandle): boolean {
  return c.close < c.open;
}

function isDoji(c: OHLCVCandle, threshold: number = 0.05): boolean {
  const range = candleRange(c);
  if (range === 0) return true;
  return bodySize(c) / range <= threshold;
}

function bodyMidpoint(c: OHLCVCandle): number {
  return (c.open + c.close) / 2;
}

function avgBodySize(candles: OHLCVCandle[], count: number, endIdx: number): number {
  let sum = 0;
  let n = 0;
  for (let i = Math.max(0, endIdx - count); i < endIdx; i++) {
    if (validCandle(candles[i])) {
      sum += bodySize(candles[i]);
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

function avgRange(candles: OHLCVCandle[], count: number, endIdx: number): number {
  let sum = 0;
  let n = 0;
  for (let i = Math.max(0, endIdx - count); i < endIdx; i++) {
    if (validCandle(candles[i])) {
      sum += candleRange(candles[i]);
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

// ─── Single Candle Patterns ─────────────────────────────────────────────────

export function hammer(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    if (!validCandle(c)) continue;

    const range = candleRange(c);
    if (range === 0) continue;

    const body = bodySize(c);
    const lower = lowerShadow(c);
    const upper = upperShadow(c);
    const avg = avgRange(candles, lookback, i);

    if (
      lower >= 2 * body &&
      upper <= body * 0.3 &&
      body > 0 &&
      range >= avg * 0.5
    ) {
      const prevTrend = i >= 5 && candles[i - 1].close < candles[i - 5].close;
      if (prevTrend) {
        results.push({ index: i, type: 'hammer', reliability: 'medium', direction: 'bullish' });
      }
    }
  }

  return results;
}

export function invertedHammer(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    if (!validCandle(c)) continue;

    const range = candleRange(c);
    if (range === 0) continue;

    const body = bodySize(c);
    const lower = lowerShadow(c);
    const upper = upperShadow(c);
    const avg = avgRange(candles, lookback, i);

    if (
      upper >= 2 * body &&
      lower <= body * 0.3 &&
      body > 0 &&
      range >= avg * 0.5
    ) {
      const prevTrend = i >= 5 && candles[i - 1].close < candles[i - 5].close;
      if (prevTrend) {
        results.push({ index: i, type: 'inverted_hammer', reliability: 'low', direction: 'bullish' });
      }
    }
  }

  return results;
}

export function hangingMan(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    if (!validCandle(c)) continue;

    const range = candleRange(c);
    if (range === 0) continue;

    const body = bodySize(c);
    const lower = lowerShadow(c);
    const upper = upperShadow(c);
    const avg = avgRange(candles, lookback, i);

    if (
      lower >= 2 * body &&
      upper <= body * 0.3 &&
      body > 0 &&
      range >= avg * 0.5
    ) {
      const prevTrend = i >= 5 && candles[i - 1].close > candles[i - 5].close;
      if (prevTrend) {
        results.push({ index: i, type: 'hanging_man', reliability: 'medium', direction: 'bearish' });
      }
    }
  }

  return results;
}

export function shootingStar(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    if (!validCandle(c)) continue;

    const range = candleRange(c);
    if (range === 0) continue;

    const body = bodySize(c);
    const lower = lowerShadow(c);
    const upper = upperShadow(c);
    const avg = avgRange(candles, lookback, i);

    if (
      upper >= 2 * body &&
      lower <= body * 0.3 &&
      body > 0 &&
      range >= avg * 0.5
    ) {
      const prevTrend = i >= 5 && candles[i - 1].close > candles[i - 5].close;
      if (prevTrend) {
        results.push({ index: i, type: 'shooting_star', reliability: 'medium', direction: 'bearish' });
      }
    }
  }

  return results;
}

export function doji(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!validCandle(c)) continue;

    if (isDoji(c, 0.05) && candleRange(c) > 0) {
      results.push({ index: i, type: 'doji', reliability: 'low', direction: 'neutral' });
    }
  }

  return results;
}

export function longLeggedDoji(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!validCandle(c)) continue;

    const range = candleRange(c);
    if (range === 0) continue;

    const body = bodySize(c);
    const upper = upperShadow(c);
    const lower = lowerShadow(c);
    const avg = avgRange(candles, lookback, i);

    if (
      isDoji(c, 0.05) &&
      upper >= range * 0.3 &&
      lower >= range * 0.3 &&
      range >= avg * 0.8
    ) {
      results.push({ index: i, type: 'long_legged_doji', reliability: 'medium', direction: 'neutral' });
    }
  }

  return results;
}

export function dragonflyDoji(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!validCandle(c)) continue;

    const range = candleRange(c);
    if (range === 0) continue;

    const body = bodySize(c);
    const upper = upperShadow(c);
    const lower = lowerShadow(c);
    const avg = avgRange(candles, lookback, i);

    if (
      isDoji(c, 0.05) &&
      lower >= range * 0.6 &&
      upper <= range * 0.1 &&
      range >= avg * 0.5
    ) {
      results.push({ index: i, type: 'dragonfly_doji', reliability: 'medium', direction: 'bullish' });
    }
  }

  return results;
}

export function gravestoneDoji(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!validCandle(c)) continue;

    const range = candleRange(c);
    if (range === 0) continue;

    const upper = upperShadow(c);
    const lower = lowerShadow(c);
    const avg = avgRange(candles, lookback, i);

    if (
      isDoji(c, 0.05) &&
      upper >= range * 0.6 &&
      lower <= range * 0.1 &&
      range >= avg * 0.5
    ) {
      results.push({ index: i, type: 'gravestone_doji', reliability: 'medium', direction: 'bearish' });
    }
  }

  return results;
}

export function spinningTop(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!validCandle(c)) continue;

    const range = candleRange(c);
    if (range === 0) continue;

    const body = bodySize(c);
    const upper = upperShadow(c);
    const lower = lowerShadow(c);

    if (
      body <= range * 0.3 &&
      body > range * 0.05 &&
      upper >= body &&
      lower >= body
    ) {
      results.push({ index: i, type: 'spinning_top', reliability: 'low', direction: 'neutral' });
    }
  }

  return results;
}

export function marubozu(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!validCandle(c)) continue;

    const range = candleRange(c);
    if (range === 0) continue;

    const body = bodySize(c);
    const upper = upperShadow(c);
    const lower = lowerShadow(c);

    if (body >= range * 0.95 && upper <= range * 0.025 && lower <= range * 0.025) {
      const dir: PatternDirection = isBullish(c) ? 'bullish' : 'bearish';
      results.push({ index: i, type: 'marubozu', reliability: 'medium', direction: dir });
    }
  }

  return results;
}

// ─── Two-Candle Patterns ────────────────────────────────────────────────────

export function bullishEngulfing(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (!validCandle(prev) || !validCandle(curr)) continue;

    if (
      isBearish(prev) &&
      isBullish(curr) &&
      curr.open <= prev.close &&
      curr.close >= prev.open &&
      bodySize(curr) > bodySize(prev)
    ) {
      results.push({ index: i, type: 'bullish_engulfing', reliability: 'high', direction: 'bullish' });
    }
  }

  return results;
}

export function bearishEngulfing(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (!validCandle(prev) || !validCandle(curr)) continue;

    if (
      isBullish(prev) &&
      isBearish(curr) &&
      curr.open >= prev.close &&
      curr.close <= prev.open &&
      bodySize(curr) > bodySize(prev)
    ) {
      results.push({ index: i, type: 'bearish_engulfing', reliability: 'high', direction: 'bearish' });
    }
  }

  return results;
}

export function piercingLine(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (!validCandle(prev) || !validCandle(curr)) continue;

    const prevMid = bodyMidpoint(prev);

    if (
      isBearish(prev) &&
      isBullish(curr) &&
      curr.open < prev.low &&
      curr.close > prevMid &&
      curr.close < prev.open
    ) {
      results.push({ index: i, type: 'piercing_line', reliability: 'high', direction: 'bullish' });
    }
  }

  return results;
}

export function darkCloudCover(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (!validCandle(prev) || !validCandle(curr)) continue;

    const prevMid = bodyMidpoint(prev);

    if (
      isBullish(prev) &&
      isBearish(curr) &&
      curr.open > prev.high &&
      curr.close < prevMid &&
      curr.close > prev.open
    ) {
      results.push({ index: i, type: 'dark_cloud_cover', reliability: 'high', direction: 'bearish' });
    }
  }

  return results;
}

export function bullishHarami(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (!validCandle(prev) || !validCandle(curr)) continue;

    if (
      isBearish(prev) &&
      isBullish(curr) &&
      curr.open >= prev.close &&
      curr.close <= prev.open &&
      bodySize(curr) < bodySize(prev) * 0.6
    ) {
      results.push({ index: i, type: 'bullish_harami', reliability: 'medium', direction: 'bullish' });
    }
  }

  return results;
}

export function bearishHarami(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (!validCandle(prev) || !validCandle(curr)) continue;

    if (
      isBullish(prev) &&
      isBearish(curr) &&
      curr.open <= prev.close &&
      curr.close >= prev.open &&
      bodySize(curr) < bodySize(prev) * 0.6
    ) {
      results.push({ index: i, type: 'bearish_harami', reliability: 'medium', direction: 'bearish' });
    }
  }

  return results;
}

export function tweezerTops(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const tolerance = 0.001;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (!validCandle(prev) || !validCandle(curr)) continue;

    const avgHigh = (prev.high + curr.high) / 2;
    if (avgHigh === 0) continue;

    if (
      isBullish(prev) &&
      isBearish(curr) &&
      Math.abs(prev.high - curr.high) / avgHigh <= tolerance
    ) {
      results.push({ index: i, type: 'tweezer_tops', reliability: 'medium', direction: 'bearish' });
    }
  }

  return results;
}

export function tweezerBottoms(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const tolerance = 0.001;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (!validCandle(prev) || !validCandle(curr)) continue;

    const avgLow = (prev.low + curr.low) / 2;
    if (avgLow === 0) continue;

    if (
      isBearish(prev) &&
      isBullish(curr) &&
      Math.abs(prev.low - curr.low) / avgLow <= tolerance
    ) {
      results.push({ index: i, type: 'tweezer_bottoms', reliability: 'medium', direction: 'bullish' });
    }
  }

  return results;
}

export function bullishKicker(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (!validCandle(prev) || !validCandle(curr)) continue;

    if (
      isBearish(prev) &&
      isBullish(curr) &&
      curr.open >= prev.open &&
      bodySize(curr) > 0 &&
      bodySize(prev) > 0
    ) {
      results.push({ index: i, type: 'bullish_kicker', reliability: 'high', direction: 'bullish' });
    }
  }

  return results;
}

export function bearishKicker(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (!validCandle(prev) || !validCandle(curr)) continue;

    if (
      isBullish(prev) &&
      isBearish(curr) &&
      curr.open <= prev.open &&
      bodySize(curr) > 0 &&
      bodySize(prev) > 0
    ) {
      results.push({ index: i, type: 'bearish_kicker', reliability: 'high', direction: 'bearish' });
    }
  }

  return results;
}

// ─── Three-Candle Patterns ──────────────────────────────────────────────────

export function morningStar(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const second = candles[i - 1];
    const third = candles[i];
    if (!validCandle(first) || !validCandle(second) || !validCandle(third)) continue;

    const avgBody = avgBodySize(candles, lookback, i - 2);
    const firstBody = bodySize(first);
    const secondBody = bodySize(second);
    const thirdBody = bodySize(third);

    if (
      isBearish(first) &&
      firstBody >= avgBody * 0.7 &&
      secondBody < firstBody * 0.4 &&
      Math.max(second.open, second.close) < first.close &&
      isBullish(third) &&
      thirdBody >= avgBody * 0.7 &&
      third.close > bodyMidpoint(first)
    ) {
      results.push({ index: i, type: 'morning_star', reliability: 'high', direction: 'bullish' });
    }
  }

  return results;
}

export function eveningStar(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const second = candles[i - 1];
    const third = candles[i];
    if (!validCandle(first) || !validCandle(second) || !validCandle(third)) continue;

    const avgBody = avgBodySize(candles, lookback, i - 2);
    const firstBody = bodySize(first);
    const secondBody = bodySize(second);
    const thirdBody = bodySize(third);

    if (
      isBullish(first) &&
      firstBody >= avgBody * 0.7 &&
      secondBody < firstBody * 0.4 &&
      Math.min(second.open, second.close) > first.close &&
      isBearish(third) &&
      thirdBody >= avgBody * 0.7 &&
      third.close < bodyMidpoint(first)
    ) {
      results.push({ index: i, type: 'evening_star', reliability: 'high', direction: 'bearish' });
    }
  }

  return results;
}

export function threeWhiteSoldiers(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];
    if (!validCandle(c1) || !validCandle(c2) || !validCandle(c3)) continue;

    const avgBody = avgBodySize(candles, lookback, i - 2);

    if (
      isBullish(c1) && isBullish(c2) && isBullish(c3) &&
      bodySize(c1) >= avgBody * 0.5 &&
      bodySize(c2) >= avgBody * 0.5 &&
      bodySize(c3) >= avgBody * 0.5 &&
      c2.open > c1.open && c2.open < c1.close &&
      c3.open > c2.open && c3.open < c2.close &&
      c2.close > c1.close &&
      c3.close > c2.close &&
      upperShadow(c1) < bodySize(c1) * 0.5 &&
      upperShadow(c2) < bodySize(c2) * 0.5 &&
      upperShadow(c3) < bodySize(c3) * 0.5
    ) {
      results.push({ index: i, type: 'three_white_soldiers', reliability: 'high', direction: 'bullish' });
    }
  }

  return results;
}

export function threeBlackCrows(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];
  const lookback = 14;

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];
    if (!validCandle(c1) || !validCandle(c2) || !validCandle(c3)) continue;

    const avgBody = avgBodySize(candles, lookback, i - 2);

    if (
      isBearish(c1) && isBearish(c2) && isBearish(c3) &&
      bodySize(c1) >= avgBody * 0.5 &&
      bodySize(c2) >= avgBody * 0.5 &&
      bodySize(c3) >= avgBody * 0.5 &&
      c2.open < c1.open && c2.open > c1.close &&
      c3.open < c2.open && c3.open > c2.close &&
      c2.close < c1.close &&
      c3.close < c2.close &&
      lowerShadow(c1) < bodySize(c1) * 0.5 &&
      lowerShadow(c2) < bodySize(c2) * 0.5 &&
      lowerShadow(c3) < bodySize(c3) * 0.5
    ) {
      results.push({ index: i, type: 'three_black_crows', reliability: 'high', direction: 'bearish' });
    }
  }

  return results;
}

export function risingThreeMethods(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 4; i < candles.length; i++) {
    const c1 = candles[i - 4];
    const c5 = candles[i];
    if (!validCandle(c1) || !validCandle(c5)) continue;

    if (!isBullish(c1) || bodySize(c1) === 0) continue;
    if (!isBullish(c5) || bodySize(c5) === 0) continue;

    let middleValid = true;
    for (let j = i - 3; j <= i - 1; j++) {
      const cm = candles[j];
      if (!validCandle(cm) || !isBearish(cm)) { middleValid = false; break; }
      if (cm.low < c1.low || cm.high > c1.high) { middleValid = false; break; }
    }

    if (middleValid && c5.close > c1.close) {
      results.push({ index: i, type: 'rising_three_methods', reliability: 'high', direction: 'bullish' });
    }
  }

  return results;
}

export function fallingThreeMethods(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 4; i < candles.length; i++) {
    const c1 = candles[i - 4];
    const c5 = candles[i];
    if (!validCandle(c1) || !validCandle(c5)) continue;

    if (!isBearish(c1) || bodySize(c1) === 0) continue;
    if (!isBearish(c5) || bodySize(c5) === 0) continue;

    let middleValid = true;
    for (let j = i - 3; j <= i - 1; j++) {
      const cm = candles[j];
      if (!validCandle(cm) || !isBullish(cm)) { middleValid = false; break; }
      if (cm.low < c1.low || cm.high > c1.high) { middleValid = false; break; }
    }

    if (middleValid && c5.close < c1.close) {
      results.push({ index: i, type: 'falling_three_methods', reliability: 'high', direction: 'bearish' });
    }
  }

  return results;
}

export function bullishAbandonedBaby(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const second = candles[i - 1];
    const third = candles[i];
    if (!validCandle(first) || !validCandle(second) || !validCandle(third)) continue;

    if (
      isBearish(first) &&
      isDoji(second, 0.05) &&
      isBullish(third) &&
      second.high < first.low &&
      second.high < third.low
    ) {
      results.push({ index: i, type: 'bullish_abandoned_baby', reliability: 'high', direction: 'bullish' });
    }
  }

  return results;
}

export function bearishAbandonedBaby(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const second = candles[i - 1];
    const third = candles[i];
    if (!validCandle(first) || !validCandle(second) || !validCandle(third)) continue;

    if (
      isBullish(first) &&
      isDoji(second, 0.05) &&
      isBearish(third) &&
      second.low > first.high &&
      second.low > third.high
    ) {
      results.push({ index: i, type: 'bearish_abandoned_baby', reliability: 'high', direction: 'bearish' });
    }
  }

  return results;
}

export function threeInsideUp(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];
    if (!validCandle(c1) || !validCandle(c2) || !validCandle(c3)) continue;

    if (
      isBearish(c1) &&
      isBullish(c2) &&
      c2.open >= c1.close && c2.close <= c1.open &&
      bodySize(c2) < bodySize(c1) * 0.6 &&
      isBullish(c3) &&
      c3.close > c1.open
    ) {
      results.push({ index: i, type: 'three_inside_up', reliability: 'high', direction: 'bullish' });
    }
  }

  return results;
}

export function threeInsideDown(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];
    if (!validCandle(c1) || !validCandle(c2) || !validCandle(c3)) continue;

    if (
      isBullish(c1) &&
      isBearish(c2) &&
      c2.open <= c1.close && c2.close >= c1.open &&
      bodySize(c2) < bodySize(c1) * 0.6 &&
      isBearish(c3) &&
      c3.close < c1.open
    ) {
      results.push({ index: i, type: 'three_inside_down', reliability: 'high', direction: 'bearish' });
    }
  }

  return results;
}

export function threeOutsideUp(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];
    if (!validCandle(c1) || !validCandle(c2) || !validCandle(c3)) continue;

    if (
      isBearish(c1) &&
      isBullish(c2) &&
      c2.open <= c1.close && c2.close >= c1.open &&
      bodySize(c2) > bodySize(c1) &&
      isBullish(c3) &&
      c3.close > c2.close
    ) {
      results.push({ index: i, type: 'three_outside_up', reliability: 'high', direction: 'bullish' });
    }
  }

  return results;
}

export function threeOutsideDown(candles: OHLCVCandle[]): PatternMatch[] {
  const results: PatternMatch[] = [];

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];
    if (!validCandle(c1) || !validCandle(c2) || !validCandle(c3)) continue;

    if (
      isBullish(c1) &&
      isBearish(c2) &&
      c2.open >= c1.close && c2.close <= c1.open &&
      bodySize(c2) > bodySize(c1) &&
      isBearish(c3) &&
      c3.close < c2.close
    ) {
      results.push({ index: i, type: 'three_outside_down', reliability: 'high', direction: 'bearish' });
    }
  }

  return results;
}

// ─── Scan all patterns ──────────────────────────────────────────────────────

export type PatternDetector = (candles: OHLCVCandle[]) => PatternMatch[];

export const allPatternDetectors: Record<string, PatternDetector> = {
  hammer,
  inverted_hammer: invertedHammer,
  hanging_man: hangingMan,
  shooting_star: shootingStar,
  doji,
  long_legged_doji: longLeggedDoji,
  dragonfly_doji: dragonflyDoji,
  gravestone_doji: gravestoneDoji,
  spinning_top: spinningTop,
  marubozu,
  bullish_engulfing: bullishEngulfing,
  bearish_engulfing: bearishEngulfing,
  piercing_line: piercingLine,
  dark_cloud_cover: darkCloudCover,
  bullish_harami: bullishHarami,
  bearish_harami: bearishHarami,
  tweezer_tops: tweezerTops,
  tweezer_bottoms: tweezerBottoms,
  bullish_kicker: bullishKicker,
  bearish_kicker: bearishKicker,
  morning_star: morningStar,
  evening_star: eveningStar,
  three_white_soldiers: threeWhiteSoldiers,
  three_black_crows: threeBlackCrows,
  rising_three_methods: risingThreeMethods,
  falling_three_methods: fallingThreeMethods,
  bullish_abandoned_baby: bullishAbandonedBaby,
  bearish_abandoned_baby: bearishAbandonedBaby,
  three_inside_up: threeInsideUp,
  three_inside_down: threeInsideDown,
  three_outside_up: threeOutsideUp,
  three_outside_down: threeOutsideDown,
};

export function scanAllPatterns(
  candles: OHLCVCandle[],
  patternNames?: string[]
): PatternMatch[] {
  const results: PatternMatch[] = [];

  const detectors = patternNames
    ? patternNames
        .filter(name => allPatternDetectors[name])
        .map(name => allPatternDetectors[name])
    : Object.values(allPatternDetectors);

  for (const detector of detectors) {
    const matches = detector(candles);
    results.push(...matches);
  }

  results.sort((a, b) => a.index - b.index);
  return results;
}

export function scanPatternsAtIndex(
  candles: OHLCVCandle[],
  index: number
): PatternMatch[] {
  const allMatches = scanAllPatterns(candles);
  return allMatches.filter(m => m.index === index);
}

export function filterPatterns(
  matches: PatternMatch[],
  options: {
    direction?: PatternDirection;
    reliability?: PatternReliability;
    minReliability?: PatternReliability;
  }
): PatternMatch[] {
  const reliabilityOrder: Record<PatternReliability, number> = {
    low: 0,
    medium: 1,
    high: 2
  };

  return matches.filter(m => {
    if (options.direction && m.direction !== options.direction) return false;
    if (options.reliability && m.reliability !== options.reliability) return false;
    if (options.minReliability && reliabilityOrder[m.reliability] < reliabilityOrder[options.minReliability]) {
      return false;
    }
    return true;
  });
}
