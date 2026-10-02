-- ════════════════════════════════════════════════════════════════
--  PEMBATALAN aturan akses G-C dari merger_gc.sql
--  Mengembalikan aturan akses tabel G-C (schema public) persis seperti
--  aplikasi G-C lama, supaya aplikasi lama bisa dipakai lagi.
--  Peran di Security Desk TIDAK dikembalikan (tetap peran baru).
-- ════════════════════════════════════════════════════════════════
begin;
do $$
declare t text; p record;
begin
  foreach t in array array['suppliers','destinations','nc_categories','nc_reports','nc_report_findings','pemeriksaan_harian'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t and policyname like 'sd_%' loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
  foreach t in array array['v_nc_reports','v_nc_by_category','v_nc_by_supplier','v_nc_by_driver'] loop
    if to_regclass('public.' || t) is not null then execute format('alter view public.%I set (security_invoker = off)', t); end if;
  end loop;
end $$;

create policy "authenticated read suppliers" on public.suppliers for select using (auth.role() = 'authenticated');
create policy "admin write suppliers" on public.suppliers for insert with check (public.is_admin());
create policy "admin update suppliers" on public.suppliers for update using (public.is_admin());
create policy "authenticated read destinations" on public.destinations for select using (auth.role() = 'authenticated');
create policy "admin write destinations" on public.destinations for insert with check (public.is_admin());
create policy "admin update destinations" on public.destinations for update using (public.is_admin());
create policy "authenticated read categories" on public.nc_categories for select using (auth.role() = 'authenticated');
create policy "authenticated read reports" on public.nc_reports for select using (auth.role() = 'authenticated');
create policy "authenticated insert reports" on public.nc_reports for insert with check (auth.role() = 'authenticated');
create policy "owner or admin update reports" on public.nc_reports for update using (public.is_admin() or reported_by = auth.uid());
create policy "admin delete reports" on public.nc_reports for delete using (public.is_admin());
create policy "authenticated read findings" on public.nc_report_findings for select using (auth.role() = 'authenticated');
create policy "authenticated insert findings" on public.nc_report_findings for insert with check (auth.role() = 'authenticated');
create policy "authenticated delete findings" on public.nc_report_findings for delete using (auth.role() = 'authenticated');
create policy "authenticated read pemeriksaan" on public.pemeriksaan_harian for select using (auth.role() = 'authenticated');
create policy "authenticated insert pemeriksaan" on public.pemeriksaan_harian for insert with check (auth.role() = 'authenticated');
create policy "admin update pemeriksaan" on public.pemeriksaan_harian for update using (public.is_admin());
create policy "admin delete pemeriksaan" on public.pemeriksaan_harian for delete using (public.is_admin());
commit;
