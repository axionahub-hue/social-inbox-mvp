import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const cache = new Map();
let providerCalls = 0;
let onProviderCall;
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} };
  cache.set(file, loaded);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (name) => {
    if (name === "@/lib/supabase") return { createServiceSupabaseClient: () => null };
    if (name === "@/lib/meta") return {
      decryptMetaToken: () => "test-token",
      executeMetaAction: async () => {
        providerCalls++;
        if (onProviderCall) return onProviderCall();
        throw new Error("Unexpected call to Meta");
      },
    };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  new Function("require", "module", "exports", source)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}

function database(initial = {}) {
  const tables = { inbox_items: [], action_queue: [], inbox_messages: [], automation_executions: [],
    contacts: [], action_log: [], ...structuredClone(initial) };
  const client = { tables, auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from(table) {
      tables[table] ??= [];
      const conditions = [];
      let op = "select", values, single = false, take = Infinity;
      const q = {
        select() { return q; },
        eq(key, value) { conditions.push(r => r[key] === value); return q; },
        in(key, values) { conditions.push(r => values.includes(r[key])); return q; },
        or(filter) {
          if (filter.startsWith("action_state")) conditions.push(r => r.action_state !== "deleted");
          else if (!filter.startsWith("locked_at")) throw new Error(`Unknown filter ${filter}`);
          return q;
        },
        order() { return q; }, limit(n) { take = n; return q; },
        update(value) { op = "update"; values = value; return q; },
        insert(value) { op = "insert"; values = value; return q; },
        maybeSingle() { single = true; return q; }, single() { single = true; return q; },
        then(resolve, reject) {
          try {
            let rows = tables[table].filter(r => conditions.every(c => c(r))).slice(0, take);
            if (op === "update") rows.forEach(r => Object.assign(r, values));
            if (op === "insert") {
              const row = { id: randomUUID(), ...values };
              tables[table].push(row); rows = [row];
            }
            return Promise.resolve({ data: structuredClone(single ? rows[0] ?? null : rows), error: null }).then(resolve, reject);
          } catch (error) { return Promise.reject(error).then(resolve, reject); }
        },
      };
      return q;
    },
  };
  return client;
}

const deletion = load("src/lib/deleted-comments.ts");
const queue = load("src/lib/inbox-action-queue.ts");
const persistence = load("src/lib/inbox-persistence.ts");
const automations = load("src/lib/automation-rules.ts");
const item = { id: "item", workspace_id: "workspace", account_id: "account", source: "post_comment",
  provider_comment_id: "post_comment", provider_post_id: "post", action_state: null,
  status: "new", unread_count: 1, connected_accounts: { network: "facebook", access_token_encrypted: "x", provider_account_id: "page" } };
const input = { itemId: "item", externalId: "post_comment", action: "reply", message: "hello" };
const job = { id: "job", workspace_id: "workspace", inbox_item_id: "item", action: "reply",
  payload: input, previous_state: item, status: "queued", attempt_count: 0 };
const remove = (supabase) => deletion.recordDeletedComment({ supabase, workspaceId: "workspace", accountId: "account", commentId: "post_comment", postId: "post" });

(async () => {
  const db = database({ inbox_items: [item, { ...item, id: "other", account_id: "other" }],
    action_queue: [job], inbox_messages: [{ id: "message", action_queue_id: "job", delivery_status: "pending" }],
    automation_executions: [{ id: "execution", action_queue_id: "job", status: "queued" }] });
  await remove(db);
  await remove(db);
  assert.equal(db.tables.inbox_items.length, 2);
  assert.equal(db.tables.inbox_items[0].action_state, "deleted");
  assert.equal(db.tables.inbox_items[0].unread_count, 0);
  assert.equal(db.tables.inbox_items[1].action_state, null);
  assert.equal(db.tables.action_queue[0].status, "cancelled");
  assert.equal(db.tables.automation_executions[0].status, "cancelled");
  assert.equal(db.tables.inbox_messages[0].delivery_status, "failed");
  assert.equal((await db.from("inbox_items").select().or(deletion.liveInboxItemFilter)).data.length, 1);
  await assert.rejects(queue.enqueueInboxAction({ input, supabase: db, workspaceId: "workspace" }), /eliminado/);

  const early = database();
  await remove(early);
  const comment = { commentId: "post_comment", postId: "post", message: "old polling", fromId: "person", fromName: "Person" };
  for (const persist of [persistence.persistFacebookComment, persistence.persistInstagramComment]) {
    assert.equal(await persist({ supabase: early, workspaceId: "workspace", accountId: "account",
      accountExternalId: "page", accountName: "Page", comment }), "skipped_deleted");
  }
  assert.equal(early.tables.inbox_items.length, 1);
  assert.equal((await automations.evaluateCommentAutomations({ supabase: early, workspaceId: "workspace",
    accountId: "account", network: "facebook", providerCommentId: "post_comment", providerPostId: "post", commentText: "hello" })).queued, 0);

  const stale = database({ inbox_items: [{ ...item, action_state: "deleted" }], action_queue: [job] });
  await queue.processQueuedInboxActions({ supabase: stale });
  assert.equal(stale.tables.action_queue[0].status, "cancelled");
  assert.equal(providerCalls, 0);

  for (const result of [{ ok: true, mode: "meta", payload: { id: "sent" } },
    { ok: false, mode: "meta", message: "Cannot post", payload: { error: { code: 1705 } } }]) {
    const racing = database({ inbox_items: [item], action_queue: [job] });
    onProviderCall = async () => { await remove(racing); return result; };
    await queue.processQueuedInboxActions({ supabase: racing });
    assert.equal(racing.tables.inbox_items[0].action_state, "deleted");
    assert.equal(racing.tables.inbox_items[0].unread_count, 0);
    assert.equal(racing.tables.inbox_items[0].status, "archived");
  }
  console.log("PASS: deletion, repeat delivery, account isolation, cancellation, remove-before-add, stale polling, automation guard, stale worker and in-flight success/failure.");
})().catch(error => { console.error(error); process.exitCode = 1; });
