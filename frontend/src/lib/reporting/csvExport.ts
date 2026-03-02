// --- CSV Configuration ---

export interface CSVOptions {
  delimiter?: string;
  lineEnding?: string;
  includeHeaders?: boolean;
  quoteAll?: boolean;
  dateFormat?: 'iso' | 'us' | 'eu' | 'unix';
  numberPrecision?: number;
  nullValue?: string;
  bom?: boolean;
  encoding?: 'utf-8' | 'ascii';
}

const DEFAULT_OPTIONS: Required<CSVOptions> = {
  delimiter: ',',
  lineEnding: '\n',
  includeHeaders: true,
  quoteAll: false,
  dateFormat: 'iso',
  numberPrecision: 6,
  nullValue: '',
  bom: false,
  encoding: 'utf-8',
};

// --- Core CSV Generation ---

export function generateCSV(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  options?: CSVOptions,
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const parts: string[] = [];
  if (opts.bom) parts.push('\uFEFF');
  if (opts.includeHeaders) {
    parts.push(headers.map(h => escapeField(h, opts)).join(opts.delimiter));
  }
  for (const row of rows) {
    const cells = row.map(cell => escapeField(formatValue(cell, opts), opts));
    parts.push(cells.join(opts.delimiter));
  }
  return parts.join(opts.lineEnding);
}

// --- Object-Based CSV ---

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  format?: 'string' | 'number' | 'currency' | 'percent' | 'date' | 'boolean';
  precision?: number;
  transform?: (value: unknown, row: T) => string;
}

export function generateCSVFromObjects<T extends Record<string, unknown>>(
  data: T[],
  columns: ColumnDef<T>[],
  options?: CSVOptions,
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const headers = columns.map(c => c.header);
  const rows = data.map(item => {
    return columns.map(col => {
      const raw = getNestedValue(item, String(col.key));
      if (col.transform) return col.transform(raw, item);
      switch (col.format) {
        case 'currency':
          return typeof raw === 'number' ? raw.toFixed(col.precision ?? 2) : String(raw ?? '');
        case 'percent':
          return typeof raw === 'number' ? raw.toFixed(col.precision ?? 2) : String(raw ?? '');
        case 'number':
          return typeof raw === 'number' ? raw.toFixed(col.precision ?? opts.numberPrecision) : String(raw ?? '');
        case 'date':
          return formatDate(raw, opts.dateFormat);
        case 'boolean':
          return raw ? 'true' : 'false';
        default:
          return raw !== null && raw !== undefined ? String(raw) : opts.nullValue;
      }
    });
  });
  return generateCSV(headers, rows, opts);
}

// --- Streaming Export ---

export class CSVStreamWriter {
  private opts: Required<CSVOptions>;
  private headers: string[];
  private chunks: string[] = [];
  private rowCount = 0;
  private headerWritten = false;

  constructor(headers: string[], options?: CSVOptions) {
    this.opts = { ...DEFAULT_OPTIONS, ...options };
    this.headers = headers;
    if (this.opts.bom) this.chunks.push('\uFEFF');
  }

  writeHeader(): void {
    if (this.headerWritten) return;
    if (this.opts.includeHeaders) {
      this.chunks.push(this.headers.map(h => escapeField(h, this.opts)).join(this.opts.delimiter));
    }
    this.headerWritten = true;
  }

  writeRow(row: (string | number | boolean | null | undefined)[]): void {
    if (!this.headerWritten) this.writeHeader();
    const cells = row.map(cell => escapeField(formatValue(cell, this.opts), this.opts));
    this.chunks.push(cells.join(this.opts.delimiter));
    this.rowCount++;
  }

  writeRows(rows: (string | number | boolean | null | undefined)[][]): void {
    for (const row of rows) this.writeRow(row);
  }

  writeBatch<T extends Record<string, unknown>>(data: T[], columns: ColumnDef<T>[]): void {
    for (const item of data) {
      const row = columns.map(col => {
        const raw = getNestedValue(item, String(col.key));
        if (col.transform) return col.transform(raw, item);
        if (typeof raw === 'number') return raw.toFixed(col.precision ?? this.opts.numberPrecision);
        return raw !== null && raw !== undefined ? String(raw) : this.opts.nullValue;
      });
      this.writeRow(row);
    }
  }

  getRowCount(): number { return this.rowCount; }

  flush(): string {
    const result = this.chunks.join(this.opts.lineEnding);
    this.chunks = [];
    this.rowCount = 0;
    this.headerWritten = false;
    return result;
  }

  toString(): string { return this.chunks.join(this.opts.lineEnding); }
}

// --- Predefined Export Functions ---

export function exportPositionsCSV(positions: {
  symbol: string; quantity: number; avgPrice: number; currentPrice: number;
  marketValue: number; weight: number; pnl: number; pnlPct: number;
}[], options?: CSVOptions): string {
  return generateCSVFromObjects(positions, [
    { key: 'symbol', header: 'Symbol' },
    { key: 'quantity', header: 'Quantity', format: 'number', precision: 0 },
    { key: 'avgPrice', header: 'Avg Price', format: 'currency' },
    { key: 'currentPrice', header: 'Current Price', format: 'currency' },
    { key: 'marketValue', header: 'Market Value', format: 'currency' },
    { key: 'weight', header: 'Weight %', format: 'percent' },
    { key: 'pnl', header: 'P&L', format: 'currency' },
    { key: 'pnlPct', header: 'P&L %', format: 'percent' },
  ], options);
}

export function exportTradesCSV(trades: {
  id: string; date: string; symbol: string; side: string; quantity: number;
  entryPrice: number; exitPrice: number; pnl: number; pnlPct: number;
  duration: string; fees: number;
}[], options?: CSVOptions): string {
  return generateCSVFromObjects(trades, [
    { key: 'id', header: 'Trade ID' },
    { key: 'date', header: 'Date' },
    { key: 'symbol', header: 'Symbol' },
    { key: 'side', header: 'Side' },
    { key: 'quantity', header: 'Quantity', format: 'number', precision: 0 },
    { key: 'entryPrice', header: 'Entry Price', format: 'currency' },
    { key: 'exitPrice', header: 'Exit Price', format: 'currency' },
    { key: 'pnl', header: 'P&L', format: 'currency' },
    { key: 'pnlPct', header: 'Return %', format: 'percent' },
    { key: 'duration', header: 'Duration' },
    { key: 'fees', header: 'Fees', format: 'currency' },
  ], options);
}

export function exportOHLCVCSV(candles: {
  timestamp: number; open: number; high: number; low: number; close: number; volume: number;
}[], options?: CSVOptions): string {
  return generateCSVFromObjects(candles, [
    { key: 'timestamp', header: 'Timestamp', format: 'date' },
    { key: 'open', header: 'Open', format: 'number', precision: 4 },
    { key: 'high', header: 'High', format: 'number', precision: 4 },
    { key: 'low', header: 'Low', format: 'number', precision: 4 },
    { key: 'close', header: 'Close', format: 'number', precision: 4 },
    { key: 'volume', header: 'Volume', format: 'number', precision: 0 },
  ], options);
}

export function exportWatchlistCSV(symbols: {
  symbol: string; name: string; price: number; change: number; changePct: number;
  volume: number; marketCap: number;
}[], options?: CSVOptions): string {
  return generateCSVFromObjects(symbols, [
    { key: 'symbol', header: 'Symbol' },
    { key: 'name', header: 'Name' },
    { key: 'price', header: 'Price', format: 'currency' },
    { key: 'change', header: 'Change', format: 'currency' },
    { key: 'changePct', header: 'Change %', format: 'percent' },
    { key: 'volume', header: 'Volume', format: 'number', precision: 0 },
    { key: 'marketCap', header: 'Market Cap', format: 'number', precision: 0 },
  ], options);
}

// --- CSV Parsing ---

export function parseCSV(csv: string, options?: { delimiter?: string; hasHeaders?: boolean }): {
  headers: string[];
  rows: string[][];
} {
  const delimiter = options?.delimiter ?? ',';
  const hasHeaders = options?.hasHeaders ?? true;
  const lines = splitCSVLines(csv);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parsedRows = lines.map(line => parseCSVLine(line, delimiter));
  if (hasHeaders) {
    const [headers, ...rows] = parsedRows;
    return { headers, rows };
  }
  const colCount = Math.max(...parsedRows.map(r => r.length));
  const headers = Array.from({ length: colCount }, (_, i) => 'Column ' + (i + 1));
  return { headers, rows: parsedRows };
}

function splitCSVLines(csv: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') { inQuotes = !inQuotes; current += ch; }
    else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      if (current.length > 0) lines.push(current);
      current = '';
    } else { current += ch; }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else { current += ch; }
    } else if (ch === '"') { inQuotes = true; }
    else if (ch === delimiter) { fields.push(current); current = ''; }
    else { current += ch; }
  }
  fields.push(current);
  return fields;
}

// --- Helpers ---

function escapeField(value: string, opts: Required<CSVOptions>): string {
  if (opts.quoteAll || value.includes(opts.delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function formatValue(value: unknown, opts: Required<CSVOptions>): string {
  if (value === null || value === undefined) return opts.nullValue;
  if (typeof value === 'number') {
    if (!isFinite(value)) return opts.nullValue;
    return value.toFixed(opts.numberPrecision);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return formatDate(value.getTime(), opts.dateFormat);
  return String(value);
}

function formatDate(value: unknown, format: string): string {
  if (value === null || value === undefined) return '';
  let ts: number;
  if (typeof value === 'number') ts = value;
  else if (typeof value === 'string') ts = new Date(value).getTime();
  else return String(value);
  if (!isFinite(ts)) return '';
  const d = new Date(ts);
  switch (format) {
    case 'us': return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + '/' + d.getFullYear();
    case 'eu': return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    case 'unix': return String(Math.floor(ts / 1000));
    default: return d.toISOString();
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
