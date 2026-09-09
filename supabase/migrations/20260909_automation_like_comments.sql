alter table automation_rules
  add column if not exists like_comment_enabled boolean not null default false;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'automation_rules'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%public_reply_enabled%'
      and pg_get_constraintdef(oid) like '%private_reply_enabled%'
  loop
    execute format('alter table automation_rules drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table automation_rules
  add constraint automation_rules_has_action_check
  check (
    like_comment_enabled
    or
    (public_reply_enabled and nullif(trim(public_reply_text), '') is not null)
    or
    (private_reply_enabled and nullif(trim(private_reply_text), '') is not null)
  );

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'automation_executions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%destination%'
  loop
    execute format('alter table automation_executions drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table automation_executions
  add constraint automation_executions_destination_check
  check (destination in ('like_comment', 'public_comment', 'private_message'));
