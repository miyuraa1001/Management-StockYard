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
  APP_TITLE: 'Management StockYard',
  APP_SUBTITLE: 'Astra Daihatsu DSO Lampung',
  BRANCH_NAME: 'Astra Daihatsu DSO Lampung',
  OPERATOR_NAME: 'Andi Pratama',
  OPERATOR_NPK: '21040889',
  OPERATOR_NIP: '19870215201001123',
  OPERATOR_ROLE: 'Staff Operasional',
  OPERATOR_BRANCH: 'Sentra Lampung • Astra Daihatsu DSO Lampung',
  OPERATOR_PHOTO: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',

  // Mode Koneksi Backend: 'proxy' (Vercel Serverless Reverse Proxy)
  API_MODE: 'proxy',

  // Endpoint Vercel Serverless Reverse Proxy (Keamanan Zero-Leakage: Token dikelola murni di server Vercel)
  PROXY_ENDPOINT: '/api/proxy',

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
    DRIVE_FOLDER_ID: 'daihatsu_drive_folder_id',
    DIRECT_URL: 'daihatsu_direct_appscript_url'
  },

  /**
   * Endpoint aktif:
   * 1. Direct Mode: Jika pengguna menyimpan URL Web App Google Apps Script di Pengaturan/Modal
   * 2. Proxy Mode : Menggunakan Vercel Serverless Reverse Proxy (/api/proxy) via Vercel Environment Variables
   */
  getActiveEndpoint() {
    try {
      const directUrl = typeof localStorage !== 'undefined' ? (localStorage.getItem(this.CACHE_KEYS.DIRECT_URL) || '').trim() : '';
      if (directUrl && (directUrl.startsWith('https://script.google.com') || directUrl.startsWith('http'))) {
        return { 
          url: directUrl, 
          isProxy: false, 
          isConfigured: true, 
          mode: 'direct' 
        };
      }
    } catch (e) {}

    return { 
      url: this.PROXY_ENDPOINT, 
      isProxy: true, 
      isConfigured: true, 
      mode: 'proxy' 
    };
  }
};

// Export ke window untuk kemudahan akses modular di browser
window.CONFIG = CONFIG;
