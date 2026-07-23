-- Local-only Supabase shim so migrations apply on plain Postgres for validation.
create schema if not exists auth;
create schema if not exists realtime;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
-- auth.uid() reads a GUC we can set per-session; null when unset => service_role path
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.uid', true), '')::uuid;
$$;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean)
  returns void language sql as $$ select $$;
