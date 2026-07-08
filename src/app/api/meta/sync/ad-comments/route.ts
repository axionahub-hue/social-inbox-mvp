import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRecentMetaCommentSince,
  decryptMetaToken,
  fetchMetaAdCommentTargets,
  fetchMetaCommentContext,
  fetchMetaPostComments,
  metaRecentCommentWindowHours,
} from "@/lib/meta";
import { persistFacebookComment } from "@/lib/inbox-persistence";
import { createServiceSupabaseClient } from "@/lib/supabase";

const syncSchema = z.object({
  workspaceId: z.string().uuid(),
  mode: z.enum(["fast", "full"]).optional().default("full"),
  trigger: z.enum(["auto", "manual"]).optional().default("manual"),
});

const adSyncLimits = {
  fast: {
    adAccounts: 100,
    adsPerAccount: 100,
    targets: 500,
    commentsPerTarget: 100,
    effectiveStatuses: ["ACTIVE"],
  },
  full: {
    adAccounts: 100,
    adsPerAccount: 100,
    targets: 500,
    commentsPerTarget: 100,
    effectiveStatuses: ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"],
  },
} as const;

type FacebookAccountRow = {
  id: string;
  provider_account_id: string;
  name: string;
  access_token_encrypted: string | null;
};

type MetaConnectionRow = {
  user_access_token_encrypted: string;
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

  const connectionResult = await supabase
    .from("meta_connections")
    .select("user_access_token_encrypted,scopes")
    .eq("workspace_id", parsed.data.workspaceId)
    .maybeSingle();

  if (connectionResult.error) {
    return NextResponse.json(
      { ok: false, message: connectionResult.error.message },
      { status: 500 },
    );
  }

  const connection = connectionResult.data as MetaConnectionRow | null;
  const scopes = connection?.scopes ?? [];

  if (!connection?.user_access_token_encrypted || !scopes.includes("ads_read")) {
    return NextResponse.json({
      ok: false,
      message: "Falta reautorizar Meta con ads_read antes de sincronizar comentarios de Ads.",
      targets: { found: 0, matchedPages: 0 },
      comments: { found: 0, inserted: 0, updated: 0 },
      errors: [],
    });
  }

  const accountsResult = await supabase
    .from("connected_accounts")
    .select("id,provider_account_id,name,access_token_encrypted")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("network", "facebook");

  if (accountsResult.error) {
    return NextResponse.json(
      { ok: false, message: accountsResult.error.message },
      { status: 500 },
    );
  }

  const pageAccounts = ((accountsResult.data ?? []) as FacebookAccountRow[]).filter(
    (account) => account.access_token_encrypted,
  );
  const limits = adSyncLimits[parsed.data.mode];
  const pageByProviderId = new Map(pageAccounts.map((account) => [account.provider_account_id, account]));
  const userToken = decryptMetaToken(connection.user_access_token_encrypted);
  const targets = await fetchMetaAdCommentTargets({
    accessToken: userToken,
    adAccountLimit: limits.adAccounts,
    adsPerAccountLimit: limits.adsPerAccount,
    effectiveStatuses: [...limits.effectiveStatuses],
  });
  const recentSince = createRecentMetaCommentSince();
  const uniqueTargetsByPost = new Map(
    targets
      .filter((target) => pageByProviderId.has(target.pageId))
      .map((target) => [target.postId, target]),
  );
  const matchedTargets = Array.from(uniqueTargetsByPost.values()).slice(0, limits.targets);
  let commentsFound = 0;
  let inserted = 0;
  let updated = 0;
  const errors: Array<{ target: string; message: string }> = [];

  for (const target of matchedTargets) {
    const pageAccount = pageByProviderId.get(target.pageId);

    if (!pageAccount?.access_token_encrypted) {
      continue;
    }

    try {
      const pageToken = decryptMetaToken(pageAccount.access_token_encrypted);
      const comments = await fetchMetaPostComments({
        accessToken: pageToken,
        postId: target.postId,
        commentsLimit: limits.commentsPerTarget,
        since: recentSince,
      });

      commentsFound += comments.length;

      for (const comment of comments) {
        const enrichedComment =
          comment.fromId && comment.fromName
            ? comment
            : await fetchMetaCommentContext({
                accessToken: pageToken,
                commentId: comment.commentId,
                postId: comment.postId,
                fallback: {
                  postId: comment.postId,
                  commentId: comment.commentId,
                  message: comment.message,
                  fromId: comment.fromId,
                  fromName: comment.fromName,
                  createdTime: comment.createdTime,
                  isHidden: comment.isHidden,
                  permalink: comment.permalink,
                },
              });
        const result = await persistFacebookComment({
          supabase,
          workspaceId: parsed.data.workspaceId,
          accountId: pageAccount.id,
          accountExternalId: pageAccount.provider_account_id,
          accountName: pageAccount.name,
          comment: enrichedComment,
          ingestSource: parsed.data.trigger === "auto" ? "ads_auto" : "ads_manual",
          source: "ad_comment",
          providerAdId: target.adId,
        });

        if (result === "inserted") {
          inserted += 1;
        }
        if (result === "updated") {
          updated += 1;
        }
      }
    } catch (error) {
      errors.push({
        target: `${target.adAccountName} / ${target.adName}`,
        message: error instanceof Error ? error.message : "Error leyendo comentarios de Ad.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    message:
      errors.length > 0
        ? `Meta bloqueo ${errors.length} anuncio(s) al leer comentarios.`
        : `Sincronizacion Ads: ${commentsFound} comentario(s) de las ultimas ${metaRecentCommentWindowHours}h, ${inserted} nuevo(s), ${updated} actualizado(s).`,
    targets: {
      found: targets.length,
      matchedPages: matchedTargets.length,
      scannedAdAccounts: limits.adAccounts,
      scannedAdsPerAccount: limits.adsPerAccount,
      scannedPosts: matchedTargets.length,
      mode: parsed.data.mode,
      trigger: parsed.data.trigger,
    },
    comments: {
      found: commentsFound,
      inserted,
      updated,
      since: recentSince,
    },
    errors,
  });
}
