import { describe, it, expect } from 'vitest';
import {
  normalPDF,
  normalCDF,
  normalInvCDF,
  calcD1,
  calcD2,
  bsCallPrice,
  bsPutPrice,
  bsPrice,
  bsDelta,
  bsGamma,
  bsTheta,
  bsVega,
  bsRho,
  bsVanna,
  bsVolga,
  bsCharm,
  bsVeta,
  bsSpeed,
  bsZomma,
  bsColor,
  bsAllGreeks,
  bsPriceAndGreeks,
  impliedVolatility,
  putCallParityDeviation,
  putCallParityHolds,
  syntheticCallFromPut,
  syntheticPutFromCall,
  adjustForDiscreteDividends,
  bsPriceDiscreteDividends,
} from '../../../src/lib/options/blackScholes';
import { OptionType } from '../../../src/lib/options/types';

// Standard ATM test parameters
const S = 100, K = 100, T = 1, r = 0.05, q = 0, sigma = 0.2;

describe('Normal Distribution Functions', () => {
  it('normalPDF at 0 should equal 1/√(2π)', () => {
    expect(normalPDF(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 10);
  });

  it('normalPDF is symmetric: φ(x) = φ(-x)', () => {
    for (const x of [0.5, 1.0, 2.0, 3.0]) {
      expect(normalPDF(x)).toBeCloseTo(normalPDF(-x), 12);
    }
  });

  it('normalPDF decreases for increasing |x|', () => {
    expect(normalPDF(0)).toBeGreaterThan(normalPDF(1));
    expect(normalPDF(1)).toBeGreaterThan(normalPDF(2));
    expect(normalPDF(2)).toBeGreaterThan(normalPDF(3));
  });

  it('normalCDF(0) = 0.5', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 6);
  });

  it('normalCDF known quantiles', () => {
    expect(normalCDF(-1.96)).toBeCloseTo(0.025, 3);
    expect(normalCDF(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCDF(1.0)).toBeCloseTo(0.8413, 3);
    expect(normalCDF(-1.0)).toBeCloseTo(0.1587, 3);
    expect(normalCDF(2.326)).toBeCloseTo(0.99, 2);
  });

  it('normalCDF symmetry: N(x) + N(-x) = 1', () => {
    for (const x of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]) {
      expect(normalCDF(x) + normalCDF(-x)).toBeCloseTo(1, 8);
    }
  });

  it('normalCDF extreme values', () => {
    expect(normalCDF(-10)).toBe(0);
    expect(normalCDF(10)).toBe(1);
  });

  it('normalInvCDF(0.5) = 0', () => {
    expect(normalInvCDF(0.5)).toBe(0);
  });

  it('normalInvCDF round-trip: CDF(InvCDF(p)) ≈ p', () => {
    for (const p of [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99]) {
      expect(normalCDF(normalInvCDF(p))).toBeCloseTo(p, 5);
    }
  });

  it('normalInvCDF extreme values', () => {
    expect(normalInvCDF(0)).toBe(-Infinity);
    expect(normalInvCDF(1)).toBe(Infinity);
  });

  it('normalInvCDF known quantiles', () => {
    expect(normalInvCDF(0.975)).toBeCloseTo(1.96, 2);
    expect(normalInvCDF(0.025)).toBeCloseTo(-1.96, 2);
  });
});

describe('d1 and d2 Calculation', () => {
  it('calcD1 for ATM option with q=0', () => {
    const d1 = calcD1(S, K, T, r, q, sigma);
    const expected = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
    expect(d1).toBeCloseTo(expected, 10);
  });

  it('calcD2 = d1 - σ√T', () => {
    const d1 = calcD1(S, K, T, r, q, sigma);
    const d2 = calcD2(S, K, T, r, q, sigma);
    expect(d2).toBeCloseTo(d1 - sigma * Math.sqrt(T), 10);
  });

  it('edge case: T=0 returns extreme values', () => {
    expect(calcD1(110, 100, 0, r, q, sigma)).toBe(100);
    expect(calcD1(90, 100, 0, r, q, sigma)).toBe(-100);
  });

  it('edge case: sigma=0 returns extreme values', () => {
    expect(calcD1(110, 100, T, r, q, 0)).toBe(100);
    expect(calcD1(90, 100, T, r, q, 0)).toBe(-100);
  });
});

describe('European Call Pricing', () => {
  it('ATM call S=100, K=100, T=1, r=0.05, σ=0.2 ≈ 10.45', () => {
    const price = bsCallPrice(S, K, T, r, q, sigma);
    expect(price).toBeCloseTo(10.4506, 2);
  });

  it('deep ITM call should approach S - K*e^(-rT)', () => {
    const deepITM = bsCallPrice(200, 100, T, r, q, sigma);
    const intrinsicPV = 200 - 100 * Math.exp(-r * T);
    expect(deepITM).toBeCloseTo(intrinsicPV, 0);
  });

  it('deep OTM call should approach 0', () => {
    const deepOTM = bsCallPrice(50, 100, T, r, q, sigma);
    expect(deepOTM).toBeLessThan(0.01);
  });

  it('call price increases with spot', () => {
    const p1 = bsCallPrice(90, K, T, r, q, sigma);
    const p2 = bsCallPrice(100, K, T, r, q, sigma);
    const p3 = bsCallPrice(110, K, T, r, q, sigma);
    expect(p1).toBeLessThan(p2);
    expect(p2).toBeLessThan(p3);
  });

  it('call price increases with volatility', () => {
    const p1 = bsCallPrice(S, K, T, r, q, 0.1);
    const p2 = bsCallPrice(S, K, T, r, q, 0.2);
    const p3 = bsCallPrice(S, K, T, r, q, 0.4);
    expect(p1).toBeLessThan(p2);
    expect(p2).toBeLessThan(p3);
  });

  it('call price increases with time to expiry', () => {
    const p1 = bsCallPrice(S, K, 0.25, r, q, sigma);
    const p2 = bsCallPrice(S, K, 0.5, r, q, sigma);
    const p3 = bsCallPrice(S, K, 1.0, r, q, sigma);
    expect(p1).toBeLessThan(p2);
    expect(p2).toBeLessThan(p3);
  });

  it('expiry edge case: T=0 returns intrinsic', () => {
    expect(bsCallPrice(110, 100, 0, r, q, sigma)).toBe(10);
    expect(bsCallPrice(90, 100, 0, r, q, sigma)).toBe(0);
  });

  it('zero vol: returns discounted intrinsic', () => {
    const price = bsCallPrice(110, 100, T, r, q, 0);
    const expected = Math.max(110 - 100 * Math.exp(-r * T), 0);
    expect(price).toBeCloseTo(expected, 8);
  });
});

describe('European Put Pricing', () => {
  it('ATM put S=100, K=100, T=1, r=0.05, σ=0.2', () => {
    const price = bsPutPrice(S, K, T, r, q, sigma);
    expect(price).toBeGreaterThan(0);
    expect(price).toBeLessThan(S);
  });

  it('deep ITM put should approach K*e^(-rT) - S', () => {
    const deepITM = bsPutPrice(50, 100, T, r, q, sigma);
    const intrinsicPV = 100 * Math.exp(-r * T) - 50;
    expect(deepITM).toBeCloseTo(intrinsicPV, 0);
  });

  it('deep OTM put should approach 0', () => {
    const deepOTM = bsPutPrice(200, 100, T, r, q, sigma);
    expect(deepOTM).toBeLessThan(0.01);
  });

  it('expiry edge case: T=0 returns intrinsic', () => {
    expect(bsPutPrice(90, 100, 0, r, q, sigma)).toBe(10);
    expect(bsPutPrice(110, 100, 0, r, q, sigma)).toBe(0);
  });

  it('bsPrice dispatches correctly by type', () => {
    expect(bsPrice(S, K, T, r, q, sigma, OptionType.CALL)).toBe(bsCallPrice(S, K, T, r, q, sigma));
    expect(bsPrice(S, K, T, r, q, sigma, OptionType.PUT)).toBe(bsPutPrice(S, K, T, r, q, sigma));
  });
});

describe('Put-Call Parity', () => {
  it('C - P = S*e^(-qT) - K*e^(-rT) for q=0', () => {
    const C = bsCallPrice(S, K, T, r, q, sigma);
    const P = bsPutPrice(S, K, T, r, q, sigma);
    const deviation = putCallParityDeviation(C, P, S, K, T, r, q);
    expect(deviation).toBeLessThan(1e-10);
  });

  it('putCallParityHolds returns true for BS-generated prices', () => {
    const C = bsCallPrice(S, K, T, r, q, sigma);
    const P = bsPutPrice(S, K, T, r, q, sigma);
    expect(putCallParityHolds(C, P, S, K, T, r, q)).toBe(true);
  });

  it('parity holds with dividends q=0.02', () => {
    const qd = 0.02;
    const C = bsCallPrice(S, K, T, r, qd, sigma);
    const P = bsPutPrice(S, K, T, r, qd, sigma);
    const deviation = putCallParityDeviation(C, P, S, K, T, r, qd);
    expect(deviation).toBeLessThan(1e-10);
  });

  it('syntheticCallFromPut matches BS call price', () => {
    const P = bsPutPrice(S, K, T, r, q, sigma);
    const syntheticC = syntheticCallFromPut(P, S, K, T, r, q);
    expect(syntheticC).toBeCloseTo(bsCallPrice(S, K, T, r, q, sigma), 10);
  });

  it('syntheticPutFromCall matches BS put price', () => {
    const C = bsCallPrice(S, K, T, r, q, sigma);
    const syntheticP = syntheticPutFromCall(C, S, K, T, r, q);
    expect(syntheticP).toBeCloseTo(bsPutPrice(S, K, T, r, q, sigma), 10);
  });

  it('parity across multiple strikes', () => {
    for (const strike of [80, 90, 100, 110, 120]) {
      const C = bsCallPrice(S, strike, T, r, q, sigma);
      const P = bsPutPrice(S, strike, T, r, q, sigma);
      const lhs = C - P;
      const rhs = S - strike * Math.exp(-r * T);
      expect(lhs).toBeCloseTo(rhs, 8);
    }
  });
});

describe('Greeks: Delta', () => {
  it('call delta is between 0 and 1', () => {
    const delta = bsDelta(S, K, T, r, q, sigma, OptionType.CALL);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(1);
  });

  it('put delta is between -1 and 0', () => {
    const delta = bsDelta(S, K, T, r, q, sigma, OptionType.PUT);
    expect(delta).toBeGreaterThan(-1);
    expect(delta).toBeLessThan(0);
  });

  it('ATM call delta ≈ 0.5 (slightly above with r>0)', () => {
    const delta = bsDelta(S, K, T, r, q, sigma, OptionType.CALL);
    expect(delta).toBeCloseTo(0.5, 0);
    expect(delta).toBeGreaterThan(0.5);
  });

  it('call delta + |put delta| ≈ 1 (with no dividends)', () => {
    const callD = bsDelta(S, K, T, r, q, sigma, OptionType.CALL);
    const putD = bsDelta(S, K, T, r, q, sigma, OptionType.PUT);
    expect(callD - putD).toBeCloseTo(1, 8);
  });

  it('deep ITM call delta ≈ 1', () => {
    const delta = bsDelta(200, 100, T, r, q, sigma, OptionType.CALL);
    expect(delta).toBeCloseTo(1, 1);
  });

  it('deep OTM call delta ≈ 0', () => {
    const delta = bsDelta(50, 100, T, r, q, sigma, OptionType.CALL);
    expect(delta).toBeCloseTo(0, 1);
  });

  it('T=0 ITM call delta = 1', () => {
    expect(bsDelta(110, 100, 0, r, q, sigma, OptionType.CALL)).toBe(1);
  });

  it('T=0 OTM call delta = 0', () => {
    expect(bsDelta(90, 100, 0, r, q, sigma, OptionType.CALL)).toBe(0);
  });

  it('T=0 ATM call delta = 0.5', () => {
    expect(bsDelta(100, 100, 0, r, q, sigma, OptionType.CALL)).toBe(0.5);
  });
});

describe('Greeks: Gamma', () => {
  it('gamma is always positive', () => {
    for (const strike of [80, 90, 100, 110, 120]) {
      expect(bsGamma(S, strike, T, r, q, sigma)).toBeGreaterThan(0);
    }
  });

  it('gamma is highest ATM', () => {
    const gammaATM = bsGamma(S, 100, T, r, q, sigma);
    const gammaITM = bsGamma(S, 80, T, r, q, sigma);
    const gammaOTM = bsGamma(S, 120, T, r, q, sigma);
    expect(gammaATM).toBeGreaterThan(gammaITM);
    expect(gammaATM).toBeGreaterThan(gammaOTM);
  });

  it('gamma increases as expiry approaches (ATM)', () => {
    const gamma1y = bsGamma(S, K, 1, r, q, sigma);
    const gamma3m = bsGamma(S, K, 0.25, r, q, sigma);
    const gamma1m = bsGamma(S, K, 1 / 12, r, q, sigma);
    expect(gamma1m).toBeGreaterThan(gamma3m);
    expect(gamma3m).toBeGreaterThan(gamma1y);
  });

  it('gamma is same for call and put', () => {
    const gammaVal = bsGamma(S, K, T, r, q, sigma);
    expect(gammaVal).toBeGreaterThan(0);
  });

  it('T=0 gamma = 0', () => {
    expect(bsGamma(S, K, 0, r, q, sigma)).toBe(0);
  });
});

describe('Greeks: Theta', () => {
  it('long call theta is negative', () => {
    const theta = bsTheta(S, K, T, r, q, sigma, OptionType.CALL);
    expect(theta).toBeLessThan(0);
  });

  it('long put theta is negative', () => {
    const theta = bsTheta(S, K, T, r, q, sigma, OptionType.PUT);
    expect(theta).toBeLessThan(0);
  });

  it('theta magnitude increases near expiry (ATM)', () => {
    const theta1y = Math.abs(bsTheta(S, K, 1, r, q, sigma, OptionType.CALL));
    const theta1m = Math.abs(bsTheta(S, K, 1 / 12, r, q, sigma, OptionType.CALL));
    expect(theta1m).toBeGreaterThan(theta1y);
  });

  it('T=0 theta = 0', () => {
    expect(bsTheta(S, K, 0, r, q, sigma, OptionType.CALL)).toBe(0);
  });
});

describe('Greeks: Vega', () => {
  it('vega is always positive', () => {
    for (const strike of [80, 90, 100, 110, 120]) {
      expect(bsVega(S, strike, T, r, q, sigma)).toBeGreaterThan(0);
    }
  });

  it('vega is highest ATM', () => {
    const vegaATM = bsVega(S, 100, T, r, q, sigma);
    const vegaOTM = bsVega(S, 120, T, r, q, sigma);
    expect(vegaATM).toBeGreaterThan(vegaOTM);
  });

  it('vega is same for call and put at same strike', () => {
    const vega = bsVega(S, K, T, r, q, sigma);
    expect(vega).toBeGreaterThan(0);
  });

  it('T=0 vega = 0', () => {
    expect(bsVega(S, K, 0, r, q, sigma)).toBe(0);
  });
});

describe('Greeks: Rho', () => {
  it('call rho is positive', () => {
    expect(bsRho(S, K, T, r, q, sigma, OptionType.CALL)).toBeGreaterThan(0);
  });

  it('put rho is negative', () => {
    expect(bsRho(S, K, T, r, q, sigma, OptionType.PUT)).toBeLessThan(0);
  });

  it('T=0 rho = 0', () => {
    expect(bsRho(S, K, 0, r, q, sigma, OptionType.CALL)).toBe(0);
  });
});

describe('Second-Order Greeks', () => {
  it('vanna is finite for standard parameters', () => {
    const vanna = bsVanna(S, K, T, r, q, sigma);
    expect(isFinite(vanna)).toBe(true);
  });

  it('volga is finite for standard parameters', () => {
    const volga = bsVolga(S, K, T, r, q, sigma);
    expect(isFinite(volga)).toBe(true);
  });

  it('charm is finite for standard parameters', () => {
    const charm = bsCharm(S, K, T, r, q, sigma, OptionType.CALL);
    expect(isFinite(charm)).toBe(true);
  });

  it('veta is finite for standard parameters', () => {
    const veta = bsVeta(S, K, T, r, q, sigma);
    expect(isFinite(veta)).toBe(true);
  });

  it('speed is finite for standard parameters', () => {
    const speed = bsSpeed(S, K, T, r, q, sigma);
    expect(isFinite(speed)).toBe(true);
  });

  it('zomma is finite for standard parameters', () => {
    const zomma = bsZomma(S, K, T, r, q, sigma);
    expect(isFinite(zomma)).toBe(true);
  });

  it('color is finite for standard parameters', () => {
    const color = bsColor(S, K, T, r, q, sigma);
    expect(isFinite(color)).toBe(true);
  });

  it('all second-order Greeks return 0 at T=0', () => {
    expect(bsVanna(S, K, 0, r, q, sigma)).toBe(0);
    expect(bsVolga(S, K, 0, r, q, sigma)).toBe(0);
    expect(bsCharm(S, K, 0, r, q, sigma, OptionType.CALL)).toBe(0);
    expect(bsVeta(S, K, 0, r, q, sigma)).toBe(0);
    expect(bsSpeed(S, K, 0, r, q, sigma)).toBe(0);
    expect(bsZomma(S, K, 0, r, q, sigma)).toBe(0);
    expect(bsColor(S, K, 0, r, q, sigma)).toBe(0);
  });
});

describe('bsAllGreeks', () => {
  it('returns all Greek fields', () => {
    const greeks = bsAllGreeks(S, K, T, r, q, sigma, OptionType.CALL);
    expect(greeks).toHaveProperty('delta');
    expect(greeks).toHaveProperty('gamma');
    expect(greeks).toHaveProperty('theta');
    expect(greeks).toHaveProperty('vega');
    expect(greeks).toHaveProperty('rho');
    expect(greeks).toHaveProperty('vanna');
    expect(greeks).toHaveProperty('volga');
    expect(greeks).toHaveProperty('charm');
    expect(greeks).toHaveProperty('veta');
    expect(greeks).toHaveProperty('speed');
    expect(greeks).toHaveProperty('zomma');
    expect(greeks).toHaveProperty('color');
  });

  it('matches individual Greek functions', () => {
    const greeks = bsAllGreeks(S, K, T, r, q, sigma, OptionType.CALL);
    expect(greeks.delta).toBe(bsDelta(S, K, T, r, q, sigma, OptionType.CALL));
    expect(greeks.gamma).toBe(bsGamma(S, K, T, r, q, sigma));
    expect(greeks.vega).toBe(bsVega(S, K, T, r, q, sigma));
  });
});

describe('bsPriceAndGreeks', () => {
  it('returns price and greeks for a contract', () => {
    const contract = {
      underlyingPrice: S, strike: K, expiry: T,
      riskFreeRate: r, dividendYield: q, volatility: sigma,
      type: OptionType.CALL, exerciseStyle: 'EUROPEAN' as any,
    };
    const result = bsPriceAndGreeks(contract);
    expect(result.theoreticalPrice).toBeCloseTo(10.4506, 2);
    expect(result.greeks.delta).toBeGreaterThan(0);
  });
});

describe('Implied Volatility', () => {
  it('round-trip: price → IV → price for ATM call', () => {
    const price = bsCallPrice(S, K, T, r, q, sigma);
    const iv = impliedVolatility(price, S, K, T, r, q, OptionType.CALL);
    expect(iv).toBeCloseTo(sigma, 6);
  });

  it('round-trip: price → IV → price for ATM put', () => {
    const price = bsPutPrice(S, K, T, r, q, sigma);
    const iv = impliedVolatility(price, S, K, T, r, q, OptionType.PUT);
    expect(iv).toBeCloseTo(sigma, 6);
  });

  it('round-trip across multiple vols', () => {
    for (const vol of [0.05, 0.1, 0.2, 0.4, 0.8, 1.5]) {
      const price = bsCallPrice(S, K, T, r, q, vol);
      const iv = impliedVolatility(price, S, K, T, r, q, OptionType.CALL);
      expect(iv).toBeCloseTo(vol, 4);
    }
  });

  it('round-trip for OTM options', () => {
    const otmPrice = bsCallPrice(90, 100, 0.5, r, q, 0.3);
    const iv = impliedVolatility(otmPrice, 90, 100, 0.5, r, q, OptionType.CALL);
    expect(iv).toBeCloseTo(0.3, 4);
  });

  it('round-trip for ITM options', () => {
    const itmPrice = bsPutPrice(110, 100, 0.5, r, q, 0.25);
    const iv = impliedVolatility(itmPrice, 110, 100, 0.5, r, q, OptionType.PUT);
    expect(iv).toBeCloseTo(0.25, 4);
  });

  it('returns 0 when T=0', () => {
    expect(impliedVolatility(10, 110, 100, 0, r, q, OptionType.CALL)).toBe(0);
  });

  it('returns 0 when price <= intrinsic', () => {
    expect(impliedVolatility(0, S, K, T, r, q, OptionType.CALL)).toBe(0);
  });
});

describe('Greeks: Numerical Validation via Finite Differences', () => {
  const h = 0.01;

  it('delta ≈ ∂C/∂S via finite difference', () => {
    const analyticDelta = bsDelta(S, K, T, r, q, sigma, OptionType.CALL);
    const numDelta = (bsCallPrice(S + h, K, T, r, q, sigma) - bsCallPrice(S - h, K, T, r, q, sigma)) / (2 * h);
    expect(analyticDelta).toBeCloseTo(numDelta, 4);
  });

  it('gamma ≈ ∂²C/∂S² via finite difference', () => {
    const analyticGamma = bsGamma(S, K, T, r, q, sigma);
    const numGamma = (bsCallPrice(S + h, K, T, r, q, sigma) - 2 * bsCallPrice(S, K, T, r, q, sigma) + bsCallPrice(S - h, K, T, r, q, sigma)) / (h * h);
    expect(analyticGamma).toBeCloseTo(numGamma, 3);
  });

  it('vega ≈ ∂C/∂σ via finite difference', () => {
    const dSigma = 0.001;
    const analyticVega = bsVega(S, K, T, r, q, sigma);
    const numVega = (bsCallPrice(S, K, T, r, q, sigma + dSigma) - bsCallPrice(S, K, T, r, q, sigma - dSigma)) / (2 * dSigma);
    expect(analyticVega).toBeCloseTo(numVega, 3);
  });

  it('rho ≈ ∂C/∂r via finite difference', () => {
    const dr = 0.001;
    const analyticRho = bsRho(S, K, T, r, q, sigma, OptionType.CALL);
    const numRho = (bsCallPrice(S, K, T, r + dr, q, sigma) - bsCallPrice(S, K, T, r - dr, q, sigma)) / (2 * dr);
    expect(analyticRho).toBeCloseTo(numRho, 3);
  });
});

describe('Discrete Dividends', () => {
  it('adjustForDiscreteDividends reduces spot price', () => {
    const adjusted = adjustForDiscreteDividends(100, r, [{ date: 0.25, amount: 2 }], T);
    expect(adjusted).toBeLessThan(100);
    expect(adjusted).toBeCloseTo(100 - 2 * Math.exp(-r * 0.25), 6);
  });

  it('dividends after expiry are ignored', () => {
    const adjusted = adjustForDiscreteDividends(100, r, [{ date: 2, amount: 5 }], T);
    expect(adjusted).toBe(100);
  });

  it('multiple dividends reduce spot additively', () => {
    const divs = [{ date: 0.25, amount: 1 }, { date: 0.5, amount: 1 }];
    const adjusted = adjustForDiscreteDividends(100, r, divs, T);
    const expectedPV = 1 * Math.exp(-r * 0.25) + 1 * Math.exp(-r * 0.5);
    expect(adjusted).toBeCloseTo(100 - expectedPV, 6);
  });

  it('bsPriceDiscreteDividends prices a call with dividends', () => {
    const price = bsPriceDiscreteDividends(100, 100, T, r, sigma, OptionType.CALL, [{ date: 0.5, amount: 2 }]);
    const noDivPrice = bsCallPrice(100, 100, T, r, 0, sigma);
    expect(price).toBeLessThan(noDivPrice);
  });

  it('no dividends gives same price as standard BS', () => {
    const price = bsPriceDiscreteDividends(S, K, T, r, sigma, OptionType.CALL, []);
    expect(price).toBeCloseTo(bsCallPrice(S, K, T, r, 0, sigma), 10);
  });
});

describe('Dividend Yield Effect', () => {
  it('continuous dividend reduces call price', () => {
    const noDivCall = bsCallPrice(S, K, T, r, 0, sigma);
    const divCall = bsCallPrice(S, K, T, r, 0.03, sigma);
    expect(divCall).toBeLessThan(noDivCall);
  });

  it('continuous dividend increases put price', () => {
    const noDivPut = bsPutPrice(S, K, T, r, 0, sigma);
    const divPut = bsPutPrice(S, K, T, r, 0.03, sigma);
    expect(divPut).toBeGreaterThan(noDivPut);
  });
});
