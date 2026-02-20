/**
 * UI2 InsightsPanel Component
 * AI-powered insights with urgency, confidence, and suggested actions
 */

import React from 'react';
import { StatusBadge } from './StatusBadge';
import { ConfidenceBar } from './ProgressBar';
import { Button } from './Button';

export interface InsightAction {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: React.ReactNode;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  confidence: number; // 0-1
  actions?: InsightAction[];
  timestamp?: Date;
  category?: string;
}

export interface InsightsPanelProps {
  insights: Insight[];
  testId?: string;
  onDismiss?: (id: string) => void;
}

export function InsightsPanel({ insights, testId, onDismiss }: InsightsPanelProps) {
  if (insights.length === 0) {
    return (
      <div
        data-testid={testId}
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--ui2-text-muted)',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>💡</div>
        <div className="ui2-subhead" style={{ marginBottom: '8px' }}>
          No active insights
        </div>
        <div style={{ fontSize: '13px' }}>
          Insights will appear here when our AI detects actionable opportunities.
        </div>
      </div>
    );
  }

  return (
    <div data-testid={testId} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

interface InsightCardProps {
  insight: Insight;
  onDismiss?: (id: string) => void;
}

function InsightCard({ insight, onDismiss }: InsightCardProps) {
  const urgencyVariant: Record<string, 'danger' | 'warning' | 'info'> = {
    high: 'danger',
    medium: 'warning',
    low: 'info',
  };

  const urgencyIcon: Record<string, string> = {
    high: '🚨',
    medium: '⚠️',
    low: 'ℹ️',
  };

  return (
    <div
      className="ui2-elevation-1"
      style={{
        padding: '16px',
        borderRadius: 'var(--ui2-radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
      data-testid={`insight-card-${insight.id}`}
    >
      {/* Header: Urgency + Title + Dismiss */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <StatusBadge variant={urgencyVariant[insight.urgency]} icon={urgencyIcon[insight.urgency]} testId={`insight-urgency-${insight.id}`}>
              {insight.urgency}
            </StatusBadge>
            {insight.category && (
              <span className="ui2-micro" style={{ color: 'var(--ui2-text-tertiary)' }}>
                {insight.category}
              </span>
            )}
          </div>
          <div className="ui2-title" style={{ marginBottom: '4px' }}>
            {insight.title}
          </div>
        </div>
        {onDismiss && (
          <button
            className="ui2-icon-btn"
            onClick={() => onDismiss(insight.id)}
            data-testid={`insight-dismiss-${insight.id}`}
            title="Dismiss"
            style={{ flexShrink: 0 }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: '13px',
          lineHeight: '1.5',
          color: 'var(--ui2-text-secondary)',
        }}
      >
        {insight.description}
      </div>

      {/* Confidence */}
      <ConfidenceBar
        confidence={insight.confidence}
        label={`Confidence: ${(insight.confidence * 100).toFixed(0)}%`}
        testId={`insight-confidence-${insight.id}`}
      />

      {/* Actions */}
      {insight.actions && insight.actions.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
          {insight.actions.map((action, idx) => (
            <Button
              key={idx}
              variant={action.variant || 'secondary'}
              size="sm"
              onClick={action.onClick}
              icon={action.icon}
              testId={`insight-${insight.id}-action-${idx}`}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Timestamp */}
      {insight.timestamp && (
        <div
          className="ui2-micro"
          style={{
            color: 'var(--ui2-text-muted)',
            marginTop: '4px',
          }}
        >
          {insight.timestamp.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
