-- Run once if a development project created duplicate Personal workspaces
-- for the same Supabase Auth user before the unique owner index existed.

with ranked_workspaces as (
  select
    id,
    owner_user_id,
    row_number() over (
      partition by owner_user_id
      order by created_at asc, id asc
    ) as workspace_rank
  from workspaces
  where owner_user_id is not null
),
duplicate_workspaces as (
  select id
  from ranked_workspaces
  where workspace_rank > 1
)
delete from workspaces
where id in (select id from duplicate_workspaces);

create unique index if not exists workspaces_owner_user_id_unique_idx
  on workspaces (owner_user_id)
  where owner_user_id is not null;
