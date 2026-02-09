export class LinearScale {
    private min: number;
    private max: number;
    private height: number;
    private top: number;

    constructor(min: number, max: number, height: number, top: number) {
        this.min = min;
        this.max = max;
        this.height = height;
        this.top = top;
    }

    toPixels(value: number): number {
        const range = this.max - this.min;
        if (range === 0) return this.top + this.height / 2;
        const ratio = (value - this.min) / range;
        return this.top + this.height * (1 - ratio);
    }

    fromPixels(pixel: number): number {
        const range = this.max - this.min;
        if (range === 0) return this.min;
        const ratio = 1 - (pixel - this.top) / this.height;
        return this.min + ratio * range;
    }
}

export class TimeScale {
    private startIndex: number;
    private visibleCount: number;
    private width: number;

    constructor(startIndex: number, visibleCount: number, width: number) {
        this.startIndex = startIndex;
        this.visibleCount = Math.max(1, visibleCount);
        this.width = width;
    }

    private barWidth(): number {
        return this.width / this.visibleCount;
    }

    indexToPixels(index: number): number {
        const half = this.barWidth() / 2;
        return (index - this.startIndex) * this.barWidth() + half;
    }

    pixelsToIndex(pixel: number): number {
        const half = this.barWidth() / 2;
        return (pixel - half) / this.barWidth() + this.startIndex;
    }
}
