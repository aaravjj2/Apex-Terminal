import { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../../state/store';
import type { Drawing } from '../../core/types';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

interface DrawingLayerProps {
    chart: IChartApi;
    series: ISeriesApi<"Candlestick">;
}

export const DrawingLayer = ({ chart, series }: DrawingLayerProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { activeTool, addDrawing, drawings, setTool } = useStore();
    const [currentDrawing, setCurrentDrawing] = useState<Partial<Drawing> | null>(null);

    // Convert lightweight-charts coordinates to pixel coordinates
    const timeToX = useCallback((time: number) => {
        if (!chart) return 0;
        return chart.timeScale().timeToCoordinate(time / 1000 as Time) ?? 0;
    }, [chart]);

    const priceToY = useCallback((price: number) => {
        if (!series) return 0;
        return series.priceToCoordinate(price) ?? 0;
    }, [series]);

    // Convert pixel to chart coordinates
    const xToTime = useCallback((x: number) => {
        if (!chart) return 0;
        // This is tricky: lightweight-charts 3.x/4.x/5.x coordinateToTime
        // timeScale().coordinateToTime returns logical index or time? 
        // In 4.x+ it returns time.
        const time = chart.timeScale().coordinateToTime(x);
        return (time as number) * 1000;
    }, [chart]);

    const yToPrice = useCallback((y: number) => {
        if (!series) return 0;
        return series.coordinateToPrice(y) ?? 0;
    }, [series]);

    // Render drawings
    const render = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Resolution correction
        // Assuming canvas width/height set by resize observer

        // Helper to draw
        const drawShape = (d: Drawing | Partial<Drawing>, isPreview = false) => {
            if (!d.points || d.points.length === 0) return;
            const points = d.points;

            ctx.strokeStyle = isPreview ? '#3b82f6' : (d.color || '#3b82f6');
            ctx.lineWidth = 2; // Fixed width for now
            ctx.beginPath();

            const startX = timeToX(points[0].time);
            const startY = priceToY(points[0].price);

            if (d.type === 'line' || d.type === 'ray') {
                if (points.length < 2) return;
                const endX = timeToX(points[1].time);
                const endY = priceToY(points[1].price);

                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                // Ray extension (simplistic)
                if (d.type === 'ray') {
                    // extended line beyond end
                    const angle = Math.atan2(endY - startY, endX - startX);
                    const dist = 5000;
                    ctx.lineTo(endX + Math.cos(angle) * dist, endY + Math.sin(angle) * dist);
                    ctx.stroke();
                }
            } else if (d.type === 'rect') {
                if (points.length < 2) return;
                const endX = timeToX(points[1].time);
                const endY = priceToY(points[1].price);

                const w = endX - startX;
                const h = endY - startY;

                ctx.fillStyle = isPreview ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.2)';
                ctx.fillRect(startX, startY, w, h);
                ctx.strokeRect(startX, startY, w, h);
            } else if (d.type === 'hline') {
                // Price line
                ctx.moveTo(0, startY);
                ctx.lineTo(canvas.width, startY);
                ctx.stroke();
            } else if (d.type === 'vline') {
                // Time line
                ctx.moveTo(startX, 0);
                ctx.lineTo(startX, canvas.height);
                ctx.stroke();
            } else if (d.type === 'text') {
                ctx.fillStyle = '#ffffff';
                ctx.font = '12px sans-serif';
                ctx.fillText(d.text || 'Text', startX, startY);
            }
        };

        // Draw saved
        drawings.forEach(d => drawShape(d));

        // Draw current
        if (currentDrawing) {
            drawShape(currentDrawing, true);
        }
    }, [drawings, currentDrawing, timeToX, priceToY]);

    // Event Loop
    useEffect(() => {
        let animId: number;
        const loop = () => {
            render();
            animId = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(animId);
    }, [render]);

    // Resize handling
    useEffect(() => {
        const handleResize = () => {
            // Sync canvas size to container
            if (canvasRef.current && containerRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = containerRef.current.clientHeight;
            }
        };
        window.addEventListener('resize', handleResize);
        // Initial size
        handleResize();
        // Resize observer
        const ro = new ResizeObserver(handleResize);
        if (containerRef.current) ro.observe(containerRef.current);

        return () => {
            window.removeEventListener('resize', handleResize);
            ro.disconnect();
        };
    }, []);


    // Mouse Interactions
    const handleMouseDown = (e: React.MouseEvent) => {
        if (activeTool === 'cursor') return;
        if (!canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const time = xToTime(x);
        const price = yToPrice(y);

        if (!currentDrawing) {
            // Start Drawing
            setCurrentDrawing({
                type: activeTool,
                points: [{ time, price }],
                color: '#3b82f6'
            });
        } else {
            // Finish Drawing (for 2-point tools)
            if (['line', 'ray', 'rect'].includes(activeTool)) {
                const newDrawing = {
                    ...currentDrawing,
                    id: Math.random().toString(36).substr(2, 9),
                    points: [...(currentDrawing.points || []), { time, price }],
                    // Ensure color and text are set if missing from partial
                    color: currentDrawing.color || '#3b82f6'
                } as Drawing;
                addDrawing(newDrawing);
                setCurrentDrawing(null);
                // Keep tool active? User pref. Reset for now.
                setTool('cursor');
            }
        }

        // Single point tools
        if (['hline', 'vline', 'text'].includes(activeTool) && !currentDrawing) {
            const newDrawing = {
                type: activeTool,
                id: Math.random().toString(36).substr(2, 9),
                points: [{ time, price }],
                color: activeTool === 'text' ? '#ffffff' : '#ef4444',
                text: activeTool === 'text' ? 'Note' : undefined
            } as Drawing;
            addDrawing(newDrawing);
            setCurrentDrawing(null);
            setTool('cursor');
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!currentDrawing || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const time = xToTime(x);
        const price = yToPrice(y);

        // Update preview end point
        if (['line', 'ray', 'rect'].includes(currentDrawing.type || '')) {
            setCurrentDrawing(prev => ({
                ...prev,
                points: [prev!.points![0], { time, price }]
            }));
        }
    };

    return (
        <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none">
            <canvas
                ref={canvasRef}
                data-testid="drawing-layer"
                className={`w-full h-full ${activeTool !== 'cursor' ? 'pointer-events-auto cursor-crosshair' : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
            />
        </div>
    );
};
