/**
 * TopBar Component - v1.51
 * Professional-grade top navigation bar
 */

import React from 'react';
import { Settings, Bell, User, HelpCircle } from 'lucide-react';
import { cn } from './utils';

interface TopBarProps {
  className?: string;
  title?: string;
  subtitle?: string;
  mode?: 'demo' | 'live' | 'paper' | 'replay' | 'backtest';
  provider?: string;
  actions?: React.ReactNode;
}

const MODE_BADGES = {
  demo: { label: 'DEMO', color: 'bg-blue-600 text-white' },
  live: { label: 'LIVE', color: 'bg-green-600 text-white' },
  paper: { label: 'PAPER', color: 'bg-amber-600 text-white' },
  replay: { label: 'REPLAY', color: 'bg-purple-600 text-white' },
  backtest: { label: 'BACKTEST', color: 'bg-cyan-600 text-white' },
};

export function TopBar({ className, title, subtitle, mode, provider, actions }: TopBarProps) {
  return (
    <div
      className={cn(
        'h-14 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)]',
        'flex items-center justify-between px-6',
        'sticky top-0 z-[var(--z-header)]',
        className
      )}
      data-testid="app-top-bar"
    >
      {/* Left: Title + Mode Badge */}
      <div className="flex items-center gap-4">
        {title && (
          <div className="flex flex-col">
            <h1 className="text-[var(--text-lg)] font-semibold text-[var(--text-primary)] leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[var(--text-sm)] text-[var(--text-secondary)] leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        )}
        
        {mode && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[var(--text-xs)] font-semibold uppercase tracking-wider',
                MODE_BADGES[mode].color
              )}
              data-testid="mode-badge"
            >
              {MODE_BADGES[mode].label}
            </span>
            {provider && (
              <span className="text-[var(--text-xs)] text-[var(--text-tertiary)] uppercase tracking-wide">
                {provider}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions + System Controls */}
      <div className="flex items-center gap-2">
        {actions}
        
        <button
          className="p-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Notifications"
          data-testid="topbar-notifications"
        >
          <Bell size={18} />
        </button>
        
        <button
          className="p-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Help"
          data-testid="topbar-help"
        >
          <HelpCircle size={18} />
        </button>
        
        <button
          className="p-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Settings"
          data-testid="topbar-settings"
        >
          <Settings size={18} />
        </button>
        
        <button
          className="p-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Profile"
          data-testid="topbar-profile"
        >
          <User size={18} />
        </button>
      </div>
    </div>
  );
}
