/**
 * AlertsUI2 Page
 * Embeds the real AlertsView from UI1
 */
import { AlertsView } from '../../features/layout/views/AlertsView';

export function AlertsUI2() {
  return (
    <div data-testid="alerts-ui2-page" style={{ height: '100%', overflow: 'auto' }}>
      <AlertsView />
    </div>
  );
}
