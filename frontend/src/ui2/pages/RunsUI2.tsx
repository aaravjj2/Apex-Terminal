/**
 * RunsUI2 Page
 * Embeds the real RunsAuditView from UI1 — audit trail and run history
 */
import { RunsAuditView } from '../../features/layout/views/RunsAuditView';

export function RunsUI2() {
  return (
    <div data-testid="runs-ui2-page" style={{ height: '100%', overflow: 'auto' }}>
      <RunsAuditView />
    </div>
  );
}
