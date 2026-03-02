import type {
  ScheduleConfig,
  DeliveryConfig,
  GeneratedReport,
} from './types';
import { ReportFrequency, ReportStatus, DeliveryMethod } from './types';

let scheduleCounter = 0;
function genId(prefix: string): string {
  return prefix + '_' + Date.now() + '_' + (++scheduleCounter) + '_' + Math.random().toString(36).slice(2, 8);
}

const schedules = new Map<string, ScheduleConfig>();
const reportQueue: QueuedReport[] = [];
const reportHistory = new Map<string, GeneratedReport[]>();

interface QueuedReport {
  id: string;
  scheduleId: string;
  reportConfigId: string;
  status: ReportStatus;
  scheduledFor: number;
  attempts: number;
  lastAttemptAt: number | null;
  error: string | null;
  result: GeneratedReport | null;
}

interface CronFields {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

function parseCronExpression(expr: string): CronFields {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('Invalid cron expression: ' + expr);
  return {
    minute: parseCronField(parts[0], 0, 59),
    hour: parseCronField(parts[1], 0, 23),
    dayOfMonth: parseCronField(parts[2], 1, 31),
    month: parseCronField(parts[3], 1, 12),
    dayOfWeek: parseCronField(parts[4], 0, 6),
  };
}

function parseCronField(field: string, min: number, max: number): number[] {
  if (field === '*') return rangeArray(min, max);
  const values: number[] = [];
  for (const part of field.split(',')) {
    if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      const [start, end] = range === '*' ? [min, max] : parseRange(range, min, max);
      for (let i = start; i <= end; i += step) values.push(i);
    } else if (part.includes('-')) {
      const [start, end] = parseRange(part, min, max);
      for (let i = start; i <= end; i++) values.push(i);
    } else {
      const val = parseInt(part, 10);
      if (val >= min && val <= max) values.push(val);
    }
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

function parseRange(range: string, min: number, max: number): [number, number] {
  const [a, b] = range.split('-').map(Number);
  return [Math.max(min, a), Math.min(max, b)];
}

function rangeArray(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

export function calculateNextRun(
  frequency: ReportFrequency,
  fromDate: Date = new Date(),
  cronExpression?: string,
): number {
  switch (frequency) {
    case ReportFrequency.Daily: return getNextDaily(fromDate);
    case ReportFrequency.Weekly: return getNextWeekly(fromDate);
    case ReportFrequency.Biweekly: return getNextBiweekly(fromDate);
    case ReportFrequency.Monthly: return getNextMonthly(fromDate);
    case ReportFrequency.Quarterly: return getNextQuarterly(fromDate);
    case ReportFrequency.Annual: return getNextAnnual(fromDate);
    case ReportFrequency.Custom:
      if (cronExpression) return getNextCron(fromDate, cronExpression);
      return getNextDaily(fromDate);
    default: return getNextDaily(fromDate);
  }
}

function getNextDaily(from: Date): number {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  next.setHours(6, 0, 0, 0);
  return next.getTime();
}

function getNextWeekly(from: Date): number {
  const next = new Date(from);
  const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
  next.setDate(next.getDate() + daysUntilMonday);
  next.setHours(6, 0, 0, 0);
  return next.getTime();
}

function getNextBiweekly(from: Date): number {
  const next = new Date(from);
  const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
  next.setDate(next.getDate() + daysUntilMonday + 7);
  next.setHours(6, 0, 0, 0);
  return next.getTime();
}

function getNextMonthly(from: Date): number {
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1, 1);
  next.setHours(6, 0, 0, 0);
  return next.getTime();
}

function getNextQuarterly(from: Date): number {
  const next = new Date(from);
  const currentQ = Math.floor(next.getMonth() / 3);
  next.setMonth((currentQ + 1) * 3, 1);
  next.setHours(6, 0, 0, 0);
  return next.getTime();
}

function getNextAnnual(from: Date): number {
  const next = new Date(from);
  next.setFullYear(next.getFullYear() + 1, 0, 1);
  next.setHours(6, 0, 0, 0);
  return next.getTime();
}

function getNextCron(from: Date, cronExpression: string): number {
  const fields = parseCronExpression(cronExpression);
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);
  for (let attempts = 0; attempts < 525960; attempts++) {
    if (
      fields.month.includes(candidate.getMonth() + 1) &&
      fields.dayOfMonth.includes(candidate.getDate()) &&
      fields.dayOfWeek.includes(candidate.getDay()) &&
      fields.hour.includes(candidate.getHours()) &&
      fields.minute.includes(candidate.getMinutes())
    ) {
      return candidate.getTime();
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return from.getTime() + 86_400_000;
}

export interface CreateScheduleInput {
  reportConfigId: string;
  frequency: ReportFrequency;
  cronExpression?: string;
  timezone?: string;
  delivery: DeliveryConfig;
  maxRetries?: number;
}

export function createSchedule(input: CreateScheduleInput): ScheduleConfig {
  const now = Date.now();
  const nextRun = calculateNextRun(input.frequency, new Date(), input.cronExpression);
  const schedule: ScheduleConfig = {
    id: genId('sched'),
    reportConfigId: input.reportConfigId,
    frequency: input.frequency,
    cronExpression: input.cronExpression,
    timezone: input.timezone ?? 'UTC',
    nextRunAt: nextRun,
    lastRunAt: null,
    isActive: true,
    delivery: input.delivery,
    retryCount: 0,
    maxRetries: input.maxRetries ?? 3,
    createdAt: now,
  };
  schedules.set(schedule.id, schedule);
  return { ...schedule };
}

export function getSchedule(scheduleId: string): ScheduleConfig | null {
  const s = schedules.get(scheduleId);
  return s ? { ...s } : null;
}

export function updateSchedule(
  scheduleId: string,
  updates: Partial<Pick<ScheduleConfig, 'frequency' | 'cronExpression' | 'timezone' | 'isActive' | 'delivery' | 'maxRetries'>>,
): ScheduleConfig {
  const schedule = schedules.get(scheduleId);
  if (!schedule) throw new Error('Schedule not found: ' + scheduleId);
  if (updates.frequency !== undefined) schedule.frequency = updates.frequency;
  if (updates.cronExpression !== undefined) schedule.cronExpression = updates.cronExpression;
  if (updates.timezone !== undefined) schedule.timezone = updates.timezone;
  if (updates.isActive !== undefined) schedule.isActive = updates.isActive;
  if (updates.delivery !== undefined) schedule.delivery = updates.delivery;
  if (updates.maxRetries !== undefined) schedule.maxRetries = updates.maxRetries;
  if (updates.frequency || updates.cronExpression) {
    schedule.nextRunAt = calculateNextRun(schedule.frequency, new Date(), schedule.cronExpression);
  }
  return { ...schedule };
}

export function deleteSchedule(scheduleId: string): void {
  schedules.delete(scheduleId);
}

export function listSchedules(reportConfigId?: string): ScheduleConfig[] {
  let list = Array.from(schedules.values());
  if (reportConfigId) list = list.filter(s => s.reportConfigId === reportConfigId);
  return list.map(s => ({ ...s })).sort((a, b) => a.nextRunAt - b.nextRunAt);
}

export function pauseSchedule(scheduleId: string): void {
  const schedule = schedules.get(scheduleId);
  if (schedule) schedule.isActive = false;
}

export function resumeSchedule(scheduleId: string): void {
  const schedule = schedules.get(scheduleId);
  if (schedule) {
    schedule.isActive = true;
    schedule.nextRunAt = calculateNextRun(schedule.frequency, new Date(), schedule.cronExpression);
    schedule.retryCount = 0;
  }
}

export function enqueueReport(scheduleId: string): string {
  const schedule = schedules.get(scheduleId);
  if (!schedule) throw new Error('Schedule not found: ' + scheduleId);
  const queued: QueuedReport = {
    id: genId('queue'),
    scheduleId,
    reportConfigId: schedule.reportConfigId,
    status: ReportStatus.Pending,
    scheduledFor: schedule.nextRunAt,
    attempts: 0,
    lastAttemptAt: null,
    error: null,
    result: null,
  };
  reportQueue.push(queued);
  return queued.id;
}

export function processQueue(
  generator: (configId: string) => GeneratedReport,
): { processed: number; failed: number } {
  const now = Date.now();
  let processed = 0;
  let failed = 0;
  const pending = reportQueue.filter(q => q.status === ReportStatus.Pending && q.scheduledFor <= now);
  for (const queued of pending) {
    queued.status = ReportStatus.Generating;
    queued.attempts++;
    queued.lastAttemptAt = now;
    try {
      const report = generator(queued.reportConfigId);
      queued.result = report;
      queued.status = ReportStatus.Completed;
      processed++;
      let history = reportHistory.get(queued.reportConfigId);
      if (!history) { history = []; reportHistory.set(queued.reportConfigId, history); }
      history.push(report);
      const schedule = schedules.get(queued.scheduleId);
      if (schedule) {
        schedule.lastRunAt = now;
        schedule.retryCount = 0;
        schedule.nextRunAt = calculateNextRun(schedule.frequency, new Date(), schedule.cronExpression);
      }
    } catch (err) {
      queued.error = err instanceof Error ? err.message : 'Unknown error';
      const schedule = schedules.get(queued.scheduleId);
      if (schedule && queued.attempts < schedule.maxRetries) {
        queued.status = ReportStatus.Pending;
        queued.scheduledFor = now + Math.min(3_600_000, 60_000 * Math.pow(2, queued.attempts));
        schedule.retryCount = queued.attempts;
      } else {
        queued.status = ReportStatus.Failed;
        failed++;
      }
    }
  }
  return { processed, failed };
}

export function getQueueStatus(): { pending: number; generating: number; completed: number; failed: number; total: number } {
  return {
    pending: reportQueue.filter(q => q.status === ReportStatus.Pending).length,
    generating: reportQueue.filter(q => q.status === ReportStatus.Generating).length,
    completed: reportQueue.filter(q => q.status === ReportStatus.Completed).length,
    failed: reportQueue.filter(q => q.status === ReportStatus.Failed).length,
    total: reportQueue.length,
  };
}

export function getQueuedReports(scheduleId?: string): QueuedReport[] {
  let list = [...reportQueue];
  if (scheduleId) list = list.filter(q => q.scheduleId === scheduleId);
  return list.sort((a, b) => b.scheduledFor - a.scheduledFor);
}

export function cancelQueuedReport(queueId: string): boolean {
  const idx = reportQueue.findIndex(q => q.id === queueId);
  if (idx === -1) return false;
  if (reportQueue[idx].status === ReportStatus.Pending) {
    reportQueue[idx].status = ReportStatus.Cancelled;
    return true;
  }
  return false;
}

export function getReportHistory(configId: string, limit = 20): GeneratedReport[] {
  const history = reportHistory.get(configId) ?? [];
  return history.slice(-limit).reverse();
}

export function getUpcomingRuns(limit = 10): { scheduleId: string; reportConfigId: string; nextRunAt: number; frequency: string }[] {
  return Array.from(schedules.values())
    .filter(s => s.isActive)
    .sort((a, b) => a.nextRunAt - b.nextRunAt)
    .slice(0, limit)
    .map(s => ({ scheduleId: s.id, reportConfigId: s.reportConfigId, nextRunAt: s.nextRunAt, frequency: s.frequency }));
}

export function clearSchedulerStore(): void {
  schedules.clear();
  reportQueue.length = 0;
  reportHistory.clear();
  scheduleCounter = 0;
}
