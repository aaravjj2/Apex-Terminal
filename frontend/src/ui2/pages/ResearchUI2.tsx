/**
 * ResearchUI2 Page
 * Strategy Lab: Strategies management + Backtest launcher  
 * Embeds real UI1 components for feature parity
 */

import { useState } from 'react';
import { PageHeader, Tabs } from '../components';
import { StrategiesView } from '../../features/layout/views/StrategiesView';
import { BacktestPanel } from '../../features/backtest/BacktestPanel';
import { RunsAuditView } from '../../features/layout/views/RunsAuditView';

export function ResearchUI2() {
  const [activeTab, setActiveTab] = useState('strategies');

  return (
    <div data-testid="research-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Research"
          subtitle="Strategy Lab: Build, Test, Validate"
          icon="🔬"
          testId="research-header"
        />
      </div>

      <div style={{ padding: '0 16px 8px 16px' }}>
        <Tabs
          items={[
            { id: 'strategies', label: 'Strategies' },
            { id: 'backtest', label: 'Backtest' },
            { id: 'runs', label: 'Runs & Audit' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          testId="research-tabs"
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        {activeTab === 'strategies' && (
          <div data-testid="research-strategies-embed">
            <StrategiesView />
          </div>
        )}

        {activeTab === 'backtest' && (
          <div data-testid="research-backtest-embed">
            <BacktestPanel />
          </div>
        )}

        {activeTab === 'runs' && (
          <div data-testid="research-runs-embed">
            <RunsAuditView />
          </div>
        )}
      </div>
    </div>
  );
}
