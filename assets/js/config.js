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
  // Informasi Cabang & Operator Lapangan
  APP_TITLE: 'Salvage',
  APP_SUBTITLE: 'Management Sentra Lampung',
  BRANCH_NAME: 'Astra Daihatsu DSO Lampung',
  OPERATOR_NAME: 'Andi Pratama',
  OPERATOR_NPK: '21040889',
  OPERATOR_NIP: '19870215201001123',
  OPERATOR_ROLE: 'Staff Operasional',
  OPERATOR_BRANCH: 'Sentra Lampung • Astra Daihatsu DSO Lampung',
  OPERATOR_PHOTO: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',

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

  // LocalStorage Cache Key (v4 - Data Bersih & Realtime)
  CACHE_KEYS: {
    INVENTORY: 'daihatsu_inventory_cache_v4',
    HISTORY: 'daihatsu_history_cache_v4',
    KPI: 'daihatsu_kpi_cache_v4',
    PROFILE: 'daihatsu_profile_cache_v4',
    AUTOMATION: 'daihatsu_automation_cache_v4'
  }
};

// Export ke window untuk kemudahan akses modular di browser
window.CONFIG = CONFIG;

