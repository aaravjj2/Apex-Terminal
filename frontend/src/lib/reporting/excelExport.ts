import type {
  ExcelWorkbook,
  ExcelSheet,
  ExcelColumn,
  ExcelRow,
  ExcelCell,
  ExcelCellStyle,
  ConditionalFormat,
  DataValidation,
} from './types';

function colLetter(idx: number): string {
  let result = '';
  let n = idx;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

function cellRef(row: number, col: number): string {
  return colLetter(col) + (row + 1);
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export class WorkbookBuilder {
  private sheets: SheetBuilder[] = [];
  private title = 'Workbook';
  private author = 'TradingView Pro';

  setProperties(title: string, author: string): this {
    this.title = title;
    this.author = author;
    return this;
  }

  addSheet(name: string): SheetBuilder {
    const sheet = new SheetBuilder(name);
    this.sheets.push(sheet);
    return sheet;
  }

  build(): ExcelWorkbook {
    return {
      sheets: this.sheets.map(s => s.build()),
      properties: { title: this.title, author: this.author, createdAt: new Date().toISOString() },
    };
  }

  toXML(): string {
    return generateSpreadsheetML(this.build());
  }
}

export class SheetBuilder {
  private name: string;
  private columns: ExcelColumn[] = [];
  private rows: ExcelRow[] = [];
  private mergedCells: string[] = [];
  private freezeRow = 0;
  private freezeCol = 0;
  private conditionalFormats: ConditionalFormat[] = [];

  constructor(name: string) {
    this.name = name;
  }

  addColumn(key: string, header: string, opts?: { width?: number; format?: string; style?: ExcelCellStyle }): this {
    this.columns.push({ key, header, width: opts?.width, format: opts?.format, style: opts?.style });
    return this;
  }

  addColumns(cols: ExcelColumn[]): this {
    this.columns.push(...cols);
    return this;
  }

  addRow(cells: Record<string, ExcelCell>): this {
    this.rows.push({ cells });
    return this;
  }

  addDataRow(data: Record<string, string | number | boolean | null>, style?: ExcelCellStyle): this {
    const cells: Record<string, ExcelCell> = {};
    for (const [key, value] of Object.entries(data)) {
      cells[key] = { value, style };
    }
    this.rows.push({ cells });
    return this;
  }

  addEmptyRow(): this {
    this.rows.push({ cells: {} });
    return this;
  }

  addFormulaRow(formulas: Record<string, string>, style?: ExcelCellStyle): this {
    const cells: Record<string, ExcelCell> = {};
    for (const [key, formula] of Object.entries(formulas)) {
      cells[key] = { value: null, formula, style };
    }
    this.rows.push({ cells });
    return this;
  }

  mergeCells(range: string): this {
    this.mergedCells.push(range);
    return this;
  }

  setFreezePane(row: number, col: number): this {
    this.freezeRow = row;
    this.freezeCol = col;
    return this;
  }

  addConditionalFormat(format: ConditionalFormat): this {
    this.conditionalFormats.push(format);
    return this;
  }

  addValidation(colKey: string, validation: DataValidation): this {
    for (const row of this.rows) {
      const cell = row.cells[colKey];
      if (cell) cell.validation = validation;
    }
    return this;
  }

  build(): ExcelSheet {
    return {
      name: this.name,
      columns: this.columns,
      rows: this.rows,
      mergedCells: this.mergedCells.length > 0 ? this.mergedCells : undefined,
      freezePane: (this.freezeRow > 0 || this.freezeCol > 0) ? { row: this.freezeRow, col: this.freezeCol } : undefined,
      conditionalFormats: this.conditionalFormats.length > 0 ? this.conditionalFormats : undefined,
    };
  }
}

function generateSpreadsheetML(workbook: ExcelWorkbook): string {
  const styles = collectStyles(workbook);
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += '  xmlns:x="urn:schemas-microsoft-com:office:excel">\n';
  xml += '  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">\n';
  xml += '    <Title>' + escapeXml(workbook.properties.title) + '</Title>\n';
  xml += '    <Author>' + escapeXml(workbook.properties.author) + '</Author>\n';
  xml += '    <Created>' + workbook.properties.createdAt + '</Created>\n';
  xml += '  </DocumentProperties>\n';
  xml += '  <Styles>\n';
  xml += '    <Style ss:ID="Default"><Font ss:Size="10" ss:FontName="Calibri"/></Style>\n';
  xml += '    <Style ss:ID="Header"><Font ss:Bold="1" ss:Size="10" ss:FontName="Calibri" ss:Color="#FFFFFF"/><Interior ss:Color="#2962FF" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>\n';
  xml += '    <Style ss:ID="Currency"><NumberFormat ss:Format="$#,##0.00"/></Style>\n';
  xml += '    <Style ss:ID="Percent"><NumberFormat ss:Format="0.00%"/></Style>\n';
  xml += '    <Style ss:ID="Date"><NumberFormat ss:Format="yyyy-mm-dd"/></Style>\n';
  xml += '    <Style ss:ID="Positive"><Font ss:Color="#16A34A" ss:Bold="1"/></Style>\n';
  xml += '    <Style ss:ID="Negative"><Font ss:Color="#DC2626" ss:Bold="1"/></Style>\n';
  xml += '    <Style ss:ID="Bold"><Font ss:Bold="1"/></Style>\n';
  xml += '    <Style ss:ID="StripedRow"><Interior ss:Color="#F8F9FA" ss:Pattern="Solid"/></Style>\n';
  for (let i = 0; i < styles.length; i++) {
    xml += '    <Style ss:ID="Custom_' + i + '">' + styleToXml(styles[i]) + '</Style>\n';
  }
  xml += '  </Styles>\n';
  for (const sheet of workbook.sheets) {
    xml += '  <Worksheet ss:Name="' + escapeXml(sheet.name) + '">\n';
    xml += '    <Table ss:DefaultRowHeight="15" ss:ExpandedColumnCount="' + sheet.columns.length + '" ss:ExpandedRowCount="' + (sheet.rows.length + 1) + '">\n';
    for (const col of sheet.columns) {
      xml += '      <Column ss:Width="' + (col.width ?? estimateColumnWidth(col, sheet.rows)) + '"/>\n';
    }
    xml += '      <Row ss:Height="20">\n';
    for (const col of sheet.columns) {
      xml += '        <Cell ss:StyleID="Header"><Data ss:Type="String">' + escapeXml(col.header) + '</Data></Cell>\n';
    }
    xml += '      </Row>\n';
    for (let ri = 0; ri < sheet.rows.length; ri++) {
      const row = sheet.rows[ri];
      const isStriped = ri % 2 === 1;
      xml += '      <Row' + (row.height ? ' ss:Height="' + row.height + '"' : '') + '>\n';
      for (const col of sheet.columns) {
        const cell = row.cells[col.key];
        if (!cell) { xml += '        <Cell><Data ss:Type="String"></Data></Cell>\n'; continue; }
        let styleId = isStriped ? 'StripedRow' : 'Default';
        if (cell.style) {
          const idx = styles.findIndex(s => JSON.stringify(s) === JSON.stringify(cell.style));
          if (idx >= 0) styleId = 'Custom_' + idx;
        } else if (col.format === 'currency') { styleId = 'Currency'; }
        else if (col.format === 'percent') { styleId = 'Percent'; }
        else if (col.format === 'date') { styleId = 'Date'; }
        if (typeof cell.value === 'number' && col.format === 'percent') {
          styleId = cell.value > 0 ? 'Positive' : cell.value < 0 ? 'Negative' : styleId;
        }
        if (cell.formula) {
          xml += '        <Cell ss:StyleID="' + styleId + '" ss:Formula="=' + escapeXml(cell.formula) + '"><Data ss:Type="Number">0</Data></Cell>\n';
        } else if (cell.value === null || cell.value === undefined) {
          xml += '        <Cell ss:StyleID="' + styleId + '"><Data ss:Type="String"></Data></Cell>\n';
        } else if (typeof cell.value === 'number') {
          xml += '        <Cell ss:StyleID="' + styleId + '"><Data ss:Type="Number">' + cell.value + '</Data></Cell>\n';
        } else if (typeof cell.value === 'boolean') {
          xml += '        <Cell ss:StyleID="' + styleId + '"><Data ss:Type="Boolean">' + (cell.value ? 1 : 0) + '</Data></Cell>\n';
        } else {
          xml += '        <Cell ss:StyleID="' + styleId + '"><Data ss:Type="String">' + escapeXml(String(cell.value)) + '</Data></Cell>\n';
        }
      }
      xml += '      </Row>\n';
    }
    xml += '    </Table>\n';
    if (sheet.freezePane) {
      xml += '    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">\n';
      xml += '      <FreezePanes/><FrozenNoSplit/>\n';
      xml += '      <SplitHorizontal>' + sheet.freezePane.row + '</SplitHorizontal>\n';
      xml += '      <TopRowBottomPane>' + sheet.freezePane.row + '</TopRowBottomPane>\n';
      if (sheet.freezePane.col > 0) {
        xml += '      <SplitVertical>' + sheet.freezePane.col + '</SplitVertical>\n';
        xml += '      <LeftColumnRightPane>' + sheet.freezePane.col + '</LeftColumnRightPane>\n';
      }
      xml += '    </WorksheetOptions>\n';
    }
    xml += '  </Worksheet>\n';
  }
  xml += '</Workbook>';
  return xml;
}

function styleToXml(style: ExcelCellStyle): string {
  let xml = '';
  if (style.font) {
    xml += '<Font';
    if (style.font.name) xml += ' ss:FontName="' + style.font.name + '"';
    if (style.font.size) xml += ' ss:Size="' + style.font.size + '"';
    if (style.font.bold) xml += ' ss:Bold="1"';
    if (style.font.italic) xml += ' ss:Italic="1"';
    if (style.font.underline) xml += ' ss:Underline="Single"';
    if (style.font.color) xml += ' ss:Color="' + style.font.color + '"';
    xml += '/>';
  }
  if (style.fill) xml += '<Interior ss:Color="' + style.fill.color + '" ss:Pattern="Solid"/>';
  if (style.alignment) {
    xml += '<Alignment';
    if (style.alignment.horizontal) xml += ' ss:Horizontal="' + capitalize(style.alignment.horizontal) + '"';
    if (style.alignment.vertical) xml += ' ss:Vertical="' + capitalize(style.alignment.vertical) + '"';
    if (style.alignment.wrapText) xml += ' ss:WrapText="1"';
    xml += '/>';
  }
  if (style.numberFormat) xml += '<NumberFormat ss:Format="' + escapeXml(style.numberFormat) + '"/>';
  if (style.border) {
    xml += '<Borders>';
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      if (style.border[side]) xml += '<Border ss:Position="' + capitalize(side) + '" ss:LineStyle="Continuous" ss:Weight="1"/>';
    }
    xml += '</Borders>';
  }
  return xml;
}

function collectStyles(workbook: ExcelWorkbook): ExcelCellStyle[] {
  const seen = new Set<string>();
  const styles: ExcelCellStyle[] = [];
  for (const sheet of workbook.sheets) {
    for (const row of sheet.rows) {
      for (const cell of Object.values(row.cells)) {
        if (cell.style) {
          const key = JSON.stringify(cell.style);
          if (!seen.has(key)) { seen.add(key); styles.push(cell.style); }
        }
      }
    }
  }
  return styles;
}

function estimateColumnWidth(col: ExcelColumn, rows: ExcelRow[]): number {
  let maxLen = col.header.length;
  for (const row of rows) {
    const cell = row.cells[col.key];
    if (cell?.value !== null && cell?.value !== undefined) {
      const len = String(cell.value).length;
      if (len > maxLen) maxLen = len;
    }
  }
  return Math.max(60, Math.min(300, maxLen * 8 + 20));
}

const CURRENCY_STYLE: ExcelCellStyle = { numberFormat: '$#,##0.00' };
const PERCENT_STYLE: ExcelCellStyle = { numberFormat: '0.00%' };
const BOLD_STYLE: ExcelCellStyle = { font: { bold: true } };
const POSITIVE_STYLE: ExcelCellStyle = { font: { color: '#16A34A', bold: true }, numberFormat: '$#,##0.00' };
const NEGATIVE_STYLE: ExcelCellStyle = { font: { color: '#DC2626', bold: true }, numberFormat: '$#,##0.00' };

export function createPortfolioExport(data: {
  portfolioName: string;
  positions: { symbol: string; quantity: number; avgPrice: number; currentPrice: number; marketValue: number; weight: number; pnl: number; pnlPct: number }[];
  totalValue: number;
  totalPnl: number;
}): string {
  const wb = new WorkbookBuilder();
  wb.setProperties('Portfolio: ' + data.portfolioName, 'TradingView Pro');
  const summary = wb.addSheet('Summary');
  summary.addColumn('label', 'Metric', { width: 150 }).addColumn('value', 'Value', { width: 150 })
    .addDataRow({ label: 'Portfolio Name', value: data.portfolioName })
    .addDataRow({ label: 'Total Value', value: data.totalValue }, CURRENCY_STYLE)
    .addDataRow({ label: 'Total P&L', value: data.totalPnl }, data.totalPnl >= 0 ? POSITIVE_STYLE : NEGATIVE_STYLE)
    .addDataRow({ label: 'Positions', value: data.positions.length })
    .addDataRow({ label: 'Generated', value: new Date().toISOString() })
    .setFreezePane(1, 0);
  const positions = wb.addSheet('Positions');
  positions.addColumn('symbol', 'Symbol', { width: 80 }).addColumn('quantity', 'Quantity', { width: 80 })
    .addColumn('avgPrice', 'Avg Price', { width: 100, format: 'currency' })
    .addColumn('currentPrice', 'Current Price', { width: 100, format: 'currency' })
    .addColumn('marketValue', 'Market Value', { width: 120, format: 'currency' })
    .addColumn('weight', 'Weight', { width: 80, format: 'percent' })
    .addColumn('pnl', 'P&L', { width: 100, format: 'currency' })
    .addColumn('pnlPct', 'P&L %', { width: 80, format: 'percent' })
    .setFreezePane(1, 0);
  for (const pos of data.positions) {
    positions.addRow({
      symbol: { value: pos.symbol }, quantity: { value: pos.quantity },
      avgPrice: { value: pos.avgPrice, style: CURRENCY_STYLE },
      currentPrice: { value: pos.currentPrice, style: CURRENCY_STYLE },
      marketValue: { value: pos.marketValue, style: CURRENCY_STYLE },
      weight: { value: pos.weight, style: PERCENT_STYLE },
      pnl: { value: pos.pnl, style: pos.pnl >= 0 ? POSITIVE_STYLE : NEGATIVE_STYLE },
      pnlPct: { value: pos.pnlPct, style: pos.pnlPct >= 0 ? { ...PERCENT_STYLE, font: { color: '#16A34A' } } : { ...PERCENT_STYLE, font: { color: '#DC2626' } } },
    });
  }
  return wb.toXML();
}

export function createTradeHistoryExport(data: {
  trades: { id: string; date: string; symbol: string; side: string; quantity: number; entryPrice: number; exitPrice: number; pnl: number; pnlPct: number; duration: string; fees: number }[];
}): string {
  const wb = new WorkbookBuilder();
  wb.setProperties('Trade History', 'TradingView Pro');
  const sheet = wb.addSheet('Trades');
  sheet.addColumn('id', 'Trade ID', { width: 100 }).addColumn('date', 'Date', { width: 100, format: 'date' })
    .addColumn('symbol', 'Symbol', { width: 80 }).addColumn('side', 'Side', { width: 60 })
    .addColumn('quantity', 'Quantity', { width: 80 })
    .addColumn('entryPrice', 'Entry Price', { width: 100, format: 'currency' })
    .addColumn('exitPrice', 'Exit Price', { width: 100, format: 'currency' })
    .addColumn('pnl', 'P&L', { width: 100, format: 'currency' })
    .addColumn('pnlPct', 'Return %', { width: 80, format: 'percent' })
    .addColumn('duration', 'Duration', { width: 80 }).addColumn('fees', 'Fees', { width: 80, format: 'currency' })
    .setFreezePane(1, 0);
  for (const trade of data.trades) {
    sheet.addRow({
      id: { value: trade.id }, date: { value: trade.date }, symbol: { value: trade.symbol },
      side: { value: trade.side }, quantity: { value: trade.quantity },
      entryPrice: { value: trade.entryPrice, style: CURRENCY_STYLE },
      exitPrice: { value: trade.exitPrice, style: CURRENCY_STYLE },
      pnl: { value: trade.pnl, style: trade.pnl >= 0 ? POSITIVE_STYLE : NEGATIVE_STYLE },
      pnlPct: { value: trade.pnlPct, style: PERCENT_STYLE },
      duration: { value: trade.duration }, fees: { value: trade.fees, style: CURRENCY_STYLE },
    });
  }
  const stats = wb.addSheet('Statistics');
  const wins = data.trades.filter(t => t.pnl > 0);
  const losses = data.trades.filter(t => t.pnl <= 0);
  const totalPnl = data.trades.reduce((s, t) => s + t.pnl, 0);
  const totalFees = data.trades.reduce((s, t) => s + t.fees, 0);
  const lossSum = losses.reduce((s, t) => s + t.pnl, 0);
  stats.addColumn('label', 'Metric', { width: 180 }).addColumn('value', 'Value', { width: 150 })
    .addDataRow({ label: 'Total Trades', value: data.trades.length })
    .addDataRow({ label: 'Winning Trades', value: wins.length })
    .addDataRow({ label: 'Losing Trades', value: losses.length })
    .addDataRow({ label: 'Win Rate', value: data.trades.length > 0 ? wins.length / data.trades.length : 0 }, PERCENT_STYLE)
    .addDataRow({ label: 'Total P&L', value: totalPnl }, totalPnl >= 0 ? POSITIVE_STYLE : NEGATIVE_STYLE)
    .addDataRow({ label: 'Total Fees', value: totalFees }, CURRENCY_STYLE)
    .addDataRow({ label: 'Net P&L', value: totalPnl - totalFees }, (totalPnl - totalFees) >= 0 ? POSITIVE_STYLE : NEGATIVE_STYLE)
    .addDataRow({ label: 'Average Win', value: wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0 }, CURRENCY_STYLE)
    .addDataRow({ label: 'Average Loss', value: losses.length > 0 ? lossSum / losses.length : 0 }, CURRENCY_STYLE)
    .addDataRow({ label: 'Profit Factor', value: lossSum !== 0 ? Math.abs(wins.reduce((s, t) => s + t.pnl, 0) / lossSum) : 0 })
    .setFreezePane(1, 0);
  return wb.toXML();
}

export function createBacktestExport(data: {
  strategyName: string;
  metrics: Record<string, number>;
  monthlyReturns: { year: number; month: number; return: number }[];
  trades: { date: string; symbol: string; side: string; entryPrice: number; exitPrice: number; pnl: number; pnlPct: number }[];
}): string {
  const wb = new WorkbookBuilder();
  wb.setProperties('Backtest: ' + data.strategyName, 'TradingView Pro');
  const metricsSheet = wb.addSheet('Metrics');
  metricsSheet.addColumn('metric', 'Metric', { width: 200 }).addColumn('value', 'Value', { width: 150 }).setFreezePane(1, 0);
  for (const [key, val] of Object.entries(data.metrics)) {
    metricsSheet.addDataRow({ metric: key.replace(/([A-Z])/g, ' $1').trim(), value: val });
  }
  const monthlySheet = wb.addSheet('Monthly Returns');
  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  monthlySheet.addColumn('year', 'Year', { width: 60 });
  for (const mk of monthKeys) monthlySheet.addColumn(mk, mk.charAt(0).toUpperCase() + mk.slice(1), { width: 70, format: 'percent' });
  monthlySheet.setFreezePane(1, 1);
  const years = [...new Set(data.monthlyReturns.map(m => m.year))].sort();
  for (const year of years) {
    const rowData: Record<string, string | number | boolean | null> = { year };
    for (let m = 0; m < 12; m++) {
      const entry = data.monthlyReturns.find(r => r.year === year && r.month === m + 1);
      rowData[monthKeys[m]] = entry ? entry.return : null;
    }
    monthlySheet.addDataRow(rowData);
  }
  const tradesSheet = wb.addSheet('Trades');
  tradesSheet.addColumn('date', 'Date', { width: 100 }).addColumn('symbol', 'Symbol', { width: 80 })
    .addColumn('side', 'Side', { width: 60 }).addColumn('entryPrice', 'Entry', { width: 100, format: 'currency' })
    .addColumn('exitPrice', 'Exit', { width: 100, format: 'currency' }).addColumn('pnl', 'P&L', { width: 100, format: 'currency' })
    .addColumn('pnlPct', 'Return', { width: 80, format: 'percent' }).setFreezePane(1, 0);
  for (const t of data.trades) {
    tradesSheet.addDataRow({ date: t.date, symbol: t.symbol, side: t.side, entryPrice: t.entryPrice, exitPrice: t.exitPrice, pnl: t.pnl, pnlPct: t.pnlPct });
  }
  return wb.toXML();
}
