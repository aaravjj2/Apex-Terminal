/**
 * Strategy Payoff Chart
 * Visualizes P/L at different underlying prices
 */

import React, { useMemo, useRef, useEffect } from 'react';
import type { StrategyAnalysis } from '../types';

interface PayoffChartProps {
  strategy: StrategyAnalysis;
  width?: number;
  height?: number;
  className?: string;
  showTheoretical?: boolean;
}

export const PayoffChart: React.FC<PayoffChartProps> = ({
  strategy,
  width = 400,
  height = 200,
  className = '',
  showTheoretical = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Chart metrics
  const metrics = useMemo(() => {
    const prices = strategy.priceRange;
    const expPayoff = strategy.expirationPayoff;
    const theoPayoff = strategy.theoreticalPayoff;
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    const allPayoffs = [...expPayoff, ...theoPayoff];
    const minPayoff = Math.min(...allPayoffs, 0);
    const maxPayoff = Math.max(...allPayoffs, 0);
    
    // Add padding to payoff range
    const payoffPadding = (maxPayoff - minPayoff) * 0.1;
    
    return {
      minPrice,
      maxPrice,
      minPayoff: minPayoff - payoffPadding,
      maxPayoff: maxPayoff + payoffPadding,
      prices,
      expPayoff,
      theoPayoff,
    };
  }, [strategy]);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = width;
    const h = height;
    
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Margins
    const margin = { top: 10, right: 10, bottom: 25, left: 50 };
    const chartW = w - margin.left - margin.right;
    const chartH = h - margin.top - margin.bottom;

    // Scale functions
    const scaleX = (price: number) => 
      margin.left + ((price - metrics.minPrice) / (metrics.maxPrice - metrics.minPrice)) * chartW;
    const scaleY = (payoff: number) => 
      margin.top + chartH - ((payoff - metrics.minPayoff) / (metrics.maxPayoff - metrics.minPayoff)) * chartH;

    // Clear
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, w, h);

    // Zero line
    const zeroY = scaleY(0);
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(w - margin.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Current price line
    const currentX = scaleX(strategy.underlyingPrice);
    ctx.strokeStyle = '#6b7280';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(currentX, margin.top);
    ctx.lineTo(currentX, h - margin.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Breakeven lines
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1;
    strategy.breakevens.forEach(be => {
      const beX = scaleX(be);
      ctx.beginPath();
      ctx.moveTo(beX, margin.top);
      ctx.lineTo(beX, h - margin.bottom);
      ctx.stroke();
    });

    // Theoretical payoff (if showing)
    if (showTheoretical) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      metrics.prices.forEach((price, i) => {
        const x = scaleX(price);
        const y = scaleY(metrics.theoPayoff[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Expiration payoff
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    metrics.prices.forEach((price, i) => {
      const x = scaleX(price);
      const y = scaleY(metrics.expPayoff[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill profit area
    ctx.beginPath();
    let startedProfit = false;
    metrics.prices.forEach((price, i) => {
      const x = scaleX(price);
      const payoff = metrics.expPayoff[i];
      const y = scaleY(payoff);
      
      if (payoff > 0) {
        if (!startedProfit) {
          ctx.moveTo(x, zeroY);
          startedProfit = true;
        }
        ctx.lineTo(x, y);
      } else if (startedProfit) {
        ctx.lineTo(x, zeroY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
        ctx.fill();
        ctx.beginPath();
        startedProfit = false;
      }
    });
    if (startedProfit) {
      ctx.lineTo(scaleX(metrics.maxPrice), zeroY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
      ctx.fill();
    }

    // Fill loss area
    ctx.beginPath();
    let startedLoss = false;
    metrics.prices.forEach((price, i) => {
      const x = scaleX(price);
      const payoff = metrics.expPayoff[i];
      const y = scaleY(payoff);
      
      if (payoff < 0) {
        if (!startedLoss) {
          ctx.moveTo(x, zeroY);
          startedLoss = true;
        }
        ctx.lineTo(x, y);
      } else if (startedLoss) {
        ctx.lineTo(x, zeroY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fill();
        ctx.beginPath();
        startedLoss = false;
      }
    });
    if (startedLoss) {
      ctx.lineTo(scaleX(metrics.maxPrice), zeroY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.fill();
    }

    // X-axis labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    
    const xLabels = [metrics.minPrice, strategy.underlyingPrice, metrics.maxPrice];
    xLabels.forEach(price => {
      ctx.fillText(`$${price.toFixed(0)}`, scaleX(price), h - 5);
    });

    // Y-axis labels
    ctx.textAlign = 'right';
    const yLabels = [metrics.minPayoff, 0, metrics.maxPayoff];
    yLabels.forEach(payoff => {
      const y = scaleY(payoff);
      if (y > margin.top && y < h - margin.bottom) {
        ctx.fillText(`$${payoff.toFixed(0)}`, margin.left - 5, y + 3);
      }
    });

  }, [metrics, width, height, strategy, showTheoretical]);

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} />
    </div>
  );
};

interface StrategyMetricsProps {
  strategy: StrategyAnalysis;
  className?: string;
}

export const StrategyMetrics: React.FC<StrategyMetricsProps> = ({ strategy, className = '' }) => {
  const formatProfit = (value: number): string => {
    if (value === 999999999 || value === Infinity) return 'Unlimited';
    if (value === -999999999 || value === -Infinity) return 'Unlimited';
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      <div className="bg-gray-700 rounded p-2">
        <div className="text-xs text-gray-400">Max Profit</div>
        <div className="text-sm font-semibold text-green-400">
          {formatProfit(strategy.maxProfit)}
        </div>
      </div>
      
      <div className="bg-gray-700 rounded p-2">
        <div className="text-xs text-gray-400">Max Loss</div>
        <div className="text-sm font-semibold text-red-400">
          {formatProfit(Math.abs(strategy.maxLoss))}
        </div>
      </div>
      
      <div className="bg-gray-700 rounded p-2">
        <div className="text-xs text-gray-400">Breakevens</div>
        <div className="text-sm font-semibold text-yellow-400">
          {strategy.breakevens.length > 0 
            ? strategy.breakevens.map(b => `$${b.toFixed(2)}`).join(', ')
            : 'None'}
        </div>
      </div>
      
      <div className="bg-gray-700 rounded p-2">
        <div className="text-xs text-gray-400">Current Price</div>
        <div className="text-sm font-semibold text-gray-200">
          ${strategy.underlyingPrice.toFixed(2)}
        </div>
      </div>
    </div>
  );
};

export default PayoffChart;
