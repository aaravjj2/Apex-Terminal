/**
 * Unit tests for ProvenanceDisplay component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProvenanceDisplay, type ProvenanceInfo } from '../../src/components/ProvenanceDisplay';

describe('ProvenanceDisplay', () => {
  it('renders DEMO source provenance', () => {
    const provenance: ProvenanceInfo = {
      source: 'DEMO',
      cache_key: 'abc123def456',
      checksum: 'check123',
    };

    render(<ProvenanceDisplay provenance={provenance} />);

    expect(screen.getByTestId('provenance-display')).toBeInTheDocument();
    expect(screen.getByTestId('provenance-source')).toHaveTextContent('DEMO');
    expect(screen.getByTestId('provenance-cache-key')).toBeInTheDocument();
    expect(screen.getByTestId('provenance-checksum')).toBeInTheDocument();
  });

  it('renders LOCAL_REPLAY source provenance', () => {
    const provenance: ProvenanceInfo = {
      source: 'LOCAL_REPLAY',
      cache_key: 'xyz789abc',
      provider: 'Yahoo Finance',
      fetched_at: '2026-02-08T12:00:00Z',
    };

    render(<ProvenanceDisplay provenance={provenance} />);

    expect(screen.getByTestId('provenance-source')).toHaveTextContent('LOCAL_REPLAY');
    expect(screen.getByTestId('provenance-provider')).toHaveTextContent('Yahoo Finance');
    expect(screen.getByTestId('provenance-fetched-at')).toBeInTheDocument();
  });

  it('returns null when provenance is null', () => {
    const { container } = render(<ProvenanceDisplay provenance={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('truncates long cache_key', () => {
    const longCacheKey = 'a'.repeat(100);
    const provenance: ProvenanceInfo = {
      source: 'LOCAL_CACHE',
      cache_key: longCacheKey,
    };

    render(<ProvenanceDisplay provenance={provenance} />);

    const cacheKeyElement = screen.getByTestId('provenance-cache-key');
    expect(cacheKeyElement.textContent).not.toBe(longCacheKey);
    expect(cacheKeyElement.textContent).toContain('...');
  });

  it('applies custom className', () => {
    const provenance: ProvenanceInfo = {
      source: 'DEMO',
    };

    render(<ProvenanceDisplay provenance={provenance} className="mt-4" />);

    const display = screen.getByTestId('provenance-display');
    expect(display.className).toContain('mt-4');
  });

  it('handles provenance without optional fields', () => {
    const provenance: ProvenanceInfo = {
      source: 'DEMO',
    };

    render(<ProvenanceDisplay provenance={provenance} />);

    expect(screen.getByTestId('provenance-source')).toHaveTextContent('DEMO');
    expect(screen.queryByTestId('provenance-cache-key')).not.toBeInTheDocument();
    expect(screen.queryByTestId('provenance-provider')).not.toBeInTheDocument();
    expect(screen.queryByTestId('provenance-fetched-at')).not.toBeInTheDocument();
  });
});
