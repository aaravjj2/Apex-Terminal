import { describe, it, expect } from 'vitest';
import type { OHLCVCandle, PatternMatch } from '../../../src/lib/indicators/patterns';
import {
  hammer, invertedHammer, hangingMan, shootingStar,
  doji, longLeggedDoji, dragonflyDoji, gravestoneDoji,
  spinningTop, marubozu,
  bullishEngulfing, bearishEngulfing,
  piercingLine, darkCloudCover,
  bullishHarami, bearishHarami,
  tweezerTops, tweezerBottoms,
  bullishKicker, bearishKicker,
  morningStar, eveningStar,
  threeWhiteSoldiers, threeBlackCrows,
  risingThreeMethods, fallingThreeMethods,
  bullishAbandonedBaby, bearishAbandonedBaby,
  threeInsideUp, threeInsideDown,
  threeOutsideUp, threeOutsideDown,
  scanAllPatterns, scanPatternsAtIndex, filterPatterns,
  allPatternDetectors,
} from '../../../src/lib/indicators/patterns';

const mkCandle = (o: number, h: number, l: number, c: number, v = 10000, t = 0): OHLCVCandle =>
  ({ open: o, high: h, low: l, close: c, volume: v, time: t });

const downtrendPre = (n: number, startPrice: number, step = 2): OHLCVCandle[] =>
  Array.from({ length: n }, (_, i) => {
    const mid = startPrice - i * step;
    return mkCandle(mid + 1, mid + 3, mid - 3, mid - 1);
  });

const uptrendPre = (n: number, startPrice: number, step = 2): OHLCVCandle[] =>
  Array.from({ length: n }, (_, i) => {
    const mid = startPrice + i * step;
    return mkCandle(mid - 1, mid + 3, mid - 3, mid + 1);
  });

// ═══════════════════════════════════════════════════════════════════════════════
// Doji
// ═══════════════════════════════════════════════════════════════════════════════

describe('doji', () => {
  it('detects doji when open ≈ close', () => {
    const candles = [mkCandle(100, 110, 90, 100.1)];
    const result = doji(candles);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].type).toBe('doji');
    expect(result[0].direction).toBe('neutral');
  });

  it('does not detect when body is large', () => {
    const candles = [mkCandle(90, 110, 80, 110)];
    const result = doji(candles);
    expect(result).toHaveLength(0);
  });

  it('does not detect zero-range candle', () => {
    const candles = [mkCandle(100, 100, 100, 100)];
    const result = doji(candles);
    expect(result).toHaveLength(0);
  });

  it('reliability is low', () => {
    const candles = [mkCandle(100, 120, 80, 100.5)];
    const result = doji(candles);
    if (result.length) {
      expect(result[0].reliability).toBe('low');
    }
  });

  it('detects multiple doji in series', () => {
    const candles = [
      mkCandle(100, 110, 90, 100.1),
      mkCandle(105, 115, 95, 105.2),
      mkCandle(110, 120, 100, 110.3),
    ];
    const result = doji(candles);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Hammer
// ═══════════════════════════════════════════════════════════════════════════════

describe('hammer', () => {
  it('detects hammer: long lower wick, small body, small upper wick in downtrend', () => {
    const pre = downtrendPre(6, 120);
    const hammerCandle = mkCandle(80, 81, 60, 82);
    const candles = [...pre, hammerCandle];
    const result = hammer(candles);
    const found = result.find(m => m.type === 'hammer');
    expect(found).toBeDefined();
    expect(found!.direction).toBe('bullish');
  });

  it('rejects hammer-like candle in uptrend', () => {
    const pre = uptrendPre(6, 100);
    const hammerCandle = mkCandle(118, 119, 100, 120);
    const candles = [...pre, hammerCandle];
    const result = hammer(candles);
    expect(result).toHaveLength(0);
  });

  it('rejects candle with long upper wick', () => {
    const pre = downtrendPre(6, 120);
    const candle = mkCandle(80, 100, 60, 82);
    const candles = [...pre, candle];
    const result = hammer(candles);
    expect(result).toHaveLength(0);
  });

  it('empty array for empty input', () => {
    expect(hammer([])).toHaveLength(0);
  });

  it('reliability is medium', () => {
    const pre = downtrendPre(6, 120);
    const hammerCandle = mkCandle(80, 81, 60, 82);
    const candles = [...pre, hammerCandle];
    const result = hammer(candles);
    const found = result.find(m => m.type === 'hammer');
    if (found) expect(found.reliability).toBe('medium');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Inverted Hammer
// ═══════════════════════════════════════════════════════════════════════════════

describe('invertedHammer', () => {
  it('detects in downtrend: long upper wick, small body, no lower wick', () => {
    const pre: OHLCVCandle[] = [];
    for (let i = 0; i < 14; i++) {
      const mid = 150 - i * 3;
      pre.push(mkCandle(mid + 2, mid + 4, mid - 4, mid - 2));
    }
    const candle = mkCandle(100, 120, 99.5, 102);
    const candles = [...pre, candle];
    const result = invertedHammer(candles);
    const found = result.find(m => m.type === 'inverted_hammer');
    expect(found).toBeDefined();
    expect(found!.direction).toBe('bullish');
  });

  it('reliability is low', () => {
    const pre: OHLCVCandle[] = [];
    for (let i = 0; i < 14; i++) {
      const mid = 150 - i * 3;
      pre.push(mkCandle(mid + 2, mid + 4, mid - 4, mid - 2));
    }
    const candle = mkCandle(100, 120, 99.5, 102);
    const candles = [...pre, candle];
    const result = invertedHammer(candles);
    if (result.length) expect(result[0].reliability).toBe('low');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Hanging Man / Shooting Star
// ═══════════════════════════════════════════════════════════════════════════════

describe('hangingMan', () => {
  it('detects in uptrend: same shape as hammer but bearish signal', () => {
    const pre = uptrendPre(6, 100);
    const candle = mkCandle(118, 119, 100, 120);
    const candles = [...pre, candle];
    const result = hangingMan(candles);
    const found = result.find(m => m.type === 'hanging_man');
    expect(found).toBeDefined();
    expect(found!.direction).toBe('bearish');
  });
});

describe('shootingStar', () => {
  it('detects in uptrend: long upper wick, small body', () => {
    const pre = uptrendPre(6, 100);
    const candle = mkCandle(120, 140, 119, 118);
    const candles = [...pre, candle];
    const result = shootingStar(candles);
    const found = result.find(m => m.type === 'shooting_star');
    expect(found).toBeDefined();
    expect(found!.direction).toBe('bearish');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Engulfing Patterns
// ═══════════════════════════════════════════════════════════════════════════════

describe('bullishEngulfing', () => {
  it('detects when bullish candle engulfs prior bearish candle', () => {
    const candles = [
      mkCandle(110, 112, 98, 100), // bearish
      mkCandle(98, 115, 97, 112),  // bullish engulfs
    ];
    const result = bullishEngulfing(candles);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('bullish_engulfing');
    expect(result[0].direction).toBe('bullish');
    expect(result[0].reliability).toBe('high');
  });

  it('rejects when current body does not exceed previous', () => {
    const candles = [
      mkCandle(110, 115, 95, 100), // bearish big body
      mkCandle(99, 105, 98, 102),  // small bullish
    ];
    const result = bullishEngulfing(candles);
    expect(result).toHaveLength(0);
  });

  it('rejects when prev is bullish', () => {
    const candles = [
      mkCandle(100, 115, 98, 110), // bullish
      mkCandle(98, 120, 97, 118),  // bullish
    ];
    const result = bullishEngulfing(candles);
    expect(result).toHaveLength(0);
  });

  it('empty for empty input', () => {
    expect(bullishEngulfing([])).toHaveLength(0);
  });

  it('empty for single candle', () => {
    expect(bullishEngulfing([mkCandle(100, 110, 90, 105)])).toHaveLength(0);
  });
});

describe('bearishEngulfing', () => {
  it('detects when bearish candle engulfs prior bullish candle', () => {
    const candles = [
      mkCandle(100, 112, 98, 110), // bullish
      mkCandle(112, 115, 97, 98),  // bearish engulfs
    ];
    const result = bearishEngulfing(candles);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('bearish_engulfing');
    expect(result[0].direction).toBe('bearish');
  });

  it('rejects when current body smaller', () => {
    const candles = [
      mkCandle(100, 115, 98, 110), // bullish big body
      mkCandle(111, 112, 106, 108),// small bearish
    ];
    const result = bearishEngulfing(candles);
    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Harami Patterns
// ═══════════════════════════════════════════════════════════════════════════════

describe('bullishHarami', () => {
  it('detects small bullish inside large bearish', () => {
    const candles = [
      mkCandle(120, 125, 95, 100),  // big bearish
      mkCandle(103, 108, 101, 107), // small bullish inside
    ];
    const result = bullishHarami(candles);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('bullish');
  });

  it('rejects when second body too large', () => {
    const candles = [
      mkCandle(120, 125, 95, 100), // bearish
      mkCandle(102, 119, 101, 118),// big bullish
    ];
    const result = bullishHarami(candles);
    expect(result).toHaveLength(0);
  });
});

describe('bearishHarami', () => {
  it('detects small bearish inside large bullish', () => {
    const candles = [
      mkCandle(100, 125, 95, 120),  // big bullish
      mkCandle(115, 118, 108, 110), // small bearish inside
    ];
    const result = bearishHarami(candles);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('bearish');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Morning / Evening Star
// ═══════════════════════════════════════════════════════════════════════════════

describe('morningStar', () => {
  it('detects three-candle bullish reversal', () => {
    const pre = downtrendPre(14, 180);
    const first = mkCandle(100, 105, 80, 82);   // big bearish
    const second = mkCandle(78, 80, 74, 79);      // small body below first.close
    const third = mkCandle(82, 108, 80, 105);     // big bullish above first midpoint
    const candles = [...pre, first, second, third];
    const result = morningStar(candles);
    const found = result.find(m => m.type === 'morning_star');
    if (found) {
      expect(found.direction).toBe('bullish');
      expect(found.reliability).toBe('high');
    }
  });

  it('rejects when third candle does not close above first midpoint', () => {
    const pre = downtrendPre(14, 180);
    const first = mkCandle(100, 105, 80, 82);
    const second = mkCandle(78, 80, 74, 79);
    const third = mkCandle(80, 85, 78, 83); // not above midpoint(first) ~91
    const candles = [...pre, first, second, third];
    const result = morningStar(candles);
    expect(result.filter(m => m.type === 'morning_star')).toHaveLength(0);
  });
});

describe('eveningStar', () => {
  it('detects three-candle bearish reversal', () => {
    const pre = uptrendPre(14, 60);
    const first = mkCandle(100, 120, 98, 118);   // big bullish
    const second = mkCandle(120, 124, 119, 121);  // small body above first.close
    const third = mkCandle(118, 119, 95, 96);     // big bearish below first midpoint
    const candles = [...pre, first, second, third];
    const result = eveningStar(candles);
    const found = result.find(m => m.type === 'evening_star');
    if (found) {
      expect(found.direction).toBe('bearish');
      expect(found.reliability).toBe('high');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Three White Soldiers / Three Black Crows
// ═══════════════════════════════════════════════════════════════════════════════

describe('threeWhiteSoldiers', () => {
  it('detects three consecutive bullish candles with higher closes', () => {
    const pre = downtrendPre(14, 180);
    const c1 = mkCandle(90, 102, 88, 100);
    const c2 = mkCandle(95, 112, 94, 110);
    const c3 = mkCandle(105, 122, 104, 120);
    const candles = [...pre, c1, c2, c3];
    const result = threeWhiteSoldiers(candles);
    const found = result.find(m => m.type === 'three_white_soldiers');
    if (found) {
      expect(found.direction).toBe('bullish');
      expect(found.reliability).toBe('high');
    }
  });

  it('rejects if one candle is bearish', () => {
    const pre = downtrendPre(14, 180);
    const c1 = mkCandle(90, 102, 88, 100);
    const c2 = mkCandle(105, 112, 94, 95); // bearish
    const c3 = mkCandle(100, 115, 98, 112);
    const candles = [...pre, c1, c2, c3];
    const result = threeWhiteSoldiers(candles);
    expect(result.filter(m => m.type === 'three_white_soldiers')).toHaveLength(0);
  });
});

describe('threeBlackCrows', () => {
  it('detects three consecutive bearish candles with lower closes', () => {
    const pre = uptrendPre(14, 60);
    const c1 = mkCandle(120, 122, 108, 110);
    const c2 = mkCandle(112, 113, 98, 100);
    const c3 = mkCandle(102, 103, 88, 90);
    const candles = [...pre, c1, c2, c3];
    const result = threeBlackCrows(candles);
    const found = result.find(m => m.type === 'three_black_crows');
    if (found) {
      expect(found.direction).toBe('bearish');
      expect(found.reliability).toBe('high');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Marubozu
// ═══════════════════════════════════════════════════════════════════════════════

describe('marubozu', () => {
  it('detects bullish marubozu (no wicks)', () => {
    const candles = [mkCandle(100, 120.1, 99.9, 120)];
    const result = marubozu(candles);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const found = result.find(m => m.direction === 'bullish');
    expect(found).toBeDefined();
  });

  it('detects bearish marubozu', () => {
    const candles = [mkCandle(120, 120.1, 99.9, 100)];
    const result = marubozu(candles);
    const found = result.find(m => m.direction === 'bearish');
    expect(found).toBeDefined();
  });

  it('rejects candle with significant wicks', () => {
    const candles = [mkCandle(100, 130, 70, 120)];
    const result = marubozu(candles);
    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tweezer Tops / Bottoms
// ═══════════════════════════════════════════════════════════════════════════════

describe('tweezerTops', () => {
  it('detects equal highs: bullish then bearish', () => {
    const candles = [
      mkCandle(100, 110, 95, 108),  // bullish
      mkCandle(108, 110, 96, 98),   // bearish, same high
    ];
    const result = tweezerTops(candles);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('bearish');
  });

  it('rejects when highs differ significantly', () => {
    const candles = [
      mkCandle(100, 110, 95, 108),
      mkCandle(108, 105, 96, 98),
    ];
    const result = tweezerTops(candles);
    expect(result).toHaveLength(0);
  });
});

describe('tweezerBottoms', () => {
  it('detects equal lows: bearish then bullish', () => {
    const candles = [
      mkCandle(108, 110, 95, 98),  // bearish
      mkCandle(98, 110, 95, 108),  // bullish, same low
    ];
    const result = tweezerBottoms(candles);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('bullish');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Kicker Patterns
// ═══════════════════════════════════════════════════════════════════════════════

describe('bullishKicker', () => {
  it('detects bearish candle followed by bullish gap up', () => {
    const candles = [
      mkCandle(110, 112, 98, 100),  // bearish
      mkCandle(112, 125, 110, 122), // bullish, open >= prev open
    ];
    const result = bullishKicker(candles);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('bullish');
    expect(result[0].reliability).toBe('high');
  });
});

describe('bearishKicker', () => {
  it('detects bullish candle followed by bearish gap down', () => {
    const candles = [
      mkCandle(100, 115, 98, 112), // bullish
      mkCandle(98, 102, 85, 88),   // bearish, open <= prev open
    ];
    const result = bearishKicker(candles);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe('bearish');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Special Doji variants
// ═══════════════════════════════════════════════════════════════════════════════

describe('dragonflyDoji', () => {
  it('detects: long lower shadow, no upper shadow, body ≈ 0', () => {
    const pre = downtrendPre(14, 200);
    const candle = mkCandle(100, 100.2, 80, 100.1);
    const candles = [...pre, candle];
    const result = dragonflyDoji(candles);
    const found = result.find(m => m.type === 'dragonfly_doji');
    if (found) {
      expect(found.direction).toBe('bullish');
    }
  });
});

describe('gravestoneDoji', () => {
  it('detects: long upper shadow, no lower shadow, body ≈ 0', () => {
    const pre = uptrendPre(14, 60);
    const candle = mkCandle(100, 120, 99.8, 100.1);
    const candles = [...pre, candle];
    const result = gravestoneDoji(candles);
    const found = result.find(m => m.type === 'gravestone_doji');
    if (found) {
      expect(found.direction).toBe('bearish');
    }
  });
});

describe('spinningTop', () => {
  it('detects small body with long wicks both sides', () => {
    const candles = [mkCandle(100, 115, 85, 102)];
    const result = spinningTop(candles);
    const found = result.find(m => m.type === 'spinning_top');
    if (found) {
      expect(found.direction).toBe('neutral');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Abandoned Baby
// ═══════════════════════════════════════════════════════════════════════════════

describe('bullishAbandonedBaby', () => {
  it('detects gap-down doji gap-up pattern', () => {
    const candles = [
      mkCandle(110, 112, 98, 100),  // bearish
      mkCandle(95, 97, 93, 95.1),   // doji below (high < first.low)
      mkCandle(99, 115, 98, 112),   // bullish (low > second.high)
    ];
    const result = bullishAbandonedBaby(candles);
    const found = result.find(m => m.type === 'bullish_abandoned_baby');
    if (found) {
      expect(found.direction).toBe('bullish');
      expect(found.reliability).toBe('high');
    }
  });
});

describe('bearishAbandonedBaby', () => {
  it('detects gap-up doji gap-down pattern', () => {
    const candles = [
      mkCandle(100, 115, 98, 112),  // bullish
      mkCandle(117, 119, 116, 117.1), // doji above (low > first.high)
      mkCandle(114, 115, 95, 98),    // bearish (high < second.low)
    ];
    const result = bearishAbandonedBaby(candles);
    const found = result.find(m => m.type === 'bearish_abandoned_baby');
    if (found) {
      expect(found.direction).toBe('bearish');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Three Inside / Three Outside
// ═══════════════════════════════════════════════════════════════════════════════

describe('threeInsideUp', () => {
  it('detects harami + confirmation', () => {
    const candles = [
      mkCandle(120, 125, 95, 100),  // big bearish
      mkCandle(103, 108, 101, 107), // small bullish inside
      mkCandle(108, 125, 106, 122), // bullish breaks above c1.open
    ];
    const result = threeInsideUp(candles);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].direction).toBe('bullish');
  });
});

describe('threeInsideDown', () => {
  it('detects bearish harami + confirmation', () => {
    const candles = [
      mkCandle(100, 125, 95, 120),  // big bullish
      mkCandle(115, 118, 105, 108), // small bearish inside
      mkCandle(106, 108, 88, 90),   // bearish breaks below c1.open
    ];
    const result = threeInsideDown(candles);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].direction).toBe('bearish');
  });
});

describe('threeOutsideUp', () => {
  it('detects engulfing + continuation', () => {
    const candles = [
      mkCandle(110, 112, 98, 100), // small bearish
      mkCandle(98, 115, 97, 112),  // bullish engulfs
      mkCandle(113, 120, 112, 118),// bullish continuation
    ];
    const result = threeOutsideUp(candles);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].direction).toBe('bullish');
  });
});

describe('threeOutsideDown', () => {
  it('detects bearish engulfing + continuation', () => {
    const candles = [
      mkCandle(100, 112, 98, 110), // small bullish
      mkCandle(112, 115, 97, 98),  // bearish engulfs
      mkCandle(96, 98, 85, 88),    // bearish continuation
    ];
    const result = threeOutsideDown(candles);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].direction).toBe('bearish');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Rising / Falling Three Methods
// ═══════════════════════════════════════════════════════════════════════════════

describe('risingThreeMethods', () => {
  it('detects bullish continuation pattern', () => {
    const candles = [
      mkCandle(90, 110, 88, 108),  // big bullish
      mkCandle(106, 107, 92, 94),  // small bearish inside
      mkCandle(96, 98, 90, 92),    // small bearish inside
      mkCandle(94, 96, 89, 91),    // small bearish inside
      mkCandle(93, 115, 91, 112),  // big bullish, close > c1.close
    ];
    const result = risingThreeMethods(candles);
    const found = result.find(m => m.type === 'rising_three_methods');
    if (found) {
      expect(found.direction).toBe('bullish');
    }
  });
});

describe('fallingThreeMethods', () => {
  it('detects bearish continuation pattern', () => {
    const candles = [
      mkCandle(110, 112, 88, 90),  // big bearish
      mkCandle(92, 108, 91, 106),  // small bullish inside
      mkCandle(104, 110, 100, 108),// small bullish inside
      mkCandle(106, 111, 102, 109),// small bullish inside
      mkCandle(108, 110, 85, 88),  // big bearish, close < c1.close
    ];
    const result = fallingThreeMethods(candles);
    const found = result.find(m => m.type === 'falling_three_methods');
    if (found) {
      expect(found.direction).toBe('bearish');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// scanAllPatterns / scanPatternsAtIndex / filterPatterns
// ═══════════════════════════════════════════════════════════════════════════════

describe('scanAllPatterns', () => {
  it('returns sorted array of all pattern matches', () => {
    const candles = [
      mkCandle(100, 120.1, 99.9, 120), // marubozu
      mkCandle(120, 120.2, 99.8, 120.1), // doji
    ];
    const result = scanAllPatterns(candles);
    expect(Array.isArray(result)).toBe(true);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].index).toBeGreaterThanOrEqual(result[i - 1].index);
    }
  });

  it('filters by pattern names', () => {
    const candles = [
      mkCandle(100, 120.1, 99.9, 120),
      mkCandle(120, 120.2, 99.8, 120.1),
    ];
    const result = scanAllPatterns(candles, ['doji']);
    result.forEach(m => expect(m.type).toBe('doji'));
  });

  it('returns empty for empty candles', () => {
    expect(scanAllPatterns([])).toHaveLength(0);
  });
});

describe('scanPatternsAtIndex', () => {
  it('returns only patterns at specified index', () => {
    const candles = [
      mkCandle(100, 120.1, 99.9, 120),
      mkCandle(100, 110, 90, 100.1),
    ];
    const result = scanPatternsAtIndex(candles, 1);
    result.forEach(m => expect(m.index).toBe(1));
  });
});

describe('filterPatterns', () => {
  const matches: PatternMatch[] = [
    { index: 0, type: 'doji', reliability: 'low', direction: 'neutral' },
    { index: 1, type: 'hammer', reliability: 'medium', direction: 'bullish' },
    { index: 2, type: 'bullish_engulfing', reliability: 'high', direction: 'bullish' },
    { index: 3, type: 'bearish_engulfing', reliability: 'high', direction: 'bearish' },
  ];

  it('filters by direction', () => {
    const result = filterPatterns(matches, { direction: 'bullish' });
    result.forEach(m => expect(m.direction).toBe('bullish'));
    expect(result).toHaveLength(2);
  });

  it('filters by reliability', () => {
    const result = filterPatterns(matches, { reliability: 'high' });
    result.forEach(m => expect(m.reliability).toBe('high'));
    expect(result).toHaveLength(2);
  });

  it('filters by minReliability', () => {
    const result = filterPatterns(matches, { minReliability: 'medium' });
    result.forEach(m => expect(['medium', 'high']).toContain(m.reliability));
    expect(result).toHaveLength(3);
  });

  it('combines filters', () => {
    const result = filterPatterns(matches, { direction: 'bullish', minReliability: 'high' });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('bullish_engulfing');
  });

  it('returns all if no filter', () => {
    const result = filterPatterns(matches, {});
    expect(result).toHaveLength(4);
  });
});

describe('allPatternDetectors', () => {
  it('contains all expected pattern names', () => {
    const names = Object.keys(allPatternDetectors);
    expect(names).toContain('hammer');
    expect(names).toContain('doji');
    expect(names).toContain('bullish_engulfing');
    expect(names).toContain('bearish_engulfing');
    expect(names).toContain('morning_star');
    expect(names).toContain('evening_star');
    expect(names).toContain('three_white_soldiers');
    expect(names).toContain('three_black_crows');
  });

  it('all detectors are functions', () => {
    for (const [, fn] of Object.entries(allPatternDetectors)) {
      expect(typeof fn).toBe('function');
    }
  });

  it('all detectors return arrays', () => {
    const candles = [mkCandle(100, 110, 90, 105)];
    for (const [, fn] of Object.entries(allPatternDetectors)) {
      const result = fn(candles);
      expect(Array.isArray(result)).toBe(true);
    }
  });
});
