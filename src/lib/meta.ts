import crypto from "node:crypto";
import type { InboxAction } from "@/lib/types";

const graphVersion = process.env.META_GRAPH_VERSION ?? "v25.0";
const graphBaseUrl = `https://graph.facebook.com/${graphVersion}`;

export type MetaActionInput = {
  action: InboxAction;
  externalId: string;
  accessToken?: string;
  message?: string;
};

export function isMetaConfigured() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
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
  if (input.action === "archive") {
    return {
      mode: "internal",
      ok: true,
      message: "Conversacion archivada.",
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
