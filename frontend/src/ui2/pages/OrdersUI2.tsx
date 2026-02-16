/**
 * OrdersUI2 Page
 * Embeds the real OrdersView from UI1 — full order blotter
 */
import { OrdersView } from '../../features/layout/views/OrdersView';

export function OrdersUI2() {
  return (
    <div data-testid="orders-ui2-page" style={{ height: '100%', overflow: 'auto' }}>
      <OrdersView />
    </div>
  );
}
