import { useState, useEffect } from 'react';
import { Plus, Trash2, Settings, Eye, EyeOff } from 'lucide-react';

interface Indicator {
  id: string;
  type: string;
  name: string;
  params: Record<string, any>;
  visible: boolean;
  color?: string;
}

interface IndicatorManagerProps {
  symbol: string;
  onIndicatorUpdate: (indicators: Indicator[]) => void;
}

const INDICATOR_PRESETS = [
  { type: 'volume_profile', name: 'Volume Profile', defaultParams: { profile_type: 'visible_range' } },
  { type: 'anchored_vwap', name: 'Anchored VWAP', defaultParams: { anchor_date: new Date().toISOString().split('T')[0] } },
  { type: 'atr_bands', name: 'ATR Bands', defaultParams: { period: 14, multiplier: 2.0 } },
  { type: 'ema_regime', name: 'EMA Regime', defaultParams: {} },
  { type: 'patterns', name: 'Pattern Detection', defaultParams: { confidence: 0.7 } },
];

export const IndicatorManager = ({ symbol, onIndicatorUpdate }: IndicatorManagerProps) => {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    // Load saved indicators from localStorage
    const saved = localStorage.getItem(`indicators_${symbol}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setIndicators(parsed);
        onIndicatorUpdate(parsed);
      } catch (e) {
        console.error('Failed to parse saved indicators:', e);
      }
    }
  }, [symbol]);

  const saveIndicators = (newIndicators: Indicator[]) => {
    setIndicators(newIndicators);
    localStorage.setItem(`indicators_${symbol}`, JSON.stringify(newIndicators));
    onIndicatorUpdate(newIndicators);
  };

  const addIndicator = (preset: typeof INDICATOR_PRESETS[0]) => {
    const newIndicator: Indicator = {
      id: `${preset.type}_${Date.now()}`,
      type: preset.type,
      name: preset.name,
      params: { ...preset.defaultParams },
      visible: true,
      color: getRandomColor(),
    };
    
    saveIndicators([...indicators, newIndicator]);
    setShowAddMenu(false);
  };

  const removeIndicator = (id: string) => {
    saveIndicators(indicators.filter(ind => ind.id !== id));
  };

  const toggleVisibility = (id: string) => {
    saveIndicators(
      indicators.map(ind =>
        ind.id === id ? { ...ind, visible: !ind.visible } : ind
      )
    );
  };

  const updateParams = (id: string, params: Record<string, any>) => {
    saveIndicators(
      indicators.map(ind =>
        ind.id === id ? { ...ind, params } : ind
      )
    );
    setEditingId(null);
  };

  const getRandomColor = () => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 border-l border-gray-700">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <h3 className="text-sm font-semibold">Indicators</h3>
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
          title="Add indicator"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showAddMenu && (
        <div className="border-b border-gray-700 bg-gray-850 p-2">
          <div className="text-xs text-gray-400 mb-2">Add Indicator:</div>
          {INDICATOR_PRESETS.map(preset => (
            <button
              key={preset.type}
              onClick={() => addIndicator(preset)}
              className="w-full text-left px-2 py-1 text-xs hover:bg-gray-700 rounded mb-1 transition-colors"
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {indicators.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-4">
            No indicators added.<br />Click + to add.
          </div>
        ) : (
          indicators.map(indicator => (
            <div
              key={indicator.id}
              className="bg-gray-800 rounded p-2 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-1">
                  {indicator.color && (
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: indicator.color }}
                    />
                  )}
                  <span className="text-xs font-medium">{indicator.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleVisibility(indicator.id)}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title={indicator.visible ? 'Hide' : 'Show'}
                  >
                    {indicator.visible ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-gray-500" />
                    )}
                  </button>
                  <button
                    onClick={() => setEditingId(editingId === indicator.id ? null : indicator.id)}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title="Settings"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeIndicator(indicator.id)}
                    className="p-1 hover:bg-red-900/50 rounded transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {editingId === indicator.id && (
                <div className="mt-2 pt-2 border-t border-gray-700 space-y-2">
                  {Object.entries(indicator.params).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className="text-xs text-gray-400 flex-1">{key}:</label>
                      <input
                        type={typeof value === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={(e) => {
                          const newValue = typeof value === 'number'
                            ? parseFloat(e.target.value)
                            : e.target.value;
                          updateParams(indicator.id, {
                            ...indicator.params,
                            [key]: newValue,
                          });
                        }}
                        className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs w-24"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
