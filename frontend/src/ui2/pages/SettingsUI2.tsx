/**
 * SettingsUI2 Page
 * Embeds the real SettingsView from UI1
 */
import { SettingsView } from '../../features/layout/views/SettingsView';

export function SettingsUI2() {
  return (
    <div data-testid="settings-ui2-page" style={{ height: '100%', overflow: 'auto' }}>
      <SettingsView />
    </div>
  );
}
