/**
 * UI2 RightSidebar Component
 * Inspector/ticket region with collapsible behavior
 */

import React, { useState } from 'react';

export interface RightSidebarProps {
  title?: string;
  width?: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
  testId?: string;
}

export function RightSidebar({
  title = 'Inspector',
  width = '320px',
  defaultCollapsed = false,
  children,
  testId,
}: RightSidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      data-testid={testId}
      style={{
        width: collapsed ? '40px' : width,
        height: '100%',
        background: 'var(--ui2-bg-panel)',
        borderLeft: '1px solid var(--ui2-border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '40px',
          padding: '0 12px',
          background: 'var(--ui2-bg-elevated)',
          borderBottom: '1px solid var(--ui2-border)',
        }}
      >
        {!collapsed && (
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--ui2-text-primary)',
              margin: 0,
            }}
          >
            {title}
          </h3>
        )}
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
            marginLeft: collapsed ? 0 : 'auto',
          }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '◀' : '▶'}
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div
          className="ui2-scrollable"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
