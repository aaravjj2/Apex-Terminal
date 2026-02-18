/**
 * UI2 KPIStrip Component
 * Hero-level KPI display for dashboards and key metrics
 * Bloomberg Terminal-style data presentation
 */

import React from 'react';

export interface KPIItem {
  id: string;
  label: string;
  value: string | number;
  change?: {
    value: string | number;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  status?: 'success' | 'danger' | 'warning' | 'neutral';
  icon?: React.ReactNode;
  description?: string;
}

interface KPIStripProps {
  items: KPIItem[];
  variant?: 'compact' | 'hero';
  testId?: string;
}

export function KPIStrip({ items, variant = 'compact', testId }: KPIStripProps) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
        gap: variant === 'hero' ? 'var(--ui2-space-6)' : 'var(--ui2-space-4)',
      }}
    >
      {items.map((item) => (
        <KPICard key={item.id} item={item} variant={variant} />
      ))}
    </div>
  );
}

function KPICard({ item, variant }: { item: KPIItem; variant: 'compact' | 'hero' }) {
  const isHero = variant === 'hero';

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'success':
        return 'var(--ui2-success)';
      case 'danger':
        return 'var(--ui2-danger)';
      case 'warning':
        return 'var(--ui2-warning)';
      default:
        return 'var(--ui2-text-primary)';
    }
  };

  const getChangeColor = (direction: 'up' | 'down' | 'neutral') => {
    switch (direction) {
      case 'up':
        return 'var(--ui2-positive)';
      case 'down':
        return 'var(--ui2-negative)';
      default:
        return 'var(--ui2-neutral)';
    }
  };

  return (
    <div
      data-testid={`kpi-item-${item.id}`}
      className={`ui2-interactive${isHero ? ' hero' : ''}`}
      style={{
        background: 'var(--ui2-bg-panel)',
        border: '1px solid var(--ui2-border)',
        borderRadius: 'var(--ui2-radius-lg)',
        padding: isHero ? 'var(--ui2-space-6)' : 'var(--ui2-space-4)',
        transition: 'all var(--ui2-transition-fast)',
      }}
    >
      {/* Icon (if present) */}
      {item.icon && (
        <div
          style={{
            marginBottom: 'var(--ui2-space-2)',
            color: 'var(--ui2-text-secondary)',
            opacity: 0.7,
          }}
        >
          {item.icon}
        </div>
      )}

      {/* Label */}
      <div
        style={{
          fontSize: isHero ? '13px' : '11px',
          fontWeight: 500,
          color: 'var(--ui2-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 'var(--ui2-space-2)',
        }}
      >
        {item.label}
      </div>

      {/* Value */}
      <div
        className={isHero ? 'ui2-display' : 'ui2-data'}
        style={{
          fontSize: isHero ? '32px' : '20px',
          fontWeight: isHero ? 700 : 600,
          color: getStatusColor(item.status),
          lineHeight: 1.2,
          marginBottom: item.change ? 'var(--ui2-space-2)' : 0,
          letterSpacing: isHero ? '-0.02em' : '-0.01em',
        }}
      >
        {item.value}
      </div>

      {/* Change indicator */}
      {item.change && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 500,
            color: getChangeColor(item.change.direction),
          }}
        >
          <span>
            {item.change.direction === 'up' && '↑'}
            {item.change.direction === 'down' && '↓'}
            {item.change.direction === 'neutral' && '→'}
          </span>
          <span className="ui2-tabular">{item.change.value}</span>
          {item.change.label && (
            <span style={{ color: 'var(--ui2-text-tertiary)' }}>
              {item.change.label}
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {item.description && (
        <div
          style={{
            marginTop: 'var(--ui2-space-2)',
            fontSize: '11px',
            color: 'var(--ui2-text-tertiary)',
            lineHeight: 1.4,
          }}
        >
          {item.description}
        </div>
      )}
    </div>
  );
}
