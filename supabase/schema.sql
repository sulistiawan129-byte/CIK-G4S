-- ════════════════════════════════════════════════════════════════
--  SECURITY DESK — skema database Supabase
--  Jalankan di Supabase → SQL Editor → New query → Run.
--  Aman dijalankan ulang (idempotent).
--
--  SEMUA objek dibuat di schema terpisah bernama "security", jadi aman
--  dipasang di project Supabase yang sudah dipakai aplikasi lain:
--  tidak ada tabel, fungsi, trigger, atau policy di schema "public"
--  maupun di "auth" yang dibuat, diubah, atau dihapus.
--  Akun login (Supabase Auth) dipakai bersama; akses Security Desk
--  diatur sendiri di tabel security.profiles.
-- ════════════════════════════════════════════════════════════════

create schema if not exists security;
grant usage on schema security to authenticated, service_role;

-- ── 1. Site / plant ──────────────────────────────────────────────
create table if not exists security.sites (
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
create table if not exists security.profiles (
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

-- Tidak ada trigger di auth.users: profil Security Desk hanya dibuat oleh
-- Master Admin (menu Pengguna) atau lewat SQL di bagian akhir file ini.

-- Helper untuk RLS (security definer supaya tidak rekursif ke profiles)
create or replace function security.app_role() returns text
language sql stable security definer set search_path = security as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function security.has_site(s uuid) returns boolean
language sql stable security definer set search_path = security as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.active
      and (p.role = 'master_admin' or s = any(p.site_ids))
  )
$$;

create or replace function security.can_write(s uuid) returns boolean
language sql stable security definer set search_path = security as $$
  select has_site(s) and app_role() in ('master_admin','admin')
$$;

-- ── 3. Data operasional ──────────────────────────────────────────
-- Kendaraan & visitor per hari (satu baris per site/tanggal/kategori)
create table if not exists security.daily_counts (
  site_id     uuid not null references security.sites(id) on delete cascade,
  day         date not null,
  category    text not null check (category in ('karyawan','tamu','kontraktor','motor','visitor')),
  value       integer not null default 0 check (value >= 0),
  updated_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  primary key (site_id, day, category)
);

-- Total bulanan historis (sebelum sistem dipakai). Dipakai grafik 13 bulan
-- untuk bulan yang belum punya data harian.
create table if not exists security.monthly_baseline (
  site_id   uuid not null references security.sites(id) on delete cascade,
  month     date not null,                         -- tanggal 1 tiap bulan
  category  text not null check (category in ('karyawan','tamu','kontraktor','motor','visitor')),
  total     integer not null check (total >= 0),
  primary key (site_id, month, category)
);

-- Catatan kejadian/temuan per tanggal (titik merah di kalender & feed layar)
create table if not exists security.day_events (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references security.sites(id) on delete cascade,
  day         date not null,
  kind        text not null default 'Temuan'
              check (kind in ('Temuan','Security','Personel','Patroli','Kegiatan','Lainnya')),
  description text not null,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists day_events_site_day on security.day_events(site_id, day);

-- Rekap kejadian per kategori per bulan
create table if not exists security.incident_counts (
  site_id   uuid not null references security.sites(id) on delete cascade,
  month     date not null,
  category  text not null,
  value     integer not null default 0 check (value >= 0),
  note      text not null default '',
  updated_at timestamptz not null default now(),
  primary key (site_id, month, category)
);

-- Patroli (guard tour) per bulan
create table if not exists security.patrol_monthly (
  site_id           uuid not null references security.sites(id) on delete cascade,
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
create table if not exists security.leaves (
  id        uuid primary key default gen_random_uuid(),
  site_id   uuid not null references security.sites(id) on delete cascade,
  month     date not null,
  name      text not null default '',
  date_text text not null default '',
  type      text not null default 'Annual Leave' check (type in ('Annual Leave','Sakit','Extra Day Off','Izin')),
  backup    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists leaves_site_month on security.leaves(site_id, month);

-- Need improvement / temuan jangka panjang
create table if not exists security.improvements (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references security.sites(id) on delete cascade,
  opened_month date not null,
  description  text not null default '',
  priority     text not null default 'High' check (priority in ('High','Medium','Low')),
  progress     text not null default '',
  status       text not null default 'Open' check (status in ('Open','Proses','Selesai')),
  updated_at   timestamptz not null default now()
);

-- Skor KPI (1–5) per objektif per bulan
create table if not exists security.kpi_scores (
  site_id   uuid not null references security.sites(id) on delete cascade,
  year      integer not null,
  month     integer not null check (month between 1 and 12),
  objective integer not null check (objective between 1 and 7),
  score     integer check (score between 1 and 5),
  primary key (site_id, year, month, objective)
);

-- Catatan highlight laporan per kategori per bulan
create table if not exists security.report_notes (
  site_id     uuid not null references security.sites(id) on delete cascade,
  month       date not null,
  category    text not null,
  note        text not null default '',
  weekly_note text not null default '',
  primary key (site_id, month, category)
);


-- Total per bulan dari data harian (security_invoker = tetap patuh RLS)
create or replace view security.monthly_totals with (security_invoker = true) as
  select site_id, date_trunc('month', day)::date as month, category, sum(value)::int as total
  from security.daily_counts group by 1, 2, 3;

-- ── 4. Jejak perubahan (audit trail) ─────────────────────────────
create table if not exists security.activity_log (
  id          bigserial primary key,
  actor       uuid default auth.uid(),
  actor_email text,
  table_name  text not null,
  action      text not null,
  site_id     uuid,
  row_data    jsonb,
  at          timestamptz not null default now()
);

create or replace function security.log_activity() returns trigger
language plpgsql security definer set search_path = security as $$
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
    execute format('drop trigger if exists trg_log_%1$s on security.%1$s', t);
    execute format('create trigger trg_log_%1$s after insert or update or delete on security.%1$s for each row execute function security.log_activity()', t);
  end loop;
end $$;

-- updated_at otomatis
create or replace function security.touch_updated_at() returns trigger language plpgsql set search_path = security as $$
begin new.updated_at := now(); return new; end $$;
do $$
declare t text;
begin
  foreach t in array array['daily_counts','incident_counts','patrol_monthly','improvements'] loop
    execute format('drop trigger if exists trg_touch_%1$s on security.%1$s', t);
    execute format('create trigger trg_touch_%1$s before update on security.%1$s for each row execute function security.touch_updated_at()', t);
  end loop;
end $$;

-- ── 5. Row Level Security ────────────────────────────────────────
alter table security.sites            enable row level security;
alter table security.profiles         enable row level security;
alter table security.daily_counts     enable row level security;
alter table security.monthly_baseline enable row level security;
alter table security.day_events       enable row level security;
alter table security.incident_counts  enable row level security;
alter table security.patrol_monthly   enable row level security;
alter table security.leaves           enable row level security;
alter table security.improvements     enable row level security;
alter table security.kpi_scores       enable row level security;
alter table security.report_notes     enable row level security;
alter table security.activity_log     enable row level security;

-- sites
drop policy if exists sites_select on security.sites;
create policy sites_select on security.sites for select to authenticated using (security.has_site(id));
drop policy if exists sites_admin on security.sites;
create policy sites_admin on security.sites for all to authenticated
  using (security.app_role() = 'master_admin') with check (security.app_role() = 'master_admin');

-- profiles: lihat diri sendiri; master admin kelola semua
drop policy if exists profiles_self on security.profiles;
create policy profiles_self on security.profiles for select to authenticated
  using (id = auth.uid() or security.app_role() = 'master_admin');
drop policy if exists profiles_admin on security.profiles;
create policy profiles_admin on security.profiles for update to authenticated
  using (security.app_role() = 'master_admin') with check (security.app_role() = 'master_admin');
drop policy if exists profiles_admin_del on security.profiles;
create policy profiles_admin_del on security.profiles for delete to authenticated
  using (security.app_role() = 'master_admin');

-- tabel data: baca kalau punya site, tulis kalau admin di site itu
do $$
declare t text;
begin
  foreach t in array array['daily_counts','monthly_baseline','day_events','incident_counts','patrol_monthly','leaves','improvements','kpi_scores','report_notes'] loop
    execute format('drop policy if exists %1$s_read on security.%1$s', t);
    execute format('create policy %1$s_read on security.%1$s for select to authenticated using (security.has_site(site_id))', t);
    execute format('drop policy if exists %1$s_ins on security.%1$s', t);
    execute format('create policy %1$s_ins on security.%1$s for insert to authenticated with check (security.can_write(site_id))', t);
    execute format('drop policy if exists %1$s_upd on security.%1$s', t);
    execute format('create policy %1$s_upd on security.%1$s for update to authenticated using (security.can_write(site_id)) with check (security.can_write(site_id))', t);
    execute format('drop policy if exists %1$s_del on security.%1$s', t);
    execute format('create policy %1$s_del on security.%1$s for delete to authenticated using (security.can_write(site_id))', t);
  end loop;
end $$;

drop policy if exists activity_read on security.activity_log;
create policy activity_read on security.activity_log for select to authenticated
  using (security.app_role() = 'master_admin');

-- ── 6. Realtime ──────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['daily_counts','day_events','incident_counts','patrol_monthly','leaves','improvements','kpi_scores','report_notes','monthly_baseline'] loop
    begin
      execute format('alter publication supabase_realtime add table security.%I', t);
    exception when duplicate_object then null;
    end;
    execute format('alter table security.%I replica identity full', t);
  end loop;
end $$;

-- ── 7. Site awal ─────────────────────────────────────────────────
insert into security.sites (code, name, client)
values ('CIK', 'FFI Plant Cikarang', 'PT Frisian Flag Indonesia')
on conflict (code) do nothing;

-- ── 8. Hak akses tabel untuk API Supabase ────────────────────────
-- (schema baru tidak otomatis mendapat grant seperti schema public)
grant select, insert, update, delete on all tables in schema security to authenticated;
grant usage, select on all sequences in schema security to authenticated;
grant all on all tables in schema security to service_role;
grant all on all sequences in schema security to service_role;
grant execute on all functions in schema security to authenticated, service_role;
alter default privileges in schema security grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema security grant all on tables to service_role;

-- ════════════════════════════════════════════════════════════════
--  SETELAH MENJALANKAN FILE INI
--  1) Project Settings → API (Data API) → Exposed schemas: tambahkan  security
--  2) Beri akses Master Admin ke akun Anda (akun yang sudah ada di
--     Authentication → Users boleh dipakai; ganti email & nama):
--
--  insert into security.profiles (id, email, full_name, role, active)
--  select id, email, 'Nama Anda', 'master_admin', true
--  from auth.users where email = 'email@anda.com'
--  on conflict (id) do update set role = 'master_admin', active = true;
-- ════════════════════════════════════════════════════════════════
