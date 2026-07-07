import { NextResponse } from "next/server";
import { z } from "zod";
import {
  decryptMetaToken,
  fetchMetaAppSubscriptions,
  subscribeMetaPageToFeed,
} from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";

const subscribeSchema = z.object({
  workspaceId: z.string().uuid(),
});

type FacebookAccountRow = {
  id: string;
  provider_account_id: string;
  name: string;
  access_token_encrypted: string | null;
};

export async function POST(request: Request) {
  const parsed = subscribeSchema.safeParse(await request.json());

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
    .select("id,provider_account_id,name,access_token_encrypted")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("network", "facebook");

  if (accountsResult.error) {
    return NextResponse.json(
      { ok: false, message: accountsResult.error.message },
      { status: 500 },
    );
  }

  const accounts = (accountsResult.data ?? []) as FacebookAccountRow[];
  const appSubscriptions = await fetchMetaAppSubscriptions();
  const appPageSubscription = (appSubscriptions.data ?? []).find(
    (subscription) => subscription.object === "page",
  );
  const appPageMessagesActive = Boolean(
    appPageSubscription?.active &&
      appPageSubscription.fields?.some((field) => field.name === "messages"),
  );
  const results = await Promise.all(
    accounts.map(async (account) => {
      if (!account.access_token_encrypted) {
        return {
          pageId: account.provider_account_id,
          pageName: account.name,
          ok: false,
          message: "La pagina no tiene page token guardado.",
        };
      }

      try {
        return {
          pageId: account.provider_account_id,
          pageName: account.name,
          ...(await subscribeMetaPageToFeed({
            accessToken: decryptMetaToken(account.access_token_encrypted),
            pageId: account.provider_account_id,
          })),
        };
      } catch (error) {
        return {
          pageId: account.provider_account_id,
          pageName: account.name,
          ok: false,
          message: error instanceof Error ? error.message : "No se pudo suscribir la pagina.",
        };
      }
    }),
  );
  const subscribedPages = results.filter((result) => result.ok).length;

  return NextResponse.json({
    ok: subscribedPages > 0,
    message: appPageMessagesActive
      ? `Suscripcion solicitada: ${subscribedPages}/${accounts.length} pagina(s).`
      : "Primero activa el campo Page messages en Meta Developers; luego vuelve a re-suscribir paginas.",
    app: {
      pageMessagesActive: appPageMessagesActive,
    },
    subscribedPages,
    totalPages: accounts.length,
    results,
  });
}
