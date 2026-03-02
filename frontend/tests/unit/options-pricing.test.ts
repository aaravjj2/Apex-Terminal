import { describe, it, expect } from 'vitest';
import {
  bsCallPrice,
  bsPutPrice,
  bsPrice,
  bsDelta,
  bsGamma,
  bsTheta,
  bsVega,
  bsRho,
  impliedVolatility,
} from '../../src/lib/options/blackScholes';
import { OptionType } from '../../src/lib/options/types';

const S = 100, K = 100, T = 1, r = 0.05, q = 0, sigma = 0.2;

describe('options-pricing: BSM call', () => {
  it('ATM call price ~10.45', () => {
    const price = bsCallPrice(S, K, T, r, q, sigma);
    expect(price).toBeCloseTo(10.45, 1);
  });
  it('ITM call > OTM call', () => {
    const itm = bsCallPrice(110, K, T, r, q, sigma);
    const otm = bsCallPrice(90, K, T, r, q, sigma);
    expect(itm).toBeGreaterThan(otm);
  });
  it('higher vol increases price', () => {
    const low = bsCallPrice(S, K, T, r, q, 0.1);
    const high = bsCallPrice(S, K, T, r, q, 0.4);
    expect(high).toBeGreaterThan(low);
  });
});

describe('options-pricing: BSM put', () => {
  it('ATM put price positive', () => {
    const price = bsPutPrice(S, K, T, r, q, sigma);
    expect(price).toBeGreaterThan(0);
  });
  it('ITM put > OTM put', () => {
    const itm = bsPutPrice(90, K, T, r, q, sigma);
    const otm = bsPutPrice(110, K, T, r, q, sigma);
    expect(itm).toBeGreaterThan(otm);
  });
});

describe('options-pricing: bsPrice dispatch', () => {
  it('CALL matches bsCallPrice', () => {
    expect(bsPrice(S, K, T, r, q, sigma, OptionType.CALL))
      .toBe(bsCallPrice(S, K, T, r, q, sigma));
  });
  it('PUT matches bsPutPrice', () => {
    expect(bsPrice(S, K, T, r, q, sigma, OptionType.PUT))
      .toBe(bsPutPrice(S, K, T, r, q, sigma));
  });
});

describe('options-pricing: Greeks', () => {
  it('call delta in [0,1]', () => {
    const d = bsDelta(S, K, T, r, q, sigma, OptionType.CALL);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(1);
  });
  it('put delta in [-1,0]', () => {
    const d = bsDelta(S, K, T, r, q, sigma, OptionType.PUT);
    expect(d).toBeGreaterThan(-1);
    expect(d).toBeLessThan(0);
  });
  it('gamma positive', () => {
    expect(bsGamma(S, K, T, r, q, sigma)).toBeGreaterThan(0);
  });
  it('theta negative for long option', () => {
    expect(bsTheta(S, K, T, r, q, sigma, OptionType.CALL)).toBeLessThan(0);
  });
  it('vega positive', () => {
    expect(bsVega(S, K, T, r, q, sigma)).toBeGreaterThan(0);
  });
  it('call rho positive', () => {
    expect(bsRho(S, K, T, r, q, sigma, OptionType.CALL)).toBeGreaterThan(0);
  });
  it('put rho negative', () => {
    expect(bsRho(S, K, T, r, q, sigma, OptionType.PUT)).toBeLessThan(0);
  });
});

describe('options-pricing: Implied Volatility', () => {
  it('round-trip: price → IV → price', () => {
    const price = bsCallPrice(S, K, T, r, q, sigma);
    const iv = impliedVolatility(price, S, K, T, r, q, OptionType.CALL);
    expect(iv).toBeCloseTo(sigma, 5);
  });
  it('higher market price → higher IV', () => {
    const p1 = bsCallPrice(S, K, T, r, q, 0.2);
    const p2 = bsCallPrice(S, K, T, r, q, 0.3);
    const iv1 = impliedVolatility(p1, S, K, T, r, q, OptionType.CALL);
    const iv2 = impliedVolatility(p2, S, K, T, r, q, OptionType.CALL);
    expect(iv2).toBeGreaterThan(iv1);
  });
});
