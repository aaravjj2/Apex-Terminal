/**
 * chart-types.ts — Chart Type Processors for OHLCV Data
 * ======================================================
 * Transforms OHLCV[] to renderable data for each chart type.
 * Each processor: (data: OHLCV[]) => RenderableData
 * All exports.
 */

// ─── BASE TYPES ──────────────────────────────────────────────────────────────

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RenderableCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  direction: 'up' | 'down';
  bodySize: number;
  upperWick: number;
  lowerWick: number;
  bodyTop: number;
  bodyBottom: number;
  [key: string]: number | string | undefined;
}

export interface RenderableLine {
  time: number;
  value: number;
  [key: string]: number | string | undefined;
}

export interface RenderableBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  [key: string]: number | string | undefined;
}

export interface VolumeProfileBin {
  price: number;
  volume: number;
  percent: number;
}

export interface VolumeProfileResult {
  bins: VolumeProfileBin[];
  vah: number;
  val: number;
  poc: number;
  totalVolume: number;
}

export interface FootprintCell {
  price: number;
  bidVolume: number;
  askVolume: number;
  delta: number;
  time: number;
}

export interface MarketProfileRow {
  price: number;
  volume: number;
  tpo: string;
  startTime: number;
  endTime: number;
}

// ─── CANDLESTICK ─────────────────────────────────────────────────────────────

export function Candlestick(data: OHLCV[]): RenderableCandle[] {
  if (!data.length) return [];
  return data.map(bar => {
    const direction: 'up' | 'down' = bar.close >= bar.open ? 'up' : 'down';
    const bodyTop = Math.max(bar.open, bar.close);
    const bodyBottom = Math.min(bar.open, bar.close);
    const bodySize = Math.abs(bar.close - bar.open);
    const upperWick = bar.high - bodyTop;
    const lowerWick = bodyBottom - bar.low;
    return {
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      direction,
      bodySize,
      upperWick,
      lowerWick,
      bodyTop,
      bodyBottom,
    };
  });
}

// ─── HEIKIN ASHI ────────────────────────────────────────────────────────────

export function HeikinAshi(data: OHLCV[]): RenderableCandle[] {
  if (!data.length) return [];
  const candles: RenderableCandle[] = [];
  let prevOpen = data[0].open;
  let prevClose = (data[0].open + data[0].high + data[0].low + data[0].close) / 4;

  for (let i = 0; i < data.length; i++) {
    const bar = data[i];
    const haClose = (bar.open + bar.high + bar.low + bar.close) / 4;
    const haOpen = i === 0 ? (bar.open + bar.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(bar.high, haOpen, haClose);
    const haLow = Math.min(bar.low, haOpen, haClose);
    const direction: 'up' | 'down' = haClose >= haOpen ? 'up' : 'down';
    const bodySize = Math.abs(haClose - haOpen);
    const bodyTop = Math.max(haOpen, haClose);
    const bodyBottom = Math.min(haOpen, haClose);
    const upperWick = haHigh - bodyTop;
    const lowerWick = bodyBottom - haLow;

    candles.push({
      time: bar.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: bar.volume,
      direction,
      bodySize,
      upperWick,
      lowerWick,
      bodyTop,
      bodyBottom,
    });

    prevOpen = haOpen;
    prevClose = haClose;
  }
  return candles;
}

// ─── HOLLOW CANDLES ──────────────────────────────────────────────────────────

export function HollowCandles(data: OHLCV[]): RenderableCandle[] {
  const candles = Candlestick(data);
  return candles.map(c => ({
    ...c,
    hollow: c.close > c.open,
  }));
}

// ─── LINE ────────────────────────────────────────────────────────────────────

export function Line(data: OHLCV[]): RenderableLine[] {
  return data.map(bar => ({
    time: bar.time,
    value: bar.close,
  }));
}

// ─── AREA ─────────────────────────────────────────────────────────────────────

export function Area(data: OHLCV[]): RenderableLine[] {
  return data.map(bar => ({
    time: bar.time,
    value: bar.close,
    baseline: 0,
  }));
}

// ─── BAR ─────────────────────────────────────────────────────────────────────

export function Bar(data: OHLCV[]): RenderableBar[] {
  return data.map(bar => ({
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    direction: bar.close >= bar.open ? 'up' : 'down',
  }));
}

// ─── RENKO ───────────────────────────────────────────────────────────────────

export interface RenkoBrick {
  time: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  direction: 'up' | 'down';
  brickIndex: number;
}

function computeATR(bars: OHLCV[], period: number): number {
  if (bars.length < 2) return 0;
  const tr: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    tr.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    ));
  }
  const n = Math.min(period, tr.length);
  let atr = tr.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < tr.length; i++) atr = (atr * (period - 1) + tr[i]) / period;
  return atr;
}

export function Renko(
  data: OHLCV[],
  brickSize?: number,
  useATR = false,
  atrPeriod = 14
): RenkoBrick[] {
  if (!data.length) return [];
  const size = useATR ? computeATR(data, atrPeriod) : (brickSize ?? 1);
  if (size <= 0) return [];

  const bricks: RenkoBrick[] = [];
  let refPrice = Math.round(data[0].close / size) * size;
  let accVol = 0;
  let sourceStart = data[0].time;

  for (let i = 0; i < data.length; i++) {
    const bar = data[i];
    accVol += bar.volume;
    const diff = bar.close - refPrice;
    const absDiff = Math.abs(diff);

    if (absDiff >= size) {
      const numBricks = Math.floor(absDiff / size);
      const direction: 'up' | 'down' = diff > 0 ? 'up' : 'down';
      const step = direction === 'up' ? size : -size;
      const volPerBrick = numBricks > 0 ? accVol / numBricks : accVol;

      for (let b = 0; b < numBricks; b++) {
        const open = refPrice + (direction === 'up' ? b * step : (b + 1) * step);
        const close = refPrice + (direction === 'up' ? (b + 1) * step : b * step);
        bricks.push({
          time: bar.time,
          open: direction === 'up' ? open : close,
          close: direction === 'up' ? close : open,
          high: Math.max(open, close, bar.high),
          low: Math.min(open, close, bar.low),
          volume: volPerBrick,
          direction,
          brickIndex: bricks.length,
        });
      }
      refPrice += numBricks * step;
      accVol = 0;
      sourceStart = bar.time;
    }
  }
  return bricks;
}

// ─── POINT AND FIGURE ────────────────────────────────────────────────────────

export interface PnFColumn {
  type: 'X' | 'O';
  startPrice: number;
  endPrice: number;
  boxes: number;
  startTime: number;
  endTime: number;
  columnIndex: number;
  volume: number;
}

function roundToBox(price: number, boxSize: number): number {
  return Math.round(price / boxSize) * boxSize;
}

export function PointAndFigure(
  data: OHLCV[],
  boxSize = 1,
  reversal = 3,
  method: 'close' | 'high-low' = 'close'
): PnFColumn[] {
  if (data.length < 2) return [];
  if (boxSize <= 0) return [];

  const reversalSize = boxSize * reversal;
  const columns: PnFColumn[] = [];
  let currentType: 'X' | 'O' | null = null;
  let colStart = roundToBox(data[0].close, boxSize);
  let colEnd = colStart;
  let colStartTime = data[0].time;
  let colEndTime = data[0].time;
  let colVolume = data[0].volume;

  const pushColumn = () => {
    if (currentType) {
      columns.push({
        type: currentType,
        startPrice: colStart,
        endPrice: colEnd,
        boxes: Math.round(Math.abs(colEnd - colStart) / boxSize),
        startTime: colStartTime,
        endTime: colEndTime,
        columnIndex: columns.length,
        volume: colVolume,
      });
    }
  };

  for (let i = 1; i < data.length; i++) {
    const bar = data[i];
    const high = method === 'close' ? bar.close : bar.high;
    const low = method === 'close' ? bar.close : bar.low;

    if (currentType === null) {
      const upMove = roundToBox(high, boxSize) - colStart;
      const downMove = colStart - roundToBox(low, boxSize);
      if (upMove >= boxSize) {
        currentType = 'X';
        colEnd = roundToBox(high, boxSize);
        colEndTime = bar.time;
        colVolume += bar.volume;
      } else if (downMove >= boxSize) {
        currentType = 'O';
        colEnd = roundToBox(low, boxSize);
        colEndTime = bar.time;
        colVolume += bar.volume;
      }
      continue;
    }

    if (currentType === 'X') {
      const newHigh = roundToBox(high, boxSize);
      if (newHigh > colEnd) {
        colEnd = newHigh;
        colEndTime = bar.time;
        colVolume += bar.volume;
      } else if (colEnd - roundToBox(low, boxSize) >= reversalSize) {
        pushColumn();
        currentType = 'O';
        colStart = colEnd - boxSize;
        colEnd = roundToBox(low, boxSize);
        colStartTime = bar.time;
        colEndTime = bar.time;
        colVolume = bar.volume;
      }
    } else {
      const newLow = roundToBox(low, boxSize);
      if (newLow < colEnd) {
        colEnd = newLow;
        colEndTime = bar.time;
        colVolume += bar.volume;
      } else if (roundToBox(high, boxSize) - colEnd >= reversalSize) {
        pushColumn();
        currentType = 'X';
        colStart = colEnd + boxSize;
        colEnd = roundToBox(high, boxSize);
        colStartTime = bar.time;
        colEndTime = bar.time;
        colVolume = bar.volume;
      }
    }
  }
  pushColumn();
  return columns;
}

// ─── KAGI ───────────────────────────────────────────────────────────────────

export interface KagiSegment {
  startPrice: number;
  endPrice: number;
  startTime: number;
  endTime: number;
  weight: 'yang' | 'yin';
  direction: 'up' | 'down';
  volume: number;
  segmentIndex: number;
}

export function Kagi(
  data: OHLCV[],
  reversalAmount = 4,
  reversalMode: 'fixed' | 'percentage' = 'percentage'
): KagiSegment[] {
  if (data.length < 2) return [];
  const segments: KagiSegment[] = [];
  let direction: 'up' | 'down' = data[1].close >= data[0].close ? 'up' : 'down';
  let segStart = data[0].close;
  let segEnd = data[0].close;
  let segStartTime = data[0].time;
  let segEndTime = data[0].time;
  let accVol = data[0].volume;
  let prevHigh = data[0].close;
  let prevLow = data[0].close;
  let weight: 'yang' | 'yin' = 'yang';

  const getReversal = (price: number) =>
    reversalMode === 'percentage' ? price * (reversalAmount / 100) : reversalAmount;

  const pushSegment = () => {
    segments.push({
      startPrice: segStart,
      endPrice: segEnd,
      startTime: segStartTime,
      endTime: segEndTime,
      weight,
      direction,
      volume: accVol,
      segmentIndex: segments.length,
    });
  };

  for (let i = 1; i < data.length; i++) {
    const price = data[i].close;
    const reversal = getReversal(segEnd);
    accVol += data[i].volume;

    if (direction === 'up') {
      if (price > segEnd) {
        segEnd = price;
        segEndTime = data[i].time;
        if (price > prevHigh) { weight = 'yang'; prevHigh = price; }
      } else if (segEnd - price >= reversal) {
        pushSegment();
        direction = 'down';
        segStart = segEnd;
        segStartTime = segEndTime;
        segEnd = price;
        segEndTime = data[i].time;
        accVol = data[i].volume;
        if (price < prevLow) { weight = 'yin'; prevLow = price; }
      }
    } else {
      if (price < segEnd) {
        segEnd = price;
        segEndTime = data[i].time;
        if (price < prevLow) { weight = 'yin'; prevLow = price; }
      } else if (price - segEnd >= reversal) {
        pushSegment();
        direction = 'up';
        segStart = segEnd;
        segStartTime = segEndTime;
        segEnd = price;
        segEndTime = data[i].time;
        accVol = data[i].volume;
        if (price > prevHigh) { weight = 'yang'; prevHigh = price; }
      }
    }
  }
  pushSegment();
  return segments;
}

// ─── LINE BREAK ──────────────────────────────────────────────────────────────

export interface LineBreakBlock {
  open: number;
  close: number;
  high: number;
  low: number;
  time: number;
  direction: 'up' | 'down';
  blockIndex: number;
  volume: number;
  isReversal: boolean;
}

export function LineBreak(data: OHLCV[], lineCount = 3): LineBreakBlock[] {
  if (data.length < 2) return [];
  const n = Math.max(1, lineCount);
  const blocks: LineBreakBlock[] = [];
  const firstDir: 'up' | 'down' = data[1].close >= data[0].close ? 'up' : 'down';
  blocks.push({
    open: data[0].close,
    close: data[1].close,
    high: Math.max(data[0].close, data[1].close),
    low: Math.min(data[0].close, data[1].close),
    time: data[1].time,
    direction: firstDir,
    blockIndex: 0,
    volume: data[0].volume + data[1].volume,
    isReversal: false,
  });

  for (let i = 2; i < data.length; i++) {
    const price = data[i].close;
    const lastBlock = blocks[blocks.length - 1];

    if (lastBlock.direction === 'up') {
      if (price > lastBlock.close) {
        blocks.push({
          open: lastBlock.close,
          close: price,
          high: price,
          low: lastBlock.close,
          time: data[i].time,
          direction: 'up',
          blockIndex: blocks.length,
          volume: data[i].volume,
          isReversal: false,
        });
      } else {
        const lookback = blocks.slice(-n);
        const lowestClose = Math.min(...lookback.map(b => Math.min(b.open, b.close)));
        if (price < lowestClose) {
          blocks.push({
            open: lastBlock.close,
            close: price,
            high: lastBlock.close,
            low: price,
            time: data[i].time,
            direction: 'down',
            blockIndex: blocks.length,
            volume: data[i].volume,
            isReversal: true,
          });
        }
      }
    } else {
      if (price < lastBlock.close) {
        blocks.push({
          open: lastBlock.close,
          close: price,
          high: lastBlock.close,
          low: price,
          time: data[i].time,
          direction: 'down',
          blockIndex: blocks.length,
          volume: data[i].volume,
          isReversal: false,
        });
      } else {
        const lookback = blocks.slice(-n);
        const highestClose = Math.max(...lookback.map(b => Math.max(b.open, b.close)));
        if (price > highestClose) {
          blocks.push({
            open: lastBlock.close,
            close: price,
            high: price,
            low: lastBlock.close,
            time: data[i].time,
            direction: 'up',
            blockIndex: blocks.length,
            volume: data[i].volume,
            isReversal: true,
          });
        }
      }
    }
  }
  return blocks;
}

// ─── RANGE BARS ──────────────────────────────────────────────────────────────

export interface RangeBarCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  direction: 'up' | 'down';
  barIndex: number;
}

export function RangeBars(
  data: OHLCV[],
  rangeSize: number | 'atr' = 1,
  atrPeriod = 14
): RangeBarCandle[] {
  if (!data.length) return [];
  const range = typeof rangeSize === 'string' && rangeSize === 'atr'
    ? computeATR(data, atrPeriod)
    : (typeof rangeSize === 'number' ? rangeSize : 1);
  if (range <= 0) return [];

  const rangeBars: RangeBarCandle[] = [];
  let barOpen = data[0].open;
  let barHigh = data[0].high;
  let barLow = data[0].low;
  let barClose = data[0].close;
  let barVolume = data[0].volume;
  let barStartTime = data[0].time;
  let barEndTime = data[0].time;

  const pushBar = () => {
    rangeBars.push({
      time: barEndTime,
      open: barOpen,
      high: barHigh,
      low: barLow,
      close: barClose,
      volume: barVolume,
      direction: barClose >= barOpen ? 'up' : 'down',
      barIndex: rangeBars.length,
    });
  };

  for (let i = 1; i < data.length; i++) {
    const bar = data[i];
    const prices = [bar.open, bar.high, bar.low, bar.close];

    for (const price of prices) {
      barHigh = Math.max(barHigh, price);
      barLow = Math.min(barLow, price);

      if (barHigh - barLow >= range) {
        if (price >= barOpen) {
          barHigh = barLow + range;
          barClose = barHigh;
        } else {
          barLow = barHigh - range;
          barClose = barLow;
        }
        barEndTime = bar.time;
        pushBar();
        barOpen = barClose;
        barHigh = barClose;
        barLow = barClose;
        barVolume = 0;
        barStartTime = bar.time;
      }
    }
    barClose = bar.close;
    barVolume += bar.volume;
    barEndTime = bar.time;
  }

  pushBar();
  return rangeBars;
}

// ─── VOLUME PROFILE VISIBLE ─────────────────────────────────────────────────

export interface VolumeProfileConfig {
  bins?: number;
  priceStep?: number;
  mode?: 'volume' | 'tpo';
}

export function VolumeProfileVisible(
  data: OHLCV[],
  config: Partial<VolumeProfileConfig> = {}
): VolumeProfileResult {
  const bins = config.bins ?? 24;
  const priceStep = config.priceStep;

  if (!data.length) {
    return { bins: [], vah: 0, val: 0, poc: 0, totalVolume: 0 };
  }

  const low = Math.min(...data.map(d => d.low));
  const high = Math.max(...data.map(d => d.high));
  const step = priceStep ?? ((high - low) / bins || 0.01);
  const profile = new Map<number, number>();
  let totalVolume = 0;

  for (const bar of data) {
    const priceRange = bar.high - bar.low;
    if (priceRange <= 0) {
      const bin = Math.round(bar.close / step) * step;
      profile.set(bin, (profile.get(bin) ?? 0) + bar.volume);
      totalVolume += bar.volume;
      continue;
    }
    const numSteps = Math.ceil(priceRange / step) || 1;
    const volPerStep = bar.volume / numSteps;
    let p = bar.low;
    while (p <= bar.high) {
      const bin = Math.round(p / step) * step;
      profile.set(bin, (profile.get(bin) ?? 0) + volPerStep);
      totalVolume += volPerStep;
      p += step;
    }
  }

  const binsArr: VolumeProfileBin[] = [];
  let maxVol = 0;
  let pocPrice = low;
  for (const [price, vol] of profile) {
    binsArr.push({
      price,
      volume: vol,
      percent: totalVolume > 0 ? (vol / totalVolume) * 100 : 0,
    });
    if (vol > maxVol) {
      maxVol = vol;
      pocPrice = price;
    }
  }
  binsArr.sort((a, b) => a.price - b.price);

  const meanPrice = binsArr.reduce((s, b) => s + b.price * b.volume, 0) / (totalVolume || 1);
  let cumulative = 0;
  const targetVol = totalVolume * 0.68;
  let vah = pocPrice;
  let val = pocPrice;

  for (let i = binsArr.length - 1; i >= 0; i--) {
    cumulative += binsArr[i].volume;
    if (cumulative >= targetVol / 2) {
      vah = binsArr[i].price;
      break;
    }
  }
  cumulative = 0;
  for (let i = 0; i < binsArr.length; i++) {
    cumulative += binsArr[i].volume;
    if (cumulative >= targetVol / 2) {
      val = binsArr[i].price;
      break;
    }
  }

  return {
    bins: binsArr,
    vah,
    val,
    poc: pocPrice,
    totalVolume,
  };
}

// ─── FOOTPRINT ───────────────────────────────────────────────────────────────

export interface FootprintConfig {
  tickSize?: number;
  showDelta?: boolean;
}

export function Footprint(
  data: OHLCV[],
  config: Partial<FootprintConfig> = {}
): FootprintCell[] {
  const tickSize = config.tickSize ?? 0.01;
  const cells: FootprintCell[] = [];
  const priceToBin = (p: number) => Math.round(p / tickSize) * tickSize;

  for (const bar of data) {
    const priceRange = bar.high - bar.low;
    if (priceRange <= 0) {
      const bin = priceToBin(bar.close);
      cells.push({
        price: bin,
        bidVolume: bar.close >= bar.open ? 0 : bar.volume,
        askVolume: bar.close >= bar.open ? bar.volume : 0,
        delta: bar.close >= bar.open ? bar.volume : -bar.volume,
        time: bar.time,
      });
      continue;
    }
    const numTicks = Math.ceil(priceRange / tickSize) || 1;
    const volPerTick = bar.volume / numTicks;
    const upVol = bar.close >= bar.open ? bar.volume : 0;
    const downVol = bar.close < bar.open ? bar.volume : 0;
    const upPerTick = upVol / numTicks;
    const downPerTick = downVol / numTicks;

    let p = bar.low;
    while (p <= bar.high) {
      const bin = priceToBin(p);
      const existing = cells.find(c => c.price === bin && c.time === bar.time);
      if (existing) {
        existing.bidVolume += downPerTick;
        existing.askVolume += upPerTick;
        existing.delta += upPerTick - downPerTick;
      } else {
        cells.push({
          price: bin,
          bidVolume: downPerTick,
          askVolume: upPerTick,
          delta: upPerTick - downPerTick,
          time: bar.time,
        });
      }
      p += tickSize;
    }
  }
  return cells;
}

// ─── MARKET PROFILE ──────────────────────────────────────────────────────────

export interface MarketProfileConfig {
  tickSize?: number;
  sessionLetters?: string;
}

const TPO_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function MarketProfile(
  data: OHLCV[],
  config: Partial<MarketProfileConfig> = {}
): MarketProfileRow[] {
  const tickSize = config.tickSize ?? 0.01;
  const priceToBin = (p: number) => Math.round(p / tickSize) * tickSize;
  const rowMap = new Map<number, { volume: number; tpo: Map<number, string>; startTime: number; endTime: number }>();

  let letterIdx = 0;
  for (const bar of data) {
    const priceRange = bar.high - bar.low;
    const numTicks = Math.ceil(priceRange / tickSize) || 1;
    const volPerTick = bar.volume / numTicks;
    let p = bar.low;
    let tick = 0;
    while (p <= bar.high) {
      const bin = priceToBin(p);
      const letter = TPO_LETTERS[letterIdx % 26];
      if (!rowMap.has(bin)) {
        rowMap.set(bin, {
          volume: 0,
          tpo: new Map(),
          startTime: bar.time,
          endTime: bar.time,
        });
      }
      const row = rowMap.get(bin)!;
      row.volume += volPerTick;
      row.tpo.set(bar.time, letter);
      row.endTime = bar.time;
      p += tickSize;
      tick++;
    }
    letterIdx++;
  }

  return Array.from(rowMap.entries())
    .map(([price, row]) => ({
      price,
      volume: row.volume,
      tpo: Array.from(row.tpo.values()).join(''),
      startTime: row.startTime,
      endTime: row.endTime,
    }))
    .sort((a, b) => b.price - a.price);
}

// ─── EQUIVOLUME ──────────────────────────────────────────────────────────────

export interface EquivolumeBox {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  direction: 'up' | 'down';
  width: number;
  normalizedWidth: number;
  barIndex: number;
}

export function Equivolume(
  data: OHLCV[],
  config: { volumeScale?: 'linear' | 'sqrt' | 'log'; maxWidthMultiple?: number } = {}
): EquivolumeBox[] {
  const scale = config.volumeScale ?? 'sqrt';
  const maxMult = config.maxWidthMultiple ?? 5;

  if (!data.length) return [];

  const scaleVol = (v: number) => {
    switch (scale) {
      case 'sqrt': return Math.sqrt(v);
      case 'log': return v > 0 ? Math.log(v + 1) : 0;
      default: return v;
    }
  };

  const scaled = data.map(d => scaleVol(d.volume));
  const avgScaled = scaled.reduce((a, b) => a + b, 0) / scaled.length;
  const maxAllowed = avgScaled * maxMult;

  return data.map((bar, i) => {
    const rawWidth = scaled[i];
    const clamped = Math.min(rawWidth, maxAllowed);
    const normWidth = avgScaled > 0 ? clamped / avgScaled : 1;
    return {
      time: bar.time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      direction: bar.close >= bar.open ? 'up' : 'down',
      width: clamped,
      normalizedWidth: normWidth,
      barIndex: i,
    };
  });
}

// ─── BASELINE ────────────────────────────────────────────────────────────────

export interface BaselineConfig {
  period?: number;
  deviation?: number;
}

export function Baseline(
  data: OHLCV[],
  config: Partial<BaselineConfig> = {}
): RenderableLine[] {
  const period = config.period ?? 20;
  const deviation = config.deviation ?? 2;

  if (data.length < period) return data.map(d => ({ time: d.time, value: d.close }));

  const closes = data.map(d => d.close);
  const sma: number[] = [];
  const std: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
      std.push(NaN);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    sma.push(mean);
    std.push(Math.sqrt(variance));
  }

  return data.map((d, i) => {
    const m = sma[i];
    const s = std[i];
    const upper = !isNaN(m) && !isNaN(s) ? m + deviation * s : d.close;
    const lower = !isNaN(m) && !isNaN(s) ? m - deviation * s : d.close;
    let baseline = m;
    if (!isNaN(m)) {
      if (d.close > upper) baseline = upper;
      else if (d.close < lower) baseline = lower;
    }
    return {
      time: d.time,
      value: d.close,
      baseline: baseline ?? d.close,
      upper,
      lower,
      sma: m,
    };
  });
}

// ─── TICK CHART ──────────────────────────────────────────────────────────────

export interface TickBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ticks: number;
  direction: 'up' | 'down';
}

/**
 * TickChart — aggregates OHLCV bars into tick-count bars.
 * Each output bar represents exactly `tickCount` trades.
 */
export function TickChart(data: OHLCV[], tickCount = 100): TickBar[] {
  if (!data.length || tickCount < 1) return [];
  const result: TickBar[] = [];
  let current: TickBar | null = null;
  let accTicks = 0;

  for (const bar of data) {
    // Estimate ticks from volume (each bar ≈ volume ticks)
    const barTicks = Math.max(1, Math.round(bar.volume / 100));
    let remaining = barTicks;

    while (remaining > 0) {
      if (!current) {
        current = {
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: 0,
          ticks: 0,
          direction: 'up',
        };
        accTicks = 0;
      }

      const need = tickCount - accTicks;
      const take = Math.min(need, remaining);
      accTicks += take;
      remaining -= take;
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
      current.volume += bar.volume * (take / barTicks);
      current.ticks = accTicks;

      if (accTicks >= tickCount) {
        current.direction = current.close >= current.open ? 'up' : 'down';
        result.push(current);
        current = null;
      }
    }
  }

  if (current) {
    current.direction = current.close >= current.open ? 'up' : 'down';
    result.push(current);
  }

  return result;
}

// ─── CHART TYPE REGISTRY ────────────────────────────────────────────────────

export const CHART_TYPE_PROCESSORS = {
  Candlestick,
  HeikinAshi,
  HollowCandles,
  Line,
  Area,
  Bar,
  Renko,
  PointAndFigure,
  Kagi,
  LineBreak,
  RangeBars,
  TickChart,
  VolumeProfileVisible,
  Footprint,
  MarketProfile,
  Equivolume,
  Baseline,
} as const;

export type ChartTypeName = keyof typeof CHART_TYPE_PROCESSORS;

export function processChartType(
  type: ChartTypeName,
  data: OHLCV[],
  options?: Record<string, unknown>
): unknown {
  const processor = CHART_TYPE_PROCESSORS[type];
  if (!processor) throw new Error(`Unknown chart type: ${type}`);
  switch (type) {
    case 'Renko':
      return processor(data as OHLCV[], options?.brickSize as number, options?.useATR as boolean, options?.atrPeriod as number);
    case 'PointAndFigure':
      return processor(data as OHLCV[], options?.boxSize as number, options?.reversal as number, options?.method as 'close' | 'high-low');
    case 'Kagi':
      return processor(data as OHLCV[], options?.reversalAmount as number, options?.reversalMode as 'fixed' | 'percentage');
    case 'LineBreak':
      return processor(data as OHLCV[], options?.lineCount as number);
    case 'RangeBars':
      return processor(data as OHLCV[], options?.rangeSize as number | 'atr', options?.atrPeriod as number);
    case 'TickChart':
      return processor(data as OHLCV[], options?.tickCount as number);
    case 'VolumeProfileVisible':
      return processor(data as OHLCV[], options as Partial<VolumeProfileConfig>);
    case 'Footprint':
      return processor(data as OHLCV[], options as Partial<FootprintConfig>);
    case 'MarketProfile':
      return processor(data as OHLCV[], options as Partial<MarketProfileConfig>);
    case 'Equivolume':
      return processor(data as OHLCV[], options);
    case 'Baseline':
      return processor(data as OHLCV[], options as Partial<BaselineConfig>);
    default:
      return processor(data as OHLCV[]);
  }
}
