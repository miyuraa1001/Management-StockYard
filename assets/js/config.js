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

  // Network Timeout (milidetik)
  REQUEST_TIMEOUT: 20000,

  // LocalStorage Cache Key (v4 - Data Bersih & Realtime)
  CACHE_KEYS: {
    INVENTORY: 'daihatsu_inventory_cache_v4',
    HISTORY: 'daihatsu_history_cache_v4',
    KPI: 'daihatsu_kpi_cache_v4',
    PROFILE: 'daihatsu_profile_cache_v4',
    AUTOMATION: 'daihatsu_automation_cache_v4'
  },

  /**
   * Endpoint aktif menggunakan Vercel Serverless Proxy (/api/proxy)
   * Menyambungkan ke Google Apps Script via Environment Variables Vercel
   */
  getActiveEndpoint() {
    return { url: this.PROXY_ENDPOINT, isProxy: true, isConfigured: true };
  }
};

// Export ke window untuk kemudahan akses modular di browser
window.CONFIG = CONFIG;
