import { NextResponse } from "next/server";
import { z } from "zod";
import { decryptMetaToken, executeMetaAction, type MetaActionInput } from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";

const actionSchema = z.object({
  itemId: z.string().min(1),
  externalId: z.string().default("demo-external-id"),
  replyMode: z.enum(["public_comment", "private_message"]).optional(),
  recipientExternalId: z.string().optional(),
  messageId: z.string().optional(),
  action: z.enum([
    "reply",
    "like",
    "unlike",
    "hide",
    "unhide",
    "block",
    "unblock",
    "archive",
    "unarchive",
    "mark_read",
    "mark_unread",
    "delete_comment",
    "delete_message",
  ]),
  message: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = actionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceSupabaseClient();
  let actionInput: MetaActionInput = parsed.data;
  let canPersist = false;

  if (supabase) {
    const resolved = await resolveAuthenticatedActionInput({
      supabase,
      request,
      input: parsed.data,
    });

    if (resolved.response) {
      return resolved.response;
    }

    actionInput = resolved.input;
    canPersist = resolved.canPersist;
  }

  const result = await executeMetaAction(actionInput);
  let persisted = false;

  if (supabase && canPersist) {
    if (result.ok) {
      persisted = await persistInboxAction({
        supabase,
        itemId: parsed.data.itemId,
        action: parsed.data.action,
        message: parsed.data.message,
        messageId: parsed.data.messageId,
        providerMessageId: readPrimaryProviderMessageId("payload" in result ? result.payload : null),
      });
    }

    await supabase.from("action_log").insert({
      inbox_item_id: parsed.data.itemId,
      action: parsed.data.action,
      message: parsed.data.message ?? null,
      provider_mode: result.mode,
      provider_ok: result.ok,
      provider_payload: {
        ...result,
        persisted,
        replyMode: parsed.data.replyMode ?? null,
        recipientExternalId: parsed.data.recipientExternalId ?? null,
        messageId: parsed.data.messageId ?? null,
        metaMode: actionInput.accessToken ? "real" : "none",
      },
    });
  }

  return NextResponse.json({ ...result, persisted }, { status: result.ok ? 200 : 502 });
}

async function resolveAuthenticatedActionInput({
  supabase,
  request,
  input,
}: {
  supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>;
  request: Request;
  input: z.infer<typeof actionSchema>;
}): Promise<{
  input: MetaActionInput;
  canPersist: boolean;
  response?: NextResponse;
}> {
  const internalActions = new Set(["archive", "unarchive", "mark_read", "mark_unread"]);
  const metaCommentActions = new Set([
    "reply",
    "like",
    "unlike",
    "hide",
    "unhide",
    "delete_comment",
    "delete_message",
    "block",
    "unblock",
  ]);
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return { input, canPersist: false };
  }

  const userResult = await supabase.auth.getUser(accessToken);
  const user = userResult.data.user;

  if (userResult.error || !user) {
    return {
      input,
      canPersist: false,
      response: NextResponse.json(
        { ok: false, message: "Sesion Supabase invalida o expirada." },
        { status: 401 },
      ),
    };
  }

  const itemResult = await supabase
    .from("inbox_items")
    .select(
      `
      id,
      workspace_id,
      source,
      provider_thread_id,
      provider_comment_id,
      provider_post_id,
      connected_accounts (
        network,
        provider_account_id,
        access_token_encrypted
      ),
      contacts (
        provider_user_id,
        handle
      )
    `,
    )
    .eq("id", input.itemId)
    .maybeSingle();

  if (itemResult.error) {
    return {
      input,
      canPersist: false,
      response: NextResponse.json({ ok: false, message: itemResult.error.message }, { status: 500 }),
    };
  }

  if (!itemResult.data?.id) {
    return { input, canPersist: false };
  }

  const workspaceResult = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", itemResult.data.workspace_id as string)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (workspaceResult.error || !workspaceResult.data?.id) {
    return {
      input,
      canPersist: false,
      response: NextResponse.json(
        { ok: false, message: "Item no pertenece al usuario autenticado." },
        { status: 403 },
      ),
    };
  }

  if (internalActions.has(input.action)) {
    return { input, canPersist: true };
  }

  if (!metaCommentActions.has(input.action)) {
    return { input, canPersist: true };
  }

  const account = firstOrNull(itemResult.data.connected_accounts);
  const contact = firstOrNull(itemResult.data.contacts);
  const providerCommentId = itemResult.data.provider_comment_id as string | null;
  const providerThreadId = itemResult.data.provider_thread_id as string | null;

  if (input.action === "delete_message") {
    const messageResult = await supabase
      .from("inbox_messages")
      .select("id,provider_message_id,author_type")
      .eq("id", input.messageId ?? "")
      .eq("inbox_item_id", input.itemId)
      .maybeSingle();

    if (messageResult.error) {
      return {
        input,
        canPersist: false,
        response: NextResponse.json({ ok: false, message: messageResult.error.message }, { status: 500 }),
      };
    }

    if (!messageResult.data?.id || messageResult.data.author_type !== "agent") {
      return {
        input,
        canPersist: false,
        response: NextResponse.json(
          { ok: false, message: "Solo se pueden eliminar respuestas enviadas desde la app." },
          { status: 403 },
        ),
      };
    }

    if (!messageResult.data.provider_message_id) {
      return {
        input,
        canPersist: false,
        response: NextResponse.json(
          {
            ok: false,
            message:
              "Esta respuesta no tiene ID de Meta guardado; no se puede eliminar de Meta.",
          },
          { status: 409 },
        ),
      };
    }

    if (
      (account?.network !== "facebook" && account?.network !== "instagram") ||
      !account.access_token_encrypted
    ) {
      return {
        input,
        canPersist: false,
        response: NextResponse.json(
          { ok: false, message: "No hay token real para eliminar esta respuesta en Meta." },
          { status: 409 },
        ),
      };
    }

    return {
      input: {
        ...input,
        externalId: messageResult.data.provider_message_id as string,
        network: account.network,
        accountExternalId: account.provider_account_id as string,
        accessToken: decryptMetaToken(account.access_token_encrypted),
      },
      canPersist: true,
    };
  }

  if (input.action === "block" || input.action === "unblock") {
    if (account?.network !== "facebook" || !account.access_token_encrypted) {
      return {
        input,
        canPersist: false,
        response: NextResponse.json(
          { ok: false, message: "No hay page token real para bloquear este autor en Meta." },
          { status: 409 },
        ),
      };
    }

    const providerUserId = readContactProviderUserId(contact);

    if (!providerUserId) {
      return {
        input,
        canPersist: false,
        response: NextResponse.json(
          {
            ok: false,
            message:
              "No hay ID de autor compatible con Meta para bloquearlo en la red social.",
          },
          { status: 409 },
        ),
      };
    }

    return {
      input: {
        ...input,
        externalId: account.provider_account_id as string,
        recipientExternalId: providerUserId,
        accessToken: decryptMetaToken(account.access_token_encrypted),
      },
      canPersist: true,
    };
  }

  if (input.action === "delete_comment") {
    if (
      (account?.network !== "facebook" && account?.network !== "instagram") ||
      !account.access_token_encrypted ||
      !providerCommentId ||
      (itemResult.data.source !== "post_comment" && itemResult.data.source !== "ad_comment")
    ) {
      return {
        input,
        canPersist: false,
        response: NextResponse.json(
          { ok: false, message: "No hay comentario real de Meta para eliminar." },
          { status: 409 },
        ),
      };
    }

    return {
      input: {
        ...input,
        externalId: providerCommentId,
        network: account.network,
        accessToken: decryptMetaToken(account.access_token_encrypted),
      },
      canPersist: true,
    };
  }

  if (
    input.action === "reply" &&
    itemResult.data.source === "messenger" &&
    account?.network === "facebook" &&
    account.access_token_encrypted &&
    providerThreadId
  ) {
    const recipientExternalId = providerThreadId.replace(/^messenger:/, "");

    return {
      input: {
        ...input,
        externalId: providerThreadId.startsWith("messenger:")
          ? providerThreadId
          : `messenger:${providerThreadId}`,
        recipientExternalId,
        replyMode: "private_message",
        accessToken: decryptMetaToken(account.access_token_encrypted),
      },
      canPersist: true,
    };
  }

  if (
    input.action === "reply" &&
    itemResult.data.source === "instagram_dm" &&
    account?.network === "instagram" &&
    account.access_token_encrypted &&
    providerThreadId
  ) {
    const recipientExternalId = providerThreadId.replace(/^instagram:/, "");

    return {
      input: {
        ...input,
        externalId: providerThreadId.startsWith("instagram:")
          ? providerThreadId
          : `instagram:${providerThreadId}`,
        recipientExternalId,
        replyMode: "private_message",
        network: "instagram",
        accountExternalId: account.provider_account_id as string,
        accessToken: decryptMetaToken(account.access_token_encrypted),
      },
      canPersist: true,
    };
  }

  if (
    (account?.network !== "facebook" && account?.network !== "instagram") ||
    !account.access_token_encrypted ||
    !providerCommentId ||
    (itemResult.data.source !== "post_comment" && itemResult.data.source !== "ad_comment")
  ) {
    return { input, canPersist: true };
  }

  return {
    input: {
      ...input,
      externalId: providerCommentId,
      network: account.network,
      accountExternalId: account.provider_account_id as string,
      accessToken: decryptMetaToken(account.access_token_encrypted),
    },
    canPersist: true,
  };
}

function firstOrNull<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function readContactProviderUserId(contact: unknown) {
  if (!contact || typeof contact !== "object") {
    return null;
  }

  const row = contact as { provider_user_id?: unknown; handle?: unknown };

  if (typeof row.provider_user_id === "string" && row.provider_user_id) {
    return row.provider_user_id;
  }

  if (typeof row.handle === "string") {
    const [prefix, value] = row.handle.split(":");

    if (prefix === "facebook" && value) {
      return value;
    }
  }

  return null;
}

async function persistInboxAction({
  supabase,
  itemId,
  action,
  message,
  messageId,
  providerMessageId,
}: {
  supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>;
  itemId: string;
  action: z.infer<typeof actionSchema>["action"];
  message?: string;
  messageId?: string;
  providerMessageId?: string | null;
}) {
  const existing = await supabase
    .from("inbox_items")
    .select("id,contact_id,status")
    .eq("id", itemId)
    .maybeSingle();

  if (existing.error || !existing.data?.id) {
    return false;
  }

  const updatedAt = new Date().toISOString();

  if (action === "reply") {
    if (message?.trim()) {
      await supabase.from("inbox_messages").insert({
        inbox_item_id: itemId,
        provider_message_id: providerMessageId ?? null,
        author_type: "agent",
        body: message.trim(),
        sent_at: updatedAt,
      });
    }

    const { error } = await supabase
      .from("inbox_items")
      .update({
        status: "responded",
        unread_count: 0,
        preview: message?.trim() || undefined,
        updated_at: updatedAt,
      })
      .eq("id", itemId);

    return !error;
  }

  if (action === "delete_message" && messageId) {
    const { error } = await supabase
      .from("inbox_messages")
      .delete()
      .eq("id", messageId)
      .eq("inbox_item_id", itemId)
      .eq("author_type", "agent");

    return !error;
  }

  if (action === "delete_comment") {
    const { error } = await supabase
      .from("inbox_items")
      .delete()
      .eq("id", itemId);

    return !error;
  }

  if (action === "like" || action === "unlike") {
    const { error } = await supabase
      .from("inbox_items")
      .update({
        is_liked: action === "like",
        updated_at: updatedAt,
      })
      .eq("id", itemId);

    return !error;
  }

  if (action === "hide" || action === "unhide") {
    const { error } = await supabase
      .from("inbox_items")
      .update({
        is_hidden: action === "hide",
        updated_at: updatedAt,
      })
      .eq("id", itemId);

    return !error;
  }

  if (action === "archive" || action === "unarchive") {
    const { error } = await supabase
      .from("inbox_items")
      .update({
        status: action === "archive" ? "archived" : "open",
        unread_count: 0,
        updated_at: updatedAt,
      })
      .eq("id", itemId);

    return !error;
  }

  if (action === "mark_read" || action === "mark_unread") {
    const { error } = await supabase
      .from("inbox_items")
      .update({
        status:
          action === "mark_unread"
            ? "new"
            : existing.data.status === "responded"
              ? "responded"
              : "open",
        unread_count: action === "mark_unread" ? 1 : 0,
        updated_at: updatedAt,
      })
      .eq("id", itemId);

    return !error;
  }

  if ((action === "block" || action === "unblock") && existing.data.contact_id) {
    const { error } = await supabase
      .from("contacts")
      .update({
        is_blocked: action === "block",
        updated_at: updatedAt,
      })
      .eq("id", existing.data.contact_id);

    return !error;
  }

  return action === "block" || action === "unblock";
}

function readPrimaryProviderMessageId(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("id" in payload)) {
    return null;
  }

  const id = (payload as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}
