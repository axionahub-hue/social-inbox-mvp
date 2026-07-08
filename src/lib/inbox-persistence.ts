import type { MetaOrganicComment } from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";
import type { InboxSource } from "@/lib/types";

export type SupabaseServiceClient = NonNullable<ReturnType<typeof createServiceSupabaseClient>>;
export type CommentPersistenceResult = "inserted" | "updated" | "skipped_self";

export type MetaMessengerMessage = {
  senderId: string;
  recipientId: string | null;
  messageId: string;
  text: string;
  timestamp: string | null;
  senderName?: string | null;
  senderUsername?: string | null;
  senderProfilePic?: string | null;
};

export async function persistFacebookComment({
  supabase,
  workspaceId,
  accountId,
  accountExternalId,
  accountName,
  comment,
  ingestSource = "unknown",
  source = "post_comment",
  providerAdId = null,
}: {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  accountId: string;
  accountExternalId: string;
  accountName: string;
  comment: MetaOrganicComment;
  ingestSource?: "webhook" | "polling_fast" | "polling_full" | "ads_auto" | "ads_manual" | "unknown";
  source?: InboxSource;
  providerAdId?: string | null;
}): Promise<CommentPersistenceResult> {
  if (isSelfAuthoredComment({ authorId: comment.fromId, accountExternalId })) {
    return "skipped_self";
  }

  const contactId = await ensureFacebookContact({
    supabase,
    workspaceId,
    comment,
  });
  const existingItem = await supabase
    .from("inbox_items")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .eq("provider_comment_id", comment.commentId)
    .maybeSingle();
  const now = new Date().toISOString();
  const receivedAt = normalizeDate(comment.createdTime) ?? now;
  const title = comment.postMessage
    ? `Comentario en:\n${comment.postMessage}`
    : `Comentario en ${accountName}`;
  const preview = comment.message || "(comentario sin texto)";
  const threadContextForUpdate = resolveCommentThreadContext(comment, { preserveExisting: true });
  const threadContextForInsert = resolveCommentThreadContext(comment);

  if (existingItem.error) {
    throw new Error(existingItem.error.message);
  }

  if (existingItem.data?.id) {
    const nextContactId =
      comment.fromId || comment.fromName ? contactId : await resolveExistingItemContactId({
        supabase,
        itemId: existingItem.data.id as string,
        fallbackContactId: contactId,
      });
    const updatePayload = {
      contact_id: nextContactId,
      title,
      preview,
      source,
      is_hidden: comment.isHidden,
      ingest_source: ingestSource,
      provider_post_id: comment.postId,
      provider_ad_id: providerAdId,
      provider_permalink_url: comment.permalink ?? comment.postPermalink ?? null,
      ...threadContextForUpdate,
      updated_at: now,
    };
    const updateResult = await supabase
      .from("inbox_items")
      .update(updatePayload)
      .eq("id", existingItem.data.id);

    if (updateResult.error) {
      if (!isOptionalInboxColumnError(updateResult.error.message)) {
        throw new Error(updateResult.error.message);
      }

      const retryResult = await supabase
        .from("inbox_items")
        .update({
          contact_id: nextContactId,
          title,
          preview,
          source,
          is_hidden: comment.isHidden,
          provider_post_id: comment.postId,
          provider_ad_id: providerAdId,
          updated_at: now,
        })
        .eq("id", existingItem.data.id);

      if (retryResult.error) {
        throw new Error(retryResult.error.message);
      }
    }

    await ensureFacebookMessage({
      supabase,
      inboxItemId: existingItem.data.id,
      comment,
      receivedAt,
    });

    return "updated";
  }

  const insertPayload = {
    workspace_id: workspaceId,
    account_id: accountId,
    contact_id: contactId,
    source,
    status: "new",
    provider_thread_id: comment.postId,
    provider_comment_id: comment.commentId,
    provider_post_id: comment.postId,
    provider_ad_id: providerAdId,
    provider_permalink_url: comment.permalink ?? comment.postPermalink ?? null,
    ...threadContextForInsert,
    title,
    preview,
    is_hidden: comment.isHidden,
    ingest_source: ingestSource,
    unread_count: 1,
    received_at: receivedAt,
    updated_at: now,
  };
  let insertResult = await supabase
    .from("inbox_items")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertResult.error && isOptionalInboxColumnError(insertResult.error.message)) {
    insertResult = await supabase
      .from("inbox_items")
      .insert({
        workspace_id: workspaceId,
        account_id: accountId,
        contact_id: contactId,
        source,
        status: "new",
        provider_thread_id: comment.postId,
        provider_comment_id: comment.commentId,
        provider_post_id: comment.postId,
        provider_ad_id: providerAdId,
        title,
        preview,
        is_hidden: comment.isHidden,
        unread_count: 1,
        received_at: receivedAt,
        updated_at: now,
      })
      .select("id")
      .single();
  }

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await ensureFacebookMessage({
    supabase,
    inboxItemId: insertResult.data.id as string,
    comment,
    receivedAt,
  });

  return "inserted";
}

async function resolveExistingItemContactId({
  supabase,
  itemId,
  fallbackContactId,
}: {
  supabase: SupabaseServiceClient;
  itemId: string;
  fallbackContactId: string;
}) {
  const existing = await supabase
    .from("inbox_items")
    .select("contact_id,contacts(provider_user_id,display_name,handle)")
    .eq("id", itemId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const contact = firstOrNull(
    existing.data?.contacts as
      | { provider_user_id?: string | null; display_name?: string | null; handle?: string | null }
      | Array<{
          provider_user_id?: string | null;
          display_name?: string | null;
          handle?: string | null;
        }>
      | null
      | undefined,
  );
  const providerUserId = contact?.provider_user_id ?? "";
  const hasRealContact =
    Boolean(existing.data?.contact_id) &&
    Boolean(contact?.display_name) &&
    Boolean(contact?.handle) &&
    !providerUserId.startsWith("comment-author:");

  return hasRealContact ? (existing.data!.contact_id as string) : fallbackContactId;
}

export async function persistInstagramComment({
  supabase,
  workspaceId,
  accountId,
  accountExternalId,
  accountName,
  comment,
  ingestSource = "unknown",
}: {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  accountId: string;
  accountExternalId: string;
  accountName: string;
  comment: MetaOrganicComment;
  ingestSource?: "webhook" | "polling_fast" | "polling_full" | "ads_auto" | "ads_manual" | "unknown";
}): Promise<CommentPersistenceResult> {
  if (isSelfAuthoredComment({ authorId: comment.fromId, accountExternalId })) {
    return "skipped_self";
  }

  const contactId = await ensureInstagramContact({
    supabase,
    workspaceId,
    comment,
  });
  const existingItem = await supabase
    .from("inbox_items")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .eq("provider_comment_id", comment.commentId)
    .maybeSingle();
  const now = new Date().toISOString();
  const receivedAt = normalizeDate(comment.createdTime) ?? now;
  const title = comment.postMessage
    ? `Comentario en:\n${comment.postMessage}`
    : `Comentario en ${accountName}`;
  const preview = comment.message || "(comentario sin texto)";
  const threadContextForUpdate = resolveCommentThreadContext(comment, { preserveExisting: true });
  const threadContextForInsert = resolveCommentThreadContext(comment);

  if (existingItem.error) {
    throw new Error(existingItem.error.message);
  }

  if (existingItem.data?.id) {
    const updateResult = await supabase
      .from("inbox_items")
      .update({
        contact_id: contactId,
        title,
        preview,
        source: "post_comment",
        is_hidden: comment.isHidden,
        ingest_source: ingestSource,
        provider_post_id: comment.postId,
        provider_permalink_url: comment.permalink ?? comment.postPermalink ?? null,
        ...threadContextForUpdate,
        updated_at: now,
      })
      .eq("id", existingItem.data.id);

    if (updateResult.error) {
      if (!isOptionalInboxColumnError(updateResult.error.message)) {
        throw new Error(updateResult.error.message);
      }

      const retryResult = await supabase
        .from("inbox_items")
        .update({
          contact_id: contactId,
          title,
          preview,
          source: "post_comment",
          is_hidden: comment.isHidden,
          provider_post_id: comment.postId,
          updated_at: now,
        })
        .eq("id", existingItem.data.id);

      if (retryResult.error) {
        throw new Error(retryResult.error.message);
      }
    }

    await ensureInstagramMessage({
      supabase,
      inboxItemId: existingItem.data.id,
      comment,
      receivedAt,
    });

    return "updated";
  }

  let insertResult = await supabase
    .from("inbox_items")
    .insert({
      workspace_id: workspaceId,
      account_id: accountId,
      contact_id: contactId,
      source: "post_comment",
      status: "new",
      provider_thread_id: comment.postId,
      provider_comment_id: comment.commentId,
      provider_post_id: comment.postId,
      provider_ad_id: null,
      provider_permalink_url: comment.permalink ?? comment.postPermalink ?? null,
      ...threadContextForInsert,
      title,
      preview,
      is_hidden: comment.isHidden,
      ingest_source: ingestSource,
      unread_count: 1,
      received_at: receivedAt,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertResult.error && isOptionalInboxColumnError(insertResult.error.message)) {
    insertResult = await supabase
      .from("inbox_items")
      .insert({
        workspace_id: workspaceId,
        account_id: accountId,
        contact_id: contactId,
        source: "post_comment",
        status: "new",
        provider_thread_id: comment.postId,
        provider_comment_id: comment.commentId,
        provider_post_id: comment.postId,
        provider_ad_id: null,
        title,
        preview,
        is_hidden: comment.isHidden,
        unread_count: 1,
        received_at: receivedAt,
        updated_at: now,
      })
      .select("id")
      .single();
  }

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await ensureInstagramMessage({
    supabase,
    inboxItemId: insertResult.data.id as string,
    comment,
    receivedAt,
  });

  return "inserted";
}

export async function persistFacebookMessengerMessage({
  supabase,
  workspaceId,
  accountId,
  accountName,
  message,
}: {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  accountId: string;
  accountName: string;
  message: MetaMessengerMessage;
}) {
  const contactId = await ensureFacebookMessengerContact({
    supabase,
    workspaceId,
    message,
  });
  const providerThreadId = `messenger:${message.senderId}`;
  const existingItem = await supabase
    .from("inbox_items")
    .select("id,unread_count")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .eq("source", "messenger")
    .eq("provider_thread_id", providerThreadId)
    .maybeSingle();
  const now = new Date().toISOString();
  const receivedAt = normalizeDate(message.timestamp) ?? now;
  const preview = message.text || "(mensaje sin texto)";

  if (existingItem.error) {
    throw new Error(existingItem.error.message);
  }

  if (existingItem.data?.id) {
    const existingMessage = await supabase
      .from("inbox_messages")
      .select("id")
      .eq("inbox_item_id", existingItem.data.id)
      .eq("provider_message_id", message.messageId)
      .maybeSingle();

    if (existingMessage.error) {
      throw new Error(existingMessage.error.message);
    }

    if (existingMessage.data?.id) {
      return "duplicate";
    }

    const updateResult = await supabase
      .from("inbox_items")
      .update({
        contact_id: contactId,
        status: "new",
        preview,
        unread_count: Number(existingItem.data.unread_count ?? 0) + 1,
        received_at: receivedAt,
        updated_at: now,
      })
      .eq("id", existingItem.data.id);

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    await ensureMessengerMessage({
      supabase,
      inboxItemId: existingItem.data.id as string,
      message,
      receivedAt,
    });

    return "updated";
  }

  const insertResult = await supabase
    .from("inbox_items")
    .insert({
      workspace_id: workspaceId,
      account_id: accountId,
      contact_id: contactId,
      source: "messenger",
      status: "new",
      provider_thread_id: providerThreadId,
      provider_comment_id: null,
      provider_post_id: null,
      provider_ad_id: null,
      title: `Messenger en ${accountName}`,
      preview,
      is_hidden: false,
      ingest_source: "webhook",
      unread_count: 1,
      received_at: receivedAt,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await ensureMessengerMessage({
    supabase,
    inboxItemId: insertResult.data.id as string,
    message,
    receivedAt,
  });

  return "inserted";
}

export async function persistInstagramDirectMessage({
  supabase,
  workspaceId,
  accountId,
  accountName,
  message,
}: {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  accountId: string;
  accountName: string;
  message: MetaMessengerMessage;
}) {
  const contactId = await ensureInstagramDirectContact({
    supabase,
    workspaceId,
    message,
  });
  const providerThreadId = `instagram:${message.senderId}`;
  const existingItem = await supabase
    .from("inbox_items")
    .select("id,unread_count")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .eq("source", "instagram_dm")
    .eq("provider_thread_id", providerThreadId)
    .maybeSingle();
  const now = new Date().toISOString();
  const receivedAt = normalizeDate(message.timestamp) ?? now;
  const preview = message.text || "(mensaje sin texto)";

  if (existingItem.error) {
    throw new Error(existingItem.error.message);
  }

  if (existingItem.data?.id) {
    const existingMessage = await supabase
      .from("inbox_messages")
      .select("id")
      .eq("inbox_item_id", existingItem.data.id)
      .eq("provider_message_id", message.messageId)
      .maybeSingle();

    if (existingMessage.error) {
      throw new Error(existingMessage.error.message);
    }

    if (existingMessage.data?.id) {
      return "duplicate";
    }

    const updateResult = await supabase
      .from("inbox_items")
      .update({
        status: "new",
        preview,
        unread_count: Number(existingItem.data.unread_count ?? 0) + 1,
        received_at: receivedAt,
        updated_at: now,
      })
      .eq("id", existingItem.data.id);

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    await ensureMessengerMessage({
      supabase,
      inboxItemId: existingItem.data.id as string,
      message,
      receivedAt,
    });

    return "updated";
  }

  const insertResult = await supabase
    .from("inbox_items")
    .insert({
      workspace_id: workspaceId,
      account_id: accountId,
      contact_id: contactId,
      source: "instagram_dm",
      status: "new",
      provider_thread_id: providerThreadId,
      provider_comment_id: null,
      provider_post_id: null,
      provider_ad_id: null,
      title: `Instagram DM en ${accountName}`,
      preview,
      is_hidden: false,
      ingest_source: "webhook",
      unread_count: 1,
      received_at: receivedAt,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }

  await ensureMessengerMessage({
    supabase,
    inboxItemId: insertResult.data.id as string,
    message,
    receivedAt,
  });

  return "inserted";
}

async function ensureFacebookContact({
  supabase,
  workspaceId,
  comment,
}: {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  comment: MetaOrganicComment;
}) {
  const providerUserId = comment.fromId ?? `comment-author:${comment.commentId}`;
  const displayName = comment.fromName ?? "Autor pendiente";
  const existing = await supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("network", "facebook")
    .eq("provider_user_id", providerUserId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    if (comment.fromName) {
      await supabase
        .from("contacts")
        .update({
          display_name: displayName,
          handle: comment.fromId ? `facebook:${comment.fromId}` : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id);
    }

    return existing.data.id as string;
  }

  const inserted = await supabase
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      network: "facebook",
      provider_user_id: providerUserId,
      display_name: displayName,
      handle: comment.fromId ? `facebook:${comment.fromId}` : null,
    })
    .select("id")
    .single();

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }

  return inserted.data.id as string;
}

async function ensureInstagramContact({
  supabase,
  workspaceId,
  comment,
}: {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  comment: MetaOrganicComment;
}) {
  const providerUserId = comment.fromId ?? `instagram-comment-author:${comment.commentId}`;
  const displayName = comment.fromName ?? "Autor Instagram";
  const handle = providerUserId.startsWith("instagram:")
    ? providerUserId
    : comment.fromName?.startsWith("@")
      ? `instagram:${comment.fromName.slice(1)}`
      : null;
  const existing = await supabase
    .from("contacts")
    .select("id,display_name,handle")
    .eq("workspace_id", workspaceId)
    .eq("network", "instagram")
    .eq("provider_user_id", providerUserId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    if (shouldUpdateContactIdentity({
      existingDisplayName: existing.data.display_name,
      existingHandle: existing.data.handle,
      nextDisplayName: displayName,
      nextHandle: handle,
      fallbackPrefixes: ["Autor Instagram", "instagram-comment-author:"],
    })) {
      await supabase
        .from("contacts")
        .update({
          display_name: displayName,
          handle: handle ?? existing.data.handle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id);
    }

    return existing.data.id as string;
  }

  const inserted = await supabase
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      network: "instagram",
      provider_user_id: providerUserId,
      display_name: displayName,
      handle,
    })
    .select("id")
    .single();

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }

  return inserted.data.id as string;
}

async function ensureFacebookMessengerContact({
  supabase,
  workspaceId,
  message,
}: {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  message: MetaMessengerMessage;
}) {
  const senderId = message.senderId;
  const displayName = message.senderName ?? `Messenger ${senderId.slice(-6)}`;
  const handle = `facebook:${senderId}`;
  const existing = await supabase
    .from("contacts")
    .select("id,display_name,handle")
    .eq("workspace_id", workspaceId)
    .eq("network", "facebook")
    .eq("provider_user_id", senderId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    if (shouldUpdateContactIdentity({
      existingDisplayName: existing.data.display_name,
      existingHandle: existing.data.handle,
      nextDisplayName: displayName,
      nextHandle: handle,
      fallbackPrefixes: ["Messenger "],
    })) {
      const updated = await supabase
        .from("contacts")
        .update({
          display_name: displayName,
          handle: handle ?? existing.data.handle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id);

      if (updated.error) {
        throw new Error(updated.error.message);
      }
    }

    return existing.data.id as string;
  }

  const inserted = await supabase
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      network: "facebook",
      provider_user_id: senderId,
      display_name: displayName,
      handle,
    })
    .select("id")
    .single();

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }

  return inserted.data.id as string;
}

async function ensureInstagramDirectContact({
  supabase,
  workspaceId,
  message,
}: {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  message: MetaMessengerMessage;
}) {
  const senderId = message.senderId;
  const displayName =
    message.senderName ??
    (message.senderUsername ? `@${message.senderUsername}` : `Instagram ${senderId.slice(-6)}`);
  const handle = message.senderUsername
    ? `instagram:${message.senderUsername}`
    : `instagram:${senderId}`;
  const existing = await supabase
    .from("contacts")
    .select("id,display_name,handle")
    .eq("workspace_id", workspaceId)
    .eq("network", "instagram")
    .eq("provider_user_id", senderId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    if (shouldUpdateContactIdentity({
      existingDisplayName: existing.data.display_name,
      existingHandle: existing.data.handle,
      nextDisplayName: displayName,
      nextHandle: handle,
      fallbackPrefixes: ["Instagram "],
    })) {
      const updated = await supabase
        .from("contacts")
        .update({
          display_name: displayName,
          handle: handle ?? existing.data.handle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.data.id);

      if (updated.error) {
        throw new Error(updated.error.message);
      }
    }

    return existing.data.id as string;
  }

  const inserted = await supabase
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      network: "instagram",
      provider_user_id: senderId,
      display_name: displayName,
      handle,
    })
    .select("id")
    .single();

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }

  return inserted.data.id as string;
}

async function ensureFacebookMessage({
  supabase,
  inboxItemId,
  comment,
  receivedAt,
}: {
  supabase: SupabaseServiceClient;
  inboxItemId: string;
  comment: MetaOrganicComment;
  receivedAt: string;
}) {
  const existing = await supabase
    .from("inbox_messages")
    .select("id")
    .eq("inbox_item_id", inboxItemId)
    .eq("provider_message_id", comment.commentId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    return;
  }

  const inserted = await supabase.from("inbox_messages").insert({
    inbox_item_id: inboxItemId,
    provider_message_id: comment.commentId,
    author_type: "contact",
    body: comment.message || "(comentario sin texto)",
    sent_at: receivedAt,
  });

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }
}

async function ensureInstagramMessage({
  supabase,
  inboxItemId,
  comment,
  receivedAt,
}: {
  supabase: SupabaseServiceClient;
  inboxItemId: string;
  comment: MetaOrganicComment;
  receivedAt: string;
}) {
  const existing = await supabase
    .from("inbox_messages")
    .select("id")
    .eq("inbox_item_id", inboxItemId)
    .eq("provider_message_id", comment.commentId)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    return;
  }

  const inserted = await supabase.from("inbox_messages").insert({
    inbox_item_id: inboxItemId,
    provider_message_id: comment.commentId,
    author_type: "contact",
    body: comment.message || "(comentario sin texto)",
    sent_at: receivedAt,
  });

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }
}

async function ensureMessengerMessage({
  supabase,
  inboxItemId,
  message,
  receivedAt,
}: {
  supabase: SupabaseServiceClient;
  inboxItemId: string;
  message: MetaMessengerMessage;
  receivedAt: string;
}) {
  const inserted = await supabase.from("inbox_messages").insert({
    inbox_item_id: inboxItemId,
    provider_message_id: message.messageId,
    author_type: "contact",
    body: message.text || "(mensaje sin texto)",
    sent_at: receivedAt,
  });

  if (inserted.error) {
    throw new Error(inserted.error.message);
  }
}

function normalizeDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isSelfAuthoredComment({
  authorId,
  accountExternalId,
}: {
  authorId?: string | null;
  accountExternalId: string;
}) {
  return Boolean(authorId) && authorId === accountExternalId;
}

function isOptionalInboxColumnError(message: string) {
  return (
    message.includes("ingest_source") ||
    message.includes("provider_permalink_url") ||
    message.includes("parent_comment_id") ||
    message.includes("parent_comment_author") ||
    message.includes("parent_comment_text")
  );
}

function resolveCommentThreadContext(
  comment: MetaOrganicComment,
  options: { preserveExisting?: boolean } = {},
) {
  const context: {
    parent_comment_id?: string | null;
    parent_comment_author?: string | null;
    parent_comment_text?: string | null;
  } = {};

  if (!options.preserveExisting || comment.parentCommentId != null) {
    context.parent_comment_id = comment.parentCommentId ?? null;
  }

  if (!options.preserveExisting || comment.parentCommentAuthorName != null) {
    context.parent_comment_author = comment.parentCommentAuthorName ?? null;
  }

  if (!options.preserveExisting || comment.parentCommentText != null) {
    context.parent_comment_text = comment.parentCommentText ?? null;
  }

  return context;
}

function firstOrNull<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function shouldUpdateContactIdentity({
  existingDisplayName,
  existingHandle,
  fallbackPrefixes,
  nextDisplayName,
  nextHandle,
}: {
  existingDisplayName: string | null;
  existingHandle: string | null;
  fallbackPrefixes: string[];
  nextDisplayName: string;
  nextHandle: string | null;
}) {
  const existingIsFallback = isFallbackIdentity(existingDisplayName, fallbackPrefixes);
  const nextIsFallback = isFallbackIdentity(nextDisplayName, fallbackPrefixes);

  if (existingIsFallback && !nextIsFallback) {
    return true;
  }

  if (!existingHandle && nextHandle) {
    return true;
  }

  if (!existingIsFallback && nextIsFallback) {
    return false;
  }

  return existingDisplayName !== nextDisplayName || Boolean(nextHandle && existingHandle !== nextHandle);
}

function isFallbackIdentity(value: string | null | undefined, fallbackPrefixes: string[]) {
  if (!value) {
    return true;
  }

  return fallbackPrefixes.some((prefix) => value.startsWith(prefix));
}
