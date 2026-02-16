/**
 * AutopilotUI2 Page
 * Embeds the real AutopilotView from UI1 — full autopilot system  
 */

import { AutopilotView } from '../../features/layout/views/AutopilotView';
import { PageHeader, Pill } from '../components';

export function AutopilotUI2() {
  return (
    <div data-testid="autopilot-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Autopilot"
          subtitle="AI agent orchestration and autonomous trading"
          icon="🤖"
          badge={<Pill variant="success" size="xs">ENABLED</Pill>}
          testId="autopilot-header"
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        <AutopilotView />
      </div>
    </div>
  );
}
