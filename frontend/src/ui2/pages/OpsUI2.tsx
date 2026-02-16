/**
 * OpsUI2 Page
 * Operations: Embeds real UI1 views for Incidents, Health, Settings
 */

import { useState } from 'react';
import { PageHeader, Tabs } from '../components';
import { IncidentsView } from '../../features/layout/views/IncidentsView';
import { SettingsView } from '../../features/layout/views/SettingsView';
import { ReportsView } from '../../features/layout/views/ReportsView';

export function OpsUI2() {
  const [activeTab, setActiveTab] = useState('incidents');

  return (
    <div data-testid="ops-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Operations"
          subtitle="Platform monitoring, incidents, and system health"
          icon="⚙️"
          testId="ops-header"
        />
      </div>

      <div style={{ padding: '0 16px 8px 16px' }}>
        <Tabs
          items={[
            { id: 'incidents', label: 'Incidents', icon: <span>🚨</span> },
            { id: 'reports', label: 'Reports', icon: <span>📊</span> },
            { id: 'settings', label: 'Settings', icon: <span>⚙️</span> },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          testId="ops-tabs"
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        {activeTab === 'incidents' && (
          <div data-testid="ops-incidents-embed">
            <IncidentsView />
          </div>
        )}

        {activeTab === 'reports' && (
          <div data-testid="ops-reports-embed">
            <ReportsView />
          </div>
        )}

        {activeTab === 'settings' && (
          <div data-testid="ops-settings-embed">
            <SettingsView />
          </div>
        )}
      </div>
    </div>
  );
}
