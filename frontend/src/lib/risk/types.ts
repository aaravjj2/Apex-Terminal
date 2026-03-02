// ─── Enumerations ───────────────────────────────────────────────────────────

export type RiskFactorType =
  | 'equity'
  | 'fx'
  | 'interest_rate'
  | 'credit_spread'
  | 'commodity'
  | 'volatility'
  | 'inflation'
  | 'basis';

export type VaRMethod =
  | 'historical'
  | 'parametric'
  | 'monte_carlo'
  | 'cornish_fisher';

export type ConfidenceLevel = 0.90 | 0.95 | 0.975 | 0.99 | 0.995;

export type Horizon = '1d' | '10d' | '1m';

export type LimitStatus = 'green' | 'amber' | 'red' | 'breached';

export type LimitType =
  | 'notional'
  | 'var'
  | 'sensitivity'
  | 'concentration'
  | 'loss'
  | 'stress'
  | 'greek';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type CreditRatingAgency = 'sp' | 'moodys' | 'fitch';

export type SPRating =
  | 'AAA' | 'AA+' | 'AA' | 'AA-'
  | 'A+' | 'A' | 'A-'
  | 'BBB+' | 'BBB' | 'BBB-'
  | 'BB+' | 'BB' | 'BB-'
  | 'B+' | 'B' | 'B-'
  | 'CCC+' | 'CCC' | 'CCC-'
  | 'CC' | 'C' | 'D';

export type MoodysRating =
  | 'Aaa' | 'Aa1' | 'Aa2' | 'Aa3'
  | 'A1' | 'A2' | 'A3'
  | 'Baa1' | 'Baa2' | 'Baa3'
  | 'Ba1' | 'Ba2' | 'Ba3'
  | 'B1' | 'B2' | 'B3'
  | 'Caa1' | 'Caa2' | 'Caa3'
  | 'Ca' | 'C';

export type BaselOpRiskCategory =
  | 'internal_fraud'
  | 'external_fraud'
  | 'employment_practices'
  | 'clients_products'
  | 'damage_to_physical_assets'
  | 'business_disruption'
  | 'execution_delivery';

export type RegulatoryFramework = 'frtb' | 'basel_iii' | 'solvency_ii' | 'isda_simm';

// ─── Core Risk Structures ───────────────────────────────────────────────────

export interface RiskFactor {
  id: string;
  name: string;
  type: RiskFactorType;
  currentValue: number;
  currency: string;
  volatility: number;
  historicalReturns: number[];
  metadata?: Record<string, unknown>;
}

export interface RiskMetric {
  name: string;
  value: number;
  unit: string;
  confidenceLevel?: ConfidenceLevel;
  horizon?: Horizon;
  timestamp: number;
  method?: string;
}

export interface StressScenario {
  id: string;
  name: string;
  description: string;
  category: 'historical' | 'hypothetical' | 'reverse' | 'regulatory';
  factorShocks: FactorShock[];
  correlationOverride?: number[][];
  liquidityMultiplier?: number;
  createdAt: number;
}

export interface FactorShock {
  factorId: string;
  factorType: RiskFactorType;
  shockType: 'absolute' | 'relative' | 'override';
  shockValue: number;
}

export interface RiskLimit {
  id: string;
  name: string;
  type: LimitType;
  level: 'desk' | 'portfolio' | 'firm';
  entityId: string;
  warningThreshold: number;
  limitValue: number;
  currentUtilization: number;
  status: LimitStatus;
  currency: string;
  approvedBy: string;
  approvedAt: number;
  expiresAt?: number;
  temporaryIncrease?: TemporaryLimitIncrease;
}

export interface TemporaryLimitIncrease {
  newLimit: number;
  reason: string;
  approvedBy: string;
  approvedAt: number;
  expiresAt: number;
}

export interface RiskAlert {
  id: string;
  severity: Severity;
  category: 'limit_breach' | 'var_spike' | 'stress_warning' | 'credit_event' | 'operational' | 'regulatory';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  relatedEntityId?: string;
  metrics?: RiskMetric[];
}

// ─── VaR & Tail Risk ────────────────────────────────────────────────────────

export interface VaRResult {
  method: VaRMethod;
  confidenceLevel: ConfidenceLevel;
  horizon: Horizon;
  var: number;
  expectedShortfall: number;
  stressedVaR?: number;
  componentVaR?: Record<string, number>;
  marginalVaR?: Record<string, number>;
  incrementalVaR?: Record<string, number>;
  timestamp: number;
}

export interface VaRBacktestResult {
  method: VaRMethod;
  confidenceLevel: ConfidenceLevel;
  observationPeriod: number;
  exceptions: number;
  expectedExceptions: number;
  kupiecPValue: number;
  kupiecPass: boolean;
  christoffersenPValue: number;
  christoffersenPass: boolean;
  baselZone: 'green' | 'yellow' | 'red';
  baselMultiplier: number;
  exceptionDates: number[];
}

export interface EVTResult {
  method: 'pot' | 'block_maxima';
  threshold?: number;
  shapeParameter: number;
  scaleParameter: number;
  locationParameter?: number;
  tailIndex: number;
  expectedTailLoss: number;
  tailVaR: Record<ConfidenceLevel, number>;
}

// ─── Stress Testing ─────────────────────────────────────────────────────────

export interface StressTestResult {
  scenarioId: string;
  scenarioName: string;
  portfolioId: string;
  pnl: number;
  pnlPercent: number;
  componentPnl: Record<string, number>;
  factorContributions: Record<string, number>;
  breachedLimits: string[];
  timestamp: number;
}

export interface SensitivityLadder {
  factorId: string;
  factorName: string;
  shockLevels: number[];
  pnlResults: number[];
}

// ─── Sensitivity / Greeks ───────────────────────────────────────────────────

export interface SensitivityResult {
  positionId: string;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
  crossGamma?: Record<string, number>;
  timestamp: number;
}

export interface PnLAttribution {
  total: number;
  byAsset: Record<string, number>;
  byFactor: Record<string, number>;
  byGreek: { delta: number; gamma: number; vega: number; theta: number; rho: number; unexplained: number };
  period: { start: number; end: number };
}

// ─── Credit Risk ─────────────────────────────────────────────────────────────

export interface CreditRating {
  agency: CreditRatingAgency;
  rating: string;
  outlook: 'positive' | 'stable' | 'negative' | 'developing';
  date: number;
}

export interface ProbabilityOfDefault {
  counterpartyId: string;
  pd1y: number;
  pdCumulative: number[];
  method: 'merton' | 'altman_z' | 'historical' | 'market_implied';
  asOfDate: number;
}

export interface LossGivenDefault {
  instrumentType: string;
  seniority: 'senior_secured' | 'senior_unsecured' | 'subordinated' | 'junior';
  lgd: number;
  recoveryRate: number;
}

export interface ExposureAtDefault {
  counterpartyId: string;
  currentExposure: number;
  potentialFutureExposure: number;
  ead: number;
  nettingSetId?: string;
}

export interface CreditVAResult {
  cva: number;
  dva: number;
  fva: number;
  bilateral: number;
  byCounterparty: Record<string, { cva: number; dva: number }>;
}

// ─── Operational Risk ───────────────────────────────────────────────────────

export interface OperationalRiskEvent {
  id: string;
  category: BaselOpRiskCategory;
  severity: Severity;
  description: string;
  lossAmount: number;
  currency: string;
  occurredAt: number;
  discoveredAt: number;
  businessLine: string;
  status: 'open' | 'investigating' | 'remediated' | 'closed';
  nearMiss: boolean;
  rootCause?: string;
  remediationActions?: RemediationAction[];
}

export interface RemediationAction {
  id: string;
  description: string;
  assignee: string;
  dueDate: number;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

export interface KRI {
  id: string;
  name: string;
  category: BaselOpRiskCategory;
  currentValue: number;
  thresholdGreen: number;
  thresholdAmber: number;
  thresholdRed: number;
  status: LimitStatus;
  trend: 'improving' | 'stable' | 'deteriorating';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  history: { date: number; value: number }[];
}

export interface RCSAScore {
  riskId: string;
  inherentLikelihood: number;
  inherentImpact: number;
  controlEffectiveness: number;
  residualLikelihood: number;
  residualImpact: number;
  residualScore: number;
}

// ─── Regulatory ─────────────────────────────────────────────────────────────

export interface RegulatoryMetric {
  framework: RegulatoryFramework;
  metricName: string;
  value: number;
  threshold: number;
  compliant: boolean;
  reportingDate: number;
  details?: Record<string, number>;
}

export interface FRTBResult {
  sbm: { delta: number; vega: number; curvature: number; total: number };
  drc: number;
  rrao: number;
  totalCapitalCharge: number;
}

export interface BaselIIIMetrics {
  cet1Ratio: number;
  tier1Ratio: number;
  totalCapitalRatio: number;
  leverageRatio: number;
  lcr: number;
  nsfr: number;
  rwa: number;
}

export interface ISDAMargin {
  deltaMargin: number;
  vegaMargin: number;
  curvatureMargin: number;
  totalMargin: number;
  byRiskClass: Record<string, number>;
}

// ─── Reporting ──────────────────────────────────────────────────────────────

export interface RiskReport {
  id: string;
  title: string;
  generatedAt: number;
  asOfDate: number;
  portfolioId: string;
  var: VaRResult[];
  stressTests: StressTestResult[];
  sensitivities: SensitivityResult[];
  pnlAttribution?: PnLAttribution;
  creditMetrics?: CreditVAResult;
  regulatoryMetrics?: RegulatoryMetric[];
  alerts: RiskAlert[];
}

export interface RiskDashboardData {
  portfolioValue: number;
  dailyPnl: number;
  varSummary: VaRResult;
  topRisks: RiskMetric[];
  limitUtilization: { limit: RiskLimit; utilization: number }[];
  stressTestSummary: StressTestResult[];
  alerts: RiskAlert[];
  kriSummary: KRI[];
  regulatorySummary: RegulatoryMetric[];
  asOfTimestamp: number;
}

// ─── Portfolio Position (shared input type) ─────────────────────────────────

export interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  weight: number;
  assetClass: RiskFactorType;
  currency: string;
  sector?: string;
  country?: string;
  counterpartyId?: string;
  maturityDate?: number;
  Greeks?: Partial<SensitivityResult>;
}

export interface Portfolio {
  id: string;
  name: string;
  positions: Position[];
  totalValue: number;
  currency: string;
  historicalReturns: number[];
  historicalDates: number[];
}
