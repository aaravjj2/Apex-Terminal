import type {
  Badge,
  Achievement,
  AchievementCriteria,
  LeaderboardEntry,
  StreakInfo,
  ReputationScore,
} from './types';
import { BadgeRarity, ReputationLevel } from './types';

// ─── Level Thresholds ────────────────────────────────────────────────────────

const LEVEL_THRESHOLDS: { level: ReputationLevel; minScore: number }[] = [
  { level: ReputationLevel.Novice, minScore: 0 },
  { level: ReputationLevel.Apprentice, minScore: 100 },
  { level: ReputationLevel.Intermediate, minScore: 500 },
  { level: ReputationLevel.Advanced, minScore: 1500 },
  { level: ReputationLevel.Expert, minScore: 5000 },
  { level: ReputationLevel.Master, minScore: 15000 },
  { level: ReputationLevel.Grandmaster, minScore: 50000 },
  { level: ReputationLevel.Legend, minScore: 150000 },
];

// ─── Badge Definitions ───────────────────────────────────────────────────────

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  category: string;
  criteria: AchievementCriteria;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ── Idea Badges ──
  { id: 'first_idea', name: 'First Spark', description: 'Published your first trading idea', icon: '💡', rarity: BadgeRarity.Common, category: 'ideas', criteria: { type: 'ideas_published', threshold: 1 } },
  { id: 'idea_10', name: 'Idea Machine', description: 'Published 10 trading ideas', icon: '🧠', rarity: BadgeRarity.Common, category: 'ideas', criteria: { type: 'ideas_published', threshold: 10 } },
  { id: 'idea_50', name: 'Thought Leader', description: 'Published 50 trading ideas', icon: '🎓', rarity: BadgeRarity.Uncommon, category: 'ideas', criteria: { type: 'ideas_published', threshold: 50 } },
  { id: 'idea_100', name: 'Idea Powerhouse', description: 'Published 100 trading ideas', icon: '🏭', rarity: BadgeRarity.Rare, category: 'ideas', criteria: { type: 'ideas_published', threshold: 100 } },
  { id: 'idea_500', name: 'Oracle', description: 'Published 500 trading ideas', icon: '🔮', rarity: BadgeRarity.Epic, category: 'ideas', criteria: { type: 'ideas_published', threshold: 500 } },
  { id: 'idea_1000', name: 'Legendary Analyst', description: 'Published 1000 trading ideas', icon: '👑', rarity: BadgeRarity.Legendary, category: 'ideas', criteria: { type: 'ideas_published', threshold: 1000 } },

  // ── Accuracy Badges ──
  { id: 'accuracy_60', name: 'Reliable', description: 'Achieved 60% idea accuracy', icon: '🎯', rarity: BadgeRarity.Common, category: 'accuracy', criteria: { type: 'accuracy_rate', threshold: 0.6 } },
  { id: 'accuracy_70', name: 'Sharp Eye', description: 'Achieved 70% idea accuracy', icon: '👁️', rarity: BadgeRarity.Uncommon, category: 'accuracy', criteria: { type: 'accuracy_rate', threshold: 0.7 } },
  { id: 'accuracy_80', name: 'Precision Trader', description: 'Achieved 80% idea accuracy', icon: '🏹', rarity: BadgeRarity.Rare, category: 'accuracy', criteria: { type: 'accuracy_rate', threshold: 0.8 } },
  { id: 'accuracy_90', name: 'Sniper', description: 'Achieved 90% idea accuracy', icon: '🔫', rarity: BadgeRarity.Epic, category: 'accuracy', criteria: { type: 'accuracy_rate', threshold: 0.9 } },
  { id: 'accuracy_95', name: 'Nostradamus', description: 'Achieved 95% idea accuracy', icon: '🌟', rarity: BadgeRarity.Legendary, category: 'accuracy', criteria: { type: 'accuracy_rate', threshold: 0.95 } },

  // ── Streak Badges ──
  { id: 'streak_7', name: 'Weekly Warrior', description: '7-day activity streak', icon: '🔥', rarity: BadgeRarity.Common, category: 'streaks', criteria: { type: 'streak_days', threshold: 7 } },
  { id: 'streak_30', name: 'Monthly Maverick', description: '30-day activity streak', icon: '⚡', rarity: BadgeRarity.Uncommon, category: 'streaks', criteria: { type: 'streak_days', threshold: 30 } },
  { id: 'streak_90', name: 'Quarterly Champion', description: '90-day activity streak', icon: '🏆', rarity: BadgeRarity.Rare, category: 'streaks', criteria: { type: 'streak_days', threshold: 90 } },
  { id: 'streak_180', name: 'Half-Year Hero', description: '180-day activity streak', icon: '💪', rarity: BadgeRarity.Epic, category: 'streaks', criteria: { type: 'streak_days', threshold: 180 } },
  { id: 'streak_365', name: 'Year of the Bull', description: '365-day activity streak', icon: '🐂', rarity: BadgeRarity.Legendary, category: 'streaks', criteria: { type: 'streak_days', threshold: 365 } },

  // ── Social Badges ──
  { id: 'followers_10', name: 'Rising Star', description: 'Gained 10 followers', icon: '⭐', rarity: BadgeRarity.Common, category: 'social', criteria: { type: 'follower_count', threshold: 10 } },
  { id: 'followers_100', name: 'Community Voice', description: 'Gained 100 followers', icon: '📢', rarity: BadgeRarity.Uncommon, category: 'social', criteria: { type: 'follower_count', threshold: 100 } },
  { id: 'followers_1000', name: 'Influencer', description: 'Gained 1,000 followers', icon: '🌐', rarity: BadgeRarity.Rare, category: 'social', criteria: { type: 'follower_count', threshold: 1000 } },
  { id: 'followers_10000', name: 'Market Sage', description: 'Gained 10,000 followers', icon: '🏛️', rarity: BadgeRarity.Epic, category: 'social', criteria: { type: 'follower_count', threshold: 10000 } },
  { id: 'followers_100000', name: 'Trading Legend', description: 'Gained 100,000 followers', icon: '👑', rarity: BadgeRarity.Legendary, category: 'social', criteria: { type: 'follower_count', threshold: 100000 } },

  // ── Voting / Engagement Badges ──
  { id: 'votes_given_50', name: 'Active Voter', description: 'Voted on 50 ideas', icon: '🗳️', rarity: BadgeRarity.Common, category: 'engagement', criteria: { type: 'votes_given', threshold: 50 } },
  { id: 'votes_received_100', name: 'Crowd Favorite', description: 'Received 100 votes on ideas', icon: '❤️', rarity: BadgeRarity.Uncommon, category: 'engagement', criteria: { type: 'votes_received', threshold: 100 } },
  { id: 'votes_received_1000', name: 'Fan Favorite', description: 'Received 1,000 votes on ideas', icon: '🥇', rarity: BadgeRarity.Rare, category: 'engagement', criteria: { type: 'votes_received', threshold: 1000 } },
  { id: 'comments_50', name: 'Conversationalist', description: 'Left 50 comments', icon: '💬', rarity: BadgeRarity.Common, category: 'engagement', criteria: { type: 'comments_posted', threshold: 50 } },
  { id: 'comments_500', name: 'Discussion Leader', description: 'Left 500 comments', icon: '🗣️', rarity: BadgeRarity.Rare, category: 'engagement', criteria: { type: 'comments_posted', threshold: 500 } },

  // ── Performance Badges ──
  { id: 'return_10', name: 'Green Thumb', description: 'Achieved 10% avg return on ideas', icon: '📈', rarity: BadgeRarity.Uncommon, category: 'performance', criteria: { type: 'avg_return', threshold: 10 } },
  { id: 'return_25', name: 'Profit Hunter', description: 'Achieved 25% avg return on ideas', icon: '💰', rarity: BadgeRarity.Rare, category: 'performance', criteria: { type: 'avg_return', threshold: 25 } },
  { id: 'return_50', name: 'Alpha Generator', description: 'Achieved 50% avg return on ideas', icon: '🚀', rarity: BadgeRarity.Epic, category: 'performance', criteria: { type: 'avg_return', threshold: 50 } },
  { id: 'return_100', name: 'Moonshot', description: 'Achieved 100% avg return on ideas', icon: '🌙', rarity: BadgeRarity.Legendary, category: 'performance', criteria: { type: 'avg_return', threshold: 100 } },

  // ── Category Specialist Badges ──
  { id: 'tech_specialist', name: 'Chartist', description: 'Published 25 technical analysis ideas', icon: '📊', rarity: BadgeRarity.Uncommon, category: 'specialist', criteria: { type: 'category_ideas', threshold: 25, conditions: { category: 'technical' } } },
  { id: 'fundamental_specialist', name: 'Fundamentalist', description: 'Published 25 fundamental analysis ideas', icon: '📋', rarity: BadgeRarity.Uncommon, category: 'specialist', criteria: { type: 'category_ideas', threshold: 25, conditions: { category: 'fundamental' } } },
  { id: 'macro_specialist', name: 'Macro Thinker', description: 'Published 25 macro ideas', icon: '🌍', rarity: BadgeRarity.Uncommon, category: 'specialist', criteria: { type: 'category_ideas', threshold: 25, conditions: { category: 'macro' } } },
  { id: 'options_specialist', name: 'Options Whisperer', description: 'Published 25 options ideas', icon: '🎲', rarity: BadgeRarity.Uncommon, category: 'specialist', criteria: { type: 'category_ideas', threshold: 25, conditions: { category: 'options' } } },
  { id: 'crypto_specialist', name: 'Crypto Native', description: 'Published 25 crypto ideas', icon: '₿', rarity: BadgeRarity.Uncommon, category: 'specialist', criteria: { type: 'category_ideas', threshold: 25, conditions: { category: 'crypto' } } },

  // ── Special Badges ──
  { id: 'early_adopter', name: 'Early Adopter', description: 'Joined in the first year', icon: '🌱', rarity: BadgeRarity.Rare, category: 'special', criteria: { type: 'join_date', threshold: 365 } },
  { id: 'multi_asset', name: 'Diversified Mind', description: 'Published ideas across 5+ asset classes', icon: '🎨', rarity: BadgeRarity.Rare, category: 'special', criteria: { type: 'unique_categories', threshold: 5 } },
  { id: 'viral_idea', name: 'Viral Sensation', description: 'Single idea received 1000+ views', icon: '🦠', rarity: BadgeRarity.Epic, category: 'special', criteria: { type: 'single_idea_views', threshold: 1000 } },
  { id: 'correct_streak_5', name: 'Hot Hand', description: '5 correct ideas in a row', icon: '🔥', rarity: BadgeRarity.Rare, category: 'special', criteria: { type: 'correct_streak', threshold: 5 } },
  { id: 'correct_streak_10', name: 'Untouchable', description: '10 correct ideas in a row', icon: '💎', rarity: BadgeRarity.Epic, category: 'special', criteria: { type: 'correct_streak', threshold: 10 } },
  { id: 'mentor', name: 'Mentor', description: 'Helped 50 users with educational content', icon: '🎓', rarity: BadgeRarity.Rare, category: 'special', criteria: { type: 'educational_ideas', threshold: 50 } },
  { id: 'collaborator_10', name: 'Team Player', description: 'Active in 10+ workspaces', icon: '🤝', rarity: BadgeRarity.Uncommon, category: 'special', criteria: { type: 'workspace_count', threshold: 10 } },
  { id: 'night_owl', name: 'Night Owl', description: 'Published 20 ideas between midnight and 4am', icon: '🦉', rarity: BadgeRarity.Uncommon, category: 'special', criteria: { type: 'night_ideas', threshold: 20 } },
  { id: 'speed_demon', name: 'Speed Demon', description: 'Published an idea within 5 minutes of market open', icon: '⚡', rarity: BadgeRarity.Rare, category: 'special', criteria: { type: 'quick_publish', threshold: 1 } },
  { id: 'bear_market_hero', name: 'Bear Market Hero', description: 'Profitable ideas during market downturn', icon: '🐻', rarity: BadgeRarity.Epic, category: 'special', criteria: { type: 'bear_market_accuracy', threshold: 0.7 } },
  { id: 'community_builder', name: 'Community Builder', description: 'Created 5 active workspaces with 10+ members', icon: '🏗️', rarity: BadgeRarity.Epic, category: 'special', criteria: { type: 'active_workspaces', threshold: 5 } },
];

// ─── Stores ──────────────────────────────────────────────────────────────────

interface UserReputation {
  userId: string;
  score: number;
  history: { timestamp: number; delta: number; reason: string }[];
  achievements: Map<string, Achievement>;
  streaks: Map<string, StreakInfo>;
  contributionHistory: ContributionEntry[];
}

interface ContributionEntry {
  date: string;
  type: string;
  count: number;
  points: number;
}

const userReputations = new Map<string, UserReputation>();

function getOrCreateReputation(userId: string): UserReputation {
  let rep = userReputations.get(userId);
  if (!rep) {
    rep = {
      userId,
      score: 0,
      history: [],
      achievements: new Map(),
      streaks: new Map(),
      contributionHistory: [],
    };
    initializeAchievements(rep);
    userReputations.set(userId, rep);
  }
  return rep;
}

function initializeAchievements(rep: UserReputation): void {
  for (const def of BADGE_DEFINITIONS) {
    if (!rep.achievements.has(def.id)) {
      rep.achievements.set(def.id, {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        rarity: def.rarity,
        criteria: def.criteria,
        progress: 0,
        target: def.criteria.threshold,
        isUnlocked: false,
        unlockedAt: null,
      });
    }
  }
}

// ─── Reputation Scoring ──────────────────────────────────────────────────────

const REPUTATION_WEIGHTS: Record<string, number> = {
  idea_published: 10,
  idea_correct: 50,
  idea_incorrect: -10,
  idea_voted: 2,
  vote_received: 3,
  comment_posted: 2,
  comment_received: 1,
  follower_gained: 5,
  view_received: 0.1,
  share_received: 5,
  bookmark_received: 3,
  helpful_comment: 8,
  streak_day: 1,
  workspace_created: 15,
  file_shared: 3,
};

export function addReputationPoints(userId: string, reason: string, customDelta?: number): ReputationScore {
  const rep = getOrCreateReputation(userId);
  const delta = customDelta ?? (REPUTATION_WEIGHTS[reason] ?? 0);
  rep.score = Math.max(0, rep.score + delta);

  rep.history.push({ timestamp: Date.now(), delta, reason });
  if (rep.history.length > 500) rep.history.splice(0, rep.history.length - 500);

  const dateStr = new Date().toISOString().split('T')[0];
  const existing = rep.contributionHistory.find(c => c.date === dateStr && c.type === reason);
  if (existing) {
    existing.count++;
    existing.points += delta;
  } else {
    rep.contributionHistory.push({ date: dateStr, type: reason, count: 1, points: delta });
  }

  return computeReputationScore(rep);
}

export function getReputationScore(userId: string): ReputationScore {
  const rep = getOrCreateReputation(userId);
  return computeReputationScore(rep);
}

function computeReputationScore(rep: UserReputation): ReputationScore {
  const score = rep.score;
  const level = getLevel(score);
  const { current, next } = getLevelBounds(score);

  const range = next - current;
  const progress = range > 0 ? (score - current) / range : 1;

  const allScores = Array.from(userReputations.values()).map(r => r.score).sort((a, b) => a - b);
  const rank = allScores.findIndex(s => s >= score);
  const percentile = allScores.length > 0 ? ((rank + 1) / allScores.length) * 100 : 50;

  const recentHistory = rep.history.filter(h => h.timestamp > Date.now() - 30 * 86_400_000);
  const ideaPoints = recentHistory.filter(h => h.reason.startsWith('idea_')).reduce((s, h) => s + h.delta, 0);
  const socialPoints = recentHistory.filter(h => ['comment_posted', 'helpful_comment', 'follower_gained'].includes(h.reason)).reduce((s, h) => s + h.delta, 0);
  const totalRecent = recentHistory.reduce((s, h) => s + Math.abs(h.delta), 0) || 1;

  return {
    total: score,
    level,
    ideaAccuracy: Math.max(0, ideaPoints / totalRecent),
    helpfulness: Math.max(0, socialPoints / totalRecent),
    consistency: Math.min(1, rep.contributionHistory.length / 365),
    trustScore: computeTrustScore(rep),
    percentile,
    levelProgress: Math.max(0, Math.min(1, progress)),
  };
}

function computeTrustScore(rep: UserReputation): number {
  const accountAge = rep.history.length > 0
    ? (Date.now() - rep.history[0].timestamp) / 86_400_000
    : 0;
  const ageFactor = Math.min(1, accountAge / 365);

  const totalIdeas = rep.history.filter(h => h.reason === 'idea_published').length;
  const correctIdeas = rep.history.filter(h => h.reason === 'idea_correct').length;
  const accuracyFactor = totalIdeas >= 10 ? correctIdeas / totalIdeas : 0.5;

  const consistencyDays = new Set(rep.contributionHistory.map(c => c.date)).size;
  const consistencyFactor = Math.min(1, consistencyDays / 180);

  return Math.min(100, (ageFactor * 30 + accuracyFactor * 40 + consistencyFactor * 30));
}

function getLevel(score: number): ReputationLevel {
  let level = ReputationLevel.Novice;
  for (const t of LEVEL_THRESHOLDS) {
    if (score >= t.minScore) level = t.level;
  }
  return level;
}

function getLevelBounds(score: number): { current: number; next: number } {
  let current = 0;
  let next = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1].minScore;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (score >= LEVEL_THRESHOLDS[i].minScore) {
      current = LEVEL_THRESHOLDS[i].minScore;
      next = i + 1 < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[i + 1].minScore : current * 2;
    }
  }
  return { current, next };
}

// ─── Achievement Progress ────────────────────────────────────────────────────

export function updateAchievementProgress(
  userId: string,
  criteriaType: string,
  currentValue: number,
  conditions?: Record<string, unknown>,
): Achievement[] {
  const rep = getOrCreateReputation(userId);
  const newlyUnlocked: Achievement[] = [];

  for (const [, ach] of rep.achievements) {
    if (ach.isUnlocked) continue;
    if (ach.criteria.type !== criteriaType) continue;

    if (ach.criteria.conditions) {
      const conditionsMatch = Object.entries(ach.criteria.conditions).every(
        ([key, val]) => conditions?.[key] === val,
      );
      if (!conditionsMatch) continue;
    }

    ach.progress = currentValue;

    if (ach.progress >= ach.target) {
      ach.isUnlocked = true;
      ach.unlockedAt = Date.now();
      newlyUnlocked.push({ ...ach });

      const rarityBonus: Record<BadgeRarity, number> = {
        [BadgeRarity.Common]: 25,
        [BadgeRarity.Uncommon]: 50,
        [BadgeRarity.Rare]: 100,
        [BadgeRarity.Epic]: 250,
        [BadgeRarity.Legendary]: 500,
      };
      addReputationPoints(userId, 'achievement_unlocked', rarityBonus[ach.rarity]);
    }
  }

  return newlyUnlocked;
}

export function getAchievements(userId: string): Achievement[] {
  const rep = getOrCreateReputation(userId);
  return Array.from(rep.achievements.values()).map(a => ({ ...a }));
}

export function getUnlockedBadges(userId: string): Badge[] {
  const rep = getOrCreateReputation(userId);
  return Array.from(rep.achievements.values())
    .filter(a => a.isUnlocked)
    .map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      rarity: a.rarity,
      category: BADGE_DEFINITIONS.find(d => d.id === a.id)?.category ?? 'unknown',
      unlockedAt: a.unlockedAt,
    }));
}

// ─── Streaks ─────────────────────────────────────────────────────────────────

export function updateStreak(userId: string, type: string): StreakInfo {
  const rep = getOrCreateReputation(userId);
  const today = new Date().toISOString().split('T')[0];

  let streak = rep.streaks.get(type);
  if (!streak) {
    streak = { current: 0, longest: 0, lastActivityDate: '', type };
    rep.streaks.set(type, streak);
  }

  if (streak.lastActivityDate === today) return { ...streak };

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
  if (streak.lastActivityDate === yesterday) {
    streak.current++;
  } else {
    streak.current = 1;
  }

  streak.longest = Math.max(streak.longest, streak.current);
  streak.lastActivityDate = today;

  updateAchievementProgress(userId, 'streak_days', streak.current);

  return { ...streak };
}

export function getStreaks(userId: string): StreakInfo[] {
  const rep = getOrCreateReputation(userId);
  return Array.from(rep.streaks.values()).map(s => ({ ...s }));
}

// ─── Leaderboards ────────────────────────────────────────────────────────────

export type LeaderboardType = 'reputation' | 'accuracy' | 'ideas' | 'returns' | 'streaks' | 'helpful';

export function getLeaderboard(type: LeaderboardType, limit = 50): LeaderboardEntry[] {
  const entries: { userId: string; score: number }[] = [];

  for (const [userId, rep] of userReputations) {
    let score: number;
    switch (type) {
      case 'reputation':
        score = rep.score;
        break;
      case 'accuracy': {
        const correct = rep.history.filter(h => h.reason === 'idea_correct').length;
        const total = rep.history.filter(h => h.reason === 'idea_published').length;
        score = total >= 10 ? (correct / total) * 100 : 0;
        break;
      }
      case 'ideas':
        score = rep.history.filter(h => h.reason === 'idea_published').length;
        break;
      case 'returns': {
        const returnEntries = rep.history.filter(h => h.reason === 'idea_correct' || h.reason === 'idea_incorrect');
        score = returnEntries.reduce((s, h) => s + h.delta, 0);
        break;
      }
      case 'streaks': {
        const maxStreak = Array.from(rep.streaks.values()).reduce((max, s) => Math.max(max, s.longest), 0);
        score = maxStreak;
        break;
      }
      case 'helpful':
        score = rep.history.filter(h => h.reason === 'helpful_comment').length;
        break;
      default:
        score = rep.score;
    }
    entries.push({ userId, score });
  }

  entries.sort((a, b) => b.score - a.score);

  return entries.slice(0, limit).map((entry, idx) => ({
    rank: idx + 1,
    userId: entry.userId,
    username: entry.userId,
    avatarUrl: '',
    score: entry.score,
    change: 0,
  }));
}

// ─── Contribution History ────────────────────────────────────────────────────

export function getContributionHistory(userId: string, days = 365): ContributionEntry[] {
  const rep = getOrCreateReputation(userId);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0];
  return rep.contributionHistory
    .filter(c => c.date >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getContributionHeatmap(userId: string, days = 365): Record<string, number> {
  const history = getContributionHistory(userId, days);
  const heatmap: Record<string, number> = {};
  for (const entry of history) {
    heatmap[entry.date] = (heatmap[entry.date] ?? 0) + entry.count;
  }
  return heatmap;
}

// ─── Reputation History ──────────────────────────────────────────────────────

export function getReputationHistory(userId: string, limit = 100): { timestamp: number; delta: number; reason: string }[] {
  const rep = getOrCreateReputation(userId);
  return rep.history.slice(-limit).reverse().map(h => ({ ...h }));
}

// ─── Verification ────────────────────────────────────────────────────────────

const verificationLevels = new Map<string, string>();

export function setVerificationLevel(userId: string, level: string): void {
  verificationLevels.set(userId, level);
}

export function getVerificationLevel(userId: string): string {
  return verificationLevels.get(userId) ?? 'unverified';
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export function clearReputationStore(): void {
  userReputations.clear();
  verificationLevels.clear();
}
