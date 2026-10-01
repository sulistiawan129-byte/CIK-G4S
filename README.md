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
| Gate transporter | `/gate` | Gate In, kendaraan di dalam area, Gate Out, persetujuan SL/SPV, cetak form, laporan NC |
| Layar ruang Security | `/display` | Dashboard eksekutif layar penuh, realtime |

### Peran & scope

| Peran | Bisa apa |
|---|---|
| **Master Admin** | Semua site, semua menu, kelola pengguna, lihat log aktivitas |
| **Admin / SPV G4S** | Input & ubah data serta laporan, hanya untuk site yang diberikan |
| **Viewer FFI** | Hanya melihat, hanya site yang diberikan |
| **Layar Ruang Security** | Otomatis diarahkan ke `/display`, tidak bisa membuka menu lain |
| **Petugas Gate** | Hanya halaman Gate: mencatat kendaraan masuk/keluar di site yang diberikan |

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

### Ubah password sendiri
Setiap akun bisa mengganti password sendiri, tanpa perlu Master Admin:
- **Aplikasi utama:** klik nama di pojok kanan atas, lalu pilih **Ubah password**.
- **Aplikasi petugas (`/pos`):** klik tombol **Password** di header.

Password lama wajib diisi. Password baru minimal 8 karakter dan harus berisi huruf dan angka. Karena akunnya dipakai bersama, password baru ini juga berlaku di aplikasi lain seperti G-C.

Kalau muncul pesan "verifikasi tambahan", buka Supabase → Authentication → Providers → Email, lalu matikan **Secure password change**.

### Memberi akses ke akun yang sudah ada (mis. akun G-C)
Akun dari aplikasi lain bisa login dengan email dan password yang sama, tetapi **baru bisa masuk Security Desk setelah diberi akses**. Ini disengaja supaya tidak semua akun G-C otomatis melihat data security.
1. Jalankan `supabase/akses_akun.sql` sekali di SQL Editor.
2. Buka menu **Pengguna**, lalu cari bagian *Akun dari aplikasi lain belum punya akses*. Pilih peran dan site, lalu klik **Beri akses**.

Cara cepat lewat SQL juga tersedia di bagian bawah file `akses_akun.sql`.

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

## Modul Gate transporter

Digitalisasi form **Ceklist Pemeriksaan Kelengkapan Transporter**: Gate In (kedatangan), daftar kendaraan di dalam area, Gate Out (keberangkatan), persetujuan Shift Leader/Supervisor, cetak form, dan pembuatan laporan pelanggaran ke aplikasi NC.

**Setup (sekali):** jalankan `supabase/gate_module.sql` di SQL Editor setelah `schema.sql`. File ini aman dijalankan ulang, dan tidak mengubah tabel aplikasi NC. Tabel `suppliers` dan `destinations` hanya dibaca. Laporan NC dibuat lewat fungsi `security.gate_create_nc` saat petugas menekan tombol.

**Akun petugas:** di menu Pengguna, buat akun dengan peran **Petugas Gate** dan centang site-nya.

**Link khusus petugas: `/pos`** (misalnya `https://cik-g4s.vercel.app/pos`)
- Punya halaman login sendiri (`/pos/login`) dan tampilan ringkas tanpa menu admin. Isinya hanya daftar kendaraan di dalam area, Gate In, dan Gate Out.
- Bisa dipasang sebagai aplikasi di HP: buka link di Chrome, lalu pilih menu **Tambahkan ke layar utama**. Namanya akan muncul sebagai "Pos Gate".
- Akun Petugas Gate yang login lewat link utama otomatis diarahkan ke `/pos`.
- Admin dan SPV tetap bisa membuka `/pos` untuk membantu di gate. Linknya ada di menu kiri: *Aplikasi petugas gate ↗*.

**Opsional, pakai domain terpisah** (misalnya `pos-cik-g4s.vercel.app`):
1. Vercel → project → Settings → **Domains** → tambahkan domain tersebut.
2. Vercel → Settings → Environment Variables: `POS_HOST` = `pos-cik-g4s.vercel.app`, lalu Redeploy.
3. Membuka domain itu akan langsung masuk ke halaman petugas.

**Aturan yang dijaga database:**
- Jam masuk dan keluar diisi server, sehingga tidak bisa dimundurkan.
- Nomor dokumen otomatis dengan format `GT-<site>-<YYMM>-<urut>`.
- Petugas gate tidak bisa mengisi persetujuan SL/SPV.
- Setelah kendaraan keluar, data hanya bisa diubah atau dihapus admin.
- Laporan NC hanya bisa dibuat sekali per pemeriksaan.

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
