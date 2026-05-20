-- Optionales, risikoarmes Tracking für POI-Aufrufe.
-- Speichert nur aggregierte Monatszählungen je POI, keine IP-Adressen und keine User-Agents.
-- Vor dem Deployment in Supabase SQL Editor ausführen, wenn /admin/pois Aufrufzahlen zeigen soll.

create table if not exists public.poi_view_stats (
  id uuid primary key default gen_random_uuid(),
  poi_id uuid not null references public.pois(id) on delete cascade,
  month_key text not null check (month_key ~ '^\\d{4}-\\d{2}$'),
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poi_id, month_key)
);

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
