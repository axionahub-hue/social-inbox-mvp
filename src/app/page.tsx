"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Archive,
  Ban,
  Camera,
  Eye,
  EyeOff,
  ExternalLink,
  Heart,
  Pencil,
  Plus,
  Save,
  MessageCircle,
  MessagesSquare,
  PanelLeft,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { channels, inboxItems, quickReplies } from "@/lib/demo-data";
import { createBrowserSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";
import type {
  ChannelConnection,
  InboxAction,
  InboxItem,
  InboxSource,
  Network,
  QuickReply,
} from "@/lib/types";
import type { User } from "@supabase/supabase-js";

const sourceLabels: Record<InboxSource, string> = {
  messenger: "Messenger",
  instagram_dm: "Instagram DM",
  post_comment: "Comentario",
  ad_comment: "Comentario ad",
};

const sourceColors: Record<InboxSource, string> = {
  messenger: "bg-sky-50 text-sky-700 ring-sky-200",
  instagram_dm: "bg-pink-50 text-pink-700 ring-pink-200",
  post_comment: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ad_comment: "bg-amber-50 text-amber-800 ring-amber-200",
};

const networkIcon = {
  facebook: MessagesSquare,
  instagram: Camera,
};

const metaRequiredScopes = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_engagement",
  "pages_messaging",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
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
  author_type: "contact" | "agent";
  body: string;
  sent_at: string;
};

type InboxItemRow = {
  id: string;
  account_id: string;
  source: InboxSource;
  status: InboxItem["status"];
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

type InboxView = "active" | "archived";

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
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState<Network | "all">("all");
  const [inboxView, setInboxView] = useState<InboxView>("active");
  const [visibleAccountIds, setVisibleAccountIds] = useState<string[]>(() =>
    channels.map((channel) => channel.id),
  );
  const hasLoadedVisibleAccounts = useRef(false);
  const hasLoadedQuickReplies = useRef(false);
  const hasLoadedRemoteWorkspace = useRef(false);
  const [isQuickReplyPanelOpen, setIsQuickReplyPanelOpen] = useState(false);
  const [isQuickReplyEditorOpen, setIsQuickReplyEditorOpen] = useState(false);
  const [editingQuickReplyId, setEditingQuickReplyId] = useState<string | null>(null);
  const [quickReplyDraft, setQuickReplyDraft] =
    useState<QuickReplyDraft>(emptyQuickReplyDraft);
  const [composer, setComposer] = useState("");
  const [notice, setNotice] = useState("Listo para conectar Meta cuando tengas permisos.");
  const [appOrigin] = useState(() =>
    typeof window === "undefined" ? "http://localhost:3100" : window.location.origin,
  );
  const [isMetaSettingsOpen, setIsMetaSettingsOpen] = useState(() =>
    typeof window === "undefined"
      ? false
      : new URLSearchParams(window.location.search).has("meta_oauth"),
  );
  const [metaConnectionMessage, setMetaConnectionMessage] = useState(() =>
    typeof window === "undefined"
      ? "Configura la app Meta y usa OAuth cuando tengas credenciales."
      : resolveMetaOAuthMessage(new URLSearchParams(window.location.search).get("meta_oauth")),
  );

  const visibleAccountSet = useMemo(() => new Set(visibleAccountIds), [visibleAccountIds]);
  const hiddenAccountCount = channelList.length - visibleAccountIds.length;
  const archivedCount = items.filter((item) => item.status === "archived").length;
  const activeCount = items.length - archivedCount;
  const workspaceBootstrap = useRef<{
    userId: string;
    promise: Promise<string | null>;
  } | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesAccount = visibleAccountSet.has(item.accountId);
      const matchesNetwork = network === "all" || item.network === network;
      const matchesView =
        inboxView === "archived" ? item.status === "archived" : item.status !== "archived";
      const text = `${item.contactName} ${item.contactHandle} ${item.title} ${item.preview}`;
      const matchesQuery = text.toLowerCase().includes(query.toLowerCase());
      return matchesAccount && matchesNetwork && matchesQuery && matchesView;
    });
  }, [inboxView, items, network, query, visibleAccountSet]);

  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0];
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
      .select("id,network,provider_account_id,name,handle,scopes,updated_at")
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

    const inbox = await supabase
      .from("inbox_items")
      .select(`
        id,
        account_id,
        source,
        status,
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
          author_type,
          body,
          sent_at
        )
      `)
      .eq("workspace_id", workspaceId)
      .order("received_at", { ascending: false });

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

  async function runAction(action: InboxAction, message?: string) {
    if (!selectedItem) return;

    const response = await fetch("/api/inbox/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: selectedItem.id,
        externalId: selectedItem.id,
        action,
        message,
      }),
    });

    const result = await response.json();
    setNotice(result.message ?? "Accion registrada.");

    setItems((current) =>
      current.map((item) => {
        if (item.id !== selectedItem.id) return item;

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

        return {
          ...item,
          liked: action === "like" ? true : action === "unlike" ? false : item.liked,
          hidden: action === "hide" ? true : action === "unhide" ? false : item.hidden,
          blocked: action === "block" ? true : item.blocked,
          status:
            action === "archive" ? "archived" : action === "unarchive" ? "open" : item.status,
          unreadCount:
            action === "archive" || action === "unarchive" ? 0 : item.unreadCount,
        };
      }),
    );
  }

  function sendReply() {
    const message = composer.trim();
    if (!message) return;
    void runAction("reply", message);
    setComposer("");
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[280px_minmax(320px,420px)_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Social Inbox
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                Bandeja unificada
              </h1>
            </div>
            <button
              className="grid size-10 place-items-center rounded-md border border-slate-200 text-slate-700"
              onClick={() => setIsMetaSettingsOpen((current) => !current)}
              title="Configuracion"
            >
              <Settings size={18} />
            </button>
          </div>

          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold">Sesion</p>
            {supabase ? (
              currentUser ? (
                <>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {currentUser.email}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Supabase activo
                  </p>
                  <button
                    className="mt-3 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
                    onClick={() => void signOut()}
                  >
                    Cerrar sesion
                  </button>
                </>
              ) : (
                <>
                  <input
                    className="mt-3 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="tu@email.com"
                    type="email"
                    value={authEmail}
                  />
                  <button
                    className="mt-2 h-9 w-full rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"
                    onClick={() => void sendMagicLink()}
                  >
                    Enviar acceso
                  </button>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {authMessage}
                  </p>
                </>
              )
            ) : (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Sin variables de Supabase. La app guarda datos en este navegador.
              </p>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Metric label="Nuevo" value={items.filter((item) => item.status === "new").length} />
            <Metric
              label="Abierto"
              value={items.filter((item) => item.status === "open").length}
            />
            <Metric
              label="Oculto"
              value={items.filter((item) => item.hidden).length}
            />
          </div>

          <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
            Inbox: {inboxSource === "supabase" ? "Supabase" : "demo local"}
          </p>

          <div className="mt-6 space-y-3">
            {channelList.map((channel) => {
              const Icon = networkIcon[channel.network];
              return (
                <div
                  className="rounded-md border border-slate-200 bg-slate-50 p-3"
                  key={channel.id}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-md bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{channel.name}</p>
                      <p className="truncate text-xs text-slate-500">{channel.handle}</p>
                    </div>
                    <ShieldCheck size={17} className="text-emerald-600" />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{channel.lastSync}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Cuentas visibles</p>
                <p className="text-xs text-slate-500">
                  {visibleAccountIds.length} de {channelList.length} activas
                </p>
              </div>
              {hiddenAccountCount > 0 ? (
                <button
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
                  onClick={showAllAccounts}
                >
                  Mostrar todas
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-2">
              {channelList.map((channel) => {
                const Icon = networkIcon[channel.network];
                const isVisible = visibleAccountSet.has(channel.id);
                const accountItems = items.filter((item) => item.accountId === channel.id).length;

                return (
                  <button
                    className="flex w-full items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-left"
                    data-testid={`account-toggle-${channel.id}`}
                    key={channel.id}
                    onClick={() => toggleAccountVisibility(channel.id)}
                    aria-pressed={isVisible}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{channel.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {accountItems} items
                      </span>
                    </span>
                    <span
                      className={`h-6 w-11 rounded-full p-0.5 transition ${
                        isVisible ? "bg-slate-950" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`block size-5 rounded-full bg-white transition ${
                          isVisible ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white"
            onClick={() => setIsMetaSettingsOpen(true)}
          >
            <PanelLeft size={17} />
            Conectar cuenta Meta
          </button>

          {isMetaSettingsOpen ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
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
            </div>
          ) : null}
        </aside>

        <section className="min-w-0 border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur">
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
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                ["active", `Bandeja (${activeCount})`],
                ["archived", `Archivados (${archivedCount})`],
              ] as const).map(([value, label]) => (
                <button
                  className={`h-9 rounded-md border text-sm font-medium ${
                    inboxView === value
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                  key={value}
                  onClick={() => setInboxView(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[44vh] overflow-auto lg:max-h-[calc(100vh-141px)]">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <InboxRow
                  item={item}
                  key={item.id}
                  selected={item.id === selectedItem?.id}
                  onClick={() => setSelectedId(item.id)}
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

        <section className="flex min-h-[620px] min-w-0 flex-col bg-[#fbfcfd]">
          {selectedItem ? (
            <>
              <ConversationHeader item={selectedItem} />
              <div className="flex-1 overflow-auto px-4 py-4 sm:px-6">
                <div className="mx-auto max-w-3xl space-y-4">
                  <div className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge source={selectedItem.source} />
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
                    <p className="mt-3 text-sm text-slate-600">{selectedItem.title}</p>
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-white p-4">
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
                    <div className="flex gap-2">
                      <ActionButton
                        active={selectedItem.liked}
                        title={selectedItem.liked ? "Quitar like" : "Dar like"}
                        onClick={() => void runAction(selectedItem.liked ? "unlike" : "like")}
                      >
                        <Heart size={17} />
                      </ActionButton>
                      <ActionButton
                        active={selectedItem.hidden}
                        title={selectedItem.hidden ? "Mostrar" : "Ocultar"}
                        onClick={() => void runAction(selectedItem.hidden ? "unhide" : "hide")}
                      >
                        {selectedItem.hidden ? <Eye size={17} /> : <EyeOff size={17} />}
                      </ActionButton>
                      <ActionButton title="Bloquear usuario" onClick={() => void runAction("block")}>
                        <Ban size={17} />
                      </ActionButton>
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
                    </div>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function InboxRow({
  item,
  selected,
  onClick,
}: {
  item: InboxItem;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = networkIcon[item.network];

  return (
    <button
      onClick={onClick}
      className={`w-full border-b border-slate-200 p-4 text-left transition ${
        selected ? "bg-slate-100" : "bg-white hover:bg-slate-50"
      }`}
    >
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
          <div className="mt-2 flex items-center gap-2">
            <Icon size={15} className="text-slate-500" />
            <Badge source={item.source} />
            {item.unreadCount ? (
              <span className="grid min-w-5 place-items-center rounded-full bg-rose-600 px-1.5 text-xs font-semibold text-white">
                {item.unreadCount}
              </span>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{item.preview}</p>
        </div>
      </div>
    </button>
  );
}

function Badge({ source }: { source: InboxSource }) {
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ring-1 ${sourceColors[source]}`}>
      {sourceLabels[source]}
    </span>
  );
}

function ConversationHeader({ item }: { item: InboxItem }) {
  const Icon = networkIcon[item.network];

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-md bg-slate-900 text-sm font-semibold text-white">
            {item.avatarInitials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{item.contactName}</h2>
              <Icon size={17} className="shrink-0 text-slate-500" />
            </div>
            <p className="truncate text-sm text-slate-500">{item.accountName}</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            {item.assignee}
          </span>
          <span className="grid size-9 place-items-center rounded-md border border-slate-200">
            <MessageCircle size={17} />
          </span>
          <span className="grid size-9 place-items-center rounded-md border border-slate-200">
            <Sparkles size={17} />
          </span>
        </div>
      </div>
    </header>
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
  return {
    id: row.id,
    network: row.network,
    name: row.name,
    handle: row.handle ?? "",
    status: "demo",
    scopes: row.scopes ?? [],
    lastSync: `Supabase ${formatTimestamp(row.updated_at)}`,
  };
}

function mapInboxItemRow(row: InboxItemRow): InboxItem {
  const account = firstOrNull(row.connected_accounts);
  const contact = firstOrNull(row.contacts);
  const contactName = contact?.display_name ?? "Contacto";
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
    contactHandle: contact?.handle ?? "",
    avatarInitials: getInitials(contactName),
    title: row.title,
    preview: row.preview,
    receivedAt: formatTimestamp(row.received_at),
    assignee: "Sin asignar",
    unreadCount: row.unread_count,
    liked: row.is_liked,
    hidden: row.is_hidden,
    blocked: Boolean(contact?.is_blocked),
    messages: messages.map((message) => ({
      id: message.id,
      author: message.author_type,
      body: message.body,
      sentAt: formatTimestamp(message.sent_at),
    })),
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveMetaOAuthMessage(result: string | null) {
  switch (result) {
    case "code_received":
      return "Meta devolvio un codigo OAuth valido. Siguiente paso: intercambio de token con cifrado antes de guardar cuentas reales.";
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
