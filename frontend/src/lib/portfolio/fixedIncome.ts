import type {
  Bond,
  BondAnalytics,
  SpreadMetrics,
  YieldCurvePoint,
  CashFlowSchedule,
  KeyRateDuration,
  CarryRollAnalysis,
  DayCountConvention,
} from './types';

// ─── Day Count Fractions ────────────────────────────────────────────────────

export function dayCountFraction(
  startDate: number,
  endDate: number,
  convention: DayCountConvention
): number {
  const d1 = new Date(startDate);
  const d2 = new Date(endDate);

  switch (convention) {
    case '30/360': {
      const y1 = d1.getFullYear(), m1 = d1.getMonth() + 1;
      let dd1 = Math.min(d1.getDate(), 30);
      const y2 = d2.getFullYear(), m2 = d2.getMonth() + 1;
      let dd2 = Math.min(d2.getDate(), 30);
      if (dd1 === 31) dd1 = 30;
      if (dd2 === 31 && dd1 >= 30) dd2 = 30;
      return (360 * (y2 - y1) + 30 * (m2 - m1) + (dd2 - dd1)) / 360;
    }
    case 'actual/actual': {
      const diffMs = endDate - startDate;
      const diffDays = diffMs / (24 * 60 * 60 * 1000);
      const yearStart = new Date(d1.getFullYear(), 0, 1).getTime();
      const yearEnd = new Date(d1.getFullYear() + 1, 0, 1).getTime();
      const daysInYear = (yearEnd - yearStart) / (24 * 60 * 60 * 1000);
      return diffDays / daysInYear;
    }
    case 'actual/360': {
      const diffMs = endDate - startDate;
      return diffMs / (24 * 60 * 60 * 1000) / 360;
    }
    case 'actual/365': {
      const diffMs = endDate - startDate;
      return diffMs / (24 * 60 * 60 * 1000) / 365;
    }
  }
}

// ─── Cash Flow Generation ───────────────────────────────────────────────────

export function generateCashFlows(bond: Bond): { date: number; coupon: number; principal: number }[] {
  const flows: { date: number; coupon: number; principal: number }[] = [];
  const couponPerPeriod = (bond.couponRate / bond.frequency) * bond.faceValue;

  const matDate = new Date(bond.maturityDate);

  // Walk backward from maturity to generate coupon dates
  const couponDates: number[] = [];
  const d = new Date(matDate);

  while (d.getTime() > bond.issueDate) {
    couponDates.unshift(d.getTime());
    const monthsBack = 12 / bond.frequency;
    d.setMonth(d.getMonth() - monthsBack);
  }

  for (let i = 0; i < couponDates.length; i++) {
    const isLast = i === couponDates.length - 1;
    flows.push({
      date: couponDates[i],
      coupon: couponPerPeriod,
      principal: isLast ? bond.faceValue : 0,
    });
  }

  return flows;
}

export function cashFlowSchedule(bond: Bond, yieldRate: number): CashFlowSchedule[] {
  const flows = generateCashFlows(bond);
  const schedule: CashFlowSchedule[] = [];

  for (const flow of flows) {
    const t = dayCountFraction(bond.settlementDate, flow.date, bond.dayCount);
    const df = Math.pow(1 + yieldRate / bond.frequency, -t * bond.frequency);
    const total = flow.coupon + flow.principal;
    schedule.push({
      date: flow.date,
      coupon: flow.coupon,
      principal: flow.principal,
      total,
      discountFactor: df,
      presentValue: total * df,
    });
  }

  return schedule;
}

// ─── Accrued Interest ───────────────────────────────────────────────────────

export function accruedInterest(bond: Bond): number {
  const flows = generateCashFlows(bond);
  const couponPerPeriod = (bond.couponRate / bond.frequency) * bond.faceValue;

  let prevCouponDate = bond.issueDate;
  let nextCouponDate = bond.maturityDate;

  for (const flow of flows) {
    if (flow.date <= bond.settlementDate) {
      prevCouponDate = flow.date;
    } else {
      nextCouponDate = flow.date;
      break;
    }
  }

  const accrualPeriod = dayCountFraction(prevCouponDate, bond.settlementDate, bond.dayCount);
  const fullPeriod = dayCountFraction(prevCouponDate, nextCouponDate, bond.dayCount);

  return fullPeriod > 0 ? couponPerPeriod * (accrualPeriod / fullPeriod) : 0;
}

// ─── Bond Pricing ───────────────────────────────────────────────────────────

export function bondDirtyPrice(bond: Bond, yieldRate: number): number {
  const flows = generateCashFlows(bond);
  let price = 0;

  for (const flow of flows) {
    if (flow.date <= bond.settlementDate) continue;
    const t = dayCountFraction(bond.settlementDate, flow.date, bond.dayCount);
    const df = Math.pow(1 + yieldRate / bond.frequency, -t * bond.frequency);
    price += (flow.coupon + flow.principal) * df;
  }

  return price;
}

export function bondCleanPrice(bond: Bond, yieldRate: number): number {
  return bondDirtyPrice(bond, yieldRate) - accruedInterest(bond);
}

// ─── Yield Calculations ─────────────────────────────────────────────────────

export function yieldToMaturity(
  bond: Bond,
  marketPrice: number,
  tolerance = 1e-10,
  maxIter = 500
): number {
  const targetDirty = marketPrice + accruedInterest(bond);
  let ytm = bond.couponRate || 0.05;

  for (let iter = 0; iter < maxIter; iter++) {
    const price = bondDirtyPrice(bond, ytm);
    const diff = price - targetDirty;

    if (Math.abs(diff) < tolerance) return ytm;

    const dYtm = 0.0001;
    const priceUp = bondDirtyPrice(bond, ytm + dYtm);
    const deriv = (priceUp - price) / dYtm;

    if (Math.abs(deriv) < 1e-20) break;

    ytm -= diff / deriv;

    if (ytm < -0.5) ytm = -0.5;
    if (ytm > 2) ytm = 2;
  }

  return ytm;
}

export function yieldToCall(bond: Bond, marketPrice: number): number | null {
  if (!bond.callSchedule || bond.callSchedule.length === 0) return null;

  let worstYield = Infinity;

  for (const call of bond.callSchedule) {
    if (call.date <= bond.settlementDate) continue;

    const callBond: Bond = {
      ...bond,
      maturityDate: call.date,
      faceValue: call.price,
    };

    const ytc = yieldToMaturity(callBond, marketPrice);
    if (ytc < worstYield) worstYield = ytc;
  }

  return worstYield === Infinity ? null : worstYield;
}

export function yieldToWorst(bond: Bond, marketPrice: number): number {
  const ytm = yieldToMaturity(bond, marketPrice);
  const ytc = yieldToCall(bond, marketPrice);
  return ytc !== null ? Math.min(ytm, ytc) : ytm;
}

export function currentYield(bond: Bond, marketPrice: number): number {
  const annualCoupon = bond.couponRate * bond.faceValue;
  return marketPrice > 0 ? annualCoupon / marketPrice : 0;
}

// ─── Duration & Convexity ───────────────────────────────────────────────────

export function macaulayDuration(bond: Bond, yieldRate: number): number {
  const flows = generateCashFlows(bond);
  let weightedTime = 0;
  let totalPV = 0;

  for (const flow of flows) {
    if (flow.date <= bond.settlementDate) continue;
    const t = dayCountFraction(bond.settlementDate, flow.date, bond.dayCount);
    const cf = flow.coupon + flow.principal;
    const df = Math.pow(1 + yieldRate / bond.frequency, -t * bond.frequency);
    const pv = cf * df;
    weightedTime += t * pv;
    totalPV += pv;
  }

  return totalPV > 0 ? weightedTime / totalPV : 0;
}

export function modifiedDuration(bond: Bond, yieldRate: number): number {
  const macD = macaulayDuration(bond, yieldRate);
  return macD / (1 + yieldRate / bond.frequency);
}

export function effectiveDuration(bond: Bond, yieldRate: number, shiftBps = 1): number {
  const shift = shiftBps / 10000;
  const priceUp = bondDirtyPrice(bond, yieldRate - shift);
  const priceDown = bondDirtyPrice(bond, yieldRate + shift);
  const priceBase = bondDirtyPrice(bond, yieldRate);
  return priceBase > 0 ? (priceUp - priceDown) / (2 * shift * priceBase) : 0;
}

export function bondConvexity(bond: Bond, yieldRate: number, shiftBps = 1): number {
  const shift = shiftBps / 10000;
  const priceUp = bondDirtyPrice(bond, yieldRate - shift);
  const priceDown = bondDirtyPrice(bond, yieldRate + shift);
  const priceBase = bondDirtyPrice(bond, yieldRate);
  return priceBase > 0 ? (priceUp + priceDown - 2 * priceBase) / (shift * shift * priceBase) : 0;
}

export function dollarDuration(bond: Bond, yieldRate: number): number {
  const modD = modifiedDuration(bond, yieldRate);
  const price = bondDirtyPrice(bond, yieldRate);
  return modD * price / 10000;
}

export function keyRateDurations(
  bond: Bond,
  yieldRate: number,
  tenors: number[] = [0.5, 1, 2, 3, 5, 7, 10, 20, 30]
): KeyRateDuration[] {
  const basePrice = bondDirtyPrice(bond, yieldRate);
  const shift = 0.0001;

  return tenors.map(tenor => {
    const timeToMaturity = dayCountFraction(bond.settlementDate, bond.maturityDate, bond.dayCount);
    const weight = Math.exp(-0.5 * ((timeToMaturity - tenor) / Math.max(tenor * 0.5, 0.25)) ** 2);

    const adjustedYieldUp = yieldRate + shift * weight;
    const adjustedYieldDown = yieldRate - shift * weight;
    const priceUp = bondDirtyPrice(bond, adjustedYieldDown);
    const priceDown = bondDirtyPrice(bond, adjustedYieldUp);

    const krd = basePrice > 0 ? (priceUp - priceDown) / (2 * shift * basePrice) * weight : 0;

    return { tenor, duration: krd };
  });
}

// ─── Spread Calculations ────────────────────────────────────────────────────

export function gSpread(bondYield: number, treasuryYield: number): number {
  return bondYield - treasuryYield;
}

export function iSpread(bondYield: number, swapRate: number): number {
  return bondYield - swapRate;
}

export function zSpread(
  bond: Bond,
  marketPrice: number,
  treasuryCurve: { maturity: number; yield: number }[],
  tolerance = 1e-8,
  maxIter = 200
): number {
  const targetDirty = marketPrice + accruedInterest(bond);
  const flows = generateCashFlows(bond);

  const interpolateYield = (t: number): number => {
    if (treasuryCurve.length === 0) return 0;
    if (t <= treasuryCurve[0].maturity) return treasuryCurve[0].yield;
    if (t >= treasuryCurve[treasuryCurve.length - 1].maturity)
      return treasuryCurve[treasuryCurve.length - 1].yield;

    for (let i = 0; i < treasuryCurve.length - 1; i++) {
      if (t >= treasuryCurve[i].maturity && t <= treasuryCurve[i + 1].maturity) {
        const frac = (t - treasuryCurve[i].maturity) /
          (treasuryCurve[i + 1].maturity - treasuryCurve[i].maturity);
        return treasuryCurve[i].yield + frac * (treasuryCurve[i + 1].yield - treasuryCurve[i].yield);
      }
    }
    return treasuryCurve[0].yield;
  };

  let spread = 0.01;

  for (let iter = 0; iter < maxIter; iter++) {
    let price = 0;
    let dPrice = 0;

    for (const flow of flows) {
      if (flow.date <= bond.settlementDate) continue;
      const t = dayCountFraction(bond.settlementDate, flow.date, bond.dayCount);
      const treasYield = interpolateYield(t);
      const cf = flow.coupon + flow.principal;
      const df = Math.pow(1 + (treasYield + spread) / bond.frequency, -t * bond.frequency);
      price += cf * df;
      dPrice += -t * cf * df / (1 + (treasYield + spread) / bond.frequency);
    }

    const diff = price - targetDirty;
    if (Math.abs(diff) < tolerance) return spread;
    if (Math.abs(dPrice) < 1e-20) break;
    spread -= diff / dPrice;
  }

  return spread;
}

export function optionAdjustedSpread(
  zSpreadValue: number,
  optionValue: number,
  bondPrice: number
): number {
  const optionCostInYield = bondPrice > 0 ? optionValue / bondPrice : 0;
  return zSpreadValue - optionCostInYield;
}

export function assetSwapSpread(
  cleanPrice: number,
  parValue: number,
  couponRate: number,
  swapRate: number,
  frequency: number,
  yearsToMaturity: number
): number {
  const annuity = (1 - Math.pow(1 + swapRate / frequency, -yearsToMaturity * frequency)) / (swapRate / frequency);
  const aswSpread = couponRate - swapRate + (parValue - cleanPrice) / (annuity * parValue);
  return aswSpread;
}

export function calculateSpreadMetrics(
  bond: Bond,
  marketPrice: number,
  treasuryCurve: { maturity: number; yield: number }[],
  swapRate: number,
  optionValue = 0
): SpreadMetrics {
  const ytm = yieldToMaturity(bond, marketPrice);
  const ttm = dayCountFraction(bond.settlementDate, bond.maturityDate, bond.dayCount);

  let treasYield = treasuryCurve[0]?.yield ?? 0;
  for (let i = 0; i < treasuryCurve.length - 1; i++) {
    if (ttm >= treasuryCurve[i].maturity && ttm <= treasuryCurve[i + 1].maturity) {
      const frac = (ttm - treasuryCurve[i].maturity) /
        (treasuryCurve[i + 1].maturity - treasuryCurve[i].maturity);
      treasYield = treasuryCurve[i].yield + frac * (treasuryCurve[i + 1].yield - treasuryCurve[i].yield);
      break;
    }
  }

  const gSpr = gSpread(ytm, treasYield);
  const iSpr = iSpread(ytm, swapRate);
  const zSpr = zSpread(bond, marketPrice, treasuryCurve);
  const oas = optionAdjustedSpread(zSpr, optionValue, marketPrice);
  const cleanP = bondCleanPrice(bond, ytm);
  const aswSpr = assetSwapSpread(cleanP, bond.faceValue, bond.couponRate, swapRate, bond.frequency, ttm);

  return { gSpread: gSpr, iSpread: iSpr, zSpread: zSpr, oas, aswSpread: aswSpr };
}

// ─── Yield Curve Construction ───────────────────────────────────────────────

function interpolateDF(dfs: { maturity: number; df: number }[], t: number): number {
  if (dfs.length === 0) return 1;
  if (t <= dfs[0].maturity) return Math.pow(dfs[0].df, t / dfs[0].maturity);
  if (t >= dfs[dfs.length - 1].maturity) {
    const last = dfs[dfs.length - 1];
    return Math.pow(last.df, t / last.maturity);
  }

  for (let i = 0; i < dfs.length - 1; i++) {
    if (t >= dfs[i].maturity && t <= dfs[i + 1].maturity) {
      const frac = (t - dfs[i].maturity) / (dfs[i + 1].maturity - dfs[i].maturity);
      const logDF = Math.log(dfs[i].df) + frac * (Math.log(dfs[i + 1].df) - Math.log(dfs[i].df));
      return Math.exp(logDF);
    }
  }
  return 1;
}

function calculateParYield(
  dfs: { maturity: number; df: number }[],
  maturity: number,
  frequency: number
): number {
  const periods = Math.round(maturity * frequency);
  let annuity = 0;
  for (let t = 1; t <= periods; t++) {
    annuity += interpolateDF(dfs, t / frequency);
  }
  const dfMat = interpolateDF(dfs, maturity);
  return annuity > 0 ? frequency * (1 - dfMat) / annuity : 0;
}

export function bootstrapYieldCurve(
  instruments: { maturity: number; couponRate: number; price: number; frequency: number }[]
): YieldCurvePoint[] {
  const sorted = [...instruments].sort((a, b) => a.maturity - b.maturity);
  const discountFactors: { maturity: number; df: number }[] = [];
  const points: YieldCurvePoint[] = [];

  for (const inst of sorted) {
    const { maturity, couponRate, price, frequency } = inst;
    const coupon = couponRate / frequency;
    const periods = Math.round(maturity * frequency);

    let knownPV = 0;
    for (let t = 1; t < periods; t++) {
      const tYears = t / frequency;
      const df = interpolateDF(discountFactors, tYears);
      knownPV += coupon * 100 * df;
    }

    const df = (price - knownPV) / (100 * (1 + coupon));
    discountFactors.push({ maturity, df });

    const zeroRate = df > 0 ? Math.pow(1 / df, 1 / maturity) - 1 : 0;

    let fwdRate = 0;
    if (discountFactors.length >= 2) {
      const prev = discountFactors[discountFactors.length - 2];
      const dt = maturity - prev.maturity;
      if (dt > 0 && prev.df > 0 && df > 0) {
        fwdRate = (prev.df / df - 1) / dt;
      }
    } else {
      fwdRate = zeroRate;
    }

    const parYld = calculateParYield(discountFactors, maturity, frequency);

    points.push({
      maturity,
      yield: zeroRate,
      discountFactor: df,
      forwardRate: fwdRate,
      parYield: parYld,
    });
  }

  return points;
}

// ─── Cubic Spline Interpolation ─────────────────────────────────────────────

export function cubicSplineYieldCurve(
  knots: { maturity: number; yield: number }[],
  evalPoints: number[]
): { maturity: number; yield: number }[] {
  const n = knots.length;
  if (n < 2) return evalPoints.map(t => ({ maturity: t, yield: knots[0]?.yield ?? 0 }));

  const x = knots.map(k => k.maturity);
  const y = knots.map(k => k.yield);

  const h = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) h[i] = x[i + 1] - x[i];

  const alpha = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / h[i]) * (y[i + 1] - y[i]) - (3 / h[i - 1]) * (y[i] - y[i - 1]);
  }

  const l = new Array(n).fill(1);
  const mu = new Array(n).fill(0);
  const z = new Array(n).fill(0);

  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  const c = new Array(n).fill(0);
  const b = new Array(n - 1);
  const d = new Array(n - 1);

  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (y[j + 1] - y[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  return evalPoints.map(t => {
    let seg = 0;
    for (let i = 0; i < n - 1; i++) {
      if (t >= x[i] && (i === n - 2 || t < x[i + 1])) { seg = i; break; }
    }
    const dt = t - x[seg];
    const yVal = y[seg] + b[seg] * dt + c[seg] * dt * dt + d[seg] * dt * dt * dt;
    return { maturity: t, yield: yVal };
  });
}

// ─── Nelson-Siegel Model ────────────────────────────────────────────────────

export function nelsonSiegel(
  beta0: number,
  beta1: number,
  beta2: number,
  lambda: number,
  maturity: number
): number {
  if (maturity <= 0) return beta0 + beta1;
  const x = maturity / lambda;
  const expTerm = Math.exp(-x);
  const factor1 = (1 - expTerm) / x;
  const factor2 = factor1 - expTerm;
  return beta0 + beta1 * factor1 + beta2 * factor2;
}

export function fitNelsonSiegel(
  marketData: { maturity: number; yield: number }[],
  maxIter = 1000,
  lr = 0.001
): { beta0: number; beta1: number; beta2: number; lambda: number } {
  let beta0 = marketData[marketData.length - 1].yield;
  let beta1 = marketData[0].yield - beta0;
  let beta2 = 0;
  let lambda = 2;

  for (let iter = 0; iter < maxIter; iter++) {
    let dBeta0 = 0, dBeta1 = 0, dBeta2 = 0, dLambda = 0;

    for (const point of marketData) {
      const t = point.maturity;
      const predicted = nelsonSiegel(beta0, beta1, beta2, lambda, t);
      const error = predicted - point.yield;

      const x = t / lambda;
      const expTerm = Math.exp(-x);
      const factor1 = x > 0 ? (1 - expTerm) / x : 1;
      const factor2 = factor1 - expTerm;

      dBeta0 += 2 * error;
      dBeta1 += 2 * error * factor1;
      dBeta2 += 2 * error * factor2;

      if (x > 0) {
        const dFactor1 = (expTerm * (x + 1) - 1) / (x * x) * (t / (lambda * lambda));
        const dFactor2 = dFactor1 - expTerm * t / (lambda * lambda);
        dLambda += 2 * error * (beta1 * dFactor1 + beta2 * dFactor2);
      }
    }

    beta0 -= lr * dBeta0 / marketData.length;
    beta1 -= lr * dBeta1 / marketData.length;
    beta2 -= lr * dBeta2 / marketData.length;
    lambda -= lr * dLambda / marketData.length;
    lambda = Math.max(0.1, lambda);
  }

  return { beta0, beta1, beta2, lambda };
}

// ─── Nelson-Siegel-Svensson Model ──────────────────────────────────────────

export function nelsonSiegelSvensson(
  beta0: number, beta1: number, beta2: number, beta3: number,
  lambda1: number, lambda2: number,
  maturity: number
): number {
  if (maturity <= 0) return beta0 + beta1;

  const x1 = maturity / lambda1;
  const x2 = maturity / lambda2;
  const exp1 = Math.exp(-x1);
  const exp2 = Math.exp(-x2);

  const f1 = (1 - exp1) / x1;
  const f2 = f1 - exp1;
  const f3 = (1 - exp2) / x2 - exp2;

  return beta0 + beta1 * f1 + beta2 * f2 + beta3 * f3;
}

export function fitNelsonSiegelSvensson(
  marketData: { maturity: number; yield: number }[],
  maxIter = 2000,
  lr = 0.0005
): { beta0: number; beta1: number; beta2: number; beta3: number; lambda1: number; lambda2: number } {
  let beta0 = marketData[marketData.length - 1].yield;
  let beta1 = marketData[0].yield - beta0;
  let beta2 = 0, beta3 = 0;
  const lambda1 = 1.5, lambda2 = 5;

  for (let iter = 0; iter < maxIter; iter++) {
    let dB0 = 0, dB1 = 0, dB2 = 0, dB3 = 0;

    for (const point of marketData) {
      const predicted = nelsonSiegelSvensson(beta0, beta1, beta2, beta3, lambda1, lambda2, point.maturity);
      const error = predicted - point.yield;
      const t = point.maturity;

      const x1 = t / lambda1;
      const x2 = t / lambda2;
      const exp1 = Math.exp(-x1);
      const exp2 = Math.exp(-x2);
      const f1 = x1 > 0 ? (1 - exp1) / x1 : 1;
      const f2 = f1 - exp1;
      const f3 = x2 > 0 ? (1 - exp2) / x2 - exp2 : 0;

      dB0 += 2 * error;
      dB1 += 2 * error * f1;
      dB2 += 2 * error * f2;
      dB3 += 2 * error * f3;
    }

    const nn = marketData.length;
    beta0 -= lr * dB0 / nn;
    beta1 -= lr * dB1 / nn;
    beta2 -= lr * dB2 / nn;
    beta3 -= lr * dB3 / nn;
  }

  return { beta0, beta1, beta2, beta3, lambda1, lambda2 };
}

// ─── Forward Rates ──────────────────────────────────────────────────────────

export function forwardRate(
  spotRate1: number, maturity1: number,
  spotRate2: number, maturity2: number
): number {
  if (maturity2 <= maturity1) return spotRate2;
  const df1 = Math.pow(1 + spotRate1, -maturity1);
  const df2 = Math.pow(1 + spotRate2, -maturity2);
  const dt = maturity2 - maturity1;
  return Math.pow(df1 / df2, 1 / dt) - 1;
}

export function instantaneousForwardRate(
  spotRate: number,
  maturity: number,
  dSpotDt: number
): number {
  return spotRate + maturity * dSpotDt;
}

export function forwardCurve(
  yieldCurve: { maturity: number; yield: number }[]
): { maturity: number; forwardRate: number }[] {
  const result: { maturity: number; forwardRate: number }[] = [];

  for (let i = 0; i < yieldCurve.length; i++) {
    if (i === 0) {
      result.push({ maturity: yieldCurve[i].maturity, forwardRate: yieldCurve[i].yield });
    } else {
      const fwd = forwardRate(
        yieldCurve[i - 1].yield, yieldCurve[i - 1].maturity,
        yieldCurve[i].yield, yieldCurve[i].maturity
      );
      result.push({ maturity: yieldCurve[i].maturity, forwardRate: fwd });
    }
  }

  return result;
}

// ─── Bond Relative Value ────────────────────────────────────────────────────

export interface BondRelativeValue {
  symbol: string;
  spreadToFit: number;
  durationAdjustedSpread: number;
  cheapRich: 'cheap' | 'rich' | 'fair';
  zScore: number;
}

export function bondRelativeValue(
  bonds: { symbol: string; yield: number; duration: number; spread: number }[],
  fittedCurve: (duration: number) => number
): BondRelativeValue[] {
  const residuals = bonds.map(b => ({
    ...b,
    spreadToFit: b.spread - fittedCurve(b.duration),
    durationAdjustedSpread: b.spread / Math.max(b.duration, 0.01),
  }));

  const meanResidual = residuals.reduce((s, r) => s + r.spreadToFit, 0) / residuals.length;
  const stdResidual = Math.sqrt(
    residuals.reduce((s, r) => s + (r.spreadToFit - meanResidual) ** 2, 0) / Math.max(residuals.length - 1, 1)
  );

  return residuals.map(r => {
    const zScore = stdResidual > 0 ? (r.spreadToFit - meanResidual) / stdResidual : 0;
    return {
      symbol: r.symbol,
      spreadToFit: r.spreadToFit,
      durationAdjustedSpread: r.durationAdjustedSpread,
      cheapRich: zScore > 1 ? 'cheap' : zScore < -1 ? 'rich' : 'fair',
      zScore,
    };
  });
}

// ─── Carry and Roll Analysis ────────────────────────────────────────────────

export function carryAndRoll(
  bond: Bond,
  marketPrice: number,
  yieldCurve: { maturity: number; yield: number }[],
  horizonYears = 0.25
): CarryRollAnalysis {
  const ytm = yieldToMaturity(bond, marketPrice);
  const ttm = dayCountFraction(bond.settlementDate, bond.maturityDate, bond.dayCount);
  const fundingRate = yieldCurve.length > 0 ? yieldCurve[0].yield : 0;

  const carry = ytm - fundingRate;

  const newTTM = ttm - horizonYears;
  let rolledYield = ytm;

  for (let i = 0; i < yieldCurve.length - 1; i++) {
    if (newTTM >= yieldCurve[i].maturity && newTTM <= yieldCurve[i + 1].maturity) {
      const frac = (newTTM - yieldCurve[i].maturity) /
        (yieldCurve[i + 1].maturity - yieldCurve[i].maturity);
      rolledYield = yieldCurve[i].yield + frac * (yieldCurve[i + 1].yield - yieldCurve[i].yield);
      break;
    }
  }

  const modDur = modifiedDuration(bond, ytm);
  const rollReturn = -modDur * (rolledYield - ytm);
  const totalCarryRoll = carry * horizonYears + rollReturn;
  const breakEvenYieldChange = totalCarryRoll > 0 && modDur > 0
    ? totalCarryRoll / modDur
    : 0;

  return { carry, rollReturn, totalCarryRoll, breakEvenYieldChange };
}

// ─── Full Bond Analytics ────────────────────────────────────────────────────

export function calculateBondAnalytics(bond: Bond, marketPrice: number): BondAnalytics {
  const ytm = yieldToMaturity(bond, marketPrice);
  const ytc = yieldToCall(bond, marketPrice);
  const ytw = yieldToWorst(bond, marketPrice);
  const ai = accruedInterest(bond);

  return {
    cleanPrice: marketPrice,
    dirtyPrice: marketPrice + ai,
    accruedInterest: ai,
    ytm,
    ytc,
    ytw,
    currentYield: currentYield(bond, marketPrice),
    macaulayDuration: macaulayDuration(bond, ytm),
    modifiedDuration: modifiedDuration(bond, ytm),
    effectiveDuration: effectiveDuration(bond, ytm),
    convexity: bondConvexity(bond, ytm),
    dv01: dollarDuration(bond, ytm),
  };
}
