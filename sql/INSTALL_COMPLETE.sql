create extension if not exists "uuid-ossp";

begin;

-- Clean up legacy objects that are no longer used by the current app version
alter table if exists public.pois drop column if exists nice_to_know;
alter table if exists public.pois drop column if exists affiliate_url;
drop table if exists public.audit_logs cascade;
drop table if exists public.ai_generations cascade;

-- Core tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.pois (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  short_description text,
  description text,
  category_id uuid not null references public.categories(id) on delete restrict,
  state text,
  city text,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  opening_hours_text text,
  price_info_text text,
  hotels_nearby_text text,
  website_url text,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.poi_images (
  id uuid primary key default uuid_generate_v4(),
  poi_id uuid not null references public.pois(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  path text not null unique,
  caption text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  is_cover boolean not null default false,
  is_gallery_pick boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.poi_change_requests (
  id uuid primary key default uuid_generate_v4(),
  poi_id uuid not null references public.pois(id) on delete cascade,
  submitted_by uuid references auth.users(id) on delete set null,
  field_name text not null,
  old_value text,
  new_value text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  poi_id uuid not null references public.pois(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, poi_id)
);

create table if not exists public.poi_editorial (
  id uuid primary key default uuid_generate_v4(),
  poi_id uuid not null unique references public.pois(id) on delete cascade,
  highlights_json jsonb not null default '[]'::jsonb,
  nice_to_know_json jsonb not null default '[]'::jsonb,
  visit_duration_text text,
  best_time_to_visit_text text,
  family_friendly_json jsonb not null default '{}'::jsonb,
  suggested_tags_json jsonb not null default '[]'::jsonb,
  seo_title text,
  seo_description text,
  editorial_review_notes_json jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.poi_external_links (
  id uuid primary key default uuid_generate_v4(),
  poi_id uuid not null references public.pois(id) on delete cascade,
  label text,
  url text not null,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_providers (
  provider_key text primary key,
  provider_name text not null,
  is_global_enabled boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.poi_affiliate_settings (
  id uuid primary key default uuid_generate_v4(),
  poi_id uuid not null references public.pois(id) on delete cascade,
  provider_key text not null references public.affiliate_providers(provider_key) on delete cascade,
  is_enabled boolean not null default false,
  manual_url text,
  generated_text text,
  cta_text text,
  placement text default 'after_description',
  user_intent text default 'information',
  updated_at timestamptz not null default now(),
  unique (poi_id, provider_key)
);

create table if not exists public.poi_reviews (
  id uuid primary key default uuid_generate_v4(),
  poi_id uuid not null references public.pois(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poi_id, user_id)
);

create table if not exists public.poi_review_replies (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references public.poi_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reply_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id) on delete set null
);

-- Helper function
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pois_updated_at on public.pois;
create trigger trg_pois_updated_at before update on public.pois for each row execute function public.set_updated_at();

drop trigger if exists trg_poi_editorial_updated_at on public.poi_editorial;
create trigger trg_poi_editorial_updated_at before update on public.poi_editorial for each row execute function public.set_updated_at();

drop trigger if exists trg_poi_external_links_updated_at on public.poi_external_links;
create trigger trg_poi_external_links_updated_at before update on public.poi_external_links for each row execute function public.set_updated_at();

drop trigger if exists trg_poi_reviews_updated_at on public.poi_reviews;
create trigger trg_poi_reviews_updated_at before update on public.poi_reviews for each row execute function public.set_updated_at();

drop trigger if exists trg_poi_affiliate_settings_updated_at on public.poi_affiliate_settings;
create trigger trg_poi_affiliate_settings_updated_at before update on public.poi_affiliate_settings for each row execute function public.set_updated_at();

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();

-- Seed data
insert into public.categories (name, slug, description, sort_order)
values
  ('Nationalpark', 'nationalpark', 'Nationalparks und Schutzgebiete', 10),
  ('Aussichtspunkt', 'aussichtspunkt', 'Scenic Overlooks und Viewpoints', 20),
  ('Museum', 'museum', 'Museen und Ausstellungen', 30),
  ('Historischer Ort', 'historischer-ort', 'Historische Sehenswürdigkeiten', 40),
  ('Stadt-Highlight', 'stadt-highlight', 'Sehenswürdigkeiten in Städten', 50),
  ('Hidden Gem', 'hidden-gem', 'Weniger bekannte Highlights', 60)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.affiliate_providers (provider_key, provider_name, is_global_enabled, sort_order)
values
  ('booking', 'Booking.com', true, 10),
  ('getyourguide', 'GetYourGuide', true, 20),
  ('amazon', 'Amazon', true, 30)
on conflict (provider_key) do update set
  provider_name = excluded.provider_name,
  is_global_enabled = excluded.is_global_enabled,
  sort_order = excluded.sort_order;

insert into public.app_settings (key, value_json)
values ('public_ranking_visible', 'false'::jsonb)
on conflict (key) do nothing;

-- RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.pois enable row level security;
alter table public.poi_images enable row level security;
alter table public.poi_change_requests enable row level security;
alter table public.favorites enable row level security;
alter table public.poi_editorial enable row level security;
alter table public.poi_external_links enable row level security;
alter table public.affiliate_providers enable row level security;
alter table public.poi_affiliate_settings enable row level security;
alter table public.poi_reviews enable row level security;
alter table public.poi_review_replies enable row level security;
alter table public.app_settings enable row level security;

-- Drop policies if they already exist

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "categories_public_read" on public.categories;
drop policy if exists "categories_admin_all" on public.categories;
drop policy if exists "pois_public_read_published" on public.pois;
drop policy if exists "pois_insert_own" on public.pois;
drop policy if exists "pois_update_own_pending" on public.pois;
drop policy if exists "pois_admin_all" on public.pois;
drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;
drop policy if exists "change_requests_insert_own" on public.poi_change_requests;
drop policy if exists "change_requests_select_own_or_admin" on public.poi_change_requests;
drop policy if exists "change_requests_admin_update" on public.poi_change_requests;
drop policy if exists "images_public_read_approved" on public.poi_images;
drop policy if exists "images_insert_own" on public.poi_images;
drop policy if exists "images_admin_all" on public.poi_images;
drop policy if exists "poi_editorial_public_read" on public.poi_editorial;
drop policy if exists "poi_editorial_admin_all" on public.poi_editorial;
drop policy if exists "poi_external_links_owner_or_admin_select" on public.poi_external_links;
drop policy if exists "poi_external_links_owner_insert" on public.poi_external_links;
drop policy if exists "poi_external_links_admin_all" on public.poi_external_links;
drop policy if exists "affiliate_providers_public_read" on public.affiliate_providers;
drop policy if exists "affiliate_settings_admin_all" on public.poi_affiliate_settings;
drop policy if exists "poi_reviews_public_read" on public.poi_reviews;
drop policy if exists "poi_reviews_user_insert_own" on public.poi_reviews;
drop policy if exists "poi_reviews_user_update_own" on public.poi_reviews;
drop policy if exists "poi_review_replies_public_read" on public.poi_review_replies;
drop policy if exists "poi_review_replies_user_insert_own" on public.poi_review_replies;
drop policy if exists "app_settings_read_public" on public.app_settings;
drop policy if exists "app_settings_insert_admin_only" on public.app_settings;
drop policy if exists "app_settings_update_admin_only" on public.app_settings;
drop policy if exists "app_settings_delete_admin_only" on public.app_settings;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using (auth.uid() = id or public.is_admin());

create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy "categories_public_read" on public.categories
for select to anon, authenticated
using (is_active = true or public.is_admin());

create policy "categories_admin_all" on public.categories
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "pois_public_read_published" on public.pois
for select to anon, authenticated
using (status = 'published' or auth.uid() = created_by or public.is_admin());

create policy "pois_insert_own" on public.pois
for insert to authenticated
with check (auth.uid() = created_by and status = 'pending');

create policy "pois_update_own_pending" on public.pois
for update to authenticated
using (auth.uid() = created_by and status = 'pending')
with check (auth.uid() = created_by);

create policy "pois_admin_all" on public.pois
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "favorites_select_own" on public.favorites
for select to authenticated
using (auth.uid() = user_id);

create policy "favorites_insert_own" on public.favorites
for insert to authenticated
with check (auth.uid() = user_id);

create policy "favorites_delete_own" on public.favorites
for delete to authenticated
using (auth.uid() = user_id);

create policy "change_requests_insert_own" on public.poi_change_requests
for insert to authenticated
with check (auth.uid() = submitted_by);

create policy "change_requests_select_own_or_admin" on public.poi_change_requests
for select to authenticated
using (auth.uid() = submitted_by or public.is_admin());

create policy "change_requests_admin_update" on public.poi_change_requests
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "images_public_read_approved" on public.poi_images
for select to anon, authenticated
using (status = 'approved' or auth.uid() = uploaded_by or public.is_admin());

create policy "images_insert_own" on public.poi_images
for insert to authenticated
with check (auth.uid() = uploaded_by);

create policy "images_admin_all" on public.poi_images
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "poi_editorial_public_read" on public.poi_editorial
for select to anon, authenticated
using (
  exists (
    select 1 from public.pois p
    where p.id = poi_id
      and (p.status = 'published' or p.created_by = auth.uid() or public.is_admin())
  )
);

create policy "poi_editorial_admin_all" on public.poi_editorial
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "poi_external_links_owner_or_admin_select" on public.poi_external_links
for select to authenticated
using (
  auth.uid() = submitted_by
  or exists (select 1 from public.pois p where p.id = poi_id and p.created_by = auth.uid())
  or public.is_admin()
);

create policy "poi_external_links_owner_insert" on public.poi_external_links
for insert to authenticated
with check (
  auth.uid() = submitted_by
  and exists (select 1 from public.pois p where p.id = poi_id and p.created_by = auth.uid())
);

create policy "poi_external_links_admin_all" on public.poi_external_links
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "affiliate_providers_public_read" on public.affiliate_providers
for select to anon, authenticated
using (is_global_enabled = true or public.is_admin());

create policy "affiliate_settings_admin_all" on public.poi_affiliate_settings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "poi_reviews_public_read" on public.poi_reviews
for select to anon, authenticated
using (exists (select 1 from public.pois p where p.id = poi_id and p.status = 'published'));

create policy "poi_reviews_user_insert_own" on public.poi_reviews
for insert to authenticated
with check (auth.uid() = user_id);

create policy "poi_reviews_user_update_own" on public.poi_reviews
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "poi_review_replies_public_read" on public.poi_review_replies
for select to anon, authenticated
using (true);

create policy "poi_review_replies_user_insert_own" on public.poi_review_replies
for insert to authenticated
with check (auth.uid() = user_id);

create policy "app_settings_read_public" on public.app_settings
for select to anon, authenticated
using (true);

create policy "app_settings_insert_admin_only" on public.app_settings
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create policy "app_settings_update_admin_only" on public.app_settings
for update to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create policy "app_settings_delete_admin_only" on public.app_settings
for delete to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

-- Storage bucket and policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('poi-images', 'poi-images', false, 12582912, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_insert_authenticated" on storage.objects;
drop policy if exists "storage_update_authenticated" on storage.objects;
drop policy if exists "storage_delete_authenticated" on storage.objects;
drop policy if exists "storage_read_poi_images" on storage.objects;

create policy "storage_insert_authenticated" on storage.objects
for insert to authenticated
with check (bucket_id = 'poi-images');

create policy "storage_update_authenticated" on storage.objects
for update to authenticated
using (bucket_id = 'poi-images')
with check (bucket_id = 'poi-images');

create policy "storage_delete_authenticated" on storage.objects
for delete to authenticated
using (bucket_id = 'poi-images');

create policy "storage_read_poi_images" on storage.objects
for select to authenticated, anon
using (bucket_id = 'poi-images');

-- Helpful indexes
create index if not exists idx_pois_status on public.pois(status);
create index if not exists idx_pois_category_id on public.pois(category_id);
create index if not exists idx_pois_state on public.pois(state);
create index if not exists idx_pois_city on public.pois(city);
create index if not exists idx_pois_updated_at on public.pois(updated_at desc);
create index if not exists idx_pois_created_at on public.pois(created_at desc);
create index if not exists idx_pois_latitude on public.pois(latitude);
create index if not exists idx_pois_longitude on public.pois(longitude);
create unique index if not exists idx_pois_slug_unique on public.pois(slug);
create index if not exists idx_poi_editorial_poi_id on public.poi_editorial(poi_id);
create index if not exists idx_poi_images_poi_id on public.poi_images(poi_id);
create index if not exists idx_poi_images_status on public.poi_images(status);
create index if not exists idx_poi_external_links_poi_id on public.poi_external_links(poi_id);
create index if not exists idx_poi_external_links_status on public.poi_external_links(status);
create index if not exists idx_poi_affiliate_settings_poi_id on public.poi_affiliate_settings(poi_id);
create index if not exists idx_poi_reviews_poi_id on public.poi_reviews(poi_id);
create index if not exists idx_poi_review_replies_review_id on public.poi_review_replies(review_id);
create index if not exists idx_favorites_poi_id on public.favorites(poi_id);
create index if not exists idx_favorites_user_id on public.favorites(user_id);

commit;
