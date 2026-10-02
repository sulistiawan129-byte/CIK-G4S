-- ════════════════════════════════════════════════════════════════
--  SECURITY DESK × CIKOPS-G&C — PENGGABUNGAN JADI SATU SISTEM
--  Jalankan SEKALI di Supabase → SQL Editor, SETELAH schema.sql,
--  gate_module.sql dan akses_akun.sql. Aman dijalankan ulang.
--
--  Yang dilakukan:
--   1. Peran baru (berlaku untuk seluruh sistem):
--        admin_g4s   Admin G4S       semua data, semua site, kelola pengguna
--        admin_ga    Admin GA        semua data, semua site, kelola pengguna
--        ga_dept     GA Department   semua data, semua site (tanpa kelola pengguna)
--        she_dept    SHE Department  hanya modul G-C: lihat + unduh/cetak
--        management  Management      dashboard eksekutif, lihat saja
--        gate        Petugas Gate    aplikasi pos: gate in/out, input NC, total pemeriksaan
--        display     Layar ruang Security
--      Peran lama diubah otomatis: master_admin & admin → admin_g4s,
--      viewer → management.
--   2. Akun aplikasi G-C lama otomatis mendapat akses:
--        admin_ga → admin_ga, admin_security → admin_g4s, petugas_gate → gate
--   3. Aturan akses tabel G-C (schema public) diperketat sesuai peran.
--      Setelah ini aplikasi G-C LAMA tidak dipakai lagi.
--      Untuk membatalkan: jalankan merger_gc_rollback.sql.
--
--  Data G-C (nc_reports, suppliers, dll.) TIDAK dipindah atau diubah.
-- ════════════════════════════════════════════════════════════════

begin;

-- ── 1. Peran ────────────────────────────────────────────────────
alter table security.profiles drop constraint if exists profiles_role_check;
update security.profiles set role = 'admin_g4s'  where role in ('master_admin', 'admin');
update security.profiles set role = 'management' where role = 'viewer';
alter table security.profiles add constraint profiles_role_check
  check (role in ('admin_g4s','admin_ga','ga_dept','she_dept','management','gate','display'));
alter table security.profiles alter column role set default 'management';

-- plant G-C untuk tiap site (dipakai untuk menghitung pemeriksaan dari Gate In)
alter table security.sites add column if not exists gc_plant text;
update security.sites set gc_plant = 'Cikarang' where gc_plant is null and code = 'CIK';

-- ── 2. Fungsi bantu akses ───────────────────────────────────────
create or replace function security.is_user_admin() returns boolean
language sql stable security definer set search_path = security as $$
  select coalesce(security.app_role() in ('admin_g4s','admin_ga'), false)
$$;

-- peran yang melihat semua site
create or replace function security.all_sites() returns boolean
language sql stable security definer set search_path = security as $$
  select coalesce(security.app_role() in ('admin_g4s','admin_ga','ga_dept','management'), false)
$$;

-- modul security (laporan bulanan, data harian, dll.): SHE tidak termasuk
create or replace function security.has_site(s uuid) returns boolean
language sql stable security definer set search_path = security as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.active and p.role <> 'she_dept'
      and (p.role in ('admin_g4s','admin_ga','ga_dept','management') or s = any(p.site_ids))
  )
$$;

create or replace function security.can_write(s uuid) returns boolean
language sql stable security definer set search_path = security as $$
  select security.has_site(s) and security.app_role() in ('admin_g4s','admin_ga','ga_dept')
$$;

create or replace function security.can_gate(s uuid) returns boolean
language sql stable security definer set search_path = security as $$
  select security.has_site(s) and security.app_role() in ('admin_g4s','admin_ga','ga_dept','gate')
$$;

-- modul G-C
create or replace function security.gc_read() returns boolean
language sql stable security definer set search_path = security as $$
  select security.app_role() is not null
$$;
create or replace function security.gc_admin() returns boolean
language sql stable security definer set search_path = security as $$
  select coalesce(security.app_role() in ('admin_g4s','admin_ga','ga_dept'), false)
$$;
create or replace function security.gc_field() returns boolean
language sql stable security definer set search_path = security as $$
  select coalesce(security.app_role() in ('admin_g4s','admin_ga','ga_dept','gate'), false)
$$;

grant execute on function security.is_user_admin(), security.all_sites(), security.has_site(uuid), security.can_write(uuid),
  security.can_gate(uuid), security.gc_read(), security.gc_admin(), security.gc_field() to authenticated;

-- jumlah kendaraan diperiksa per hari dari Gate In (untuk True NC Rate modul G-C)
create or replace function security.gate_daily(p_from date, p_to date)
returns table (plant text, tanggal date, jumlah int)
language sql stable security invoker set search_path = security as $$
  select coalesce(s.gc_plant, s.name), (g.in_at at time zone 'Asia/Jakarta')::date, count(*)::int
  from security.gate_inspections g join security.sites s on s.id = g.site_id
  where (g.in_at at time zone 'Asia/Jakarta')::date between p_from and p_to
  group by 1, 2
$$;
grant execute on function security.gate_daily(date, date) to authenticated;

-- ── 3. Aturan akses tabel security ──────────────────────────────
drop policy if exists sites_select on security.sites;
create policy sites_select on security.sites for select to authenticated
  using (security.has_site(id) or security.app_role() = 'she_dept');
drop policy if exists sites_admin on security.sites;
create policy sites_admin on security.sites for all to authenticated
  using (security.is_user_admin()) with check (security.is_user_admin());

drop policy if exists profiles_self on security.profiles;
create policy profiles_self on security.profiles for select to authenticated
  using (id = auth.uid() or security.is_user_admin());
drop policy if exists profiles_admin on security.profiles;
create policy profiles_admin on security.profiles for update to authenticated
  using (security.is_user_admin()) with check (security.is_user_admin());
drop policy if exists profiles_admin_del on security.profiles;
create policy profiles_admin_del on security.profiles for delete to authenticated
  using (security.is_user_admin());

drop policy if exists activity_read on security.activity_log;
create policy activity_read on security.activity_log for select to authenticated
  using (security.is_user_admin());

-- pemeriksaan gate: SHE ikut melihat (bagian dari kepatuhan transporter)
drop policy if exists gate_read on security.gate_inspections;
create policy gate_read on security.gate_inspections for select to authenticated
  using (security.has_site(site_id) or security.app_role() = 'she_dept');

-- aturan otomatis gate: admin boleh mengisi jam manual
create or replace function security.gate_guard() returns trigger
language plpgsql security definer set search_path = security as $$
declare r text := security.app_role(); code text; n int; nm text;
begin
  select coalesce(full_name, email, '') into nm from security.profiles where id = auth.uid();
  if tg_op = 'INSERT' then
    new.nopol := upper(regexp_replace(trim(new.nopol), '\s+', ' ', 'g'));
    new.status := 'in';
    new.in_by := auth.uid();
    new.in_by_name := coalesce(nm, '');
    if r is null or r not in ('admin_g4s','admin_ga','ga_dept') or new.in_at is null then
      new.in_at := now();
    end if;
    new.out_at := null; new.sl_at := null; new.spv_at := null; new.sl_by := null; new.spv_by := null;
    select s.code into code from sites s where s.id = new.site_id;
    perform pg_advisory_xact_lock(hashtext('gate_doc_' || new.site_id::text || to_char(new.in_at at time zone 'Asia/Jakarta', 'YYMM')));
    select count(*) + 1 into n from gate_inspections
      where site_id = new.site_id
        and to_char(in_at at time zone 'Asia/Jakarta', 'YYMM') = to_char(new.in_at at time zone 'Asia/Jakarta', 'YYMM');
    new.doc_no := 'GT-' || coalesce(code, 'X') || '-' || to_char(new.in_at at time zone 'Asia/Jakarta', 'YYMM') || '-' || lpad(n::text, 4, '0');
    return new;
  end if;

  if current_setting('security.gate_link_nc', true) = 'on' then
    if old.nc_report_id is null then old.nc_report_id := new.nc_report_id; end if;
    old.updated_at := now();
    return old;
  end if;
  new.id := old.id; new.site_id := old.site_id; new.doc_no := old.doc_no;
  new.in_by := old.in_by; new.in_by_name := old.in_by_name;
  if r = 'gate' then
    if old.status = 'out' then
      raise exception 'Pemeriksaan ini sudah selesai (kendaraan sudah keluar). Hubungi admin untuk perubahan.';
    end if;
    new.in_at := old.in_at;
    new.sl_by := old.sl_by; new.sl_name := old.sl_name; new.sl_at := old.sl_at;
    new.spv_by := old.spv_by; new.spv_name := old.spv_name; new.spv_at := old.spv_at;
  end if;
  new.nopol := upper(regexp_replace(trim(new.nopol), '\s+', ' ', 'g'));
  if old.status = 'in' and new.status = 'out' then
    new.out_by := auth.uid();
    new.out_by_name := coalesce(nm, '');
    if r = 'gate' or new.out_at is null then new.out_at := now(); end if;
  end if;
  if new.sl_at is not null and old.sl_at is null then new.sl_by := auth.uid(); new.sl_name := coalesce(nm, ''); end if;
  if new.spv_at is not null and old.spv_at is null then new.spv_by := auth.uid(); new.spv_name := coalesce(nm, ''); end if;
  new.updated_at := now();
  return new;
end $$;

-- ── 4. Kelola akun (Admin G4S & Admin GA) ───────────────────────
create or replace function security.unlinked_accounts()
returns table (id uuid, email text, full_name text, app_role text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = security, public, auth as $$
begin
  if not security.is_user_admin() then raise exception 'Hanya Admin G4S / Admin GA.'; end if;
  if to_regclass('public.profiles') is not null then
    return query execute $q$
      select u.id, u.email::text,
             coalesce(nullif(pp.full_name, ''), u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))::text,
             pp.role::text, u.created_at, u.last_sign_in_at
      from auth.users u
      left join public.profiles pp on pp.id = u.id
      where not exists (select 1 from security.profiles sp where sp.id = u.id)
      order by u.last_sign_in_at desc nulls last, u.email $q$;
  else
    return query
      select u.id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))::text,
             null::text, u.created_at, u.last_sign_in_at
      from auth.users u
      where not exists (select 1 from security.profiles sp where sp.id = u.id)
      order by u.last_sign_in_at desc nulls last, u.email;
  end if;
end $$;

create or replace function security.grant_access(p_user uuid, p_role text, p_sites uuid[], p_name text default null)
returns void
language plpgsql security definer set search_path = security, auth as $$
declare u auth.users;
begin
  if not security.is_user_admin() then raise exception 'Hanya Admin G4S / Admin GA yang boleh memberi akses.'; end if;
  if p_role not in ('admin_g4s','admin_ga','ga_dept','she_dept','management','gate','display') then
    raise exception 'Peran tidak dikenal: %', p_role;
  end if;
  select * into u from auth.users where id = p_user;
  if not found then raise exception 'Akun tidak ditemukan.'; end if;
  insert into security.profiles (id, email, full_name, role, site_ids, active)
  values (u.id, u.email,
          coalesce(nullif(trim(p_name), ''), u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
          p_role, coalesce(p_sites, '{}'), true)
  on conflict (id) do update
    set role = excluded.role, site_ids = excluded.site_ids, active = true,
        full_name = coalesce(nullif(trim(p_name), ''), security.profiles.full_name);
end $$;

-- ── 5. Pindahkan akun G-C lama ──────────────────────────────────
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute $q$
      insert into security.profiles (id, email, full_name, role, site_ids, active)
      select pp.id, coalesce(pp.email, u.email),
             coalesce(nullif(pp.full_name, ''), u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
             case pp.role when 'admin_ga' then 'admin_ga' when 'admin_security' then 'admin_g4s' else 'gate' end,
             (select coalesce(array_agg(s.id), '{}') from security.sites s),
             true
      from public.profiles pp join auth.users u on u.id = pp.id
      where not exists (select 1 from security.profiles sp where sp.id = pp.id)
    $q$;
  end if;
end $$;

-- ── 6. Aturan akses tabel G-C (schema public) ───────────────────
do $$
declare t text; p record;
begin
  foreach t in array array['suppliers','destinations','nc_categories','nc_reports','nc_report_findings','pemeriksaan_harian'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    -- hapus aturan lama aplikasi G-C pada tabel ini
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy sd_read on public.%I for select to authenticated using (security.gc_read())', t);
  end loop;

  if to_regclass('public.suppliers') is not null then
    create policy sd_ins on public.suppliers for insert to authenticated with check (security.gc_admin());
    create policy sd_upd on public.suppliers for update to authenticated using (security.gc_admin()) with check (security.gc_admin());
    create policy sd_del on public.suppliers for delete to authenticated using (security.gc_admin());
  end if;
  if to_regclass('public.destinations') is not null then
    create policy sd_ins on public.destinations for insert to authenticated with check (security.gc_admin());
    create policy sd_upd on public.destinations for update to authenticated using (security.gc_admin()) with check (security.gc_admin());
    create policy sd_del on public.destinations for delete to authenticated using (security.gc_admin());
  end if;
  if to_regclass('public.nc_categories') is not null then
    create policy sd_ins on public.nc_categories for insert to authenticated with check (security.gc_admin());
    create policy sd_upd on public.nc_categories for update to authenticated using (security.gc_admin()) with check (security.gc_admin());
  end if;
  if to_regclass('public.nc_reports') is not null then
    create policy sd_ins on public.nc_reports for insert to authenticated with check (security.gc_field());
    create policy sd_upd on public.nc_reports for update to authenticated
      using (security.gc_admin() or (security.gc_field() and reported_by = auth.uid()))
      with check (security.gc_admin() or (security.gc_field() and reported_by = auth.uid()));
    create policy sd_del on public.nc_reports for delete to authenticated using (security.gc_admin());
  end if;
  if to_regclass('public.nc_report_findings') is not null then
    -- petugas hanya boleh mengubah temuan pada laporan yang dia buat sendiri
    create policy sd_ins on public.nc_report_findings for insert to authenticated with check (
      security.gc_admin() or (security.gc_field() and exists (select 1 from public.nc_reports r where r.id = report_id and r.reported_by = auth.uid())));
    create policy sd_del on public.nc_report_findings for delete to authenticated using (
      security.gc_admin() or (security.gc_field() and exists (select 1 from public.nc_reports r where r.id = report_id and r.reported_by = auth.uid())));
  end if;
  if to_regclass('public.pemeriksaan_harian') is not null then
    create policy sd_ins on public.pemeriksaan_harian for insert to authenticated with check (security.gc_field());
    create policy sd_upd on public.pemeriksaan_harian for update to authenticated using (security.gc_admin()) with check (security.gc_admin());
    create policy sd_del on public.pemeriksaan_harian for delete to authenticated using (security.gc_admin());
  end if;

  -- view laporan mengikuti aturan akses pembacanya (bukan pemilik view)
  foreach t in array array['v_nc_reports','v_nc_by_category','v_nc_by_supplier','v_nc_by_driver'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter view public.%I set (security_invoker = on)', t);
    end if;
  end loop;
end $$;

commit;

-- ── Cek hasil ───────────────────────────────────────────────────
select role, count(*) as akun from security.profiles group by role order by role;
