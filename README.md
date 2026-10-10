# 🚗 Daihatsu Vehicle Logistics Tracker - Sentra Monitoring

Sistem pelacakan mutasi dan logistik unit kendaraan Daihatsu berbasis web mobile dengan optical barcode scanner (ZXing) dan database real-time Google Spreadsheet.

---

## 📁 Struktur Proyek (Standar IT Profesional)

```text
Management Salvage/
├── api/
│   └── proxy.js             # Vercel Serverless Function (Reverse Proxy: Menyembunyikan URL & Token GAS)
├── assets/
│   ├── css/
│   │   └── styles.css       # Stylesheet terpisah (Animasi laser, glassmorphism, responsive UI)
│   └── js/
│       ├── config.js        # Konfigurasi aplikasi & routing API
│       ├── state.js         # Single source of truth (State management & local storage cache)
│       ├── api.js           # API Service komunikasi ke backend (Proxy / Direct / Offline)
│       ├── scanner.js       # Kontrol scanner ZXing, kamera, senter, audio beep, haptic
│       ├── ui.js            # Renderer UI (Dashboard, Inventory, Riwayat, Modals, Toast)
│       └── app.js           # Entrypoint / Orchestrator utama aplikasi
├── index.html               # Semantic HTML bersih tanpa inline script/style berantakan
├── vercel.json              # Konfigurasi routing, cache, dan security headers Vercel
├── .env.example             # Template variabel environment untuk Vercel
├── .gitignore               # Proteksi rahasia (mencegah file .env & kode backend ter-commit)
└── README.md                # Dokumentasi instalasi dan arsitektur sistem
```

---

## 🚀 Panduan Deployment ke Vercel

### 1. Push ke Git Repository
Proyek sudah terstruktur rapi. Commit dan push ke repository GitHub:
```bash
git add .
git commit -m "Refactor: modular professional architecture & vercel setup"
git push origin main
```

### 2. Hubungkan Proyek ke Vercel
1. Buka [Vercel Dashboard](https://vercel.com/dashboard) -> Klik **"Add New..."** -> **"Project"**.
2. Pilih repository GitHub ini.
3. Di bagian **Build and Output Settings**, biarkan default (Framework: *Other*).

### 3. Konfigurasi Environment Variables di Vercel
Pada halaman project settings Vercel (*Settings* > *Environment Variables*), tambahkan dua variabel rahasia:
| Key | Value | Keterangan |
| :--- | :--- | :--- |
| `APPSCRIPT_URL` | `https://script.google.com/macros/s/AKfycb.../exec` | URL Web App Google Apps Script Anda |
| `API_SECRET_TOKEN` | *Kode rahasia pilihan Anda* (contoh: `dht_sec_99a8b7c6d5e4f3a2b1c0`) | Token otentikasi API |

> **Catatan Keamanan:** Dengan arsitektur ini, URL Google Apps Script dan Token otentikasi hanya berjalan di server Vercel (`api/proxy.js`) dan **tidak akan pernah bocor** ke browser pengunjung atau ter-commit di GitHub!

