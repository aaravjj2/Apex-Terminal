/**
 * Autopilot View - Main container with tab navigation
 * v1.53 - Professional redesign with design tokens
 */

import { useState } from 'react';
import { Bot } from 'lucide-react';
import {
  AutopilotDashboard,
  AutopilotPositions,
  AutopilotActivity,
  AutopilotSettings,
} from '../../autopilot/components';
import { AIPanel } from './AIPanel';
import { useAppStore } from '../../../state/appStore';
import { PageHeader } from '../../../ui/PageHeader';
import { cn } from '../../../ui/utils';

type TabId = 'dashboard' | 'positions' | 'activity' | 'settings';

const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'positions', label: 'Positions' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
];

export function AutopilotView() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { symbol } = useAppStore();

  return (
    <div className="h-full w-full flex flex-col bg-background" data-testid="autopilot-view">
      {/* Professional Header */}
      <PageHeader
        title="Autopilot"
        subtitle="AI-powered autonomous trading engine"
        icon={<Bot size={20} />}
        data-testid="autopilot-header"
      />

      {/* Tab Bar - design token colors */}
      <div className="pro-tab-bar shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            data-testid={`autopilot-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            className={cn(
              "pro-tab",
              activeTab === tab.id && "active"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto flex min-h-0">
        <div className="flex-1 overflow-auto">
          {activeTab === 'dashboard' && <AutopilotDashboard />}
          {activeTab === 'positions' && (
            <div className="h-full p-4 bg-background">
              <AutopilotPositions />
            </div>
          )}
          {activeTab === 'activity' && (
            <div className="h-full p-4 bg-background">
              <AutopilotActivity />
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="h-full p-4 bg-background">
              <AutopilotSettings />
            </div>
          )}
        </div>
        <div className="w-80 shrink-0 border-l border-border/60 overflow-auto bg-panel-bg/30">
          <AIPanel symbol={symbol || 'SPY'} />
        </div>
      </div>
    </div>
  );
}
