import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { WatchlistTile } from '../../src/features/trading/tiles/WatchlistTile';

describe('WatchlistTile (demo data consistency)', () => {
  it('renders canonical demo price for AAPL', () => {
    render(<WatchlistTile tileId="watchlist-1" onClose={() => {}} onMaximize={() => {}} isMaximized={false} />);
    // Should display the canonical demo price from DEMO_QUOTES / streamSimulator
    expect(screen.getByText('$182.41')).toBeTruthy();
  });
});
