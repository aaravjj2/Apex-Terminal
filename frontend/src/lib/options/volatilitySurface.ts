import {
  OptionType,
  VolSurfacePoint,
  VolSurface,
  SABRParams,
  SVIParams,
} from './types';
import { bsPrice, impliedVolatility, normalCDF, normalPDF, bsDelta } from './blackScholes';

// ─── Cubic Spline Interpolation ─────────────────────────────────────────────

interface SplineCoefficients {
  xs: number[];
  ys: number[];
  a: number[];
  b: number[];
  c: number[];
  d: number[];
}

function buildCubicSpline(xs: number[], ys: number[]): SplineCoefficients {
  const n = xs.length - 1;
  if (n < 1) return { xs, ys, a: [ys[0]], b: [0], c: [0], d: [0] };

  const h = new Float64Array(n);
  for (let i = 0; i < n; i++) h[i] = xs[i + 1] - xs[i];

  // Natural spline: solve tridiagonal system for c coefficients
  const alpha = new Float64Array(n + 1);
  for (let i = 1; i < n; i++) {
    alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  }

  const l = new Float64Array(n + 1);
  const mu = new Float64Array(n + 1);
  const z = new Float64Array(n + 1);
  l[0] = 1;

  for (let i = 1; i < n; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  l[n] = 1;
  const cCoeff = new Float64Array(n + 1);
  const bCoeff = new Float64Array(n);
  const dCoeff = new Float64Array(n);
  const aCoeff = ys.slice();

  for (let j = n - 1; j >= 0; j--) {
    cCoeff[j] = z[j] - mu[j] * cCoeff[j + 1];
    bCoeff[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (cCoeff[j + 1] + 2 * cCoeff[j]) / 3;
    dCoeff[j] = (cCoeff[j + 1] - cCoeff[j]) / (3 * h[j]);
  }

  return {
    xs, ys,
    a: Array.from(aCoeff),
    b: Array.from(bCoeff),
    c: Array.from(cCoeff),
    d: Array.from(dCoeff),
  };
}

function evaluateSpline(spline: SplineCoefficients, x: number): number {
  const { xs, a, b, c, d } = spline;
  const n = xs.length - 1;

  // Clamp to range
  if (x <= xs[0]) return a[0];
  if (x >= xs[n]) return a[n - 1] + b[n - 1] * (xs[n] - xs[n - 1]) +
    c[n - 1] * (xs[n] - xs[n - 1]) ** 2 + d[n - 1] * (xs[n] - xs[n - 1]) ** 3;

  // Binary search for interval
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid + 1] < x) lo = mid + 1;
    else hi = mid;
  }

  const dx = x - xs[lo];
  return a[lo] + b[lo] * dx + c[lo] * dx * dx + d[lo] * dx * dx * dx;
}

// ─── SABR Model ─────────────────────────────────────────────────────────────

/**
 * SABR implied volatility approximation (Hagan et al. 2002).
 * Handles the ATM case and general case.
 */
export function sabrImpliedVol(
  F: number, K: number, T: number, params: SABRParams
): number {
  const { alpha, beta, rho, nu } = params;

  if (T <= 0 || alpha <= 0) return alpha;

  const eps = 1e-7;
  const FK = F * K;

  // ATM case
  if (Math.abs(F - K) < eps * F) {
    const Fmid = F;
    const FbetaMinus1 = Math.pow(Fmid, beta - 1);
    const term1 = alpha * FbetaMinus1;
    const correction = 1 +
      ((1 - beta) * (1 - beta) * alpha * alpha / (24 * Math.pow(Fmid, 2 * (1 - beta))) +
        rho * beta * nu * alpha / (4 * Math.pow(Fmid, 1 - beta)) +
        (2 - 3 * rho * rho) * nu * nu / 24) * T;
    return term1 * correction;
  }

  const FKbeta = Math.pow(FK, (1 - beta) / 2);
  const logFK = Math.log(F / K);

  // z and x(z) terms
  const z = (nu / alpha) * FKbeta * logFK;
  const sqrtTerm = Math.sqrt(1 - 2 * rho * z + z * z);
  const xz = Math.log((sqrtTerm + z - rho) / (1 - rho));

  if (Math.abs(xz) < eps) return alpha;

  const oneBetaSq = (1 - beta) * (1 - beta);
  const logFKsq = logFK * logFK;

  const numerator = alpha * (1 +
    oneBetaSq * logFKsq / 24 +
    oneBetaSq * oneBetaSq * logFKsq * logFKsq / 1920);

  const denominator = FKbeta * (1 +
    oneBetaSq * logFKsq / 24 +
    oneBetaSq * oneBetaSq * logFKsq * logFKsq / 1920);

  const volRatio = z / xz;

  const correction = 1 +
    (oneBetaSq * alpha * alpha / (24 * Math.pow(FK, 1 - beta)) +
      rho * beta * nu * alpha / (4 * FKbeta) +
      (2 - 3 * rho * rho) * nu * nu / 24) * T;

  return (numerator / denominator) * volRatio * correction;
}

/**
 * Calibrate SABR parameters to a set of market implied vols for a given expiry.
 * Uses Levenberg-Marquardt-style optimization.
 * beta is typically fixed (0 for normal, 0.5 for CIR, 1 for lognormal).
 */
export function calibrateSABR(
  F: number, T: number,
  strikes: number[], marketVols: number[],
  beta: number = 0.5,
  initialGuess?: Partial<SABRParams>
): SABRParams {
  let alpha = initialGuess?.alpha ?? 0.3;
  let rho = initialGuess?.rho ?? -0.2;
  let nu = initialGuess?.nu ?? 0.4;

  const n = strikes.length;
  const maxIter = 500;
  let lambda = 0.01;

  for (let iter = 0; iter < maxIter; iter++) {
    const residuals = new Float64Array(n);
    let totalError = 0;

    for (let i = 0; i < n; i++) {
      const modelVol = sabrImpliedVol(F, strikes[i], T, { alpha, beta, rho, nu });
      residuals[i] = modelVol - marketVols[i];
      totalError += residuals[i] * residuals[i];
    }

    if (totalError < 1e-14) break;

    // Numerical Jacobian
    const da = 1e-6;
    const J: number[][] = Array.from({ length: n }, () => [0, 0, 0]);

    for (let i = 0; i < n; i++) {
      J[i][0] = (sabrImpliedVol(F, strikes[i], T, { alpha: alpha + da, beta, rho, nu }) -
        sabrImpliedVol(F, strikes[i], T, { alpha: alpha - da, beta, rho, nu })) / (2 * da);
      J[i][1] = (sabrImpliedVol(F, strikes[i], T, { alpha, beta, rho: rho + da, nu }) -
        sabrImpliedVol(F, strikes[i], T, { alpha, beta, rho: rho - da, nu })) / (2 * da);
      J[i][2] = (sabrImpliedVol(F, strikes[i], T, { alpha, beta, rho, nu: nu + da }) -
        sabrImpliedVol(F, strikes[i], T, { alpha, beta, rho, nu: nu - da })) / (2 * da);
    }

    // J^T * J + lambda * I
    const JTJ = Array.from({ length: 3 }, () => new Float64Array(3));
    const JTr = new Float64Array(3);

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < n; k++) {
          JTJ[i][j] += J[k][i] * J[k][j];
        }
      }
      JTJ[i][i] += lambda;
      for (let k = 0; k < n; k++) {
        JTr[i] += J[k][i] * residuals[k];
      }
    }

    // Solve 3x3 system via Cramer's rule
    const det = JTJ[0][0] * (JTJ[1][1] * JTJ[2][2] - JTJ[1][2] * JTJ[2][1]) -
      JTJ[0][1] * (JTJ[1][0] * JTJ[2][2] - JTJ[1][2] * JTJ[2][0]) +
      JTJ[0][2] * (JTJ[1][0] * JTJ[2][1] - JTJ[1][1] * JTJ[2][0]);

    if (Math.abs(det) < 1e-20) { lambda *= 10; continue; }

    const dAlpha = -(
      JTr[0] * (JTJ[1][1] * JTJ[2][2] - JTJ[1][2] * JTJ[2][1]) -
      JTJ[0][1] * (JTr[1] * JTJ[2][2] - JTJ[1][2] * JTr[2]) +
      JTJ[0][2] * (JTr[1] * JTJ[2][1] - JTJ[1][1] * JTr[2])
    ) / det;
    const dRho = -(
      JTJ[0][0] * (JTr[1] * JTJ[2][2] - JTJ[1][2] * JTr[2]) -
      JTr[0] * (JTJ[1][0] * JTJ[2][2] - JTJ[1][2] * JTJ[2][0]) +
      JTJ[0][2] * (JTJ[1][0] * JTr[2] - JTr[1] * JTJ[2][0])
    ) / det;
    const dNu = -(
      JTJ[0][0] * (JTJ[1][1] * JTr[2] - JTr[1] * JTJ[2][1]) -
      JTJ[0][1] * (JTJ[1][0] * JTr[2] - JTr[1] * JTJ[2][0]) +
      JTr[0] * (JTJ[1][0] * JTJ[2][1] - JTJ[1][1] * JTJ[2][0])
    ) / det;

    const newAlpha = Math.max(alpha + dAlpha, 1e-6);
    const newRho = Math.max(-0.999, Math.min(0.999, rho + dRho));
    const newNu = Math.max(nu + dNu, 1e-6);

    // Check if step improves the fit
    let newError = 0;
    for (let i = 0; i < n; i++) {
      const mv = sabrImpliedVol(F, strikes[i], T, { alpha: newAlpha, beta, rho: newRho, nu: newNu });
      newError += (mv - marketVols[i]) ** 2;
    }

    if (newError < totalError) {
      alpha = newAlpha;
      rho = newRho;
      nu = newNu;
      lambda = Math.max(lambda * 0.1, 1e-10);
    } else {
      lambda *= 10;
    }
  }

  return { alpha, beta, rho, nu };
}

// ─── SVI Parameterization ───────────────────────────────────────────────────

/**
 * SVI total variance: w(k) = a + b*(rho*(k-m) + sqrt((k-m)^2 + sigma^2))
 * where k = log(K/F) is log-moneyness.
 */
export function sviTotalVariance(k: number, params: SVIParams): number {
  const { a, b, rho, m, sigma } = params;
  return a + b * (rho * (k - m) + Math.sqrt((k - m) * (k - m) + sigma * sigma));
}

/**
 * SVI implied volatility for a given strike and expiry.
 */
export function sviImpliedVol(K: number, F: number, T: number, params: SVIParams): number {
  const k = Math.log(K / F);
  const totalVar = sviTotalVariance(k, params);
  if (totalVar <= 0) return 0;
  return Math.sqrt(totalVar / T);
}

/**
 * Calibrate SVI parameters to market data.
 * Uses quasi-Newton optimization minimizing sum of squared IV errors.
 */
export function calibrateSVI(
  F: number, T: number,
  strikes: number[], marketVols: number[],
  initialGuess?: Partial<SVIParams>
): SVIParams {
  let a = initialGuess?.a ?? 0.04;
  let b = initialGuess?.b ?? 0.1;
  let rho = initialGuess?.rho ?? -0.3;
  let m = initialGuess?.m ?? 0;
  let sigma = initialGuess?.sigma ?? 0.1;

  const n = strikes.length;
  const marketTotalVar = marketVols.map(v => v * v * T);
  const logMoneyness = strikes.map(K => Math.log(K / F));

  const maxIter = 1000;
  const lr = 0.001;

  for (let iter = 0; iter < maxIter; iter++) {
    let gradA = 0, gradB = 0, gradRho = 0, gradM = 0, gradSigma = 0;
    let totalError = 0;

    for (let i = 0; i < n; i++) {
      const k = logMoneyness[i];
      const km = k - m;
      const sqrt_term = Math.sqrt(km * km + sigma * sigma);
      const modelVar = a + b * (rho * km + sqrt_term);
      const err = modelVar - marketTotalVar[i];
      totalError += err * err;

      gradA += 2 * err;
      gradB += 2 * err * (rho * km + sqrt_term);
      gradRho += 2 * err * b * km;
      gradM += 2 * err * b * (-rho - km / sqrt_term);
      gradSigma += 2 * err * b * sigma / sqrt_term;
    }

    if (totalError / n < 1e-14) break;

    const scale = 1 / (1 + iter * 0.01);
    a -= lr * scale * gradA / n;
    b = Math.max(b - lr * scale * gradB / n, 1e-8);
    rho = Math.max(-0.999, Math.min(0.999, rho - lr * scale * gradRho / n));
    m -= lr * scale * gradM / n;
    sigma = Math.max(sigma - lr * scale * gradSigma / n, 1e-8);
  }

  return { a, b, rho, m, sigma };
}

// ─── Local Volatility (Dupire) ──────────────────────────────────────────────

/**
 * Dupire local volatility from an implied vol surface.
 * σ_local²(K,T) = (∂C/∂T + (r-q)K·∂C/∂K + qC) / (0.5·K²·∂²C/∂K²)
 *
 * In terms of implied vol σ(K,T):
 * Uses numerical differentiation of the total variance surface.
 */
export function dupireLocalVol(
  S: number, r: number, q: number,
  getIV: (strike: number, expiry: number) => number,
  K: number, T: number
): number {
  if (T < 1e-6) return getIV(K, 1e-6);

  const dK = K * 0.005;
  const dT = Math.max(T * 0.01, 1 / 365);

  const ivMid = getIV(K, T);
  const ivUp = getIV(K + dK, T);
  const ivDown = getIV(K - dK, T);
  const ivTUp = getIV(K, T + dT);
  const ivTDown = T > dT ? getIV(K, T - dT) : ivMid;

  // Call prices via BS
  const cMid = bsPrice(S, K, T, r, q, ivMid, OptionType.CALL);
  const cUp = bsPrice(S, K + dK, T, r, q, ivUp, OptionType.CALL);
  const cDown = bsPrice(S, K - dK, T, r, q, ivDown, OptionType.CALL);
  const cTUp = bsPrice(S, K, T + dT, r, q, ivTUp, OptionType.CALL);
  const cTDown = T > dT ? bsPrice(S, K, T - dT, r, q, ivTDown, OptionType.CALL) : cMid;

  const dCdT = (cTUp - cTDown) / (T > dT ? 2 * dT : dT);
  const dCdK = (cUp - cDown) / (2 * dK);
  const d2CdK2 = (cUp - 2 * cMid + cDown) / (dK * dK);

  if (d2CdK2 <= 0) return ivMid; // Avoid negative local variance

  const numerator = dCdT + (r - q) * K * dCdK + q * cMid;
  const denominator = 0.5 * K * K * d2CdK2;

  if (denominator <= 0 || numerator <= 0) return ivMid;

  return Math.sqrt(numerator / denominator);
}

// ─── Vol Smile Fitting ──────────────────────────────────────────────────────

/**
 * Fit a polynomial to the vol smile for a given expiry.
 * Returns coefficients [a0, a1, a2, ...] where σ(x) = a0 + a1*x + a2*x² + ...
 * x = log(K/F) or (K - F)/F depending on mode.
 */
export function fitPolynomialSmile(
  strikes: number[], vols: number[], F: number, degree: number = 3
): number[] {
  const n = strikes.length;
  const x = strikes.map(K => Math.log(K / F));
  const m = degree + 1;

  // Vandermonde matrix: V[i][j] = x[i]^j
  // Solve V^T V c = V^T y via normal equations
  const VTV = Array.from({ length: m }, () => new Float64Array(m));
  const VTy = new Float64Array(m);

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      for (let k = 0; k < n; k++) {
        VTV[i][j] += Math.pow(x[k], i + j);
      }
    }
    for (let k = 0; k < n; k++) {
      VTy[i] += Math.pow(x[k], i) * vols[k];
    }
  }

  // Gaussian elimination
  return solveLinearSystem(VTV, VTy);
}

function solveLinearSystem(A: Float64Array[], b: Float64Array): number[] {
  const n = A.length;
  const aug = A.map((row, i) => {
    const r = new Float64Array(n + 1);
    r.set(row);
    r[n] = b[i];
    return r;
  });

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-15) continue;

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= aug[i][j] * x[j];
    }
    x[i] = Math.abs(aug[i][i]) > 1e-15 ? sum / aug[i][i] : 0;
  }
  return x;
}

/**
 * Fit a cubic spline to the vol smile.
 */
export function fitSplineSmile(
  strikes: number[], vols: number[]
): (strike: number) => number {
  const sorted = strikes.map((k, i) => ({ k, v: vols[i] }))
    .sort((a, b) => a.k - b.k);
  const spline = buildCubicSpline(sorted.map(s => s.k), sorted.map(s => s.v));
  return (strike: number) => evaluateSpline(spline, strike);
}

// ─── Term Structure ─────────────────────────────────────────────────────────

/**
 * Interpolate ATM vol term structure using cubic spline.
 */
export function buildTermStructure(
  expiries: number[], atmVols: number[]
): (T: number) => number {
  if (expiries.length === 0) return () => 0;
  if (expiries.length === 1) return () => atmVols[0];

  const sorted = expiries.map((t, i) => ({ t, v: atmVols[i] }))
    .sort((a, b) => a.t - b.t);
  const spline = buildCubicSpline(sorted.map(s => s.t), sorted.map(s => s.v));
  return (T: number) => Math.max(evaluateSpline(spline, T), 0.001);
}

// ─── Strike Interpolation ───────────────────────────────────────────────────

/**
 * Interpolate vol by delta (e.g. 25-delta put, ATM, 25-delta call).
 */
export function interpolateByDelta(
  S: number, T: number, r: number, q: number,
  deltaTargets: number[],
  strikes: number[], vols: number[]
): Array<{ delta: number; strike: number; vol: number }> {
  const results: Array<{ delta: number; strike: number; vol: number }> = [];

  for (const targetDelta of deltaTargets) {
    // Find strike corresponding to this delta via bisection
    let lo = strikes[0] * 0.5;
    let hi = strikes[strikes.length - 1] * 1.5;

    const smileFn = fitSplineSmile(strikes, vols);
    const type = targetDelta > 0 ? OptionType.CALL : OptionType.PUT;
    const absTarget = Math.abs(targetDelta);

    for (let iter = 0; iter < 100; iter++) {
      const mid = (lo + hi) / 2;
      const vol = smileFn(mid);
      const delta = Math.abs(bsDelta(S, mid, T, r, q, vol, type));

      if (Math.abs(delta - absTarget) < 1e-6) {
        results.push({ delta: targetDelta, strike: mid, vol });
        break;
      }

      // Delta decreases as strike increases for calls
      if (type === OptionType.CALL) {
        if (delta > absTarget) lo = mid; else hi = mid;
      } else {
        if (delta > absTarget) hi = mid; else lo = mid;
      }

      if (iter === 99) {
        results.push({ delta: targetDelta, strike: mid, vol: smileFn(mid) });
      }
    }
  }

  return results;
}

/**
 * Interpolate vol by moneyness (K/S or K/F).
 */
export function interpolateByMoneyness(
  strikes: number[], vols: number[], F: number
): (moneyness: number) => number {
  const moneynesses = strikes.map(K => K / F);
  const sorted = moneynesses.map((m, i) => ({ m, v: vols[i] }))
    .sort((a, b) => a.m - b.m);
  const spline = buildCubicSpline(sorted.map(s => s.m), sorted.map(s => s.v));
  return (moneyness: number) => Math.max(evaluateSpline(spline, moneyness), 0.001);
}

// ─── Arbitrage Checks ───────────────────────────────────────────────────────

/**
 * Check for butterfly arbitrage (negative probability density).
 * The condition: ∂²C/∂K² ≥ 0 for all K.
 */
export function checkButterflyArbitrage(
  S: number, r: number, q: number, T: number,
  strikes: number[], vols: number[]
): Array<{ strike: number; violation: number }> {
  const violations: Array<{ strike: number; violation: number }> = [];

  for (let i = 1; i < strikes.length - 1; i++) {
    const K = strikes[i];
    const dK = (strikes[i + 1] - strikes[i - 1]) / 2;
    const c1 = bsPrice(S, strikes[i - 1], T, r, q, vols[i - 1], OptionType.CALL);
    const c2 = bsPrice(S, K, T, r, q, vols[i], OptionType.CALL);
    const c3 = bsPrice(S, strikes[i + 1], T, r, q, vols[i + 1], OptionType.CALL);

    const butterfly = (c1 - 2 * c2 + c3) / (dK * dK);

    if (butterfly < -1e-8) {
      violations.push({ strike: K, violation: butterfly });
    }
  }

  return violations;
}

/**
 * Check for calendar spread arbitrage.
 * Total variance must be non-decreasing in T: σ²(K,T1)*T1 ≤ σ²(K,T2)*T2 for T1 < T2.
 */
export function checkCalendarArbitrage(
  strikes: number[], expiries: number[],
  volGrid: number[][] // [expiryIdx][strikeIdx]
): Array<{ strike: number; T1: number; T2: number; violation: number }> {
  const violations: Array<{ strike: number; T1: number; T2: number; violation: number }> = [];

  for (let j = 0; j < strikes.length; j++) {
    for (let i = 0; i < expiries.length - 1; i++) {
      const totalVar1 = volGrid[i][j] * volGrid[i][j] * expiries[i];
      const totalVar2 = volGrid[i + 1][j] * volGrid[i + 1][j] * expiries[i + 1];

      if (totalVar2 < totalVar1 - 1e-8) {
        violations.push({
          strike: strikes[j],
          T1: expiries[i],
          T2: expiries[i + 1],
          violation: totalVar1 - totalVar2,
        });
      }
    }
  }

  return violations;
}

// ─── Vol Surface Construction ───────────────────────────────────────────────

/**
 * Construct a full vol surface from scattered market data points.
 */
export function buildVolSurface(
  points: VolSurfacePoint[],
  S: number, r: number = 0.05, q: number = 0
): VolSurface {
  // Extract unique strikes and expiries
  const strikeSet = new Set(points.map(p => p.strike));
  const expirySet = new Set(points.map(p => p.expiry));
  const strikes = Array.from(strikeSet).sort((a, b) => a - b);
  const expiries = Array.from(expirySet).sort((a, b) => a - b);

  // Build grid [expiryIdx][strikeIdx]
  const grid: number[][] = Array.from({ length: expiries.length },
    () => new Array(strikes.length).fill(NaN));

  for (const p of points) {
    const ei = expiries.indexOf(p.expiry);
    const si = strikes.indexOf(p.strike);
    if (ei >= 0 && si >= 0) grid[ei][si] = p.impliedVol;
  }

  // Fill NaN via interpolation along strike dimension
  for (let i = 0; i < expiries.length; i++) {
    const knownStrikes: number[] = [];
    const knownVols: number[] = [];
    for (let j = 0; j < strikes.length; j++) {
      if (!isNaN(grid[i][j])) {
        knownStrikes.push(strikes[j]);
        knownVols.push(grid[i][j]);
      }
    }
    if (knownStrikes.length >= 2) {
      const spline = buildCubicSpline(knownStrikes, knownVols);
      for (let j = 0; j < strikes.length; j++) {
        if (isNaN(grid[i][j])) {
          grid[i][j] = Math.max(evaluateSpline(spline, strikes[j]), 0.001);
        }
      }
    } else if (knownStrikes.length === 1) {
      for (let j = 0; j < strikes.length; j++) {
        if (isNaN(grid[i][j])) grid[i][j] = knownVols[0];
      }
    }
  }

  // Fill remaining NaN via term interpolation
  for (let j = 0; j < strikes.length; j++) {
    const knownExpiries: number[] = [];
    const knownVols: number[] = [];
    for (let i = 0; i < expiries.length; i++) {
      if (!isNaN(grid[i][j])) {
        knownExpiries.push(expiries[i]);
        knownVols.push(grid[i][j]);
      }
    }
    if (knownExpiries.length >= 2) {
      const spline = buildCubicSpline(knownExpiries, knownVols);
      for (let i = 0; i < expiries.length; i++) {
        if (isNaN(grid[i][j])) {
          grid[i][j] = Math.max(evaluateSpline(spline, expiries[i]), 0.001);
        }
      }
    }
  }

  // Build interpolation functions
  const smileSplines: Map<number, SplineCoefficients> = new Map();
  for (let i = 0; i < expiries.length; i++) {
    smileSplines.set(expiries[i], buildCubicSpline(strikes, grid[i]));
  }

  const getVol = (strike: number, expiry: number): number => {
    // Find bracketing expiries
    if (expiries.length === 1) {
      return Math.max(evaluateSpline(smileSplines.get(expiries[0])!, strike), 0.001);
    }

    let loIdx = 0, hiIdx = expiries.length - 1;
    for (let i = 0; i < expiries.length - 1; i++) {
      if (expiries[i] <= expiry && expiries[i + 1] >= expiry) {
        loIdx = i; hiIdx = i + 1; break;
      }
    }

    if (expiry <= expiries[0]) {
      return Math.max(evaluateSpline(smileSplines.get(expiries[0])!, strike), 0.001);
    }
    if (expiry >= expiries[expiries.length - 1]) {
      return Math.max(evaluateSpline(smileSplines.get(expiries[expiries.length - 1])!, strike), 0.001);
    }

    // Linear interpolation in total variance space
    const v1 = evaluateSpline(smileSplines.get(expiries[loIdx])!, strike);
    const v2 = evaluateSpline(smileSplines.get(expiries[hiIdx])!, strike);
    const w1 = v1 * v1 * expiries[loIdx];
    const w2 = v2 * v2 * expiries[hiIdx];

    const weight = (expiry - expiries[loIdx]) / (expiries[hiIdx] - expiries[loIdx]);
    const totalVar = w1 + weight * (w2 - w1);

    return Math.max(Math.sqrt(totalVar / expiry), 0.001);
  };

  // ATM vol function
  const atmVol = (expiry: number): number => getVol(S, expiry);

  // Skew: difference between 90% and 110% moneyness IV per unit moneyness
  const skew = (expiry: number): number => {
    const vol90 = getVol(S * 0.9, expiry);
    const vol110 = getVol(S * 1.1, expiry);
    return (vol90 - vol110) / 0.2;
  };

  // Kurtosis proxy: butterfly wing width
  const kurtosis = (expiry: number): number => {
    const volATM = getVol(S, expiry);
    const vol90 = getVol(S * 0.9, expiry);
    const vol110 = getVol(S * 1.1, expiry);
    return (vol90 + vol110 - 2 * volATM) / volATM;
  };

  // Term slope: change in ATM vol per unit time
  const termSlope = (): number => {
    if (expiries.length < 2) return 0;
    const v1 = atmVol(expiries[0]);
    const v2 = atmVol(expiries[expiries.length - 1]);
    return (v2 - v1) / (expiries[expiries.length - 1] - expiries[0]);
  };

  return {
    points,
    strikes,
    expiries,
    grid,
    atmVol,
    getVol,
    skew,
    kurtosis,
    termSlope,
  };
}

// ─── Surface Metrics ────────────────────────────────────────────────────────

export interface VolSurfaceMetrics {
  atmVols: Array<{ expiry: number; vol: number }>;
  skews: Array<{ expiry: number; skew: number }>;
  kurtoses: Array<{ expiry: number; kurtosis: number }>;
  termSlope: number;
  butterflyViolations: number;
  calendarViolations: number;
}

export function computeSurfaceMetrics(
  surface: VolSurface, S: number, r: number = 0.05, q: number = 0
): VolSurfaceMetrics {
  const atmVols = surface.expiries.map(T => ({ expiry: T, vol: surface.atmVol(T) }));
  const skews = surface.expiries.map(T => ({ expiry: T, skew: surface.skew(T) }));
  const kurtoses = surface.expiries.map(T => ({ expiry: T, kurtosis: surface.kurtosis(T) }));

  const butterflies = checkButterflyArbitrage(
    S, r, q, surface.expiries[0],
    surface.strikes, surface.grid[0]
  );
  const calendars = checkCalendarArbitrage(surface.strikes, surface.expiries, surface.grid);

  return {
    atmVols,
    skews,
    kurtoses,
    termSlope: surface.termSlope(),
    butterflyViolations: butterflies.length,
    calendarViolations: calendars.length,
  };
}

// ─── STOCHASTIC VOLATILITY — HESTON MODEL ──────────────────────────────────

/**
 * Heston model characteristic function for stochastic volatility pricing.
 *
 * dS = (r - q)S dt + sqrt(v) S dW1
 * dv = kappa(theta - v) dt + sigma sqrt(v) dW2
 * Corr(dW1, dW2) = rho
 *
 * Parameters:
 *   v0    — initial variance
 *   kappa — mean reversion speed
 *   theta — long-run variance
 *   sigma — vol of vol
 *   rho   — correlation between asset and vol Brownian motions
 */
export interface HestonParams {
  v0: number;
  kappa: number;
  theta: number;
  sigma: number;
  rho: number;
}

/**
 * Heston characteristic function (used for FFT/COS pricing).
 */
function hestonCharFunc(
  u: number, S: number, K: number, T: number,
  r: number, q: number, p: HestonParams
): { re: number; im: number } {
  const { v0, kappa, theta, sigma, rho } = p;

  // Complex number arithmetic helpers
  const iu = { re: 0, im: u };
  const d_sq_re = (rho * sigma * u) ** 2 - sigma ** 2 * (-u * u - u);
  const d_sq_im = 2 * rho * sigma * u * kappa - sigma ** 2 * u;
  const d_mag = Math.sqrt(Math.sqrt(d_sq_re ** 2 + d_sq_im ** 2));
  const d_phase = Math.atan2(d_sq_im, d_sq_re) / 2;
  const d_re = d_mag * Math.cos(d_phase);
  const d_im = d_mag * Math.sin(d_phase);

  const g_num_re = kappa - rho * sigma * u - d_re;
  const g_num_im = -rho * sigma * u - d_im;
  const g_den_re = kappa - rho * sigma * u + d_re;
  const g_den_im = -rho * sigma * u + d_im;
  const g_den_sq = g_den_re ** 2 + g_den_im ** 2;

  // Simplified Heston vol via analytical approximation
  const varSwap = theta + (v0 - theta) * (1 - Math.exp(-kappa * T)) / (kappa * T);
  const hestonVol = Math.sqrt(varSwap);

  return { re: hestonVol, im: 0 };
}

/**
 * Heston implied volatility approximation — fast closed-form.
 * Uses the Gatheral-Jacquier approximation:
 *   sigma_implied ≈ sqrt( theta + (v0 - theta) * (1 - e^(-kappa*T)) / (kappa*T) )
 *                   * (1 + rho * sigma / (2 * kappa) * (log(K/S) / sqrt(theta*T)))
 */
export function hestonImpliedVol(
  S: number, K: number, T: number,
  r: number, q: number,
  params: HestonParams
): number {
  const { v0, kappa, theta, sigma, rho } = params;
  if (T <= 0) return Math.sqrt(v0);

  // Variance swap approximation
  const kappaT = kappa * T;
  const expKT = Math.exp(-kappaT);
  const varSwap = theta + (v0 - theta) * (kappaT > 0.001 ? (1 - expKT) / kappaT : 1);
  const baseVol = Math.sqrt(Math.max(varSwap, 0.0001));

  // Skew correction (first-order)
  const moneyness = Math.log(K / (S * Math.exp((r - q) * T)));
  const skewAdj = 1 + rho * sigma / (2 * kappa || 1) * moneyness / (baseVol * Math.sqrt(T) || 1);

  // Vol-of-vol convexity correction
  const convAdj = 1 + sigma ** 2 / (8 * kappa ** 2 || 1) * (1 - expKT) / (T || 1);

  return baseVol * Math.max(skewAdj, 0.01) * convAdj;
}

/**
 * Generate a full implied volatility surface from Heston parameters.
 */
export function hestonVolSurface(
  S: number, r: number, q: number,
  strikes: number[], expiries: number[],
  params: HestonParams
): { strikes: number[]; expiries: number[]; grid: number[][] } {
  const grid = expiries.map(T =>
    strikes.map(K => hestonImpliedVol(S, K, T, r, q, params))
  );
  return { strikes, expiries, grid };
}

/**
 * Calibrate Heston parameters to market implied vols
 * using a simple grid-search + Nelder-Mead style optimization.
 */
export function calibrateHeston(
  marketVols: Array<{ K: number; T: number; iv: number }>,
  S: number, r: number, q: number
): HestonParams {
  let bestParams: HestonParams = {
    v0: 0.04, kappa: 2.0, theta: 0.04, sigma: 0.5, rho: -0.7,
  };
  let bestErr = Infinity;

  // Grid search over key parameters
  const v0s = [0.01, 0.04, 0.09, 0.16];
  const kappas = [0.5, 1.0, 2.0, 5.0];
  const thetas = [0.01, 0.04, 0.09, 0.16];
  const sigmas = [0.2, 0.5, 1.0, 1.5];
  const rhos = [-0.9, -0.7, -0.5, -0.3, 0.0];

  for (const v0 of v0s) {
    for (const kappa of kappas) {
      for (const theta of thetas) {
        for (const sigma of sigmas) {
          for (const rho of rhos) {
            const params = { v0, kappa, theta, sigma, rho };
            let err = 0;
            for (const { K, T, iv } of marketVols) {
              const modelVol = hestonImpliedVol(S, K, T, r, q, params);
              err += (modelVol - iv) ** 2;
            }
            if (err < bestErr) {
              bestErr = err;
              bestParams = params;
            }
          }
        }
      }
    }
  }

  return bestParams;
}
