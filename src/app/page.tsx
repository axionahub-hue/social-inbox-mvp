"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  Ban,
  Camera,
  Eye,
  EyeOff,
  Heart,
  MessageCircle,
  MessagesSquare,
  PanelLeft,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { channels, inboxItems, quickReplies } from "@/lib/demo-data";
import type { InboxAction, InboxItem, InboxSource, Network } from "@/lib/types";

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

export default function Home() {
  const [items, setItems] = useState(inboxItems);
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const [query, setQuery] = useState("");
  const [network, setNetwork] = useState<Network | "all">("all");
  const [composer, setComposer] = useState("");
  const [notice, setNotice] = useState("Listo para conectar Meta cuando tengas permisos.");

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesNetwork = network === "all" || item.network === network;
      const text = `${item.contactName} ${item.contactHandle} ${item.title} ${item.preview}`;
      return matchesNetwork && text.toLowerCase().includes(query.toLowerCase());
    });
  }, [items, network, query]);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? items[0];

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
      <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[280px_minmax(320px,420px)_1fr]">
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
              title="Configuracion"
            >
              <Settings size={18} />
            </button>
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

          <div className="mt-6 space-y-3">
            {channels.map((channel) => {
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

          <button className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white">
            <PanelLeft size={17} />
            Conectar cuenta Meta
          </button>
        </aside>

        <section className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
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
          </div>

          <div className="max-h-[44vh] overflow-auto lg:max-h-[calc(100vh-141px)]">
            {filteredItems.map((item) => (
              <InboxRow
                item={item}
                key={item.id}
                selected={item.id === selectedItem?.id}
                onClick={() => setSelectedId(item.id)}
              />
            ))}
          </div>
        </section>

        <section className="flex min-h-[620px] flex-col bg-[#fbfcfd]">
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
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                    {quickReplies.map((reply) => (
                      <button
                        className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-white"
                        key={reply.id}
                        onClick={() => setComposer(reply.body)}
                      >
                        {reply.title}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-end gap-2">
                    <textarea
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      placeholder="Escribir respuesta"
                      className="min-h-24 flex-1 resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-slate-400"
                    />
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
                      <ActionButton title="Archivar">
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
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
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
