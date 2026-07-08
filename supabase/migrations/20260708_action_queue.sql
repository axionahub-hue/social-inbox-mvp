create table if not exists action_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  inbox_item_id uuid not null references inbox_items(id) on delete cascade,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  previous_state jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  provider_mode text,
  provider_ok boolean,
  provider_payload jsonb not null default '{}'::jsonb,
  last_error text,
  locked_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inbox_items
  add column if not exists action_state text,
  add column if not exists action_error text,
  add column if not exists action_queue_id uuid;

alter table inbox_messages
  add column if not exists delivery_status text not null default 'sent',
  add column if not exists action_queue_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'inbox_items_action_queue_id_fkey') then
    alter table inbox_items
      add constraint inbox_items_action_queue_id_fkey
      foreign key (action_queue_id) references action_queue(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inbox_messages_action_queue_id_fkey') then
    alter table inbox_messages
      add constraint inbox_messages_action_queue_id_fkey
      foreign key (action_queue_id) references action_queue(id) on delete set null;
  end if;
end $$;

create index if not exists action_queue_status_created_idx
  on action_queue (status, created_at);

alter table action_queue enable row level security;
