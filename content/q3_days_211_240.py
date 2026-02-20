
from quarter_03 import add_day

# ─── MONTH 8: MACHINE LEARNING PIPELINE (DAYS 211-240) ──────────────────────

# Week 31: Predictive Modeling (XGBoost)
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
