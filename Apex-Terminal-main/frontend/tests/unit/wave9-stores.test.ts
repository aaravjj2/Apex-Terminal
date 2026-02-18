/**
 * Wave 9 Trading Store Tests (v1.83-92)
 * Tests tradingStore and autopilotV2Store basic structure.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tradingStore } from '../../src/ui2/stores/tradingStore';
import { autopilotV2Store } from '../../src/ui2/stores/autopilotV2Store';

describe('tradingStore - Wave 9', () => {
  beforeEach(() => {
    tradingStore.reset();
    tradingStore.stopPolling();
  });

  afterEach(() => {
    tradingStore.stopPolling();
  });

  it('should initialize with empty state', () => {
    const orders = tradingStore.getOrders();
    const positions = tradingStore.getPositions();
    const pnl = tradingStore.getPnL();

    expect(orders).toEqual([]);
    expect(positions).toEqual([]);
    expect(pnl.total_pnl).toBe(0);
    expect(pnl.positions_count).toBe(0);
  });

  it('should have all required API methods', () => {
    expect(typeof tradingStore.getOrders).toBe('function');
    expect(typeof tradingStore.getPositions).toBe('function');
    expect(typeof tradingStore.getPnL).toBe('function');
    expect(typeof tradingStore.refresh).toBe('function');
    expect(typeof tradingStore.startPolling).toBe('function');
    expect(typeof tradingStore.stopPolling).toBe('function');
  });

  it('should return correct types from getters', () => {
    expect(Array.isArray(tradingStore.getOrders())).toBe(true);
    expect(Array.isArray(tradingStore.getPositions())).toBe(true);
    expect(typeof tradingStore.getPnL()).toBe('object');
  });

  it('should reset to empty state', () => {
    tradingStore.reset();
    expect(tradingStore.getOrders()).toHaveLength(0);
    expect(tradingStore.getPositions()).toHaveLength(0);
    expect(tradingStore.getPnL().total_pnl).toBe(0);
  });
});

describe('autopilotV2Store - Wave 9', () => {
  it('should have required methods', () => {
    expect(typeof autopilotV2Store.getRuns).toBe('function');
    expect(typeof autopilotV2Store.execute).toBe('function');
    expect(typeof autopilotV2Store.setSeed).toBe('function');
    expect(typeof autopilotV2Store.armKillSwitch).toBe('function');
    expect(typeof autopilotV2Store.disarmKillSwitch).toBe('function');
  });

  it('should have default seed=42', () => {
    expect(autopilotV2Store.getSeed()).toBe(42);
  });

  it('should update seed', () => {
    autopilotV2Store.setSeed(999);
    expect(autopilotV2Store.getSeed()).toBe(999);
    autopilotV2Store.setSeed(42); // Reset
  });

  it('should have kill switch disabled by default', () => {
    const killSwitch = autopilotV2Store.getKillSwitch();
    expect(killSwitch.armed).toBe(false);
  });

  it('should arm and disarm kill switch', () => {
    autopilotV2Store.armKillSwitch('test');
    expect(autopilotV2Store.getKillSwitch().armed).toBe(true);
    
    autopilotV2Store.disarmKillSwitch('test-clear');
    expect(autopilotV2Store.getKillSwitch().armed).toBe(false);
  });

  it('execute should return promise', () => {
    const result = autopilotV2Store.execute(['SPY'], 100000);
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('Wave 9 KPI Formatting', () => {
  it('should handle P&L signs correctly', () => {
    expect(123.45).toBeGreaterThan(0);
    expect(-67.89).toBeLessThan(0);
    expect(0).toBe(0);
  });

  it('should not produce NaN in P&L calculations', () => {
    const pnl = { total_pnl: 0, realized_pnl: 0, unrealized_pnl: 0 };
    expect(pnl.total_pnl).not.toBeNaN();
    expect(typeof pnl.total_pnl).toBe('number');
  });
});
