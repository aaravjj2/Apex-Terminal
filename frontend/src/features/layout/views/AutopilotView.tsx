/**
 * Autopilot View - Main container with tab navigation
 */

import { useState } from 'react';
import {
  AutopilotDashboard,
  AutopilotPositions,
  AutopilotActivity,
  AutopilotSettings,
} from '../../autopilot/components';
import { AIPanel } from './AIPanel';
import { useAppStore } from '../../../state/appStore';

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
    <div className="h-full w-full flex flex-col" data-testid="autopilot-view">
      {/* Tab Bar */}
      <div className="flex border-b border-gray-700 bg-gray-800 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            data-testid={`autopilot-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400 bg-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto flex">
        <div className="flex-1 overflow-auto">
        {activeTab === 'dashboard' && <AutopilotDashboard />}
        {activeTab === 'positions' && (
          <div className="h-full p-4 bg-gray-900">
            <AutopilotPositions />
          </div>
        )}
        {activeTab === 'activity' && (
          <div className="h-full p-4 bg-gray-900">
            <AutopilotActivity />
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="h-full p-4 bg-gray-900">
            <AutopilotSettings />
          </div>
        )}
        </div>
        <div className="w-80 shrink-0 border-l border-gray-700 overflow-auto">
          <AIPanel symbol={symbol || 'SPY'} />
        </div>
      </div>
    </div>
  );
}
