import { enqueueInboxAction } from "@/lib/inbox-action-queue";
import type { SupabaseServiceClient } from "@/lib/inbox-persistence";
import type { InboxSource, Network, ReplyMode } from "@/lib/types";

export type AutomationMatchType = "contains" | "starts_with" | "equals";
export type AutomationDestination = "public_comment" | "private_message";

type AutomationRuleRow = {
  id: string;
  created_at: string;
  public_reply_enabled: boolean;
  public_reply_text: string | null;
  private_reply_enabled: boolean;
  private_reply_text: string | null;
  match_type: AutomationMatchType;
  keyword_normalized: string;
};

type InboxItemRow = {
  id: string;
  created_at: string;
  source: InboxSource;
};

type EvaluateCommentAutomationsInput = {
  supabase: SupabaseServiceClient;
  workspaceId: string;
  accountId: string;
  network: Network;
  providerPostId: string;
  providerCommentId: string;
  commentText: string;
  source?: InboxSource;
};

export function normalizeAutomationKeyword(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export async function evaluateCommentAutomations({
  accountId,
  commentText,
  providerCommentId,
  providerPostId,
  source,
  supabase,
  workspaceId,
}: EvaluateCommentAutomationsInput) {
  const item = await resolveCommentInboxItem({
    accountId,
    providerCommentId,
    supabase,
    workspaceId,
  });

  if (!item) {
    return { matched: 0, queued: 0, skipped: 0 };
  }

  const rules = await loadActiveRulesForPost({
    accountId,
    providerPostId,
    supabase,
    workspaceId,
  });

  if (rules.length === 0) {
    return { matched: 0, queued: 0, skipped: 0 };
  }

  const normalizedComment = normalizeAutomationKeyword(commentText);
  let matched = 0;
  let queued = 0;
  let skipped = 0;

  for (const rule of rules) {
    if (wasItemCreatedBeforeRule({ item, rule })) {
      skipped += 1;
      continue;
    }

    if (!doesRuleMatch(rule, normalizedComment)) {
      continue;
    }

    matched += 1;

    const destinations = resolveRuleDestinations(rule);

    for (const destination of destinations) {
      const execution = await reserveAutomationExecution({
        destination: destination.replyMode,
        itemId: item.id,
        providerCommentId,
        ruleId: rule.id,
        supabase,
        workspaceId,
      });

      if (!execution) {
        skipped += 1;
        continue;
      }

      try {
        const queueId = await enqueueInboxAction({
          input: {
            action: "reply",
            externalId: providerCommentId,
            itemId: item.id,
            message: destination.message,
            replyMode: destination.replyMode,
          },
          supabase,
          workspaceId,
        });

        await supabase
          .from("automation_executions")
          .update({
            action_queue_id: queueId,
            status: "queued",
            updated_at: new Date().toISOString(),
          })
          .eq("id", execution.id);

        queued += 1;
      } catch (error) {
        await supabase
          .from("automation_executions")
          .update({
            error: error instanceof Error ? error.message : "No se pudo encolar automatizacion.",
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", execution.id);
      }
    }
  }

  return { matched, queued, skipped, source: source ?? item.source };
}

async function resolveCommentInboxItem({
  accountId,
  providerCommentId,
  supabase,
  workspaceId,
}: {
  accountId: string;
  providerCommentId: string;
  supabase: SupabaseServiceClient;
  workspaceId: string;
}) {
  const result = await supabase
    .from("inbox_items")
    .select("id,created_at,source")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .eq("provider_comment_id", providerCommentId)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data as InboxItemRow | null;
}

async function loadActiveRulesForPost({
  accountId,
  providerPostId,
  supabase,
  workspaceId,
}: {
  accountId: string;
  providerPostId: string;
  supabase: SupabaseServiceClient;
  workspaceId: string;
}) {
  const result = await supabase
    .from("automation_rules")
    .select(
      "id,created_at,public_reply_enabled,public_reply_text,private_reply_enabled,private_reply_text,match_type,keyword_normalized",
    )
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .eq("provider_post_id", providerPostId)
    .eq("active", true);

  if (result.error) {
    if (isMissingAutomationSchemaError(result.error.message)) {
      return [];
    }

    throw new Error(result.error.message);
  }

  return (result.data ?? []) as AutomationRuleRow[];
}

function wasItemCreatedBeforeRule({
  item,
  rule,
}: {
  item: InboxItemRow;
  rule: AutomationRuleRow;
}) {
  const itemCreatedAt = new Date(item.created_at).getTime();
  const ruleCreatedAt = new Date(rule.created_at).getTime();

  if (Number.isNaN(itemCreatedAt) || Number.isNaN(ruleCreatedAt)) {
    return false;
  }

  return itemCreatedAt < ruleCreatedAt;
}

function doesRuleMatch(rule: AutomationRuleRow, normalizedComment: string) {
  if (!rule.keyword_normalized) {
    return false;
  }

  switch (rule.match_type) {
    case "equals":
      return normalizedComment === rule.keyword_normalized;
    case "starts_with":
      return normalizedComment.startsWith(rule.keyword_normalized);
    case "contains":
      return normalizedComment.includes(rule.keyword_normalized);
  }
}

function resolveRuleDestinations(rule: AutomationRuleRow) {
  const destinations: Array<{ replyMode: ReplyMode; message: string }> = [];

  if (rule.public_reply_enabled && rule.public_reply_text?.trim()) {
    destinations.push({
      replyMode: "public_comment",
      message: rule.public_reply_text.trim(),
    });
  }

  if (rule.private_reply_enabled && rule.private_reply_text?.trim()) {
    destinations.push({
      replyMode: "private_message",
      message: rule.private_reply_text.trim(),
    });
  }

  return destinations;
}

async function reserveAutomationExecution({
  destination,
  itemId,
  providerCommentId,
  ruleId,
  supabase,
  workspaceId,
}: {
  destination: ReplyMode;
  itemId: string;
  providerCommentId: string;
  ruleId: string;
  supabase: SupabaseServiceClient;
  workspaceId: string;
}) {
  const inserted = await supabase
    .from("automation_executions")
    .insert({
      destination,
      inbox_item_id: itemId,
      provider_comment_id: providerCommentId,
      rule_id: ruleId,
      status: "reserved",
      workspace_id: workspaceId,
    })
    .select("id")
    .single();

  if (inserted.error) {
    if (isDuplicateExecutionError(inserted.error) || isMissingAutomationSchemaError(inserted.error.message)) {
      return null;
    }

    throw new Error(inserted.error.message);
  }

  return inserted.data as { id: string };
}

function isDuplicateExecutionError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    Boolean(error.message?.includes("automation_executions_rule_comment_destination_idx"))
  );
}

function isMissingAutomationSchemaError(message?: string) {
  return Boolean(
    message?.includes("automation_rules") ||
      message?.includes("automation_executions") ||
      message?.includes("keyword_normalized"),
  );
}
