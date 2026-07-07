export type Network = "facebook" | "instagram";

export type InboxSource =
  | "messenger"
  | "instagram_dm"
  | "post_comment"
  | "ad_comment";

export type InboxStatus = "new" | "open" | "responded" | "archived";
export type IngestSource =
  | "webhook"
  | "polling_fast"
  | "polling_full"
  | "ads_manual"
  | "unknown";

export type Sentiment = "hot" | "neutral" | "support";

export type InboxItem = {
  id: string;
  accountId: string;
  network: Network;
  source: InboxSource;
  status: InboxStatus;
  sentiment: Sentiment;
  accountName: string;
  contactName: string;
  contactHandle: string;
  avatarInitials: string;
  title: string;
  preview: string;
  receivedAt: string;
  assignee: string;
  campaign?: string;
  postTitle?: string;
  providerPostId?: string;
  providerCommentId?: string;
  ingestSource?: IngestSource;
  originalUrl?: string;
  unreadCount: number;
  liked: boolean;
  hidden: boolean;
  blocked: boolean;
  messages: InboxMessage[];
};

export type InboxMessage = {
  id: string;
  author: "contact" | "agent";
  body: string;
  sentAt: string;
  providerMessageId?: string;
};

export type QuickReply = {
  id: string;
  title: string;
  category: string;
  body: string;
  tags: string[];
};

export type ReplyMode = "public_comment" | "private_message";

export type ChannelConnection = {
  id: string;
  network: Network;
  name: string;
  handle: string;
  status: "connected" | "needs_review" | "demo";
  scopes: string[];
  lastSync: string;
};

export type InboxAction =
  | "reply"
  | "like"
  | "unlike"
  | "hide"
  | "unhide"
  | "block"
  | "unblock"
  | "archive"
  | "unarchive"
  | "mark_read"
  | "mark_unread"
  | "delete_message";
