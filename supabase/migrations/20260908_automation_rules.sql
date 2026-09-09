create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid not null references connected_accounts(id) on delete cascade,
  provider_post_id text not null,
  network network not null,
  source inbox_source,
  active boolean not null default true,
  match_type text not null check (match_type in ('contains', 'starts_with', 'equals')),
  keyword text not null,
  keyword_normalized text not null,
  like_comment_enabled boolean not null default false,
  public_reply_enabled boolean not null default false,
  public_reply_text text,
  private_reply_enabled boolean not null default false,
  private_reply_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_rules_has_action_check check (
    like_comment_enabled
    or
    (public_reply_enabled and nullif(trim(public_reply_text), '') is not null)
    or
    (private_reply_enabled and nullif(trim(private_reply_text), '') is not null)
  )
);

create table if not exists automation_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  rule_id uuid not null references automation_rules(id) on delete cascade,
  inbox_item_id uuid not null references inbox_items(id) on delete cascade,
  provider_comment_id text not null,
  destination text not null check (destination in ('like_comment', 'public_comment', 'private_message')),
  action_queue_id uuid references action_queue(id) on delete set null,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_rules_post_active_idx
  on automation_rules (workspace_id, account_id, provider_post_id, active);

create unique index if not exists automation_executions_rule_comment_destination_idx
  on automation_executions (rule_id, provider_comment_id, destination);

alter table automation_rules enable row level security;
alter table automation_executions enable row level security;

drop policy if exists "automation rule workspace owner access" on automation_rules;
create policy "automation rule workspace owner access"
  on automation_rules
  for all
  using (
    workspace_id in (
      select id from workspaces where owner_user_id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select id from workspaces where owner_user_id = auth.uid()
    )
  );

drop policy if exists "automation execution workspace owner access" on automation_executions;
create policy "automation execution workspace owner access"
  on automation_executions
  for all
  using (
    workspace_id in (
      select id from workspaces where owner_user_id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select id from workspaces where owner_user_id = auth.uid()
    )
  );
