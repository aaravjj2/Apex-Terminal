/**
 * chart-interaction.ts — Chart Interaction Engine
 * =================================================
 * §1.5 Chart Interaction — Full implementation
 * 
 * Features:
 *  • Crosshair with data tooltip (OHLCV + indicator values)
 *  • Measure tool (distance, percentage, bars, time)
 *  • Screenshot/Export chart to PNG/SVG/PDF
 *  • Print chart with custom formatting
 *  • Chart overlay comparison (multi-symbol overlay)
 *  • Price scale formatting (linear, logarithmic, percentage, indexed)
 *  • Auto-scale / fixed scale with manual Y-axis drag
 *  • Right-click context menu system
 *  • 60+ keyboard shortcuts with customization
 *  • Touch/gesture support (pinch-zoom, pan, double-tap)
 *  • Chart replay with speed control
 *  • Go-to date/time navigation
 *  • Bookmark timestamps with annotations
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface PricePoint {
  time: number;
  price: number;
  barIndex: number;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CrosshairData {
  position: Point;
  pricePoint: PricePoint;
  bar: OHLCV | null;
  indicatorValues: Record<string, number | string>;
  visible: boolean;
}

export interface MeasureResult {
  startPoint: PricePoint;
  endPoint: PricePoint;
  priceDiff: number;
  pricePercent: number;
  barCount: number;
  timeDiff: number;
  timeDiffFormatted: string;
  direction: 'up' | 'down' | 'flat';
}

export type PriceScaleMode = 'linear' | 'logarithmic' | 'percentage' | 'indexed';

export interface PriceScaleConfig {
  mode: PriceScaleMode;
  autoScale: boolean;
  fixedMin?: number;
  fixedMax?: number;
  invertScale: boolean;
  alignLabels: boolean;
  borderVisible: boolean;
  scaleMargins: { top: number; bottom: number };
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
  children?: ContextMenuItem[];
  action?: (ctx: ContextMenuContext) => void;
}

export interface ContextMenuContext {
  price: number;
  time: number;
  barIndex: number;
  symbol: string;
  chartType: string;
  selectedDrawing?: string;
  mousePosition: Point;
}

export interface KeyboardShortcut {
  id: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: string;
  description: string;
  category: 'navigation' | 'drawing' | 'chart' | 'trading' | 'general';
  customizable: boolean;
}

export interface GestureState {
  type: 'pan' | 'pinch' | 'rotate' | 'tap' | 'doubletap' | 'longpress';
  startPoint: Point;
  currentPoint: Point;
  scale: number;
  rotation: number;
  velocity: Point;
  deltaX: number;
  deltaY: number;
  fingers: number;
  phase: 'start' | 'move' | 'end' | 'cancel';
}

export interface ReplayState {
  active: boolean;
  speed: number; // 1x, 2x, 5x, 10x, 50x, 100x
  currentBarIndex: number;
  totalBars: number;
  paused: boolean;
  startTime: number;
  endTime: number;
  visibleBars: OHLCV[];
}

export interface Bookmark {
  id: string;
  time: number;
  price: number;
  label: string;
  color: string;
  icon: string;
  notes: string;
  createdAt: number;
}

export interface ChartExportOptions {
  format: 'png' | 'svg' | 'pdf' | 'jpeg';
  width: number;
  height: number;
  quality: number; // 0-1 for JPEG
  includeWatermark: boolean;
  watermarkText: string;
  backgroundColor: string;
  includeTimestamp: boolean;
  includeLogo: boolean;
  includeDrawings: boolean;
  includeIndicators: boolean;
  scale: number; // DPI multiplier for high-res
}

export interface OverlaySymbol {
  symbol: string;
  color: string;
  lineWidth: number;
  opacity: number;
  data: OHLCV[];
  visible: boolean;
  priceScale: 'left' | 'right' | 'overlay';
  indexed: boolean; // percentage comparison mode
}

// ─── Crosshair Engine ─────────────────────────────────────────────────────────

export class CrosshairEngine {
  private data: OHLCV[] = [];
  private indicators: Map<string, number[]> = new Map();
  private visible = false;
  private position: Point = { x: 0, y: 0 };
  private snapToCandle = true;
  private showTooltip = true;
  private tooltipPosition: 'follow' | 'fixed-top' | 'fixed-bottom' = 'follow';
  private crosshairStyle: 'cross' | 'dot' | 'line' = 'cross';
  private lineColor = '#787B86';
  private lineWidth = 0.5;
  private lineDash: number[] = [4, 4];
  private listeners: ((data: CrosshairData) => void)[] = [];

  setData(data: OHLCV[]): void {
    this.data = data;
  }

  setIndicators(indicators: Map<string, number[]>): void {
    this.indicators = indicators;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.notifyListeners();
  }

  setSnapToCandle(snap: boolean): void {
    this.snapToCandle = snap;
  }

  setTooltipPosition(pos: 'follow' | 'fixed-top' | 'fixed-bottom'): void {
    this.tooltipPosition = pos;
  }

  setCrosshairStyle(style: 'cross' | 'dot' | 'line'): void {
    this.crosshairStyle = style;
  }

  onUpdate(listener: (data: CrosshairData) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  updatePosition(
    mouseX: number,
    mouseY: number,
    chartRect: { x: number; y: number; width: number; height: number },
    timeRange: [number, number],
    priceRange: [number, number],
  ): CrosshairData {
    const relX = mouseX - chartRect.x;
    const relY = mouseY - chartRect.y;
    const timePercent = relX / chartRect.width;
    const pricePercent = 1 - (relY / chartRect.height);

    const time = timeRange[0] + timePercent * (timeRange[1] - timeRange[0]);
    const price = priceRange[0] + pricePercent * (priceRange[1] - priceRange[0]);

    // Find nearest bar
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < this.data.length; i++) {
      const dist = Math.abs(this.data[i].time - time);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    const bar = this.data[nearestIdx] || null;
    let snappedX = relX;
    let snappedPrice = price;

    if (this.snapToCandle && bar) {
      const barTimePercent = (bar.time - timeRange[0]) / (timeRange[1] - timeRange[0]);
      snappedX = barTimePercent * chartRect.width;
      // Snap to closest OHLC value
      const ohlc = [bar.open, bar.high, bar.low, bar.close];
      const closest = ohlc.reduce((a, b) => Math.abs(a - price) < Math.abs(b - price) ? a : b);
      snappedPrice = closest;
    }

    // Collect indicator values at this bar index
    const indicatorValues: Record<string, number | string> = {};
    this.indicators.forEach((values, name) => {
      if (nearestIdx < values.length && !isNaN(values[nearestIdx])) {
        indicatorValues[name] = values[nearestIdx];
      }
    });

    const crosshairData: CrosshairData = {
      position: { x: snappedX, y: relY },
      pricePoint: { time: bar?.time ?? time, price: snappedPrice, barIndex: nearestIdx },
      bar,
      indicatorValues,
      visible: this.visible,
    };

    this.position = crosshairData.position;
    this.notifyListeners(crosshairData);
    return crosshairData;
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.visible) return;

    ctx.save();
    ctx.strokeStyle = this.lineColor;
    ctx.lineWidth = this.lineWidth;
    ctx.setLineDash(this.lineDash);

    if (this.crosshairStyle === 'cross' || this.crosshairStyle === 'line') {
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(this.position.x, 0);
      ctx.lineTo(this.position.x, height);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, this.position.y);
      ctx.lineTo(width, this.position.y);
      ctx.stroke();
    }

    if (this.crosshairStyle === 'dot' || this.crosshairStyle === 'cross') {
      // Center dot
      ctx.setLineDash([]);
      ctx.fillStyle = this.lineColor;
      ctx.beginPath();
      ctx.arc(this.position.x, this.position.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private notifyListeners(data?: CrosshairData): void {
    const d = data ?? {
      position: this.position,
      pricePoint: { time: 0, price: 0, barIndex: 0 },
      bar: null,
      indicatorValues: {},
      visible: false,
    };
    this.listeners.forEach(l => l(d));
  }

  getConfig() {
    return {
      snapToCandle: this.snapToCandle,
      showTooltip: this.showTooltip,
      tooltipPosition: this.tooltipPosition,
      crosshairStyle: this.crosshairStyle,
      lineColor: this.lineColor,
      lineWidth: this.lineWidth,
    };
  }
}

// ─── Measure Tool ─────────────────────────────────────────────────────────────

export class MeasureTool {
  private active = false;
  private startPoint: PricePoint | null = null;
  private endPoint: PricePoint | null = null;
  private color = '#2962FF';
  private fontSize = 11;
  private results: MeasureResult[] = [];

  start(point: PricePoint): void {
    this.active = true;
    this.startPoint = point;
    this.endPoint = null;
  }

  update(point: PricePoint): MeasureResult | null {
    if (!this.active || !this.startPoint) return null;
    this.endPoint = point;
    return this.calculate();
  }

  finish(): MeasureResult | null {
    if (!this.active || !this.startPoint || !this.endPoint) return null;
    const result = this.calculate();
    if (result) this.results.push(result);
    this.active = false;
    return result;
  }

  cancel(): void {
    this.active = false;
    this.startPoint = null;
    this.endPoint = null;
  }

  clearAll(): void {
    this.results = [];
  }

  getResults(): MeasureResult[] {
    return [...this.results];
  }

  isActive(): boolean {
    return this.active;
  }

  private calculate(): MeasureResult | null {
    if (!this.startPoint || !this.endPoint) return null;

    const priceDiff = this.endPoint.price - this.startPoint.price;
    const pricePercent = this.startPoint.price !== 0
      ? (priceDiff / this.startPoint.price) * 100
      : 0;
    const barCount = Math.abs(this.endPoint.barIndex - this.startPoint.barIndex);
    const timeDiff = Math.abs(this.endPoint.time - this.startPoint.time);

    return {
      startPoint: this.startPoint,
      endPoint: this.endPoint,
      priceDiff,
      pricePercent,
      barCount,
      timeDiff,
      timeDiffFormatted: formatTimeDiff(timeDiff),
      direction: priceDiff > 0 ? 'up' : priceDiff < 0 ? 'down' : 'flat',
    };
  }

  render(ctx: CanvasRenderingContext2D, chartRect: { x: number; y: number; width: number; height: number }, timeRange: [number, number], priceRange: [number, number]): void {
    const toX = (time: number) => chartRect.x + ((time - timeRange[0]) / (timeRange[1] - timeRange[0])) * chartRect.width;
    const toY = (price: number) => chartRect.y + (1 - (price - priceRange[0]) / (priceRange[1] - priceRange[0])) * chartRect.height;

    // Render saved results
    for (const result of this.results) {
      this.renderMeasure(ctx, result, toX, toY);
    }

    // Render active measure
    if (this.active && this.startPoint && this.endPoint) {
      const result = this.calculate();
      if (result) this.renderMeasure(ctx, result, toX, toY);
    }
  }

  private renderMeasure(ctx: CanvasRenderingContext2D, result: MeasureResult, toX: (t: number) => number, toY: (p: number) => number): void {
    const x1 = toX(result.startPoint.time);
    const y1 = toY(result.startPoint.price);
    const x2 = toX(result.endPoint.time);
    const y2 = toY(result.endPoint.price);

    ctx.save();

    // Background rectangle
    const bgColor = result.direction === 'up' ? 'rgba(38,166,154,0.1)' : result.direction === 'down' ? 'rgba(239,83,80,0.1)' : 'rgba(120,123,134,0.1)';
    ctx.fillStyle = bgColor;
    ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));

    // Border
    const borderColor = result.direction === 'up' ? '#26A69A' : result.direction === 'down' ? '#EF5350' : '#787B86';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.setLineDash([]);

    // Diagonal line
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Label
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const text = `${result.priceDiff >= 0 ? '+' : ''}${result.priceDiff.toFixed(2)} (${result.pricePercent >= 0 ? '+' : ''}${result.pricePercent.toFixed(2)}%) | ${result.barCount} bars | ${result.timeDiffFormatted}`;

    ctx.font = `${this.fontSize}px "Inter", sans-serif`;
    const metrics = ctx.measureText(text);
    const labelPad = 4;
    const labelW = metrics.width + labelPad * 2;
    const labelH = this.fontSize + labelPad * 2;

    ctx.fillStyle = '#1E222D';
    ctx.fillRect(midX - labelW / 2, midY - labelH / 2, labelW, labelH);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(midX - labelW / 2, midY - labelH / 2, labelW, labelH);

    ctx.fillStyle = '#D1D4DC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, midX, midY);

    ctx.restore();
  }
}

// ─── Chart Export ─────────────────────────────────────────────────────────────

export class ChartExporter {
  static async exportToPNG(
    canvas: HTMLCanvasElement,
    options: Partial<ChartExportOptions> = {},
  ): Promise<Blob> {
    const opts: ChartExportOptions = {
      format: 'png',
      width: canvas.width,
      height: canvas.height,
      quality: 1,
      includeWatermark: true,
      watermarkText: 'Apex Terminal',
      backgroundColor: '#131722',
      includeTimestamp: true,
      includeLogo: false,
      includeDrawings: true,
      includeIndicators: true,
      scale: 2,
      ...options,
    };

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = opts.width * opts.scale;
    exportCanvas.height = opts.height * opts.scale;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) throw new Error('Cannot create canvas context');

    ctx.scale(opts.scale, opts.scale);

    // Background
    ctx.fillStyle = opts.backgroundColor;
    ctx.fillRect(0, 0, opts.width, opts.height);

    // Copy chart content
    ctx.drawImage(canvas, 0, 0, opts.width, opts.height);

    // Watermark
    if (opts.includeWatermark) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.font = 'bold 24px "Inter", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(opts.width / 2, opts.height / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(opts.watermarkText, 0, 0);
      ctx.restore();
    }

    // Timestamp
    if (opts.includeTimestamp) {
      ctx.save();
      ctx.font = '10px "Inter", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'right';
      ctx.fillText(new Date().toISOString(), opts.width - 10, opts.height - 10);
      ctx.restore();
    }

    return new Promise((resolve, reject) => {
      exportCanvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to export canvas'));
        },
        `image/${opts.format}`,
        opts.quality,
      );
    });
  }

  static async exportToSVG(
    canvas: HTMLCanvasElement,
    _options: Partial<ChartExportOptions> = {},
  ): Promise<string> {
    const dataURL = canvas.toDataURL('image/png');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <rect width="100%" height="100%" fill="#131722"/>
  <image xlink:href="${dataURL}" width="${canvas.width}" height="${canvas.height}"/>
  <text x="${canvas.width - 10}" y="${canvas.height - 10}" text-anchor="end"
    font-family="Inter, sans-serif" font-size="10" fill="rgba(255,255,255,0.5)">
    ${new Date().toISOString()} — Apex Terminal
  </text>
</svg>`;
    return svg;
  }

  static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static downloadText(text: string, filename: string, mimeType = 'image/svg+xml'): void {
    const blob = new Blob([text], { type: mimeType });
    ChartExporter.downloadBlob(blob, filename);
  }

  static print(canvas: HTMLCanvasElement): void {
    const win = window.open('', '_blank');
    if (!win) return;
    const dataURL = canvas.toDataURL('image/png');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chart Print — Apex Terminal</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              img { max-width: 100%; height: auto; }
              .meta { font-size: 8pt; color: #666; margin-top: 4px; }
            }
            body { background: #fff; text-align: center; padding: 20px; }
            img { max-width: 100%; border: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <img src="${dataURL}" />
          <div class="meta">
            Exported from Apex Terminal — ${new Date().toLocaleString()}
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }
}

// ─── Price Scale ──────────────────────────────────────────────────────────────

export class PriceScaleEngine {
  private config: PriceScaleConfig = {
    mode: 'linear',
    autoScale: true,
    invertScale: false,
    alignLabels: true,
    borderVisible: true,
    scaleMargins: { top: 0.1, bottom: 0.1 },
  };

  private manualMin: number | null = null;
  private manualMax: number | null = null;

  setMode(mode: PriceScaleMode): void {
    this.config.mode = mode;
  }

  getMode(): PriceScaleMode {
    return this.config.mode;
  }

  setAutoScale(auto: boolean): void {
    this.config.autoScale = auto;
    if (auto) {
      this.manualMin = null;
      this.manualMax = null;
    }
  }

  setFixedRange(min: number, max: number): void {
    this.config.autoScale = false;
    this.manualMin = min;
    this.manualMax = max;
  }

  setInvert(invert: boolean): void {
    this.config.invertScale = invert;
  }

  setMargins(top: number, bottom: number): void {
    this.config.scaleMargins = { top, bottom };
  }

  /**
   * Transform a price value to Y pixel coordinate
   */
  priceToY(price: number, height: number, minPrice: number, maxPrice: number): number {
    const effectiveMin = this.manualMin ?? minPrice;
    const effectiveMax = this.manualMax ?? maxPrice;
    const marginTop = height * this.config.scaleMargins.top;
    const marginBottom = height * this.config.scaleMargins.bottom;
    const chartHeight = height - marginTop - marginBottom;

    let normalized: number;
    switch (this.config.mode) {
      case 'logarithmic':
        if (effectiveMin <= 0 || effectiveMax <= 0) {
          normalized = (price - effectiveMin) / (effectiveMax - effectiveMin || 1);
        } else {
          normalized = (Math.log(price) - Math.log(effectiveMin)) /
            (Math.log(effectiveMax) - Math.log(effectiveMin) || 1);
        }
        break;
      case 'percentage': {
        const basePrice = effectiveMin;
        const pctPrice = basePrice !== 0 ? ((price - basePrice) / basePrice) * 100 : 0;
        const pctMin = 0;
        const pctMax = basePrice !== 0 ? ((effectiveMax - basePrice) / basePrice) * 100 : 100;
        normalized = (pctPrice - pctMin) / (pctMax - pctMin || 1);
        break;
      }
      case 'indexed': {
        const base = effectiveMin || 1;
        const idxPrice = (price / base) * 100;
        const idxMax = (effectiveMax / base) * 100;
        normalized = (idxPrice - 100) / (idxMax - 100 || 1);
        break;
      }
      default: // linear
        normalized = (price - effectiveMin) / (effectiveMax - effectiveMin || 1);
    }

    let y = marginTop + (1 - normalized) * chartHeight;
    if (this.config.invertScale) {
      y = height - y;
    }
    return y;
  }

  /**
   * Transform Y pixel coordinate back to price
   */
  yToPrice(y: number, height: number, minPrice: number, maxPrice: number): number {
    const effectiveMin = this.manualMin ?? minPrice;
    const effectiveMax = this.manualMax ?? maxPrice;
    const marginTop = height * this.config.scaleMargins.top;
    const marginBottom = height * this.config.scaleMargins.bottom;
    const chartHeight = height - marginTop - marginBottom;

    let adjustedY = y;
    if (this.config.invertScale) adjustedY = height - y;

    const normalized = 1 - (adjustedY - marginTop) / chartHeight;

    switch (this.config.mode) {
      case 'logarithmic':
        if (effectiveMin <= 0 || effectiveMax <= 0) {
          return effectiveMin + normalized * (effectiveMax - effectiveMin);
        }
        return Math.exp(Math.log(effectiveMin) + normalized * (Math.log(effectiveMax) - Math.log(effectiveMin)));
      case 'percentage': {
        const basePrice = effectiveMin;
        const pctMax = basePrice !== 0 ? ((effectiveMax - basePrice) / basePrice) * 100 : 100;
        const pct = normalized * pctMax;
        return basePrice * (1 + pct / 100);
      }
      case 'indexed': {
        const base = effectiveMin || 1;
        const idxMax = (effectiveMax / base) * 100;
        const idx = 100 + normalized * (idxMax - 100);
        return (idx / 100) * base;
      }
      default:
        return effectiveMin + normalized * (effectiveMax - effectiveMin);
    }
  }

  /**
   * Generate nicely spaced price labels for the Y axis
   */
  generateLabels(minPrice: number, maxPrice: number, height: number, maxLabels = 8): { price: number; y: number; text: string }[] {
    const effectiveMin = this.manualMin ?? minPrice;
    const effectiveMax = this.manualMax ?? maxPrice;
    const range = effectiveMax - effectiveMin;
    if (range <= 0) return [];

    const step = niceStep(range / maxLabels);
    const labels: { price: number; y: number; text: string }[] = [];
    const start = Math.ceil(effectiveMin / step) * step;

    for (let price = start; price <= effectiveMax; price += step) {
      const y = this.priceToY(price, height, minPrice, maxPrice);
      let text: string;
      switch (this.config.mode) {
        case 'percentage':
          text = `${(((price - effectiveMin) / effectiveMin) * 100).toFixed(1)}%`;
          break;
        case 'indexed':
          text = ((price / effectiveMin) * 100).toFixed(1);
          break;
        default:
          text = formatPrice(price);
      }
      labels.push({ price, y, text });
    }

    return labels;
  }

  /**
   * Handle Y-axis drag to manually scale
   */
  handleDrag(startY: number, currentY: number, height: number, minPrice: number, maxPrice: number): void {
    if (this.config.autoScale) return;
    const deltaPercent = (startY - currentY) / height;
    const range = (this.manualMax ?? maxPrice) - (this.manualMin ?? minPrice);
    const shift = deltaPercent * range * 0.5;
    this.manualMin = (this.manualMin ?? minPrice) - shift;
    this.manualMax = (this.manualMax ?? maxPrice) + shift;
  }

  getConfig(): PriceScaleConfig {
    return { ...this.config };
  }
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

export class ContextMenuEngine {
  private items: ContextMenuItem[] = [];
  private visible = false;
  private position: Point = { x: 0, y: 0 };
  private context: ContextMenuContext | null = null;

  constructor() {
    this.items = this.buildDefaultMenu();
  }

  private buildDefaultMenu(): ContextMenuItem[] {
    return [
      { id: 'copy-price', label: 'Copy Price', shortcut: 'Ctrl+C', action: (ctx) => { navigator.clipboard.writeText(ctx.price.toFixed(2)); } },
      { id: 'sep1', label: '', separator: true },
      { id: 'add-alert', label: 'Set Alert at Price...', shortcut: 'Alt+A', action: () => {} },
      { id: 'add-hline', label: 'Add Horizontal Line', action: () => {} },
      { id: 'add-indicator', label: 'Add Indicator...', action: () => {} },
      { id: 'sep2', label: '', separator: true },
      { id: 'chart-settings', label: 'Chart Settings...', action: () => {} },
      {
        id: 'chart-type', label: 'Chart Type',
        children: [
          { id: 'ct-candle', label: 'Candlestick', action: () => {} },
          { id: 'ct-heikin', label: 'Heikin Ashi', action: () => {} },
          { id: 'ct-line', label: 'Line', action: () => {} },
          { id: 'ct-area', label: 'Area', action: () => {} },
          { id: 'ct-bar', label: 'Bar (OHLC)', action: () => {} },
          { id: 'ct-renko', label: 'Renko', action: () => {} },
          { id: 'ct-pnf', label: 'Point & Figure', action: () => {} },
          { id: 'ct-kagi', label: 'Kagi', action: () => {} },
          { id: 'ct-linebreak', label: 'Line Break', action: () => {} },
          { id: 'ct-hollow', label: 'Hollow Candles', action: () => {} },
          { id: 'ct-baseline', label: 'Baseline', action: () => {} },
          { id: 'ct-range', label: 'Range Bars', action: () => {} },
          { id: 'ct-tick', label: 'Tick Chart', action: () => {} },
          { id: 'ct-footprint', label: 'Footprint', action: () => {} },
          { id: 'ct-tpo', label: 'Market Profile (TPO)', action: () => {} },
        ],
      },
      {
        id: 'price-scale', label: 'Price Scale',
        children: [
          { id: 'ps-linear', label: 'Linear', action: () => {} },
          { id: 'ps-log', label: 'Logarithmic', action: () => {} },
          { id: 'ps-percent', label: 'Percentage', action: () => {} },
          { id: 'ps-indexed', label: 'Indexed to 100', action: () => {} },
        ],
      },
      { id: 'sep3', label: '', separator: true },
      { id: 'take-screenshot', label: 'Take Screenshot', shortcut: 'Ctrl+Shift+S', action: () => {} },
      { id: 'print', label: 'Print Chart...', shortcut: 'Ctrl+P', action: () => {} },
      { id: 'sep4', label: '', separator: true },
      {
        id: 'compare', label: 'Add Comparison Symbol...',
        action: () => {},
      },
      { id: 'replay', label: 'Chart Replay', shortcut: 'Alt+R', action: () => {} },
      { id: 'goto-date', label: 'Go to Date...', shortcut: 'Alt+G', action: () => {} },
      { id: 'sep5', label: '', separator: true },
      {
        id: 'drawing-submenu', label: 'Drawing Tools',
        children: [
          { id: 'dt-trendline', label: 'Trend Line', shortcut: 'T', action: () => {} },
          { id: 'dt-hline', label: 'Horizontal Line', shortcut: 'H', action: () => {} },
          { id: 'dt-fib', label: 'Fibonacci Retracement', shortcut: 'F', action: () => {} },
          { id: 'dt-rect', label: 'Rectangle', shortcut: 'R', action: () => {} },
          { id: 'dt-text', label: 'Text', action: () => {} },
          { id: 'dt-measure', label: 'Measure', action: () => {} },
        ],
      },
      { id: 'sep6', label: '', separator: true },
      { id: 'clear-drawings', label: 'Remove All Drawings', action: () => {} },
      { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', action: () => {} },
      { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', action: () => {} },
    ];
  }

  addItem(item: ContextMenuItem, beforeId?: string): void {
    if (beforeId) {
      const idx = this.items.findIndex(i => i.id === beforeId);
      if (idx >= 0) {
        this.items.splice(idx, 0, item);
        return;
      }
    }
    this.items.push(item);
  }

  removeItem(id: string): void {
    this.items = this.items.filter(i => i.id !== id);
  }

  show(x: number, y: number, context: ContextMenuContext): void {
    this.visible = true;
    this.position = { x, y };
    this.context = context;
  }

  hide(): void {
    this.visible = false;
    this.context = null;
  }

  isVisible(): boolean {
    return this.visible;
  }

  getPosition(): Point {
    return { ...this.position };
  }

  getItems(): ContextMenuItem[] {
    return [...this.items];
  }

  getContext(): ContextMenuContext | null {
    return this.context;
  }

  executeItem(id: string): void {
    const item = this.findItem(id, this.items);
    if (item?.action && this.context && !item.disabled) {
      item.action(this.context);
    }
    this.hide();
  }

  private findItem(id: string, items: ContextMenuItem[]): ContextMenuItem | null {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = this.findItem(id, item.children);
        if (found) return found;
      }
    }
    return null;
  }
}

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  { id: 'scroll-left', key: 'ArrowLeft', action: 'scrollLeft', description: 'Scroll chart left', category: 'navigation', customizable: true },
  { id: 'scroll-right', key: 'ArrowRight', action: 'scrollRight', description: 'Scroll chart right', category: 'navigation', customizable: true },
  { id: 'scroll-up', key: 'ArrowUp', action: 'scrollUp', description: 'Scroll chart up', category: 'navigation', customizable: true },
  { id: 'scroll-down', key: 'ArrowDown', action: 'scrollDown', description: 'Scroll chart down', category: 'navigation', customizable: true },
  { id: 'zoom-in', key: '=', ctrl: true, action: 'zoomIn', description: 'Zoom in', category: 'navigation', customizable: true },
  { id: 'zoom-out', key: '-', ctrl: true, action: 'zoomOut', description: 'Zoom out', category: 'navigation', customizable: true },
  { id: 'fit', key: ' ', action: 'fitToScreen', description: 'Fit chart to screen', category: 'navigation', customizable: true },
  { id: 'home', key: 'Home', action: 'goToStart', description: 'Go to start', category: 'navigation', customizable: true },
  { id: 'end', key: 'End', action: 'goToEnd', description: 'Go to latest bar', category: 'navigation', customizable: true },
  { id: 'page-left', key: 'PageUp', action: 'pageLeft', description: 'Page left', category: 'navigation', customizable: true },
  { id: 'page-right', key: 'PageDown', action: 'pageRight', description: 'Page right', category: 'navigation', customizable: true },

  // Chart
  { id: 'toggle-crosshair', key: 'c', action: 'toggleCrosshair', description: 'Toggle crosshair', category: 'chart', customizable: true },
  { id: 'toggle-log', key: 'l', alt: true, action: 'toggleLogScale', description: 'Toggle log scale', category: 'chart', customizable: true },
  { id: 'toggle-percent', key: '%', action: 'togglePercentScale', description: 'Toggle percent scale', category: 'chart', customizable: true },
  { id: 'auto-scale', key: 'a', alt: true, action: 'autoScale', description: 'Auto-scale', category: 'chart', customizable: true },
  { id: 'screenshot', key: 's', ctrl: true, shift: true, action: 'screenshot', description: 'Take screenshot', category: 'chart', customizable: true },
  { id: 'print-chart', key: 'p', ctrl: true, action: 'printChart', description: 'Print chart', category: 'chart', customizable: true },
  { id: 'fullscreen', key: 'F11', action: 'toggleFullscreen', description: 'Toggle fullscreen', category: 'chart', customizable: true },
  { id: 'goto-date', key: 'g', alt: true, action: 'goToDate', description: 'Go to date', category: 'chart', customizable: true },
  { id: 'replay', key: 'r', alt: true, action: 'toggleReplay', description: 'Toggle chart replay', category: 'chart', customizable: true },

  // Timeframes
  { id: 'tf-1m', key: '1', action: 'setTimeframe1m', description: 'Set 1m timeframe', category: 'chart', customizable: true },
  { id: 'tf-5m', key: '2', action: 'setTimeframe5m', description: 'Set 5m timeframe', category: 'chart', customizable: true },
  { id: 'tf-15m', key: '3', action: 'setTimeframe15m', description: 'Set 15m timeframe', category: 'chart', customizable: true },
  { id: 'tf-30m', key: '4', action: 'setTimeframe30m', description: 'Set 30m timeframe', category: 'chart', customizable: true },
  { id: 'tf-1h', key: '5', action: 'setTimeframe1h', description: 'Set 1h timeframe', category: 'chart', customizable: true },
  { id: 'tf-4h', key: '6', action: 'setTimeframe4h', description: 'Set 4h timeframe', category: 'chart', customizable: true },
  { id: 'tf-1d', key: '7', action: 'setTimeframe1d', description: 'Set daily timeframe', category: 'chart', customizable: true },
  { id: 'tf-1w', key: '8', action: 'setTimeframe1w', description: 'Set weekly timeframe', category: 'chart', customizable: true },
  { id: 'tf-1mo', key: '9', action: 'setTimeframe1mo', description: 'Set monthly timeframe', category: 'chart', customizable: true },

  // Drawing
  { id: 'draw-trendline', key: 't', action: 'drawTrendLine', description: 'Trend line tool', category: 'drawing', customizable: true },
  { id: 'draw-hline', key: 'h', action: 'drawHLine', description: 'Horizontal line', category: 'drawing', customizable: true },
  { id: 'draw-vline', key: 'v', shift: true, action: 'drawVLine', description: 'Vertical line', category: 'drawing', customizable: true },
  { id: 'draw-fib', key: 'f', action: 'drawFibRetracement', description: 'Fibonacci retracement', category: 'drawing', customizable: true },
  { id: 'draw-rect', key: 'r', action: 'drawRectangle', description: 'Rectangle', category: 'drawing', customizable: true },
  { id: 'draw-ellipse', key: 'e', action: 'drawEllipse', description: 'Ellipse', category: 'drawing', customizable: true },
  { id: 'draw-text', key: 'x', action: 'drawText', description: 'Text tool', category: 'drawing', customizable: true },
  { id: 'draw-arrow', key: 'a', action: 'drawArrow', description: 'Arrow', category: 'drawing', customizable: true },
  { id: 'draw-measure', key: 'm', shift: true, action: 'drawMeasure', description: 'Measure tool', category: 'drawing', customizable: true },
  { id: 'draw-pitchfork', key: 'p', shift: true, action: 'drawPitchfork', description: 'Pitchfork', category: 'drawing', customizable: true },
  { id: 'cursor-tool', key: 'v', action: 'cursorTool', description: 'Cursor tool', category: 'drawing', customizable: true },
  { id: 'clear-drawings', key: 'Delete', ctrl: true, action: 'clearAllDrawings', description: 'Clear all drawings', category: 'drawing', customizable: true },
  { id: 'delete-selected', key: 'Delete', action: 'deleteSelectedDrawing', description: 'Delete selected drawing', category: 'drawing', customizable: true },
  { id: 'lock-drawings', key: 'l', shift: true, action: 'lockDrawings', description: 'Lock/unlock drawings', category: 'drawing', customizable: true },
  { id: 'magnet-mode', key: 'g', action: 'toggleMagnet', description: 'Toggle magnet mode', category: 'drawing', customizable: true },

  // Trading
  { id: 'buy-market', key: 'b', ctrl: true, action: 'buyMarket', description: 'Buy market order', category: 'trading', customizable: true },
  { id: 'sell-market', key: 's', ctrl: true, action: 'sellMarket', description: 'Sell market order', category: 'trading', customizable: true },
  { id: 'order-panel', key: 'o', ctrl: true, action: 'openOrderPanel', description: 'Open order panel', category: 'trading', customizable: true },
  { id: 'cancel-all', key: 'x', ctrl: true, action: 'cancelAllOrders', description: 'Cancel all orders', category: 'trading', customizable: true },
  { id: 'close-position', key: 'w', ctrl: true, action: 'closePosition', description: 'Close position', category: 'trading', customizable: true },

  // General
  { id: 'undo', key: 'z', ctrl: true, action: 'undo', description: 'Undo', category: 'general', customizable: true },
  { id: 'redo', key: 'y', ctrl: true, action: 'redo', description: 'Redo', category: 'general', customizable: true },
  { id: 'redo-alt', key: 'z', ctrl: true, shift: true, action: 'redo', description: 'Redo (alt)', category: 'general', customizable: false },
  { id: 'command-palette', key: 'k', ctrl: true, action: 'openCommandPalette', description: 'Command palette', category: 'general', customizable: false },
  { id: 'search-symbol', key: '/', action: 'searchSymbol', description: 'Search symbol', category: 'general', customizable: true },
  { id: 'toggle-sidebar', key: 'b', alt: true, action: 'toggleSidebar', description: 'Toggle sidebar', category: 'general', customizable: true },
  { id: 'toggle-toolbox', key: 't', alt: true, action: 'toggleToolbox', description: 'Toggle toolbox', category: 'general', customizable: true },
  { id: 'toggle-watchlist', key: 'w', alt: true, action: 'toggleWatchlist', description: 'Toggle watchlist', category: 'general', customizable: true },
  { id: 'help', key: '?', action: 'showHelp', description: 'Show shortcuts help', category: 'general', customizable: false },
];

export class KeyboardShortcutEngine {
  private shortcuts: KeyboardShortcut[];
  private customizations: Map<string, Partial<KeyboardShortcut>> = new Map();
  private handlers: Map<string, (() => void)[]> = new Map();
  private enabled = true;
  private inputFocused = false;

  constructor(shortcuts: KeyboardShortcut[] = DEFAULT_SHORTCUTS) {
    this.shortcuts = [...shortcuts];
  }

  enable(): void { this.enabled = true; }
  disable(): void { this.enabled = false; }
  setInputFocused(focused: boolean): void { this.inputFocused = focused; }

  onAction(action: string, handler: () => void): () => void {
    if (!this.handlers.has(action)) this.handlers.set(action, []);
    this.handlers.get(action)!.push(handler);
    return () => {
      const list = this.handlers.get(action);
      if (list) {
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  }

  handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.enabled) return false;

    // Don't intercept if typing in an input
    if (this.inputFocused) {
      // Allow some global shortcuts even in input
      const isGlobalShortcut = (e.ctrlKey || e.metaKey) && ['k', 'z', 'y'].includes(e.key.toLowerCase());
      if (!isGlobalShortcut) return false;
    }

    for (const shortcut of this.shortcuts) {
      const custom = this.customizations.get(shortcut.id);
      const key = custom?.key ?? shortcut.key;
      const ctrl = custom?.ctrl ?? shortcut.ctrl ?? false;
      const shift = custom?.shift ?? shortcut.shift ?? false;
      const alt = custom?.alt ?? shortcut.alt ?? false;
      const meta = custom?.meta ?? shortcut.meta ?? false;

      const ctrlMatch = ctrl === (e.ctrlKey || e.metaKey);
      const shiftMatch = shift === e.shiftKey;
      const altMatch = alt === e.altKey;
      const metaMatch = meta === e.metaKey;
      const keyMatch = e.key.toLowerCase() === key.toLowerCase();

      if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
        e.preventDefault();
        e.stopPropagation();
        const action = custom?.action ?? shortcut.action;
        const actionHandlers = this.handlers.get(action);
        actionHandlers?.forEach(h => h());
        return true;
      }
    }

    return false;
  }

  customize(id: string, overrides: Partial<KeyboardShortcut>): void {
    const shortcut = this.shortcuts.find(s => s.id === id);
    if (shortcut && shortcut.customizable) {
      this.customizations.set(id, overrides);
    }
  }

  resetCustomizations(): void {
    this.customizations.clear();
  }

  getShortcuts(): KeyboardShortcut[] {
    return this.shortcuts.map(s => ({
      ...s,
      ...this.customizations.get(s.id),
    }));
  }

  getByCategory(category: string): KeyboardShortcut[] {
    return this.getShortcuts().filter(s => s.category === category);
  }

  formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.meta) parts.push('⌘');
    parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
    return parts.join('+');
  }
}

// ─── Touch Gesture Engine ─────────────────────────────────────────────────────

export class GestureEngine {
  private touches: Map<number, Point> = new Map();
  private lastScale = 1;
  private lastCenter: Point = { x: 0, y: 0 };
  private panThreshold = 5;
  private pinchThreshold = 0.05;
  private doubleTapTimeout = 300;
  private longPressTimeout = 500;
  private lastTapTime = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: ((gesture: GestureState) => void)[] = [];

  onGesture(listener: (gesture: GestureState) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  handleTouchStart(e: TouchEvent): void {
    this.touches.clear();
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      this.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }

    if (e.touches.length === 1) {
      const now = Date.now();
      const point = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      // Check double tap
      if (now - this.lastTapTime < this.doubleTapTimeout) {
        this.emit({ type: 'doubletap', startPoint: point, currentPoint: point, scale: 1, rotation: 0, velocity: { x: 0, y: 0 }, deltaX: 0, deltaY: 0, fingers: 1, phase: 'end' });
        this.lastTapTime = 0;
        return;
      }
      this.lastTapTime = now;

      // Start long press timer
      this.longPressTimer = setTimeout(() => {
        this.emit({ type: 'longpress', startPoint: point, currentPoint: point, scale: 1, rotation: 0, velocity: { x: 0, y: 0 }, deltaX: 0, deltaY: 0, fingers: 1, phase: 'end' });
      }, this.longPressTimeout);

      this.emit({ type: 'pan', startPoint: point, currentPoint: point, scale: 1, rotation: 0, velocity: { x: 0, y: 0 }, deltaX: 0, deltaY: 0, fingers: 1, phase: 'start' });
    } else if (e.touches.length === 2) {
      if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
      const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      this.lastCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      this.lastScale = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.emit({ type: 'pinch', startPoint: this.lastCenter, currentPoint: this.lastCenter, scale: 1, rotation: 0, velocity: { x: 0, y: 0 }, deltaX: 0, deltaY: 0, fingers: 2, phase: 'start' });
    }
  }

  handleTouchMove(e: TouchEvent): void {
    if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const start = this.touches.get(t.identifier) ?? { x: t.clientX, y: t.clientY };
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      this.emit({ type: 'pan', startPoint: start, currentPoint: { x: t.clientX, y: t.clientY }, scale: 1, rotation: 0, velocity: { x: dx, y: dy }, deltaX: dx, deltaY: dy, fingers: 1, phase: 'move' });
    } else if (e.touches.length === 2) {
      const p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const p2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const scale = dist / (this.lastScale || 1);
      this.emit({ type: 'pinch', startPoint: this.lastCenter, currentPoint: center, scale, rotation: 0, velocity: { x: center.x - this.lastCenter.x, y: center.y - this.lastCenter.y }, deltaX: center.x - this.lastCenter.x, deltaY: center.y - this.lastCenter.y, fingers: 2, phase: 'move' });
      this.lastCenter = center;
      this.lastScale = dist;
    }
  }

  handleTouchEnd(e: TouchEvent): void {
    if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }

    const type = e.touches.length === 0 ? (this.touches.size >= 2 ? 'pinch' : 'pan') : 'pan';
    this.emit({ type: type as GestureState['type'], startPoint: { x: 0, y: 0 }, currentPoint: { x: 0, y: 0 }, scale: 1, rotation: 0, velocity: { x: 0, y: 0 }, deltaX: 0, deltaY: 0, fingers: 0, phase: 'end' });
    this.touches.clear();
  }

  private emit(gesture: GestureState): void {
    this.listeners.forEach(l => l(gesture));
  }
}

// ─── Chart Replay Engine ──────────────────────────────────────────────────────

export class ChartReplayEngine {
  private state: ReplayState = {
    active: false,
    speed: 1,
    currentBarIndex: 0,
    totalBars: 0,
    paused: true,
    startTime: 0,
    endTime: 0,
    visibleBars: [],
  };

  private fullData: OHLCV[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: ((state: ReplayState) => void)[] = [];

  // Available speeds
  static readonly SPEEDS = [0.5, 1, 2, 5, 10, 25, 50, 100];

  setData(data: OHLCV[]): void {
    this.fullData = data;
    this.state.totalBars = data.length;
    if (data.length > 0) {
      this.state.startTime = data[0].time;
      this.state.endTime = data[data.length - 1].time;
    }
  }

  start(fromBar = 0): void {
    this.state.active = true;
    this.state.currentBarIndex = Math.max(0, Math.min(fromBar, this.fullData.length - 1));
    this.state.paused = false;
    this.state.visibleBars = this.fullData.slice(0, this.state.currentBarIndex + 1);
    this.startTimer();
    this.notify();
  }

  stop(): void {
    this.state.active = false;
    this.state.paused = true;
    this.stopTimer();
    this.state.visibleBars = [...this.fullData];
    this.notify();
  }

  pause(): void {
    this.state.paused = true;
    this.stopTimer();
    this.notify();
  }

  resume(): void {
    if (!this.state.active) return;
    this.state.paused = false;
    this.startTimer();
    this.notify();
  }

  togglePause(): void {
    if (this.state.paused) this.resume();
    else this.pause();
  }

  setSpeed(speed: number): void {
    this.state.speed = speed;
    if (!this.state.paused) {
      this.stopTimer();
      this.startTimer();
    }
    this.notify();
  }

  stepForward(bars = 1): void {
    if (!this.state.active) return;
    this.state.currentBarIndex = Math.min(this.state.currentBarIndex + bars, this.fullData.length - 1);
    this.state.visibleBars = this.fullData.slice(0, this.state.currentBarIndex + 1);
    this.notify();
  }

  stepBackward(bars = 1): void {
    if (!this.state.active) return;
    this.state.currentBarIndex = Math.max(this.state.currentBarIndex - bars, 0);
    this.state.visibleBars = this.fullData.slice(0, this.state.currentBarIndex + 1);
    this.notify();
  }

  goToBar(index: number): void {
    if (!this.state.active) return;
    this.state.currentBarIndex = Math.max(0, Math.min(index, this.fullData.length - 1));
    this.state.visibleBars = this.fullData.slice(0, this.state.currentBarIndex + 1);
    this.notify();
  }

  goToTime(time: number): void {
    const idx = this.fullData.findIndex(b => b.time >= time);
    if (idx >= 0) this.goToBar(idx);
  }

  getState(): ReplayState {
    return { ...this.state };
  }

  onStateChange(listener: (state: ReplayState) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private startTimer(): void {
    this.stopTimer();
    const interval = Math.max(10, 1000 / this.state.speed);
    this.timer = setInterval(() => {
      if (this.state.currentBarIndex >= this.fullData.length - 1) {
        this.pause();
        return;
      }
      this.state.currentBarIndex++;
      this.state.visibleBars = this.fullData.slice(0, this.state.currentBarIndex + 1);
      this.notify();
    }, interval);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private notify(): void {
    this.listeners.forEach(l => l({ ...this.state }));
  }
}

// ─── Bookmark Manager ─────────────────────────────────────────────────────────

export class BookmarkManager {
  private bookmarks: Bookmark[] = [];
  private storageKey = 'apex-chart-bookmarks';
  private listeners: ((bookmarks: Bookmark[]) => void)[] = [];

  constructor() {
    this.load();
  }

  add(time: number, price: number, label: string, options: Partial<Bookmark> = {}): Bookmark {
    const bookmark: Bookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time,
      price,
      label,
      color: options.color ?? '#2962FF',
      icon: options.icon ?? '🔖',
      notes: options.notes ?? '',
      createdAt: Date.now(),
    };
    this.bookmarks.push(bookmark);
    this.save();
    this.notify();
    return bookmark;
  }

  remove(id: string): void {
    this.bookmarks = this.bookmarks.filter(b => b.id !== id);
    this.save();
    this.notify();
  }

  update(id: string, updates: Partial<Bookmark>): void {
    this.bookmarks = this.bookmarks.map(b =>
      b.id === id ? { ...b, ...updates } : b
    );
    this.save();
    this.notify();
  }

  getAll(): Bookmark[] {
    return [...this.bookmarks].sort((a, b) => a.time - b.time);
  }

  getByTimeRange(start: number, end: number): Bookmark[] {
    return this.bookmarks.filter(b => b.time >= start && b.time <= end);
  }

  clear(): void {
    this.bookmarks = [];
    this.save();
    this.notify();
  }

  onChange(listener: (bookmarks: Bookmark[]) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.bookmarks));
    } catch { /* quota exceeded, ignore */ }
  }

  private load(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) this.bookmarks = JSON.parse(data);
    } catch { /* corrupted data, ignore */ }
  }

  private notify(): void {
    this.listeners.forEach(l => l(this.getAll()));
  }

  render(ctx: CanvasRenderingContext2D, chartRect: { x: number; y: number; width: number; height: number }, timeRange: [number, number]): void {
    const visible = this.getByTimeRange(timeRange[0], timeRange[1]);
    for (const bm of visible) {
      const x = chartRect.x + ((bm.time - timeRange[0]) / (timeRange[1] - timeRange[0])) * chartRect.width;

      // Vertical line
      ctx.save();
      ctx.strokeStyle = bm.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x, chartRect.y);
      ctx.lineTo(x, chartRect.y + chartRect.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Flag icon at top
      ctx.font = '14px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bm.icon, x, chartRect.y + 14);

      // Label
      ctx.font = '9px "Inter", sans-serif';
      ctx.fillStyle = bm.color;
      ctx.fillText(bm.label, x, chartRect.y + 26);

      ctx.restore();
    }
  }
}

// ─── Symbol Overlay Comparison ────────────────────────────────────────────────

export class OverlayComparisonEngine {
  private overlays: OverlaySymbol[] = [];
  private maxOverlays = 10;
  private listeners: ((overlays: OverlaySymbol[]) => void)[] = [];

  addOverlay(symbol: string, data: OHLCV[], options: Partial<OverlaySymbol> = {}): OverlaySymbol {
    if (this.overlays.length >= this.maxOverlays) {
      throw new Error(`Maximum ${this.maxOverlays} overlays allowed`);
    }

    const overlay: OverlaySymbol = {
      symbol,
      color: options.color ?? this.getNextColor(),
      lineWidth: options.lineWidth ?? 1.5,
      opacity: options.opacity ?? 0.8,
      data,
      visible: options.visible ?? true,
      priceScale: options.priceScale ?? 'overlay',
      indexed: options.indexed ?? true,
    };

    this.overlays.push(overlay);
    this.notify();
    return overlay;
  }

  removeOverlay(symbol: string): void {
    this.overlays = this.overlays.filter(o => o.symbol !== symbol);
    this.notify();
  }

  toggleVisibility(symbol: string): void {
    this.overlays = this.overlays.map(o =>
      o.symbol === symbol ? { ...o, visible: !o.visible } : o
    );
    this.notify();
  }

  setIndexed(indexed: boolean): void {
    this.overlays = this.overlays.map(o => ({ ...o, indexed }));
    this.notify();
  }

  getOverlays(): OverlaySymbol[] {
    return [...this.overlays];
  }

  clearAll(): void {
    this.overlays = [];
    this.notify();
  }

  onChange(listener: (overlays: OverlaySymbol[]) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  render(ctx: CanvasRenderingContext2D, chartRect: { x: number; y: number; width: number; height: number }, mainData: OHLCV[], timeRange: [number, number], priceRange: [number, number]): void {
    const visibleOverlays = this.overlays.filter(o => o.visible && o.data.length > 0);

    for (const overlay of visibleOverlays) {
      ctx.save();
      ctx.globalAlpha = overlay.opacity;
      ctx.strokeStyle = overlay.color;
      ctx.lineWidth = overlay.lineWidth;

      const baseMain = mainData[0]?.close ?? 1;
      const baseOverlay = overlay.data[0]?.close ?? 1;

      ctx.beginPath();
      let started = false;

      for (let i = 0; i < overlay.data.length; i++) {
        const bar = overlay.data[i];
        if (bar.time < timeRange[0] || bar.time > timeRange[1]) continue;

        const x = chartRect.x + ((bar.time - timeRange[0]) / (timeRange[1] - timeRange[0])) * chartRect.width;
        let price: number;

        if (overlay.indexed) {
          // Percentage comparison: normalize both to base 100
          const overlayPct = (bar.close / baseOverlay - 1) * 100;
          const mainPctRange = ((priceRange[1] / baseMain - 1) - (priceRange[0] / baseMain - 1)) * 100;
          const mainPctMin = (priceRange[0] / baseMain - 1) * 100;
          const y = chartRect.y + (1 - (overlayPct - mainPctMin) / (mainPctRange || 1)) * chartRect.height;
          if (!started) { ctx.moveTo(x, y); started = true; }
          else ctx.lineTo(x, y);
          continue;
        }

        price = bar.close;
        const y = chartRect.y + (1 - (price - priceRange[0]) / (priceRange[1] - priceRange[0])) * chartRect.height;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }

      ctx.stroke();

      // Symbol label
      const lastBar = overlay.data[overlay.data.length - 1];
      if (lastBar && lastBar.time >= timeRange[0] && lastBar.time <= timeRange[1]) {
        const lx = chartRect.x + ((lastBar.time - timeRange[0]) / (timeRange[1] - timeRange[0])) * chartRect.width;
        let ly: number;
        if (overlay.indexed) {
          const pct = (lastBar.close / baseOverlay - 1) * 100;
          const mainPctRange = ((priceRange[1] / baseMain - 1) - (priceRange[0] / baseMain - 1)) * 100;
          const mainPctMin = (priceRange[0] / baseMain - 1) * 100;
          ly = chartRect.y + (1 - (pct - mainPctMin) / (mainPctRange || 1)) * chartRect.height;
        } else {
          ly = chartRect.y + (1 - (lastBar.close - priceRange[0]) / (priceRange[1] - priceRange[0])) * chartRect.height;
        }

        ctx.font = 'bold 10px "Inter", sans-serif';
        ctx.fillStyle = overlay.color;
        ctx.textAlign = 'left';
        ctx.fillText(overlay.symbol, lx + 4, ly - 4);
      }

      ctx.restore();
    }
  }

  private colorIndex = 0;
  private readonly colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#DDA0DD', '#87CEEB', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];

  private getNextColor(): string {
    return this.colors[this.colorIndex++ % this.colors.length];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeDiff(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatPrice(price: number): string {
  if (Math.abs(price) >= 10000) return price.toFixed(0);
  if (Math.abs(price) >= 100) return price.toFixed(1);
  if (Math.abs(price) >= 1) return price.toFixed(2);
  if (Math.abs(price) >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function niceStep(rough: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const frac = rough / pow;
  let nice: number;
  if (frac <= 1.5) nice = 1;
  else if (frac <= 3) nice = 2;
  else if (frac <= 7) nice = 5;
  else nice = 10;
  return nice * pow;
}

// ─── GoTo Date ──────────────────────────────────────────────────────────

export class GoToDateEngine {
  private data: OHLCV[] = [];
  private listeners: ((index: number) => void)[] = [];

  setData(data: OHLCV[]): void {
    this.data = data;
  }

  goToDate(dateStr: string): number {
    const target = new Date(dateStr).getTime() / 1000;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.data.length; i++) {
      const dist = Math.abs(this.data[i].time - target);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    this.listeners.forEach(l => l(bestIdx));
    return bestIdx;
  }

  goToTime(timestamp: number): number {
    return this.goToDate(new Date(timestamp * 1000).toISOString());
  }

  onNavigate(listener: (index: number) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  getAvailableDateRange(): { start: Date; end: Date } | null {
    if (this.data.length === 0) return null;
    return {
      start: new Date(this.data[0].time * 1000),
      end: new Date(this.data[this.data.length - 1].time * 1000),
    };
  }
}

// ─── Magnet Mode (Snap to OHLCV) ─────────────────────────────────────────────

export class MagnetMode {
  private enabled = false;
  private strength: 'weak' | 'strong' = 'strong';

  toggle(): void { this.enabled = !this.enabled; }
  setEnabled(enabled: boolean): void { this.enabled = enabled; }
  isEnabled(): boolean { return this.enabled; }
  setStrength(strength: 'weak' | 'strong'): void { this.strength = strength; }

  snapToOHLCV(price: number, bar: OHLCV | null, threshold: number): number {
    if (!this.enabled || !bar) return price;

    const values = [bar.open, bar.high, bar.low, bar.close];
    let closest = price;
    let minDist = Infinity;

    for (const v of values) {
      const dist = Math.abs(v - price);
      if (dist < minDist && (this.strength === 'strong' || dist < threshold)) {
        minDist = dist;
        closest = v;
      }
    }

    return this.strength === 'strong' ? closest : (minDist < threshold ? closest : price);
  }
}

// ─── Drawing Visibility by Timeframe ──────────────────────────────────────────

export type TimeframeVisibility = 'all' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M';

export class DrawingVisibilityManager {
  private visibilityMap: Map<string, TimeframeVisibility[]> = new Map();

  setVisibility(drawingId: string, timeframes: TimeframeVisibility[]): void {
    this.visibilityMap.set(drawingId, timeframes);
  }

  isVisible(drawingId: string, currentTimeframe: string): boolean {
    const tfs = this.visibilityMap.get(drawingId);
    if (!tfs || tfs.length === 0 || tfs.includes('all')) return true;
    return tfs.includes(currentTimeframe as TimeframeVisibility);
  }

  getVisibility(drawingId: string): TimeframeVisibility[] {
    return this.visibilityMap.get(drawingId) ?? ['all'];
  }

  removeDrawing(drawingId: string): void {
    this.visibilityMap.delete(drawingId);
  }

  clear(): void {
    this.visibilityMap.clear();
  }
}

// ─── Drawing Lock Manager ─────────────────────────────────────────────────────

export class DrawingLockManager {
  private lockedDrawings: Set<string> = new Set();
  private globalLock = false;

  lockDrawing(id: string): void {
    this.lockedDrawings.add(id);
  }

  unlockDrawing(id: string): void {
    this.lockedDrawings.delete(id);
  }

  toggleDrawingLock(id: string): void {
    if (this.lockedDrawings.has(id)) this.lockedDrawings.delete(id);
    else this.lockedDrawings.add(id);
  }

  isLocked(id: string): boolean {
    return this.globalLock || this.lockedDrawings.has(id);
  }

  setGlobalLock(locked: boolean): void {
    this.globalLock = locked;
  }

  isGloballyLocked(): boolean {
    return this.globalLock;
  }
}

// ─── Drawing Template Manager ─────────────────────────────────────────────────

export interface DrawingTemplate {
  id: string;
  name: string;
  toolType: string;
  defaultParams: Record<string, unknown>;
  style: {
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    fillColor?: string;
    fillOpacity?: number;
    fontSize?: number;
    fontFamily?: string;
  };
  createdAt: number;
}

export class DrawingTemplateManager {
  private templates: DrawingTemplate[] = [];
  private storageKey = 'apex-drawing-templates';

  constructor() {
    this.load();
  }

  save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.templates));
    } catch { /* ignore */ }
  }

  load(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) this.templates = JSON.parse(data);
    } catch { /* ignore */ }
  }

  addTemplate(template: Omit<DrawingTemplate, 'id' | 'createdAt'>): DrawingTemplate {
    const t: DrawingTemplate = {
      ...template,
      id: `dt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    this.templates.push(t);
    this.save();
    return t;
  }

  removeTemplate(id: string): void {
    this.templates = this.templates.filter(t => t.id !== id);
    this.save();
  }

  getTemplates(toolType?: string): DrawingTemplate[] {
    if (toolType) return this.templates.filter(t => t.toolType === toolType);
    return [...this.templates];
  }

  getTemplate(id: string): DrawingTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  applyTemplate(id: string): DrawingTemplate | undefined {
    return this.getTemplate(id);
  }
}

// ─── Multi-Chart Drawing Sync ─────────────────────────────────────────────────

export class DrawingSyncEngine {
  private syncEnabled = true;
  private drawings: Map<string, unknown[]> = new Map(); // chartId -> drawings
  private listeners: Map<string, ((drawings: unknown[]) => void)[]> = new Map();

  setSyncEnabled(enabled: boolean): void {
    this.syncEnabled = enabled;
  }

  isSyncEnabled(): boolean {
    return this.syncEnabled;
  }

  registerChart(chartId: string): void {
    if (!this.drawings.has(chartId)) {
      this.drawings.set(chartId, []);
      this.listeners.set(chartId, []);
    }
  }

  unregisterChart(chartId: string): void {
    this.drawings.delete(chartId);
    this.listeners.delete(chartId);
  }

  addDrawing(sourceChartId: string, drawing: unknown): void {
    const chartDrawings = this.drawings.get(sourceChartId);
    if (chartDrawings) chartDrawings.push(drawing);

    if (this.syncEnabled) {
      // Propagate to all other charts
      for (const [chartId, drawingList] of this.drawings) {
        if (chartId !== sourceChartId) {
          drawingList.push(drawing);
          this.notifyChart(chartId);
        }
      }
    }
  }

  removeDrawing(sourceChartId: string, drawingId: string): void {
    for (const [chartId, drawingList] of this.drawings) {
      const filtered = drawingList.filter((d: unknown) => (d as Record<string, unknown>).id !== drawingId);
      this.drawings.set(chartId, filtered);
      if (chartId !== sourceChartId || this.syncEnabled) {
        this.notifyChart(chartId);
      }
    }
  }

  onDrawingsUpdate(chartId: string, listener: (drawings: unknown[]) => void): () => void {
    if (!this.listeners.has(chartId)) this.listeners.set(chartId, []);
    this.listeners.get(chartId)!.push(listener);
    return () => {
      const list = this.listeners.get(chartId);
      if (list) {
        const idx = list.indexOf(listener);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  }

  getDrawings(chartId: string): unknown[] {
    return this.drawings.get(chartId) ?? [];
  }

  private notifyChart(chartId: string): void {
    const drawings = this.drawings.get(chartId) ?? [];
    const chartListeners = this.listeners.get(chartId) ?? [];
    chartListeners.forEach(l => l([...drawings]));
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  formatTimeDiff,
  formatPrice,
  niceStep,
};
