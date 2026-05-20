-- Optionales, risikoarmes Tracking für POI-Aufrufe.
-- Speichert nur aggregierte Monatszählungen je POI, keine IP-Adressen und keine User-Agents.
-- Vor dem Deployment in Supabase SQL Editor ausführen, wenn /admin/pois Aufrufzahlen zeigen soll.
--
-- WICHTIGER FIX:
-- Eine frühere Version nutzte im month_key-Check versehentlich eine Regex mit \\d.
-- Das kann gültige Werte wie 2026-05 ablehnen und dadurch das Hochzählen verhindern.
-- Dieses Script korrigiert den Check auch bei bereits bestehender Tabelle.

create extension if not exists "uuid-ossp";

create table if not exists public.poi_view_stats (
  id uuid primary key default uuid_generate_v4(),
  poi_id uuid not null references public.pois(id) on delete cascade,
  month_key text not null,
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poi_id, month_key)
);

-- Den month_key-Check bewusst nachträglich setzen, damit auch bestehende Installationen repariert werden.
alter table public.poi_view_stats
  drop constraint if exists poi_view_stats_month_key_check;

alter table public.poi_view_stats
  add constraint poi_view_stats_month_key_check
  check (month_key ~ '^[0-9]{4}-[0-9]{2}$');

create index if not exists poi_view_stats_poi_id_idx on public.poi_view_stats(poi_id);
create index if not exists poi_view_stats_month_key_idx on public.poi_view_stats(month_key);

alter table public.poi_view_stats enable row level security;

-- Normale Nutzer greifen nicht direkt auf diese Tabelle zu. Lesen/Schreiben erfolgt serverseitig.
-- Diese Funktion macht das Hochzählen atomar und verhindert verlorene Updates bei parallelen Aufrufen.
create or replace function public.increment_poi_view(p_poi_id uuid, p_month_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.poi_view_stats (poi_id, month_key, view_count, updated_at)
  values (p_poi_id, p_month_key, 1, now())
  on conflict (poi_id, month_key)
  do update set
    view_count = public.poi_view_stats.view_count + 1,
    updated_at = now();
end;
$$;

revoke all on function public.increment_poi_view(uuid, text) from public;
grant execute on function public.increment_poi_view(uuid, text) to anon, authenticated, service_role;

-- Liefert aggregierte Aufrufzahlen für die Admin-POI-Liste.
-- SECURITY DEFINER ist bewusst gewählt, damit /admin/pois die Werte auch dann
-- lesen kann, wenn RLS direkte Selects auf poi_view_stats blockiert.
create or replace function public.get_poi_view_stats_for_admin(
  p_poi_ids uuid[],
  p_month_key text
)
returns table (
  poi_id uuid,
  view_count_month bigint,
  view_count_all bigint
)
language sql
security definer
set search_path = public
as $$
  select
    s.poi_id,
    coalesce(sum(s.view_count) filter (where s.month_key = p_month_key), 0)::bigint as view_count_month,
    coalesce(sum(s.view_count), 0)::bigint as view_count_all
  from public.poi_view_stats s
  where s.poi_id = any(p_poi_ids)
  group by s.poi_id;
$$;

revoke all on function public.get_poi_view_stats_for_admin(uuid[], text) from public;
grant execute on function public.get_poi_view_stats_for_admin(uuid[], text) to authenticated, service_role;
