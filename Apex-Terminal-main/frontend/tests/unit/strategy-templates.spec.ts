import { describe, it, expect } from 'vitest';
import { STRATEGY_TEMPLATES } from '../../src/features/options/StrategyBuilder';

describe('Strategy Templates', () => {
  it('contains 10 templates and expected names', () => {
    expect(STRATEGY_TEMPLATES.length).toBe(10);
    const names = STRATEGY_TEMPLATES.map(t => t.name);
    expect(names).toEqual(expect.arrayContaining([
      'Covered Call',
      'Protective Put',
      'Bull Call Spread',
      'Bear Put Spread',
      'Iron Condor',
      'Straddle',
      'Strangle',
      'Butterfly Spread',
      'Calendar Spread',
      'Collar'
    ]));
  });
});