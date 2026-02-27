// Bloomberg IVSC — IV Skew Chart
const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const SUBTLE = '#555';
const TEXT = '#d1d4dc';
const MONO = '"Roboto Mono","Courier New",monospace';

import { useMemo } from 'react';
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import { useOptionsStore } from './store';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface IVSkewChartProps {
  symbol: string;
  expiration: string;
  underlyingPrice?: number;
}

export const IVSkewChart = ({ symbol, expiration }: IVSkewChartProps) => {
  const { skew, skewLoading } = useOptionsStore();

  const chartData = useMemo(() => {
    if (!skew?.strikes?.length) return { labels: [], datasets: [] };
    return {
      labels: skew.strikes.map(s => s.toString()),
      datasets: [{
        label: 'Implied Volatility',
        data: skew.ivs.map(iv => iv * 100),
        borderColor: BLUE,
        backgroundColor: BLUE + '22',
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: true,
        borderWidth: 1.5,
      }],
    };
  }, [skew]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: `${symbol} VOL SKEW — ${expiration}`,
        color: AMBER,
        font: { size: 10, family: MONO, weight: 'bold' },
      },
      tooltip: {
        mode: 'index', intersect: false,
        backgroundColor: PANEL, titleColor: AMBER, bodyColor: TEXT,
        borderColor: BORDER, borderWidth: 1,
        callbacks: { label: ctx => `IV: ${ctx.parsed.y?.toFixed(2) ?? '0.00'}%` },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'STRIKE', color: SUBTLE, font: { size: 8, family: MONO } },
        grid: { color: BORDER },
        ticks: { color: SUBTLE, maxTicksLimit: 10, font: { size: 8, family: MONO } },
      },
      y: {
        title: { display: true, text: 'IV (%)', color: SUBTLE, font: { size: 8, family: MONO } },
        grid: { color: BORDER },
        ticks: { color: SUBTLE, callback: v => `${v}%`, font: { size: 8, family: MONO } },
      },
    },
  };

  if (skewLoading && !chartData.labels.length) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', background:BG, fontFamily:MONO }}>
        <span style={{ color:SUBTLE, fontSize:10 }}>LOADING IV SKEW...</span>
      </div>
    );
  }

  if (!skewLoading && !chartData.labels.length) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', background:BG, fontFamily:MONO }}>
        <span style={{ color:SUBTLE, fontSize:10 }}>NO SKEW DATA FOR THIS EXPIRATION</span>
      </div>
    );
  }

  return (
    <div style={{ height:'100%', background:BG, padding:12, boxSizing:'border-box' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};
