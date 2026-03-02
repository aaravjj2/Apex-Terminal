import type {
  ReportConfig,
  ReportSection,
  ReportBranding,
  ChartData,
  TableData,
  MetricData,
  TextData,
  GeneratedReport,
  DateRange,
  ChartSeries,
  TableHeader,
} from './types';
import {
  ExportFormat,
  ReportStatus,
  SectionType,
  ChartType,
} from './types';

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtCurrency(val: number): string {
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtPercent(val: number, decimals = 2): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(decimals)}%`;
}

function fmtNumber(val: number, decimals = 2): string {
  return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtShortDate(ts: number): string {
  return new Date(ts).toISOString().split('T')[0];
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatCellValue(val: string | number, format?: string): string {
  if (typeof val === 'number') {
    switch (format) {
      case 'currency': return fmtCurrency(val);
      case 'percent': return fmtPercent(val);
      case 'date': return fmtDate(val);
      default: return fmtNumber(val);
    }
  }
  return escapeHtml(String(val));
}

// ─── CSS Styles ──────────────────────────────────────────────────────────────

function generateCSS(branding: ReportBranding): string {
  return `
    @page {
      size: A4;
      margin: 2cm;
      @top-left { content: "${escapeHtml(branding.headerText)}"; font-size: 8pt; color: #999; }
      @top-right { content: "${escapeHtml(branding.companyName)}"; font-size: 8pt; color: #999; }
      @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #999; }
      @bottom-right { content: "${escapeHtml(branding.confidentiality)}"; font-size: 7pt; color: #bbb; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${branding.fontFamily}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1a1a1a; font-size: 10pt; line-height: 1.5;
    }
    .report-header {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 3px solid ${branding.primaryColor}; padding-bottom: 16px; margin-bottom: 24px;
    }
    .report-header .logo { max-height: 48px; }
    .report-header .title-block h1 { font-size: 22pt; color: ${branding.primaryColor}; margin: 0; }
    .report-header .title-block .subtitle { font-size: 10pt; color: #666; margin-top: 4px; }
    .report-footer {
      border-top: 1px solid #ddd; padding-top: 8px; margin-top: 32px;
      font-size: 8pt; color: #999; text-align: center;
    }
    h2.section-title {
      font-size: 14pt; color: ${branding.primaryColor}; margin: 24px 0 12px 0;
      border-bottom: 1px solid #eee; padding-bottom: 6px;
    }
    h3.section-subtitle { font-size: 10pt; color: #888; margin-bottom: 10px; font-weight: 400; }
    .toc { margin: 16px 0; }
    .toc-entry { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; }
    .toc-entry .toc-label { color: #333; }
    .toc-entry .toc-page { color: #999; }
    .metric-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px; margin: 12px 0;
    }
    .metric-card {
      background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px;
      padding: 12px; text-align: center;
    }
    .metric-card .label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-card .value { font-size: 16pt; font-weight: 700; margin: 4px 0; color: #1a1a1a; }
    .metric-card .change { font-size: 8pt; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 9pt; }
    table th {
      background: ${branding.primaryColor}; color: #fff; font-weight: 600;
      padding: 8px 10px; text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.3px;
    }
    table td { padding: 6px 10px; border-bottom: 1px solid #eee; }
    table tr.striped:nth-child(even) td { background: #f8f9fa; }
    table tr.highlight td { background: #fff3cd; }
    table tr.summary td { font-weight: 700; border-top: 2px solid ${branding.primaryColor}; background: #f0f0f0; }
    .chart-container {
      margin: 16px 0; padding: 12px; background: #fff;
      border: 1px solid #eee; border-radius: 6px; text-align: center;
    }
    .chart-container svg { max-width: 100%; }
    .text-section { margin: 12px 0; }
    .text-section p { margin-bottom: 8px; }
    .divider { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
    .page-break { page-break-after: always; }
    .executive-summary {
      background: linear-gradient(135deg, #f8f9fa, #fff);
      border-left: 4px solid ${branding.primaryColor};
      padding: 16px 20px; margin: 16px 0; border-radius: 0 6px 6px 0;
    }
    .executive-summary p { font-size: 10pt; line-height: 1.6; }
    .footnote { font-size: 7pt; color: #aaa; margin-top: 4px; }
  `;
}

// ─── SVG Chart Generation ────────────────────────────────────────────────────

function generateSVGChart(chartData: ChartData): string {
  const w = chartData.width ?? 600;
  const h = chartData.height ?? 300;
  const pad = { top: 30, right: 30, bottom: 50, left: 60 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const colors = chartData.colors ?? ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];

  switch (chartData.type) {
    case ChartType.Line: return svgLineChart(chartData.series, w, h, pad, plotW, plotH, colors, chartData);
    case ChartType.Bar: return svgBarChart(chartData.series, w, h, pad, plotW, plotH, colors, chartData);
    case ChartType.Pie: return svgPieChart(chartData.series, w, h, colors);
    case ChartType.Area: return svgAreaChart(chartData.series, w, h, pad, plotW, plotH, colors, chartData);
    case ChartType.Histogram: return svgBarChart(chartData.series, w, h, pad, plotW, plotH, colors, chartData);
    default: return svgLineChart(chartData.series, w, h, pad, plotW, plotH, colors, chartData);
  }
}

interface Padding { top: number; right: number; bottom: number; left: number }

function computeBounds(series: ChartSeries[]): { minY: number; maxY: number } {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of series) {
    for (const d of s.data) {
      if (d.y < minY) minY = d.y;
      if (d.y > maxY) maxY = d.y;
    }
  }
  if (!isFinite(minY)) { minY = 0; maxY = 100; }
  const range = maxY - minY || 1;
  return { minY: minY - range * 0.05, maxY: maxY + range * 0.05 };
}

function yAxisTicks(minY: number, maxY: number, count = 5): number[] {
  const step = (maxY - minY) / count;
  return Array.from({ length: count + 1 }, (_, i) => minY + step * i);
}

function formatAxisValue(val: number, format?: string): string {
  switch (format) {
    case 'currency': return fmtCurrency(val);
    case 'percent': return fmtPercent(val, 1);
    case 'date': return fmtShortDate(val);
    default: return fmtNumber(val, val > 1000 ? 0 : 2);
  }
}

function svgLineChart(series: ChartSeries[], w: number, h: number, pad: Padding, plotW: number, plotH: number, colors: string[], chartData: ChartData): string {
  const { minY, maxY } = computeBounds(series);
  const ticks = yAxisTicks(minY, maxY);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`;
  svg += `<rect width="${w}" height="${h}" fill="#fff"/>`;

  for (const tick of ticks) {
    const y = pad.top + plotH - ((tick - minY) / (maxY - minY)) * plotH;
    svg += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="#eee" stroke-width="1"/>`;
    svg += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" font-size="8" fill="#999">${formatAxisValue(tick, chartData.yAxis.format)}</text>`;
  }

  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const color = s.color ?? colors[si % colors.length];
    if (s.data.length === 0) continue;

    const points = s.data.map((d, i) => {
      const x = pad.left + (i / Math.max(1, s.data.length - 1)) * plotW;
      const y = pad.top + plotH - ((d.y - minY) / (maxY - minY)) * plotH;
      return { x, y };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    svg += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2"/>`;
  }

  if (chartData.legend && series.length > 1) {
    for (let si = 0; si < series.length; si++) {
      const color = series[si].color ?? colors[si % colors.length];
      const x = pad.left + si * 120;
      svg += `<rect x="${x}" y="${h - 15}" width="12" height="8" fill="${color}" rx="2"/>`;
      svg += `<text x="${x + 16}" y="${h - 8}" font-size="8" fill="#666">${escapeHtml(series[si].name)}</text>`;
    }
  }

  svg += `<text x="${w / 2}" y="${h - 2}" text-anchor="middle" font-size="9" fill="#888">${escapeHtml(chartData.xAxis.label)}</text>`;
  svg += `<text x="12" y="${h / 2}" text-anchor="middle" font-size="9" fill="#888" transform="rotate(-90,12,${h / 2})">${escapeHtml(chartData.yAxis.label)}</text>`;
  svg += '</svg>';
  return svg;
}

function svgAreaChart(series: ChartSeries[], w: number, h: number, pad: Padding, plotW: number, plotH: number, colors: string[], chartData: ChartData): string {
  const { minY, maxY } = computeBounds(series);
  const ticks = yAxisTicks(minY, maxY);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`;
  svg += `<rect width="${w}" height="${h}" fill="#fff"/>`;

  for (const tick of ticks) {
    const y = pad.top + plotH - ((tick - minY) / (maxY - minY)) * plotH;
    svg += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="#eee"/>`;
    svg += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" font-size="8" fill="#999">${formatAxisValue(tick, chartData.yAxis.format)}</text>`;
  }

  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const color = s.color ?? colors[si % colors.length];
    if (s.data.length === 0) continue;

    const points = s.data.map((d, i) => {
      const x = pad.left + (i / Math.max(1, s.data.length - 1)) * plotW;
      const y = pad.top + plotH - ((d.y - minY) / (maxY - minY)) * plotH;
      return { x, y };
    });

    const baseline = pad.top + plotH;
    const areaD = `M${points[0].x.toFixed(1)},${baseline} ` +
      points.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
      ` L${points[points.length - 1].x.toFixed(1)},${baseline} Z`;

    svg += `<path d="${areaD}" fill="${color}" fill-opacity="0.15"/>`;
    const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    svg += `<path d="${lineD}" fill="none" stroke="${color}" stroke-width="2"/>`;
  }

  svg += '</svg>';
  return svg;
}

function svgBarChart(series: ChartSeries[], w: number, h: number, pad: Padding, plotW: number, plotH: number, colors: string[], chartData: ChartData): string {
  const { minY, maxY } = computeBounds(series);
  const adjustedMinY = Math.min(0, minY);
  const range = maxY - adjustedMinY || 1;
  const ticks = yAxisTicks(adjustedMinY, maxY);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`;
  svg += `<rect width="${w}" height="${h}" fill="#fff"/>`;

  for (const tick of ticks) {
    const y = pad.top + plotH - ((tick - adjustedMinY) / range) * plotH;
    svg += `<line x1="${pad.left}" y1="${y}" x2="${w - pad.right}" y2="${y}" stroke="#eee"/>`;
    svg += `<text x="${pad.left - 8}" y="${y + 4}" text-anchor="end" font-size="8" fill="#999">${formatAxisValue(tick, chartData.yAxis.format)}</text>`;
  }

  const maxDataLen = Math.max(...series.map(s => s.data.length), 1);
  const barGroupWidth = plotW / maxDataLen;
  const barWidth = (barGroupWidth * 0.7) / series.length;

  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const color = s.color ?? colors[si % colors.length];
    for (let di = 0; di < s.data.length; di++) {
      const d = s.data[di];
      const x = pad.left + di * barGroupWidth + barGroupWidth * 0.15 + si * barWidth;
      const zeroY = pad.top + plotH - ((0 - adjustedMinY) / range) * plotH;
      const valY = pad.top + plotH - ((d.y - adjustedMinY) / range) * plotH;
      const barH = Math.abs(valY - zeroY);
      const barTop = d.y >= 0 ? valY : zeroY;
      svg += `<rect x="${x.toFixed(1)}" y="${barTop.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" fill="${color}" rx="2"/>`;

      if (s.data.length <= 20 && d.label) {
        svg += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${pad.top + plotH + 14}" text-anchor="middle" font-size="7" fill="#999">${escapeHtml(String(d.label))}</text>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}

function svgPieChart(series: ChartSeries[], w: number, h: number, colors: string[]): string {
  const data = series[0]?.data ?? [];
  const total = data.reduce((s, d) => s + Math.abs(d.y), 0) || 1;
  const cx = w / 2;
  const cy = h / 2 - 10;
  const r = Math.min(cx, cy) - 30;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`;
  svg += `<rect width="${w}" height="${h}" fill="#fff"/>`;

  let currentAngle = -Math.PI / 2;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const sliceAngle = (Math.abs(d.y) / total) * 2 * Math.PI;
    const endAngle = currentAngle + sliceAngle;
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const color = colors[i % colors.length];

    const x1 = cx + r * Math.cos(currentAngle);
    const y1 = cy + r * Math.sin(currentAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    svg += `<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${color}" stroke="#fff" stroke-width="2"/>`;

    const midAngle = currentAngle + sliceAngle / 2;
    const labelR = r * 0.65;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    const pct = ((d.y / total) * 100).toFixed(1);
    svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="8" fill="#fff" font-weight="600">${pct}%</text>`;

    currentAngle = endAngle;
  }

  const legendY = h - 20;
  for (let i = 0; i < data.length; i++) {
    const x = 20 + i * 100;
    if (x + 80 > w) break;
    svg += `<rect x="${x}" y="${legendY}" width="10" height="8" fill="${colors[i % colors.length]}" rx="2"/>`;
    svg += `<text x="${x + 14}" y="${legendY + 7}" font-size="8" fill="#666">${escapeHtml(String(data[i].label ?? data[i].x))}</text>`;
  }

  svg += '</svg>';
  return svg;
}

// ─── Section Renderers ───────────────────────────────────────────────────────

function renderSection(section: ReportSection, sectionIndex: number): string {
  if (section.options.visible === false) return '';
  let html = '';

  if (section.options.pageBreakBefore) html += '<div class="page-break"></div>';

  switch (section.type) {
    case SectionType.TableOfContents:
      html += renderTOC(section);
      break;
    case SectionType.ExecutiveSummary:
      html += renderExecutiveSummary(section);
      break;
    case SectionType.Chart:
      html += renderChart(section);
      break;
    case SectionType.Table:
      html += renderTable(section);
      break;
    case SectionType.MetricGrid:
      html += renderMetricGrid(section);
      break;
    case SectionType.Text:
      html += renderText(section);
      break;
    case SectionType.Divider:
      html += '<hr class="divider"/>';
      break;
    case SectionType.PageBreak:
      html += '<div class="page-break"></div>';
      break;
    default:
      break;
  }

  if (section.options.pageBreakAfter) html += '<div class="page-break"></div>';
  return html;
}

function renderTOC(section: ReportSection): string {
  return `
    <h2 class="section-title">Table of Contents</h2>
    <div class="toc" id="toc-placeholder">
      <p style="color:#999;font-size:9pt;">Table of contents will be generated based on report sections.</p>
    </div>`;
}

function renderExecutiveSummary(section: ReportSection): string {
  const textData = section.data as TextData | null;
  const content = textData?.content ?? '';
  return `
    <h2 class="section-title">${escapeHtml(section.title)}</h2>
    ${section.subtitle ? `<h3 class="section-subtitle">${escapeHtml(section.subtitle)}</h3>` : ''}
    <div class="executive-summary">
      ${textData?.format === 'html' ? content : `<p>${escapeHtml(content)}</p>`}
    </div>`;
}

function renderChart(section: ReportSection): string {
  const chartData = section.data as ChartData | null;
  if (!chartData) return '';
  return `
    <h2 class="section-title">${escapeHtml(section.title)}</h2>
    ${section.subtitle ? `<h3 class="section-subtitle">${escapeHtml(section.subtitle)}</h3>` : ''}
    <div class="chart-container">${generateSVGChart(chartData)}</div>`;
}

function renderTable(section: ReportSection): string {
  const tableData = section.data as TableData | null;
  if (!tableData) return '';

  const headerRow = tableData.headers
    .map(h => `<th style="text-align:${h.align ?? 'left'};${h.width ? `width:${h.width};` : ''}">${escapeHtml(h.label)}</th>`)
    .join('');

  const bodyRows = tableData.rows.map((row, ri) => {
    const cls = [
      tableData.striped ? 'striped' : '',
      row.highlight ? 'highlight' : '',
    ].filter(Boolean).join(' ');

    const cells = tableData.headers.map(h => {
      const val = row.cells[h.key];
      const formatted = val !== undefined ? formatCellValue(val, h.format) : '';
      const align = h.align ?? 'left';
      const isNumeric = typeof val === 'number';
      const colorCls = isNumeric && h.format === 'percent' ? (val as number >= 0 ? 'positive' : 'negative') : '';
      return `<td style="text-align:${align};" class="${colorCls}">${formatted}</td>`;
    }).join('');

    return `<tr class="${cls}">${cells}</tr>`;
  }).join('\n');

  let summaryRow = '';
  if (tableData.summary) {
    const cells = tableData.headers.map(h => {
      const val = tableData.summary!.cells[h.key];
      const formatted = val !== undefined ? formatCellValue(val, h.format) : '';
      return `<td style="text-align:${h.align ?? 'left'};">${formatted}</td>`;
    }).join('');
    summaryRow = `<tr class="summary">${cells}</tr>`;
  }

  return `
    <h2 class="section-title">${escapeHtml(section.title)}</h2>
    ${section.subtitle ? `<h3 class="section-subtitle">${escapeHtml(section.subtitle)}</h3>` : ''}
    <table>
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}${summaryRow}</tbody>
    </table>`;
}

function renderMetricGrid(section: ReportSection): string {
  const metricData = section.data as MetricData | null;
  if (!metricData) return '';

  const cols = metricData.columns ?? 4;
  const cards = metricData.metrics.map(m => {
    let displayValue: string;
    if (typeof m.value === 'number') {
      switch (m.format) {
        case 'currency': displayValue = fmtCurrency(m.value); break;
        case 'percent': displayValue = fmtPercent(m.value); break;
        default: displayValue = fmtNumber(m.value); break;
      }
    } else {
      displayValue = escapeHtml(m.value);
    }

    const changeHtml = m.change !== undefined
      ? `<div class="change ${m.change >= 0 ? 'positive' : 'negative'}">${fmtPercent(m.change)} vs prior</div>`
      : '';

    return `
      <div class="metric-card" ${m.color ? `style="border-left:3px solid ${m.color};"` : ''}>
        <div class="label">${escapeHtml(m.label)}</div>
        <div class="value" ${m.color ? `style="color:${m.color};"` : ''}>${displayValue}</div>
        ${changeHtml}
      </div>`;
  }).join('');

  return `
    <h2 class="section-title">${escapeHtml(section.title)}</h2>
    ${section.subtitle ? `<h3 class="section-subtitle">${escapeHtml(section.subtitle)}</h3>` : ''}
    <div class="metric-grid" style="grid-template-columns:repeat(${cols},1fr);">${cards}</div>`;
}

function renderText(section: ReportSection): string {
  const textData = section.data as TextData | null;
  if (!textData) return '';

  let content: string;
  if (textData.format === 'html') {
    content = textData.content;
  } else {
    content = escapeHtml(textData.content).replace(/\n/g, '<br/>');
  }

  return `
    <h2 class="section-title">${escapeHtml(section.title)}</h2>
    ${section.subtitle ? `<h3 class="section-subtitle">${escapeHtml(section.subtitle)}</h3>` : ''}
    <div class="text-section">${content}</div>`;
}

// ─── Full Report Generation ──────────────────────────────────────────────────

export function generateHTMLReport(config: ReportConfig): string {
  const { branding, sections, dateRange } = config;
  const css = generateCSS(branding);
  const sectionHTML = sections.map((s, i) => renderSection(s, i)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.name)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="report-header">
    <div class="title-block">
      <h1>${escapeHtml(config.name)}</h1>
      <div class="subtitle">${escapeHtml(config.description)} | ${fmtDate(dateRange.start)} – ${fmtDate(dateRange.end)}</div>
    </div>
    ${branding.logoUrl ? `<img class="logo" src="${escapeHtml(branding.logoUrl)}" alt="Logo"/>` : `<div style="font-size:14pt;font-weight:700;color:${branding.primaryColor};">${escapeHtml(branding.companyName)}</div>`}
  </div>

  ${sectionHTML}

  <div class="report-footer">
    <p>${escapeHtml(branding.footerText)} | Generated: ${new Date().toISOString()}</p>
    ${branding.confidentiality ? `<p class="footnote">${escapeHtml(branding.confidentiality)}</p>` : ''}
  </div>
</body>
</html>`;
}

// ─── Report Builders ─────────────────────────────────────────────────────────

let reportCounter = 0;
function genId(): string {
  return `report_${Date.now()}_${++reportCounter}`;
}

export function generatePDFReport(config: ReportConfig): GeneratedReport {
  const startTime = Date.now();

  try {
    const html = generateHTMLReport(config);
    return {
      id: genId(),
      configId: config.id,
      status: ReportStatus.Completed,
      format: ExportFormat.HTML,
      content: html,
      fileSize: new TextEncoder().encode(html).length,
      generatedAt: Date.now(),
      duration: Date.now() - startTime,
      metadata: {
        pageCount: Math.max(1, Math.ceil(config.sections.length / 3)),
        sectionCount: config.sections.length,
        generatedAs: 'html_for_pdf',
      },
    };
  } catch (err) {
    return {
      id: genId(),
      configId: config.id,
      status: ReportStatus.Failed,
      format: ExportFormat.PDF,
      content: '',
      fileSize: 0,
      generatedAt: Date.now(),
      duration: Date.now() - startTime,
      error: err instanceof Error ? err.message : 'Unknown error',
      metadata: {},
    };
  }
}

// ─── Predefined Report Builders ──────────────────────────────────────────────

const DEFAULT_BRANDING: ReportBranding = {
  companyName: 'TradingView Pro',
  logoUrl: '',
  primaryColor: '#2962ff',
  secondaryColor: '#1e88e5',
  fontFamily: 'Inter',
  headerText: 'CONFIDENTIAL',
  footerText: 'TradingView Pro Analytics',
  confidentiality: 'This report is confidential and intended for the recipient only.',
};

export function buildPortfolioPerformanceReport(data: {
  portfolioName: string;
  dateRange: DateRange;
  totalReturn: number;
  annualizedReturn: number;
  sharpe: number;
  maxDrawdown: number;
  positions: { symbol: string; weight: number; return: number; contribution: number }[];
  equityCurve: { x: number; y: number }[];
  monthlyReturns: { month: string; return: number }[];
}): ReportConfig {
  return {
    id: genId(),
    name: `Portfolio Performance Report – ${data.portfolioName}`,
    description: 'Comprehensive performance analysis',
    templateId: 'portfolio_performance',
    format: ExportFormat.PDF,
    branding: DEFAULT_BRANDING,
    dateRange: data.dateRange,
    parameters: {},
    createdBy: 'system',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sections: [
      {
        id: 's1', type: SectionType.ExecutiveSummary, title: 'Executive Summary', data: {
          content: `Portfolio "${data.portfolioName}" returned ${fmtPercent(data.totalReturn)} (${fmtPercent(data.annualizedReturn)} annualized) during ${data.dateRange.label}. Sharpe ratio: ${fmtNumber(data.sharpe)}. Maximum drawdown: ${fmtPercent(data.maxDrawdown)}.`,
          format: 'plain' as const,
        }, options: {},
      },
      {
        id: 's2', type: SectionType.MetricGrid, title: 'Key Metrics', data: {
          metrics: [
            { label: 'Total Return', value: data.totalReturn, format: 'percent' as const },
            { label: 'Annualized Return', value: data.annualizedReturn, format: 'percent' as const },
            { label: 'Sharpe Ratio', value: data.sharpe, format: 'number' as const },
            { label: 'Max Drawdown', value: data.maxDrawdown, format: 'percent' as const, color: '#dc2626' },
          ], columns: 4,
        }, options: {},
      },
      {
        id: 's3', type: SectionType.Chart, title: 'Equity Curve', data: {
          type: ChartType.Area,
          series: [{ name: 'Portfolio', data: data.equityCurve.map(p => ({ x: p.x, y: p.y })) }],
          xAxis: { label: 'Date', format: 'date' as const },
          yAxis: { label: 'Value', format: 'currency' as const },
          width: 600, height: 280, colors: ['#2962ff'],
        }, options: {},
      },
      {
        id: 's4', type: SectionType.Table, title: 'Position Breakdown', data: {
          headers: [
            { key: 'symbol', label: 'Symbol', align: 'left' as const },
            { key: 'weight', label: 'Weight', align: 'right' as const, format: 'percent' as const },
            { key: 'return', label: 'Return', align: 'right' as const, format: 'percent' as const },
            { key: 'contribution', label: 'Contribution', align: 'right' as const, format: 'percent' as const },
          ],
          rows: data.positions.map(p => ({ cells: { symbol: p.symbol, weight: p.weight, return: p.return, contribution: p.contribution } })),
          striped: true,
        }, options: {},
      },
    ],
  };
}

export function buildRiskAnalysisReport(data: {
  portfolioName: string;
  dateRange: DateRange;
  var95: number;
  cvar95: number;
  volatility: number;
  beta: number;
  sharpe: number;
  drawdowns: { start: string; end: string; depth: number; duration: number }[];
  correlationMatrix: { assets: string[]; matrix: number[][] };
}): ReportConfig {
  return {
    id: genId(),
    name: `Risk Analysis – ${data.portfolioName}`,
    description: 'Risk metrics and stress analysis',
    templateId: 'risk_analysis',
    format: ExportFormat.PDF,
    branding: DEFAULT_BRANDING,
    dateRange: data.dateRange,
    parameters: {},
    createdBy: 'system',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sections: [
      {
        id: 's1', type: SectionType.MetricGrid, title: 'Risk Overview', data: {
          metrics: [
            { label: 'VaR (95%)', value: data.var95, format: 'currency' as const, color: '#dc2626' },
            { label: 'CVaR (95%)', value: data.cvar95, format: 'currency' as const, color: '#dc2626' },
            { label: 'Volatility', value: data.volatility, format: 'percent' as const },
            { label: 'Beta', value: data.beta, format: 'number' as const },
            { label: 'Sharpe', value: data.sharpe, format: 'number' as const },
          ], columns: 5,
        }, options: {},
      },
      {
        id: 's2', type: SectionType.Table, title: 'Drawdown Analysis', data: {
          headers: [
            { key: 'start', label: 'Start', align: 'left' as const },
            { key: 'end', label: 'End', align: 'left' as const },
            { key: 'depth', label: 'Depth', align: 'right' as const, format: 'percent' as const },
            { key: 'duration', label: 'Duration (days)', align: 'right' as const },
          ],
          rows: data.drawdowns.map(d => ({ cells: { start: d.start, end: d.end, depth: d.depth, duration: d.duration } })),
          striped: true, bordered: true,
        }, options: {},
      },
    ],
  };
}

export function buildBacktestReport(data: {
  strategyName: string;
  dateRange: DateRange;
  totalReturn: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  equityCurve: { x: number; y: number }[];
  trades: { date: string; symbol: string; side: string; pnl: number; return: number }[];
}): ReportConfig {
  return {
    id: genId(),
    name: `Backtest Results – ${data.strategyName}`,
    description: 'Strategy backtest performance summary',
    templateId: 'backtest_results',
    format: ExportFormat.PDF,
    branding: DEFAULT_BRANDING,
    dateRange: data.dateRange,
    parameters: {},
    createdBy: 'system',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sections: [
      {
        id: 's1', type: SectionType.ExecutiveSummary, title: 'Strategy Summary', data: {
          content: `"${data.strategyName}" returned ${fmtPercent(data.totalReturn)} over the test period with a Sharpe of ${fmtNumber(data.sharpe)}. Win rate: ${fmtPercent(data.winRate)} across ${data.totalTrades} trades. Profit factor: ${fmtNumber(data.profitFactor)}.`,
          format: 'plain' as const,
        }, options: {},
      },
      {
        id: 's2', type: SectionType.MetricGrid, title: 'Key Metrics', data: {
          metrics: [
            { label: 'Total Return', value: data.totalReturn, format: 'percent' as const },
            { label: 'Sharpe Ratio', value: data.sharpe, format: 'number' as const },
            { label: 'Max Drawdown', value: data.maxDrawdown, format: 'percent' as const, color: '#dc2626' },
            { label: 'Win Rate', value: data.winRate, format: 'percent' as const },
            { label: 'Profit Factor', value: data.profitFactor, format: 'number' as const },
            { label: 'Total Trades', value: data.totalTrades, format: 'number' as const },
          ], columns: 3,
        }, options: {},
      },
      {
        id: 's3', type: SectionType.Chart, title: 'Equity Curve', data: {
          type: ChartType.Area,
          series: [{ name: 'Strategy', data: data.equityCurve.map(p => ({ x: p.x, y: p.y })) }],
          xAxis: { label: 'Date', format: 'date' as const },
          yAxis: { label: 'Equity', format: 'currency' as const },
          width: 600, height: 280,
        }, options: {},
      },
      {
        id: 's4', type: SectionType.Table, title: 'Trade Log', data: {
          headers: [
            { key: 'date', label: 'Date', align: 'left' as const },
            { key: 'symbol', label: 'Symbol', align: 'left' as const },
            { key: 'side', label: 'Side', align: 'center' as const },
            { key: 'pnl', label: 'P&L', align: 'right' as const, format: 'currency' as const },
            { key: 'return', label: 'Return', align: 'right' as const, format: 'percent' as const },
          ],
          rows: data.trades.slice(0, 200).map(t => ({ cells: { date: t.date, symbol: t.symbol, side: t.side, pnl: t.pnl, return: t.return } })),
          striped: true,
        }, options: {},
      },
    ],
  };
}

export function buildTradingSummaryReport(data: {
  dateRange: DateRange;
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  avgHoldTime: string;
  topWinners: { symbol: string; pnl: number }[];
  topLosers: { symbol: string; pnl: number }[];
  pnlByDay: { day: string; pnl: number }[];
}): ReportConfig {
  return {
    id: genId(),
    name: 'Trading Summary',
    description: `Trading activity overview for ${data.dateRange.label}`,
    templateId: 'trading_summary',
    format: ExportFormat.PDF,
    branding: DEFAULT_BRANDING,
    dateRange: data.dateRange,
    parameters: {},
    createdBy: 'system',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sections: [
      {
        id: 's1', type: SectionType.MetricGrid, title: 'Overview', data: {
          metrics: [
            { label: 'Total P&L', value: data.totalPnl, format: 'currency' as const, color: data.totalPnl >= 0 ? '#16a34a' : '#dc2626' },
            { label: 'Win Rate', value: data.winRate, format: 'percent' as const },
            { label: 'Total Trades', value: data.totalTrades, format: 'number' as const },
            { label: 'Avg Hold Time', value: data.avgHoldTime, format: 'text' as const },
          ], columns: 4,
        }, options: {},
      },
      {
        id: 's2', type: SectionType.Chart, title: 'Daily P&L', data: {
          type: ChartType.Bar,
          series: [{ name: 'P&L', data: data.pnlByDay.map(d => ({ x: d.day, y: d.pnl, label: d.day })) }],
          xAxis: { label: 'Day' },
          yAxis: { label: 'P&L', format: 'currency' as const },
          width: 600, height: 250,
        }, options: {},
      },
      {
        id: 's3', type: SectionType.Table, title: 'Top Winners', data: {
          headers: [
            { key: 'symbol', label: 'Symbol', align: 'left' as const },
            { key: 'pnl', label: 'P&L', align: 'right' as const, format: 'currency' as const },
          ],
          rows: data.topWinners.map(w => ({ cells: { symbol: w.symbol, pnl: w.pnl } })),
          striped: true,
        }, options: {},
      },
    ],
  };
}

export function buildOptionsAnalysisReport(data: {
  dateRange: DateRange;
  strategies: { name: string; maxProfit: number; maxLoss: number; breakeven: number; probability: number }[];
  greeks: { delta: number; gamma: number; theta: number; vega: number; rho: number };
  ivSkew: { strike: number; iv: number }[];
}): ReportConfig {
  return {
    id: genId(),
    name: 'Options Analysis Report',
    description: 'Options strategy and Greeks analysis',
    templateId: 'options_analysis',
    format: ExportFormat.PDF,
    branding: DEFAULT_BRANDING,
    dateRange: data.dateRange,
    parameters: {},
    createdBy: 'system',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sections: [
      {
        id: 's1', type: SectionType.MetricGrid, title: 'Portfolio Greeks', data: {
          metrics: [
            { label: 'Delta', value: data.greeks.delta, format: 'number' as const },
            { label: 'Gamma', value: data.greeks.gamma, format: 'number' as const },
            { label: 'Theta', value: data.greeks.theta, format: 'currency' as const, color: data.greeks.theta < 0 ? '#dc2626' : '#16a34a' },
            { label: 'Vega', value: data.greeks.vega, format: 'number' as const },
            { label: 'Rho', value: data.greeks.rho, format: 'number' as const },
          ], columns: 5,
        }, options: {},
      },
      {
        id: 's2', type: SectionType.Table, title: 'Strategy Summary', data: {
          headers: [
            { key: 'name', label: 'Strategy', align: 'left' as const },
            { key: 'maxProfit', label: 'Max Profit', align: 'right' as const, format: 'currency' as const },
            { key: 'maxLoss', label: 'Max Loss', align: 'right' as const, format: 'currency' as const },
            { key: 'breakeven', label: 'Breakeven', align: 'right' as const, format: 'currency' as const },
            { key: 'probability', label: 'Prob. Profit', align: 'right' as const, format: 'percent' as const },
          ],
          rows: data.strategies.map(s => ({ cells: { name: s.name, maxProfit: s.maxProfit, maxLoss: s.maxLoss, breakeven: s.breakeven, probability: s.probability } })),
          striped: true,
        }, options: {},
      },
      {
        id: 's3', type: SectionType.Chart, title: 'IV Skew', data: {
          type: ChartType.Line,
          series: [{ name: 'Implied Volatility', data: data.ivSkew.map(p => ({ x: p.strike, y: p.iv })) }],
          xAxis: { label: 'Strike', format: 'currency' as const },
          yAxis: { label: 'IV', format: 'percent' as const },
          width: 600, height: 250,
        }, options: {},
      },
    ],
  };
}
