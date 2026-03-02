# News API

Financial news aggregation with NLP-powered sentiment analysis, symbol tagging, and real-time alerts.

## Table of Contents

- [Endpoints](#endpoints)
- [Latest News](#get-latest-news)
- [Search](#get-search-news)
- [Symbol News](#get-symbol-news)
- [Sentiment](#get-sentiment-analysis)
- [Article Schema](#article-schema)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/news/latest` | Latest news articles across all sources |
| GET | `/api/news/search` | Full-text search across articles |
| GET | `/api/news/:symbol` | News related to a specific symbol |
| GET | `/api/news/sentiment` | Aggregated sentiment by symbol or sector |

## GET Latest News

Returns the most recent news articles, optionally filtered by category.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | No | `earnings`, `macro`, `commodities`, `crypto`, `forex`, `politics`, `central_banks` |
| `source` | string | No | Filter by source (e.g., `reuters`, `bloomberg`, `wsj`) |
| `limit` | number | No | Articles per page (default: 20, max: 100) |
| `cursor` | string | No | Pagination cursor for next page |

```typescript
const news = await newsApi.getLatest({ category: 'earnings', limit: 10 });
```

## GET Search News

Full-text search across all indexed articles.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | Yes | Search query (supports AND, OR, NOT operators) |
| `from` | string | No | Start date (ISO 8601) |
| `to` | string | No | End date (ISO 8601) |
| `source` | string | No | Source filter |
| `sort` | string | No | `relevance` or `date` (default: `relevance`) |
| `limit` | number | No | Results count (default: 20) |

```typescript
const results = await newsApi.search({
  q: 'Federal Reserve AND rate decision',
  from: '2026-01-01',
  sort: 'date',
});
```

## GET Symbol News

Returns news articles mentioning or tagged with a specific symbol.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | string | Yes | Ticker symbol (path param) |
| `limit` | number | No | Number of articles (default: 20) |
| `sentiment` | string | No | Filter: `positive`, `negative`, `neutral` |

## GET Sentiment Analysis

Aggregated sentiment scores derived from NLP analysis of recent articles.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `symbols` | string | No | Comma-separated symbols |
| `sector` | string | No | Sector name |
| `period` | string | No | `1D`, `1W`, `1M` (default: `1D`) |

```typescript
interface SentimentResponse {
  items: {
    symbol: string;
    sentimentScore: number;      // -1.0 (bearish) to 1.0 (bullish)
    sentimentLabel: 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
    articleCount: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    buzzScore: number;           // Relative mention volume vs average
    topKeywords: string[];
    sentimentHistory: { date: string; score: number }[];
  }[];
}
```

## Article Schema

```typescript
interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  sourceUrl: string;
  author: string;
  publishedAt: string;          // ISO 8601
  category: string;
  symbols: string[];            // Tagged tickers
  sentiment: {
    score: number;              // -1.0 to 1.0
    label: string;
    confidence: number;         // 0.0 to 1.0
  };
  keywords: string[];
  imageUrl: string | null;
  isBreaking: boolean;
}
```

### News Categories

| Category | Description |
|----------|-------------|
| `earnings` | Earnings reports, guidance, estimates |
| `macro` | GDP, employment, inflation data |
| `commodities` | Oil, gold, agricultural commodities |
| `crypto` | Digital assets and blockchain |
| `forex` | Currency markets and central bank policy |
| `politics` | Regulatory and geopolitical events |
| `central_banks` | Fed, ECB, BOJ policy decisions |
| `ipo` | IPO filings and pricing |
| `ma` | Mergers and acquisitions |

## Error Handling

| Status | Code | Description |
|--------|------|-------------|
| 400 | `5001` | Invalid search query syntax |
| 404 | `5002` | No news found for symbol |
| 400 | `5003` | Invalid date range |
| 429 | `5010` | Rate limit exceeded |
| 503 | `5020` | News feed temporarily unavailable |

## Rate Limits

| Tier | Latest/min | Search/min | Sentiment/min |
|------|-----------|------------|---------------|
| Free | 20 | 10 | 5 |
| Pro | 120 | 60 | 30 |
| Enterprise | 600 | 300 | 150 |

The WebSocket API also supports real-time news streaming via the `news` channel — see [WEBSOCKET_API.md](./WEBSOCKET_API.md) for subscription details.
