-- ═══════════════════════════════════════════════════════
--  SECURITY DESK — LENGKAPI FITUR (setara modul Security CIKOPS)
--  Jalankan SETELAH schema.sql, laporan_cikops.sql, merger_gc.sql. Aman diulang.
--
--  A. Riwayat 12 bulan: total bulan lama untuk SEMUA kategori laporan (bukan hanya 5 kategori harian).
--  B. Perusahaan khusus (mis. PT BECIS, PT JAYA MUKTI MANDIRI): daftar yang dipantau khusus di analisa pelanggaran.
-- ═══════════════════════════════════════════════════════

-- A. Kategori riwayat diperluas
alter table security.monthly_baseline drop constraint if exists monthly_baseline_category_check;
alter table security.monthly_baseline add constraint monthly_baseline_category_check check (category in (
  'karyawan', 'tamu', 'kontraktor', 'motor', 'visitor',
  'timbang', 'non_timbang', 'biomas', 'pelanggaran', 'kejadian'));

-- B. Perusahaan khusus per site
create table if not exists security.special_companies (
  site_id    uuid not null references security.sites(id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  primary key (site_id, name)
);
alter table security.special_companies enable row level security;
drop policy if exists special_companies_read on security.special_companies;
create policy special_companies_read on security.special_companies for select to authenticated using (security.has_site(site_id));
drop policy if exists special_companies_ins on security.special_companies;
create policy special_companies_ins on security.special_companies for insert to authenticated with check (security.can_write(site_id));
drop policy if exists special_companies_del on security.special_companies;
create policy special_companies_del on security.special_companies for delete to authenticated using (security.can_write(site_id));
grant select, insert, delete on security.special_companies to authenticated;
grant all on security.special_companies to service_role;

-- isian awal (hanya bila daftar site itu masih kosong)
insert into security.special_companies (site_id, name)
select s.id, n.name
from security.sites s
cross join (values ('PT. BECIS'), ('PT. JAYA MUKTI MANDIRI')) as n(name)
where not exists (select 1 from security.special_companies c where c.site_id = s.id)
on conflict do nothing;

notify pgrst, 'reload schema';
