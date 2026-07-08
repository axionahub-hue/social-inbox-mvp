import { decryptMetaToken, executeMetaAction, type MetaActionInput } from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";
import type { InboxAction, ReplyMode } from "@/lib/types";

export type SupabaseServiceClient = NonNullable<ReturnType<typeof createServiceSupabaseClient>>;

export type InboxActionPayload = {
  itemId: string;
  externalId: string;
  action: InboxAction;
  message?: string;
  messageId?: string;
  replyMode?: ReplyMode;
  recipientExternalId?: string;
};

type ActionResolution = {
  input: MetaActionInput;
  canPersist: boolean;
  workspaceId?: string;
  error?: {
    status: number;
    message: string;
  };
};

type QueueRow = {
  id: string;
  workspace_id: string;
  inbox_item_id: string;
  action: InboxAction;
  payload: InboxActionPayload;
  previous_state: Record<string, unknown>;
};

const internalActions = new Set<InboxAction>([
  "archive",
  "unarchive",
  "mark_read",
  "mark_unread",
]);

const queueableMetaActions = new Set<InboxAction>([
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

export function shouldQueueAction(action: InboxAction, actionInput: MetaActionInput) {
  return queueableMetaActions.has(action) && Boolean(actionInput.accessToken);
}

export async function resolveAuthenticatedActionInput({
  accessToken,
  input,
  supabase,
}: {
  accessToken: string | null;
  input: InboxActionPayload;
  supabase: SupabaseServiceClient;
}): Promise<ActionResolution> {
  if (!accessToken) {
    return { input, canPersist: false };
  }

  const userResult = await supabase.auth.getUser(accessToken);
  const user = userResult.data.user;

  if (userResult.error || !user) {
    return {
      input,
      canPersist: false,
      error: { status: 401, message: "Sesion Supabase invalida o expirada." },
    };
  }

  return resolveActionInputFromItem({
    input,
    supabase,
    userId: user.id,
  });
}

export async function enqueueInboxAction({
  input,
  supabase,
  workspaceId,
}: {
  input: InboxActionPayload;
  supabase: SupabaseServiceClient;
  workspaceId: string;
}) {
  const previousState = await readPreviousState({ input, supabase });
  const inserted = await supabase
    .from("action_queue")
    .insert({
      workspace_id: workspaceId,
      inbox_item_id: input.itemId,
      action: input.action,
      payload: input,
      previous_state: previousState,
      status: "queued",
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data?.id) {
    throw new Error(inserted.error?.message ?? "No se pudo encolar la accion.");
  }

  await applyOptimisticQueuedAction({
    input,
    queueId: inserted.data.id as string,
    supabase,
  });

  return inserted.data.id as string;
}

export async function executeAndPersistAction({
  actionInput,
  input,
  providerQueueId = null,
  supabase,
}: {
  actionInput: MetaActionInput;
  input: InboxActionPayload;
  providerQueueId?: string | null;
  supabase: SupabaseServiceClient;
}) {
  const result = await executeMetaAction(actionInput);
  let persisted = false;

  if (result.ok) {
    persisted = await persistInboxAction({
      action: input.action,
      message: input.message,
      messageId: input.messageId,
      providerMessageId: readPrimaryProviderMessageId("payload" in result ? result.payload : null),
      queueId: providerQueueId,
      supabase,
      itemId: input.itemId,
    });
  }

  await insertActionLog({
    input,
    result,
    persisted,
    actionInput,
    supabase,
  });

  return { ...result, persisted };
}

export async function processQueuedInboxActions({
  limit = 5,
  supabase = createServiceSupabaseClient(),
}: {
  limit?: number;
  supabase?: SupabaseServiceClient | null;
} = {}) {
  if (!supabase) {
    return { processed: 0, failed: 0 };
  }

  const queued = await supabase
    .from("action_queue")
    .select("id,workspace_id,inbox_item_id,action,payload,previous_state")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (queued.error) {
    throw new Error(queued.error.message);
  }

  let processed = 0;
  let failed = 0;

  for (const row of (queued.data ?? []) as QueueRow[]) {
    const locked = await supabase
      .from("action_queue")
      .update({
        status: "processing",
        attempt_count: 1,
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();

    if (locked.error || !locked.data?.id) {
      continue;
    }

    try {
      const resolved = await resolveActionInputFromItem({
        input: row.payload,
        supabase,
        workspaceId: row.workspace_id,
      });

      if (resolved.error || !resolved.canPersist) {
        throw new Error(resolved.error?.message ?? "No se pudo resolver la accion encolada.");
      }

      const result = await executeMetaAction(resolved.input);

      if (!result.ok) {
        await markQueuedActionFailed({
          actionInput: resolved.input,
          input: row.payload,
          queue: row,
          result,
          supabase,
        });
        failed += 1;
        continue;
      }

      const persisted = await persistInboxAction({
        action: row.payload.action,
        message: row.payload.message,
        messageId: row.payload.messageId,
        providerMessageId: readPrimaryProviderMessageId("payload" in result ? result.payload : null),
        queueId: row.id,
        supabase,
        itemId: row.payload.itemId,
      });

      await supabase
        .from("action_queue")
        .update({
          status: "succeeded",
          provider_mode: result.mode,
          provider_ok: result.ok,
          provider_payload: { ...result, persisted },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      await insertActionLog({
        actionInput: resolved.input,
        input: row.payload,
        persisted,
        queueId: row.id,
        result,
        supabase,
      });

      processed += 1;
    } catch (error) {
      await markQueuedActionFailed({
        input: row.payload,
        queue: row,
        result: {
          ok: false,
          mode: "real",
          message: error instanceof Error ? error.message : "Fallo desconocido en accion encolada.",
        },
        supabase,
      });
      failed += 1;
    }
  }

  return { processed, failed };
}

async function resolveActionInputFromItem({
  input,
  supabase,
  userId,
  workspaceId,
}: {
  input: InboxActionPayload;
  supabase: SupabaseServiceClient;
  userId?: string;
  workspaceId?: string;
}): Promise<ActionResolution> {
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
      error: { status: 500, message: itemResult.error.message },
    };
  }

  if (!itemResult.data?.id) {
    return { input, canPersist: false };
  }

  const itemWorkspaceId = itemResult.data.workspace_id as string;

  if (workspaceId && itemWorkspaceId !== workspaceId) {
    return {
      input,
      canPersist: false,
      error: { status: 403, message: "Item no pertenece al workspace de la cola." },
    };
  }

  if (userId) {
    const workspaceResult = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", itemWorkspaceId)
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (workspaceResult.error || !workspaceResult.data?.id) {
      return {
        input,
        canPersist: false,
        error: { status: 403, message: "Item no pertenece al usuario autenticado." },
      };
    }
  }

  if (internalActions.has(input.action)) {
    return { input, canPersist: true, workspaceId: itemWorkspaceId };
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
        error: { status: 500, message: messageResult.error.message },
      };
    }

    if (!messageResult.data?.id || messageResult.data.author_type !== "agent") {
      return {
        input,
        canPersist: false,
        error: { status: 403, message: "Solo se pueden eliminar respuestas enviadas desde la app." },
      };
    }

    if (!messageResult.data.provider_message_id) {
      return {
        input,
        canPersist: false,
        error: {
          status: 409,
          message: "Esta respuesta no tiene ID de Meta guardado; no se puede eliminar de Meta.",
        },
      };
    }

    if (
      (account?.network !== "facebook" && account?.network !== "instagram") ||
      !account.access_token_encrypted
    ) {
      return {
        input,
        canPersist: false,
        error: { status: 409, message: "No hay token real para eliminar esta respuesta en Meta." },
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
      workspaceId: itemWorkspaceId,
    };
  }

  if (input.action === "block" || input.action === "unblock") {
    if (account?.network !== "facebook" || !account.access_token_encrypted) {
      return {
        input,
        canPersist: false,
        error: { status: 409, message: "No hay page token real para bloquear este autor en Meta." },
      };
    }

    const providerUserId = readContactProviderUserId(contact);

    if (!providerUserId) {
      return {
        input,
        canPersist: false,
        error: {
          status: 409,
          message: "No hay ID de autor compatible con Meta para bloquearlo en la red social.",
        },
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
      workspaceId: itemWorkspaceId,
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
        error: { status: 409, message: "No hay comentario real de Meta para eliminar." },
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
      workspaceId: itemWorkspaceId,
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
      workspaceId: itemWorkspaceId,
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
      workspaceId: itemWorkspaceId,
    };
  }

  if (
    (account?.network !== "facebook" && account?.network !== "instagram") ||
    !account.access_token_encrypted ||
    !providerCommentId ||
    (itemResult.data.source !== "post_comment" && itemResult.data.source !== "ad_comment")
  ) {
    return { input, canPersist: true, workspaceId: itemWorkspaceId };
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
    workspaceId: itemWorkspaceId,
  };
}

async function readPreviousState({
  input,
  supabase,
}: {
  input: InboxActionPayload;
  supabase: SupabaseServiceClient;
}) {
  const item = await supabase
    .from("inbox_items")
    .select(
      `
      id,
      contact_id,
      status,
      unread_count,
      preview,
      is_liked,
      is_hidden,
      action_state,
      action_error,
      action_queue_id,
      contacts (is_blocked)
    `,
    )
    .eq("id", input.itemId)
    .maybeSingle();

  if (item.error || !item.data?.id) {
    return {};
  }

  const contact = firstOrNull(item.data.contacts);

  return {
    ...item.data,
    contacts: undefined,
    contact_is_blocked: Boolean(contact?.is_blocked),
  };
}

async function applyOptimisticQueuedAction({
  input,
  queueId,
  supabase,
}: {
  input: InboxActionPayload;
  queueId: string;
  supabase: SupabaseServiceClient;
}) {
  const updatedAt = new Date().toISOString();
  const baseItemUpdate = {
    action_state: "pending",
    action_error: null,
    action_queue_id: queueId,
    updated_at: updatedAt,
  };

  if (input.action === "reply" && input.message?.trim()) {
    await supabase.from("inbox_messages").insert({
      inbox_item_id: input.itemId,
      provider_message_id: null,
      author_type: "agent",
      body: input.message.trim(),
      delivery_status: "pending",
      action_queue_id: queueId,
      sent_at: updatedAt,
    });

    await supabase
      .from("inbox_items")
      .update({
        ...baseItemUpdate,
        status: "responded",
        unread_count: 0,
        preview: input.message.trim(),
      })
      .eq("id", input.itemId);
    return;
  }

  if (input.action === "delete_message" && input.messageId) {
    await supabase
      .from("inbox_messages")
      .update({
        delivery_status: "pending_delete",
        action_queue_id: queueId,
      })
      .eq("id", input.messageId)
      .eq("inbox_item_id", input.itemId)
      .eq("author_type", "agent");
  }

  if (input.action === "delete_comment") {
    await supabase
      .from("inbox_items")
      .update(baseItemUpdate)
      .eq("id", input.itemId);
    return;
  }

  if (input.action === "like" || input.action === "unlike") {
    await supabase
      .from("inbox_items")
      .update({
        ...baseItemUpdate,
        is_liked: input.action === "like",
      })
      .eq("id", input.itemId);
    return;
  }

  if (input.action === "hide" || input.action === "unhide") {
    await supabase
      .from("inbox_items")
      .update({
        ...baseItemUpdate,
        is_hidden: input.action === "hide",
      })
      .eq("id", input.itemId);
    return;
  }

  if (input.action === "block" || input.action === "unblock") {
    const existing = await supabase
      .from("inbox_items")
      .select("contact_id")
      .eq("id", input.itemId)
      .maybeSingle();

    if (existing.data?.contact_id) {
      await supabase
        .from("contacts")
        .update({
          is_blocked: input.action === "block",
          updated_at: updatedAt,
        })
        .eq("id", existing.data.contact_id);
    }

    await supabase
      .from("inbox_items")
      .update(baseItemUpdate)
      .eq("id", input.itemId);
    return;
  }

  await supabase
    .from("inbox_items")
    .update(baseItemUpdate)
    .eq("id", input.itemId);
}

async function markQueuedActionFailed({
  actionInput,
  input,
  queue,
  result,
  supabase,
}: {
  actionInput?: MetaActionInput;
  input: InboxActionPayload;
  queue: QueueRow;
  result: { ok: boolean; mode: string; message?: string; payload?: unknown };
  supabase: SupabaseServiceClient;
}) {
  const message = result.message ?? "Meta no pudo ejecutar la accion.";
  const previous = queue.previous_state ?? {};

  await supabase
    .from("action_queue")
    .update({
      status: "failed",
      provider_mode: result.mode,
      provider_ok: false,
      provider_payload: result,
      last_error: message,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", queue.id);

  await restoreFailedItem({
    input,
    message,
    previous,
    queueId: queue.id,
    supabase,
  });

  await insertActionLog({
    actionInput,
    input,
    persisted: false,
    queueId: queue.id,
    result,
    supabase,
  });
}

async function restoreFailedItem({
  input,
  message,
  previous,
  queueId,
  supabase,
}: {
  input: InboxActionPayload;
  message: string;
  previous: Record<string, unknown>;
  queueId: string;
  supabase: SupabaseServiceClient;
}) {
  const restoredFields: Record<string, unknown> = {
    status: "new",
    unread_count: 1,
    action_state: "failed",
    action_error: message,
    action_queue_id: queueId,
    updated_at: new Date().toISOString(),
  };

  if (typeof previous.is_liked === "boolean") {
    restoredFields.is_liked = previous.is_liked;
  }

  if (typeof previous.is_hidden === "boolean") {
    restoredFields.is_hidden = previous.is_hidden;
  }

  if (typeof previous.preview === "string" && input.action !== "reply") {
    restoredFields.preview = previous.preview;
  }

  await supabase.from("inbox_items").update(restoredFields).eq("id", input.itemId);

  if (input.action === "reply") {
    await supabase
      .from("inbox_messages")
      .update({ delivery_status: "failed" })
      .eq("action_queue_id", queueId)
      .eq("author_type", "agent");
  }

  if (input.action === "delete_message" && input.messageId) {
    await supabase
      .from("inbox_messages")
      .update({ delivery_status: "sent", action_queue_id: null })
      .eq("id", input.messageId)
      .eq("action_queue_id", queueId);
  }

  if ((input.action === "block" || input.action === "unblock") && previous.contact_id) {
    await supabase
      .from("contacts")
      .update({
        is_blocked: Boolean(previous.contact_is_blocked),
        updated_at: new Date().toISOString(),
      })
      .eq("id", previous.contact_id as string);
  }
}

async function persistInboxAction({
  supabase,
  itemId,
  action,
  message,
  messageId,
  providerMessageId,
  queueId,
}: {
  supabase: SupabaseServiceClient;
  itemId: string;
  action: InboxAction;
  message?: string;
  messageId?: string;
  providerMessageId?: string | null;
  queueId?: string | null;
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
    if (queueId) {
      await supabase
        .from("inbox_messages")
        .update({
          provider_message_id: providerMessageId ?? null,
          delivery_status: "sent",
        })
        .eq("action_queue_id", queueId)
        .eq("author_type", "agent");
    } else if (message?.trim()) {
      await supabase.from("inbox_messages").insert({
        inbox_item_id: itemId,
        provider_message_id: providerMessageId ?? null,
        author_type: "agent",
        body: message.trim(),
        delivery_status: "sent",
        sent_at: updatedAt,
      });
    }

    const { error } = await supabase
      .from("inbox_items")
      .update({
        status: "responded",
        unread_count: 0,
        preview: message?.trim() || undefined,
        action_state: null,
        action_error: null,
        action_queue_id: null,
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

    await clearItemActionState({ itemId, supabase, updatedAt });
    return !error;
  }

  if (action === "delete_comment") {
    const { error } = await supabase.from("inbox_items").delete().eq("id", itemId);
    return !error;
  }

  if (action === "like" || action === "unlike") {
    const { error } = await supabase
      .from("inbox_items")
      .update({
        is_liked: action === "like",
        action_state: null,
        action_error: null,
        action_queue_id: null,
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
        action_state: null,
        action_error: null,
        action_queue_id: null,
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
        action_state: null,
        action_error: null,
        action_queue_id: null,
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
        action_state: null,
        action_error: null,
        action_queue_id: null,
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

    await clearItemActionState({ itemId, supabase, updatedAt });
    return !error;
  }

  await clearItemActionState({ itemId, supabase, updatedAt });
  return action === "block" || action === "unblock";
}

async function clearItemActionState({
  itemId,
  supabase,
  updatedAt,
}: {
  itemId: string;
  supabase: SupabaseServiceClient;
  updatedAt: string;
}) {
  await supabase
    .from("inbox_items")
    .update({
      action_state: null,
      action_error: null,
      action_queue_id: null,
      updated_at: updatedAt,
    })
    .eq("id", itemId);
}

async function insertActionLog({
  actionInput,
  input,
  persisted,
  queueId,
  result,
  supabase,
}: {
  actionInput?: MetaActionInput;
  input: InboxActionPayload;
  persisted: boolean;
  queueId?: string | null;
  result: { ok: boolean; mode: string; message?: string; payload?: unknown };
  supabase: SupabaseServiceClient;
}) {
  await supabase.from("action_log").insert({
    inbox_item_id: input.itemId,
    action: input.action,
    message: input.message ?? null,
    provider_mode: result.mode,
    provider_ok: result.ok,
    provider_payload: {
      ...result,
      persisted,
      queueId: queueId ?? null,
      replyMode: input.replyMode ?? null,
      recipientExternalId: input.recipientExternalId ?? null,
      messageId: input.messageId ?? null,
      metaMode: actionInput?.accessToken ? "real" : "none",
    },
  });
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

function readPrimaryProviderMessageId(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("id" in payload)) {
    return null;
  }

  const id = (payload as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}
