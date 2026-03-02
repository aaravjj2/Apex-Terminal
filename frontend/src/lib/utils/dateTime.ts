// ============================================================================
// Types
// ============================================================================

export interface MarketSession {
  name: 'pre-market' | 'regular' | 'after-hours' | 'closed';
  start: string; // HH:MM
  end: string;
  timezone: string;
}

export type DayCountConvention = '30/360' | 'ACT/365' | 'ACT/ACT' | 'ACT/360';

export type HolidayCalendar = 'US' | 'UK' | 'EU' | 'JP' | 'HK';

export interface SettlementRule {
  days: number;
  businessDays: boolean;
  calendar: HolidayCalendar;
}

// ============================================================================
// Holiday Calendars
// ============================================================================

const FIXED_HOLIDAYS: Record<HolidayCalendar, Array<{ month: number; day: number }>> = {
  US: [
    { month: 1, day: 1 },   // New Year's Day
    { month: 7, day: 4 },   // Independence Day
    { month: 12, day: 25 }, // Christmas
  ],
  UK: [
    { month: 1, day: 1 },
    { month: 12, day: 25 },
    { month: 12, day: 26 },
  ],
  EU: [
    { month: 1, day: 1 },
    { month: 5, day: 1 },
    { month: 12, day: 25 },
    { month: 12, day: 26 },
  ],
  JP: [
    { month: 1, day: 1 },
    { month: 1, day: 2 },
    { month: 1, day: 3 },
    { month: 2, day: 11 },  // National Foundation Day
    { month: 2, day: 23 },  // Emperor's Birthday
    { month: 4, day: 29 },  // Showa Day
    { month: 5, day: 3 },   // Constitution Memorial Day
    { month: 5, day: 4 },   // Greenery Day
    { month: 5, day: 5 },   // Children's Day
    { month: 11, day: 3 },  // Culture Day
    { month: 11, day: 23 }, // Labor Thanksgiving Day
  ],
  HK: [
    { month: 1, day: 1 },
    { month: 7, day: 1 },   // HKSAR Establishment Day
    { month: 10, day: 1 },  // National Day
    { month: 12, day: 25 },
    { month: 12, day: 26 },
  ],
};

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month - 1, 1);
  let dayOfWeek = first.getDay();
  let day = 1 + ((weekday - dayOfWeek + 7) % 7);
  day += (n - 1) * 7;
  return new Date(year, month - 1, day);
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month, 0);
  const diff = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month - 1, last.getDate() - diff);
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getFloatingHolidays(year: number, calendar: HolidayCalendar): Date[] {
  const holidays: Date[] = [];

  if (calendar === 'US') {
    holidays.push(nthWeekday(year, 1, 1, 3));  // MLK Day (3rd Monday Jan)
    holidays.push(nthWeekday(year, 2, 1, 3));  // Presidents' Day (3rd Monday Feb)
    holidays.push(lastWeekday(year, 5, 1));     // Memorial Day (last Monday May)
    holidays.push(nthWeekday(year, 9, 1, 1));   // Labor Day (1st Monday Sep)
    holidays.push(nthWeekday(year, 11, 4, 4));  // Thanksgiving (4th Thursday Nov)
  }

  if (calendar === 'UK') {
    const easter = easterSunday(year);
    holidays.push(new Date(easter.getTime() - 2 * 86400000)); // Good Friday
    holidays.push(new Date(easter.getTime() + 1 * 86400000)); // Easter Monday
    holidays.push(nthWeekday(year, 5, 1, 1));   // Early May
    holidays.push(lastWeekday(year, 5, 1));      // Spring Bank
    holidays.push(lastWeekday(year, 8, 1));      // Summer Bank
  }

  if (calendar === 'EU') {
    const easter = easterSunday(year);
    holidays.push(new Date(easter.getTime() - 2 * 86400000)); // Good Friday
    holidays.push(new Date(easter.getTime() + 1 * 86400000)); // Easter Monday
  }

  return holidays;
}

export function getHolidays(year: number, calendar: HolidayCalendar): Date[] {
  const fixed = FIXED_HOLIDAYS[calendar].map(h => new Date(year, h.month - 1, h.day));
  const floating = getFloatingHolidays(year, calendar);
  return [...fixed, ...floating];
}

export function isHoliday(date: Date, calendar: HolidayCalendar): boolean {
  const holidays = getHolidays(date.getFullYear(), calendar);
  const ts = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return holidays.some(h => new Date(h.getFullYear(), h.getMonth(), h.getDate()).getTime() === ts);
}

// ============================================================================
// Business Day Calculations
// ============================================================================

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isBusinessDay(date: Date, calendar: HolidayCalendar = 'US'): boolean {
  return !isWeekend(date) && !isHoliday(date, calendar);
}

export function addBusinessDays(date: Date, days: number, calendar: HolidayCalendar = 'US'): Date {
  const result = new Date(date);
  const direction = days >= 0 ? 1 : -1;
  let remaining = Math.abs(days);

  while (remaining > 0) {
    result.setDate(result.getDate() + direction);
    if (isBusinessDay(result, calendar)) remaining--;
  }
  return result;
}

export function businessDaysBetween(start: Date, end: Date, calendar: HolidayCalendar = 'US'): number {
  let count = 0;
  const current = new Date(start);
  const direction = end >= start ? 1 : -1;

  while (
    (direction === 1 && current < end) ||
    (direction === -1 && current > end)
  ) {
    current.setDate(current.getDate() + direction);
    if (isBusinessDay(current, calendar)) count++;
  }
  return count * direction;
}

export function nextBusinessDay(date: Date, calendar: HolidayCalendar = 'US'): Date {
  return addBusinessDays(date, 1, calendar);
}

export function previousBusinessDay(date: Date, calendar: HolidayCalendar = 'US'): Date {
  return addBusinessDays(date, -1, calendar);
}

export function businessDayRange(start: Date, end: Date, calendar: HolidayCalendar = 'US'): Date[] {
  const result: Date[] = [];
  const current = new Date(start);
  if (isBusinessDay(current, calendar)) result.push(new Date(current));

  while (current < end) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current, calendar)) result.push(new Date(current));
  }
  return result;
}

// ============================================================================
// Market Sessions
// ============================================================================

const MARKET_SESSIONS: Record<string, MarketSession[]> = {
  NYSE: [
    { name: 'pre-market', start: '04:00', end: '09:30', timezone: 'America/New_York' },
    { name: 'regular', start: '09:30', end: '16:00', timezone: 'America/New_York' },
    { name: 'after-hours', start: '16:00', end: '20:00', timezone: 'America/New_York' },
  ],
  NASDAQ: [
    { name: 'pre-market', start: '04:00', end: '09:30', timezone: 'America/New_York' },
    { name: 'regular', start: '09:30', end: '16:00', timezone: 'America/New_York' },
    { name: 'after-hours', start: '16:00', end: '20:00', timezone: 'America/New_York' },
  ],
  LSE: [
    { name: 'regular', start: '08:00', end: '16:30', timezone: 'Europe/London' },
  ],
  TSE: [
    { name: 'regular', start: '09:00', end: '11:30', timezone: 'Asia/Tokyo' },
    { name: 'regular', start: '12:30', end: '15:00', timezone: 'Asia/Tokyo' },
  ],
  HKEX: [
    { name: 'regular', start: '09:30', end: '12:00', timezone: 'Asia/Hong_Kong' },
    { name: 'regular', start: '13:00', end: '16:00', timezone: 'Asia/Hong_Kong' },
  ],
};

export function getMarketSession(exchange: string, date: Date): MarketSession | null {
  const sessions = MARKET_SESSIONS[exchange];
  if (!sessions) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: sessions[0].timezone,
  });
  const timeStr = formatter.format(date);

  for (const session of sessions) {
    if (timeStr >= session.start && timeStr < session.end) return session;
  }
  return null;
}

export function isMarketOpen(exchange: string, date: Date = new Date()): boolean {
  const session = getMarketSession(exchange, date);
  return session?.name === 'regular';
}

export function timeToMarketOpen(exchange: string, now: Date = new Date()): number | null {
  const sessions = MARKET_SESSIONS[exchange];
  if (!sessions) return null;

  const regularSession = sessions.find(s => s.name === 'regular');
  if (!regularSession) return null;

  const [hours, minutes] = regularSession.start.split(':').map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  while (!isBusinessDay(target, 'US')) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

export function timeToMarketClose(exchange: string, now: Date = new Date()): number | null {
  const sessions = MARKET_SESSIONS[exchange];
  if (!sessions) return null;

  const regularSessions = sessions.filter(s => s.name === 'regular');
  const lastSession = regularSessions[regularSessions.length - 1];
  if (!lastSession) return null;

  const [hours, minutes] = lastSession.end.split(':').map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);

  if (target <= now) return 0;
  return target.getTime() - now.getTime();
}

// ============================================================================
// Day Count Fractions
// ============================================================================

export function dayCountFraction(start: Date, end: Date, convention: DayCountConvention): number {
  const msPerDay = 86400000;

  switch (convention) {
    case '30/360': {
      let d1 = Math.min(start.getDate(), 30);
      let d2 = end.getDate();
      if (d1 === 30) d2 = Math.min(d2, 30);
      const m1 = start.getMonth() + 1, m2 = end.getMonth() + 1;
      const y1 = start.getFullYear(), y2 = end.getFullYear();
      return (360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1)) / 360;
    }
    case 'ACT/365': {
      const days = (end.getTime() - start.getTime()) / msPerDay;
      return days / 365;
    }
    case 'ACT/360': {
      const days = (end.getTime() - start.getTime()) / msPerDay;
      return days / 360;
    }
    case 'ACT/ACT': {
      const days = (end.getTime() - start.getTime()) / msPerDay;
      const y1 = start.getFullYear(), y2 = end.getFullYear();
      if (y1 === y2) {
        const yearDays = isLeapYear(y1) ? 366 : 365;
        return days / yearDays;
      }
      let frac = 0;
      const endOfY1 = new Date(y1 + 1, 0, 1);
      const startOfY2 = new Date(y2, 0, 1);
      frac += (endOfY1.getTime() - start.getTime()) / msPerDay / (isLeapYear(y1) ? 366 : 365);
      frac += (end.getTime() - startOfY2.getTime()) / msPerDay / (isLeapYear(y2) ? 366 : 365);
      frac += y2 - y1 - 1;
      return frac;
    }
  }
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// ============================================================================
// Financial Date Calculations
// ============================================================================

export function formatFinancialDate(date: Date, format: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return format
    .replace('YYYY', y.toString())
    .replace('YY', (y % 100).toString().padStart(2, '0'))
    .replace('MMM', months[m - 1])
    .replace('MM', pad(m))
    .replace('DD', pad(d))
    .replace('HH', pad(date.getHours()))
    .replace('mm', pad(date.getMinutes()))
    .replace('ss', pad(date.getSeconds()));
}

export function optionExpiryDate(year: number, month: number): Date {
  // Standard US equity options: 3rd Friday of the expiration month
  const thirdFriday = nthWeekday(year, month, 5, 3);
  if (!isBusinessDay(thirdFriday, 'US')) return previousBusinessDay(thirdFriday, 'US');
  return thirdFriday;
}

export function settlementDate(tradeDate: Date, rule: SettlementRule): Date {
  if (rule.businessDays) {
    return addBusinessDays(tradeDate, rule.days, rule.calendar);
  }
  const result = new Date(tradeDate);
  result.setDate(result.getDate() + rule.days);
  return result;
}

export const SETTLEMENT_RULES: Record<string, SettlementRule> = {
  US_EQUITY: { days: 1, businessDays: true, calendar: 'US' },
  US_BOND: { days: 1, businessDays: true, calendar: 'US' },
  US_OPTION: { days: 1, businessDays: true, calendar: 'US' },
  FX_SPOT: { days: 2, businessDays: true, calendar: 'US' },
  UK_EQUITY: { days: 2, businessDays: true, calendar: 'UK' },
  JP_EQUITY: { days: 2, businessDays: true, calendar: 'JP' },
};

export function quarterEndDate(year: number, quarter: number): Date {
  const month = quarter * 3;
  return new Date(year, month, 0);
}

export function yearEndDate(year: number): Date {
  return new Date(year, 11, 31);
}

export function immDates(year: number): Date[] {
  // IMM dates: 3rd Wednesday of March, June, September, December
  return [3, 6, 9, 12].map(month => nthWeekday(year, month, 3, 3));
}

export function nextIMMDate(from: Date = new Date()): Date {
  const year = from.getFullYear();
  const dates = [...immDates(year), ...immDates(year + 1)];
  return dates.find(d => d > from) ?? dates[0];
}

export function futuresRollDate(
  year: number,
  month: number,
  rollDaysBefore = 5,
  calendar: HolidayCalendar = 'US'
): Date {
  const lastDay = lastTradingDay(year, month, calendar);
  return addBusinessDays(lastDay, -rollDaysBefore, calendar);
}

export function lastTradingDay(
  year: number,
  month: number,
  calendar: HolidayCalendar = 'US'
): Date {
  const lastDayOfMonth = new Date(year, month, 0);
  let current = new Date(lastDayOfMonth);
  while (!isBusinessDay(current, calendar)) {
    current.setDate(current.getDate() - 1);
  }
  return current;
}

// ============================================================================
// Timezone Utilities
// ============================================================================

export function convertTimezone(date: Date, fromTZ: string, toTZ: string): Date {
  const str = date.toLocaleString('en-US', { timeZone: toTZ });
  return new Date(str);
}

export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

export const MARKET_TIMEZONES: Record<string, string> = {
  NYSE: 'America/New_York',
  NASDAQ: 'America/New_York',
  CME: 'America/Chicago',
  LSE: 'Europe/London',
  EURONEXT: 'Europe/Paris',
  TSE: 'Asia/Tokyo',
  HKEX: 'Asia/Hong_Kong',
  SSE: 'Asia/Shanghai',
  BSE: 'Asia/Kolkata',
  ASX: 'Australia/Sydney',
};

// ============================================================================
// Duration & Elapsed
// ============================================================================

export function timeUntil(target: Date, from: Date = new Date()): {
  days: number; hours: number; minutes: number; seconds: number; totalMs: number;
} {
  const totalMs = target.getTime() - from.getTime();
  const totalSec = Math.abs(totalMs) / 1000;
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: Math.floor(totalSec % 60),
    totalMs,
  };
}

export function tradingDaysInYear(year: number, calendar: HolidayCalendar = 'US'): number {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  return businessDayRange(start, end, calendar).length;
}

export function isTradingDay(date: Date, exchange: string = 'NYSE'): boolean {
  const calendarMap: Record<string, HolidayCalendar> = {
    NYSE: 'US', NASDAQ: 'US', CME: 'US',
    LSE: 'UK', TSE: 'JP', HKEX: 'HK',
  };
  return isBusinessDay(date, calendarMap[exchange] ?? 'US');
}

export function dateRangePresets(): Record<string, { start: Date; end: Date }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return {
    '1D': { start: new Date(today.getTime() - 86400000), end: today },
    '1W': { start: new Date(today.getTime() - 7 * 86400000), end: today },
    '1M': { start: new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()), end: today },
    '3M': { start: new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()), end: today },
    '6M': { start: new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()), end: today },
    YTD: { start: new Date(today.getFullYear(), 0, 1), end: today },
    '1Y': { start: new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()), end: today },
    '3Y': { start: new Date(today.getFullYear() - 3, today.getMonth(), today.getDate()), end: today },
    '5Y': { start: new Date(today.getFullYear() - 5, today.getMonth(), today.getDate()), end: today },
    MAX: { start: new Date(1970, 0, 1), end: today },
  };
}
