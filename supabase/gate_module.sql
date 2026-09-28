-- ════════════════════════════════════════════════════════════════
--  SECURITY DESK — MODUL GATE TRANSPORTER
--  Digitalisasi form "Ceklist Pemeriksaan Kelengkapan Transporter".
--  Jalankan SETELAH schema.sql. Aman dijalankan ulang.
--
--  Semua tabel baru ada di schema "security". Tabel aplikasi NC di
--  schema "public" (suppliers, destinations, nc_reports, nc_categories,
--  nc_report_findings) TIDAK diubah: hanya dibaca, dan nc_reports
--  diisi lewat fungsi security.gate_create_nc() saat petugas menekan
--  "Buat laporan pelanggaran".
-- ════════════════════════════════════════════════════════════════

-- ── 1. Peran baru: Petugas Gate ─────────────────────────────────
alter table security.profiles drop constraint if exists profiles_role_check;
alter table security.profiles add constraint profiles_role_check
  check (role in ('master_admin','admin','viewer','display','gate'));

-- boleh mengisi form gate: master admin, admin/SPV, petugas gate (di site-nya)
create or replace function security.can_gate(s uuid) returns boolean
language sql stable security definer set search_path = security as $$
  select security.has_site(s) and security.app_role() in ('master_admin','admin','gate')
$$;

-- ── 2. Tabel pemeriksaan ────────────────────────────────────────
create table if not exists security.gate_inspections (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references security.sites(id) on delete cascade,
  doc_no          text,
  status          text not null default 'in' check (status in ('in','out')),

  -- identitas transporter
  nopol           text not null,
  company_id      uuid,               -- public.suppliers.id (tanpa FK supaya schema tetap terpisah)
  company_name    text not null default '',
  vehicle_type    text not null default '',
  kir             text not null default '',
  driver_name     text not null default '',
  driver_id_type  text not null default 'SIM',
  driver_id_no    text not null default '',
  driver_phone    text not null default '',
  helper_name     text not null default '',
  helper_id_no    text not null default '',

  -- kedatangan
  in_at           timestamptz not null default now(),
  in_by           uuid default auth.uid(),
  in_by_name      text not null default '',
  in_sj           text not null default '',
  in_dept_id      uuid,               -- public.destinations.id
  in_dept_name    text not null default '',
  in_seal         text not null default '',
  in_material     text not null default '',
  adm_in          jsonb not null default '{}',   -- {"ktp_sim":true,"stnk_kir":true,"note":""}
  safety          jsonb not null default '{}',   -- {"ganjal":true,"p3k_apar":true,"fitting":true,"sepatu_vest":true,"b3":"na","hama":false,"note":""}
  phys_in         jsonb not null default '{}',   -- {"kabin":{"ok":true,"note":""}, ...}
  driver_ack_in   boolean not null default false,

  -- keberangkatan
  out_at          timestamptz,
  out_by          uuid,
  out_by_name     text not null default '',
  out_sj          text not null default '',
  out_dest        text not null default '',
  out_seal        text not null default '',
  out_material    text not null default '',
  adm_out         jsonb not null default '{}',
  phys_out        jsonb not null default '{}',
  driver_ack_out  boolean not null default false,

  -- ringkasan & persetujuan
  finding_count   integer not null default 0,
  sl_by           uuid,
  sl_name         text,
  sl_at           timestamptz,
  spv_by          uuid,
  spv_name        text,
  spv_at          timestamptz,
  nc_report_id    uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists gate_site_status on security.gate_inspections(site_id, status);
create index if not exists gate_site_in_at on security.gate_inspections(site_id, in_at desc);
create index if not exists gate_nopol on security.gate_inspections(upper(replace(nopol,' ','')));

-- ── 3. Aturan otomatis ──────────────────────────────────────────
-- • jam masuk/keluar diisi server (tidak bisa diketik mundur oleh petugas)
-- • nomor dokumen GT-<KODE SITE>-<YYMM>-<urut>
-- • petugas gate tidak bisa mengisi persetujuan SL/SPV
-- • setelah keluar, data hanya bisa diubah admin
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
    if r is distinct from 'master_admin' and r is distinct from 'admin' then
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

  -- UPDATE
  -- dipanggil dari gate_create_nc(): hanya boleh menautkan nomor laporan NC
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

drop trigger if exists trg_gate_guard on security.gate_inspections;
create trigger trg_gate_guard before insert or update on security.gate_inspections
  for each row execute function security.gate_guard();

drop trigger if exists trg_log_gate_inspections on security.gate_inspections;
create trigger trg_log_gate_inspections after insert or update or delete on security.gate_inspections
  for each row execute function security.log_activity();

-- ── 4. Row Level Security ───────────────────────────────────────
alter table security.gate_inspections enable row level security;
drop policy if exists gate_read on security.gate_inspections;
create policy gate_read on security.gate_inspections for select to authenticated using (security.has_site(site_id));
drop policy if exists gate_ins on security.gate_inspections;
create policy gate_ins on security.gate_inspections for insert to authenticated with check (security.can_gate(site_id));
drop policy if exists gate_upd on security.gate_inspections;
create policy gate_upd on security.gate_inspections for update to authenticated using (security.can_gate(site_id)) with check (security.can_gate(site_id));
drop policy if exists gate_del on security.gate_inspections;
create policy gate_del on security.gate_inspections for delete to authenticated using (security.can_write(site_id));

grant select, insert, update, delete on security.gate_inspections to authenticated;
grant all on security.gate_inspections to service_role;

do $$ begin
  alter publication supabase_realtime add table security.gate_inspections;
exception when duplicate_object then null; end $$;
alter table security.gate_inspections replica identity full;

-- ── 5. Baca data aplikasi NC (hanya baca) ──────────────────────
-- Lewat fungsi supaya aturan akses tabel public milik aplikasi NC tidak perlu diubah.
-- Hanya akun yang terdaftar & aktif di Security Desk yang mendapat data.
create or replace function security.gate_suppliers()
returns table (id uuid, name text, jenis_material text)
language plpgsql stable security definer set search_path = public, security as $$
begin
  if security.app_role() is null then return; end if;
  return query execute 'select s.id, s.name::text, s.jenis_material::text from public.suppliers s where s.is_active order by s.name';
end $$;

create or replace function security.gate_destinations()
returns table (id uuid, name text)
language plpgsql stable security definer set search_path = public, security as $$
begin
  if security.app_role() is null then return; end if;
  return query execute 'select d.id, d.name::text from public.destinations d where d.is_active order by d.name';
end $$;

-- Pilihan yang dipakai aplikasi NC (plant, jenis identitas, status, kategori temuan),
-- dibaca langsung dari definisi tabelnya supaya selalu sama.
create or replace function security.gate_nc_meta()
returns jsonb
language plpgsql stable security definer set search_path = public, security as $$
declare res jsonb; cats jsonb;
  function_enum constant text := $q$
    select coalesce(jsonb_agg(e.enumlabel order by e.enumsortorder), '[]'::jsonb)
    from pg_attribute a join pg_enum e on e.enumtypid = a.atttypid
    where a.attrelid = 'public.nc_reports'::regclass and a.attname = $1 $q$;
  pl jsonb; ji jsonb; st jsonb;
begin
  if security.app_role() is null then return null; end if;
  if to_regclass('public.nc_reports') is null then return jsonb_build_object('available', false); end if;
  execute function_enum into pl using 'plant';
  execute function_enum into ji using 'jenis_identitas';
  execute function_enum into st using 'status';
  if to_regclass('public.nc_categories') is not null then
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''id'', id, ''name'', name) order by sort_order, id), ''[]''::jsonb) from public.nc_categories' into cats;
  end if;
  res := jsonb_build_object('available', true, 'plants', pl, 'identitas', ji, 'status', st, 'categories', coalesce(cats, '[]'::jsonb));
  return res;
end $$;

-- Buat laporan pelanggaran di aplikasi NC dari satu pemeriksaan gate.
create or replace function security.gate_create_nc(
  p_inspection uuid, p_plant text, p_identitas text, p_status text, p_categories int[], p_catatan text
) returns uuid
language plpgsql security definer set search_path = public, security as $$
declare g security.gate_inspections; new_id uuid; t_plant text; t_ji text; t_st text;
begin
  select * into g from security.gate_inspections where id = p_inspection;
  if not found then raise exception 'Pemeriksaan tidak ditemukan.'; end if;
  if not security.can_gate(g.site_id) then raise exception 'Akun ini tidak boleh membuat laporan untuk site ini.'; end if;
  if g.nc_report_id is not null then raise exception 'Laporan pelanggaran untuk pemeriksaan ini sudah dibuat.'; end if;
  if g.company_id is null then raise exception 'Perusahaan belum dipilih dari daftar supplier.'; end if;

  select format_type(atttypid, atttypmod) into t_plant from pg_attribute where attrelid = 'public.nc_reports'::regclass and attname = 'plant';
  select format_type(atttypid, atttypmod) into t_ji    from pg_attribute where attrelid = 'public.nc_reports'::regclass and attname = 'jenis_identitas';
  select format_type(atttypid, atttypmod) into t_st    from pg_attribute where attrelid = 'public.nc_reports'::regclass and attname = 'status';

  execute format(
    'insert into public.nc_reports (plant, tanggal, supplier_id, no_polisi, nama_petugas, jenis_identitas, nomor_identitas, status, catatan, reported_by, tujuan_id)
     values ($1::%s, $2, $3, $4, $5, $6::%s, $7, $8::%s, $9, $10, $11) returning id', t_plant, t_ji, t_st)
  into new_id
  using p_plant, (g.in_at at time zone 'Asia/Jakarta')::date, g.company_id, g.nopol, g.driver_name,
        p_identitas, g.driver_id_no, p_status,
        nullif(trim(coalesce(p_catatan, '') || case when g.doc_no is not null then ' [Gate ' || g.doc_no || ']' else '' end), ''),
        auth.uid(), g.in_dept_id;

  if p_categories is not null and array_length(p_categories, 1) > 0 then
    execute 'insert into public.nc_report_findings (report_id, category_id) select $1, unnest($2::int[])'
      using new_id, p_categories;
  end if;

  perform set_config('security.gate_link_nc', 'on', true);
  update security.gate_inspections set nc_report_id = new_id where id = p_inspection;
  perform set_config('security.gate_link_nc', 'off', true);
  return new_id;
end $$;

revoke all on function security.gate_suppliers(), security.gate_destinations(), security.gate_nc_meta(),
  security.gate_create_nc(uuid, text, text, text, int[], text) from public;
grant execute on function security.can_gate(uuid), security.gate_suppliers(), security.gate_destinations(),
  security.gate_nc_meta(), security.gate_create_nc(uuid, text, text, text, int[], text) to authenticated;
