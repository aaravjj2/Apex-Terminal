# News & Research

Aggregated news feeds with AI-powered sentiment analysis, category and symbol filtering, research reports, earnings transcripts, and SEC filing integration.

## Table of Contents

- [Overview](#overview)
- [News Feed](#news-feed)
- [Sentiment Analysis](#sentiment-analysis)
- [Filtering](#filtering)
- [Research Reports](#research-reports)
- [Earnings Transcripts](#earnings-transcripts)
- [SEC Filings](#sec-filings)
- [NewsPanel Component](#newspanel-component)
- [Store Integration](#store-integration)

## Overview

The news and research module aggregates financial news from multiple sources, applies real-time sentiment scoring, and integrates directly with chart annotations and watchlists. The `newsStore` manages state, and the `NewsPanel` component provides the UI.

```typescript
import { useNewsStore } from '@/stores/newsStore';
import { NewsPanel } from '@/components/bloomberg/NewsPanel';
```

## News Feed

Real-time news aggregation with deduplication and relevance scoring:

```typescript
interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: number;
  symbols: string[];
  categories: NewsCategory[];
  sentimentScore: number;      // -1.0 to 1.0
  sentimentLabel: 'bearish' | 'neutral' | 'bullish';
  relevanceScore: number;      // 0.0 to 1.0
  url: string;
  imageUrl?: string;
  isBreaking: boolean;
}

type NewsCategory =
  | 'earnings' | 'mergers' | 'macro' | 'central-bank'
  | 'regulation' | 'crypto' | 'commodities' | 'tech'
  | 'healthcare' | 'geopolitics' | 'ipo';
```

The feed deduplicates stories across sources, prioritizing the earliest and most comprehensive version.

## Sentiment Analysis

Automated sentiment scoring of news headlines and content:

```typescript
const { analyzeSentiment, getSentimentTimeline } = useNewsStore();

const sentiment = analyzeSentiment('AAPL', { period: '7d' });
// {
//   overallScore: 0.35,
//   label: 'bullish',
//   articleCount: 47,
//   distribution: { bearish: 8, neutral: 21, bullish: 18 },
//   trendDirection: 'improving',
//   keyTopics: ['iPhone sales', 'AI features', 'services revenue'],
// }

const timeline = getSentimentTimeline('AAPL', {
  period: '30d',
  granularity: 'daily',
});
// Array of { date, avgSentiment, articleCount, priceChange }
```

Sentiment overlays on the price chart show correlation between news tone and price movement.

## Filtering

Narrow the feed by symbol, category, source, and sentiment:

```typescript
const { setNewsFilter } = useNewsStore();

setNewsFilter({
  symbols: ['AAPL', 'MSFT'],
  categories: ['earnings', 'mergers'],
  sources: ['reuters', 'bloomberg', 'wsj'],
  sentiment: 'bearish',         // show only bearish articles
  dateRange: { from: '2026-02-01', to: '2026-03-01' },
  searchQuery: 'AI revenue',
  isBreaking: undefined,        // undefined = show all, true = breaking only
});
```

Filters persist per-session and can be saved as named filter presets. Symbol filters auto-sync with the active chart or selected watchlist.

## Research Reports

Access analyst research and institutional reports:

```typescript
interface ResearchReport {
  id: string;
  title: string;
  analyst: string;
  firm: string;
  symbol: string;
  rating: 'buy' | 'overweight' | 'hold' | 'underweight' | 'sell';
  priceTarget: number;
  previousTarget: number;
  publishedAt: number;
  summary: string;
  sectors: string[];
}

const { getResearchReports } = useNewsStore();

const reports = getResearchReports('AAPL', { limit: 20 });
// Sorted by date, includes rating changes and target revisions
```

Consensus tracking aggregates all analyst ratings and price targets into a visual consensus chart with historical accuracy metrics.

## Earnings Transcripts

Full earnings call transcripts with searchable Q&A sections:

```typescript
interface EarningsTranscript {
  symbol: string;
  quarter: string;           // 'Q4 2025'
  date: number;
  participants: { name: string; title: string; role: 'executive' | 'analyst' }[];
  sections: {
    preparedRemarks: TranscriptSection[];
    questionAndAnswer: QAExchange[];
  };
  keyMetrics: Record<string, number>;
  guidanceRevisions: GuidanceItem[];
}

const transcript = await getEarningsTranscript('AAPL', 'Q4-2025');
// Full searchable transcript with highlighted key metrics
```

Keyword highlighting surfaces mentions of revenue guidance, margin changes, and forward-looking statements.

## SEC Filings

Integrated access to regulatory filings:

```typescript
interface SECFiling {
  symbol: string;
  formType: '10-K' | '10-Q' | '8-K' | 'S-1' | 'DEF 14A' | '13F' | 'SC 13D';
  filedAt: number;
  periodOfReport: string;
  url: string;
  description: string;
  isAmendment: boolean;
}

const filings = await getSECFilings('AAPL', {
  formTypes: ['10-K', '10-Q', '8-K'],
  limit: 20,
});
```

8-K filings trigger automatic alerts for material events. 13F filings enable institutional ownership tracking and quarter-over-quarter position change analysis.

## NewsPanel Component

The Bloomberg-style `NewsPanel` component:

```tsx
<NewsPanel
  defaultSymbol="AAPL"
  layout="split"              // 'list' | 'split' | 'grid'
  showSentimentBar={true}
  showTimeline={true}
  autoRefreshInterval={30}    // seconds
  enableBreakingAlerts={true}
  maxArticles={200}
/>
```

The split layout shows a scrollable headline list on the left with article preview on the right. Breaking news triggers a banner overlay with configurable sound alerts.

## Store Integration

The `newsStore` (Zustand) manages news state:

```typescript
interface NewsState {
  articles: NewsArticle[];
  filters: NewsFilter;
  sentimentCache: Record<string, SentimentData>;
  isLoading: boolean;
  setNewsFilter: (filter: Partial<NewsFilter>) => void;
  analyzeSentiment: (symbol: string, opts: SentimentOpts) => SentimentData;
  getSentimentTimeline: (symbol: string, opts: TimelineOpts) => TimelinePoint[];
  getResearchReports: (symbol: string, opts: ReportOpts) => ResearchReport[];
  markAsRead: (articleId: string) => void;
  bookmarkArticle: (articleId: string) => void;
}
```

Articles persist in IndexedDB with a configurable retention period (default: 30 days).
