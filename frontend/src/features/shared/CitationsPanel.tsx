/**
 * v1.38 — Citations Panel
 * Reusable component for rendering citation/evidence items.
 */
import { useState } from 'react';

export interface CitationItem {
  id: string;
  source_type: string;
  source_id: string;
  title: string;
  detail: string;
  timestamp: string;
  confidence?: number | null;
  url?: string | null;
  metadata?: Record<string, any>;
}

interface CitationsPanelProps {
  citations: CitationItem[];
  maxVisible?: number;
  loading?: boolean;
}

const sourceColors: Record<string, string> = {
  risk_run: 'bg-red-500/20 text-red-400',
  backtest: 'bg-blue-500/20 text-blue-400',
  validation: 'bg-green-500/20 text-green-400',
  strategy: 'bg-purple-500/20 text-purple-400',
  export: 'bg-yellow-500/20 text-yellow-400',
  provenance: 'bg-cyan-500/20 text-cyan-400',
};

export function CitationsPanel({ citations, maxVisible = 5, loading }: CitationsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div data-testid="citations-panel" className="p-3 rounded-lg border border-border bg-panel-bg">
        <div data-testid="citations-loading" className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-8 bg-element-bg/50 rounded w-full" />)}
        </div>
      </div>
    );
  }

  if (!citations.length) {
    return (
      <div data-testid="citations-panel" className="p-3 rounded-lg border border-border bg-panel-bg">
        <div data-testid="citations-empty" className="text-sm text-text-muted text-center py-4">
          No citations available
        </div>
      </div>
    );
  }

  const visible = expanded ? citations : citations.slice(0, maxVisible);
  const hasMore = citations.length > maxVisible;

  return (
    <div data-testid="citations-panel" className="p-3 rounded-lg border border-border bg-panel-bg">
      <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
        <span>Citations & Evidence</span>
        <span className="text-xs text-text-muted">({citations.length})</span>
      </h3>
      <div className="space-y-2">
        {visible.map((c, idx) => (
          <div
            key={c.id}
            data-testid={`citation-item-${idx}`}
            className="p-2 rounded bg-element-bg/30 border border-border/50"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                data-testid={`citation-source-${idx}`}
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sourceColors[c.source_type] || 'bg-gray-500/20 text-gray-400'}`}
              >
                {c.source_type}
              </span>
              <span className="text-xs font-medium text-text flex-1 truncate">{c.title}</span>
              {c.confidence != null && (
                <span
                  data-testid={`citation-confidence-${idx}`}
                  className="text-[10px] text-text-muted"
                >
                  {Math.round(c.confidence * 100)}%
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary line-clamp-2">{c.detail}</p>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          data-testid="citations-toggle"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-brand hover:text-brand/80 transition-colors"
        >
          {expanded ? 'Show less' : `Show ${citations.length - maxVisible} more`}
        </button>
      )}
    </div>
  );
}
