create extension if not exists pgcrypto;

create type network as enum ('facebook', 'instagram');
create type inbox_source as enum ('messenger', 'instagram_dm', 'post_comment', 'ad_comment');
create type inbox_status as enum ('new', 'open', 'responded', 'archived');

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists connected_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  network network not null,
  provider_account_id text not null,
  name text not null,
  handle text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network, provider_account_id)
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  network network not null,
  provider_user_id text not null,
  display_name text not null,
  handle text,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, network, provider_user_id)
);

create table if not exists inbox_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_id uuid not null references connected_accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  source inbox_source not null,
  status inbox_status not null default 'new',
  provider_thread_id text,
  provider_comment_id text,
  provider_post_id text,
  provider_ad_id text,
  title text not null,
  preview text not null,
  is_liked boolean not null default false,
  is_hidden boolean not null default false,
  unread_count integer not null default 0,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inbox_messages (
  id uuid primary key default gen_random_uuid(),
  inbox_item_id uuid not null references inbox_items(id) on delete cascade,
  provider_message_id text,
  author_type text not null check (author_type in ('contact', 'agent')),
  body text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists quick_replies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  category text not null default 'General',
  body text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists action_log (
  id uuid primary key default gen_random_uuid(),
  inbox_item_id text not null,
  action text not null,
  message text,
  provider_mode text not null,
  provider_ok boolean not null,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists inbox_items_workspace_status_idx
  on inbox_items (workspace_id, status, received_at desc);

create index if not exists inbox_items_provider_refs_idx
  on inbox_items (provider_thread_id, provider_comment_id, provider_post_id);

create index if not exists webhook_events_unprocessed_idx
  on webhook_events (provider, created_at)
  where processed_at is null;
