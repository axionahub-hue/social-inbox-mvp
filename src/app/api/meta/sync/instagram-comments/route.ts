import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRecentMetaCommentSince,
  decryptMetaToken,
  fetchMetaInstagramComments,
  metaRecentCommentWindowHours,
} from "@/lib/meta";
import { persistInstagramComment } from "@/lib/inbox-persistence";
import { createServiceSupabaseClient } from "@/lib/supabase";

const syncSchema = z.object({
  workspaceId: z.string().uuid(),
  mode: z.enum(["fast", "full"]).optional().default("full"),
});

const requiredInstagramReadScopes = ["instagram_basic", "instagram_manage_comments"];

type InstagramAccountRow = {
  id: string;
  provider_account_id: string;
  name: string;
  handle: string | null;
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
    .select("id,provider_account_id,name,handle,access_token_encrypted,scopes")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("network", "instagram");

  if (accountsResult.error) {
    return NextResponse.json(
      { ok: false, message: accountsResult.error.message },
      { status: 500 },
    );
  }

  const accounts = ((accountsResult.data ?? []) as InstagramAccountRow[]).filter(
    (account) => account.access_token_encrypted,
  );
  const eligibleAccounts = accounts.filter((account) => {
    const scopes = account.scopes ?? [];
    return requiredInstagramReadScopes.every((scope) => scopes.includes(scope));
  });
  const skippedForPermission = accounts.length - eligibleAccounts.length;
  const syncOptions =
    parsed.data.mode === "fast"
      ? {
          commentsLimit: 10,
          mediaLimit: 25,
          mediaWithCommentsLimit: 10,
        }
      : {
          commentsLimit: 50,
          mediaLimit: 100,
          mediaWithCommentsLimit: 50,
        };
  const ingestSource = parsed.data.mode === "fast" ? "polling_fast" : "polling_full";
  const recentSince = createRecentMetaCommentSince();
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

  const accountResults = await Promise.all(
    eligibleAccounts.map(async (account) => {
      try {
        const pageToken = decryptMetaToken(account.access_token_encrypted!);
        const comments = await fetchMetaInstagramComments({
          accessToken: pageToken,
          instagramAccountId: account.provider_account_id,
          since: recentSince,
          ...syncOptions,
        });
        let accountInserted = 0;
        let accountUpdated = 0;

        for (const comment of comments) {
          const result = await persistInstagramComment({
            supabase,
            workspaceId: parsed.data.workspaceId,
            accountId: account.id,
            accountExternalId: account.provider_account_id,
            accountHandle: account.handle,
            accountName: account.name,
            comment,
            ingestSource,
          });

          if (result === "inserted") {
            accountInserted += 1;
          }
          if (result === "updated") {
            accountUpdated += 1;
          }
        }

        return {
          account: account.name,
          found: comments.length,
          inserted: accountInserted,
          updated: accountUpdated,
          error: null,
        };
      } catch (error) {
        return {
          account: account.name,
          found: 0,
          inserted: 0,
          updated: 0,
          error: error instanceof Error ? error.message : "Error desconocido.",
        };
      }
    }),
  );

  for (const result of accountResults) {
    commentsFound += result.found;
    inserted += result.inserted;
    updated += result.updated;
    accountSummaries.push({
      account: result.account,
      found: result.found,
      inserted: result.inserted,
      updated: result.updated,
    });

    if (result.error) {
      errors.push({
        account: result.account,
        message: result.error,
      });
    }
  }

  const message =
    eligibleAccounts.length === 0
      ? "No hay cuentas Instagram con instagram_basic e instagram_manage_comments concedidos."
      : errors.length > 0
        ? `Meta bloqueo la sincronizacion Instagram en ${errors.length} cuenta(s).`
        : `Sincronizacion Instagram: ${commentsFound} comentario(s) de las ultimas ${metaRecentCommentWindowHours}h, ${inserted} nuevo(s), ${updated} actualizado(s).`;

  console.info("meta_instagram_comment_sync", {
    workspaceId: parsed.data.workspaceId,
    accounts: accountSummaries,
    mode: parsed.data.mode,
    commentsFound,
    inserted,
    updated,
    recentSince,
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
      since: recentSince,
    },
    accountSummaries,
    errors,
  });
}
