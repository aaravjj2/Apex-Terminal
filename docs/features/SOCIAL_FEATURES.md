# Social & Collaboration

Community features for idea sharing, strategy discussion, trader following, leaderboards, copy trading, and collaborative watchlists.

## Table of Contents

- [Overview](#overview)
- [Idea Sharing](#idea-sharing)
- [Strategy Sharing](#strategy-sharing)
- [Trade Discussions](#trade-discussions)
- [Following Traders](#following-traders)
- [Leaderboards](#leaderboards)
- [Copy Trading](#copy-trading)
- [Collaborative Watchlists](#collaborative-watchlists)
- [Reputation System](#reputation-system)
- [Notification System](#notification-system)

## Overview

The social module (`lib/social/`) builds a trader community within Apex Terminal. It covers collaboration tools, idea publishing, notification delivery, and a reputation engine that ranks contributors by verified performance.

```typescript
import { CollaborationHub } from '@/lib/social/collaboration';
import { IdeaManager } from '@/lib/social/ideas';
import { NotificationService } from '@/lib/social/notifications';
import { ReputationEngine } from '@/lib/social/reputation';
```

## Idea Sharing

Publish trading ideas with chart annotations and rationale:

```typescript
interface TradingIdea {
  id: string;
  author: string;
  symbol: string;
  direction: 'long' | 'short' | 'neutral';
  timeframe: string;
  entry: number;
  stopLoss: number;
  targets: number[];
  chartSnapshot: string;       // base64 chart image with annotations
  description: string;
  tags: string[];
  indicators: string[];
  publishedAt: number;
  likes: number;
  comments: number;
  status: 'active' | 'target-hit' | 'stopped-out' | 'expired';
}

const idea = await IdeaManager.publish({
  symbol: 'AAPL',
  direction: 'long',
  entry: 195,
  stopLoss: 188,
  targets: [210, 225],
  description: 'Bull flag breakout on daily chart with volume confirmation...',
  tags: ['swing-trade', 'breakout', 'tech'],
});
```

Ideas automatically track P&L against entry/target/stop levels and update status when milestones are hit.

## Strategy Sharing

Share complete trading strategies with backtested results:

```typescript
interface SharedStrategy {
  id: string;
  author: string;
  name: string;
  description: string;
  rules: StrategyRule[];
  backtestResults: BacktestSummary;
  assetClasses: string[];
  timeframes: string[];
  parameters: Record<string, number>;
  isPublic: boolean;
  forkCount: number;
}

const strategy = await CollaborationHub.shareStrategy({
  name: 'Mean Reversion RSI',
  rules: [
    { type: 'entry', condition: 'rsi(14) < 25 AND close > sma(200)' },
    { type: 'exit', condition: 'rsi(14) > 65 OR stopLoss(-3%)' },
  ],
  backtestResults: backtestSummary,
  isPublic: true,
});
```

Other users can fork strategies, modify parameters, and run their own backtests — creating a version history tree.

## Trade Discussions

Threaded discussions attached to symbols, ideas, or strategies:

```typescript
const discussion = await CollaborationHub.createThread({
  context: { type: 'symbol', value: 'TSLA' },
  title: 'TSLA earnings setup — bearish divergence on RSI',
  body: 'Looking at the daily chart, RSI is making lower highs...',
  attachments: [{ type: 'chart-snapshot', data: chartImage }],
});

await CollaborationHub.reply(discussion.id, {
  body: 'Agree on the divergence, but volume is still supportive...',
});
```

Discussions support markdown formatting, chart image attachments, and @mentions with notifications.

## Following Traders

Follow other traders to track their activity:

```typescript
const { followTrader, getFollowing, getFollowers, getFeed } = CollaborationHub;

await followTrader('trader-123');

const feed = await getFeed({
  types: ['idea', 'trade', 'strategy', 'comment'],
  limit: 50,
});
// Chronological feed of activity from followed traders
```

The activity feed surfaces new ideas, published trades, strategy updates, and discussion activity from followed accounts.

## Leaderboards

Performance-ranked trader leaderboards:

```typescript
interface LeaderboardEntry {
  rank: number;
  trader: string;
  returnPercent: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  followers: number;
  reputationScore: number;
  verified: boolean;
}

const leaderboard = await ReputationEngine.getLeaderboard({
  period: 'monthly',          // 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'all-time'
  category: 'all',            // 'all' | 'equities' | 'crypto' | 'forex' | 'options'
  metric: 'returnPercent',
  minTrades: 10,
  limit: 100,
});
```

Only verified trades (logged through the platform's journal) count toward leaderboard rankings, preventing fabricated performance.

## Copy Trading

Mirror trades from top-performing traders:

```typescript
interface CopyTradingConfig {
  sourceTrader: string;
  allocationPercent: number;     // % of portfolio to allocate
  maxPositionSize: number;
  assetFilter: string[];         // only copy specific asset classes
  riskMultiplier: number;        // scale position sizes (0.5 = half size)
  autoStopLoss: boolean;
  maxDailyLoss: number;
  requireConfirmation: boolean;  // manual approval before each trade
}

await CollaborationHub.enableCopyTrading({
  sourceTrader: 'trader-123',
  allocationPercent: 10,
  riskMultiplier: 0.5,
  requireConfirmation: true,
});
```

Copy trading includes risk controls: maximum allocation, position size limits, daily loss caps, and optional manual confirmation.

## Collaborative Watchlists

Shared watchlists with multi-user editing:

```typescript
const sharedList = await CollaborationHub.createSharedWatchlist({
  name: 'Team Picks — March 2026',
  members: ['trader-123', 'trader-456'],
  permissions: {
    'trader-123': 'editor',
    'trader-456': 'viewer',
  },
  enableComments: true,
  enableVoting: true,       // members can upvote/downvote symbols
});

await sharedList.addSymbol('NVDA', { addedBy: 'me', note: 'AI capex play' });
```

Voting tallies surface the group's highest-conviction ideas. Change history tracks who added/removed symbols and when.

## Reputation System

Quantified trader reputation based on verified activity:

```typescript
interface ReputationProfile {
  score: number;                 // 0-1000 composite score
  level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  components: {
    tradingPerformance: number;  // verified P&L track record
    ideaAccuracy: number;        // % of ideas that hit targets
    communityContribution: number; // discussions, helpful comments
    consistency: number;         // streak of active participation
  };
  badges: Badge[];
  verifiedSince: number;
}
```

The reputation engine weights verified trading performance highest, followed by idea accuracy, then community contribution. Badges reward milestones (100 ideas published, 12-month positive streak, etc.).

## Notification System

Unified notification delivery across channels:

```typescript
const { subscribe, getNotifications, markRead } = NotificationService;

subscribe({
  events: ['idea-published', 'trade-copied', 'discussion-reply', 'follower-added'],
  channels: ['in-app', 'push', 'email'],
  quietHours: { from: '22:00', to: '07:00', timezone: 'America/New_York' },
});

const notifications = await getNotifications({ unreadOnly: true, limit: 20 });
```

Quiet hours suppress non-critical notifications. Market alerts always bypass quiet hours.
