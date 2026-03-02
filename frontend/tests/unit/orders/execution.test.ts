import { describe, it, expect } from 'vitest';
import {
  executeTWAP, executeVWAP, executeImplementationShortfall,
  executePOV, executeArrivalPrice,
} from '../../../src/lib/orders/execution';
import { OrderSide, AlgoType } from '../../../src/lib/orders/types';

const NOW = Date.now();
const HOUR = 3_600_000;

describe('TWAP schedule generation', () => {
  it('generates correct number of slices', () => {
    const result = executeTWAP('AAPL', OrderSide.BUY, 10_000, {
      algo: AlgoType.TWAP, startTime: NOW, endTime: NOW + 4 * HOUR, sliceIntervalMs: HOUR,
    }, 150);
    expect(result.schedule.slices.length).toBe(4);
    expect(result.schedule.algoType).toBe(AlgoType.TWAP);
  });

  it('total quantity across slices equals total order', () => {
    const result = executeTWAP('AAPL', OrderSide.BUY, 1000, {
      algo: AlgoType.TWAP, startTime: NOW, endTime: NOW + 5 * HOUR, sliceIntervalMs: HOUR,
    }, 100);
    const totalSliceQty = result.schedule.slices.reduce((s, sl) => s + sl.targetQuantity, 0);
    expect(totalSliceQty).toBeCloseTo(1000, -1);
  });

  it('generates child orders matching slices', () => {
    const result = executeTWAP('AAPL', OrderSide.BUY, 500, {
      algo: AlgoType.TWAP, startTime: NOW, endTime: NOW + 5 * HOUR, sliceIntervalMs: HOUR,
    }, 100);
    expect(result.childOrders.length).toBe(result.schedule.slices.length);
  });

  it('calculates positive cost estimates', () => {
    const result = executeTWAP('AAPL', OrderSide.BUY, 10_000, {
      algo: AlgoType.TWAP, startTime: NOW, endTime: NOW + 6 * HOUR, sliceIntervalMs: HOUR,
    }, 150);
    expect(result.expectedCost.spreadCost).toBeGreaterThan(0);
    expect(result.expectedCost.totalExpectedCost).toBeGreaterThan(0);
    expect(result.expectedCost.costBps).toBeGreaterThan(0);
  });

  it('slices have sequential scheduled times', () => {
    const result = executeTWAP('AAPL', OrderSide.BUY, 1000, {
      algo: AlgoType.TWAP, startTime: NOW, endTime: NOW + 3 * HOUR, sliceIntervalMs: HOUR,
    }, 100);
    for (let i = 1; i < result.schedule.slices.length; i++) {
      expect(result.schedule.slices[i].scheduledTime).toBeGreaterThan(result.schedule.slices[i - 1].scheduledTime);
    }
  });

  it('risk metrics are populated', () => {
    const result = executeTWAP('AAPL', OrderSide.BUY, 5000, {
      algo: AlgoType.TWAP, startTime: NOW, endTime: NOW + 4 * HOUR, sliceIntervalMs: HOUR,
    }, 100);
    expect(result.riskMetrics.participationRate).toBeGreaterThan(0);
    expect(typeof result.riskMetrics.trackingError).toBe('number');
  });
});

describe('VWAP schedule generation', () => {
  const volumeProfile = [10, 25, 30, 20, 15];

  it('generates slices matching volume profile length', () => {
    const result = executeVWAP('AAPL', OrderSide.BUY, 1000, {
      algo: AlgoType.VWAP, startTime: NOW, endTime: NOW + 5 * HOUR, volumeProfile,
    }, 150);
    expect(result.schedule.slices.length).toBe(5);
  });

  it('allocates more to higher-volume periods', () => {
    const result = executeVWAP('AAPL', OrderSide.BUY, 1000, {
      algo: AlgoType.VWAP, startTime: NOW, endTime: NOW + 5 * HOUR, volumeProfile,
    }, 150);
    const sliceQtys = result.schedule.slices.map(s => s.targetQuantity);
    expect(sliceQtys[2]).toBeGreaterThan(sliceQtys[0]);
  });

  it('total quantity sums to order quantity', () => {
    const result = executeVWAP('AAPL', OrderSide.BUY, 2000, {
      algo: AlgoType.VWAP, startTime: NOW, endTime: NOW + 5 * HOUR, volumeProfile,
    }, 100);
    const total = result.schedule.slices.reduce((s, sl) => s + sl.targetQuantity, 0);
    expect(total).toBe(2000);
  });

  it('throws on zero-sum volume profile', () => {
    expect(() => executeVWAP('AAPL', OrderSide.BUY, 1000, {
      algo: AlgoType.VWAP, startTime: NOW, endTime: NOW + 3 * HOUR, volumeProfile: [0, 0, 0],
    }, 100)).toThrow();
  });

  it('cost estimation is positive', () => {
    const result = executeVWAP('AAPL', OrderSide.BUY, 5000, {
      algo: AlgoType.VWAP, startTime: NOW, endTime: NOW + 5 * HOUR, volumeProfile,
    }, 100);
    expect(result.expectedCost.totalExpectedCost).toBeGreaterThan(0);
  });
});

describe('Implementation Shortfall', () => {
  it('generates an Almgren-Chriss trajectory', () => {
    const result = executeImplementationShortfall('AAPL', OrderSide.BUY, 10_000, {
      algo: AlgoType.IMPLEMENTATION_SHORTFALL,
      urgency: 0.5,
      riskAversion: 1e-6,
      volatility: 0.02,
      dailyVolume: 1_000_000,
      temporaryImpact: 0.1,
      permanentImpact: 0.05,
      startTime: NOW,
      endTime: NOW + 6.5 * HOUR,
    }, 150);
    expect(result.schedule.slices.length).toBeGreaterThan(0);
    expect(result.schedule.algoType).toBe(AlgoType.IMPLEMENTATION_SHORTFALL);
  });

  it('front-loads trades for high risk aversion', () => {
    const result = executeImplementationShortfall('AAPL', OrderSide.BUY, 10_000, {
      algo: AlgoType.IMPLEMENTATION_SHORTFALL,
      urgency: 0.8,
      riskAversion: 1e-4,
      volatility: 0.02,
      dailyVolume: 1_000_000,
      temporaryImpact: 0.1,
      permanentImpact: 0.05,
      startTime: NOW,
      endTime: NOW + 6 * HOUR,
    }, 150);
    const slices = result.schedule.slices;
    if (slices.length >= 2) {
      expect(slices[0].targetQuantity).toBeGreaterThanOrEqual(slices[slices.length - 1].targetQuantity);
    }
  });

  it('cost decomposition includes permanent and temporary impact', () => {
    const result = executeImplementationShortfall('AAPL', OrderSide.BUY, 5000, {
      algo: AlgoType.IMPLEMENTATION_SHORTFALL,
      urgency: 0.5,
      riskAversion: 1e-6,
      volatility: 0.02,
      dailyVolume: 500_000,
      temporaryImpact: 0.1,
      permanentImpact: 0.05,
      startTime: NOW,
      endTime: NOW + 6 * HOUR,
    }, 100);
    expect(result.expectedCost.impactCost).toBeGreaterThan(0);
    expect(result.expectedCost.timingRisk).toBeGreaterThan(0);
  });

  it('child orders are created', () => {
    const result = executeImplementationShortfall('AAPL', OrderSide.SELL, 3000, {
      algo: AlgoType.IMPLEMENTATION_SHORTFALL,
      urgency: 0.3,
      riskAversion: 1e-6,
      volatility: 0.015,
      dailyVolume: 800_000,
      temporaryImpact: 0.08,
      permanentImpact: 0.03,
      startTime: NOW,
      endTime: NOW + 4 * HOUR,
    }, 200);
    expect(result.childOrders.length).toBeGreaterThan(0);
    expect(result.childOrders[0].symbol).toBe('AAPL');
    expect(result.childOrders[0].side).toBe(OrderSide.SELL);
  });
});

describe('POV algorithm', () => {
  it('generates slices based on volume profile', () => {
    const profile = [50_000, 80_000, 100_000, 70_000, 60_000];
    const result = executePOV('AAPL', OrderSide.BUY, 5000, {
      algo: AlgoType.POV, targetRate: 0.1, startTime: NOW, endTime: NOW + 5 * HOUR,
    }, 150, profile);
    expect(result.schedule.slices.length).toBeGreaterThan(0);
  });

  it('respects target participation rate', () => {
    const profile = [100_000, 100_000, 100_000];
    const result = executePOV('AAPL', OrderSide.BUY, 10_000, {
      algo: AlgoType.POV, targetRate: 0.1, startTime: NOW, endTime: NOW + 3 * HOUR,
    }, 100, profile);
    expect(result.riskMetrics.participationRate).toBeCloseTo(0.1, 1);
  });

  it('clamps rate between min and max', () => {
    const result = executePOV('AAPL', OrderSide.BUY, 1000, {
      algo: AlgoType.POV, targetRate: 0.8, minRate: 0.01, maxRate: 0.5,
      startTime: NOW, endTime: NOW + 2 * HOUR,
    }, 100, [50_000, 50_000]);
    expect(result.riskMetrics.participationRate).toBeLessThanOrEqual(0.5);
  });

  it('cost bps is positive', () => {
    const result = executePOV('AAPL', OrderSide.BUY, 5000, {
      algo: AlgoType.POV, targetRate: 0.15, startTime: NOW, endTime: NOW + 4 * HOUR,
    }, 100, [40_000, 60_000, 50_000, 50_000]);
    expect(result.expectedCost.costBps).toBeGreaterThan(0);
  });
});

describe('Arrival Price', () => {
  it('front-loads for high urgency', () => {
    const result = executeArrivalPrice('AAPL', OrderSide.BUY, 5000, {
      algo: AlgoType.ARRIVAL_PRICE,
      arrivalPrice: 150,
      urgency: 0.9,
      riskAversion: 1e-5,
      volatility: 0.02,
      startTime: NOW,
      endTime: NOW + 4 * HOUR,
    }, 150, 1_000_000);
    const slices = result.schedule.slices;
    expect(slices.length).toBeGreaterThan(0);
    if (slices.length >= 3) {
      expect(slices[0].targetQuantity).toBeGreaterThanOrEqual(slices[slices.length - 1].targetQuantity);
    }
  });

  it('distributes more evenly for low urgency', () => {
    const result = executeArrivalPrice('AAPL', OrderSide.BUY, 3000, {
      algo: AlgoType.ARRIVAL_PRICE,
      arrivalPrice: 100,
      urgency: 0.1,
      riskAversion: 1e-6,
      volatility: 0.015,
      startTime: NOW,
      endTime: NOW + 6 * HOUR,
    }, 100, 500_000);
    expect(result.schedule.slices.length).toBeGreaterThan(1);
  });

  it('cost metrics are non-negative', () => {
    const result = executeArrivalPrice('GOOG', OrderSide.SELL, 2000, {
      algo: AlgoType.ARRIVAL_PRICE,
      arrivalPrice: 3000,
      urgency: 0.5,
      riskAversion: 1e-6,
      volatility: 0.025,
      startTime: NOW,
      endTime: NOW + 3 * HOUR,
    }, 3000, 200_000);
    expect(result.expectedCost.impactCost).toBeGreaterThanOrEqual(0);
    expect(result.expectedCost.timingRisk).toBeGreaterThanOrEqual(0);
    expect(result.expectedCost.commissions).toBeGreaterThan(0);
  });
});

describe('Cost estimation across algos', () => {
  it('TWAP commission scales with quantity', () => {
    const r1 = executeTWAP('AAPL', OrderSide.BUY, 1000, {
      algo: AlgoType.TWAP, startTime: NOW, endTime: NOW + HOUR, sliceIntervalMs: HOUR / 5,
    }, 100);
    const r2 = executeTWAP('AAPL', OrderSide.BUY, 5000, {
      algo: AlgoType.TWAP, startTime: NOW, endTime: NOW + HOUR, sliceIntervalMs: HOUR / 5,
    }, 100);
    expect(r2.expectedCost.commissions).toBeGreaterThan(r1.expectedCost.commissions);
  });

  it('VWAP has lower impact than TWAP for same order', () => {
    const twap = executeTWAP('AAPL', OrderSide.BUY, 5000, {
      algo: AlgoType.TWAP, startTime: NOW, endTime: NOW + 6 * HOUR, sliceIntervalMs: HOUR,
    }, 100);
    const vwap = executeVWAP('AAPL', OrderSide.BUY, 5000, {
      algo: AlgoType.VWAP, startTime: NOW, endTime: NOW + 6 * HOUR,
      volumeProfile: [10, 20, 30, 20, 15, 5],
    }, 100);
    expect(vwap.expectedCost.impactCost).toBeLessThan(twap.expectedCost.impactCost);
  });
});
