import { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Plus, Trash2 } from 'lucide-react';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Leg {
  id: string;
  type: 'call' | 'put';
  action: 'buy' | 'sell';
  strike: number;
  quantity: number;
  premium: number;
}

interface StrategyBuilderProps {
  symbol: string;
  underlyingPrice: number;
}

export const STRATEGY_TEMPLATES = [
  { name: 'Covered Call', legs: [{ type: 'call', action: 'sell', strike: 0, quantity: 1, premium: 2 }] },
  { name: 'Protective Put', legs: [{ type: 'put', action: 'buy', strike: 0, quantity: 1, premium: 2 }] },
  {
    name: 'Bull Call Spread', legs: [
      { type: 'call', action: 'buy', strike: 0, quantity: 1, premium: 3 },
      { type: 'call', action: 'sell', strike: 5, quantity: 1, premium: 1 }
    ]
  },
  {
    name: 'Bear Put Spread', legs: [
      { type: 'put', action: 'buy', strike: 0, quantity: 1, premium: 3 },
      { type: 'put', action: 'sell', strike: -5, quantity: 1, premium: 1 }
    ]
  },
  {
    name: 'Iron Condor', legs: [
      { type: 'put', action: 'buy', strike: -10, quantity: 1, premium: 1 },
      { type: 'put', action: 'sell', strike: -5, quantity: 1, premium: 2 },
      { type: 'call', action: 'sell', strike: 5, quantity: 1, premium: 2 },
      { type: 'call', action: 'buy', strike: 10, quantity: 1, premium: 1 }
    ]
  },
  {
    name: 'Straddle', legs: [
      { type: 'call', action: 'buy', strike: 0, quantity: 1, premium: 3 },
      { type: 'put', action: 'buy', strike: 0, quantity: 1, premium: 3 }
    ]
  },
  {
    name: 'Strangle', legs: [
      { type: 'put', action: 'buy', strike: -2, quantity: 1, premium: 1.5 },
      { type: 'call', action: 'buy', strike: 2, quantity: 1, premium: 1.5 }
    ]
  },
  {
    name: 'Butterfly Spread', legs: [
      { type: 'call', action: 'buy', strike: -5, quantity: 1, premium: 0.5 },
      { type: 'call', action: 'sell', strike: 0, quantity: 2, premium: 1.5 },
      { type: 'call', action: 'buy', strike: 5, quantity: 1, premium: 0.5 }
    ]
  },
  {
    name: 'Calendar Spread', legs: [
      { type: 'call', action: 'buy', strike: 0, quantity: 1, premium: 2 },
      { type: 'call', action: 'sell', strike: 0, quantity: 1, premium: 1 }
    ]
  },
  {
    name: 'Collar', legs: [
      { type: 'call', action: 'sell', strike: 5, quantity: 1, premium: 1 },
      { type: 'put', action: 'buy', strike: -5, quantity: 1, premium: 1 }
    ]
  },
];

export const StrategyBuilder = ({ symbol, underlyingPrice }: StrategyBuilderProps) => {
  const [legs, setLegs] = useState<Leg[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  const addLeg = () => {
    const newLeg: Leg = {
      id: `leg_${Date.now()}`,
      type: 'call',
      action: 'buy',
      strike: underlyingPrice,
      quantity: 1,
      premium: 2,
    };
    setLegs([...legs, newLeg]);
  };

  const removeLeg = (id: string) => {
    setLegs(legs.filter(leg => leg.id !== id));
  };

  const updateLeg = (id: string, updates: Partial<Leg>) => {
    setLegs(legs.map(leg => (leg.id === id ? { ...leg, ...updates } : leg)));
  };

  const loadTemplate = (template: typeof STRATEGY_TEMPLATES[0]) => {
    const newLegs: Leg[] = template.legs.map((legTemplate, idx) => ({
      id: `leg_${Date.now()}_${idx}`,
      type: legTemplate.type as 'call' | 'put',
      action: legTemplate.action as 'buy' | 'sell',
      strike: underlyingPrice + legTemplate.strike,
      quantity: legTemplate.quantity,
      premium: legTemplate.premium,
    }));
    setLegs(newLegs);
    setShowTemplates(false);
  };

  // Calculate payoff for a single leg at a given price
  const calculateLegPayoff = (leg: Leg, price: number): number => {
    const isCall = leg.type === 'call';
    const isBuy = leg.action === 'buy';

    let intrinsicValue = 0;
    if (isCall) {
      intrinsicValue = Math.max(0, price - leg.strike);
    } else {
      intrinsicValue = Math.max(0, leg.strike - price);
    }

    const premiumCost = isBuy ? -leg.premium : leg.premium;
    const payoff = (isBuy ? intrinsicValue : -intrinsicValue) * leg.quantity;

    return (payoff + premiumCost * leg.quantity) * 100; // Convert to dollars
  };

  // Generate payoff chart data
  const payoffData = useMemo(() => {
    if (legs.length === 0) return { labels: [], datasets: [] };

    const strikes = legs.map(leg => leg.strike);
    const minStrike = Math.min(...strikes, underlyingPrice * 0.8);
    const maxStrike = Math.max(...strikes, underlyingPrice * 1.2);
    const range = maxStrike - minStrike;
    const step = range / 50;

    const prices: number[] = [];
    for (let price = minStrike; price <= maxStrike; price += step) {
      prices.push(price);
    }

    const payoffs = prices.map(price => {
      return legs.reduce((total, leg) => total + calculateLegPayoff(leg, price), 0);
    });

    return {
      labels: prices.map(p => p.toFixed(2)),
      datasets: [
        {
          label: 'Total P/L',
          data: payoffs,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: (context: any) => {
            const value = context.parsed.y;
            return value >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)';
          },
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  }, [legs, underlyingPrice]);

  const maxProfit = useMemo(() => {
    if (legs.length === 0) return 0;
    const payoffs = payoffData.datasets[0]?.data || [];
    return Math.max(...(payoffs as number[]));
  }, [payoffData]);

  const maxLoss = useMemo(() => {
    if (legs.length === 0) return 0;
    const payoffs = payoffData.datasets[0]?.data || [];
    return Math.min(...(payoffs as number[]));
  }, [payoffData]);

  const breakevens = useMemo(() => {
    if (legs.length === 0) return [];
    const payoffs = payoffData.datasets[0]?.data || [];
    const prices = payoffData.labels.map(l => parseFloat(l));
    const bePoints: number[] = [];

    for (let i = 1; i < payoffs.length; i++) {
      const curr = payoffs[i] as number;
      const prev = payoffs[i - 1] as number;

      if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) {
        // Interpolate exact breakeven point
        const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
        const bePrice = prices[i - 1] + ratio * (prices[i] - prices[i - 1]);
        bePoints.push(bePrice);
      }
    }

    return bePoints;
  }, [payoffData]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Strategy Payoff Diagram',
        color: '#f3f4f6',
        font: { size: 13 },
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
            const value = context.parsed.y;
            return `P/L: $${value !== null ? value.toFixed(2) : '0.00'}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Underlying Price',
          color: '#9ca3af',
        },
        grid: { color: '#374151' },
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 10,
          callback: (_, index) => {
            // Show only every 5th label
            return index % 5 === 0 ? payoffData.labels[index] : '';
          },
        },
      },
      y: {
        title: {
          display: true,
          text: 'Profit/Loss ($)',
          color: '#9ca3af',
        },
        grid: { color: '#374151' },
        ticks: {
          color: '#9ca3af',
          callback: (value) => `$${value}`,
        },
      },
    },
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h2 className="text-sm font-semibold">Strategy Builder - {symbol}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Templates
          </button>
          <button
            onClick={addLeg}
            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add Leg
          </button>
        </div>
      </div>

      {showTemplates && (
        <div className="border-b border-gray-700 bg-gray-850 p-3">
          <div className="grid grid-cols-3 gap-2">
            {STRATEGY_TEMPLATES.map(template => (
              <button
                key={template.name}
                onClick={() => loadTemplate(template)}
                className="px-3 py-2 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Legs panel */}
        <div className="w-1/3 flex flex-col gap-2 overflow-y-auto">
          {legs.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8">
              No legs added. Click "Add Leg" or choose a template.
            </div>
          ) : (
            legs.map(leg => (
              <div key={leg.id} className="bg-gray-800 rounded p-3 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">
                    {leg.action.toUpperCase()} {leg.type.toUpperCase()}
                  </span>
                  <button
                    onClick={() => removeLeg(leg.id)}
                    className="p-1 hover:bg-red-900/50 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={leg.type}
                      onChange={(e) => updateLeg(leg.id, { type: e.target.value as 'call' | 'put' })}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
                    >
                      <option value="call">Call</option>
                      <option value="put">Put</option>
                    </select>
                    <select
                      value={leg.action}
                      onChange={(e) => updateLeg(leg.id, { action: e.target.value as 'buy' | 'sell' })}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
                    >
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 w-16">Strike:</label>
                    <input
                      type="number"
                      value={leg.strike}
                      onChange={(e) => updateLeg(leg.id, { strike: parseFloat(e.target.value) || 0 })}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
                      step="0.5"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 w-16">Quantity:</label>
                    <input
                      type="number"
                      value={leg.quantity}
                      onChange={(e) => updateLeg(leg.id, { quantity: parseInt(e.target.value) || 1 })}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
                      min="1"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 w-16">Premium:</label>
                    <input
                      type="number"
                      value={leg.premium}
                      onChange={(e) => updateLeg(leg.id, { premium: parseFloat(e.target.value) || 0 })}
                      className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs"
                      step="0.05"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chart and stats panel */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex-1 bg-gray-800 rounded p-4">
            {legs.length > 0 ? (
              <Line data={payoffData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Add legs to see payoff diagram
              </div>
            )}
          </div>

          {legs.length > 0 && (
            <div className="bg-gray-800 rounded p-4 grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">Max Profit</div>
                <div className={`text-lg font-semibold ${maxProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${maxProfit.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Max Loss</div>
                <div className={`text-lg font-semibold ${maxLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${maxLoss.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Breakeven(s)</div>
                <div className="text-sm font-mono">
                  {breakevens.length > 0
                    ? breakevens.map(be => `$${be.toFixed(2)}`).join(', ')
                    : 'None'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
