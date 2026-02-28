/**
 * v1.62 — SettingsUI2 Page (Enhanced)
 * Platform settings with health status and about info
 */

import { useState } from 'react';
import { PageHeader, Tabs } from '../components';

const SETTINGS_SECTIONS = [
  { id: 'display', label: 'Display', items: [
    { key: 'theme', label: 'Theme', value: 'Dark (Apex)', type: 'text' },
    { key: 'density', label: 'Density', value: 'Compact', type: 'text' },
    { key: 'fontSize', label: 'Font Size', value: '13px', type: 'text' },
  ]},
  { id: 'data', label: 'Data & Streams', items: [
    { key: 'mode', label: 'Run Mode', value: 'LIVE', type: 'text' },
    { key: 'provider', label: 'LLM Provider', value: 'Online', type: 'text' },
    { key: 'replayCache', label: 'Replay Cache', value: 'Enabled', type: 'text' },
  ]},
  { id: 'keys', label: 'API Keys', items: [
    { key: 'polygon', label: 'Polygon', value: 'Not Set', type: 'text' },
    { key: 'finnhub', label: 'Finnhub', value: 'Not Set', type: 'text' },
    { key: 'alpaca', label: 'Alpaca', value: 'Not Set', type: 'text' },
  ]},
];

export function SettingsUI2() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div data-testid="settings-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader title="Settings" subtitle="Configuration and platform preferences" icon="S" testId="settings-header" />
      </div>

      <div style={{ padding: '0 16px 8px 16px' }}>
        <Tabs
          items={[
            { id: 'general', label: 'General' },
            { id: 'about', label: 'About' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          testId="settings-tabs"
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        {activeTab === 'general' && (
          <div data-testid="settings-general">
            {SETTINGS_SECTIONS.map(section => (
              <div key={section.id} data-testid={`settings-section-${section.id}`} style={{
                marginBottom: '20px', padding: '16px', background: 'var(--ui2-bg-panel)',
                border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-md)',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '12px' }}>{section.label}</div>
                {section.items.map(item => (
                  <div key={item.key} data-testid={`settings-item-${item.key}`} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: '1px solid var(--ui2-border)',
                  }}>
                    <span style={{ fontSize: '13px', color: 'var(--ui2-text-secondary)' }}>{item.label}</span>
                    <span style={{ fontSize: '13px', color: 'var(--ui2-text-primary)', fontFamily: 'monospace' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'about' && (
          <div data-testid="settings-about">
            <div style={{
              padding: '20px', background: 'var(--ui2-bg-panel)', border: '1px solid var(--ui2-border)',
              borderRadius: 'var(--ui2-radius-md)',
            }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ui2-text-primary)', marginBottom: '4px' }}>
                Apex Terminal
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ui2-text-muted)', marginBottom: '16px' }}>
                Professional Trading & Risk Management Platform
              </div>
              <div data-testid="settings-about-info" style={{ fontSize: '13px', lineHeight: 2, fontFamily: 'monospace', color: 'var(--ui2-text-secondary)' }}>
                <div>Version: 1.62.0</div>
                <div>Build: dde87004</div>
                <div>Mode: Online</div>
                <div>Session Start: {new Date().toISOString()}</div>
                <div>Environment: production</div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div data-testid="settings-ready" style={{ display: 'none' }} />
    </div>
  );
}
