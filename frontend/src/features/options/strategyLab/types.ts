/**
 * Strategy Lab TypeScript types
 */

export type StrategyType = 'signal' | 'crossover' | 'mean_reversion' | 'breakout';

export interface IndicatorConfig {
  type: string;
  params: Record<string, any>;
}

export interface SignalCondition {
  condition_type: 'above' | 'below' | 'cross_above' | 'cross_below' | 'between';
  indicator: string;
  reference?: number;
  reference_indicator?: string;
}

export interface StrategyDefinition {
  id?: string;
  name: string;
  description?: string;
  strategy_type: StrategyType;
  indicators: IndicatorConfig[];
  entry_condition?: SignalCondition;
  exit_condition?: SignalCondition;
  stop_loss_pct?: number;
  take_profit_pct?: number;
  tags: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  line?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export type StrategyLabTab = 'builder' | 'library' | 'validate';
