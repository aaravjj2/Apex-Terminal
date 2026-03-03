"""
News & Research Service — §11 of tasks.md
==========================================
Multi-source news aggregation, NLP sentiment analysis, entity extraction,
topic modeling, news correlation with price movement, research reports,
earnings calendar, IPO tracking, SEC filings, analyst ratings.

Uses: NewsAPI, Finnhub, Reddit, SEC EDGAR, FRED, Groq/Gemini for NLP.
"""

import os, asyncio, logging, re, json, hashlib
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict, Counter
import statistics

logger = logging.getLogger(__name__)

NEWSAPI_KEY   = os.getenv("NEWSAPI_KEY", "")
FINNHUB_KEY   = os.getenv("FINNHUB_API_KEY", "")
REDDIT_CLIENT = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")
REDDIT_USER   = os.getenv("REDDIT_USERNAME", "")
SEC_API_KEY   = os.getenv("SEC_API_KEY", "")
GROQ_KEY      = os.getenv("GROQ_API_KEY", "")
GEMINI_KEY    = os.getenv("GEMINI_API_KEY", "")
FRED_KEY      = os.getenv("FRED_API_KEY", "")

# ── Enums ─────────────────────────────────────────────────────────────────────

class NewsSource(str, Enum):
    NEWSAPI    = "newsapi"
    FINNHUB    = "finnhub"
    REDDIT     = "reddit"
    SEC        = "sec"
    CUSTOM     = "custom"

class SentimentLabel(str, Enum):
    VERY_BEARISH = "very_bearish"
    BEARISH      = "bearish"
    NEUTRAL      = "neutral"
    BULLISH      = "bullish"
    VERY_BULLISH = "very_bullish"

class NewsCategory(str, Enum):
    EARNINGS       = "earnings"
    MACRO          = "macro"
    MERGER_ACQ     = "merger_acquisition"
    IPO            = "ipo"
    REGULATION     = "regulation"
    PRODUCT        = "product_launch"
    MANAGEMENT     = "management"
    ANALYST        = "analyst_rating"
    CRYPTO         = "crypto"
    GEOPOLITICAL   = "geopolitical"
    COMMODITIES    = "commodities"
    TECHNOLOGY     = "technology"
    HEALTHCARE     = "healthcare"
    ENERGY         = "energy"
    FINANCIALS     = "financials"
    REAL_ESTATE    = "real_estate"
    GENERAL        = "general"

class FilingType(str, Enum):
    FORM_10K   = "10-K"
    FORM_10Q   = "10-Q"
    FORM_8K    = "8-K"
    FORM_S1    = "S-1"
    FORM_4     = "4"
    FORM_SC13D = "SC 13D"
    FORM_DEF14A= "DEF 14A"
    FORM_13F   = "13F-HR"
    FORM_SD    = "SD"

# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class NewsArticle:
    id: str
    title: str
    description: str
    content: str
    source: str
    source_name: str
    url: str
    image_url: str
    published_at: str
    category: NewsCategory
    sentiment: SentimentLabel
    sentiment_score: float       # -1 to 1
    relevance_score: float       # 0 to 1
    tickers: List[str]
    entities: List[Dict[str, str]]
    keywords: List[str]
    language: str
    author: str

@dataclass
class SentimentAnalysis:
    ticker: str
    overall_sentiment: SentimentLabel
    overall_score: float
    news_count: int
    positive_count: int
    negative_count: int
    neutral_count: int
    sentiment_change_24h: float
    sentiment_trend: str         # "improving", "deteriorating", "stable"
    top_positive: List[Dict[str, Any]]
    top_negative: List[Dict[str, Any]]
    social_sentiment: float
    social_volume: int
    social_mentions_change: float
    word_cloud: Dict[str, int]
    timestamp: str

@dataclass
class EarningsEvent:
    symbol: str
    company_name: str
    report_date: str
    fiscal_quarter: str
    fiscal_year: int
    eps_estimate: float
    eps_actual: Optional[float]
    revenue_estimate: float
    revenue_actual: Optional[float]
    eps_surprise: Optional[float]
    eps_surprise_pct: Optional[float]
    revenue_surprise: Optional[float]
    revenue_surprise_pct: Optional[float]
    guidance: Optional[str]
    conference_call_time: str
    report_time: str           # "before_market", "after_market"
    analyst_count: int
    stock_reaction_pct: Optional[float]

@dataclass
class IPOEvent:
    company_name: str
    symbol: str
    exchange: str
    ipo_date: str
    price_range_low: float
    price_range_high: float
    shares_offered: int
    valuation: float
    underwriters: List[str]
    sector: str
    status: str               # "upcoming", "priced", "withdrawn"
    ipo_price: Optional[float]
    first_day_close: Optional[float]
    first_day_return: Optional[float]
    lock_up_expiry: str
    description: str

@dataclass
class SECFiling:
    company_name: str
    ticker: str
    cik: str
    filing_type: str
    filed_date: str
    accepted_date: str
    accession_number: str
    url: str
    size_bytes: int
    summary: str
    key_items: List[str]
    insider_transactions: Optional[List[Dict[str, Any]]]
    material_events: List[str]

@dataclass
class AnalystRating:
    symbol: str
    analyst_name: str
    firm: str
    rating: str              # "Buy", "Hold", "Sell", "Overweight", etc.
    previous_rating: str
    price_target: float
    previous_target: float
    target_change: float
    date: str
    summary: str

@dataclass
class SocialPost:
    platform: str
    author: str
    title: str
    content: str
    url: str
    score: int
    comments: int
    created_at: str
    sentiment: float
    tickers: List[str]
    subreddit: Optional[str]

@dataclass
class TopicCluster:
    topic_id: int
    label: str
    keywords: List[str]
    article_count: int
    avg_sentiment: float
    trending_score: float
    representative_articles: List[str]

@dataclass
class NewsPriceCorrelation:
    ticker: str
    event_type: str
    sentiment_at_event: float
    price_before: float
    price_after_1d: float
    price_after_5d: float
    return_1d: float
    return_5d: float
    correlation_score: float
    sample_size: int

@dataclass
class ResearchReport:
    title: str
    author: str
    firm: str
    date: str
    ticker: str
    report_type: str         # "initiation", "update", "sector", "macro"
    rating: str
    price_target: float
    thesis: str
    key_points: List[str]
    risks: List[str]
    catalysts: List[str]
    comparable_companies: List[Dict[str, Any]]
    model_assumptions: Dict[str, Any]

# ── NewsAPI Integration ──────────────────────────────────────────────────────

async def _fetch_newsapi(query: str, from_date: Optional[str] = None, page_size: int = 50) -> List[Dict[str, Any]]:
    """Fetch from NewsAPI"""
    if not NEWSAPI_KEY:
        return []
    try:
        import aiohttp
        params = {
            "q": query,
            "apiKey": NEWSAPI_KEY,
            "pageSize": page_size,
            "sortBy": "publishedAt",
            "language": "en",
        }
        if from_date:
            params["from"] = from_date
        url = "https://newsapi.org/v2/everything"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                return data.get("articles", [])
    except Exception as e:
        logger.warning(f"NewsAPI fetch failed: {e}")
        return []


async def _fetch_newsapi_headlines(category: str = "business", country: str = "us") -> List[Dict[str, Any]]:
    """Fetch top headlines from NewsAPI"""
    if not NEWSAPI_KEY:
        return []
    try:
        import aiohttp
        url = "https://newsapi.org/v2/top-headlines"
        params = {
            "category": category,
            "country": country,
            "apiKey": NEWSAPI_KEY,
            "pageSize": 50,
        }
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                return data.get("articles", [])
    except Exception as e:
        logger.warning(f"NewsAPI headlines fetch failed: {e}")
        return []


# ── Finnhub News ──────────────────────────────────────────────────────────────

async def _fetch_finnhub_news(symbol: str = "", category: str = "general") -> List[Dict[str, Any]]:
    """Fetch from Finnhub"""
    if not FINNHUB_KEY:
        return []
    try:
        import aiohttp
        if symbol:
            url = f"https://finnhub.io/api/v1/company-news"
            from_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
            to_date = datetime.now().strftime("%Y-%m-%d")
            params = {"symbol": symbol, "from": from_date, "to": to_date, "token": FINNHUB_KEY}
        else:
            url = f"https://finnhub.io/api/v1/news"
            params = {"category": category, "token": FINNHUB_KEY}

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as resp:
                if resp.status != 200:
                    return []
                return await resp.json()
    except Exception as e:
        logger.warning(f"Finnhub news fetch failed: {e}")
        return []


async def _fetch_finnhub_sentiment(symbol: str) -> Dict[str, Any]:
    """Fetch social sentiment from Finnhub"""
    if not FINNHUB_KEY:
        return {}
    try:
        import aiohttp
        url = "https://finnhub.io/api/v1/stock/social-sentiment"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params={"symbol": symbol, "token": FINNHUB_KEY}) as resp:
                if resp.status != 200:
                    return {}
                return await resp.json()
    except Exception as e:
        logger.warning(f"Finnhub sentiment fetch failed: {e}")
        return {}


# ── Reddit Integration ───────────────────────────────────────────────────────

async def _get_reddit_token() -> Optional[str]:
    """Get Reddit OAuth token"""
    if not REDDIT_CLIENT or not REDDIT_SECRET:
        return None
    try:
        import aiohttp
        auth = aiohttp.BasicAuth(REDDIT_CLIENT, REDDIT_SECRET)
        data = {"grant_type": "password", "username": REDDIT_USER, "password": os.getenv("REDDIT_PASSWORD", "")}
        headers = {"User-Agent": "ApexTerminal/1.0"}
        async with aiohttp.ClientSession() as session:
            async with session.post("https://www.reddit.com/api/v1/access_token",
                                     auth=auth, data=data, headers=headers) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    return result.get("access_token")
        return None
    except Exception:
        return None


async def _fetch_reddit_posts(subreddit: str = "wallstreetbets", limit: int = 50, sort: str = "hot") -> List[Dict[str, Any]]:
    """Fetch Reddit posts"""
    token = await _get_reddit_token()
    if not token:
        return []
    try:
        import aiohttp
        headers = {"Authorization": f"bearer {token}", "User-Agent": "ApexTerminal/1.0"}
        url = f"https://oauth.reddit.com/r/{subreddit}/{sort}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params={"limit": limit}) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                posts = []
                for child in data.get("data", {}).get("children", []):
                    p = child.get("data", {})
                    posts.append({
                        "title": p.get("title", ""),
                        "selftext": p.get("selftext", "")[:500],
                        "score": p.get("score", 0),
                        "num_comments": p.get("num_comments", 0),
                        "url": f"https://reddit.com{p.get('permalink', '')}",
                        "created_utc": p.get("created_utc", 0),
                        "author": p.get("author", ""),
                        "subreddit": subreddit,
                    })
                return posts
    except Exception as e:
        logger.warning(f"Reddit fetch failed: {e}")
        return []


# ── SEC EDGAR Integration ────────────────────────────────────────────────────

CIK_MAP = {
    "AAPL": "0000320193", "MSFT": "0000789019", "GOOGL": "0001652044",
    "AMZN": "0001018724", "TSLA": "0001318605", "META": "0001326801",
    "NVDA": "0001045810", "JPM": "0000019617", "V": "0001403161",
    "JNJ": "0000200406", "UNH": "0000731766", "WMT": "0000104169",
    "PG": "0000080424", "MA": "0001141391", "BAC": "0000070858",
    "DIS": "0001744489", "NFLX": "0001065280", "COST": "0000909832",
    "AMD": "0000002488", "INTC": "0000050863",
}


async def _fetch_sec_filings(ticker: str, filing_type: Optional[str] = None, count: int = 10) -> List[Dict[str, Any]]:
    """Fetch SEC EDGAR filings"""
    cik = CIK_MAP.get(ticker)
    if not cik:
        return []
    try:
        import aiohttp
        url = f"https://efts.sec.gov/LATEST/search-index?q=%22{ticker}%22&dateRange=custom&startdt=2024-01-01&enddt={date.today()}"
        headers = {"User-Agent": f"ApexTerminal research@apexterminal.com", "Accept": "application/json"}
        if SEC_API_KEY:
            headers["Authorization"] = f"Bearer {SEC_API_KEY}"
        # Use full-text search endpoint
        url2 = f"https://efts.sec.gov/LATEST/search-index?q={ticker}&forms={filing_type or ''}&dateRange=custom"
        # Fallback to EDGAR API
        url3 = f"https://data.sec.gov/submissions/CIK{cik}.json"
        async with aiohttp.ClientSession() as session:
            async with session.get(url3, headers=headers) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                recent = data.get("filings", {}).get("recent", {})
                forms = recent.get("form", [])
                dates = recent.get("filingDate", [])
                accessions = recent.get("accessionNumber", [])
                primary_docs = recent.get("primaryDocument", [])

                filings = []
                for i in range(min(count, len(forms))):
                    if filing_type and forms[i] != filing_type:
                        continue
                    acc = accessions[i].replace("-", "")
                    doc_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{primary_docs[i]}"
                    filings.append({
                        "form": forms[i],
                        "filed_date": dates[i],
                        "accession": accessions[i],
                        "url": doc_url,
                        "company": data.get("name", ticker),
                    })
                    if len(filings) >= count:
                        break
                return filings
    except Exception as e:
        logger.warning(f"SEC fetch failed for {ticker}: {e}")
        return []


# ── NLP / Sentiment Engine ───────────────────────────────────────────────────

# Sentiment lexicon for financial text
POSITIVE_WORDS = {
    "surge", "soar", "rally", "gain", "profit", "growth", "bullish", "upgrade",
    "outperform", "beat", "exceed", "strong", "robust", "accelerate", "optimistic",
    "breakout", "breakthrough", "record", "high", "positive", "improvement",
    "innovation", "expand", "milestone", "dividend", "buyback", "acquisition",
    "partnership", "deal", "launch", "approve", "succeed", "momentum", "recover",
    "opportunity", "upside", "potential", "promising", "resilient", "boost",
    "increase", "rise", "advance", "climb", "jump", "spike", "surge",
}

NEGATIVE_WORDS = {
    "crash", "plunge", "drop", "fall", "decline", "loss", "bearish", "downgrade",
    "underperform", "miss", "miss", "weak", "slowdown", "decelerate", "pessimistic",
    "breakdown", "low", "negative", "deterioration", "bankruptcy", "layoff",
    "recall", "investigation", "lawsuit", "fine", "penalty", "fraud", "scandal",
    "default", "recession", "inflation", "risk", "warning", "threat", "concern",
    "decrease", "slump", "tumble", "sink", "collapse", "crisis", "volatile",
    "uncertainty", "headwind", "pressure", "contraction", "deficit", "sell-off",
}

AMPLIFIERS = {"very", "extremely", "significantly", "substantially", "dramatically", "sharply"}
NEGATORS = {"not", "no", "never", "n't", "without", "barely", "hardly"}


def _compute_lexicon_sentiment(text: str) -> Tuple[float, SentimentLabel]:
    """Compute sentiment using lexicon-based approach"""
    if not text:
        return 0.0, SentimentLabel.NEUTRAL

    words = re.findall(r'\b\w+\b', text.lower())
    score = 0.0
    prev_word = ""

    for word in words:
        if word in POSITIVE_WORDS:
            modifier = 1.5 if prev_word in AMPLIFIERS else (-1.0 if prev_word in NEGATORS else 1.0)
            score += modifier
        elif word in NEGATIVE_WORDS:
            modifier = 1.5 if prev_word in AMPLIFIERS else (-1.0 if prev_word in NEGATORS else 1.0)
            score -= modifier
        prev_word = word

    if len(words) > 0:
        score = score / math.sqrt(len(words))  # normalize by text length

    # Clamp to [-1, 1]
    score = max(-1.0, min(1.0, score / 5.0))

    if score > 0.3:
        label = SentimentLabel.VERY_BULLISH if score > 0.6 else SentimentLabel.BULLISH
    elif score < -0.3:
        label = SentimentLabel.VERY_BEARISH if score < -0.6 else SentimentLabel.BEARISH
    else:
        label = SentimentLabel.NEUTRAL

    return round(score, 4), label


async def _compute_llm_sentiment(text: str) -> Tuple[float, SentimentLabel]:
    """Use Groq/Gemini for advanced sentiment analysis"""
    if not GROQ_KEY and not GEMINI_KEY:
        return _compute_lexicon_sentiment(text)

    try:
        import aiohttp
        prompt = f"""Analyze the sentiment of this financial news. Return ONLY a JSON object with:
- "score": float from -1 (very bearish) to 1 (very bullish)
- "label": one of "very_bearish", "bearish", "neutral", "bullish", "very_bullish"
- "entities": list of mentioned company tickers
- "category": one of "earnings", "macro", "merger_acquisition", "ipo", "regulation", "product_launch", "analyst_rating", "general"

Text: {text[:500]}"""

        if GROQ_KEY:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"}
            body = {
                "model": "llama-3.1-8b-instant",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1,
                "max_tokens": 200,
            }
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=body) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        content = data["choices"][0]["message"]["content"]
                        # Parse JSON from response
                        json_match = re.search(r'\{[^}]+\}', content)
                        if json_match:
                            result = json.loads(json_match.group())
                            score = float(result.get("score", 0))
                            label_str = result.get("label", "neutral")
                            return score, SentimentLabel(label_str)

        return _compute_lexicon_sentiment(text)
    except Exception as e:
        logger.warning(f"LLM sentiment failed: {e}")
        return _compute_lexicon_sentiment(text)


def _extract_tickers(text: str) -> List[str]:
    """Extract stock tickers from text"""
    # Common ticker patterns: $AAPL or just AAPL in context
    dollar_tickers = re.findall(r'\$([A-Z]{1,5})\b', text)
    # Upper case words that look like tickers
    upper_words = re.findall(r'\b([A-Z]{2,5})\b', text)
    # Filter common non-ticker uppercase words
    non_tickers = {"THE", "AND", "FOR", "NOT", "BUT", "ARE", "WAS", "HAS", "HAD",
                   "CAN", "ALL", "HER", "WAS", "ONE", "OUR", "OUT", "NEW", "CEO",
                   "CFO", "IPO", "ETF", "SEC", "FDA", "ISS", "NYSE", "NASDAQ",
                   "USA", "GDP", "CPI", "FED", "API", "ETH", "BTC", "NFT", "AI"}
    filtered = [t for t in upper_words if t not in non_tickers and len(t) >= 2]
    return list(set(dollar_tickers + filtered))[:10]


def _extract_entities(text: str) -> List[Dict[str, str]]:
    """Extract named entities from text"""
    entities = []
    # Company name patterns
    company_patterns = [
        (r'\b(Apple|Microsoft|Google|Alphabet|Amazon|Tesla|Meta|Nvidia|JPMorgan|Goldman Sachs)\b', "COMPANY"),
        (r'\b(S&P 500|Dow Jones|Nasdaq|Russell 2000|FTSE|Nikkei|DAX)\b', "INDEX"),
        (r'\b(Federal Reserve|Fed|ECB|BOJ|BOE|PBOC|RBI)\b', "ORGANIZATION"),
        (r'\b(Jerome Powell|Janet Yellen|Christine Lagarde|Elon Musk|Tim Cook|Satya Nadella)\b', "PERSON"),
    ]
    for pattern, entity_type in company_patterns:
        matches = re.findall(pattern, text)
        for m in matches:
            entities.append({"text": m, "type": entity_type})
    return entities[:20]


def _extract_keywords(text: str, top_n: int = 10) -> List[str]:
    """Extract important keywords using TF approach"""
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    stopwords = {"the", "and", "for", "not", "but", "are", "was", "has", "had", "can", "all",
                 "her", "was", "one", "our", "out", "new", "its", "this", "that", "with",
                 "from", "will", "have", "been", "more", "also", "than", "said", "each",
                 "may", "which", "their", "about", "would", "could", "other", "into",
                 "some", "when", "over", "just", "year", "most", "after", "before"}
    filtered = [w for w in words if w not in stopwords]
    counts = Counter(filtered)
    return [word for word, count in counts.most_common(top_n)]


def _categorize_article(title: str, content: str) -> NewsCategory:
    """Categorize news article based on content"""
    text = (title + " " + content).lower()
    category_keywords = {
        NewsCategory.EARNINGS: ["earnings", "revenue", "eps", "quarterly results", "beat estimates", "miss estimates"],
        NewsCategory.MACRO: ["gdp", "inflation", "interest rate", "federal reserve", "unemployment", "economic"],
        NewsCategory.MERGER_ACQ: ["acquisition", "merger", "takeover", "buyout", "deal", "acquire"],
        NewsCategory.IPO: ["ipo", "initial public offering", "going public", "debut"],
        NewsCategory.REGULATION: ["regulation", "sec", "fda", "antitrust", "compliance", "fine", "lawsuit"],
        NewsCategory.PRODUCT: ["launch", "product", "release", "unveil", "announce", "patent"],
        NewsCategory.MANAGEMENT: ["ceo", "cfo", "resign", "appointed", "hire", "executive"],
        NewsCategory.ANALYST: ["upgrade", "downgrade", "price target", "analyst", "rating", "overweight"],
        NewsCategory.CRYPTO: ["bitcoin", "ethereum", "crypto", "blockchain", "defi", "nft"],
        NewsCategory.COMMODITIES: ["oil", "gold", "commodity", "crude", "natural gas", "wheat"],
        NewsCategory.TECHNOLOGY: ["ai", "artificial intelligence", "semiconductor", "chip", "software"],
        NewsCategory.HEALTHCARE: ["drug", "fda approval", "clinical trial", "pharma", "biotech"],
        NewsCategory.ENERGY: ["solar", "renewable", "oil", "gas", "energy", "utility"],
    }
    for cat, keywords in category_keywords.items():
        if any(kw in text for kw in keywords):
            return cat
    return NewsCategory.GENERAL


# ── News Aggregation ─────────────────────────────────────────────────────────

async def get_news(
    query: Optional[str] = None,
    ticker: Optional[str] = None,
    category: Optional[str] = None,
    sources: Optional[List[str]] = None,
    from_date: Optional[str] = None,
    limit: int = 50,
) -> List[NewsArticle]:
    """Get aggregated news from multiple sources"""
    articles: List[NewsArticle] = []

    # Determine search query
    search_q = query or ticker or "stock market"

    # Fetch from all sources in parallel
    tasks = []
    if not sources or "newsapi" in sources:
        tasks.append(_fetch_newsapi(search_q, from_date, min(limit, 50)))
    if not sources or "finnhub" in sources:
        if ticker:
            tasks.append(_fetch_finnhub_news(ticker))
        else:
            tasks.append(_fetch_finnhub_news(category=category or "general"))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Process NewsAPI results
    for result in results:
        if isinstance(result, Exception):
            continue
        if not isinstance(result, list):
            continue

        for item in result:
            try:
                # Determine source type
                if "source" in item and isinstance(item["source"], dict):
                    # NewsAPI format
                    title = item.get("title", "")
                    desc = item.get("description", "")
                    content = item.get("content", desc)
                    source_name = item.get("source", {}).get("name", "Unknown")
                    url = item.get("url", "")
                    image = item.get("urlToImage", "")
                    pub_date = item.get("publishedAt", datetime.now().isoformat())
                    author = item.get("author", "")
                    source_type = NewsSource.NEWSAPI
                elif "headline" in item:
                    # Finnhub format
                    title = item.get("headline", "")
                    desc = item.get("summary", "")
                    content = desc
                    source_name = item.get("source", "")
                    url = item.get("url", "")
                    image = item.get("image", "")
                    pub_date = datetime.fromtimestamp(item.get("datetime", 0)).isoformat()
                    author = ""
                    source_type = NewsSource.FINNHUB
                else:
                    continue

                if not title:
                    continue

                # Compute sentiment
                full_text = f"{title} {desc} {content}"
                score, label = _compute_lexicon_sentiment(full_text)

                # Extract metadata
                tickers = _extract_tickers(full_text)
                if ticker and ticker not in tickers:
                    tickers.insert(0, ticker)
                entities = _extract_entities(full_text)
                keywords = _extract_keywords(full_text)
                cat = _categorize_article(title, content)

                article_id = hashlib.md5(f"{title}{pub_date}".encode()).hexdigest()

                articles.append(NewsArticle(
                    id=article_id,
                    title=title,
                    description=desc[:300] if desc else "",
                    content=content[:1000] if content else "",
                    source=source_type.value,
                    source_name=source_name,
                    url=url,
                    image_url=image or "",
                    published_at=pub_date,
                    category=cat,
                    sentiment=label,
                    sentiment_score=score,
                    relevance_score=0.8 if ticker and ticker in tickers else 0.5,
                    tickers=tickers,
                    entities=entities,
                    keywords=keywords,
                    language="en",
                    author=author or "",
                ))
            except Exception as e:
                logger.debug(f"Article parse error: {e}")
                continue

    # Sort by date
    articles.sort(key=lambda a: a.published_at, reverse=True)
    return articles[:limit]


async def get_news_headlines(category: str = "business") -> List[NewsArticle]:
    """Get top news headlines"""
    raw = await _fetch_newsapi_headlines(category)
    articles = []
    for item in raw:
        title = item.get("title", "")
        desc = item.get("description", "")
        score, label = _compute_lexicon_sentiment(f"{title} {desc}")
        article_id = hashlib.md5(title.encode()).hexdigest()
        articles.append(NewsArticle(
            id=article_id, title=title, description=desc[:300],
            content=item.get("content", "")[:1000],
            source="newsapi", source_name=item.get("source", {}).get("name", ""),
            url=item.get("url", ""), image_url=item.get("urlToImage", ""),
            published_at=item.get("publishedAt", ""),
            category=_categorize_article(title, desc),
            sentiment=label, sentiment_score=score, relevance_score=0.7,
            tickers=_extract_tickers(f"{title} {desc}"),
            entities=_extract_entities(title), keywords=_extract_keywords(f"{title} {desc}"),
            language="en", author=item.get("author", ""),
        ))
    return articles


# ── Sentiment Aggregation ────────────────────────────────────────────────────

async def get_sentiment_analysis(ticker: str) -> SentimentAnalysis:
    """Comprehensive sentiment analysis for a ticker"""
    # Get news articles
    articles = await get_news(ticker=ticker, limit=100)

    if not articles:
        return SentimentAnalysis(
            ticker=ticker, overall_sentiment=SentimentLabel.NEUTRAL, overall_score=0,
            news_count=0, positive_count=0, negative_count=0, neutral_count=0,
            sentiment_change_24h=0, sentiment_trend="stable",
            top_positive=[], top_negative=[], social_sentiment=0,
            social_volume=0, social_mentions_change=0, word_cloud={},
            timestamp=datetime.now().isoformat(),
        )

    scores = [a.sentiment_score for a in articles]
    overall = statistics.mean(scores) if scores else 0

    pos = sum(1 for s in scores if s > 0.1)
    neg = sum(1 for s in scores if s < -0.1)
    neu = len(scores) - pos - neg

    # Top articles by sentiment
    sorted_articles = sorted(articles, key=lambda a: a.sentiment_score, reverse=True)
    top_pos = [{"title": a.title, "score": a.sentiment_score, "url": a.url} for a in sorted_articles[:3]]
    top_neg = [{"title": a.title, "score": a.sentiment_score, "url": a.url} for a in sorted_articles[-3:]]

    # 24h change
    now = datetime.now()
    recent = [a.sentiment_score for a in articles
              if a.published_at and datetime.fromisoformat(a.published_at.replace("Z", "+00:00").replace("+00:00", "")) > now - timedelta(hours=24)]
    older = [a.sentiment_score for a in articles
             if a.published_at and datetime.fromisoformat(a.published_at.replace("Z", "+00:00").replace("+00:00", "")) <= now - timedelta(hours=24)]
    recent_avg = statistics.mean(recent) if recent else overall
    older_avg = statistics.mean(older) if older else overall
    change_24h = recent_avg - older_avg
    trend = "improving" if change_24h > 0.05 else "deteriorating" if change_24h < -0.05 else "stable"

    # Social sentiment from Finnhub
    social_data = await _fetch_finnhub_sentiment(ticker)
    social_sentiment = 0.0
    social_volume = 0
    if social_data:
        reddit_data = social_data.get("reddit", [])
        twitter_data = social_data.get("twitter", [])
        if reddit_data:
            social_sentiment = statistics.mean([r.get("score", 0) for r in reddit_data[-10:]]) if reddit_data else 0
            social_volume = sum(r.get("mention", 0) for r in reddit_data[-10:])

    # Word cloud from all articles
    all_text = " ".join(a.title + " " + a.description for a in articles)
    word_cloud_data = Counter(_extract_keywords(all_text, 30))

    # Determine overall sentiment label
    if overall > 0.3:
        label = SentimentLabel.VERY_BULLISH if overall > 0.6 else SentimentLabel.BULLISH
    elif overall < -0.3:
        label = SentimentLabel.VERY_BEARISH if overall < -0.6 else SentimentLabel.BEARISH
    else:
        label = SentimentLabel.NEUTRAL

    return SentimentAnalysis(
        ticker=ticker,
        overall_sentiment=label,
        overall_score=round(overall, 4),
        news_count=len(articles),
        positive_count=pos,
        negative_count=neg,
        neutral_count=neu,
        sentiment_change_24h=round(change_24h, 4),
        sentiment_trend=trend,
        top_positive=top_pos,
        top_negative=top_neg,
        social_sentiment=round(social_sentiment, 4),
        social_volume=social_volume,
        social_mentions_change=0,
        word_cloud=dict(word_cloud_data),
        timestamp=datetime.now().isoformat(),
    )


# ── Earnings Calendar ────────────────────────────────────────────────────────

async def _fetch_finnhub_earnings(from_date: str, to_date: str) -> List[Dict[str, Any]]:
    """Fetch earnings from Finnhub"""
    if not FINNHUB_KEY:
        return []
    try:
        import aiohttp
        url = "https://finnhub.io/api/v1/calendar/earnings"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params={"from": from_date, "to": to_date, "token": FINNHUB_KEY}) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                return data.get("earningsCalendar", [])
    except Exception as e:
        logger.warning(f"Finnhub earnings fetch failed: {e}")
        return []


async def get_earnings_calendar(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    symbol: Optional[str] = None,
) -> List[EarningsEvent]:
    """Get earnings calendar"""
    if not from_date:
        from_date = datetime.now().strftime("%Y-%m-%d")
    if not to_date:
        to_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")

    raw = await _fetch_finnhub_earnings(from_date, to_date)
    events = []

    for e in raw:
        sym = e.get("symbol", "")
        if symbol and sym != symbol:
            continue

        eps_est = e.get("epsEstimate", 0) or 0
        eps_act = e.get("epsActual")
        rev_est = e.get("revenueEstimate", 0) or 0
        rev_act = e.get("revenueActual")
        eps_surprise = (eps_act - eps_est) if eps_act is not None else None
        eps_surprise_pct = (eps_surprise / abs(eps_est) * 100) if eps_surprise is not None and eps_est else None
        rev_surprise = (rev_act - rev_est) if rev_act is not None else None
        rev_surprise_pct = (rev_surprise / abs(rev_est) * 100) if rev_surprise is not None and rev_est else None

        events.append(EarningsEvent(
            symbol=sym,
            company_name=sym,  # Would need company name lookup
            report_date=e.get("date", ""),
            fiscal_quarter=f"Q{e.get('quarter', 0)}",
            fiscal_year=e.get("year", datetime.now().year),
            eps_estimate=eps_est,
            eps_actual=eps_act,
            revenue_estimate=rev_est,
            revenue_actual=rev_act,
            eps_surprise=round(eps_surprise, 4) if eps_surprise is not None else None,
            eps_surprise_pct=round(eps_surprise_pct, 2) if eps_surprise_pct is not None else None,
            revenue_surprise=round(rev_surprise, 2) if rev_surprise is not None else None,
            revenue_surprise_pct=round(rev_surprise_pct, 2) if rev_surprise_pct is not None else None,
            guidance=None,
            conference_call_time="",
            report_time=e.get("hour", "after_market"),
            analyst_count=e.get("number", 0) or 0,
            stock_reaction_pct=None,
        ))

    return sorted(events, key=lambda e: e.report_date)


# ── IPO Calendar ──────────────────────────────────────────────────────────────

async def _fetch_finnhub_ipos(from_date: str, to_date: str) -> List[Dict[str, Any]]:
    """Fetch IPOs from Finnhub"""
    if not FINNHUB_KEY:
        return []
    try:
        import aiohttp
        url = "https://finnhub.io/api/v1/calendar/ipo"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params={"from": from_date, "to": to_date, "token": FINNHUB_KEY}) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
                return data.get("ipoCalendar", [])
    except Exception as e:
        logger.warning(f"Finnhub IPO fetch failed: {e}")
        return []


async def get_ipo_calendar(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> List[IPOEvent]:
    """Get IPO calendar"""
    if not from_date:
        from_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not to_date:
        to_date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")

    raw = await _fetch_finnhub_ipos(from_date, to_date)
    events = []

    for e in raw:
        price_low = e.get("priceLow", 0) or 0
        price_high = e.get("priceHigh", 0) or 0
        shares = e.get("numberOfShares", 0) or 0
        mid_price = (price_low + price_high) / 2 if price_low and price_high else 0
        valuation = mid_price * e.get("totalSharesValue", 0) if mid_price else 0

        events.append(IPOEvent(
            company_name=e.get("name", ""),
            symbol=e.get("symbol", ""),
            exchange=e.get("exchange", ""),
            ipo_date=e.get("date", ""),
            price_range_low=price_low,
            price_range_high=price_high,
            shares_offered=shares,
            valuation=valuation,
            underwriters=[],
            sector="Technology",  # Would need sector classification
            status="upcoming" if e.get("date", "") > datetime.now().strftime("%Y-%m-%d") else "priced",
            ipo_price=None,
            first_day_close=None,
            first_day_return=None,
            lock_up_expiry="",
            description="",
        ))

    return sorted(events, key=lambda e: e.ipo_date)


# ── SEC Filings ──────────────────────────────────────────────────────────────

async def get_sec_filings(
    ticker: str,
    filing_type: Optional[str] = None,
    count: int = 10,
) -> List[SECFiling]:
    """Get SEC filings for a ticker"""
    raw = await _fetch_sec_filings(ticker, filing_type, count)
    filings = []

    for f in raw:
        form = f.get("form", "")
        # Generate summary based on filing type
        if form == "10-K":
            summary = f"Annual report for {f.get('company', ticker)}"
            key_items = ["Financial Statements", "Risk Factors", "Management Discussion"]
        elif form == "10-Q":
            summary = f"Quarterly report for {f.get('company', ticker)}"
            key_items = ["Financial Statements", "Results of Operations"]
        elif form == "8-K":
            summary = f"Current report - material event disclosure for {f.get('company', ticker)}"
            key_items = ["Material Event", "Financial Exhibit"]
        elif form == "4":
            summary = f"Insider transaction filing for {f.get('company', ticker)}"
            key_items = ["Transaction Type", "Shares", "Price"]
        else:
            summary = f"{form} filing for {f.get('company', ticker)}"
            key_items = []

        filings.append(SECFiling(
            company_name=f.get("company", ticker),
            ticker=ticker,
            cik=CIK_MAP.get(ticker, ""),
            filing_type=form,
            filed_date=f.get("filed_date", ""),
            accepted_date=f.get("filed_date", ""),
            accession_number=f.get("accession", ""),
            url=f.get("url", ""),
            size_bytes=0,
            summary=summary,
            key_items=key_items,
            insider_transactions=None,
            material_events=[],
        ))

    return filings


# ── Analyst Ratings ──────────────────────────────────────────────────────────

async def _fetch_finnhub_recommendations(symbol: str) -> List[Dict[str, Any]]:
    """Fetch analyst recommendations from Finnhub"""
    if not FINNHUB_KEY:
        return []
    try:
        import aiohttp
        url = f"https://finnhub.io/api/v1/stock/recommendation"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params={"symbol": symbol, "token": FINNHUB_KEY}) as resp:
                if resp.status != 200:
                    return []
                return await resp.json()
    except Exception as e:
        logger.warning(f"Finnhub recommendation fetch failed: {e}")
        return []


async def _fetch_finnhub_price_target(symbol: str) -> Dict[str, Any]:
    """Fetch consensus price target from Finnhub"""
    if not FINNHUB_KEY:
        return {}
    try:
        import aiohttp
        url = f"https://finnhub.io/api/v1/stock/price-target"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params={"symbol": symbol, "token": FINNHUB_KEY}) as resp:
                if resp.status != 200:
                    return {}
                return await resp.json()
    except Exception as e:
        logger.warning(f"Finnhub price target fetch failed: {e}")
        return {}


async def get_analyst_ratings(symbol: str) -> List[AnalystRating]:
    """Get analyst ratings and price targets"""
    recs = await _fetch_finnhub_recommendations(symbol)
    target_data = await _fetch_finnhub_price_target(symbol)

    ratings = []
    for r in recs[:20]:
        period = r.get("period", "")
        buy = r.get("buy", 0)
        hold = r.get("hold", 0)
        sell = r.get("sell", 0)
        strong_buy = r.get("strongBuy", 0)
        strong_sell = r.get("strongSell", 0)

        total = buy + hold + sell + strong_buy + strong_sell
        if total == 0:
            continue

        # Consensus rating
        if strong_buy + buy > total * 0.6:
            rating = "Buy"
        elif sell + strong_sell > total * 0.4:
            rating = "Sell"
        else:
            rating = "Hold"

        target = target_data.get("targetMean", 0) or 0

        ratings.append(AnalystRating(
            symbol=symbol,
            analyst_name="Consensus",
            firm=f"{total} analysts",
            rating=rating,
            previous_rating="",
            price_target=target,
            previous_target=target_data.get("targetLow", 0) or 0,
            target_change=0,
            date=period,
            summary=f"Strong Buy: {strong_buy}, Buy: {buy}, Hold: {hold}, Sell: {sell}, Strong Sell: {strong_sell}",
        ))

    return ratings


# ── Social Media Analytics ───────────────────────────────────────────────────

FINANCE_SUBREDDITS = [
    "wallstreetbets", "stocks", "investing", "options",
    "stockmarket", "thetagang", "dividends", "ValueInvesting",
    "cryptocurrency", "Bitcoin", "ethereum", "defi",
]


async def get_social_posts(
    ticker: Optional[str] = None,
    subreddit: Optional[str] = None,
    limit: int = 50,
) -> List[SocialPost]:
    """Get social media posts"""
    target_sub = subreddit or "wallstreetbets"
    raw = await _fetch_reddit_posts(target_sub, limit)

    posts = []
    for p in raw:
        title = p.get("title", "")
        content = p.get("selftext", "")
        full_text = f"{title} {content}"

        # Skip if ticker specified and not mentioned
        if ticker and ticker.upper() not in full_text.upper() and f"${ticker}" not in full_text:
            continue

        score, _ = _compute_lexicon_sentiment(full_text)
        tickers = _extract_tickers(full_text)

        posts.append(SocialPost(
            platform="reddit",
            author=p.get("author", ""),
            title=title,
            content=content[:500],
            url=p.get("url", ""),
            score=p.get("score", 0),
            comments=p.get("num_comments", 0),
            created_at=datetime.fromtimestamp(p.get("created_utc", 0)).isoformat() if p.get("created_utc") else "",
            sentiment=score,
            tickers=tickers,
            subreddit=target_sub,
        ))

    return sorted(posts, key=lambda p: p.score, reverse=True)[:limit]


async def get_trending_tickers_social() -> List[Dict[str, Any]]:
    """Get trending tickers from social media"""
    all_tickers: List[str] = []
    sentiments: Dict[str, List[float]] = defaultdict(list)

    for sub in ["wallstreetbets", "stocks", "investing"]:
        posts = await get_social_posts(subreddit=sub, limit=100)
        for p in posts:
            for t in p.tickers:
                all_tickers.append(t)
                sentiments[t].append(p.sentiment)

    # Count and rank
    counter = Counter(all_tickers)
    trending = []
    for ticker, count in counter.most_common(30):
        sents = sentiments.get(ticker, [0])
        avg_sent = statistics.mean(sents) if sents else 0
        trending.append({
            "ticker": ticker,
            "mentions": count,
            "avg_sentiment": round(avg_sent, 4),
            "sentiment_label": "bullish" if avg_sent > 0.1 else "bearish" if avg_sent < -0.1 else "neutral",
            "trending_score": count * (1 + abs(avg_sent)),
        })

    return sorted(trending, key=lambda t: t["trending_score"], reverse=True)


# ── Topic Modeling ───────────────────────────────────────────────────────────

async def get_topic_clusters(articles: Optional[List[NewsArticle]] = None) -> List[TopicCluster]:
    """Cluster news articles into topics"""
    if not articles:
        articles = await get_news(limit=100)

    if not articles:
        return []

    # Simple keyword-based clustering
    topic_groups: Dict[str, List[NewsArticle]] = defaultdict(list)
    for article in articles:
        cat_key = article.category.value
        topic_groups[cat_key].append(article)

    clusters = []
    for i, (topic_key, arts) in enumerate(topic_groups.items()):
        all_keywords: List[str] = []
        sentiments = []
        titles = []
        for a in arts:
            all_keywords.extend(a.keywords)
            sentiments.append(a.sentiment_score)
            titles.append(a.title)

        top_keywords = [w for w, c in Counter(all_keywords).most_common(10)]
        avg_sent = statistics.mean(sentiments) if sentiments else 0
        trending = len(arts) * (1 + abs(avg_sent))

        clusters.append(TopicCluster(
            topic_id=i,
            label=topic_key.replace("_", " ").title(),
            keywords=top_keywords,
            article_count=len(arts),
            avg_sentiment=round(avg_sent, 4),
            trending_score=round(trending, 2),
            representative_articles=titles[:3],
        ))

    return sorted(clusters, key=lambda c: c.trending_score, reverse=True)


# ── News-Price Correlation ───────────────────────────────────────────────────

async def compute_news_price_correlation(ticker: str) -> List[NewsPriceCorrelation]:
    """Analyze correlation between news sentiment and price movement"""
    articles = await get_news(ticker=ticker, limit=200)
    if not articles:
        return []

    # Get price data
    try:
        import yfinance as yf
        tk = yf.Ticker(ticker)
        hist = tk.history(period="3mo")
        if hist.empty:
            return []
        prices = {idx.strftime("%Y-%m-%d"): float(row["Close"]) for idx, row in hist.iterrows()}
    except Exception:
        return []

    correlations = []
    for article in articles:
        try:
            pub_date = article.published_at[:10]
            if pub_date not in prices:
                continue

            price_at_event = prices[pub_date]
            dates_after_1d = sorted([d for d in prices if d > pub_date])[:1]
            dates_after_5d = sorted([d for d in prices if d > pub_date])[:5]

            if not dates_after_1d or not dates_after_5d:
                continue

            price_1d = prices[dates_after_1d[-1]]
            price_5d = prices[dates_after_5d[-1]]
            ret_1d = (price_1d - price_at_event) / price_at_event * 100
            ret_5d = (price_5d - price_at_event) / price_at_event * 100

            # Correlation: does sentiment direction predict price direction?
            corr = 1.0 if (article.sentiment_score > 0 and ret_1d > 0) or (article.sentiment_score < 0 and ret_1d < 0) else -1.0

            correlations.append(NewsPriceCorrelation(
                ticker=ticker,
                event_type=article.category.value,
                sentiment_at_event=article.sentiment_score,
                price_before=round(price_at_event, 2),
                price_after_1d=round(price_1d, 2),
                price_after_5d=round(price_5d, 2),
                return_1d=round(ret_1d, 4),
                return_5d=round(ret_5d, 4),
                correlation_score=corr,
                sample_size=1,
            ))
        except Exception:
            continue

    return correlations[:50]


# ── Research Report Generator ────────────────────────────────────────────────

async def generate_research_report(ticker: str) -> Optional[ResearchReport]:
    """Generate AI-powered research report"""
    # Gather all data
    sentiment = await get_sentiment_analysis(ticker)
    analyst_ratings = await get_analyst_ratings(ticker)
    news = await get_news(ticker=ticker, limit=20)

    # Get stock fundamentals via yfinance
    try:
        import yfinance as yf
        tk = yf.Ticker(ticker)
        info = tk.info
        price = info.get("currentPrice", info.get("regularMarketPrice", 0))
        pe = info.get("forwardPE", info.get("trailingPE", 0))
        revenue = info.get("totalRevenue", 0)
        profit_margin = info.get("profitMargins", 0)
        sector = info.get("sector", "Unknown")
        industry = info.get("industry", "Unknown")
        name = info.get("longName", ticker)
        market_cap = info.get("marketCap", 0)
        beta = info.get("beta", 1.0)
        dividend_yield = info.get("dividendYield", 0)
        fifty_two_high = info.get("fiftyTwoWeekHigh", 0)
        fifty_two_low = info.get("fiftyTwoWeekLow", 0)
    except Exception:
        price = pe = revenue = profit_margin = 0
        name = ticker
        sector = industry = "Unknown"
        market_cap = beta = dividend_yield = fifty_two_high = fifty_two_low = 0

    # Determine rating
    rating = "Buy" if sentiment.overall_score > 0.1 else "Sell" if sentiment.overall_score < -0.1 else "Hold"
    if analyst_ratings:
        rating = analyst_ratings[0].rating

    target = price * 1.15 if rating == "Buy" else price * 0.9 if rating == "Sell" else price * 1.05

    key_points = [
        f"Trading at ${price:.2f}, P/E ratio of {pe:.1f}x",
        f"Market cap: ${market_cap / 1e9:.1f}B",
        f"Profit margin: {profit_margin * 100:.1f}%",
        f"News sentiment: {sentiment.overall_sentiment.value} ({sentiment.overall_score:.2f})",
        f"52-week range: ${fifty_two_low:.2f} - ${fifty_two_high:.2f}",
    ]

    risks = [
        "Market volatility and macroeconomic uncertainty",
        "Competitive pressure in the industry",
        "Regulatory changes that could impact operations",
        "Supply chain disruptions",
    ]

    catalysts = [
        "Upcoming earnings report",
        "Product pipeline expansion",
        "Market share gains",
        "Favorable industry trends",
    ]

    return ResearchReport(
        title=f"{name} ({ticker}) - Research Report",
        author="Apex Terminal AI Research",
        firm="Apex Terminal",
        date=datetime.now().strftime("%Y-%m-%d"),
        ticker=ticker,
        report_type="update",
        rating=rating,
        price_target=round(target, 2),
        thesis=f"{name} is currently rated {rating} based on fundamental analysis, news sentiment ({sentiment.overall_sentiment.value}), and analyst consensus.",
        key_points=key_points,
        risks=risks,
        catalysts=catalysts,
        comparable_companies=[],
        model_assumptions={
            "revenue_growth": "8%",
            "margin_expansion": "50bps",
            "wacc": "10%",
            "terminal_growth": "3%",
        },
    )


# ── News Dashboard Aggregator ────────────────────────────────────────────────

@dataclass
class NewsDashboard:
    headlines: List[Dict[str, Any]]
    market_sentiment: Dict[str, Any]
    trending_tickers: List[Dict[str, Any]]
    topic_clusters: List[Dict[str, Any]]
    earnings_calendar: List[Dict[str, Any]]
    ipos: List[Dict[str, Any]]
    recent_filings: List[Dict[str, Any]]
    social_trending: List[Dict[str, Any]]
    timestamp: str


async def get_news_dashboard() -> NewsDashboard:
    """Comprehensive news dashboard"""
    headlines = await get_news_headlines()
    trending = await get_trending_tickers_social()
    topics = await get_topic_clusters()
    earnings = await get_earnings_calendar()
    ipos = await get_ipo_calendar()

    # Compute market-wide sentiment
    all_scores = [a.sentiment_score for a in headlines]
    market_sent = {
        "overall_score": round(statistics.mean(all_scores), 4) if all_scores else 0,
        "bullish_pct": round(sum(1 for s in all_scores if s > 0.1) / max(len(all_scores), 1) * 100, 2),
        "bearish_pct": round(sum(1 for s in all_scores if s < -0.1) / max(len(all_scores), 1) * 100, 2),
        "article_count": len(all_scores),
    }

    return NewsDashboard(
        headlines=[asdict(h) for h in headlines[:20]],
        market_sentiment=market_sent,
        trending_tickers=trending[:15],
        topic_clusters=[asdict(t) for t in topics[:10]],
        earnings_calendar=[asdict(e) for e in earnings[:20]],
        ipos=[asdict(i) for i in ipos[:10]],
        recent_filings=[],
        social_trending=trending[:10],
        timestamp=datetime.now().isoformat(),
    )


# ── FastAPI Router ────────────────────────────────────────────────────────────

def create_news_router():
    """Create FastAPI router for news endpoints"""
    from fastapi import APIRouter, Query, HTTPException
    router = APIRouter(prefix="/api/v4/news", tags=["news"])

    @router.get("/articles")
    async def articles(
        query: Optional[str] = None, ticker: Optional[str] = None,
        category: Optional[str] = None, limit: int = Query(50, le=100),
    ):
        news = await get_news(query=query, ticker=ticker, category=category, limit=limit)
        return {"articles": [asdict(a) for a in news]}

    @router.get("/headlines")
    async def headlines(category: str = "business"):
        news = await get_news_headlines(category)
        return {"headlines": [asdict(a) for a in news]}

    @router.get("/sentiment/{ticker}")
    async def sentiment(ticker: str):
        s = await get_sentiment_analysis(ticker.upper())
        return asdict(s)

    @router.get("/earnings")
    async def earnings(
        from_date: Optional[str] = None, to_date: Optional[str] = None,
        symbol: Optional[str] = None,
    ):
        events = await get_earnings_calendar(from_date, to_date, symbol)
        return {"earnings": [asdict(e) for e in events]}

    @router.get("/ipos")
    async def ipos(from_date: Optional[str] = None, to_date: Optional[str] = None):
        events = await get_ipo_calendar(from_date, to_date)
        return {"ipos": [asdict(e) for e in events]}

    @router.get("/filings/{ticker}")
    async def filings(ticker: str, filing_type: Optional[str] = None, count: int = 10):
        f = await get_sec_filings(ticker.upper(), filing_type, count)
        return {"filings": [asdict(fl) for fl in f]}

    @router.get("/analyst/{ticker}")
    async def analyst(ticker: str):
        ratings = await get_analyst_ratings(ticker.upper())
        return {"ratings": [asdict(r) for r in ratings]}

    @router.get("/social")
    async def social(ticker: Optional[str] = None, subreddit: Optional[str] = None, limit: int = 50):
        posts = await get_social_posts(ticker, subreddit, limit)
        return {"posts": [asdict(p) for p in posts]}

    @router.get("/trending")
    async def trending():
        return {"trending": await get_trending_tickers_social()}

    @router.get("/topics")
    async def topics():
        clusters = await get_topic_clusters()
        return {"topics": [asdict(c) for c in clusters]}

    @router.get("/correlation/{ticker}")
    async def correlation(ticker: str):
        corrs = await compute_news_price_correlation(ticker.upper())
        return {"correlations": [asdict(c) for c in corrs]}

    @router.get("/research/{ticker}")
    async def research(ticker: str):
        report = await generate_research_report(ticker.upper())
        if not report:
            raise HTTPException(404, "Could not generate report")
        return asdict(report)

    @router.get("/dashboard")
    async def dashboard():
        d = await get_news_dashboard()
        return asdict(d)

    return router
