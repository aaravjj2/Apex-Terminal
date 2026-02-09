/**
 * Autopilot View – v2 UI Overhaul
 * Tab-based container for autopilot dashboard, positions, activity, settings.
 */

import { useState } from 'react';
import { Bot, BarChart3, Activity, Settings } from 'lucide-react';
import { PageHeader } from '../../../ui/PageHeader';
import { Badge } from '../../../ui/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../ui/Tabs';
import {
  AutopilotDashboard,
  AutopilotPositions,
  AutopilotActivity,
  AutopilotSettings,
} from '../../autopilot/components';

export function AutopilotView() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="h-full w-full flex flex-col bg-background" data-testid="autopilot-view">
      <PageHeader
        title="Autopilot"
        subtitle="AI-driven autonomous trading engine"
        icon={<Bot size={20} />}
        badge={<Badge variant="info" dot size="sm">AI</Badge>}
        data-testid="autopilot-header"
      />

      <Tabs
        defaultValue="dashboard"
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="px-6">
          <TabsTrigger value="dashboard" icon={<BarChart3 size={12} />} data-testid="autopilot-tab-dashboard">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="positions" icon={<Activity size={12} />} data-testid="autopilot-tab-positions">
            Positions
          </TabsTrigger>
          <TabsTrigger value="activity" icon={<Activity size={12} />} data-testid="autopilot-tab-activity">
            Activity
          </TabsTrigger>
          <TabsTrigger value="settings" icon={<Settings size={12} />} data-testid="autopilot-tab-settings">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="flex-1 overflow-auto">
          <AutopilotDashboard />
        </TabsContent>
        <TabsContent value="positions" className="flex-1 overflow-auto p-4">
          <AutopilotPositions />
        </TabsContent>
        <TabsContent value="activity" className="flex-1 overflow-auto p-4">
          <AutopilotActivity />
        </TabsContent>
        <TabsContent value="settings" className="flex-1 overflow-auto p-4">
          <AutopilotSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
