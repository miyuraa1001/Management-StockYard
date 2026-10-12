# 🚗 Salvage (Management Salvage Sentra Lampung)

Sistem manajemen unit salvage Astra Daihatsu DSO Lampung berbasis web mobile & desktop dengan optical barcode scanner (ZXing) dan database real-time Google Spreadsheet.

---

## 📁 Struktur Proyek (Standar IT Profesional)

```text
Management Salvage/
├── api/
│   └── proxy.js             # Vercel Serverless Function (Reverse Proxy aman)
├── assets/
│   ├── css/
│   │   └── styles.css       # Stylesheet terpisah (Animasi laser, responsive UI)
│   └── js/
│       ├── config.js        # Konfigurasi aplikasi & routing API
│       ├── state.js         # Single source of truth (State management & local storage cache)
│       ├── api.js           # API Service komunikasi ke backend
│       ├── scanner.js       # Kontrol scanner ZXing, kamera, senter, audio beep, haptic
│       ├── ui.js            # Renderer UI (Dashboard, Inventory, Riwayat, Modals, Toast)
│       └── app.js           # Entrypoint / Orchestrator utama aplikasi
├── index.html               # Semantic HTML bersih tanpa inline script/style berantakan
├── vercel.json              # Konfigurasi routing, cache, dan security headers Vercel
├── .gitignore               # Proteksi keamanan repository
└── README.md                # Dokumentasi arsitektur sistem
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
Input variabel langsung di dashboard Vercel (**Settings** > **Environment Variables**):
- `APPSCRIPT_URL` : Isi dengan URL Web App Apps Script Anda.
- `API_SECRET_TOKEN` : Isi dengan kode rahasia pilihan pribadi Anda.

> **Jaminan Keamanan:** Tidak ada file `.env`, kode backend, URL Spreadsheet, maupun secret token yang tersimpan di dalam repository GitHub. Seluruh kredensial hanya diproses di server Vercel.
