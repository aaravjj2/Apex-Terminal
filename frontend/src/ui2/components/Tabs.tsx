/**
 * UI2 Tabs Component
 * Tab navigation for workspace sections
 */

import React, { useState } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  testId?: string;
  className?: string;
}

export function Tabs({
  items,
  activeTab: controlledActiveTab,
  onTabChange,
  testId,
  className = '',
}: TabsProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(items[0]?.id || '');
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabClick = (tabId: string, disabled?: boolean) => {
    if (disabled) return;
    setInternalActiveTab(tabId);
    onTabChange?.(tabId);
  };

  return (
    <div
      data-testid={testId}
      className={`flex items-center border-b ${className}`}
      style={{
        borderColor: 'var(--ui2-border)',
        gap: 'var(--ui2-space-1)',
      }}
    >
      {items.map((item) => {
        const isActive = activeTab === item.id;
        const isDisabled = item.disabled;

        return (
          <button
            key={item.id}
            data-testid={`${testId}-tab-${item.id}`}
            disabled={isDisabled}
            onClick={() => handleTabClick(item.id, isDisabled)}
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 500,
              color: isDisabled
                ? 'var(--ui2-text-disabled)'
                : isActive
                ? 'var(--ui2-brand)'
                : 'var(--ui2-text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--ui2-brand)' : '2px solid transparent',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (!isDisabled && !isActive) {
                e.currentTarget.style.color = 'var(--ui2-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isDisabled && !isActive) {
                e.currentTarget.style.color = 'var(--ui2-text-secondary)';
              }
            }}
          >
            {item.icon && <span style={{ display: 'flex' }}>{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
