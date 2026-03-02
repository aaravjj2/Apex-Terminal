// ─── Message Protocol ───────────────────────────────────────────────────────

interface BarData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IndicatorConfig {
  type: string;
  params: Record<string, number | string | boolean>;
  inputField?: 'close' | 'open' | 'high' | 'low' | 'volume' | 'hl2' | 'hlc3' | 'ohlc4';
}

interface InboundMessage {
  type: 'calculate' | 'batch' | 'stream' | 'cancel';
  taskId: string;
  indicators?: IndicatorConfig[];
  bars?: BarData[];
  newBars?: BarData[];
}

interface OutboundMessage {
  type: 'result' | 'error' | 'progress' | 'ready';
  taskId: string;
  data?: unknown;
  error?: string;
  progress?: number;
}

// ─── Input Field Extraction ─────────────────────────────────────────────────

function extractField(bars: BarData[], field: string): number[] {
  switch (field) {
    case 'open': return bars.map(b => b.open);
    case 'high': return bars.map(b => b.high);
    case 'low': return bars.map(b => b.low);
    case 'volume': return bars.map(b => b.volume);
    case 'hl2': return bars.map(b => (b.high + b.low) / 2);
    case 'hlc3': return bars.map(b => (b.high + b.low + b.close) / 3);
    case 'ohlc4': return bars.map(b => (b.open + b.high + b.low + b.close) / 4);
    default: return bars.map(b => b.close);
  }
}

// ─── Indicator Implementations ──────────────────────────────────────────────

function sma(data: number[], period: number): number[] {
  const out = new Array(data.length).fill(NaN);
  if (period > data.length) return out;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(data: number[], period: number): number[] {
  const out = new Array(data.length).fill(NaN);
  if (period > data.length) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < data.length; i++) {
    prev = (data[i] - prev) * k + prev;
    out[i] = prev;
  }
  return out;
}

function rsi(data: number[], period: number): number[] {
  const out = new Array(data.length).fill(NaN);
  if (data.length < period + 1) return out;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function macd(data: number[], fast: number, slow: number, signal: number): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = ema(data, fast);
  const emaSlow = ema(data, slow);
  const macdLine = new Array(data.length).fill(NaN);
  for (let i = 0; i < data.length; i++) {
    if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) macdLine[i] = emaFast[i] - emaSlow[i];
  }
  const validMacd = macdLine.filter(v => !isNaN(v));
  const sigLine = ema(validMacd, signal);
  const fullSig = new Array(data.length).fill(NaN);
  let j = 0;
  for (let i = 0; i < data.length; i++) {
    if (!isNaN(macdLine[i])) {
      if (j < sigLine.length) fullSig[i] = sigLine[j];
      j++;
    }
  }
  const hist = new Array(data.length).fill(NaN);
  for (let i = 0; i < data.length; i++) {
    if (!isNaN(macdLine[i]) && !isNaN(fullSig[i])) hist[i] = macdLine[i] - fullSig[i];
  }
  return { macd: macdLine, signal: fullSig, histogram: hist };
}

function bollingerBands(data: number[], period: number, mult: number): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(data, period);
  const upper = new Array(data.length).fill(NaN);
  const lower = new Array(data.length).fill(NaN);
  for (let i = period - 1; i < data.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (data[j] - middle[i]) ** 2;
    const std = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + mult * std;
    lower[i] = middle[i] - mult * std;
  }
  return { upper, middle, lower };
}

function atr(bars: BarData[], period: number): number[] {
  const out = new Array(bars.length).fill(NaN);
  if (bars.length < 2) return out;
  const tr: number[] = [bars[0].high - bars[0].low];
  for (let i = 1; i < bars.length; i++) {
    tr.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    ));
  }
  let sum = 0;
  for (let i = 0; i < Math.min(period, tr.length); i++) sum += tr[i];
  out[period - 1] = sum / period;
  for (let i = period; i < tr.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

function stochastic(bars: BarData[], kPeriod: number, dPeriod: number): { k: number[]; d: number[] } {
  const k = new Array(bars.length).fill(NaN);
  for (let i = kPeriod - 1; i < bars.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hh = Math.max(hh, bars[j].high);
      ll = Math.min(ll, bars[j].low);
    }
    k[i] = hh !== ll ? ((bars[i].close - ll) / (hh - ll)) * 100 : 50;
  }
  const d = sma(k.map(v => (isNaN(v) ? 0 : v)), dPeriod);
  return { k, d };
}

function obv(bars: BarData[]): number[] {
  const out = new Array(bars.length).fill(0);
  if (!bars.length) return out;
  out[0] = bars[0].volume;
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].close > bars[i - 1].close) out[i] = out[i - 1] + bars[i].volume;
    else if (bars[i].close < bars[i - 1].close) out[i] = out[i - 1] - bars[i].volume;
    else out[i] = out[i - 1];
  }
  return out;
}

function vwap(bars: BarData[]): number[] {
  const out = new Array(bars.length).fill(NaN);
  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i < bars.length; i++) {
    const tp = (bars[i].high + bars[i].low + bars[i].close) / 3;
    cumPV += tp * bars[i].volume;
    cumVol += bars[i].volume;
    out[i] = cumVol > 0 ? cumPV / cumVol : tp;
  }
  return out;
}

function wma(data: number[], period: number): number[] {
  const out = new Array(data.length).fill(NaN);
  if (period > data.length) return out;
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - period + 1 + j] * (j + 1);
    out[i] = sum / denom;
  }
  return out;
}

// ─── Indicator Dispatch ─────────────────────────────────────────────────────

function calculateIndicator(
  indicator: IndicatorConfig,
  bars: BarData[],
): unknown {
  const data = extractField(bars, indicator.inputField ?? 'close');
  const p = indicator.params;

  switch (indicator.type) {
    case 'sma': return sma(data, (p.period as number) ?? 20);
    case 'ema': return ema(data, (p.period as number) ?? 20);
    case 'wma': return wma(data, (p.period as number) ?? 20);
    case 'rsi': return rsi(data, (p.period as number) ?? 14);
    case 'macd': return macd(data, (p.fast as number) ?? 12, (p.slow as number) ?? 26, (p.signal as number) ?? 9);
    case 'bollinger': return bollingerBands(data, (p.period as number) ?? 20, (p.multiplier as number) ?? 2);
    case 'atr': return atr(bars, (p.period as number) ?? 14);
    case 'stochastic': return stochastic(bars, (p.kPeriod as number) ?? 14, (p.dPeriod as number) ?? 3);
    case 'obv': return obv(bars);
    case 'vwap': return vwap(bars);
    default: throw new Error(`Unknown indicator type: ${indicator.type}`);
  }
}

// ─── Cancellation Tracking ──────────────────────────────────────────────────

const cancelledTasks = new Set<string>();

// ─── Message Handler ────────────────────────────────────────────────────────

const ctx = self as unknown as Worker;

function send(msg: OutboundMessage): void {
  ctx.postMessage(msg);
}

ctx.onmessage = (event: MessageEvent<InboundMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'cancel': {
      cancelledTasks.add(msg.taskId);
      return;
    }

    case 'calculate': {
      try {
        if (!msg.indicators?.length || !msg.bars?.length) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing indicators or bars data' });
          return;
        }
        const indicator = msg.indicators[0];
        const result = calculateIndicator(indicator, msg.bars);
        send({ type: 'result', taskId: msg.taskId, data: { indicator: indicator.type, values: result } });
      } catch (err) {
        send({ type: 'error', taskId: msg.taskId, error: (err as Error).message });
      }
      return;
    }

    case 'batch': {
      try {
        if (!msg.indicators?.length || !msg.bars?.length) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing indicators or bars data' });
          return;
        }
        const results: Record<string, unknown> = {};
        const total = msg.indicators.length;

        for (let i = 0; i < total; i++) {
          if (cancelledTasks.has(msg.taskId)) {
            cancelledTasks.delete(msg.taskId);
            send({ type: 'error', taskId: msg.taskId, error: 'Cancelled' });
            return;
          }

          const indicator = msg.indicators[i];
          const key = `${indicator.type}_${JSON.stringify(indicator.params)}`;
          results[key] = calculateIndicator(indicator, msg.bars!);

          if ((i + 1) % Math.max(1, Math.floor(total / 20)) === 0) {
            send({ type: 'progress', taskId: msg.taskId, progress: (i + 1) / total });
          }
        }

        send({ type: 'result', taskId: msg.taskId, data: results });
      } catch (err) {
        send({ type: 'error', taskId: msg.taskId, error: (err as Error).message });
      }
      return;
    }

    case 'stream': {
      try {
        if (!msg.indicators?.length || !msg.newBars?.length || !msg.bars?.length) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing data for streaming update' });
          return;
        }

        const allBars = [...msg.bars, ...msg.newBars];
        const results: Record<string, unknown> = {};

        for (const indicator of msg.indicators) {
          const key = `${indicator.type}_${JSON.stringify(indicator.params)}`;
          const fullResult = calculateIndicator(indicator, allBars) as number[];
          results[key] = Array.isArray(fullResult)
            ? fullResult.slice(-msg.newBars.length)
            : fullResult;
        }

        send({ type: 'result', taskId: msg.taskId, data: { streaming: true, results } });
      } catch (err) {
        send({ type: 'error', taskId: msg.taskId, error: (err as Error).message });
      }
      return;
    }
  }
};

send({ type: 'ready', taskId: '' });
