import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildMetaOAuthUrl,
  createMetaOAuthState,
  getMetaOAuthRedirectUri,
  isMetaConfigured,
  metaOAuthScopes,
} from "@/lib/meta";
import { createServiceSupabaseClient } from "@/lib/supabase";

const startSchema = z.object({
  workspaceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const parsed = startSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (!isMetaConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message: "Faltan META_APP_ID y/o META_APP_SECRET en el entorno.",
        requiredEnv: ["META_APP_ID", "META_APP_SECRET", "META_GRAPH_VERSION"],
      },
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
      { ok: false, message: "Sesion Supabase requerida para conectar Meta." },
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

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const state = createMetaOAuthState({
    userId: user.id,
    workspaceId: parsed.data.workspaceId,
  });
  const redirectUrl = buildMetaOAuthUrl({
    origin,
    state,
  });

  if (!redirectUrl) {
    return NextResponse.json(
      { ok: false, message: "No se pudo construir URL OAuth Meta." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    redirectUrl,
    callbackUrl: getMetaOAuthRedirectUri(origin),
    scopes: metaOAuthScopes,
  });
}
