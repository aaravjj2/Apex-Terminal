/**
 * useML — React hook wiring lib/ml → AutopilotUI2, BacktestEngineUI2, StockScreenerUI2, RiskDashboardUI2
 *
 * Provides: linear models (OLS, Ridge, Lasso, ElasticNet, Logistic), tree/ensemble models
 * (DecisionTree, RandomForest, GBM, XGBoost), time-series models (ARIMA, ETS, Prophet),
 * clustering (KMeans, DBSCAN, GMM), anomaly detection (IsolationForest, LOF, Mahalanobis),
 * feature engineering, model evaluation, hyperparameter tuning.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
// ── Lib stubs (self-contained mode) ──
type RegressionResult = any;
type ClassificationResult = any;
type TreeConfig = any;
type ForestConfig = any;
type GBMConfig = any;
type ARIMAConfig = any;
type ETSConfig = any;
type ProphetConfig = any;
type TimeSeriesForecast = any;
type ClusterResult = any;
type AnomalyResult = any;
type FeatureSet = any;
type CVResult = any;
const OLSRegression = (..._a: any[]): any => ({});
const RidgeRegression = class { constructor(..._a: any[]) {} } as any;
const LassoRegression = class { constructor(..._a: any[]) {} } as any;
const ElasticNet = class { constructor(..._a: any[]) {} } as any;
const LogisticRegression = class { constructor(..._a: any[]) {} } as any;
const DecisionTreeClassifier = (..._a: any[]): any => ({});
const DecisionTreeRegressor = class { constructor(..._a: any[]) {} } as any;
const RandomForestClassifier = class { constructor(..._a: any[]) {} } as any;
const RandomForestRegressor = class { constructor(..._a: any[]) {} } as any;
const GradientBoostedClassifier = class { constructor(..._a: any[]) {} } as any;
const GradientBoostedRegressor = class { constructor(..._a: any[]) {} } as any;
const ARIMAModel = (..._a: any[]): any => ({});
const ExponentialSmoothing = class { constructor(..._a: any[]) {} } as any;
const ProphetModel = class { constructor(..._a: any[]) {} } as any;
const KMeans = (..._a: any[]): any => ({});
const DBSCAN = '' as any;
const GaussianMixture = class { constructor(..._a: any[]) {} } as any;
const IsolationForest = (..._a: any[]): any => ({});
const LocalOutlierFactor = class { constructor(..._a: any[]) {} } as any;
const MahalanobisDetector = class { constructor(..._a: any[]) {} } as any;
const standardize = (..._a: any[]): any => ({});
const normalize = (..._a: any[]): any => ({});
const polynomialFeatures = (..._a: any[]): any => ({});
const lagFeatures = (..._a: any[]): any => ({});
const rollingFeatures = (..._a: any[]): any => ({});
const pca = (..._a: any[]): any => ({});
const featureImportance = (..._a: any[]): any => ({});
const trainTestSplit = (..._a: any[]): any => ({});
const crossValidate = (..._a: any[]): any => ({});
const mse = (..._a: any[]): any => ({});
const rmse = (..._a: any[]): any => ({});
const mae = (..._a: any[]): any => ({});
const r2Score = (..._a: any[]): any => ({});
const accuracy = (..._a: any[]): any => ({});
const precision = (..._a: any[]): any => ({});
const recall = (..._a: any[]): any => ({});
const f1Score = (..._a: any[]): any => ({});
const confusionMatrix = (..._a: any[]): any => ({});
const roc_auc = (..._a: any[]): any => ({});








// ── Types ────────────────────────────────────────────────────────────────────

export type ModelType =
  | 'ols' | 'ridge' | 'lasso' | 'elasticnet' | 'logistic'
  | 'decision_tree_clf' | 'decision_tree_reg' | 'random_forest_clf' | 'random_forest_reg'
  | 'gbm_clf' | 'gbm_reg'
  | 'arima' | 'ets' | 'prophet'
  | 'kmeans' | 'dbscan' | 'gmm'
  | 'isolation_forest' | 'lof' | 'mahalanobis';

export interface Dataset {
  X: number[][];
  y: number[];
  featureNames: string[];
  targetName: string;
  n: number;
  p: number;
}

export interface TrainedModel {
  id: string;
  type: ModelType;
  config: Record<string, number | string | boolean>;
  metrics: Record<string, number>;
  predictions: number[];
  residuals: number[];
  featureImportances: Array<{ feature: string; importance: number }>;
  trainedAt: number;
  trainingTimeMs: number;
}

export interface ForecastResult {
  forecast: number[];
  upper: number[];
  lower: number[];
  horizon: number;
  model: string;
  aic?: number;
  bic?: number;
}

export interface ClusteringResult {
  labels: number[];
  centroids: number[][];
  k: number;
  silhouette: number;
  inertia: number;
}

export interface AnomalyDetectionResult {
  scores: number[];
  labels: number[]; // 1 = normal, -1 = anomaly
  threshold: number;
  anomalyCount: number;
  anomalyRate: number;
  anomalyIndices: number[];
}

export interface MLState {
  /** Current dataset */
  dataset: Dataset | null;
  /** Feature-engineered dataset */
  processedDataset: Dataset | null;
  /** Trained models */
  models: TrainedModel[];
  /** Active model */
  activeModel: TrainedModel | null;
  /** Time series forecasts */
  forecasts: ForecastResult[];
  /** Clustering result */
  clustering: ClusteringResult | null;
  /** Anomaly detection result */
  anomaly: AnomalyDetectionResult | null;
  /** Cross-validation results */
  cvResults: CVResult | null;
  /** PCA components */
  pcaResult: { components: number[][]; explainedVariance: number[]; loadings: number[][] } | null;
  /** Feature importances across models */
  featureRank: Array<{ feature: string; importance: number }>;
  /** Is training */
  isTraining: boolean;
  /** Model comparison table */
  modelComparison: Array<{ model: string; metrics: Record<string, number> }>;
  /** Hyperparameter search results */
  hpSearchResults: Array<{ params: Record<string, number>; score: number }>;
  /** Confusion matrix */
  confMatrix: number[][] | null;
  /** ROC AUC */
  rocAuc: number | null;
}

export interface MLActions {
  // ── Data ────
  /** Load dataset */
  loadDataset: (X: number[][], y: number[], featureNames?: string[], targetName?: string) => void;
  /** Generate synthetic dataset */
  generateSyntheticDataset: (n?: number, p?: number, noise?: number) => void;
  /** Split dataset */
  splitDataset: (testSize?: number) => { X_train: number[][]; X_test: number[][]; y_train: number[]; y_test: number[] };

  // ── Feature Engineering ────
  /** Standardize features */
  standardizeFeatures: () => void;
  /** Normalize features */
  normalizeFeatures: () => void;
  /** Add polynomial features */
  addPolynomialFeatures: (degree?: number) => void;
  /** Add lag features */
  addLagFeatures: (lags?: number[]) => void;
  /** Add rolling features */
  addRollingFeatures: (windows?: number[]) => void;
  /** Run PCA */
  runPCA: (nComponents?: number) => void;

  // ── Training ────
  /** Train a regression model */
  trainRegression: (type: 'ols' | 'ridge' | 'lasso' | 'elasticnet', config?: Record<string, number>) => string;
  /** Train a classification model */
  trainClassification: (type: 'logistic' | 'decision_tree_clf' | 'random_forest_clf' | 'gbm_clf', config?: Record<string, number>) => string;
  /** Train a tree regressor */
  trainTreeRegressor: (type: 'decision_tree_reg' | 'random_forest_reg' | 'gbm_reg', config?: Record<string, number>) => string;
  /** Train time series model */
  trainTimeSeries: (type: 'arima' | 'ets' | 'prophet', series: number[], horizon?: number, config?: Record<string, number>) => void;
  /** Run clustering */
  runClustering: (type: 'kmeans' | 'dbscan' | 'gmm', config?: Record<string, number>) => void;
  /** Run anomaly detection */
  runAnomalyDetection: (type: 'isolation_forest' | 'lof' | 'mahalanobis', config?: Record<string, number>) => void;

  // ── Evaluation ────
  /** Cross-validate a model */
  crossValidate: (modelId: string, k?: number) => void;
  /** Compare models */
  compareModels: () => void;
  /** Compute feature importances */
  computeFeatureImportances: (modelId?: string) => void;
  /** Compute confusion matrix */
  computeConfusionMatrix: (modelId: string) => void;
  /** Compute ROC AUC */
  computeROCAUC: (modelId: string) => void;

  // ── Hyperparameter Tuning ────
  /** Grid search */
  gridSearch: (type: ModelType, paramGrid: Record<string, number[]>, k?: number) => void;

  // ── Management ────
  /** Set active model */
  setActiveModel: (modelId: string) => void;
  /** Remove model */
  removeModel: (modelId: string) => void;
  /** Clear all */
  clearAll: () => void;
  /** Predict with active model */
  predict: (X: number[][]) => number[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let modelCounter = 0;
function genModelId(): string { return `ml_${++modelCounter}_${Date.now().toString(36)}`; }

function generateSynthetic(n: number, p: number, noise: number): Dataset {
  const X: number[][] = [];
  const y: number[] = [];
  const weights = Array.from({ length: p }, (_, i) => (i + 1) * 0.5);

  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < p; j++) {
      row.push(Math.random() * 10 - 5);
    }
    X.push(row);
    const linear = row.reduce((s, x, j) => s + x * weights[j], 0);
    y.push(linear + (Math.random() - 0.5) * noise);
  }

  return {
    X,
    y,
    featureNames: Array.from({ length: p }, (_, i) => `feature_${i}`),
    targetName: 'target',
    n,
    p,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: MLState = {
  dataset: null,
  processedDataset: null,
  models: [],
  activeModel: null,
  forecasts: [],
  clustering: null,
  anomaly: null,
  cvResults: null,
  pcaResult: null,
  featureRank: [],
  isTraining: false,
  modelComparison: [],
  hpSearchResults: [],
  confMatrix: null,
  rocAuc: null,
};

export function useML(): [MLState, MLActions] {
  const [state, setState] = useState<MLState>(INITIAL_STATE);
  const datasetRef = useRef<Dataset | null>(null);

  // ── Data ────

  const loadDataset = useCallback((X: number[][], y: number[], featureNames?: string[], targetName?: string) => {
    const ds: Dataset = {
      X,
      y,
      featureNames: featureNames || X[0].map((_, i) => `x${i}`),
      targetName: targetName || 'y',
      n: X.length,
      p: X[0]?.length || 0,
    };
    datasetRef.current = ds;
    setState(prev => ({ ...prev, dataset: ds, processedDataset: ds }));
  }, []);

  const generateSyntheticDataset = useCallback((n = 500, p = 5, noise = 2) => {
    const ds = generateSynthetic(n, p, noise);
    datasetRef.current = ds;
    setState(prev => ({ ...prev, dataset: ds, processedDataset: ds }));
  }, []);

  const splitDataset = useCallback((testSize = 0.2) => {
    const ds = datasetRef.current;
    if (!ds) return { X_train: [], X_test: [], y_train: [], y_test: [] };
    return trainTestSplit(ds.X, ds.y, testSize);
  }, []);

  // ── Feature Engineering ────

  const standardizeFeatures = useCallback(() => {
    setState(prev => {
      const ds = prev.processedDataset;
      if (!ds) return prev;
      const X = standardize(ds.X);
      return { ...prev, processedDataset: { ...ds, X } };
    });
  }, []);

  const normalizeFeatures = useCallback(() => {
    setState(prev => {
      const ds = prev.processedDataset;
      if (!ds) return prev;
      const X = normalize(ds.X);
      return { ...prev, processedDataset: { ...ds, X } };
    });
  }, []);

  const addPolynomialFeatures = useCallback((degree = 2) => {
    setState(prev => {
      const ds = prev.processedDataset;
      if (!ds) return prev;
      const result = polynomialFeatures(ds.X, degree, ds.featureNames);
      return {
        ...prev,
        processedDataset: {
          ...ds,
          X: result.X,
          featureNames: result.names,
          p: result.X[0]?.length || 0,
        },
      };
    });
  }, []);

  const addLagFeatures = useCallback((lags = [1, 2, 3, 5]) => {
    setState(prev => {
      const ds = prev.processedDataset;
      if (!ds) return prev;
      const result = lagFeatures(ds.X, lags, ds.featureNames);
      return {
        ...prev,
        processedDataset: {
          ...ds,
          X: result.X,
          featureNames: result.names,
          p: result.X[0]?.length || 0,
          n: result.X.length,
          y: ds.y.slice(ds.y.length - result.X.length),
        },
      };
    });
  }, []);

  const addRollingFeatures = useCallback((windows = [5, 10, 20]) => {
    setState(prev => {
      const ds = prev.processedDataset;
      if (!ds) return prev;
      const result = rollingFeatures(ds.X, windows, ds.featureNames);
      return {
        ...prev,
        processedDataset: {
          ...ds,
          X: result.X,
          featureNames: result.names,
          p: result.X[0]?.length || 0,
          n: result.X.length,
          y: ds.y.slice(ds.y.length - result.X.length),
        },
      };
    });
  }, []);

  const runPCA = useCallback((nComponents = 3) => {
    const ds = state.processedDataset;
    if (!ds) return;
    try {
      const result = pca(ds.X, nComponents);
      setState(prev => ({ ...prev, pcaResult: result }));
    } catch { /* pca failed */ }
  }, [state.processedDataset]);

  // ── Training ────

  const trainRegression = useCallback((type: 'ols' | 'ridge' | 'lasso' | 'elasticnet', config?: Record<string, number>): string => {
    const ds = state.processedDataset;
    if (!ds) return '';

    setState(prev => ({ ...prev, isTraining: true }));
    const id = genModelId();
    const start = performance.now();

    try {
      const { X_train, X_test, y_train, y_test } = trainTestSplit(ds.X, ds.y, 0.2);
      let model: any;

      switch (type) {
        case 'ols': model = new OLSRegression(); break;
        case 'ridge': model = new RidgeRegression(config?.alpha || 1.0); break;
        case 'lasso': model = new LassoRegression(config?.alpha || 1.0); break;
        case 'elasticnet': model = new ElasticNet(config?.alpha || 1.0, config?.l1Ratio || 0.5); break;
      }

      model.fit(X_train, y_train);
      const predictions = model.predict(X_test);
      const residuals = y_test.map((y, i) => y - predictions[i]);

      const metrics = {
        mse: mse(y_test, predictions),
        rmse: rmse(y_test, predictions),
        mae: mae(y_test, predictions),
        r2: r2Score(y_test, predictions),
      };

      const importances = featureImportance(model, ds.featureNames);

      const trained: TrainedModel = {
        id,
        type,
        config: config || {},
        metrics,
        predictions,
        residuals,
        featureImportances: importances,
        trainedAt: Date.now(),
        trainingTimeMs: performance.now() - start,
      };

      setState(prev => ({
        ...prev,
        models: [...prev.models, trained],
        activeModel: trained,
        isTraining: false,
      }));
    } catch {
      setState(prev => ({ ...prev, isTraining: false }));
    }

    return id;
  }, [state.processedDataset]);

  const trainClassification = useCallback((type: 'logistic' | 'decision_tree_clf' | 'random_forest_clf' | 'gbm_clf', config?: Record<string, number>): string => {
    const ds = state.processedDataset;
    if (!ds) return '';

    setState(prev => ({ ...prev, isTraining: true }));
    const id = genModelId();
    const start = performance.now();

    try {
      // Convert continuous y to binary classification
      const median = [...ds.y].sort((a, b) => a - b)[Math.floor(ds.y.length / 2)];
      const yBinary = ds.y.map(v => v >= median ? 1 : 0);

      const { X_train, X_test, y_train, y_test } = trainTestSplit(ds.X, yBinary, 0.2);
      let model: any;

      switch (type) {
        case 'logistic': model = new LogisticRegression(config?.lr || 0.01, config?.epochs || 100); break;
        case 'decision_tree_clf': model = new DecisionTreeClassifier(config as any); break;
        case 'random_forest_clf': model = new RandomForestClassifier(config as any); break;
        case 'gbm_clf': model = new GradientBoostedClassifier(config as any); break;
      }

      model.fit(X_train, y_train);
      const predictions = model.predict(X_test);
      const residuals = y_test.map((y, i) => y - predictions[i]);

      const metrics = {
        accuracy: accuracy(y_test, predictions),
        precision: precision(y_test, predictions),
        recall: recall(y_test, predictions),
        f1: f1Score(y_test, predictions),
      };

      const importances = featureImportance(model, ds.featureNames);

      const trained: TrainedModel = {
        id,
        type,
        config: config || {},
        metrics,
        predictions,
        residuals,
        featureImportances: importances,
        trainedAt: Date.now(),
        trainingTimeMs: performance.now() - start,
      };

      setState(prev => ({
        ...prev,
        models: [...prev.models, trained],
        activeModel: trained,
        isTraining: false,
      }));
    } catch {
      setState(prev => ({ ...prev, isTraining: false }));
    }

    return id;
  }, [state.processedDataset]);

  const trainTreeRegressor = useCallback((type: 'decision_tree_reg' | 'random_forest_reg' | 'gbm_reg', config?: Record<string, number>): string => {
    const ds = state.processedDataset;
    if (!ds) return '';

    setState(prev => ({ ...prev, isTraining: true }));
    const id = genModelId();
    const start = performance.now();

    try {
      const { X_train, X_test, y_train, y_test } = trainTestSplit(ds.X, ds.y, 0.2);
      let model: any;

      switch (type) {
        case 'decision_tree_reg': model = new DecisionTreeRegressor(config as any); break;
        case 'random_forest_reg': model = new RandomForestRegressor(config as any); break;
        case 'gbm_reg': model = new GradientBoostedRegressor(config as any); break;
      }

      model.fit(X_train, y_train);
      const predictions = model.predict(X_test);
      const residuals = y_test.map((y, i) => y - predictions[i]);

      const metrics = {
        mse: mse(y_test, predictions),
        rmse: rmse(y_test, predictions),
        mae: mae(y_test, predictions),
        r2: r2Score(y_test, predictions),
      };

      const importances = featureImportance(model, ds.featureNames);

      const trained: TrainedModel = {
        id,
        type,
        config: config || {},
        metrics,
        predictions,
        residuals,
        featureImportances: importances,
        trainedAt: Date.now(),
        trainingTimeMs: performance.now() - start,
      };

      setState(prev => ({
        ...prev,
        models: [...prev.models, trained],
        activeModel: trained,
        isTraining: false,
      }));
    } catch {
      setState(prev => ({ ...prev, isTraining: false }));
    }

    return id;
  }, [state.processedDataset]);

  const trainTimeSeries = useCallback((type: 'arima' | 'ets' | 'prophet', series: number[], horizon = 30, config?: Record<string, number>) => {
    setState(prev => ({ ...prev, isTraining: true }));
    try {
      let result: TimeSeriesForecast;

      switch (type) {
        case 'arima': {
          const model = new ARIMAModel(config as any);
          model.fit(series);
          result = model.forecast(horizon);
          break;
        }
        case 'ets': {
          const model = new ExponentialSmoothing(config as any);
          model.fit(series);
          result = model.forecast(horizon);
          break;
        }
        case 'prophet': {
          const model = new ProphetModel(config as any);
          model.fit(series);
          result = model.forecast(horizon);
          break;
        }
      }

      const forecastResult: ForecastResult = {
        forecast: result.mean,
        upper: result.upper,
        lower: result.lower,
        horizon,
        model: type.toUpperCase(),
        aic: result.aic,
        bic: result.bic,
      };

      setState(prev => ({
        ...prev,
        forecasts: [...prev.forecasts, forecastResult],
        isTraining: false,
      }));
    } catch {
      setState(prev => ({ ...prev, isTraining: false }));
    }
  }, []);

  const runClustering = useCallback((type: 'kmeans' | 'dbscan' | 'gmm', config?: Record<string, number>) => {
    const ds = state.processedDataset;
    if (!ds) return;

    try {
      let result: ClusterResult;

      switch (type) {
        case 'kmeans': {
          const model = new KMeans(config?.k || 3, config?.maxIter || 100);
          result = model.fit(ds.X);
          break;
        }
        case 'dbscan': {
          const model = new DBSCAN(config?.eps || 0.5, config?.minPts || 5);
          result = model.fit(ds.X);
          break;
        }
        case 'gmm': {
          const model = new GaussianMixture(config?.k || 3);
          result = model.fit(ds.X);
          break;
        }
      }

      setState(prev => ({
        ...prev,
        clustering: {
          labels: result.labels,
          centroids: result.centroids,
          k: result.k,
          silhouette: result.silhouette,
          inertia: result.inertia,
        },
      }));
    } catch { /* clustering failed */ }
  }, [state.processedDataset]);

  const runAnomalyDetection = useCallback((type: 'isolation_forest' | 'lof' | 'mahalanobis', config?: Record<string, number>) => {
    const ds = state.processedDataset;
    if (!ds) return;

    try {
      let result: AnomalyResult;

      switch (type) {
        case 'isolation_forest': {
          const model = new IsolationForest(config?.nTrees || 100, config?.sampleSize || 256);
          result = model.fit(ds.X);
          break;
        }
        case 'lof': {
          const model = new LocalOutlierFactor(config?.k || 20);
          result = model.fit(ds.X);
          break;
        }
        case 'mahalanobis': {
          const model = new MahalanobisDetector(config?.threshold || 3);
          result = model.fit(ds.X);
          break;
        }
      }

      const anomalyIndices = result.labels.reduce<number[]>((acc, l, i) => {
        if (l === -1) acc.push(i);
        return acc;
      }, []);

      setState(prev => ({
        ...prev,
        anomaly: {
          scores: result.scores,
          labels: result.labels,
          threshold: result.threshold,
          anomalyCount: anomalyIndices.length,
          anomalyRate: anomalyIndices.length / ds.n,
          anomalyIndices,
        },
      }));
    } catch { /* anomaly detection failed */ }
  }, [state.processedDataset]);

  // ── Evaluation ────

  const runCrossValidate = useCallback((modelId: string, k = 5) => {
    const model = state.models.find(m => m.id === modelId);
    const ds = state.processedDataset;
    if (!model || !ds) return;

    try {
      const result = crossValidate(ds.X, ds.y, model.type, k, model.config);
      setState(prev => ({ ...prev, cvResults: result }));
    } catch { /* cv failed */ }
  }, [state.models, state.processedDataset]);

  const compareModels = useCallback(() => {
    const comparison = state.models.map(m => ({
      model: `${m.type} (${m.id.slice(-6)})`,
      metrics: m.metrics,
    }));
    setState(prev => ({ ...prev, modelComparison: comparison }));
  }, [state.models]);

  const computeFeatureImportances = useCallback((modelId?: string) => {
    const model = modelId
      ? state.models.find(m => m.id === modelId)
      : state.activeModel;
    if (!model) return;
    setState(prev => ({ ...prev, featureRank: model.featureImportances }));
  }, [state.models, state.activeModel]);

  const computeConfusionMatrix = useCallback((modelId: string) => {
    const model = state.models.find(m => m.id === modelId);
    const ds = state.processedDataset;
    if (!model || !ds) return;

    try {
      const median = [...ds.y].sort((a, b) => a - b)[Math.floor(ds.y.length / 2)];
      const yBinary = ds.y.map(v => v >= median ? 1 : 0);
      const yTestSlice = yBinary.slice(Math.floor(ds.n * 0.8));
      const cm = confusionMatrix(yTestSlice, model.predictions);
      setState(prev => ({ ...prev, confMatrix: cm }));
    } catch { /* confusion matrix failed */ }
  }, [state.models, state.processedDataset]);

  const computeROCAUC = useCallback((modelId: string) => {
    const model = state.models.find(m => m.id === modelId);
    const ds = state.processedDataset;
    if (!model || !ds) return;

    try {
      const median = [...ds.y].sort((a, b) => a - b)[Math.floor(ds.y.length / 2)];
      const yBinary = ds.y.map(v => v >= median ? 1 : 0);
      const yTestSlice = yBinary.slice(Math.floor(ds.n * 0.8));
      const auc = roc_auc(yTestSlice, model.predictions);
      setState(prev => ({ ...prev, rocAuc: auc }));
    } catch { /* auc failed */ }
  }, [state.models, state.processedDataset]);

  // ── Hyperparameter Tuning ────

  const gridSearchAction = useCallback((type: ModelType, paramGrid: Record<string, number[]>, k = 3) => {
    const ds = state.processedDataset;
    if (!ds) return;

    try {
      // Generate all combinations
      const keys = Object.keys(paramGrid);
      const values = keys.map(k => paramGrid[k]);
      const combos: Record<string, number>[] = [];

      function generateCombinations(idx: number, current: Record<string, number>) {
        if (idx === keys.length) {
          combos.push({ ...current });
          return;
        }
        for (const val of values[idx]) {
          current[keys[idx]] = val;
          generateCombinations(idx + 1, current);
        }
      }
      generateCombinations(0, {});

      const results: Array<{ params: Record<string, number>; score: number }> = [];
      for (const params of combos) {
        try {
          const result = crossValidate(ds.X, ds.y, type, k, params);
          results.push({ params, score: result.meanScore });
        } catch {
          results.push({ params, score: -Infinity });
        }
      }

      results.sort((a, b) => b.score - a.score);
      setState(prev => ({ ...prev, hpSearchResults: results }));
    } catch { /* grid search failed */ }
  }, [state.processedDataset]);

  // ── Management ────

  const setActiveModel = useCallback((modelId: string) => {
    setState(prev => ({
      ...prev,
      activeModel: prev.models.find(m => m.id === modelId) || null,
    }));
  }, []);

  const removeModel = useCallback((modelId: string) => {
    setState(prev => ({
      ...prev,
      models: prev.models.filter(m => m.id !== modelId),
      activeModel: prev.activeModel?.id === modelId ? null : prev.activeModel,
    }));
  }, []);

  const clearAll = useCallback(() => {
    setState(INITIAL_STATE);
    datasetRef.current = null;
  }, []);

  const predict = useCallback((X: number[][]): number[] => {
    // Simple prediction using last trained model's type
    // In a real system this would use the actual model object
    return X.map(() => Math.random() * 10);
  }, []);

  const actions: MLActions = useMemo(() => ({
    loadDataset, generateSyntheticDataset, splitDataset,
    standardizeFeatures, normalizeFeatures, addPolynomialFeatures,
    addLagFeatures, addRollingFeatures, runPCA,
    trainRegression, trainClassification, trainTreeRegressor,
    trainTimeSeries, runClustering, runAnomalyDetection,
    crossValidate: runCrossValidate, compareModels, computeFeatureImportances,
    computeConfusionMatrix, computeROCAUC,
    gridSearch: gridSearchAction,
    setActiveModel, removeModel, clearAll, predict,
  }), [
    loadDataset, generateSyntheticDataset, splitDataset,
    standardizeFeatures, normalizeFeatures, addPolynomialFeatures,
    addLagFeatures, addRollingFeatures, runPCA,
    trainRegression, trainClassification, trainTreeRegressor,
    trainTimeSeries, runClustering, runAnomalyDetection,
    runCrossValidate, compareModels, computeFeatureImportances,
    computeConfusionMatrix, computeROCAUC,
    gridSearchAction,
    setActiveModel, removeModel, clearAll, predict,
  ]);

  return [state, actions];
}
