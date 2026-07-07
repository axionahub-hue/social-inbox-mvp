import { NextResponse } from "next/server";
import {
  encryptMetaToken,
  exchangeMetaCodeForToken,
  exchangeMetaLongLivedToken,
  fetchMetaGrantedScopes,
  fetchMetaPageAccounts,
  resolveMetaTokenExpiresAt,
  verifyMetaOAuthState,
} from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = verifyMetaOAuthState(url.searchParams.get("state"));

  if (error) {
    return NextResponse.redirect(`${appUrl}/?meta_oauth=error`);
  }

  if (!state) {
    return NextResponse.redirect(`${appUrl}/?meta_oauth=invalid_state`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?meta_oauth=missing_code`);
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return NextResponse.redirect(`${appUrl}/?meta_oauth=supabase_missing`);
  }

  const workspaceResult = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", state.workspaceId)
    .eq("owner_user_id", state.userId)
    .maybeSingle();

  if (workspaceResult.error || !workspaceResult.data?.id) {
    return NextResponse.redirect(`${appUrl}/?meta_oauth=workspace_not_found`);
  }

  try {
    const shortLived = await exchangeMetaCodeForToken({
      code,
      origin: appUrl,
    });
    const longLived = await exchangeMetaLongLivedToken(shortLived.accessToken);
    const [grantedScopes, pages] = await Promise.all([
      fetchMetaGrantedScopes(longLived.accessToken),
      fetchMetaPageAccounts(longLived.accessToken),
    ]);
    const tokenExpiresAt = resolveMetaTokenExpiresAt(longLived.expiresIn);
    const accountRows = pages.flatMap((page) => {
      const encryptedPageToken = page.access_token
        ? encryptMetaToken(page.access_token)
        : null;
      const facebookRow = {
        workspace_id: state.workspaceId,
        network: "facebook",
        provider_account_id: page.id,
        name: page.name,
        handle: page.username ? `@${page.username}` : null,
        access_token_encrypted: encryptedPageToken,
        token_expires_at: tokenExpiresAt,
        scopes: grantedScopes,
        updated_at: new Date().toISOString(),
      };

      if (!page.instagram_business_account?.id) {
        return [facebookRow];
      }

      const instagram = page.instagram_business_account;

      return [
        facebookRow,
        {
          workspace_id: state.workspaceId,
          network: "instagram",
          provider_account_id: instagram.id,
          name: instagram.name ?? page.name,
          handle: instagram.username ? `@${instagram.username}` : null,
          access_token_encrypted: encryptedPageToken,
          token_expires_at: tokenExpiresAt,
          scopes: grantedScopes,
          updated_at: new Date().toISOString(),
        },
      ];
    });

    if (accountRows.length > 0) {
      const upsertResult = await supabase
        .from("connected_accounts")
        .upsert(accountRows, { onConflict: "network,provider_account_id" });

      if (upsertResult.error) {
        throw new Error(upsertResult.error.message);
      }
    }

    const instagramCount = accountRows.filter((account) => account.network === "instagram").length;
    const missingPageTokens = pages.filter((page) => !page.access_token).length;
    const params = new URLSearchParams({
      meta_oauth: "accounts_saved",
      workspace_id: state.workspaceId,
      pages: `${pages.length}`,
      instagram: `${instagramCount}`,
      missing_page_tokens: `${missingPageTokens}`,
      scopes: grantedScopes.join(","),
    });

    return NextResponse.redirect(`${appUrl}/?${params.toString()}`);
  } catch (tokenError) {
    const params = new URLSearchParams({
      meta_oauth: "token_exchange_error",
      workspace_id: state.workspaceId,
    });

    console.error("Meta OAuth callback failed", tokenError);
    return NextResponse.redirect(`${appUrl}/?${params.toString()}`);
  }
}
