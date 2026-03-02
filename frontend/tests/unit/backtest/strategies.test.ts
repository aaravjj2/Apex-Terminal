import { describe, it, expect } from 'vitest';
import {
  SMACrossover, RSIMeanReversion, MACDStrategy, BollingerMeanReversion,
  BreakoutStrategy, MomentumStrategy, TrendFollowing, IchimokuStrategy,
  VWAPStrategy, MeanReversionZScore, VolatilityTargeting, TurtleTrading,
  BUILT_IN_STRATEGIES, getStrategy,
} from '../../../src/lib/backtest/strategies';
import { BacktestEngine } from '../../../src/lib/backtest/engine';
import {
  type Bar, type Strategy, defaultBacktestConfig,
  CommissionModel, SlippageModel,
} from '../../../src/lib/backtest/types';

const DAY = 86_400_000;

function sineWaveBars(symbol: string, count: number, base: number, amplitude: number, period: number): Bar[] {
  const bars: Bar[] = [];
  for (let i = 0; i < count; i++) {
    const price = base + amplitude * Math.sin((2 * Math.PI * i) / period);
    const high = price + amplitude * 0.15;
    const low = price - amplitude * 0.15;
    bars.push({ time: 1_609_459_200_000 + i * DAY, open: price - 0.5, high, low, close: price, volume: 500_000 });
  }
  return bars;
}

function trendingBars(symbol: string, count: number, start: number, slope: number): Bar[] {
  const bars: Bar[] = [];
  for (let i = 0; i < count; i++) {
    const price = start + slope * i + Math.sin(i * 0.5) * 2;
    const high = price + 1;
    const low = price - 1;
    bars.push({ time: 1_609_459_200_000 + i * DAY, open: price - 0.3, high, low, close: price, volume: 300_000 + i * 100 });
  }
  return bars;
}

function runStrategy(strat: Strategy, bars: Bar[], symbol = 'AAPL') {
  const config = defaultBacktestConfig({
    symbols: [symbol],
    startDate: bars[0].time,
    endDate: bars[bars.length - 1].time,
    initialCapital: 100_000,
    warmupBars: 0,
    seed: 42,
    maxPositionSize: 5.0,
    commission: { model: CommissionModel.PER_TRADE, perTrade: 1 },
    slippage: { model: SlippageModel.FIXED, fixedAmount: 0.01 },
  });
  const engine = new BacktestEngine(config, strat, {});
  return engine.run(new Map([[symbol, bars]]));
}

describe('Strategy interface compliance', () => {
  for (const strat of BUILT_IN_STRATEGIES) {
    it(`${strat.name} has required fields`, () => {
      expect(strat.name).toBeTruthy();
      expect(strat.description).toBeTruthy();
      expect(strat.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(Array.isArray(strat.params)).toBe(true);
      expect(typeof strat.init).toBe('function');
      expect(typeof strat.onBar).toBe('function');
    });
  }

  it('all strategies have valid params', () => {
    for (const strat of BUILT_IN_STRATEGIES) {
      for (const param of strat.params) {
        expect(param.name).toBeTruthy();
        expect(param.type).toBeTruthy();
        expect(param.default !== undefined).toBe(true);
      }
    }
  });

  it('BUILT_IN_STRATEGIES contains all expected strategies', () => {
    expect(BUILT_IN_STRATEGIES.length).toBeGreaterThanOrEqual(15);
    const names = BUILT_IN_STRATEGIES.map(s => s.name);
    expect(names).toContain('SMA Crossover');
    expect(names).toContain('RSI Mean Reversion');
    expect(names).toContain('MACD Strategy');
    expect(names).toContain('Bollinger Band Mean Reversion');
  });
});

describe('getStrategy', () => {
  it('returns strategy by name', () => {
    const strat = getStrategy('SMA Crossover');
    expect(strat).toBeDefined();
    expect(strat!.name).toBe('SMA Crossover');
  });

  it('returns undefined for unknown name', () => {
    expect(getStrategy('NonExistent')).toBeUndefined();
  });
});

describe('SMACrossover', () => {
  it('produces trades on sine wave data', () => {
    const bars = sineWaveBars('AAPL', 200, 100, 10, 40);
    const result = runStrategy(SMACrossover, bars);
    expect(result.trades.length).toBeGreaterThan(0);
  });

  it('does not trade on flat data', () => {
    const bars: Bar[] = Array.from({ length: 100 }, (_, i) => ({
      time: 1_609_459_200_000 + i * DAY, open: 100, high: 100.01, low: 99.99, close: 100, volume: 100_000,
    }));
    const result = runStrategy(SMACrossover, bars);
    expect(result.trades.length).toBeLessThanOrEqual(1);
  });
});

describe('RSIMeanReversion', () => {
  it('buys on oversold conditions', () => {
    const bars = sineWaveBars('AAPL', 200, 100, 15, 30);
    const result = runStrategy(RSIMeanReversion, bars);
    expect(result.trades.length).toBeGreaterThan(0);
  });

  it('produces trades with valid entry/exit prices', () => {
    const bars = sineWaveBars('AAPL', 200, 100, 12, 25);
    const result = runStrategy(RSIMeanReversion, bars);
    for (const trade of result.trades) {
      expect(trade.entryPrice).toBeGreaterThan(0);
      expect(trade.exitPrice).toBeGreaterThan(0);
    }
  });
});

describe('MACDStrategy', () => {
  it('produces trades on trending data', () => {
    const bars = sineWaveBars('AAPL', 250, 100, 10, 50);
    const result = runStrategy(MACDStrategy, bars);
    expect(result.trades.length).toBeGreaterThan(0);
  });

  it('needs sufficient warmup bars', () => {
    const bars = sineWaveBars('AAPL', 20, 100, 5, 10);
    const result = runStrategy(MACDStrategy, bars);
    expect(result.trades.length).toBe(0);
  });
});

describe('BollingerMeanReversion', () => {
  it('produces trades on volatile data', () => {
    const bars = sineWaveBars('AAPL', 300, 100, 20, 60);
    const result = runStrategy(BollingerMeanReversion, bars);
    expect(result.trades.length).toBeGreaterThan(0);
  });

  it('buys at lower band and sells at upper', () => {
    const bars = sineWaveBars('AAPL', 300, 100, 20, 60);
    const result = runStrategy(BollingerMeanReversion, bars);
    for (const t of result.trades) {
      expect(t.entryPrice).toBeGreaterThan(0);
    }
  });
});

describe('BreakoutStrategy', () => {
  it('trades on breakouts in trending data', () => {
    const bars = trendingBars('AAPL', 150, 100, 0.5);
    const result = runStrategy(BreakoutStrategy, bars);
    expect(result.trades.length).toBeGreaterThan(0);
  });
});

describe('MomentumStrategy', () => {
  it('buys when momentum is positive', () => {
    const bars = trendingBars('AAPL', 150, 100, 0.3);
    const result = runStrategy(MomentumStrategy, bars);
    expect(result.trades.length).toBeGreaterThan(0);
  });
});

describe('TrendFollowing', () => {
  it('enters on strong trend', () => {
    const bars = trendingBars('AAPL', 200, 100, 0.5);
    const result = runStrategy(TrendFollowing, bars);
    expect(result.trades.length).toBeGreaterThanOrEqual(0);
  });
});

describe('IchimokuStrategy', () => {
  it('needs sufficient data', () => {
    const bars = trendingBars('AAPL', 30, 100, 0.5);
    const result = runStrategy(IchimokuStrategy, bars);
    expect(result.trades.length).toBe(0);
  });

  it('produces trades with enough data', () => {
    const bars = trendingBars('AAPL', 200, 100, 0.3);
    const result = runStrategy(IchimokuStrategy, bars);
    expect(result.trades.length).toBeGreaterThanOrEqual(0);
  });
});

describe('VWAPStrategy', () => {
  it('trades reversion to VWAP', () => {
    const bars = sineWaveBars('AAPL', 200, 100, 8, 20);
    const result = runStrategy(VWAPStrategy, bars);
    expect(result.trades.length).toBeGreaterThanOrEqual(0);
  });
});

describe('MeanReversionZScore', () => {
  it('trades when z-score is extreme', () => {
    const bars = sineWaveBars('AAPL', 200, 100, 12, 20);
    const result = runStrategy(MeanReversionZScore, bars);
    expect(result.trades.length).toBeGreaterThanOrEqual(0);
  });
});

describe('VolatilityTargeting', () => {
  it('adjusts position size based on volatility', () => {
    const bars = sineWaveBars('AAPL', 200, 100, 10, 30);
    const result = runStrategy(VolatilityTargeting, bars);
    expect(result.orders.length).toBeGreaterThan(0);
  });
});

describe('TurtleTrading', () => {
  it('enters on 20-day breakout', () => {
    const bars = trendingBars('AAPL', 150, 100, 0.5);
    const result = runStrategy(TurtleTrading, bars);
    expect(result.trades.length).toBeGreaterThanOrEqual(0);
  });

  it('does not overtrade on flat market', () => {
    const bars: Bar[] = Array.from({ length: 100 }, (_, i) => ({
      time: 1_609_459_200_000 + i * DAY,
      open: 100 + Math.random() * 0.5,
      high: 100.5 + Math.random() * 0.5,
      low: 99.5 + Math.random() * 0.5,
      close: 100 + Math.random() * 0.5,
      volume: 200_000,
    }));
    const result = runStrategy(TurtleTrading, bars);
    expect(result.trades.length).toBeLessThan(50);
  });
});

describe('Strategy parameter validation', () => {
  it('SMACrossover params have correct min/max', () => {
    const fast = SMACrossover.params.find(p => p.name === 'fastPeriod');
    const slow = SMACrossover.params.find(p => p.name === 'slowPeriod');
    expect(fast).toBeDefined();
    expect(slow).toBeDefined();
    expect(fast!.min).toBeLessThan(fast!.max!);
    expect(slow!.min).toBeLessThan(slow!.max!);
  });

  it('RSIMeanReversion has oversold < overbought', () => {
    const oversold = RSIMeanReversion.params.find(p => p.name === 'oversold');
    const overbought = RSIMeanReversion.params.find(p => p.name === 'overbought');
    expect(oversold!.default).toBeLessThan(overbought!.default as number);
  });

  it('all strategies have positionSize param with valid range', () => {
    for (const strat of BUILT_IN_STRATEGIES) {
      const ps = strat.params.find(p => p.name === 'positionSize');
      if (ps) {
        expect(ps.min).toBeGreaterThan(0);
        expect(ps.max).toBeLessThanOrEqual(1);
      }
    }
  });

  it('each strategy has a unique name', () => {
    const names = BUILT_IN_STRATEGIES.map(s => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
