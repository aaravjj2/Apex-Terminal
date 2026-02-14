/**
 * Strategy Filter UI (v1.35)
 * Filter and sort strategy artifacts with deterministic defaults.
 */

import { useState, useEffect, useCallback } from 'react';
import { Filter, X, ArrowUpDown } from 'lucide-react';
import { API_BASE } from '../../../config/api';

interface Artifact {
  id: string;
  name: string;
  type: string;
  version: string;
  checksum: string;
  spec: Record<string, unknown>;
}

interface FilterState {
  tag: string;
  type: string;
  sortBy: string;
  sortOrder: string;
}

interface FilteredResult {
  artifacts: Artifact[];
  count: number;
  filter: { tag: string | null; type: string | null };
  sort: { key: string; order: string };
}

interface StrategyFilterProps {
  onResults: (artifacts: Artifact[]) => void;
}

const SORT_OPTIONS = [
  { value: 'id', label: 'ID (Default)' },
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
  { value: 'version', label: 'Version' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'crossover', label: 'Crossover' },
  { value: 'signal', label: 'Signal' },
  { value: 'mean_reversion', label: 'Mean Reversion' },
  { value: 'breakout', label: 'Breakout' },
];

export function StrategyFilter({ onResults }: StrategyFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterState>({
    tag: '',
    type: '',
    sortBy: 'id',
    sortOrder: 'asc',
  });
  const [loading, setLoading] = useState(false);

  const applyFilter = useCallback(async (f: FilterState) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.tag) params.set('tag', f.tag);
      if (f.type) params.set('type', f.type);
      params.set('sort_by', f.sortBy);
      params.set('sort_order', f.sortOrder);

      const res = await fetch(`${API_BASE}/api/v1/strategy-artifacts/filter/list?${params}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data: FilteredResult = await res.json();
        onResults(data.artifacts);
      }
    } catch (e) {
      console.error('Filter failed:', e);
    } finally {
      setLoading(false);
    }
  }, [onResults]);

  useEffect(() => {
    applyFilter(filter);
  }, []);

  const handleApply = () => {
    applyFilter(filter);
  };

  const handleReset = () => {
    const defaultFilter: FilterState = { tag: '', type: '', sortBy: 'id', sortOrder: 'asc' };
    setFilter(defaultFilter);
    applyFilter(defaultFilter);
  };

  return (
    <div data-testid="strategy-filter" className="relative">
      <button
        data-testid="strategy-filter-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 text-sm transition-colors"
      >
        <Filter size={14} className="text-blue-400" />
        <span>Filter & Sort</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-gray-800 border border-gray-600 rounded shadow-lg z-50 p-3 space-y-3">
          {/* Tag Filter */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Tag</label>
            <input
              data-testid="strategy-filter-tag-input"
              type="text"
              value={filter.tag}
              onChange={(e) => setFilter({ ...filter, tag: e.target.value })}
              placeholder="e.g., trend, oscillator"
              className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm text-white"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Type</label>
            <select
              data-testid="strategy-filter-type-select"
              value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm text-white"
            >
              {TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Sort By</label>
            <div className="flex gap-2">
              <select
                data-testid="strategy-filter-sort-select"
                value={filter.sortBy}
                onChange={(e) => setFilter({ ...filter, sortBy: e.target.value })}
                className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm text-white"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                data-testid="strategy-filter-sort-order"
                onClick={() => setFilter({ ...filter, sortOrder: filter.sortOrder === 'asc' ? 'desc' : 'asc' })}
                className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm"
              >
                <ArrowUpDown size={14} className={filter.sortOrder === 'desc' ? 'rotate-180' : ''} />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              data-testid="strategy-filter-apply"
              onClick={handleApply}
              disabled={loading}
              className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
            >
              {loading ? 'Loading…' : 'Apply'}
            </button>
            <button
              data-testid="strategy-filter-reset"
              onClick={handleReset}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
