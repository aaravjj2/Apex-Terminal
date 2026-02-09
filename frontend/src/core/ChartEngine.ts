type Candle = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

type ChartEngineOptions = {
    width: number;
    height: number;
};

export class ChartEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D | null;
    private width: number;
    private height: number;
    private data: Candle[] = [];
    private frameId: number | null = null;
    private running = false;
    private isDragging = false;
    private lastX = 0;
    private scrollOffset = 0;
    private defaultVisibleCount = 50;

    private handleMouseDown = (event: MouseEvent) => {
        this.isDragging = true;
        this.lastX = event.clientX;
    };

    private handleMouseMoveWindow = (event: MouseEvent) => {
        if (!this.isDragging) return;
        const dx = event.clientX - this.lastX;
        this.lastX = event.clientX;
        this.scrollOffset -= dx / this.barWidth();
        this.render();
    };

    private handleMouseUp = () => {
        this.isDragging = false;
    };

    private handleMouseMoveCanvas = (event: MouseEvent) => {
        if (this.isDragging) {
            this.handleMouseMoveWindow(event);
            return;
        }
        if (!this.ctx || this.data.length === 0) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const { startIndex } = this.visibleRange();
        const index = Math.floor(x / this.barWidth());
        const dataIndex = Math.min(
            Math.max(startIndex + index, 0),
            this.data.length - 1
        );
        const candle = this.data[dataIndex];
        if (!candle) return;
        this.ctx.fillText(
            `O: ${candle.open} H: ${candle.high} L: ${candle.low} C: ${candle.close}`,
            Math.max(0, x + 8),
            16
        );
    };

    constructor(canvas: HTMLCanvasElement, options: ChartEngineOptions) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = options.width;
        this.height = options.height;
        this.resize(options.width, options.height);
        this.render();
    }

    resize(width: number, height: number) {
        this.width = width;
        this.height = height;
        const pixelRatio = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(width * pixelRatio);
        this.canvas.height = Math.round(height * pixelRatio);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        if (this.ctx && pixelRatio !== 1 && typeof this.ctx.scale === 'function') {
            this.ctx.scale(pixelRatio, pixelRatio);
        }
        this.render();
    }

    setData(data: Candle[]) {
        this.data = data;
        this.render();
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.attachEvents();
        this.loop();
    }

    stop() {
        this.running = false;
        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        this.detachEvents();
    }

    private attachEvents() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMoveCanvas);
        window.addEventListener('mousemove', this.handleMouseMoveWindow);
        window.addEventListener('mouseup', this.handleMouseUp);
    }

    private detachEvents() {
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMoveCanvas);
        window.removeEventListener('mousemove', this.handleMouseMoveWindow);
        window.removeEventListener('mouseup', this.handleMouseUp);
    }

    private loop() {
        if (!this.running) return;
        this.render();
        this.frameId = requestAnimationFrame(() => this.loop());
    }

    private barWidth(): number {
        const count = Math.max(1, Math.min(this.data.length || this.defaultVisibleCount, this.defaultVisibleCount));
        return this.width / count;
    }

    private visibleRange() {
        const visibleCount = Math.max(
            1,
            Math.min(this.data.length || this.defaultVisibleCount, this.defaultVisibleCount)
        );
        const offset = Math.round(this.scrollOffset);
        const startIndex = Math.max(0, this.data.length - visibleCount - offset);
        return { startIndex, visibleCount };
    }

    private render() {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.fillRect(0, 0, this.width, this.height);

        if (this.data.length === 0) return;

        const { startIndex, visibleCount } = this.visibleRange();
        const endIndex = Math.min(startIndex + visibleCount, this.data.length);
        const visibleData = this.data.slice(startIndex, endIndex);
        if (visibleData.length === 0) return;

        const highs = visibleData.map((c) => c.high);
        const lows = visibleData.map((c) => c.low);
        const max = Math.max(...highs);
        const min = Math.min(...lows);
        const range = max - min || 1;
        const barWidth = this.barWidth();

        visibleData.forEach((candle, i) => {
            const x = i * barWidth + barWidth / 2;
            const openY = this.height - ((candle.open - min) / range) * this.height;
            const closeY = this.height - ((candle.close - min) / range) * this.height;
            const highY = this.height - ((candle.high - min) / range) * this.height;
            const lowY = this.height - ((candle.low - min) / range) * this.height;
            const bodyHeight = Math.max(1, Math.abs(openY - closeY));
            const bodyTop = Math.min(openY, closeY);

            ctx.fillRect(x - barWidth / 4, bodyTop, barWidth / 2, bodyHeight);
            ctx.beginPath();
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();
        });
    }
}
