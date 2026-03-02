// ─── Message Protocol ───────────────────────────────────────────────────────

interface TickData {
  time: number;
  price: number;
  volume: number;
  side?: 'buy' | 'sell';
}

interface BarData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CorporateAction {
  type: 'split' | 'dividend' | 'merger';
  exDate: number;
  ratio?: number;
  amount?: number;
  newSymbol?: string;
}

interface FuturesContract {
  symbol: string;
  expiry: number;
  bars: BarData[];
}

interface DataQualityReport {
  totalBars: number;
  missingBars: number;
  duplicateBars: number;
  outlierBars: number;
  gapCount: number;
  completeness: number;
  issues: { type: string; time: number; description: string }[];
}

interface InboundMessage {
  type: 'aggregate' | 'clean' | 'adjust' | 'continuous_futures' | 'process' | 'cancel';
  taskId: string;
  ticks?: TickData[];
  bars?: BarData[];
  intervalMs?: number;
  actions?: CorporateAction[];
  contracts?: FuturesContract[];
  rollMethod?: 'ratio' | 'difference' | 'volume';
  rollDaysBefore?: number;
  options?: {
    removeOutliers?: boolean;
    fillGaps?: boolean;
    fillMethod?: 'forward' | 'interpolate' | 'skip';
    outlierStdDev?: number;
    dedup?: boolean;
  };
}

interface OutboundMessage {
  type: 'result' | 'error' | 'progress' | 'ready' | 'partial';
  taskId: string;
  data?: unknown;
  error?: string;
  progress?: number;
}

// ─── Tick to Bar Aggregation ────────────────────────────────────────────────

function aggregateTicks(ticks: TickData[], intervalMs: number, progressCb: (p: number) => void): BarData[] {
  if (!ticks.length || intervalMs <= 0) return [];

  const sorted = [...ticks].sort((a, b) => a.time - b.time);
  const bars: BarData[] = [];
  let bucketStart = Math.floor(sorted[0].time / intervalMs) * intervalMs;
  let open = sorted[0].price;
  let high = sorted[0].price;
  let low = sorted[0].price;
  let close = sorted[0].price;
  let volume = sorted[0].volume;

  for (let i = 1; i < sorted.length; i++) {
    const tick = sorted[i];
    const tickBucket = Math.floor(tick.time / intervalMs) * intervalMs;

    if (tickBucket !== bucketStart) {
      bars.push({ time: bucketStart, open, high, low, close, volume });

      const gapBuckets = (tickBucket - bucketStart) / intervalMs;
      for (let g = 1; g < gapBuckets; g++) {
        bars.push({
          time: bucketStart + g * intervalMs,
          open: close, high: close, low: close, close, volume: 0,
        });
      }

      bucketStart = tickBucket;
      open = tick.price;
      high = tick.price;
      low = tick.price;
      close = tick.price;
      volume = tick.volume;
    } else {
      high = Math.max(high, tick.price);
      low = Math.min(low, tick.price);
      close = tick.price;
      volume += tick.volume;
    }

    if (i % Math.max(1, Math.floor(sorted.length / 50)) === 0) {
      progressCb(i / sorted.length);
    }
  }

  bars.push({ time: bucketStart, open, high, low, close, volume });
  return bars;
}

// ─── Data Cleaning & Validation ─────────────────────────────────────────────

function cleanAndValidate(
  bars: BarData[],
  options: {
    removeOutliers?: boolean;
    fillGaps?: boolean;
    fillMethod?: 'forward' | 'interpolate' | 'skip';
    outlierStdDev?: number;
    dedup?: boolean;
  },
): { bars: BarData[]; report: DataQualityReport } {
  const issues: { type: string; time: number; description: string }[] = [];
  let cleaned = [...bars].sort((a, b) => a.time - b.time);

  if (options.dedup !== false) {
    const seen = new Set<number>();
    const deduped: BarData[] = [];
    for (const bar of cleaned) {
      if (seen.has(bar.time)) {
        issues.push({ type: 'duplicate', time: bar.time, description: 'Duplicate timestamp removed' });
      } else {
        seen.add(bar.time);
        deduped.push(bar);
      }
    }
    cleaned = deduped;
  }

  const invalidBars: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const b = cleaned[i];
    if (b.open <= 0 || b.high <= 0 || b.low <= 0 || b.close <= 0) {
      issues.push({ type: 'invalid', time: b.time, description: 'Non-positive price' });
      invalidBars.push(i);
    } else if (b.high < b.low || b.high < b.open || b.high < b.close || b.low > b.open || b.low > b.close) {
      issues.push({ type: 'invalid', time: b.time, description: 'OHLC constraint violation' });
      cleaned[i] = { ...b, high: Math.max(b.open, b.high, b.low, b.close), low: Math.min(b.open, b.high, b.low, b.close) };
    }
  }

  cleaned = cleaned.filter((_, i) => !invalidBars.includes(i));

  if (options.removeOutliers && cleaned.length > 20) {
    const stdMult = options.outlierStdDev ?? 4;
    const closes = cleaned.map(b => b.close);
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push(closes[i - 1] > 0 ? (closes[i] - closes[i - 1]) / closes[i - 1] : 0);
    }
    const mean = returns.reduce((s, v) => s + v, 0) / returns.length;
    const std = Math.sqrt(returns.reduce((s, v) => s + (v - mean) ** 2, 0) / returns.length);
    const threshold = std * stdMult;

    const outlierIndices = new Set<number>();
    for (let i = 0; i < returns.length; i++) {
      if (Math.abs(returns[i] - mean) > threshold) {
        outlierIndices.add(i + 1);
        issues.push({ type: 'outlier', time: cleaned[i + 1].time, description: `Return ${(returns[i] * 100).toFixed(2)}% exceeds ${stdMult} std devs` });
      }
    }
    cleaned = cleaned.filter((_, i) => !outlierIndices.has(i));
  }

  let gapCount = 0;
  if (options.fillGaps && cleaned.length > 1) {
    const intervals: number[] = [];
    for (let i = 1; i < Math.min(100, cleaned.length); i++) {
      intervals.push(cleaned[i].time - cleaned[i - 1].time);
    }
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    if (medianInterval > 0) {
      const filled: BarData[] = [cleaned[0]];
      for (let i = 1; i < cleaned.length; i++) {
        const gap = cleaned[i].time - cleaned[i - 1].time;
        const missedBars = Math.round(gap / medianInterval) - 1;

        if (missedBars > 0 && missedBars < 100) {
          gapCount++;
          issues.push({ type: 'gap', time: cleaned[i - 1].time, description: `${missedBars} missing bars` });

          if (options.fillMethod === 'forward') {
            for (let g = 1; g <= missedBars; g++) {
              filled.push({
                time: cleaned[i - 1].time + g * medianInterval,
                open: cleaned[i - 1].close,
                high: cleaned[i - 1].close,
                low: cleaned[i - 1].close,
                close: cleaned[i - 1].close,
                volume: 0,
              });
            }
          } else if (options.fillMethod === 'interpolate') {
            for (let g = 1; g <= missedBars; g++) {
              const frac = g / (missedBars + 1);
              const price = cleaned[i - 1].close + (cleaned[i].open - cleaned[i - 1].close) * frac;
              filled.push({
                time: cleaned[i - 1].time + g * medianInterval,
                open: price, high: price, low: price, close: price, volume: 0,
              });
            }
          }
        }
        filled.push(cleaned[i]);
      }
      cleaned = filled;
    }
  }

  const report: DataQualityReport = {
    totalBars: bars.length,
    missingBars: gapCount,
    duplicateBars: issues.filter(i => i.type === 'duplicate').length,
    outlierBars: issues.filter(i => i.type === 'outlier').length,
    gapCount,
    completeness: bars.length > 0 ? cleaned.length / bars.length : 1,
    issues,
  };

  return { bars: cleaned, report };
}

// ─── Corporate Action Adjustments ───────────────────────────────────────────

function adjustForCorporateActions(bars: BarData[], actions: CorporateAction[]): BarData[] {
  const sorted = [...actions].sort((a, b) => b.exDate - a.exDate);
  let adjusted = bars.map(b => ({ ...b }));

  for (const action of sorted) {
    switch (action.type) {
      case 'split': {
        const ratio = action.ratio ?? 1;
        if (ratio <= 0 || ratio === 1) continue;
        adjusted = adjusted.map(bar => {
          if (bar.time < action.exDate) {
            return {
              ...bar,
              open: bar.open / ratio,
              high: bar.high / ratio,
              low: bar.low / ratio,
              close: bar.close / ratio,
              volume: bar.volume * ratio,
            };
          }
          return bar;
        });
        break;
      }
      case 'dividend': {
        const amount = action.amount ?? 0;
        if (amount <= 0) continue;
        adjusted = adjusted.map(bar => {
          if (bar.time < action.exDate) {
            const factor = 1 - amount / (bar.close + amount);
            return {
              ...bar,
              open: bar.open * factor,
              high: bar.high * factor,
              low: bar.low * factor,
              close: bar.close * factor,
            };
          }
          return bar;
        });
        break;
      }
    }
  }

  return adjusted;
}

// ─── Continuous Futures Construction ────────────────────────────────────────

function buildContinuousFutures(
  contracts: FuturesContract[],
  rollMethod: 'ratio' | 'difference' | 'volume',
  rollDaysBefore: number,
  progressCb: (p: number) => void,
): BarData[] {
  const sorted = [...contracts].sort((a, b) => a.expiry - b.expiry);
  if (!sorted.length) return [];
  if (sorted.length === 1) return sorted[0].bars;

  const continuous: BarData[] = [];
  let cumulativeAdjustment = rollMethod === 'difference' ? 0 : 1;

  for (let c = 0; c < sorted.length; c++) {
    const contract = sorted[c];
    const nextContract = sorted[c + 1];
    const rollDate = contract.expiry - rollDaysBefore * 86_400_000;

    for (const bar of contract.bars) {
      if (nextContract && bar.time >= rollDate) {
        const overlapBar = nextContract.bars.find(b => b.time === bar.time);
        if (overlapBar) {
          if (rollMethod === 'difference') {
            cumulativeAdjustment += overlapBar.close - bar.close;
          } else if (rollMethod === 'ratio' && bar.close > 0) {
            cumulativeAdjustment *= overlapBar.close / bar.close;
          }
          break;
        }
      }

      let adjusted: BarData;
      if (rollMethod === 'difference') {
        adjusted = {
          ...bar,
          open: bar.open + cumulativeAdjustment,
          high: bar.high + cumulativeAdjustment,
          low: bar.low + cumulativeAdjustment,
          close: bar.close + cumulativeAdjustment,
        };
      } else {
        adjusted = {
          ...bar,
          open: bar.open * cumulativeAdjustment,
          high: bar.high * cumulativeAdjustment,
          low: bar.low * cumulativeAdjustment,
          close: bar.close * cumulativeAdjustment,
        };
      }
      continuous.push(adjusted);
    }

    progressCb((c + 1) / sorted.length);
  }

  return continuous.sort((a, b) => a.time - b.time);
}

// ─── Large Dataset Processing ───────────────────────────────────────────────

function processLargeDataset(
  bars: BarData[],
  chunkSize: number,
  operation: (chunk: BarData[]) => BarData[],
  progressCb: (p: number) => void,
  isCancelled: () => boolean,
): BarData[] {
  const result: BarData[] = [];
  const totalChunks = Math.ceil(bars.length / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    if (isCancelled()) break;
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, bars.length);
    const chunk = bars.slice(start, end);
    result.push(...operation(chunk));
    progressCb((i + 1) / totalChunks);
  }

  return result;
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

  if (msg.type === 'cancel') {
    cancelledTasks.add(msg.taskId);
    return;
  }

  const progressCb = (p: number) => send({ type: 'progress', taskId: msg.taskId, progress: p });
  const isCancelled = () => cancelledTasks.has(msg.taskId);

  try {
    switch (msg.type) {
      case 'aggregate': {
        if (!msg.ticks?.length || !msg.intervalMs) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing ticks or interval' });
          return;
        }
        const bars = aggregateTicks(msg.ticks, msg.intervalMs, progressCb);
        send({ type: 'result', taskId: msg.taskId, data: { bars, count: bars.length } });
        return;
      }

      case 'clean': {
        if (!msg.bars?.length) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing bars data' });
          return;
        }
        const { bars, report } = cleanAndValidate(msg.bars, msg.options ?? {});
        send({ type: 'result', taskId: msg.taskId, data: { bars, report } });
        return;
      }

      case 'adjust': {
        if (!msg.bars?.length || !msg.actions?.length) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing bars or actions' });
          return;
        }
        const adjusted = adjustForCorporateActions(msg.bars, msg.actions);
        send({ type: 'result', taskId: msg.taskId, data: { bars: adjusted } });
        return;
      }

      case 'continuous_futures': {
        if (!msg.contracts?.length) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing contracts' });
          return;
        }
        const continuous = buildContinuousFutures(
          msg.contracts,
          msg.rollMethod ?? 'ratio',
          msg.rollDaysBefore ?? 5,
          progressCb,
        );
        send({ type: 'result', taskId: msg.taskId, data: { bars: continuous, contracts: msg.contracts.length } });
        return;
      }

      case 'process': {
        if (!msg.bars?.length) {
          send({ type: 'error', taskId: msg.taskId, error: 'Missing bars' });
          return;
        }
        const chunkSize = 10000;
        const identity = (chunk: BarData[]) => chunk;
        const processed = processLargeDataset(msg.bars, chunkSize, identity, progressCb, isCancelled);

        if (isCancelled()) {
          cancelledTasks.delete(msg.taskId);
          send({ type: 'error', taskId: msg.taskId, error: 'Cancelled' });
          return;
        }

        send({ type: 'result', taskId: msg.taskId, data: { bars: processed, count: processed.length } });
        return;
      }

      default:
        send({ type: 'error', taskId: msg.taskId, error: `Unknown message type: ${msg.type}` });
    }
  } catch (err) {
    send({ type: 'error', taskId: msg.taskId, error: (err as Error).message });
  }
};

send({ type: 'ready', taskId: '' });
