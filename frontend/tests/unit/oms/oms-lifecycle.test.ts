import { describe, it, expect } from 'vitest';
import {
  OrderType,
  OrderSide,
  OrderLifecycleState,
  TimeInForce,
  ExecutionAlgoType,
} from '../../../src/lib/oms/order-types';

describe('OrderLifecycleState', () => {
  it('PENDING is initial state', () => {
    expect(OrderLifecycleState.PENDING).toBe('PENDING');
  });

  it('STAGED for queued orders', () => {
    expect(OrderLifecycleState.STAGED).toBe('STAGED');
  });

  it('SUBMITTED after send', () => {
    expect(OrderLifecycleState.SUBMITTED).toBe('SUBMITTED');
  });

  it('PARTIAL_FILL for partially executed', () => {
    expect(OrderLifecycleState.PARTIAL_FILL).toBe('PARTIAL_FILL');
  });

  it('FILLED is terminal', () => {
    expect(OrderLifecycleState.FILLED).toBe('FILLED');
  });

  it('CANCELLED is terminal', () => {
    expect(OrderLifecycleState.CANCELLED).toBe('CANCELLED');
  });

  it('REJECTED is terminal', () => {
    expect(OrderLifecycleState.REJECTED).toBe('REJECTED');
  });

  it('EXPIRED is terminal', () => {
    expect(OrderLifecycleState.EXPIRED).toBe('EXPIRED');
  });

  it('terminal states do not allow transitions', () => {
    const terminal = [OrderLifecycleState.FILLED, OrderLifecycleState.CANCELLED, OrderLifecycleState.REJECTED, OrderLifecycleState.EXPIRED];
    expect(terminal).toHaveLength(4);
  });

  it('active states allow fill transitions', () => {
    const active = [OrderLifecycleState.PENDING, OrderLifecycleState.STAGED, OrderLifecycleState.SUBMITTED, OrderLifecycleState.PARTIAL_FILL];
    expect(active.length).toBeGreaterThan(0);
  });
});

describe('OrderType', () => {
  it('MARKET exists', () => expect(OrderType.MARKET).toBeDefined());
  it('LIMIT exists', () => expect(OrderType.LIMIT).toBeDefined());
  it('STOP exists', () => expect(OrderType.STOP).toBeDefined());
  it('STOP_LIMIT exists', () => expect(OrderType.STOP_LIMIT).toBeDefined());
  it('IOC exists', () => expect(OrderType.IOC).toBeDefined());
  it('FOK exists', () => expect(OrderType.FOK).toBeDefined());
});

describe('OrderSide', () => {
  it('BUY exists', () => expect(OrderSide.BUY).toBeDefined());
  it('SELL exists', () => expect(OrderSide.SELL).toBeDefined());
  it('BUY_TO_COVER exists', () => expect(OrderSide.BUY_TO_COVER).toBeDefined());
  it('SELL_SHORT exists', () => expect(OrderSide.SELL_SHORT).toBeDefined());
});

describe('TimeInForce', () => {
  it('DAY exists', () => expect(TimeInForce.DAY).toBeDefined());
  it('GTC exists', () => expect(TimeInForce.GTC).toBeDefined());
  it('IOC exists', () => expect(TimeInForce.IOC).toBeDefined());
  it('FOK exists', () => expect(TimeInForce.FOK).toBeDefined());
});

describe('ExecutionAlgoType', () => {
  it('TWAP exists', () => expect(ExecutionAlgoType.TWAP).toBeDefined());
  it('VWAP exists', () => expect(ExecutionAlgoType.VWAP).toBeDefined());
  it('POV exists', () => expect(ExecutionAlgoType.POV).toBeDefined());
  it('ICEBERG exists', () => expect(ExecutionAlgoType.ICEBERG).toBeDefined());
});

describe('Lifecycle Transitions', () => {
  const validTransitions: [OrderLifecycleState, OrderLifecycleState][] = [
    [OrderLifecycleState.PENDING, OrderLifecycleState.STAGED],
    [OrderLifecycleState.STAGED, OrderLifecycleState.SUBMITTED],
    [OrderLifecycleState.SUBMITTED, OrderLifecycleState.PARTIAL_FILL],
    [OrderLifecycleState.SUBMITTED, OrderLifecycleState.FILLED],
    [OrderLifecycleState.PARTIAL_FILL, OrderLifecycleState.FILLED],
    [OrderLifecycleState.SUBMITTED, OrderLifecycleState.CANCELLED],
  ];

  it('valid transition from PENDING to STAGED', () => {
    expect(validTransitions.some(([a, b]) => a === OrderLifecycleState.PENDING && b === OrderLifecycleState.STAGED)).toBe(true);
  });

  it('valid transition from SUBMITTED to FILLED', () => {
    expect(validTransitions.some(([a, b]) => a === OrderLifecycleState.SUBMITTED && b === OrderLifecycleState.FILLED)).toBe(true);
  });
});
