"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Archive,
  AtSign,
  Ban,
  Camera,
  ChevronDown,
  ChevronLeft,
  Eye,
  EyeOff,
  ExternalLink,
  Heart,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  MessageCircle,
  MessagesSquare,
  Search,
  Send,
  Settings,
  Sparkles,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { channels, inboxItems, quickReplies } from "@/lib/demo-data";
import { createBrowserSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";
import type {
  ChannelConnection,
  IngestSource,
  InboxAction,
  InboxItem,
  InboxSource,
  Network,
  QuickReply,
  ReplyMode,
} from "@/lib/types";
import type { User } from "@supabase/supabase-js";

const sourceLabels: Record<InboxSource, string> = {
  messenger: "Messenger",
  instagram_dm: "Instagram DM",
  post_comment: "Comentario organico",
  ad_comment: "Comentario ad",
};

const sourceColors: Record<InboxSource, string> = {
  messenger: "bg-sky-50 text-sky-700 ring-sky-200",
  instagram_dm: "bg-pink-50 text-pink-700 ring-pink-200",
  post_comment: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ad_comment: "bg-amber-50 text-amber-800 ring-amber-200",
};

const ingestSourceLabels: Record<IngestSource, string> = {
  webhook: "Webhook",
  polling_fast: "Polling rapido",
  polling_full: "Sync manual",
  ads_auto: "Ads auto",
  ads_manual: "Ads manual",
  unknown: "Origen pendiente",
};

const ingestSourceColors: Record<IngestSource, string> = {
  webhook: "bg-violet-50 text-violet-700 ring-violet-200",
  polling_fast: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  polling_full: "bg-slate-100 text-slate-700 ring-slate-200",
  ads_auto: "bg-orange-50 text-orange-800 ring-orange-200",
  ads_manual: "bg-amber-50 text-amber-800 ring-amber-200",
  unknown: "bg-slate-50 text-slate-500 ring-slate-200",
};

const networkIcon = {
  facebook: MessagesSquare,
  instagram: Camera,
};

const networkMeta: Record<
  Network,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
  }
> = {
  facebook: {
    label: "Facebook",
    shortLabel: "FB",
    badgeClass: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  instagram: {
    label: "Instagram",
    shortLabel: "IG",
    badgeClass: "bg-pink-50 text-pink-700 ring-pink-200",
  },
};

const metaRequiredScopes = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "ads_read",
  "pages_manage_engagement",
  "pages_messaging",
  "pages_manage_metadata",
  "business_management",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_engagement",
  "instagram_manage_messages",
];

const facebookCommentSyncIntervalMs = 5000;
const metaAdCommentSyncIntervalMs = 30000;
const instagramCommentSyncIntervalMs = 10000;

const metaCapabilityChecks = [
  {
    label: "Leer posts/comentarios Facebook",
    scopes: ["pages_read_engagement", "pages_read_user_content"],
  },
  {
    label: "Responder/moderar Facebook",
    scopes: ["pages_manage_engagement"],
  },
  {
    label: "Comentarios Ads",
    scopes: ["ads_read", "pages_read_engagement"],
  },
  {
    label: "Paginas Business Manager",
    scopes: ["business_management"],
  },
  {
    label: "Messenger",
    scopes: ["pages_messaging"],
  },
  {
    label: "Instagram comentarios",
    scopes: ["instagram_basic", "instagram_manage_comments"],
  },
  {
    label: "Instagram reacciones",
    scopes: ["instagram_basic", "instagram_manage_engagement"],
  },
  {
    label: "Instagram DM",
    scopes: ["instagram_basic", "instagram_manage_messages"],
  },
];

const visibleAccountsStorageKey = "social-inbox.visible-account-ids";
const quickRepliesStorageKey = "social-inbox.quick-replies";

type QuickReplyDraft = {
  title: string;
  category: string;
  body: string;
  tagsText: string;
};

type ConnectedAccountRow = {
  id: string;
  network: Network;
  provider_account_id: string;
  name: string;
  handle: string | null;
  access_token_encrypted: string | null;
  scopes: string[] | null;
  updated_at: string | null;
};

type ContactRow = {
  display_name: string;
  handle: string | null;
  is_blocked: boolean | null;
};

type InboxMessageRow = {
  id: string;
  provider_message_id: string | null;
  author_type: "contact" | "agent";
  body: string;
  sent_at: string;
};

type InboxItemRow = {
  id: string;
  account_id: string;
  source: InboxSource;
  status: InboxItem["status"];
  ingest_source: IngestSource | null;
  provider_comment_id: string | null;
  provider_post_id: string | null;
  title: string;
  preview: string;
  is_liked: boolean;
  is_hidden: boolean;
  unread_count: number;
  received_at: string;
  connected_accounts: ConnectedAccountRow | ConnectedAccountRow[] | null;
  contacts: ContactRow | ContactRow[] | null;
  inbox_messages: InboxMessageRow[] | null;
};

type SupabaseInboxData = {
  channels: ChannelConnection[];
  items: InboxItem[];
};

type InboxView = "active" | "responded" | "archived";
type BulkInboxAction = "mark_read" | "mark_unread" | "archive" | "unarchive";
type ReactionKind = "like";
type MobileInboxPanel = "list" | "detail";
type RunActionOptions = {
  replyMode?: ReplyMode;
  recipientExternalId?: string;
  messageId?: string;
};

type BlockedAuthor = {
  key: string;
  item: InboxItem;
};

type MetaWebhookDiagnostics = {
  app?: {
    pageFeedActive: boolean;
    pageMessagesActive: boolean;
    pageReady: boolean;
    callbackUrl: string | null;
    fields: Array<{ name?: string; version?: string }>;
    error: string | null;
  };
  pages?: Array<{
    pageId: string;
    pageName: string;
    subscribed: boolean;
    fields: string[];
    error: string | null;
  }>;
  latestEvents?: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    processedAt: string | null;
    entryIds: string[];
    changes: Array<{ field?: string; item?: string }>;
    messaging?: Array<{ senderId?: string; messageId?: string }>;
  }>;
  latestEventsError?: string | null;
};

type MetaAdsDiagnostics = {
  ready: boolean;
  reason: string | null;
  message: string;
  scopes: string[];
  updatedAt?: string | null;
  adAccounts: Array<{
    id: string;
    accountId: string | null;
    name: string;
    status: number | null;
    currency: string | null;
    business: string | null;
  }>;
};

const emptyQuickReplyDraft: QuickReplyDraft = {
  title: "",
  category: "General",
  body: "",
  tagsText: "",
};

export default function Home() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [items, setItems] = useState(inboxItems);
  const [channelList, setChannelList] = useState<ChannelConnection[]>(channels);
  const [inboxSource, setInboxSource] = useState<"demo" | "supabase">("demo");
  const [replies, setReplies] = useState<QuickReply[]>(quickReplies);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState(
    hasSupabaseConfig ? "Inicia sesion para guardar en Supabase." : "Modo demo local.",
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [itemReactions, setItemReactions] = useState<Record<string, ReactionKind>>({});
  const [replyModesByItemId, setReplyModesByItemId] = useState<Record<string, ReplyMode>>({});
  const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState<Network | "all">("all");
  const [inboxView, setInboxView] = useState<InboxView>("active");
  const [mobileInboxPanel, setMobileInboxPanel] = useState<MobileInboxPanel>("list");
  const [isMobileAccountsOpen, setIsMobileAccountsOpen] = useState(false);
  const [visibleAccountIds, setVisibleAccountIds] = useState<string[]>(() =>
    channels.map((channel) => channel.id),
  );
  const hasLoadedVisibleAccounts = useRef(false);
  const hasLoadedQuickReplies = useRef(false);
  const hasLoadedRemoteWorkspace = useRef(false);
  const commentSyncInFlight = useRef(false);
  const adCommentSyncInFlight = useRef(false);
  const instagramCommentSyncInFlight = useRef(false);
  const realtimeRefreshTimeout = useRef<number | null>(null);
  const [isQuickReplyPanelOpen, setIsQuickReplyPanelOpen] = useState(false);
  const [isQuickReplyEditorOpen, setIsQuickReplyEditorOpen] = useState(false);
  const [openOriginalPostMenuItemId, setOpenOriginalPostMenuItemId] = useState<string | null>(null);
  const [editingQuickReplyId, setEditingQuickReplyId] = useState<string | null>(null);
  const [quickReplyDraft, setQuickReplyDraft] =
    useState<QuickReplyDraft>(emptyQuickReplyDraft);
  const [composer, setComposer] = useState("");
  const [notice, setNotice] = useState("Listo para conectar Meta cuando tengas permisos.");
  const [metaWebhookDiagnostics, setMetaWebhookDiagnostics] =
    useState<MetaWebhookDiagnostics | null>(null);
  const [metaAdsDiagnostics, setMetaAdsDiagnostics] =
    useState<MetaAdsDiagnostics | null>(null);
  const [isMetaWebhookDiagnosticsLoading, setIsMetaWebhookDiagnosticsLoading] = useState(false);
  const [isMetaWebhookSubscribeLoading, setIsMetaWebhookSubscribeLoading] = useState(false);
  const [isMetaAdsDiagnosticsLoading, setIsMetaAdsDiagnosticsLoading] = useState(false);
  const [isMetaAdCommentsSyncing, setIsMetaAdCommentsSyncing] = useState(false);
  const [appOrigin] = useState(() =>
    typeof window === "undefined" ? "http://localhost:3100" : window.location.origin,
  );
  const [isMetaSettingsOpen, setIsMetaSettingsOpen] = useState(() =>
    typeof window === "undefined"
      ? false
      : new URLSearchParams(window.location.search).has("meta_oauth"),
  );
  const [openAccountMenuId, setOpenAccountMenuId] = useState<string | null>(null);
  const [metaConnectionMessage, setMetaConnectionMessage] = useState(() => {
    if (typeof window === "undefined") {
      return "Configura la app Meta y usa OAuth cuando tengas credenciales.";
    }

    const params = new URLSearchParams(window.location.search);
    return resolveMetaOAuthMessage(params.get("meta_oauth"), params);
  });

  const visibleAccountSet = useMemo(() => new Set(visibleAccountIds), [visibleAccountIds]);
  const hiddenAccountCount = channelList.length - visibleAccountIds.length;
  const inboxUnreadCount = items.filter(
    (item) => item.status !== "archived" && item.status !== "responded" && item.unreadCount > 0,
  ).length;
  const realMetaChannels = channelList.filter((channel) => channel.status === "connected");
  const reviewMetaChannels = channelList.filter((channel) => channel.status === "needs_review");
  const demoMetaChannels = channelList.filter((channel) => channel.status === "demo");
  const grantedMetaScopes = useMemo(
    () => [...new Set(realMetaChannels.flatMap((channel) => channel.scopes))],
    [realMetaChannels],
  );
  const canAutoSyncFacebookComments = realMetaChannels.some(
    (channel) =>
      channel.network === "facebook" &&
      channel.scopes.includes("pages_read_engagement") &&
      channel.scopes.includes("pages_read_user_content"),
  );
  const canAutoSyncMetaAdComments =
    grantedMetaScopes.includes("ads_read") &&
    grantedMetaScopes.includes("pages_read_engagement") &&
    realMetaChannels.some((channel) => channel.network === "facebook");
  const canAutoSyncInstagramComments =
    grantedMetaScopes.includes("instagram_basic") &&
    grantedMetaScopes.includes("instagram_manage_comments") &&
    realMetaChannels.some((channel) => channel.network === "instagram");
  const workspaceBootstrap = useRef<{
    userId: string;
    promise: Promise<string | null>;
  } | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesAccount = visibleAccountSet.has(item.accountId);
      const matchesNetwork = network === "all" || item.network === network;
      const matchesView = matchesInboxView(item, inboxView);
      const text = `${item.contactName} ${item.contactHandle} ${item.title} ${item.preview}`;
      const matchesQuery = text.toLowerCase().includes(query.toLowerCase());
      return matchesAccount && matchesNetwork && matchesQuery && matchesView;
    });
  }, [inboxView, items, network, query, visibleAccountSet]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? filteredItems[0];
  const selectedReaction = selectedItem
    ? itemReactions[selectedItem.id] ?? (selectedItem.liked ? "like" : null)
    : null;
  const selectedOriginalPostUrl = selectedItem ? resolveOriginalPostUrl(selectedItem) : null;
  const selectedPostContext = selectedItem ? resolvePostContextText(selectedItem) : "";
  const selectedReplyMode = selectedItem
    ? replyModesByItemId[selectedItem.id] ?? getDefaultReplyMode(selectedItem)
    : "private_message";
  const selectedRecipientExternalId = selectedItem
    ? resolveRecipientExternalId(selectedItem)
    : undefined;
  const shouldShowReplyModeSelector = selectedItem ? isCommentItem(selectedItem) : false;
  const blockedAuthors = useMemo(() => {
    const blockedByAuthor = new Map<string, BlockedAuthor>();

    for (const item of items) {
      if (!item.blocked) {
        continue;
      }

      const key = `${item.accountId}:${item.contactHandle}:${item.contactName}`;
      if (!blockedByAuthor.has(key)) {
        blockedByAuthor.set(key, { key, item });
      }
    }

    return [...blockedByAuthor.values()];
  }, [items]);
  const selectedItemSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const filteredItemIds = useMemo(() => filteredItems.map((item) => item.id), [filteredItems]);
  const selectedVisibleCount = filteredItemIds.filter((id) => selectedItemSet.has(id)).length;
  const allVisibleSelected = filteredItemIds.length > 0 && selectedVisibleCount === filteredItemIds.length;
  const metaCallbackUrl = `${appOrigin}/api/meta/oauth/callback`;

  useEffect(() => {
    const metaOAuthResult = new URLSearchParams(window.location.search).get("meta_oauth");

    if (metaOAuthResult) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (currentUser) return;

    window.setTimeout(() => {
      const stored = window.localStorage.getItem(visibleAccountsStorageKey);
      if (!stored) {
        hasLoadedVisibleAccounts.current = true;
        return;
      }

      try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
          hasLoadedVisibleAccounts.current = true;
          return;
        }

        const validIds = parsed.filter((id) =>
          channelList.some((channel) => channel.id === id),
        );

        setVisibleAccountIds(validIds);
      } catch {
        window.localStorage.removeItem(visibleAccountsStorageKey);
      } finally {
        hasLoadedVisibleAccounts.current = true;
      }
    }, 0);
  }, [channelList, currentUser]);

  useEffect(() => {
    if (currentUser) return;
    if (!hasLoadedVisibleAccounts.current) return;

    window.localStorage.setItem(
      visibleAccountsStorageKey,
      JSON.stringify(visibleAccountIds),
    );
  }, [currentUser, visibleAccountIds]);

  useEffect(() => {
    if (currentUser) return;

    window.setTimeout(() => {
      const stored = window.localStorage.getItem(quickRepliesStorageKey);
      if (!stored) {
        hasLoadedQuickReplies.current = true;
        return;
      }

      try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
          hasLoadedQuickReplies.current = true;
          return;
        }

        const validReplies = parsed.filter(isQuickReply);
        setReplies(validReplies);
      } catch {
        window.localStorage.removeItem(quickRepliesStorageKey);
      } finally {
        hasLoadedQuickReplies.current = true;
      }
    }, 0);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) return;
    if (!hasLoadedQuickReplies.current) return;

    window.localStorage.setItem(quickRepliesStorageKey, JSON.stringify(replies));
  }, [currentUser, replies]);

  async function sendMagicLink() {
    const email = authEmail.trim();
    if (!supabase || !email) {
      setAuthMessage("Ingresa un email para iniciar sesion.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setAuthMessage(
      error
        ? `No se pudo enviar el enlace: ${error.message}`
        : "Revisa tu email para abrir el enlace de acceso.",
    );
  }

  async function signOut() {
    if (!supabase) return;

    await supabase.auth.signOut();
    setCurrentUser(null);
    setActiveWorkspaceId(null);
    hasLoadedRemoteWorkspace.current = false;
    workspaceBootstrap.current = null;
    setItems(inboxItems);
    setChannelList(channels);
    setInboxSource("demo");
    setReplies(quickReplies);
    setVisibleAccountIds(channels.map((channel) => channel.id));
    setAuthMessage("Sesion cerrada. La app vuelve a modo demo local.");
  }

  const ensurePersonalWorkspace = useCallback(async (userId: string) => {
    if (!supabase) return null;

    const existing = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing.data?.id) {
      return existing.data.id as string;
    }

    if (existing.error) {
      setNotice(`No se pudo leer workspace: ${existing.error.message}`);
      return null;
    }

    const created = await supabase
      .from("workspaces")
      .insert({
        name: "Personal",
        owner_user_id: userId,
      })
      .select("id")
      .single();

    if (created.error) {
      setNotice(`No se pudo crear workspace: ${created.error.message}`);
      return null;
    }

    const workspaceId = created.data.id as string;

    await supabase.from("workspace_members").upsert({
      workspace_id: workspaceId,
      user_id: userId,
      role: "owner",
    });

    return workspaceId;
  }, [supabase]);

  const loadSupabaseQuickReplies = useCallback(async (workspaceId: string) => {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("quick_replies")
      .select("id,title,category,body,tags")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      setNotice(`No se pudieron cargar respuestas rapidas: ${error.message}`);
      return [];
    }

    return (data ?? []).map(mapQuickReplyRow);
  }, [supabase]);

  const seedSupabaseQuickReplies = useCallback(async (workspaceId: string) => {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("quick_replies")
      .insert(
        quickReplies.map((reply) => ({
          workspace_id: workspaceId,
          title: reply.title,
          category: reply.category,
          body: reply.body,
          tags: reply.tags,
        })),
      )
      .select("id,title,category,body,tags")
      .order("created_at", { ascending: true });

    if (error) {
      setNotice(`No se pudieron crear respuestas iniciales: ${error.message}`);
      return [];
    }

    return (data ?? []).map(mapQuickReplyRow);
  }, [supabase]);

  const loadSupabaseInbox = useCallback(async (workspaceId: string): Promise<SupabaseInboxData> => {
    if (!supabase) {
      return {
        channels,
        items: inboxItems,
      };
    }

    const accounts = await supabase
      .from("connected_accounts")
      .select("id,network,provider_account_id,name,handle,access_token_encrypted,scopes,updated_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (accounts.error) {
      setNotice(`No se pudieron cargar cuentas: ${accounts.error.message}`);
      return {
        channels,
        items: inboxItems,
      };
    }

    const accountRows = (accounts.data ?? []) as ConnectedAccountRow[];

    if (accountRows.length === 0) {
      return {
        channels: [],
        items: [],
      };
    }

    const inboxSelect = `
      id,
      account_id,
      source,
      status,
      ingest_source,
      provider_comment_id,
      provider_post_id,
      title,
      preview,
      is_liked,
      is_hidden,
      unread_count,
      received_at,
      connected_accounts (
        id,
        network,
        provider_account_id,
        name,
        handle,
        access_token_encrypted,
        scopes,
        updated_at
      ),
      contacts (
        display_name,
        handle,
        is_blocked
      ),
      inbox_messages (
        id,
        provider_message_id,
        author_type,
        body,
        sent_at
      )
    `;
    const inboxSelectWithoutIngestSource = inboxSelect.replace("      ingest_source,\n", "");
    let inbox = (await supabase
      .from("inbox_items")
      .select(inboxSelect)
      .eq("workspace_id", workspaceId)
      .order("received_at", { ascending: false })) as {
      data: unknown[] | null;
      error: { message: string } | null;
    };

    if (inbox.error?.message.includes("ingest_source")) {
      inbox = (await supabase
        .from("inbox_items")
        .select(inboxSelectWithoutIngestSource)
        .eq("workspace_id", workspaceId)
        .order("received_at", { ascending: false })) as {
        data: unknown[] | null;
        error: { message: string } | null;
      };
    }

    if (inbox.error) {
      setNotice(`No se pudo cargar inbox Supabase: ${inbox.error.message}`);
      return {
        channels: accountRows.map(mapConnectedAccountRow),
        items: [],
      };
    }

    return {
      channels: accountRows.map(mapConnectedAccountRow),
      items: ((inbox.data ?? []) as InboxItemRow[]).map(mapInboxItemRow),
    };
  }, [supabase]);

  const seedSupabaseInbox = useCallback(async (workspaceId: string) => {
    if (!supabase) return;

    const accountInsert = await supabase
      .from("connected_accounts")
      .insert(
        channels.map((channel) => ({
          workspace_id: workspaceId,
          network: channel.network,
          provider_account_id: channel.id,
          name: channel.name,
          handle: channel.handle,
          scopes: channel.scopes,
        })),
      )
      .select("id,network,provider_account_id");

    if (accountInsert.error) {
      setNotice(`No se pudieron crear cuentas demo: ${accountInsert.error.message}`);
      return;
    }

    const accountByProviderId = new Map(
      (accountInsert.data ?? []).map((account) => [
        account.provider_account_id as string,
        account.id as string,
      ]),
    );

    const contactsByKey = new Map<string, {
      workspace_id: string;
      network: Network;
      provider_user_id: string;
      display_name: string;
      handle: string;
      is_blocked: boolean;
    }>();

    for (const item of inboxItems) {
      contactsByKey.set(`${item.network}:${item.contactHandle}`, {
        workspace_id: workspaceId,
        network: item.network,
        provider_user_id: item.contactHandle,
        display_name: item.contactName,
        handle: item.contactHandle,
        is_blocked: item.blocked,
      });
    }

    const contactInsert = await supabase
      .from("contacts")
      .insert([...contactsByKey.values()])
      .select("id,network,provider_user_id");

    if (contactInsert.error) {
      setNotice(`No se pudieron crear contactos demo: ${contactInsert.error.message}`);
      return;
    }

    const contactByKey = new Map(
      (contactInsert.data ?? []).map((contact) => [
        `${contact.network}:${contact.provider_user_id}`,
        contact.id as string,
      ]),
    );

    const baseTime = Date.now();
    const itemInsert = await supabase
      .from("inbox_items")
      .insert(
        inboxItems.map((item, index) => ({
          workspace_id: workspaceId,
          account_id: accountByProviderId.get(item.accountId),
          contact_id: contactByKey.get(`${item.network}:${item.contactHandle}`),
          source: item.source,
          status: item.status,
          provider_thread_id: item.id,
          provider_comment_id: item.providerCommentId,
          provider_post_id: item.providerPostId,
          title: item.title,
          preview: item.preview,
          is_liked: item.liked,
          is_hidden: item.hidden,
          unread_count: item.unreadCount,
          received_at: new Date(baseTime - index * 60000).toISOString(),
        })),
      )
      .select("id,provider_thread_id");

    if (itemInsert.error) {
      setNotice(`No se pudieron crear conversaciones demo: ${itemInsert.error.message}`);
      return;
    }

    const itemByProviderId = new Map(
      (itemInsert.data ?? []).map((item) => [
        item.provider_thread_id as string,
        item.id as string,
      ]),
    );

    const messageInsert = await supabase.from("inbox_messages").insert(
      inboxItems.flatMap((item, itemIndex) =>
        item.messages.map((message, messageIndex) => ({
          inbox_item_id: itemByProviderId.get(item.id),
          provider_message_id: message.id,
          author_type: message.author,
          body: message.body,
          sent_at: new Date(baseTime - (itemIndex * 10 + messageIndex) * 60000).toISOString(),
        })),
      ),
    );

    if (messageInsert.error) {
      setNotice(`No se pudieron crear mensajes demo: ${messageInsert.error.message}`);
    }
  }, [supabase]);

  const loadSupabasePreferences = useCallback(async (workspaceId: string) => {
    if (!supabase || !currentUser) return null;

    const { data, error } = await supabase
      .from("user_preferences")
      .select("visible_account_ids")
      .eq("workspace_id", workspaceId)
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) {
      setNotice(`No se pudieron cargar preferencias: ${error.message}`);
      return null;
    }

    return {
      visibleAccountIds: Array.isArray(data?.visible_account_ids)
        ? (data.visible_account_ids as string[])
        : null,
    };
  }, [currentUser, supabase]);

  useEffect(() => {
    const user = currentUser;

    if (!supabase || !user) {
      window.setTimeout(() => {
        setActiveWorkspaceId(null);
        hasLoadedRemoteWorkspace.current = false;
        workspaceBootstrap.current = null;
      }, 0);
      return;
    }

    const userId = user.id;
    let isCancelled = false;

    async function loadWorkspaceData() {
      let workspacePromise = workspaceBootstrap.current?.promise ?? null;

      if (workspaceBootstrap.current?.userId !== userId) {
        workspacePromise = ensurePersonalWorkspace(userId);
        workspaceBootstrap.current = {
          userId,
          promise: workspacePromise,
        };
      }

      const workspaceId = await workspacePromise;
      if (!workspaceId || isCancelled) return;

      setActiveWorkspaceId(workspaceId);

      const [replyRows, preferences] = await Promise.all([
        loadSupabaseQuickReplies(workspaceId),
        loadSupabasePreferences(workspaceId),
      ]);

      if (isCancelled) return;

      let inboxData = await loadSupabaseInbox(workspaceId);
      if (!isCancelled && inboxData.channels.length === 0) {
        await seedSupabaseInbox(workspaceId);
        inboxData = await loadSupabaseInbox(workspaceId);
      }

      if (isCancelled) return;

      if (replyRows.length > 0) {
        setReplies(replyRows);
      } else {
        const seededReplies = await seedSupabaseQuickReplies(workspaceId);
        if (!isCancelled && seededReplies.length > 0) {
          setReplies(seededReplies);
        }
      }

      if (inboxData.channels.length > 0) {
        const remoteAccountIds = inboxData.channels.map((channel) => channel.id);

        setChannelList(inboxData.channels);
        setItems(inboxData.items);
        setInboxSource("supabase");
        setSelectedId(inboxData.items[0]?.id);

        if (preferences?.visibleAccountIds) {
          setVisibleAccountIds(
            preferences.visibleAccountIds.filter((id) =>
              remoteAccountIds.includes(id),
            ),
          );
        } else {
          setVisibleAccountIds(remoteAccountIds);
        }
      }

      hasLoadedRemoteWorkspace.current = true;
      setNotice("Supabase conectado. Inbox, respuestas rapidas y preferencias usan tu cuenta.");
    }

    void loadWorkspaceData();

    return () => {
      isCancelled = true;
    };
  }, [
    currentUser,
    ensurePersonalWorkspace,
    loadSupabaseInbox,
    loadSupabasePreferences,
    loadSupabaseQuickReplies,
    seedSupabaseInbox,
    seedSupabaseQuickReplies,
    supabase,
  ]);

  useEffect(() => {
    if (!supabase || !activeWorkspaceId) {
      return;
    }

    const refreshInbox = () => {
      if (realtimeRefreshTimeout.current) {
        window.clearTimeout(realtimeRefreshTimeout.current);
      }

      realtimeRefreshTimeout.current = window.setTimeout(async () => {
        const inboxData = await loadSupabaseInbox(activeWorkspaceId);
        setChannelList(inboxData.channels);
        setItems(inboxData.items);
        setInboxSource("supabase");
        setSelectedId((currentSelectedId) => {
          if (currentSelectedId && inboxData.items.some((item) => item.id === currentSelectedId)) {
            return currentSelectedId;
          }

          return inboxData.items[0]?.id;
        });
        realtimeRefreshTimeout.current = null;
      }, 1200);
    };

    const channel = supabase
      .channel(`inbox-items-${activeWorkspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbox_items",
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        refreshInbox,
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimeout.current) {
        window.clearTimeout(realtimeRefreshTimeout.current);
        realtimeRefreshTimeout.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId, loadSupabaseInbox, supabase]);

  async function persistSupabasePreferences(nextVisibleAccountIds: string[]) {
    if (!supabase || !currentUser || !activeWorkspaceId || !hasLoadedRemoteWorkspace.current) {
      return;
    }

    const { error } = await supabase.from("user_preferences").upsert({
      user_id: currentUser.id,
      workspace_id: activeWorkspaceId,
      visible_account_ids: nextVisibleAccountIds,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setNotice(`No se pudieron guardar preferencias: ${error.message}`);
    }
  }

  async function persistSupabaseQuickReply(reply: QuickReply) {
    if (!supabase || !activeWorkspaceId || !hasLoadedRemoteWorkspace.current) {
      return;
    }

    const { data, error } = await supabase
      .from("quick_replies")
      .upsert({
        id: reply.id,
        workspace_id: activeWorkspaceId,
        title: reply.title,
        category: reply.category,
        body: reply.body,
        tags: reply.tags,
        updated_at: new Date().toISOString(),
      })
      .select("id,title,category,body,tags")
      .single();

    if (error) {
      setNotice(`No se pudo guardar en Supabase: ${error.message}`);
      return;
    }

    const savedReply = mapQuickReplyRow(data);
    setReplies((current) =>
      current.map((item) => (item.id === reply.id ? savedReply : item)),
    );
  }

  async function deleteSupabaseQuickReply(replyId: string) {
    if (!supabase || !activeWorkspaceId || !hasLoadedRemoteWorkspace.current) {
      return;
    }

    const { error } = await supabase
      .from("quick_replies")
      .delete()
      .eq("id", replyId)
      .eq("workspace_id", activeWorkspaceId);

    if (error) {
      setNotice(`No se pudo eliminar en Supabase: ${error.message}`);
    }
  }

  function toggleAccountVisibility(accountId: string) {
    setVisibleAccountIds((current) => {
      const next = current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId];

      void persistSupabasePreferences(next);
      return next;
    });
  }

  function showAllAccounts() {
    const next = channelList.map((channel) => channel.id);
    setVisibleAccountIds(next);
    void persistSupabasePreferences(next);
  }

  function hideAllAccounts() {
    setVisibleAccountIds([]);
    void persistSupabasePreferences([]);
  }

  function toggleAllAccountsVisibility() {
    if (visibleAccountIds.length === channelList.length) {
      hideAllAccounts();
      return;
    }

    showAllAccounts();
  }

  function configureAccount(channel: ChannelConnection) {
    setIsMetaSettingsOpen(true);
    setOpenAccountMenuId(null);
    setNotice(`Configuracion abierta para revisar permisos de ${channel.name}.`);
  }

  async function disconnectAccount(accountId: string) {
    if (!supabase || !currentUser) {
      setNotice("Inicia sesion Supabase para desconectar cuentas.");
      return;
    }

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;

    if (!accessToken) {
      setNotice("Sesion Supabase expirada. Vuelve a iniciar sesion.");
      return;
    }

    const response = await fetch(`/api/meta/accounts/${accountId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = await response.json();

    if (!response.ok) {
      setNotice(payload.message ?? "No se pudo desconectar la cuenta.");
      return;
    }

    setChannelList((current) => current.filter((channel) => channel.id !== accountId));
    setVisibleAccountIds((current) => current.filter((id) => id !== accountId));
    setItems((current) => current.filter((item) => item.accountId !== accountId));
    setNotice(payload.message ?? "Cuenta desconectada.");
  }

  function openNewQuickReply() {
    setIsQuickReplyPanelOpen(true);
    setEditingQuickReplyId(null);
    setQuickReplyDraft(emptyQuickReplyDraft);
    setIsQuickReplyEditorOpen(true);
  }

  function openEditQuickReply(reply: QuickReply) {
    setIsQuickReplyPanelOpen(true);
    setEditingQuickReplyId(reply.id);
    setQuickReplyDraft({
      title: reply.title,
      category: reply.category,
      body: reply.body,
      tagsText: reply.tags.join(", "),
    });
    setIsQuickReplyEditorOpen(true);
  }

  function closeQuickReplyEditor() {
    setEditingQuickReplyId(null);
    setQuickReplyDraft(emptyQuickReplyDraft);
    setIsQuickReplyEditorOpen(false);
  }

  function saveQuickReply() {
    const title = quickReplyDraft.title.trim();
    const body = quickReplyDraft.body.trim();
    const category = quickReplyDraft.category.trim() || "General";

    if (!title || !body) {
      setNotice("Titulo y texto son obligatorios para guardar la respuesta rapida.");
      return;
    }

    const nextReply: QuickReply = {
      id: editingQuickReplyId ?? createLocalId(),
      title,
      category,
      body,
      tags: parseTags(quickReplyDraft.tagsText),
    };

    setReplies((current) => {
      if (!editingQuickReplyId) {
        return [nextReply, ...current];
      }

      return current.map((reply) =>
        reply.id === editingQuickReplyId ? nextReply : reply,
      );
    });

    setNotice(
      editingQuickReplyId
        ? "Respuesta rapida actualizada."
        : "Respuesta rapida guardada.",
    );
    void persistSupabaseQuickReply(nextReply);
    closeQuickReplyEditor();
  }

  function deleteQuickReply(replyId: string) {
    setReplies((current) => current.filter((reply) => reply.id !== replyId));
    if (editingQuickReplyId === replyId) {
      closeQuickReplyEditor();
    }
    setNotice("Respuesta rapida eliminada.");
    void deleteSupabaseQuickReply(replyId);
  }

  function insertQuickReply(reply: QuickReply) {
    setComposer(reply.body);
    setIsQuickReplyPanelOpen(false);
  }

  async function startMetaOAuth() {
    if (!supabase || !currentUser || !activeWorkspaceId) {
      setMetaConnectionMessage("Inicia sesion Supabase antes de conectar Meta.");
      return;
    }

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;

    if (!accessToken) {
      setMetaConnectionMessage("Sesion Supabase expirada. Vuelve a iniciar sesion.");
      return;
    }

    const response = await fetch("/api/meta/oauth/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: activeWorkspaceId,
      }),
    });

    const payload = await response.json();

    if (!response.ok || !payload.redirectUrl) {
      setMetaConnectionMessage(payload.message ?? "No se pudo iniciar OAuth Meta.");
      return;
    }

    window.location.href = payload.redirectUrl;
  }

  const syncFacebookComments = useCallback(async ({ automatic = false }: { automatic?: boolean } = {}) => {
    if (commentSyncInFlight.current) {
      return;
    }

    if (!supabase || !currentUser || !activeWorkspaceId) {
      if (!automatic) {
        setMetaConnectionMessage("Inicia sesion Supabase antes de sincronizar comentarios.");
      }
      return;
    }

    commentSyncInFlight.current = true;

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;

    if (!accessToken) {
      if (!automatic) {
        setMetaConnectionMessage("Sesion Supabase expirada. Vuelve a iniciar sesion.");
      }
      commentSyncInFlight.current = false;
      return;
    }

    try {
      const response = await fetch("/api/meta/sync/comments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          mode: automatic ? "fast" : "full",
        }),
      });
      const payload = await response.json();

      const firstError = Array.isArray(payload.errors) ? payload.errors[0] : null;
      const errorDetail =
        firstError && typeof firstError.message === "string"
          ? ` Error: ${firstError.account ? `${firstError.account}: ` : ""}${firstError.message}`
          : "";

      const insertedCount =
        typeof payload.comments?.inserted === "number" ? payload.comments.inserted : 0;

      if (!automatic || insertedCount > 0 || !payload.ok) {
        setMetaConnectionMessage(
          `${payload.message ?? "Sincronizacion finalizada."}${errorDetail}`,
        );
      }

      if (!response.ok || !payload.ok) {
        return;
      }

      const inboxData = await loadSupabaseInbox(activeWorkspaceId);
      setChannelList(inboxData.channels);
      setItems(inboxData.items);
      setInboxSource("supabase");

      if (insertedCount > 0) {
        setNotice(`${insertedCount} comentario(s) nuevo(s) importado(s) automaticamente.`);
      } else if (!automatic) {
        setNotice("Sincronizacion manual finalizada sin comentarios nuevos.");
      }
    } catch {
      if (!automatic) {
        setMetaConnectionMessage("No se pudo sincronizar comentarios Facebook.");
      }
    } finally {
      commentSyncInFlight.current = false;
    }
  }, [activeWorkspaceId, currentUser, loadSupabaseInbox, supabase]);

  const syncInstagramComments = useCallback(async ({ automatic = false }: { automatic?: boolean } = {}) => {
    if (instagramCommentSyncInFlight.current) {
      return;
    }

    if (!supabase || !currentUser || !activeWorkspaceId) {
      if (!automatic) {
        setMetaConnectionMessage("Inicia sesion Supabase antes de sincronizar Instagram.");
      }
      return;
    }

    instagramCommentSyncInFlight.current = true;

    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;

    if (!accessToken) {
      if (!automatic) {
        setMetaConnectionMessage("Sesion Supabase expirada. Vuelve a iniciar sesion.");
      }
      instagramCommentSyncInFlight.current = false;
      return;
    }

    try {
      const response = await fetch("/api/meta/sync/instagram-comments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          mode: automatic ? "fast" : "full",
        }),
      });
      const payload = await response.json();
      const firstError = Array.isArray(payload.errors) ? payload.errors[0] : null;
      const errorDetail =
        firstError && typeof firstError.message === "string"
          ? ` Error: ${firstError.account ? `${firstError.account}: ` : ""}${firstError.message}`
          : "";
      const insertedCount =
        typeof payload.comments?.inserted === "number" ? payload.comments.inserted : 0;

      if (!automatic || insertedCount > 0 || !payload.ok) {
        setMetaConnectionMessage(
          `${payload.message ?? "Sincronizacion Instagram finalizada."}${errorDetail}`,
        );
      }

      if (!response.ok || !payload.ok) {
        return;
      }

      const inboxData = await loadSupabaseInbox(activeWorkspaceId);
      setChannelList(inboxData.channels);
      setItems(inboxData.items);
      setInboxSource("supabase");

      if (insertedCount > 0) {
        setNotice(`${insertedCount} comentario(s) Instagram nuevo(s) importado(s).`);
      } else if (!automatic) {
        setNotice("Sincronizacion Instagram finalizada sin comentarios nuevos.");
      }
    } catch {
      if (!automatic) {
        setMetaConnectionMessage("No se pudo sincronizar comentarios Instagram.");
      }
    } finally {
      instagramCommentSyncInFlight.current = false;
    }
  }, [activeWorkspaceId, currentUser, loadSupabaseInbox, supabase]);

  async function runMetaWebhookDiagnostics() {
    if (!supabase || !currentUser || !activeWorkspaceId) {
      setMetaConnectionMessage("Inicia sesion Supabase antes de diagnosticar Webhooks.");
      return;
    }

    setIsMetaWebhookDiagnosticsLoading(true);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        setMetaConnectionMessage("Sesion Supabase expirada. Vuelve a iniciar sesion.");
        return;
      }

      const response = await fetch("/api/meta/webhook/diagnostics", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMetaConnectionMessage(payload.message ?? "No se pudo diagnosticar Webhooks Meta.");
        return;
      }

      setMetaWebhookDiagnostics(payload);
      setMetaConnectionMessage("Diagnostico Webhooks actualizado.");
    } catch {
      setMetaConnectionMessage("No se pudo diagnosticar Webhooks Meta.");
    } finally {
      setIsMetaWebhookDiagnosticsLoading(false);
    }
  }

  async function subscribeMetaWebhooks() {
    if (!supabase || !currentUser || !activeWorkspaceId) {
      setMetaConnectionMessage("Inicia sesion Supabase antes de suscribir Webhooks.");
      return;
    }

    setIsMetaWebhookSubscribeLoading(true);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        setMetaConnectionMessage("Sesion Supabase expirada. Vuelve a iniciar sesion.");
        return;
      }

      const response = await fetch("/api/meta/webhook/subscribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
        }),
      });
      const payload = await response.json();

      setMetaConnectionMessage(payload.message ?? "Suscripcion Webhooks solicitada.");

      if (response.ok && payload.ok) {
        await runMetaWebhookDiagnostics();
      }
    } catch {
      setMetaConnectionMessage("No se pudo re-suscribir Webhooks Meta.");
    } finally {
      setIsMetaWebhookSubscribeLoading(false);
    }
  }

  async function runMetaAdsDiagnostics() {
    if (!supabase || !currentUser || !activeWorkspaceId) {
      setMetaConnectionMessage("Inicia sesion Supabase antes de diagnosticar Ads.");
      return;
    }

    setIsMetaAdsDiagnosticsLoading(true);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        setMetaConnectionMessage("Sesion Supabase expirada. Vuelve a iniciar sesion.");
        return;
      }

      const response = await fetch("/api/meta/ads/diagnostics", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setMetaConnectionMessage(payload.message ?? "No se pudo diagnosticar Ads Meta.");
        return;
      }

      setMetaAdsDiagnostics(payload);
      setMetaConnectionMessage(payload.message ?? "Diagnostico Ads actualizado.");
    } catch {
      setMetaConnectionMessage("No se pudo diagnosticar Ads Meta.");
    } finally {
      setIsMetaAdsDiagnosticsLoading(false);
    }
  }

  const syncMetaAdComments = useCallback(async ({ automatic = false }: { automatic?: boolean } = {}) => {
    if (!supabase || !currentUser || !activeWorkspaceId) {
      if (!automatic) {
        setMetaConnectionMessage("Inicia sesion Supabase antes de sincronizar Ads.");
      }
      return;
    }

    if (adCommentSyncInFlight.current) {
      return;
    }

    adCommentSyncInFlight.current = true;

    if (!automatic) {
      setIsMetaAdCommentsSyncing(true);
    }

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        if (!automatic) {
          setMetaConnectionMessage("Sesion Supabase expirada. Vuelve a iniciar sesion.");
        }
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 60000);
      const response = await fetch("/api/meta/sync/ad-comments", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          mode: "full",
          trigger: automatic ? "auto" : "manual",
        }),
      });
      window.clearTimeout(timeoutId);
      const payload = await response.json();
      const firstError = Array.isArray(payload.errors) ? payload.errors[0] : null;
      const errorDetail =
        firstError && typeof firstError.message === "string"
          ? ` Error: ${firstError.target ? `${firstError.target}: ` : ""}${firstError.message}`
          : "";

      if (!automatic || !payload.ok || (payload.comments?.inserted ?? 0) > 0) {
        setMetaConnectionMessage(`${payload.message ?? "Sincronizacion Ads finalizada."}${errorDetail}`);
      }

      if (!response.ok || !payload.ok) {
        return;
      }

      const inboxData = await loadSupabaseInbox(activeWorkspaceId);
      setChannelList(inboxData.channels);
      setItems(inboxData.items);
      setInboxSource("supabase");
      if ((payload.comments?.inserted ?? 0) > 0) {
        setNotice(`${payload.comments?.inserted ?? 0} comentario(s) de Ads nuevo(s) importado(s).`);
      } else if (!automatic) {
        setNotice("Sincronizacion Ads finalizada sin comentarios nuevos.");
      }
    } catch (error) {
      if (!automatic) {
        setMetaConnectionMessage(
          error instanceof DOMException && error.name === "AbortError"
            ? "La sincronizacion Ads tardo demasiado y fue cancelada en la UI. Intenta de nuevo en unos segundos."
            : "No se pudo sincronizar comentarios de Ads.",
        );
      }
    } finally {
      adCommentSyncInFlight.current = false;
      if (!automatic) {
        setIsMetaAdCommentsSyncing(false);
      }
    }
  }, [activeWorkspaceId, currentUser, loadSupabaseInbox, supabase]);

  useEffect(() => {
    if (!canAutoSyncFacebookComments || !currentUser || !activeWorkspaceId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void syncFacebookComments({ automatic: true });
    }, 1500);
    const intervalId = window.setInterval(() => {
      void syncFacebookComments({ automatic: true });
    }, facebookCommentSyncIntervalMs);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [activeWorkspaceId, canAutoSyncFacebookComments, currentUser, syncFacebookComments]);

  useEffect(() => {
    if (!canAutoSyncMetaAdComments || !currentUser || !activeWorkspaceId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void syncMetaAdComments({ automatic: true });
    }, 6000);
    const intervalId = window.setInterval(() => {
      void syncMetaAdComments({ automatic: true });
    }, metaAdCommentSyncIntervalMs);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [activeWorkspaceId, canAutoSyncMetaAdComments, currentUser, syncMetaAdComments]);

  useEffect(() => {
    if (!canAutoSyncInstagramComments || !currentUser || !activeWorkspaceId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void syncInstagramComments({ automatic: true });
    }, 3000);
    const intervalId = window.setInterval(() => {
      void syncInstagramComments({ automatic: true });
    }, instagramCommentSyncIntervalMs);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [activeWorkspaceId, canAutoSyncInstagramComments, currentUser, syncInstagramComments]);

  async function runAction(action: InboxAction, message?: string, options?: RunActionOptions) {
    if (!selectedItem) return;

    const session = supabase ? await supabase.auth.getSession() : null;
    const accessToken = session?.data.session?.access_token;
    const response = await fetch("/api/inbox/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        itemId: selectedItem.id,
        externalId:
          selectedItem.providerCommentId ?? selectedItem.providerPostId ?? selectedItem.id,
        action,
        message,
        messageId: options?.messageId,
        replyMode: options?.replyMode,
        recipientExternalId: options?.recipientExternalId,
      }),
    });

    const result = await response.json();
    setNotice(result.message ?? "Accion registrada.");

    if (!response.ok) {
      if (activeWorkspaceId) {
        const inboxData = await loadSupabaseInbox(activeWorkspaceId);
        setChannelList(inboxData.channels);
        setItems(inboxData.items);
        setInboxSource("supabase");
      }
      return;
    }

    if (action === "delete_comment") {
      setItems((current) => current.filter((item) => item.id !== selectedItem.id));
      setSelectedId(filteredItems.find((item) => item.id !== selectedItem.id)?.id ?? "");
    } else {
      setItems((current) =>
        current.map((item) =>
          action === "block" || action === "unblock"
            ? item.accountId === selectedItem.accountId &&
              item.contactHandle === selectedItem.contactHandle &&
              item.contactName === selectedItem.contactName
              ? applyInboxActionToItem(item, action, message)
              : item
            : item.id === selectedItem.id
              ? applyInboxActionToItem(item, action, message)
              : item,
        ),
      );
    }

    if ((action === "reply" || action === "delete_message" || action === "delete_comment") && activeWorkspaceId) {
      const inboxData = await loadSupabaseInbox(activeWorkspaceId);
      setChannelList(inboxData.channels);
      setItems(inboxData.items);
      setInboxSource("supabase");
    }
  }

  function setReplyModeForSelectedItem(replyMode: ReplyMode) {
    if (!selectedItem) return;

    setReplyModesByItemId((current) => ({
      ...current,
      [selectedItem.id]: replyMode,
    }));
  }

  function openOriginalPost() {
    if (!selectedOriginalPostUrl) {
      setNotice("Esta conversacion todavia no tiene URL original disponible.");
      setOpenOriginalPostMenuItemId(null);
      return;
    }

    window.open(selectedOriginalPostUrl, "_blank", "noopener,noreferrer");
    setOpenOriginalPostMenuItemId(null);
  }

  function reactToSelectedItem(reaction: ReactionKind) {
    if (!selectedItem) return;

    const isRemovingReaction = selectedReaction === reaction;
    setItemReactions((current) => {
      const next = { ...current };
      if (isRemovingReaction) {
        delete next[selectedItem.id];
      } else {
        next[selectedItem.id] = reaction;
      }
      return next;
    });
    void runAction(isRemovingReaction ? "unlike" : "like");
  }

  function toggleSelectedItem(itemId: string, checked: boolean) {
    setSelectedItemIds((current) =>
      checked
        ? [...new Set([...current, itemId])]
        : current.filter((selectedItemId) => selectedItemId !== itemId),
    );
  }

  function toggleAllVisibleItems(checked: boolean) {
    setSelectedItemIds((current) => {
      const hiddenSelections = current.filter((id) => !filteredItemIds.includes(id));
      return checked ? [...new Set([...hiddenSelections, ...filteredItemIds])] : hiddenSelections;
    });
  }

  async function runBulkAction(action: BulkInboxAction) {
    const targetIds = filteredItemIds.filter((id) => selectedItemSet.has(id));

    if (targetIds.length === 0) {
      return;
    }

    setIsBulkActionRunning(true);
    setItems((current) =>
      current.map((item) =>
        targetIds.includes(item.id) ? applyInboxActionToItem(item, action) : item,
      ),
    );
    setSelectedItemIds((current) => current.filter((id) => !targetIds.includes(id)));
    setNotice(`${targetIds.length} conversacion(es) actualizada(s). Guardando cambios...`);

    try {
      const session = supabase ? await supabase.auth.getSession() : null;
      const accessToken = session?.data.session?.access_token;
      const results = await Promise.all(
        targetIds.map((itemId) =>
          fetch("/api/inbox/action", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({
              itemId,
              externalId: itemId,
              action,
            }),
          }).then((response) => response.ok),
        ),
      );
      const succeededIds = targetIds.filter((_, index) => results[index]);
      const failedCount = targetIds.length - succeededIds.length;

      if (failedCount > 0 && activeWorkspaceId) {
        const inboxData = await loadSupabaseInbox(activeWorkspaceId);
        setChannelList(inboxData.channels);
        setItems(inboxData.items);
        setInboxSource("supabase");
      }

      setNotice(
        failedCount > 0
          ? `${succeededIds.length} conversacion(es) guardada(s); ${failedCount} no se pudieron guardar.`
          : `${succeededIds.length} conversacion(es) guardada(s).`,
      );
    } catch {
      if (activeWorkspaceId) {
        const inboxData = await loadSupabaseInbox(activeWorkspaceId);
        setChannelList(inboxData.channels);
        setItems(inboxData.items);
        setInboxSource("supabase");
      }

      setNotice("No se pudieron guardar los cambios masivos. Revisa la conexion e intenta de nuevo.");
    } finally {
      setIsBulkActionRunning(false);
    }
  }

  function sendReply() {
    const message = composer.trim();
    if (!message) return;
    void runAction("reply", message, {
      replyMode: selectedReplyMode,
      recipientExternalId: selectedRecipientExternalId,
    });
    setComposer("");
  }

  function deleteAgentMessage(messageId: string) {
    if (!selectedItem) return;

    void runAction("delete_message", undefined, { messageId });
  }

  async function unblockAuthorFromList(author: BlockedAuthor) {
    const target = author.item;

    setItems((current) =>
      current.map((item) =>
        item.accountId === target.accountId &&
        item.contactHandle === target.contactHandle &&
        item.contactName === target.contactName
          ? { ...item, blocked: false }
          : item,
      ),
    );

    try {
      const session = supabase ? await supabase.auth.getSession() : null;
      const accessToken = session?.data.session?.access_token;
      const response = await fetch("/api/inbox/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          itemId: target.id,
          externalId: target.providerCommentId ?? target.providerPostId ?? target.id,
          action: "unblock",
        }),
      });
      const result = await response.json();

      setNotice(result.message ?? "Autor desbloqueado.");

      if (!response.ok && activeWorkspaceId) {
        const inboxData = await loadSupabaseInbox(activeWorkspaceId);
        setChannelList(inboxData.channels);
        setItems(inboxData.items);
        setInboxSource("supabase");
      }
    } catch {
      if (activeWorkspaceId) {
        const inboxData = await loadSupabaseInbox(activeWorkspaceId);
        setChannelList(inboxData.channels);
        setItems(inboxData.items);
        setInboxSource("supabase");
      }
      setNotice("No se pudo desbloquear el autor.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <div className="flex min-h-screen flex-col lg:h-screen lg:grid lg:grid-cols-[340px_minmax(340px,430px)_minmax(0,1fr)] lg:overflow-hidden">
        <aside
          className={`${mobileInboxPanel === "detail" ? "hidden" : "flex"} min-h-0 flex-col border-b border-slate-200 bg-[#202020] text-white lg:flex lg:h-screen lg:border-b-0 lg:border-r lg:border-slate-800`}
        >
          <div className="shrink-0 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Social Inbox
              </p>
                <h1 className="mt-1 text-lg font-semibold tracking-tight">Cuentas</h1>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                className="grid size-8 place-items-center rounded-md border border-white/10 text-slate-200 hover:bg-white/10"
                onClick={toggleAllAccountsVisibility}
                title={visibleAccountIds.length === channelList.length ? "Ocultar todas" : "Mostrar todas"}
              >
                {visibleAccountIds.length === channelList.length ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
              <button
                className="grid size-8 place-items-center rounded-md border border-white/10 text-slate-200 hover:bg-white/10 lg:hidden"
                onClick={() => setIsMobileAccountsOpen((current) => !current)}
                title={isMobileAccountsOpen ? "Contraer cuentas" : "Expandir cuentas"}
              >
                <ChevronDown
                  className={`transition ${isMobileAccountsOpen ? "rotate-180" : ""}`}
                  size={17}
                />
              </button>
            </div>
          </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-300">
                <span className="font-semibold text-white">{visibleAccountIds.length}</span>
                {" / "}
                {channelList.length} visibles
              </p>
              <p className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-400">
                Inbox: {inboxSource === "supabase" ? "Supabase" : "demo"}
              </p>
              <button
                className="grid size-8 place-items-center rounded-md border border-white/10 text-slate-200 hover:bg-white/10"
                onClick={() => setIsMetaSettingsOpen((current) => !current)}
                title="Configuracion Meta"
              >
                <Settings size={16} />
              </button>
            </div>
          </div>

          <div className={`${isMobileAccountsOpen ? "flex" : "hidden"} max-h-[58vh] min-h-0 flex-col lg:flex lg:max-h-none lg:flex-1`}>
            <div className="shrink-0 px-3 pb-3">
            <div className="mt-3 rounded-md border border-white/10 bg-white/[0.04] p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Sesion</p>
            {supabase ? (
              currentUser ? (
                <>
                    <p className="mt-1.5 break-all text-xs text-slate-200">
                    {currentUser.email}
                  </p>
                    <p className="mt-1 text-[11px] text-emerald-300">
                    Supabase activo
                  </p>
                  <button
                      className="mt-2 h-8 w-full rounded-md border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-100 hover:bg-white/10"
                    onClick={() => void signOut()}
                  >
                    Cerrar sesion
                  </button>
                </>
              ) : (
                <>
                  <input
                      className="mt-3 h-10 w-full rounded-md border border-white/10 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-400"
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="tu@email.com"
                    type="email"
                    value={authEmail}
                  />
                  <button
                      className="mt-2 h-9 w-full rounded-md bg-white px-3 text-sm font-semibold text-slate-950"
                    onClick={() => void sendMagicLink()}
                  >
                    Enviar acceso
                  </button>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                    {authMessage}
                  </p>
                </>
              )
            ) : (
                <p className="mt-1 text-xs leading-5 text-slate-400">
                Sin variables de Supabase. La app guarda datos en este navegador.
              </p>
            )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
            <div className="space-y-1.5">
              {channelList.map((channel) => {
                const Icon = networkIcon[channel.network];
                const platform = networkMeta[channel.network];
                const isVisible = visibleAccountSet.has(channel.id);
                const accountItems = items.filter((item) => item.accountId === channel.id).length;
                const accountType =
                  channel.network === "facebook" ? "Pagina de Facebook" : "Instagram para Empresa";

                return (
                  <div
                    className={`relative rounded-md border p-2.5 ${
                      isVisible
                        ? "border-white/10 bg-white/[0.05]"
                        : "border-white/5 bg-transparent opacity-60"
                    }`}
                    key={channel.id}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="relative grid size-9 shrink-0 place-items-center rounded-full border-2 border-amber-300 bg-slate-100 text-slate-700">
                        <Icon size={16} />
                        <span className={`absolute -bottom-1 -right-1 rounded-full px-1 py-0.5 text-[9px] font-bold leading-none ring-2 ring-[#202020] ${platform.badgeClass}`}>
                          {platform.shortLabel}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold leading-4 text-white">
                          {channel.name}
                        </p>
                        <p className="mt-1 break-words text-xs leading-4 text-slate-300">
                          {accountType}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {accountItems} item(s) · {channel.status === "connected" ? "Real" : channel.status === "needs_review" ? "Pendiente" : "Demo"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          className="grid size-7 place-items-center rounded-md text-slate-200 hover:bg-white/10"
                          onClick={() => toggleAccountVisibility(channel.id)}
                          title={isVisible ? "Ocultar cuenta" : "Mostrar cuenta"}
                        >
                          {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button
                          className="grid size-7 place-items-center rounded-md text-slate-200 hover:bg-white/10"
                          onClick={() =>
                            setOpenAccountMenuId((current) =>
                              current === channel.id ? null : channel.id,
                            )
                          }
                          title="Opciones de cuenta"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </div>
                    {openAccountMenuId === channel.id ? (
                      <div className="absolute right-3 top-12 z-20 w-44 rounded-md border border-white/10 bg-[#2d2d2d] p-1 shadow-xl">
                        <button
                          className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-slate-100 hover:bg-white/10"
                          onClick={() => configureAccount(channel)}
                        >
                          <Settings size={15} />
                          Configurar
                        </button>
                        <button
                          className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-rose-200 hover:bg-white/10"
                          onClick={() => {
                            setOpenAccountMenuId(null);
                            void disconnectAccount(channel.id);
                          }}
                        >
                          <Trash2 size={15} />
                          Eliminar cuenta
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 rounded-md border border-white/10 bg-white/[0.04] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Autores bloqueados
                </p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                  {blockedAuthors.length}
                </span>
              </div>
              {blockedAuthors.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {blockedAuthors.map((author) => (
                    <div
                      className="flex items-center gap-2 rounded-md border border-white/10 bg-black/10 p-2"
                      key={author.key}
                    >
                      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-900 text-xs font-semibold text-white">
                        {author.item.avatarInitials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-white">
                          {author.item.contactName}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {author.item.accountName}
                        </p>
                      </div>
                      <button
                        className="grid size-8 shrink-0 place-items-center rounded-md border border-white/10 text-slate-200 hover:bg-white/10"
                        onClick={() => void unblockAuthorFromList(author)}
                        title="Desbloquear autor"
                      >
                        <Ban size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  No hay autores bloqueados.
                </p>
              )}
            </div>
          </div>

          <button
            className="mx-3 mb-3 mt-2 flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 text-sm font-semibold text-white hover:bg-white/10"
            onClick={() => setIsMetaSettingsOpen(true)}
          >
            <Plus size={17} />
            Añadir cuenta
          </button>

          {isMetaSettingsOpen ? (
            <div className="mx-4 mb-4 max-h-[42vh] shrink-0 overflow-y-auto rounded-md border border-white/10 bg-white p-3 text-slate-950 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Configuracion Meta</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    OAuth prueba permisos minimos; los tokens no se guardan hasta sumar cifrado.
                  </p>
                </div>
                <button
                  className="grid size-8 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-600"
                  onClick={() => setIsMetaSettingsOpen(false)}
                  title="Cerrar configuracion Meta"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="mt-3 rounded-md bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-700">Callback URL</p>
                <p className="mt-1 break-all text-xs leading-5 text-slate-500">
                  {metaCallbackUrl}
                </p>
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-700">Permisos objetivo</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {metaRequiredScopes.map((scope) => (
                    <span
                      className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600"
                      key={scope}
                    >
                      {scope}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  OAuth local: pages_show_list.
                </p>
              </div>

              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-700">Diagnostico actual</p>
                <div className="mt-2 grid gap-1 text-xs leading-5 text-slate-600">
                  <p>
                    Reales: {realMetaChannels.length} | Pendientes: {reviewMetaChannels.length} | Demo: {demoMetaChannels.length}
                  </p>
                  <p>
                    Facebook real:{" "}
                    {realMetaChannels.filter((channel) => channel.network === "facebook").length}
                    {" "} | Instagram real:{" "}
                    {realMetaChannels.filter((channel) => channel.network === "instagram").length}
                  </p>
                  <p>
                    Scopes concedidos: {grantedMetaScopes.length ? grantedMetaScopes.join(", ") : "ninguno"}
                  </p>
                </div>
                <div className="mt-2 grid gap-1">
                  {metaCapabilityChecks.map((capability) => {
                    const isReady = capability.scopes.every((scope) =>
                      grantedMetaScopes.includes(scope),
                    );

                    return (
                      <div
                        className="flex items-center justify-between gap-2 text-xs"
                        key={capability.label}
                      >
                        <span className="text-slate-600">{capability.label}</span>
                        <span
                          className={`rounded-md px-2 py-0.5 font-medium ${
                            isReady
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isReady ? "Listo" : "Faltan permisos"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                {metaConnectionMessage}
              </p>

              <button
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-950 bg-white px-3 text-sm font-semibold text-slate-950"
                onClick={() => void startMetaOAuth()}
              >
                <ExternalLink size={16} />
                Iniciar OAuth Meta
              </button>

              <button
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"
                onClick={() => void syncFacebookComments()}
              >
                <MessageCircle size={16} />
                Sincronizar comentarios FB
              </button>
              <button
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-pink-200 bg-pink-50 px-3 text-sm font-semibold text-pink-800"
                onClick={() => void syncInstagramComments()}
              >
                <Camera size={16} />
                Sincronizar comentarios IG
              </button>
              <button
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
                disabled={isMetaWebhookDiagnosticsLoading}
                onClick={() => void runMetaWebhookDiagnostics()}
              >
                <Settings size={16} />
                {isMetaWebhookDiagnosticsLoading ? "Diagnosticando..." : "Diagnosticar webhooks"}
              </button>
              {metaWebhookDiagnostics ? (
                <div className="mt-3 rounded-md border border-slate-200 bg-white p-2 text-xs leading-5 text-slate-600">
                  <p className="font-semibold text-slate-700">Webhooks Meta</p>
                  <p>
                    App Page fields:{" "}
                    <span
                      className={
                        metaWebhookDiagnostics.app?.pageReady
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-amber-700"
                      }
                    >
                      {metaWebhookDiagnostics.app?.pageReady ? "feed + messages" : "Incompleto"}
                    </span>
                  </p>
                  <p>
                    Feed:{" "}
                    <span
                      className={
                        metaWebhookDiagnostics.app?.pageFeedActive
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-amber-700"
                      }
                    >
                      {metaWebhookDiagnostics.app?.pageFeedActive ? "Activo" : "No activo"}
                    </span>
                    {" | "}
                    Messages:{" "}
                    <span
                      className={
                        metaWebhookDiagnostics.app?.pageMessagesActive
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-amber-700"
                      }
                    >
                      {metaWebhookDiagnostics.app?.pageMessagesActive ? "Activo" : "No activo"}
                    </span>
                  </p>
                  <p className="break-all">
                    Callback: {metaWebhookDiagnostics.app?.callbackUrl ?? "No reportado"}
                  </p>
                  <p>
                    Paginas feed+messages:{" "}
                    {(metaWebhookDiagnostics.pages ?? []).filter((page) => page.subscribed).length}
                    /{metaWebhookDiagnostics.pages?.length ?? 0}
                  </p>
                  <button
                    className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-2 text-xs font-semibold text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
                    disabled={isMetaWebhookSubscribeLoading}
                    onClick={() => void subscribeMetaWebhooks()}
                  >
                    <Settings size={14} />
                    {isMetaWebhookSubscribeLoading
                      ? "Re-suscribiendo..."
                      : "Re-suscribir paginas"}
                  </button>
                  <div className="mt-2 grid gap-1">
                    {(metaWebhookDiagnostics.pages ?? []).map((page) => (
                      <div className="flex items-center justify-between gap-2" key={page.pageId}>
                        <span className="min-w-0 truncate">{page.pageName}</span>
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 font-medium ${
                            page.subscribed
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {page.subscribed ? "feed+messages" : "incompleta"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2">
                    Ultimos eventos guardados: {metaWebhookDiagnostics.latestEvents?.length ?? 0}
                  </p>
                </div>
              ) : null}
              <button
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-900"
                disabled={isMetaAdsDiagnosticsLoading}
                onClick={() => void runMetaAdsDiagnostics()}
              >
                <Settings size={16} />
                {isMetaAdsDiagnosticsLoading ? "Diagnosticando Ads..." : "Diagnosticar Ads"}
              </button>
              {metaAdsDiagnostics ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-900">
                  <p className="font-semibold">Marketing API / Ads</p>
                  <p>
                    Estado:{" "}
                    <span
                      className={
                        metaAdsDiagnostics.ready
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-amber-800"
                      }
                    >
                      {metaAdsDiagnostics.ready ? "Listo" : "Pendiente"}
                    </span>
                  </p>
                  <p>{metaAdsDiagnostics.message}</p>
                  <p>
                    Cuentas publicitarias: {metaAdsDiagnostics.adAccounts.length}
                  </p>
                  {metaAdsDiagnostics.adAccounts.length > 0 ? (
                    <div className="mt-2 grid gap-1">
                      {metaAdsDiagnostics.adAccounts.slice(0, 5).map((account) => (
                        <div className="rounded bg-white/70 px-2 py-1" key={account.id}>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-amber-800/80">
                            {account.accountId ?? account.id}
                            {account.business ? ` · ${account.business}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isMetaAdCommentsSyncing}
                onClick={() => void syncMetaAdComments()}
              >
                <MessageCircle size={16} />
                {isMetaAdCommentsSyncing ? "Sincronizando Ads..." : "Sincronizar comentarios Ads"}
              </button>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {canAutoSyncFacebookComments || canAutoSyncMetaAdComments
                || canAutoSyncInstagramComments
                  ? `Auto-sinc activa: Facebook organico${
                      canAutoSyncMetaAdComments ? " y Ads completo cada 30s" : ""
                    }${
                      canAutoSyncInstagramComments ? " e Instagram comentarios cada 10s" : ""
                    }. Webhooks Meta se diagnostican arriba.`
                  : "Auto-sinc pendiente hasta conceder permisos de lectura de comentarios."}
              </p>
            </div>
          ) : null}
          </div>
        </aside>

        <section
          className={`${mobileInboxPanel === "detail" ? "hidden" : "flex"} min-h-[calc(100vh-96px)] min-w-0 flex-col border-b border-slate-200 bg-white lg:flex lg:h-screen lg:border-b-0 lg:border-r`}
        >
          <div className="shrink-0 border-b border-slate-200 bg-white/95 p-4 backdrop-blur">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar contacto o texto"
                className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["all", "facebook", "instagram"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setNetwork(value)}
                  className={`h-9 rounded-md border text-sm font-medium ${
                    network === value
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {value === "all" ? "Todo" : value === "facebook" ? "Facebook" : "Instagram"}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                ["active", inboxUnreadCount > 0 ? `Bandeja (${inboxUnreadCount})` : "Bandeja"],
                ["responded", "Respondidos"],
                ["archived", "Archivados"],
              ] as const).map(([value, label]) => (
                <button
                  className={`h-9 rounded-md border text-xs font-medium sm:text-sm ${
                    inboxView === value
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                  key={value}
                  onClick={() => {
                    setInboxView(value);
                    setMobileInboxPanel("list");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredItems.length > 0 ? (
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      aria-label="Seleccionar conversaciones visibles"
                      checked={allVisibleSelected}
                      className="size-4 rounded border-slate-300"
                      onChange={(event) => toggleAllVisibleItems(event.target.checked)}
                      type="checkbox"
                    />
                    <span className="truncate sm:hidden">
                      {selectedVisibleCount > 0 ? `${selectedVisibleCount} sel.` : `${filteredItems.length}`}
                    </span>
                    <span className="hidden truncate sm:inline">
                      {selectedVisibleCount > 0
                        ? `${selectedVisibleCount} seleccionada(s)`
                        : `${filteredItems.length} conversacion(es)`}
                    </span>
                  </label>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      className="h-8 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-700 disabled:opacity-40"
                      data-testid="bulk-mark-read"
                      disabled={selectedVisibleCount === 0 || isBulkActionRunning}
                      onClick={() => void runBulkAction("mark_read")}
                    >
                      Leido
                    </button>
                    <button
                      className="h-8 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-700 disabled:opacity-40"
                      data-testid="bulk-mark-unread"
                      disabled={selectedVisibleCount === 0 || isBulkActionRunning}
                      onClick={() => void runBulkAction("mark_unread")}
                    >
                      No leido
                    </button>
                    <button
                      className="h-8 rounded-md border border-slate-950 bg-slate-950 px-2 text-xs font-semibold text-white disabled:opacity-40"
                      data-testid="bulk-archive"
                      disabled={selectedVisibleCount === 0 || isBulkActionRunning}
                      onClick={() =>
                        void runBulkAction(inboxView === "archived" ? "unarchive" : "archive")
                      }
                    >
                      {inboxView === "archived" ? "Desarchivar" : "Archivar"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <InboxRow
                  item={item}
                  key={item.id}
                  selected={item.id === selectedItem?.id}
                  checked={selectedItemSet.has(item.id)}
                  onClick={() => {
                    setSelectedId(item.id);
                    setMobileInboxPanel("detail");
                    setIsMobileAccountsOpen(false);
                  }}
                  onCheckedChange={(checked) => toggleSelectedItem(item.id, checked)}
                />
              ))
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm font-semibold text-slate-800">
                  No hay conversaciones visibles
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {inboxView === "archived"
                    ? "No hay conversaciones archivadas con estos filtros."
                    : inboxView === "responded"
                      ? "No hay conversaciones respondidas con estos filtros."
                    : "Ajusta busqueda, red o cuentas visibles para volver a mostrar items."}
                </p>
                {hiddenAccountCount > 0 ? (
                  <button
                    className="mt-4 h-9 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"
                    onClick={showAllAccounts}
                  >
                    Mostrar todas las cuentas
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <section
          className={`${mobileInboxPanel === "detail" ? "flex" : "hidden"} min-h-screen min-w-0 flex-col bg-[#fbfcfd] lg:flex lg:h-screen lg:min-h-[620px] lg:overflow-hidden`}
        >
          {selectedItem ? (
            <>
              <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                  onClick={() => setMobileInboxPanel("list")}
                >
                  <ChevronLeft size={17} />
                  Volver a bandeja
                </button>
              </div>
              <ConversationHeader
                item={selectedItem}
                onBlockToggle={() => void runAction(selectedItem.blocked ? "unblock" : "block")}
              />
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                <div className="mx-auto max-w-3xl space-y-4">
                  <div className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <NetworkBadge network={selectedItem.network} />
                      <Badge source={selectedItem.source} />
                      {selectedItem.ingestSource ? (
                        <IngestSourceBadge ingestSource={selectedItem.ingestSource} />
                      ) : null}
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {selectedItem.accountName}
                      </span>
                      {selectedItem.campaign ? (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {selectedItem.campaign}
                        </span>
                      ) : null}
                      {selectedItem.hidden ? (
                        <span className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">
                          Oculto
                        </span>
                      ) : null}
                      {selectedItem.blocked ? (
                        <span className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white">
                          Bloqueado
                        </span>
                      ) : null}
                      {selectedItem.status === "archived" ? (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                          Archivado
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Publicacion / contexto
                        </p>
                        <div className="relative">
                          <button
                            className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            onClick={() =>
                              setOpenOriginalPostMenuItemId((current) =>
                                current === selectedItem.id ? null : selectedItem.id,
                              )
                            }
                            title="Opciones de publicacion"
                          >
                            <ExternalLink size={15} />
                          </button>
                          {openOriginalPostMenuItemId === selectedItem.id ? (
                            <div className="absolute right-0 top-9 z-20 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                              <button
                                className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                                disabled={!selectedOriginalPostUrl}
                                onClick={openOriginalPost}
                              >
                                <ExternalLink size={15} />
                                Abrir publicacion original
                              </button>
                              {!selectedOriginalPostUrl ? (
                                <p className="px-2 py-1 text-xs leading-4 text-slate-400">
                                  Falta URL original en este item.
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                        {selectedPostContext}
                      </p>
                    </div>
                  </div>

                  {selectedItem.messages.map((message) => (
                    <div
                      className={`flex ${message.author === "agent" ? "justify-end" : "justify-start"}`}
                      key={message.id}
                    >
                      <div
                        className={`max-w-[84%] rounded-md px-4 py-3 text-sm shadow-sm ${
                          message.author === "agent"
                            ? "bg-slate-950 text-white"
                            : "border border-slate-200 bg-white text-slate-800"
                        }`}
                      >
                        <p className="leading-6">{message.body}</p>
                        <p
                          className={`mt-2 text-xs ${
                            message.author === "agent" ? "text-slate-300" : "text-slate-500"
                          }`}
                        >
                          {message.sentAt}
                        </p>
                        {message.author === "contact" ? (
                          <MessageModerationActions
                            hidden={selectedItem.hidden}
                            network={selectedItem.network}
                            reaction={selectedReaction}
                            onHideToggle={() =>
                              void runAction(selectedItem.hidden ? "unhide" : "hide")
                            }
                            onDelete={
                              isCommentItem(selectedItem)
                                ? () => void runAction("delete_comment")
                                : undefined
                            }
                            onReact={reactToSelectedItem}
                          />
                        ) : (
                          <div className="mt-3 flex justify-end border-t border-white/10 pt-2">
                            <SmallActionButton
                              disabled={!message.providerMessageId}
                              title={
                                message.providerMessageId
                                  ? "Eliminar respuesta en Meta"
                                  : "Esta respuesta no tiene ID de Meta para eliminar"
                              }
                              onClick={() => deleteAgentMessage(message.id)}
                            >
                              <Trash2 size={14} />
                            </SmallActionButton>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white p-4">
                <div className="mx-auto max-w-3xl">
                  {isQuickReplyPanelOpen ? (
                  <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Respuestas rapidas</p>
                        <p className="text-xs text-slate-500">
                          {replies.length} guardadas
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="grid size-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700"
                          onClick={() => setIsQuickReplyPanelOpen(false)}
                          title="Cerrar respuestas rapidas"
                        >
                          <X size={17} />
                        </button>
                        <button
                          className="grid size-9 place-items-center rounded-md bg-slate-950 text-white"
                          data-testid="quick-reply-new"
                          onClick={openNewQuickReply}
                          title="Crear respuesta rapida"
                        >
                          <Plus size={17} />
                        </button>
                      </div>
                    </div>

                    {isQuickReplyEditorOpen ? (
                      <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                        <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                          <input
                            className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-slate-400"
                            data-testid="quick-reply-title"
                            onChange={(event) =>
                              setQuickReplyDraft((current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                            placeholder="Titulo"
                            value={quickReplyDraft.title}
                          />
                          <input
                            className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-slate-400"
                            data-testid="quick-reply-category"
                            onChange={(event) =>
                              setQuickReplyDraft((current) => ({
                                ...current,
                                category: event.target.value,
                              }))
                            }
                            placeholder="Categoria"
                            value={quickReplyDraft.category}
                          />
                        </div>
                        <textarea
                          className="mt-2 min-h-20 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-slate-400"
                          data-testid="quick-reply-body"
                          onChange={(event) =>
                            setQuickReplyDraft((current) => ({
                              ...current,
                              body: event.target.value,
                            }))
                          }
                          placeholder="Texto de respuesta"
                          value={quickReplyDraft.body}
                        />
                        <input
                          className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-slate-400"
                          data-testid="quick-reply-tags"
                          onChange={(event) =>
                            setQuickReplyDraft((current) => ({
                              ...current,
                              tagsText: event.target.value,
                            }))
                          }
                          placeholder="Tags separados por coma"
                          value={quickReplyDraft.tagsText}
                        />
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            className="grid size-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700"
                            onClick={closeQuickReplyEditor}
                            title="Cancelar"
                          >
                            <X size={17} />
                          </button>
                          <button
                            className="grid size-9 place-items-center rounded-md bg-slate-950 text-white"
                            data-testid="quick-reply-save"
                            onClick={saveQuickReply}
                            title="Guardar respuesta rapida"
                          >
                            <Save size={17} />
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-2 sm:flex sm:overflow-x-auto sm:pb-1">
                      {replies.map((reply) => (
                        <div
                          className="rounded-md border border-slate-200 bg-white p-2 sm:shrink-0"
                          key={reply.id}
                        >
                          <button
                            className="block w-full truncate text-left text-xs font-semibold text-slate-800 sm:min-w-36 sm:max-w-56"
                            onClick={() => insertQuickReply(reply)}
                          >
                            {reply.title}
                          </button>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {reply.category}
                          </p>
                          <div className="mt-2 flex gap-1">
                            <button
                              className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-600"
                              onClick={() => openEditQuickReply(reply)}
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="grid size-7 place-items-center rounded-md border border-slate-200 text-slate-600"
                              onClick={() => deleteQuickReply(reply.id)}
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  ) : null}

                  {shouldShowReplyModeSelector ? (
                    <ReplyModeSelector
                      network={selectedItem.network}
                      replyMode={selectedReplyMode}
                      onChange={setReplyModeForSelectedItem}
                    />
                  ) : null}

                  <div className="flex items-end gap-2">
                    <textarea
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      placeholder="Escribir respuesta"
                      className="min-h-24 flex-1 resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-slate-400"
                    />
                    <button
                      className={`grid size-12 shrink-0 place-items-center rounded-md border ${
                        isQuickReplyPanelOpen
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                      onClick={() => setIsQuickReplyPanelOpen((current) => !current)}
                      title="Respuestas rapidas"
                    >
                      <Sparkles size={19} />
                    </button>
                    <button
                      onClick={sendReply}
                      className="grid size-12 shrink-0 place-items-center rounded-md bg-slate-950 text-white"
                      title="Enviar"
                    >
                      <Send size={19} />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <ActionButton
                      active={selectedItem.status === "archived"}
                      title={selectedItem.status === "archived" ? "Desarchivar" : "Archivar"}
                      onClick={() =>
                        void runAction(
                          selectedItem.status === "archived" ? "unarchive" : "archive",
                        )
                      }
                    >
                      <Archive size={17} />
                    </ActionButton>
                    <p className="text-xs text-slate-500">{notice}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-10 text-center text-slate-500">
              No hay conversaciones para mostrar.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InboxRow({
  item,
  selected,
  checked,
  onClick,
  onCheckedChange,
}: {
  item: InboxItem;
  selected: boolean;
  checked: boolean;
  onClick: () => void;
  onCheckedChange: (checked: boolean) => void;
}) {
  const Icon = networkIcon[item.network];

  return (
    <div
      className={`flex w-full gap-3 border-b border-slate-200 p-4 text-left transition ${
        selected ? "bg-slate-100" : "bg-white hover:bg-slate-50"
      }`}
    >
      <input
        aria-label={`Seleccionar ${item.contactName}`}
        checked={checked}
        className="mt-3 size-4 shrink-0 rounded border-slate-300"
        onChange={(event) => onCheckedChange(event.target.checked)}
        type="checkbox"
      />
      <button className="min-w-0 flex-1 text-left" onClick={onClick}>
        <div className="flex gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-md bg-slate-900 text-sm font-semibold text-white">
          {item.avatarInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{item.contactName}</p>
              <p className="truncate text-xs text-slate-500">{item.contactHandle}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-500">{item.receivedAt}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <NetworkBadge network={item.network} />
            <Badge source={item.source} />
            {item.ingestSource ? <IngestSourceBadge ingestSource={item.ingestSource} /> : null}
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              <Icon size={13} className="shrink-0 text-slate-500" />
              <span className="truncate">{item.accountName}</span>
            </span>
            {item.unreadCount ? (
              <span className="grid min-w-5 place-items-center rounded-full bg-rose-600 px-1.5 text-xs font-semibold text-white">
                {item.unreadCount}
              </span>
            ) : null}
            {item.blocked ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                <Ban size={12} />
                Bloqueado
              </span>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{item.preview}</p>
        </div>
      </div>
      </button>
    </div>
  );
}

function Badge({ source }: { source: InboxSource }) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${sourceColors[source]}`}>
      {sourceLabels[source]}
    </span>
  );
}

function IngestSourceBadge({ ingestSource }: { ingestSource: IngestSource }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${ingestSourceColors[ingestSource]}`}
    >
      {ingestSourceLabels[ingestSource]}
    </span>
  );
}

function ConversationHeader({
  item,
  onBlockToggle,
}: {
  item: InboxItem;
  onBlockToggle: () => void;
}) {
  const Icon = networkIcon[item.network];

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-md bg-slate-900 text-sm font-semibold text-white">
            {item.avatarInitials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{item.contactName}</h2>
              <Icon size={17} className="shrink-0 text-slate-500" />
              <button
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold ${
                  item.blocked
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={onBlockToggle}
                title={item.blocked ? "Desbloquear usuario" : "Bloquear usuario"}
              >
                <Ban size={15} />
                {item.blocked ? "Desbloquear" : "Bloquear autor"}
              </button>
            </div>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <NetworkBadge network={item.network} />
              <Badge source={item.source} />
              <span className="min-w-0 truncate text-sm text-slate-500">{item.accountName}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function MessageModerationActions({
  hidden,
  network,
  reaction,
  onDelete,
  onHideToggle,
  onReact,
}: {
  hidden: boolean;
  network: Network;
  reaction: ReactionKind | null;
  onDelete?: () => void;
  onHideToggle: () => void;
  onReact: (reaction: ReactionKind) => void;
}) {
  const isInstagram = network === "instagram";

  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
      <SmallActionButton
        active={reaction === "like"}
        title={reaction === "like" ? "Quitar like" : isInstagram ? "Like" : "Me gusta"}
        onClick={() => onReact("like")}
      >
        {isInstagram ? <Heart size={14} /> : <ThumbsUp size={14} />}
      </SmallActionButton>
      <SmallActionButton
        active={hidden}
        title={hidden ? "Mostrar comentario" : "Ocultar comentario"}
        onClick={onHideToggle}
      >
        {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
      </SmallActionButton>
      {onDelete ? (
        <SmallActionButton
          title="Eliminar comentario"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </SmallActionButton>
      ) : null}
    </div>
  );
}

function SmallActionButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`grid size-7 place-items-center rounded-md border ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
          : active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function ReplyModeSelector({
  network,
  replyMode,
  onChange,
}: {
  network: Network;
  replyMode: ReplyMode;
  onChange: (replyMode: ReplyMode) => void;
}) {
  const privateLabel = network === "instagram" ? "Responder por DM" : "Responder por mensaje interno";
  const privateDescription =
    network === "instagram"
      ? "Envia la respuesta como DM cuando el permiso este conectado."
      : "Envia la respuesta por Messenger cuando el permiso este conectado.";

  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-2">
      <ReplyModeButton
        active={replyMode === "public_comment"}
        description="Etiqueta al usuario y responde sobre el comentario."
        icon={<AtSign size={18} />}
        label="Responder sobre comentario"
        onClick={() => onChange("public_comment")}
      />
      <ReplyModeButton
        active={replyMode === "private_message"}
        description={privateDescription}
        icon={<MessageCircle size={18} />}
        label={privateLabel}
        onClick={() => onChange("private_message")}
      />
    </div>
  );
}

function ReplyModeButton({
  active,
  description,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex min-h-16 items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
      }`}
      onClick={onClick}
      type="button"
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-md ${
          active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-5">{label}</span>
        <span className={`mt-0.5 block text-xs leading-4 ${active ? "text-slate-300" : "text-slate-500"}`}>
          {description}
        </span>
      </span>
    </button>
  );
}

function ActionButton({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`grid size-10 place-items-center rounded-md border ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-700"
      }`}
      title={title}
    >
      {children}
    </button>
  );
}

function NetworkBadge({ network }: { network: Network }) {
  const meta = networkMeta[network];

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${meta.badgeClass}`}>
      {meta.shortLabel}
    </span>
  );
}

function resolveOriginalPostUrl(item: InboxItem) {
  if (item.originalUrl) {
    return item.originalUrl;
  }

  if (item.network === "facebook" && item.providerPostId) {
    return `https://www.facebook.com/${encodeURIComponent(item.providerPostId)}`;
  }

  return null;
}

function resolvePostContextText(item: InboxItem) {
  const title = item.title.trim();
  const commentPrefixWithBreak = "Comentario en:\n";
  const commentPrefixInline = "Comentario en: ";

  if (title.startsWith(commentPrefixWithBreak)) {
    return title.slice(commentPrefixWithBreak.length).trim();
  }

  if (title.startsWith(commentPrefixInline)) {
    return title.slice(commentPrefixInline.length).trim();
  }

  return title;
}

function isCommentItem(item: InboxItem) {
  return item.source === "post_comment" || item.source === "ad_comment";
}

function getDefaultReplyMode(item: InboxItem): ReplyMode {
  return isCommentItem(item) ? "public_comment" : "private_message";
}

function resolveRecipientExternalId(item: InboxItem) {
  const [prefix, value] = item.contactHandle.split(":");

  if ((prefix === "facebook" || prefix === "instagram") && value) {
    return value;
  }

  return undefined;
}

function matchesInboxView(item: InboxItem, inboxView: InboxView) {
  if (inboxView === "archived") {
    return item.status === "archived";
  }

  if (inboxView === "responded") {
    return item.status === "responded";
  }

  return item.status !== "archived" && item.status !== "responded";
}

function createLocalId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}`;
}

function parseTags(tagsText: string) {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isQuickReply(value: unknown): value is QuickReply {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as QuickReply;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.body === "string" &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === "string")
  );
}

function mapQuickReplyRow(row: {
  id: string;
  title: string;
  category: string;
  body: string;
  tags: string[] | null;
}): QuickReply {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    body: row.body,
    tags: row.tags ?? [],
  };
}

function mapConnectedAccountRow(row: ConnectedAccountRow): ChannelConnection {
  const hasRealToken = Boolean(row.access_token_encrypted);
  const isSeedDemo =
    row.provider_account_id.startsWith("fb-") || row.provider_account_id.startsWith("ig-");

  return {
    id: row.id,
    network: row.network,
    name: row.name,
    handle: row.handle ?? "",
    status: hasRealToken ? "connected" : isSeedDemo ? "demo" : "needs_review",
    scopes: row.scopes ?? [],
    lastSync: `Supabase ${formatTimestamp(row.updated_at)}`,
  };
}

function mapInboxItemRow(row: InboxItemRow): InboxItem {
  const account = firstOrNull(row.connected_accounts);
  const contact = firstOrNull(row.contacts);
  const contactName =
    !contact?.display_name || contact.display_name === "Usuario Facebook"
      ? "Autor no disponible"
      : contact.display_name;
  const messages = [...(row.inbox_messages ?? [])].sort(
    (left, right) => new Date(left.sent_at).getTime() - new Date(right.sent_at).getTime(),
  );

  return {
    id: row.id,
    accountId: row.account_id,
    network: account?.network ?? "facebook",
    source: row.source,
    status: row.status,
    sentiment: "neutral",
    accountName: account?.name ?? "Cuenta conectada",
    contactName,
    contactHandle: contact?.handle ?? "Meta no envio identidad del autor",
    avatarInitials: getInitials(contactName),
    title: row.title,
    preview: row.preview,
    receivedAt: formatTimestamp(row.received_at),
    assignee: "Sin asignar",
    providerPostId: row.provider_post_id ?? undefined,
    providerCommentId: row.provider_comment_id ?? undefined,
    ingestSource: row.ingest_source ?? "unknown",
    unreadCount: row.unread_count,
    liked: row.is_liked,
    hidden: row.is_hidden,
    blocked: Boolean(contact?.is_blocked),
    messages: messages.map((message) => ({
      id: message.id,
      providerMessageId: message.provider_message_id ?? undefined,
      author: message.author_type,
      body: message.body,
      sentAt: formatTimestamp(message.sent_at),
    })),
  };
}

function applyInboxActionToItem(
  item: InboxItem,
  action: InboxAction,
  message?: string,
): InboxItem {
  if (action === "reply" && message) {
    return {
      ...item,
      status: "responded",
      unreadCount: 0,
      preview: message,
      messages: [
        ...item.messages,
        {
          id: `local-${Date.now()}`,
          author: "agent",
          body: message,
          sentAt: "Ahora",
        },
      ],
    };
  }

  if (action === "delete_message") {
    return item;
  }

  return {
    ...item,
    liked: action === "like" ? true : action === "unlike" ? false : item.liked,
    hidden: action === "hide" ? true : action === "unhide" ? false : item.hidden,
    blocked: action === "block" ? true : action === "unblock" ? false : item.blocked,
    status:
      action === "archive"
        ? "archived"
        : action === "unarchive"
          ? "open"
          : action === "mark_unread"
            ? "new"
            : action === "mark_read"
              ? item.status === "responded"
                ? "responded"
                : "open"
              : item.status,
    unreadCount:
      action === "archive" || action === "unarchive" || action === "mark_read"
        ? 0
        : action === "mark_unread"
          ? Math.max(item.unreadCount, 1)
          : item.unreadCount,
  };
}

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "??";
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Supabase";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Supabase";
  }

  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveMetaOAuthMessage(result: string | null, params?: URLSearchParams) {
  switch (result) {
    case "accounts_saved": {
      const pages = params?.get("pages") ?? "0";
      const instagram = params?.get("instagram") ?? "0";
      const missingPageTokens = Number(params?.get("missing_page_tokens") ?? "0");
      const webhookSubscribedPages = Number(params?.get("webhook_subscribed_pages") ?? "0");
      const webhookSubscriptionFailures = Number(
        params?.get("webhook_subscription_failures") ?? "0",
      );
      const scopeText = params?.get("scopes") || "sin scopes reportados";
      const pageNames = params?.get("page_names");
      const tokenWarning =
        missingPageTokens > 0
          ? ` ${missingPageTokens} pagina(s) no devolvieron token; falta ampliar permisos.`
          : "";
      const webhookStatus =
        webhookSubscribedPages > 0
          ? ` Webhooks feed+messages suscritos: ${webhookSubscribedPages}.`
          : "";
      const webhookWarning =
        webhookSubscriptionFailures > 0
          ? ` Fallo suscripcion webhook en ${webhookSubscriptionFailures} pagina(s).`
          : "";
      const pagesDetail = pageNames ? ` Paginas devueltas: ${pageNames}.` : "";

      return `Meta conectado: ${pages} pagina(s), ${instagram} Instagram. Scopes: ${scopeText}.${pagesDetail}${webhookStatus}${webhookWarning}${tokenWarning}`;
    }
    case "code_received":
      return "Meta devolvio un codigo OAuth valido. Siguiente paso: intercambio de token con cifrado antes de guardar cuentas reales.";
    case "token_exchange_error":
      return "Meta devolvio codigo, pero fallo el intercambio de token o el guardado de cuentas. Revisa permisos y logs del servidor.";
    case "supabase_missing":
      return "No se pudo guardar Meta porque Supabase service role no esta configurado.";
    case "workspace_not_found":
      return "No se pudo guardar Meta porque el workspace no coincide con tu sesion.";
    case "invalid_state":
      return "Meta devolvio un estado invalido o expirado. Reintenta desde Conectar cuenta Meta.";
    case "missing_code":
      return "Meta no devolvio codigo OAuth. Revisa la configuracion de la app Meta.";
    case "error":
      return "Meta devolvio un error durante la autorizacion.";
    default:
      return "Configura la app Meta y usa OAuth cuando tengas credenciales.";
  }
}
