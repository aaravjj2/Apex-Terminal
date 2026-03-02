import { describe, it, expect } from 'vitest';
import { OrderBook } from '../../../src/lib/orders/orderBook';
import { OrderSide, OrderType, OrderStatus, TimeInForce, Venue } from '../../../src/lib/orders/types';
import type { Order } from '../../../src/lib/orders/types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: `O-${Math.random().toString(36).slice(2, 8)}`,
    clientOrderId: 'C-1',
    accountId: 'ACC-1',
    symbol: 'AAPL',
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    timeInForce: TimeInForce.GTC,
    status: OrderStatus.NEW,
    quantity: 100,
    filledQuantity: 0,
    remainingQuantity: 100,
    avgFillPrice: 0,
    commission: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: {},
    price: 150,
    ...overrides,
  };
}

describe('OrderBook – add bid/ask orders', () => {
  it('accepts a limit buy order', () => {
    const book = new OrderBook('AAPL');
    const order = makeOrder({ side: OrderSide.BUY, price: 150 });
    const { fills, remainingQty } = book.addOrder(order);
    expect(fills).toHaveLength(0);
    expect(remainingQty).toBe(100);
    expect(book.bestBid).toBe(150);
  });

  it('accepts a limit sell order', () => {
    const book = new OrderBook('AAPL');
    const order = makeOrder({ side: OrderSide.SELL, price: 151 });
    const { fills, remainingQty } = book.addOrder(order);
    expect(fills).toHaveLength(0);
    expect(remainingQty).toBe(100);
    expect(book.bestAsk).toBe(151);
  });

  it('maintains best bid/ask correctly', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 149 }));
    book.addOrder(makeOrder({ id: 'B2', side: OrderSide.BUY, price: 150 }));
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 152 }));
    book.addOrder(makeOrder({ id: 'A2', side: OrderSide.SELL, price: 151 }));
    expect(book.bestBid).toBe(150);
    expect(book.bestAsk).toBe(151);
  });

  it('multiple orders at the same price level', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150, quantity: 50, remainingQuantity: 50 }));
    book.addOrder(makeOrder({ id: 'B2', side: OrderSide.BUY, price: 150, quantity: 75, remainingQuantity: 75 }));
    const l2 = book.getLevel2(5);
    expect(l2.bids.length).toBe(1);
    expect(l2.bids[0].quantity).toBe(125);
    expect(l2.bids[0].orderCount).toBe(2);
  });
});

describe('OrderBook – order matching', () => {
  it('market buy fills against asks', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151, quantity: 50, remainingQuantity: 50 }));
    book.addOrder(makeOrder({ id: 'A2', side: OrderSide.SELL, price: 152, quantity: 100, remainingQuantity: 100 }));

    const mktBuy = makeOrder({ id: 'M1', side: OrderSide.BUY, type: OrderType.MARKET, quantity: 70, remainingQuantity: 70 });
    const { fills, remainingQty } = book.addOrder(mktBuy);
    expect(fills.length).toBe(2);
    expect(fills[0].price).toBe(151);
    expect(fills[0].quantity).toBe(50);
    expect(fills[1].price).toBe(152);
    expect(fills[1].quantity).toBe(20);
    expect(remainingQty).toBe(0);
  });

  it('market sell fills against bids', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150, quantity: 100, remainingQuantity: 100 }));

    const mktSell = makeOrder({ id: 'M1', side: OrderSide.SELL, type: OrderType.MARKET, quantity: 50, remainingQuantity: 50 });
    const { fills, remainingQty } = book.addOrder(mktSell);
    expect(fills.length).toBe(1);
    expect(fills[0].price).toBe(150);
    expect(fills[0].quantity).toBe(50);
    expect(remainingQty).toBe(0);
  });

  it('limit buy crosses the spread and matches', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151, quantity: 30, remainingQuantity: 30 }));

    const limitBuy = makeOrder({ id: 'L1', side: OrderSide.BUY, price: 152, quantity: 50, remainingQuantity: 50 });
    const { fills, remainingQty } = book.addOrder(limitBuy);
    expect(fills.length).toBe(1);
    expect(fills[0].quantity).toBe(30);
    expect(remainingQty).toBe(20);
    expect(book.bestBid).toBe(152);
  });
});

describe('OrderBook – price-time priority', () => {
  it('fills earlier orders at the same price first', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151, quantity: 30, remainingQuantity: 30 }));
    book.addOrder(makeOrder({ id: 'A2', side: OrderSide.SELL, price: 151, quantity: 50, remainingQuantity: 50 }));

    const mktBuy = makeOrder({ id: 'M1', side: OrderSide.BUY, type: OrderType.MARKET, quantity: 40, remainingQuantity: 40 });
    const { fills } = book.addOrder(mktBuy);
    expect(fills[0].orderId).toBe('A1');
    expect(fills[0].quantity).toBe(30);
    expect(fills[1].orderId).toBe('A2');
    expect(fills[1].quantity).toBe(10);
  });

  it('fills better-priced asks first for buy orders', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'A_152', side: OrderSide.SELL, price: 152, quantity: 50, remainingQuantity: 50 }));
    book.addOrder(makeOrder({ id: 'A_151', side: OrderSide.SELL, price: 151, quantity: 50, remainingQuantity: 50 }));

    const mktBuy = makeOrder({ id: 'M1', side: OrderSide.BUY, type: OrderType.MARKET, quantity: 30, remainingQuantity: 30 });
    const { fills } = book.addOrder(mktBuy);
    expect(fills.length).toBe(1);
    expect(fills[0].price).toBe(151);
  });
});

describe('OrderBook – cancel orders', () => {
  it('cancels an existing order', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150 }));
    expect(book.cancelOrder('B1')).toBe(true);
    expect(book.bestBid).toBeUndefined();
  });

  it('returns false for non-existent order', () => {
    const book = new OrderBook('AAPL');
    expect(book.cancelOrder('FAKE')).toBe(false);
  });

  it('removes cancelled order from depth', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150, quantity: 50, remainingQuantity: 50 }));
    book.addOrder(makeOrder({ id: 'B2', side: OrderSide.BUY, price: 150, quantity: 30, remainingQuantity: 30 }));
    book.cancelOrder('B1');
    const depth = book.getDepthAtPrice(150, 'BID');
    expect(depth).toBe(30);
  });
});

describe('OrderBook – modify orders', () => {
  it('modifies quantity of existing order', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150, quantity: 100, remainingQuantity: 100 }));
    expect(book.modifyOrder('B1', 50)).toBe(true);
    expect(book.getDepthAtPrice(150, 'BID')).toBe(50);
  });

  it('modifies price and moves to new level', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150, quantity: 100, remainingQuantity: 100 }));
    expect(book.modifyOrder('B1', 100, 151)).toBe(true);
    expect(book.bestBid).toBe(151);
    expect(book.getDepthAtPrice(150, 'BID')).toBe(0);
  });

  it('returns false for non-existent order', () => {
    const book = new OrderBook('AAPL');
    expect(book.modifyOrder('FAKE', 50)).toBe(false);
  });
});

describe('OrderBook – book depth', () => {
  it('getLevel2 returns correct depth', () => {
    const book = new OrderBook('AAPL');
    for (let p = 145; p <= 150; p++) {
      book.addOrder(makeOrder({ id: `B${p}`, side: OrderSide.BUY, price: p, quantity: 100, remainingQuantity: 100 }));
    }
    for (let p = 151; p <= 156; p++) {
      book.addOrder(makeOrder({ id: `A${p}`, side: OrderSide.SELL, price: p, quantity: 100, remainingQuantity: 100 }));
    }
    const l2 = book.getLevel2(3);
    expect(l2.bids.length).toBe(3);
    expect(l2.asks.length).toBe(3);
    expect(l2.bids[0].price).toBe(150);
    expect(l2.asks[0].price).toBe(151);
  });

  it('getCumulativeDepth accumulates correctly', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150, quantity: 100, remainingQuantity: 100 }));
    book.addOrder(makeOrder({ id: 'B2', side: OrderSide.BUY, price: 149, quantity: 200, remainingQuantity: 200 }));
    const cum = book.getCumulativeDepth('BID', 2);
    expect(cum.length).toBe(2);
    expect(cum[0].cumQty).toBe(100);
    expect(cum[1].cumQty).toBe(300);
  });
});

describe('OrderBook – imbalance calculation', () => {
  it('positive imbalance when bid volume > ask volume', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150, quantity: 500, remainingQuantity: 500 }));
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151, quantity: 100, remainingQuantity: 100 }));
    expect(book.orderBookImbalance()).toBeGreaterThan(0);
  });

  it('negative imbalance when ask volume > bid volume', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150, quantity: 100, remainingQuantity: 100 }));
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151, quantity: 500, remainingQuantity: 500 }));
    expect(book.orderBookImbalance()).toBeLessThan(0);
  });

  it('zero imbalance when equal', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150, quantity: 200, remainingQuantity: 200 }));
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151, quantity: 200, remainingQuantity: 200 }));
    expect(book.orderBookImbalance()).toBeCloseTo(0, 10);
  });

  it('zero imbalance for empty book', () => {
    const book = new OrderBook('AAPL');
    expect(book.orderBookImbalance()).toBe(0);
  });
});

describe('OrderBook – spread calculation', () => {
  it('computes spread', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150 }));
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151 }));
    expect(book.spread).toBe(1);
  });

  it('midPrice is average of best bid and ask', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150 }));
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 152 }));
    expect(book.midPrice).toBe(151);
  });

  it('spread is Infinity for one-sided book', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150 }));
    expect(book.spread).toBe(Infinity);
  });

  it('bidAskSpreadBps is correct', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 100, quantity: 100, remainingQuantity: 100 }));
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 101, quantity: 100, remainingQuantity: 100 }));
    const bps = book.bidAskSpreadBps();
    expect(bps).toBeCloseTo(10000 / 100.5, 0);
  });
});

describe('OrderBook – FOK and IOC', () => {
  it('FOK rejects when not fully fillable', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151, quantity: 30, remainingQuantity: 30 }));
    const fok = makeOrder({ id: 'F1', side: OrderSide.BUY, type: OrderType.FOK, quantity: 50, remainingQuantity: 50 });
    const { fills, remainingQty } = book.addOrder(fok);
    expect(fills).toHaveLength(0);
    expect(remainingQty).toBe(50);
  });

  it('FOK fills when fully fillable', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151, quantity: 100, remainingQuantity: 100 }));
    const fok = makeOrder({ id: 'F1', side: OrderSide.BUY, type: OrderType.FOK, quantity: 50, remainingQuantity: 50 });
    const { fills, remainingQty } = book.addOrder(fok);
    expect(fills.length).toBe(1);
    expect(remainingQty).toBe(0);
  });

  it('IOC fills what it can and leaves no rest', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151, quantity: 30, remainingQuantity: 30 }));
    const ioc = makeOrder({ id: 'I1', side: OrderSide.BUY, type: OrderType.IOC, quantity: 50, remainingQuantity: 50 });
    const { fills, remainingQty } = book.addOrder(ioc);
    expect(fills.length).toBe(1);
    expect(fills[0].quantity).toBe(30);
    expect(remainingQty).toBe(20);
  });
});

describe('OrderBook – simulateMarketOrder', () => {
  it('simulates buy walking through ask levels', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151, quantity: 50, remainingQuantity: 50 }));
    book.addOrder(makeOrder({ id: 'A2', side: OrderSide.SELL, price: 152, quantity: 50, remainingQuantity: 50 }));
    const sim = book.simulateMarketOrder(OrderSide.BUY, 80);
    expect(sim.avgPrice).toBeCloseTo((50 * 151 + 30 * 152) / 80, 2);
    expect(sim.levelsConsumed).toBe(2);
  });

  it('returns 0 avgPrice for empty book side', () => {
    const book = new OrderBook('AAPL');
    const sim = book.simulateMarketOrder(OrderSide.BUY, 100);
    expect(sim.avgPrice).toBe(0);
  });
});

describe('OrderBook – snapshot', () => {
  it('returns complete snapshot', () => {
    const book = new OrderBook('AAPL');
    book.addOrder(makeOrder({ id: 'B1', side: OrderSide.BUY, price: 150, quantity: 200, remainingQuantity: 200 }));
    book.addOrder(makeOrder({ id: 'A1', side: OrderSide.SELL, price: 151, quantity: 300, remainingQuantity: 300 }));
    const snap = book.getSnapshot();
    expect(snap.symbol).toBe('AAPL');
    expect(snap.totalBidVolume).toBe(200);
    expect(snap.totalAskVolume).toBe(300);
    expect(snap.spread).toBe(1);
    expect(snap.midPrice).toBe(150.5);
    expect(typeof snap.imbalance).toBe('number');
  });
});
