import { NextResponse } from "next/server";
import { z } from "zod";
import { executeMetaAction } from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";

const actionSchema = z.object({
  itemId: z.string().min(1),
  externalId: z.string().default("demo-external-id"),
  replyMode: z.enum(["public_comment", "private_message"]).optional(),
  recipientExternalId: z.string().optional(),
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
  const result = await executeMetaAction(parsed.data);
  let persisted = false;

  if (supabase) {
    if (result.ok) {
      persisted = await persistInboxAction({
        supabase,
        itemId: parsed.data.itemId,
        action: parsed.data.action,
        message: parsed.data.message,
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
      },
    });
  }

  return NextResponse.json({ ...result, persisted }, { status: result.ok ? 200 : 502 });
}

async function persistInboxAction({
  supabase,
  itemId,
  action,
  message,
}: {
  supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>;
  itemId: string;
  action: z.infer<typeof actionSchema>["action"];
  message?: string;
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
