# 🚗 Dokumen Spesifikasi Produk (PRD) & Panduan Teknis Arsitektur Menyeluruh
## Sistem Management StockYard Kendaraan (Astra Daihatsu DSO Lampung)

> **Klasifikasi:** Dokumen Resmi Spesifikasi Produk (PRD), Arsitektur Sistem, Katalog Fitur Menyeluruh & Direktori Kode Program  
> **Sasaran Pembaca:** Manajemen Astra Daihatsu, Kepala Wilayah (DSO Lampung), Admin Head / Branch Manager (ADH/BM), Supervisor Logistik, Tim Security On-Duty Cabang (D660–D664), System Architect, & Tim Pengembang  
> **Status Dokumen:** Siap Operasional (*Production-Ready Enterprise Edition — Versi 2.27 PRO Enterprise PWA v1.7.2 Terverifikasi Penuh*)  
> **Cakupan Wilayah:** Sentra Distribusi & Manajemen StockYard Area Lampung (DSO Lampung & 5 Cabang Resmi: D660, D661, D662, D663, D664 serta Rute Distribusi Luar Lampung)  

---

## 1. Ringkasan Eksekutif (Executive Summary)

### 1.1 Latar Belakang & Visi Transformasi Digital
Operasional penanganan, pengawasan fisik, dan mutasi unit kendaraan di area pool logistik dan StockYard Astra Daihatsu Sales Operation (DSO) Area Lampung memerlukan kecepatan pemrosesan tinggi, pencatatan fisik bebas human error, dan pelacakan audit legal yang transparan (*audit-ready*). 

Sistem **Management StockYard (Astra Daihatsu DSO Lampung)** mentransformasi proses konvensional berbasis kertas dan spreadsheet manual menjadi **ekosistem aplikasi web enterprise modern berbasis Progressive Web App (PWA Mobile & Desktop v1.7.2)**. Sistem terhubung secara realtime dengan infrastruktur komputasi awan Google Workspace (Google Sheets, Google Drive, Gmail API) melalui serverless reverse proxy Vercel berkeamanan tinggi dengan enkripsi SSL/TLS 256-bit.

### 1.2 Pilar Keunggulan Sistem (v2.27 PRO Enterprise)
1. **Arsitektur Multi-Cabang Resmi (DSO Lampung & 5 Cabang D660–D664)**: Pengawasan sentral oleh Admin DSO Lampung sekaligus isolasi data (*data isolation*) untuk petugas Security cabang sesuai lokasi penugasan resmi.
2. **Akun Security Universal per Cabang (Bebas NPK)**: Kredensial login cabang bersifat universal untuk setiap regu *Security on-duty*, sehingga pergantian giliran jaga berjalan lancar tanpa kendala birokrasi input NPK perorangan.
3. **Radar OKK & Logistics Flight Board Realtime (3-Kolom Kanban Simetris)**: Visualisasi status armada yang sedang bergerak (*In-Transit / OTW*) antar cabang dan ke Luar Lampung, estimasi waktu tempuh (ETA), status ketepatan waktu (*On-Track* vs *Melebihi Estimasi*), rute asal ➔ tujuan, serta durasi perjalanan live dengan tata letak desktop simetris sejajar (*items-stretch*).
4. **Dukungan Distribusi Luar Lampung & SLA Kustom (SPPDC Eksternal)**: Dukungan pengiriman unit ke luar provinsi Lampung (Palembang, Jakarta, Bandung, dll.) dengan input kota tujuan dinamis dan penentuan target SLA waktu tempuh (1 Hari, 2 Hari, dll.).
5. **Modal Konfirmasi Pengiriman Luar Lampung (Custom Astra Daihatsu Modal)**: Penyelesaian siklus unit keluar ke luar Lampung melalui tombol *Validasi Selesai (Unit Telah Diterima)* yang menggunakan dialog modal konfirmasi elegan Astra Daihatsu (bebas dari popup bawaan browser yang kaku).
6. **Lencana Asal & Tujuan Pengiriman Standar Astra Daihatsu**: Tampilan kolom Cabang pada seluruh tabel (Riwayat Mutasi, Modal Detail Model, dan Ekspor PDF/Excel) menyajikan lencana bertumpuk: Cabang Asal (`🟡 D661 - Soekarno Hatta`) dan Lencana Tujuan Pengiriman (`➔ Tujuan: D660 – Ahmad Yani` atau `➔ Tujuan: Luar Lampung (Palembang)`) dengan styling biru lembut anti-wrap.
7. **Tabel Rinci Stok Fisik Parkir di Pool Yard (Anti-Wrap Responsive)**: Panel drawer inventaris stok fisik mobil riil di yard dengan toolbar pemilih cabang terpadu, counter unit, dan tabel lebar minimum (`min-w-[880px]`) yang tidak terhimpit pada layar mobile maupun desktop.
8. **Proteksi Konkurensi 5 Lapis & Atomic Lock Server (`LockService`)**: Jaminan nol bentrokan data (*zero race condition / zero lost update*) saat banyak petugas di berbagai pos cabang memindai dan menyimpan mutasi pada detik yang bersamaan.
9. **Nol Risiko Data Ganda (*Zero Duplicate Entry*)**: Sistem memblokir pemindaian berulang untuk unit yang sama melalui alarm multi-sensor seketika di lapangan (audio 1760Hz, getaran haptik, dan kunci visual).
10. **Keamanan Akses Tingkat Enterprise (Hardened Security Layer)**: Kredensial akun terlindungi penuh tanpa *hardcoded password* di browser. Dilengkapi proteksi anti *brute-force* (kunci akun 60 detik setelah 3 kali salah PIN/password).
11. **Sinkronisasi Database 17 Kolom & Auto-Reconcile Stok**: Pencatatan mutasi lengkap 17 kolom (termasuk rute tujuan). Tab `Inventory` menggunakan formula presisi (Col D: Total Masuk, Col E: Total Keluar, Net Stock = Masuk - Keluar) dengan tombol rekonsiliasi otomatis 1-klik di Google Sheets.
12. **Otomasi Laporan Harian Terjadwal Tepat Pukul 08:00 WIB**: Rekap mutasi 24 jam terakhir dalam format **PDF & Excel (.xlsx murni)** berkop resmi Astra Daihatsu dikompilasi dan dikirim otomatis ke email manajemen DSO serta dipartisi eksklusif ke masing-masing cabang.
13. **Desain UI Minimalis & Bersih**: Penghapusan kartu footer yang bulky dan digantikan dengan *single-line minimalist copyright* yang elegan dan profesional di seluruh halaman aplikasi.
14. **Standarisasi Seragam Notifikasi Android Native (PWA v1.7.2)**:
   - **Thumbnail Foto Seragam**: Prioritas utama selalu menggunakan **Foto Dokumentasi Fisik Security (`unitPhoto`)** dari laporan mutasi nyata. Apabila foto fisik tidak diunggah, sistem otomatis melakukan fallback bersih ke **Foto Katalog Resmi Kendaraan (`modelPhoto`)**, dan terakhir ke icon aplikasi. Menghilangkan inkonsistensi visual antara entri pemindaian lokal dan data sinkronisasi Google Sheets.
   - **Notifikasi Spesifik Luar Lampung**:
     - *Kedatangan Unit*: Judul `🏁 Unit Tiba di [Kota/Tujuan]: [Model]` dengan body `VIN: ... • Tujuan: ...\nUnit resmi diterima & selesai diverifikasi (Validasi Admin DSO)`. Menghapus kerancuan label "Unit Masuk" untuk kendaraan yang telah sampai di luar Lampung.
     - *Keberangkatan Unit*: Judul `🚛 Pengiriman ke [Kota/Tujuan]: [Model]` dengan body rincian cabang asal dan status perjalanan.

---

## 2. Perbandingan: Cara Kerja Konvensional vs. Sistem Baru (v2.27)

| Aspek Operasional | Cara Konvensional (Sebelumnya) | Menggunakan Sistem Management StockYard (v2.27 PRO) |
| :--- | :--- | :--- |
| **Pencatatan Nomor Rangka (VIN)** | Dicatat manual di kertas surat jalan atau diketik di Excel. Sering terjadi salah baca angka `0` dan huruf `O`, atau `1` dan `I`. | **Pemindaian Otomatis via Kamera Smartphone**. Dual-engine (Barcode + Tesseract OCR) mengekstrak 17 digit VIN dan nomor mesin dengan normalisasi ISO. |
| **Menghadapi Stiker Kaca Bertumpuk** | Petugas bingung karena stiker kaca Daihatsu memiliki 5-7 baris barcode bertumpuk (nomor DO, PO, suku cadang, VIN, mesin). | **Filter Cerdas Otomatis (`smartFilterBarcodes`)**. Kamera langsung mengunci VIN berawalan `MHK...` serta membuang kode pabrik yang tidak relevan. |
| **Identitas Petugas Security** | Diikat ke NPK perorangan sehingga sulit saat ganti shift atau petugas piket berganti. | **Universal Branch Account Login**. Login fleksibel per cabang untuk seluruh security bertugas tanpa perlu input NPK perorangan. |
| **Pencatatan Sopir / Driver** | Mengetik nama supir pihak ketiga yang sering berganti dan memperlambat antrean gerbang pool. | **Disederhanakan (Bebas Input Driver)**. Sistem fokus pada verifikasi unit, rute cabang tujuan, dan bukti fisik dokumen serah terima. |
| **Pelacakan Mobil Antar Cabang & Luar Lampung** | Mengandalkan telepon / WhatsApp manual untuk mengetahui apakah mobil sudah berangkat atau sampai di cabang tujuan / luar kota. | **Radar OKK & Logistics Flight Board (3 Kolom Kanban Simetris)**. Menampilkan unit *In-Transit* lengkap dengan timer jalan, SLA durasi rute, deteksi keterlambatan real-time, dukungan rute Luar Lampung dengan SLA khusus, serta verifikasi fisik kedatangan. |
| **Penyelesaian Unit Keluar ke Luar Lampung** | Tidak ada sistem penutupan siklus karena penerima di luar Lampung tidak memiliki akun cabang DSO. | **Validasi Selesai (Unit Telah Diterima)** via Modal Elegan Astra Daihatsu untuk menyelesaikan unit eksternal secara resmi tanpa popup browser bawaan. |
| **Pencegahan Bentrok Simpan Bersamaan (Concurrency)** | Rawan data tertimpa atau selisih stok jika ada 2 petugas menyimpan unit bersamaan di jam sibuk. | **Proteksi Konkurensi 5 Lapis (Client Mutex + Server `LockService`)**. Google Apps Script mengantrekan request dan mengunci transaksi secara atomik sehingga data 100% konsisten. |
| **Pencegahan Unit Terinput Dua Kali** | Baru ketahuan saat ada selisih stok fisik bulanan (*stock opname*). | **Pencegahan Real-Time di Lapangan**. Jika unit sudah tercatat, aplikasi seketika mengunci layar merah, menyalakan alarm nada rendah, dan menolak penyimpanan. |
| **Keamanan Autentikasi Pengguna** | Password tersimpan pada kode aplikasi front-end, rentan dibongkar via DevTools / Inspect Element. | **Server-First Hardened Auth**. Verifikasi kredensial terisolasi ke Apps Script tanpa ekspos password, plus proteksi *brute-force lockout* 60 detik (3 salah coba). |
| **Sinkronisasi Stok di Database** | Total masuk dan keluar rentan salah hitung manual pada spreadsheet. | **Kalkulasi Matematis Presisi & Auto-Reconcile**. Col D (Total Masuk) dan Col E (Total Keluar) terpisah tegas. Tersedia menu 1-klik di Google Sheets untuk sinkronisasi ulang instan. |
| **Arsip Bukti Foto Fisik & Dokumen** | Foto tersimpan di galeri WhatsApp petugas lapangan, sering terhapus, buram, atau membebani memori ponsel. | **Terunggah Otomatis ke Google Drive Resmi**. Foto unit & dokumen (SPPDC / BSTKB / OKK) terhubung langsung dengan nomor rangka kendaraan dan dapat diakses dari laporan. |
| **Format Laporan Harian Eksekutif** | Format Excel dan PDF sering kali berbeda susunan kolom, tanpa logo resmi, dan tanpa foto visual. | **100% Identik Berlogo Daihatsu**: PDF dan Excel memiliki susunan kolom seragam, kop Astra resmi, lencana cabang asal & tujuan, status terverifikasi, dan visual thumbnail tersemat rapi di sel. |
| **Distribusi Laporan Harian ke Cabang** | Satu file rekap dikirim massal; cabang melihat data unit cabang lain yang bukan wewenangnya. | **Distribusi Partisi Eksklusif**: Admin DSO menerima rekap 5 cabang (master), sedangkan tiap cabang (D660–D664) hanya menerima file mutasi eksklusif cabangnya. |
| **Tampilan Tabel Stok Fisik di Pool** | Teks sering terpotong dan terhimpit di layar ponsel (*bad text wrapping*). | **Tabel Responsif Anti-Wrap (`min-w-[880px]`)**: Layout lega dengan badge monospace, foto resmi katalog, tombol salin VIN cepat, dan toolbar pemilih cabang. |

---

## 3. Struktur Organisasi, Hak Akses Berjenjang & Matriks Wewenang (RBAC)

Sistem menerapkan prinsip **Role-Based Access Control (RBAC)** dan prinsip **Least Privilege** yang memisahkan secara tegas wewenang administratif manajerial dan wewenang operasional lapangan:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             STRUKTUR HAK AKSES SISTEM MANAGEMENT STOCKYARD ASTRA DAIHATSU              │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│ 1. ADMIN HEAD / BRANCH MANAGER (ADH/BM)  │ • Pengawas sentral seluruh cabang           │
│    (Sentra Lampung • Astra Daihatsu DSO) │ • Akses penuh 5 cabang (D660 s/d D664)      │
│                                          │ • Akses Tab Sebaran Cabang & Radar OKK      │
│                                          │ • Melihat, memfilter, & ekspor seluruh data │
│                                          │ • Menerima email laporan master 5 cabang    │
│                                          │ • Mengatur jadwal kirim & toggle digest     │
│                                          │ • Mengatur durasi estimasi tempuh cabang    │
│                                          │ • Mengedit jadwal pengiriman logistik       │
│                                          │ • Melihat status koneksi Cloud & Database   │
├──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ 2. USER CABANG SECURITY (D660 s/d D664)  │ • D660 - Ahmad Yani                         │
│    (Petugas Security On-Duty per Cabang) │ • D661 - Soekarno Hatta                     │
│                                          │ • D662 - Bandar Jaya                        │
│                                          │ • D663 - Lampung Utara                      │
│                                          │ • D664 - Tulang Bawang                      │
│                                          │ • Terbatas HANYA pada data cabang sendiri   │
│                                          │ • Universal login tanpa NPK perorangan      │
│                                          │ • Menerima rekap email eksklusif cabangnya  │
│                                          │ • TERKUNCI TOTAL: Otomatisasi Laporan       │
│                                          │   bersifat Read-Only (terkunci 🔒)          │
│                                          │ • DISEMBUNYIKAN: Durasi Perjalanan SLA dan  │
│                                          │   Status Koneksi Cloud disembunyikan total  │
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
```

### 3.1 Matriks Wewenang Fitur (Authority Matrix)

| Fitur / Modul Operasional | Admin DSO (ADH / BM) | Petugas Security Cabang | Alasan & Landasan Tata Kelola (*Governance*) |
| :--- | :---: | :---: | :--- |
| **Scan Barcode & OCR Unit** | ✅ Ya | ✅ Ya | Kebutuhan esensial pencatatan fisik di gerbang masuk/keluar. |
| **Simpan Mutasi (Masuk/Keluar)** | ✅ Ya | ✅ Ya | Eksekusi serah terima fisik unit & dokumen. |
| **Konfirmasi Unit Tiba (Radar OKK)** | ✅ Ya | ✅ Ya (Di Cabang Tujuan) | Security cabang penerima wajib memverifikasi kedatangan fisik. |
| **Lihat Dashboard & Stok Katalog** | ✅ Ya (Semua) | ✅ Ya (Filtered Cabang) | Visibilitas ketersediaan unit. |
| **Ekspor PDF & Excel Riwayat** | ✅ Ya (Semua) | ✅ Ya (Cabang Sendiri) | Kebutuhan serah terima dan laporan shift. |
| **Ubah Email Penerima Cabang** | ✅ **Hanya Admin** | ❌ **Terkunci** | Mencegah kebocoran data dokumen rahasia korporat (SPPDC/OKK) ke email pribadi. |
| **Edit Jadwal Pengiriman Unit** | ✅ **Hanya Admin** | ❌ **Terkunci** | Jadwal pengiriman merupakan wewenang distribusi supply chain; security hanya bertindak sebagai eksekutor fisik gerbang. |
| **Aktif/Nonaktifkan Daily Digest** | ✅ **Hanya Admin** | ❌ **Terkunci** | Mencegah bot rekap harian termatikan secara tidak sengaja oleh regu jaga shift malam/pagi. |
| **Ubah Jam Pengiriman Daily Digest** | ✅ **Hanya Admin** | ❌ **Terkunci** | Jam rekap 08:00 WIB terikat SOP holding DSO & Astra International. |
| **Atur Durasi Perjalanan SLA Cabang** | ✅ **Tampil & Edit** | ❌ **Disembunyikan (*Hidden*)** | Parameter manajerial disembunyikan sepenuhnya dari pandangan antarmuka Security. |
| **Status Koneksi Cloud & Database** | ✅ **Tampil & Periksa** | ❌ **Disembunyikan (*Hidden*)** | Pengawasan kesehatan teknis database cloud hanya relevan untuk Administrator DSO. |

---

## 4. Arsitektur Tiga Lapis (Frontend, Backend, & Database)

```mermaid
flowchart TD
    subgraph Frontend["1. LAPISAN TAMPILAN (FRONTEND CLIENT - MOBILE & DESKTOP PWA)"]
        UI["Antarmuka Modern (Tailwind CSS, Glassmorphism)"]
        FlightBoard["Radar OKK & Logistics Flight Board (Live In-Transit Kanban & SLA Status)"]
        Scanner["Dual Scanner Engine (Native BarcodeDetector + Tesseract.js OCR)"]
        Compress["Kompresor Foto Otomatis di Browser (< 400 KB)"]
        Sensor["Proteksi Anti-Duplikat (Lampu Merah/Hijau, Audio 1760Hz, Haptik)"]
        ClientExport["Pembuat Laporan PDF & Excel Client-Side (jsPDF & ExcelJS)"]
        AuthPersist["Manajer Sesi Autentikasi (Local Storage v8)"]
        AuthShield["Pelindung Login (Server-First Auth & 60s Brute-Force Lockout)"]
    end

    subgraph Backend["2. LAPISAN PENGOLAH & PENGAMAN (BACKEND SERVERLESS)"]
        Proxy["Gerbang Aman Vercel (/api/proxy Reverse Proxy)"]
        Secret["Proteksi Kredensial (Token Rahasia X-API-SECRET)"]
        GAS["Mesin Google Apps Script (Backend v2.24)"]
        Reconcile["Engine Auto-Reconcile Stok Inventory"]
        Cron["Robot Penjadwal Otomatis (Time-driven Trigger Jam 08:00 WIB)"]
        Partition["Mesin Partisi Laporan Eksklusif per Cabang (D660 - D664)"]
    end

    subgraph Database["3. LAPISAN BASIS DATA & PENYIMPANAN (GOOGLE SPREADSHEET & DRIVE)"]
        Sheet1[("Sheet: HistoryMutasi\n(17 Kolom Resmi Termasuk Rute Tujuan)")]
        Sheet2[("Sheet: Inventory\n(6 Kolom Presisi: Masuk, Keluar, Stok)")]
        Sheet3[("Sheet: UserPIC\n(10 Kolom Akun & Target Email Cabang)")]
        Sheet4[("Sheet: SystemConfig\n(Parameter SLA Perjalanan & Otomasi)")]
        Sheet5[("Sheet: ReportLogs\n(Log Pengiriman Laporan Harian)")]
        Drive[("Google Drive Khusus\n(Arsip Foto Unit, Dokumen, Avatar)")]
    end

    subgraph Output["4. DISTRIBUSI LAPORAN MULTI-CABANG"]
        Gmail["Layanan Email Gmail API Korporat"]
        MasterRep["Email Admin DSO Lampung (Master 5 Cabang)"]
        BranchRep["Email Cabang D660 - D664 (Eksklusif Cabang)"]
    end

    UI --> FlightBoard
    UI --> Scanner
    Scanner --> Sensor
    Sensor -->|Valid & Non-Duplikat| Compress
    Compress -->|Kirim Data & Foto via HTTPS| Proxy
    Proxy --> Secret
    Secret --> GAS
    GAS --> Sheet1
    GAS --> Sheet2
    GAS --> Sheet3
    GAS --> Sheet4
    GAS --> Sheet5
    GAS --> Drive
    Reconcile --> Sheet1
    Reconcile --> Sheet2
    Cron -->|Eksekusi Otomatis 08:00 WIB| Partition
    Partition --> GAS
    GAS --> Gmail
    Gmail --> MasterRep
    Gmail --> BranchRep
    UI --> ClientExport
    UI --> AuthPersist
    UI --> AuthShield
```

---

## 5. Rincian Lengkap Seluruh Menu & Fitur Website

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                  PETA FITUR SISTEM MANAGEMENT STOCKYARD (v2.11)                  │
├───────────────────────────────┬──────────────────────────────────────────────────┤
│ 1. NAVIGASI & HEADER GLOBAL   │ • Status Pool Cabang, Pill Role Switcher,        │
│                               │   Dot Notifikasi, Pull-to-Refresh Mobile, FAB    │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 2. DASHBOARD & ANALITIK       │ • Hero Ringkasan, Filter Cepat 1-Tap (Hari Ini,  │
│                               │   7 Hari, 30 Hari, Semua), Donut Chart & Preview │
│                               │   Card Interaktif, Feed Aktivitas Mutasi Terkini │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 3. MANAJEMEN INVENTARIS &     │ • Tab Katalog 13 Model vs Tab Sebaran Cabang,    │
│    RADAR OKK LOGISTIK         │   Kartu Flight Board Radar OKK (In-Transit live, │
│                               │   timer durasi, SLA rute, deteksi keterlambatan, │
│                               │   status otomatis tiba saat scan Unit Masuk)     │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 4. RINCIAN MODEL (DRILL-DOWN) │ • Banner Spesifikasi Model, Filter Mutasi Model, │
│                               │   Filter Tanggal, Tabel Rincian Unit per Model   │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 5. RIWAYAT MUTASI & EKSPOR    │ • Log Mutasi 17 Kolom (Badge Rute Asal ➔ Tujuan),│
│                               │   Filter Kalender, Ekspor PDF & Excel Berfoto    │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 6. SCANNER CEPAT & FORM       │ • Dual Engine (Barcode + OCR), Senter, Reticle,  │
│                               │   Alarm Anti-Duplikat, Bebas Input Driver,       │
│                               │   Dropdown Cabang Tujuan, Foto Unit & Dokumen    │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 7. PUSAT NOTIFIKASI REAL-TIME │ • Indikator Live Sync, Ping Server, Tombol Kirim │
│                               │   Laporan, Sinkronisasi Cloud Tab ReportLogs     │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 8. PENGATURAN & RBAC SECURITY │ • Profil Operator (Sync Avatar Drive), Kamera,   │
│                               │   Otomatisasi Laporan (Terkunci untuk Security), │
│                               │   Durasi SLA Perjalanan (Hidden untuk Security), │
│                               │   Status Koneksi Cloud (Hidden untuk Security)   │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 9. LIGHTBOX & TOAST ALERT     │ • Penampil Foto Resolusi Penuh, Zoom & Unduh,    │
│                               │   Floating Toast Notifications (Sukses/Error)    │
└───────────────────────────────┴──────────────────────────────────────────────────┘
```

### 5.1 Navigasi Global, Header, & Gestur Mobile
1. **Lencana Status Pool Aktif (*Yard Badge*)**: Menampilkan identitas cabang penugasan resmi (`D660 - Ahmad Yani` hingga `Sentra Lampung • Astra Daihatsu DSO Lampung`).
2. **Pill Role Switcher Interaktif**: Menampilkan status akun saat ini (`Admin (Semua)` warna biru safir atau `User D66X` warna kuning amber). Mengetuk tombol ini membuka modal autentikasi cepat untuk berpindah akun operasional secara aman.
3. **Indikator Lonceng Notifikasi & Pulse Dot**: Ikon lonceng di bagian atas dengan titik merah berdenyut (*pulse dot*) yang menyala otomatis jika terdapat mutasi baru atau update status laporan harian.
4. **Profil Petugas di Header**: Menampilkan foto avatar petugas yang tersinkronisasi dari Google Drive, nama petugas, dan jabatan resmi (`ADMIN HEAD / BRANCH MANAGER` atau `SECURITY`).
5. **Navigasi Tab Utama (Desktop & Mobile)**: Tab navigasi atas untuk desktop dan *floating bottom bar* ergonomis untuk smartphone.
6. **Tombol FAB Scan Melayang**: Tombol bulat besar dengan animasi berpendar (*glowing pulse*) di bilah navigasi bawah untuk memicu kamera pemindai dari menu mana saja.
7. **Gestur Tarik Layar ke Bawah (*Pull-to-Refresh*)**: Menyegarkan data mutasi terbaru langsung dari cloud.

### 5.2 Dashboard Bersih & Ergonomis
1. **Hero Banner Ringkasan**: Menampilkan status operasional hari ini, jumlah mutasi masuk/keluar, dan status sinkronisasi cloud.
2. **Filter Cepat 1-Tap**: Tombol segmentasi instan: *Hari Ini*, *7 Hari Terakhir*, *30 Hari Terakhir*, dan *Semua Waktu*.
3. **Diagram Donat Distribusi Model & Interactive Preview Card**: Diagram donat visual komposisi armada yang terhubung langsung dengan kartu preview model interaktif (menampilkan foto resmi mobil, tipe varian, total unit, dan status stok).
4. **Feed Aktivitas Mutasi Terkini (Live Feed)**: Menampilkan 5 transaksi mutasi mutakhir secara realtime dengan badge status masuk/keluar, rute asal ➔ tujuan, nomor VIN, model, dan waktu pencatatan.

### 5.3 Manajemen Inventaris, Radar OKK Logistik (Flight Board) & Tabel Stok Fisik Pool Yard
1. **Dua Mode Tampilan Utama**:
   - **Tab Katalog 13 Model**: Menampilkan seluruh jajaran model Daihatsu lengkap dengan rincian stok masuk, keluar, dan unit tersedia di pool.
   - **Tab Sebaran Cabang & Radar OKK**: Menampilkan ringkasan unit fisik di 5 cabang resmi serta **Kanban Radar OKK In-Transit** (khusus pengawasan admin DSO).
2. **Fitur Radar OKK / Logistics Flight Board (3-Kolom Kanban Simetris)**:
   - Tata letak desktop 3 kolom sejajar (*items-stretch*) dengan kesamaan garis dasar bawah (*baseline alignment*):
     - **Kolom 1: Pool Asal** — Unit yang baru dicatat keluar dari pool cabang asal.
     - **Kolom 2: Sedang Di Jalan (In-Transit)** — Unit yang sedang aktif bergerak menuju cabang penerima atau ke Luar Lampung.
     - **Kolom 3: Tiba di Tujuan** — Unit yang telah selesai diverifikasi masuk pool cabang penerima atau divalidasi tiba di luar Lampung.
   - **Format Tiket Boarding Pass Logistik**:
     - Menampilkan kode cabang asal, panah transit, kota/cabang tujuan, serta lencana rute (`D66X` warna amber atau `LUAR` warna indigo).
     - Timer durasi perjalanan live (*elapsed time*) yang menghitung menit dan jam sejak unit keluar.
     - Indikator SLA dan Status ETA dinamis:
       - `⏱️ On-Track (~Xm lagi)` jika durasi perjalanan masih dalam batas SLA.
       - `⚠️ Melebihi Estimasi (+Ym)` dengan aksen merah berkedip jika perjalanan melebihi rata-rata durasi cabang atau target SLA hari luar Lampung.
   - **Validasi Selesai Pengiriman Luar Lampung (Custom Astra Daihatsu Modal)**:
     - Karena penerima di luar provinsi Lampung (Palembang, Jakarta, dll.) tidak berada di ekosistem login security DSO Lampung, unit eksternal dilengkapi tombol hijau *Validasi Selesai (Unit Telah Diterima)*.
     - Menekan tombol ini memunculkan **Modal Konfirmasi Kustom Astra Daihatsu** bertema elegan (`#modalExternalDeliveryConfirm`), menampilkan nomor VIN, model kendaraan, dan rute tujuan untuk menyelesaikan siklus transit secara resmi tanpa popup bawaan browser (`confirm()`) yang kaku.
3. **Tabel Rinci Stok Fisik Parkir di Pool Yard (Anti-Wrap Responsive)**:
   - Panel drawer inventaris stok fisik mobil riil yang parkir di area pool yard.
   - Dilengkapi toolbar pemilihan cabang pool yard (`#invPhysicalStockFilterBa`), indikator geser horizontal (*Geser ↔*), dan badge counter unit fisik.
   - Tabel lebar minimum proporsional (`min-w-[880px]`) dengan perlindungan anti-wrap (`whitespace-nowrap`):
     - **No.** — Nomor urut monospace (`#1`, `#2`, ...).
     - **Kendaraan** — Thumbnail foto resmi katalog 13 model, nama model tebal, kategori segmen, dan badge warna mobil.
     - **No. Rangka (VIN) & Mesin** — Tag VIN monospace tebal dengan tombol salin cepat 1-klik (`copyVinToClipboard`) dan nomor mesin.
     - **Cabang Lokasi** — Lencana resmi Astra Daihatsu dalam satu baris utuh (`🟡 D660 - Ahmad Yani`).
     - **Waktu Masuk** — Format tanggal dan jam kedatangan rapi disertai ikon jam.
     - **Dokumen** — Lencana dokumen resmi (`OKK` amber, `BSTKB` emerald, `SPPDC` blue).
     - **Petugas Penerima** — Avatar inisial lingkaran, nama petugas, dan cabang security.
     - **Foto Fisik** — Thumbnail foto fisik mobil di yard yang dapat diklik untuk memperbesar (*preview lightbox*).
4. **Header Statistik Kategori**: Ringkasan armada keluarga/LCGC, SUV/Crossover, dan armada niaga komersial.
5. **Halaman Khusus Rincian Model (*Drill-Down*)**: Banner spesifikasi kendaraan, kartu ringkasan stok model, filter tanggal khusus tipe tersebut, dan tabel unit terdaftar lengkap dengan lencana cabang asal & tujuan.

### 5.4 Riwayat Mutasi & Ekspor Laporan Komprehensif
1. **Tabel Log Mutasi Terintegrasi dengan Lencana Asal & Tujuan**:
   - Catatan kronologis mutasi dengan rincian: Waktu, ID Transaksi, VIN, Nomor Mesin, Model Mobil, Tipe Mutasi, Petugas Security, **Cabang Asal & Tujuan Pengiriman**, Jenis Dokumen (SPPDC / BSTKB / OKK), Foto Fisik Unit, Foto Dokumen, dan Catatan Lapangan.
   - **Format Lencana Cabang Asal & Tujuan Pengiriman Bertumpuk (`renderBranchWithDestination`)**:
     - Lencana Atas: Cabang Asal (`🟡 D661 - Soekarno Hatta`) dalam warna krem amber dengan dot kuning.
     - Lencana Bawah: Tujuan Pengiriman (`➔ Tujuan: D660 – Ahmad Yani` untuk mutasi antar cabang OKK, atau `➔ Tujuan: Luar Lampung (Palembang)` untuk mutasi keluar provinsi SPPDC) dalam warna biru lembut berbingkai tipis (`bg-blue-50 border-blue-200 text-blue-700`).
     - Unit Masuk hanya menampilkan cabang penerima tanpa lencana tujuan.
2. **Filter Rentang Kalender & Pencarian Global**: Menyesuaikan audit harian, mingguan, bulanan, serta pencarian instan nomor rangka, nomor mesin, atau model.
3. **Empat Metode Ekspor Resmi**:
   - **Ekspor PDF Berkop Resmi**: Dokumen PDF landscape berlogo Daihatsu, format kode form `ADM-YARD-BA-01`, tabel seragam, kolom cabang asal dan tujuan (`➔ Tujuan: ...`), dan 2 pengesahan tanda tangan resmi: `SECURITY` dan `ADH / BM`.
   - **Ekspor Excel (.xlsx Murni) Berfoto**: Dihasilkan via `ExcelJS` langsung di browser, menyematkan visual foto unit & dokumen ke dalam sel tabel secara proporsional, border rapi, keterangan rute cabang asal & tujuan, dan tanda tangan resmi.
   - **Cetak Langsung (*Print-Ready*)**: Tata letak ramah cetak A4 tanpa elemen UI browser.
   - **Email Rekapitulasi Terjadwal & On-Demand (Backend v2.27)**: Pengiriman otomatis pukul 08:00 WIB dan manual via tombol "Kirim Laporan" dengan lampiran PDF & Excel yang dipartisi eksklusif per cabang.

### 5.5 Pemindai Kamera Cepat & Formulir Ringkas
* **Tahap 1: Viewport Kamera & Deteksi Cerdas**:
  - Bingkai laser 4 sudut dengan sakelar mode: Barcode Otomatis, OCR Teks Stiker, dan Unggah Foto dari Galeri.
  - Penyaring cerdas multi-barcode (`smartFilterBarcodes`): otomatis mengunci VIN 17 digit `MHK...` dan nomor mesin.
  - Alarm anti-duplikat multi-sensori: Jika unit terdaftar, layar menyala **MERAH**, alarm nada rendah berbunyi, ponsel bergetar panjang, dan tombol lanjut diblokir. Jika valid, layar menyala **HIJAU**, bunyi bip 1760Hz, dan tombol lanjut aktif.
* **Tahap 2: Formulir Serah Terima Mutasi Unit (Bebas Input Driver)**:
  - Banner identitas nomor sasis dan mesin terkunci otomatis.
  - Pilihan radio: **Unit Masuk** atau **Unit Keluar**.
  - Dropdown 13 Model Resmi Kendaraan Daihatsu.
  - Dropdown Cabang Asal (Otomatis terkunci ke cabang penugasan petugas).
  - **Dukungan Rute Antar-Cabang (OKK) & Rute Luar Lampung (SPPDC)**:
    - **Mutasi Antar-Cabang (OKK)**: Dropdown Cabang Tujuan otomatis menyaring dan menyembunyikan cabang asal untuk mencegah salah pilih (validasi form memblokir pengiriman jika cabang asal dan cabang tujuan sama).
    - **Mutasi Luar Lampung (SPPDC)**: Saat memilih tujuan Luar Lampung, formulir secara dinamis memunculkan kolom input teks:
      - **Kota / Pihak Tujuan Luar Lampung**: Wajib diisi (misal: *Palembang*, *Jakarta*, *Bandung*, dll.).
      - **Target Waktu Tempuh SLA Luar Lampung**: Pilihan durasi perjalanan (misal: *1 Hari / 24 Jam*, *2 Hari / 48 Jam*, *3 Hari / 72 Jam*).
  - Dropdown Dokumen Resmi: **SPPDC**, **BSTKB**, atau **OKK**.
  - Dua slot foto wajib: Foto Fisik Mobil dan Foto Dokumen (SPPDC / BSTKB / OKK).
  - Kolom catatan kondisi lapangan & tombol simpan berindikator kompresi gambar otomatis.

### 5.6 Pusat Notifikasi & Sistem Pemberitahuan Android (`NotificationService` & `ReportLogs`)
* **Integrasi Penuh Status Bar & Notifikasi Sistem Android**:
  - Berfungsi langsung melalui Service Worker (`reg.showNotification`) pada smartphone Android yang telah menginstal PWA/WebAPK.
  - Dilengkapi banner aktivasi 1-klik di Dashboard jika izin notifikasi belum diaktifkan di perangkat.
  - Dilengkapi nada notifikasi sistem, getaran haptik (*tactile vibration patterns*), logo resmi Daihatsu pada status bar, serta dukungan buka-langsung ke tab terkait saat notifikasi diketuk.
* **Skenario Pemberitahuan Real-Time di Handphone Petugas**:
  1. **Scan Berhasil Masuk Database**: Seketika setelah barcode discan dan data tersimpan ke Google Spreadsheet & Drive, ponsel memunculkan notifikasi: `✅ Unit Masuk/Keluar Berhasil Tersimpan` dengan rincian model, nomor rangka (VIN), dan nama petugas.
  2. **Pengiriman Transit OKK (Asal vs Tujuan)**:
     - **Cabang Pengirim (misal D661)**: Notifikasi status bar: `🚛 Unit Dalam Perjalanan (Transit OKK)` — mengonfirmasi unit resmi meluncur menuju cabang tujuan.
     - **Cabang Penerima (misal D660)**: Notifikasi getar tegas: `📍 Unit OTW Menuju Cabang Anda!` — memberi peringatan kepada regu security pos tujuan bahwa armada sedang menuju lokasinya agar gerbang penerimaan siap.
     - **Admin DSO**: Notifikasi sentral: `🚛 Mutasi OKK Antar-Cabang (D661 ➔ D660)`.
  3. **Konfirmasi Kedatangan Fisik (Scan Tiba di Tujuan)**:
     - **Cabang Penerima (D660)**: `✅ Unit OKK Berhasil Diterima di Pool!` — unit tercatat masuk ke database dan stok fisik bertambah.
     - **Cabang Pengirim (D661)**: `🏁 Unit Transit Tiba di Tujuan!` — memastikan mobil yang dikirim telah sampai dengan aman di pos penerima.
     - **Admin DSO**: `✅ OKK Selesai: Tiba di D660`.
  4. **Peringatan Keterlambatan Perjalanan (Radar SLA Delay)**:
     - Jika unit di jalan melebihi estimasi durasi matriks rute cabang, sistem secara otomatis membunyikan alarm dan memunculkan notifikasi darurat: `⚠️ Peringatan Keterlambatan OKK!` lengkap dengan indikator selisih waktu keterlambatan.
  5. **Rekapitulasi Harian Email Berhasil Terkirim**:
     - Pukul 08:00 WIB, ponsel menampilkan notifikasi: `📊 Rekapitulasi Mutasi Harian Terkirim!` mengonfirmasi pengiriman berkas PDF & Excel ke email manajemen.
* **Filter Riwayat Notifikasi di Tab History**:
  - `Semua (N)`: Menggabungkan seluruh mutasi unit dan riwayat pengiriman laporan.
  - `Masuk (N)`: Mutasi unit masuk.
  - `Keluar (N)`: Mutasi unit keluar.
  - `Laporan (N)`: Catatan resmi berkas laporan rekapitulasi harian yang berhasil dikirimkan ke email target, tersinkronisasi langsung dari tab spreadsheet **`ReportLogs`**.
* **Kartu Laporan Harian Modern**: Memuat badge `📄 Laporan Rekap Harian`, tanggal periode laporan, jumlah unit (masuk/keluar), status `Spreadsheet Sync ✓` / `Email Terkirim ✓`, serta rincian chip email penerima.

### 5.7 Pengaturan & Proteksi Akses Berjenjang (Settings)
* **Profil Pengguna**: Menampilkan nama pejabat/regu security, foto avatar terintegrasi Google Drive dengan fitur auto-cleanup foto lama saat foto baru diunggah.
* **Preferensi Perangkat**: Pilihan kamera default (kamera belakang/depan) dan sakelar auto-torch (senter otomatis menyala saat pemindai dibuka di tempat gelap).
* **Otomatisasi Laporan (Terkunci Total untuk Security)**:
  - Menampilkan jadwal kirim laporan dan target email terdaftar.
  - Akun Security mendapati item ini terkunci dengan lencana `🔒 Terkunci` dan sakelar toggle dinonaktifkan (`disabled`).
  - Hanya Admin DSO yang dapat mengklik tombol "Ubah Jadwal", mengedit jam pengiriman, atau mengubah target email.
* **Durasi Perjalanan Cabang SLA & Matriks Rute Dinamis (Hidden untuk Security, Otoritas Penuh Admin DSO)**:
  - Kartu ini **disembunyikan sepenuhnya** dari akun Security dan hanya dapat diakses oleh Admin DSO.
  - **Matriks Rute Dinamis Asal ➔ Tujuan**: Memungkinkan penetapan estimasi SLA durasi perjalanan spesifik untuk setiap pasangan cabang (contoh: dari D661 ke D660 = 45 menit, D661 ke D662 = 90 menit).
  - **Kontrol Stepper Taktil**: Dilengkapi tombol sentuh cepat (+/- 5 menit dan +/- 15 menit) untuk memudahkan penyesuaian SLA tanpa mengetik manual.
  - **Penambahan Rute Baru Mandiri**: Admin dapat dengan bebas menambahkan rute baru melalui formulir `+ Tambah Rute Antar Cabang Baru` (misal D661 ke D663 atau D662 ke D664) dan sistem langsung mengintegrasikannya ke Radar OKK dan Google Spreadsheet (`SystemConfig`).
  - **Penghapusan Rute**: Rute kustom dapat dihapus secara instan dengan tombol hapus tempat sampah merah.
  - **Sinkronisasi Otomatis**: Seluruh perubahan matriks rute tersinkronisasi instan ke tab `SystemConfig` (`TRANSIT_ROUTES_JSON`) dan cache offline.
* **Status Koneksi Cloud & Database (Hidden untuk Security)**:
  - Kartu ini **disembunyikan sepenuhnya** dari akun Security.
  - Hanya Admin DSO yang dapat memeriksa status ping dan latensi server Apps Script / Drive.

---

## 6. Kamus Lengkap & Direktori Kode Program (Codebase & Function Directory)

Bagian ini mendokumentasikan setiap berkas kode, objek arsitektural, dan fungsi internal sistem secara rinci:

### 6.1 Berkas `assets/js/config.js` (Konfigurasi & Katalog Model)
Objek sentral `CONFIG` yang menyimpan seluruh parameter dasar, konstanta identitas perusahaan, daftar cabang, dan katalog kendaraan:
* `CONFIG.APP_NAME`: Nama resmi aplikasi (`Management StockYard`).
* `CONFIG.COMPANY`: Identitas resmi (`PT Astra International Tbk - Daihatsu Sales Operation`).
* `CONFIG.AREA`: Cakupan wilayah (`Sentra Lampung (DSO)`).
* `CONFIG.DEFAULT_TRANSIT_TIMES`: Konstanta durasi standar perjalanan dalam menit:
  - `DEFAULT: 90`, `D660: 45`, `D661: 30`, `D662: 90`, `D663: 150`, `D664: 180`.
* `CONFIG.BRANCHES`: Array objek 5 cabang resmi dan 1 sentra DSO (`Sentra Lampung`, `D660 - Ahmad Yani`, `D661 - Soekarno Hatta`, `D662 - Bandar Jaya`, `D663 - Lampung Utara`, `D664 - Tulang Bawang`).
* `CONFIG.MODELS`: Array 13 model resmi Daihatsu lengkap dengan ID katalog, nama varian, kategori segmen, kapasitas maksimum yard, dan tautan berkas foto resmi.
* `CONFIG.CACHE_KEYS`: Konstanta kunci `localStorage` untuk caching offline (`AUTH_SESSION`, `INVENTORY`, `HISTORY`, `USER_PROFILE`, `CONFIG`, `TRANSIT_TIMES`).

### 6.2 Berkas `assets/js/api.js` (`ApiService`)
Modul penghubung komunikasi jaringan antara aplikasi frontend dan backend serverless:
* `ApiService.request(action, method, data)`: Fungsi inti HTTP client yang membungkus pemanggilan `fetch` menuju `/api/proxy` (atau direct Apps Script URL jika dikonfigurasi). Dilengkapi timeout 35 detik dan penanganan error terpusat.
* `ApiService.fetchInitialData()`: Mengambil data dari 5 sheet sekaligus (`HistoryMutasi`, `Inventory`, `UserPIC`, `SystemConfig`, `ReportLogs`) dalam 1 round-trip HTTP.
* `ApiService.login(username, password)`: Melakukan autentikasi kredensial pengguna ke server Google Apps Script tanpa mengekspos kata sandi di sisi browser.
* `ApiService.verifyLocalCredentials(username, password)`: Fallback verifikasi lokal jika jaringan offline menggunakan data akun ter-cache.
* `ApiService.saveMutation(mutationRecord)`: Mengirimkan data transaksi mutasi unit 17 kolom beserta foto base64 ke Google Spreadsheet & Google Drive.
* `ApiService.updateConfig(configData)`: Menyimpan parameter key-value konfigurasi ke tab `SystemConfig`.
* `ApiService.saveTransitDurations(durations)`: Membungkus penyimpanan parameter SLA durasi perjalanan (`TRANSIT_TIME_*`) ke sheet `SystemConfig`.
* `ApiService.updateBranchTargetEmail(branchOrUsername, emailStr)`: Memperbarui kolom Target Email pada tab `UserPIC` di Google Sheets.
* `ApiService.triggerEmailReport(targetEmail)`: Memicu pengiriman laporan rekapitulasi harian secara manual (on-demand).
* `ApiService.checkHealth()`: Memeriksa ketersediaan koneksi dan latensi ke server Google Apps Script.

### 6.3 Berkas `assets/js/state.js` (`AppState`)
Pusat manajemen state reaktif aplikasi (*Single Source of Truth*):
* `AppState.vehicleCatalog`: Menyimpan 13 model mobil Daihatsu.
* `AppState.inventoryData`: Array data stok unit fisik aktual di yard.
* `AppState.historyData`: Array seluruh transaksi mutasi yang pernah dicatat.
* `AppState.transitTimes`: Objek durasi perjalanan per cabang yang tersinkronisasi dari `SystemConfig`.
* `AppState.transitRoutes`: Array matriks rute point-to-point dinamis antar-cabang (`originCode`, `destinationCode`, `durationMinutes`, `label`).
* `AppState.initTransitRoutes()`: Menginisialisasi dan memulihkan matriks rute perjalanan dari `localStorage` atau `DEFAULT_TRANSIT_ROUTES`.
* `AppState.getTransitDurationForRoute(origin, dest)`: Menghitung durasi SLA spesifik rute dari cabang asal ke cabang tujuan (contoh: D661 ke D660 = 45 mnt), dengan fallback ke durasi cabang tujuan atau default 90 menit.
* `AppState.setTransitRoute(origin, dest, minutes)`: Menambah atau memperbarui estimasi durasi rute point-to-point tertentu.
* `AppState.removeTransitRoute(index)`: Menghapus rute kustom dari matriks rute.
* `AppState.computeRelevantAverageTransitTime(activeUnits)`: Menghitung rata-rata SLA durasi perjalanan secara dinamis dan akurat berdasarkan armada yang sedang *In-Transit* atau matriks rute aktif (bukan angka statis).
* `AppState.userProfile`: Profil pengguna yang sedang login saat ini.
* `AppState.isAdmin()`: Mengembalikan nilai boolean `true` jika user adalah Admin DSO (ADH/BM).
* `AppState.getUserBranch()` / `AppState.getUserBranchCode()`: Mengambil nama dan kode cabang pengguna saat ini.
* `AppState.getTransitDurationForBranch(branchCodeOrName)`: Mengambil estimasi durasi tempuh (menit) untuk cabang tujuan tertentu dengan fallback ke nilai `DEFAULT`.
* `AppState.formatMinutesToHuman(totalMinutes)`: Mengonversi satuan menit menjadi format ramah baca (contoh: `1j 30m` atau `45m`).
* `AppState.getAverageTransitMinutes()`: Menghitung rata-rata waktu tempuh seluruh rute aktif.
* `AppState.getInTransitUnits()`: Mengambil daftar armada yang sedang bergerak (*In-Transit OKK*), menghitung durasi perjalanan live, dan mendeteksi apakah unit *On-Track* atau *Melebihi Estimasi*.
* `AppState.getLogisticsKanbanData(filterRoute, searchQuery)`: Mengelompokkan data Radar OKK ke dalam kolom *Departures*, *In-Transit*, dan *Delivered*.
* `AppState.evaluateMutationAllowed(vin, engine, proposedType, proposedBranch)`: Evaluasi validasi anti-duplikat dan siklus mutasi unit (mencegah unit di-scan Masuk jika masih berstatus Masuk).
* `AppState.isUnitCurrentlyInYard(vin, engine)` / `AppState.isVinDuplicate(vin, engine)`: Helper pengecekan keberadaan fisik unit di dalam yard.
* `AppState.getMultiBranchStockSummary()`: Menghitung rekapitulasi sebaran unit fisik di seluruh cabang.
* `AppState.updateKpiCounts()`: Menghitung ulang total unit terdaftar, unit in-yard, unit in-transit, dan mutasi harian untuk widget dashboard.
* `AppState.saveToCache()` / `AppState.loadFromCache()`: Serialisasi dan pemulihan state dari `localStorage`.

### 6.4 Berkas `assets/js/scanner.js` (`ScannerService`)
Mesin pemindai kamera multi-sensor:
* `ScannerService.open(mode)`: Menginisialisasi kamera smartphone, menampilkan reticle laser 4 sudut, dan memulai loop deteksi.
* `ScannerService.close()`: Menghentikan stream kamera dan membersihkan media track perangkat.
* `ScannerService.startNativeDetectorLoop()`: Loop pemindaian cepat memanfaatkan native browser `BarcodeDetector` API.
* `ScannerService.smartFilterBarcodes(rawBarcodes)`: Algoritma penyaring multi-barcode pada stiker kaca mobil: memprioritaskan barcode berawalan `MHK...` (VIN 17 digit) dan membuang nomor PO/part yang tidak relevan.
* `ScannerService.captureAndProcessOcr()`: Mengambil tangkapan frame kamera resolusi tinggi, melakukan preprocessing kontras, dan mengekstrak nomor rangka/mesin via `Tesseract.js` jika barcode fisik rusak atau buram.
* `ScannerService.playSuccessBeep()` / `ScannerService.playWarningBeep()`: Menghasilkan umpan balik audio synthesized (nada tinggi 1760Hz untuk scan sukses, nada rendah berulang untuk unit duplikat).
* `ScannerService.triggerHaptic()` / `ScannerService.triggerWarningHaptic()`: Menggetarkan smartphone petugas (getar pendek untuk sukses, getar panjang berdenyut untuk peringatan duplikat).
* `ScannerService.goToStep2Form()`: Mengunci nomor VIN dan nomor mesin, memvalidasi anti-duplikat, dan membuka formulir serah terima mutasi.

### 6.5 Berkas `assets/js/ui.js` (`UI`)
Pengendali antarmuka pengguna, visualisasi data, dan pembuat laporan:
* `UI.switchTab(targetTab)`: Berpindah antar tab utama (*dashboard*, *inventory*, *history*, *settings*) dengan animasi halus dan pembaruan riwayat URL browser.
* `UI.applyDashboardDateFilter()`: Menyaring feed dan statistik mutasi berdasarkan filter tanggal 1-tap (*Hari Ini*, *7 Hari*, *30 Hari*, *Semua*).
* `UI.updateDashboardDonut()`: Menggambar grafik donat SVG interaktif komposisi armada mobil lengkap dengan preview card saat irisan donat disentuh/diklik.
* `UI.renderInventoryList()`: Merender grid kartu 13 model kendaraan lengkap dengan rincian unit masuk, keluar, dan sisa stok fisik di yard.
* `UI.renderInventoryBranchesView()`: Merender tampilan sebaran stok per cabang dan Kanban Radar OKK Flight Board.
* `UI.openModelDetail(catalogId)`: Membuka halaman drill-down rincian spesifikasi teknis dan daftar unit fisik per model.
* `UI.renderHistoryList()`: Merender tabel riwayat mutasi 17 kolom dengan pagination dan badge rute cabang tujuan.
* `UI.exportToPdf()`: Menghasilkan berkas PDF landscape berstandar resmi Astra Daihatsu `ADM-YARD-BA-01` menggunakan pustaka `jsPDF` dan `jspdf-autotable`.
* `UI.exportToExcel()`: Menghasilkan berkas Excel murni (`.xlsx`) berlogo Astra Daihatsu dengan visual foto unit dan dokumen tersemat langsung ke dalam sel spreadsheet menggunakan pustaka `ExcelJS`.
* `UI.openEditScheduleModal()`: Membuka modal pengaturan jam pengiriman laporan (diproteksi khusus Admin DSO).
* `UI.openEditTargetEmailModal()`: Membuka modal pengaturan target email penerima laporan (diproteksi khusus Admin DSO).
* `UI.toggleDailyDigestSetting(isChecked)`: Mengaktifkan/menonaktifkan sakelar bot daily digest (diproteksi khusus Admin DSO).
* `UI.saveTransitDurations()`: Mengambil nilai matriks rute perjalanan dan durasi cabang, menyimpannya ke `SystemConfig` via `ApiService`, dan memperbarui cache offline.
* `UI.renderTransitDurationSettings()`: Merender daftar interaktif matriks rute point-to-point di menu Settings, lengkap dengan stepper pills (+/- 5 dan +/- 15 menit), tombol hapus rute, dan kartu tambah rute baru.
* `UI.adjustTransitDurationInput(routeId, deltaMinutes)`: Menambah atau mengurangi durasi SLA menit suatu rute dengan umpan balik visual instan.
* `UI.deleteTransitRouteRow(index)`: Menghapus rute transit kustom dari antarmuka Settings dan state aplikasi.
* `UI.addNewTransitRoute()`: Menambahkan kombinasi rute baru (misal D661 ke D662) secara mandiri oleh Admin tanpa perlu merombak kode.
* `UI.syncSettingsPreferences()`: Menyinkronkan seluruh tampilan halaman Pengaturan:
  - Mematikan sakelar dan mengunci form Otomatisasi Laporan untuk akun Security.
  - Menyembunyikan kartu Durasi Perjalanan Cabang untuk akun Security.
  - Menyembunyikan kartu Status Koneksi Cloud & Database untuk akun Security.
* `UI.showToast(message, duration)`: Menampilkan floating toast notification elegan untuk notifikasi sukses, peringatan, atau error.

### 6.6 Berkas `assets/js/app.js` (`App`)
Pengendali siklus hidup aplikasi (*Application Lifecycle & Orchestrator*):
* `App.init()`: Titik masuk utama aplikasi saat halaman dimuat: memulihkan sesi autentikasi, memuat cache offline, mendaftarkan service worker PWA, memicu sinkronisasi backend, dan mengatur event listener global.
* `App.syncBackendData(silent)`: Mengambil data termutakhir dari Google Spreadsheet di background secara senyap tanpa mengganggu aktivitas input petugas.
* `App.saveMutationData()`: Memvalidasi kelengkapan form serah terima mutasi (nomor rangka, mesin, foto unit, foto dokumen, jenis mutasi, cabang asal/tujuan), mengompresi foto di sisi klien (< 400 KB), memperbarui state lokal secara optimistik, dan mengirimkan data ke Google Apps Script backend.
* `App.handleImageUpload(inputEl, previewId)`: Membaca file gambar dari kamera/galeri, melakukan kompresi proporsional menggunakan HTML5 Canvas, dan membuat URL preview lokal.

### 6.7 Berkas `assets/js/notification.js` (`NotificationService`)
Sistem pengelola notifikasi bawaan Android (*Native Web Push & System Notification Drawer*):
* `NotificationService.init()`: Memuat riwayat ID mutasi yang telah dilihat dari `localStorage`, mendaftarkan listener Service Worker, dan menyalakan timer pemantau SLA delay setiap 60 detik.
* `NotificationService.isSupported()` / `isGranted()`: Memeriksa dukungan peramban dan status izin notifikasi sistem Android.
* `NotificationService.requestPermission()`: Meminta izin notifikasi ke sistem operasi Android/Chrome dan memunculkan konfirmasi getar pertama.
* `NotificationService.show(title, options)`: Mengirimkan payload notifikasi kaya (*rich notification*) melalui `registration.showNotification` lengkap dengan getaran haptik, badge icon, tag anti-spam, dan URL navigasi tab.
* `NotificationService.notifyMutation(record)`: Menangani orkestrasi skenario notifikasi:
  - *Scan Berhasil Masuk Database*: Memberi notif `✅ Unit Masuk/Keluar Berhasil Tersimpan` saat operator lapangan selesai scan.
  - *Transit Antar-Cabang (OKK Keluar)*:
    - Cabang Asal (D661): Menerima notif `🚛 Unit Dalam Perjalanan (Transit OKK)`.
    - Cabang Tujuan (D660): Menerima notif `📍 Unit OTW Menuju Cabang Anda! Siapkan gerbang!`.
    - Admin DSO: Menerima notif pergerakan armada antar cabang.
  - *Konfirmasi Kedatangan Fisik (OKK Masuk di Tujuan)*:
    - Cabang Pengirim (D661): Menerima notif `🏁 Unit Transit Tiba di Tujuan!`.
    - Cabang Penerima (D660): Menerima notif `✅ Unit OKK Berhasil Diterima di Pool!`.
* `NotificationService.checkDelaysAndNotify()`: Memeriksa armada *In-Transit* yang melebihi estimasi durasi SLA rute dan memicu alarm keterlambatan.
* `NotificationService.checkNewReportLogsAndNotify(reportLogs)`: Sinkronisasi realtime notifikasi laporan email harian terkirim dengan validasi ganda ketat:
  - **Inisialisasi Cold-Start**: Menandai seluruh log laporan yang sudah ada di database sebagai *seen* saat pertama kali aplikasi dibuka agar riwayat lama tidak memicu notifikasi palsu.
  - **Filter Status Sukses**: Hanya bereaksi terhadap log yang berstatus `SUCCESS` / `TERKIRIM` nyata dari server.
  - **Uji Kebaruan Waktu (Freshness Check < 15 Menit)**: Membandingkan timestamp eksekusi laporan dengan jam perangkat saat ini. Notifikasi status bar HANYA ditembakkan jika laporan benar-benar baru dikirim dalam 15 menit terakhir, menjamin sinkronisasi 100% presisi dan bersamaan dengan masuknya email di Gmail (misal jam 08:31 WIB).
  - **Persistensi `localStorage`**: Menyimpan ID laporan yang sudah dinotifikasikan (`daihatsu_seen_report_ids`) agar tidak terjadi notifikasi ganda saat aplikasi dibuka ulang.
* `NotificationService.notifyDailyReport(reportLog)`: Memunculkan notifikasi status bar saat rekap harian PDF/Excel terkirim ke email manajemen.
* `NotificationService.testNotification()`: Tombol uji coba instan untuk memverifikasi getaran dan visual status bar di ponsel petugas.

### 6.8 Berkas `backend/backend_stockyard_v2_27.gs` (Google Apps Script Engine)
Mesin komputasi awan serverless yang berjalan di Google Workspace:
* `doGet(e)` / `doPost(e)`: Pintu gerbang API HTTP RESTful yang menangani routing aksi (*actions*): `getInitialData`, `recordMutation`, `updateConfig`, `updateProfile`, `updateBranchEmail`, `verifyCredentials`, `sendReportEmail`, dan `health`.
* `getInitialData(ss)`: Mengekstrak seluruh data 5 sheet dalam format JSON teroptimasi.
* `recordMutation(ss, data)`: Menuliskan baris transaksi mutasi 17 kolom ke `HistoryMutasi`, memanggil `updateInventoryStock`, dan memicu notifikasi email realtime.
* `updateInventoryStock(ss, modelName, mutationType)`: Memperbarui stok di tab `Inventory` secara presisi:
  - `Unit Masuk` HANYA menambah angka pada Kolom D (`Total Masuk`).
  - `Unit Keluar` HANYA menambah angka pada Kolom E (`Total Keluar`).
* `reconcileInventoryStock(ss)`: Membaca ulang seluruh riwayat transaksi di `HistoryMutasi` dan menghitung ulang angka akumulasi masuk dan keluar untuk memastikan tidak ada selisih stok fisik.
* `getSystemConfigData(ss)` / `updateSystemConfig(ss, data)`: Mengelola parameter key-value konfigurasi sistem di tab `SystemConfig` (termasuk matriks `TRANSIT_ROUTES_JSON` dan nilai `TRANSIT_TIME_*` per cabang).
* `menuInitSystemConfig()`: Fungsi menu khusus Google Sheets untuk menginisialisasi parameter durasi dan jadwal secara otomatis dengan 1-klik.
* `generateDailyPdfReport(ss, dateStr, branchFilter)`: Membangun dokumen laporan rekapitulasi PDF berkop resmi Astra Daihatsu 13 kolom dengan tanda tangan digital Security dan ADH/BM.
* `generateDailyExcelReport(ss, dateStr, branchFilter)`: Membangun dokumen laporan rekapitulasi Excel (.xlsx) dengan visual foto unit tersemat rapi di sel.
* `triggerReportEmail(ss, data)`: Mengirimkan laporan harian via Gmail API yang dipartisi secara eksklusif ke masing-masing cabang:
  - **Integritas Audit Periode H-1 (Kemarin)**: Secara ketat merekap operasional kemarin. Menghapus tuntas bug pengalihan ke hari ini jika kemarin 0 transaksi, sehingga data operasional hari ini yang belum selesai tidak akan pernah terkirim mendahului waktunya.
  - **Status Nihil Mutasi**: Jika kemarin tidak terdapat pergerakan fisik unit (0 transaksi), sistem menerbitkan email resmi berstatus `NIHIL MUTASI` untuk periode kemarin.
* `sendDailyScheduledReport()`: Fungsi yang dipicu oleh time-driven cron trigger otomatis setiap pukul 08:00 WIB untuk mengirimkan rekapitulasi operasional H-1 (Kemarin).
* `uploadImageToDrive(folderId, base64Data, fileName, mimeType)`: Mengunggah file foto dari aplikasi langsung ke folder Google Drive perusahaan.
* `deleteDriveFile(fileUrlOrId)`: Menghapus file foto lama di Google Drive secara otomatis saat foto profil diperbarui.

### 6.9 Berkas `sw.js` (Progressive Web App Service Worker)
Pengelola fungsionalitas offline, caching aset, dan penerimaan notifikasi status bar Android:
* `CACHE_NAME`: Nama cache versi aktif (`stockyard-pwa-v1.4.9`).
* `STATIC_ASSETS`: Daftar berkas inti aplikasi (*App Shell*) yang di-cache di perangkat: HTML, CSS, JavaScript modul, dan icon manifest.
* Menggunakan strategi *Stale-While-Revalidate* untuk aset statis dan strategi *Network-Only* untuk pemanggilan API dan Google Drive.
* `notificationclick`: Event listener yang menangani sentuhan pada notifikasi status bar Android, otomatis memfokuskan jendela aplikasi dan menavigasi ke tab yang relevan (Dashboard, Riwayat, atau Radar OKK).

### 6.10 Berkas `api/proxy.js` (Vercel Serverless Reverse Proxy)
Lapisan pengaman kredensial dan gateway reverse proxy:
* Menerima permintaan HTTPS dari aplikasi frontend dan meneruskannya ke URL rahasia Google Apps Script (`APPSCRIPT_URL`).
* Menyuntikkan token otentikasi rahasia (`API_SECRET_TOKEN`) ke header request di sisi server sehingga kredensial cloud tidak pernah terekspos ke perangkat pengguna atau DevTools browser.

---

## 7. Spesifikasi Lengkap Basis Data (Google Sheets & Drive)

### 7.1 Lembar Kerja 1: `HistoryMutasi` (Buku Besar Rekam Jejak — 17 Kolom Resmi)
| Kolom | Nama Kolom Spreadsheet | Tipe Data | Contoh Isi Data | Penjelasan Fungsi Data |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `ID Mutasi` | Teks Unik | `MUT-20261119-083015` | Nomor registrasi transaksi mutasi |
| **B** | `Timestamp ISO` | ISO String | `2026-11-19T01:30:15.000Z` | Stempel waktu standar sistem internasional |
| **C** | `Tanggal` | Tanggal | `19/11/2026` | Tanggal mutasi di lapangan |
| **D** | `Jam` | Waktu | `08:30 WIB` | Jam serah terima unit di gerbang pool |
| **E** | `Model` | Teks Pilihan | `Rocky e-Smart Hybrid` | Varian model dari 13 katalog resmi Daihatsu |
| **F** | `Warna` | Teks | `Putih Mutiara` | Warna unit kendaraan |
| **G** | `No. Rangka (VIN)` | Teks (17 Digit) | `MHKP3FA1JTK137533` | Nomor rangka kendaraan resmi (Kunci Utama) |
| **H** | `No. Mesin` | Teks | `2NR4F82393` | Nomor mesin kendaraan resmi |
| **I** | `Jenis Mutasi` | Teks | `Unit Masuk` / `Unit Keluar` | Jenis pergerakan kendaraan di pool |
| **J** | `Nama Petugas` | Teks | `Budi Santoso` | Nama lengkap petugas security yang bertugas |
| **K** | `Jabatan PIC` | Teks | `SECURITY` / `ADH/BM` | Peran pengguna yang mencatat transaksi |
| **L** | `Cabang Asal` | Teks | `D660 - Ahmad Yani` | Cabang lokasi pencatatan mutasi unit |
| **M** | `Catatan` | Teks Catatan | `Kondisi mulus, spion & toolkit lengkap` | Catatan kondisi fisik unit di lapangan |
| **N** | `Jenis Dokumen` | Teks | `SPPDC` / `BSTKB` / `OKK` | Jenis dokumen serah terima resmi |
| **O** | `Foto Unit` | Tautan URL Drive | `https://drive.google.com/file/d/...` | Foto fisik unit kendaraan tampak depan |
| **P** | `Foto Dokumen` | Tautan URL Drive | `https://drive.google.com/file/d/...` | Foto fisik surat jalan resmi yang ditandatangani |
| **Q** | `Cabang Tujuan` | Teks | `D662 - Bandar Jaya` | Cabang destinasi mutasi keluar (Radar OKK) |

### 7.2 Lembar Kerja 2: `Inventory` (Status Stok per Model — 6 Kolom Presisi)
| Kolom | Nama Kolom | Tipe Data | Contoh Isi Data | Penjelasan |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `ID Model` | Teks | `INV-001` | Kode model kendaraan katalog |
| **B** | `Nama Model Kendaraan` | Teks | `Rocky e-Smart Hybrid` | Nama varian resmi kendaraan Daihatsu |
| **C** | `Kategori` | Teks | `Smart Hybrid SUV` | Segmen pasar armada |
| **D** | `Total Masuk` | Angka | `1` | Akumulasi total unit masuk yang pernah dicatat |
| **E** | `Total Keluar` | Angka | `0` | Akumulasi total unit keluar yang pernah dicatat |
| **F** | `URL Foto` | Teks URL | `assets/images/...` | Gambar visual resmi katalog model |

> [!IMPORTANT]
> **Formula Perhitungan Stok Fisik (Net Stock):**  
> $\text{Stok Tersedia di Yard} = \text{Total Masuk (Col D)} - \text{Total Keluar (Col E)}$  
> Sistem dilengkapi fitur **Auto-Reconcile 1-Klik**: Melalui menu Google Sheets **`🚗 Daihatsu Stockyard` ➔ `🔄 Sinkronisasi / Rebuild Stok Inventory`**, sistem secara otomatis menghitung ulang seluruh baris di `HistoryMutasi` dan menuliskan angka mutlak ke Kolom D dan E tanpa risiko salah hitung.

### 7.3 Lembar Kerja 3: `UserPIC` (Akun Pengguna Universal — 10 Kolom Resmi)
| Kolom | Nama Kolom | Tipe Data | Contoh Isi | Penjelasan |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `ID User` | Teks | `USR-001` / `SEC-D660` | Kode identitas sistem |
| **B** | `Username` | Teks | `DSO LAMPUNG` / `D660` | Username login universal |
| **C** | `Password` | Teks Terisolasi | `daihatsu2026` | Kredensial autentikasi server |
| **D** | `Nama Lengkap` | Teks | `ADMIN HEAD / BRANCH MANAGER` | Nama tampilan pejabat/regu |
| **E** | `Cabang` | Teks | `Sentra Lampung` / `D660 - Ahmad Yani` | Wilayah wewenang kerja |
| **F** | `Jabatan` | Teks | `ADMIN HEAD / BRANCH MANAGER` / `SECURITY` | Peran operasional |
| **G** | `Target Email` | Teks | `email.resmi@cabang.daihatsu.co.id` | Email koordinasi cabang penerima laporan |
| **H** | `Foto Profil` | Tautan URL | `https://drive.google.com/...` | URL foto profil aktif di Drive |
| **I** | `Status` | Teks | `Active` | Status keaktifan akun |
| **J** | `Terakhir Login` | Waktu | `19/11/2026 08:15:20 WIB` | Stempel waktu login terakhir |

### 7.4 Lembar Kerja 4: `SystemConfig` (Konfigurasi Parameter Sistem & Durasi Perjalanan)
| Kolom | Nama Kolom | Tipe Data | Contoh Isi Data | Penjelasan |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `Parameter Key` | Teks Unik | `TRANSIT_TIME_D662` | Kunci parameter sistem |
| **B** | `Nilai / Value` | Teks / Angka | `90` | Nilai konfigurasi aktif |
| **C** | `Deskripsi` | Teks | `Estimasi durasi tempuh D662 (menit)` | Catatan fungsional parameter |

#### Daftar Kunci Parameter di `SystemConfig`:
* `TRANSIT_ROUTES_JSON`: Representasi string JSON dari matriks rute perjalanan dinamis point-to-point antar-cabang (`originCode`, `destinationCode`, `durationMinutes`, `label`).
* `DAILY_DIGEST_ENABLED`: `true` / `false` (Status aktifasi bot laporan otomatis jam 08:00 WIB).
* `DAILY_DIGEST_TIME`: `08:00` (Jadwal pengiriman laporan rekapitulasi harian).
* `TRANSIT_TIME_DEFAULT`: `90` (Estimasi durasi default antar cabang jika rute khusus belum diset - dalam menit).
* `TRANSIT_TIME_D660`: `45` (Estimasi durasi tempuh menuju Cabang Ahmad Yani - dalam menit).
* `TRANSIT_TIME_D661`: `30` (Estimasi durasi tempuh menuju Cabang Soekarno Hatta - dalam menit).
* `TRANSIT_TIME_D662`: `90` (Estimasi durasi tempuh menuju Cabang Bandar Jaya - dalam menit).
* `TRANSIT_TIME_D663`: `150` (Estimasi durasi tempuh menuju Cabang Lampung Utara - dalam menit).
* `TRANSIT_TIME_D664`: `180` (Estimasi durasi tempuh menuju Cabang Tulang Bawang - dalam menit).

### 7.5 Lembar Kerja 5: `ReportLogs` (Riwayat Pengiriman Laporan Harian)
| Kolom | Nama Kolom | Tipe Data | Contoh Isi Data | Penjelasan |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `ID Laporan` | Teks | `REP-20261119-080005` | Nomor transaksi pengiriman laporan |
| **B** | `Timestamp ISO` | ISO String | `2026-11-19T01:00:05.000Z` | Waktu eksekusi laporan |
| **C** | `Waktu Kirim` | Teks | `19/11/2026 08:00 WIB` | Jam pengiriman laporan resmi |
| **D** | `Periode Laporan` | Teks | `18/11/2026` | Tanggal mutasi yang direkap |
| **E** | `Target Email Penerima` | Teks | `email.resmi@cabang.daihatsu.co.id, ...` | Seluruh email yang menerima laporan |
| **F** | `Total Unit` | Angka | `13` | Total mutasi yang dilaporkan |
| **G** | `Unit Masuk` | Angka | `12` | Jumlah unit masuk |
| **H** | `Unit Keluar` | Angka | `1` | Jumlah unit keluar |
| **I** | `Lampiran Berkas` | Angka | `2` | Jumlah berkas (PDF & Excel) |
| **J** | `Status` | Teks | `SUCCESS` | Status pengiriman email Gmail API |
| **K** | `Keterangan` | Teks | `Laporan rekapitulasi mutasi berhasil dikirim` | Catatan eksekusi sistem |
| **L** | `Cabang Terkait` | Teks | `ALL` / `D660` | Sasaran cabang laporan |

---

## 8. Format Dokumen Laporan Resmi (PDF & Excel 100% Identik Berkop Astra Daihatsu)

Berkas laporan PDF dan Excel (.xlsx) dibuat dengan format kop surat dan struktur data yang **100% konsisten**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  [LOGO DAIHATSU]   PT ASTRA INTERNATIONAL Tbk — DAIHATSU SALES OPERATION               │
│  (Base64 Resmi)    Sentra Distribusi & Manajemen StockYard Area Lampung                │
│                    KODE FORM: ADM-YARD-BA-01 • Astra Daihatsu DSO Lampung               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ══════════════════════ [Garis Aksen: Merah 54% & Navy 46%] ═════════════════════════  │
│                                                                                        │
│               REPORT REKAPITULASI MUTASI HARIAN KENDARAAN (STOCKYARD)                  │
│                                                                                        │
│  [🏢 CABANG: D660 - AHMAD YANI]   [📅 PERIODE: 19/11/2026]   [🕒 CETAK: 08:00 WIB]    │
├────┬──────────┬───────┬─────────┬──────────┬────────┬──────────┬────────┬───────┬──────┤
│ No │ID Mutasi │ Waktu │ Tanggal │  Model   │ Cabang │No Rangka │No Mesin│ Rute /│Petugas│
│    │          │       │         │Kendaraan │        │  (VIN)   │        │ Mutasi│Secur. │
├────┼──────────┼───────┼─────────┼──────────┼────────┼──────────┼────────┼───────┼──────┤
│ 1  │MUT-001   │08:15  │19/11/26 │Rocky Hyb.│D660    │MHKP3...  │2NR...  │D660➔  │Sec D0│
│    │          │       │         │          │        │          │        │D662   │      │
├────┴──────────┴───────┴─────────┴──────────┴────────┴──────────┴────────┴───────┴──────┤
│ TOTAL REKAPITULASI MUTASI KENDARAAN: 1 Unit   |  MASUK: 1 Unit   |  KELUAR: 0 Unit     │
├────────────────────────────────────────────────────┬───────────────────────────────────┤
│           Petugas Pemeriksa & Pemindai:            │      Mengetahui & Menyetujui:     │
│                     SECURITY                       │ ADH / BM (ADMIN HEAD / BRANCH MGR)│
│                                                    │                                   │
│           ( Petugas Security On-Duty )             │   ( Admin Head / Branch Manager ) │
│        Reg. Security Guard • Astra Daihatsu        │     Astra Daihatsu DSO Lampung    │
└────────────────────────────────────────────────────┴───────────────────────────────────┘
```

### 13 Kolom Seragam Tabel PDF & Excel:
1. `No` — Nomor Urut
2. `ID Mutasi` — Nomor Registrasi Transaksi
3. `Waktu` — Jam Mutasi di Lapangan (WIB)
4. `Tanggal` — Tanggal Transaksi Mutasi
5. `Model Kendaraan` — Varian Resmi dari 13 Model Daihatsu
6. `Cabang` — Kode & Nama Cabang (D660 s/d D664)
7. `No. Rangka (VIN)` — 17 Digit Nomor Sasis (Font Monospace)
8. `No. Mesin` — Nomor Mesin Kendaraan
9. `Jenis Mutasi` — Lencana Hijau (`Unit Masuk`) atau Biru (`Unit Keluar / Rute Tujuan`)
10. `Petugas Security` — Identitas Petugas On-Duty Cabang
11. `Catatan` — Catatan Kondisi Fisik Lapangan
12. `Foto Fisik Unit` — Visual Gambar / Tautan Langsung Google Drive
13. `Foto Dokumen` — Visual Berkas Dokumen (SPPDC / BSTKB / OKK) / Tautan Langsung Google Drive

---

## 9. Katalog 13 Model Resmi Kendaraan Daihatsu

| No | Nama Model Kendaraan | Kategori Segmen | Karakteristik Penggunaan Lapangan |
| :-: | :--- | :--- | :--- |
| **1** | **All New Ayla** | Hatchback / LCGC | Area parkir *city car* / *compact yard* |
| **2** | **New Sigra** | MPV 7-Seater / LCGC | Unit volume tinggi, distribusi keluarga |
| **3** | **All New Xenia** | MPV Keluarga | Mobil keluarga multifungsi, perputaran unit tinggi |
| **4** | **New Terios** | Compact SUV | Unit petualang / medium ground clearance |
| **5** | **Terios Special Edition (SE)**| Compact SUV Khusus | Unit edisi terbatas dengan aksesoris khusus |
| **6** | **New Rocky** | Compact Crossover | Unit SUV turbo compact modern |
| **7** | **Rocky ADS** | Crossover Sporty | Edisi sporty paket bodi Astra Daihatsu Styling |
| **8** | **Rocky e-Smart Hybrid** | Crossover Elektrik/Hybrid | Penanganan khusus unit berteknologi baterai/hybrid |
| **9** | **New Sirion** | City Car Premium | Hatchback premium perkotaan |
| **10**| **Gran Max Pick Up** | Niaga Komersial Ringan | Armada angkutan barang terbuka, frekuensi mutasi tinggi |
| **11**| **Gran Max Blind Van** | Niaga Kargo Tertutup | Armada kargo tertutup untuk ekspedisi dan logistik |
| **12**| **Gran Max Minibus** | Niaga Penumpang / Travel | Armada angkutan penumpang umum / travel |
| **13**| **Daihatsu Luxio** | Minibus Eksekutif | Kendaraan komersial premium berkapasitas lega |

---

## 10. Alur Kerja Operasional Petugas Lapangan (SOP Ringkas < 15 Detik)

```mermaid
flowchart TD
    Start([Petugas Tiba di Depan Mobil]) --> OpenApp[Buka Aplikasi Management StockYard]
    OpenApp --> LoginUniversal[Login Akun Universal Cabang: D660 - D664]
    LoginUniversal --> ClickScan[Tekan Tombol FAB 'Scan Barcode Unit']
    ClickScan --> ChooseMode{Pilih Metode Scan}
    
    ChooseMode -->|Barcode Terbaca Jelas| ModeBarcode[Arahkan Kamera ke Barcode Kaca Depan]
    ChooseMode -->|Barcode Silau / Rusak| ModeOCR[Tekan 'Foto & Baca Teks Stiker' / Galeri]
    
    ModeBarcode --> CheckDupe{Pengecekan Otomatis Anti-Duplikat}
    ModeOCR --> CheckDupe
    
    CheckDupe -->|Unit Sudah Ada / Duplikat| Blocked[Layar Merah, Alarm Bunyi, Getar Panjang: Input Ditolak]
    Blocked --> FinishDuplicate([Pemeriksaan Selesai - Tidak Ada Data Ganda])
    
    CheckDupe -->|Unit Baru & Valid| Verified[Layar Hijau, Bip 1760Hz: Data Valid & Terverifikasi]
    Verified --> Step2[Klik 'Lanjut ke Formulir Mutasi']
    
    Step2 --> FillForm[Pilih Jenis: Unit Masuk/Keluar, Model, & Cabang Tujuan jika Keluar]
    FillForm --> SnapPhotos[Ambil Foto Fisik Mobil & Dokumen SPPDC/BSTKB/OKK]
    SnapPhotos --> Submit[Tekan 'Simpan & Verifikasi Mutasi']
    
    Submit --> CompressImg[Kompresi Otomatis di HP < 400 KB]
    CompressImg --> CloudSync[Tersimpan di HistoryMutasi 17 Kolom & Update Stok Inventory]
    CloudSync --> TriggerFlightBoard[Unit Keluar Otomatis Masuk Radar OKK In-Transit]
    CloudSync --> AutoReport[Otomatis Masuk Rekap Harian 08:00 WIB via PDF, Excel, & Tab ReportLogs]
    AutoReport --> Done([Selesai - Dashboard & Riwayat Terupdate])
```

---

## 11. Keamanan Sistem, Privasi Data, & Kepatuhan Korporat Astra International

1. **Pencegahan Kebocoran Kredensial (Zero Public Secrets)**:
   - Tidak ada berkas Google Apps Script (`.gs`) yang terbuka di repositori publik.
   - Variabel lingkungan rahasia (`APPSCRIPT_URL`, `API_SECRET_TOKEN`) dilindungi di balik reverse proxy Vercel (`/api/proxy`).
2. **Koneksi Terenkripsi Penuh (SSL/TLS 256-Bit)**:
   - Seluruh komunikasi dari perangkat smartphone/desktop lapangan ke cloud dijamin oleh protokol HTTPS.
3. **Pemisahan Hak Akses & Isolasi Data Cabang (Data Isolation)**:
   - Cabang D660 hingga D664 hanya dapat mengakses dan menerima data cabangnya sendiri.
   - Admin DSO Lampung memegang hak pengawasan menyeluruh terhadap 5 cabang.
4. **Manajemen Penyimpanan Google Drive Otomatis**:
   - Mengunggah foto profil baru memicu penghapusan foto profil lama secara otomatis untuk mencegah penumpukan sampah digital dan menjaga kuota penyimpanan cloud perusahaan.
5. **Proteksi Konkurensi & Mutex Atomik Server (Multi-Layer Concurrency Control)**:
   - **Client-Side Mutex Lock**: Saat tombol *Simpan & Verifikasi* ditekan, sistem langsung mengaktifkan kunci `_isSavingMutation = true`, menonaktifkan tombol (`disabled`, `pointer-events-none`), dan menampilkan animasi spinner untuk mencegah klik ganda (*anti-double submission*).
   - **Optimistic Deduplication**: Pengecekan riwayat lokal dalam selang waktu 20 detik untuk mencegah duplikasi entri di memori browser.
   - **Antrean Atomik Database Google Sheets**: Penulisan baris mutasi menggunakan `sheet.appendRow()` yang secara native mengantrekan request sehingga tidak ada baris yang tertimpa (*no row overwrite*).
   - **Server-Side Mutex Lock (`LockService.getScriptLock()`)**: Di tingkat backend Google Apps Script, proses perekaman mutasi dan pembaruan counter stok katalog (`updateInventoryStock`) diproteksi dengan kunci skrip atomik (antrean hingga 30 detik) guna menjamin konsistensi data mutlak tanpa *race condition* atau *lost update*.
   - **Validasi Siklus Logika Terakhir (*Last-State Validation*)**: Server memverifikasi status terakhir unit; jika ada dua request bersamaan untuk aksi yang sama pada unit yang sama, request kedua otomatis ditolak dengan pesan kesalahan yang jelas.

---

## 12. Lembar Pengesahan & Kontak Dukungan Resmi

Dokumen spesifikasi produk dan cetak biru arsitektur sistem ini merupakan panduan operasional dan teknis resmi bagi seluruh pemangku kepentingan Astra Daihatsu DSO Lampung:

* **Penanggung Jawab Sistem:** Tim Sistem Informasi & Manajemen StockYard Astra Daihatsu DSO Lampung  
* **Pusat Operasional:** Pool StockYard Sentra Lampung (Astra Daihatsu DSO Lampung)  
* **Cabang Terdaftar:** D660 (Ahmad Yani), D661 (Soekarno Hatta), D662 (Bandar Jaya), D663 (Lampung Utara), D664 (Tulang Bawang)  
* **Email Dukungan Resmi:** `admin.logistics@daihatsu.co.id`  
* **Status Dokumen:** Disetujui untuk Operasional Penuh (*Versi 2.27 PRO Enterprise Edition PWA v1.7.1 — Terverifikasi Penuh*)  
