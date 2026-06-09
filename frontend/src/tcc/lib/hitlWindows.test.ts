import { describe, expect, it } from 'vitest';

import {
  computeDriftPct,
  computeHITLWindows,
  driftLevel,
  HITL_CUTOFF_MIN,
  HITL_HARD_CLOCK_MIN,
  HITL_SOFT_OPEN_MIN,
} from './hitlWindows';

/** Build a Date whose America/New_York clock reads hour:minute:00 (approx). */
function etTime(hour: number, minute: number): Date {
  const ref = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(ref);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? '01';
  const iso = `${get('year')}-${get('month')}-${get('day')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

describe('computeHITLWindows', () => {
  it('enables pre-authorize during soft window', () => {
    const now = etTime(8, 10);
    const w = computeHITLWindows(now);
    expect(w.phase).toBe('soft_preopen');
    expect(w.preAuthorizeEnabled).toBe(true);
    expect(w.authorizeEnabled).toBe(false);
  });

  it('enables authorize during hard window', () => {
    const now = etTime(9, 35);
    const w = computeHITLWindows(now);
    expect(w.phase).toBe('hard_window');
    expect(w.authorizeEnabled).toBe(true);
  });

  it('expires after cutoff', () => {
    const now = etTime(9, 46);
    const w = computeHITLWindows(now);
    expect(w.phase).toBe('expired');
    expect(w.countdownActive).toBe(false);
  });
});

describe('driftLevel', () => {
  it('warns above 0.4%', () => {
    expect(driftLevel(0.41)).toBe('warning');
  });

  it('invalidates above 0.5%', () => {
    expect(driftLevel(0.51)).toBe('critical');
  });

  it('computes drift pct', () => {
    expect(computeDriftPct(100, 100.5)).toBeCloseTo(0.5, 2);
  });
});

describe('window constants', () => {
  it('matches spec minutes', () => {
    expect(HITL_SOFT_OPEN_MIN).toBe(8 * 60 + 5);
    expect(HITL_HARD_CLOCK_MIN).toBe(9 * 60 + 30);
    expect(HITL_CUTOFF_MIN).toBe(9 * 60 + 45);
  });
});
