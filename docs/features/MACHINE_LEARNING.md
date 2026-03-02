# Machine Learning for Trading

Client-side ML models for anomaly detection, clustering, regression, decision trees, data preprocessing, and time series forecasting — all running in Web Workers for non-blocking performance.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Anomaly Detection](#anomaly-detection)
- [Clustering](#clustering)
- [Linear Models](#linear-models)
- [Decision Trees](#decision-trees)
- [Data Preprocessing](#data-preprocessing)
- [Time Series Forecasting](#time-series-forecasting)
- [Model Pipeline](#model-pipeline)

## Overview

The ML module (`lib/ml/`) implements lightweight machine learning algorithms in TypeScript, designed to run entirely in the browser via Web Workers. No server-side inference is required for core functionality.

```typescript
import { AnomalyDetector } from '@/lib/ml/anomaly';
import { KMeans } from '@/lib/ml/clustering';
import { LinearRegression } from '@/lib/ml/linearModels';
import { DecisionTree } from '@/lib/ml/trees';
import { Preprocessor } from '@/lib/ml/preprocessing';
import { ARIMAModel } from '@/lib/ml/timeSeries';
```

## Architecture

All models conform to a shared interface for consistent pipeline integration:

```typescript
interface MLModel<TInput, TOutput> {
  fit(data: TInput[]): void;
  predict(input: TInput): TOutput;
  score(testData: TInput[], labels: TOutput[]): number;
  serialize(): ArrayBuffer;
  static deserialize(buffer: ArrayBuffer): MLModel<TInput, TOutput>;
}
```

Heavy computations are offloaded to `workers/mlWorker.ts`, which manages model lifecycle and batch predictions without blocking the UI thread.

## Anomaly Detection

Identifies unusual market behavior using statistical and distance-based methods:

```typescript
const detector = new AnomalyDetector({
  method: 'isolation-forest',  // 'isolation-forest' | 'z-score' | 'mad' | 'local-outlier-factor'
  contamination: 0.05,
  windowSize: 100,
});

detector.fit(historicalReturns);

const result = detector.predict(latestDataPoint);
// { isAnomaly: true, score: 0.92, threshold: 0.85 }
```

Use cases include flash crash detection, unusual volume spikes, and abnormal spread widening. The isolation forest implementation uses random feature splits optimized for streaming data.

## Clustering

Group securities by behavior patterns using unsupervised learning:

### K-Means

```typescript
const kmeans = new KMeans({
  k: 5,
  maxIterations: 300,
  distanceMetric: 'euclidean',
  initialization: 'kmeans++',
});

const features = stocks.map(s => [s.returns30d, s.volatility, s.volume, s.momentum]);
kmeans.fit(features);

const clusters = kmeans.predict(features);
// [0, 2, 1, 0, 4, ...] — cluster assignment per stock
const centroids = kmeans.getCentroids();
```

### DBSCAN

```typescript
const dbscan = new DBSCAN({
  epsilon: 0.5,
  minPoints: 3,
  distanceMetric: 'correlation',
});

const { clusters, noise } = dbscan.fit(features);
// Density-based clustering — no need to predefine k
// noise array contains outlier indices
```

Applications: sector rotation detection, correlation regime identification, portfolio diversification analysis.

## Linear Models

Regression and regularized variants for factor modeling:

```typescript
const ridge = new RidgeRegression({ alpha: 1.0 });
ridge.fit(factorExposures, returns);

const predicted = ridge.predict(currentFactors);
const coefficients = ridge.getCoefficients();
// Factor loadings: { momentum: 0.32, value: -0.15, size: 0.08, ... }

const lasso = new LassoRegression({ alpha: 0.5 });
lasso.fit(factorExposures, returns);
// Sparse coefficients — automatic feature selection
const selectedFactors = lasso.getNonZeroFeatures();
```

The ordinary least squares, Ridge (L2), and Lasso (L1) implementations support incremental updates for online learning as new data arrives.

## Decision Trees

Tree-based models for classification and non-linear pattern recognition:

```typescript
const tree = new DecisionTree({
  maxDepth: 8,
  minSamplesLeaf: 10,
  criterion: 'gini',           // 'gini' | 'entropy' | 'mse'
  featureNames: ['rsi', 'macd', 'volume_ratio', 'atr', 'bb_width'],
});

tree.fit(trainingFeatures, labels);  // labels: 'buy' | 'sell' | 'hold'

const prediction = tree.predict(currentFeatures);
// { label: 'buy', confidence: 0.78, path: ['rsi > 30', 'macd > 0', 'volume_ratio > 1.5'] }
```

Decision path visualization renders the tree structure as an interactive SVG, showing split criteria and leaf distributions.

## Data Preprocessing

The preprocessing module standardizes data preparation for all models:

```typescript
const preprocessor = new Preprocessor();

const pipeline = preprocessor.createPipeline([
  { type: 'fillMissing', strategy: 'forward-fill' },
  { type: 'normalize', method: 'min-max', range: [0, 1] },
  { type: 'featureEngineer', transforms: [
    { name: 'returns_5d', fn: (row) => (row.close - row.close_5d_ago) / row.close_5d_ago },
    { name: 'vol_ratio', fn: (row) => row.volume / row.avg_volume_20d },
  ]},
  { type: 'removeOutliers', method: 'iqr', multiplier: 1.5 },
]);

const cleanData = pipeline.transform(rawData);
const inversed = pipeline.inverseTransform(predictions);
```

Pipelines are serializable and reusable, ensuring consistent preprocessing between training and inference.

## Time Series Forecasting

Statistical and neural-inspired forecasting models:

### ARIMA

```typescript
const arima = new ARIMAModel({ p: 2, d: 1, q: 1 });
arima.fit(priceHistory);

const forecast = arima.forecast(10);
// { values: [...], confidenceBands: { upper95: [...], lower95: [...] } }
```

### LSTM-Style Recurrent Model

```typescript
const lstm = new RecurrentForecaster({
  inputSize: 5,
  hiddenSize: 32,
  sequenceLength: 60,
  outputSteps: 5,
  learningRate: 0.001,
  epochs: 100,
});

lstm.fit(sequenceData);
const prediction = lstm.forecast(currentSequence);
// Multi-step ahead prediction with uncertainty estimates
```

The LSTM-style implementation uses a simplified recurrent architecture compiled to WebAssembly for near-native inference speed.

## Model Pipeline

End-to-end pipeline combining preprocessing, training, evaluation, and deployment:

```typescript
const pipeline = new MLPipeline({
  preprocessing: preprocessor.createPipeline([...]),
  model: new RidgeRegression({ alpha: 1.0 }),
  validation: { method: 'walk-forward', trainWindow: 252, testWindow: 21 },
  metrics: ['mae', 'rmse', 'sharpe', 'hit-rate'],
});

const results = pipeline.run(dataset);
// results.metrics: { mae: 0.012, rmse: 0.018, sharpe: 1.45, hitRate: 0.58 }
// results.predictions: walk-forward out-of-sample predictions
```

Walk-forward validation prevents look-ahead bias by strictly respecting temporal ordering during cross-validation splits.
