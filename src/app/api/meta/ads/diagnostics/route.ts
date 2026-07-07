import { NextResponse } from "next/server";
import { z } from "zod";
import { decryptMetaToken, fetchMetaAdAccounts } from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";

const diagnosticsSchema = z.object({
  workspaceId: z.string().uuid(),
});

type MetaConnectionRow = {
  workspace_id: string;
  user_access_token_encrypted: string;
  scopes: string[] | null;
  updated_at: string | null;
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

  const connectionResult = await supabase
    .from("meta_connections")
    .select("workspace_id,user_access_token_encrypted,scopes,updated_at")
    .eq("workspace_id", parsed.data.workspaceId)
    .maybeSingle();

  if (connectionResult.error?.message.includes("meta_connections")) {
    return NextResponse.json({
      ok: true,
      ready: false,
      reason: "schema_missing",
      message: "Falta ejecutar el schema de meta_connections en Supabase.",
      scopes: [],
      adAccounts: [],
    });
  }

  if (connectionResult.error) {
    return NextResponse.json(
      { ok: false, message: connectionResult.error.message },
      { status: 500 },
    );
  }

  const connection = connectionResult.data as MetaConnectionRow | null;

  if (!connection?.user_access_token_encrypted) {
    return NextResponse.json({
      ok: true,
      ready: false,
      reason: "reauthorization_required",
      message: "Reautoriza Meta para guardar el token de usuario requerido por Marketing API.",
      scopes: [],
      adAccounts: [],
    });
  }

  const scopes = connection.scopes ?? [];

  if (!scopes.includes("ads_read")) {
    return NextResponse.json({
      ok: true,
      ready: false,
      reason: "ads_read_missing",
      message: "Falta conceder ads_read en Meta para leer cuentas publicitarias y comentarios de anuncios.",
      scopes,
      adAccounts: [],
      updatedAt: connection.updated_at,
    });
  }

  try {
    const userToken = decryptMetaToken(connection.user_access_token_encrypted);
    const adAccounts = await fetchMetaAdAccounts(userToken);

    return NextResponse.json({
      ok: true,
      ready: true,
      reason: null,
      message: `Marketing API listo: ${adAccounts.length} cuenta(s) publicitaria(s) detectada(s).`,
      scopes,
      updatedAt: connection.updated_at,
      adAccounts: adAccounts.map((account) => ({
        id: account.id,
        accountId: account.account_id ?? null,
        name: account.name ?? account.id,
        status: account.account_status ?? null,
        currency: account.currency ?? null,
        business: account.business?.name ?? null,
      })),
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      ready: false,
      reason: "marketing_api_error",
      message: error instanceof Error ? error.message : "Meta rechazo la consulta Marketing API.",
      scopes,
      adAccounts: [],
      updatedAt: connection.updated_at,
    });
  }
}
