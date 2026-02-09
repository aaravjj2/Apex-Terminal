import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import { useOptionsStore } from './store';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface IVSkewChartProps {
  symbol: string;
  expiration: string;
  underlyingPrice?: number;
}

export const IVSkewChart = ({ symbol, expiration }: IVSkewChartProps) => {
  const { skew, skewLoading } = useOptionsStore();

  const chartData = useMemo(() => {
    if (!skew || !skew.strikes || skew.strikes.length === 0) {
      return { labels: [], datasets: [] };
    }

    return {
      labels: skew.strikes.map(s => s.toString()),
      datasets: [
        {
          label: 'Implied Volatility',
          data: skew.ivs.map(iv => iv * 100),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
          fill: true,
        }
      ],
    };
  }, [skew]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: `${symbol} Volatility Skew - ${expiration}`,
        color: '#f3f4f6',
        font: {
          size: 13,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f3f4f6',
        bodyColor: '#d1d5db',
        borderColor: '#374151',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y !== null ? context.parsed.y.toFixed(2) : '0.00';
            return `IV: ${value}%`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Strike Price',
          color: '#9ca3af',
        },
        grid: {
          color: '#374151',
        },
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 10,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Implied Volatility (%)',
          color: '#9ca3af',
        },
        grid: {
          color: '#374151',
        },
        ticks: {
          color: '#9ca3af',
          callback: (value) => `${value}%`,
        },
      },
    },
  };

  if (skewLoading && chartData.labels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-gray-400 text-sm">Loading IV skew...</div>
      </div>
    );
  }

  if (!skewLoading && chartData.labels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-gray-400 text-sm">No skew data available for this expiration.</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 p-4">
      <Line data={chartData} options={options} />
    </div>
  );
};
