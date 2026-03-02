import { describe, it, expect } from 'vitest';
import {
  bullCallSpread,
  bearPutSpread,
  bullPutSpread,
  bearCallSpread,
  longStraddle,
  shortStraddle,
  longStrangle,
  shortStrangle,
  ironCondor,
  ironButterfly,
  coveredCall,
  protectivePut,
  calendarSpread,
  diagonalSpread,
  ratioCallSpread,
  ratioPutSpread,
  collar,
  jadeLizard,
  brokenWingButterfly,
  christmasTree,
  boxSpread,
  conversion,
  reversal,
  syntheticLong,
  syntheticShort,
  riskReversal,
  gutSpread,
  ladder,
  calculatePayoffAtExpiry,
  calculatePnLBeforeExpiry,
  findBreakEvenPrices,
  strategyGreeks,
  strategyMaxProfit,
  strategyMaxLoss,
  rollStrategy,
  compareStrategies,
  scenarioAnalysis,
  whatIfMatrix,
  pnlSurface,
} from '../../../src/lib/options/strategies';
import { OptionType } from '../../../src/lib/options/types';

describe('Bull Call Spread', () => {
  const strategy = bullCallSpread(95, 105, 1, 5, 2);

  it('has correct name', () => {
    expect(strategy.name).toBe('Bull Call Spread');
  });

  it('has 2 legs', () => {
    expect(strategy.legs).toHaveLength(2);
  });

  it('max profit = strike diff - net debit', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    const netDebit = 5 - 2; // long call premium - short call premium
    const expectedMaxProfit = (105 - 95) - netDebit;
    expect(payoff.maxProfit).toBeCloseTo(expectedMaxProfit, 0);
  });

  it('max loss = net debit', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    const netDebit = 5 - 2;
    expect(payoff.maxLoss).toBeCloseTo(-netDebit, 0);
  });

  it('has one breakeven between strikes', () => {
    const breakEvens = findBreakEvenPrices(strategy, [80.07, 130.07]);
    expect(breakEvens.length).toBe(1);
    expect(breakEvens[0]).toBeGreaterThan(95);
    expect(breakEvens[0]).toBeLessThan(105);
  });

  it('breakeven = lower strike + net debit', () => {
    const breakEvens = findBreakEvenPrices(strategy, [80.07, 130.07]);
    expect(breakEvens[0]).toBeCloseTo(95 + 3, 0);
  });
});

describe('Bear Put Spread', () => {
  const strategy = bearPutSpread(90, 100, 1, 2, 6);

  it('has correct name', () => {
    expect(strategy.name).toBe('Bear Put Spread');
  });

  it('max profit = strike diff - net debit', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    const netDebit = 6 - 2;
    const expectedMaxProfit = (100 - 90) - netDebit;
    expect(payoff.maxProfit).toBeCloseTo(expectedMaxProfit, 0);
  });

  it('max loss = net debit', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    expect(payoff.maxLoss).toBeCloseTo(-(6 - 2), 0);
  });
});

describe('Bull Put Spread', () => {
  const strategy = bullPutSpread(90, 100, 1, 2, 6);

  it('max profit = strike width - net premium paid', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    const netPremiumPaid = 6 - 2;
    expect(payoff.maxProfit).toBeCloseTo(10 - netPremiumPaid, 0);
  });

  it('max loss = net premium paid', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    const netPremiumPaid = 6 - 2;
    expect(payoff.maxLoss).toBeCloseTo(-netPremiumPaid, 0);
  });
});

describe('Bear Call Spread', () => {
  const strategy = bearCallSpread(95, 105, 1, 5, 2);

  it('max profit = net credit', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    const netCredit = 5 - 2;
    expect(payoff.maxProfit).toBeCloseTo(netCredit, 0);
  });

  it('max loss = width - net credit', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    const netCredit = 5 - 2;
    expect(payoff.maxLoss).toBeCloseTo(-(10 - netCredit), 0);
  });
});

describe('Long Straddle', () => {
  const strategy = longStraddle(100, 1, 5, 4);

  it('has correct name', () => {
    expect(strategy.name).toBe('Long Straddle');
  });

  it('max loss = total premium paid', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    expect(payoff.maxLoss).toBeCloseTo(-(5 + 4), 0);
  });

  it('profit is unbounded to the upside', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [0, 300], 1000);
    expect(payoff.maxProfit).toBeGreaterThan(100);
  });

  it('has two breakevens', () => {
    const breakEvens = findBreakEvenPrices(strategy, [49.73, 150.27]);
    expect(breakEvens.length).toBe(2);
  });

  it('breakevens are symmetric around the strike', () => {
    const breakEvens = findBreakEvenPrices(strategy, [49.73, 150.27]);
    const totalPremium = 5 + 4;
    expect(breakEvens[0]).toBeCloseTo(100 - totalPremium, 0);
    expect(breakEvens[1]).toBeCloseTo(100 + totalPremium, 0);
  });
});

describe('Short Straddle', () => {
  const strategy = shortStraddle(100, 1, 5, 4);

  it('max profit = total premium received', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    expect(payoff.maxProfit).toBeCloseTo(5 + 4, 0);
  });

  it('loss is unbounded', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [0, 300], 1000);
    expect(payoff.maxLoss).toBeLessThan(-100);
  });
});

describe('Long Strangle', () => {
  const strategy = longStrangle(95, 105, 1, 3, 2);

  it('max loss = total premium', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    expect(payoff.maxLoss).toBeCloseTo(-(3 + 2), 0);
  });

  it('has two breakevens', () => {
    const breakEvens = findBreakEvenPrices(strategy, [49.73, 150.27]);
    expect(breakEvens.length).toBe(2);
  });
});

describe('Short Strangle', () => {
  const strategy = shortStrangle(95, 105, 1, 3, 2);

  it('max profit = total premium', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    expect(payoff.maxProfit).toBeCloseTo(3 + 2, 0);
  });
});

describe('Iron Condor', () => {
  const strategy = ironCondor(85, 95, 105, 115, 1, 1, 4, 4, 1);

  it('has correct name', () => {
    expect(strategy.name).toBe('Iron Condor');
  });

  it('has 4 legs', () => {
    expect(strategy.legs).toHaveLength(4);
  });

  it('max profit = net credit', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [60, 140], 2000);
    const netCredit = -1 + 4 + 4 - 1;
    expect(payoff.maxProfit).toBeCloseTo(netCredit, 0);
  });

  it('max loss = width - net credit', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [60, 140], 2000);
    const netCredit = -1 + 4 + 4 - 1;
    const width = 95 - 85;
    expect(payoff.maxLoss).toBeCloseTo(-(width - netCredit), 0);
  });
});

describe('Iron Butterfly', () => {
  const strategy = ironButterfly(90, 100, 110, 1, 1, 5, 5, 1);

  it('has correct name', () => {
    expect(strategy.name).toBe('Iron Butterfly');
  });

  it('has 4 legs', () => {
    expect(strategy.legs).toHaveLength(4);
  });

  it('max profit at the center strike', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [70, 130], 2000);
    expect(payoff.maxProfit).toBeGreaterThan(0);
  });
});

describe('Covered Call', () => {
  const strategy = coveredCall(100, 105, 1, 3);

  it('has correct name', () => {
    expect(strategy.name).toBe('Covered Call');
  });

  it('payoff with stock: max profit = strike - entry + premium', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000, 1, 100);
    expect(payoff.maxProfit).toBeCloseTo(105 - 100 + 3, 0);
  });
});

describe('Protective Put', () => {
  const strategy = protectivePut(100, 95, 1, 3);

  it('has correct name', () => {
    expect(strategy.name).toBe('Protective Put');
  });

  it('limits downside to strike - entry - premium', () => {
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000, 1, 100);
    const maxLoss = 95 - 100 - 3;
    expect(payoff.maxLoss).toBeCloseTo(maxLoss, 0);
  });
});

describe('Calendar Spread', () => {
  it('has correct name', () => {
    const strategy = calendarSpread(100, 0.25, 1, OptionType.CALL, 3, 8);
    expect(strategy.name).toBe('Calendar Spread');
  });

  it('has 2 legs with different expiries', () => {
    const strategy = calendarSpread(100, 0.25, 1, OptionType.CALL, 3, 8);
    expect(strategy.legs[0].expiry).toBe(0.25);
    expect(strategy.legs[1].expiry).toBe(1);
  });
});

describe('Diagonal Spread', () => {
  it('has correct name', () => {
    const strategy = diagonalSpread(100, 105, 0.25, 1, OptionType.CALL, 3, 8);
    expect(strategy.name).toBe('Diagonal Spread');
  });
});

describe('Ratio Call Spread', () => {
  it('has correct name', () => {
    const strategy = ratioCallSpread(100, 110, 1, 2, 5, 3);
    expect(strategy.name).toBe('Ratio Call Spread');
  });

  it('short leg has ratio quantity', () => {
    const strategy = ratioCallSpread(100, 110, 1, 2, 5, 3);
    expect(strategy.legs[1].quantity).toBe(-2);
  });
});

describe('Ratio Put Spread', () => {
  it('has correct name', () => {
    const strategy = ratioPutSpread(90, 100, 1, 2, 3, 5);
    expect(strategy.name).toBe('Ratio Put Spread');
  });
});

describe('Collar', () => {
  it('has correct name', () => {
    const strategy = collar(95, 105, 1, 3, 2);
    expect(strategy.name).toBe('Collar');
  });

  it('limits both upside and downside with stock', () => {
    const strategy = collar(95, 105, 1, 3, 2);
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000, 1, 100);
    expect(payoff.maxProfit).toBeCloseTo(105 - 100 + (2 - 3), 0);
    expect(payoff.maxLoss).toBeCloseTo(95 - 100 + (2 - 3), 0);
  });
});

describe('Jade Lizard', () => {
  it('has correct name', () => {
    const strategy = jadeLizard(90, 105, 115, 1, 2, 3, 1);
    expect(strategy.name).toBe('Jade Lizard');
  });

  it('has 3 legs', () => {
    const strategy = jadeLizard(90, 105, 115, 1, 2, 3, 1);
    expect(strategy.legs).toHaveLength(3);
  });
});

describe('Broken Wing Butterfly', () => {
  it('has correct name', () => {
    const strategy = brokenWingButterfly(90, 100, 115, 1, OptionType.CALL, 5, 3, 1);
    expect(strategy.name).toBe('Broken Wing Butterfly');
  });

  it('middle leg has -2 quantity', () => {
    const strategy = brokenWingButterfly(90, 100, 115, 1, OptionType.CALL, 5, 3, 1);
    expect(strategy.legs[1].quantity).toBe(-2);
  });
});

describe('Christmas Tree', () => {
  it('has correct name', () => {
    const strategy = christmasTree(100, 105, 110, 1, OptionType.CALL, 5, 3, 2);
    expect(strategy.name).toBe('Christmas Tree');
  });
});

describe('Box Spread', () => {
  it('has correct name', () => {
    const strategy = boxSpread(95, 105, 1, 6, 2, 6, 2);
    expect(strategy.name).toBe('Box Spread');
  });

  it('payoff is constant (≈ PV of strike diff) at any price', () => {
    const strategy = boxSpread(95, 105, 1, 6, 2, 6, 2);
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 1000);
    const payoffs = payoff.payoffs;
    const firstPayoff = payoffs[0];
    for (const p of payoffs) {
      expect(p).toBeCloseTo(firstPayoff, 2);
    }
  });
});

describe('Synthetic Positions', () => {
  it('synthetic long has correct structure', () => {
    const strategy = syntheticLong(100, 1, 5, 4);
    expect(strategy.name).toBe('Synthetic Long');
    expect(strategy.legs).toHaveLength(2);
  });

  it('synthetic short has correct structure', () => {
    const strategy = syntheticShort(100, 1, 5, 4);
    expect(strategy.name).toBe('Synthetic Short');
    expect(strategy.legs).toHaveLength(2);
  });

  it('conversion has correct name', () => {
    const strategy = conversion(100, 1, 5, 4);
    expect(strategy.name).toBe('Conversion');
  });

  it('reversal has correct name', () => {
    const strategy = reversal(100, 1, 5, 4);
    expect(strategy.name).toBe('Reversal');
  });

  it('risk reversal has correct name', () => {
    const strategy = riskReversal(95, 105, 1, 3, 2);
    expect(strategy.name).toBe('Risk Reversal');
  });
});

describe('Gut Spread', () => {
  it('long gut spread has long legs', () => {
    const strategy = gutSpread(95, 105, 1, 'long', 8, 8);
    expect(strategy.legs[0].quantity).toBe(1);
    expect(strategy.legs[1].quantity).toBe(1);
  });

  it('short gut spread has short legs', () => {
    const strategy = gutSpread(95, 105, 1, 'short', 8, 8);
    expect(strategy.legs[0].quantity).toBe(-1);
    expect(strategy.legs[1].quantity).toBe(-1);
  });
});

describe('Ladder', () => {
  it('call ladder has correct name', () => {
    const strategy = ladder(100, 105, 110, 1, OptionType.CALL, 5, 3, 2);
    expect(strategy.name).toBe('Call Ladder');
  });

  it('put ladder has correct name', () => {
    const strategy = ladder(90, 95, 100, 1, OptionType.PUT, 2, 3, 5);
    expect(strategy.name).toBe('Put Ladder');
  });
});

describe('Payoff Calculation', () => {
  it('returns correct number of points', () => {
    const strategy = longStraddle(100, 1, 5, 4);
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 100);
    expect(payoff.underlyingPrices).toHaveLength(100);
    expect(payoff.payoffs).toHaveLength(100);
  });

  it('breakEvens are within the price range', () => {
    const strategy = longStraddle(100, 1, 5, 4);
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 500);
    for (const be of payoff.breakEvens) {
      expect(be).toBeGreaterThan(50);
      expect(be).toBeLessThan(150);
    }
  });

  it('probabilityOfProfit is between 0 and 1', () => {
    const strategy = longStraddle(100, 1, 5, 4);
    const payoff = calculatePayoffAtExpiry(strategy, [50, 150], 500);
    expect(payoff.probabilityOfProfit).toBeGreaterThanOrEqual(0);
    expect(payoff.probabilityOfProfit).toBeLessThanOrEqual(1);
  });
});

describe('findBreakEvenPrices', () => {
  it('bull call spread has one breakeven', () => {
    const strategy = bullCallSpread(95, 105, 1, 5, 2);
    const be = findBreakEvenPrices(strategy, [80.07, 120.07]);
    expect(be).toHaveLength(1);
  });

  it('long straddle has two breakevens', () => {
    const strategy = longStraddle(100, 1, 5, 4);
    const be = findBreakEvenPrices(strategy, [49.73, 150.27]);
    expect(be).toHaveLength(2);
  });
});

describe('P&L Before Expiry', () => {
  it('returns a number', () => {
    const strategy = bullCallSpread(95, 105, 1, 5, 2);
    const pnl = calculatePnLBeforeExpiry(strategy, 100, 0.05, 0, 0.2, 0.5);
    expect(isFinite(pnl)).toBe(true);
  });
});

describe('Strategy Greeks', () => {
  it('bull call spread has positive delta', () => {
    const strategy = bullCallSpread(95, 105, 1, 5, 2);
    const greeks = strategyGreeks(strategy, 100, 0.05, 0, 0.2);
    expect(greeks.delta).toBeGreaterThan(0);
  });

  it('short straddle has near-zero delta ATM', () => {
    const strategy = shortStraddle(100, 1, 5, 5);
    const greeks = strategyGreeks(strategy, 100, 0.05, 0, 0.2);
    expect(Math.abs(greeks.delta)).toBeLessThan(0.35);
  });

  it('iron condor has near-zero delta', () => {
    const strategy = ironCondor(85, 95, 105, 115, 1, 1, 4, 4, 1);
    const greeks = strategyGreeks(strategy, 100, 0.05, 0, 0.2);
    expect(Math.abs(greeks.delta)).toBeLessThan(0.3);
  });
});

describe('Strategy Max Profit / Max Loss', () => {
  it('bull call spread max profit is finite', () => {
    const strategy = bullCallSpread(95, 105, 1, 5, 2);
    const maxProfit = strategyMaxProfit(strategy);
    expect(maxProfit).toBeGreaterThan(0);
    expect(isFinite(maxProfit)).toBe(true);
  });

  it('bull call spread max loss is finite', () => {
    const strategy = bullCallSpread(95, 105, 1, 5, 2);
    const maxLoss = strategyMaxLoss(strategy);
    expect(maxLoss).toBeLessThan(0);
    expect(isFinite(maxLoss)).toBe(true);
  });
});

describe('Roll Strategy', () => {
  it('rolled strategy has new expiry', () => {
    const strategy = bullCallSpread(95, 105, 0.25, 5, 2);
    const rolled = rollStrategy(strategy, 100, 0.05, 0, 0.2, 0.5);
    expect(rolled.legs[0].expiry).toBe(0.5);
    expect(rolled.legs[1].expiry).toBe(0.5);
    expect(rolled.name).toContain('rolled');
  });
});

describe('Compare Strategies', () => {
  it('returns comparison data for multiple strategies', () => {
    const s1 = bullCallSpread(95, 105, 1, 5, 2);
    const s2 = longStraddle(100, 1, 5, 4);
    const comparison = compareStrategies([s1, s2], [50, 150], 100);
    expect(comparison.strategies).toHaveLength(2);
    expect(comparison.payoffs).toHaveLength(2);
  });
});

describe('Scenario Analysis', () => {
  it('returns scenario results', () => {
    const strategy = bullCallSpread(95, 105, 1, 5, 2);
    const results = scenarioAnalysis(
      strategy, 100, 0.05, 0, 0.2, 1,
      [{ priceChange: 5 }, { priceChange: -5 }, { volChange: 0.05 }]
    );
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r).toHaveProperty('pnl');
      expect(r).toHaveProperty('greeks');
    }
  });
});

describe('What-If Matrix', () => {
  it('returns correct matrix dimensions', () => {
    const strategy = longStraddle(100, 1, 5, 4);
    const matrix = whatIfMatrix(
      strategy, 100, 0.05, 0, 0.2, 1,
      [-10, 0, 10], [-0.05, 0, 0.05]
    );
    expect(matrix.pnl).toHaveLength(3);
    expect(matrix.pnl[0]).toHaveLength(3);
  });
});

describe('P&L Surface', () => {
  it('returns correct surface dimensions', () => {
    const strategy = bullCallSpread(95, 105, 1, 5, 2);
    const surface = pnlSurface(
      strategy, [80, 120], [1, 0.5, 0], 0.05, 0, 0.2, 50
    );
    expect(surface.prices).toHaveLength(50);
    expect(surface.times).toHaveLength(3);
    expect(surface.pnl).toHaveLength(3);
    expect(surface.pnl[0]).toHaveLength(50);
  });
});

describe('All Strategy Definitions', () => {
  const strategies = [
    { name: 'coveredCall', fn: () => coveredCall(100, 105, 1, 3) },
    { name: 'protectivePut', fn: () => protectivePut(100, 95, 1, 3) },
    { name: 'bullCallSpread', fn: () => bullCallSpread(95, 105, 1, 5, 2) },
    { name: 'bearPutSpread', fn: () => bearPutSpread(90, 100, 1, 2, 6) },
    { name: 'bullPutSpread', fn: () => bullPutSpread(90, 100, 1, 2, 6) },
    { name: 'bearCallSpread', fn: () => bearCallSpread(95, 105, 1, 5, 2) },
    { name: 'longStraddle', fn: () => longStraddle(100, 1, 5, 4) },
    { name: 'shortStraddle', fn: () => shortStraddle(100, 1, 5, 4) },
    { name: 'longStrangle', fn: () => longStrangle(95, 105, 1, 3, 2) },
    { name: 'shortStrangle', fn: () => shortStrangle(95, 105, 1, 3, 2) },
    { name: 'ironCondor', fn: () => ironCondor(85, 95, 105, 115, 1, 1, 4, 4, 1) },
    { name: 'ironButterfly', fn: () => ironButterfly(90, 100, 110, 1, 1, 5, 5, 1) },
    { name: 'collar', fn: () => collar(95, 105, 1, 3, 2) },
    { name: 'jadeLizard', fn: () => jadeLizard(90, 105, 115, 1, 2, 3, 1) },
    { name: 'boxSpread', fn: () => boxSpread(95, 105, 1, 6, 2, 6, 2) },
    { name: 'syntheticLong', fn: () => syntheticLong(100, 1, 5, 4) },
    { name: 'syntheticShort', fn: () => syntheticShort(100, 1, 5, 4) },
    { name: 'conversion', fn: () => conversion(100, 1, 5, 4) },
    { name: 'reversal', fn: () => reversal(100, 1, 5, 4) },
    { name: 'riskReversal', fn: () => riskReversal(95, 105, 1, 3, 2) },
    { name: 'ratioCallSpread', fn: () => ratioCallSpread(100, 110, 1, 2, 5, 3) },
    { name: 'ratioPutSpread', fn: () => ratioPutSpread(90, 100, 1, 2, 3, 5) },
    { name: 'calendarSpread', fn: () => calendarSpread(100, 0.25, 1, OptionType.CALL, 3, 8) },
    { name: 'diagonalSpread', fn: () => diagonalSpread(100, 105, 0.25, 1, OptionType.CALL, 3, 8) },
    { name: 'brokenWingButterfly', fn: () => brokenWingButterfly(90, 100, 115, 1, OptionType.CALL, 5, 3, 1) },
    { name: 'christmasTree', fn: () => christmasTree(100, 105, 110, 1, OptionType.CALL, 5, 3, 2) },
  ];

  for (const { name, fn } of strategies) {
    it(`${name}: has name, legs, description, outlook`, () => {
      const s = fn();
      expect(s.name).toBeTruthy();
      expect(s.legs.length).toBeGreaterThan(0);
      expect(s.description).toBeTruthy();
      expect(s.outlook).toBeTruthy();
    });

    it(`${name}: each leg has valid fields`, () => {
      const s = fn();
      for (const leg of s.legs) {
        expect(leg.strike).toBeGreaterThan(0);
        expect(leg.expiry).toBeGreaterThan(0);
        expect(leg.quantity).not.toBe(0);
        expect(leg.premium).toBeGreaterThanOrEqual(0);
      }
    });
  }
});
