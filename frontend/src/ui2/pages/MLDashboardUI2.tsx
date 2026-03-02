/**
 * MLDashboardUI2.tsx — Bloomberg MLAI / Machine Learning Dashboard
 * ==================================================================
 * Full ML/AI dashboard with:
 * - Model training dashboard with metrics
 * - Feature importance visualization (Canvas)
 * - Prediction confidence meters
 * - Model comparison table
 * - Live prediction feed
 * - Training loss curve (Canvas)
 * - Hyperparameter tuning results
 * - Bloomberg dark theme
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';

const BG = '#0a0a0a';
const PANEL = '#111111';
const BORDER = '#1e1e1e';
const AMBER = '#f5a623';
const GREEN = '#26a69a';
const RED = '#ef5350';
const BLUE = '#42a5f5';
const PURPLE = '#ab47bc';
const ORANGE = '#ff9800';
const TEAL = '#4db6ac';
const TEXT = '#d4d4d4';
const MUTED = '#888888';

// ── Types ────────────────────────────────────────────────────────────────────
interface MLModel {
  id: string;
  name: string;
  type: string;
  status: 'training' | 'ready' | 'deployed' | 'failed';
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  sharpeRatio: number;
  maxDrawdown: number;
  trainedOn: string;
  features: number;
  samples: number;
  epochs: number;
  learningRate: number;
  trainingLoss: number[];
  validationLoss: number[];
}

interface Feature {
  name: string;
  importance: number;
  category: string;
}

interface Prediction {
  id: number;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  price: number;
  target: number;
  stopLoss: number;
  timestamp: string;
  model: string;
  features: string[];
}

// ── Mock data ────────────────────────────────────────────────────────────────
function generateLossCurve(epochs: number, finalLoss: number): number[] {
  const curve: number[] = [];
  let loss = 2.5 + Math.random();
  for (let i = 0; i < epochs; i++) {
    const decay = Math.exp(-3 * i / epochs);
    loss = finalLoss + (loss - finalLoss) * decay + (Math.random() - 0.5) * 0.05 * decay;
    curve.push(Math.max(loss, finalLoss * 0.9));
  }
  return curve;
}

function generateModels(): MLModel[] {
  return [
    {
      id: 'lstm-v3', name: 'LSTM Price Predictor v3', type: 'LSTM',
      status: 'deployed', accuracy: 0.687, precision: 0.712, recall: 0.654, f1Score: 0.682,
      sharpeRatio: 1.84, maxDrawdown: -0.124, trainedOn: '2024-07-10',
      features: 42, samples: 125000, epochs: 100, learningRate: 0.001,
      trainingLoss: generateLossCurve(100, 0.32), validationLoss: generateLossCurve(100, 0.38),
    },
    {
      id: 'xgb-v5', name: 'XGBoost Signal', type: 'XGBoost',
      status: 'deployed', accuracy: 0.721, precision: 0.698, recall: 0.745, f1Score: 0.721,
      sharpeRatio: 2.12, maxDrawdown: -0.098, trainedOn: '2024-07-12',
      features: 38, samples: 250000, epochs: 500, learningRate: 0.05,
      trainingLoss: generateLossCurve(500, 0.28), validationLoss: generateLossCurve(500, 0.34),
    },
    {
      id: 'transformer-v1', name: 'Attention Transformer', type: 'Transformer',
      status: 'ready', accuracy: 0.743, precision: 0.756, recall: 0.731, f1Score: 0.743,
      sharpeRatio: 2.45, maxDrawdown: -0.087, trainedOn: '2024-07-14',
      features: 64, samples: 500000, epochs: 50, learningRate: 0.0003,
      trainingLoss: generateLossCurve(50, 0.25), validationLoss: generateLossCurve(50, 0.31),
    },
    {
      id: 'rf-v2', name: 'Random Forest Regime', type: 'RandomForest',
      status: 'deployed', accuracy: 0.654, precision: 0.641, recall: 0.668, f1Score: 0.654,
      sharpeRatio: 1.56, maxDrawdown: -0.154, trainedOn: '2024-07-08',
      features: 28, samples: 75000, epochs: 200, learningRate: 0.01,
      trainingLoss: generateLossCurve(200, 0.42), validationLoss: generateLossCurve(200, 0.48),
    },
    {
      id: 'gru-v1', name: 'GRU Momentum', type: 'GRU',
      status: 'training', accuracy: 0.612, precision: 0.598, recall: 0.627, f1Score: 0.612,
      sharpeRatio: 1.23, maxDrawdown: -0.178, trainedOn: '2024-07-15',
      features: 35, samples: 180000, epochs: 75, learningRate: 0.0005,
      trainingLoss: generateLossCurve(75, 0.45), validationLoss: generateLossCurve(75, 0.52),
    },
    {
      id: 'ensemble-v2', name: 'Ensemble Meta-Learner', type: 'Ensemble',
      status: 'deployed', accuracy: 0.768, precision: 0.781, recall: 0.756, f1Score: 0.768,
      sharpeRatio: 2.78, maxDrawdown: -0.065, trainedOn: '2024-07-13',
      features: 128, samples: 1000000, epochs: 30, learningRate: 0.001,
      trainingLoss: generateLossCurve(30, 0.22), validationLoss: generateLossCurve(30, 0.28),
    },
  ];
}

function generateFeatures(): Feature[] {
  return [
    { name: 'RSI_14', importance: 0.089, category: 'Technical' },
    { name: 'MACD_Signal', importance: 0.082, category: 'Technical' },
    { name: 'Volume_SMA_Ratio', importance: 0.076, category: 'Volume' },
    { name: 'BB_Width', importance: 0.071, category: 'Technical' },
    { name: 'ATR_14', importance: 0.068, category: 'Volatility' },
    { name: 'Price_SMA20_Dist', importance: 0.064, category: 'Technical' },
    { name: 'OBV_Slope', importance: 0.061, category: 'Volume' },
    { name: 'ADX_14', importance: 0.058, category: 'Technical' },
    { name: 'Market_Regime', importance: 0.055, category: 'Macro' },
    { name: 'Sector_Momentum', importance: 0.052, category: 'Fundamental' },
    { name: 'Earnings_Surprise', importance: 0.048, category: 'Fundamental' },
    { name: 'VIX_Level', importance: 0.045, category: 'Volatility' },
    { name: 'Put_Call_Ratio', importance: 0.043, category: 'Sentiment' },
    { name: 'News_Sentiment', importance: 0.041, category: 'Sentiment' },
    { name: 'Yield_Curve_Slope', importance: 0.038, category: 'Macro' },
    { name: 'Dollar_Index', importance: 0.035, category: 'Macro' },
    { name: 'Options_IV_Rank', importance: 0.033, category: 'Volatility' },
    { name: 'Short_Interest', importance: 0.031, category: 'Sentiment' },
    { name: 'Price_EMA50_Cross', importance: 0.028, category: 'Technical' },
    { name: 'Volume_Profile', importance: 0.025, category: 'Volume' },
  ].sort((a, b) => b.importance - a.importance);
}

function generatePredictions(): Prediction[] {
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'SPY', 'QQQ', 'JPM', 'V', 'AMD'];
  const models = ['LSTM v3', 'XGBoost', 'Transformer', 'Ensemble'];
  return Array.from({ length: 20 }, (_, i) => {
    const sym = symbols[i % symbols.length];
    const dir = Math.random() > 0.45 ? 'LONG' as const : 'SHORT' as const;
    const price = 100 + Math.random() * 400;
    const move = price * (0.01 + Math.random() * 0.05);
    return {
      id: i + 1,
      symbol: sym,
      direction: dir,
      confidence: +(0.55 + Math.random() * 0.4).toFixed(3),
      price: +price.toFixed(2),
      target: +(dir === 'LONG' ? price + move : price - move).toFixed(2),
      stopLoss: +(dir === 'LONG' ? price - move * 0.5 : price + move * 0.5).toFixed(2),
      timestamp: `2024-07-15T${(8 + Math.floor(i * 0.5)).toString().padStart(2, '0')}:${(Math.floor(Math.random() * 60)).toString().padStart(2, '0')}:00Z`,
      model: models[i % models.length],
      features: ['RSI_14', 'MACD_Signal', 'Volume_SMA_Ratio'].slice(0, 1 + Math.floor(Math.random() * 3)),
    };
  }).sort((a, b) => b.confidence - a.confidence);
}

// ── Canvas: Training Loss Curve ──────────────────────────────────────────────
function LossCurve({ trainLoss, valLoss, width = 500, height = 180 }: {
  trainLoss: number[];
  valLoss: number[];
  width?: number;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const margin = { top: 10, right: 60, bottom: 25, left: 45 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const allVals = [...trainLoss, ...valLoss];
    const maxLoss = Math.max(...allVals);
    const minLoss = Math.min(...allVals);
    const range = maxLoss - minLoss || 1;

    // Grid
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + w, y);
      ctx.stroke();

      ctx.fillStyle = MUTED;
      ctx.font = '8px monospace';
      ctx.textAlign = 'right';
      const val = maxLoss - (i / 4) * range;
      ctx.fillText(val.toFixed(2), margin.left - 4, y + 3);
    }

    // Train loss
    ctx.beginPath();
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 1.5;
    trainLoss.forEach((v, i) => {
      const x = margin.left + (i / (trainLoss.length - 1)) * w;
      const y = margin.top + ((maxLoss - v) / range) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Val loss
    ctx.beginPath();
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    valLoss.forEach((v, i) => {
      const x = margin.left + (i / (valLoss.length - 1)) * w;
      const y = margin.top + ((maxLoss - v) / range) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.fillStyle = BLUE;
    ctx.fillRect(width - 55, margin.top, 8, 2);
    ctx.fillStyle = TEXT;
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Train', width - 44, margin.top + 4);

    ctx.fillStyle = ORANGE;
    ctx.fillRect(width - 55, margin.top + 12, 8, 2);
    ctx.fillStyle = TEXT;
    ctx.fillText('Val', width - 44, margin.top + 16);

    // X-axis
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'center';
    ctx.fillText('Epoch 1', margin.left, height - 4);
    ctx.fillText(`Epoch ${trainLoss.length}`, margin.left + w, height - 4);
  }, [trainLoss, valLoss, width, height]);

  return <canvas ref={ref} style={{ width, height }} />;
}

// ── Canvas: Feature Importance ───────────────────────────────────────────────
function FeatureImportanceChart({ features, width = 400, height = 350 }: {
  features: Feature[];
  width?: number;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const margin = { top: 10, right: 10, bottom: 10, left: 120 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const maxImp = Math.max(...features.map(f => f.importance));
    const barH = Math.min(16, h / features.length - 2);
    const catColors: Record<string, string> = {
      Technical: BLUE,
      Volume: PURPLE,
      Volatility: RED,
      Macro: AMBER,
      Fundamental: GREEN,
      Sentiment: TEAL,
    };

    features.forEach((f, i) => {
      const y = margin.top + (i / features.length) * h;
      const barW = (f.importance / maxImp) * w;
      const color = catColors[f.category] || MUTED;

      // Bar
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(margin.left, y, barW, barH);
      ctx.globalAlpha = 1;

      // Border
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(margin.left, y, barW, barH);

      // Label
      ctx.fillStyle = TEXT;
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(f.name, margin.left - 4, y + barH / 2 + 3);

      // Value
      ctx.fillStyle = MUTED;
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${(f.importance * 100).toFixed(1)}%`, margin.left + barW + 4, y + barH / 2 + 3);
    });
  }, [features, width, height]);

  return <canvas ref={ref} style={{ width, height }} />;
}

// ── Component ────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'models' | 'predictions' | 'features';

export default function MLDashboardUI2() {
  const [models] = useState<MLModel[]>(() => generateModels());
  const [features] = useState<Feature[]>(() => generateFeatures());
  const [predictions] = useState<Prediction[]>(() => generatePredictions());
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedModel, setSelectedModel] = useState<string>('ensemble-v2');

  const activeModel = useMemo(() => models.find(m => m.id === selectedModel) || models[0], [models, selectedModel]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'models', label: 'MODELS' },
    { key: 'predictions', label: 'PREDICTIONS' },
    { key: 'features', label: 'FEATURES' },
  ];

  const statusColor = (s: MLModel['status']) => {
    switch (s) {
      case 'deployed': return GREEN;
      case 'ready': return BLUE;
      case 'training': return AMBER;
      case 'failed': return RED;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: BG,
      fontFamily: '"Roboto Mono", "Cascadia Code", monospace',
      fontSize: 11,
      color: TEXT,
    }}>
      {/* Header */}
      <div style={{
        background: PANEL,
        borderBottom: `1px solid ${BORDER}`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{ color: AMBER, fontWeight: 700, letterSpacing: 1.5, fontSize: 11 }}>
          ML/AI DASHBOARD
        </span>
        <span style={{ color: MUTED, fontSize: 9 }}>
          {models.filter(m => m.status === 'deployed').length} deployed &middot; {models.filter(m => m.status === 'training').length} training
        </span>

        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              style={{
                background: activeTab === t.key ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: `1px solid ${activeTab === t.key ? AMBER : 'transparent'}`,
                color: activeTab === t.key ? AMBER : MUTED,
                padding: '4px 10px',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 9,
                fontFamily: '"Roboto Mono", monospace',
              }}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 'overview' && (
          <div>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Best Accuracy', value: `${(Math.max(...models.map(m => m.accuracy)) * 100).toFixed(1)}%`, color: GREEN },
                { label: 'Avg Sharpe', value: (models.reduce((a, m) => a + m.sharpeRatio, 0) / models.length).toFixed(2), color: AMBER },
                { label: 'Total Models', value: models.length.toString(), color: BLUE },
                { label: 'Deployed', value: models.filter(m => m.status === 'deployed').length.toString(), color: GREEN },
                { label: 'Predictions Today', value: predictions.length.toString(), color: PURPLE },
                { label: 'Avg Confidence', value: `${(predictions.reduce((a, p) => a + p.confidence, 0) / predictions.length * 100).toFixed(0)}%`, color: TEAL },
              ].map((s, i) => (
                <div key={i} style={{
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  padding: 12,
                  textAlign: 'center',
                }}>
                  <div style={{ color: MUTED, fontSize: 8, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ color: s.color, fontSize: 18, fontWeight: 700 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Training curve + Feature importance side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 16 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                  <span style={{ color: AMBER, fontSize: 10, fontWeight: 600 }}>TRAINING LOSS</span>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    style={{
                      background: BG,
                      border: `1px solid ${BORDER}`,
                      color: TEXT,
                      padding: '2px 6px',
                      fontSize: 9,
                      fontFamily: '"Roboto Mono", monospace',
                      borderRadius: 3,
                    }}
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <LossCurve trainLoss={activeModel.trainingLoss} valLoss={activeModel.validationLoss} />
              </div>

              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 16 }}>
                <span style={{ color: AMBER, fontSize: 10, fontWeight: 600 }}>FEATURE IMPORTANCE</span>
                <FeatureImportanceChart features={features.slice(0, 15)} width={400} height={300} />
              </div>
            </div>

            {/* Recent predictions */}
            <div style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: 16,
              marginTop: 16,
            }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>LATEST PREDICTIONS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {predictions.slice(0, 8).map(p => (
                  <div key={p.id} style={{
                    padding: '8px 10px',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 4,
                    borderLeft: `3px solid ${p.direction === 'LONG' ? GREEN : RED}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 11 }}>{p.symbol}</span>
                      <span style={{
                        color: p.direction === 'LONG' ? GREEN : RED,
                        fontWeight: 600,
                        fontSize: 9,
                      }}>
                        {p.direction}
                      </span>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <div style={{
                        height: 4,
                        borderRadius: 2,
                        background: BORDER,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${p.confidence * 100}%`,
                          background: p.confidence > 0.8 ? GREEN : p.confidence > 0.65 ? AMBER : RED,
                          borderRadius: 2,
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 8, color: MUTED }}>
                        <span>Conf: {(p.confidence * 100).toFixed(0)}%</span>
                        <span>{p.model}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'models' && (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                  {['Model', 'Type', 'Status', 'Accuracy', 'Precision', 'Recall', 'F1', 'Sharpe', 'MaxDD', 'Features', 'Samples', 'Trained'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', color: MUTED, fontSize: 8, textAlign: h === 'Model' ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {models.map(m => (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: `1px solid ${BORDER}`,
                      cursor: 'pointer',
                      background: selectedModel === m.id ? 'rgba(245,166,35,0.06)' : 'transparent',
                    }}
                    onClick={() => setSelectedModel(m.id)}
                  >
                    <td style={{ padding: '8px', fontWeight: 600 }}>{m.name}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: PURPLE }}>{m.type}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 3,
                        fontSize: 8,
                        background: statusColor(m.status) + '22',
                        color: statusColor(m.status),
                      }}>
                        {m.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: m.accuracy > 0.7 ? GREEN : TEXT }}>
                      {(m.accuracy * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{(m.precision * 100).toFixed(1)}%</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{(m.recall * 100).toFixed(1)}%</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{(m.f1Score * 100).toFixed(1)}%</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: AMBER, fontWeight: 600 }}>
                      {m.sharpeRatio.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: RED }}>
                      {(m.maxDrawdown * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: MUTED }}>{m.features}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: MUTED }}>{(m.samples / 1000).toFixed(0)}K</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: MUTED }}>{m.trainedOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Selected model detail */}
            <div style={{
              background: PANEL,
              border: `1px solid ${BORDER}`,
              borderRadius: 4,
              padding: 16,
              marginTop: 16,
            }}>
              <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>
                {activeModel.name} — TRAINING CURVE
              </div>
              <LossCurve trainLoss={activeModel.trainingLoss} valLoss={activeModel.validationLoss} width={700} height={200} />
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 9 }}>
                <span><span style={{ color: MUTED }}>Epochs:</span> {activeModel.epochs}</span>
                <span><span style={{ color: MUTED }}>LR:</span> {activeModel.learningRate}</span>
                <span><span style={{ color: MUTED }}>Final Train Loss:</span> <span style={{ color: BLUE }}>{activeModel.trainingLoss[activeModel.trainingLoss.length - 1]?.toFixed(4)}</span></span>
                <span><span style={{ color: MUTED }}>Final Val Loss:</span> <span style={{ color: ORANGE }}>{activeModel.validationLoss[activeModel.validationLoss.length - 1]?.toFixed(4)}</span></span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'predictions' && (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                  {['#', 'Symbol', 'Direction', 'Confidence', 'Price', 'Target', 'Stop', 'R:R', 'Model', 'Time'].map(h => (
                    <th key={h} style={{
                      padding: '6px 8px',
                      color: MUTED,
                      fontSize: 8,
                      textAlign: h === 'Symbol' || h === 'Model' ? 'left' : 'right',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {predictions.map(p => {
                  const risk = Math.abs(p.price - p.stopLoss);
                  const reward = Math.abs(p.target - p.price);
                  const rr = risk > 0 ? reward / risk : 0;
                  return (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '6px 8px', color: MUTED, textAlign: 'right' }}>{p.id}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>{p.symbol}</td>
                      <td style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: p.direction === 'LONG' ? GREEN : RED,
                        fontWeight: 600,
                      }}>
                        {p.direction}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <div style={{
                            width: 40,
                            height: 6,
                            background: BORDER,
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${p.confidence * 100}%`,
                              background: p.confidence > 0.8 ? GREEN : p.confidence > 0.65 ? AMBER : RED,
                              borderRadius: 3,
                            }} />
                          </div>
                          <span>{(p.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>${p.price.toFixed(2)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: GREEN }}>${p.target.toFixed(2)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: RED }}>${p.stopLoss.toFixed(2)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: rr > 2 ? GREEN : AMBER }}>
                        {rr.toFixed(1)}:1
                      </td>
                      <td style={{ padding: '6px 8px', color: PURPLE }}>{p.model}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: MUTED }}>{p.timestamp.slice(11, 16)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'features' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 16 }}>
                <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>FEATURE IMPORTANCE (TOP 20)</div>
                <FeatureImportanceChart features={features} width={450} height={400} />
              </div>

              <div>
                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 16, marginBottom: 16 }}>
                  <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 12 }}>BY CATEGORY</div>
                  {Object.entries(
                    features.reduce<Record<string, number>>((acc, f) => {
                      acc[f.category] = (acc[f.category] || 0) + f.importance;
                      return acc;
                    }, {})
                  )
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, total]) => (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                        <span style={{ width: 80, fontSize: 9, color: TEXT }}>{cat}</span>
                        <div style={{ flex: 1, height: 12, background: BORDER, borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${total * 100 / 0.5}%`,
                            background: cat === 'Technical' ? BLUE : cat === 'Volume' ? PURPLE : cat === 'Volatility' ? RED : cat === 'Macro' ? AMBER : cat === 'Fundamental' ? GREEN : TEAL,
                            borderRadius: 6,
                            opacity: 0.7,
                          }} />
                        </div>
                        <span style={{ width: 45, fontSize: 9, color: MUTED, textAlign: 'right' }}>{(total * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                </div>

                <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 16 }}>
                  <div style={{ color: AMBER, fontSize: 10, fontWeight: 600, marginBottom: 8 }}>ALL FEATURES</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <th style={{ padding: 4, textAlign: 'left', color: MUTED, fontSize: 8 }}>Feature</th>
                        <th style={{ padding: 4, textAlign: 'left', color: MUTED, fontSize: 8 }}>Category</th>
                        <th style={{ padding: 4, textAlign: 'right', color: MUTED, fontSize: 8 }}>Importance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {features.map(f => (
                        <tr key={f.name} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <td style={{ padding: 4 }}>{f.name}</td>
                          <td style={{ padding: 4, color: MUTED }}>{f.category}</td>
                          <td style={{ padding: 4, textAlign: 'right', color: AMBER }}>{(f.importance * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
