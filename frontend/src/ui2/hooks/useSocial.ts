/**
 * useSocial — React hook wiring lib/social → DashboardUI2, NewsTerminalUI2, AlertsManagerUI2
 *
 * Provides: trading ideas, social feed, user profiles, reputation system,
 * collaboration, live chat, copy trading, leaderboards, community analytics.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
// ── Lib stubs (self-contained mode) ──
type Post = any;
type Workspace = any;
type UserReputation = any;
type Message = any;
type SocialConfig = any;
const SocialFeed = class { constructor(..._a: any[]) {} } as any;
const CollaborationEngine = class { constructor(..._a: any[]) {} } as any;
const ReputationSystem = class { constructor(..._a: any[]) {} } as any;
const ChatEngine = class { constructor(..._a: any[]) {} } as any;


// ── Types ────────────────────────────────────────────────────────────────────

export interface TradingIdea {
  id: string;
  author: UserProfile;
  symbol: string;
  direction: 'long' | 'short';
  entry: number;
  target: number;
  stop: number;
  timeframe: string;
  title: string;
  body: string;
  tags: string[];
  chart?: string;           // chart snapshot URL
  published: number;
  updated?: number;
  likes: number;
  comments: number;
  views: number;
  isLiked: boolean;
  isBookmarked: boolean;
  status: 'active' | 'target_hit' | 'stopped_out' | 'expired' | 'cancelled';
  pnlPct?: number;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  joinDate: number;
  followers: number;
  following: number;
  ideas: number;
  winRate: number;
  reputation: number;
  badges: Badge[];
  isFollowing: boolean;
  isVerified: boolean;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface SocialComment {
  id: string;
  author: { id: string; username: string; avatar: string };
  text: string;
  timestamp: number;
  likes: number;
  isLiked: boolean;
  replies: SocialComment[];
}

export interface ChatMessage {
  id: string;
  author: { id: string; username: string; avatar: string };
  text: string;
  timestamp: number;
  type: 'text' | 'trade' | 'chart' | 'system';
  data?: Record<string, any>;
}

export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  members: number;
  online: number;
  lastMessage?: ChatMessage;
  isJoined: boolean;
  type: 'public' | 'private' | 'direct';
  unread: number;
}

export interface LeaderboardEntry {
  rank: number;
  user: { id: string; username: string; avatar: string };
  returnPct: number;
  winRate: number;
  sharpe: number;
  trades: number;
  followers: number;
  reputation: number;
}

export interface CopyTradeConfig {
  leaderId: string;
  enabled: boolean;
  allocationPct: number;
  maxPositionSize: number;
  copyStops: boolean;
  copyTargets: boolean;
  symbols: string[];         // empty = all
  maxDailyTrades: number;
}

export interface SocialNotification {
  id: string;
  type: 'follow' | 'like' | 'comment' | 'mention' | 'trade' | 'idea' | 'badge';
  from: { id: string; username: string; avatar: string };
  message: string;
  timestamp: number;
  read: boolean;
  link?: string;
}

export interface SocialState {
  /** Trading ideas feed */
  ideas: TradingIdea[];
  /** Active idea */
  activeIdea: TradingIdea | null;
  /** Comments on active idea */
  comments: SocialComment[];
  /** User profile (self) */
  myProfile: UserProfile;
  /** Viewed profile */
  viewedProfile: UserProfile | null;
  /** Chat rooms */
  chatRooms: ChatRoom[];
  /** Active chat messages */
  chatMessages: ChatMessage[];
  /** Active chat room id */
  activeChatRoom: string | null;
  /** Leaderboard */
  leaderboard: LeaderboardEntry[];
  /** Copy trade configs */
  copyTrades: CopyTradeConfig[];
  /** Social notifications */
  socialNotifications: SocialNotification[];
  /** Unread social notifications */
  socialUnread: number;
  /** Feed filter */
  feedFilter: 'trending' | 'latest' | 'following' | 'top';
  /** Feed symbol filter */
  feedSymbol: string;
  /** Is loading */
  isLoading: boolean;
  /** Followers list */
  followers: UserProfile[];
  /** Following list */
  followingList: UserProfile[];
}

export interface SocialActions {
  // ── Ideas ────
  loadIdeas: (filter?: SocialState['feedFilter'], symbol?: string) => void;
  createIdea: (idea: Omit<TradingIdea, 'id' | 'author' | 'published' | 'likes' | 'comments' | 'views' | 'isLiked' | 'isBookmarked' | 'status'>) => string;
  updateIdea: (id: string, patch: Partial<TradingIdea>) => void;
  deleteIdea: (id: string) => void;
  viewIdea: (id: string) => void;
  likeIdea: (id: string) => void;
  bookmarkIdea: (id: string) => void;
  closeIdea: (id: string, status: TradingIdea['status']) => void;

  // ── Comments ────
  loadComments: (ideaId: string) => void;
  addComment: (ideaId: string, text: string) => void;
  likeComment: (commentId: string) => void;
  replyToComment: (commentId: string, text: string) => void;

  // ── Profiles ────
  viewProfile: (userId: string) => void;
  followUser: (userId: string) => void;
  unfollowUser: (userId: string) => void;
  updateMyProfile: (patch: Partial<UserProfile>) => void;
  loadFollowers: () => void;
  loadFollowing: () => void;

  // ── Chat ────
  loadChatRooms: () => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (text: string, type?: ChatMessage['type'], data?: Record<string, any>) => void;
  loadMessages: (roomId: string) => void;

  // ── Leaderboard ────
  loadLeaderboard: (period?: 'daily' | 'weekly' | 'monthly' | 'allTime') => void;

  // ── Copy Trading ────
  startCopyTrading: (config: CopyTradeConfig) => void;
  stopCopyTrading: (leaderId: string) => void;
  updateCopyConfig: (leaderId: string, patch: Partial<CopyTradeConfig>) => void;

  // ── Notifications ────
  markSocialRead: (id: string) => void;
  markAllSocialRead: () => void;
  clearSocialNotifications: () => void;

  // ── Feed ────
  setFeedFilter: (filter: SocialState['feedFilter']) => void;
  setFeedSymbol: (symbol: string) => void;
  refreshFeed: () => void;
}

// ── Data ─────────────────────────────────────────────────────────────────────

let socialCounter = 0;
function sid() { return `soc_${++socialCounter}_${Date.now().toString(36)}`; }

const AVATARS = ['🐂', '🐻', '🦅', '🐺', '🦊', '🐯', '🦁', '🐉', '🦈', '🐳'];
const USERNAMES = ['AlphaTrader', 'ChartMaster', 'TrendRider', 'PipHunter', 'SwingKing', 'QubitTrader', 'NightOwl', 'BullishBear', 'CryptoSage', 'VolSurfer'];
const SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'BTC', 'ETH', 'AMZN', 'GOOGL', 'SPY', 'EUR/USD', 'GC'];
const TAGS = ['breakout', 'reversal', 'trend', 'support', 'resistance', 'earnings', 'macro', 'technical', 'fundamental', 'options'];

function mockUser(i: number): UserProfile {
  return {
    id: `user_${i}`, username: USERNAMES[i % USERNAMES.length],
    displayName: USERNAMES[i % USERNAMES.length],
    avatar: AVATARS[i % AVATARS.length],
    bio: 'Full-time trader | Technical analysis | Options',
    joinDate: Date.now() - Math.floor(Math.random() * 365 * 86400000),
    followers: Math.floor(100 + Math.random() * 10000),
    following: Math.floor(50 + Math.random() * 500),
    ideas: Math.floor(10 + Math.random() * 200),
    winRate: +(50 + Math.random() * 30).toFixed(1),
    reputation: Math.floor(100 + Math.random() * 5000),
    badges: [],
    isFollowing: Math.random() > 0.5,
    isVerified: Math.random() > 0.7,
  };
}

function mockIdea(i: number): TradingIdea {
  const sym = SYMBOLS[i % SYMBOLS.length];
  const direction: 'long' | 'short' = Math.random() > 0.4 ? 'long' : 'short';
  const base = 100 + Math.random() * 200;
  const entry = +base.toFixed(2);
  const target = +(direction === 'long' ? base * (1.05 + Math.random() * 0.1) : base * (0.9 + Math.random() * 0.05)).toFixed(2);
  const stop = +(direction === 'long' ? base * (0.95 - Math.random() * 0.03) : base * (1.03 + Math.random() * 0.03)).toFixed(2);
  return {
    id: sid(), author: mockUser(i), symbol: sym, direction, entry, target, stop,
    timeframe: ['1H', '4H', '1D', '1W'][Math.floor(Math.random() * 4)],
    title: `${sym} ${direction === 'long' ? 'Bullish' : 'Bearish'} Setup - ${['Breakout', 'Reversal', 'Continuation', 'Gap Fill'][Math.floor(Math.random() * 4)]}`,
    body: `Technical analysis shows a clear ${direction} setup on ${sym}. Key levels identified with entry, target, and stop-loss defined. Risk/reward ratio: ${+((Math.abs(target - entry) / Math.abs(entry - stop))).toFixed(1)}:1.`,
    tags: Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => TAGS[Math.floor(Math.random() * TAGS.length)]),
    published: Date.now() - Math.floor(Math.random() * 7 * 86400000),
    likes: Math.floor(Math.random() * 500),
    comments: Math.floor(Math.random() * 50),
    views: Math.floor(50 + Math.random() * 5000),
    isLiked: false, isBookmarked: false,
    status: 'active',
  };
}

const MY_PROFILE: UserProfile = {
  id: 'user_self', username: 'ApexTrader', displayName: 'Apex Trader',
  avatar: '🦅', bio: 'Professional trader | Algo strategies | Risk management',
  joinDate: Date.now() - 365 * 86400000,
  followers: 2500, following: 150, ideas: 45,
  winRate: 68.5, reputation: 4200,
  badges: [
    { id: 'b1', name: 'Top Contributor', icon: '⭐', description: 'Published 50+ ideas', rarity: 'rare' },
    { id: 'b2', name: 'Sharp Shooter', icon: '🎯', description: '70%+ win rate over 30 days', rarity: 'epic' },
    { id: 'b3', name: 'Early Adopter', icon: '🏷️', description: 'Joined in first year', rarity: 'legendary' },
  ],
  isFollowing: false, isVerified: true,
};

// ── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: SocialState = {
  ideas: Array.from({ length: 20 }, (_, i) => mockIdea(i)),
  activeIdea: null,
  comments: [],
  myProfile: MY_PROFILE,
  viewedProfile: null,
  chatRooms: [],
  chatMessages: [],
  activeChatRoom: null,
  leaderboard: [],
  copyTrades: [],
  socialNotifications: [],
  socialUnread: 0,
  feedFilter: 'trending',
  feedSymbol: '',
  isLoading: false,
  followers: [],
  followingList: [],
};

export function useSocial(): [SocialState, SocialActions] {
  const [state, setState] = useState<SocialState>(INITIAL_STATE);

  // Ideas
  const loadIdeas = useCallback((filter?: SocialState['feedFilter'], symbol?: string) => {
    setState(prev => {
      let ideas = Array.from({ length: 20 }, (_, i) => mockIdea(i));
      if (symbol) ideas = ideas.filter(i => i.symbol === symbol);
      if (filter === 'top') ideas.sort((a, b) => b.likes - a.likes);
      else if (filter === 'latest') ideas.sort((a, b) => b.published - a.published);
      return { ...prev, ideas, feedFilter: filter || prev.feedFilter, feedSymbol: symbol || prev.feedSymbol };
    });
  }, []);

  const createIdea = useCallback((idea: Omit<TradingIdea, 'id' | 'author' | 'published' | 'likes' | 'comments' | 'views' | 'isLiked' | 'isBookmarked' | 'status'>): string => {
    const id = sid();
    const newIdea: TradingIdea = {
      ...idea, id, author: state.myProfile,
      published: Date.now(), likes: 0, comments: 0, views: 0,
      isLiked: false, isBookmarked: false, status: 'active',
    };
    setState(prev => ({ ...prev, ideas: [newIdea, ...prev.ideas] }));
    return id;
  }, [state.myProfile]);

  const updateIdea = useCallback((id: string, patch: Partial<TradingIdea>) => {
    setState(prev => ({ ...prev, ideas: prev.ideas.map(i => i.id === id ? { ...i, ...patch, updated: Date.now() } : i) }));
  }, []);

  const deleteIdea = useCallback((id: string) => {
    setState(prev => ({ ...prev, ideas: prev.ideas.filter(i => i.id !== id) }));
  }, []);

  const viewIdea = useCallback((id: string) => {
    setState(prev => {
      const idea = prev.ideas.find(i => i.id === id);
      if (!idea) return prev;
      return {
        ...prev,
        activeIdea: idea,
        ideas: prev.ideas.map(i => i.id === id ? { ...i, views: i.views + 1 } : i),
      };
    });
  }, []);

  const likeIdea = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      ideas: prev.ideas.map(i => i.id === id
        ? { ...i, isLiked: !i.isLiked, likes: i.isLiked ? i.likes - 1 : i.likes + 1 }
        : i
      ),
      activeIdea: prev.activeIdea?.id === id
        ? { ...prev.activeIdea, isLiked: !prev.activeIdea.isLiked, likes: prev.activeIdea.isLiked ? prev.activeIdea.likes - 1 : prev.activeIdea.likes + 1 }
        : prev.activeIdea,
    }));
  }, []);

  const bookmarkIdea = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      ideas: prev.ideas.map(i => i.id === id ? { ...i, isBookmarked: !i.isBookmarked } : i),
    }));
  }, []);

  const closeIdea = useCallback((id: string, status: TradingIdea['status']) => {
    setState(prev => ({
      ...prev,
      ideas: prev.ideas.map(i => i.id === id ? { ...i, status } : i),
    }));
  }, []);

  // Comments
  const loadComments = useCallback((ideaId: string) => {
    const comments: SocialComment[] = Array.from({ length: Math.floor(3 + Math.random() * 10) }, (_, i) => ({
      id: sid(),
      author: { id: `user_${i}`, username: USERNAMES[i % USERNAMES.length], avatar: AVATARS[i % AVATARS.length] },
      text: ['Great analysis!', 'I agree with this setup.', 'What about the earnings risk?', 'Entered on this trade, thanks!', 'The R/R looks solid.'][i % 5],
      timestamp: Date.now() - Math.floor(Math.random() * 86400000),
      likes: Math.floor(Math.random() * 20),
      isLiked: false,
      replies: [],
    }));
    setState(prev => ({ ...prev, comments }));
  }, []);

  const addComment = useCallback((ideaId: string, text: string) => {
    const comment: SocialComment = {
      id: sid(),
      author: { id: state.myProfile.id, username: state.myProfile.username, avatar: state.myProfile.avatar },
      text, timestamp: Date.now(), likes: 0, isLiked: false, replies: [],
    };
    setState(prev => ({
      ...prev,
      comments: [...prev.comments, comment],
      ideas: prev.ideas.map(i => i.id === ideaId ? { ...i, comments: i.comments + 1 } : i),
    }));
  }, [state.myProfile]);

  const likeComment = useCallback((commentId: string) => {
    setState(prev => ({
      ...prev,
      comments: prev.comments.map(c => c.id === commentId
        ? { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 }
        : c
      ),
    }));
  }, []);

  const replyToComment = useCallback((commentId: string, text: string) => {
    const reply: SocialComment = {
      id: sid(),
      author: { id: state.myProfile.id, username: state.myProfile.username, avatar: state.myProfile.avatar },
      text, timestamp: Date.now(), likes: 0, isLiked: false, replies: [],
    };
    setState(prev => ({
      ...prev,
      comments: prev.comments.map(c => c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c),
    }));
  }, [state.myProfile]);

  // Profiles
  const viewProfile = useCallback((userId: string) => {
    const profile = mockUser(parseInt(userId.split('_')[1]) || 0);
    setState(prev => ({ ...prev, viewedProfile: profile }));
  }, []);

  const followUser = useCallback((userId: string) => {
    setState(prev => ({
      ...prev,
      viewedProfile: prev.viewedProfile?.id === userId ? { ...prev.viewedProfile, isFollowing: true, followers: prev.viewedProfile.followers + 1 } : prev.viewedProfile,
      myProfile: { ...prev.myProfile, following: prev.myProfile.following + 1 },
    }));
  }, []);

  const unfollowUser = useCallback((userId: string) => {
    setState(prev => ({
      ...prev,
      viewedProfile: prev.viewedProfile?.id === userId ? { ...prev.viewedProfile, isFollowing: false, followers: prev.viewedProfile.followers - 1 } : prev.viewedProfile,
      myProfile: { ...prev.myProfile, following: prev.myProfile.following - 1 },
    }));
  }, []);

  const updateMyProfile = useCallback((patch: Partial<UserProfile>) => {
    setState(prev => ({ ...prev, myProfile: { ...prev.myProfile, ...patch } }));
  }, []);

  const loadFollowers = useCallback(() => {
    setState(prev => ({ ...prev, followers: Array.from({ length: 20 }, (_, i) => mockUser(i + 10)) }));
  }, []);

  const loadFollowing = useCallback(() => {
    setState(prev => ({ ...prev, followingList: Array.from({ length: 10 }, (_, i) => mockUser(i + 30)) }));
  }, []);

  // Chat
  const loadChatRooms = useCallback(() => {
    const rooms: ChatRoom[] = [
      { id: 'room_general', name: 'General', description: 'General trading discussion', members: 15000, online: 342, isJoined: true, type: 'public', unread: 5 },
      { id: 'room_stocks', name: 'Stocks', description: 'Stock market analysis and trades', members: 8500, online: 180, isJoined: true, type: 'public', unread: 2 },
      { id: 'room_crypto', name: 'Crypto', description: 'Cryptocurrency discussion', members: 12000, online: 520, isJoined: true, type: 'public', unread: 12 },
      { id: 'room_options', name: 'Options', description: 'Options strategies and flow', members: 4200, online: 95, isJoined: false, type: 'public', unread: 0 },
      { id: 'room_forex', name: 'Forex', description: 'Currency pair analysis', members: 6300, online: 145, isJoined: false, type: 'public', unread: 0 },
      { id: 'room_algo', name: 'Algo Trading', description: 'Algorithmic and quant strategies', members: 3100, online: 67, isJoined: true, type: 'public', unread: 0 },
    ];
    setState(prev => ({ ...prev, chatRooms: rooms }));
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    setState(prev => ({
      ...prev,
      chatRooms: prev.chatRooms.map(r => r.id === roomId ? { ...r, isJoined: true, members: r.members + 1 } : r),
    }));
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    setState(prev => ({
      ...prev,
      chatRooms: prev.chatRooms.map(r => r.id === roomId ? { ...r, isJoined: false, members: r.members - 1 } : r),
      activeChatRoom: prev.activeChatRoom === roomId ? null : prev.activeChatRoom,
    }));
  }, []);

  const sendMessage = useCallback((text: string, type: ChatMessage['type'] = 'text', data?: Record<string, any>) => {
    if (!state.activeChatRoom) return;
    const msg: ChatMessage = {
      id: sid(),
      author: { id: state.myProfile.id, username: state.myProfile.username, avatar: state.myProfile.avatar },
      text, timestamp: Date.now(), type, data,
    };
    setState(prev => ({ ...prev, chatMessages: [...prev.chatMessages, msg] }));
  }, [state.activeChatRoom, state.myProfile]);

  const loadMessages = useCallback((roomId: string) => {
    const messages: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({
      id: sid(),
      author: { id: `user_${i % 10}`, username: USERNAMES[i % 10], avatar: AVATARS[i % 10] },
      text: [
        'What do you think about this setup?',
        'Just entered a long on AAPL',
        'Markets looking bearish today',
        'The RSI is showing divergence',
        'Volume pickup on the 15m chart',
        'Anyone watching the Fed meeting?',
        'This support level is key',
        'Added to my position',
        'Nice breakout forming',
        'Be careful with size here',
      ][i % 10],
      timestamp: Date.now() - (30 - i) * 60000,
      type: 'text' as const,
    }));
    setState(prev => ({
      ...prev,
      chatMessages: messages,
      activeChatRoom: roomId,
      chatRooms: prev.chatRooms.map(r => r.id === roomId ? { ...r, unread: 0 } : r),
    }));
  }, []);

  // Leaderboard
  const loadLeaderboard = useCallback((period?: 'daily' | 'weekly' | 'monthly' | 'allTime') => {
    const entries: LeaderboardEntry[] = Array.from({ length: 50 }, (_, i) => ({
      rank: i + 1,
      user: { id: `user_${i}`, username: USERNAMES[i % USERNAMES.length] + (i > 9 ? `_${i}` : ''), avatar: AVATARS[i % AVATARS.length] },
      returnPct: +(80 - i * 1.5 + Math.random() * 5).toFixed(2),
      winRate: +(75 - i * 0.3 + Math.random() * 5).toFixed(1),
      sharpe: +(3.5 - i * 0.05 + Math.random() * 0.3).toFixed(2),
      trades: Math.floor(50 + Math.random() * 500),
      followers: Math.floor(10000 - i * 150 + Math.random() * 500),
      reputation: Math.floor(5000 - i * 80 + Math.random() * 200),
    }));
    setState(prev => ({ ...prev, leaderboard: entries }));
  }, []);

  // Copy Trading
  const startCopyTrading = useCallback((config: CopyTradeConfig) => {
    setState(prev => ({
      ...prev,
      copyTrades: [...prev.copyTrades.filter(c => c.leaderId !== config.leaderId), config],
    }));
  }, []);

  const stopCopyTrading = useCallback((leaderId: string) => {
    setState(prev => ({ ...prev, copyTrades: prev.copyTrades.filter(c => c.leaderId !== leaderId) }));
  }, []);

  const updateCopyConfig = useCallback((leaderId: string, patch: Partial<CopyTradeConfig>) => {
    setState(prev => ({
      ...prev,
      copyTrades: prev.copyTrades.map(c => c.leaderId === leaderId ? { ...c, ...patch } : c),
    }));
  }, []);

  // Notifications
  const markSocialRead = useCallback((id: string) => {
    setState(prev => {
      const n = prev.socialNotifications.find(x => x.id === id);
      if (!n || n.read) return prev;
      return {
        ...prev,
        socialNotifications: prev.socialNotifications.map(x => x.id === id ? { ...x, read: true } : x),
        socialUnread: Math.max(0, prev.socialUnread - 1),
      };
    });
  }, []);

  const markAllSocialRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      socialNotifications: prev.socialNotifications.map(n => ({ ...n, read: true })),
      socialUnread: 0,
    }));
  }, []);

  const clearSocialNotifications = useCallback(() => {
    setState(prev => ({ ...prev, socialNotifications: [], socialUnread: 0 }));
  }, []);

  // Feed
  const setFeedFilter = useCallback((filter: SocialState['feedFilter']) => {
    setState(prev => ({ ...prev, feedFilter: filter }));
  }, []);

  const setFeedSymbol = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, feedSymbol: symbol }));
  }, []);

  const refreshFeed = useCallback(() => {
    loadIdeas(state.feedFilter, state.feedSymbol);
  }, [loadIdeas, state.feedFilter, state.feedSymbol]);

  const actions: SocialActions = useMemo(() => ({
    loadIdeas, createIdea, updateIdea, deleteIdea, viewIdea, likeIdea, bookmarkIdea, closeIdea,
    loadComments, addComment, likeComment, replyToComment,
    viewProfile, followUser, unfollowUser, updateMyProfile, loadFollowers, loadFollowing,
    loadChatRooms, joinRoom, leaveRoom, sendMessage, loadMessages,
    loadLeaderboard,
    startCopyTrading, stopCopyTrading, updateCopyConfig,
    markSocialRead, markAllSocialRead, clearSocialNotifications,
    setFeedFilter, setFeedSymbol, refreshFeed,
  }), [
    loadIdeas, createIdea, updateIdea, deleteIdea, viewIdea, likeIdea, bookmarkIdea, closeIdea,
    loadComments, addComment, likeComment, replyToComment,
    viewProfile, followUser, unfollowUser, updateMyProfile, loadFollowers, loadFollowing,
    loadChatRooms, joinRoom, leaveRoom, sendMessage, loadMessages,
    loadLeaderboard,
    startCopyTrading, stopCopyTrading, updateCopyConfig,
    markSocialRead, markAllSocialRead, clearSocialNotifications,
    setFeedFilter, setFeedSymbol, refreshFeed,
  ]);

  return [state, actions];
}
