import { type EconomicEvent } from './types';

// ─── Enums & Types ──────────────────────────────────────────────────────────

export enum EconomicCategory {
  GDP = 'GDP',
  INFLATION = 'INFLATION',
  EMPLOYMENT = 'EMPLOYMENT',
  MANUFACTURING = 'MANUFACTURING',
  HOUSING = 'HOUSING',
  CONSUMER = 'CONSUMER',
  TRADE = 'TRADE',
  CENTRAL_BANK = 'CENTRAL_BANK',
  GOVERNMENT = 'GOVERNMENT',
  CONFIDENCE = 'CONFIDENCE',
  LEADING = 'LEADING',
}

export enum IndicatorType {
  GDP = 'GDP',
  GDP_GROWTH = 'GDP_GROWTH',
  CPI = 'CPI',
  CORE_CPI = 'CORE_CPI',
  PPI = 'PPI',
  PCE = 'PCE',
  NFP = 'NFP',
  UNEMPLOYMENT_RATE = 'UNEMPLOYMENT_RATE',
  INITIAL_CLAIMS = 'INITIAL_CLAIMS',
  ADP_EMPLOYMENT = 'ADP_EMPLOYMENT',
  PMI_MANUFACTURING = 'PMI_MANUFACTURING',
  PMI_SERVICES = 'PMI_SERVICES',
  ISM_MANUFACTURING = 'ISM_MANUFACTURING',
  ISM_SERVICES = 'ISM_SERVICES',
  RETAIL_SALES = 'RETAIL_SALES',
  CONSUMER_CONFIDENCE = 'CONSUMER_CONFIDENCE',
  MICHIGAN_SENTIMENT = 'MICHIGAN_SENTIMENT',
  HOUSING_STARTS = 'HOUSING_STARTS',
  EXISTING_HOME_SALES = 'EXISTING_HOME_SALES',
  NEW_HOME_SALES = 'NEW_HOME_SALES',
  BUILDING_PERMITS = 'BUILDING_PERMITS',
  TRADE_BALANCE = 'TRADE_BALANCE',
  INDUSTRIAL_PRODUCTION = 'INDUSTRIAL_PRODUCTION',
  DURABLE_GOODS = 'DURABLE_GOODS',
  FED_FUNDS_RATE = 'FED_FUNDS_RATE',
  ECB_RATE = 'ECB_RATE',
  BOE_RATE = 'BOE_RATE',
  BOJ_RATE = 'BOJ_RATE',
  FOMC_MINUTES = 'FOMC_MINUTES',
  BEIGE_BOOK = 'BEIGE_BOOK',
}

export interface EconomicDataPoint {
  date: string;
  value: number;
  revised?: number;
  consensus?: number;
  previous?: number;
}

export interface EconomicIndicatorSeries {
  indicator: IndicatorType;
  country: string;
  unit: string;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'WEEKLY' | 'DAILY' | 'ANNUAL';
  seasonallyAdjusted: boolean;
  data: EconomicDataPoint[];
  source: string;
}

export interface CentralBankMeeting {
  bank: string;
  date: string;
  rateDecision?: number;
  previousRate: number;
  expectedRate?: number;
  statement?: string;
  presser: boolean;
  dotPlot?: boolean;
  minutes?: string;
}

export interface CalendarViewEvent extends EconomicEvent {
  surprise?: number;
  surprisePct?: number;
  indicatorType?: IndicatorType;
  frequency?: string;
}

export interface CalendarViewDay {
  date: string;
  events: CalendarViewEvent[];
  highImpactCount: number;
  mediumImpactCount: number;
  lowImpactCount: number;
}

// ─── Surprise Calculation ───────────────────────────────────────────────────

export function computeSurprise(actual: number | undefined, consensus: number | undefined): { surprise: number; surprisePct: number } | null {
  if (actual === undefined || consensus === undefined) return null;
  const surprise = actual - consensus;
  const surprisePct = consensus !== 0 ? (surprise / Math.abs(consensus)) * 100 : 0;
  return { surprise, surprisePct };
}

// ─── Economic Calendar ──────────────────────────────────────────────────────

export class EconomicCalendar {
  private events: CalendarViewEvent[] = [];
  private series = new Map<string, EconomicIndicatorSeries>();
  private centralBankMeetings: CentralBankMeeting[] = [];
  private countdownListeners: Array<{ eventId: string; callback: (ms: number) => void; timer?: ReturnType<typeof setInterval> }> = [];

  addEvents(events: EconomicEvent[]): void {
    for (const e of events) {
      const surp = computeSurprise(e.actual, e.consensus);
      const viewEvent: CalendarViewEvent = {
        ...e,
        surprise: surp?.surprise,
        surprisePct: surp?.surprisePct,
      };
      const idx = this.events.findIndex(x => x.id === e.id);
      if (idx >= 0) {
        this.events[idx] = viewEvent;
      } else {
        this.events.push(viewEvent);
      }
    }
    this.events.sort((a, b) => a.timestamp - b.timestamp);
  }

  addSeries(series: EconomicIndicatorSeries): void {
    this.series.set(`${series.indicator}:${series.country}`, series);
  }

  addCentralBankMeeting(meeting: CentralBankMeeting): void {
    this.centralBankMeetings.push(meeting);
    this.centralBankMeetings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // ── Queries ──

  getEvents(from: number, to: number): CalendarViewEvent[] {
    return this.events.filter(e => e.timestamp >= from && e.timestamp <= to);
  }

  getByCountry(country: string, from?: number, to?: number): CalendarViewEvent[] {
    return this.events.filter(e =>
      e.country === country &&
      (from === undefined || e.timestamp >= from) &&
      (to === undefined || e.timestamp <= to),
    );
  }

  getByCategory(category: string, from?: number, to?: number): CalendarViewEvent[] {
    return this.events.filter(e =>
      e.category === category &&
      (from === undefined || e.timestamp >= from) &&
      (to === undefined || e.timestamp <= to),
    );
  }

  getByImpact(impact: 'HIGH' | 'MEDIUM' | 'LOW', from?: number, to?: number): CalendarViewEvent[] {
    return this.events.filter(e =>
      e.impact === impact &&
      (from === undefined || e.timestamp >= from) &&
      (to === undefined || e.timestamp <= to),
    );
  }

  getHighImpact(from?: number, to?: number): CalendarViewEvent[] {
    return this.getByImpact('HIGH', from, to);
  }

  getUpcoming(count = 20): CalendarViewEvent[] {
    const now = Date.now();
    return this.events.filter(e => e.timestamp > now).slice(0, count);
  }

  getNext(country?: string): CalendarViewEvent | null {
    const now = Date.now();
    return this.events.find(e => e.timestamp > now && (!country || e.country === country)) ?? null;
  }

  // ── Calendar Views ──

  getDayView(date: string): CalendarViewDay {
    const dayStart = new Date(date).setHours(0, 0, 0, 0);
    const dayEnd = dayStart + 86_400_000;
    const events = this.getEvents(dayStart, dayEnd);
    return {
      date,
      events,
      highImpactCount: events.filter(e => e.impact === 'HIGH').length,
      mediumImpactCount: events.filter(e => e.impact === 'MEDIUM').length,
      lowImpactCount: events.filter(e => e.impact === 'LOW').length,
    };
  }

  getWeekView(startDate: string): CalendarViewDay[] {
    const days: CalendarViewDay[] = [];
    const start = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(this.getDayView(d.toISOString().slice(0, 10)));
    }
    return days;
  }

  getMonthView(year: number, month: number): CalendarViewDay[] {
    const days: CalendarViewDay[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push(this.getDayView(dateStr));
    }
    return days;
  }

  // ── Countdown / Reminder ──

  startCountdown(eventId: string, callback: (msRemaining: number) => void): () => void {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return () => {};

    const entry = { eventId, callback, timer: undefined as ReturnType<typeof setInterval> | undefined };

    entry.timer = setInterval(() => {
      const remaining = event.timestamp - Date.now();
      if (remaining <= 0) {
        callback(0);
        if (entry.timer) clearInterval(entry.timer);
        const idx = this.countdownListeners.indexOf(entry);
        if (idx >= 0) this.countdownListeners.splice(idx, 1);
      } else {
        callback(remaining);
      }
    }, 1_000);

    this.countdownListeners.push(entry);
    return () => {
      if (entry.timer) clearInterval(entry.timer);
      const idx = this.countdownListeners.indexOf(entry);
      if (idx >= 0) this.countdownListeners.splice(idx, 1);
    };
  }

  // ── Central Bank Tracker ──

  getCentralBankMeetings(bank?: string): CentralBankMeeting[] {
    if (!bank) return [...this.centralBankMeetings];
    return this.centralBankMeetings.filter(m => m.bank === bank);
  }

  getNextCentralBankMeeting(bank?: string): CentralBankMeeting | null {
    const now = new Date().toISOString().slice(0, 10);
    return this.centralBankMeetings.find(
      m => m.date >= now && (!bank || m.bank === bank),
    ) ?? null;
  }

  getRateHistory(bank: string): Array<{ date: string; rate: number }> {
    return this.centralBankMeetings
      .filter(m => m.bank === bank && m.rateDecision !== undefined)
      .map(m => ({ date: m.date, rate: m.rateDecision! }));
  }

  // ── Indicator Time Series ──

  getSeries(indicator: IndicatorType, country: string): EconomicIndicatorSeries | undefined {
    return this.series.get(`${indicator}:${country}`);
  }

  getSeriesData(indicator: IndicatorType, country: string, from?: string, to?: string): EconomicDataPoint[] {
    const s = this.getSeries(indicator, country);
    if (!s) return [];
    return s.data.filter(d => (!from || d.date >= from) && (!to || d.date <= to));
  }

  getLatestValue(indicator: IndicatorType, country: string): EconomicDataPoint | null {
    const s = this.getSeries(indicator, country);
    if (!s || s.data.length === 0) return null;
    return s.data[s.data.length - 1];
  }

  // ── Cross-Country Comparison ──

  compareCountries(indicator: IndicatorType, countries: string[]): Map<string, EconomicDataPoint | null> {
    const result = new Map<string, EconomicDataPoint | null>();
    for (const country of countries) {
      result.set(country, this.getLatestValue(indicator, country));
    }
    return result;
  }

  compareIndicatorTrends(indicator: IndicatorType, countries: string[], periods = 4): Map<string, number[]> {
    const result = new Map<string, number[]>();
    for (const country of countries) {
      const s = this.getSeries(indicator, country);
      if (!s) { result.set(country, []); continue; }
      result.set(country, s.data.slice(-periods).map(d => d.value));
    }
    return result;
  }

  // ── Economic Surprise Index ──

  computeSurpriseIndex(country: string, windowDays = 90): number {
    const now = Date.now();
    const from = now - windowDays * 86_400_000;
    const events = this.getByCountry(country, from, now).filter(
      e => e.actual !== undefined && e.consensus !== undefined,
    );

    if (events.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const event of events) {
      const surp = computeSurprise(event.actual, event.consensus);
      if (!surp) continue;

      const impactWeight = event.impact === 'HIGH' ? 3 : event.impact === 'MEDIUM' ? 2 : 1;
      const recency = 1 - (now - event.timestamp) / (windowDays * 86_400_000);
      const weight = impactWeight * Math.max(recency, 0.1);

      weightedSum += surp.surprisePct * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  computeSurpriseIndexHistory(country: string, dates: string[], windowDays = 90): Array<{ date: string; value: number }> {
    return dates.map(date => {
      const ts = new Date(date).getTime();
      const from = ts - windowDays * 86_400_000;
      const events = this.events.filter(
        e => e.country === country && e.timestamp >= from && e.timestamp <= ts &&
          e.actual !== undefined && e.consensus !== undefined,
      );

      let weightedSum = 0, totalWeight = 0;
      for (const event of events) {
        const surp = computeSurprise(event.actual, event.consensus);
        if (!surp) continue;
        const impactWeight = event.impact === 'HIGH' ? 3 : event.impact === 'MEDIUM' ? 2 : 1;
        const recency = 1 - (ts - event.timestamp) / (windowDays * 86_400_000);
        const weight = impactWeight * Math.max(recency, 0.1);
        weightedSum += surp.surprisePct * weight;
        totalWeight += weight;
      }

      return { date, value: totalWeight > 0 ? weightedSum / totalWeight : 0 };
    });
  }

  // ── Leading / Lagging Identification ──

  classifyIndicator(indicator: IndicatorType): 'LEADING' | 'LAGGING' | 'COINCIDENT' {
    const leading: IndicatorType[] = [
      IndicatorType.PMI_MANUFACTURING,
      IndicatorType.PMI_SERVICES,
      IndicatorType.ISM_MANUFACTURING,
      IndicatorType.ISM_SERVICES,
      IndicatorType.BUILDING_PERMITS,
      IndicatorType.CONSUMER_CONFIDENCE,
      IndicatorType.MICHIGAN_SENTIMENT,
      IndicatorType.INITIAL_CLAIMS,
      IndicatorType.HOUSING_STARTS,
      IndicatorType.DURABLE_GOODS,
    ];
    const lagging: IndicatorType[] = [
      IndicatorType.UNEMPLOYMENT_RATE,
      IndicatorType.CPI,
      IndicatorType.CORE_CPI,
      IndicatorType.PPI,
      IndicatorType.TRADE_BALANCE,
    ];

    if (leading.includes(indicator)) return 'LEADING';
    if (lagging.includes(indicator)) return 'LAGGING';
    return 'COINCIDENT';
  }

  getLeadingIndicators(country: string): Array<{ indicator: IndicatorType; latest: EconomicDataPoint | null; trend: 'IMPROVING' | 'DETERIORATING' | 'STABLE' }> {
    const leadingTypes: IndicatorType[] = [
      IndicatorType.PMI_MANUFACTURING,
      IndicatorType.PMI_SERVICES,
      IndicatorType.BUILDING_PERMITS,
      IndicatorType.CONSUMER_CONFIDENCE,
      IndicatorType.INITIAL_CLAIMS,
    ];

    return leadingTypes.map(indicator => {
      const latest = this.getLatestValue(indicator, country);
      const data = this.getSeriesData(indicator, country).slice(-3);
      const trend = computeTrend(data, indicator === IndicatorType.INITIAL_CLAIMS);
      return { indicator, latest, trend };
    });
  }

  getLaggingIndicators(country: string): Array<{ indicator: IndicatorType; latest: EconomicDataPoint | null; trend: 'IMPROVING' | 'DETERIORATING' | 'STABLE' }> {
    const laggingTypes: IndicatorType[] = [
      IndicatorType.UNEMPLOYMENT_RATE,
      IndicatorType.CPI,
      IndicatorType.CORE_CPI,
    ];

    return laggingTypes.map(indicator => {
      const latest = this.getLatestValue(indicator, country);
      const data = this.getSeriesData(indicator, country).slice(-3);
      const isInverse = indicator === IndicatorType.UNEMPLOYMENT_RATE;
      const trend = computeTrend(data, isInverse);
      return { indicator, latest, trend };
    });
  }

  // ── Cleanup ──

  destroyTimers(): void {
    for (const entry of this.countdownListeners) {
      if (entry.timer) clearInterval(entry.timer);
    }
    this.countdownListeners = [];
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeTrend(
  data: EconomicDataPoint[],
  inverse = false,
): 'IMPROVING' | 'DETERIORATING' | 'STABLE' {
  if (data.length < 2) return 'STABLE';
  const recent = data[data.length - 1].value;
  const prev = data[data.length - 2].value;
  const diff = recent - prev;
  const threshold = Math.abs(prev) * 0.01;

  if (Math.abs(diff) < threshold) return 'STABLE';
  const improving = inverse ? diff < 0 : diff > 0;
  return improving ? 'IMPROVING' : 'DETERIORATING';
}

// ─── Well-known Event Templates ─────────────────────────────────────────────

export const EVENT_TEMPLATES: Record<string, Partial<EconomicEvent>> = {
  US_NFP: { name: 'Non-Farm Payrolls', country: 'US', category: EconomicCategory.EMPLOYMENT, impact: 'HIGH', unit: 'K' },
  US_CPI: { name: 'Consumer Price Index', country: 'US', category: EconomicCategory.INFLATION, impact: 'HIGH', unit: '%' },
  US_CORE_CPI: { name: 'Core CPI', country: 'US', category: EconomicCategory.INFLATION, impact: 'HIGH', unit: '%' },
  US_GDP: { name: 'GDP Growth Rate', country: 'US', category: EconomicCategory.GDP, impact: 'HIGH', unit: '%' },
  US_FED_RATE: { name: 'Fed Funds Rate Decision', country: 'US', category: EconomicCategory.CENTRAL_BANK, impact: 'HIGH', unit: '%' },
  US_UNEMPLOYMENT: { name: 'Unemployment Rate', country: 'US', category: EconomicCategory.EMPLOYMENT, impact: 'HIGH', unit: '%' },
  US_RETAIL_SALES: { name: 'Retail Sales MoM', country: 'US', category: EconomicCategory.CONSUMER, impact: 'HIGH', unit: '%' },
  US_PMI_MFG: { name: 'ISM Manufacturing PMI', country: 'US', category: EconomicCategory.MANUFACTURING, impact: 'HIGH', unit: '' },
  US_PMI_SVC: { name: 'ISM Services PMI', country: 'US', category: EconomicCategory.MANUFACTURING, impact: 'HIGH', unit: '' },
  US_INITIAL_CLAIMS: { name: 'Initial Jobless Claims', country: 'US', category: EconomicCategory.EMPLOYMENT, impact: 'MEDIUM', unit: 'K' },
  US_CONSUMER_CONFIDENCE: { name: 'Consumer Confidence', country: 'US', category: EconomicCategory.CONFIDENCE, impact: 'MEDIUM', unit: '' },
  US_MICHIGAN_SENTIMENT: { name: 'Michigan Consumer Sentiment', country: 'US', category: EconomicCategory.CONFIDENCE, impact: 'MEDIUM', unit: '' },
  US_HOUSING_STARTS: { name: 'Housing Starts', country: 'US', category: EconomicCategory.HOUSING, impact: 'MEDIUM', unit: 'K' },
  US_DURABLE_GOODS: { name: 'Durable Goods Orders', country: 'US', category: EconomicCategory.MANUFACTURING, impact: 'MEDIUM', unit: '%' },
  US_TRADE_BALANCE: { name: 'Trade Balance', country: 'US', category: EconomicCategory.TRADE, impact: 'MEDIUM', unit: 'B' },
  US_PPI: { name: 'Producer Price Index', country: 'US', category: EconomicCategory.INFLATION, impact: 'MEDIUM', unit: '%' },
  US_PCE: { name: 'PCE Price Index', country: 'US', category: EconomicCategory.INFLATION, impact: 'HIGH', unit: '%' },
  US_FOMC_MINUTES: { name: 'FOMC Minutes', country: 'US', category: EconomicCategory.CENTRAL_BANK, impact: 'HIGH' },
  US_BEIGE_BOOK: { name: 'Beige Book', country: 'US', category: EconomicCategory.CENTRAL_BANK, impact: 'MEDIUM' },

  EU_ECB_RATE: { name: 'ECB Interest Rate Decision', country: 'EU', category: EconomicCategory.CENTRAL_BANK, impact: 'HIGH', unit: '%' },
  EU_CPI: { name: 'CPI Flash Estimate', country: 'EU', category: EconomicCategory.INFLATION, impact: 'HIGH', unit: '%' },
  EU_GDP: { name: 'GDP Growth Rate', country: 'EU', category: EconomicCategory.GDP, impact: 'HIGH', unit: '%' },
  EU_PMI_MFG: { name: 'Manufacturing PMI', country: 'EU', category: EconomicCategory.MANUFACTURING, impact: 'MEDIUM', unit: '' },

  UK_BOE_RATE: { name: 'BoE Interest Rate Decision', country: 'UK', category: EconomicCategory.CENTRAL_BANK, impact: 'HIGH', unit: '%' },
  UK_CPI: { name: 'CPI YoY', country: 'UK', category: EconomicCategory.INFLATION, impact: 'HIGH', unit: '%' },
  UK_GDP: { name: 'GDP Growth Rate', country: 'UK', category: EconomicCategory.GDP, impact: 'HIGH', unit: '%' },

  JP_BOJ_RATE: { name: 'BoJ Interest Rate Decision', country: 'JP', category: EconomicCategory.CENTRAL_BANK, impact: 'HIGH', unit: '%' },
  JP_CPI: { name: 'CPI YoY', country: 'JP', category: EconomicCategory.INFLATION, impact: 'MEDIUM', unit: '%' },
  JP_GDP: { name: 'GDP Growth Rate', country: 'JP', category: EconomicCategory.GDP, impact: 'HIGH', unit: '%' },

  CN_GDP: { name: 'GDP Growth Rate', country: 'CN', category: EconomicCategory.GDP, impact: 'HIGH', unit: '%' },
  CN_PMI_MFG: { name: 'Manufacturing PMI', country: 'CN', category: EconomicCategory.MANUFACTURING, impact: 'MEDIUM', unit: '' },
  CN_CPI: { name: 'CPI YoY', country: 'CN', category: EconomicCategory.INFLATION, impact: 'MEDIUM', unit: '%' },
};

// ─── Central Bank Constants ─────────────────────────────────────────────────

export const CENTRAL_BANKS = {
  FED: { name: 'Federal Reserve', country: 'US', meetingsPerYear: 8 },
  ECB: { name: 'European Central Bank', country: 'EU', meetingsPerYear: 8 },
  BOE: { name: 'Bank of England', country: 'UK', meetingsPerYear: 8 },
  BOJ: { name: 'Bank of Japan', country: 'JP', meetingsPerYear: 8 },
  BOC: { name: 'Bank of Canada', country: 'CA', meetingsPerYear: 8 },
  RBA: { name: 'Reserve Bank of Australia', country: 'AU', meetingsPerYear: 11 },
  RBNZ: { name: 'Reserve Bank of New Zealand', country: 'NZ', meetingsPerYear: 7 },
  SNB: { name: 'Swiss National Bank', country: 'CH', meetingsPerYear: 4 },
  PBOC: { name: "People's Bank of China", country: 'CN', meetingsPerYear: 12 },
} as const;
