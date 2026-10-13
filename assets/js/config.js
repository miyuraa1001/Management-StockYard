/**
 * ============================================================================
 * Configuration Module - Daihatsu Vehicle Logistics Tracker
 * ============================================================================
 * Menampung konfigurasi aplikasi, endpoint API, dan opsi koneksi backend.
 * 
 * ARSITEKTUR KEAMANAN:
 * - Secara default, aplikasi menggunakan endpoint '/api/proxy' (Vercel Serverless).
 * - Dengan mode ini, URL Google Apps Script dan Secret Token tersimpan aman di 
 *   Environment Variables Vercel (tidak terekspos di browser / source code).
 */

const CONFIG = {
  // Informasi Cabang & Aplikasi
  APP_TITLE: 'Salvage',
  APP_SUBTITLE: 'Management Sentra Lampung',
  BRANCH_NAME: 'Astra Daihatsu DSO Lampung',
  OPERATOR_NAME: 'Andi Pratama',
  OPERATOR_NIP: '19870215201001123',

  // Mode Koneksi Backend:
  // 'proxy'  -> Menggunakan Vercel Serverless Function /api/proxy (SANGAT DIREKOMENDASIKAN untuk Vercel)
  // 'direct' -> Menghubungi Google Apps Script Web App langsung via browser
  // 'mock'   -> Mode offline/demo dengan data lokal
  API_MODE: 'proxy',

  // Endpoint Vercel Serverless Reverse Proxy
  PROXY_ENDPOINT: '/api/proxy',

  // Fallback Direct URL Google Apps Script (Hanya jika mode = 'direct' dan tidak lewat Vercel)
  // Catatan: Jika deploy di Vercel, kosongkan ini dan gunakan Vercel Environment Variables!
  DIRECT_APPSCRIPT_URL: '',

  // Secret Token untuk otentikasi (Hanya dipakai jika mode 'direct')
  API_TOKEN: '',

  // Network Timeout (milidetik)
  REQUEST_TIMEOUT: 15000,

  // LocalStorage Cache Key
  CACHE_KEYS: {
    INVENTORY: 'daihatsu_inventory_cache_v3',
    HISTORY: 'daihatsu_history_cache_v3',
    KPI: 'daihatsu_kpi_cache_v3'
  }
};

// Export ke window untuk kemudahan akses modular di browser
window.CONFIG = CONFIG;

