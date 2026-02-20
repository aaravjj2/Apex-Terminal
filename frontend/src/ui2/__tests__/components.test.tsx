/**
 * UI2 Component Render Tests
 * Verify components render without errors
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { Pill } from '../components/Pill';

describe('UI2 Components - Render Tests', () => {
  it('PageHeader renders with title', () => {
    render(<PageHeader title="Test Page" testId="test-header" />);
    expect(screen.getByText('Test Page')).toBeTruthy();
    expect(screen.getByTestId('test-header')).toBeTruthy();
  });

  it('PageHeader renders with subtitle and badge', () => {
    render(
      <PageHeader
        title="Test Page"
        subtitle="Test subtitle"
        badge={<Pill variant="success">LIVE</Pill>}
        testId="test-header"
      />
    );
    expect(screen.getByText('Test Page')).toBeTruthy();
    expect(screen.getByText('Test subtitle')).toBeTruthy();
    expect(screen.getByText('LIVE')).toBeTruthy();
  });

  it('Panel renders with children', () => {
    render(
      <Panel testId="test-panel">
        <div>Panel content</div>
      </Panel>
    );
    expect(screen.getByText('Panel content')).toBeTruthy();
    expect(screen.getByTestId('test-panel')).toBeTruthy();
  });

  it('Panel renders with title and actions', () => {
    render(
      <Panel title="Test Panel" actions={<button>Action</button>} testId="test-panel">
        <div>Panel content</div>
      </Panel>
    );
    expect(screen.getByText('Test Panel')).toBeTruthy();
    expect(screen.getByText('Action')).toBeTruthy();
    expect(screen.getByText('Panel content')).toBeTruthy();
  });

  it('Pill renders with default variant', () => {
    render(<Pill testId="test-pill">Test Badge</Pill>);
    expect(screen.getByText('Test Badge')).toBeTruthy();
    expect(screen.getByTestId('test-pill')).toBeTruthy();
  });

  it('Pill renders with success variant', () => {
    render(<Pill variant="success" testId="test-pill">Success</Pill>);
    const pill = screen.getByTestId('test-pill');
    expect(pill).toBeTruthy();
    expect(screen.getByText('Success')).toBeTruthy();
  });

  it('Pill renders with danger variant', () => {
    render(<Pill variant="danger" testId="test-pill">Error</Pill>);
    const pill = screen.getByTestId('test-pill');
    expect(pill).toBeTruthy();
    expect(screen.getByText('Error')).toBeTruthy();
  });
});
