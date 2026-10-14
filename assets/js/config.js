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

  // Mode Koneksi Backend: 'auto' | 'direct' | 'proxy' | 'mock'
  API_MODE: 'auto',

  // Endpoint Vercel Serverless Reverse Proxy
  PROXY_ENDPOINT: '/api/proxy',

  // Fallback Direct URL Google Apps Script (Bisa diisi manual atau via UI Pengaturan)
  DIRECT_APPSCRIPT_URL: (typeof localStorage !== 'undefined' ? localStorage.getItem('daihatsu_appscript_url') : '') || '',

  // ID Folder Google Drive tempat foto unit & bukti dokumen disimpan
  DRIVE_FOLDER_ID: (typeof localStorage !== 'undefined' ? localStorage.getItem('daihatsu_drive_folder_id') : '') || '',

  // Secret Token untuk otentikasi (Opsional)
  API_TOKEN: (typeof localStorage !== 'undefined' ? localStorage.getItem('daihatsu_api_token') : '') || '',

  // Network Timeout (milidetik)
  REQUEST_TIMEOUT: 20000,

  // LocalStorage Cache Key (v4 - Data Bersih & Realtime)
  CACHE_KEYS: {
    INVENTORY: 'daihatsu_inventory_cache_v4',
    HISTORY: 'daihatsu_history_cache_v4',
    KPI: 'daihatsu_kpi_cache_v4',
    PROFILE: 'daihatsu_profile_cache_v4',
    AUTOMATION: 'daihatsu_automation_cache_v4',
    APPSCRIPT_URL: 'daihatsu_appscript_url',
    DRIVE_FOLDER_ID: 'daihatsu_drive_folder_id',
    API_TOKEN: 'daihatsu_api_token'
  },

  /**
   * Helper untuk menentukan endpoint aktif secara dinamis
   */
  getActiveEndpoint() {
    const savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem(this.CACHE_KEYS.APPSCRIPT_URL) : '';
    const directUrl = savedUrl || this.DIRECT_APPSCRIPT_URL;

    // 1. Jika pengguna sengaja memasukkan URL direct di Pengaturan aplikasi, prioritaskan direct URL tersebut
    if (directUrl && directUrl.trim().startsWith('http')) {
      return { url: directUrl.trim(), isProxy: false, isConfigured: true };
    }

    // 2. Jika diakses via file:/// lokal atau GitHub Pages murni (tanpa server proxy Vercel)
    const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.includes('github.io');
    const isLocalFile = typeof window !== 'undefined' && window.location.protocol === 'file:';
    if (isGitHubPages || isLocalFile) {
      return { url: '', isProxy: false, isConfigured: false, isOffline: true };
    }

    // 3. Default di Vercel / server hosting: Gunakan Vercel Serverless Proxy (/api/proxy)
    // Mode ini otomatis memanfaatkan APPSCRIPT_URL & API_SECRET_TOKEN dari Environment Variables Vercel!
    return { url: this.PROXY_ENDPOINT, isProxy: true, isConfigured: true };
  }
};

// Export ke window untuk kemudahan akses modular di browser
window.CONFIG = CONFIG;
