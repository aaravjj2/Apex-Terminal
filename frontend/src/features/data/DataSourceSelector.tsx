/**
 * DataSourceSelector
 * ===================
 * Compact dropdown for switching between data providers.
 * Shows in the top bar or settings panel.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Database, ChevronDown, Wifi, HardDrive, Package } from 'lucide-react';
import type { DataSourceId } from './providers';
import { getAvailableProviders } from './providers';

interface DataSourceSelectorProps {
  value: DataSourceId;
  onChange: (id: DataSourceId) => void;
  className?: string;
}

const ICONS: Record<string, React.ReactNode> = {
  fixture: <Package size={14} />,
  'cached-yahoo': <HardDrive size={14} />,
  yahoo: <Wifi size={14} />,
};

const LABELS: Record<string, string> = {
  fixture: 'Demo Fixtures',
  'cached-yahoo': 'Cached',
  yahoo: 'Yahoo Finance',
};

export const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const providers = getAvailableProviders();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLabel = LABELS[value] ?? value;
  const currentIcon = ICONS[value] ?? <Database size={14} />;

  return (
    <div ref={ref} className={`relative ${className}`} data-testid="data-source-selector">
      <button
        data-testid="data-source-trigger"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-element-bg border border-border hover:border-brand/50 transition-colors text-text-secondary"
      >
        {currentIcon}
        <span>{currentLabel}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          data-testid="data-source-dropdown"
          className="absolute top-full mt-1 left-0 w-56 bg-panel-bg border border-border rounded-lg shadow-lg z-50 overflow-hidden"
        >
          <div className="px-3 py-2 text-[10px] text-text-secondary uppercase tracking-wider border-b border-border">
            Data Source
          </div>
          {providers.map((p) => {
            const id = p.id as DataSourceId;
            const isActive = id === value;
            return (
              <button
                key={p.id}
                data-testid={`data-source-option-${p.id}`}
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
                className={`w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-element-bg transition-colors ${
                  isActive ? 'bg-brand/5 text-brand' : 'text-text'
                }`}
              >
                <span className="mt-0.5">
                  {ICONS[p.id] ?? <Database size={14} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-text-secondary truncate">{p.description}</div>
                  {p.requiresNetwork && (
                    <span className="text-[10px] text-yellow-500 mt-0.5 inline-block">
                      Requires network
                    </span>
                  )}
                </div>
                {isActive && (
                  <span className="text-brand text-xs mt-0.5">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DataSourceSelector;
