import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAutomationKeyword } from "@/lib/automation-rules";
import { createServiceSupabaseClient } from "@/lib/supabase";

const ruleSchema = z
  .object({
    id: z.string().uuid().optional(),
    workspaceId: z.string().uuid(),
    accountId: z.string().uuid(),
    providerPostId: z.string().min(1),
    network: z.enum(["facebook", "instagram"]),
    source: z.enum(["post_comment", "ad_comment"]).optional(),
    active: z.boolean().default(true),
    matchType: z.enum(["contains", "starts_with", "equals"]),
    keyword: z.string().min(1),
    publicReplyEnabled: z.boolean().default(false),
    publicReplyText: z.string().optional().default(""),
    privateReplyEnabled: z.boolean().default(false),
    privateReplyText: z.string().optional().default(""),
  })
  .refine(
    (value) =>
      (value.publicReplyEnabled && value.publicReplyText.trim()) ||
      (value.privateReplyEnabled && value.privateReplyText.trim()),
    {
      message: "Activa al menos una respuesta y escribe su texto.",
      path: ["publicReplyText"],
    },
  );

const listSchema = z.object({
  workspaceId: z.string().uuid(),
  accountId: z.string().uuid(),
  providerPostId: z.string().min(1),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    workspaceId: url.searchParams.get("workspaceId"),
    accountId: url.searchParams.get("accountId"),
    providerPostId: url.searchParams.get("providerPostId"),
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const auth = await authenticateRequest(request, parsed.data.workspaceId);

  if (auth.error) {
    return NextResponse.json({ ok: false, message: auth.error.message }, { status: auth.error.status });
  }

  const accountOk = await assertAccountBelongsToWorkspace({
    accountId: parsed.data.accountId,
    supabase: auth.supabase,
    workspaceId: parsed.data.workspaceId,
  });

  if (!accountOk.ok) {
    return NextResponse.json({ ok: false, message: accountOk.message }, { status: accountOk.status });
  }

  const rules = await auth.supabase
    .from("automation_rules")
    .select(
      "id,workspace_id,account_id,provider_post_id,network,source,active,match_type,keyword,public_reply_enabled,public_reply_text,private_reply_enabled,private_reply_text,created_at,updated_at",
    )
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("account_id", parsed.data.accountId)
    .eq("provider_post_id", parsed.data.providerPostId)
    .order("created_at", { ascending: false });

  if (rules.error) {
    return NextResponse.json(
      { ok: false, message: resolveAutomationSchemaMessage(rules.error.message) },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, rules: (rules.data ?? []).map(mapRuleRow) });
}

export async function POST(request: Request) {
  const parsed = ruleSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const auth = await authenticateRequest(request, parsed.data.workspaceId);

  if (auth.error) {
    return NextResponse.json({ ok: false, message: auth.error.message }, { status: auth.error.status });
  }

  const accountOk = await assertAccountBelongsToWorkspace({
    accountId: parsed.data.accountId,
    supabase: auth.supabase,
    workspaceId: parsed.data.workspaceId,
  });

  if (!accountOk.ok) {
    return NextResponse.json({ ok: false, message: accountOk.message }, { status: accountOk.status });
  }

  if (parsed.data.id) {
    const ownership = await auth.supabase
      .from("automation_rules")
      .select("id")
      .eq("id", parsed.data.id)
      .eq("workspace_id", parsed.data.workspaceId)
      .maybeSingle();

    if (ownership.error) {
      return NextResponse.json(
        { ok: false, message: resolveAutomationSchemaMessage(ownership.error.message) },
        { status: 409 },
      );
    }

    if (!ownership.data?.id) {
      return NextResponse.json({ ok: false, message: "Regla no encontrada." }, { status: 404 });
    }
  }

  const payload = {
    active: parsed.data.active,
    account_id: parsed.data.accountId,
    keyword: parsed.data.keyword.trim(),
    keyword_normalized: normalizeAutomationKeyword(parsed.data.keyword),
    match_type: parsed.data.matchType,
    network: parsed.data.network,
    private_reply_enabled: parsed.data.privateReplyEnabled,
    private_reply_text: parsed.data.privateReplyEnabled ? parsed.data.privateReplyText.trim() : null,
    provider_post_id: parsed.data.providerPostId,
    public_reply_enabled: parsed.data.publicReplyEnabled,
    public_reply_text: parsed.data.publicReplyEnabled ? parsed.data.publicReplyText.trim() : null,
    source: parsed.data.source ?? null,
    updated_at: new Date().toISOString(),
    workspace_id: parsed.data.workspaceId,
  };

  const query = parsed.data.id
    ? auth.supabase
        .from("automation_rules")
        .update(payload)
        .eq("id", parsed.data.id)
        .select(
          "id,workspace_id,account_id,provider_post_id,network,source,active,match_type,keyword,public_reply_enabled,public_reply_text,private_reply_enabled,private_reply_text,created_at,updated_at",
        )
        .single()
    : auth.supabase
        .from("automation_rules")
        .insert(payload)
        .select(
          "id,workspace_id,account_id,provider_post_id,network,source,active,match_type,keyword,public_reply_enabled,public_reply_text,private_reply_enabled,private_reply_text,created_at,updated_at",
        )
        .single();

  const saved = await query;

  if (saved.error) {
    return NextResponse.json(
      { ok: false, message: resolveAutomationSchemaMessage(saved.error.message) },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, rule: mapRuleRow(saved.data) });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const parsed = deleteSchema.safeParse({
    id: url.searchParams.get("id"),
    workspaceId: url.searchParams.get("workspaceId"),
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const auth = await authenticateRequest(request, parsed.data.workspaceId);

  if (auth.error) {
    return NextResponse.json({ ok: false, message: auth.error.message }, { status: auth.error.status });
  }

  const deleted = await auth.supabase
    .from("automation_rules")
    .delete()
    .eq("id", parsed.data.id)
    .eq("workspace_id", parsed.data.workspaceId);

  if (deleted.error) {
    return NextResponse.json(
      { ok: false, message: resolveAutomationSchemaMessage(deleted.error.message) },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, message: "Automatizacion eliminada." });
}

async function authenticateRequest(request: Request, workspaceId: string) {
  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return {
      error: { status: 500, message: "Supabase service role no esta configurado." },
      supabase: null as never,
    };
  }

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return {
      error: { status: 401, message: "Sesion Supabase requerida." },
      supabase,
    };
  }

  const userResult = await supabase.auth.getUser(accessToken);
  const user = userResult.data.user;

  if (userResult.error || !user) {
    return {
      error: { status: 401, message: "Sesion Supabase invalida o expirada." },
      supabase,
    };
  }

  const workspaceResult = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (workspaceResult.error || !workspaceResult.data?.id) {
    return {
      error: { status: 403, message: "Workspace no encontrado para el usuario actual." },
      supabase,
    };
  }

  return { error: null, supabase };
}

async function assertAccountBelongsToWorkspace({
  accountId,
  supabase,
  workspaceId,
}: {
  accountId: string;
  supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>;
  workspaceId: string;
}) {
  const account = await supabase
    .from("connected_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (account.error) {
    return {
      ok: false,
      status: 500,
      message: account.error.message,
    };
  }

  if (!account.data?.id) {
    return {
      ok: false,
      status: 403,
      message: "Cuenta no pertenece al workspace actual.",
    };
  }

  return { ok: true, status: 200, message: null };
}

function mapRuleRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    accountId: row.account_id,
    providerPostId: row.provider_post_id,
    network: row.network,
    source: row.source,
    active: row.active,
    matchType: row.match_type,
    keyword: row.keyword,
    publicReplyEnabled: row.public_reply_enabled,
    publicReplyText: row.public_reply_text,
    privateReplyEnabled: row.private_reply_enabled,
    privateReplyText: row.private_reply_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveAutomationSchemaMessage(message: string) {
  if (message.includes("automation_rules") || message.includes("automation_executions")) {
    return "Falta ejecutar la migracion Supabase de automatizaciones.";
  }

  return message;
}
