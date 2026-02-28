import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { Pill } from '../components/Pill';
import { DataTable } from '../components/DataTable';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { ErrorCard } from '../components/ErrorCard';
import { NumericValue } from '../components/NumericDisplay';
import { Tabs } from '../components/Tabs';

// Button

describe('Button', () => {
  it('renders with children', () => {
    const { getByText } = render(<Button>Click Me</Button>);
    expect(getByText('Click Me')).toBeTruthy();
  });
  it('calls onClick', () => {
    const fn = vi.fn();
    const { getByRole } = render(<Button onClick={fn}>Test</Button>);
    fireEvent.click(getByRole('button'));
    expect(fn).toHaveBeenCalled();
  });
  it('shows loading state', () => {
    const { getByRole } = render(<Button loading>Load</Button>);
    expect(getByRole('button')).toBeDisabled();
  });
});

// StatusBadge

describe('StatusBadge', () => {
  it('renders with variant and children', () => {
    const { getByText } = render(<StatusBadge variant="success">OK</StatusBadge>);
    expect(getByText('OK')).toBeTruthy();
  });
});

// Pill

describe('Pill', () => {
  it('renders with children', () => {
    const { getByText } = render(<Pill>Meta</Pill>);
    expect(getByText('Meta')).toBeTruthy();
  });
});

// DataTable

describe('DataTable', () => {
  it('renders table with data', () => {
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
    ];
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const { getByText } = render(<DataTable columns={columns} data={data} />);
    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('Bob')).toBeTruthy();
  });
  it('shows empty state', () => {
    const columns = [{ key: 'id', label: 'ID' }];
    const { getByText } = render(<DataTable columns={columns} data={[]} />);
    expect(getByText('No data available')).toBeTruthy();
  });
});

// Panel

describe('Panel', () => {
  it('renders with title and children', () => {
    const { getByText } = render(<Panel title="Panel Title">Body</Panel>);
    expect(getByText('Panel Title')).toBeTruthy();
    expect(getByText('Body')).toBeTruthy();
  });
});

// ProgressBar

describe('ProgressBar', () => {
  it('renders with value', () => {
    const { getByRole } = render(<ProgressBar value={50} />);
    expect(getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });
});

// EmptyState

describe('EmptyState', () => {
  it('renders with title', () => {
    const { getByText } = render(<EmptyState title="Nothing here" />);
    expect(getByText('Nothing here')).toBeTruthy();
  });
});

// Skeleton

describe('Skeleton', () => {
  it('renders skeleton', () => {
    const { getByTestId } = render(<Skeleton testId="skel" />);
    expect(getByTestId('skel')).toBeTruthy();
  });
});

// ErrorCard

describe('ErrorCard', () => {
  it('renders error message', () => {
    const error = { code: '404', message: 'Not found' };
    const { getByText } = render(<ErrorCard error={error} />);
    expect(getByText('Not found')).toBeTruthy();
  });
});

// NumericValue

describe('NumericValue', () => {
  it('renders number', () => {
    const { getByText } = render(<NumericValue value={123.45} />);
    expect(getByText('123.45')).toBeTruthy();
  });
  it('renders currency', () => {
    const { getByText } = render(<NumericValue value={1000} format="currency" />);
    expect(getByText('$1,000.00')).toBeTruthy();
  });
});

// Tabs

describe('Tabs', () => {
  it('renders tabs and changes active tab', () => {
    const items = [
      { id: 'tab1', label: 'Tab 1' },
      { id: 'tab2', label: 'Tab 2' },
    ];
    const { getByText } = render(<Tabs items={items} />);
    expect(getByText('Tab 1')).toBeTruthy();
    expect(getByText('Tab 2')).toBeTruthy();
    fireEvent.click(getByText('Tab 2'));
    expect(getByText('Tab 2')).toBeTruthy();
  });
});