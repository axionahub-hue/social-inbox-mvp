import { NextResponse } from "next/server";
import { z } from "zod";
import { executeMetaAction } from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";

const actionSchema = z.object({
  itemId: z.string().min(1),
  externalId: z.string().default("demo-external-id"),
  action: z.enum(["reply", "like", "unlike", "hide", "unhide", "block"]),
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

  if (supabase) {
    await supabase.from("action_log").insert({
      inbox_item_id: parsed.data.itemId,
      action: parsed.data.action,
      message: parsed.data.message ?? null,
      provider_mode: result.mode,
      provider_ok: result.ok,
      provider_payload: result,
    });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
