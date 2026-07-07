import { NextResponse } from "next/server";
import {
  decryptMetaToken,
  fetchMetaCommentContext,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
  type MetaOrganicComment,
} from "@/lib/meta";
import { persistFacebookComment, type SupabaseServiceClient } from "@/lib/inbox-persistence";
import { createServiceSupabaseClient } from "@/lib/supabase";

type MetaWebhookPayload = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

type MetaWebhookEntry = {
  id?: string;
  time?: number;
  changes?: Array<{
    field?: string;
    value?: MetaPageFeedValue;
  }>;
};

type MetaPageFeedValue = {
  item?: string;
  verb?: string;
  post_id?: string;
  parent_id?: string;
  comment_id?: string;
  message?: string;
  created_time?: number | string;
  is_hidden?: boolean;
  permalink_url?: string;
  from?: {
    id?: string;
    name?: string;
  };
};

type ConnectedFacebookAccount = {
  id: string;
  workspace_id: string;
  provider_account_id: string;
  name: string;
  access_token_encrypted: string | null;
};

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

  const payload = JSON.parse(rawBody) as MetaWebhookPayload;
  const supabase = createServiceSupabaseClient();
  let webhookEventId: string | null = null;
  let processedCount = 0;
  const errors: string[] = [];

  if (supabase) {
    const inserted = await supabase
      .from("webhook_events")
      .insert({
        provider: "meta",
        event_type: payload.object ?? "unknown",
        payload,
        processed_at: null,
      })
      .select("id")
      .single();

    webhookEventId = inserted.data?.id ?? null;

    try {
      processedCount = await processMetaWebhookPayload({ payload, supabase });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Error procesando webhook Meta.");
    }

    if (webhookEventId && errors.length === 0) {
      await supabase
        .from("webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", webhookEventId);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    processed: processedCount,
    errors,
  });
}

async function processMetaWebhookPayload({
  payload,
  supabase,
}: {
  payload: MetaWebhookPayload;
  supabase: SupabaseServiceClient;
}) {
  let processed = 0;

  for (const entry of payload.entry ?? []) {
    const pageId = entry.id;

    if (!pageId) {
      continue;
    }

    const account = await findConnectedFacebookAccount({ pageId, supabase });

    if (!account?.access_token_encrypted) {
      continue;
    }

    const accessToken = decryptMetaToken(account.access_token_encrypted);

    for (const change of entry.changes ?? []) {
      if (change.field !== "feed") {
        continue;
      }

      const comment = await mapPageFeedChangeToComment({
        accessToken,
        changeValue: change.value,
      });

      if (!comment) {
        continue;
      }

      await persistFacebookComment({
        supabase,
        workspaceId: account.workspace_id,
        accountId: account.id,
        accountName: account.name,
        comment,
        ingestSource: "webhook",
      });
      processed += 1;
    }
  }

  return processed;
}

async function findConnectedFacebookAccount({
  pageId,
  supabase,
}: {
  pageId: string;
  supabase: SupabaseServiceClient;
}) {
  const result = await supabase
    .from("connected_accounts")
    .select("id,workspace_id,provider_account_id,name,access_token_encrypted")
    .eq("network", "facebook")
    .eq("provider_account_id", pageId)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data as ConnectedFacebookAccount | null;
}

async function mapPageFeedChangeToComment({
  accessToken,
  changeValue,
}: {
  accessToken: string;
  changeValue?: MetaPageFeedValue;
}) {
  if (!changeValue || changeValue.item !== "comment") {
    return null;
  }

  if (changeValue.verb && !["add", "edited"].includes(changeValue.verb)) {
    return null;
  }

  const commentId = changeValue.comment_id;
  const postId = changeValue.post_id ?? changeValue.parent_id;

  if (!commentId || !postId) {
    return null;
  }

  const fallback: Omit<MetaOrganicComment, "postMessage" | "postPermalink"> = {
    postId,
    commentId,
    message: changeValue.message ?? "",
    fromId: changeValue.from?.id ?? null,
    fromName: changeValue.from?.name ?? null,
    createdTime: normalizeWebhookTimestamp(changeValue.created_time),
    isHidden: Boolean(changeValue.is_hidden),
    permalink: changeValue.permalink_url ?? null,
  };

  try {
    return await fetchMetaCommentContext({
      accessToken,
      commentId,
      fallback,
      postId,
    });
  } catch {
    return {
      ...fallback,
      postMessage: null,
      postPermalink: null,
    };
  }
}

function normalizeWebhookTimestamp(value: number | string | undefined) {
  if (!value) {
    return null;
  }

  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
