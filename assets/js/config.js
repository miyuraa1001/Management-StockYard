/**
 * ============================================================================
 * Configuration Module - Daihatsu Vehicle Logistics Tracker
 * ============================================================================
 * Menampung konfigurasi aplikasi, endpoint API, dan opsi koneksi backend.
 * 
 * ARSITEKTUR KONEKSI DATABASE:
 * - Direct Mode: Browser menghubungi Google Apps Script Web App secara langsung (via safe CORS text/plain POST).
 * - Proxy Mode : Menggunakan Vercel Serverless Function '/api/proxy' jika di-deploy di Vercel.
 * - Auto Detect: Jika URL Web App tersimpan di LocalStorage atau diatur di tab Pengaturan,
 *   aplikasi langsung menghubungkan data ke Google Apps Script & Drive!
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

  // Mode Koneksi Backend: 'proxy' (Vercel Serverless Reverse Proxy)
  API_MODE: 'proxy',

  // Endpoint Vercel Serverless Reverse Proxy
  PROXY_ENDPOINT: '/api/proxy',

  // Autentikasi Secret API Token
  API_TOKEN: 'DSO-SALVAGE-SECRET-KEY-982143',
  DRIVE_FOLDER_ID: '1qQR4cxbBGB2DNi9mML9I3TZzKC6992A2',

  // Network Timeout & Realtime Polling Interval (milidetik)
  REQUEST_TIMEOUT: 20000,
  REALTIME_SYNC_INTERVAL: 15000,

  // LocalStorage Cache Key (v5 - Murni Realtime Database Tanpa Data Fiktif)
  CACHE_KEYS: {
    INVENTORY: 'daihatsu_inventory_cache_v5',
    HISTORY: 'daihatsu_history_cache_v5',
    KPI: 'daihatsu_kpi_cache_v5',
    PROFILE: 'daihatsu_profile_cache_v5',
    AUTOMATION: 'daihatsu_automation_cache_v5',
    API_TOKEN: 'daihatsu_api_secret_token',
    DRIVE_FOLDER_ID: 'daihatsu_drive_folder_id'
  },

  /**
   * Endpoint aktif:
   * Menggunakan Vercel Serverless Reverse Proxy (/api/proxy) via Vercel Environment Variables
   */
  getActiveEndpoint() {
    return { url: this.PROXY_ENDPOINT, isProxy: true, isConfigured: true };
  }
};

// Export ke window untuk kemudahan akses modular di browser
window.CONFIG = CONFIG;
