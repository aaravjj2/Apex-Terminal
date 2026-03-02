import { describe, it, expect } from 'vitest';
import {
  orderStatusColor,
  orderStatusLabel,
  isOrderActive,
  isOrderTerminal,
  formatPnl,
  pnlColor,
  type OrderStatus,
} from '../../src/api/tradingApi';

describe('order-types: orderStatusColor', () => {
  it('returns color for each status', () => {
    const statuses: OrderStatus[] = [
      'new', 'pending', 'partially_filled', 'filled',
      'cancelled', 'rejected', 'expired', 'replaced',
    ];
    statuses.forEach((s) => {
      expect(orderStatusColor(s)).toBeTruthy();
      expect(orderStatusColor(s).startsWith('#')).toBe(true);
    });
  });
});

describe('order-types: orderStatusLabel', () => {
  it('returns label for each status', () => {
    expect(orderStatusLabel('new')).toBe('New');
    expect(orderStatusLabel('filled')).toBe('Filled');
    expect(orderStatusLabel('cancelled')).toBe('Cancelled');
    expect(orderStatusLabel('rejected')).toBe('Rejected');
  });
});

describe('order-types: isOrderActive', () => {
  it('true for new, pending, partially_filled', () => {
    expect(isOrderActive('new')).toBe(true);
    expect(isOrderActive('pending')).toBe(true);
    expect(isOrderActive('partially_filled')).toBe(true);
  });
  it('false for filled, cancelled, rejected, expired', () => {
    expect(isOrderActive('filled')).toBe(false);
    expect(isOrderActive('cancelled')).toBe(false);
    expect(isOrderActive('rejected')).toBe(false);
    expect(isOrderActive('expired')).toBe(false);
  });
  it('false for replaced', () => {
    expect(isOrderActive('replaced')).toBe(false);
  });
});

describe('order-types: isOrderTerminal', () => {
  it('true for filled, cancelled, rejected, expired', () => {
    expect(isOrderTerminal('filled')).toBe(true);
    expect(isOrderTerminal('cancelled')).toBe(true);
    expect(isOrderTerminal('rejected')).toBe(true);
    expect(isOrderTerminal('expired')).toBe(true);
  });
  it('false for new, pending', () => {
    expect(isOrderTerminal('new')).toBe(false);
    expect(isOrderTerminal('pending')).toBe(false);
  });
});

describe('order-types: formatPnl', () => {
  it('formats positive with +', () => {
    expect(formatPnl(100.5)).toMatch(/\+/);
  });
  it('formats negative without +', () => {
    expect(formatPnl(-50.25)).not.toMatch(/\+/);
  });
  it('has 2 decimal places', () => {
    expect(formatPnl(123.456)).toMatch(/123\.46/);
  });
});

describe('order-types: pnlColor', () => {
  it('green for positive', () => {
    expect(pnlColor(1)).toBe('#00d4aa');
  });
  it('red for negative', () => {
    expect(pnlColor(-1)).toBe('#ff4444');
  });
  it('gray for zero', () => {
    expect(pnlColor(0)).toBe('#888888');
  });
});
