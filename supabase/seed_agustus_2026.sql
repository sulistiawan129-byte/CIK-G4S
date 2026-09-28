-- Data contoh: laporan Agustus 2026 (FFI Plant Cikarang). Jalankan setelah schema.sql.
-- Hanya mengisi tabel di schema "security".
do $$
declare s uuid;
begin
  select id into s from security.sites where code='CIK';
  delete from security.daily_counts where site_id=s and day between '2026-08-01' and '2026-08-31';
  insert into security.monthly_baseline values (s,'2025-08-01','karyawan',1500) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-09-01','karyawan',1386) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-10-01','karyawan',1575) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-11-01','karyawan',1286) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-12-01','karyawan',1427) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-01-01','karyawan',1379) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-02-01','karyawan',1331) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-03-01','karyawan',1363) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-04-01','karyawan',1428) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-05-01','karyawan',1280) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-06-01','karyawan',1289) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-07-01','karyawan',1349) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-08-01','tamu',283) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-09-01','tamu',425) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-10-01','tamu',316) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-11-01','tamu',248) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-12-01','tamu',252) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-01-01','tamu',185) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-02-01','tamu',213) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-03-01','tamu',124) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-04-01','tamu',215) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-05-01','tamu',137) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-06-01','tamu',179) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-07-01','tamu',191) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-08-01','kontraktor',293) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-09-01','kontraktor',546) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-10-01','kontraktor',654) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-11-01','kontraktor',626) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-12-01','kontraktor',554) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-01-01','kontraktor',530) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-02-01','kontraktor',395) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-03-01','kontraktor',362) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-04-01','kontraktor',504) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-05-01','kontraktor',622) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-06-01','kontraktor',743) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-07-01','kontraktor',664) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-08-01','motor',29064) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-09-01','motor',31965) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-10-01','motor',34491) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-11-01','motor',31425) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-12-01','motor',34175) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-01-01','motor',33898) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-02-01','motor',29784) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-03-01','motor',33148) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-04-01','motor',33970) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-05-01','motor',34238) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-06-01','motor',33579) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-07-01','motor',34723) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-08-01','visitor',1174) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-09-01','visitor',1244) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-10-01','visitor',1371) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-11-01','visitor',1280) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2025-12-01','visitor',966) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-01-01','visitor',903) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-02-01','visitor',692) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-03-01','visitor',491) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-04-01','visitor',741) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-05-01','visitor',642) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-06-01','visitor',648) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.monthly_baseline values (s,'2026-07-01','visitor',434) on conflict (site_id,month,category) do update set total=excluded.total;
  insert into security.daily_counts (site_id,day,category,value) values
    (s,'2026-08-01','karyawan',17),
    (s,'2026-08-02','karyawan',19),
    (s,'2026-08-03','karyawan',59),
    (s,'2026-08-04','karyawan',59),
    (s,'2026-08-05','karyawan',72),
    (s,'2026-08-06','karyawan',63),
    (s,'2026-08-07','karyawan',55),
    (s,'2026-08-08','karyawan',16),
    (s,'2026-08-09','karyawan',15),
    (s,'2026-08-10','karyawan',46),
    (s,'2026-08-11','karyawan',54),
    (s,'2026-08-12','karyawan',58),
    (s,'2026-08-13','karyawan',46),
    (s,'2026-08-14','karyawan',49),
    (s,'2026-08-15','karyawan',19),
    (s,'2026-08-16','karyawan',16),
    (s,'2026-08-17','karyawan',47),
    (s,'2026-08-18','karyawan',59),
    (s,'2026-08-19','karyawan',55),
    (s,'2026-08-20','karyawan',45),
    (s,'2026-08-21','karyawan',54),
    (s,'2026-08-22','karyawan',16),
    (s,'2026-08-23','karyawan',12),
    (s,'2026-08-24','karyawan',45),
    (s,'2026-08-25','karyawan',53),
    (s,'2026-08-26','karyawan',44),
    (s,'2026-08-27','karyawan',41),
    (s,'2026-08-28','karyawan',51),
    (s,'2026-08-29','karyawan',14),
    (s,'2026-08-30','karyawan',11),
    (s,'2026-08-31','karyawan',48),
    (s,'2026-08-01','tamu',4),
    (s,'2026-08-02','tamu',2),
    (s,'2026-08-03','tamu',9),
    (s,'2026-08-04','tamu',10),
    (s,'2026-08-05','tamu',8),
    (s,'2026-08-06','tamu',7),
    (s,'2026-08-07','tamu',9),
    (s,'2026-08-08','tamu',7),
    (s,'2026-08-09','tamu',5),
    (s,'2026-08-10','tamu',18),
    (s,'2026-08-11','tamu',18),
    (s,'2026-08-12','tamu',13),
    (s,'2026-08-13','tamu',15),
    (s,'2026-08-14','tamu',18),
    (s,'2026-08-15','tamu',0),
    (s,'2026-08-16','tamu',0),
    (s,'2026-08-17','tamu',15),
    (s,'2026-08-18','tamu',13),
    (s,'2026-08-19','tamu',12),
    (s,'2026-08-20','tamu',13),
    (s,'2026-08-21','tamu',13),
    (s,'2026-08-22','tamu',0),
    (s,'2026-08-23','tamu',0),
    (s,'2026-08-24','tamu',10),
    (s,'2026-08-25','tamu',8),
    (s,'2026-08-26','tamu',8),
    (s,'2026-08-27','tamu',9),
    (s,'2026-08-28','tamu',8),
    (s,'2026-08-29','tamu',0),
    (s,'2026-08-30','tamu',0),
    (s,'2026-08-31','tamu',8),
    (s,'2026-08-01','kontraktor',7),
    (s,'2026-08-02','kontraktor',8),
    (s,'2026-08-03','kontraktor',27),
    (s,'2026-08-04','kontraktor',22),
    (s,'2026-08-05','kontraktor',22),
    (s,'2026-08-06','kontraktor',27),
    (s,'2026-08-07','kontraktor',22),
    (s,'2026-08-08','kontraktor',5),
    (s,'2026-08-09','kontraktor',6),
    (s,'2026-08-10','kontraktor',23),
    (s,'2026-08-11','kontraktor',19),
    (s,'2026-08-12','kontraktor',23),
    (s,'2026-08-13','kontraktor',23),
    (s,'2026-08-14','kontraktor',18),
    (s,'2026-08-15','kontraktor',6),
    (s,'2026-08-16','kontraktor',6),
    (s,'2026-08-17','kontraktor',19),
    (s,'2026-08-18','kontraktor',18),
    (s,'2026-08-19','kontraktor',22),
    (s,'2026-08-20','kontraktor',20),
    (s,'2026-08-21','kontraktor',17),
    (s,'2026-08-22','kontraktor',9),
    (s,'2026-08-23','kontraktor',9),
    (s,'2026-08-24','kontraktor',16),
    (s,'2026-08-25','kontraktor',18),
    (s,'2026-08-26','kontraktor',21),
    (s,'2026-08-27','kontraktor',16),
    (s,'2026-08-28','kontraktor',16),
    (s,'2026-08-29','kontraktor',0),
    (s,'2026-08-30','kontraktor',0),
    (s,'2026-08-31','kontraktor',15),
    (s,'2026-08-01','motor',509),
    (s,'2026-08-02','motor',508),
    (s,'2026-08-03','motor',1073),
    (s,'2026-08-04','motor',1244),
    (s,'2026-08-05','motor',1400),
    (s,'2026-08-06','motor',1127),
    (s,'2026-08-07','motor',1147),
    (s,'2026-08-08','motor',1206),
    (s,'2026-08-09','motor',1044),
    (s,'2026-08-10','motor',1114),
    (s,'2026-08-11','motor',1399),
    (s,'2026-08-12','motor',1356),
    (s,'2026-08-13','motor',1098),
    (s,'2026-08-14','motor',1307),
    (s,'2026-08-15','motor',1599),
    (s,'2026-08-16','motor',1276),
    (s,'2026-08-17','motor',1059),
    (s,'2026-08-18','motor',1277),
    (s,'2026-08-19','motor',1080),
    (s,'2026-08-20','motor',989),
    (s,'2026-08-21','motor',1244),
    (s,'2026-08-22','motor',995),
    (s,'2026-08-23','motor',818),
    (s,'2026-08-24','motor',1157),
    (s,'2026-08-25','motor',1229),
    (s,'2026-08-26','motor',977),
    (s,'2026-08-27','motor',1068),
    (s,'2026-08-28','motor',1260),
    (s,'2026-08-29','motor',966),
    (s,'2026-08-30','motor',916),
    (s,'2026-08-31','motor',1241),
    (s,'2026-08-01','visitor',0),
    (s,'2026-08-02','visitor',0),
    (s,'2026-08-03','visitor',28),
    (s,'2026-08-04','visitor',29),
    (s,'2026-08-05','visitor',22),
    (s,'2026-08-06','visitor',25),
    (s,'2026-08-07','visitor',29),
    (s,'2026-08-08','visitor',2),
    (s,'2026-08-09','visitor',0),
    (s,'2026-08-10','visitor',32),
    (s,'2026-08-11','visitor',28),
    (s,'2026-08-12','visitor',24),
    (s,'2026-08-13','visitor',30),
    (s,'2026-08-14','visitor',30),
    (s,'2026-08-15','visitor',0),
    (s,'2026-08-16','visitor',0),
    (s,'2026-08-17','visitor',20),
    (s,'2026-08-18','visitor',16),
    (s,'2026-08-19','visitor',16),
    (s,'2026-08-20','visitor',19),
    (s,'2026-08-21','visitor',17),
    (s,'2026-08-22','visitor',0),
    (s,'2026-08-23','visitor',0),
    (s,'2026-08-24','visitor',20),
    (s,'2026-08-25','visitor',16),
    (s,'2026-08-26','visitor',18),
    (s,'2026-08-27','visitor',20),
    (s,'2026-08-28','visitor',16),
    (s,'2026-08-29','visitor',1),
    (s,'2026-08-30','visitor',1),
    (s,'2026-08-31','visitor',17);
  insert into security.incident_counts (site_id,month,category,value,note) values (s,'2026-08-01','Lost & Found',17,'Tidak ada barang yang hilang.') on conflict (site_id,month,category) do update set value=excluded.value, note=excluded.note;
  insert into security.incident_counts (site_id,month,category,value,note) values (s,'2026-08-01','Kerusakan Fasilitas',10,'8 berstatus open, 2 close.') on conflict (site_id,month,category) do update set value=excluded.value, note=excluded.note;
  insert into security.incident_counts (site_id,month,category,value,note) values (s,'2026-08-01','Security Issue',2,'Penahanan susu tanpa surat jalan dan produk dari luar yang tidak dikonfirmasi ke petugas.') on conflict (site_id,month,category) do update set value=excluded.value, note=excluded.note;
  insert into security.incident_counts (site_id,month,category,value,note) values (s,'2026-08-01','Kecelakaan/Sakit',2,'Karyawan dirujuk ke RS Mitra Keluarga.') on conflict (site_id,month,category) do update set value=excluded.value, note=excluded.note;
  insert into security.incident_counts (site_id,month,category,value,note) values (s,'2026-08-01','Komplain Eksternal',1,'') on conflict (site_id,month,category) do update set value=excluded.value, note=excluded.note;
  insert into security.incident_counts (site_id,month,category,value) values (s,'2026-07-01','Lost & Found',33) on conflict do nothing;
  insert into security.patrol_monthly values (s,'2026-08-01',372,7520,371,7519,'1 kali missed pada 21 Agustus 2026 di checkpoint Biomas 1 karena jaringan buruk saat scan NFC.',now()) on conflict (site_id,month) do nothing;
  delete from security.leaves where site_id=s and month='2026-08-01';
  insert into security.leaves (site_id,month,name,date_text,type,backup) values (s,'2026-08-01','Sodik Pariki','3 & 4 Agustus 2026','Annual Leave','Reliver');
  insert into security.leaves (site_id,month,name,date_text,type,backup) values (s,'2026-08-01','Rohmatullah','6 Agustus 2026','Sakit','');
  insert into security.leaves (site_id,month,name,date_text,type,backup) values (s,'2026-08-01','Engkus','11 & 12 Agustus 2026','Annual Leave','Reliver');
  insert into security.leaves (site_id,month,name,date_text,type,backup) values (s,'2026-08-01','Nurahmit','15 Agustus 2026','Sakit','');
  insert into security.leaves (site_id,month,name,date_text,type,backup) values (s,'2026-08-01','Indra Jaelani','15 & 16 Agustus 2026','Annual Leave','Reliver');
  insert into security.leaves (site_id,month,name,date_text,type,backup) values (s,'2026-08-01','Yusup Apandi','28 & 29 Agustus 2026','Annual Leave','Reliver');
  insert into security.leaves (site_id,month,name,date_text,type,backup) values (s,'2026-08-01','Riski Pranata','31 Agustus 2026','Extra Day Off','Reliver');
  delete from security.improvements where site_id=s;
  insert into security.improvements (site_id,opened_month,description,priority,progress,status) values (s,'2026-01-01','Pemindahan zebra cross di area GHC','Medium','Sudah dilakukan penawaran kepada vendor TBR','Proses');
  insert into security.improvements (site_id,opened_month,description,priority,progress,status) values (s,'2026-01-01','Penambahan CCTV perimeter','High','Sudah di-approve, menunggu pengerjaan','Proses');
  insert into security.improvements (site_id,opened_month,description,priority,progress,status) values (s,'2026-02-01','Perbaikan gerbang gate motor','High','Sudah dilakukan penawaran kepada vendor','Proses');
  insert into security.improvements (site_id,opened_month,description,priority,progress,status) values (s,'2026-02-01','Perbaikan CCTV area parkir motor','High','','Open');
  insert into security.improvements (site_id,opened_month,description,priority,progress,status) values (s,'2026-03-01','Horn alarm di GHC diperbesar dan lampu sign','High','','Open');
  insert into security.improvements (site_id,opened_month,description,priority,progress,status) values (s,'2026-04-01','Pemasangan media sensor boomgate','High','','Open');
  insert into security.improvements (site_id,opened_month,description,priority,progress,status) values (s,'2026-06-01','Update matrix barang keluar','High','','Open');
  insert into security.improvements (site_id,opened_month,description,priority,progress,status) values (s,'2026-07-01','Aturan Form Incoming Material dengan matrix barang keluar','High','','Open');
  insert into security.improvements (site_id,opened_month,description,priority,progress,status) values (s,'2026-07-01','Maintenance CCTV','Medium','','Open');
  insert into security.kpi_scores values (s,2026,1,1,4) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,1,2,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,1,3,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,1,4,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,1,5,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,1,6,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,1,7,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,2,1,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,2,2,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,2,3,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,2,4,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,2,5,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,2,6,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,2,7,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,3,1,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,3,2,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,3,3,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,3,4,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,3,5,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,3,6,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,3,7,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,4,1,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,4,2,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,4,3,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,4,4,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,4,5,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,4,6,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,4,7,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,5,1,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,5,2,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,5,3,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,5,4,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,5,5,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,5,6,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,5,7,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,6,1,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,6,2,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,6,3,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,6,4,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,6,5,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,6,6,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,6,7,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,7,1,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,7,2,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,7,3,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,7,4,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,7,5,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,7,6,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,7,7,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,8,1,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,8,2,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,8,3,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,8,4,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,8,5,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,8,6,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.kpi_scores values (s,2026,8,7,5) on conflict (site_id,year,month,objective) do update set score=excluded.score;
  insert into security.report_notes values (s,'2026-08-01','karyawan','Sebagian karyawan beralih menggunakan taksi dan kendaraan operasional secara sharing.','Beberapa karyawan bergantian membawa jenis kendaraan ketika bekerja.') on conflict (site_id,month,category) do update set note=excluded.note, weekly_note=excluded.weekly_note;
  insert into security.report_notes values (s,'2026-08-01','tamu','Tamu yang berkunjung sebagian besar kontraktor dengan keperluan visit, induction dan meeting.','') on conflict (site_id,month,category) do update set note=excluded.note, weekly_note=excluded.weekly_note;
  insert into security.report_notes values (s,'2026-08-01','kontraktor','Vendor SIG, E80 dan Tetra Pak berkurang; sebagian manpower memakai kendaraan umum dan operasional perusahaannya.','Penambahan project di area loading RTD dan area bongkar Fresh Milk. Beberapa vendor datang dengan shuttle bus.') on conflict (site_id,month,category) do update set note=excluded.note, weekly_note=excluded.weekly_note;
  insert into security.report_notes values (s,'2026-08-01','motor','Penambahan dari vendor PT TBR dan Allasa, pengurangan dari vendor Tata.','Puncak weekend untuk penyelesaian project kontraktor PT Trimas, Tata dan Allasa.') on conflict (site_id,month,category) do update set note=excluded.note, weekly_note=excluded.weekly_note;
  insert into security.report_notes values (s,'2026-08-01','visitor','','Kenaikan di minggu ke-3 bertepatan dengan Upacara HUT RI ke-81.') on conflict (site_id,month,category) do update set note=excluded.note, weekly_note=excluded.weekly_note;
  delete from security.day_events where site_id=s and day between '2026-08-01' and '2026-08-31';
  insert into security.day_events (site_id,day,kind,description) values (s,'2026-08-04','Temuan','Driver menjemur pakaian di area parkir RMS.');
  insert into security.day_events (site_id,day,kind,description) values (s,'2026-08-06','Temuan','Rolling door loading MDC/RTD terbuka malam hari. SPV RTD Packing tidak merespons.');
  insert into security.day_events (site_id,day,kind,description) values (s,'2026-08-06','Personel','Rohmatullah sakit, tanpa backup.');
  insert into security.day_events (site_id,day,kind,description) values (s,'2026-08-11','Security','3 sachet SKM dibawa keluar tanpa konfirmasi ke petugas.');
  insert into security.day_events (site_id,day,kind,description) values (s,'2026-08-15','Personel','Nurahmit sakit, tanpa backup.');
  insert into security.day_events (site_id,day,kind,description) values (s,'2026-08-17','Kegiatan','Upacara HUT RI ke-81.');
  insert into security.day_events (site_id,day,kind,description) values (s,'2026-08-21','Patroli','Checkpoint Biomas 1 terlewat karena jaringan buruk saat scan NFC.');
  insert into security.day_events (site_id,day,kind,description) values (s,'2026-08-21','Temuan','Driver memanjat iso tank tanpa body harness.');
  insert into security.day_events (site_id,day,kind,description) values (s,'2026-08-22','Security','Karyawan PT Powerindo membawa 2 UHT tanpa surat jalan.');
end $$;
