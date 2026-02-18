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

interface IVTermStructureProps {
  symbol: string;
  strike?: number;
}

export const IVTermStructure = ({ symbol }: IVTermStructureProps) => {
  const { termStructure, termStructureLoading } = useOptionsStore();

  const chartData = useMemo(() => {
    if (!termStructure || !termStructure.daysToExpiration || termStructure.daysToExpiration.length === 0) {
      return { labels: [], datasets: [] };
    }

    return {
      labels: termStructure.daysToExpiration.map(dte => `${dte}d`),
      datasets: [
        {
          label: 'ATM IV',
          data: termStructure.ivs.map(iv => iv * 100),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
        },
      ],
    };
  }, [termStructure]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: `${symbol} IV Term Structure`,
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
            return `ATM IV: ${value}%`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Days to Expiration',
          color: '#9ca3af',
        },
        grid: {
          color: '#374151',
        },
        ticks: {
          color: '#9ca3af',
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

  if (termStructureLoading && chartData.labels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-gray-400 text-sm">Loading term structure...</div>
      </div>
    );
  }

  if (!termStructureLoading && chartData.labels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-gray-400 text-sm">No term structure data available</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 p-4">
      <Line data={chartData} options={options} />
    </div>
  );
};
