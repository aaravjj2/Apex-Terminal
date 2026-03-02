# Reports & Exports

Multi-format report generation with CSV, Excel, and PDF output, scheduled delivery, custom templates, portfolio reports, risk reports, and chart snapshots.

## Table of Contents

- [Overview](#overview)
- [CSV Export](#csv-export)
- [Excel Export](#excel-export)
- [PDF Reports](#pdf-reports)
- [Portfolio Reports](#portfolio-reports)
- [Trade Confirmations](#trade-confirmations)
- [Risk Reports](#risk-reports)
- [Scheduled Delivery](#scheduled-delivery)
- [Custom Templates](#custom-templates)
- [Chart Snapshots](#chart-snapshots)

## Overview

The reporting module (`lib/reporting/`) generates professional-grade reports and exports from any data within Apex Terminal. All report generation runs client-side — no server round-trip required.

```typescript
import { CSVExporter } from '@/lib/reporting/csv';
import { ExcelExporter } from '@/lib/reporting/excel';
import { PDFGenerator } from '@/lib/reporting/pdf';
import { ReportScheduler } from '@/lib/reporting/scheduler';
import { TemplateEngine } from '@/lib/reporting/templates';
```

## CSV Export

Lightweight tabular export for any dataset:

```typescript
const exporter = new CSVExporter();

exporter.export({
  data: portfolioPositions,
  columns: ['symbol', 'quantity', 'avgCost', 'currentPrice', 'pnl', 'pnlPercent'],
  headers: ['Symbol', 'Qty', 'Avg Cost', 'Price', 'P&L', 'P&L %'],
  filename: 'positions_2026-03-01',
  delimiter: ',',
  includeTimestamp: true,
  encoding: 'utf-8',
});
```

CSV export supports custom delimiters, column selection, header renaming, and automatic number formatting. Large datasets stream to the file to avoid memory pressure.

## Excel Export

Rich Excel workbooks with formatting, formulas, and multiple sheets:

```typescript
const excel = new ExcelExporter();

const workbook = excel.createWorkbook({
  sheets: [
    {
      name: 'Positions',
      data: positions,
      columns: [
        { field: 'symbol', header: 'Symbol', width: 12 },
        { field: 'pnl', header: 'P&L', width: 15, format: '$#,##0.00', conditionalColor: true },
        { field: 'pnlPercent', header: 'P&L %', width: 10, format: '0.00%', conditionalColor: true },
      ],
      autoFilter: true,
      freezePane: { row: 1, col: 0 },
    },
    {
      name: 'Trades',
      data: tradeHistory,
      columns: [/* ... */],
    },
    {
      name: 'Summary',
      data: null,
      customCells: [
        { cell: 'A1', value: 'Portfolio Summary', style: { bold: true, fontSize: 14 } },
        { cell: 'A3', value: 'Total P&L', style: { bold: true } },
        { cell: 'B3', formula: '=SUM(Positions!D2:D100)' },
      ],
    },
  ],
});

await workbook.download('portfolio_report.xlsx');
```

Generated workbooks include conditional formatting (green/red for P&L), auto-filters, frozen headers, and cross-sheet formula references.

## PDF Reports

Professional PDF documents with charts, tables, and branding:

```typescript
const pdf = new PDFGenerator();

await pdf.generate({
  template: 'portfolio-report',
  data: {
    portfolioName: 'Main Trading Account',
    date: '2026-03-01',
    positions: portfolioPositions,
    performance: performanceMetrics,
    chartImages: [equityCurveImage, drawdownChartImage],
  },
  options: {
    pageSize: 'A4',
    orientation: 'portrait',
    header: { logo: logoUrl, title: 'Apex Terminal — Portfolio Report' },
    footer: { text: 'Confidential', pageNumbers: true },
    watermark: 'DRAFT',
  },
  filename: 'portfolio_report_march_2026.pdf',
});
```

PDF generation uses a template engine with placeholder binding. Charts render as high-resolution images embedded directly in the document.

## Portfolio Reports

Pre-built portfolio analysis reports:

```typescript
const portfolioReport = await pdf.generatePortfolioReport({
  sections: [
    'executive-summary',      // total value, P&L, allocation pie chart
    'performance-attribution', // return attribution by sector/strategy
    'position-detail',        // individual position table
    'risk-metrics',           // VaR, Sharpe, max drawdown
    'transaction-history',    // recent trades
    'benchmark-comparison',   // vs S&P 500, custom benchmark
  ],
  period: 'monthly',
  benchmarks: ['SPY', 'QQQ'],
});
```

The executive summary page includes an equity curve chart, allocation donut chart, and key performance metrics in a dashboard-style layout.

## Trade Confirmations

Individual trade confirmation documents:

```typescript
const confirmation = await pdf.generateTradeConfirmation({
  trade: {
    symbol: 'AAPL',
    side: 'buy',
    quantity: 100,
    price: 195.50,
    executedAt: Date.now(),
    orderType: 'limit',
    fees: 0.65,
  },
  includeMarketContext: true,  // price chart at time of execution
});
```

## Risk Reports

Comprehensive risk analysis documents:

```typescript
const riskReport = await pdf.generateRiskReport({
  sections: [
    'var-analysis',           // Value at Risk: parametric, historical, Monte Carlo
    'stress-tests',           // predefined and custom scenarios
    'correlation-matrix',     // cross-asset correlation heatmap
    'concentration-risk',     // single-name and sector exposure
    'liquidity-risk',         // position size vs average volume
    'tail-risk',              // expected shortfall, extreme event analysis
  ],
  confidenceLevel: 0.99,
  horizon: '1d',
});
```

## Scheduled Delivery

Automate recurring report generation and delivery:

```typescript
const scheduler = new ReportScheduler();

scheduler.schedule({
  id: 'weekly-portfolio',
  name: 'Weekly Portfolio Summary',
  template: 'portfolio-report',
  schedule: {
    frequency: 'weekly',
    dayOfWeek: 'friday',
    time: '16:30',
    timezone: 'America/New_York',
  },
  delivery: {
    email: ['trader@example.com'],
    saveLocally: true,
    webhook: 'https://hooks.slack.com/...',
  },
  format: 'pdf',
});

// List and manage scheduled reports
const scheduled = scheduler.listScheduled();
scheduler.pause('weekly-portfolio');
scheduler.resume('weekly-portfolio');
```

The scheduler runs via a Service Worker to operate even when the tab is in the background. Missed schedules execute on next app activation.

## Custom Templates

Define reusable report templates:

```typescript
const template = TemplateEngine.create({
  id: 'custom-daily',
  name: 'Daily Trading Summary',
  layout: {
    header: { logo: true, title: '{{portfolioName}} — Daily Summary' },
    sections: [
      { type: 'text', content: 'Report generated on {{date}}' },
      { type: 'table', dataKey: 'trades', columns: ['symbol', 'side', 'qty', 'pnl'] },
      { type: 'chart', dataKey: 'equityCurve', height: 300 },
      { type: 'metrics', dataKey: 'performance', layout: 'grid' },
    ],
    footer: { pageNumbers: true },
  },
  styles: {
    primaryColor: '#1e40af',
    fontFamily: 'Inter',
    tableBorderStyle: 'minimal',
  },
});
```

Templates support Mustache-style variable binding (`{{variable}}`), conditional sections, and loop constructs for dynamic content.

## Chart Snapshots

Capture charts as high-resolution images for reports and sharing:

```typescript
import { captureChart } from '@/lib/reporting/chartSnapshot';

const snapshot = await captureChart({
  chartId: 'main-chart',
  format: 'png',              // 'png' | 'svg' | 'jpeg'
  resolution: 2,              // device pixel ratio multiplier
  width: 1920,
  height: 1080,
  includeIndicators: true,
  includeDrawings: true,
  watermark: 'Apex Terminal',
  theme: 'dark',
});

// snapshot.dataUrl: base64-encoded image
// snapshot.blob: Blob for direct download or API upload
```

Snapshots respect the current chart state including all overlays, drawings, and active indicators.
