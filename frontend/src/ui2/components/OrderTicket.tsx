/**
 * v1.57 — OrderTicket Component
 * Full order entry with market/limit/stop, validation, preview, and placement
 */

import { useState, useCallback } from 'react';
import {
  validateOrder,
  previewOrder,
  placeOrder,
  type OrderTicket as OrderTicketType,
  type OrderSide,
  type OrderType,
  type OrderTIF,
  type OrderValidationError,
} from '../stores/orderTicketStore';

interface OrderTicketProps {
  testId?: string;
  onOrderPlaced?: (order: OrderTicketType) => void;
}

export function OrderTicket({ testId = 'ui2-order-ticket', onOrderPlaced }: OrderTicketProps) {
  const [symbol, setSymbol] = useState('SPY');
  const [side, setSide] = useState<OrderSide>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState(100);
  const [limitPrice, setLimitPrice] = useState(0);
  const [stopPrice, setStopPrice] = useState(0);
  const [tif, setTif] = useState<OrderTIF>('day');
  const [errors, setErrors] = useState<OrderValidationError[]>([]);
  const [preview, setPreview] = useState<OrderTicketType | null>(null);
  const [lastPlaced, setLastPlaced] = useState<OrderTicketType | null>(null);

  const handlePreview = useCallback(() => {
    const ticket = { symbol, side, type, quantity, limitPrice: type === 'limit' ? limitPrice : undefined, stopPrice: type === 'stop' ? stopPrice : undefined, tif };
    const validationErrors = validateOrder(ticket);
    setErrors(validationErrors);
    if (validationErrors.length === 0) {
      const p = previewOrder(ticket);
      setPreview(p);
    } else {
      setPreview(null);
    }
  }, [symbol, side, type, quantity, limitPrice, stopPrice, tif]);

  const handlePlace = useCallback(() => {
    if (!preview) return;
    const placed = placeOrder(preview);
    setLastPlaced(placed);
    setPreview(null);
    setErrors([]);
    onOrderPlaced?.(placed);
  }, [preview, onOrderPlaced]);

  const handleCancel = useCallback(() => {
    setPreview(null);
    setErrors([]);
  }, []);

  return (
    <div data-testid={testId} style={{ padding: '16px', background: 'var(--ui2-bg-panel)', borderRadius: 'var(--ui2-radius-md)', border: '1px solid var(--ui2-border)' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '12px' }}>
        Order Ticket
      </div>

      {/* Validation Errors Banner */}
      {errors.length > 0 && (
        <div data-testid={`${testId}-errors`} style={{
          padding: '8px 12px', marginBottom: '12px', background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--ui2-radius-sm)',
          color: 'var(--ui2-danger)', fontSize: '12px',
        }}>
          {errors.map((e, i) => (
            <div key={i} data-testid={`${testId}-error-${e.field}`}>{e.field}: {e.message}</div>
          ))}
        </div>
      )}

      {/* Success Banner */}
      {lastPlaced && (
        <div data-testid={`${testId}-success`} style={{
          padding: '8px 12px', marginBottom: '12px', background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--ui2-radius-sm)',
          color: 'var(--ui2-success)', fontSize: '12px',
        }}>
          Order {lastPlaced.id} placed: {lastPlaced.side} {lastPlaced.quantity} {lastPlaced.symbol} ({lastPlaced.status})
        </div>
      )}

      {!preview ? (
        /* Entry form */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Symbol */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ width: '70px', fontSize: '12px', color: 'var(--ui2-text-secondary)' }}>Symbol</label>
            <input
              data-testid={`${testId}-symbol`}
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              style={{ flex: 1, padding: '6px 8px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px' }}
            />
          </div>

          {/* Side */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ width: '70px', fontSize: '12px', color: 'var(--ui2-text-secondary)' }}>Side</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['buy', 'sell'] as OrderSide[]).map(s => (
                <button
                  key={s}
                  data-testid={`${testId}-side-${s}`}
                  onClick={() => setSide(s)}
                  style={{
                    padding: '4px 12px', fontSize: '12px', fontWeight: 600, borderRadius: 'var(--ui2-radius-sm)',
                    border: side === s ? 'none' : '1px solid var(--ui2-border)',
                    background: side === s ? (s === 'buy' ? 'var(--ui2-success)' : 'var(--ui2-danger)') : 'var(--ui2-bg-input)',
                    color: side === s ? 'white' : 'var(--ui2-text-secondary)', cursor: 'pointer',
                  }}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ width: '70px', fontSize: '12px', color: 'var(--ui2-text-secondary)' }}>Type</label>
            <select
              data-testid={`${testId}-type`}
              aria-label="Order type"
              value={type}
              onChange={e => setType(e.target.value as OrderType)}
              style={{ flex: 1, padding: '6px 8px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px' }}
            >
              <option value="market">Market</option>
              <option value="limit">Limit</option>
              <option value="stop">Stop</option>
            </select>
          </div>

          {/* Quantity */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ width: '70px', fontSize: '12px', color: 'var(--ui2-text-secondary)' }}>Quantity</label>
            <input
              data-testid={`${testId}-quantity`}
              type="number"
              value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value) || 0)}
              style={{ flex: 1, padding: '6px 8px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px' }}
            />
          </div>

          {/* Limit Price (conditional) */}
          {type === 'limit' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ width: '70px', fontSize: '12px', color: 'var(--ui2-text-secondary)' }}>Price</label>
              <input
                data-testid={`${testId}-limit-price`}
                type="number"
                step="0.01"
                value={limitPrice}
                onChange={e => setLimitPrice(parseFloat(e.target.value) || 0)}
                style={{ flex: 1, padding: '6px 8px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px' }}
              />
            </div>
          )}

          {/* Stop Price (conditional) */}
          {type === 'stop' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ width: '70px', fontSize: '12px', color: 'var(--ui2-text-secondary)' }}>Stop</label>
              <input
                data-testid={`${testId}-stop-price`}
                type="number"
                step="0.01"
                value={stopPrice}
                onChange={e => setStopPrice(parseFloat(e.target.value) || 0)}
                style={{ flex: 1, padding: '6px 8px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px' }}
              />
            </div>
          )}

          {/* TIF */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ width: '70px', fontSize: '12px', color: 'var(--ui2-text-secondary)' }}>TIF</label>
            <select
              data-testid={`${testId}-tif`}
              aria-label="Time in force"
              value={tif}
              onChange={e => setTif(e.target.value as OrderTIF)}
              style={{ flex: 1, padding: '6px 8px', background: 'var(--ui2-bg-input)', border: '1px solid var(--ui2-border)', borderRadius: 'var(--ui2-radius-sm)', color: 'var(--ui2-text-primary)', fontSize: '13px' }}
            >
              <option value="day">DAY</option>
              <option value="gtc">GTC</option>
              <option value="ioc">IOC</option>
              <option value="fok">FOK</option>
            </select>
          </div>

          {/* Preview Button */}
          <button
            data-testid={`${testId}-preview-btn`}
            onClick={handlePreview}
            style={{
              marginTop: '8px', padding: '8px 16px', background: 'var(--ui2-brand-primary)',
              color: 'white', border: 'none', borderRadius: 'var(--ui2-radius-md)',
              fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}
          >
            Preview Order
          </button>
        </div>
      ) : (
        /* Preview confirmation */
        <div data-testid={`${testId}-preview`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ui2-text-primary)', marginBottom: '4px' }}>
            Order Preview
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ui2-text-secondary)', lineHeight: 1.6 }}>
            <div><strong>ID:</strong> {preview.id}</div>
            <div><strong>Action:</strong> {preview.side.toUpperCase()} {preview.quantity} {preview.symbol}</div>
            <div><strong>Type:</strong> {preview.type.toUpperCase()}</div>
            {preview.limitPrice && <div><strong>Limit:</strong> ${preview.limitPrice.toFixed(2)}</div>}
            {preview.stopPrice && <div><strong>Stop:</strong> ${preview.stopPrice.toFixed(2)}</div>}
            <div><strong>TIF:</strong> {preview.tif.toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              data-testid={`${testId}-place-btn`}
              onClick={handlePlace}
              style={{
                flex: 1, padding: '8px 16px', background: side === 'buy' ? 'var(--ui2-success)' : 'var(--ui2-danger)',
                color: 'white', border: 'none', borderRadius: 'var(--ui2-radius-md)',
                fontWeight: 600, fontSize: '13px', cursor: 'pointer',
              }}
            >
              Place Order
            </button>
            <button
              data-testid={`${testId}-cancel-btn`}
              onClick={handleCancel}
              style={{
                padding: '8px 16px', background: 'var(--ui2-bg-input)',
                color: 'var(--ui2-text-secondary)', border: '1px solid var(--ui2-border)',
                borderRadius: 'var(--ui2-radius-md)', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
