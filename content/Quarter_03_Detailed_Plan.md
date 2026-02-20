# Quarter 3: Intelligence & Optimization (Days 181-270)

> **Theme**: Intelligence, ML & Portfolio Optimization

[TOC]

## Week 26

### Day 181: [WEEKEND] NewsAPI Ingestion Service
**Saturday** | *Outcome: Research & Cleanup: Ingest real-time news from NewsAPI.org and normalize.*

#### 1. Tech & Commands
```bash
pip install newsapi-python
```

#### 2. Files
- `apps/data/ingestion/news_api.py`
- `apps/data/models/news.py`

#### 3. Architecture
- ETL Pipeline
- Normalization

#### 4. Autopilot Prompts
- Poll NewsAPI every 15m
- Deduplicate articles by URL

#### 5. Risk & Metrics
- **Risk**: Rate limits.
- **Metric**: Zero missed headlines

---

### Day 182: [WEEKEND] Benzinga Pro Newswire Integration
**Sunday** | *Outcome: Research & Cleanup: Connect to Benzinga TCP stream for low-latency financial news.*

#### 1. Tech & Commands
```bash
pip install benzinga
```

#### 2. Files
- `apps/data/ingestion/benzinga_stream.py`

#### 3. Architecture
- Stream Processing
- WebSockets

#### 4. Autopilot Prompts
- Handle reconnections
- Parse rapid-fire JSON

#### 5. Risk & Metrics
- **Risk**: Buffer overflow.
- **Metric**: <100ms latency

---

## Week 27

### Day 183: Twitter/X Scraper (nitter)
**Monday** | *Outcome: Scrape financial twitter (FinTwit) for ticker mentions.*

#### 1. Tech & Commands
```bash
pip install ntscraper
```

#### 2. Files
- `apps/data/ingestion/social/twitter.py`

#### 3. Architecture
- Scraping
- Rate Limiting

#### 4. Autopilot Prompts
- Rotate proxies
- Extract $CASHTAGS

#### 5. Risk & Metrics
- **Risk**: Banhammer.
- **Metric**: Stable scraping

---

### Day 184: Reddit WallStreetBets Scraper
**Tuesday** | *Outcome: Monitor r/WSB and r/stocks for retail sentiment spikes.*

#### 1. Tech & Commands
```bash
pip install praw
```

#### 2. Files
- `apps/data/ingestion/social/reddit.py`

#### 3. Architecture
- API Integration
- Batch Processing

#### 4. Autopilot Prompts
- Fetch top posts hourly
- Count ticker mentions

#### 5. Risk & Metrics
- **Risk**: API Quota.
- **Metric**: Hourly updates

---

### Day 185: SEC EDGAR Filer (13F/8K)
**Wednesday** | *Outcome: Ingest institutional filings to track whale movements.*

#### 1. Tech & Commands
```bash
pip install sec-edgar-downloader
```

#### 2. Files
- `apps/data/ingestion/sec.py`

#### 3. Architecture
- Document Parsing
- XML Extraction

#### 4. Autopilot Prompts
- Download 13F-HR
- Extract holdings table

#### 5. Risk & Metrics
- **Risk**: Parsing errors.
- **Metric**: Accurate holdings

---

### Day 186: Economic Calendar & Fed Events
**Thursday** | *Outcome: Ingest macro events (CPI, FOMC) to tag high-volatility days.*

#### 1. Tech & Commands
```bash
pip install investpy
```

#### 2. Files
- `apps/data/ingestion/macro.py`

#### 3. Architecture
- Event Scheduling
- Risk Flagging

#### 4. Autopilot Prompts
- Fetch economic calendar
- Flag days as 'High Volatility'

#### 5. Risk & Metrics
- **Risk**: Missing data.
- **Metric**: Calendar sync

---

### Day 187: Data Lake Ingestion Pipeline
**Friday** | *Outcome: Unified pipeline to dump all raw text data to S3/MinIO.*

#### 1. Tech & Commands
```bash
pip install boto3
```

#### 2. Files
- `infra/datalake/s3_writer.py`

#### 3. Architecture
- Data Lake
- Batch Write

#### 4. Autopilot Prompts
- Partition by date/source
- Compress (Parquet/Snappy)

#### 5. Risk & Metrics
- **Risk**: Disk fill.
- **Metric**: Efficient storage

---

### Day 188: [WEEKEND] FinBERT Model Setup
**Saturday** | *Outcome: Research & Cleanup: Deploy Hugging Face FinBERT for financial sentiment classification.*

#### 1. Tech & Commands
```bash
pip install transformers torch
```

#### 2. Files
- `libs/ml/nlp/finbert.py`

#### 3. Architecture
- NLP
- Transformer

#### 4. Autopilot Prompts
- Load ProsusAI/finbert
- Create prediction pipeline

#### 5. Risk & Metrics
- **Risk**: Slow inference.
- **Metric**: Batch processing

---

### Day 189: [WEEKEND] Entity Recognition (NER)
**Sunday** | *Outcome: Research & Cleanup: Extract specific tickers and company names from raw text.*

#### 1. Tech & Commands
```bash
pip install spacy
```

#### 2. Files
- `libs/ml/nlp/ner.py`

#### 3. Architecture
- Named Entity Recognition
- Symbology Mapping

#### 4. Autopilot Prompts
- Map 'Apple' -> AAPL
- Disambiguate 'Ford' (Harrison vs Motor)

#### 5. Risk & Metrics
- **Risk**: False matches.
- **Metric**: Precision > 95%

---

## Week 28

### Day 190: Sentiment Scoring Service
**Monday** | *Outcome: Real-time service assigning -1 to +1 sentiment scores to news.*

#### 1. Tech & Commands
```bash
touch apps/services/sentiment.py
```

#### 2. Files
- `apps/services/sentiment.py`

#### 3. Architecture
- Microservice
- Inference

#### 4. Autopilot Prompts
- Consume Kafka news topic
- Publish sentiment score topic

#### 5. Risk & Metrics
- **Risk**: Backpressure.
- **Metric**: Throughput 100/sec

---

### Day 191: Aggregate Sentiment Signal
**Tuesday** | *Outcome: Combine news, twitter, reddit scores into a single alpha factor.*

#### 1. Tech & Commands
```bash
touch apps/services/sentiment_aggregator.py
```

#### 2. Files
- `apps/services/sentiment_aggregator.py`

#### 3. Architecture
- Signal Processing
- Weighted Average

#### 4. Autopilot Prompts
- Weight News (0.6) > Reddit (0.2)
- Decay old sentiment (half-life 4h)

#### 5. Risk & Metrics
- **Risk**: Noise.
- **Metric**: Signal correlation

---

### Day 192: Sentiment Dashboard Widget
**Wednesday** | *Outcome: Visualize sentiment trends vs Price on frontend.*

#### 1. Tech & Commands
```bash
npm install react-chartjs-2
```

#### 2. Files
- `apps/web/src/features/Sentiment/SentimentChart.tsx`

#### 3. Architecture
- Visualization
- Overlay

#### 4. Autopilot Prompts
- Plot price candle
- Overlay sentiment moving avg

#### 5. Risk & Metrics
- **Risk**: Laggy render.
- **Metric**: Real-time updates

---

### Day 193: LLM Summary Generation
**Thursday** | *Outcome: Use LLM to generate daily 'Morning Brief' from raw news.*

#### 1. Tech & Commands
```bash
pip install langchain
```

#### 2. Files
- `apps/services/briefing.py`

#### 3. Architecture
- Generative AI
- Summarization

#### 4. Autopilot Prompts
- Prompt: Summarize top 5 bearish stories for TSLA
- Email report

#### 5. Risk & Metrics
- **Risk**: Hallucinations.
- **Metric**: Fact-checked summaries

---

### Day 194: FOMC Press Conference Analyze
**Friday** | *Outcome: Real-time transcription and hawkish/dovish scoring of Fed speech.*

#### 1. Tech & Commands
```bash
pip install openai-whisper
```

#### 2. Files
- `apps/services/fomc_watcher.py`

#### 3. Architecture
- Audio Processing
- Real-time NLP

#### 4. Autopilot Prompts
- Transcribe audio stream
- Score hawkishness

#### 5. Risk & Metrics
- **Risk**: Latency.
- **Metric**: Text within 5s

---

### Day 195: [WEEKEND] Alphalens Setup
**Saturday** | *Outcome: Research & Cleanup: Setup Quantopian Alphalens for factor quality analysis.*

#### 1. Tech & Commands
```bash
pip install alphalens-reloaded
```

#### 2. Files
- `research/factors/setup.py`

#### 3. Architecture
- Factor Analysis
- Quantstats

#### 4. Autopilot Prompts
- Format data for Alphalens
- Run tear sheet generation

#### 5. Risk & Metrics
- **Risk**: Data alignment.
- **Metric**: Clean tear sheets

---

### Day 196: [WEEKEND] Momentum Factors
**Sunday** | *Outcome: Research & Cleanup: Implement and test RSI, MACD, ROC factors.*

#### 1. Tech & Commands
```bash
touch libs/factors/momentum.py
```

#### 2. Files
- `libs/factors/momentum.py`

#### 3. Architecture
- Technical Analysis
- Vectorization

#### 4. Autopilot Prompts
- Calc 14d RSI
- Calc 12/26 MACD

#### 5. Risk & Metrics
- **Risk**: Lookahead.
- **Metric**: Shifted correctly

---

## Week 29

### Day 197: Volatilty Factors
**Monday** | *Outcome: Implement ATR, Bollinger Band Width, Hist Vol.*

#### 1. Tech & Commands
```bash
touch libs/factors/volatility.py
```

#### 2. Files
- `libs/factors/volatility.py`

#### 3. Architecture
- Risk Metrics
- Standard Deviation

#### 4. Autopilot Prompts
- Calc realized vol
- Calc implied vol surface

#### 5. Risk & Metrics
- **Risk**: NaN handling.
- **Metric**: Robust calcs

---

### Day 198: Volume Factors
**Tuesday** | *Outcome: Implement OBV, A/D Line, VPOC.*

#### 1. Tech & Commands
```bash
touch libs/factors/volume.py
```

#### 2. Files
- `libs/factors/volume.py`

#### 3. Architecture
- Market Microstructure
- Flow

#### 4. Autopilot Prompts
- On-Balance Volume
- Volume Profile Point of Control

#### 5. Risk & Metrics
- **Risk**: Adjusted volume.
- **Metric**: Splits handled

---

### Day 199: Sentiment Factors
**Wednesday** | *Outcome: Backtest the predictive power of our sentiment engine.*

#### 1. Tech & Commands
```bash
touch research/factors/test_sentiment.py
```

#### 2. Files
- `research/notebooks/sentiment_alpha.ipynb`

#### 3. Architecture
- Hypothesis Testing
- Alpha Decay

#### 4. Autopilot Prompts
- Correlate sentiment lag-1 with returns
- Check information coefficient (IC)

#### 5. Risk & Metrics
- **Risk**: Low IC.
- **Metric**: IC > 0.02

---

### Day 200: Factor Correlation Matrix
**Thursday** | *Outcome: Identify collinearity among factors to avoid redundancy.*

#### 1. Tech & Commands
```bash
python scripts/calc_factor_corr.py
```

#### 2. Files
- `reports/factor_correlation.png`

#### 3. Architecture
- Statistics
- Diversification

#### 4. Autopilot Prompts
- Heatmap of factor correlations
- Drop highly correlated (>0.7)

#### 5. Risk & Metrics
- **Risk**: Multicollinearity.
- **Metric**: Orthogonal factors

---

### Day 201: Multi-Factor Ranking System
**Friday** | *Outcome: Combine factors into a single rank for stock selection.*

#### 1. Tech & Commands
```bash
touch libs/factors/ranker.py
```

#### 2. Files
- `libs/factors/ranker.py`

#### 3. Architecture
- Z-Score
- Ranking

#### 4. Autopilot Prompts
- Normalize factors (Z-score)
- Sum weighted scores

#### 5. Risk & Metrics
- **Risk**: Outliers.
- **Metric**: Winsorization

---

### Day 202: [WEEKEND] Feature Store (Feast) Init
**Saturday** | *Outcome: Research & Cleanup: Initialize Feast feature store for training/serving consistency.*

#### 1. Tech & Commands
```bash
pip install feast
```

#### 2. Files
- `feature_repo/feature_store.yaml`

#### 3. Architecture
- MLOps
- Data Consistency

#### 4. Autopilot Prompts
- Define entity: ticker
- Define features: rsi_14, senti_score

#### 5. Risk & Metrics
- **Risk**: Time travel.
- **Metric**: Point-in-time correct

---

### Day 203: [WEEKEND] Feature Retrievel Service
**Sunday** | *Outcome: Research & Cleanup: API to fetch feature vectors for inference.*

#### 1. Tech & Commands
```bash
touch apps/ml/feature_service.py
```

#### 2. Files
- `apps/ml/feature_service.py`

#### 3. Architecture
- Low Latency API
- Redis

#### 4. Autopilot Prompts
- Get online features from Redis
- Get offline features from Parquet

#### 5. Risk & Metrics
- **Risk**: Latency.
- **Metric**: <10ms retrieval

---

## Week 30

### Day 204: MLflow Experiment Tracking
**Monday** | *Outcome: Setup MLflow to track experiments, params, and metrics.*

#### 1. Tech & Commands
```bash
pip install mlflow
```

#### 2. Files
- `docker-compose.ml.yml`

#### 3. Architecture
- Experiment Tracking
- Reproducibility

#### 4. Autopilot Prompts
- Log params (learning_rate)
- Log metrics (RMSE, Accuracy)

#### 5. Risk & Metrics
- **Risk**: Lost experiments.
- **Metric**: Full audit trail

---

### Day 205: Dataset Versioning (DVC)
**Tuesday** | *Outcome: Version control large datasets used for training.*

#### 1. Tech & Commands
```bash
pip install dvc
```

#### 2. Files
- `dvc init`

#### 3. Architecture
- Data Versioning
- Storage

#### 4. Autopilot Prompts
- Track .parquet files
- Push to S3 remote

#### 5. Risk & Metrics
- **Risk**: Data drift.
- **Metric**: Reproducible datasets

---

### Day 206: Training Pipeline (Airflow/Prefect)
**Wednesday** | *Outcome: Automate weekly model retraining.*

#### 1. Tech & Commands
```bash
pip install prefect
```

#### 2. Files
- `pipelines/training_flow.py`

#### 3. Architecture
- Orchestration
- Automation

#### 4. Autopilot Prompts
- Fetch data -> Train -> Eval -> Register
- Schedule weekly

#### 5. Risk & Metrics
- **Risk**: Pipeline failure.
- **Metric**: Alert on fail

---

### Day 207: Model Registry
**Thursday** | *Outcome: Central repository for versioned, production-ready models.*

#### 1. Tech & Commands
```bash
touch apps/ml/registry.py
```

#### 2. Files
- `apps/ml/registry.py`

#### 3. Architecture
- Governance
- Lifecycle

#### 4. Autopilot Prompts
- Promote Staging -> Prod
- Rollback capability

#### 5. Risk & Metrics
- **Risk**: Bad model deployed.
- **Metric**: Gatekeeper checks

---

### Day 208: Model Inference Server (Triton/FastAPI)
**Friday** | *Outcome: Dedicated microservice for serving predictions.*

#### 1. Tech & Commands
```bash
touch apps/ml/inference.py
```

#### 2. Files
- `apps/ml/inference.py`

#### 3. Architecture
- Microservice
- Scalability

#### 4. Autopilot Prompts
- Load model from registry
- Expose /predict endpoint

#### 5. Risk & Metrics
- **Risk**: Throughput.
- **Metric**: 1000 req/sec

---

### Day 209: [WEEKEND] A/B Testing Framework
**Saturday** | *Outcome: Research & Cleanup: Infrastructure to test Model A vs Model B in live market.*

#### 1. Tech & Commands
```bash
touch apps/ml/ab_test.py
```

#### 2. Files
- `apps/ml/ab_test.py`

#### 3. Architecture
- Experimentation
- Routing

#### 4. Autopilot Prompts
- Route 50% users to Model A
- Route 50% to Model B

#### 5. Risk & Metrics
- **Risk**: Bias.
- **Metric**: Statistically significant

---

### Day 210: [WEEKEND] Q3 Month 1 Review
**Sunday** | *Outcome: Research & Cleanup: Review data ingestion, factor quality, and MLOps setup.*

#### 1. Tech & Commands
```bash
touch reports/q3_m1_review.md
```

#### 2. Files
- `reports/q3_m1_review.md`

#### 3. Architecture
- Review
- Quality Gate

#### 4. Autopilot Prompts
- Check factor ICs
- Verify Feature Store latency

#### 5. Risk & Metrics
- **Risk**: Slow features.
- **Metric**: Green light

---

## Week 31

### Day 211: Target Variable Definition
**Monday** | *Outcome: Define what we are predicting (e.g., 5-min forward return > 0.1%).*

#### 1. Tech & Commands
```bash
touch research/targets.py
```

#### 2. Files
- `research/targets.py`

#### 3. Architecture
- Label Engineering
- Classification

#### 4. Autopilot Prompts
- Define 'Up' vs 'Down' classes
- Handle class imbalance (SMOTE)

#### 5. Risk & Metrics
- **Risk**: Leakage.
- **Metric**: Clean labels

---

### Day 212: XGBoost Baseline Model
**Tuesday** | *Outcome: Train first Gradient Boosted Decision Tree (GBDT) model.*

#### 1. Tech & Commands
```bash
pip install xgboost
```

#### 2. Files
- `research/notebooks/xgboost_baseline.ipynb`

#### 3. Architecture
- Supervised Learning
- Boosting

#### 4. Autopilot Prompts
- Train/Test Split (Time Series)
- Eval LogLoss/AUC

#### 5. Risk & Metrics
- **Risk**: Overfitting.
- **Metric**: AUC > 0.55

---

### Day 213: Feature Importance Analysis (SHAP)
**Wednesday** | *Outcome: Explain model predictions using SHAP values.*

#### 1. Tech & Commands
```bash
pip install shap
```

#### 2. Files
- `research/notebooks/shap_analysis.ipynb`

#### 3. Architecture
- Explainable AI
- feature Selection

#### 4. Autopilot Prompts
- Plot summary dot plot
- Drop zero-importance features

#### 5. Risk & Metrics
- **Risk**: Black box.
- **Metric**: Interpretability

---

### Day 214: Hyperparameter Tuning (Optuna)
**Thursday** | *Outcome: Optimize XGBoost params (eta, max_depth, subsample).*

#### 1. Tech & Commands
```bash
pip install optuna
```

#### 2. Files
- `research/notebooks/optuna_optimization.ipynb`

#### 3. Architecture
- Bayesian Optimization
- Search Space

#### 4. Autopilot Prompts
- Run 100 trials
- Minimize validation logloss

#### 5. Risk & Metrics
- **Risk**: Local minima.
- **Metric**: Global optimum found

---

### Day 215: CatBoost Implementation
**Friday** | *Outcome: Test CatBoost for better handling of categorical features (Sector).*

#### 1. Tech & Commands
```bash
pip install catboost
```

#### 2. Files
- `research/notebooks/catboost_test.ipynb`

#### 3. Architecture
- Gradient Boosting
- Categorical Encoding

#### 4. Autopilot Prompts
- Compare vs XGBoost
- Train on Sector/Industry columns

#### 5. Risk & Metrics
- **Risk**: Long train time.
- **Metric**: Better OOS accuracy

---

### Day 216: [WEEKEND] Ensemble Stacking
**Saturday** | *Outcome: Research & Cleanup: Combine XGBoost + CatBoost + LightGBM predictions.*

#### 1. Tech & Commands
```bash
touch apps/ml/ensemble.py
```

#### 2. Files
- `apps/ml/ensemble.py`

#### 3. Architecture
- Ensemble Learning
- Stacking

#### 4. Autopilot Prompts
- Train meta-learner (Logistic Regression)
- Average predictions

#### 5. Risk & Metrics
- **Risk**: Complexity.
- **Metric**: Robustness

---

### Day 217: [WEEKEND] Production Inference Pipeline
**Sunday** | *Outcome: Research & Cleanup: Deploy the trained XGBoost model to the live trading loop.*

#### 1. Tech & Commands
```bash
touch apps/strategies/ml_strategy.py
```

#### 2. Files
- `apps/strategies/ml_strategy.py`

#### 3. Architecture
- Inference
- Strategy

#### 4. Autopilot Prompts
- Fetch features -> Predict -> Signal
- Latency constraints

#### 5. Risk & Metrics
- **Risk**: Slow prediction.
- **Metric**: <5ms inference

---

## Week 32

### Day 218: PyTorch Environment Setup
**Monday** | *Outcome: Prepare GPU environment for Deep Learning experimentation.*

#### 1. Tech & Commands
```bash
pip install torch torchvision torchaudio
```

#### 2. Files
- `infra/gpu/cuda_check.py`

#### 3. Architecture
- Deep Learning
- GPU Acceleration

#### 4. Autopilot Prompts
- Verify CUDA availability
- Load tensor to GPU

#### 5. Risk & Metrics
- **Risk**: Driver hell.
- **Metric**: CUDA Ready

---

### Day 219: LSTM for Time Series
**Tuesday** | *Outcome: Implement Long Short-Term Memory network for price prediction.*

#### 1. Tech & Commands
```bash
touch libs/ml/models/lstm.py
```

#### 2. Files
- `libs/ml/models/lstm.py`

#### 3. Architecture
- RNN
- Sequence Modeling

#### 4. Autopilot Prompts
- Define input shape (batch, seq_len, features)
- Train on 60-min sequences

#### 5. Risk & Metrics
- **Risk**: Vanishing gradient.
- **Metric**: Loss convergence

---

### Day 220: Temporal Fusion Transformer (TFT)
**Wednesday** | *Outcome: Research state-of-the-art Transformer for interpretable forecasting.*

#### 1. Tech & Commands
```bash
pip install pytorch-forecasting
```

#### 2. Files
- `research/notebooks/tft_research.ipynb`

#### 3. Architecture
- Transformer
- Attention Mechanism

#### 4. Autopilot Prompts
- Interpret attention weights
- Forecast volatility

#### 5. Risk & Metrics
- **Risk**: Complexity.
- **Metric**: Better than LSTM

---

### Day 221: Autoencoder for Anomaly Detection
**Thursday** | *Outcome: Detect market regime changes or strange price action.*

#### 1. Tech & Commands
```bash
touch libs/ml/models/autoencoder.py
```

#### 2. Files
- `libs/ml/models/autoencoder.py`

#### 3. Architecture
- Unsupervised Learning
- Reconstruction Error

#### 4. Autopilot Prompts
- Train on normal market data
- High reconstruction error = Anomaly

#### 5. Risk & Metrics
- **Risk**: False alarms.
- **Metric**: Reliable detection

---

### Day 222: Reinforcement Learning Environment (Gym)
**Friday** | *Outcome: Build an OpenAI Gym environment for trading.*

#### 1. Tech & Commands
```bash
pip install gym
```

#### 2. Files
- `research/rl/trading_env.py`

#### 3. Architecture
- Reinforcement Learning
- Simulation

#### 4. Autopilot Prompts
- Define State (OHLC+Holdings)
- Define Action (Buy/Sell/Hold)
- Define Reward (P&L)

#### 5. Risk & Metrics
- **Risk**: Reward hacking.
- **Metric**: Realistic sim

---

### Day 223: [WEEKEND] PPO Agent Training
**Saturday** | *Outcome: Research & Cleanup: Train a Proximal Policy Optimization agent in the gym.*

#### 1. Tech & Commands
```bash
pip install stable-baselines3
```

#### 2. Files
- `research/rl/train_ppo.py`

#### 3. Architecture
- RL
- Policy Gradient

#### 4. Autopilot Prompts
- Train 1M steps
- Monitor mean reward

#### 5. Risk & Metrics
- **Risk**: Unstable training.
- **Metric**: Profitable policy

---

### Day 224: [WEEKEND] Model Distillation
**Sunday** | *Outcome: Research & Cleanup: Compress large Deep Learning model into smaller, faster model.*

#### 1. Tech & Commands
```bash
touch apps/ml/distillation.py
```

#### 2. Files
- `apps/ml/distillation.py`

#### 3. Architecture
- Model Compression
- Performance

#### 4. Autopilot Prompts
- Teacher (Transformer) -> Student (MLP)
- Minimize KL Divergence

#### 5. Risk & Metrics
- **Risk**: Accuracy loss.
- **Metric**: Fast & Accurate

---

## Week 33

### Day 225: Data Drift Detection (Evidently AI)
**Monday** | *Outcome: Monitor input feature distributions for shifts.*

#### 1. Tech & Commands
```bash
pip install evidently
```

#### 2. Files
- `apps/monitoring/data_drift.py`

#### 3. Architecture
- Drift Monitoring
- Quality Assurance

#### 4. Autopilot Prompts
- Compare train vs serving distribution
- Alert on K-S test failure

#### 5. Risk & Metrics
- **Risk**: Silent failure.
- **Metric**: Early warning

---

### Day 226: Concept Drift Detection
**Tuesday** | *Outcome: Detect when the relationship between features and target changes.*

#### 1. Tech & Commands
```bash
touch apps/monitoring/concept_drift.py
```

#### 2. Files
- `apps/monitoring/concept_drift.py`

#### 3. Architecture
- Model Monitoring
- Retraining Trigger

#### 4. Autopilot Prompts
- Monitor prediction error over time
- Trigger retraining if error spikes

#### 5. Risk & Metrics
- **Risk**: Market regime shift.
- **Metric**: Adaptive model

---

### Day 227: Shadow Mode Deployment
**Wednesday** | *Outcome: Run new ML models in production without trading (logging only).*

#### 1. Tech & Commands
```bash
touch apps/strategies/shadow_runner.py
```

#### 2. Files
- `apps/strategies/shadow_runner.py`

#### 3. Architecture
- Safe Deployment
- Evaluation

#### 4. Autopilot Prompts
- Log 'Shadow Buys'
- Compare with live P&L

#### 5. Risk & Metrics
- **Risk**: Risk free.
- **Metric**: Real-world validation

---

### Day 228: Online Learning (River)
**Thursday** | *Outcome: Update linear models incrementally with every new data point.*

#### 1. Tech & Commands
```bash
pip install river
```

#### 2. Files
- `apps/ml/online_learning.py`

#### 3. Architecture
- Incremental Learning
- Adaptability

#### 4. Autopilot Prompts
- Update weights on each bar
- No full retraining needed

#### 5. Risk & Metrics
- **Risk**: Catastrophic forgetting.
- **Metric**: Sticky weights

---

### Day 229: Explainability Dashboard
**Friday** | *Outcome: UI to show why the ML model made a trade.*

#### 1. Tech & Commands
```bash
touch apps/web/src/features/ML/Explainability.tsx
```

#### 2. Files
- `apps/api/routes/explain.py`

#### 3. Architecture
- Trust
- Visualization

#### 4. Autopilot Prompts
- Show top 3 contributing features
- Feature value context

#### 5. Risk & Metrics
- **Risk**: Black box mistrust.
- **Metric**: Trader confidence

---

### Day 230: [WEEKEND] Automated Retraining Pipeline V2
**Saturday** | *Outcome: Research & Cleanup: Fully autonomous retraining loop with safety gates.*

#### 1. Tech & Commands
```bash
touch pipelines/autonomous_retrain.py
```

#### 2. Files
- `pipelines/autonomous_retrain.py`

#### 3. Architecture
- Automation
- CI/CD for ML

#### 4. Autopilot Prompts
- Trigger -> Train -> Eval -> Challenger vs Champion -> Deploy

#### 5. Risk & Metrics
- **Risk**: Bad deploy.
- **Metric**: Automatic rollback

---

### Day 231: [WEEKEND] Model Governance & Auditing
**Sunday** | *Outcome: Research & Cleanup: Compliance logs for every model version and valid period.*

#### 1. Tech & Commands
```bash
touch docs/compliance/model_inventory.md
```

#### 2. Files
- `docs/compliance/model_inventory.md`

#### 3. Architecture
- Governance
- Audit

#### 4. Autopilot Prompts
- Log Training Data Hash
- Log Hyperparams
- Log performance metrics

#### 5. Risk & Metrics
- **Risk**: Regulatory fine.
- **Metric**: Full compliance

---

## Week 34

### Day 232: Vectorized Backtesting (VectorBT)
**Monday** | *Outcome: Rapidly backtest ML signals over variable params.*

#### 1. Tech & Commands
```bash
pip install vectorbt
```

#### 2. Files
- `research/backtest/vbt_ml.py`

#### 3. Architecture
- High Performance
- Backtesting

#### 4. Autopilot Prompts
- Run 1000s of simulations
- Analyze Sharpe/Calmar

#### 5. Risk & Metrics
- **Risk**: Lookahead.
- **Metric**: Correct shifting

---

### Day 233: Event-Driven ML Backtest
**Tuesday** | *Outcome: Validate ML signals with realistic execution constraints.*

#### 1. Tech & Commands
```bash
python apps/backtest/run_ml_strat.py
```

#### 2. Files
- `reports/ml_backtest_results.md`

#### 3. Architecture
- Simulation
- Verification

#### 4. Autopilot Prompts
- Include latency (feature calc time)
- Include transaction costs

#### 5. Risk & Metrics
- **Risk**: Over-optimism.
- **Metric**: Realistic P&L

---

### Day 234: Feature Selection Optimization
**Wednesday** | *Outcome: Genetic algorithm to select optimal subset of features.*

#### 1. Tech & Commands
```bash
pip install sklearn-genetic
```

#### 2. Files
- `research/notebooks/genetic_selection.ipynb`

#### 3. Architecture
- Evolutionary Algo
- Optimization

#### 4. Autopilot Prompts
- Evolve feature sets
- Maximize Sharpe

#### 5. Risk & Metrics
- **Risk**: Computation cost.
- **Metric**: Optimal subset

---

### Day 235: Regime Logic Integration
**Thursday** | *Outcome: Use HMM (Hidden Markov Model) to switch strategies.*

#### 1. Tech & Commands
```bash
pip install hmmlearn
```

#### 2. Files
- `libs/ml/regime_detection.py`

#### 3. Architecture
- Regime Switching
- HMM

#### 4. Autopilot Prompts
- Detect Bull/Bear/Sideways
- Adjust leverage accordingly

#### 5. Risk & Metrics
- **Risk**: Lagging indicator.
- **Metric**: Probability based

---

### Day 236: Clustering for Universe Selection
**Friday** | *Outcome: Cluster stocks by price movement to select diverse universe.*

#### 1. Tech & Commands
```bash
pip install scikit-learn
```

#### 2. Files
- `libs/ml/clustering.py`

#### 3. Architecture
- Unsupervised
- K-Means/DBSCAN

#### 4. Autopilot Prompts
- Cluster stocks
- Pick 1 from each cluster

#### 5. Risk & Metrics
- **Risk**: Correlation breakdown.
- **Metric**: Diversified Universe

---

### Day 237: [WEEKEND] Performance Attribution (ML)
**Saturday** | *Outcome: Research & Cleanup: Attribution analysis specifically for ML factors.*

#### 1. Tech & Commands
```bash
touch reports/ml_attribution.py
```

#### 2. Files
- `reports/ml_attribution.md`

#### 3. Architecture
- Analysis
- Alpha

#### 4. Autopilot Prompts
- Example: 'Momentum contributed 2%', 'ML Signal 5%'

#### 5. Risk & Metrics
- **Risk**: Ambiguity.
- **Metric**: Clear sources of return

---

### Day 238: [WEEKEND] Confidence Scoring
**Sunday** | *Outcome: Research & Cleanup: Convert model probability to trade conviction size.*

#### 1. Tech & Commands
```bash
touch apps/strategies/sizing.py
```

#### 2. Files
- `apps/strategies/sizing.py`

#### 3. Architecture
- Bet Sizing
- Kelly Criterion

#### 4. Autopilot Prompts
- Prob > 0.7 -> Full Size
- Prob < 0.55 -> Half Size

#### 5. Risk & Metrics
- **Risk**: Over-betting.
- **Metric**: Risk-adjusted sizing

---

## Week 35

### Day 239: Fail-Safe Logic for ML
**Monday** | *Outcome: Circuit breakers specific to ML model failure modes.*

#### 1. Tech & Commands
```bash
touch apps/risk/ml_failsafe.py
```

#### 2. Files
- `apps/risk/ml_failsafe.py`

#### 3. Architecture
- Risk Management
- Safety

#### 4. Autopilot Prompts
- Stop if model accuracy drops below 50%
- Stop if feature drift high

#### 5. Risk & Metrics
- **Risk**: Model blowup.
- **Metric**: Capital preservation

---

### Day 240: Q3 Month 2 Review
**Tuesday** | *Outcome: Deep dive into ML strategy performance and infrastructure.*

#### 1. Tech & Commands
```bash
touch reports/q3_m2_review.md
```

#### 2. Files
- `reports/q3_m2_review.md`

#### 3. Architecture
- Review
- Milestone

#### 4. Autopilot Prompts
- Assess XGBoost vs LSTM
- Plan Portfolio Optimization phase

#### 5. Risk & Metrics
- **Risk**: Complexity creep.
- **Metric**: Simplified robust models

---

### Day 241: Portfolio Theory Library (CVXPY)
**Wednesday** | *Outcome: Implement core Markowitz Mean-Variance Optimization engine.*

#### 1. Tech & Commands
```bash
pip install cvxpy ecos scs
```

#### 2. Files
- `libs/math/mvo.py`

#### 3. Architecture
- Convex Optimization
- Quadratic Programming

#### 4. Autopilot Prompts
- Minimize Variance subject to Return > Target
- Subject to sum(weights) = 1

#### 5. Risk & Metrics
- **Risk**: Unsolvable matrix.
- **Metric**: Optimal weights

---

### Day 242: Covariance Matrix Estimation
**Thursday** | *Outcome: Robust estimation of asset covariance (Ledoit-Wolf shrinkage).*

#### 1. Tech & Commands
```bash
pip install scikit-learn
```

#### 2. Files
- `libs/math/covariance.py`

#### 3. Architecture
- Statistics
- Risk Modeling

#### 4. Autopilot Prompts
- Calculate sample covariance
- Apply shrinkage to reduce noise

#### 5. Risk & Metrics
- **Risk**: Singular matrix.
- **Metric**: Invertible matrix

---

### Day 243: Black-Litterman Implementation
**Friday** | *Outcome: Combine market equilibrium with investor views (ML signals).*

#### 1. Tech & Commands
```bash
touch libs/math/black_litterman.py
```

#### 2. Files
- `libs/math/black_litterman.py`

#### 3. Architecture
- Bayesian Stats
- Portfolio Construction

#### 4. Autopilot Prompts
- Prior: Market Cap Weights
- Likelihood: ML Alpha Scores

#### 5. Risk & Metrics
- **Risk**: Confidence levels.
- **Metric**: Posterior weights

---

### Day 244: [WEEKEND] Hierarchical Risk Parity (HRP)
**Saturday** | *Outcome: Research & Cleanup: Machine Learning based allocation using clustering.*

#### 1. Tech & Commands
```bash
pip install scipy cluster
```

#### 2. Files
- `libs/math/hrp.py`

#### 3. Architecture
- Clustering
- Risk Parity

#### 4. Autopilot Prompts
- Tree clustering of correlation matrix
- Recursive bisection allocation

#### 5. Risk & Metrics
- **Risk**: Correlation instability.
- **Metric**: Robust diversification

---

### Day 245: [WEEKEND] Constraints Engine
**Sunday** | *Outcome: Research & Cleanup: Add real-world constraints to optimizer (Turnover, Leverage, Sector).*

#### 1. Tech & Commands
```bash
touch libs/math/constraints.py
```

#### 2. Files
- `libs/math/constraints.py`

#### 3. Architecture
- Linear Constraints
- Regulation

#### 4. Autopilot Prompts
- Max Turnover < 20%
- Max Sector Exposure < 30%
- Long Only (w >= 0)

#### 5. Risk & Metrics
- **Risk**: Infeasible problem.
- **Metric**: Feasible solution

---

## Week 36

### Day 246: Transaction Cost Analysis (TCA) in Optimization
**Monday** | *Outcome: Incorporate trading costs directly into the objective function.*

#### 1. Tech & Commands
```bash
touch libs/math/tca_model.py
```

#### 2. Files
- `libs/math/tca_model.py`

#### 3. Architecture
- Cost Modeling
- Slippage

#### 4. Autopilot Prompts
- Penalty = w_delta * cost_matrix
- Dampens turnover

#### 5. Risk & Metrics
- **Risk**: Over-trading.
- **Metric**: Efficient frontier

---

### Day 247: Performance Attribution (Brinson)
**Tuesday** | *Outcome: Decompose returns into Allocation vs Selection effects.*

#### 1. Tech & Commands
```bash
touch reports/attribution.py
```

#### 2. Files
- `reports/attribution.md`

#### 3. Architecture
- Reporting
- Analytics

#### 4. Autopilot Prompts
- Sector Allocation Effect
- Stock Selection Effect

#### 5. Risk & Metrics
- **Risk**: Unexplained alpha.
- **Metric**: Clarity

---

### Day 248: Alpha Combination Layer
**Wednesday** | *Outcome: Combine signals from multiple strategies (Trend, MeanDev, ML).*

#### 1. Tech & Commands
```bash
touch apps/portfolio/alpha_combiner.py
```

#### 2. Files
- `apps/portfolio/alpha_combiner.py`

#### 3. Architecture
- Signal Processing
- Ensemble

#### 4. Autopilot Prompts
- Normalize signals to Z-scores
- Weighted Average based on trailing Sharpe

#### 5. Risk & Metrics
- **Risk**: Signal decay.
- **Metric**: Strong aggregate signal

---

### Day 249: Risk Model Integration (Barra-style)
**Thursday** | *Outcome: Factor Risk Model to target specific factor exposures.*

#### 1. Tech & Commands
```bash
touch apps/risk/factor_model.py
```

#### 2. Files
- `apps/risk/factor_model.py`

#### 3. Architecture
- Risk Management
- Factors

#### 4. Autopilot Prompts
- Exposure target: Momentum
- Neutralize: Beta, Size

#### 5. Risk & Metrics
- **Risk**: Factor timing.
- **Metric**: Controlled risk

---

### Day 250: Volatility Targeting
**Friday** | *Outcome: Scale portfolio leverage to maintain constant volatility daily.*

#### 1. Tech & Commands
```bash
touch apps/portfolio/vol_target.py
```

#### 2. Files
- `apps/portfolio/vol_target.py`

#### 3. Architecture
- Leverage Control
- Risk parity

#### 4. Autopilot Prompts
- Target Vol = 15%
- Leverage = Target / Realized Vol

#### 5. Risk & Metrics
- **Risk**: De-leveraging loop.
- **Metric**: Stable risk profile

---

### Day 251: [WEEKEND] Drawdown Control Logic
**Saturday** | *Outcome: Research & Cleanup: Reduce exposure as drawdown deepens (CPPI-like logic).*

#### 1. Tech & Commands
```bash
touch apps/portfolio/drawdown_control.py
```

#### 2. Files
- `apps/portfolio/drawdown_control.py`

#### 3. Architecture
- Capital Protection
- Dynamic Allocation

#### 4. Autopilot Prompts
- Floor = 90% of High Water Mark
- Exposure = Multiplier * (Equity - Floor)

#### 5. Risk & Metrics
- **Risk**: Whipsaw.
- **Metric**: Survival

---

### Day 252: [WEEKEND] Liquidity Constraint Logic
**Sunday** | *Outcome: Research & Cleanup: Ensure position sizes do not exceed % of daily volume.*

#### 1. Tech & Commands
```bash
touch apps/portfolio/liquidity.py
```

#### 2. Files
- `apps/portfolio/liquidity.py`

#### 3. Architecture
- Market Impact
- Constraints

#### 4. Autopilot Prompts
- Max Position < 2% ADV
- Penalty in optimizer for illiquid stocks

#### 5. Risk & Metrics
- **Risk**: Stuck positions.
- **Metric**: Liquid portfolio

---

## Week 37

### Day 253: Turnover Constraint Logic
**Monday** | *Outcome: Limit daily trading volume to reduce costs.*

#### 1. Tech & Commands
```bash
touch apps/portfolio/turnover.py
```

#### 2. Files
- `apps/portfolio/turnover.py`

#### 3. Architecture
- Cost Efficiency
- rebalancing

#### 4. Autopilot Prompts
- Soft constraint in optimization
- Hard cap on generated orders

#### 5. Risk & Metrics
- **Risk**: Stale portfolio.
- **Metric**: Cost-efficient updates

---

### Day 254: Rebalance Scheduler
**Tuesday** | *Outcome: Define when to trigger rebalancing (Time vs Threshold).*

#### 1. Tech & Commands
```bash
touch apps/portfolio/scheduler.py
```

#### 2. Files
- `apps/portfolio/scheduler.py`

#### 3. Architecture
- Scheduling
- Event Driven

#### 4. Autopilot Prompts
- Cron: Daily at 9:15 AM
- Event: Drift > 5%

#### 5. Risk & Metrics
- **Risk**: Excessive trading.
- **Metric**: Timely updates

---

### Day 255: Cluster-based Optimization
**Wednesday** | *Outcome: Use clustering to enforce diversification constraints.*

#### 1. Tech & Commands
```bash
touch research/notebooks/cluster_opt.ipynb
```

#### 2. Files
- `research/notebooks/cluster_opt.ipynb`

#### 3. Architecture
- Unsupervised
- Diversification

#### 4. Autopilot Prompts
- Group correlated assets
- Constraint: max 20% per cluster

#### 5. Risk & Metrics
- **Risk**: Concentration risk.
- **Metric**: Broad verification

---

### Day 256: Nested Clustering Optimization (NCO)
**Thursday** | *Outcome: Advanced de-noising technique for covariance matrices.*

#### 1. Tech & Commands
```bash
touch research/notebooks/nco_research.ipynb
```

#### 2. Files
- `research/notebooks/nco_research.ipynb`

#### 3. Architecture
- Matrix Theory
- Stability

#### 4. Autopilot Prompts
- Cluster-level weights * Asset-level weights
- Compare vs Standard MVO

#### 5. Risk & Metrics
- **Risk**: Complexity.
- **Metric**: Higher Sharpe

---

### Day 257: Genetic Algorithms for Portfolio
**Friday** | *Outcome: Evolve portfolio weights using evolutionary strategies.*

#### 1. Tech & Commands
```bash
pip install deap
```

#### 2. Files
- `libs/math/genetic_opt.py`

#### 3. Architecture
- Evolutionary Computation
- Non-convex

#### 4. Autopilot Prompts
- Optimize non-convex objectives (e.g. Sortino)
- Population evolution

#### 5. Risk & Metrics
- **Risk**: Slow convergence.
- **Metric**: Global optimum

---

### Day 258: [WEEKEND] Kelly Criterion Optimization
**Saturday** | *Outcome: Research & Cleanup: Maximize log-growth utility (aggressive).*

#### 1. Tech & Commands
```bash
touch libs/math/kelly.py
```

#### 2. Files
- `libs/math/kelly.py`

#### 3. Architecture
- Bet Sizing
- Log Utility

#### 4. Autopilot Prompts
- Full Kelly (too risky)
- Fractional Kelly (Half-Kelly)

#### 5. Risk & Metrics
- **Risk**: Ruin.
- **Metric**: Growth maximization

---

### Day 259: [WEEKEND] Universal Portfolio (Cover's Algo)
**Sunday** | *Outcome: Research & Cleanup: Online portfolio selection algorithm benchmarking.*

#### 1. Tech & Commands
```bash
touch research/notebooks/universal_portfolio.ipynb
```

#### 2. Files
- `research/notebooks/universal_portfolio.ipynb`

#### 3. Architecture
- Information Theory
- Online Learning

#### 4. Autopilot Prompts
- Constant Rebalanced Portfolios
- Asymptotic optimality

#### 5. Risk & Metrics
- **Risk**: Transaction costs.
- **Metric**: Theoretical benchmark

---

## Week 38

### Day 260: Reinforcement Learning Portfolio Agent
**Monday** | *Outcome: Train RL agent to allocate weights dynamically.*

#### 1. Tech & Commands
```bash
touch research/rl/portfolio_agent.py
```

#### 2. Files
- `research/rl/portfolio_agent.py`

#### 3. Architecture
- Deep RL
- PPO

#### 4. Autopilot Prompts
- State: Market Regime
- Action: Sector Weights

#### 5. Risk & Metrics
- **Risk**: Sample inefficiency.
- **Metric**: Adaptive allocation

---

### Day 261: Tail Risk Hedging Strategy
**Tuesday** | *Outcome: Dedicate small % of capital to OTM puts (VIX calls).*

#### 1. Tech & Commands
```bash
touch apps/strategies/hedging.py
```

#### 2. Files
- `apps/strategies/hedging.py`

#### 3. Architecture
- Insurance
- Options

#### 4. Autopilot Prompts
- Buy 10% OTM Puts monthy
- Roll strategy

#### 5. Risk & Metrics
- **Risk**: Drag on returns.
- **Metric**: Crash protection

---

### Day 262: Full System Integration Test
**Wednesday** | *Outcome: End-to-End test of Data -> ML -> Optimizer -> Execution.*

#### 1. Tech & Commands
```bash
pytest tests/e2e/full_loop.py
```

#### 2. Files
- `tests/e2e/full_loop.py`

#### 3. Architecture
- Integration
- Verification

#### 4. Autopilot Prompts
- Mock market data feed
- Verify orders match target portfolio

#### 5. Risk & Metrics
- **Risk**: Drift.
- **Metric**: Perfect replication

---

### Day 263: Latency Profiling (End-to-End)
**Thursday** | *Outcome: Measure time from 'Tick' to 'Order Submitted'.*

#### 1. Tech & Commands
```bash
python scripts/profile_full_loop.py
```

#### 2. Files
- `reports/e2e_latency.png`

#### 3. Architecture
- Performance
- Optimization

#### 4. Autopilot Prompts
- Identify bottlenecks (Model inference? Convex Solver?)
- Optimize critical path

#### 5. Risk & Metrics
- **Risk**: Slow loop.
- **Metric**: <100ms total tick-to-trade

---

### Day 264: Backtest: ML + Optimization Strategy
**Friday** | *Outcome: Run 5-year backtest of the complete integrated system.*

#### 1. Tech & Commands
```bash
python apps/backtest/run_super_strat.py
```

#### 2. Files
- `reports/super_strat_results.pdf`

#### 3. Architecture
- Backtesting
- Validation

#### 4. Autopilot Prompts
- Compare vs SPY Buy-Hold
- Check annual turnover

#### 5. Risk & Metrics
- **Risk**: Overfitting.
- **Metric**: Realistic Alpha

---

### Day 265: [WEEKEND] Paper Trading Launch (Alpha)
**Saturday** | *Outcome: Research & Cleanup: Deploy full system to paper trading environment.*

#### 1. Tech & Commands
```bash
kubectl apply -f k8s/paper-trading/
```

#### 2. Files
- `k8s/paper-trading/deployment.yaml`

#### 3. Architecture
- Deployment
- UAT

#### 4. Autopilot Prompts
- Monitor live dashboard
- Wait for trades

#### 5. Risk & Metrics
- **Risk**: Config errors.
- **Metric**: Live execution

---

### Day 266: [WEEKEND] Documentation Update: ML & Portfolio
**Sunday** | *Outcome: Research & Cleanup: Document the mathematical models and signals used.*

#### 1. Tech & Commands
```bash
touch docs/models/math_spec.md
```

#### 2. Files
- `docs/models/math_spec.md`

#### 3. Architecture
- Documentation
- Knowledge Base

#### 4. Autopilot Prompts
- Formula for HRP
- Formula for Black-Litterman

#### 5. Risk & Metrics
- **Risk**: Obscure code.
- **Metric**: Clear math specs

---

## Week 39

### Day 267: Disaster Recovery Testing (Portfolio)
**Monday** | *Outcome: Simulate data corruption and portfolio state recovery.*

#### 1. Tech & Commands
```bash
python scripts/dr/corrupt_positions.py
```

#### 2. Files
- `scripts/dr/restore_positions.py`

#### 3. Architecture
- Resilience
- Recovery

#### 4. Autopilot Prompts
- Rebuild state from broker API
- Re-run optimizer

#### 5. Risk & Metrics
- **Risk**: Lost state.
- **Metric**: Fast recovery

---

### Day 268: Q3 Performance Review
**Tuesday** | *Outcome: Review paper trading results and backtest metrics.*

#### 1. Tech & Commands
```bash
python scripts/reporting/q3_review.py
```

#### 2. Files
- `reports/q3_review.md`

#### 3. Architecture
- Analytics
- Milestone

#### 4. Autopilot Prompts
- Sharpe Ratio vs Target
- Max Drawdown vs Limit

#### 5. Risk & Metrics
- **Risk**: Missed targets.
- **Metric**: Plan adjustment

---

### Day 269: Tech Debt Clean Up Sprint
**Wednesday** | *Outcome: Freeze new features, clean up code and tests.*

#### 1. Tech & Commands
```bash
flake8 apps/ libs/
mypy apps/ libs/
```

#### 2. Files
- `refactor_q3.md`

#### 3. Architecture
- Maintenance
- Quality

#### 4. Autopilot Prompts
- Fix Type hints
- Refactor monster functions

#### 5. Risk & Metrics
- **Risk**: Spaghetti.
- **Metric**: Clean architecture

---

### Day 270: Quarter 4 Planning Session
**Thursday** | *Outcome: Plan for White Labeling, Fund Admin, and IPO.*

#### 1. Tech & Commands
```bash
touch docs/planning/q4_roadmap.md
```

#### 2. Files
- `docs/planning/q4_roadmap.md`

#### 3. Architecture
- Strategy
- Roadmap

#### 4. Autopilot Prompts
- Define Multi-tenancy regs
- Plan Scale-out

#### 5. Risk & Metrics
- **Risk**: Scope creep.
- **Metric**: Final push

---
