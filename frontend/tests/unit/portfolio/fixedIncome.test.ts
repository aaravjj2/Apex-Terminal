import { describe, it, expect } from 'vitest';
import {
  dayCountFraction,
  generateCashFlows,
  cashFlowSchedule,
  accruedInterest,
  bondDirtyPrice,
  bondCleanPrice,
  yieldToMaturity,
  yieldToCall,
  yieldToWorst,
  currentYield,
  macaulayDuration,
  modifiedDuration,
  effectiveDuration,
  bondConvexity,
  dollarDuration,
  keyRateDurations,
  gSpread,
  iSpread,
  zSpread,
  optionAdjustedSpread,
  assetSwapSpread,
  bootstrapYieldCurve,
  cubicSplineYieldCurve,
  nelsonSiegel,
  fitNelsonSiegel,
  nelsonSiegelSvensson,
  forwardRate,
  forwardCurve,
  carryAndRoll,
  calculateBondAnalytics,
} from '../../../src/lib/portfolio/fixedIncome';
import { DayCountConvention } from '../../../src/lib/portfolio/types';

function makeBond(overrides: Partial<any> = {}) {
  const now = new Date(2024, 0, 15);
  const issue = new Date(2023, 0, 15);
  const maturity = new Date(2026, 0, 15);
  return {
    faceValue: 100,
    couponRate: 0.05,
    frequency: 2 as const,
    maturityDate: maturity.getTime(),
    issueDate: issue.getTime(),
    settlementDate: now.getTime(),
    dayCount: DayCountConvention.Thirty360,
    ...overrides,
  };
}

describe('Day Count Fractions', () => {
  it('30/360: 6 months = 0.5', () => {
    const d1 = new Date(2024, 0, 15).getTime();
    const d2 = new Date(2024, 6, 15).getTime();
    const frac = dayCountFraction(d1, d2, DayCountConvention.Thirty360);
    expect(frac).toBeCloseTo(0.5, 2);
  });

  it('30/360: full year = 1.0', () => {
    const d1 = new Date(2024, 0, 1).getTime();
    const d2 = new Date(2025, 0, 1).getTime();
    const frac = dayCountFraction(d1, d2, DayCountConvention.Thirty360);
    expect(frac).toBeCloseTo(1.0, 2);
  });

  it('actual/actual: full year ≈ 1.0', () => {
    const d1 = new Date(2024, 0, 1).getTime();
    const d2 = new Date(2025, 0, 1).getTime();
    const frac = dayCountFraction(d1, d2, DayCountConvention.ActualActual);
    expect(frac).toBeCloseTo(1.0, 1);
  });

  it('actual/360: 360 days = 1.0', () => {
    const d1 = new Date(2024, 0, 1).getTime();
    const d2 = new Date(2024, 0, 1 + 360).getTime();
    const frac = dayCountFraction(d1, d2, DayCountConvention.Actual360);
    expect(frac).toBeCloseTo(1.0, 2);
  });

  it('actual/365: 365 days = 1.0', () => {
    const d1 = new Date(2024, 0, 1).getTime();
    const d2 = new Date(2025, 0, 1).getTime();
    const frac = dayCountFraction(d1, d2, DayCountConvention.Actual365);
    expect(frac).toBeCloseTo(1.0, 1);
  });
});

describe('Cash Flow Generation', () => {
  it('generates correct number of coupons for 2-year semi-annual bond', () => {
    const bond = makeBond({ couponRate: 0.05, frequency: 2 });
    const flows = generateCashFlows(bond);
    expect(flows.length).toBeGreaterThanOrEqual(4);
  });

  it('last cash flow includes principal', () => {
    const bond = makeBond();
    const flows = generateCashFlows(bond);
    const lastFlow = flows[flows.length - 1];
    expect(lastFlow.principal).toBe(100);
  });

  it('coupon amount = face * rate / frequency', () => {
    const bond = makeBond({ couponRate: 0.06, frequency: 2 });
    const flows = generateCashFlows(bond);
    expect(flows[0].coupon).toBeCloseTo(3, 6);
  });

  it('non-last coupons have zero principal', () => {
    const bond = makeBond();
    const flows = generateCashFlows(bond);
    for (let i = 0; i < flows.length - 1; i++) {
      expect(flows[i].principal).toBe(0);
    }
  });
});

describe('Bond Pricing', () => {
  it('bond priced at par when coupon = yield', () => {
    const bond = makeBond({ couponRate: 0.05 });
    const dirtyPrice = bondDirtyPrice(bond, 0.05);
    const ai = accruedInterest(bond);
    const cleanPrice = dirtyPrice - ai;
    expect(cleanPrice).toBeCloseTo(100, 0);
  });

  it('price decreases when yield increases', () => {
    const bond = makeBond();
    const p1 = bondDirtyPrice(bond, 0.04);
    const p2 = bondDirtyPrice(bond, 0.05);
    const p3 = bondDirtyPrice(bond, 0.06);
    expect(p1).toBeGreaterThan(p2);
    expect(p2).toBeGreaterThan(p3);
  });

  it('dirty price = clean price + accrued interest', () => {
    const bond = makeBond();
    const dirtyP = bondDirtyPrice(bond, 0.05);
    const cleanP = bondCleanPrice(bond, 0.05);
    const ai = accruedInterest(bond);
    expect(dirtyP).toBeCloseTo(cleanP + ai, 6);
  });

  it('accrued interest >= 0', () => {
    const bond = makeBond();
    expect(accruedInterest(bond)).toBeGreaterThanOrEqual(0);
  });
});

describe('Yield to Maturity', () => {
  it('YTM round-trip: price → YTM → price', () => {
    const bond = makeBond({ couponRate: 0.05 });
    const targetPrice = 98;
    const ytm = yieldToMaturity(bond, targetPrice);
    const dirtyFromYtm = bondDirtyPrice(bond, ytm);
    const cleanFromYtm = dirtyFromYtm - accruedInterest(bond);
    expect(cleanFromYtm).toBeCloseTo(targetPrice, 1);
  });

  it('discount bond (price < 100): YTM > coupon rate', () => {
    const bond = makeBond({ couponRate: 0.05 });
    const ytm = yieldToMaturity(bond, 98);
    expect(ytm).toBeGreaterThan(0.05);
  });

  it('premium bond (price > 100): YTM < coupon rate', () => {
    const bond = makeBond({ couponRate: 0.05 });
    const ytm = yieldToMaturity(bond, 102);
    expect(ytm).toBeLessThan(0.05);
  });

  it('par bond: YTM ≈ coupon rate', () => {
    const bond = makeBond({ couponRate: 0.05 });
    const cleanAtPar = bondCleanPrice(bond, 0.05);
    const ytm = yieldToMaturity(bond, cleanAtPar);
    expect(ytm).toBeCloseTo(0.05, 2);
  });
});

describe('Yield to Call / Yield to Worst', () => {
  it('YTC returns null when no call schedule', () => {
    const bond = makeBond();
    expect(yieldToCall(bond, 100)).toBeNull();
  });

  it('YTC returns a value when call schedule exists', () => {
    const callDate = new Date(2025, 0, 15).getTime();
    const bond = makeBond({ callSchedule: [{ date: callDate, price: 101 }] });
    const ytc = yieldToCall(bond, 100);
    expect(ytc).not.toBeNull();
    expect(isFinite(ytc!)).toBe(true);
  });

  it('YTW <= YTM when callable', () => {
    const callDate = new Date(2025, 0, 15).getTime();
    const bond = makeBond({ callSchedule: [{ date: callDate, price: 101 }] });
    const ytm = yieldToMaturity(bond, 102);
    const ytw = yieldToWorst(bond, 102);
    expect(ytw).toBeLessThanOrEqual(ytm + 0.01);
  });
});

describe('Current Yield', () => {
  it('current yield = annual coupon / market price', () => {
    const bond = makeBond({ couponRate: 0.05 });
    const cy = currentYield(bond, 98);
    expect(cy).toBeCloseTo(0.05 * 100 / 98, 4);
  });

  it('returns 0 for zero market price', () => {
    const bond = makeBond();
    expect(currentYield(bond, 0)).toBe(0);
  });
});

describe('Duration', () => {
  it('Macaulay duration is positive', () => {
    const bond = makeBond();
    const dur = macaulayDuration(bond, 0.05);
    expect(dur).toBeGreaterThan(0);
  });

  it('Macaulay duration < time to maturity', () => {
    const bond = makeBond();
    const dur = macaulayDuration(bond, 0.05);
    const ttm = dayCountFraction(bond.settlementDate, bond.maturityDate, bond.dayCount);
    expect(dur).toBeLessThanOrEqual(ttm + 0.01);
  });

  it('modified duration = Macaulay / (1 + y/freq)', () => {
    const bond = makeBond();
    const y = 0.05;
    const macD = macaulayDuration(bond, y);
    const modD = modifiedDuration(bond, y);
    expect(modD).toBeCloseTo(macD / (1 + y / bond.frequency), 4);
  });

  it('effective duration via bump agrees with modified duration for bullet bond', () => {
    const bond = makeBond();
    const modD = modifiedDuration(bond, 0.05);
    const effD = effectiveDuration(bond, 0.05);
    expect(effD).toBeCloseTo(modD, 0);
  });

  it('duration increases with maturity', () => {
    const bond2y = makeBond();
    const mat5y = new Date(2029, 0, 15).getTime();
    const bond5y = makeBond({ maturityDate: mat5y });
    const dur2 = macaulayDuration(bond2y, 0.05);
    const dur5 = macaulayDuration(bond5y, 0.05);
    expect(dur5).toBeGreaterThan(dur2);
  });

  it('zero-coupon bond: Macaulay duration = time to maturity', () => {
    const bond = makeBond({ couponRate: 0 });
    const ttm = dayCountFraction(bond.settlementDate, bond.maturityDate, bond.dayCount);
    const dur = macaulayDuration(bond, 0.05);
    expect(dur).toBeCloseTo(ttm, 1);
  });
});

describe('Convexity', () => {
  it('convexity is positive', () => {
    const bond = makeBond();
    const conv = bondConvexity(bond, 0.05);
    expect(conv).toBeGreaterThan(0);
  });

  it('price approximation: ΔP ≈ -D*Δy + 0.5*C*(Δy)²', () => {
    const bond = makeBond();
    const y = 0.05;
    const dy = 0.01;
    const p0 = bondDirtyPrice(bond, y);
    const pActual = bondDirtyPrice(bond, y + dy);
    const dur = modifiedDuration(bond, y);
    const conv = bondConvexity(bond, y);
    const pApprox = p0 * (1 - dur * dy + 0.5 * conv * dy * dy);
    expect(pApprox).toBeCloseTo(pActual, 0);
  });
});

describe('DV01 (Dollar Duration)', () => {
  it('DV01 is positive', () => {
    const bond = makeBond();
    const dv01 = dollarDuration(bond, 0.05);
    expect(dv01).toBeGreaterThan(0);
  });

  it('DV01 ≈ modDur * price / 10000', () => {
    const bond = makeBond();
    const y = 0.05;
    const modD = modifiedDuration(bond, y);
    const price = bondDirtyPrice(bond, y);
    const dv01 = dollarDuration(bond, y);
    expect(dv01).toBeCloseTo(modD * price / 10000, 2);
  });
});

describe('Key Rate Durations', () => {
  it('returns durations for each tenor', () => {
    const bond = makeBond();
    const krds = keyRateDurations(bond, 0.05);
    expect(krds.length).toBeGreaterThan(0);
    for (const krd of krds) {
      expect(krd).toHaveProperty('tenor');
      expect(krd).toHaveProperty('duration');
    }
  });
});

describe('Spread Calculations', () => {
  it('gSpread = bond yield - treasury yield', () => {
    expect(gSpread(0.065, 0.04)).toBeCloseTo(0.025, 10);
  });

  it('iSpread = bond yield - swap rate', () => {
    expect(iSpread(0.065, 0.045)).toBeCloseTo(0.020, 10);
  });

  it('zSpread is positive for credit bond', () => {
    const bond = makeBond({ couponRate: 0.06 });
    const treasuryCurve = [
      { maturity: 0.5, yield: 0.03 },
      { maturity: 1, yield: 0.035 },
      { maturity: 2, yield: 0.04 },
      { maturity: 5, yield: 0.045 },
    ];
    const zSpr = zSpread(bond, 98, treasuryCurve);
    expect(zSpr).toBeGreaterThan(0);
  });

  it('OAS = zSpread - option cost', () => {
    const oas = optionAdjustedSpread(0.015, 0.5, 100);
    expect(oas).toBeCloseTo(0.015 - 0.5 / 100, 4);
  });

  it('asset swap spread is finite', () => {
    const asw = assetSwapSpread(98, 100, 0.05, 0.04, 2, 2);
    expect(isFinite(asw)).toBe(true);
  });
});

describe('Nelson-Siegel Model', () => {
  it('NS at maturity=0: yield = β0 + β1', () => {
    expect(nelsonSiegel(0.05, -0.01, 0.02, 2, 0)).toBeCloseTo(0.04, 10);
  });

  it('NS at large maturity: yield → β0', () => {
    const y = nelsonSiegel(0.05, -0.01, 0.02, 2, 100);
    expect(y).toBeCloseTo(0.05, 2);
  });

  it('NS produces smooth term structure', () => {
    const maturities = [0.25, 0.5, 1, 2, 5, 10, 30];
    const yields = maturities.map(t => nelsonSiegel(0.05, -0.02, 0.03, 2, t));
    for (const y of yields) {
      expect(isFinite(y)).toBe(true);
    }
  });

  it('fitNelsonSiegel fits market data reasonably', () => {
    const marketData = [
      { maturity: 0.25, yield: 0.03 },
      { maturity: 0.5, yield: 0.032 },
      { maturity: 1, yield: 0.035 },
      { maturity: 2, yield: 0.038 },
      { maturity: 5, yield: 0.042 },
      { maturity: 10, yield: 0.045 },
      { maturity: 30, yield: 0.048 },
    ];
    const params = fitNelsonSiegel(marketData);
    for (const point of marketData) {
      const fitted = nelsonSiegel(params.beta0, params.beta1, params.beta2, params.lambda, point.maturity);
      expect(fitted).toBeCloseTo(point.yield, 1);
    }
  });
});

describe('Nelson-Siegel-Svensson', () => {
  it('NSS at maturity=0: yield = β0 + β1', () => {
    expect(nelsonSiegelSvensson(0.05, -0.01, 0.02, 0.01, 1.5, 5, 0)).toBeCloseTo(0.04, 10);
  });

  it('NSS produces finite yields', () => {
    for (const t of [0.25, 1, 5, 10, 30]) {
      const y = nelsonSiegelSvensson(0.05, -0.01, 0.02, 0.01, 1.5, 5, t);
      expect(isFinite(y)).toBe(true);
    }
  });
});

describe('Forward Rates', () => {
  it('forward rate between two spots', () => {
    const spot1 = 0.04;
    const spot2 = 0.05;
    const fwd = forwardRate(spot1, 1, spot2, 2);
    expect(fwd).toBeGreaterThan(spot2);
  });

  it('forward rate equals spot for same maturity', () => {
    expect(forwardRate(0.05, 2, 0.05, 2)).toBe(0.05);
  });

  it('forwardCurve returns rates for each point', () => {
    const curve = [
      { maturity: 1, yield: 0.03 },
      { maturity: 2, yield: 0.035 },
      { maturity: 5, yield: 0.04 },
    ];
    const fwdCurve = forwardCurve(curve);
    expect(fwdCurve).toHaveLength(3);
    expect(fwdCurve[0].forwardRate).toBeCloseTo(0.03, 6);
  });
});

describe('Bootstrap Yield Curve', () => {
  it('bootstraps discount factors and zero rates', () => {
    const instruments = [
      { maturity: 0.5, couponRate: 0, price: 98.5, frequency: 2 },
      { maturity: 1, couponRate: 0.03, price: 100, frequency: 2 },
      { maturity: 2, couponRate: 0.035, price: 100, frequency: 2 },
    ];
    const curve = bootstrapYieldCurve(instruments);
    expect(curve).toHaveLength(3);
    for (const point of curve) {
      expect(point.discountFactor).toBeGreaterThan(0);
      expect(point.discountFactor).toBeLessThanOrEqual(1);
      expect(point.yield).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Cubic Spline Yield Curve', () => {
  it('interpolates between known points', () => {
    const knots = [
      { maturity: 1, yield: 0.03 },
      { maturity: 2, yield: 0.035 },
      { maturity: 5, yield: 0.04 },
      { maturity: 10, yield: 0.045 },
    ];
    const result = cubicSplineYieldCurve(knots, [1, 3, 5, 7, 10]);
    expect(result[0].yield).toBeCloseTo(0.03, 4);
    expect(result[2].yield).toBeCloseTo(0.04, 4);
    expect(result[4].yield).toBeCloseTo(0.045, 4);
    expect(result[1].yield).toBeGreaterThan(0.035);
    expect(result[1].yield).toBeLessThan(0.04);
  });
});

describe('Carry and Roll Analysis', () => {
  it('returns finite carry metrics', () => {
    const bond = makeBond({ couponRate: 0.05 });
    const yieldCurve = [
      { maturity: 0.25, yield: 0.03 },
      { maturity: 0.5, yield: 0.035 },
      { maturity: 1, yield: 0.04 },
      { maturity: 2, yield: 0.045 },
      { maturity: 5, yield: 0.05 },
    ];
    const result = carryAndRoll(bond, 100, yieldCurve, 0.25);
    expect(isFinite(result.carry)).toBe(true);
    expect(isFinite(result.rollReturn)).toBe(true);
    expect(isFinite(result.totalCarryRoll)).toBe(true);
  });
});

describe('Full Bond Analytics', () => {
  it('returns all analytics fields', () => {
    const bond = makeBond({ couponRate: 0.05 });
    const analytics = calculateBondAnalytics(bond, 98);
    expect(analytics).toHaveProperty('cleanPrice');
    expect(analytics).toHaveProperty('dirtyPrice');
    expect(analytics).toHaveProperty('accruedInterest');
    expect(analytics).toHaveProperty('ytm');
    expect(analytics).toHaveProperty('ytc');
    expect(analytics).toHaveProperty('ytw');
    expect(analytics).toHaveProperty('currentYield');
    expect(analytics).toHaveProperty('macaulayDuration');
    expect(analytics).toHaveProperty('modifiedDuration');
    expect(analytics).toHaveProperty('effectiveDuration');
    expect(analytics).toHaveProperty('convexity');
    expect(analytics).toHaveProperty('dv01');
  });

  it('cleanPrice matches input', () => {
    const bond = makeBond();
    const analytics = calculateBondAnalytics(bond, 98);
    expect(analytics.cleanPrice).toBe(98);
  });

  it('dirtyPrice = cleanPrice + accruedInterest', () => {
    const bond = makeBond();
    const analytics = calculateBondAnalytics(bond, 98);
    expect(analytics.dirtyPrice).toBeCloseTo(98 + analytics.accruedInterest, 6);
  });

  it('all durations and convexity are positive for standard bond', () => {
    const bond = makeBond();
    const analytics = calculateBondAnalytics(bond, 98);
    expect(analytics.macaulayDuration).toBeGreaterThan(0);
    expect(analytics.modifiedDuration).toBeGreaterThan(0);
    expect(analytics.effectiveDuration).toBeGreaterThan(0);
    expect(analytics.convexity).toBeGreaterThan(0);
    expect(analytics.dv01).toBeGreaterThan(0);
  });
});

describe('Cash Flow Schedule', () => {
  it('present values are positive', () => {
    const bond = makeBond();
    const schedule = cashFlowSchedule(bond, 0.05);
    const futureCFs = schedule.filter(cf => cf.date >= bond.settlementDate);
    for (const cf of futureCFs) {
      expect(cf.presentValue).toBeGreaterThan(0);
      expect(cf.discountFactor).toBeGreaterThan(0);
      expect(cf.discountFactor).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
