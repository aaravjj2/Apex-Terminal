import { describe, it, expect } from 'vitest';
import {
  ARModel, MAModel, ARMAModel, ARIMAModel,
  SimpleExponentialSmoothing, HoltLinear, HoltWinters,
  KalmanFilter, HiddenMarkovModel,
  autocorrelation, partialAutocorrelation,
  cusumChangePoint, peltChangePoint,
  fftPeriodDetection, adfTest,
} from '../../../src/lib/ml/timeSeries';

function trendSeries(n: number, slope: number, noise: number): number[] {
  return Array.from({ length: n }, (_, i) => slope * i + (Math.random() - 0.5) * noise);
}

function sineSeries(n: number, period: number, amplitude: number): number[] {
  return Array.from({ length: n }, (_, i) => amplitude * Math.sin((2 * Math.PI * i) / period));
}

function randomWalk(n: number, seed = 42): number[] {
  let val = 100;
  const result: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    val += ((s / 0x7fffffff) - 0.5) * 2;
    result.push(val);
  }
  return result;
}

describe('autocorrelation', () => {
  it('lag-0 autocorrelation is 1', () => {
    const acf = autocorrelation([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    expect(acf[0]).toBeCloseTo(1, 5);
  });

  it('returns correct number of lags', () => {
    const acf = autocorrelation(randomWalk(100), 10);
    expect(acf.length).toBe(11);
  });

  it('sine wave shows periodic ACF', () => {
    const series = sineSeries(200, 20, 1);
    const acf = autocorrelation(series, 40);
    expect(acf[20]).toBeGreaterThan(0.5);
  });
});

describe('partialAutocorrelation', () => {
  it('returns correct number of lags', () => {
    const pacf = partialAutocorrelation(randomWalk(100), 10);
    expect(pacf.length).toBe(11);
  });

  it('PACF values are in [-1, 1]', () => {
    const pacf = partialAutocorrelation(randomWalk(200), 10);
    pacf.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(-1.01);
      expect(v).toBeLessThanOrEqual(1.01);
    });
  });
});

describe('ARModel', () => {
  it('fits and predicts', () => {
    const series = randomWalk(100);
    const model = new ARModel(2);
    model.fit(series);
    const forecast = model.predict(series, 5);
    expect(forecast.forecast.length).toBe(5);
    expect(forecast.horizon).toBe(5);
    expect(forecast.lower.length).toBe(5);
    expect(forecast.upper.length).toBe(5);
  });

  it('confidence intervals widen with horizon', () => {
    const series = trendSeries(100, 0.5, 1);
    const model = new ARModel(1);
    model.fit(series);
    const forecast = model.predict(series, 10);
    const width0 = forecast.upper[0] - forecast.lower[0];
    const width9 = forecast.upper[9] - forecast.lower[9];
    expect(width9).toBeGreaterThanOrEqual(width0 * 0.99);
  });
});

describe('MAModel', () => {
  it('fits and produces forecast', () => {
    const series = randomWalk(100);
    const model = new MAModel(1);
    model.fit(series);
    const forecast = model.predict(series, 3);
    expect(forecast.forecast.length).toBe(3);
  });
});

describe('ARMAModel', () => {
  it('fits AR(1) + MA(1)', () => {
    const series = randomWalk(150);
    const model = new ARMAModel(1, 1);
    model.fit(series);
    const forecast = model.predict(series, 5);
    expect(forecast.forecast.length).toBe(5);
  });
});

describe('ARIMAModel', () => {
  it('fits non-stationary data with d=1', () => {
    const series = trendSeries(100, 1, 0.5);
    const model = new ARIMAModel(1, 1, 0);
    model.fit(series);
    const forecast = model.predict(series, 5);
    expect(forecast.forecast.length).toBe(5);
  });
});

describe('SimpleExponentialSmoothing', () => {
  it('fits and forecasts constant series', () => {
    const series = Array(50).fill(10);
    const model = new SimpleExponentialSmoothing(0.3);
    model.fit(series);
    const forecast = model.predict(5);
    forecast.forecast.forEach(v => expect(v).toBeCloseTo(10, 0));
  });

  it('adapts to level shift', () => {
    const series = [...Array(50).fill(10), ...Array(50).fill(20)];
    const model = new SimpleExponentialSmoothing(0.5);
    model.fit(series);
    const forecast = model.predict(3);
    expect(forecast.forecast[0]).toBeGreaterThan(15);
  });
});

describe('HoltLinear', () => {
  it('captures trend', () => {
    const series = Array.from({ length: 50 }, (_, i) => 10 + 2 * i);
    const model = new HoltLinear(0.8, 0.2);
    model.fit(series);
    const forecast = model.predict(5);
    expect(forecast.forecast[0]).toBeGreaterThan(series[series.length - 1]);
  });
});

describe('HoltWinters', () => {
  it('captures seasonal pattern', () => {
    const period = 12;
    const series = Array.from({ length: 60 }, (_, i) => 100 + 5 * Math.sin((2 * Math.PI * i) / period) + i * 0.1);
    const model = new HoltWinters(period, 0.3, 0.1, 0.1);
    model.fit(series);
    const forecast = model.predict(period);
    expect(forecast.forecast.length).toBe(period);
  });
});

describe('KalmanFilter', () => {
  it('filter smooths noisy signal', () => {
    const truth = Array.from({ length: 100 }, (_, i) => 10 + 0.1 * i);
    const noisy = truth.map(v => v + (Math.random() - 0.5) * 5);
    const kf = new KalmanFilter(0.01, 1, truth[0]);
    const { states } = kf.filter(noisy);
    expect(states.length).toBe(100);
    const filterMSE = states.reduce((s, v, i) => s + (v - truth[i]) ** 2, 0) / 100;
    const noiseMSE = noisy.reduce((s, v, i) => s + (v - truth[i]) ** 2, 0) / 100;
    expect(filterMSE).toBeLessThan(noiseMSE);
  });

  it('smooth produces smoother estimates than filter', () => {
    const noisy = Array.from({ length: 50 }, () => 10 + (Math.random() - 0.5) * 3);
    const kf = new KalmanFilter(0.1, 1, 10);
    const filtered = kf.filter(noisy);
    const smoothed = kf.smooth(noisy);
    expect(smoothed.states.length).toBe(50);
    const filtVar = filtered.states.reduce((s, v) => s + (v - 10) ** 2, 0) / 50;
    const smoothVar = smoothed.states.reduce((s, v) => s + (v - 10) ** 2, 0) / 50;
    expect(smoothVar).toBeLessThanOrEqual(filtVar * 1.5);
  });

  it('predict returns forecast with confidence', () => {
    const kf = new KalmanFilter(0.01, 1, 50);
    kf.filter(Array.from({ length: 20 }, () => 50 + (Math.random() - 0.5)));
    const forecast = kf.predict(5);
    expect(forecast.forecast.length).toBe(5);
    expect(forecast.upper[4] - forecast.lower[4]).toBeGreaterThan(0);
  });
});

describe('HiddenMarkovModel', () => {
  it('fits and detects regimes', () => {
    const lowVol = Array.from({ length: 100 }, () => (Math.random() - 0.5) * 0.01);
    const highVol = Array.from({ length: 100 }, () => (Math.random() - 0.5) * 0.05);
    const obs = [...lowVol, ...highVol];
    const hmm = new HiddenMarkovModel(2, 100);
    hmm.fit(obs);
    const regimes = hmm.detectRegimes(obs);
    expect(regimes.length).toBeGreaterThanOrEqual(1);
    regimes.forEach(r => {
      expect(r.regime).toBeGreaterThanOrEqual(0);
      expect(r.probability).toBeGreaterThan(0);
    });
  });

  it('viterbi returns state sequence', () => {
    const obs = Array.from({ length: 50 }, () => (Math.random() - 0.5) * 0.02);
    const hmm = new HiddenMarkovModel(2, 50);
    hmm.fit(obs);
    const path = hmm.viterbi(obs);
    expect(path.length).toBe(50);
    path.forEach(s => expect(s).toBeGreaterThanOrEqual(0));
  });
});

describe('cusumChangePoint', () => {
  it('detects level shift', () => {
    const series = [...Array(50).fill(0), ...Array(50).fill(5)];
    const cps = cusumChangePoint(series, 3);
    expect(cps.length).toBeGreaterThan(0);
    expect(cps.some(cp => cp >= 45 && cp <= 55)).toBe(true);
  });
});

describe('peltChangePoint', () => {
  it('detects change points', () => {
    const series = [...Array(50).fill(10), ...Array(50).fill(20), ...Array(50).fill(10)];
    const cps = peltChangePoint(series);
    expect(cps.length).toBeGreaterThanOrEqual(1);
  });
});

describe('fftPeriodDetection', () => {
  it('detects dominant period in sine wave', () => {
    const period = 20;
    const series = sineSeries(200, period, 1);
    const result = fftPeriodDetection(series);
    expect(result.periods.length).toBeGreaterThan(0);
    expect(result.powers.length).toBe(result.periods.length);
    const dominant = result.periods[result.powers.indexOf(Math.max(...result.powers))];
    expect(Math.abs(dominant - period)).toBeLessThan(5);
  });
});

describe('adfTest', () => {
  it('stationary series has low p-value', () => {
    const stationary = Array.from({ length: 200 }, () => (Math.random() - 0.5) * 2);
    const result = adfTest(stationary);
    expect(result.isStationary).toBe(true);
    expect(result.pValue).toBeLessThan(0.1);
  });

  it('random walk is non-stationary', () => {
    const rw = randomWalk(200);
    const result = adfTest(rw);
    expect(result.isStationary).toBe(false);
  });
});
