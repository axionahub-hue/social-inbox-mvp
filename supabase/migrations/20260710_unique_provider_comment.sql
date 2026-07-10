create unique index if not exists inbox_items_unique_provider_comment_idx
  on inbox_items (workspace_id, account_id, provider_comment_id)
  where provider_comment_id is not null;
