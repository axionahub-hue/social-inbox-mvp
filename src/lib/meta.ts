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
    scope: metaOAuthScopes.join(","),
    state,
  });

  return `${facebookDialogBaseUrl}?${params.toString()}`;
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
