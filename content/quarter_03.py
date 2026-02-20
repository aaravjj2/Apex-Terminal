
# ══════════════════════════════════════════════════════════════════════════════
# V4 CONTENT: QUARTER 3 (DAYS 181-270)
# Theme: INTELLIGENCE, ML & PORTFOLIO OPTIMIZATION
# ══════════════════════════════════════════════════════════════════════════════

DAYS = {}

# ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
def add_day(day_num, title, outcome, commands, files, arch, autopilot, risk, metrics):
    week_num = (day_num - 1) // 7 + 1
    weekday_idx = (day_num - 1) % 7
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    if weekday_idx >= 5: # Weekend Work
        title = f"[WEEKEND] {title}"
        outcome = f"Research & Cleanup: {outcome}"
    
    DAYS[day_num] = {
        'day_global': day_num,
        'weekday': weekdays[weekday_idx],
        'title': title,
        'outcome': outcome,
        'commands': commands,
        'files': files,
        'arch': arch,
        'autopilot': autopilot,
        'risk': risk,
        'metrics': metrics
    }

def _d(day_num, title, outcome, commands, files, arch, autopilot, risk, metrics):
    add_day(day_num, title, outcome, commands, files, arch, autopilot, risk, metrics)

# ─── POPULATE CONTENT ────────────────────────────────────────────────────────

# Source: q3_days_181_210.py
add_day(181, "NewsAPI Ingestion Service",
    "Ingest real-time news from NewsAPI.org and normalize.",
    ["pip install newsapi-python"],
    ["apps/data/ingestion/news_api.py", "apps/data/models/news.py"],
    ["ETL Pipeline", "Normalization"],
    ["Poll NewsAPI every 15m", "Deduplicate articles by URL"],
    "Rate limits.", "Zero missed headlines"
)

add_day(182, "Benzinga Pro Newswire Integration",
    "Connect to Benzinga TCP stream for low-latency financial news.",
    ["pip install benzinga"],
    ["apps/data/ingestion/benzinga_stream.py"],
    ["Stream Processing", "WebSockets"],
    ["Handle reconnections", "Parse rapid-fire JSON"],
    "Buffer overflow.", "<100ms latency"
)

add_day(183, "Twitter/X Scraper (nitter)",
    "Scrape financial twitter (FinTwit) for ticker mentions.",
    ["pip install ntscraper"],
    ["apps/data/ingestion/social/twitter.py"],
    ["Scraping", "Rate Limiting"],
    ["Rotate proxies", "Extract $CASHTAGS"],
    "Banhammer.", "Stable scraping"
)

add_day(184, "Reddit WallStreetBets Scraper",
    "Monitor r/WSB and r/stocks for retail sentiment spikes.",
    ["pip install praw"],
    ["apps/data/ingestion/social/reddit.py"],
    ["API Integration", "Batch Processing"],
    ["Fetch top posts hourly", "Count ticker mentions"],
    "API Quota.", "Hourly updates"
)

add_day(185, "SEC EDGAR Filer (13F/8K)",
    "Ingest institutional filings to track whale movements.",
    ["pip install sec-edgar-downloader"],
    ["apps/data/ingestion/sec.py"],
    ["Document Parsing", "XML Extraction"],
    ["Download 13F-HR", "Extract holdings table"],
    "Parsing errors.", "Accurate holdings"
)

add_day(186, "Economic Calendar & Fed Events",
    "Ingest macro events (CPI, FOMC) to tag high-volatility days.",
    ["pip install investpy"],
    ["apps/data/ingestion/macro.py"],
    ["Event Scheduling", "Risk Flagging"],
    ["Fetch economic calendar", "Flag days as 'High Volatility'"],
    "Missing data.", "Calendar sync"
)

add_day(187, "Data Lake Ingestion Pipeline",
    "Unified pipeline to dump all raw text data to S3/MinIO.",
    ["pip install boto3"],
    ["infra/datalake/s3_writer.py"],
    ["Data Lake", "Batch Write"],
    ["Partition by date/source", "Compress (Parquet/Snappy)"],
    "Disk fill.", "Efficient storage"
)

# Week 28: Sentiment Analysis Engine (NLP)
add_day(188, "FinBERT Model Setup",
    "Deploy Hugging Face FinBERT for financial sentiment classification.",
    ["pip install transformers torch"],
    ["libs/ml/nlp/finbert.py"],
    ["NLP", "Transformer"],
    ["Load ProsusAI/finbert", "Create prediction pipeline"],
    "Slow inference.", "Batch processing"
)

add_day(189, "Entity Recognition (NER)",
    "Extract specific tickers and company names from raw text.",
    ["pip install spacy"],
    ["libs/ml/nlp/ner.py"],
    ["Named Entity Recognition", "Symbology Mapping"],
    ["Map 'Apple' -> AAPL", "Disambiguate 'Ford' (Harrison vs Motor)"],
    "False matches.", "Precision > 95%"
)

add_day(190, "Sentiment Scoring Service",
    "Real-time service assigning -1 to +1 sentiment scores to news.",
    ["touch apps/services/sentiment.py"],
    ["apps/services/sentiment.py"],
    ["Microservice", "Inference"],
    ["Consume Kafka news topic", "Publish sentiment score topic"],
    "Backpressure.", "Throughput 100/sec"
)

add_day(191, "Aggregate Sentiment Signal",
    "Combine news, twitter, reddit scores into a single alpha factor.",
    ["touch apps/services/sentiment_aggregator.py"],
    ["apps/services/sentiment_aggregator.py"],
    ["Signal Processing", "Weighted Average"],
    ["Weight News (0.6) > Reddit (0.2)", "Decay old sentiment (half-life 4h)"],
    "Noise.", "Signal correlation"
)

add_day(192, "Sentiment Dashboard Widget",
    "Visualize sentiment trends vs Price on frontend.",
    ["npm install react-chartjs-2"],
    ["apps/web/src/features/Sentiment/SentimentChart.tsx"],
    ["Visualization", "Overlay"],
    ["Plot price candle", "Overlay sentiment moving avg"],
    "Laggy render.", "Real-time updates"
)

add_day(193, "LLM Summary Generation",
    "Use LLM to generate daily 'Morning Brief' from raw news.",
    ["pip install langchain"],
    ["apps/services/briefing.py"],
    ["Generative AI", "Summarization"],
    ["Prompt: Summarize top 5 bearish stories for TSLA", "Email report"],
    "Hallucinations.", "Fact-checked summaries"
)

add_day(194, "FOMC Press Conference Analyze",
    "Real-time transcription and hawkish/dovish scoring of Fed speech.",
    ["pip install openai-whisper"],
    ["apps/services/fomc_watcher.py"],
    ["Audio Processing", "Real-time NLP"],
    ["Transcribe audio stream", "Score hawkishness"],
    "Latency.", "Text within 5s"
)

# Week 29: Alpha Factor Research
add_day(195, "Alphalens Setup",
    "Setup Quantopian Alphalens for factor quality analysis.",
    ["pip install alphalens-reloaded"],
    ["research/factors/setup.py"],
    ["Factor Analysis", "Quantstats"],
    ["Format data for Alphalens", "Run tear sheet generation"],
    "Data alignment.", "Clean tear sheets"
)

add_day(196, "Momentum Factors",
    "Implement and test RSI, MACD, ROC factors.",
    ["touch libs/factors/momentum.py"],
    ["libs/factors/momentum.py"],
    ["Technical Analysis", "Vectorization"],
    ["Calc 14d RSI", "Calc 12/26 MACD"],
    "Lookahead.", "Shifted correctly"
)

add_day(197, "Volatilty Factors",
    "Implement ATR, Bollinger Band Width, Hist Vol.",
    ["touch libs/factors/volatility.py"],
    ["libs/factors/volatility.py"],
    ["Risk Metrics", "Standard Deviation"],
    ["Calc realized vol", "Calc implied vol surface"],
    "NaN handling.", "Robust calcs"
)

add_day(198, "Volume Factors",
    "Implement OBV, A/D Line, VPOC.",
    ["touch libs/factors/volume.py"],
    ["libs/factors/volume.py"],
    ["Market Microstructure", "Flow"],
    ["On-Balance Volume", "Volume Profile Point of Control"],
    "Adjusted volume.", "Splits handled"
)

add_day(199, "Sentiment Factors",
    "Backtest the predictive power of our sentiment engine.",
    ["touch research/factors/test_sentiment.py"],
    ["research/notebooks/sentiment_alpha.ipynb"],
    ["Hypothesis Testing", "Alpha Decay"],
    ["Correlate sentiment lag-1 with returns", "Check information coefficient (IC)"],
    "Low IC.", "IC > 0.02"
)

add_day(200, "Factor Correlation Matrix",
    "Identify collinearity among factors to avoid redundancy.",
    ["python scripts/calc_factor_corr.py"],
    ["reports/factor_correlation.png"],
    ["Statistics", "Diversification"],
    ["Heatmap of factor correlations", "Drop highly correlated (>0.7)"],
    "Multicollinearity.", "Orthogonal factors"
)

add_day(201, "Multi-Factor Ranking System",
    "Combine factors into a single rank for stock selection.",
    ["touch libs/factors/ranker.py"],
    ["libs/factors/ranker.py"],
    ["Z-Score", "Ranking"],
    ["Normalize factors (Z-score)", "Sum weighted scores"],
    "Outliers.", "Winsorization"
)

# Week 30: Machine Learning Pipeline Setup (MLOps)
add_day(202, "Feature Store (Feast) Init",
    "Initialize Feast feature store for training/serving consistency.",
    ["pip install feast"],
    ["feature_repo/feature_store.yaml"],
    ["MLOps", "Data Consistency"],
    ["Define entity: ticker", "Define features: rsi_14, senti_score"],
    "Time travel.", "Point-in-time correct"
)

add_day(203, "Feature Retrievel Service",
    "API to fetch feature vectors for inference.",
    ["touch apps/ml/feature_service.py"],
    ["apps/ml/feature_service.py"],
    ["Low Latency API", "Redis"],
    ["Get online features from Redis", "Get offline features from Parquet"],
    "Latency.", "<10ms retrieval"
)

add_day(204, "MLflow Experiment Tracking",
    "Setup MLflow to track experiments, params, and metrics.",
    ["pip install mlflow"],
    ["docker-compose.ml.yml"],
    ["Experiment Tracking", "Reproducibility"],
    ["Log params (learning_rate)", "Log metrics (RMSE, Accuracy)"],
    "Lost experiments.", "Full audit trail"
)

add_day(205, "Dataset Versioning (DVC)",
    "Version control large datasets used for training.",
    ["pip install dvc"],
    ["dvc init"],
    ["Data Versioning", "Storage"],
    ["Track .parquet files", "Push to S3 remote"],
    "Data drift.", "Reproducible datasets"
)

add_day(206, "Training Pipeline (Airflow/Prefect)",
    "Automate weekly model retraining.",
    ["pip install prefect"],
    ["pipelines/training_flow.py"],
    ["Orchestration", "Automation"],
    ["Fetch data -> Train -> Eval -> Register", "Schedule weekly"],
    "Pipeline failure.", "Alert on fail"
)

add_day(207, "Model Registry",
    "Central repository for versioned, production-ready models.",
    ["touch apps/ml/registry.py"],
    ["apps/ml/registry.py"],
    ["Governance", "Lifecycle"],
    ["Promote Staging -> Prod", "Rollback capability"],
    "Bad model deployed.", "Gatekeeper checks"
)

add_day(208, "Model Inference Server (Triton/FastAPI)",
    "Dedicated microservice for serving predictions.",
    ["touch apps/ml/inference.py"],
    ["apps/ml/inference.py"],
    ["Microservice", "Scalability"],
    ["Load model from registry", "Expose /predict endpoint"],
    "Throughput.", "1000 req/sec"
)

add_day(209, "A/B Testing Framework",
    "Infrastructure to test Model A vs Model B in live market.",
    ["touch apps/ml/ab_test.py"],
    ["apps/ml/ab_test.py"],
    ["Experimentation", "Routing"],
    ["Route 50% users to Model A", "Route 50% to Model B"],
    "Bias.", "Statistically significant"
)

add_day(210, "Q3 Month 1 Review",
    "Review data ingestion, factor quality, and MLOps setup.",
    ["touch reports/q3_m1_review.md"],
    ["reports/q3_m1_review.md"],
    ["Review", "Quality Gate"],
    ["Check factor ICs", "Verify Feature Store latency"],
    "Slow features.", "Green light"
)


# Source: q3_days_211_240.py
add_day(211, "Target Variable Definition",
    "Define what we are predicting (e.g., 5-min forward return > 0.1%).",
    ["touch research/targets.py"],
    ["research/targets.py"],
    ["Label Engineering", "Classification"],
    ["Define 'Up' vs 'Down' classes", "Handle class imbalance (SMOTE)"],
    "Leakage.", "Clean labels"
)

add_day(212, "XGBoost Baseline Model",
    "Train first Gradient Boosted Decision Tree (GBDT) model.",
    ["pip install xgboost"],
    ["research/notebooks/xgboost_baseline.ipynb"],
    ["Supervised Learning", "Boosting"],
    ["Train/Test Split (Time Series)", "Eval LogLoss/AUC"],
    "Overfitting.", "AUC > 0.55"
)

add_day(213, "Feature Importance Analysis (SHAP)",
    "Explain model predictions using SHAP values.",
    ["pip install shap"],
    ["research/notebooks/shap_analysis.ipynb"],
    ["Explainable AI", "feature Selection"],
    ["Plot summary dot plot", "Drop zero-importance features"],
    "Black box.", "Interpretability"
)

add_day(214, "Hyperparameter Tuning (Optuna)",
    "Optimize XGBoost params (eta, max_depth, subsample).",
    ["pip install optuna"],
    ["research/notebooks/optuna_optimization.ipynb"],
    ["Bayesian Optimization", "Search Space"],
    ["Run 100 trials", "Minimize validation logloss"],
    "Local minima.", "Global optimum found"
)

add_day(215, "CatBoost Implementation",
    "Test CatBoost for better handling of categorical features (Sector).",
    ["pip install catboost"],
    ["research/notebooks/catboost_test.ipynb"],
    ["Gradient Boosting", "Categorical Encoding"],
    ["Compare vs XGBoost", "Train on Sector/Industry columns"],
    "Long train time.", "Better OOS accuracy"
)

add_day(216, "Ensemble Stacking",
    "Combine XGBoost + CatBoost + LightGBM predictions.",
    ["touch apps/ml/ensemble.py"],
    ["apps/ml/ensemble.py"],
    ["Ensemble Learning", "Stacking"],
    ["Train meta-learner (Logistic Regression)", "Average predictions"],
    "Complexity.", "Robustness"
)

add_day(217, "Production Inference Pipeline",
    "Deploy the trained XGBoost model to the live trading loop.",
    ["touch apps/strategies/ml_strategy.py"],
    ["apps/strategies/ml_strategy.py"],
    ["Inference", "Strategy"],
    ["Fetch features -> Predict -> Signal", "Latency constraints"],
    "Slow prediction.", "<5ms inference"
)

# Week 32: Deep Learning (LSTM/Transformer)
add_day(218, "PyTorch Environment Setup",
    "Prepare GPU environment for Deep Learning experimentation.",
    ["pip install torch torchvision torchaudio"],
    ["infra/gpu/cuda_check.py"],
    ["Deep Learning", "GPU Acceleration"],
    ["Verify CUDA availability", "Load tensor to GPU"],
    "Driver hell.", "CUDA Ready"
)

add_day(219, "LSTM for Time Series",
    "Implement Long Short-Term Memory network for price prediction.",
    ["touch libs/ml/models/lstm.py"],
    ["libs/ml/models/lstm.py"],
    ["RNN", "Sequence Modeling"],
    ["Define input shape (batch, seq_len, features)", "Train on 60-min sequences"],
    "Vanishing gradient.", "Loss convergence"
)

add_day(220, "Temporal Fusion Transformer (TFT)",
    "Research state-of-the-art Transformer for interpretable forecasting.",
    ["pip install pytorch-forecasting"],
    ["research/notebooks/tft_research.ipynb"],
    ["Transformer", "Attention Mechanism"],
    ["Interpret attention weights", "Forecast volatility"],
    "Complexity.", "Better than LSTM"
)

add_day(221, "Autoencoder for Anomaly Detection",
    "Detect market regime changes or strange price action.",
    ["touch libs/ml/models/autoencoder.py"],
    ["libs/ml/models/autoencoder.py"],
    ["Unsupervised Learning", "Reconstruction Error"],
    ["Train on normal market data", "High reconstruction error = Anomaly"],
    "False alarms.", "Reliable detection"
)

add_day(222, "Reinforcement Learning Environment (Gym)",
    "Build an OpenAI Gym environment for trading.",
    ["pip install gym"],
    ["research/rl/trading_env.py"],
    ["Reinforcement Learning", "Simulation"],
    ["Define State (OHLC+Holdings)", "Define Action (Buy/Sell/Hold)", "Define Reward (P&L)"],
    "Reward hacking.", "Realistic sim"
)

add_day(223, "PPO Agent Training",
    "Train a Proximal Policy Optimization agent in the gym.",
    ["pip install stable-baselines3"],
    ["research/rl/train_ppo.py"],
    ["RL", "Policy Gradient"],
    ["Train 1M steps", "Monitor mean reward"],
    "Unstable training.", "Profitable policy"
)

add_day(224, "Model Distillation",
    "Compress large Deep Learning model into smaller, faster model.",
    ["touch apps/ml/distillation.py"],
    ["apps/ml/distillation.py"],
    ["Model Compression", "Performance"],
    ["Teacher (Transformer) -> Student (MLP)", "Minimize KL Divergence"],
    "Accuracy loss.", "Fast & Accurate"
)

# Week 33: MLOps & Monitoring (Drift)
add_day(225, "Data Drift Detection (Evidently AI)",
    "Monitor input feature distributions for shifts.",
    ["pip install evidently"],
    ["apps/monitoring/data_drift.py"],
    ["Drift Monitoring", "Quality Assurance"],
    ["Compare train vs serving distribution", "Alert on K-S test failure"],
    "Silent failure.", "Early warning"
)

add_day(226, "Concept Drift Detection",
    "Detect when the relationship between features and target changes.",
    ["touch apps/monitoring/concept_drift.py"],
    ["apps/monitoring/concept_drift.py"],
    ["Model Monitoring", "Retraining Trigger"],
    ["Monitor prediction error over time", "Trigger retraining if error spikes"],
    "Market regime shift.", "Adaptive model"
)

add_day(227, "Shadow Mode Deployment",
    "Run new ML models in production without trading (logging only).",
    ["touch apps/strategies/shadow_runner.py"],
    ["apps/strategies/shadow_runner.py"],
    ["Safe Deployment", "Evaluation"],
    ["Log 'Shadow Buys'", "Compare with live P&L"],
    "Risk free.", "Real-world validation"
)

add_day(228, "Online Learning (River)",
    "Update linear models incrementally with every new data point.",
    ["pip install river"],
    ["apps/ml/online_learning.py"],
    ["Incremental Learning", "Adaptability"],
    ["Update weights on each bar", "No full retraining needed"],
    "Catastrophic forgetting.", "Sticky weights"
)

add_day(229, "Explainability Dashboard",
    "UI to show why the ML model made a trade.",
    ["touch apps/web/src/features/ML/Explainability.tsx"],
    ["apps/api/routes/explain.py"],
    ["Trust", "Visualization"],
    ["Show top 3 contributing features", "Feature value context"],
    "Black box mistrust.", "Trader confidence"
)

add_day(230, "Automated Retraining Pipeline V2",
    "Fully autonomous retraining loop with safety gates.",
    ["touch pipelines/autonomous_retrain.py"],
    ["pipelines/autonomous_retrain.py"],
    ["Automation", "CI/CD for ML"],
    ["Trigger -> Train -> Eval -> Challenger vs Champion -> Deploy"],
    "Bad deploy.", "Automatic rollback"
)

add_day(231, "Model Governance & Auditing",
    "Compliance logs for every model version and valid period.",
    ["touch docs/compliance/model_inventory.md"],
    ["docs/compliance/model_inventory.md"],
    ["Governance", "Audit"],
    ["Log Training Data Hash", "Log Hyperparams", "Log performance metrics"],
    "Regulatory fine.", "Full compliance"
)

# Week 34: Backtesting ML Strategies
add_day(232, "Vectorized Backtesting (VectorBT)",
    "Rapidly backtest ML signals over variable params.",
    ["pip install vectorbt"],
    ["research/backtest/vbt_ml.py"],
    ["High Performance", "Backtesting"],
    ["Run 1000s of simulations", "Analyze Sharpe/Calmar"],
    "Lookahead.", "Correct shifting"
)

add_day(233, "Event-Driven ML Backtest",
    "Validate ML signals with realistic execution constraints.",
    ["python apps/backtest/run_ml_strat.py"],
    ["reports/ml_backtest_results.md"],
    ["Simulation", "Verification"],
    ["Include latency (feature calc time)", "Include transaction costs"],
    "Over-optimism.", "Realistic P&L"
)

add_day(234, "Feature Selection Optimization",
    "Genetic algorithm to select optimal subset of features.",
    ["pip install sklearn-genetic"],
    ["research/notebooks/genetic_selection.ipynb"],
    ["Evolutionary Algo", "Optimization"],
    ["Evolve feature sets", "Maximize Sharpe"],
    "Computation cost.", "Optimal subset"
)

add_day(235, "Regime Logic Integration",
    "Use HMM (Hidden Markov Model) to switch strategies.",
    ["pip install hmmlearn"],
    ["libs/ml/regime_detection.py"],
    ["Regime Switching", "HMM"],
    ["Detect Bull/Bear/Sideways", "Adjust leverage accordingly"],
    "Lagging indicator.", "Probability based"
)

add_day(236, "Clustering for Universe Selection",
    "Cluster stocks by price movement to select diverse universe.",
    ["pip install scikit-learn"],
    ["libs/ml/clustering.py"],
    ["Unsupervised", "K-Means/DBSCAN"],
    ["Cluster stocks", "Pick 1 from each cluster"],
    "Correlation breakdown.", "Diversified Universe"
)

add_day(237, "Performance Attribution (ML)",
    "Attribution analysis specifically for ML factors.",
    ["touch reports/ml_attribution.py"],
    ["reports/ml_attribution.md"],
    ["Analysis", "Alpha"],
    ["Example: 'Momentum contributed 2%', 'ML Signal 5%'"],
    "Ambiguity.", "Clear sources of return"
)

add_day(238, "Confidence Scoring",
    "Convert model probability to trade conviction size.",
    ["touch apps/strategies/sizing.py"],
    ["apps/strategies/sizing.py"],
    ["Bet Sizing", "Kelly Criterion"],
    ["Prob > 0.7 -> Full Size", "Prob < 0.55 -> Half Size"],
    "Over-betting.", "Risk-adjusted sizing"
)

add_day(239, "Fail-Safe Logic for ML",
    "Circuit breakers specific to ML model failure modes.",
    ["touch apps/risk/ml_failsafe.py"],
    ["apps/risk/ml_failsafe.py"],
    ["Risk Management", "Safety"],
    ["Stop if model accuracy drops below 50%", "Stop if feature drift high"],
    "Model blowup.", "Capital preservation"
)

add_day(240, "Q3 Month 2 Review",
    "Deep dive into ML strategy performance and infrastructure.",
    ["touch reports/q3_m2_review.md"],
    ["reports/q3_m2_review.md"],
    ["Review", "Milestone"],
    ["Assess XGBoost vs LSTM", "Plan Portfolio Optimization phase"],
    "Complexity creep.", "Simplified robust models"
)


# Source: q3_days_241_270.py
add_day(241, "Portfolio Theory Library (CVXPY)",
    "Implement core Markowitz Mean-Variance Optimization engine.",
    ["pip install cvxpy ecos scs"],
    ["libs/math/mvo.py"],
    ["Convex Optimization", "Quadratic Programming"],
    ["Minimize Variance subject to Return > Target", "Subject to sum(weights) = 1"],
    "Unsolvable matrix.", "Optimal weights"
)

add_day(242, "Covariance Matrix Estimation",
    "Robust estimation of asset covariance (Ledoit-Wolf shrinkage).",
    ["pip install scikit-learn"],
    ["libs/math/covariance.py"],
    ["Statistics", "Risk Modeling"],
    ["Calculate sample covariance", "Apply shrinkage to reduce noise"],
    "Singular matrix.", "Invertible matrix"
)

add_day(243, "Black-Litterman Implementation",
    "Combine market equilibrium with investor views (ML signals).",
    ["touch libs/math/black_litterman.py"],
    ["libs/math/black_litterman.py"],
    ["Bayesian Stats", "Portfolio Construction"],
    ["Prior: Market Cap Weights", "Likelihood: ML Alpha Scores"],
    "Confidence levels.", "Posterior weights"
)

add_day(244, "Hierarchical Risk Parity (HRP)",
    "Machine Learning based allocation using clustering.",
    ["pip install scipy cluster"],
    ["libs/math/hrp.py"],
    ["Clustering", "Risk Parity"],
    ["Tree clustering of correlation matrix", "Recursive bisection allocation"],
    "Correlation instability.", "Robust diversification"
)

add_day(245, "Constraints Engine",
    "Add real-world constraints to optimizer (Turnover, Leverage, Sector).",
    ["touch libs/math/constraints.py"],
    ["libs/math/constraints.py"],
    ["Linear Constraints", "Regulation"],
    ["Max Turnover < 20%", "Max Sector Exposure < 30%", "Long Only (w >= 0)"],
    "Infeasible problem.", "Feasible solution"
)

add_day(246, "Transaction Cost Analysis (TCA) in Optimization",
    "Incorporate trading costs directly into the objective function.",
    ["touch libs/math/tca_model.py"],
    ["libs/math/tca_model.py"],
    ["Cost Modeling", "Slippage"],
    ["Penalty = w_delta * cost_matrix", "Dampens turnover"],
    "Over-trading.", "Efficient frontier"
)

add_day(247, "Performance Attribution (Brinson)",
    "Decompose returns into Allocation vs Selection effects.",
    ["touch reports/attribution.py"],
    ["reports/attribution.md"],
    ["Reporting", "Analytics"],
    ["Sector Allocation Effect", "Stock Selection Effect"],
    "Unexplained alpha.", "Clarity"
)

# Week 36: Strategy Integration
add_day(248, "Alpha Combination Layer",
    "Combine signals from multiple strategies (Trend, MeanDev, ML).",
    ["touch apps/portfolio/alpha_combiner.py"],
    ["apps/portfolio/alpha_combiner.py"],
    ["Signal Processing", "Ensemble"],
    ["Normalize signals to Z-scores", "Weighted Average based on trailing Sharpe"],
    "Signal decay.", "Strong aggregate signal"
)

add_day(249, "Risk Model Integration (Barra-style)",
    "Factor Risk Model to target specific factor exposures.",
    ["touch apps/risk/factor_model.py"],
    ["apps/risk/factor_model.py"],
    ["Risk Management", "Factors"],
    ["Exposure target: Momentum", "Neutralize: Beta, Size"],
    "Factor timing.", "Controlled risk"
)

add_day(250, "Volatility Targeting",
    "Scale portfolio leverage to maintain constant volatility daily.",
    ["touch apps/portfolio/vol_target.py"],
    ["apps/portfolio/vol_target.py"],
    ["Leverage Control", "Risk parity"],
    ["Target Vol = 15%", "Leverage = Target / Realized Vol"],
    "De-leveraging loop.", "Stable risk profile"
)

add_day(251, "Drawdown Control Logic",
    "Reduce exposure as drawdown deepens (CPPI-like logic).",
    ["touch apps/portfolio/drawdown_control.py"],
    ["apps/portfolio/drawdown_control.py"],
    ["Capital Protection", "Dynamic Allocation"],
    ["Floor = 90% of High Water Mark", "Exposure = Multiplier * (Equity - Floor)"],
    "Whipsaw.", "Survival"
)

add_day(252, "Liquidity Constraint Logic",
    "Ensure position sizes do not exceed % of daily volume.",
    ["touch apps/portfolio/liquidity.py"],
    ["apps/portfolio/liquidity.py"],
    ["Market Impact", "Constraints"],
    ["Max Position < 2% ADV", "Penalty in optimizer for illiquid stocks"],
    "Stuck positions.", "Liquid portfolio"
)

add_day(253, "Turnover Constraint Logic",
    "Limit daily trading volume to reduce costs.",
    ["touch apps/portfolio/turnover.py"],
    ["apps/portfolio/turnover.py"],
    ["Cost Efficiency", "rebalancing"],
    ["Soft constraint in optimization", "Hard cap on generated orders"],
    "Stale portfolio.", "Cost-efficient updates"
)

add_day(254, "Rebalance Scheduler",
    "Define when to trigger rebalancing (Time vs Threshold).",
    ["touch apps/portfolio/scheduler.py"],
    ["apps/portfolio/scheduler.py"],
    ["Scheduling", "Event Driven"],
    ["Cron: Daily at 9:15 AM", "Event: Drift > 5%"],
    "Excessive trading.", "Timely updates"
)

# Week 37: Advanced Optimization Research
add_day(255, "Cluster-based Optimization",
    "Use clustering to enforce diversification constraints.",
    ["touch research/notebooks/cluster_opt.ipynb"],
    ["research/notebooks/cluster_opt.ipynb"],
    ["Unsupervised", "Diversification"],
    ["Group correlated assets", "Constraint: max 20% per cluster"],
    "Concentration risk.", "Broad verification"
)

add_day(256, "Nested Clustering Optimization (NCO)",
    "Advanced de-noising technique for covariance matrices.",
    ["touch research/notebooks/nco_research.ipynb"],
    ["research/notebooks/nco_research.ipynb"],
    ["Matrix Theory", "Stability"],
    ["Cluster-level weights * Asset-level weights", "Compare vs Standard MVO"],
    "Complexity.", "Higher Sharpe"
)

add_day(257, "Genetic Algorithms for Portfolio",
    "Evolve portfolio weights using evolutionary strategies.",
    ["pip install deap"],
    ["libs/math/genetic_opt.py"],
    ["Evolutionary Computation", "Non-convex"],
    ["Optimize non-convex objectives (e.g. Sortino)", "Population evolution"],
    "Slow convergence.", "Global optimum"
)

add_day(258, "Kelly Criterion Optimization",
    "Maximize log-growth utility (aggressive).",
    ["touch libs/math/kelly.py"],
    ["libs/math/kelly.py"],
    ["Bet Sizing", "Log Utility"],
    ["Full Kelly (too risky)", "Fractional Kelly (Half-Kelly)"],
    "Ruin.", "Growth maximization"
)

add_day(259, "Universal Portfolio (Cover's Algo)",
    "Online portfolio selection algorithm benchmarking.",
    ["touch research/notebooks/universal_portfolio.ipynb"],
    ["research/notebooks/universal_portfolio.ipynb"],
    ["Information Theory", "Online Learning"],
    ["Constant Rebalanced Portfolios", "Asymptotic optimality"],
    "Transaction costs.", "Theoretical benchmark"
)

add_day(260, "Reinforcement Learning Portfolio Agent",
    "Train RL agent to allocate weights dynamically.",
    ["touch research/rl/portfolio_agent.py"],
    ["research/rl/portfolio_agent.py"],
    ["Deep RL", "PPO"],
    ["State: Market Regime", "Action: Sector Weights"],
    "Sample inefficiency.", "Adaptive allocation"
)

add_day(261, "Tail Risk Hedging Strategy",
    "Dedicate small % of capital to OTM puts (VIX calls).",
    ["touch apps/strategies/hedging.py"],
    ["apps/strategies/hedging.py"],
    ["Insurance", "Options"],
    ["Buy 10% OTM Puts monthy", "Roll strategy"],
    "Drag on returns.", "Crash protection"
)

# Week 38: Quarter 3 Retrospective & Final Integration
add_day(262, "Full System Integration Test",
    "End-to-End test of Data -> ML -> Optimizer -> Execution.",
    ["pytest tests/e2e/full_loop.py"],
    ["tests/e2e/full_loop.py"],
    ["Integration", "Verification"],
    ["Mock market data feed", "Verify orders match target portfolio"],
    "Drift.", "Perfect replication"
)

add_day(263, "Latency Profiling (End-to-End)",
    "Measure time from 'Tick' to 'Order Submitted'.",
    ["python scripts/profile_full_loop.py"],
    ["reports/e2e_latency.png"],
    ["Performance", "Optimization"],
    ["Identify bottlenecks (Model inference? Convex Solver?)", "Optimize critical path"],
    "Slow loop.", "<100ms total tick-to-trade"
)

add_day(264, "Backtest: ML + Optimization Strategy",
    "Run 5-year backtest of the complete integrated system.",
    ["python apps/backtest/run_super_strat.py"],
    ["reports/super_strat_results.pdf"],
    ["Backtesting", "Validation"],
    ["Compare vs SPY Buy-Hold", "Check annual turnover"],
    "Overfitting.", "Realistic Alpha"
)

add_day(265, "Paper Trading Launch (Alpha)",
    "Deploy full system to paper trading environment.",
    ["kubectl apply -f k8s/paper-trading/"],
    ["k8s/paper-trading/deployment.yaml"],
    ["Deployment", "UAT"],
    ["Monitor live dashboard", "Wait for trades"],
    "Config errors.", "Live execution"
)

add_day(266, "Documentation Update: ML & Portfolio",
    "Document the mathematical models and signals used.",
    ["touch docs/models/math_spec.md"],
    ["docs/models/math_spec.md"],
    ["Documentation", "Knowledge Base"],
    ["Formula for HRP", "Formula for Black-Litterman"],
    "Obscure code.", "Clear math specs"
)

add_day(267, "Disaster Recovery Testing (Portfolio)",
    "Simulate data corruption and portfolio state recovery.",
    ["python scripts/dr/corrupt_positions.py"],
    ["scripts/dr/restore_positions.py"],
    ["Resilience", "Recovery"],
    ["Rebuild state from broker API", "Re-run optimizer"],
    "Lost state.", "Fast recovery"
)

add_day(268, "Q3 Performance Review",
    "Review paper trading results and backtest metrics.",
    ["python scripts/reporting/q3_review.py"],
    ["reports/q3_review.md"],
    ["Analytics", "Milestone"],
    ["Sharpe Ratio vs Target", "Max Drawdown vs Limit"],
    "Missed targets.", "Plan adjustment"
)

add_day(269, "Tech Debt Clean Up Sprint",
    "Freeze new features, clean up code and tests.",
    ["flake8 apps/ libs/", "mypy apps/ libs/"],
    ["refactor_q3.md"],
    ["Maintenance", "Quality"],
    ["Fix Type hints", "Refactor monster functions"],
    "Spaghetti.", "Clean architecture"
)

add_day(270, "Quarter 4 Planning Session",
    "Plan for White Labeling, Fund Admin, and IPO.",
    ["touch docs/planning/q4_roadmap.md"],
    ["docs/planning/q4_roadmap.md"],
    ["Strategy", "Roadmap"],
    ["Define Multi-tenancy regs", "Plan Scale-out"],
    "Scope creep.", "Final push"
)

