# Security Desk

Sistem operasional & laporan bulanan security untuk **FFI Plant Cikarang**.
Admin mengisi data harian, sistem membentuk laporan bulanan dengan format yang sama seperti laporan G4S yang biasa dikirim ke klien, dan layar di ruang Security menampilkan dashboard eksekutif secara realtime.

- **Frontend**: Next.js 14 (App Router) → di-deploy ke **Vercel**
- **Database, login & realtime**: **Supabase** (Postgres + Auth + Realtime)
- **Kode**: disimpan di **GitHub**, Vercel otomatis deploy setiap ada push

---

## Isi aplikasi

| Halaman | Path | Fungsi |
|---|---|---|
| Ringkasan | `/` | Kesiapan laporan, angka utama, grafik harian, daftar "perlu dicek" yang bisa diselesaikan di tempat |
| Data harian | `/harian` | Kalender + isi 5 angka per hari (mobil karyawan/tamu/kontraktor, motor, visitor). Tersimpan otomatis |
| Kejadian & patroli | `/kejadian` | Jumlah kejadian per kategori + keterangan, data guard tour |
| Personel & temuan | `/personel` | Cuti/sakit + backup, need improvement + progres & status |
| KPI | `/kpi` | Skor 1–5 per objektif per bulan, nilai tahun berjalan |
| Laporan bulanan | `/laporan` | 10 slide format laporan, catatan highlight, **unduh PowerPoint** |
| Pengguna | `/pengguna` | (Master Admin) buat akun, atur peran/site/menu, nonaktifkan, reset password, log aktivitas |
| Layar ruang Security | `/display` | Dashboard eksekutif layar penuh, realtime |

### Peran & scope

| Peran | Bisa apa |
|---|---|
| **Master Admin** | Semua site, semua menu, kelola pengguna, lihat log aktivitas |
| **Admin / SPV G4S** | Input & ubah data serta laporan, hanya untuk site yang diberikan |
| **Viewer FFI** | Hanya melihat, hanya site yang diberikan |
| **Layar Ruang Security** | Otomatis diarahkan ke `/display`, tidak bisa membuka menu lain |

Selain peran, setiap akun (kecuali Master Admin) dibatasi **per site** dan bisa dibatasi **per menu**.
Pembatasan ini dijaga di dua tempat: tampilan aplikasi, dan **Row Level Security di database**. Jadi walaupun seseorang memanggil API Supabase langsung, data site lain tetap tidak bisa dibaca atau diubah.

### Realtime

Semua halaman berlangganan perubahan tabel lewat Supabase Realtime. Begitu satu admin menyimpan angka, layar lain (admin lain, viewer, layar ruang Security) ikut berubah dalam hitungan detik. Indikator **LIVE** di pojok atas menunjukkan koneksi. Sebagai jaring pengaman, data juga dimuat ulang saat tab kembali aktif, saat internet tersambung lagi, dan setiap 2 menit.

---

## 1. Siapkan Supabase

Security Desk bisa dipasang di **project Supabase yang sudah dipakai aplikasi lain**. Semua tabel, fungsi, trigger, dan aturan aksesnya dibuat di schema terpisah bernama **`security`**. Tidak ada objek di schema `public` maupun `auth` yang dibuat, diubah, atau dihapus. Ini sudah diuji dengan simulasi project yang punya `public.profiles`, `public.handle_new_user`, dan trigger `on_auth_user_created`.

1. **SQL Editor → New query**, tempel isi `supabase/schema.sql`, klik **Run**.
2. (Opsional, untuk mencoba) jalankan `supabase/seed_agustus_2026.sql`, berisi data contoh Agustus 2026.
3. **Project Settings → API → Data API → Exposed schemas**: tambahkan **`security`**, lalu Save. Tanpa langkah ini aplikasi tidak bisa membaca data.
4. Beri akses Master Admin ke akun Anda. Akun yang sudah ada di Authentication → Users boleh dipakai:
   ```sql
   insert into security.profiles (id, email, full_name, role, active)
   select id, email, 'Nama Anda', 'master_admin', true
   from auth.users where email = 'email@anda.com'
   on conflict (id) do update set role = 'master_admin', active = true;
   ```
5. **Project Settings → API**: catat **Project URL**, **anon public key**, dan **service_role key**.

### Akun login dipakai bersama
- Satu email bisa masuk ke aplikasi lain dan ke Security Desk dengan password yang sama. Akses Security Desk diatur terpisah di `security.profiles` (menu **Pengguna**).
- Akun yang **belum** diberi akses di menu Pengguna tidak bisa masuk ke Security Desk, meskipun email dan password-nya benar.
- Menu Pengguna → **Tambah akun** dengan email yang sudah terdaftar di aplikasi lain: aksesnya ditambahkan, password lama tetap berlaku.
- Tombol **Keluar** di Security Desk hanya mengakhiri sesi Security Desk. Sesi di aplikasi lain tidak ikut putus.
- Perhatian: project ini punya trigger `on_auth_user_created` milik aplikasi lain. Setiap akun **baru** yang dibuat dari Security Desk juga otomatis mendapat baris di `public.profiles` dengan peran bawaan aplikasi itu. Pastikan peran bawaan tersebut tidak memberi akses yang tidak diinginkan di aplikasi lain.

## 2. Upload ke GitHub

```bash
cd security-desk
git init
git add .
git commit -m "Security Desk v1"
git branch -M main
git remote add origin https://github.com/<akun-anda>/security-desk.git
git push -u origin main
```

Atau lewat web: buat repo baru di GitHub → **uploading an existing file** → seret isi folder ini (kecuali `node_modules` dan `.next`).

## 3. Deploy ke Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import** repo `security-desk`. Next.js terdeteksi otomatis.
2. **Environment Variables**:

   | Nama | Nilai |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**jangan** diawali `NEXT_PUBLIC_`) |

3. **Deploy**. Setiap push ke `main` akan otomatis ter-deploy ulang.
4. Di Supabase: **Authentication → URL Configuration → Site URL** isi dengan alamat Vercel Anda.

## 4. Pasang layar ruang Security

1. Di menu **Pengguna**, buat akun dengan peran **Layar Ruang Security**, centang site CIK.
2. Di PC/TV box ruang Security, buka alamat aplikasi, login dengan akun itu. Otomatis masuk ke `/display`.
3. Klik **Layar penuh** (tombol muncul saat mouse digerakkan, hilang lagi setelah 4 detik).
4. Tips: pakai Chrome dengan mode kiosk supaya langsung layar penuh saat PC menyala:
   `chrome --kiosk https://alamat-anda.vercel.app/display`

Layar ini menjaga agar monitor tidak masuk mode tidur, memilih bulan terbaru secara otomatis, dan memuat ulang dirinya setiap 6 jam. Untuk site lain gunakan `/display?site=KODE`.

---

## Menjalankan di komputer sendiri

```bash
npm install
cp .env.example .env.local   # isi 3 nilai dari Supabase
npm run dev                  # http://localhost:3000
```

## Struktur

```
supabase/
  schema.sql              schema "security": tabel, RLS, trigger log, realtime
  seed_agustus_2026.sql   data contoh Agustus 2026
src/
  middleware.ts           cek login + arahkan akun layar ke /display
  lib/
    supabase/             klien browser, server, dan service role
    data.ts               ambil data per bulan + langganan realtime + fungsi simpan
    calc.ts               rata-rata, selisih, KPI, daftar "perlu dicek"
    slides.ts             pembentuk 10 slide laporan (format G4S)
    constants.ts dates.ts types.ts useDrafts.ts latest.ts
  components/             AppContext (sesi, site, bulan, toast), Shell, komponen UI
  app/
    (app)/                halaman admin (butuh login)
    display/              layar ruang Security
    login/                halaman masuk
    api/admin/users/      buat akun & reset password (khusus Master Admin)
```

## Aturan hitung yang dipakai

- **Minggu ke-** dihitung Senin–Minggu. Hari setelah minggu ke-5 digabung ke minggu ke-5 (mengikuti laporan).
- **Hari kerja/libur** = Senin–Jumat / Sabtu–Minggu.
- **Rata-rata harian** = total hari kerja ÷ jumlah hari kerja (dan sama untuk hari libur).
- **Grafik 13 bulan**: bulan yang punya data harian memakai jumlah data harian; bulan sebelum sistem dipakai memakai tabel `security.monthly_baseline`.
- **Nilai KPI tahun berjalan** = rata-rata bulan yang sudah dinilai × bobot (tidak dibagi 12).

## Menambah site baru

```sql
insert into security.sites (code, name, client) values ('KODE', 'Nama Plant', 'Nama Klien');
```
Lalu centang site tersebut untuk akun yang boleh mengaksesnya di menu Pengguna.
