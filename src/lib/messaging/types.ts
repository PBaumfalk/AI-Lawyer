/**
 * TypeScript types for the messaging system (Phase 31).
 *
 * Contains Socket.IO payload shapes for real-time events
 * and DTOs for API responses.
 */

/** Socket.IO payload: new message broadcast to channel room */
export interface MessageNewPayload {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  body: string;
  mentions: string[] | null;
  attachments: unknown[] | null;
  parentId: string | null;
  createdAt: string; // ISO timestamp
  isSystem?: boolean;
}

/** Socket.IO payload: message edited */
export interface MessageEditedPayload {
  id: string;
  channelId: string;
  body: string;
  editedAt: string; // ISO timestamp
}

/** Socket.IO payload: message soft-deleted */
export interface MessageDeletedPayload {
  id: string;
  channelId: string;
}

/** Socket.IO payload: typing indicator */
export interface TypingPayload {
  channelId: string;
  userId: string;
  userName: string;
}

/** DTO for channel list items (includes unread count) */
export interface ChannelListItem {
  id: string;
  name: string;
  slug: string;
  beschreibung: string | null;
  typ: "ALLGEMEIN" | "AKTE" | "PORTAL";
  akteId: string | null;
  archived: boolean;
  memberCount: number;
  unreadCount: number;
  lastMessageAt: string | null; // ISO timestamp
  mandantUserId: string | null;
  mandantUserName: string | null;
}

/** DTO for message list items */
export interface MessageListItem {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  isSystem: boolean;
  body: string;
  attachments: unknown[] | null;
  mentions: string[] | null;
  parentId: string | null;
  parent?: { id: string; authorName: string; body: string } | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  reactions: { emoji: string; count: number; userIds: string[] }[];
}
