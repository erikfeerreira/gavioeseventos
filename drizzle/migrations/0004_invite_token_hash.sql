alter table public.staff_invites add column token_hash text;
create unique index staff_invites_token_hash_key on public.staff_invites (token_hash) where token_hash is not null;