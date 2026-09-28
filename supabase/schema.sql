-- ════════════════════════════════════════════════════════════════
--  SECURITY DESK — skema database Supabase
--  Jalankan SEKALI di Supabase → SQL Editor → New query → Run.
--  Aman dijalankan ulang (idempotent).
-- ════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── 1. Site / plant ──────────────────────────────────────────────
create table if not exists sites (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,              -- mis. CIK
  name        text not null,                     -- mis. FFI Plant Cikarang
  client      text,                              -- mis. PT Frisian Flag Indonesia
  created_at  timestamptz not null default now()
);

-- ── 2. Profil pengguna + peran + scope ───────────────────────────
--  role:
--    master_admin → semua site, semua menu, kelola pengguna
--    admin        → input & laporan (Admin/SPV G4S), hanya site di site_ids
--    viewer       → lihat saja (FFI), hanya site di site_ids
--    display      → khusus layar ruang Security (/display), read-only
--  modules: null = semua menu sesuai peran; atau daftar menu yang boleh
--    ('ringkasan','harian','kejadian','personel','kpi','laporan')
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'viewer'
              check (role in ('master_admin','admin','viewer','display')),
  site_ids    uuid[] not null default '{}',
  modules     text[],
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Helper untuk RLS (security definer supaya tidak rekursif ke profiles)
create or replace function app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function has_site(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.active
      and (p.role = 'master_admin' or s = any(p.site_ids))
  )
$$;

create or replace function can_write(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_site(s) and app_role() in ('master_admin','admin')
$$;

-- ── 3. Data operasional ──────────────────────────────────────────
-- Kendaraan & visitor per hari (satu baris per site/tanggal/kategori)
create table if not exists daily_counts (
  site_id     uuid not null references sites(id) on delete cascade,
  day         date not null,
  category    text not null check (category in ('karyawan','tamu','kontraktor','motor','visitor')),
  value       integer not null default 0 check (value >= 0),
  updated_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  primary key (site_id, day, category)
);

-- Total bulanan historis (sebelum sistem dipakai). Dipakai grafik 13 bulan
-- untuk bulan yang belum punya data harian.
create table if not exists monthly_baseline (
  site_id   uuid not null references sites(id) on delete cascade,
  month     date not null,                         -- tanggal 1 tiap bulan
  category  text not null check (category in ('karyawan','tamu','kontraktor','motor','visitor')),
  total     integer not null check (total >= 0),
  primary key (site_id, month, category)
);

-- Catatan kejadian/temuan per tanggal (titik merah di kalender & feed layar)
create table if not exists day_events (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites(id) on delete cascade,
  day         date not null,
  kind        text not null default 'Temuan'
              check (kind in ('Temuan','Security','Personel','Patroli','Kegiatan','Lainnya')),
  description text not null,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists day_events_site_day on day_events(site_id, day);

-- Rekap kejadian per kategori per bulan
create table if not exists incident_counts (
  site_id   uuid not null references sites(id) on delete cascade,
  month     date not null,
  category  text not null,
  value     integer not null default 0 check (value >= 0),
  note      text not null default '',
  updated_at timestamptz not null default now(),
  primary key (site_id, month, category)
);

-- Patroli (guard tour) per bulan
create table if not exists patrol_monthly (
  site_id           uuid not null references sites(id) on delete cascade,
  month             date not null,
  target_patrol     integer not null default 0,
  target_checkpoint integer not null default 0,
  actual_patrol     integer not null default 0,
  actual_checkpoint integer not null default 0,
  note              text not null default '',
  updated_at        timestamptz not null default now(),
  primary key (site_id, month)
);

-- Cuti / sakit / backup
create table if not exists leaves (
  id        uuid primary key default gen_random_uuid(),
  site_id   uuid not null references sites(id) on delete cascade,
  month     date not null,
  name      text not null default '',
  date_text text not null default '',
  type      text not null default 'Annual Leave' check (type in ('Annual Leave','Sakit','Extra Day Off','Izin')),
  backup    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists leaves_site_month on leaves(site_id, month);

-- Need improvement / temuan jangka panjang
create table if not exists improvements (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references sites(id) on delete cascade,
  opened_month date not null,
  description  text not null default '',
  priority     text not null default 'High' check (priority in ('High','Medium','Low')),
  progress     text not null default '',
  status       text not null default 'Open' check (status in ('Open','Proses','Selesai')),
  updated_at   timestamptz not null default now()
);

-- Skor KPI (1–5) per objektif per bulan
create table if not exists kpi_scores (
  site_id   uuid not null references sites(id) on delete cascade,
  year      integer not null,
  month     integer not null check (month between 1 and 12),
  objective integer not null check (objective between 1 and 7),
  score     integer check (score between 1 and 5),
  primary key (site_id, year, month, objective)
);

-- Catatan highlight laporan per kategori per bulan
create table if not exists report_notes (
  site_id     uuid not null references sites(id) on delete cascade,
  month       date not null,
  category    text not null,
  note        text not null default '',
  weekly_note text not null default '',
  primary key (site_id, month, category)
);


-- Total per bulan dari data harian (security_invoker = tetap patuh RLS)
create or replace view monthly_totals with (security_invoker = true) as
  select site_id, date_trunc('month', day)::date as month, category, sum(value)::int as total
  from daily_counts group by 1, 2, 3;
grant select on monthly_totals to authenticated;

-- ── 4. Jejak perubahan (audit trail) ─────────────────────────────
create table if not exists activity_log (
  id          bigserial primary key,
  actor       uuid default auth.uid(),
  actor_email text,
  table_name  text not null,
  action      text not null,
  site_id     uuid,
  row_data    jsonb,
  at          timestamptz not null default now()
);

create or replace function log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into activity_log (actor, actor_email, table_name, action, site_id, row_data)
  values (auth.uid(), (select email from profiles where id = auth.uid()), tg_table_name, tg_op,
          nullif(r->>'site_id','')::uuid, r);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['daily_counts','day_events','incident_counts','patrol_monthly','leaves','improvements','kpi_scores','report_notes','profiles'] loop
    execute format('drop trigger if exists trg_log_%1$s on %1$s', t);
    execute format('create trigger trg_log_%1$s after insert or update or delete on %1$s for each row execute function log_activity()', t);
  end loop;
end $$;

-- updated_at otomatis
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
do $$
declare t text;
begin
  foreach t in array array['daily_counts','incident_counts','patrol_monthly','improvements'] loop
    execute format('drop trigger if exists trg_touch_%1$s on %1$s', t);
    execute format('create trigger trg_touch_%1$s before update on %1$s for each row execute function touch_updated_at()', t);
  end loop;
end $$;

-- ── 5. Row Level Security ────────────────────────────────────────
alter table sites            enable row level security;
alter table profiles         enable row level security;
alter table daily_counts     enable row level security;
alter table monthly_baseline enable row level security;
alter table day_events       enable row level security;
alter table incident_counts  enable row level security;
alter table patrol_monthly   enable row level security;
alter table leaves           enable row level security;
alter table improvements     enable row level security;
alter table kpi_scores       enable row level security;
alter table report_notes     enable row level security;
alter table activity_log     enable row level security;

-- sites
drop policy if exists sites_select on sites;
create policy sites_select on sites for select to authenticated using (has_site(id));
drop policy if exists sites_admin on sites;
create policy sites_admin on sites for all to authenticated
  using (app_role() = 'master_admin') with check (app_role() = 'master_admin');

-- profiles: lihat diri sendiri; master admin kelola semua
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select to authenticated
  using (id = auth.uid() or app_role() = 'master_admin');
drop policy if exists profiles_admin on profiles;
create policy profiles_admin on profiles for update to authenticated
  using (app_role() = 'master_admin') with check (app_role() = 'master_admin');
drop policy if exists profiles_admin_del on profiles;
create policy profiles_admin_del on profiles for delete to authenticated
  using (app_role() = 'master_admin');

-- tabel data: baca kalau punya site, tulis kalau admin di site itu
do $$
declare t text;
begin
  foreach t in array array['daily_counts','monthly_baseline','day_events','incident_counts','patrol_monthly','leaves','improvements','kpi_scores','report_notes'] loop
    execute format('drop policy if exists %1$s_read on %1$s', t);
    execute format('create policy %1$s_read on %1$s for select to authenticated using (has_site(site_id))', t);
    execute format('drop policy if exists %1$s_ins on %1$s', t);
    execute format('create policy %1$s_ins on %1$s for insert to authenticated with check (can_write(site_id))', t);
    execute format('drop policy if exists %1$s_upd on %1$s', t);
    execute format('create policy %1$s_upd on %1$s for update to authenticated using (can_write(site_id)) with check (can_write(site_id))', t);
    execute format('drop policy if exists %1$s_del on %1$s', t);
    execute format('create policy %1$s_del on %1$s for delete to authenticated using (can_write(site_id))', t);
  end loop;
end $$;

drop policy if exists activity_read on activity_log;
create policy activity_read on activity_log for select to authenticated
  using (app_role() = 'master_admin');

-- ── 6. Realtime ──────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['daily_counts','day_events','incident_counts','patrol_monthly','leaves','improvements','kpi_scores','report_notes','monthly_baseline'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
    execute format('alter table %I replica identity full', t);
  end loop;
end $$;

-- ── 7. Site awal ─────────────────────────────────────────────────
insert into sites (code, name, client)
values ('CIK', 'FFI Plant Cikarang', 'PT Frisian Flag Indonesia')
on conflict (code) do nothing;

-- Setelah membuat akun pertama lewat Authentication → Users → Add user,
-- jadikan akun itu master admin:
--   update profiles set role = 'master_admin' where email = 'email@anda.com';
