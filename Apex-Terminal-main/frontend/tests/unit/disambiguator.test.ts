/**
 * Unit Tests — Ticker Disambiguator
 */
import { describe, it, expect } from 'vitest';
import {
  disambiguate,
  isAmbiguous,
  isWellKnown,
  getAmbiguousEntry,
  getAmbiguousTickers,
  getWellKnownTickers,
  buildDisambiguationPrompt,
} from '../../src/features/ticker/disambiguator';

describe('disambiguator', () => {
  // ── $ prefix bypasses disambiguation ──────────────────────────────────
  describe('dollar-prefix rule', () => {
    it('$ON resolves as ON without ambiguity', () => {
      const r = disambiguate('$ON');
      expect(r.symbol).toBe('ON');
      expect(r.isAmbiguous).toBe(false);
      expect(r.resolution).toBe('dollar-prefix');
    });

    it('$ai resolves as AI uppercase without ambiguity', () => {
      const r = disambiguate('$ai');
      expect(r.symbol).toBe('AI');
      expect(r.isAmbiguous).toBe(false);
      expect(r.resolution).toBe('dollar-prefix');
    });

    it('$AAPL resolves as AAPL without ambiguity', () => {
      const r = disambiguate('$AAPL');
      expect(r.symbol).toBe('AAPL');
      expect(r.isAmbiguous).toBe(false);
      expect(r.resolution).toBe('dollar-prefix');
    });
  });

  // ── Well-known tickers skip disambiguation ────────────────────────────
  describe('well-known rule', () => {
    it('AAPL is well-known', () => {
      const r = disambiguate('AAPL');
      expect(r.symbol).toBe('AAPL');
      expect(r.isAmbiguous).toBe(false);
      expect(r.resolution).toBe('well-known');
    });

    it('spy (lowercase) resolves as SPY', () => {
      const r = disambiguate('spy');
      expect(r.symbol).toBe('SPY');
      expect(r.isAmbiguous).toBe(false);
      expect(r.resolution).toBe('well-known');
    });

    it('NVDA is well-known', () => {
      const r = disambiguate('NVDA');
      expect(r.isAmbiguous).toBe(false);
      expect(r.resolution).toBe('well-known');
    });
  });

  // ── Watchlist context overrides ambiguity ──────────────────────────────
  describe('watchlist rule', () => {
    it('ON in watchlist → not ambiguous', () => {
      const r = disambiguate('ON', ['AAPL', 'ON', 'SPY']);
      expect(r.symbol).toBe('ON');
      expect(r.isAmbiguous).toBe(false);
      expect(r.resolution).toBe('watchlist');
    });

    it('IT in watchlist → not ambiguous', () => {
      const r = disambiguate('it', ['IT']);
      expect(r.symbol).toBe('IT');
      expect(r.isAmbiguous).toBe(false);
      expect(r.resolution).toBe('watchlist');
    });
  });

  // ── Ambiguous tickers ARE flagged ─────────────────────────────────────
  describe('ambiguity detection', () => {
    const ambiguousCases = ['ON', 'IT', 'AI', 'ALL', 'SO', 'A', 'NOW', 'OPEN', 'DO', 'KEY'];

    it.each(ambiguousCases)('%s is flagged as ambiguous', (sym) => {
      const r = disambiguate(sym);
      expect(r.symbol).toBe(sym);
      expect(r.isAmbiguous).toBe(true);
      expect(r.resolution).toBe('ambiguous');
      expect(r.entry).toBeDefined();
      expect(r.entry!.company).toBeTruthy();
      expect(r.entry!.confusion).toBeTruthy();
    });

    it('lowercase "on" is still ambiguous', () => {
      const r = disambiguate('on');
      expect(r.isAmbiguous).toBe(true);
      expect(r.symbol).toBe('ON');
    });
  });

  // ── Passthrough for unknown symbols ───────────────────────────────────
  describe('passthrough rule', () => {
    it('ZZZZ passes through (unknown, not ambiguous)', () => {
      const r = disambiguate('ZZZZ');
      expect(r.symbol).toBe('ZZZZ');
      expect(r.isAmbiguous).toBe(false);
      expect(r.resolution).toBe('passthrough');
    });

    it('empty string → empty passthrough', () => {
      const r = disambiguate('');
      expect(r.symbol).toBe('');
      expect(r.isAmbiguous).toBe(false);
      expect(r.resolution).toBe('passthrough');
    });

    it('whitespace → empty passthrough', () => {
      const r = disambiguate('   ');
      expect(r.symbol).toBe('');
      expect(r.isAmbiguous).toBe(false);
    });
  });

  // ── Helper functions ──────────────────────────────────────────────────
  describe('helpers', () => {
    it('isAmbiguous("IT") returns true', () => {
      expect(isAmbiguous('IT')).toBe(true);
    });

    it('isAmbiguous("AAPL") returns false', () => {
      expect(isAmbiguous('AAPL')).toBe(false);
    });

    it('isWellKnown("SPY") returns true', () => {
      expect(isWellKnown('SPY')).toBe(true);
    });

    it('isWellKnown("XYZABC") returns false', () => {
      expect(isWellKnown('XYZABC')).toBe(false);
    });

    it('getAmbiguousEntry returns entry for known ambiguous ticker', () => {
      const e = getAmbiguousEntry('ON');
      expect(e).toBeDefined();
      expect(e!.company).toBe('ON Semiconductor');
    });

    it('getAmbiguousEntry returns undefined for non-ambiguous', () => {
      expect(getAmbiguousEntry('AAPL')).toBeUndefined();
    });

    it('getAmbiguousTickers returns non-empty object', () => {
      const tickers = getAmbiguousTickers();
      expect(Object.keys(tickers).length).toBeGreaterThan(20);
    });

    it('getWellKnownTickers returns non-empty array', () => {
      const tickers = getWellKnownTickers();
      expect(tickers.length).toBeGreaterThan(30);
      expect(tickers).toContain('AAPL');
    });

    it('buildDisambiguationPrompt generates readable string', () => {
      const prompt = buildDisambiguationPrompt('ON', { company: 'ON Semiconductor', confusion: 'Common preposition' });
      expect(prompt).toContain('ON');
      expect(prompt).toContain('ON Semiconductor');
      expect(prompt).toContain('ticker');
    });
  });

  // ── Priority rules ────────────────────────────────────────────────────
  describe('rule priority', () => {
    it('$ prefix wins over ambiguity', () => {
      const r = disambiguate('$ON');
      expect(r.resolution).toBe('dollar-prefix');
      expect(r.isAmbiguous).toBe(false);
    });

    it('watchlist wins over ambiguity', () => {
      const r = disambiguate('IT', ['IT']);
      expect(r.resolution).toBe('watchlist');
      expect(r.isAmbiguous).toBe(false);
    });

    it('well-known is checked before ambiguous (not overlapping currently)', () => {
      // SPY is well-known but not ambiguous — just verifying priority path
      const r = disambiguate('SPY');
      expect(r.resolution).toBe('well-known');
    });
  });
});
