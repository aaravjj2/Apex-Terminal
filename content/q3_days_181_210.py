
from quarter_03 import add_day

# ─── MONTH 7: ALTERNATIVE DATA & SENTIMENT (DAYS 181-210) ───────────────────

# Week 27: Alternative Data Ingestion
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
