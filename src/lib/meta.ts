import crypto from "node:crypto";
import type { InboxAction } from "@/lib/types";

const graphVersion = process.env.META_GRAPH_VERSION ?? "v25.0";
const graphBaseUrl = `https://graph.facebook.com/${graphVersion}`;
const facebookDialogBaseUrl = `https://www.facebook.com/${graphVersion}/dialog/oauth`;

const defaultMetaOAuthScopes = ["pages_show_list"];

export const metaTargetScopes = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_engagement",
  "pages_messaging",
  "pages_manage_metadata",
  "business_management",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
] as const;

export const metaOAuthScopes = resolveMetaOAuthScopes();

type MetaOAuthStatePayload = {
  exp: number;
  nonce: string;
  userId: string;
  workspaceId: string;
};

export type MetaActionInput = {
  action: InboxAction;
  externalId: string;
  accessToken?: string;
  message?: string;
};

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message?: string;
  };
};

type MetaPermissionRow = {
  permission: string;
  status: "granted" | "declined" | "expired" | string;
};

type MetaPermissionsResponse = {
  data?: MetaPermissionRow[];
  error?: {
    message?: string;
  };
};

type MetaInstagramAccount = {
  id: string;
  name?: string;
  username?: string;
};

export type MetaPageAccount = {
  id: string;
  name: string;
  username?: string;
  access_token?: string;
  instagram_business_account?: MetaInstagramAccount;
};

type MetaPagesResponse = {
  data?: MetaPageAccount[];
  paging?: {
    next?: string;
  };
  error?: {
    message?: string;
  };
};

type MetaBusiness = {
  id: string;
  name?: string;
};

type MetaBusinessesResponse = {
  data?: MetaBusiness[];
  paging?: {
    next?: string;
  };
  error?: {
    message?: string;
  };
};

export function isMetaConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function getMetaOAuthRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/meta/oauth/callback`;
}

export function buildMetaOAuthUrl({
  origin,
  state,
}: {
  origin: string;
  state: string;
}) {
  if (!process.env.META_APP_ID) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: getMetaOAuthRedirectUri(origin),
    response_type: "code",
    auth_type: "rerequest",
    scope: metaOAuthScopes.join(","),
    state,
  });

  if (process.env.META_LOGIN_CONFIG_ID) {
    params.set("config_id", process.env.META_LOGIN_CONFIG_ID);
    params.set("override_default_response_type", "true");
  }

  return `${facebookDialogBaseUrl}?${params.toString()}`;
}

export async function exchangeMetaCodeForToken({
  code,
  origin,
}: {
  code: string;
  origin: string;
}) {
  return requestMetaToken({
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: getMetaOAuthRedirectUri(origin),
    code,
  });
}

export async function exchangeMetaLongLivedToken(shortLivedToken: string) {
  return requestMetaToken({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    fb_exchange_token: shortLivedToken,
  });
}

export async function fetchMetaGrantedScopes(accessToken: string) {
  const payload = await requestGraph<MetaPermissionsResponse>("me/permissions", {
    access_token: accessToken,
  });

  return (payload.data ?? [])
    .filter((permission) => permission.status === "granted")
    .map((permission) => permission.permission);
}

export async function fetchMetaPageAccounts(accessToken: string) {
  return fetchMetaPageAccountsForScopes(accessToken, []);
}

export async function fetchMetaPageAccountsForScopes(accessToken: string, grantedScopes: string[]) {
  const directPages = await fetchMetaUserPageAccounts(accessToken);

  if (!grantedScopes.includes("business_management")) {
    return directPages;
  }

  const businessPages = await fetchMetaBusinessPageAccounts(accessToken);
  const pagesById = new Map<string, MetaPageAccount>();

  for (const page of [...directPages, ...businessPages]) {
    const existing = pagesById.get(page.id);
    pagesById.set(page.id, {
      ...existing,
      ...page,
      access_token: page.access_token ?? existing?.access_token,
      instagram_business_account:
        page.instagram_business_account ?? existing?.instagram_business_account,
    });
  }

  return [...pagesById.values()];
}

async function fetchMetaUserPageAccounts(accessToken: string) {
  const withInstagram = await requestPagedGraph<MetaPagesResponse, MetaPageAccount>("me/accounts", {
    fields: "id,name,username,access_token,instagram_business_account{id,name,username}",
    limit: "100",
    access_token: accessToken,
  });

  if (withInstagram.ok) {
    return withInstagram.data;
  }

  const pagesOnly = await requestPagedGraph<MetaPagesResponse, MetaPageAccount>("me/accounts", {
    fields: "id,name,username,access_token",
    limit: "100",
    access_token: accessToken,
  });

  if (!pagesOnly.ok) {
    throw new Error(pagesOnly.errorMessage ?? "No se pudieron leer paginas de Meta.");
  }

  return pagesOnly.data;
}

async function fetchMetaBusinessPageAccounts(accessToken: string) {
  const businesses = await requestPagedGraph<MetaBusinessesResponse, MetaBusiness>("me/businesses", {
    fields: "id,name",
    limit: "100",
    access_token: accessToken,
  });

  if (!businesses.ok) {
    return [];
  }

  const pageResults = await Promise.all(
    businesses.data.flatMap((business) => [
      fetchMetaBusinessPageEdge(accessToken, business.id, "owned_pages"),
      fetchMetaBusinessPageEdge(accessToken, business.id, "client_pages"),
    ]),
  );

  return pageResults.flat();
}

async function fetchMetaBusinessPageEdge(
  accessToken: string,
  businessId: string,
  edge: "owned_pages" | "client_pages",
) {
  const withInstagram = await requestPagedGraph<MetaPagesResponse, MetaPageAccount>(
    `${businessId}/${edge}`,
    {
      fields: "id,name,username,access_token,instagram_business_account{id,name,username}",
      limit: "100",
      access_token: accessToken,
    },
  );

  if (withInstagram.ok) {
    return withInstagram.data;
  }

  const pagesOnly = await requestPagedGraph<MetaPagesResponse, MetaPageAccount>(
    `${businessId}/${edge}`,
    {
      fields: "id,name,username,access_token",
      limit: "100",
      access_token: accessToken,
    },
  );

  return pagesOnly.ok ? pagesOnly.data : [];
}

export function encryptMetaToken(token: string) {
  const key = createMetaTokenEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function resolveMetaTokenExpiresAt(expiresInSeconds?: number) {
  if (!expiresInSeconds) {
    return null;
  }

  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function createMetaOAuthState(payload: Omit<MetaOAuthStatePayload, "exp" | "nonce">) {
  const statePayload: MetaOAuthStatePayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(statePayload)).toString("base64url");
  const signature = signMetaOAuthState(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyMetaOAuthState(state: string | null) {
  if (!state) {
    return null;
  }

  const [encodedPayload, signature] = state.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signMetaOAuthState(encodedPayload);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as MetaOAuthStatePayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function verifyMetaWebhookSignature(rawBody: string, signature: string | null) {
  if (!process.env.META_APP_SECRET) {
    return process.env.NODE_ENV !== "production";
  }

  if (!signature?.startsWith("sha256=")) {
    return false;
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", process.env.META_APP_SECRET)
      .update(rawBody)
      .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function verifyMetaWebhookChallenge(searchParams: URLSearchParams) {
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    challenge &&
    token &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return challenge;
  }

  return null;
}

export async function executeMetaAction(input: MetaActionInput) {
  if (input.action === "archive" || input.action === "unarchive") {
    return {
      mode: "internal",
      ok: true,
      message: input.action === "archive" ? "Conversacion archivada." : "Conversacion desarchivada.",
    };
  }

  if (!input.accessToken) {
    return {
      mode: "demo",
      ok: true,
      message: `Accion ${input.action} registrada en modo demo.`,
    };
  }

  const endpoint = resolveActionEndpoint(input);
  const body = resolveActionBody(input);

  const response = await fetch(`${graphBaseUrl}/${endpoint}`, {
    method: input.action === "unlike" ? "DELETE" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      access_token: input.accessToken,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    return {
      mode: "meta",
      ok: false,
      message: payload?.error?.message ?? "Meta rechazo la accion.",
      payload,
    };
  }

  return {
    mode: "meta",
    ok: true,
    message: `Accion ${input.action} ejecutada en Meta.`,
    payload,
  };
}

function signMetaOAuthState(encodedPayload: string) {
  const secret = process.env.META_APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("META_APP_SECRET or SUPABASE_SERVICE_ROLE_KEY is required to sign OAuth state.");
  }

  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function resolveMetaOAuthScopes() {
  const configuredScopes = process.env.META_OAUTH_SCOPES?.split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (!configuredScopes?.length) {
    return defaultMetaOAuthScopes;
  }

  return [...new Set(configuredScopes)];
}

async function requestMetaToken(params: Record<string, string>) {
  const url = new URL(`${graphBaseUrl}/oauth/access_token`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const payload = (await response.json()) as MetaTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error?.message ?? "Meta no devolvio access token.");
  }

  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in,
  };
}

async function requestGraph<T>(path: string, params: Record<string, string>) {
  const url = new URL(`${graphBaseUrl}/${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const payload = (await response.json()) as T;

  if (!response.ok) {
    return {
      ...(typeof payload === "object" && payload ? payload : {}),
      error: {
        message: readMetaErrorMessage(payload) ?? "Meta rechazo la consulta.",
      },
    } as T;
  }

  return payload;
}

async function requestPagedGraph<T extends { data?: TItem[]; paging?: { next?: string } }, TItem>(
  path: string,
  params: Record<string, string>,
) {
  let nextUrl: string | null = `${graphBaseUrl}/${path}`;
  const firstUrl = new URL(nextUrl);
  const data: TItem[] = [];

  for (const [key, value] of Object.entries(params)) {
    firstUrl.searchParams.set(key, value);
  }

  nextUrl = firstUrl.toString();

  while (nextUrl) {
    const response = await fetch(nextUrl);
    const payload = (await response.json()) as T;

    if (!response.ok) {
      return {
        ok: false,
        data,
        errorMessage: readMetaErrorMessage(payload) ?? "Meta rechazo la consulta.",
      };
    }

    data.push(...(payload.data ?? []));
    nextUrl = payload.paging?.next ?? null;
  }

  return {
    ok: true,
    data,
    errorMessage: null,
  };
}

function readMetaErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return null;
  }

  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : null;
}

function createMetaTokenEncryptionKey() {
  const secret = process.env.META_TOKEN_ENCRYPTION_KEY || process.env.META_APP_SECRET;

  if (!secret) {
    throw new Error("META_TOKEN_ENCRYPTION_KEY or META_APP_SECRET is required to encrypt Meta tokens.");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

function resolveActionEndpoint(input: MetaActionInput) {
  switch (input.action) {
    case "reply":
      return `${input.externalId}/comments`;
    case "like":
      return `${input.externalId}/likes`;
    case "unlike":
      return `${input.externalId}/likes`;
    case "hide":
    case "unhide":
      return input.externalId;
    case "block":
      return `${input.externalId}/blocked`;
    case "archive":
    case "unarchive":
      return input.externalId;
  }
}

function resolveActionBody(input: MetaActionInput) {
  switch (input.action) {
    case "reply":
      return { message: input.message ?? "" };
    case "hide":
      return { is_hidden: true };
    case "unhide":
      return { is_hidden: false };
    default:
      return {};
  }
}
