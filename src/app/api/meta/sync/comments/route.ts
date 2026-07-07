import { NextResponse } from "next/server";
import { z } from "zod";
import {
  decryptMetaToken,
  fetchMetaOrganicComments,
  type MetaOrganicComment,
} from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";

const syncSchema = z.object({
  workspaceId: z.string().uuid(),
});

const requiredFacebookReadScopes = ["pages_read_engagement", "pages_read_user_content"];

type SupabaseServiceClient = NonNullable<ReturnType<typeof createServiceSupabaseClient>>;

type FacebookAccountRow = {
  id: string;
  provider_account_id: string;
  name: string;
  access_token_encrypted: string | null;
  scopes: string[] | null;
};

export async function POST(request: Request) {
  const parsed = syncSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Supabase service role no esta configurado." },
      { status: 500 },
    );
  }

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "Sesion Supabase requerida." },
      { status: 401 },
    );
  }

  const userResult = await supabase.auth.getUser(accessToken);
  const user = userResult.data.user;

  if (userResult.error || !user) {
    return NextResponse.json(
      { ok: false, message: "Sesion Supabase invalida o expirada." },
      { status: 401 },
    );
  }

  const workspaceResult = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", parsed.data.workspaceId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (workspaceResult.error || !workspaceResult.data?.id) {
    return NextResponse.json(
      { ok: false, message: "Workspace no encontrado para el usuario actual." },
      { status: 403 },
    );
  }

  const accountsResult = await supabase
    .from("connected_accounts")
    .select("id,provider_account_id,name,access_token_encrypted,scopes")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("network", "facebook");

  if (accountsResult.error) {
    return NextResponse.json(
      { ok: false, message: accountsResult.error.message },
      { status: 500 },
    );
  }

  const accounts = ((accountsResult.data ?? []) as FacebookAccountRow[]).filter(
    (account) => account.access_token_encrypted,
  );
  const eligibleAccounts = accounts.filter((account) => {
    const scopes = account.scopes ?? [];
    return requiredFacebookReadScopes.every((scope) => scopes.includes(scope));
  });
  const skippedForPermission = accounts.length - eligibleAccounts.length;
  let commentsFound = 0;
  let inserted = 0;
  let updated = 0;
  const errors: Array<{ account: string; message: string }> = [];
  const accountSummaries: Array<{
    account: string;
    found: number;
    inserted: number;
    updated: number;
  }> = [];

  for (const account of eligibleAccounts) {
    try {
      const pageToken = decryptMetaToken(account.access_token_encrypted!);
      const comments = await fetchMetaOrganicComments({
        accessToken: pageToken,
        pageId: account.provider_account_id,
      });
      let accountInserted = 0;
      let accountUpdated = 0;

      commentsFound += comments.length;

      for (const comment of comments) {
        const result = await persistFacebookComment({
          supabase,
          workspaceId: parsed.data.workspaceId,
          accountId: account.id,
          accountName: account.name,
          comment,
        });

        if (result === "inserted") {
          inserted += 1;
          accountInserted += 1;
        }
        if (result === "updated") {
          updated += 1;
          accountUpdated += 1;
        }
      }

      accountSummaries.push({
        account: account.name,
        found: comments.length,
        inserted: accountInserted,
        updated: accountUpdated,
      });
    } catch (error) {
      errors.push({
        account: account.name,
        message: error instanceof Error ? error.message : "Error desconocido.",
      });
    }
  }

  const message =
    eligibleAccounts.length === 0
      ? "No hay cuentas Facebook con pages_read_engagement y pages_read_user_content concedidos."
        : errors.length > 0
        ? `Meta bloqueo la sincronizacion en ${errors.length} cuenta(s).`
        : `Sincronizacion Facebook: ${commentsFound} comentario(s), ${inserted} nuevo(s), ${updated} actualizado(s).`;

  console.info("meta_comment_sync", {
    workspaceId: parsed.data.workspaceId,
    accounts: accountSummaries,
    commentsFound,
    inserted,
    updated,
    errors,
  });

  return NextResponse.json({
    ok: errors.length === 0,
    message,
    accounts: {
      total: accounts.length,
      eligible: eligibleAccounts.length,
      skippedForPermission,
    },
    comments: {
      found: commentsFound,
      inserted,
      updated,
    },
    accountSummaries,
    errors,
  });
}

async function persistFacebookComment({
  supabase,
  workspaceId,
  accountId,
  accountName,
  comment,
}: {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  accountId: string;
  accountName: string;
  comment: MetaOrganicComment;
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
    ? `Comentario en: ${comment.postMessage.slice(0, 90)}`
    : `Comentario en ${accountName}`;
  const preview = comment.message || "(comentario sin texto)";

  if (existingItem.error) {
    throw new Error(existingItem.error.message);
  }

  if (existingItem.data?.id) {
    const updateResult = await supabase
      .from("inbox_items")
      .update({
        title,
        preview,
        is_hidden: comment.isHidden,
        provider_post_id: comment.postId,
        updated_at: now,
      })
      .eq("id", existingItem.data.id);

    if (updateResult.error) {
      throw new Error(updateResult.error.message);
    }

    await ensureFacebookMessage({
      supabase,
      inboxItemId: existingItem.data.id,
      comment,
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
