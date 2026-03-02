// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  Feature, Label, Dataset, PredictionResult,
  ModelConfig, TrainingResult, ValidationResult,
  ConfusionMatrix, ClassificationReport,
  ClusterResult, AnomalyResult,
  FeatureImportance, ShapleyValue,
  TimeSeriesFeature, RegimeState, ForecastResult,
  SplitIndices, WalkForwardSplit, PCAResult,
} from './types';

export {
  ModelType, NormalizationMethod, ImputationMethod,
  SplitType, AnomalyMethod,
} from './types';

// ─── Preprocessing ───────────────────────────────────────────────────────────
export {
  normalize, denormalize,
  imputeMissing,
  detectOutliersIQR, detectOutliersZScore, clipOutliers, winsorize,
  lagFeatures, returnFeatures, logReturnFeatures,
  rollingStatFeatures, calendarFeatures,
  crossSectionalRank, crossSectionalZScore,
  timeSeriesSplit, walkForwardSplit,
  pca,
  correlationMatrix, selectByCorrelation,
  mutualInformation, selectByMutualInformation,
  removeHighlyCorrelated,
} from './preprocessing';

// ─── Linear Models ───────────────────────────────────────────────────────────
export {
  LinearRegression, RidgeRegression, LassoRegression, ElasticNet,
  LogisticRegression,
  HuberRegression, QuantileRegression,
  famaMacBeth, estimateFactorModel,
} from './linearModels';
export type { FamaMacBethResult, FactorModelResult } from './linearModels';

// ─── Tree-Based Models ───────────────────────────────────────────────────────
export { DecisionTree, RandomForest, GradientBoostedTrees } from './trees';
export type {
  DecisionTreeConfig, RandomForestConfig, GradientBoostedTreesConfig,
} from './trees';

// ─── Time Series ─────────────────────────────────────────────────────────────
export {
  autocorrelation, partialAutocorrelation,
  ARModel, MAModel, ARMAModel, ARIMAModel,
  SimpleExponentialSmoothing, HoltLinear, HoltWinters,
  KalmanFilter,
  HiddenMarkovModel,
  cusumChangePoint, peltChangePoint,
  fftPeriodDetection,
  adfTest,
} from './timeSeries';

// ─── Clustering ──────────────────────────────────────────────────────────────
export {
  KMeans, HierarchicalClustering, DBSCAN, GaussianMixture,
  spectralClustering,
  silhouetteScore, daviesBouldinIndex, calinskiHarabaszIndex,
  elbowMethod,
} from './clustering';
export type { KMeansConfig, Linkage } from './clustering';

// ─── Anomaly Detection ───────────────────────────────────────────────────────
export {
  zScoreAnomaly, modifiedZScoreAnomaly, grubbsTest, iqrAnomaly,
  IsolationForest, LocalOutlierFactor,
  cusumAnomaly, bollingerBandAnomaly,
  mahalanobisAnomaly, pcaReconstructionAnomaly,
  OnlineAnomalyDetector,
  detectMarketAnomalies, correlationBreakDetection,
  rankAnomalies,
} from './anomaly';
export type { MarketAnomalyConfig } from './anomaly';

// ─── Evaluation ──────────────────────────────────────────────────────────────
export {
  meanSquaredError, rootMeanSquaredError, meanAbsoluteError,
  meanAbsolutePercentageError,
  rSquared, adjustedRSquared,
  accuracy, confusionMatrix, precision, recall, f1Score,
  classificationReport, aucRoc,
  kFoldSplit, timeSeriesCVSplit, purgedCVSplit, crossValidate,
  learningCurve,
  permutationImportance, approximateShap,
  biasVarianceDecomposition,
  aic, bic, logLikelihoodGaussian,
  pairedTTest, wilcoxonSignedRank,
} from './evaluation';
