import type {
  RiskLimit,
  LimitType,
  LimitStatus,
  RiskAlert,
  Severity,
  TemporaryLimitIncrease,
} from './types';

// ─── Limit Creation ─────────────────────────────────────────────────────────

export function createLimit(
  name: string,
  type: LimitType,
  level: RiskLimit['level'],
  entityId: string,
  limitValue: number,
  currency: string = 'USD',
  warningPercent: number = 0.80,
  approvedBy: string = 'system',
): RiskLimit {
  return {
    id: `lmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    type,
    level,
    entityId,
    warningThreshold: limitValue * warningPercent,
    limitValue,
    currentUtilization: 0,
    status: 'green',
    currency,
    approvedBy,
    approvedAt: Date.now(),
  };
}

// ─── Limit Status Computation ───────────────────────────────────────────────

export function computeLimitStatus(utilization: number, warningThreshold: number, limitValue: number): LimitStatus {
  if (limitValue <= 0) return 'green';
  const absUtil = Math.abs(utilization);
  if (absUtil > limitValue) return 'breached';
  if (absUtil > warningThreshold) return 'red';
  if (absUtil > warningThreshold * 0.85) return 'amber';
  return 'green';
}

export function updateLimitUtilization(limit: RiskLimit, newUtilization: number): RiskLimit {
  const effectiveLimit = limit.temporaryIncrease && limit.temporaryIncrease.expiresAt > Date.now()
    ? limit.temporaryIncrease.newLimit
    : limit.limitValue;

  const effectiveWarning = effectiveLimit * (limit.warningThreshold / limit.limitValue);
  const status = computeLimitStatus(newUtilization, effectiveWarning, effectiveLimit);

  return {
    ...limit,
    currentUtilization: newUtilization,
    status,
  };
}

// ─── Batch Limit Checking ───────────────────────────────────────────────────

export interface LimitCheckResult {
  limitId: string;
  limitName: string;
  type: LimitType;
  level: RiskLimit['level'];
  entityId: string;
  limitValue: number;
  currentUtilization: number;
  utilizationPercent: number;
  status: LimitStatus;
  headroom: number;
  previousStatus?: LimitStatus;
  statusChanged: boolean;
}

export function checkLimits(
  limits: RiskLimit[],
  currentValues: Record<string, number>,
): LimitCheckResult[] {
  return limits.map(limit => {
    const value = currentValues[limit.entityId] ?? currentValues[limit.id] ?? limit.currentUtilization;
    const effectiveLimit = getEffectiveLimit(limit);
    const status = computeLimitStatus(value, limit.warningThreshold, effectiveLimit);

    return {
      limitId: limit.id,
      limitName: limit.name,
      type: limit.type,
      level: limit.level,
      entityId: limit.entityId,
      limitValue: effectiveLimit,
      currentUtilization: value,
      utilizationPercent: effectiveLimit > 0 ? Math.abs(value) / effectiveLimit : 0,
      status,
      headroom: effectiveLimit - Math.abs(value),
      previousStatus: limit.status,
      statusChanged: status !== limit.status,
    };
  });
}

function getEffectiveLimit(limit: RiskLimit): number {
  if (limit.temporaryIncrease && limit.temporaryIncrease.expiresAt > Date.now()) {
    return limit.temporaryIncrease.newLimit;
  }
  return limit.limitValue;
}

// ─── Breach Detection & Alerts ──────────────────────────────────────────────

export function detectBreaches(checkResults: LimitCheckResult[]): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  for (const result of checkResults) {
    if (result.status === 'breached') {
      alerts.push({
        id: `alert_breach_${result.limitId}_${Date.now()}`,
        severity: 'critical',
        category: 'limit_breach',
        title: `LIMIT BREACH: ${result.limitName}`,
        message: `${result.limitName} utilization at ${(result.utilizationPercent * 100).toFixed(1)}% `
               + `(${result.currentUtilization.toLocaleString()} / ${result.limitValue.toLocaleString()}). `
               + `Headroom: ${result.headroom.toLocaleString()}`,
        timestamp: Date.now(),
        acknowledged: false,
        relatedEntityId: result.entityId,
        metrics: [{
          name: result.limitName,
          value: result.currentUtilization,
          unit: result.type,
          timestamp: Date.now(),
        }],
      });
    } else if (result.status === 'red') {
      alerts.push({
        id: `alert_warning_${result.limitId}_${Date.now()}`,
        severity: 'high',
        category: 'limit_breach',
        title: `LIMIT WARNING: ${result.limitName}`,
        message: `${result.limitName} approaching limit at ${(result.utilizationPercent * 100).toFixed(1)}%. `
               + `Headroom: ${result.headroom.toLocaleString()}`,
        timestamp: Date.now(),
        acknowledged: false,
        relatedEntityId: result.entityId,
      });
    } else if (result.statusChanged && result.status === 'amber') {
      alerts.push({
        id: `alert_amber_${result.limitId}_${Date.now()}`,
        severity: 'medium',
        category: 'limit_breach',
        title: `LIMIT AMBER: ${result.limitName}`,
        message: `${result.limitName} at ${(result.utilizationPercent * 100).toFixed(1)}% utilization`,
        timestamp: Date.now(),
        acknowledged: false,
        relatedEntityId: result.entityId,
      });
    }
  }

  return alerts.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity));
}

function severityOrder(severity: Severity): number {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
  }
}

// ─── Limit Utilization Tracking ─────────────────────────────────────────────

export interface LimitUtilizationHistory {
  limitId: string;
  snapshots: { timestamp: number; utilization: number; status: LimitStatus }[];
  peakUtilization: number;
  peakTimestamp: number;
  averageUtilization: number;
  breachCount: number;
}

export function trackLimitUtilization(
  limitId: string,
  existingHistory: LimitUtilizationHistory | null,
  currentUtilization: number,
  status: LimitStatus,
): LimitUtilizationHistory {
  const now = Date.now();
  const snapshot = { timestamp: now, utilization: currentUtilization, status };
  const snapshots = [...(existingHistory?.snapshots ?? []), snapshot];

  const peak = Math.max(...snapshots.map(s => Math.abs(s.utilization)));
  const peakSnap = snapshots.find(s => Math.abs(s.utilization) === peak) ?? snapshot;
  const avg = snapshots.reduce((s, snap) => s + Math.abs(snap.utilization), 0) / snapshots.length;
  const breaches = snapshots.filter(s => s.status === 'breached').length;

  return {
    limitId,
    snapshots,
    peakUtilization: peak,
    peakTimestamp: peakSnap.timestamp,
    averageUtilization: avg,
    breachCount: breaches,
  };
}

// ─── Limit Hierarchy ────────────────────────────────────────────────────────

export interface LimitHierarchyNode {
  limit: RiskLimit;
  children: LimitHierarchyNode[];
  aggregateUtilization: number;
  aggregateStatus: LimitStatus;
}

export function buildLimitHierarchy(limits: RiskLimit[]): LimitHierarchyNode[] {
  const firmLimits = limits.filter(l => l.level === 'firm');
  const portfolioLimits = limits.filter(l => l.level === 'portfolio');
  const deskLimits = limits.filter(l => l.level === 'desk');

  return firmLimits.map(firm => {
    const portfolioChildren = portfolioLimits
      .filter(p => p.entityId.startsWith(firm.entityId) || p.type === firm.type)
      .map(portfolio => {
        const deskChildren = deskLimits
          .filter(d => d.entityId.startsWith(portfolio.entityId) || d.type === portfolio.type)
          .map(desk => ({
            limit: desk,
            children: [],
            aggregateUtilization: desk.currentUtilization,
            aggregateStatus: desk.status,
          }));

        const aggUtil = deskChildren.length > 0
          ? deskChildren.reduce((s, c) => s + c.aggregateUtilization, 0)
          : portfolio.currentUtilization;

        return {
          limit: portfolio,
          children: deskChildren,
          aggregateUtilization: aggUtil,
          aggregateStatus: computeLimitStatus(aggUtil, portfolio.warningThreshold, portfolio.limitValue),
        };
      });

    const firmAggUtil = portfolioChildren.length > 0
      ? portfolioChildren.reduce((s, c) => s + c.aggregateUtilization, 0)
      : firm.currentUtilization;

    return {
      limit: firm,
      children: portfolioChildren,
      aggregateUtilization: firmAggUtil,
      aggregateStatus: computeLimitStatus(firmAggUtil, firm.warningThreshold, firm.limitValue),
    };
  });
}

// ─── Temporary Limit Increases ──────────────────────────────────────────────

export function requestTemporaryIncrease(
  limit: RiskLimit,
  newLimit: number,
  reason: string,
  approvedBy: string,
  durationDays: number,
): RiskLimit {
  if (newLimit <= limit.limitValue) return limit;

  const tempIncrease: TemporaryLimitIncrease = {
    newLimit,
    reason,
    approvedBy,
    approvedAt: Date.now(),
    expiresAt: Date.now() + durationDays * 86400000,
  };

  return {
    ...limit,
    temporaryIncrease: tempIncrease,
  };
}

export function expireTemporaryIncreases(limits: RiskLimit[]): RiskLimit[] {
  const now = Date.now();
  return limits.map(limit => {
    if (limit.temporaryIncrease && limit.temporaryIncrease.expiresAt <= now) {
      const updated = { ...limit, temporaryIncrease: undefined };
      return updateLimitUtilization(updated, updated.currentUtilization);
    }
    return limit;
  });
}

// ─── Limit Aggregation ─────────────────────────────────────────────────────

export interface AggregatedLimit {
  type: LimitType;
  totalLimit: number;
  totalUtilization: number;
  utilizationPercent: number;
  status: LimitStatus;
  count: number;
  breachedCount: number;
  amberCount: number;
  redCount: number;
}

export function aggregateLimits(limits: RiskLimit[]): AggregatedLimit[] {
  const byType = new Map<LimitType, RiskLimit[]>();

  for (const limit of limits) {
    const existing = byType.get(limit.type) ?? [];
    existing.push(limit);
    byType.set(limit.type, existing);
  }

  const aggregated: AggregatedLimit[] = [];

  for (const [type, typeLimits] of byType.entries()) {
    const totalLimit = typeLimits.reduce((s, l) => s + getEffectiveLimit(l), 0);
    const totalUtil = typeLimits.reduce((s, l) => s + Math.abs(l.currentUtilization), 0);
    const breached = typeLimits.filter(l => l.status === 'breached').length;
    const amber = typeLimits.filter(l => l.status === 'amber').length;
    const red = typeLimits.filter(l => l.status === 'red').length;

    let status: LimitStatus = 'green';
    if (breached > 0) status = 'breached';
    else if (red > 0) status = 'red';
    else if (amber > 0) status = 'amber';

    aggregated.push({
      type,
      totalLimit,
      totalUtilization: totalUtil,
      utilizationPercent: totalLimit > 0 ? totalUtil / totalLimit : 0,
      status,
      count: typeLimits.length,
      breachedCount: breached,
      amberCount: amber,
      redCount: red,
    });
  }

  return aggregated;
}

// ─── Real-Time Limit Checking (Pre-Trade) ───────────────────────────────────

export interface PreTradeCheckResult {
  approved: boolean;
  limitId: string;
  limitName: string;
  currentUtilization: number;
  projectedUtilization: number;
  limitValue: number;
  projectedStatus: LimitStatus;
  headroomAfterTrade: number;
  reason?: string;
}

export function preTradeCheck(
  limits: RiskLimit[],
  tradeImpacts: Record<string, number>,
): PreTradeCheckResult[] {
  const results: PreTradeCheckResult[] = [];

  for (const limit of limits) {
    const impact = tradeImpacts[limit.entityId] ?? tradeImpacts[limit.id] ?? 0;
    if (impact === 0) continue;

    const effectiveLimit = getEffectiveLimit(limit);
    const projected = limit.currentUtilization + impact;
    const projectedStatus = computeLimitStatus(projected, limit.warningThreshold, effectiveLimit);
    const headroom = effectiveLimit - Math.abs(projected);
    const approved = projectedStatus !== 'breached';

    results.push({
      approved,
      limitId: limit.id,
      limitName: limit.name,
      currentUtilization: limit.currentUtilization,
      projectedUtilization: projected,
      limitValue: effectiveLimit,
      projectedStatus,
      headroomAfterTrade: headroom,
      reason: approved ? undefined : `Trade would breach ${limit.name} limit (projected: ${projected.toLocaleString()}, limit: ${effectiveLimit.toLocaleString()})`,
    });
  }

  return results;
}

export function canExecuteTrade(preTradeResults: PreTradeCheckResult[]): {
  approved: boolean;
  blockedBy: string[];
} {
  const blockedBy = preTradeResults
    .filter(r => !r.approved)
    .map(r => r.reason ?? r.limitName);

  return {
    approved: blockedBy.length === 0,
    blockedBy,
  };
}

// ─── Limit Approval Workflow ────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface LimitApproval {
  id: string;
  limitId: string;
  requestedBy: string;
  requestedAt: number;
  requestType: 'new' | 'increase' | 'temporary';
  currentValue: number;
  requestedValue: number;
  justification: string;
  status: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: number;
  rejectionReason?: string;
}

export function createLimitApproval(
  limitId: string,
  requestedBy: string,
  requestType: LimitApproval['requestType'],
  currentValue: number,
  requestedValue: number,
  justification: string,
): LimitApproval {
  return {
    id: `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    limitId,
    requestedBy,
    requestedAt: Date.now(),
    requestType,
    currentValue,
    requestedValue,
    justification,
    status: 'pending',
  };
}

export function approveLimitRequest(approval: LimitApproval, approvedBy: string): LimitApproval {
  return {
    ...approval,
    status: 'approved',
    approvedBy,
    approvedAt: Date.now(),
  };
}

export function rejectLimitRequest(approval: LimitApproval, rejectedBy: string, reason: string): LimitApproval {
  return {
    ...approval,
    status: 'rejected',
    approvedBy: rejectedBy,
    approvedAt: Date.now(),
    rejectionReason: reason,
  };
}

// ─── Limit Summary Dashboard ────────────────────────────────────────────────

export interface LimitDashboardSummary {
  totalLimits: number;
  greenCount: number;
  amberCount: number;
  redCount: number;
  breachedCount: number;
  highestUtilization: { limitName: string; percent: number };
  pendingApprovals: number;
  temporaryIncreases: number;
  aggregated: AggregatedLimit[];
}

export function getLimitDashboard(
  limits: RiskLimit[],
  pendingApprovals: LimitApproval[] = [],
): LimitDashboardSummary {
  const green = limits.filter(l => l.status === 'green').length;
  const amber = limits.filter(l => l.status === 'amber').length;
  const red = limits.filter(l => l.status === 'red').length;
  const breached = limits.filter(l => l.status === 'breached').length;

  let highestUtil = { limitName: '', percent: 0 };
  for (const limit of limits) {
    const eff = getEffectiveLimit(limit);
    const pct = eff > 0 ? Math.abs(limit.currentUtilization) / eff : 0;
    if (pct > highestUtil.percent) {
      highestUtil = { limitName: limit.name, percent: pct };
    }
  }

  const tempIncreases = limits.filter(l =>
    l.temporaryIncrease && l.temporaryIncrease.expiresAt > Date.now(),
  ).length;

  return {
    totalLimits: limits.length,
    greenCount: green,
    amberCount: amber,
    redCount: red,
    breachedCount: breached,
    highestUtilization: highestUtil,
    pendingApprovals: pendingApprovals.filter(a => a.status === 'pending').length,
    temporaryIncreases: tempIncreases,
    aggregated: aggregateLimits(limits),
  };
}
