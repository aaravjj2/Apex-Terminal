// ─── Enums ───────────────────────────────────────────────────────────────────

export enum ModelType {
  LinearRegression = 'linear_regression',
  RidgeRegression = 'ridge_regression',
  LassoRegression = 'lasso_regression',
  ElasticNet = 'elastic_net',
  LogisticRegression = 'logistic_regression',
  DecisionTree = 'decision_tree',
  RandomForest = 'random_forest',
  GradientBoostedTrees = 'gradient_boosted_trees',
  KMeans = 'kmeans',
  DBSCAN = 'dbscan',
  GaussianMixture = 'gaussian_mixture',
  HMM = 'hmm',
  ARIMA = 'arima',
  KalmanFilter = 'kalman_filter',
  ExponentialSmoothing = 'exponential_smoothing',
}

export enum NormalizationMethod {
  MinMax = 'min_max',
  ZScore = 'z_score',
  Robust = 'robust',
  MaxAbs = 'max_abs',
  Quantile = 'quantile',
}

export enum ImputationMethod {
  Mean = 'mean',
  Median = 'median',
  Mode = 'mode',
  ForwardFill = 'forward_fill',
  Interpolation = 'interpolation',
}

export enum SplitType {
  Random = 'random',
  TimeSeries = 'time_series',
  WalkForward = 'walk_forward',
  Purged = 'purged',
}

export enum AnomalyMethod {
  ZScore = 'z_score',
  ModifiedZScore = 'modified_z_score',
  IQR = 'iqr',
  IsolationForest = 'isolation_forest',
  LOF = 'lof',
  CUSUM = 'cusum',
  Mahalanobis = 'mahalanobis',
  PCAReconstruction = 'pca_reconstruction',
}

// ─── Core Data Structures ────────────────────────────────────────────────────

export interface Feature {
  name: string;
  values: number[];
  type: 'continuous' | 'categorical' | 'binary';
  importance?: number;
}

export interface Label {
  name: string;
  values: number[];
  type: 'continuous' | 'categorical';
  classes?: string[];
}

export interface Dataset {
  features: Feature[];
  labels?: Label;
  timestamps?: number[];
  index?: string[];
  metadata?: Record<string, unknown>;
}

export interface PredictionResult {
  predictions: number[];
  probabilities?: number[][];
  confidenceIntervals?: { lower: number[]; upper: number[] };
  featureImportances?: FeatureImportance[];
}

// ─── Model Configuration ─────────────────────────────────────────────────────

export interface ModelConfig {
  type: ModelType;
  hyperparameters: Record<string, number | string | boolean>;
  maxIterations?: number;
  tolerance?: number;
  randomSeed?: number;
  verbose?: boolean;
}

export interface TrainingResult {
  model: ModelConfig;
  trainMetrics: Record<string, number>;
  validationMetrics?: Record<string, number>;
  trainingTime: number;
  iterations: number;
  converged: boolean;
  weights?: number[];
  bias?: number;
}

export interface ValidationResult {
  foldMetrics: Record<string, number>[];
  meanMetrics: Record<string, number>;
  stdMetrics: Record<string, number>;
  bestFold: number;
  worstFold: number;
}

// ─── Classification Metrics ──────────────────────────────────────────────────

export interface ConfusionMatrix {
  matrix: number[][];
  labels: string[];
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
}

export interface ClassificationReport {
  precision: Record<string, number>;
  recall: Record<string, number>;
  f1Score: Record<string, number>;
  support: Record<string, number>;
  accuracy: number;
  macroAvg: { precision: number; recall: number; f1: number };
  weightedAvg: { precision: number; recall: number; f1: number };
}

// ─── Clustering ──────────────────────────────────────────────────────────────

export interface ClusterResult {
  labels: number[];
  centers?: number[][];
  inertia?: number;
  silhouetteScore?: number;
  daviesBouldinIndex?: number;
  nClusters: number;
  clusterSizes: number[];
}

// ─── Anomaly Detection ───────────────────────────────────────────────────────

export interface AnomalyResult {
  isAnomaly: boolean[];
  scores: number[];
  threshold: number;
  anomalyIndices: number[];
  anomalyRate: number;
  details?: { method: AnomalyMethod; params: Record<string, number> };
}

// ─── Feature Analysis ────────────────────────────────────────────────────────

export interface FeatureImportance {
  featureName: string;
  importance: number;
  rank: number;
  stdDev?: number;
}

export interface ShapleyValue {
  featureName: string;
  shapValues: number[];
  meanAbsShap: number;
  baseValue: number;
}

// ─── Time Series ─────────────────────────────────────────────────────────────

export interface TimeSeriesFeature {
  name: string;
  lag?: number;
  window?: number;
  transform: 'return' | 'log_return' | 'diff' | 'rolling_mean' | 'rolling_std' | 'ewm';
}

export interface RegimeState {
  regime: number;
  probability: number;
  startIndex: number;
  endIndex: number;
  characteristics: {
    meanReturn: number;
    volatility: number;
    duration: number;
  };
}

export interface ForecastResult {
  forecast: number[];
  lower: number[];
  upper: number[];
  horizon: number;
  confidenceLevel: number;
}

export interface SplitIndices {
  trainIndices: number[];
  testIndices: number[];
  validationIndices?: number[];
}

export interface WalkForwardSplit {
  splits: SplitIndices[];
  windowSize: number;
  stepSize: number;
}

export interface PCAResult {
  components: number[][];
  explainedVariance: number[];
  explainedVarianceRatio: number[];
  cumulativeVariance: number[];
  nComponents: number;
  transformedData: number[][];
}
