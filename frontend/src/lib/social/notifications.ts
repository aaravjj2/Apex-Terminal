import type {
  Notification,
  NotificationPreferences,
  NotificationTemplate,
} from './types';
import {
  NotificationType,
  NotificationChannel,
  NotificationPriority,
} from './types';

// ─── ID Generation ───────────────────────────────────────────────────────────

let notifCounter = 0;
function genId(): string {
  return `notif_${Date.now()}_${++notifCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Stores ──────────────────────────────────────────────────────────────────

const notifications = new Map<string, Notification[]>();
const preferences = new Map<string, NotificationPreferences>();
const scheduledNotifications: ScheduledNotification[] = [];

interface ScheduledNotification {
  id: string;
  userId: string;
  notification: Omit<Notification, 'id' | 'createdAt' | 'isRead' | 'isSeen' | 'readAt'>;
  scheduledFor: number;
  sent: boolean;
}

// ─── Templates ───────────────────────────────────────────────────────────────

const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  { type: NotificationType.PriceAlert, titleTemplate: 'Price Alert: {symbol}', bodyTemplate: '{symbol} has reached {price} ({change})', defaultChannel: NotificationChannel.Push, defaultPriority: NotificationPriority.High, groupable: true, ttlMs: 3_600_000 },
  { type: NotificationType.NewsAlert, titleTemplate: 'Breaking: {headline}', bodyTemplate: '{summary}', defaultChannel: NotificationChannel.Push, defaultPriority: NotificationPriority.Normal, groupable: true, ttlMs: 86_400_000 },
  { type: NotificationType.SocialMention, titleTemplate: '{username} mentioned you', bodyTemplate: '{username} mentioned you in {context}', defaultChannel: NotificationChannel.InApp, defaultPriority: NotificationPriority.Normal, groupable: true, ttlMs: 604_800_000 },
  { type: NotificationType.IdeaComment, titleTemplate: 'New comment on your idea', bodyTemplate: '{username} commented on "{ideaTitle}"', defaultChannel: NotificationChannel.InApp, defaultPriority: NotificationPriority.Normal, groupable: true, ttlMs: 604_800_000 },
  { type: NotificationType.IdeaVote, titleTemplate: 'Your idea received a vote', bodyTemplate: '{username} voted {direction} on "{ideaTitle}"', defaultChannel: NotificationChannel.InApp, defaultPriority: NotificationPriority.Low, groupable: true, ttlMs: 604_800_000 },
  { type: NotificationType.FollowActivity, titleTemplate: '{username} started following you', bodyTemplate: 'You have a new follower: {username}', defaultChannel: NotificationChannel.InApp, defaultPriority: NotificationPriority.Low, groupable: true, ttlMs: 604_800_000 },
  { type: NotificationType.WorkspaceInvite, titleTemplate: 'Workspace invitation', bodyTemplate: '{inviter} invited you to join "{workspaceName}"', defaultChannel: NotificationChannel.Push, defaultPriority: NotificationPriority.High, groupable: false, ttlMs: 604_800_000 },
  { type: NotificationType.AchievementUnlock, titleTemplate: 'Achievement Unlocked! 🏆', bodyTemplate: 'You earned the "{badgeName}" badge!', defaultChannel: NotificationChannel.InApp, defaultPriority: NotificationPriority.Normal, groupable: false, ttlMs: 2_592_000_000 },
  { type: NotificationType.SystemAnnouncement, titleTemplate: '{title}', bodyTemplate: '{message}', defaultChannel: NotificationChannel.InApp, defaultPriority: NotificationPriority.Normal, groupable: false, ttlMs: 2_592_000_000 },
  { type: NotificationType.TradeExecution, titleTemplate: 'Trade Executed: {symbol}', bodyTemplate: '{action} {quantity} {symbol} at {price}', defaultChannel: NotificationChannel.Push, defaultPriority: NotificationPriority.High, groupable: false, ttlMs: 86_400_000 },
  { type: NotificationType.MarginCall, titleTemplate: '⚠️ Margin Call', bodyTemplate: 'Your account requires additional margin. Current margin: {margin}%', defaultChannel: NotificationChannel.Push, defaultPriority: NotificationPriority.Critical, groupable: false, ttlMs: 3_600_000 },
  { type: NotificationType.ReportReady, titleTemplate: 'Report Ready', bodyTemplate: 'Your {reportType} report is ready for download', defaultChannel: NotificationChannel.Email, defaultPriority: NotificationPriority.Normal, groupable: false, ttlMs: 604_800_000 },
];

function getTemplate(type: NotificationType): NotificationTemplate | undefined {
  return NOTIFICATION_TEMPLATES.find(t => t.type === type);
}

function interpolateTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = data[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

// ─── Preferences ─────────────────────────────────────────────────────────────

const DEFAULT_CHANNEL_MAP: Record<NotificationType, NotificationChannel[]> = {
  [NotificationType.PriceAlert]: [NotificationChannel.Push, NotificationChannel.InApp],
  [NotificationType.NewsAlert]: [NotificationChannel.InApp],
  [NotificationType.SocialMention]: [NotificationChannel.InApp],
  [NotificationType.IdeaComment]: [NotificationChannel.InApp],
  [NotificationType.IdeaVote]: [NotificationChannel.InApp],
  [NotificationType.FollowActivity]: [NotificationChannel.InApp],
  [NotificationType.WorkspaceInvite]: [NotificationChannel.Push, NotificationChannel.InApp, NotificationChannel.Email],
  [NotificationType.AchievementUnlock]: [NotificationChannel.InApp],
  [NotificationType.SystemAnnouncement]: [NotificationChannel.InApp, NotificationChannel.Email],
  [NotificationType.TradeExecution]: [NotificationChannel.Push, NotificationChannel.InApp],
  [NotificationType.MarginCall]: [NotificationChannel.Push, NotificationChannel.InApp, NotificationChannel.Email, NotificationChannel.SMS],
  [NotificationType.ReportReady]: [NotificationChannel.InApp, NotificationChannel.Email],
};

export function getPreferences(userId: string): NotificationPreferences {
  let prefs = preferences.get(userId);
  if (!prefs) {
    prefs = {
      userId,
      channels: { ...DEFAULT_CHANNEL_MAP },
      quietHoursStart: null,
      quietHoursEnd: null,
      quietHoursTimezone: 'UTC',
      doNotDisturb: false,
      emailDigest: 'daily',
      mutedChannels: [],
      mutedUsers: [],
    };
    preferences.set(userId, prefs);
  }
  return { ...prefs };
}

export function updatePreferences(userId: string, updates: Partial<NotificationPreferences>): NotificationPreferences {
  const prefs = getPreferences(userId);

  if (updates.channels) prefs.channels = { ...prefs.channels, ...updates.channels };
  if (updates.quietHoursStart !== undefined) prefs.quietHoursStart = updates.quietHoursStart;
  if (updates.quietHoursEnd !== undefined) prefs.quietHoursEnd = updates.quietHoursEnd;
  if (updates.quietHoursTimezone !== undefined) prefs.quietHoursTimezone = updates.quietHoursTimezone;
  if (updates.doNotDisturb !== undefined) prefs.doNotDisturb = updates.doNotDisturb;
  if (updates.emailDigest !== undefined) prefs.emailDigest = updates.emailDigest;
  if (updates.mutedChannels !== undefined) prefs.mutedChannels = updates.mutedChannels;
  if (updates.mutedUsers !== undefined) prefs.mutedUsers = updates.mutedUsers;

  preferences.set(userId, prefs);
  return { ...prefs };
}

// ─── DND & Quiet Hours ──────────────────────────────────────────────────────

function isInQuietHours(prefs: NotificationPreferences): boolean {
  if (prefs.doNotDisturb) return true;
  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false;

  const now = new Date();
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
  const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function shouldDeliver(prefs: NotificationPreferences, type: NotificationType, channel: NotificationChannel, priority: NotificationPriority): boolean {
  if (priority === NotificationPriority.Critical) return true;
  if (isInQuietHours(prefs) && priority !== NotificationPriority.High) return false;

  const allowedChannels = prefs.channels[type] ?? [];
  return allowedChannels.includes(channel);
}

// ─── Send Notification ───────────────────────────────────────────────────────

export interface SendNotificationInput {
  userId: string;
  type: NotificationType;
  data: Record<string, unknown>;
  overrideTitle?: string;
  overrideBody?: string;
  overridePriority?: NotificationPriority;
  groupKey?: string;
  sourceUserId?: string;
}

export function sendNotification(input: SendNotificationInput): Notification | null {
  const prefs = getPreferences(input.userId);

  if (input.sourceUserId && prefs.mutedUsers.includes(input.sourceUserId)) {
    return null;
  }

  const template = getTemplate(input.type);
  const title = input.overrideTitle ?? (template ? interpolateTemplate(template.titleTemplate, input.data) : String(input.data.title ?? 'Notification'));
  const body = input.overrideBody ?? (template ? interpolateTemplate(template.bodyTemplate, input.data) : String(input.data.message ?? ''));
  const priority = input.overridePriority ?? template?.defaultPriority ?? NotificationPriority.Normal;
  const channel = template?.defaultChannel ?? NotificationChannel.InApp;
  const ttl = template?.ttlMs ?? 604_800_000;

  if (!shouldDeliver(prefs, input.type, channel, priority)) return null;

  const notification: Notification = {
    id: genId(),
    userId: input.userId,
    type: input.type,
    title,
    body,
    data: input.data,
    channel,
    priority,
    isRead: false,
    isSeen: false,
    groupKey: input.groupKey ?? (template?.groupable ? `${input.type}_${input.data.symbol ?? input.data.ideaId ?? ''}` : null),
    createdAt: Date.now(),
    readAt: null,
    expiresAt: Date.now() + ttl,
  };

  let userNotifs = notifications.get(input.userId);
  if (!userNotifs) {
    userNotifs = [];
    notifications.set(input.userId, userNotifs);
  }

  if (notification.groupKey) {
    const existingGroupIdx = userNotifs.findIndex(
      n => n.groupKey === notification.groupKey && !n.isRead && Date.now() - n.createdAt < 3_600_000,
    );
    if (existingGroupIdx !== -1) {
      const existing = userNotifs[existingGroupIdx];
      existing.body = `${body} (and more)`;
      existing.data = { ...existing.data, groupedCount: (Number(existing.data.groupedCount) || 1) + 1 };
      existing.createdAt = Date.now();
      return { ...existing };
    }
  }

  userNotifs.push(notification);

  if (userNotifs.length > 500) {
    userNotifs.splice(0, userNotifs.length - 500);
  }

  return { ...notification };
}

export function sendBulkNotification(userIds: string[], type: NotificationType, data: Record<string, unknown>): number {
  let sent = 0;
  for (const userId of userIds) {
    const result = sendNotification({ userId, type, data });
    if (result) sent++;
  }
  return sent;
}

// ─── Read / Mark ─────────────────────────────────────────────────────────────

export function markAsRead(userId: string, notificationId: string): void {
  const list = notifications.get(userId);
  if (!list) return;
  const notif = list.find(n => n.id === notificationId);
  if (notif && !notif.isRead) {
    notif.isRead = true;
    notif.isSeen = true;
    notif.readAt = Date.now();
  }
}

export function markAllAsRead(userId: string): number {
  const list = notifications.get(userId);
  if (!list) return 0;
  let count = 0;
  const now = Date.now();
  for (const notif of list) {
    if (!notif.isRead) {
      notif.isRead = true;
      notif.isSeen = true;
      notif.readAt = now;
      count++;
    }
  }
  return count;
}

export function markAsSeen(userId: string, notificationIds: string[]): void {
  const list = notifications.get(userId);
  if (!list) return;
  const idSet = new Set(notificationIds);
  for (const notif of list) {
    if (idSet.has(notif.id)) notif.isSeen = true;
  }
}

// ─── Query ───────────────────────────────────────────────────────────────────

export interface NotificationQuery {
  type?: NotificationType;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}

export function getNotifications(userId: string, query: NotificationQuery = {}): { notifications: Notification[]; total: number; unreadCount: number } {
  const now = Date.now();
  let list = (notifications.get(userId) ?? []).filter(n => !n.expiresAt || n.expiresAt > now);

  if (query.type !== undefined) list = list.filter(n => n.type === query.type);
  if (query.channel !== undefined) list = list.filter(n => n.channel === query.channel);
  if (query.priority !== undefined) list = list.filter(n => n.priority === query.priority);
  if (query.isRead !== undefined) list = list.filter(n => n.isRead === query.isRead);

  const total = list.length;
  const unreadCount = list.filter(n => !n.isRead).length;

  list.sort((a, b) => b.createdAt - a.createdAt);

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  list = list.slice(offset, offset + limit);

  return { notifications: list.map(n => ({ ...n })), total, unreadCount };
}

export function getUnreadCount(userId: string): number {
  const now = Date.now();
  return (notifications.get(userId) ?? [])
    .filter(n => !n.isRead && (!n.expiresAt || n.expiresAt > now))
    .length;
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export function deleteNotification(userId: string, notificationId: string): void {
  const list = notifications.get(userId);
  if (!list) return;
  const idx = list.findIndex(n => n.id === notificationId);
  if (idx !== -1) list.splice(idx, 1);
}

export function clearNotifications(userId: string, olderThanMs?: number): number {
  const list = notifications.get(userId);
  if (!list) return 0;
  if (!olderThanMs) {
    const count = list.length;
    list.length = 0;
    return count;
  }
  const cutoff = Date.now() - olderThanMs;
  const before = list.length;
  const filtered = list.filter(n => n.createdAt >= cutoff);
  list.length = 0;
  list.push(...filtered);
  return before - list.length;
}

// ─── Scheduled Notifications ─────────────────────────────────────────────────

export function scheduleNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, unknown>,
  scheduledFor: number,
  priority?: NotificationPriority,
): string {
  const id = genId();
  scheduledNotifications.push({
    id,
    userId,
    notification: {
      userId,
      type,
      title: '',
      body: '',
      data,
      channel: NotificationChannel.InApp,
      priority: priority ?? NotificationPriority.Normal,
      isSeen: false,
      groupKey: null,
      expiresAt: null,
    },
    scheduledFor,
    sent: false,
  });
  return id;
}

export function processScheduledNotifications(): number {
  const now = Date.now();
  let sent = 0;
  for (const scheduled of scheduledNotifications) {
    if (scheduled.sent || scheduled.scheduledFor > now) continue;
    sendNotification({
      userId: scheduled.userId,
      type: scheduled.notification.type,
      data: scheduled.notification.data,
      overridePriority: scheduled.notification.priority,
    });
    scheduled.sent = true;
    sent++;
  }
  return sent;
}

export function cancelScheduledNotification(id: string): boolean {
  const idx = scheduledNotifications.findIndex(s => s.id === id);
  if (idx === -1) return false;
  scheduledNotifications.splice(idx, 1);
  return true;
}

// ─── Notification History Summary ────────────────────────────────────────────

export interface NotificationSummary {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  last24h: number;
  last7d: number;
}

export function getNotificationSummary(userId: string): NotificationSummary {
  const now = Date.now();
  const list = (notifications.get(userId) ?? []).filter(n => !n.expiresAt || n.expiresAt > now);

  const byType: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  let last24h = 0;
  let last7d = 0;

  for (const n of list) {
    byType[n.type] = (byType[n.type] ?? 0) + 1;
    byPriority[n.priority] = (byPriority[n.priority] ?? 0) + 1;
    if (n.createdAt > now - 86_400_000) last24h++;
    if (n.createdAt > now - 604_800_000) last7d++;
  }

  return {
    total: list.length,
    unread: list.filter(n => !n.isRead).length,
    byType,
    byPriority,
    last24h,
    last7d,
  };
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export function clearNotificationStore(): void {
  notifications.clear();
  preferences.clear();
  scheduledNotifications.length = 0;
  notifCounter = 0;
}
