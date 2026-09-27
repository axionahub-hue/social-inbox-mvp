import type { SupabaseServiceClient } from "@/lib/inbox-persistence";

export const liveInboxItemFilter = "action_state.is.null,action_state.neq.deleted";
export const deletedCommentMessage = "Este comentario fue eliminado en la red social. No se pueden ejecutar acciones sobre el.";

// Keep a tombstone even when remove arrives before add or an old polling response.
export async function recordDeletedComment({
  supabase, workspaceId, accountId, commentId, postId,
}: {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  accountId: string;
  commentId: string;
  postId?: string;
}): Promise<void> {
  const existing = await supabase.from("inbox_items")
    .select("id")
    .eq("workspace_id", workspaceId).eq("account_id", accountId)
    .eq("provider_comment_id", commentId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const now = new Date().toISOString();
  const fields = {
    status: "archived", unread_count: 0, action_state: "deleted",
    action_error: null, action_queue_id: null, updated_at: now,
  };
  let itemId = existing.data?.id as string | undefined;
  if (itemId) {
    const result = await supabase.from("inbox_items").update(fields).eq("id", itemId);
    if (result.error) throw new Error(result.error.message);
  } else {
    const result = await supabase.from("inbox_items").insert({
      ...fields, workspace_id: workspaceId, account_id: accountId,
      provider_comment_id: commentId, provider_post_id: postId ?? null,
      provider_thread_id: postId ?? null, source: "post_comment",
      title: "Comentario eliminado", preview: "Comentario eliminado en la red social.",
      ingest_source: "webhook",
    }).select("id").single();
    if (result.error?.code === "23505") {
      return recordDeletedComment({ supabase, workspaceId, accountId, commentId, postId });
    }
    if (result.error) throw new Error(result.error.message);
    itemId = result.data.id as string;
  }

  const queue = await supabase.from("action_queue").update({
    status: "cancelled", last_error: deletedCommentMessage,
    processed_at: now, updated_at: now,
  }).eq("inbox_item_id", itemId).eq("status", "queued").select("id");
  if (queue.error) throw new Error(queue.error.message);
  const ids = (queue.data ?? []).map((row) => row.id as string);
  if (ids.length) {
    const messages = await supabase.from("inbox_messages")
      .update({ delivery_status: "failed" }).in("action_queue_id", ids)
      .eq("delivery_status", "pending");
    if (messages.error) throw new Error(messages.error.message);
    const executions = await supabase.from("automation_executions")
      .update({ status: "cancelled", error: deletedCommentMessage, updated_at: now })
      .in("action_queue_id", ids);
    if (executions.error) throw new Error(executions.error.message);
  }
}
