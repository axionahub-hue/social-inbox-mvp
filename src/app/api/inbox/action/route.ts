import { after, NextResponse } from "next/server";
import { z } from "zod";
import { executeMetaAction } from "@/lib/meta";
import {
  enqueueInboxAction,
  executeAndPersistAction,
  processQueuedInboxActions,
  resolveAuthenticatedActionInput,
  shouldQueueAction,
  type InboxActionPayload,
} from "@/lib/inbox-action-queue";
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
  const input = parsed.data satisfies InboxActionPayload;

  if (!supabase) {
    const result = await executeMetaAction(input);

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  }

  const resolved = await resolveAuthenticatedActionInput({
    accessToken: request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
    input,
    supabase,
  });

  if (resolved.error) {
    return NextResponse.json(
      { ok: false, message: resolved.error.message },
      { status: resolved.error.status },
    );
  }

  if (!resolved.canPersist) {
    const result = await executeAndPersistAction({
      actionInput: resolved.input,
      input,
      supabase,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  }

  if (shouldQueueAction(input.action, resolved.input) && resolved.workspaceId) {
    let queueId: string;

    try {
      queueId = await enqueueInboxAction({
        input,
        supabase,
        workspaceId: resolved.workspaceId,
      });
    } catch (error) {
      const message =
        error instanceof Error && isMissingActionQueueSchemaError(error.message)
          ? "Falta ejecutar la migracion Supabase de cola de acciones antes de usar acciones rapidas."
          : error instanceof Error
            ? error.message
            : "No se pudo encolar la accion.";

      return NextResponse.json({ ok: false, message }, { status: 409 });
    }

    after(async () => {
      await processQueuedInboxActions({ limit: 5 });
    });

    return NextResponse.json(
      {
        ok: true,
        mode: "queued",
        queued: true,
        queueId,
        persisted: true,
        message: "Accion encolada. La app la aplicara en Meta en segundo plano.",
      },
      { status: 202 },
    );
  }

  const result = await executeAndPersistAction({
    actionInput: resolved.input,
    input,
    supabase,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

function isMissingActionQueueSchemaError(message: string) {
  return [
    "action_queue",
    "action_state",
    "action_error",
    "action_queue_id",
    "delivery_status",
  ].some((column) => message.includes(column));
}
