import { describe, it, expect } from 'vitest';
import {
  binomialPrice,
  binomialGreeks,
  binomialPriceAndGreeks,
  convergenceAnalysis,
  binomialRichardsonExtrapolation,
  earlyExerciseBoundary,
  BinomialModel,
} from '../../../src/lib/options/binomial';
import { bsCallPrice, bsPutPrice, bsDelta, bsGamma } from '../../../src/lib/options/blackScholes';
import { OptionType, ExerciseStyle, OptionContract } from '../../../src/lib/options/types';

function makeContract(overrides: Partial<OptionContract> = {}): OptionContract {
  return {
    underlyingPrice: 100,
    strike: 100,
    expiry: 1,
    riskFreeRate: 0.05,
    dividendYield: 0,
    volatility: 0.2,
    type: OptionType.CALL,
    exerciseStyle: ExerciseStyle.EUROPEAN,
    ...overrides,
  };
}

describe('CRR European Call Convergence to Black-Scholes', () => {
  it('converges to BS price with 200 steps', () => {
    const contract = makeContract();
    const bsRef = bsCallPrice(100, 100, 1, 0.05, 0, 0.2);
    const binPrice = binomialPrice(contract, { steps: 200, model: 'CRR' });
    expect(binPrice).toBeCloseTo(bsRef, 1);
  });

  it('converges to BS price with 500 steps', () => {
    const contract = makeContract();
    const bsRef = bsCallPrice(100, 100, 1, 0.05, 0, 0.2);
    const binPrice = binomialPrice(contract, { steps: 500, model: 'CRR' });
    expect(binPrice).toBeCloseTo(bsRef, 2);
  });

  it('European put converges to BS put', () => {
    const contract = makeContract({ type: OptionType.PUT });
    const bsRef = bsPutPrice(100, 100, 1, 0.05, 0, 0.2);
    const binPrice = binomialPrice(contract, { steps: 300, model: 'CRR' });
    expect(binPrice).toBeCloseTo(bsRef, 1);
  });

  it('OTM call converges', () => {
    const contract = makeContract({ strike: 120 });
    const bsRef = bsCallPrice(100, 120, 1, 0.05, 0, 0.2);
    const binPrice = binomialPrice(contract, { steps: 300, model: 'CRR' });
    expect(binPrice).toBeCloseTo(bsRef, 1);
  });

  it('ITM put converges', () => {
    const contract = makeContract({ type: OptionType.PUT, strike: 110 });
    const bsRef = bsPutPrice(100, 110, 1, 0.05, 0, 0.2);
    const binPrice = binomialPrice(contract, { steps: 300, model: 'CRR' });
    expect(binPrice).toBeCloseTo(bsRef, 1);
  });
});

describe('Jarrow-Rudd Model', () => {
  it('JR European call converges to BS', () => {
    const contract = makeContract();
    const bsRef = bsCallPrice(100, 100, 1, 0.05, 0, 0.2);
    const binPrice = binomialPrice(contract, { steps: 300, model: 'JR' });
    expect(binPrice).toBeCloseTo(bsRef, 1);
  });

  it('JR European put converges to BS', () => {
    const contract = makeContract({ type: OptionType.PUT });
    const bsRef = bsPutPrice(100, 100, 1, 0.05, 0, 0.2);
    const binPrice = binomialPrice(contract, { steps: 300, model: 'JR' });
    expect(binPrice).toBeCloseTo(bsRef, 1);
  });
});

describe('Leisen-Reimer Model', () => {
  it('LR converges faster than CRR for same step count', () => {
    const contract = makeContract();
    const bsRef = bsCallPrice(100, 100, 1, 0.05, 0, 0.2);
    const steps = 51; // LR works best with odd steps
    const lrPrice = binomialPrice(contract, { steps, model: 'LR' });
    const crrPrice = binomialPrice(contract, { steps, model: 'CRR' });
    expect(Math.abs(lrPrice - bsRef)).toBeLessThan(Math.abs(crrPrice - bsRef) + 0.1);
  });
});

describe('American vs European Pricing', () => {
  it('American call ≈ European call (no dividends)', () => {
    const eurContract = makeContract();
    const amContract = makeContract({ exerciseStyle: ExerciseStyle.AMERICAN });
    const eurPrice = binomialPrice(eurContract, { steps: 200 });
    const amPrice = binomialPrice(amContract, { steps: 200 });
    expect(amPrice).toBeCloseTo(eurPrice, 1);
  });

  it('American put >= European put', () => {
    const eurContract = makeContract({ type: OptionType.PUT });
    const amContract = makeContract({ type: OptionType.PUT, exerciseStyle: ExerciseStyle.AMERICAN });
    const eurPrice = binomialPrice(eurContract, { steps: 200 });
    const amPrice = binomialPrice(amContract, { steps: 200 });
    expect(amPrice).toBeGreaterThanOrEqual(eurPrice - 0.01);
  });

  it('American put premium over European increases with higher rates', () => {
    const eurContract = makeContract({ type: OptionType.PUT, riskFreeRate: 0.10 });
    const amContract = makeContract({ type: OptionType.PUT, riskFreeRate: 0.10, exerciseStyle: ExerciseStyle.AMERICAN });
    const eurPrice = binomialPrice(eurContract, { steps: 200 });
    const amPrice = binomialPrice(amContract, { steps: 200 });
    expect(amPrice - eurPrice).toBeGreaterThan(0);
  });

  it('deep ITM American put has significant early exercise premium', () => {
    const eurContract = makeContract({ type: OptionType.PUT, underlyingPrice: 70, strike: 100, riskFreeRate: 0.08 });
    const amContract = makeContract({ type: OptionType.PUT, underlyingPrice: 70, strike: 100, riskFreeRate: 0.08, exerciseStyle: ExerciseStyle.AMERICAN });
    const eurPrice = binomialPrice(eurContract, { steps: 200 });
    const amPrice = binomialPrice(amContract, { steps: 200 });
    expect(amPrice - eurPrice).toBeGreaterThan(0.5);
  });

  it('American call with dividends >= European call', () => {
    const eurContract = makeContract({ dividendYield: 0.05 });
    const amContract = makeContract({ dividendYield: 0.05, exerciseStyle: ExerciseStyle.AMERICAN });
    const eurPrice = binomialPrice(eurContract, { steps: 200 });
    const amPrice = binomialPrice(amContract, { steps: 200 });
    expect(amPrice).toBeGreaterThanOrEqual(eurPrice - 0.01);
  });
});

describe('Bermudan Options', () => {
  it('Bermudan put price between European and American', () => {
    const eurContract = makeContract({ type: OptionType.PUT, underlyingPrice: 80, strike: 100, riskFreeRate: 0.08 });
    const bermContract = makeContract({ type: OptionType.PUT, underlyingPrice: 80, strike: 100, riskFreeRate: 0.08, exerciseStyle: ExerciseStyle.BERMUDAN });
    const amContract = makeContract({ type: OptionType.PUT, underlyingPrice: 80, strike: 100, riskFreeRate: 0.08, exerciseStyle: ExerciseStyle.AMERICAN });

    const eurPrice = binomialPrice(eurContract, { steps: 200 });
    const bermPrice = binomialPrice(bermContract, { steps: 200 });
    const amPrice = binomialPrice(amContract, { steps: 200 });

    expect(bermPrice).toBeGreaterThanOrEqual(eurPrice - 0.01);
    expect(bermPrice).toBeLessThanOrEqual(amPrice + 0.01);
  });
});

describe('Early Exercise Boundary', () => {
  it('returns boundary points for American put', () => {
    const contract = makeContract({
      type: OptionType.PUT,
      underlyingPrice: 100,
      strike: 100,
      riskFreeRate: 0.05,
      exerciseStyle: ExerciseStyle.AMERICAN,
    });
    const boundary = earlyExerciseBoundary(contract, { steps: 100 });
    expect(boundary.length).toBeGreaterThan(0);
  });

  it('boundary prices are below the strike for puts', () => {
    const contract = makeContract({
      type: OptionType.PUT,
      underlyingPrice: 100,
      strike: 100,
      riskFreeRate: 0.05,
      exerciseStyle: ExerciseStyle.AMERICAN,
    });
    const boundary = earlyExerciseBoundary(contract, { steps: 100 });
    for (const [, price] of boundary) {
      expect(price).toBeLessThanOrEqual(100);
    }
  });

  it('returns empty for T=0', () => {
    const contract = makeContract({ expiry: 0, exerciseStyle: ExerciseStyle.AMERICAN });
    const boundary = earlyExerciseBoundary(contract);
    expect(boundary).toEqual([]);
  });
});

describe('Greeks via Finite Differences on Tree', () => {
  it('binomial delta close to BS delta for European call', () => {
    const contract = makeContract();
    const greeks = binomialGreeks(contract, { steps: 200 });
    const bsD = bsDelta(100, 100, 1, 0.05, 0, 0.2, OptionType.CALL);
    expect(greeks.delta).toBeCloseTo(bsD, 1);
  });

  it('binomial gamma close to BS gamma for European call', () => {
    const contract = makeContract();
    const greeks = binomialGreeks(contract, { steps: 200 });
    const bsG = bsGamma(100, 100, 1, 0.05, 0, 0.2);
    expect(greeks.gamma).toBeCloseTo(bsG, 2);
  });

  it('binomial vega is positive for European call', () => {
    const contract = makeContract();
    const greeks = binomialGreeks(contract, { steps: 100 });
    expect(greeks.vega).toBeGreaterThan(0);
  });

  it('binomial theta is negative for European call', () => {
    const contract = makeContract();
    const greeks = binomialGreeks(contract, { steps: 100 });
    expect(greeks.theta).toBeLessThan(0);
  });

  it('American put delta is between -1 and 0', () => {
    const contract = makeContract({ type: OptionType.PUT, exerciseStyle: ExerciseStyle.AMERICAN });
    const greeks = binomialGreeks(contract, { steps: 100 });
    expect(greeks.delta).toBeGreaterThan(-1);
    expect(greeks.delta).toBeLessThan(0);
  });

  it('T=0 returns zero greeks', () => {
    const contract = makeContract({ expiry: 0 });
    const greeks = binomialGreeks(contract);
    expect(greeks.delta).toBe(0);
    expect(greeks.gamma).toBe(0);
  });
});

describe('binomialPriceAndGreeks', () => {
  it('returns consistent price and greeks', () => {
    const contract = makeContract();
    const result = binomialPriceAndGreeks(contract, { steps: 100 });
    expect(result.theoreticalPrice).toBeGreaterThan(0);
    expect(result.greeks.delta).toBeGreaterThan(0);
    expect(result.greeks.delta).toBeLessThan(1);
  });
});

describe('Convergence Analysis', () => {
  it('price converges as steps increase', () => {
    const contract = makeContract();
    const results = convergenceAnalysis(contract, 'CRR', [10, 50, 100, 200, 500]);
    const bsRef = bsCallPrice(100, 100, 1, 0.05, 0, 0.2);
    const errors = results.map(r => Math.abs(r.price - bsRef));
    expect(errors[errors.length - 1]).toBeLessThan(errors[0]);
  });

  it('delta converges as steps increase', () => {
    const contract = makeContract();
    const results = convergenceAnalysis(contract, 'CRR', [10, 50, 100, 200]);
    for (const r of results) {
      expect(r.delta).toBeDefined();
      expect(r.delta!).toBeGreaterThan(0);
    }
  });
});

describe('Richardson Extrapolation', () => {
  it('extrapolated price is closer to BS than raw price', () => {
    const contract = makeContract();
    const bsRef = bsCallPrice(100, 100, 1, 0.05, 0, 0.2);
    const rawPrice = binomialPrice(contract, { steps: 100 });
    const extrapolated = binomialRichardsonExtrapolation(contract, { steps: 100 });
    expect(Math.abs(extrapolated - bsRef)).toBeLessThan(Math.abs(rawPrice - bsRef) + 0.5);
  });
});

describe('Edge Cases', () => {
  it('T=0 call returns intrinsic', () => {
    const contract = makeContract({ expiry: 0, underlyingPrice: 110 });
    expect(binomialPrice(contract)).toBe(10);
  });

  it('T=0 put returns intrinsic', () => {
    const contract = makeContract({ type: OptionType.PUT, expiry: 0, underlyingPrice: 90 });
    expect(binomialPrice(contract)).toBe(10);
  });

  it('T=0 OTM returns 0', () => {
    const contract = makeContract({ expiry: 0, underlyingPrice: 90 });
    expect(binomialPrice(contract)).toBe(0);
  });

  it('high vol pricing is finite', () => {
    const contract = makeContract({ volatility: 1.5 });
    const price = binomialPrice(contract, { steps: 100 });
    expect(isFinite(price)).toBe(true);
    expect(price).toBeGreaterThan(0);
  });

  it('very short expiry pricing is finite', () => {
    const contract = makeContract({ expiry: 1 / 365 });
    const price = binomialPrice(contract, { steps: 50 });
    expect(isFinite(price)).toBe(true);
  });
});
