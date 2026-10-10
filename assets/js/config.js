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
  // Informasi Cabang & Unit
  BRANCH_NAME: 'Daihatsu Ahmad Yani',
  BRANCH_ADDRESS: 'Jl. Ahmad Yani No. 88, Surabaya',
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
    INVENTORY: 'daihatsu_inventory_cache',
    HISTORY: 'daihatsu_history_cache',
    KPI: 'daihatsu_kpi_cache'
  }
};

// Export ke window untuk kemudahan akses modular di browser
window.CONFIG = CONFIG;

