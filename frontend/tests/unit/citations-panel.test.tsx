/**
 * Unit tests for CitationsPanel component (v1.38)
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CitationsPanel, type CitationItem } from '../../src/features/shared/CitationsPanel';

const makeCitation = (overrides: Partial<CitationItem> = {}): CitationItem => ({
  id: 'cit-1',
  source_type: 'risk_run',
  source_id: 'run-001',
  title: 'Risk assessment',
  detail: 'Monte Carlo simulation results',
  timestamp: '2026-01-15T12:00:00Z',
  confidence: 0.92,
  url: null,
  metadata: {},
  ...overrides,
});

describe('CitationsPanel', () => {
  it('renders citations with source types', () => {
    const citations = [
      makeCitation({ id: 'c1', source_type: 'risk_run', title: 'Risk' }),
      makeCitation({ id: 'c2', source_type: 'backtest', title: 'Backtest' }),
    ];

    render(<CitationsPanel citations={citations} />);

    expect(screen.getByTestId('citations-panel')).toBeInTheDocument();
    expect(screen.getByTestId('citation-item-0')).toBeInTheDocument();
    expect(screen.getByTestId('citation-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('citation-source-0')).toHaveTextContent('RISK_RUN');
    expect(screen.getByTestId('citation-source-1')).toHaveTextContent('BACKTEST');
  });

  it('renders confidence percentage', () => {
    const citations = [makeCitation({ confidence: 0.85 })];
    render(<CitationsPanel citations={citations} />);
    expect(screen.getByTestId('citation-confidence-0')).toHaveTextContent('85%');
  });

  it('hides confidence when null', () => {
    const citations = [makeCitation({ confidence: null })];
    render(<CitationsPanel citations={citations} />);
    expect(screen.queryByTestId('citation-confidence-0')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<CitationsPanel citations={[]} loading={true} />);
    expect(screen.getByTestId('citations-panel')).toBeInTheDocument();
    expect(screen.getByTestId('citations-loading')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(<CitationsPanel citations={[]} />);
    expect(screen.getByTestId('citations-panel')).toBeInTheDocument();
    expect(screen.getByTestId('citations-empty')).toBeInTheDocument();
    expect(screen.getByTestId('citations-empty')).toHaveTextContent('NO CITATIONS AVAILABLE');
  });

  it('truncates to maxVisible and shows toggle', () => {
    const citations = Array.from({ length: 8 }, (_, i) =>
      makeCitation({ id: `c-${i}`, title: `Citation ${i}` }),
    );

    render(<CitationsPanel citations={citations} maxVisible={3} />);

    // Should only show 3 items
    expect(screen.getByTestId('citation-item-0')).toBeInTheDocument();
    expect(screen.getByTestId('citation-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('citation-item-2')).toBeInTheDocument();
    expect(screen.queryByTestId('citation-item-3')).not.toBeInTheDocument();

    // Toggle should show
    const toggle = screen.getByTestId('citations-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveTextContent('SHOW 5 MORE');
  });

  it('expands to show all items on toggle click', () => {
    const citations = Array.from({ length: 6 }, (_, i) =>
      makeCitation({ id: `c-${i}`, title: `Citation ${i}` }),
    );

    render(<CitationsPanel citations={citations} maxVisible={2} />);

    expect(screen.queryByTestId('citation-item-2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('citations-toggle'));

    // All 6 should be visible
    expect(screen.getByTestId('citation-item-5')).toBeInTheDocument();
    expect(screen.getByTestId('citations-toggle')).toHaveTextContent('SHOW LESS');
  });

  it('does not show toggle when count <= maxVisible', () => {
    const citations = [makeCitation({ id: 'c1' }), makeCitation({ id: 'c2' })];
    render(<CitationsPanel citations={citations} maxVisible={5} />);
    expect(screen.queryByTestId('citations-toggle')).not.toBeInTheDocument();
  });

  it('handles all source_type color classes', () => {
    const types = ['risk_run', 'backtest', 'validation', 'strategy', 'export', 'provenance', 'unknown'];
    const citations = types.map((t, i) =>
      makeCitation({ id: `c-${i}`, source_type: t }),
    );
    render(<CitationsPanel citations={citations} maxVisible={10} />);

    types.forEach((t, i) => {
      expect(screen.getByTestId(`citation-source-${i}`)).toHaveTextContent(t.toUpperCase());
    });
  });
});
