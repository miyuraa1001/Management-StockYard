# 🚗 Dokumen Spesifikasi Produk (PRD) & Panduan Sistem Lengkap
## Sistem Management StockYard Kendaraan (Astra Daihatsu DSO Lampung)

> **Klasifikasi:** Dokumen Resmi Spesifikasi Produk, Arsitektur Sistem, Katalog Fitur Menyeluruh & Operasional Bisnis  
> **Sasaran Pembaca:** Manajemen Astra Daihatsu, Kepala Wilayah (DSO Lampung), Admin Head / Branch Manager (ADH/BM), Supervisor Logistik, Tim Security On-Duty Cabang (D660–D664), & Tim Pengembang  
> **Status Dokumen:** Siap Operasional (*Production-Ready Enterprise Edition — Versi 2.10 Terverifikasi*)  
> **Cakupan Wilayah:** Sentra Distribusi & Manajemen StockYard Area Lampung (DSO Lampung & 5 Cabang Resmi: D660, D661, D662, D663, D664)  

---

## 1. Ringkasan Eksekutif (Executive Summary)

### 1.1 Latar Belakang & Tujuan Transformasi
Operasional pengelolaan, pengawasan, dan mutasi unit kendaraan di area pool logistik dan StockYard Astra Daihatsu DSO Lampung membutuhkan kecepatan pemrosesan tinggi, akurasi data mutlak, dan pencatatan fisik yang dapat dipertanggungjawabkan secara transparan (*audit-ready*). 

Sistem **Management StockYard (Astra Daihatsu DSO Lampung)** mentransformasi operasional konvensional berbasis kertas dan spreadsheet menjadi **ekosistem aplikasi web enterprise terpadu (Mobile & Desktop PWA)** yang terhubung secara realtime dengan infrastruktur Google Workspace (Google Sheets, Drive, Gmail API) melalui serverless reverse proxy Vercel berkeamanan tinggi.

### 1.2 Nilai Manfaat Utama bagi Manajemen & Operasional Cabang
* **Arsitektur Multi-Cabang Resmi (DSO Lampung & 5 Cabang D660–D664)**: Pengawasan sentral oleh Admin DSO Lampung sekaligus isolasi data (*data isolation*) untuk petugas Security cabang sesuai lokasi penugasan resmi.
* **Radar OKK & Logistics Flight Board Realtime (Opsi 2)**: Visualisasi status armada yang sedang bergerak (*In-Transit / OTW*) antar cabang, estimasi waktu tempuh (ETA), rute asal ➔ tujuan, serta durasi perjalanan live.
* **Penyederhanaan Form & Kecepatan Mutasi (< 15 Detik per Unit)**: Peniadaan input nama driver pihak ketiga menghilangkan antrean gerbang. Petugas cukup fokus memindai VIN, memilih cabang tujuan, dan memotret fisik serta dokumen (SPPDC/BSTKB/OKK).
* **Nol Risiko Data Ganda (*Zero Duplicate Entry*)**: Sistem memblokir pemindaian berulang untuk unit yang sama melalui alarm multi-sensor seketika di lapangan (audio 1760Hz, getaran haptik, dan kunci visual).
* **Keamanan Akses Tingkat Enterprise (Hardened Security Layer)**: Kredensial akun terlindungi penuh tanpa *hardcoded password* di browser. Dilengkapi proteksi anti *brute-force* (kunci akun 60 detik setelah 3 kali salah PIN/password).
* **Sinkronisasi Database 17 Kolom & Auto-Reconcile Stok**: Pencatatan mutasi lengkap 17 kolom (termasuk rute tujuan). Tab `Inventory` menggunakan formula presisi (Col D: Total Masuk, Col E: Total Keluar, Net Stock = Masuk - Keluar) dengan tombol rekonsiliasi otomatis 1-klik di Google Sheets.
* **Otomasi Laporan Harian Terjadwal Tepat Pukul 08:00 WIB**: Rekap mutasi 24 jam terakhir dalam format **PDF & Excel (.xlsx murni)** berkop resmi Astra Daihatsu dikompilasi dan dikirim otomatis ke email manajemen DSO serta dipartisi eksklusif ke masing-masing cabang.
* **Sinkronisasi Tab Cloud `ReportLogs` Realtime**: Setiap aktivitas pengiriman laporan harian (otomatis maupun manual via tombol "Kirim Laporan") tercatat ke tab `ReportLogs` dan tersinkronisasi 100% ke modal notifikasi aplikasi.

---

## 2. Perbandingan: Cara Kerja Konvensional vs. Sistem Baru (v2.10)

| Aspek Operasional | Cara Konvensional (Sebelumnya) | Menggunakan Sistem Management StockYard (v2.10) |
| :--- | :--- | :--- |
| **Pencatatan Nomor Rangka (VIN)** | Dicatat manual di kertas surat jalan atau diketik di Excel. Sering terjadi salah baca angka `0` dan huruf `O`, atau `1` dan `I`. | **Pemindaian Otomatis via Kamera Smartphone**. Dual-engine (Barcode + Tesseract OCR) mengekstrak 17 digit VIN dan nomor mesin dengan normalisasi ISO. |
| **Menghadapi Stiker Kaca Bertumpuk** | Petugas bingung karena stiker kaca Daihatsu memiliki 5-7 baris barcode bertumpuk (nomor DO, PO, suku cadang, VIN, mesin). | **Filter Cerdas Otomatis (`smartFilterBarcodes`)**. Kamera langsung mengunci VIN berawalan `MHK...` serta membuang kode pabrik yang tidak relevan. |
| **Pencatatan Sopir / Driver** | Mengetik nama supir pihak ketiga yang sering berganti dan memperlambat antrean gerbang pool. | **Disederhanakan (Bebas Input Driver)**. Sistem fokus pada verifikasi unit, rute cabang tujuan, dan bukti fisik dokumen serah terima. |
| **Pelacakan Mobil di Jalan (Antar Cabang)** | Mengandalkan telepon / WhatsApp manual untuk mengetahui apakah mobil sudah berangkat atau sampai di cabang tujuan. | **Radar OKK & Logistics Flight Board**. Kanban live menampilkan unit *In-Transit* lengkap dengan timer jalan, rute cabang, dan tombol konfirmasi tiba di tujuan. |
| **Pencegahan Unit Terinput Dua Kali** | Baru ketahuan saat ada selisih stok fisik bulanan (*stock opname*). | **Pencegahan Real-Time di Lapangan**. Jika unit sudah tercatat, aplikasi seketika mengunci layar merah, menyalakan alarm nada rendah, dan menolak penyimpanan. |
| **Keamanan Autentikasi Pengguna** | Password tersimpan pada kode aplikasi front-end, rentan dibongkar via DevTools / Inspect Element. | **Server-First Hardened Auth**. Verifikasi kredensial terisolasi ke Apps Script tanpa ekspos password, plus proteksi *brute-force lockout* 60 detik (3 salah coba). |
| **Sinkronisasi Stok di Database** | Total masuk dan keluar rentan salah hitung manual pada spreadsheet. | **Kalkulasi Matematis Presisi & Auto-Reconcile**. Col D (Total Masuk) dan Col E (Total Keluar) terpisah tegas. Tersedia menu 1-klik di Google Sheets untuk sinkronisasi ulang instan. |
| **Arsip Bukti Foto Fisik & Dokumen** | Foto tersimpan di galeri WhatsApp petugas lapangan, sering terhapus, buram, atau membebani memori ponsel. | **Terunggah Otomatis ke Google Drive Resmi**. Foto unit & dokumen (SPPDC / BSTKB / OKK) terhubung langsung dengan nomor rangka kendaraan dan dapat diakses dari laporan. |
| **Format Laporan Harian Eksekutif** | Format Excel dan PDF sering kali berbeda susunan kolom, tanpa logo resmi, dan tanpa foto visual. | **100% Identik Berlogo Daihatsu**: PDF dan Excel memiliki susunan kolom seragam, kop Astra resmi, rute tujuan, status terverifikasi, dan visual thumbnail tersemat rapi di sel. |
| **Distribusi Laporan Harian ke Cabang** | Satu file rekap dikirim massal; cabang melihat data unit cabang lain yang bukan wewenangnya. | **Distribusi Partisi Eksklusif**: Admin DSO menerima rekap 5 cabang (master), sedangkan tiap cabang (D660–D664) hanya menerima file mutasi eksklusif cabangnya. |

---

## 3. Struktur Organisasi Cabang & Hak Akses Berjenjang

Sistem menerapkan prinsip **Role-Based Access Control (RBAC)** terisolasi yang disesuaikan dengan hierarki operasional Astra Daihatsu Area Lampung:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             STRUKTUR HAK AKSES SISTEM MANAGEMENT STOCKYARD ASTRA DAIHATSU              │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│ 1. ADMIN HEAD / BRANCH MANAGER (ADH/BM)  │ • Pengawas sentral seluruh cabang           │
│    (Sentra Lampung • Astra Daihatsu DSO) │ • Akses penuh 5 cabang (D660 s/d D664)      │
│                                          │ • Akses Tab Sebaran Cabang & Radar OKK      │
│                                          │ • Melihat, memfilter, & ekspor seluruh data │
│                                          │ • Menerima email laporan master 5 cabang    │
├──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ 2. USER CABANG SECURITY (D660 s/d D664)  │ • D660 - Ahmad Yani                         │
│    (Petugas Security On-Duty per Cabang) │ • D661 - Soekarno Hatta                     │
│                                          │ • D662 - Bandar Jaya                        │
│                                          │ • D663 - Lampung Utara                      │
│                                          │ • D664 - Tulang Bawang                      │
│                                          │ • Terbatas HANYA pada data cabang sendiri   │
│                                          │ • Universal login tanpa NPK perorangan      │
│                                          │ • Menerima rekap email eksklusif cabangnya  │
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 4. Rincian Lengkap Seluruh Fitur Website

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                  PETA FITUR SISTEM MANAGEMENT STOCKYARD (v2.10)                  │
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
│                               │   timer durasi, ETA, konfirmasi unit tiba)       │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 4. RINCIAN MODEL (DRILL-DOWN) │ • Banner Spesifikasi Model, Filter Mutasi Model, │
│                               │   Filter Tanggal, Tabel Rincian Unit per Model   │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 5. RIWAYAT MUTASI & EKSPOR    │ • Log Mutasi 17 Kolom (Badge Rute Asal ➔ Tujuan),│
│                               │   Filter Kalender, Ekspor PDF & Excel Berfoto    │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 6. SCANNER CEPAT & FORM RINGKAS│ • Dual Engine (Barcode + OCR), Senter, Reticle, │
│                               │   Alarm Anti-Duplikat, Bebas Input Driver,       │
│                               │   Dropdown Cabang Tujuan, Foto Unit & Dokumen    │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 7. PUSAT NOTIFIKASI REAL-TIME │ • Indikator Live Sync, Ping Server, Tombol Kirim │
│                               │   Laporan, Sinkronisasi Cloud Tab ReportLogs     │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 8. PENGATURAN OTOMASI LAPORAN │ • Jam Analog "Jam Bulet", Frekuensi Kirim,       │
│                               │   Multi-Email Chips Manager (> 5 Email Tujuan)   │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 9. SECURITY & KEAMANAN AKUN   │ • Server-First Auth, Anti Brute-Force 60s Timer, │
│                               │   Edit Profil, Pembersihan Otomatis Foto Drive   │
├───────────────────────────────┼──────────────────────────────────────────────────┤
│ 10. LIGHTBOX & TOAST ALERT    │ • Penampil Foto Resolusi Penuh, Zoom & Unduh,    │
│                               │   Floating Toast Notifications (Sukses/Error)    │
└───────────────────────────────┴──────────────────────────────────────────────────┘
```

### 4.1 Navigasi Global, Header, & Gestur Mobile
1. **Lencana Status Pool Aktif (*Yard Badge*)**:
   - Menampilkan identitas cabang penugasan resmi: `D660 - Ahmad Yani` hingga `Sentra Lampung • Astra Daihatsu DSO Lampung`.
2. **Pill Role Switcher Interaktif**:
   - Menampilkan status akun saat ini (`Admin (Semua)` warna biru safir atau `User D66X` warna kuning amber).
   - Mengetuk tombol ini membuka modal autentikasi cepat untuk berpindah akun operasional secara aman.
3. **Indikator Lonceng Notifikasi & Pulse Dot**:
   - Ikon lonceng di bagian atas dengan titik merah berdenyut (*pulse dot*) yang menyala otomatis jika terdapat mutasi baru atau update status laporan.
4. **Profil Petugas di Header**:
   - Menampilkan foto avatar petugas yang tersinkronisasi dari Google Drive, nama petugas, dan jabatan resmi (`ADMIN HEAD / BRANCH MANAGER` atau `SECURITY`).
5. **Navigasi Tab Utama (Desktop & Mobile)**:
   - **Desktop Bar**: Tab navigasi atas untuk berpindah seketika antara **Dashboard**, **Inventaris**, **Riwayat**, dan **Pengaturan**.
   - **Mobile Bottom Navigation**: Bilah navigasi melayang ergonomis di bagian bawah layar smartphone.
6. **Tombol FAB Scan Melayang**:
   - Tombol bulat besar dengan animasi berpendar (*glowing pulse*) di bagian tengah bilah navigasi bawah untuk memicu kamera pemindai dari menu mana saja.
7. **Gestur Tarik Layar ke Bawah (*Pull-to-Refresh*)**:
   - Tarik layar dari atas ke bawah untuk menyegarkan dan mengambil data mutasi terbaru langsung dari Google Spreadsheet.

### 4.2 Dashboard Bersih & Ergonomis
1. **Hero Banner Ringkasan**: Menampilkan status operasional hari ini, jumlah mutasi masuk/keluar, dan status sinkronisasi cloud.
2. **Filter Cepat 1-Tap**: Tombol segmentasi instan: *Hari Ini*, *7 Hari Terakhir*, *30 Hari Terakhir*, dan *Semua Waktu*, memudahkan pengawasan berkala tanpa membuka kalender kompleks.
3. **Diagram Donat Distribusi Model & Interactive Preview Card**: Diagram donat visual komposisi armada yang terhubung langsung dengan kartu preview model interaktif (menampilkan foto resmi mobil, tipe varian, total unit, dan status stok).
4. **Feed Aktivitas Mutasi Terkini (Live Feed)**: Menampilkan 5 transaksi mutasi mutakhir secara realtime dengan badge status masuk/keluar, rute asal ➔ tujuan, nomor VIN, model, dan waktu pencatatan.

### 4.3 Manajemen Inventaris & Radar OKK Logistik (Flight Board)
1. **Dua Mode Tampilan**:
   - **Tab Katalog 13 Model**: Menampilkan seluruh jajaran model Daihatsu lengkap dengan rincian stok masuk, keluar, dan unit tersedia di pool.
   - **Tab Sebaran Cabang & Radar OKK**: Menampilkan ringkasan unit fisik di 5 cabang resmi serta **Kanban Radar OKK In-Transit** (khusus pengawasan admin DSO).
2. **Fitur Radar OKK / Logistics Flight Board**:
   - Kartu unit yang sedang bergerak (*OTW*) antar cabang.
   - Timer durasi perjalanan live yang menghitung menit dan jam sejak unit keluar.
   - Indikator rute asal ke cabang tujuan (`D660 ➔ D662`).
   - Tombol 1-klik untuk konfirmasi penerimaan unit di cabang tujuan saat unit telah tiba.
3. **Header Statistik Kategori**: Ringkasan armada keluarga/LCGC, SUV/Crossover, dan armada niaga komersial.
4. **Halaman Khusus Rincian Model (*Drill-Down*)**: Banner spesifikasi kendaraan, kartu ringkasan stok model, filter tanggal khusus tipe tersebut, dan tabel unit terdaftar.

### 4.4 Riwayat Mutasi & Ekspor Laporan Komprehensif
1. **Tabel Log Mutasi Terintegrasi**: Catatan kronologis mutasi dengan rincian: Waktu, ID Transaksi, VIN, Nomor Mesin, Model Mobil, Tipe Mutasi, Petugas Security, Cabang Asal, **Cabang Tujuan (Badge Rute)**, Jenis Dokumen (SPPDC / BSTKB / OKK), Foto Fisik Unit, Foto Dokumen, dan Catatan Lapangan.
2. **Filter Rentang Kalender & Pencarian Global**: Menyesuaikan audit harian, mingguan, bulanan, serta pencarian instan nomor rangka, nomor mesin, atau model.
3. **Empat Metode Ekspor Resmi**:
   - **Ekspor PDF Berkop Resmi**: Dokumen PDF landscape berlogo Daihatsu, format kode form `ADM-YARD-BA-01`, tabel seragam, kolom rute tujuan, dan 2 pengesahan tanda tangan resmi: `SECURITY` dan `ADH / BM`.
   - **Ekspor Excel (.xlsx Murni) Berfoto**: Dihasilkan via `ExcelJS` langsung di browser, menyematkan visual foto unit & dokumen ke dalam sel tabel secara proporsional, border rapi, badge rute tujuan, dan tanda tangan resmi.
   - **Cetak Langsung (*Print-Ready*)**: Tata letak ramah cetak A4 tanpa elemen UI browser.
   - **Email Rekapitulasi Terjadwal & On-Demand (Backend v2.23)**: Pengiriman otomatis pukul 08:00 WIB dan manual via tombol "Kirim Laporan" dengan lampiran PDF & Excel yang dipartisi eksklusif per cabang.

### 4.5 Pemindai Kamera Cepat & Formulir Ringkas
* **Tahap 1: Viewport Kamera & Deteksi Cerdas**:
  - Bingkai laser 4 sudut dengan sakelar mode: Barcode Otomatis, OCR Teks Stiker, dan Unggah Foto dari Galeri.
  - Penyaring cerdas multi-barcode (`smartFilterBarcodes`): otomatis mengunci VIN 17 digit `MHK...` dan nomor mesin.
  - Alarm anti-duplikat multi-sensori: Jika unit terdaftar, layar menyala **MERAH**, alarm nada rendah berbunyi, ponsel bergetar panjang, dan tombol lanjut diblokir. Jika valid, layar menyala **HIJAU**, bunyi bip 1760Hz, dan tombol lanjut aktif.
* **Tahap 2: Formulir Serah Terima Mutasi Unit (Bebas Input Driver)**:
  - Banner identitas nomor sasis dan mesin terkunci otomatis.
  - Pilihan radio: **Unit Masuk** atau **Unit Keluar**.
  - Dropdown 13 Model Resmi Kendaraan Daihatsu.
  - Dropdown Cabang Asal (Otomatis terkunci ke cabang penugasan petugas).
  - Dropdown Cabang Tujuan (Aktif saat scan Unit Keluar untuk memicu Radar OKK).
  - Dropdown Dokumen Resmi: **SPPDC**, **BSTKB**, atau **OKK**.
  - Dua slot foto wajib: Foto Fisik Mobil dan Foto Dokumen (SPPDC / BSTKB / OKK).
  - Kolom catatan kondisi lapangan & tombol simpan berindikator kompresi gambar.

### 4.6 Keamanan Autentikasi & Proteksi Brute-Force
* **Server-First Credential Verification**: Password diverifikasi langsung ke Google Apps Script tanpa pernah mengekspos kata sandi di sisi browser.
* **Sistem Kunci Otomatis Anti Brute-Force**: Jika terjadi 3 kali kesalahan login berturut-turut, sistem mengunci form login selama 60 detik dengan visual timer countdown live.
* **Akun Universal Cabang Bebas NPK**: Petugas tidak dibebani input NPK, cukup memilih cabang dan memasukkan PIN/password regu security on-duty.
* **Penggantian Foto Profil & Otomasi Google Drive**:
  - Mengunggah foto profil baru langsung menyimpan file ke Google Drive perusahaan.
  - Sistem secara cerdas menghapus foto lama dari Google Drive saat foto baru berhasil tersimpan (*Drive storage optimization*).

---

## 5. Arsitektur Tiga Lapis (Frontend, Backend, & Database)

```mermaid
flowchart TD
    subgraph Frontend["1. LAPISAN TAMPILAN (FRONTEND CLIENT - MOBILE & DESKTOP PWA)"]
        UI["Antarmuka Modern (Tailwind CSS, Glassmorphism)"]
        FlightBoard["Radar OKK & Logistics Flight Board (Live In-Transit Kanban)"]
        Scanner["Dual Scanner Engine (Native BarcodeDetector + Tesseract.js OCR)"]
        Compress["Kompresor Foto Otomatis di Browser (< 400 KB)"]
        Sensor["Proteksi Anti-Duplikat (Lampu Merah/Hijau, Audio 1760Hz, Haptik)"]
        ClientExport["Pembuat Laporan PDF & Excel Client-Side (jsPDF & ExcelJS)"]
        AuthShield["Pelindung Login (Server-First Auth & 60s Brute-Force Lockout)"]
    end

    subgraph Backend["2. LAPISAN PENGOLAH & PENGAMAN (BACKEND SERVERLESS)"]
        Proxy["Gerbang Aman Vercel (/api/proxy Reverse Proxy)"]
        Secret["Proteksi Kredensial (Token Rahasia X-API-SECRET)"]
        GAS["Mesin Google Apps Script (Backend v2.23)"]
        Reconcile["Engine Auto-Reconcile Stok Inventory"]
        Cron["Robot Penjadwal Otomatis (Time-driven Trigger Jam 08:00 WIB)"]
        Partition["Mesin Partisi Laporan Eksklusif per Cabang (D660 - D664)"]
    end

    subgraph Database["3. LAPISAN BASIS DATA & PENYIMPANAN (GOOGLE SPREADSHEET & DRIVE)"]
        Sheet1[("Sheet: HistoryMutasi\n(17 Kolom Resmi Termasuk Rute Tujuan)")]
        Sheet2[("Sheet: Inventory\n(6 Kolom Presisi: Masuk, Keluar, Stok)")]
        Sheet3[("Sheet: UserPIC\n(10 Kolom Akun & Target Email Cabang)")]
        Sheet4[("Sheet: SystemConfig\n(Konfigurasi Jadwal & Email)")]
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
    UI --> AuthShield
```

---

## 6. Spesifikasi Lengkap Basis Data (Google Sheets & Drive)

### 6.1 Lembar Kerja 1: `HistoryMutasi` (Buku Besar Rekam Jejak — 17 Kolom Resmi)
| Kolom | Nama Kolom Spreadsheet | Tipe Data | Contoh Isi Data | Penjelasan Fungsi Data |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `ID Mutasi` | Teks Unik | `MUT-20261119-083015` | Nomor urut kode transaksi mutasi |
| **B** | `Timestamp ISO` | ISO String | `2026-11-19T01:30:15.000Z` | Stempel waktu standar sistem |
| **C** | `Tanggal` | Tanggal | `19/11/2026` | Tanggal mutasi di lapangan |
| **D** | `Jam` | Waktu | `08:30 WIB` | Jam serah terima unit di pool |
| **E** | `Model` | Teks Pilihan | `Rocky e-Smart Hybrid` | Varian model dari 13 katalog Daihatsu |
| **F** | `Warna` | Teks | `Putih Mutiara` | Warna kendaraan (opsional) |
| **G** | `No. Rangka (VIN)` | Teks (17 Digit) | `MHKP3FA1JTK137533` | Nomor rangka resmi (Kunci Utama) |
| **H** | `No. Mesin` | Teks | `2NR4F82393` | Nomor mesin kendaraan |
| **I** | `Jenis Mutasi` | Teks | `Unit Masuk` / `Unit Keluar` | Jenis pergerakan kendaraan |
| **J** | `Nama Petugas` | Teks | `Budi Santoso` | Nama lengkap petugas security bertugas |
| **K** | `Jabatan PIC` | Teks | `SECURITY` / `ADH/BM` | Peran pengguna yang mencatat |
| **L** | `Cabang Asal` | Teks | `D660 - Ahmad Yani` | Cabang lokasi pencatatan mutasi |
| **M** | `Catatan` | Teks Catatan | `Kondisi mulus, spion lengkap` | Catatan kondisi fisik unit |
| **N** | `Jenis Dokumen` | Teks | `SPPDC` / `BSTKB` / `OKK` | Jenis dokumen serah terima resmi |
| **O** | `Foto Unit` | Tautan URL Drive | `https://drive.google.com/file/d/...` | Foto fisik unit kendaraan |
| **P** | `Foto Dokumen` | Tautan URL Drive | `https://drive.google.com/file/d/...` | Foto fisik dokumen surat jalan |
| **Q** | `Cabang Tujuan` | Teks | `D662 - Bandar Jaya` | Cabang destinasi mutasi keluar (Radar OKK) |

### 6.2 Lembar Kerja 2: `Inventory` (Status Stok per Model — 6 Kolom Presisi)
| Kolom | Nama Kolom | Tipe Data | Contoh Isi Data | Penjelasan |
| :---: | :--- | :--- | :--- | :--- |
| **A** | `ID Model` | Teks | `INV-001` | Kode model kendaraan katalog |
| **B** | `Nama Model Kendaraan` | Teks | `Rocky e-Smart Hybrid` | Nama varian resmi kendaraan Daihatsu |
| **C** | `Kategori` | Teks | `Smart Hybrid SUV` | Segmen pasar armada |
| **D** | `Total Masuk` | Angka | `1` | Akumulasi total unit masuk yang pernah dicatat |
| **E** | `Total Keluar` | Angka | `0` | Akumulasi total unit keluar yang pernah dicatat |
| **F** | `URL Foto` | Teks URL | `https://...` / `assets/images/...` | Gambar visual resmi katalog model |

> [!IMPORTANT]
> **Formula Perhitungan Stok Fisik (Net Stock):**  
> $\text{Stok Tersedia di Yard} = \text{Total Masuk (Col D)} - \text{Total Keluar (Col E)}$  
> Sistem dilengkapi fitur **Auto-Reconcile 1-Klik**: Melalui menu Google Sheets **`🚗 Daihatsu Stockyard` ➔ `🔄 Sinkronisasi / Rebuild Stok Inventory`**, sistem secara otomatis menghitung ulang seluruh baris di `HistoryMutasi` dan menuliskan angka mutlak ke Kolom D dan E tanpa risiko salah hitung.

### 6.3 Lembar Kerja 3: `UserPIC` (Akun Pengguna Universal — 10 Kolom Resmi)
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

### 6.4 Lembar Kerja 4: `ReportLogs` (Riwayat Pengiriman Laporan Harian)
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
| **K** | `Keterangan` | Teks | `Laporan rekapitulasi mutasi berhasil...` | Catatan eksekusi sistem |
| **L** | `Cabang Terkait` | Teks | `ALL` / `D660` | Sasaran cabang laporan |

---

## 7. Format Dokumen Laporan Resmi (PDF & Excel 100% Identik)

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

---

## 8. Alur Kerja Operasional Petugas Lapangan (SOP Ringkas)

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

## 9. Pengesahan & Kontak Dukungan Layanan

Dokumen spesifikasi produk dan cetak biru sistem ini merupakan panduan operasional dan teknis resmi bagi seluruh pemangku kepentingan Astra Daihatsu DSO Lampung:

* **Penanggung Jawab Sistem:** Tim Sistem Informasi & Manajemen StockYard Astra Daihatsu DSO Lampung  
* **Pusat Operasional:** Pool StockYard Sentra Lampung (Astra Daihatsu DSO Lampung)  
* **Cabang Terdaftar:** D660 (Ahmad Yani), D661 (Soekarno Hatta), D662 (Bandar Jaya), D663 (Lampung Utara), D664 (Tulang Bawang)  
* **Email Dukungan Resmi:** `admin.logistics@daihatsu.co.id`  
* **Status Dokumen:** Disetujui untuk Operasional Penuh (*Versi 2.10 Enterprise Edition — Terverifikasi*)  
