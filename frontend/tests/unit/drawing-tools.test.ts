import { describe, it, expect } from 'vitest';
import {
  TrendLine,
  HorizontalLine,
  VerticalLine,
  Ray,
  ExtendedLine,
  Rectangle,
  Circle,
  FibonacciRetracement,
  type DrawingState,
  type Viewport,
} from '../../src/lib/ta/drawing-tools';

const viewport: Viewport = {
  timeRange: [1000, 5000],
  priceRange: [90, 120],
  width: 800,
  height: 400,
};

describe('drawing-tools: hitTest', () => {
  it('TrendLine hits when near segment', () => {
    const state: DrawingState = {
      points: [
        { time: 1000, price: 100 },
        { time: 5000, price: 110 },
      ],
    };
    // Midpoint in px: x=400, y ~ halfway
    const hit = TrendLine.hitTest(state, {
      x: 400,
      y: 200,
      viewport,
      tolerance: 20,
    });
    expect(hit.hit).toBe(true);
  });

  it('TrendLine does not hit when far', () => {
    const state: DrawingState = {
      points: [
        { time: 1000, price: 100 },
        { time: 5000, price: 110 },
      ],
    };
    const hit = TrendLine.hitTest(state, {
      x: 10,
      y: 10,
      viewport,
      tolerance: 2,
    });
    expect(hit.hit).toBe(false);
  });

  it('HorizontalLine hits on same y', () => {
    const state: DrawingState = {
      points: [{ time: 2000, price: 105 }],
    };
    // price 105: y = (120-105)/30 * 400 = 200
    const hit = HorizontalLine.hitTest(state, {
      x: 400,
      y: 200,
      viewport,
      tolerance: 15,
    });
    expect(hit.hit).toBe(true);
  });

  it('Rectangle hitTest with 2 points', () => {
    const state: DrawingState = {
      points: [
        { time: 1000, price: 100 },
        { time: 3000, price: 115 },
      ],
    };
    const hit = Rectangle.hitTest(state, { x: 400, y: 100, viewport });
    expect(typeof hit.hit).toBe('boolean');
  });
});

describe('drawing-tools: toJSON / fromJSON', () => {
  it('TrendLine round-trip', () => {
    const state: DrawingState = {
      points: [
        { time: 1000, price: 100 },
        { time: 5000, price: 110 },
      ],
    };
    const json = TrendLine.toJSON(state);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.points).toHaveLength(2);
    expect(parsed.points[0].time).toBe(1000);

    const restored = TrendLine.fromJSON(json);
    expect(restored.points).toHaveLength(2);
    expect(restored.points[0].price).toBe(100);
  });

  it('HorizontalLine round-trip', () => {
    const state: DrawingState = {
      points: [{ time: 2000, price: 105 }],
    };
    const json = HorizontalLine.toJSON(state);
    const restored = HorizontalLine.fromJSON(json);
    expect(restored.points[0].price).toBe(105);
  });

  it('FibonacciRetracement round-trip', () => {
    const state: DrawingState = {
      points: [
        { time: 1000, price: 100 },
        { time: 5000, price: 120 },
      ],
    };
    const json = FibonacciRetracement.toJSON(state);
    const restored = FibonacciRetracement.fromJSON(json);
    expect(restored.points).toHaveLength(2);
  });

  it('Rectangle round-trip', () => {
    const state: DrawingState = {
      points: [
        { time: 1000, price: 100 },
        { time: 3000, price: 115 },
      ],
    };
    const json = Rectangle.toJSON(state);
    const restored = Rectangle.fromJSON(json);
    expect(restored.points).toHaveLength(2);
  });

  it('Circle round-trip', () => {
    const state: DrawingState = {
      points: [
        { time: 2000, price: 105 },
        { time: 3000, price: 110 },
      ],
    };
    const json = Circle.toJSON(state);
    const restored = Circle.fromJSON(json);
    expect(restored.points).toHaveLength(2);
  });
});

describe('drawing-tools: render', () => {
  it('TrendLine render does not throw when ctx valid', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // skip in environments without 2d context
    const state: DrawingState = {
      points: [
        { time: 1000, price: 100 },
        { time: 5000, price: 110 },
      ],
    };
    expect(() =>
      TrendLine.render(state, { ctx, viewport })
    ).not.toThrow();
  });

  it('HorizontalLine render does not throw when ctx valid', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state: DrawingState = {
      points: [{ time: 2000, price: 105 }],
    };
    expect(() =>
      HorizontalLine.render(state, { ctx, viewport })
    ).not.toThrow();
  });
});
