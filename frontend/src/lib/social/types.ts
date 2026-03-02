// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserRole {
  Viewer = 'viewer',
  Editor = 'editor',
  Admin = 'admin',
  Moderator = 'moderator',
  Owner = 'owner',
}

export enum IdeaCategory {
  Technical = 'technical',
  Fundamental = 'fundamental',
  Macro = 'macro',
  Options = 'options',
  Crypto = 'crypto',
  Forex = 'forex',
  Commodities = 'commodities',
  QuantStrategy = 'quant_strategy',
  Education = 'education',
}

export enum IdeaDirection {
  Bullish = 'bullish',
  Bearish = 'bearish',
  Neutral = 'neutral',
}

export enum IdeaStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
  Removed = 'removed',
}

export enum IdeaOutcome {
  Pending = 'pending',
  Correct = 'correct',
  Incorrect = 'incorrect',
  Partial = 'partial',
  Expired = 'expired',
}

export enum NotificationType {
  PriceAlert = 'price_alert',
  NewsAlert = 'news_alert',
  SocialMention = 'social_mention',
  IdeaComment = 'idea_comment',
  IdeaVote = 'idea_vote',
  FollowActivity = 'follow_activity',
  WorkspaceInvite = 'workspace_invite',
  AchievementUnlock = 'achievement_unlock',
  SystemAnnouncement = 'system_announcement',
  TradeExecution = 'trade_execution',
  MarginCall = 'margin_call',
  ReportReady = 'report_ready',
}

export enum NotificationChannel {
  InApp = 'in_app',
  Push = 'push',
  Email = 'email',
  SMS = 'sms',
  Webhook = 'webhook',
}

export enum NotificationPriority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Critical = 'critical',
}

export enum BadgeRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Epic = 'epic',
  Legendary = 'legendary',
}

export enum ReputationLevel {
  Novice = 'novice',
  Apprentice = 'apprentice',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
  Expert = 'expert',
  Master = 'master',
  Grandmaster = 'grandmaster',
  Legend = 'legend',
}

export enum VerificationLevel {
  Unverified = 'unverified',
  EmailVerified = 'email_verified',
  PhoneVerified = 'phone_verified',
  IdentityVerified = 'identity_verified',
  ProfessionalVerified = 'professional_verified',
}

export enum ChannelType {
  Direct = 'direct',
  Group = 'group',
  Public = 'public',
  Announcement = 'announcement',
}

export enum MessageType {
  Text = 'text',
  Image = 'image',
  Chart = 'chart',
  File = 'file',
  System = 'system',
  IdeaShare = 'idea_share',
}

// ─── Core User & Profile ─────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  location: string;
  website: string;
  joinedAt: number;
  lastActiveAt: number;
  followersCount: number;
  followingCount: number;
  ideasCount: number;
  reputation: ReputationScore;
  verification: VerificationLevel;
  badges: Badge[];
  tradingStyle: string[];
  preferredMarkets: string[];
  isOnline: boolean;
  socialLinks: Record<string, string>;
}

export interface ReputationScore {
  total: number;
  level: ReputationLevel;
  ideaAccuracy: number;
  helpfulness: number;
  consistency: number;
  trustScore: number;
  percentile: number;
  levelProgress: number;
}

// ─── Trading Ideas ───────────────────────────────────────────────────────────

export interface TradingIdea {
  id: string;
  authorId: string;
  title: string;
  description: string;
  symbol: string;
  category: IdeaCategory;
  direction: IdeaDirection;
  status: IdeaStatus;
  outcome: IdeaOutcome;
  tags: string[];
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  timeframe: string;
  chartSnapshot: ChartSnapshot | null;
  votes: IdeaVotes;
  commentsCount: number;
  viewsCount: number;
  sharesCount: number;
  bookmarksCount: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  closedAt: number | null;
  performanceReturn: number | null;
}

export interface ChartSnapshot {
  imageUrl: string;
  symbol: string;
  timeframe: string;
  indicators: string[];
  drawings: string[];
  timestamp: number;
}

export interface IdeaVotes {
  bullish: number;
  bearish: number;
  total: number;
  userVote: IdeaDirection | null;
}

export interface IdeaFollowUp {
  id: string;
  ideaId: string;
  authorId: string;
  content: string;
  outcome: IdeaOutcome;
  actualReturn: number | null;
  createdAt: number;
}

// ─── Comments & Discussions ──────────────────────────────────────────────────

export interface Comment {
  id: string;
  parentId: string | null;
  authorId: string;
  content: string;
  likesCount: number;
  repliesCount: number;
  isEdited: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Discussion {
  id: string;
  title: string;
  authorId: string;
  category: string;
  content: string;
  tags: string[];
  commentsCount: number;
  viewsCount: number;
  likesCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: number;
  lastActivityAt: number;
}

// ─── Collaboration ───────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: number;
  updatedAt: number;
  settings: WorkspaceSettings;
  isPublic: boolean;
}

export interface WorkspaceMember {
  userId: string;
  role: UserRole;
  joinedAt: number;
  lastActiveAt: number;
  permissions: string[];
}

export interface WorkspaceSettings {
  allowPublicViewing: boolean;
  requireApproval: boolean;
  maxMembers: number;
  allowFileSharing: boolean;
  allowScreenSharing: boolean;
  retentionDays: number;
}

export interface SharedLayout {
  id: string;
  workspaceId: string;
  name: string;
  layout: Record<string, unknown>;
  createdBy: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface CursorPresence {
  userId: string;
  x: number;
  y: number;
  color: string;
  label: string;
  timestamp: number;
}

export interface SharedAnnotation {
  id: string;
  workspaceId: string;
  authorId: string;
  chartId: string;
  type: string;
  data: Record<string, unknown>;
  color: string;
  createdAt: number;
}

export interface ActivityEvent {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  target: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

export interface VersionEntry {
  id: string;
  resourceId: string;
  version: number;
  authorId: string;
  changes: Record<string, unknown>;
  timestamp: number;
}

// ─── Badges & Achievements ───────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  category: string;
  unlockedAt: number | null;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  criteria: AchievementCriteria;
  progress: number;
  target: number;
  isUnlocked: boolean;
  unlockedAt: number | null;
}

export interface AchievementCriteria {
  type: string;
  threshold: number;
  timeframe?: string;
  conditions?: Record<string, unknown>;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string;
  score: number;
  change: number;
  badge?: string;
}

export interface StreakInfo {
  current: number;
  longest: number;
  lastActivityDate: string;
  type: string;
}

// ─── Messaging & Channels ────────────────────────────────────────────────────

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  description: string;
  members: string[];
  createdBy: string;
  createdAt: number;
  lastMessageAt: number;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  type: MessageType;
  content: string;
  attachments: MessageAttachment[];
  replyTo: string | null;
  reactions: Record<string, string[]>;
  isEdited: boolean;
  createdAt: number;
  readBy: string[];
}

export interface MessageAttachment {
  id: string;
  type: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channel: NotificationChannel;
  priority: NotificationPriority;
  isRead: boolean;
  isSeen: boolean;
  groupKey: string | null;
  createdAt: number;
  readAt: number | null;
  expiresAt: number | null;
}

export interface NotificationPreferences {
  userId: string;
  channels: Record<NotificationType, NotificationChannel[]>;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string;
  doNotDisturb: boolean;
  emailDigest: 'none' | 'daily' | 'weekly';
  mutedChannels: string[];
  mutedUsers: string[];
}

export interface NotificationTemplate {
  type: NotificationType;
  titleTemplate: string;
  bodyTemplate: string;
  defaultChannel: NotificationChannel;
  defaultPriority: NotificationPriority;
  groupable: boolean;
  ttlMs: number;
}

// ─── Consensus & Sentiment ───────────────────────────────────────────────────

export interface ConsensusData {
  symbol: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalVotes: number;
  bullishPercent: number;
  bearishPercent: number;
  sentimentScore: number;
  timestamp: number;
}

export interface TrendingTopic {
  tag: string;
  count: number;
  change24h: number;
  topIdeas: string[];
}
