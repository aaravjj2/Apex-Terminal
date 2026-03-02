import { describe, it, expect } from 'vitest';
import { PreTradeRiskEngine, type PositionState } from '../../../src/lib/orders/riskChecks';
import { OrderSide, OrderType, OrderStatus, TimeInForce } from '../../../src/lib/orders/types';
import type { Order, RiskLimits } from '../../../src/lib/orders/types';

function makeLimits(overrides?: Partial<RiskLimits>): RiskLimits {
  return {
    maxPositionSize: 10_000,
    maxNotionalValue: 1_000_000,
    maxConcentrationPct: 25,
    maxPriceDeviationPct: 5,
    dailyLossLimit: 50_000,
    orderRateLimit: 100,
    orderRateWindowMs: 60_000,
    marginRequirementPct: 50,
    maxCreditExposure: 5_000_000,
    ...overrides,
  };
}

function makeState(overrides?: Partial<PositionState>): PositionState {
  return {
    currentPositionQty: 0,
    currentPositionNotional: 0,
    portfolioNotional: 1_000_000,
    dailyPnL: 0,
    ordersInWindow: 0,
    marginUsed: 50_000,
    availableMargin: 500_000,
    creditUsed: 100_000,
    creditLimit: 5_000_000,
    shortInventory: new Map(),
    restrictedSymbols: new Set(),
    lastTradePrice: 150,
    prevClosePrice: 155,
    bidPrice: 149.90,
    askPrice: 150.10,
    ...overrides,
  };
}

function makeOrder(overrides?: Partial<Order>): Order {
  return {
    id: 'O-1', clientOrderId: 'C-1', accountId: 'ACC-1',
    symbol: 'AAPL', side: OrderSide.BUY, type: OrderType.LIMIT,
    timeInForce: TimeInForce.DAY, status: OrderStatus.NEW,
    quantity: 100, filledQuantity: 0, remainingQuantity: 100,
    price: 150, avgFillPrice: 0, commission: 0,
    createdAt: Date.now(), updatedAt: Date.now(), tags: {},
    ...overrides,
  };
}

describe('Position limit check', () => {
  it('passes when within limit', () => {
    const engine = new PreTradeRiskEngine(makeLimits());
    const result = engine.checkPositionLimit(makeOrder({ remainingQuantity: 500 }), makeState());
    expect(result.passed).toBe(true);
  });

  it('fails when exceeding limit', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ maxPositionSize: 50 }));
    const result = engine.checkPositionLimit(makeOrder({ remainingQuantity: 100 }), makeState());
    expect(result.passed).toBe(false);
    expect(result.checkName).toBe('Position Limit');
  });

  it('accounts for existing position', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ maxPositionSize: 150 }));
    const result = engine.checkPositionLimit(
      makeOrder({ remainingQuantity: 100 }),
      makeState({ currentPositionQty: 100 }),
    );
    expect(result.passed).toBe(false);
  });
});

describe('Notional limit check', () => {
  it('passes when notional within limit', () => {
    const engine = new PreTradeRiskEngine(makeLimits());
    const result = engine.checkNotionalLimit(makeOrder({ remainingQuantity: 100, price: 150 }), makeState());
    expect(result.passed).toBe(true);
  });

  it('fails when notional exceeds limit', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ maxNotionalValue: 10_000 }));
    const result = engine.checkNotionalLimit(
      makeOrder({ remainingQuantity: 100, price: 150 }),
      makeState(),
    );
    expect(result.passed).toBe(false);
    expect(result.checkName).toBe('Notional Limit');
  });

  it('includes existing notional', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ maxNotionalValue: 50_000 }));
    const result = engine.checkNotionalLimit(
      makeOrder({ remainingQuantity: 100, price: 150 }),
      makeState({ currentPositionNotional: 40_000 }),
    );
    expect(result.passed).toBe(false);
  });
});

describe('Fat finger check', () => {
  it('passes for normal price', () => {
    const engine = new PreTradeRiskEngine(makeLimits());
    const result = engine.checkFatFinger(makeOrder({ price: 150 }), makeState({ lastTradePrice: 150 }));
    expect(result.passed).toBe(true);
  });

  it('fails for extreme price deviation', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ maxPriceDeviationPct: 5 }));
    const result = engine.checkFatFinger(makeOrder({ price: 200 }), makeState({ lastTradePrice: 150 }));
    expect(result.passed).toBe(false);
    expect(result.checkName).toBe('Fat Finger');
  });

  it('skips when no price on order', () => {
    const engine = new PreTradeRiskEngine(makeLimits());
    const result = engine.checkFatFinger(makeOrder({ price: undefined, limitPrice: undefined }), makeState());
    expect(result.passed).toBe(true);
  });

  it('passes at exactly the threshold', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ maxPriceDeviationPct: 10 }));
    const result = engine.checkFatFinger(makeOrder({ price: 165 }), makeState({ lastTradePrice: 150 }));
    expect(result.passed).toBe(true);
  });
});

describe('Daily loss limit', () => {
  it('passes when daily PnL is positive', () => {
    const engine = new PreTradeRiskEngine(makeLimits());
    const result = engine.checkDailyLossLimit(makeState({ dailyPnL: 5000 }));
    expect(result.passed).toBe(true);
  });

  it('passes when loss is below limit', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ dailyLossLimit: 50_000 }));
    const result = engine.checkDailyLossLimit(makeState({ dailyPnL: -30_000 }));
    expect(result.passed).toBe(true);
  });

  it('fails when loss exceeds limit', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ dailyLossLimit: 50_000 }));
    const result = engine.checkDailyLossLimit(makeState({ dailyPnL: -60_000 }));
    expect(result.passed).toBe(false);
    expect(result.checkName).toBe('Daily Loss Limit');
  });
});

describe('Order rate limit', () => {
  it('passes when few orders', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ orderRateLimit: 10, orderRateWindowMs: 60_000 }));
    const result = engine.checkOrderRateLimit();
    expect(result.passed).toBe(true);
  });

  it('fails when too many orders in window', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ orderRateLimit: 3, orderRateWindowMs: 60_000 }));
    const order = makeOrder();
    const state = makeState();
    engine.runAllChecks(order, state);
    engine.runAllChecks(order, state);
    engine.runAllChecks(order, state);
    const results = engine.runAllChecks(order, state);
    const rateCheck = results.find(r => r.checkName === 'Order Rate Limit');
    expect(rateCheck!.passed).toBe(false);
  });
});

describe('validate (aggregate)', () => {
  it('passes when all checks pass', () => {
    const engine = new PreTradeRiskEngine(makeLimits());
    const { passed, rejections } = engine.validate(makeOrder(), makeState());
    expect(passed).toBe(true);
    expect(rejections).toHaveLength(0);
  });

  it('fails with rejections when limit exceeded', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ maxPositionSize: 10 }));
    const { passed, rejections } = engine.validate(makeOrder({ remainingQuantity: 100 }), makeState());
    expect(passed).toBe(false);
    expect(rejections.length).toBeGreaterThan(0);
    expect(rejections[0].severity).toBe('HARD_REJECT');
  });
});

describe('updateLimits', () => {
  it('updates limits and reflects in checks', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ maxPositionSize: 50 }));
    let result = engine.checkPositionLimit(makeOrder({ remainingQuantity: 100 }), makeState());
    expect(result.passed).toBe(false);

    engine.updateLimits({ maxPositionSize: 200 });
    result = engine.checkPositionLimit(makeOrder({ remainingQuantity: 100 }), makeState());
    expect(result.passed).toBe(true);
  });
});

describe('getRiskSummary', () => {
  it('returns risk utilization metrics', () => {
    const engine = new PreTradeRiskEngine(makeLimits());
    const summary = engine.getRiskSummary(makeState({
      currentPositionQty: 5000,
      currentPositionNotional: 500_000,
    }));
    expect(summary.positionUtilization).toBe(0.5);
    expect(summary.notionalUtilization).toBe(0.5);
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(summary.overallRisk);
  });

  it('returns CRITICAL for near-limit usage', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ maxPositionSize: 100 }));
    const summary = engine.getRiskSummary(makeState({ currentPositionQty: 99 }));
    expect(summary.overallRisk).toBe('CRITICAL');
  });

  it('returns LOW for minimal usage', () => {
    const engine = new PreTradeRiskEngine(makeLimits());
    const summary = engine.getRiskSummary(makeState({ currentPositionQty: 10, currentPositionNotional: 1500 }));
    expect(summary.overallRisk).toBe('LOW');
  });
});

describe('Margin requirement check', () => {
  it('passes when margin available', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ marginRequirementPct: 50 }));
    const result = engine.checkMarginRequirement(
      makeOrder({ remainingQuantity: 100, price: 100 }),
      makeState({ availableMargin: 100_000 }),
    );
    expect(result.passed).toBe(true);
  });

  it('fails when insufficient margin', () => {
    const engine = new PreTradeRiskEngine(makeLimits({ marginRequirementPct: 50 }));
    const result = engine.checkMarginRequirement(
      makeOrder({ remainingQuantity: 1000, price: 150 }),
      makeState({ availableMargin: 1000 }),
    );
    expect(result.passed).toBe(false);
  });
});

describe('Restricted list check', () => {
  it('passes for non-restricted symbol', () => {
    const engine = new PreTradeRiskEngine(makeLimits());
    const result = engine.checkRestrictedList(makeOrder({ symbol: 'AAPL' }), makeState({ restrictedSymbols: new Set(['TSLA']) }));
    expect(result.passed).toBe(true);
  });

  it('fails for restricted symbol', () => {
    const engine = new PreTradeRiskEngine(makeLimits());
    const result = engine.checkRestrictedList(makeOrder({ symbol: 'AAPL' }), makeState({ restrictedSymbols: new Set(['AAPL']) }));
    expect(result.passed).toBe(false);
  });
});
