/**
 * RiskUI2 Page
 * Embeds the real OptionsView from UI1 — includes Options Chain, IV, Risk Desk, Strategy Lab
 */

import { OptionsView } from '../../features/layout/views/OptionsView';
import { PageHeader } from '../components';

export function RiskUI2() {
  return (
    <div data-testid="risk-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Risk & Options"
          subtitle="Options chain, IV analysis, Risk Desk, Strategy Lab"
          icon="🛡️"
          testId="risk-header"
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        <OptionsView />
      </div>
    </div>
  );
}
