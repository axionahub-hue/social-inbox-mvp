import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeAutomationKeyword } from "@/lib/automation-rules";
import { createServiceSupabaseClient } from "@/lib/supabase";

const ruleSchema = z
  .object({
    id: z.string().uuid().optional(),
    workspaceId: z.string().uuid(),
    accountId: z.string().uuid().optional(),
    providerPostId: z.string().min(1).optional(),
    postUrl: z.string().trim().optional(),
    network: z.enum(["facebook", "instagram"]).optional(),
    source: z.enum(["post_comment", "ad_comment"]).optional(),
    active: z.boolean().default(true),
    matchType: z.enum(["contains", "starts_with", "equals"]),
    keyword: z.string().min(1),
    likeCommentEnabled: z.boolean().default(false),
    publicReplyEnabled: z.boolean().default(false),
    publicReplyText: z.string().optional().default(""),
    privateReplyEnabled: z.boolean().default(false),
    privateReplyText: z.string().optional().default(""),
  })
  .refine(
    (value) =>
      value.likeCommentEnabled ||
      (value.publicReplyEnabled && value.publicReplyText.trim()) ||
      (value.privateReplyEnabled && value.privateReplyText.trim()),
    {
      message: "Activa al menos una accion: like, respuesta publica o respuesta privada.",
      path: ["publicReplyText"],
    },
  );

const ruleSelect =
  "id,workspace_id,account_id,provider_post_id,network,source,active,match_type,keyword,like_comment_enabled,public_reply_enabled,public_reply_text,private_reply_enabled,private_reply_text,created_at,updated_at,connected_accounts(name,handle,provider_account_id)";

const listSchema = z.object({
  workspaceId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  providerPostId: z.string().min(1).optional(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

type RuleContext = {
  account_id: string;
  provider_post_id: string;
  network: "facebook" | "instagram";
  source: "post_comment" | "ad_comment" | null;
};

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

  let rulesQuery = auth.supabase
    .from("automation_rules")
    .select(ruleSelect)
    .eq("workspace_id", parsed.data.workspaceId)
    .order("created_at", { ascending: false });

  if (parsed.data.accountId) {
    const accountOk = await assertAccountBelongsToWorkspace({
      accountId: parsed.data.accountId,
      supabase: auth.supabase,
      workspaceId: parsed.data.workspaceId,
    });

    if (!accountOk.ok) {
      return NextResponse.json({ ok: false, message: accountOk.message }, { status: accountOk.status });
    }

    rulesQuery = rulesQuery.eq("account_id", parsed.data.accountId);
  }

  if (parsed.data.providerPostId) {
    rulesQuery = rulesQuery.eq("provider_post_id", parsed.data.providerPostId);
  }

  const rules = await rulesQuery;

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

  let existingContext: RuleContext | null = null;

  if (parsed.data.id) {
    const ownership = await auth.supabase
      .from("automation_rules")
      .select("id,account_id,provider_post_id,network,source")
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

    existingContext = ownership.data as RuleContext;
  }

  const resolvedContext = parsed.data.id
    ? existingContext
    : await resolveNewRuleContext({
        accountId: parsed.data.accountId,
        network: parsed.data.network,
        postUrl: parsed.data.postUrl,
        providerPostId: parsed.data.providerPostId,
        source: parsed.data.source,
        supabase: auth.supabase,
        workspaceId: parsed.data.workspaceId,
      });

  if (!resolvedContext) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "No se pudo resolver la publicacion. Usa un comentario ya recibido de esa publicacion o pega una URL que exista en el inbox.",
      },
      { status: 404 },
    );
  }

  const accountOk = await assertAccountBelongsToWorkspace({
    accountId: resolvedContext.account_id,
    supabase: auth.supabase,
    workspaceId: parsed.data.workspaceId,
  });

  if (!accountOk.ok) {
    return NextResponse.json({ ok: false, message: accountOk.message }, { status: accountOk.status });
  }

  const payload = {
    active: parsed.data.active,
    keyword: parsed.data.keyword.trim(),
    keyword_normalized: normalizeAutomationKeyword(parsed.data.keyword),
    like_comment_enabled: parsed.data.likeCommentEnabled,
    match_type: parsed.data.matchType,
    private_reply_enabled: parsed.data.privateReplyEnabled,
    private_reply_text: parsed.data.privateReplyEnabled ? parsed.data.privateReplyText.trim() : null,
    public_reply_enabled: parsed.data.publicReplyEnabled,
    public_reply_text: parsed.data.publicReplyEnabled ? parsed.data.publicReplyText.trim() : null,
    updated_at: new Date().toISOString(),
  };

  const insertPayload = {
    ...payload,
    account_id: resolvedContext.account_id,
    network: resolvedContext.network,
    provider_post_id: resolvedContext.provider_post_id,
    source: resolvedContext.source,
    workspace_id: parsed.data.workspaceId,
  };

  const query = parsed.data.id
    ? auth.supabase
        .from("automation_rules")
        .update(payload)
        .eq("id", parsed.data.id)
        .select(ruleSelect)
        .single()
    : auth.supabase
        .from("automation_rules")
        .insert(insertPayload)
        .select(ruleSelect)
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

async function resolveNewRuleContext({
  accountId,
  network,
  postUrl,
  providerPostId,
  source,
  supabase,
  workspaceId,
}: {
  accountId?: string;
  network?: "facebook" | "instagram";
  postUrl?: string;
  providerPostId?: string;
  source?: "post_comment" | "ad_comment";
  supabase: NonNullable<ReturnType<typeof createServiceSupabaseClient>>;
  workspaceId: string;
}) {
  if (accountId && providerPostId && network) {
    return {
      account_id: accountId,
      provider_post_id: providerPostId,
      network,
      source: source ?? "post_comment",
    };
  }

  if (!postUrl?.trim()) {
    return null;
  }

  const knownPosts = await supabase
    .from("inbox_items")
    .select(
      "account_id,provider_post_id,provider_permalink_url,source,connected_accounts(network)",
    )
    .eq("workspace_id", workspaceId)
    .not("provider_post_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (knownPosts.error) {
    throw new Error(knownPosts.error.message);
  }

  const match = findKnownPostForUrl(postUrl, knownPosts.data ?? []);

  if (!match?.account_id || !match.provider_post_id) {
    return null;
  }

  const account = firstOrNull(
    match.connected_accounts as { network?: string } | Array<{ network?: string }> | null,
  );

  return {
    account_id: String(match.account_id),
    provider_post_id: String(match.provider_post_id),
    network: account?.network === "instagram" ? "instagram" : "facebook",
    source: match.source === "ad_comment" ? "ad_comment" : "post_comment",
  };
}

function findKnownPostForUrl(postUrl: string, rows: Array<Record<string, unknown>>) {
  const normalizedUrl = postUrl.trim().toLowerCase();
  const instagramShortcode = normalizedUrl.match(/instagram\.com\/(?:p|reel)\/([^/?#]+)/)?.[1];
  const facebookFbid = normalizedUrl.match(/[?&]fbid=(\d+)/)?.[1];
  const facebookPostPath = normalizedUrl.match(/facebook\.com\/[^/]+\/posts\/([^/?#]+)/)?.[1];

  return rows.find((row) => {
    const permalink = String(row.provider_permalink_url ?? "").toLowerCase();
    const providerPostId = String(row.provider_post_id ?? "").toLowerCase();

    return (
      (permalink && (permalink === normalizedUrl || permalink.includes(normalizedUrl) || normalizedUrl.includes(permalink))) ||
      Boolean(instagramShortcode && permalink.includes(instagramShortcode)) ||
      Boolean(facebookFbid && (permalink.includes(`fbid=${facebookFbid}`) || providerPostId.endsWith(`_${facebookFbid}`))) ||
      Boolean(facebookPostPath && (permalink.includes(facebookPostPath) || providerPostId.endsWith(`_${facebookPostPath}`)))
    );
  });
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
  const account = firstOrNull(
    row.connected_accounts as
      | { name?: string; handle?: string | null; provider_account_id?: string }
      | Array<{ name?: string; handle?: string | null; provider_account_id?: string }>
      | null,
  );

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    accountId: row.account_id,
    accountName: account?.name,
    accountHandle: account?.handle,
    providerAccountId: account?.provider_account_id,
    providerPostId: row.provider_post_id,
    network: row.network,
    source: row.source,
    active: row.active,
    matchType: row.match_type,
    keyword: row.keyword,
    likeCommentEnabled: row.like_comment_enabled,
    publicReplyEnabled: row.public_reply_enabled,
    publicReplyText: row.public_reply_text,
    privateReplyEnabled: row.private_reply_enabled,
    privateReplyText: row.private_reply_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function resolveAutomationSchemaMessage(message: string) {
  if (message.includes("automation_rules") || message.includes("automation_executions")) {
    return "Falta ejecutar la migracion Supabase de automatizaciones.";
  }

  return message;
}
