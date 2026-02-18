/**
 * PortfolioUI2 Page
 * Embeds the real EnhancedPortfolioView from UI1 — full portfolio CRUD
 */

import { EnhancedPortfolioView } from '../../features/portfolio/EnhancedPortfolioView';
import { PageHeader } from '../components';

export function PortfolioUI2() {
  return (
    <div data-testid="portfolio-ui2-page" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 0 16px' }}>
        <PageHeader
          title="Portfolio"
          subtitle="Manage portfolios and aggregate metrics"
          icon="💼"
          testId="portfolio-header"
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px 16px' }}>
        <EnhancedPortfolioView />
      </div>
    </div>
  );
}
