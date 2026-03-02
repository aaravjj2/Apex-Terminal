import {
  Order,
  OrderSide,
  RiskCheckResult,
  RiskLimits,
  RejectionReason,
} from './types';

// ─── Position State (provided by caller) ─────────────────────────────────────

export interface PositionState {
  currentPositionQty: number;
  currentPositionNotional: number;
  portfolioNotional: number;
  dailyPnL: number;
  ordersInWindow: number;
  marginUsed: number;
  availableMargin: number;
  creditUsed: number;
  creditLimit: number;
  shortInventory: Map<string, number>;
  restrictedSymbols: Set<string>;
  lastTradePrice: number;
  prevClosePrice: number;
  bidPrice: number;
  askPrice: number;
}

// ─── Pre-Trade Risk Engine ───────────────────────────────────────────────────

export class PreTradeRiskEngine {
  private limits: RiskLimits;
  private orderTimestamps: number[] = [];

  constructor(limits: RiskLimits) {
    this.limits = limits;
  }

  updateLimits(limits: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...limits };
  }

  runAllChecks(order: Order, state: PositionState): RiskCheckResult[] {
    const results: RiskCheckResult[] = [
      this.checkPositionLimit(order, state),
      this.checkNotionalLimit(order, state),
      this.checkConcentrationLimit(order, state),
      this.checkFatFinger(order, state),
      this.checkDailyLossLimit(state),
      this.checkOrderRateLimit(),
      this.checkMarginRequirement(order, state),
      this.checkShortSellAvailability(order, state),
      this.checkRestrictedList(order, state),
      this.checkCreditLimit(order, state),
      this.checkUptickRule(order, state),
    ];

    this.orderTimestamps.push(Date.now());

    return results;
  }

  /** Returns true if all hard-reject checks pass. */
  validate(order: Order, state: PositionState): { passed: boolean; rejections: RiskCheckResult[] } {
    const results = this.runAllChecks(order, state);
    const rejections = results.filter((r) => !r.passed && r.severity === 'HARD_REJECT');
    return { passed: rejections.length === 0, rejections };
  }

  // ── Individual Checks ────────────────────────────────────────────────────

  checkPositionLimit(order: Order, state: PositionState): RiskCheckResult {
    const isBuy = order.side === OrderSide.BUY || order.side === OrderSide.BUY_TO_COVER;
    const projected = isBuy
      ? state.currentPositionQty + order.remainingQuantity
      : state.currentPositionQty - order.remainingQuantity;

    const absProjected = Math.abs(projected);
    const passed = absProjected <= this.limits.maxPositionSize;

    return {
      passed,
      checkName: 'Position Limit',
      details: passed
        ? `Projected position ${absProjected} within limit ${this.limits.maxPositionSize}`
        : `Projected position ${absProjected} exceeds limit ${this.limits.maxPositionSize}`,
      currentValue: absProjected,
      limit: this.limits.maxPositionSize,
      severity: 'HARD_REJECT',
    };
  }

  checkNotionalLimit(order: Order, state: PositionState): RiskCheckResult {
    const orderPrice = order.price ?? order.limitPrice ?? state.lastTradePrice;
    const orderNotional = order.remainingQuantity * orderPrice;
    const projectedNotional = state.currentPositionNotional + orderNotional;
    const passed = projectedNotional <= this.limits.maxNotionalValue;

    return {
      passed,
      checkName: 'Notional Limit',
      details: passed
        ? `Projected notional $${projectedNotional.toFixed(0)} within limit $${this.limits.maxNotionalValue.toFixed(0)}`
        : `Projected notional $${projectedNotional.toFixed(0)} exceeds limit $${this.limits.maxNotionalValue.toFixed(0)}`,
      currentValue: projectedNotional,
      limit: this.limits.maxNotionalValue,
      severity: 'HARD_REJECT',
    };
  }

  checkConcentrationLimit(order: Order, state: PositionState): RiskCheckResult {
    if (state.portfolioNotional <= 0) {
      return { passed: true, checkName: 'Concentration Limit', details: 'No portfolio value — skipped', severity: 'INFO' };
    }

    const orderPrice = order.price ?? order.limitPrice ?? state.lastTradePrice;
    const orderNotional = order.remainingQuantity * orderPrice;
    const projectedConcentration = (state.currentPositionNotional + orderNotional) / state.portfolioNotional;
    const passed = projectedConcentration <= this.limits.maxConcentrationPct / 100;

    return {
      passed,
      checkName: 'Concentration Limit',
      details: passed
        ? `Concentration ${(projectedConcentration * 100).toFixed(1)}% within ${this.limits.maxConcentrationPct}% limit`
        : `Concentration ${(projectedConcentration * 100).toFixed(1)}% exceeds ${this.limits.maxConcentrationPct}% limit`,
      currentValue: projectedConcentration * 100,
      limit: this.limits.maxConcentrationPct,
      severity: projectedConcentration > this.limits.maxConcentrationPct / 100 * 1.5 ? 'HARD_REJECT' : 'WARNING',
    };
  }

  checkFatFinger(order: Order, state: PositionState): RiskCheckResult {
    const orderPrice = order.price ?? order.limitPrice;
    if (orderPrice === undefined || state.lastTradePrice <= 0) {
      return { passed: true, checkName: 'Fat Finger', details: 'No price to compare — skipped', severity: 'INFO' };
    }

    const deviation = Math.abs(orderPrice - state.lastTradePrice) / state.lastTradePrice;
    const maxDeviation = this.limits.maxPriceDeviationPct / 100;
    const passed = deviation <= maxDeviation;

    return {
      passed,
      checkName: 'Fat Finger',
      details: passed
        ? `Price deviation ${(deviation * 100).toFixed(2)}% within ${this.limits.maxPriceDeviationPct}% limit`
        : `Price deviation ${(deviation * 100).toFixed(2)}% exceeds ${this.limits.maxPriceDeviationPct}% limit — possible fat finger`,
      currentValue: deviation * 100,
      limit: this.limits.maxPriceDeviationPct,
      severity: 'HARD_REJECT',
    };
  }

  checkDailyLossLimit(state: PositionState): RiskCheckResult {
    const passed = state.dailyPnL > -this.limits.dailyLossLimit;

    return {
      passed,
      checkName: 'Daily Loss Limit',
      details: passed
        ? `Daily P&L $${state.dailyPnL.toFixed(0)} above -$${this.limits.dailyLossLimit.toFixed(0)} limit`
        : `Daily P&L $${state.dailyPnL.toFixed(0)} breaches -$${this.limits.dailyLossLimit.toFixed(0)} limit`,
      currentValue: state.dailyPnL,
      limit: -this.limits.dailyLossLimit,
      severity: 'HARD_REJECT',
    };
  }

  checkOrderRateLimit(): RiskCheckResult {
    const now = Date.now();
    const windowStart = now - this.limits.orderRateWindowMs;
    this.orderTimestamps = this.orderTimestamps.filter((t) => t >= windowStart);
    const count = this.orderTimestamps.length;
    const passed = count < this.limits.orderRateLimit;

    return {
      passed,
      checkName: 'Order Rate Limit',
      details: passed
        ? `${count} orders in window, limit ${this.limits.orderRateLimit}`
        : `${count} orders in window exceeds limit ${this.limits.orderRateLimit}`,
      currentValue: count,
      limit: this.limits.orderRateLimit,
      severity: 'HARD_REJECT',
    };
  }

  checkMarginRequirement(order: Order, state: PositionState): RiskCheckResult {
    const orderPrice = order.price ?? order.limitPrice ?? state.lastTradePrice;
    const orderNotional = order.remainingQuantity * orderPrice;
    const requiredMargin = orderNotional * (this.limits.marginRequirementPct / 100);
    const passed = requiredMargin <= state.availableMargin;

    return {
      passed,
      checkName: 'Margin Requirement',
      details: passed
        ? `Required margin $${requiredMargin.toFixed(0)} available ($${state.availableMargin.toFixed(0)})`
        : `Required margin $${requiredMargin.toFixed(0)} exceeds available $${state.availableMargin.toFixed(0)}`,
      currentValue: requiredMargin,
      limit: state.availableMargin,
      severity: 'HARD_REJECT',
    };
  }

  checkShortSellAvailability(order: Order, state: PositionState): RiskCheckResult {
    if (order.side !== OrderSide.SELL_SHORT) {
      return { passed: true, checkName: 'Short Sell Availability', details: 'Not a short sale — skipped', severity: 'INFO' };
    }

    const available = state.shortInventory.get(order.symbol) ?? 0;
    const passed = available >= order.remainingQuantity;

    return {
      passed,
      checkName: 'Short Sell Availability',
      details: passed
        ? `${available} shares available to borrow (need ${order.remainingQuantity})`
        : `Only ${available} shares available to borrow (need ${order.remainingQuantity})`,
      currentValue: available,
      limit: order.remainingQuantity,
      severity: 'HARD_REJECT',
    };
  }

  checkRestrictedList(order: Order, state: PositionState): RiskCheckResult {
    const isRestricted = state.restrictedSymbols.has(order.symbol);

    return {
      passed: !isRestricted,
      checkName: 'Restricted List',
      details: isRestricted
        ? `${order.symbol} is on the restricted list`
        : `${order.symbol} not restricted`,
      severity: 'HARD_REJECT',
    };
  }

  checkCreditLimit(order: Order, state: PositionState): RiskCheckResult {
    const orderPrice = order.price ?? order.limitPrice ?? state.lastTradePrice;
    const orderNotional = order.remainingQuantity * orderPrice;
    const projectedCredit = state.creditUsed + orderNotional;
    const passed = projectedCredit <= this.limits.maxCreditExposure;

    return {
      passed,
      checkName: 'Credit Limit',
      details: passed
        ? `Projected credit exposure $${projectedCredit.toFixed(0)} within $${this.limits.maxCreditExposure.toFixed(0)} limit`
        : `Projected credit exposure $${projectedCredit.toFixed(0)} exceeds $${this.limits.maxCreditExposure.toFixed(0)} limit`,
      currentValue: projectedCredit,
      limit: this.limits.maxCreditExposure,
      severity: 'HARD_REJECT',
    };
  }

  /**
   * SEC Rule 201 (Alternative Uptick Rule): short sales prohibited at or below
   * the current best bid when a stock has dropped ≥10% from prior close.
   */
  checkUptickRule(order: Order, state: PositionState): RiskCheckResult {
    if (order.side !== OrderSide.SELL_SHORT) {
      return { passed: true, checkName: 'Uptick Rule', details: 'Not a short sale — skipped', severity: 'INFO' };
    }

    const dropPct = state.prevClosePrice > 0
      ? (state.prevClosePrice - state.lastTradePrice) / state.prevClosePrice
      : 0;

    if (dropPct < 0.10) {
      return { passed: true, checkName: 'Uptick Rule', details: `Price decline ${(dropPct * 100).toFixed(1)}% below 10% trigger`, severity: 'INFO' };
    }

    // Circuit breaker triggered — short sale must be above best bid
    const orderPrice = order.price ?? order.limitPrice ?? 0;
    const passed = orderPrice > state.bidPrice;

    return {
      passed,
      checkName: 'Uptick Rule',
      details: passed
        ? `Short sale price $${orderPrice.toFixed(2)} above best bid $${state.bidPrice.toFixed(2)} (circuit breaker active)`
        : `Short sale price $${orderPrice.toFixed(2)} at or below best bid $${state.bidPrice.toFixed(2)} — uptick rule violation`,
      currentValue: orderPrice,
      limit: state.bidPrice,
      severity: 'HARD_REJECT',
    };
  }

  // ── Aggregate Risk Summary ─────────────────────────────────────────────────

  getRiskSummary(state: PositionState): {
    positionUtilization: number;
    notionalUtilization: number;
    marginUtilization: number;
    creditUtilization: number;
    dailyPnLPercent: number;
    rateUtilization: number;
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } {
    const posUtil = Math.abs(state.currentPositionQty) / this.limits.maxPositionSize;
    const notionalUtil = state.currentPositionNotional / this.limits.maxNotionalValue;
    const marginUtil = state.marginUsed / (state.marginUsed + state.availableMargin || 1);
    const creditUtil = state.creditUsed / (this.limits.maxCreditExposure || 1);
    const pnlPct = state.dailyPnL / (-this.limits.dailyLossLimit || 1);

    const now = Date.now();
    const windowStart = now - this.limits.orderRateWindowMs;
    const recentOrders = this.orderTimestamps.filter((t) => t >= windowStart).length;
    const rateUtil = recentOrders / this.limits.orderRateLimit;

    const maxUtil = Math.max(posUtil, notionalUtil, marginUtil, creditUtil, rateUtil);
    let overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    if (maxUtil >= 0.95 || pnlPct >= 0.95) overallRisk = 'CRITICAL';
    else if (maxUtil >= 0.8 || pnlPct >= 0.8) overallRisk = 'HIGH';
    else if (maxUtil >= 0.5 || pnlPct >= 0.5) overallRisk = 'MEDIUM';
    else overallRisk = 'LOW';

    return {
      positionUtilization: posUtil,
      notionalUtilization: notionalUtil,
      marginUtilization: marginUtil,
      creditUtilization: creditUtil,
      dailyPnLPercent: pnlPct,
      rateUtilization: rateUtil,
      overallRisk,
    };
  }
}
