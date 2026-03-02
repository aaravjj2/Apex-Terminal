import type {
  TradingIdea,
  ChartSnapshot,
  IdeaFollowUp,
  IdeaVotes,
  ConsensusData,
  TrendingTopic,
} from './types';
import {
  IdeaCategory,
  IdeaDirection,
  IdeaStatus,
  IdeaOutcome,
} from './types';

// ─── ID Generation ───────────────────────────────────────────────────────────

let ideaCounter = 0;
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++ideaCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── In-Memory Store ─────────────────────────────────────────────────────────

const ideas = new Map<string, TradingIdea>();
const followUps = new Map<string, IdeaFollowUp[]>();
const userBookmarks = new Map<string, Set<string>>();
const userVotes = new Map<string, Map<string, IdeaDirection>>();

// ─── Create / Edit / Delete ──────────────────────────────────────────────────

export interface CreateIdeaInput {
  authorId: string;
  title: string;
  description: string;
  symbol: string;
  category: IdeaCategory;
  direction: IdeaDirection;
  tags?: string[];
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  timeframe?: string;
  chartSnapshot?: ChartSnapshot;
  expiresAt?: number;
}

export function createIdea(input: CreateIdeaInput): TradingIdea {
  const now = Date.now();
  const idea: TradingIdea = {
    id: generateId('idea'),
    authorId: input.authorId,
    title: input.title.trim(),
    description: input.description.trim(),
    symbol: input.symbol.toUpperCase(),
    category: input.category,
    direction: input.direction,
    status: IdeaStatus.Published,
    outcome: IdeaOutcome.Pending,
    tags: normalizeTags(input.tags ?? []),
    entryPrice: input.entryPrice ?? null,
    targetPrice: input.targetPrice ?? null,
    stopLoss: input.stopLoss ?? null,
    timeframe: input.timeframe ?? '1D',
    chartSnapshot: input.chartSnapshot ?? null,
    votes: { bullish: 0, bearish: 0, total: 0, userVote: null },
    commentsCount: 0,
    viewsCount: 0,
    sharesCount: 0,
    bookmarksCount: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt ?? null,
    closedAt: null,
    performanceReturn: null,
  };

  if (idea.direction === IdeaDirection.Bullish) {
    idea.votes.bullish = 1;
  } else if (idea.direction === IdeaDirection.Bearish) {
    idea.votes.bearish = 1;
  }
  idea.votes.total = 1;

  ideas.set(idea.id, idea);
  return { ...idea };
}

export interface EditIdeaInput {
  title?: string;
  description?: string;
  tags?: string[];
  targetPrice?: number;
  stopLoss?: number;
  timeframe?: string;
  chartSnapshot?: ChartSnapshot;
}

export function editIdea(ideaId: string, authorId: string, updates: EditIdeaInput): TradingIdea {
  const idea = ideas.get(ideaId);
  if (!idea) throw new Error(`Idea not found: ${ideaId}`);
  if (idea.authorId !== authorId) throw new Error('Only the author can edit this idea');
  if (idea.status === IdeaStatus.Removed) throw new Error('Cannot edit a removed idea');

  if (updates.title !== undefined) idea.title = updates.title.trim();
  if (updates.description !== undefined) idea.description = updates.description.trim();
  if (updates.tags !== undefined) idea.tags = normalizeTags(updates.tags);
  if (updates.targetPrice !== undefined) idea.targetPrice = updates.targetPrice;
  if (updates.stopLoss !== undefined) idea.stopLoss = updates.stopLoss;
  if (updates.timeframe !== undefined) idea.timeframe = updates.timeframe;
  if (updates.chartSnapshot !== undefined) idea.chartSnapshot = updates.chartSnapshot;
  idea.updatedAt = Date.now();

  return { ...idea };
}

export function deleteIdea(ideaId: string, authorId: string): void {
  const idea = ideas.get(ideaId);
  if (!idea) throw new Error(`Idea not found: ${ideaId}`);
  if (idea.authorId !== authorId) throw new Error('Only the author can delete this idea');

  idea.status = IdeaStatus.Removed;
  idea.updatedAt = Date.now();
}

export function archiveIdea(ideaId: string, authorId: string): TradingIdea {
  const idea = ideas.get(ideaId);
  if (!idea) throw new Error(`Idea not found: ${ideaId}`);
  if (idea.authorId !== authorId) throw new Error('Only the author can archive this idea');

  idea.status = IdeaStatus.Archived;
  idea.updatedAt = Date.now();
  return { ...idea };
}

// ─── Voting ──────────────────────────────────────────────────────────────────

export function voteOnIdea(ideaId: string, userId: string, direction: IdeaDirection): IdeaVotes {
  const idea = ideas.get(ideaId);
  if (!idea) throw new Error(`Idea not found: ${ideaId}`);

  let userMap = userVotes.get(userId);
  if (!userMap) {
    userMap = new Map();
    userVotes.set(userId, userMap);
  }

  const previousVote = userMap.get(ideaId);

  if (previousVote) {
    if (previousVote === IdeaDirection.Bullish) idea.votes.bullish--;
    else if (previousVote === IdeaDirection.Bearish) idea.votes.bearish--;
    idea.votes.total--;
  }

  if (previousVote === direction) {
    userMap.delete(ideaId);
    idea.votes.userVote = null;
  } else {
    if (direction === IdeaDirection.Bullish) idea.votes.bullish++;
    else if (direction === IdeaDirection.Bearish) idea.votes.bearish++;
    idea.votes.total++;
    userMap.set(ideaId, direction);
    idea.votes.userVote = direction;
  }

  return { ...idea.votes };
}

export function getIdeaVotes(ideaId: string, userId?: string): IdeaVotes {
  const idea = ideas.get(ideaId);
  if (!idea) throw new Error(`Idea not found: ${ideaId}`);

  const votes = { ...idea.votes, userVote: null as IdeaDirection | null };
  if (userId) {
    const userMap = userVotes.get(userId);
    votes.userVote = userMap?.get(ideaId) ?? null;
  }
  return votes;
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────

export function toggleBookmark(ideaId: string, userId: string): boolean {
  const idea = ideas.get(ideaId);
  if (!idea) throw new Error(`Idea not found: ${ideaId}`);

  let bookmarks = userBookmarks.get(userId);
  if (!bookmarks) {
    bookmarks = new Set();
    userBookmarks.set(userId, bookmarks);
  }

  if (bookmarks.has(ideaId)) {
    bookmarks.delete(ideaId);
    idea.bookmarksCount = Math.max(0, idea.bookmarksCount - 1);
    return false;
  }

  bookmarks.add(ideaId);
  idea.bookmarksCount++;
  return true;
}

export function getUserBookmarks(userId: string): TradingIdea[] {
  const bookmarks = userBookmarks.get(userId);
  if (!bookmarks) return [];

  return Array.from(bookmarks)
    .map(id => ideas.get(id))
    .filter((i): i is TradingIdea => i !== undefined && i.status === IdeaStatus.Published)
    .map(i => ({ ...i }));
}

// ─── Record View / Share ─────────────────────────────────────────────────────

export function recordView(ideaId: string): void {
  const idea = ideas.get(ideaId);
  if (idea && idea.status === IdeaStatus.Published) {
    idea.viewsCount++;
  }
}

export function recordShare(ideaId: string): void {
  const idea = ideas.get(ideaId);
  if (idea && idea.status === IdeaStatus.Published) {
    idea.sharesCount++;
  }
}

// ─── Performance Tracking ────────────────────────────────────────────────────

export function updateIdeaPerformance(
  ideaId: string,
  currentPrice: number,
): { returnPct: number; outcome: IdeaOutcome } {
  const idea = ideas.get(ideaId);
  if (!idea) throw new Error(`Idea not found: ${ideaId}`);
  if (idea.entryPrice === null) throw new Error('Idea has no entry price');

  const returnPct = idea.direction === IdeaDirection.Bearish
    ? ((idea.entryPrice - currentPrice) / idea.entryPrice) * 100
    : ((currentPrice - idea.entryPrice) / idea.entryPrice) * 100;

  idea.performanceReturn = returnPct;

  if (idea.targetPrice !== null) {
    const hitTarget = idea.direction === IdeaDirection.Bullish
      ? currentPrice >= idea.targetPrice
      : currentPrice <= idea.targetPrice;
    if (hitTarget) idea.outcome = IdeaOutcome.Correct;
  }

  if (idea.stopLoss !== null) {
    const hitStop = idea.direction === IdeaDirection.Bullish
      ? currentPrice <= idea.stopLoss
      : currentPrice >= idea.stopLoss;
    if (hitStop) idea.outcome = IdeaOutcome.Incorrect;
  }

  if (idea.expiresAt !== null && Date.now() > idea.expiresAt && idea.outcome === IdeaOutcome.Pending) {
    idea.outcome = returnPct > 0 ? IdeaOutcome.Partial : IdeaOutcome.Expired;
  }

  return { returnPct, outcome: idea.outcome };
}

export function closeIdea(ideaId: string, authorId: string, outcome: IdeaOutcome): TradingIdea {
  const idea = ideas.get(ideaId);
  if (!idea) throw new Error(`Idea not found: ${ideaId}`);
  if (idea.authorId !== authorId) throw new Error('Only the author can close this idea');

  idea.outcome = outcome;
  idea.closedAt = Date.now();
  idea.updatedAt = Date.now();
  return { ...idea };
}

// ─── Follow-Ups ──────────────────────────────────────────────────────────────

export function addFollowUp(
  ideaId: string,
  authorId: string,
  content: string,
  outcome?: IdeaOutcome,
  actualReturn?: number,
): IdeaFollowUp {
  const idea = ideas.get(ideaId);
  if (!idea) throw new Error(`Idea not found: ${ideaId}`);

  const followUp: IdeaFollowUp = {
    id: generateId('followup'),
    ideaId,
    authorId,
    content: content.trim(),
    outcome: outcome ?? IdeaOutcome.Pending,
    actualReturn: actualReturn ?? null,
    createdAt: Date.now(),
  };

  let list = followUps.get(ideaId);
  if (!list) {
    list = [];
    followUps.set(ideaId, list);
  }
  list.push(followUp);

  if (outcome && outcome !== IdeaOutcome.Pending) {
    idea.outcome = outcome;
  }
  if (actualReturn !== undefined) {
    idea.performanceReturn = actualReturn;
  }
  idea.updatedAt = Date.now();

  return { ...followUp };
}

export function getFollowUps(ideaId: string): IdeaFollowUp[] {
  return (followUps.get(ideaId) ?? []).map(f => ({ ...f }));
}

// ─── Search & Filtering ─────────────────────────────────────────────────────

export interface IdeaSearchParams {
  query?: string;
  symbol?: string;
  category?: IdeaCategory;
  direction?: IdeaDirection;
  authorId?: string;
  tags?: string[];
  status?: IdeaStatus;
  outcome?: IdeaOutcome;
  sortBy?: 'newest' | 'oldest' | 'popular' | 'votes' | 'performance';
  limit?: number;
  offset?: number;
}

export function searchIdeas(params: IdeaSearchParams): { ideas: TradingIdea[]; total: number } {
  let results = Array.from(ideas.values()).filter(i => i.status !== IdeaStatus.Removed);

  if (params.query) {
    const q = params.query.toLowerCase();
    results = results.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.symbol.toLowerCase().includes(q) ||
      i.tags.some(t => t.toLowerCase().includes(q)),
    );
  }

  if (params.symbol) {
    const sym = params.symbol.toUpperCase();
    results = results.filter(i => i.symbol === sym);
  }

  if (params.category) results = results.filter(i => i.category === params.category);
  if (params.direction) results = results.filter(i => i.direction === params.direction);
  if (params.authorId) results = results.filter(i => i.authorId === params.authorId);
  if (params.status) results = results.filter(i => i.status === params.status);
  if (params.outcome) results = results.filter(i => i.outcome === params.outcome);
  if (params.tags?.length) {
    const tagSet = new Set(params.tags.map(t => t.toLowerCase()));
    results = results.filter(i => i.tags.some(t => tagSet.has(t)));
  }

  const total = results.length;

  switch (params.sortBy) {
    case 'oldest':
      results.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case 'popular':
      results.sort((a, b) =>
        (b.viewsCount + b.votes.total * 3 + b.commentsCount * 2) -
        (a.viewsCount + a.votes.total * 3 + a.commentsCount * 2),
      );
      break;
    case 'votes':
      results.sort((a, b) => b.votes.total - a.votes.total);
      break;
    case 'performance':
      results.sort((a, b) => (b.performanceReturn ?? -Infinity) - (a.performanceReturn ?? -Infinity));
      break;
    default:
      results.sort((a, b) => b.createdAt - a.createdAt);
  }

  const offset = params.offset ?? 0;
  const limit = params.limit ?? 20;
  results = results.slice(offset, offset + limit);

  return { ideas: results.map(i => ({ ...i })), total };
}

// ─── Trending Ideas ──────────────────────────────────────────────────────────

export function getTrendingIdeas(limit = 10, windowMs = 86_400_000): TradingIdea[] {
  const cutoff = Date.now() - windowMs;
  return Array.from(ideas.values())
    .filter(i => i.status === IdeaStatus.Published && i.createdAt >= cutoff)
    .sort((a, b) => {
      const scoreA = computeTrendScore(a, cutoff);
      const scoreB = computeTrendScore(b, cutoff);
      return scoreB - scoreA;
    })
    .slice(0, limit)
    .map(i => ({ ...i }));
}

function computeTrendScore(idea: TradingIdea, windowStart: number): number {
  const age = (Date.now() - idea.createdAt) / 3_600_000;
  const decayFactor = Math.pow(0.95, age);
  const engagement = idea.viewsCount + idea.votes.total * 5 + idea.commentsCount * 3 + idea.sharesCount * 4;
  return engagement * decayFactor;
}

// ─── Popular by Category ─────────────────────────────────────────────────────

export function getPopularByCategory(
  category: IdeaCategory,
  limit = 10,
): TradingIdea[] {
  return Array.from(ideas.values())
    .filter(i => i.status === IdeaStatus.Published && i.category === category)
    .sort((a, b) =>
      (b.viewsCount + b.votes.total * 3 + b.commentsCount * 2) -
      (a.viewsCount + a.votes.total * 3 + a.commentsCount * 2),
    )
    .slice(0, limit)
    .map(i => ({ ...i }));
}

// ─── User Idea History ───────────────────────────────────────────────────────

export interface UserIdeaStats {
  totalIdeas: number;
  publishedIdeas: number;
  correctIdeas: number;
  incorrectIdeas: number;
  pendingIdeas: number;
  accuracyRate: number;
  avgReturn: number;
  bestReturn: number;
  worstReturn: number;
  totalViews: number;
  totalVotes: number;
  byCategory: Record<string, number>;
  byDirection: Record<string, number>;
}

export function getUserIdeaHistory(authorId: string): UserIdeaStats {
  const userIdeas = Array.from(ideas.values())
    .filter(i => i.authorId === authorId && i.status !== IdeaStatus.Removed);

  const correct = userIdeas.filter(i => i.outcome === IdeaOutcome.Correct);
  const incorrect = userIdeas.filter(i => i.outcome === IdeaOutcome.Incorrect);
  const pending = userIdeas.filter(i => i.outcome === IdeaOutcome.Pending);
  const withReturns = userIdeas.filter(i => i.performanceReturn !== null);
  const decidedCount = correct.length + incorrect.length;

  const byCategory: Record<string, number> = {};
  const byDirection: Record<string, number> = {};
  for (const idea of userIdeas) {
    byCategory[idea.category] = (byCategory[idea.category] ?? 0) + 1;
    byDirection[idea.direction] = (byDirection[idea.direction] ?? 0) + 1;
  }

  return {
    totalIdeas: userIdeas.length,
    publishedIdeas: userIdeas.filter(i => i.status === IdeaStatus.Published).length,
    correctIdeas: correct.length,
    incorrectIdeas: incorrect.length,
    pendingIdeas: pending.length,
    accuracyRate: decidedCount > 0 ? correct.length / decidedCount : 0,
    avgReturn: withReturns.length > 0
      ? withReturns.reduce((sum, i) => sum + i.performanceReturn!, 0) / withReturns.length
      : 0,
    bestReturn: withReturns.length > 0
      ? Math.max(...withReturns.map(i => i.performanceReturn!))
      : 0,
    worstReturn: withReturns.length > 0
      ? Math.min(...withReturns.map(i => i.performanceReturn!))
      : 0,
    totalViews: userIdeas.reduce((s, i) => s + i.viewsCount, 0),
    totalVotes: userIdeas.reduce((s, i) => s + i.votes.total, 0),
    byCategory,
    byDirection,
  };
}

// ─── Consensus Tracking ─────────────────────────────────────────────────────

export function getConsensus(symbol: string, windowMs = 604_800_000): ConsensusData {
  const cutoff = Date.now() - windowMs;
  const symbolIdeas = Array.from(ideas.values()).filter(
    i => i.symbol === symbol.toUpperCase() && i.status === IdeaStatus.Published && i.createdAt >= cutoff,
  );

  let bullish = 0;
  let bearish = 0;
  let neutral = 0;

  for (const idea of symbolIdeas) {
    const weight = 1 + Math.log2(1 + idea.votes.total);
    if (idea.direction === IdeaDirection.Bullish) bullish += weight;
    else if (idea.direction === IdeaDirection.Bearish) bearish += weight;
    else neutral += weight;
  }

  const total = bullish + bearish + neutral;
  const bullishPct = total > 0 ? (bullish / total) * 100 : 50;
  const bearishPct = total > 0 ? (bearish / total) * 100 : 50;
  const sentiment = total > 0 ? (bullish - bearish) / total : 0;

  return {
    symbol: symbol.toUpperCase(),
    bullishCount: Math.round(bullish),
    bearishCount: Math.round(bearish),
    neutralCount: Math.round(neutral),
    totalVotes: symbolIdeas.length,
    bullishPercent: bullishPct,
    bearishPercent: bearishPct,
    sentimentScore: sentiment,
    timestamp: Date.now(),
  };
}

// ─── Trending Tags ───────────────────────────────────────────────────────────

export function getTrendingTags(limit = 20, windowMs = 86_400_000): TrendingTopic[] {
  const cutoff = Date.now() - windowMs;
  const prevCutoff = cutoff - windowMs;

  const currentTagCounts = new Map<string, { count: number; ideaIds: string[] }>();
  const prevTagCounts = new Map<string, number>();

  for (const idea of ideas.values()) {
    if (idea.status !== IdeaStatus.Published) continue;
    for (const tag of idea.tags) {
      if (idea.createdAt >= cutoff) {
        const entry = currentTagCounts.get(tag) ?? { count: 0, ideaIds: [] };
        entry.count++;
        if (entry.ideaIds.length < 5) entry.ideaIds.push(idea.id);
        currentTagCounts.set(tag, entry);
      } else if (idea.createdAt >= prevCutoff) {
        prevTagCounts.set(tag, (prevTagCounts.get(tag) ?? 0) + 1);
      }
    }
  }

  return Array.from(currentTagCounts.entries())
    .map(([tag, data]) => {
      const prevCount = prevTagCounts.get(tag) ?? 0;
      const change = prevCount > 0 ? ((data.count - prevCount) / prevCount) * 100 : 100;
      return { tag, count: data.count, change24h: change, topIdeas: data.ideaIds };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeTags(tags: string[]): string[] {
  return [...new Set(
    tags
      .map(t => t.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''))
      .filter(t => t.length > 0),
  )];
}

export function getIdea(ideaId: string): TradingIdea | null {
  const idea = ideas.get(ideaId);
  if (!idea || idea.status === IdeaStatus.Removed) return null;
  return { ...idea };
}

export function getIdeaCount(): number {
  return Array.from(ideas.values()).filter(i => i.status !== IdeaStatus.Removed).length;
}

export function clearIdeaStore(): void {
  ideas.clear();
  followUps.clear();
  userBookmarks.clear();
  userVotes.clear();
  ideaCounter = 0;
}
