-- ════════════════════════════════════════════════════════════════
--  SECURITY DESK — AKSES UNTUK AKUN YANG SUDAH ADA (mis. akun G-C)
--  Jalankan SETELAH schema.sql. Aman dijalankan ulang.
--
--  Akun login (Supabase Auth) dipakai bersama aplikasi lain di project
--  ini, tetapi akses Security Desk tetap diatur di security.profiles.
--  File ini menambah dua fungsi untuk Master Admin:
--   • security.unlinked_accounts() → akun yang bisa login tapi belum
--     punya akses Security Desk
--   • security.grant_access()      → memberi akses ke akun tersebut
--  Tidak ada tabel atau trigger di schema public/auth yang diubah.
-- ════════════════════════════════════════════════════════════════

create or replace function security.unlinked_accounts()
returns table (id uuid, email text, full_name text, app_role text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = security, public, auth as $$
begin
  if security.app_role() is distinct from 'master_admin' then
    raise exception 'Hanya Master Admin.';
  end if;
  if to_regclass('public.profiles') is not null then
    -- nama & peran dari aplikasi lain (G-C) bila tersedia
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
      select u.id, u.email::text,
             coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))::text,
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
  if security.app_role() is distinct from 'master_admin' then
    raise exception 'Hanya Master Admin yang boleh memberi akses.';
  end if;
  if p_role not in ('master_admin','admin','viewer','display','gate') then
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

revoke all on function security.unlinked_accounts(), security.grant_access(uuid, text, uuid[], text) from public;
grant execute on function security.unlinked_accounts(), security.grant_access(uuid, text, uuid[], text) to authenticated;

-- ── Cara cepat lewat SQL (tanpa menu Pengguna) ──────────────────
-- Ganti email & peran, lalu jalankan. Peran: master_admin, admin, viewer, display, gate.
--
-- insert into security.profiles (id, email, full_name, role, site_ids, active)
-- select u.id, u.email, split_part(u.email, '@', 1), 'admin', array(select id from security.sites), true
-- from auth.users u
-- where u.email in ('email1@contoh.com', 'email2@contoh.com')
-- on conflict (id) do update set role = excluded.role, site_ids = excluded.site_ids, active = true;
