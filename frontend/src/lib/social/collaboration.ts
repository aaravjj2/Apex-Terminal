import type {
  Workspace,
  WorkspaceMember,
  WorkspaceSettings,
  SharedLayout,
  SharedAnnotation,
  CursorPresence,
  ActivityEvent,
  VersionEntry,
  Channel,
  Message,
} from './types';
import { UserRole, ChannelType, MessageType } from './types';

// ─── ID Generation ───────────────────────────────────────────────────────────

let collabCounter = 0;
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++collabCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Stores ──────────────────────────────────────────────────────────────────

const workspaces = new Map<string, Workspace>();
const layouts = new Map<string, SharedLayout[]>();
const annotations = new Map<string, SharedAnnotation[]>();
const presenceMap = new Map<string, Map<string, CursorPresence>>();
const activityFeeds = new Map<string, ActivityEvent[]>();
const versionHistory = new Map<string, VersionEntry[]>();
const channels = new Map<string, Channel>();
const messages = new Map<string, Message[]>();
const screenSessions = new Map<string, ScreenShareSession>();

const PRESENCE_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

interface ScreenShareSession {
  id: string;
  workspaceId: string;
  hostUserId: string;
  participantIds: string[];
  startedAt: number;
  isActive: boolean;
}

// ─── CRDT Utilities ──────────────────────────────────────────────────────────

interface CRDTOperation {
  id: string;
  timestamp: number;
  authorId: string;
  type: 'insert' | 'delete' | 'update';
  path: string;
  value: unknown;
  vectorClock: Record<string, number>;
}

const operationLogs = new Map<string, CRDTOperation[]>();

function mergeVectorClocks(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const merged: Record<string, number> = { ...a };
  for (const [key, val] of Object.entries(b)) {
    merged[key] = Math.max(merged[key] ?? 0, val);
  }
  return merged;
}

function isConflict(opA: CRDTOperation, opB: CRDTOperation): boolean {
  if (opA.path !== opB.path) return false;
  const aBeforeB = Object.entries(opA.vectorClock).every(
    ([k, v]) => v <= (opB.vectorClock[k] ?? 0),
  );
  const bBeforeA = Object.entries(opB.vectorClock).every(
    ([k, v]) => v <= (opA.vectorClock[k] ?? 0),
  );
  return !aBeforeB && !bBeforeA;
}

function resolveConflict(opA: CRDTOperation, opB: CRDTOperation): CRDTOperation {
  if (opA.timestamp !== opB.timestamp) {
    return opA.timestamp > opB.timestamp ? opA : opB;
  }
  return opA.id > opB.id ? opA : opB;
}

export function applyOperation(workspaceId: string, op: CRDTOperation): { applied: boolean; resolved?: CRDTOperation } {
  let log = operationLogs.get(workspaceId);
  if (!log) {
    log = [];
    operationLogs.set(workspaceId, log);
  }

  const conflicts = log.filter(existing => isConflict(existing, op));
  if (conflicts.length > 0) {
    const winner = conflicts.reduce((best, c) => resolveConflict(best, c), op);
    log.push(winner);
    return { applied: winner.id === op.id, resolved: winner };
  }

  log.push(op);
  return { applied: true };
}

// ─── Workspace Management ────────────────────────────────────────────────────

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  ownerId: string;
  isPublic?: boolean;
  settings?: Partial<WorkspaceSettings>;
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  allowPublicViewing: false,
  requireApproval: true,
  maxMembers: 50,
  allowFileSharing: true,
  allowScreenSharing: true,
  retentionDays: 90,
};

export function createWorkspace(input: CreateWorkspaceInput): Workspace {
  const now = Date.now();
  const ws: Workspace = {
    id: genId('ws'),
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    ownerId: input.ownerId,
    members: [{
      userId: input.ownerId,
      role: UserRole.Owner,
      joinedAt: now,
      lastActiveAt: now,
      permissions: ['read', 'write', 'admin', 'invite', 'delete'],
    }],
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SETTINGS, ...input.settings },
    isPublic: input.isPublic ?? false,
  };

  workspaces.set(ws.id, ws);
  activityFeeds.set(ws.id, []);
  logActivity(ws.id, input.ownerId, 'workspace_created', ws.name);
  return { ...ws };
}

export function getWorkspace(workspaceId: string): Workspace | null {
  const ws = workspaces.get(workspaceId);
  return ws ? { ...ws, members: ws.members.map(m => ({ ...m })) } : null;
}

export function updateWorkspace(
  workspaceId: string,
  userId: string,
  updates: Partial<Pick<Workspace, 'name' | 'description' | 'isPublic' | 'settings'>>,
): Workspace {
  const ws = workspaces.get(workspaceId);
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
  assertPermission(ws, userId, 'admin');

  if (updates.name !== undefined) ws.name = updates.name.trim();
  if (updates.description !== undefined) ws.description = updates.description.trim();
  if (updates.isPublic !== undefined) ws.isPublic = updates.isPublic;
  if (updates.settings) ws.settings = { ...ws.settings, ...updates.settings };
  ws.updatedAt = Date.now();

  logActivity(workspaceId, userId, 'workspace_updated', ws.name);
  return { ...ws };
}

export function deleteWorkspace(workspaceId: string, userId: string): void {
  const ws = workspaces.get(workspaceId);
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
  if (ws.ownerId !== userId) throw new Error('Only the owner can delete the workspace');

  workspaces.delete(workspaceId);
  layouts.delete(workspaceId);
  annotations.delete(workspaceId);
  presenceMap.delete(workspaceId);
  activityFeeds.delete(workspaceId);
  versionHistory.delete(workspaceId);
  operationLogs.delete(workspaceId);
}

// ─── Member Management ───────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.Viewer]: ['read'],
  [UserRole.Editor]: ['read', 'write'],
  [UserRole.Moderator]: ['read', 'write', 'moderate'],
  [UserRole.Admin]: ['read', 'write', 'moderate', 'admin', 'invite'],
  [UserRole.Owner]: ['read', 'write', 'moderate', 'admin', 'invite', 'delete'],
};

export function addMember(workspaceId: string, inviterId: string, userId: string, role: UserRole = UserRole.Viewer): WorkspaceMember {
  const ws = workspaces.get(workspaceId);
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
  assertPermission(ws, inviterId, 'invite');

  if (ws.members.some(m => m.userId === userId)) {
    throw new Error('User is already a member');
  }
  if (ws.members.length >= ws.settings.maxMembers) {
    throw new Error('Workspace has reached maximum members');
  }

  const now = Date.now();
  const member: WorkspaceMember = {
    userId,
    role,
    joinedAt: now,
    lastActiveAt: now,
    permissions: ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS[UserRole.Viewer],
  };

  ws.members.push(member);
  ws.updatedAt = now;
  logActivity(workspaceId, inviterId, 'member_added', userId);
  return { ...member };
}

export function removeMember(workspaceId: string, removerId: string, userId: string): void {
  const ws = workspaces.get(workspaceId);
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
  if (userId === ws.ownerId) throw new Error('Cannot remove the workspace owner');
  assertPermission(ws, removerId, 'admin');

  ws.members = ws.members.filter(m => m.userId !== userId);
  ws.updatedAt = Date.now();
  logActivity(workspaceId, removerId, 'member_removed', userId);
}

export function updateMemberRole(workspaceId: string, adminId: string, userId: string, newRole: UserRole): WorkspaceMember {
  const ws = workspaces.get(workspaceId);
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
  assertPermission(ws, adminId, 'admin');
  if (userId === ws.ownerId) throw new Error('Cannot change owner role');

  const member = ws.members.find(m => m.userId === userId);
  if (!member) throw new Error('User is not a member');

  member.role = newRole;
  member.permissions = ROLE_PERMISSIONS[newRole] ?? ROLE_PERMISSIONS[UserRole.Viewer];
  ws.updatedAt = Date.now();
  logActivity(workspaceId, adminId, 'role_changed', `${userId}:${newRole}`);
  return { ...member };
}

function assertPermission(ws: Workspace, userId: string, permission: string): void {
  const member = ws.members.find(m => m.userId === userId);
  if (!member) throw new Error('User is not a member of this workspace');
  if (!member.permissions.includes(permission)) {
    throw new Error(`User lacks the '${permission}' permission`);
  }
}

// ─── Presence ────────────────────────────────────────────────────────────────

export function updatePresence(workspaceId: string, userId: string, x: number, y: number, label: string): CursorPresence {
  let wsPresence = presenceMap.get(workspaceId);
  if (!wsPresence) {
    wsPresence = new Map();
    presenceMap.set(workspaceId, wsPresence);
  }

  const existing = wsPresence.get(userId);
  const colorIdx = Array.from(wsPresence.keys()).indexOf(userId);
  const color = existing?.color ?? PRESENCE_COLORS[(colorIdx >= 0 ? colorIdx : wsPresence.size) % PRESENCE_COLORS.length];

  const presence: CursorPresence = { userId, x, y, color, label, timestamp: Date.now() };
  wsPresence.set(userId, presence);
  return presence;
}

export function removePresence(workspaceId: string, userId: string): void {
  presenceMap.get(workspaceId)?.delete(userId);
}

export function getActivePresences(workspaceId: string, staleMs = 30_000): CursorPresence[] {
  const wsPresence = presenceMap.get(workspaceId);
  if (!wsPresence) return [];
  const cutoff = Date.now() - staleMs;
  const result: CursorPresence[] = [];
  for (const [uid, p] of wsPresence) {
    if (p.timestamp >= cutoff) result.push({ ...p });
    else wsPresence.delete(uid);
  }
  return result;
}

// ─── Shared Annotations ─────────────────────────────────────────────────────

export function addAnnotation(workspaceId: string, authorId: string, chartId: string, type: string, data: Record<string, unknown>, color = '#3b82f6'): SharedAnnotation {
  const ws = workspaces.get(workspaceId);
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
  assertPermission(ws, authorId, 'write');

  const annotation: SharedAnnotation = {
    id: genId('ann'),
    workspaceId,
    authorId,
    chartId,
    type,
    data,
    color,
    createdAt: Date.now(),
  };

  let list = annotations.get(workspaceId);
  if (!list) { list = []; annotations.set(workspaceId, list); }
  list.push(annotation);
  logActivity(workspaceId, authorId, 'annotation_added', chartId);
  return { ...annotation };
}

export function getAnnotations(workspaceId: string, chartId?: string): SharedAnnotation[] {
  const list = annotations.get(workspaceId) ?? [];
  const filtered = chartId ? list.filter(a => a.chartId === chartId) : list;
  return filtered.map(a => ({ ...a }));
}

export function removeAnnotation(workspaceId: string, annotationId: string, userId: string): void {
  const list = annotations.get(workspaceId);
  if (!list) return;
  const idx = list.findIndex(a => a.id === annotationId);
  if (idx === -1) return;
  const ann = list[idx];
  const ws = workspaces.get(workspaceId);
  if (ws && ann.authorId !== userId) assertPermission(ws, userId, 'moderate');
  list.splice(idx, 1);
}

// ─── Shared Layouts ──────────────────────────────────────────────────────────

export function saveLayout(workspaceId: string, userId: string, name: string, layout: Record<string, unknown>): SharedLayout {
  const ws = workspaces.get(workspaceId);
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
  assertPermission(ws, userId, 'write');

  let list = layouts.get(workspaceId);
  if (!list) { list = []; layouts.set(workspaceId, list); }

  const existing = list.find(l => l.name === name);
  const now = Date.now();

  if (existing) {
    recordVersion(workspaceId, existing.id, userId, { layout: existing.layout });
    existing.layout = layout;
    existing.version++;
    existing.updatedAt = now;
    logActivity(workspaceId, userId, 'layout_updated', name);
    return { ...existing };
  }

  const sl: SharedLayout = {
    id: genId('layout'),
    workspaceId,
    name,
    layout,
    createdBy: userId,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  list.push(sl);
  logActivity(workspaceId, userId, 'layout_created', name);
  return { ...sl };
}

export function getLayouts(workspaceId: string): SharedLayout[] {
  return (layouts.get(workspaceId) ?? []).map(l => ({ ...l }));
}

// ─── Shared Watchlists ──────────────────────────────────────────────────────

interface SharedWatchlist {
  id: string;
  workspaceId: string;
  name: string;
  symbols: string[];
  createdBy: string;
  updatedAt: number;
}

const sharedWatchlists = new Map<string, SharedWatchlist[]>();

export function createSharedWatchlist(workspaceId: string, userId: string, name: string, symbols: string[]): SharedWatchlist {
  const ws = workspaces.get(workspaceId);
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
  assertPermission(ws, userId, 'write');

  const wl: SharedWatchlist = {
    id: genId('wl'),
    workspaceId,
    name,
    symbols: symbols.map(s => s.toUpperCase()),
    createdBy: userId,
    updatedAt: Date.now(),
  };

  let list = sharedWatchlists.get(workspaceId);
  if (!list) { list = []; sharedWatchlists.set(workspaceId, list); }
  list.push(wl);
  logActivity(workspaceId, userId, 'watchlist_created', name);
  return { ...wl };
}

export function updateSharedWatchlist(workspaceId: string, watchlistId: string, userId: string, symbols: string[]): SharedWatchlist {
  const ws = workspaces.get(workspaceId);
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
  assertPermission(ws, userId, 'write');

  const list = sharedWatchlists.get(workspaceId) ?? [];
  const wl = list.find(w => w.id === watchlistId);
  if (!wl) throw new Error('Watchlist not found');

  wl.symbols = symbols.map(s => s.toUpperCase());
  wl.updatedAt = Date.now();
  logActivity(workspaceId, userId, 'watchlist_updated', wl.name);
  return { ...wl };
}

export function getSharedWatchlists(workspaceId: string): SharedWatchlist[] {
  return (sharedWatchlists.get(workspaceId) ?? []).map(w => ({ ...w }));
}

// ─── Chat / Messaging ───────────────────────────────────────────────────────

export function createChannel(workspaceId: string, userId: string, name: string, type: ChannelType = ChannelType.Group, memberIds: string[] = []): Channel {
  const ch: Channel = {
    id: genId('ch'),
    type,
    name,
    description: '',
    members: [userId, ...memberIds.filter(id => id !== userId)],
    createdBy: userId,
    createdAt: Date.now(),
    lastMessageAt: 0,
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
  };
  channels.set(ch.id, ch);
  messages.set(ch.id, []);
  logActivity(workspaceId, userId, 'channel_created', name);
  return { ...ch };
}

export function sendMessage(channelId: string, senderId: string, content: string, type: MessageType = MessageType.Text, replyTo?: string): Message {
  const ch = channels.get(channelId);
  if (!ch) throw new Error(`Channel not found: ${channelId}`);
  if (!ch.members.includes(senderId)) throw new Error('User is not a member of this channel');

  const msg: Message = {
    id: genId('msg'),
    channelId,
    senderId,
    type,
    content,
    attachments: [],
    replyTo: replyTo ?? null,
    reactions: {},
    isEdited: false,
    createdAt: Date.now(),
    readBy: [senderId],
  };

  let list = messages.get(channelId);
  if (!list) { list = []; messages.set(channelId, list); }
  list.push(msg);
  ch.lastMessageAt = msg.createdAt;
  return { ...msg };
}

export function getMessages(channelId: string, limit = 50, before?: number): Message[] {
  const list = messages.get(channelId) ?? [];
  let filtered = before ? list.filter(m => m.createdAt < before) : list;
  return filtered.slice(-limit).map(m => ({ ...m }));
}

export function markMessageRead(channelId: string, messageId: string, userId: string): void {
  const list = messages.get(channelId);
  if (!list) return;
  const msg = list.find(m => m.id === messageId);
  if (msg && !msg.readBy.includes(userId)) msg.readBy.push(userId);
}

export function addReaction(channelId: string, messageId: string, userId: string, emoji: string): void {
  const list = messages.get(channelId);
  if (!list) return;
  const msg = list.find(m => m.id === messageId);
  if (!msg) return;
  if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
  if (!msg.reactions[emoji].includes(userId)) msg.reactions[emoji].push(userId);
}

// ─── File Sharing ────────────────────────────────────────────────────────────

interface SharedFile {
  id: string;
  workspaceId: string;
  uploaderId: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
}

const sharedFiles = new Map<string, SharedFile[]>();

export function shareFile(workspaceId: string, userId: string, name: string, url: string, size: number, mimeType: string): SharedFile {
  const ws = workspaces.get(workspaceId);
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
  if (!ws.settings.allowFileSharing) throw new Error('File sharing is disabled');
  assertPermission(ws, userId, 'write');

  const file: SharedFile = {
    id: genId('file'),
    workspaceId,
    uploaderId: userId,
    name,
    url,
    size,
    mimeType,
    uploadedAt: Date.now(),
  };

  let list = sharedFiles.get(workspaceId);
  if (!list) { list = []; sharedFiles.set(workspaceId, list); }
  list.push(file);
  logActivity(workspaceId, userId, 'file_shared', name);
  return { ...file };
}

export function getSharedFiles(workspaceId: string): SharedFile[] {
  return (sharedFiles.get(workspaceId) ?? []).map(f => ({ ...f }));
}

// ─── Screen Sharing ──────────────────────────────────────────────────────────

export function startScreenShare(workspaceId: string, hostUserId: string): ScreenShareSession {
  const ws = workspaces.get(workspaceId);
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);
  if (!ws.settings.allowScreenSharing) throw new Error('Screen sharing is disabled');
  assertPermission(ws, hostUserId, 'write');

  const session: ScreenShareSession = {
    id: genId('screen'),
    workspaceId,
    hostUserId,
    participantIds: [hostUserId],
    startedAt: Date.now(),
    isActive: true,
  };
  screenSessions.set(session.id, session);
  logActivity(workspaceId, hostUserId, 'screen_share_started', session.id);
  return { ...session };
}

export function joinScreenShare(sessionId: string, userId: string): ScreenShareSession {
  const session = screenSessions.get(sessionId);
  if (!session) throw new Error('Screen share session not found');
  if (!session.isActive) throw new Error('Session has ended');
  if (!session.participantIds.includes(userId)) {
    session.participantIds.push(userId);
  }
  return { ...session };
}

export function endScreenShare(sessionId: string, userId: string): void {
  const session = screenSessions.get(sessionId);
  if (!session) return;
  if (session.hostUserId !== userId) throw new Error('Only the host can end the session');
  session.isActive = false;
  logActivity(session.workspaceId, userId, 'screen_share_ended', sessionId);
}

// ─── Activity Feed ───────────────────────────────────────────────────────────

function logActivity(workspaceId: string, userId: string, action: string, target: string, metadata: Record<string, unknown> = {}): void {
  const event: ActivityEvent = {
    id: genId('evt'),
    workspaceId,
    userId,
    action,
    target,
    metadata,
    timestamp: Date.now(),
  };
  let feed = activityFeeds.get(workspaceId);
  if (!feed) { feed = []; activityFeeds.set(workspaceId, feed); }
  feed.push(event);

  if (feed.length > 1000) feed.splice(0, feed.length - 1000);
}

export function getActivityFeed(workspaceId: string, limit = 50, before?: number): ActivityEvent[] {
  const feed = activityFeeds.get(workspaceId) ?? [];
  let filtered = before ? feed.filter(e => e.timestamp < before) : feed;
  return filtered.slice(-limit).reverse().map(e => ({ ...e }));
}

// ─── Version History ─────────────────────────────────────────────────────────

function recordVersion(workspaceId: string, resourceId: string, authorId: string, changes: Record<string, unknown>): VersionEntry {
  let history = versionHistory.get(workspaceId);
  if (!history) { history = []; versionHistory.set(workspaceId, history); }

  const lastVersion = history
    .filter(v => v.resourceId === resourceId)
    .reduce((max, v) => Math.max(max, v.version), 0);

  const entry: VersionEntry = {
    id: genId('ver'),
    resourceId,
    version: lastVersion + 1,
    authorId,
    changes,
    timestamp: Date.now(),
  };
  history.push(entry);
  return entry;
}

export function getVersionHistory(workspaceId: string, resourceId: string): VersionEntry[] {
  return (versionHistory.get(workspaceId) ?? [])
    .filter(v => v.resourceId === resourceId)
    .sort((a, b) => b.version - a.version)
    .map(v => ({ ...v }));
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export function clearCollaborationStore(): void {
  workspaces.clear();
  layouts.clear();
  annotations.clear();
  presenceMap.clear();
  activityFeeds.clear();
  versionHistory.clear();
  channels.clear();
  messages.clear();
  screenSessions.clear();
  sharedFiles.clear();
  sharedWatchlists.clear();
  operationLogs.clear();
  collabCounter = 0;
}
