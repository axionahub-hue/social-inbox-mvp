import type { MetaOrganicComment } from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";

export type SupabaseServiceClient = NonNullable<ReturnType<typeof createServiceSupabaseClient>>;

export async function persistFacebookComment({
  supabase,
  workspaceId,
  accountId,
  accountName,
  comment,
  ingestSource = "unknown",
}: {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  accountId: string;
  accountName: string;
  comment: MetaOrganicComment;
  ingestSource?: "webhook" | "polling_fast" | "polling_full" | "unknown";
}) {
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

  if (existingItem.error) {
    throw new Error(existingItem.error.message);
  }

  if (existingItem.data?.id) {
    const updatePayload = {
      title,
      preview,
      is_hidden: comment.isHidden,
      ingest_source: ingestSource,
      provider_post_id: comment.postId,
      updated_at: now,
    };
    const updateResult = await supabase
      .from("inbox_items")
      .update(updatePayload)
      .eq("id", existingItem.data.id);

    if (updateResult.error) {
      if (!updateResult.error.message.includes("ingest_source")) {
        throw new Error(updateResult.error.message);
      }

      const retryResult = await supabase
        .from("inbox_items")
        .update({
          title,
          preview,
          is_hidden: comment.isHidden,
          provider_post_id: comment.postId,
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
    source: "post_comment",
    status: "new",
    provider_thread_id: comment.postId,
    provider_comment_id: comment.commentId,
    provider_post_id: comment.postId,
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

  if (insertResult.error?.message.includes("ingest_source")) {
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
  const displayName = comment.fromName ?? "Autor no disponible";
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
    await supabase
      .from("contacts")
      .update({
        display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id);

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

function normalizeDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
