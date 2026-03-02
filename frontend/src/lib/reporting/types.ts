// ─── Enums ───────────────────────────────────────────────────────────────────

export enum ExportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  Excel = 'excel',
  HTML = 'html',
  JSON = 'json',
}

export enum ReportFrequency {
  Daily = 'daily',
  Weekly = 'weekly',
  Biweekly = 'biweekly',
  Monthly = 'monthly',
  Quarterly = 'quarterly',
  Annual = 'annual',
  Custom = 'custom',
}

export enum ReportStatus {
  Pending = 'pending',
  Generating = 'generating',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum DeliveryMethod {
  Download = 'download',
  Email = 'email',
  Webhook = 'webhook',
  CloudStorage = 'cloud_storage',
}

export enum SectionType {
  ExecutiveSummary = 'executive_summary',
  Chart = 'chart',
  Table = 'table',
  MetricGrid = 'metric_grid',
  Text = 'text',
  Image = 'image',
  Divider = 'divider',
  PageBreak = 'page_break',
  TableOfContents = 'table_of_contents',
}

export enum ChartType {
  Line = 'line',
  Bar = 'bar',
  Pie = 'pie',
  Area = 'area',
  Scatter = 'scatter',
  Histogram = 'histogram',
  Heatmap = 'heatmap',
  Candlestick = 'candlestick',
  Waterfall = 'waterfall',
}

// ─── Core Configuration ──────────────────────────────────────────────────────

export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  templateId: string;
  format: ExportFormat;
  sections: ReportSection[];
  branding: ReportBranding;
  dateRange: DateRange;
  parameters: Record<string, unknown>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReportBranding {
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  headerText: string;
  footerText: string;
  confidentiality: string;
}

export interface DateRange {
  start: number;
  end: number;
  label: string;
}

// ─── Report Sections ─────────────────────────────────────────────────────────

export interface ReportSection {
  id: string;
  type: SectionType;
  title: string;
  subtitle?: string;
  data: ChartData | TableData | MetricData | TextData | null;
  options: SectionOptions;
}

export interface SectionOptions {
  fullWidth?: boolean;
  pageBreakBefore?: boolean;
  pageBreakAfter?: boolean;
  backgroundColor?: string;
  padding?: number;
  visible?: boolean;
}

export interface ChartData {
  type: ChartType;
  series: ChartSeries[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  width?: number;
  height?: number;
  legend?: boolean;
  colors?: string[];
}

export interface ChartSeries {
  name: string;
  data: { x: number | string; y: number; label?: string }[];
  color?: string;
}

export interface AxisConfig {
  label: string;
  format?: 'number' | 'currency' | 'percent' | 'date';
  min?: number;
  max?: number;
}

export interface TableData {
  headers: TableHeader[];
  rows: TableRow[];
  summary?: TableRow;
  striped?: boolean;
  bordered?: boolean;
  compact?: boolean;
}

export interface TableHeader {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  format?: 'text' | 'number' | 'currency' | 'percent' | 'date';
}

export interface TableRow {
  cells: Record<string, string | number>;
  highlight?: boolean;
  style?: Record<string, string>;
}

export interface MetricData {
  metrics: MetricItem[];
  columns?: number;
}

export interface MetricItem {
  label: string;
  value: string | number;
  change?: number;
  format?: 'text' | 'number' | 'currency' | 'percent';
  icon?: string;
  color?: string;
}

export interface TextData {
  content: string;
  format: 'plain' | 'markdown' | 'html';
}

// ─── Templates ───────────────────────────────────────────────────────────────

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  sections: ReportSection[];
  defaultBranding: ReportBranding;
  defaultFormat: ExportFormat;
  parameters: TemplateParameter[];
  version: number;
}

export interface TemplateParameter {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'select';
  required: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string }[];
}

// ─── Scheduling ──────────────────────────────────────────────────────────────

export interface ScheduleConfig {
  id: string;
  reportConfigId: string;
  frequency: ReportFrequency;
  cronExpression?: string;
  timezone: string;
  nextRunAt: number;
  lastRunAt: number | null;
  isActive: boolean;
  delivery: DeliveryConfig;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
}

export interface DeliveryConfig {
  method: DeliveryMethod;
  recipients: string[];
  subject?: string;
  webhookUrl?: string;
  storagePath?: string;
}

// ─── Generated Report ────────────────────────────────────────────────────────

export interface GeneratedReport {
  id: string;
  configId: string;
  status: ReportStatus;
  format: ExportFormat;
  content: string;
  fileSize: number;
  generatedAt: number;
  duration: number;
  error?: string;
  metadata: Record<string, unknown>;
}

// ─── Excel-Specific Types ────────────────────────────────────────────────────

export interface ExcelWorkbook {
  sheets: ExcelSheet[];
  properties: { title: string; author: string; createdAt: string };
}

export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  rows: ExcelRow[];
  mergedCells?: string[];
  freezePane?: { row: number; col: number };
  conditionalFormats?: ConditionalFormat[];
}

export interface ExcelColumn {
  key: string;
  header: string;
  width?: number;
  format?: string;
  style?: ExcelCellStyle;
}

export interface ExcelRow {
  cells: Record<string, ExcelCell>;
  height?: number;
}

export interface ExcelCell {
  value: string | number | boolean | null;
  formula?: string;
  style?: ExcelCellStyle;
  validation?: DataValidation;
}

export interface ExcelCellStyle {
  font?: { name?: string; size?: number; bold?: boolean; italic?: boolean; color?: string; underline?: boolean };
  fill?: { color: string };
  border?: { top?: string; right?: string; bottom?: string; left?: string };
  alignment?: { horizontal?: 'left' | 'center' | 'right'; vertical?: 'top' | 'middle' | 'bottom'; wrapText?: boolean };
  numberFormat?: string;
}

export interface ConditionalFormat {
  range: string;
  type: 'greaterThan' | 'lessThan' | 'between' | 'equal' | 'colorScale';
  values: (string | number)[];
  style: Partial<ExcelCellStyle>;
}

export interface DataValidation {
  type: 'list' | 'whole' | 'decimal' | 'date';
  values?: string[];
  min?: number;
  max?: number;
  errorMessage?: string;
}
