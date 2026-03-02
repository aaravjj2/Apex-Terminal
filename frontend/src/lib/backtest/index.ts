// ─── Types ──────────────────────────────────────────────────────────────────
export {
  Signal,
  OrderType,
  OrderStatus,
  PositionSizing,
  CommissionModel,
  SlippageModel,
  Side,
  Timeframe,
  defaultBacktestConfig,
} from './types';

export type {
  Bar,
  Order,
  Trade,
  Position,
  CommissionConfig,
  SlippageConfig,
  DividendEvent,
  SplitEvent,
  CorporateEvent,
  BacktestConfig,
  BacktestResult,
  BacktestMetrics,
  EquityPoint,
  DrawdownPeriod,
  MonthlyReturn,
  Strategy,
  StrategyParam,
  StrategyContext,
  ParameterRange,
  OptimizationObjective,
  OptimizationResult,
  MonteCarloResult,
  WalkForwardResult,
  WalkForwardWindow,
  CSCVResult,
  SensitivityPoint,
  EngineEvent,
  EventHandler,
} from './types';

// ─── Engine ─────────────────────────────────────────────────────────────────
export { BacktestEngine } from './engine';

// ─── Analytics ──────────────────────────────────────────────────────────────
export {
  computeMetrics,
  computeMonthlyReturns,
  rollingMetric,
  maeMfeAnalysis,
  dayOfWeekAnalysis,
  hourOfDayAnalysis,
  tradeDurationDistribution,
  profitDistribution,
  regimeAnalysis,
  compareToBenchmark,
  tTestReturns,
  analyzeExposure,
} from './analytics';

export type {
  MAEMFEPoint,
  TemporalAnalysis,
  DistributionBucket,
  RegimePerformance,
  BenchmarkComparison,
  SignificanceTest,
  ExposureAnalysis,
} from './analytics';

// ─── Optimization ───────────────────────────────────────────────────────────
export {
  gridSearch,
  walkForwardAnalysis,
  monteCarloPermutationTest,
  monteCarloSimulation,
  geneticOptimization,
  bayesianOptimization,
  multiObjectiveOptimization,
  cscvAnalysis,
  parameterSensitivity,
  whitesRealityCheck,
} from './optimization';

// ─── Strategies ─────────────────────────────────────────────────────────────
export {
  SMACrossover,
  RSIMeanReversion,
  MACDStrategy,
  BollingerMeanReversion,
  BreakoutStrategy,
  MomentumStrategy,
  PairsTrading,
  TrendFollowing,
  IchimokuStrategy,
  VWAPStrategy,
  MeanReversionZScore,
  DualMomentum,
  FactorStrategy,
  VolatilityTargeting,
  TurtleTrading,
  SectorRotation,
  BUILT_IN_STRATEGIES,
  getStrategy,
} from './strategies';

// ─── Reporter ───────────────────────────────────────────────────────────────
export {
  generateReport,
  generateHTMLReport,
  exportReportJSON,
  generatePDFData,
  compareStrategies,
} from './reporter';

export type {
  BacktestReport,
  SummaryStats,
  TradeDetail,
  MonthlyPerformanceTable,
  MonthlyPerformanceCell,
  ChartDataPoint,
  RiskMetricsSummary,
  KeyTradeAnalysis,
  PDFReportSection,
  StrategyComparisonRow,
} from './reporter';
