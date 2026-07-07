import { NextResponse } from "next/server";
import { z } from "zod";
import {
  decryptMetaToken,
  fetchMetaAppSubscriptions,
  fetchMetaPageSubscribedApps,
} from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";

const diagnosticsSchema = z.object({
  workspaceId: z.string().uuid(),
});

type FacebookAccountRow = {
  id: string;
  provider_account_id: string;
  name: string;
  access_token_encrypted: string | null;
};

export async function POST(request: Request) {
  const parsed = diagnosticsSchema.safeParse(await request.json());

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

  const appSubscriptions = await fetchMetaAppSubscriptions();
  const appPageSubscription = (appSubscriptions.data ?? []).find(
    (subscription) => subscription.object === "page",
  );
  const appPageFeedActive = Boolean(
    appPageSubscription?.active &&
      appPageSubscription.fields?.some((field) => field.name === "feed"),
  );
  const accounts = (accountsResult.data ?? []) as FacebookAccountRow[];
  const pageDiagnostics = await Promise.all(
    accounts.map(async (account) => {
      if (!account.access_token_encrypted) {
        return {
          pageId: account.provider_account_id,
          pageName: account.name,
          subscribed: false,
          fields: [],
          error: "La pagina no tiene page token guardado.",
        };
      }

      try {
        const pageToken = decryptMetaToken(account.access_token_encrypted);
        const subscribedApps = await fetchMetaPageSubscribedApps({
          accessToken: pageToken,
          pageId: account.provider_account_id,
        });

        if (subscribedApps.error) {
          return {
            pageId: account.provider_account_id,
            pageName: account.name,
            subscribed: false,
            fields: [],
            error: subscribedApps.error.message ?? "Meta rechazo la consulta.",
          };
        }

        const currentApp = (subscribedApps.data ?? []).find(
          (app) => app.name === "Social Inbox MVP",
        );
        const fields = currentApp?.subscribed_fields ?? [];

        return {
          pageId: account.provider_account_id,
          pageName: account.name,
          subscribed: fields.includes("feed"),
          fields,
          error: null,
        };
      } catch (error) {
        return {
          pageId: account.provider_account_id,
          pageName: account.name,
          subscribed: false,
          fields: [],
          error: error instanceof Error ? error.message : "No se pudo diagnosticar la pagina.",
        };
      }
    }),
  );
  const latestEvents = await supabase
    .from("webhook_events")
    .select("id,event_type,processed_at,created_at,payload")
    .eq("provider", "meta")
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    ok: true,
    app: {
      pageFeedActive: appPageFeedActive,
      callbackUrl: appPageSubscription?.callback_url ?? null,
      fields: appPageSubscription?.fields ?? [],
      error: appSubscriptions.error?.message ?? null,
    },
    pages: pageDiagnostics,
    latestEvents: (latestEvents.data ?? []).map((event) => ({
      id: event.id,
      eventType: event.event_type,
      createdAt: event.created_at,
      processedAt: event.processed_at,
      entryIds: (event.payload?.entry ?? []).map((entry: { id?: string }) => entry.id),
      changes: (event.payload?.entry ?? []).flatMap(
        (entry: { changes?: Array<{ field?: string; value?: { item?: string } }> }) =>
          (entry.changes ?? []).map((change) => ({
            field: change.field,
            item: change.value?.item,
          })),
      ),
    })),
    latestEventsError: latestEvents.error?.message ?? null,
  });
}
