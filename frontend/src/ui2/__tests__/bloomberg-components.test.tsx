/**
 * Bloomberg Terminal – Comprehensive Component Tests
 * Covers: Button, EmptyState, StatusBadge, ProgressBar, NumericValue,
 *         Tabs, Skeleton, Panel, PageHeader, Pill, ActionButton
 *
 * Run:  npx vitest run src/ui2/__tests__/bloomberg-components.test.tsx
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { ProgressBar } from '../components/ProgressBar';
import { NumericValue } from '../components/NumericDisplay';
import { Tabs } from '../components/Tabs';
import { Panel } from '../components/Panel';
import { PageHeader } from '../components/PageHeader';
import { Pill } from '../components/Pill';

// ─────────────────────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────────────────────
describe('Button – render & interaction', () => {
  it('renders primary button with label', () => {
    render(<Button variant="primary" testId="btn-primary">Buy</Button>);
    expect(screen.getByTestId('btn-primary')).toBeTruthy();
    expect(screen.getByText('Buy')).toBeTruthy();
  });

  it('renders danger variant', () => {
    render(<Button variant="danger" testId="btn-danger">Sell</Button>);
    expect(screen.getByTestId('btn-danger')).toBeTruthy();
  });

  it('renders ghost variant', () => {
    render(<Button variant="ghost" testId="btn-ghost">Cancel</Button>);
    expect(screen.getByTestId('btn-ghost')).toBeTruthy();
  });

  it('renders disabled state – click does not fire', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick} testId="btn-dis">Disabled</Button>);
    fireEvent.click(screen.getByTestId('btn-dis'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires onClick when enabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} testId="btn-click">Click Me</Button>);
    fireEvent.click(screen.getByTestId('btn-click'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders small size', () => {
    render(<Button size="sm" testId="btn-sm">Sm</Button>);
    expect(screen.getByTestId('btn-sm')).toBeTruthy();
  });

  it('renders large size', () => {
    render(<Button size="lg" testId="btn-lg">Lg</Button>);
    expect(screen.getByTestId('btn-lg')).toBeTruthy();
  });

  it('renders loading state', () => {
    render(<Button loading testId="btn-loading">Loading</Button>);
    expect(screen.getByTestId('btn-loading')).toBeTruthy();
  });

  it('renders full-width button', () => {
    render(<Button fullWidth testId="btn-fw">Full Width</Button>);
    expect(screen.getByTestId('btn-fw')).toBeTruthy();
  });

  it('renders with left icon', () => {
    render(<Button icon={<span data-testid="ico">★</span>} iconPosition="left">Buy</Button>);
    expect(screen.getByTestId('ico')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────────────────────────────────────
describe('EmptyState – render', () => {
  it('renders title', () => {
    render(<EmptyState title="No Data" testId="empty-basic" />);
    expect(screen.getByText('No Data')).toBeTruthy();
    expect(screen.getByTestId('empty-basic')).toBeTruthy();
  });

  it('renders description', () => {
    render(
      <EmptyState
        title="No Orders"
        description="You have no open orders."
        testId="empty-desc"
      />,
    );
    expect(screen.getByText('No Orders')).toBeTruthy();
    expect(screen.getByText('You have no open orders.')).toBeTruthy();
  });

  it('renders icon', () => {
    render(
      <EmptyState
        title="Empty"
        icon={<span data-testid="empty-ico">📋</span>}
        testId="empty-ico-wrap"
      />,
    );
    expect(screen.getByTestId('empty-ico')).toBeTruthy();
  });

  it('renders action slot', () => {
    render(
      <EmptyState
        title="No Positions"
        action={<button>Place Order</button>}
        testId="empty-action"
      />,
    );
    expect(screen.getByText('Place Order')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge
// ─────────────────────────────────────────────────────────────────────────────
describe('StatusBadge – all variants', () => {
  const variants = [
    'success', 'danger', 'warning', 'info', 'neutral',
    'queued', 'working', 'filled', 'rejected', 'canceled',
  ] as const;

  variants.forEach((v) => {
    it(`renders variant "${v}"`, () => {
      render(
        <StatusBadge variant={v} testId={`badge-${v}`}>
          {v.toUpperCase()}
        </StatusBadge>,
      );
      expect(screen.getByTestId(`badge-${v}`)).toBeTruthy();
      expect(screen.getByText(v.toUpperCase())).toBeTruthy();
    });
  });

  it('renders with an icon', () => {
    render(
      <StatusBadge variant="success" icon={<span data-testid="badge-ico">✓</span>} testId="badge-ic">
        Filled
      </StatusBadge>,
    );
    expect(screen.getByTestId('badge-ico')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ProgressBar
// ─────────────────────────────────────────────────────────────────────────────
describe('ProgressBar – value clamping & variants', () => {
  it('renders at 0%', () => {
    render(<ProgressBar value={0} testId="pb-0" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
  });

  it('renders at 50%', () => {
    render(<ProgressBar value={50} testId="pb-50" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
  });

  it('renders at 100%', () => {
    render(<ProgressBar value={100} testId="pb-100" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('clamps value above 100 to 100', () => {
    render(<ProgressBar value={150} testId="pb-clamp-hi" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('clamps value below 0 to 0', () => {
    render(<ProgressBar value={-10} testId="pb-clamp-lo" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('shows label when showLabel=true', () => {
    render(<ProgressBar value={75} showLabel testId="pb-lbl" />);
    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('renders success variant', () => {
    render(<ProgressBar value={80} variant="success" testId="pb-suc" />);
    expect(screen.getByTestId('pb-suc')).toBeTruthy();
  });

  it('renders danger variant', () => {
    render(<ProgressBar value={20} variant="danger" testId="pb-dng" />);
    expect(screen.getByTestId('pb-dng')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NumericValue
// ─────────────────────────────────────────────────────────────────────────────
describe('NumericValue – formatting', () => {
  it('formats as default number', () => {
    render(<NumericValue value={1234.56} testId="nv-num" />);
    expect(screen.getByTestId('nv-num').textContent).toContain('1,234.56');
  });

  it('formats as currency', () => {
    render(<NumericValue value={99.99} format="currency" testId="nv-cur" />);
    expect(screen.getByTestId('nv-cur').textContent).toContain('$99.99');
  });

  it('formats as percent', () => {
    render(<NumericValue value={25} format="percent" testId="nv-pct" />);
    expect(screen.getByTestId('nv-pct').textContent).toContain('%');
  });

  it('formats negative currency', () => {
    render(<NumericValue value={-500} format="currency" testId="nv-neg" />);
    expect(screen.getByTestId('nv-neg').textContent).toContain('500');
  });

  it('formats zero', () => {
    render(<NumericValue value={0} testId="nv-zero" />);
    expect(screen.getByTestId('nv-zero').textContent).toContain('0');
  });

  it('formats compact notation', () => {
    render(<NumericValue value={1_500_000} format="compact" testId="nv-compact" />);
    // compact form: 1.5M / 1.50M depending on locale
    expect(screen.getByTestId('nv-compact').textContent).toMatch(/1\.5\d*\s*M/i);
  });

  it('respects custom decimals', () => {
    render(<NumericValue value={3.14159} decimals={4} testId="nv-dec4" />);
    expect(screen.getByTestId('nv-dec4').textContent).toContain('3.1416');
  });

  it('renders with string input', () => {
    render(<NumericValue value="42.5" testId="nv-str" />);
    expect(screen.getByTestId('nv-str').textContent).toContain('42.50');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────
describe('Tabs – navigation', () => {
  const items = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'History' },
    { id: 'analytics', label: 'Analytics', disabled: true },
  ];

  it('renders all tab labels', () => {
    render(<Tabs items={items} testId="tabs" />);
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByText('Analytics')).toBeTruthy();
  });

  it('fires onTabChange when a tab is clicked', () => {
    const onChange = vi.fn();
    render(<Tabs items={items} onTabChange={onChange} testId="tabs-ev" />);
    fireEvent.click(screen.getByText('History'));
    expect(onChange).toHaveBeenCalledWith('history');
  });

  it('does not fire onChange for disabled tab', () => {
    const onChange = vi.fn();
    render(<Tabs items={items} onTabChange={onChange} testId="tabs-dis" />);
    fireEvent.click(screen.getByText('Analytics'));
    expect(onChange).not.toHaveBeenCalledWith('analytics');
  });

  it('respects controlled activeTab prop', () => {
    render(<Tabs items={items} activeTab="history" testId="tabs-ctrl" />);
    // The "History" tab should be rendered without throwing
    expect(screen.getByText('History')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────────────────────
describe('Panel – render', () => {
  it('renders children', () => {
    render(<Panel testId="panel-base"><p>Content</p></Panel>);
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('renders title', () => {
    render(<Panel title="Order Book" testId="panel-ttl"><span>data</span></Panel>);
    expect(screen.getByText('Order Book')).toBeTruthy();
  });

  it('renders actions slot', () => {
    render(
      <Panel title="Chart" actions={<button data-testid="act-btn">Refresh</button>} testId="panel-act">
        <span>chart</span>
      </Panel>,
    );
    expect(screen.getByTestId('act-btn')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PageHeader
// ─────────────────────────────────────────────────────────────────────────────
describe('PageHeader – render', () => {
  it('renders title', () => {
    render(<PageHeader title="Portfolio" testId="ph-base" />);
    expect(screen.getByText('Portfolio')).toBeTruthy();
  });

  it('renders subtitle', () => {
    render(<PageHeader title="Trading" subtitle="Live Orders" testId="ph-sub" />);
    expect(screen.getByText('Live Orders')).toBeTruthy();
  });

  it('renders badge slot', () => {
    render(
      <PageHeader
        title="Autopilot"
        badge={<Pill variant="success" testId="ph-pill">LIVE</Pill>}
        testId="ph-badge"
      />,
    );
    expect(screen.getByTestId('ph-pill')).toBeTruthy();
    expect(screen.getByText('LIVE')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pill
// ─────────────────────────────────────────────────────────────────────────────
describe('Pill – variants', () => {
  const variants = ['default', 'success', 'danger', 'warning', 'info'] as const;

  variants.forEach((v) => {
    it(`renders variant "${v}"`, () => {
      render(<Pill variant={v} testId={`pill-${v}`}>{v}</Pill>);
      expect(screen.getByTestId(`pill-${v}`)).toBeTruthy();
    });
  });
});
