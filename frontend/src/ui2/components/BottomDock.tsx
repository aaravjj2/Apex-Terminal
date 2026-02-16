/**
 * UI2 BottomDock Component
 * Collapsible blotter region with tabs
 */

import React, { useState } from 'react';

export interface BottomDockTab {
  id: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

export interface BottomDockProps {
  tabs: BottomDockTab[];
  defaultTab?: string;
  defaultCollapsed?: boolean;
  height?: string;
  testId?: string;
}

export function BottomDock({
  tabs,
  defaultTab,
  defaultCollapsed = false,
  height = '240px',
  testId,
}: BottomDockProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const activeTabContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div
      data-testid={testId}
      style={{
        width: '100%',
        height: collapsed ? '32px' : height,
        background: 'var(--ui2-bg-panel)',
        borderTop: '1px solid var(--ui2-border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'height 0.2s',
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '32px',
          paddingLeft: '12px',
          paddingRight: '12px',
          background: 'var(--ui2-bg-elevated)',
          borderBottom: collapsed ? 'none' : '1px solid var(--ui2-border)',
          gap: '4px',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`${testId}-tab-${tab.id}`}
            onClick={() => {
              setActiveTab(tab.id);
              if (collapsed) setCollapsed(false);
            }}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? 600 : 500,
              color:
                activeTab === tab.id
                  ? 'var(--ui2-text-primary)'
                  : 'var(--ui2-text-secondary)',
              background:
                activeTab === tab.id
                  ? 'var(--ui2-bg-selected)'
                  : 'transparent',
              border: 'none',
              borderRadius: 'var(--ui2-radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = 'var(--ui2-bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--ui2-text-muted)',
                  background: 'var(--ui2-bg-elevated)',
                  padding: '2px 6px',
                  borderRadius: 'var(--ui2-radius-sm)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          data-testid={`${testId}-collapse`}
          onClick={() => setCollapsed(!collapsed)}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            color: 'var(--ui2-text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px',
          }}
        >
          {activeTabContent}
        </div>
      )}
    </div>
  );
}
