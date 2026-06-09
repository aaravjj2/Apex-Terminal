/**
 * HITL review window timing — America/New_York.
 *
 * soft=08:05 ET · hard clock=09:30 ET · cutoff=09:45 ET
 */

export const TRADING_TZ = 'America/New_York';

export const HITL_SOFT_OPEN_MIN = 8 * 60 + 5;
export const HITL_HARD_CLOCK_MIN = 9 * 60 + 30;
export const HITL_CUTOFF_MIN = 9 * 60 + 45;

export const DRIFT_WARNING_PCT = 0.4;
export const DRIFT_INVALIDATE_PCT = 0.5;

export type HITLPhase = 'pre_soft' | 'soft_preopen' | 'hard_window' | 'expired';

export interface HITLWindowState {
  phase: HITLPhase;
  nowEt: Date;
  preAuthorizeEnabled: boolean;
  authorizeEnabled: boolean;
  rejectEnabled: boolean;
  countdownActive: boolean;
  remainingMs: number;
  remainingLabel: string;
}

function etMinutesAndSeconds(now: Date): { totalMin: number; sec: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TRADING_TZ,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  return { totalMin: hour * 60 + minute, sec: second };
}

function minutesSeconds(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const DRY_RUN =
  import.meta.env.VITE_HITL_DRY_RUN === 'true' || import.meta.env.VITE_HITL_DRY_RUN === '1';

export function computeHITLWindows(now: Date = new Date()): HITLWindowState {
  if (DRY_RUN) {
    return {
      phase: 'soft_preopen',
      nowEt: now,
      preAuthorizeEnabled: true,
      authorizeEnabled: false,
      rejectEnabled: true,
      countdownActive: true,
      remainingMs: 12 * 60_000,
      remainingLabel: '12:00',
    };
  }

  const { totalMin, sec } = etMinutesAndSeconds(now);

  let phase: HITLPhase;
  let countdownActive = false;
  let targetMin = HITL_CUTOFF_MIN;

  if (totalMin < HITL_SOFT_OPEN_MIN) {
    phase = 'pre_soft';
    targetMin = HITL_SOFT_OPEN_MIN;
    countdownActive = true;
  } else if (totalMin < HITL_HARD_CLOCK_MIN) {
    phase = 'soft_preopen';
    targetMin = HITL_CUTOFF_MIN;
    countdownActive = true;
  } else if (totalMin < HITL_CUTOFF_MIN) {
    phase = 'hard_window';
    targetMin = HITL_CUTOFF_MIN;
    countdownActive = true;
  } else {
    phase = 'expired';
    countdownActive = false;
  }

  const minutesUntil =
    phase === 'expired' ? 0 : Math.max(0, targetMin - totalMin - (sec > 0 ? 1 : 0));
  const secondsUntil =
    phase === 'expired' ? 0 : sec === 0 ? 0 : 60 - sec;
  const remainingMs = countdownActive
    ? minutesUntil * 60_000 + secondsUntil * 1000
    : 0;

  const preAuthorizeEnabled = totalMin >= HITL_SOFT_OPEN_MIN && totalMin < HITL_CUTOFF_MIN;
  const authorizeEnabled = totalMin >= HITL_HARD_CLOCK_MIN && totalMin < HITL_CUTOFF_MIN;

  return {
    phase,
    nowEt: now,
    preAuthorizeEnabled,
    authorizeEnabled,
    rejectEnabled: true,
    countdownActive,
    remainingMs,
    remainingLabel: minutesSeconds(remainingMs),
  };
}

export function computeDriftPct(anchorPrice: number, livePrice: number): number {
  if (anchorPrice <= 0) return 0;
  return (Math.abs(livePrice - anchorPrice) / anchorPrice) * 100;
}

export type DriftLevel = 'ok' | 'warning' | 'critical';

export function driftLevel(driftPct: number): DriftLevel {
  if (driftPct > DRIFT_INVALIDATE_PCT) return 'critical';
  if (driftPct > DRIFT_WARNING_PCT) return 'warning';
  return 'ok';
}
