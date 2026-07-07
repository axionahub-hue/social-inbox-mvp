import { NextResponse } from "next/server";
import { z } from "zod";
import {
  decryptMetaToken,
  fetchMetaOrganicComments,
} from "@/lib/meta";
import { persistFacebookComment } from "@/lib/inbox-persistence";
import { createServiceSupabaseClient } from "@/lib/supabase";

const syncSchema = z.object({
  workspaceId: z.string().uuid(),
});

const requiredFacebookReadScopes = ["pages_read_engagement", "pages_read_user_content"];

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
