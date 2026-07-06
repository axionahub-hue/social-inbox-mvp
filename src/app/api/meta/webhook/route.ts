import { NextResponse } from "next/server";
import { verifyMetaWebhookChallenge, verifyMetaWebhookSignature } from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = verifyMetaWebhookChallenge(url.searchParams);

  if (!challenge) {
    return NextResponse.json({ ok: false, error: "Invalid verify token" }, { status: 403 });
  }

  return new Response(challenge, { status: 200 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 403 });
  }

  const payload = JSON.parse(rawBody);
  const supabase = createServiceSupabaseClient();

  if (supabase) {
    await supabase.from("webhook_events").insert({
      provider: "meta",
      event_type: payload.object ?? "unknown",
      payload,
      processed_at: null,
    });
  }

  return NextResponse.json({ ok: true });
}
