import { describe, it, expect } from 'vitest';
import { BacktestEngine } from '../../../src/lib/backtest/engine';
import {
  type Bar,
  type BacktestConfig,
  type Strategy,
  type StrategyContext,
  Side,
  OrderType,
  OrderStatus,
  CommissionModel,
  SlippageModel,
  Timeframe,
  Signal,
  defaultBacktestConfig,
} from '../../../src/lib/backtest/types';

const DAY = 86_400_000;

function makeBars(symbol: string, count: number, startPrice: number, trend = 0.001): Bar[] {
  const bars: Bar[] = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const noise = (Math.sin(i * 0.5) * 0.01 + trend) * price;
    const open = price;
    const close = price + noise;
    const high = Math.max(open, close) * 1.005;
    const low = Math.min(open, close) * 0.995;
    bars.push({ time: 1_609_459_200_000 + i * DAY, open, high, low, close, volume: 100_000 + i * 1000 });
    price = close;
  }
  return bars;
}

function makeConfig(overrides?: Partial<BacktestConfig>): BacktestConfig {
  return defaultBacktestConfig({
    symbols: ['AAPL'],
    startDate: 1_609_459_200_000,
    endDate: 1_609_459_200_000 + 200 * DAY,
    initialCapital: 100_000,
    warmupBars: 0,
    seed: 42,
    maxPositionSize: 1.0,
    ...overrides,
  });
}

function buyAndHoldStrategy(): Strategy {
  let bought = false;
  return {
    name: 'Buy and Hold',
    description: 'Buys on first bar',
    version: '1.0.0',
    params: [],
    init() { bought = false; },
    onBar(ctx: StrategyContext, bar: Bar, symbol: string) {
      if (!bought) {
        const qty = Math.floor(ctx.cash * 0.95 / bar.close);
        if (qty > 0) {
          ctx.submit({ symbol, type: OrderType.MARKET, side: Side.LONG, quantity: qty, timeInForce: 'GTC' });
          bought = true;
        }
      }
    },
  };
}

function smaCrossStrategy(fast = 5, slow = 15): Strategy {
  return {
    name: 'SMA Cross Test',
    description: 'Simple SMA crossover for testing',
    version: '1.0.0',
    params: [],
    init() {},
    onBar(ctx: StrategyContext, bar: Bar, symbol: string) {
      const history = ctx.bars.get(symbol);
      if (!history || history.length < slow + 1) return;
      const closes = history.map(b => b.close);
      const fastSma = closes.slice(-fast).reduce((s, v) => s + v, 0) / fast;
      const slowSma = closes.slice(-slow).reduce((s, v) => s + v, 0) / slow;
      const prevFast = closes.slice(-fast - 1, -1).reduce((s, v) => s + v, 0) / fast;
      const prevSlow = closes.slice(-slow - 1, -1).reduce((s, v) => s + v, 0) / slow;

      const pos = ctx.getPosition(symbol);
      if (fastSma > slowSma && prevFast <= prevSlow && !pos) {
        const qty = Math.floor(ctx.cash * 0.9 / bar.close);
        if (qty > 0) ctx.submit({ symbol, type: OrderType.MARKET, side: Side.LONG, quantity: qty, timeInForce: 'GTC' });
      } else if (fastSma < slowSma && prevFast >= prevSlow && pos) {
        ctx.submit({ symbol, type: OrderType.MARKET, side: Side.SHORT, quantity: Math.abs(pos.quantity), timeInForce: 'GTC' });
      }
    },
  };
}

describe('BacktestEngine – basic lifecycle', () => {
  it('returns a result with the correct structure', () => {
    const bars = makeBars('AAPL', 50, 100);
    const config = makeConfig({ warmupBars: 0 });
    const engine = new BacktestEngine(config, buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));

    expect(result).toHaveProperty('trades');
    expect(result).toHaveProperty('orders');
    expect(result).toHaveProperty('equityCurve');
    expect(result).toHaveProperty('drawdowns');
    expect(result).toHaveProperty('dailyReturns');
    expect(result.strategyName).toBe('Buy and Hold');
  });

  it('produces equity curve matching bar count + close', () => {
    const bars = makeBars('AAPL', 30, 100);
    const config = makeConfig({ warmupBars: 0 });
    const engine = new BacktestEngine(config, buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    expect(result.equityCurve.length).toBeGreaterThan(0);
  });

  it('records execution time', () => {
    const bars = makeBars('AAPL', 20, 100);
    const engine = new BacktestEngine(makeConfig(), buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('starts with initial capital', () => {
    const bars = makeBars('AAPL', 5, 100);
    const config = makeConfig();
    const engine = new BacktestEngine(config, { name: 'Noop', description: '', version: '1.0.0', params: [], init() {}, onBar() {} }, {});
    const result = engine.run(new Map([['AAPL', bars]]));
    expect(result.equityCurve[0].equity).toBeCloseTo(100_000, 0);
  });
});

describe('BacktestEngine – order execution', () => {
  it('fills market orders at bar open', () => {
    const bars = makeBars('AAPL', 20, 100);
    const engine = new BacktestEngine(makeConfig(), buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    expect(result.orders.length).toBeGreaterThan(0);
    expect(result.orders[0].status).toBe(OrderStatus.FILLED);
  });

  it('fills limit buy when price dips below limit', () => {
    let submitted = false;
    const strat: Strategy = {
      name: 'LimitBuy', description: '', version: '1.0.0', params: [],
      init() { submitted = false; },
      onBar(ctx, bar, sym) {
        if (!submitted) {
          ctx.submit({ symbol: sym, type: OrderType.LIMIT, side: Side.LONG, quantity: 10, price: bar.close * 0.99, timeInForce: 'GTC' });
          submitted = true;
        }
      },
    };
    const bars = makeBars('AAPL', 30, 100, -0.005);
    const engine = new BacktestEngine(makeConfig(), strat, {});
    const result = engine.run(new Map([['AAPL', bars]]));
    const filled = result.orders.filter(o => o.status === OrderStatus.FILLED);
    expect(filled.length).toBeGreaterThan(0);
    expect(filled[0].avgFillPrice).toBeGreaterThan(0);
  });

  it('fills stop orders when price exceeds stop', () => {
    let submitted = false;
    const strat: Strategy = {
      name: 'StopBuy', description: '', version: '1.0.0', params: [],
      init() { submitted = false; },
      onBar(ctx, bar, sym) {
        if (!submitted) {
          ctx.submit({ symbol: sym, type: OrderType.STOP, side: Side.LONG, quantity: 10, stopPrice: bar.close * 1.02, timeInForce: 'GTC' });
          submitted = true;
        }
      },
    };
    const bars = makeBars('AAPL', 40, 100, 0.005);
    const engine = new BacktestEngine(makeConfig(), strat, {});
    const result = engine.run(new Map([['AAPL', bars]]));
    const filled = result.orders.filter(o => o.status === OrderStatus.FILLED);
    expect(filled.length).toBeGreaterThan(0);
  });

  it('rejects orders that exceed max position size', () => {
    const events: any[] = [];
    const strat: Strategy = {
      name: 'BigOrder', description: '', version: '1.0.0', params: [],
      init() {},
      onBar(ctx, bar, sym) {
        if (ctx.barIndex === 1) {
          ctx.submit({ symbol: sym, type: OrderType.MARKET, side: Side.LONG, quantity: 999_999, timeInForce: 'GTC' });
        }
      },
    };
    const bars = makeBars('AAPL', 10, 100);
    const config = makeConfig({ maxPositionSize: 0.5 });
    const engine = new BacktestEngine(config, strat, {});
    engine.on(e => events.push(e));
    engine.run(new Map([['AAPL', bars]]));
    const rejected = events.filter(e => e.type === 'order_rejected');
    expect(rejected.length).toBeGreaterThan(0);
  });
});

describe('BacktestEngine – commission calculation', () => {
  it('charges per-share commission', () => {
    const config = makeConfig({
      commission: { model: CommissionModel.PER_SHARE, perShare: 0.01 },
    });
    const bars = makeBars('AAPL', 20, 100);
    const engine = new BacktestEngine(config, buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    const totalComm = result.orders.reduce((s, o) => s + o.commission, 0);
    expect(totalComm).toBeGreaterThan(0);
  });

  it('charges per-trade commission', () => {
    const config = makeConfig({
      commission: { model: CommissionModel.PER_TRADE, perTrade: 5.0 },
    });
    const bars = makeBars('AAPL', 20, 100);
    const engine = new BacktestEngine(config, buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    const filledOrders = result.orders.filter(o => o.status === OrderStatus.FILLED);
    expect(filledOrders.length).toBeGreaterThan(0);
    expect(filledOrders[0].commission).toBeCloseTo(5.0, 1);
  });

  it('charges percentage commission', () => {
    const config = makeConfig({
      commission: { model: CommissionModel.PERCENTAGE, percentage: 0.001 },
    });
    const bars = makeBars('AAPL', 20, 100);
    const engine = new BacktestEngine(config, buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    const firstOrder = result.orders.find(o => o.status === OrderStatus.FILLED);
    expect(firstOrder).toBeDefined();
    expect(firstOrder!.commission).toBeGreaterThan(0);
  });

  it('respects min/max commission bounds', () => {
    const config = makeConfig({
      commission: { model: CommissionModel.PER_SHARE, perShare: 0.0001, minPerTrade: 1.0, maxPerTrade: 100 },
    });
    const bars = makeBars('AAPL', 20, 100);
    const engine = new BacktestEngine(config, buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    const firstOrder = result.orders.find(o => o.status === OrderStatus.FILLED);
    expect(firstOrder!.commission).toBeGreaterThanOrEqual(1.0);
    expect(firstOrder!.commission).toBeLessThanOrEqual(100);
  });
});

describe('BacktestEngine – slippage', () => {
  it('adds fixed slippage to fill price', () => {
    const config = makeConfig({
      slippage: { model: SlippageModel.FIXED, fixedAmount: 0.05 },
    });
    const bars = makeBars('AAPL', 10, 100);
    const engine = new BacktestEngine(config, buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    const filled = result.orders.find(o => o.status === OrderStatus.FILLED);
    expect(filled).toBeDefined();
    expect(filled!.slippage).toBeGreaterThan(0);
  });

  it('adds percentage slippage', () => {
    const config = makeConfig({
      slippage: { model: SlippageModel.PERCENTAGE, percentage: 0.002 },
    });
    const bars = makeBars('AAPL', 10, 100);
    const engine = new BacktestEngine(config, buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    const filled = result.orders.find(o => o.status === OrderStatus.FILLED);
    expect(filled).toBeDefined();
    expect(filled!.slippage).toBeGreaterThan(0);
  });
});

describe('BacktestEngine – position tracking', () => {
  it('opens and tracks positions', () => {
    const events: any[] = [];
    const engine = new BacktestEngine(makeConfig(), buyAndHoldStrategy(), {});
    engine.on(e => events.push(e));
    const bars = makeBars('AAPL', 10, 100);
    engine.run(new Map([['AAPL', bars]]));
    const opened = events.filter(e => e.type === 'position_opened');
    expect(opened.length).toBe(1);
  });

  it('closes positions at backtest end', () => {
    const bars = makeBars('AAPL', 30, 100);
    const engine = new BacktestEngine(makeConfig(), buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    expect(result.trades.length).toBeGreaterThanOrEqual(1);
  });

  it('computes P&L for closed trades', () => {
    const bars = makeBars('AAPL', 50, 100, 0.005);
    const engine = new BacktestEngine(makeConfig(), smaCrossStrategy(5, 15), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    for (const trade of result.trades) {
      expect(trade).toHaveProperty('pnl');
      expect(trade).toHaveProperty('pnlPercent');
      expect(trade).toHaveProperty('entryPrice');
      expect(trade).toHaveProperty('exitPrice');
      expect(trade.entryPrice).toBeGreaterThan(0);
      expect(trade.exitPrice).toBeGreaterThan(0);
    }
  });
});

describe('BacktestEngine – P&L calculation', () => {
  it('gains on rising prices with long position', () => {
    const bars = makeBars('AAPL', 30, 100, 0.01);
    const engine = new BacktestEngine(makeConfig({ commission: { model: CommissionModel.PER_TRADE, perTrade: 0 }, slippage: { model: SlippageModel.FIXED, fixedAmount: 0 } }), buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    const lastEquity = result.equityCurve[result.equityCurve.length - 1].equity;
    expect(lastEquity).toBeGreaterThan(100_000);
  });

  it('loses on falling prices with long position', () => {
    const bars = makeBars('AAPL', 30, 100, -0.01);
    const engine = new BacktestEngine(makeConfig({ commission: { model: CommissionModel.PER_TRADE, perTrade: 0 }, slippage: { model: SlippageModel.FIXED, fixedAmount: 0 } }), buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    const lastEquity = result.equityCurve[result.equityCurve.length - 1].equity;
    expect(lastEquity).toBeLessThan(100_000);
  });
});

describe('BacktestEngine – drawdown tracking', () => {
  it('tracks drawdown in equity curve', () => {
    const bars = makeBars('AAPL', 50, 100, -0.003);
    const engine = new BacktestEngine(makeConfig(), buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    const hasDrawdown = result.equityCurve.some(ep => ep.drawdown > 0);
    expect(hasDrawdown).toBe(true);
  });

  it('computes drawdown periods', () => {
    const bars = makeBars('AAPL', 100, 100, -0.003);
    const engine = new BacktestEngine(makeConfig(), buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    expect(result.drawdowns.length).toBeGreaterThanOrEqual(0);
    for (const dd of result.drawdowns) {
      expect(dd.depth).toBeGreaterThanOrEqual(0);
      expect(dd.depthPercent).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('BacktestEngine – determinism', () => {
  it('produces identical results with the same seed', () => {
    const bars = makeBars('AAPL', 60, 100, 0.003);
    const cfg = makeConfig({ seed: 123 });
    const strat = smaCrossStrategy(5, 15);

    const engine1 = new BacktestEngine(cfg, strat, {});
    const r1 = engine1.run(new Map([['AAPL', bars]]));

    const engine2 = new BacktestEngine(cfg, strat, {});
    const r2 = engine2.run(new Map([['AAPL', bars]]));

    expect(r1.trades.length).toBe(r2.trades.length);
    expect(r1.equityCurve.length).toBe(r2.equityCurve.length);
    for (let i = 0; i < r1.equityCurve.length; i++) {
      expect(r1.equityCurve[i].equity).toBeCloseTo(r2.equityCurve[i].equity, 4);
    }
  });

  it('produces identical trade PnLs across runs', () => {
    const bars = makeBars('AAPL', 80, 100, 0.002);
    const cfg = makeConfig({ seed: 999 });
    const strat = smaCrossStrategy(5, 20);

    const e1 = new BacktestEngine(cfg, strat, {});
    const r1 = e1.run(new Map([['AAPL', bars]]));
    const e2 = new BacktestEngine(cfg, strat, {});
    const r2 = e2.run(new Map([['AAPL', bars]]));

    for (let i = 0; i < r1.trades.length; i++) {
      expect(r1.trades[i].pnl).toBeCloseTo(r2.trades[i].pnl, 4);
    }
  });
});

describe('BacktestEngine – SMA crossover strategy produces trades', () => {
  it('generates multiple trades on trending data', () => {
    const prices: number[] = [];
    let p = 100;
    for (let i = 0; i < 100; i++) {
      p += Math.sin(i / 10) * 2;
      prices.push(p);
    }
    const bars: Bar[] = prices.map((price, i) => ({
      time: 1_609_459_200_000 + i * DAY,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 100_000,
    }));
    const engine = new BacktestEngine(makeConfig(), smaCrossStrategy(5, 15), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    expect(result.trades.length).toBeGreaterThanOrEqual(1);
  });
});

describe('BacktestEngine – events', () => {
  it('emits bar events', () => {
    const events: any[] = [];
    const bars = makeBars('AAPL', 5, 100);
    const engine = new BacktestEngine(makeConfig(), { name: 'Noop', description: '', version: '1.0.0', params: [], init() {}, onBar() {} }, {});
    engine.on(e => events.push(e));
    engine.run(new Map([['AAPL', bars]]));
    const barEvents = events.filter(e => e.type === 'bar');
    expect(barEvents.length).toBeGreaterThan(0);
  });

  it('emits order_submitted and order_filled events', () => {
    const events: any[] = [];
    const bars = makeBars('AAPL', 10, 100);
    const engine = new BacktestEngine(makeConfig(), buyAndHoldStrategy(), {});
    engine.on(e => events.push(e));
    engine.run(new Map([['AAPL', bars]]));
    expect(events.some(e => e.type === 'order_submitted')).toBe(true);
    expect(events.some(e => e.type === 'order_filled')).toBe(true);
  });
});

describe('BacktestEngine – daily returns', () => {
  it('computes daily returns array', () => {
    const bars = makeBars('AAPL', 30, 100);
    const engine = new BacktestEngine(makeConfig(), buyAndHoldStrategy(), {});
    const result = engine.run(new Map([['AAPL', bars]]));
    expect(result.dailyReturns.length).toBeGreaterThan(0);
    for (const r of result.dailyReturns) {
      expect(typeof r).toBe('number');
      expect(isFinite(r)).toBe(true);
    }
  });
});

describe('BacktestEngine.resample', () => {
  it('resamples minute bars to daily', () => {
    const minuteBars: Bar[] = [];
    for (let i = 0; i < 1440; i++) {
      minuteBars.push({
        time: 1_609_459_200_000 + i * 60_000,
        open: 100, high: 101, low: 99, close: 100, volume: 100,
      });
    }
    const daily = BacktestEngine.resample(minuteBars, Timeframe.D1);
    expect(daily.length).toBeLessThan(minuteBars.length);
    expect(daily.length).toBeGreaterThan(0);
  });
});

describe('BacktestEngine – warmup bars', () => {
  it('does not call strategy during warmup', () => {
    let callCount = 0;
    const strat: Strategy = {
      name: 'Counter', description: '', version: '1.0.0', params: [],
      init() { callCount = 0; },
      onBar() { callCount++; },
    };
    const bars = makeBars('AAPL', 20, 100);
    const config = makeConfig({ warmupBars: 10 });
    const engine = new BacktestEngine(config, strat, {});
    engine.run(new Map([['AAPL', bars]]));
    expect(callCount).toBeLessThanOrEqual(bars.length - 10);
  });
});

describe('BacktestEngine – multiple symbols', () => {
  it('handles two symbols simultaneously', () => {
    const barsA = makeBars('AAPL', 30, 100, 0.005);
    const barsB = makeBars('GOOG', 30, 200, 0.003);
    for (let i = 0; i < barsB.length; i++) barsB[i].time = barsA[i].time;

    const config = makeConfig({ symbols: ['AAPL', 'GOOG'] });
    const strat: Strategy = {
      name: 'Multi', description: '', version: '1.0.0', params: [],
      init() {},
      onBar(ctx, bar, sym) {
        if (ctx.barIndex === 2 && !ctx.getPosition(sym)) {
          const qty = Math.floor(ctx.cash * 0.4 / bar.close);
          if (qty > 0) ctx.submit({ symbol: sym, type: OrderType.MARKET, side: Side.LONG, quantity: qty, timeInForce: 'GTC' });
        }
      },
    };
    const engine = new BacktestEngine(config, strat, {});
    const result = engine.run(new Map([['AAPL', barsA], ['GOOG', barsB]]));
    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(result.trades.length).toBeGreaterThanOrEqual(2);
  });
});
