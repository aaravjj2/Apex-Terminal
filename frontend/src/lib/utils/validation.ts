// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop-limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'DAY';
}

export interface PortfolioConstraints {
  maxPositionSize?: number;
  maxSectorExposure?: number;
  maxSingleStock?: number;
  minCash?: number;
  maxLeverage?: number;
  allowShort?: boolean;
  maxDrawdown?: number;
}

export interface BacktestConfig {
  startDate: string;
  endDate: string;
  initialCapital: number;
  symbols: string[];
  strategy: string;
  commissionRate?: number;
  slippage?: number;
}

export interface AlertCondition {
  type: 'price' | 'volume' | 'indicator' | 'percentage';
  symbol: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'crosses_above' | 'crosses_below';
  value: number;
  indicator?: string;
}

export interface PasswordStrength {
  score: number; // 0-4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  suggestions: string[];
}

// ============================================================================
// Symbol Validation
// ============================================================================

const SYMBOL_PATTERN = /^[A-Z]{1,5}$/;
const CRYPTO_SYMBOL_PATTERN = /^[A-Z]{2,10}(\/[A-Z]{2,10})?$/;
const FOREX_PATTERN = /^[A-Z]{3}\/[A-Z]{3}$/;
const FUTURES_PATTERN = /^[A-Z]{1,4}[FGHJKMNQUVXZ]\d{2}$/;
const OPTIONS_PATTERN = /^[A-Z]{1,5}\d{6}[CP]\d{8}$/;

export function validateSymbol(symbol: string): ValidationResult {
  const errors: string[] = [];
  const s = symbol.trim().toUpperCase();

  if (!s) {
    errors.push('Symbol is required');
  } else if (s.length > 20) {
    errors.push('Symbol too long (max 20 characters)');
  } else if (!/^[A-Z0-9./:^-]+$/.test(s)) {
    errors.push('Symbol contains invalid characters');
  }

  return { valid: errors.length === 0, errors };
}

export function isEquitySymbol(symbol: string): boolean {
  return SYMBOL_PATTERN.test(symbol.toUpperCase());
}

export function isCryptoSymbol(symbol: string): boolean {
  return CRYPTO_SYMBOL_PATTERN.test(symbol.toUpperCase());
}

export function isForexPair(symbol: string): boolean {
  return FOREX_PATTERN.test(symbol.toUpperCase());
}

export function isFuturesSymbol(symbol: string): boolean {
  return FUTURES_PATTERN.test(symbol.toUpperCase());
}

export function isOptionsSymbol(symbol: string): boolean {
  return OPTIONS_PATTERN.test(symbol.toUpperCase());
}

// ============================================================================
// Price Validation
// ============================================================================

export function validatePrice(price: number, options?: {
  min?: number;
  max?: number;
  tickSize?: number;
}): ValidationResult {
  const errors: string[] = [];
  const { min = 0, max = 1e8, tickSize } = options ?? {};

  if (!isFinite(price)) errors.push('Price must be a finite number');
  else if (price < min) errors.push(`Price must be at least ${min}`);
  else if (price > max) errors.push(`Price must not exceed ${max}`);

  if (tickSize && price > 0) {
    const remainder = Math.abs(price % tickSize);
    if (remainder > 1e-10 && Math.abs(remainder - tickSize) > 1e-10) {
      errors.push(`Price must be a multiple of tick size ${tickSize}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Quantity Validation
// ============================================================================

export function validateQuantity(quantity: number, options?: {
  min?: number;
  max?: number;
  lotSize?: number;
  allowFractional?: boolean;
}): ValidationResult {
  const errors: string[] = [];
  const { min = 0.0001, max = 1e9, lotSize, allowFractional = true } = options ?? {};

  if (!isFinite(quantity)) errors.push('Quantity must be a finite number');
  else if (quantity <= 0) errors.push('Quantity must be positive');
  else if (quantity < min) errors.push(`Quantity must be at least ${min}`);
  else if (quantity > max) errors.push(`Quantity must not exceed ${max}`);

  if (!allowFractional && quantity % 1 !== 0)
    errors.push('Fractional quantities not allowed');

  if (lotSize && quantity > 0) {
    const remainder = quantity % lotSize;
    if (remainder > 1e-10 && Math.abs(remainder - lotSize) > 1e-10)
      errors.push(`Quantity must be a multiple of lot size ${lotSize}`);
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Date Validation
// ============================================================================

export function validateDate(dateStr: string): ValidationResult {
  const errors: string[] = [];
  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    errors.push('Invalid date format');
  } else {
    if (date.getFullYear() < 1900) errors.push('Date is too far in the past');
    if (date.getFullYear() > 2100) errors.push('Date is too far in the future');
  }

  return { valid: errors.length === 0, errors };
}

export function validateDateRange(startStr: string, endStr: string): ValidationResult {
  const errors: string[] = [];
  const startResult = validateDate(startStr);
  const endResult = validateDate(endStr);

  errors.push(...startResult.errors.map(e => `Start date: ${e}`));
  errors.push(...endResult.errors.map(e => `End date: ${e}`));

  if (startResult.valid && endResult.valid) {
    const start = new Date(startStr), end = new Date(endStr);
    if (start >= end) errors.push('Start date must be before end date');
    const diffYears = (end.getTime() - start.getTime()) / (365.25 * 86400000);
    if (diffYears > 100) errors.push('Date range exceeds 100 years');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Email & Password
// ============================================================================

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  if (!email.trim()) errors.push('Email is required');
  else if (!EMAIL_PATTERN.test(email)) errors.push('Invalid email format');
  else if (email.length > 254) errors.push('Email is too long');
  return { valid: errors.length === 0, errors };
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++; else suggestions.push('Use at least 8 characters');
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else suggestions.push('Mix uppercase and lowercase letters');
  if (/\d/.test(password)) score++;
  else suggestions.push('Include at least one number');
  if (/[^a-zA-Z\d]/.test(password)) score++;
  else suggestions.push('Include a special character');

  if (/(.)\1{2,}/.test(password)) { score--; suggestions.push('Avoid repeating characters'); }
  if (/^(123|abc|qwerty|password)/i.test(password)) { score = 0; suggestions.push('Avoid common patterns'); }

  score = Math.max(0, Math.min(4, score));
  const labels: PasswordStrength['label'][] = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

  return { score, label: labels[score], suggestions };
}

// ============================================================================
// Order Parameter Validation
// ============================================================================

export function validateOrder(params: OrderParams): ValidationResult {
  const errors: string[] = [];

  const symbolResult = validateSymbol(params.symbol);
  errors.push(...symbolResult.errors);

  if (!['buy', 'sell'].includes(params.side)) errors.push('Invalid side');
  if (!['market', 'limit', 'stop', 'stop-limit'].includes(params.type)) errors.push('Invalid order type');

  const qtyResult = validateQuantity(params.quantity);
  errors.push(...qtyResult.errors);

  if (params.type === 'limit' || params.type === 'stop-limit') {
    if (params.price == null) errors.push('Limit price required for limit/stop-limit orders');
    else {
      const priceResult = validatePrice(params.price);
      errors.push(...priceResult.errors);
    }
  }

  if (params.type === 'stop' || params.type === 'stop-limit') {
    if (params.stopPrice == null) errors.push('Stop price required for stop/stop-limit orders');
    else {
      const stopResult = validatePrice(params.stopPrice);
      errors.push(...stopResult.errors);
    }
  }

  if (params.timeInForce && !['GTC', 'IOC', 'FOK', 'DAY'].includes(params.timeInForce))
    errors.push('Invalid time-in-force');

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Portfolio Constraint Validation
// ============================================================================

export function validatePortfolioConstraints(constraints: PortfolioConstraints): ValidationResult {
  const errors: string[] = [];

  if (constraints.maxPositionSize != null) {
    if (constraints.maxPositionSize <= 0 || constraints.maxPositionSize > 1)
      errors.push('Max position size must be between 0 and 1 (0-100%)');
  }
  if (constraints.maxSectorExposure != null) {
    if (constraints.maxSectorExposure <= 0 || constraints.maxSectorExposure > 1)
      errors.push('Max sector exposure must be between 0 and 1');
  }
  if (constraints.maxSingleStock != null) {
    if (constraints.maxSingleStock <= 0 || constraints.maxSingleStock > 1)
      errors.push('Max single stock allocation must be between 0 and 1');
  }
  if (constraints.minCash != null) {
    if (constraints.minCash < 0 || constraints.minCash > 1)
      errors.push('Min cash must be between 0 and 1');
  }
  if (constraints.maxLeverage != null) {
    if (constraints.maxLeverage < 1 || constraints.maxLeverage > 10)
      errors.push('Max leverage must be between 1 and 10');
  }
  if (constraints.maxDrawdown != null) {
    if (constraints.maxDrawdown <= 0 || constraints.maxDrawdown > 1)
      errors.push('Max drawdown must be between 0 and 1');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Backtest Configuration Validation
// ============================================================================

export function validateBacktestConfig(config: BacktestConfig): ValidationResult {
  const errors: string[] = [];

  const dateRangeResult = validateDateRange(config.startDate, config.endDate);
  errors.push(...dateRangeResult.errors);

  if (config.initialCapital <= 0) errors.push('Initial capital must be positive');
  if (config.initialCapital > 1e12) errors.push('Initial capital is unrealistically large');

  if (!config.symbols?.length) errors.push('At least one symbol required');
  else if (config.symbols.length > 500) errors.push('Too many symbols (max 500)');
  else {
    for (const sym of config.symbols) {
      const r = validateSymbol(sym);
      if (!r.valid) errors.push(`Invalid symbol "${sym}": ${r.errors.join(', ')}`);
    }
  }

  if (!config.strategy?.trim()) errors.push('Strategy name is required');

  if (config.commissionRate != null) {
    if (config.commissionRate < 0 || config.commissionRate > 0.1)
      errors.push('Commission rate must be between 0 and 10%');
  }

  if (config.slippage != null) {
    if (config.slippage < 0 || config.slippage > 0.1)
      errors.push('Slippage must be between 0 and 10%');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Alert Condition Validation
// ============================================================================

export function validateAlertCondition(condition: AlertCondition): ValidationResult {
  const errors: string[] = [];

  if (!['price', 'volume', 'indicator', 'percentage'].includes(condition.type))
    errors.push('Invalid alert type');

  const symResult = validateSymbol(condition.symbol);
  errors.push(...symResult.errors);

  const validOps = ['gt', 'lt', 'gte', 'lte', 'eq', 'crosses_above', 'crosses_below'];
  if (!validOps.includes(condition.operator)) errors.push('Invalid operator');

  if (!isFinite(condition.value)) errors.push('Alert value must be a finite number');

  if (condition.type === 'indicator' && !condition.indicator?.trim())
    errors.push('Indicator name required for indicator alerts');

  if (condition.type === 'price' && condition.value < 0)
    errors.push('Price alert value must be non-negative');

  if (condition.type === 'volume' && condition.value < 0)
    errors.push('Volume alert value must be non-negative');

  return { valid: errors.length === 0, errors };
}
