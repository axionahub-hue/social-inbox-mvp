import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{
    accountId: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
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

  const { accountId } = await context.params;
  const accountResult = await supabase
    .from("connected_accounts")
    .select("id,workspace_id,name,workspaces!inner(owner_user_id)")
    .eq("id", accountId)
    .eq("workspaces.owner_user_id", user.id)
    .maybeSingle();

  if (accountResult.error || !accountResult.data?.id) {
    return NextResponse.json(
      { ok: false, message: "Cuenta no encontrada para tu workspace." },
      { status: 404 },
    );
  }

  const deleteResult = await supabase
    .from("connected_accounts")
    .delete()
    .eq("id", accountResult.data.id);

  if (deleteResult.error) {
    return NextResponse.json(
      { ok: false, message: deleteResult.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Cuenta desconectada: ${accountResult.data.name}.`,
  });
}
