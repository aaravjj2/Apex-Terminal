import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChartEngine } from '../../../src/core/ChartEngine';

describe('ChartEngine', () => {
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
        canvas = document.createElement('canvas');
        ctx = {
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            fillText: vi.fn(),
            scale: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            setLineDash: vi.fn(),
        } as unknown as CanvasRenderingContext2D;

        // Mock getContext
        canvas.getContext = vi.fn().mockReturnValue(ctx);

        // Mock RAF
        vi.stubGlobal('requestAnimationFrame', (fn: Function) => setTimeout(fn, 0));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());

        // Mock getBoundingClientRect
        canvas.getBoundingClientRect = vi.fn().mockReturnValue({
            left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => { }
        });
    });

    it('should initialize correctly', () => {
        const engine = new ChartEngine(canvas, { width: 800, height: 600 });
        expect(engine).toBeDefined();
        expect(canvas.width).toBe(800); // Assumes pixelRatio=1 in jsdom if not mocked
    });

    it('should resize correctly', () => {
        const engine = new ChartEngine(canvas, { width: 800, height: 600 });
        engine.resize(1024, 768);
        expect(canvas.style.width).toBe('1024px');
        expect(canvas.style.height).toBe('768px');
    });

    it('should start loop', () => {
        const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame');

        const engine = new ChartEngine(canvas, { width: 100, height: 100 });
        engine.start();

        expect(ctx.fillRect).toHaveBeenCalled(); // One render call
        expect(requestAnimationFrameSpy).toHaveBeenCalled(); // Scheduled next frame

        engine.stop();
    });

    it('should render candles', () => {
        const engine = new ChartEngine(canvas, { width: 400, height: 300 });
        const data = [
            { time: 1000, open: 10, high: 20, low: 5, close: 15, volume: 100 },
            { time: 2000, open: 15, high: 25, low: 10, close: 20, volume: 200 },
        ];

        // Clear initial render calls from constructor
        vi.clearAllMocks();

        engine.setData(data); // Triggers render

        // Should have called fillRect for: background + candle bodies + volume bars
        // Exact count depends on implementation (indicators, grids, etc.)
        expect(ctx.fillRect).toHaveBeenCalled();

        // Should have called stroke for: wicks + volume separator + other elements
        expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should pan on drag', () => {
        const engine = new ChartEngine(canvas, { width: 400, height: 300 });
        const data = Array.from({ length: 100 }, (_, i) => ({
            time: i * 1000, open: 10, high: 20, low: 5, close: 15, volume: 100
        }));
        engine.setData(data);
        engine.start();

        // Initial state
        // Drag logic depends on DOM events. 
        // We need to trigger them on canvas/window.

        // Mouse Down
        const mouseDown = new MouseEvent('mousedown', { clientX: 100, bubbles: true });
        canvas.dispatchEvent(mouseDown);

        // Mouse Move (Move left by 50px -> Pan right/future)
        // Wait, moving mouse LEFT (decreasing X) means dragging chart LEFT.
        // If chart moves LEFT, we see MORE future or less history?
        // Dragging LEFT (dx < 0) -> candlesMoved = -(-50) / pxPerCandle > 0.
        // scrollOffset increases. 
        // Increasing scrollOffset moves 'endIndex' to the left (indexes decrease).
        // So we see OLDER data (history).

        const mouseMove = new MouseEvent('mousemove', { clientX: 50, bubbles: true });
        window.dispatchEvent(mouseMove);

        // Mouse Up
        const mouseUp = new MouseEvent('mouseup', { bubbles: true });
        window.dispatchEvent(mouseUp);

        // Verify render called again
        // 1 initial render manually called in setData
        // +1 render in handleMouseMove

        vi.clearAllMocks();
        // Trigger move again
        const move2 = new MouseEvent('mousedown', { clientX: 50, bubbles: true });
        canvas.dispatchEvent(move2);
        const move3 = new MouseEvent('mousemove', { clientX: 0, bubbles: true });
        canvas.dispatchEvent(move3);


        expect(ctx.clearRect).toHaveBeenCalled();

        engine.stop();
    });

    it('should show tooltip on hover', () => {
        const engine = new ChartEngine(canvas, { width: 400, height: 300 });
        const data = [
            // 2 candles
            { time: 1000, open: 10, high: 20, low: 5, close: 15, volume: 100 },
            { time: 2000, open: 15, high: 25, low: 10, close: 20, volume: 200 },
        ];
        engine.setData(data);
        engine.start(); // binds events

        // Hover over 1st candle (index 0)
        // At width 400, count 50. barWidth = 8.
        // Index 0 x = 4 (halfWidth).
        const move = new MouseEvent('mousemove', { clientX: 4, clientY: 50, bubbles: true });

        // Clear mocks from initial render
        vi.clearAllMocks();

        // Dispatch on canvas directly as we did in implementation
        canvas.dispatchEvent(move);

        // Check if tooltip text rendered
        // "O: 10 H: 20 L: 5 C: 15"
        expect(ctx.fillText).toHaveBeenCalledWith(
            expect.stringContaining('O: 10'),
            expect.any(Number),
            expect.any(Number)
        );

        engine.stop();
    });
});
