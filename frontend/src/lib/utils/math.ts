// ============================================================================
// Matrix Operations
// ============================================================================

export type Matrix = number[][];

export function matrixCreate(rows: number, cols: number, fill = 0): Matrix {
  return Array.from({ length: rows }, () => Array(cols).fill(fill));
}

export function matrixIdentity(n: number): Matrix {
  const m = matrixCreate(n, n);
  for (let i = 0; i < n; i++) m[i][i] = 1;
  return m;
}

export function matrixMultiply(a: Matrix, b: Matrix): Matrix {
  const rows = a.length, cols = b[0].length, inner = b.length;
  const result = matrixCreate(rows, cols);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      for (let k = 0; k < inner; k++)
        result[i][j] += a[i][k] * b[k][j];
  return result;
}

export function matrixTranspose(m: Matrix): Matrix {
  const rows = m.length, cols = m[0].length;
  const result = matrixCreate(cols, rows);
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      result[j][i] = m[i][j];
  return result;
}

export function matrixAdd(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}

export function matrixScale(m: Matrix, s: number): Matrix {
  return m.map(row => row.map(v => v * s));
}

export function matrixDeterminant(m: Matrix): number {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];

  let det = 0;
  for (let j = 0; j < n; j++) {
    const minor = m.slice(1).map(row => [...row.slice(0, j), ...row.slice(j + 1)]);
    det += (j % 2 === 0 ? 1 : -1) * m[0][j] * matrixDeterminant(minor);
  }
  return det;
}

export function matrixLU(m: Matrix): { L: Matrix; U: Matrix; P: number[] } {
  const n = m.length;
  const L = matrixCreate(n, n);
  const U = m.map(row => [...row]);
  const P = Array.from({ length: n }, (_, i) => i);

  for (let k = 0; k < n; k++) {
    let maxVal = 0, maxIdx = k;
    for (let i = k; i < n; i++) {
      if (Math.abs(U[i][k]) > maxVal) {
        maxVal = Math.abs(U[i][k]);
        maxIdx = i;
      }
    }
    if (maxIdx !== k) {
      [U[k], U[maxIdx]] = [U[maxIdx], U[k]];
      [L[k], L[maxIdx]] = [L[maxIdx], L[k]];
      [P[k], P[maxIdx]] = [P[maxIdx], P[k]];
    }
    for (let i = k + 1; i < n; i++) {
      L[i][k] = U[i][k] / U[k][k];
      for (let j = k; j < n; j++) {
        U[i][j] -= L[i][k] * U[k][j];
      }
    }
  }
  for (let i = 0; i < n; i++) L[i][i] = 1;
  return { L, U, P };
}

export function matrixInverse(m: Matrix): Matrix {
  const n = m.length;
  const aug = m.map((row, i) => {
    const ext = Array(n).fill(0);
    ext[i] = 1;
    return [...row, ...ext];
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) throw new Error('Singular matrix');
    for (let j = col; j < 2 * n; j++) aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = col; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map(row => row.slice(n));
}

export function matrixCholesky(m: Matrix): Matrix {
  const n = m.length;
  const L = matrixCreate(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      L[i][j] = i === j
        ? Math.sqrt(m[i][i] - sum)
        : (m[i][j] - sum) / L[j][j];
    }
  }
  return L;
}

export function matrixEigenvaluesQR(m: Matrix, iterations = 100): number[] {
  let A = m.map(row => [...row]);
  const n = A.length;

  for (let iter = 0; iter < iterations; iter++) {
    const { Q, R } = qrDecomposition(A);
    A = matrixMultiply(R, Q);

    let offDiag = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (i !== j) offDiag += A[i][j] * A[i][j];
    if (Math.sqrt(offDiag) < 1e-10) break;
  }
  return A.map((row, i) => row[i]);
}

function qrDecomposition(m: Matrix): { Q: Matrix; R: Matrix } {
  const n = m.length;
  let Q = matrixIdentity(n);
  let R = m.map(row => [...row]);

  for (let j = 0; j < n - 1; j++) {
    const x: number[] = [];
    for (let i = j; i < n; i++) x.push(R[i][j]);

    const normX = Math.sqrt(x.reduce((s, v) => s + v * v, 0));
    if (normX < 1e-12) continue;

    const v = [...x];
    v[0] += Math.sign(x[0] || 1) * normX;
    const normV = Math.sqrt(v.reduce((s, val) => s + val * val, 0));
    for (let i = 0; i < v.length; i++) v[i] /= normV;

    for (let col = j; col < n; col++) {
      let dot = 0;
      for (let i = 0; i < v.length; i++) dot += v[i] * R[j + i][col];
      for (let i = 0; i < v.length; i++) R[j + i][col] -= 2 * v[i] * dot;
    }

    for (let row = 0; row < n; row++) {
      let dot = 0;
      for (let i = 0; i < v.length; i++) dot += Q[row][j + i] * v[i];
      for (let i = 0; i < v.length; i++) Q[row][j + i] -= 2 * dot * v[i];
    }
  }
  return { Q, R };
}

export function matrixSVD(m: Matrix): { U: Matrix; S: number[]; V: Matrix } {
  const mt = matrixTranspose(m);
  const ata = matrixMultiply(mt, m);
  const singularValuesSquared = matrixEigenvaluesQR(ata);
  const S = singularValuesSquared.map(v => Math.sqrt(Math.max(0, v)));

  const n = ata.length;
  let V = matrixIdentity(n);
  let A = ata.map(r => [...r]);
  for (let iter = 0; iter < 100; iter++) {
    const { Q, R } = qrDecomposition(A);
    A = matrixMultiply(R, Q);
    V = matrixMultiply(V, Q);
    let offDiag = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (i !== j) offDiag += A[i][j] * A[i][j];
    if (Math.sqrt(offDiag) < 1e-10) break;
  }

  const U = matrixCreate(m.length, m.length);
  for (let i = 0; i < S.length; i++) {
    if (S[i] > 1e-10) {
      const col: number[] = [];
      for (let r = 0; r < m.length; r++) {
        let sum = 0;
        for (let c = 0; c < m[0].length; c++) sum += m[r][c] * V[c][i];
        col.push(sum / S[i]);
      }
      for (let r = 0; r < m.length; r++) U[r][i] = col[r];
    }
  }
  return { U, S, V };
}

// ============================================================================
// Statistical Functions
// ============================================================================

export function mean(data: number[]): number {
  return data.reduce((s, v) => s + v, 0) / data.length;
}

export function median(data: number[]): number {
  const sorted = [...data].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mode(data: number[]): number[] {
  const freq = new Map<number, number>();
  for (const v of data) freq.set(v, (freq.get(v) || 0) + 1);
  const maxFreq = Math.max(...freq.values());
  return [...freq.entries()].filter(([, f]) => f === maxFreq).map(([v]) => v);
}

export function variance(data: number[], population = false): number {
  const m = mean(data);
  const sumSq = data.reduce((s, v) => s + (v - m) ** 2, 0);
  return sumSq / (data.length - (population ? 0 : 1));
}

export function stdDev(data: number[], population = false): number {
  return Math.sqrt(variance(data, population));
}

export function skewness(data: number[]): number {
  const n = data.length, m = mean(data), s = stdDev(data);
  if (s === 0) return 0;
  const sum = data.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * sum;
}

export function kurtosis(data: number[]): number {
  const n = data.length, m = mean(data), s = stdDev(data);
  if (s === 0) return 0;
  const sum = data.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
  const excess = ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum
    - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
  return excess;
}

export function covariance(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y);
  const n = Math.min(x.length, y.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (x[i] - mx) * (y[i] - my);
  return sum / (n - 1);
}

export function correlation(x: number[], y: number[]): number {
  const cov = covariance(x, y);
  const sx = stdDev(x), sy = stdDev(y);
  return sx === 0 || sy === 0 ? 0 : cov / (sx * sy);
}

export function percentile(data: number[], p: number): number {
  const sorted = [...data].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function quantile(data: number[], q: number): number {
  return percentile(data, q * 100);
}

export function iqr(data: number[]): number {
  return percentile(data, 75) - percentile(data, 25);
}

export function mad(data: number[]): number {
  const m = median(data);
  return median(data.map(v => Math.abs(v - m)));
}

export function weightedMean(values: number[], weights: number[]): number {
  let sumWV = 0, sumW = 0;
  for (let i = 0; i < values.length; i++) {
    sumWV += values[i] * weights[i];
    sumW += weights[i];
  }
  return sumWV / sumW;
}

export function exponentialMovingAverage(data: number[], span: number): number[] {
  const alpha = 2 / (span + 1);
  const result = [data[0]];
  for (let i = 1; i < data.length; i++)
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  return result;
}

export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = x.length;
  const mx = mean(x), my = mean(y);
  let ssXY = 0, ssXX = 0, ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (x[i] - mx) * (y[i] - my);
    ssXX += (x[i] - mx) ** 2;
  }
  const slope = ssXY / ssXX;
  const intercept = my - slope * mx;
  for (let i = 0; i < n; i++) {
    const pred = slope * x[i] + intercept;
    ssTot += (y[i] - my) ** 2;
    ssRes += (y[i] - pred) ** 2;
  }
  return { slope, intercept, r2: 1 - ssRes / ssTot };
}

// ============================================================================
// Interpolation
// ============================================================================

export function linearInterpolation(x0: number, y0: number, x1: number, y1: number, x: number): number {
  return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

export function cubicSpline(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length - 1;
  const h = xs.map((_, i) => i < n ? xs[i + 1] - xs[i] : 0);
  const alpha = Array(n + 1).fill(0);
  for (let i = 1; i < n; i++)
    alpha[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);

  const l = Array(n + 1).fill(1);
  const mu = Array(n + 1).fill(0);
  const z = Array(n + 1).fill(0);
  for (let i = 1; i < n; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  const b = Array(n).fill(0), c = Array(n + 1).fill(0), d = Array(n).fill(0);
  for (let j = n - 1; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  return (x: number) => {
    let i = 0;
    for (let j = 0; j < n; j++) {
      if (x >= xs[j] && x <= xs[j + 1]) { i = j; break; }
    }
    const dx = x - xs[i];
    return ys[i] + b[i] * dx + c[i] * dx ** 2 + d[i] * dx ** 3;
  };
}

export function lagrangeInterpolation(xs: number[], ys: number[], x: number): number {
  let result = 0;
  for (let i = 0; i < xs.length; i++) {
    let basis = ys[i];
    for (let j = 0; j < xs.length; j++) {
      if (i !== j) basis *= (x - xs[j]) / (xs[i] - xs[j]);
    }
    result += basis;
  }
  return result;
}

export function newtonInterpolation(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  const dd: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) dd[i][0] = ys[i];
  for (let j = 1; j < n; j++)
    for (let i = 0; i < n - j; i++)
      dd[i][j] = (dd[i + 1][j - 1] - dd[i][j - 1]) / (xs[i + j] - xs[i]);

  let result = dd[0][0], product = 1;
  for (let j = 1; j < n; j++) {
    product *= x - xs[j - 1];
    result += dd[0][j] * product;
  }
  return result;
}

// ============================================================================
// Numerical Methods
// ============================================================================

export function newtonRaphson(
  f: (x: number) => number,
  df: (x: number) => number,
  x0: number,
  tol = 1e-10,
  maxIter = 100
): number {
  let x = x0;
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x), dfx = df(x);
    if (Math.abs(dfx) < 1e-15) throw new Error('Derivative near zero');
    const xNext = x - fx / dfx;
    if (Math.abs(xNext - x) < tol) return xNext;
    x = xNext;
  }
  return x;
}

export function bisection(
  f: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-10,
  maxIter = 100
): number {
  let lo = a, hi = b;
  if (f(lo) * f(hi) > 0) throw new Error('f(a) and f(b) must have opposite signs');
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    if (Math.abs(f(mid)) < tol || (hi - lo) / 2 < tol) return mid;
    if (f(lo) * f(mid) < 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

export function secantMethod(
  f: (x: number) => number,
  x0: number,
  x1: number,
  tol = 1e-10,
  maxIter = 100
): number {
  let xPrev = x0, xCurr = x1;
  for (let i = 0; i < maxIter; i++) {
    const fPrev = f(xPrev), fCurr = f(xCurr);
    if (Math.abs(fCurr) < tol) return xCurr;
    const xNext = xCurr - fCurr * (xCurr - xPrev) / (fCurr - fPrev);
    xPrev = xCurr;
    xCurr = xNext;
  }
  return xCurr;
}

export function brentMethod(
  f: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-12,
  maxIter = 100
): number {
  let fa = f(a), fb = f(b);
  if (fa * fb > 0) throw new Error('Root not bracketed');
  if (Math.abs(fa) < Math.abs(fb)) { [a, b] = [b, a]; [fa, fb] = [fb, fa]; }

  let c = a, fc = fa, d = b - a, e = d;
  for (let i = 0; i < maxIter; i++) {
    if (fb === 0 || Math.abs(b - a) < tol) return b;
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b; b = c; c = a;
      fa = fb; fb = fc; fc = fa;
    }
    const tolM = 2 * Number.EPSILON * Math.abs(b) + tol;
    const m = 0.5 * (c - b);
    if (Math.abs(m) <= tolM || fb === 0) return b;

    if (Math.abs(e) >= tolM && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number, q: number;
      if (a === c) {
        p = 2 * m * s;
        q = 1 - s;
      } else {
        const r = fb / fc;
        q = fa / fc;
        p = s * (2 * m * q * (q - r) - (b - a) * (r - 1));
        q = (q - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q; else p = -p;
      if (2 * p < Math.min(3 * m * q - Math.abs(tolM * q), Math.abs(e * q))) {
        e = d; d = p / q;
      } else { d = m; e = m; }
    } else { d = m; e = m; }

    a = b; fa = fb;
    b += Math.abs(d) > tolM ? d : (m > 0 ? tolM : -tolM);
    fb = f(b);
    if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) { c = a; fc = fa; e = d = b - a; }
  }
  return b;
}

export function gradientDescent(
  gradient: (x: number[]) => number[],
  x0: number[],
  learningRate = 0.01,
  tol = 1e-8,
  maxIter = 10000
): number[] {
  let x = [...x0];
  for (let i = 0; i < maxIter; i++) {
    const grad = gradient(x);
    let normSq = 0;
    for (let j = 0; j < x.length; j++) {
      x[j] -= learningRate * grad[j];
      normSq += grad[j] ** 2;
    }
    if (Math.sqrt(normSq) < tol) break;
  }
  return x;
}

// ============================================================================
// Numerical Integration
// ============================================================================

export function trapezoidalIntegration(f: (x: number) => number, a: number, b: number, n = 1000): number {
  const h = (b - a) / n;
  let sum = 0.5 * (f(a) + f(b));
  for (let i = 1; i < n; i++) sum += f(a + i * h);
  return sum * h;
}

export function simpsonsIntegration(f: (x: number) => number, a: number, b: number, n = 1000): number {
  if (n % 2 !== 0) n++;
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
  return (sum * h) / 3;
}

const GL_NODES_5 = [-0.9061798, -0.5384693, 0, 0.5384693, 0.9061798];
const GL_WEIGHTS_5 = [0.2369269, 0.4786287, 0.5688889, 0.4786287, 0.2369269];

export function gaussLegendreIntegration(f: (x: number) => number, a: number, b: number): number {
  const mid = (a + b) / 2, half = (b - a) / 2;
  let sum = 0;
  for (let i = 0; i < 5; i++)
    sum += GL_WEIGHTS_5[i] * f(mid + half * GL_NODES_5[i]);
  return sum * half;
}

// ============================================================================
// Random Number Generation
// ============================================================================

export class MersenneTwister {
  private mt: number[] = new Array(624);
  private mti = 625;

  constructor(seed?: number) {
    this.seed(seed ?? Date.now());
  }

  seed(s: number): void {
    this.mt[0] = s >>> 0;
    for (this.mti = 1; this.mti < 624; this.mti++) {
      const prev = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
      this.mt[this.mti] = ((1812433253 * ((prev & 0xffff0000) >>> 16)) << 16)
        + 1812433253 * (prev & 0x0000ffff) + this.mti;
      this.mt[this.mti] >>>= 0;
    }
  }

  next(): number {
    let y: number;
    const mag01 = [0, 0x9908b0df];

    if (this.mti >= 624) {
      let kk: number;
      for (kk = 0; kk < 227; kk++) {
        y = (this.mt[kk] & 0x80000000) | (this.mt[kk + 1] & 0x7fffffff);
        this.mt[kk] = this.mt[kk + 397] ^ (y >>> 1) ^ mag01[y & 1];
      }
      for (; kk < 623; kk++) {
        y = (this.mt[kk] & 0x80000000) | (this.mt[kk + 1] & 0x7fffffff);
        this.mt[kk] = this.mt[kk - 227] ^ (y >>> 1) ^ mag01[y & 1];
      }
      y = (this.mt[623] & 0x80000000) | (this.mt[0] & 0x7fffffff);
      this.mt[623] = this.mt[396] ^ (y >>> 1) ^ mag01[y & 1];
      this.mti = 0;
    }

    y = this.mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return (y >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export function boxMullerNormal(rng?: () => number): { z0: number; z1: number } {
  const random = rng ?? Math.random;
  const u1 = random(), u2 = random();
  const r = Math.sqrt(-2 * Math.log(u1));
  return { z0: r * Math.cos(2 * Math.PI * u2), z1: r * Math.sin(2 * Math.PI * u2) };
}

export function randomExponential(lambda: number, rng?: () => number): number {
  return -Math.log(1 - (rng ?? Math.random)()) / lambda;
}

export function randomUniform(min: number, max: number, rng?: () => number): number {
  return min + (rng ?? Math.random)() * (max - min);
}

export class SobolSequence {
  private dimension: number;
  private count = 0;
  private x: number[];
  private directions: number[][];

  constructor(dimension: number) {
    this.dimension = dimension;
    this.x = Array(dimension).fill(0);
    this.directions = Array.from({ length: dimension }, () => {
      const dirs = Array(32).fill(0);
      for (let i = 0; i < 32; i++) dirs[i] = 1 << (31 - i);
      return dirs;
    });
  }

  next(): number[] {
    if (this.count === 0) { this.count++; return Array(this.dimension).fill(0); }
    let c = 0;
    let val = this.count;
    while ((val & 1) !== 0) { val >>= 1; c++; }
    const result: number[] = [];
    for (let i = 0; i < this.dimension; i++) {
      this.x[i] ^= this.directions[i][c];
      result.push(this.x[i] / 2147483648);
    }
    this.count++;
    return result;
  }
}

// ============================================================================
// Special Functions & Distributions
// ============================================================================

export function gammaFunction(z: number): number {
  if (z <= 0 && z === Math.floor(z)) return Infinity;
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFunction(1 - z));
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

export function logGamma(z: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = z, tmp = z + 5.5;
  tmp -= (z + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / z);
}

export function betaFunction(a: number, b: number): number {
  return Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b));
}

export function incompleteBeta(x: number, a: number, b: number): number {
  if (x === 0 || x === 1) return x;
  if (x > (a + 1) / (a + b + 2)) return 1 - incompleteBeta(1 - x, b, a);

  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b)
    + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(lbeta) / a;

  let f = 1, c = 1, d = 1;
  for (let i = 0; i <= 200; i++) {
    const m = Math.floor(i / 2);
    let num: number;
    if (i === 0) num = 1;
    else if (i % 2 === 0) num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else num = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));

    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= c * d;
    if (Math.abs(c * d - 1) < 1e-10) break;
  }
  return front * (f - 1);
}

export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

export function erfc(x: number): number {
  return 1 - erf(x);
}

export function normalPDF(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

export function normalCDF(x: number, mu = 0, sigma = 1): number {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2,
    -2.759285104469687e2, 1.383577518672690e2,
    -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2,
    -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1,
    -2.400758277161838e0, -2.549732539343734e0,
    4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

  const pLow = 0.02425, pHigh = 1 - pLow;
  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
      / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

export function tDistributionCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  return 1 - 0.5 * incompleteBeta(x, df / 2, 0.5);
}

export function chiSquaredCDF(x: number, k: number): number {
  if (x <= 0) return 0;
  return regularizedGammaP(k / 2, x / 2);
}

export function fDistributionCDF(x: number, d1: number, d2: number): number {
  if (x <= 0) return 0;
  const z = (d1 * x) / (d1 * x + d2);
  return incompleteBeta(z, d1 / 2, d2 / 2);
}

function regularizedGammaP(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a, term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-10 * Math.abs(sum)) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  let f = 1, c = 1, d = 1 / (x + 1 - a);
  f = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    const bn = x + 2 * i + 1 - a;
    d = bn + an * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = bn + an / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= c * d;
    if (Math.abs(c * d - 1) < 1e-10) break;
  }
  return 1 - f * Math.exp(-x + a * Math.log(x) - logGamma(a));
}
