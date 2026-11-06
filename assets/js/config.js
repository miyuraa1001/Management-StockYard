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
  BRANCH_NAME: 'Sentra Lampung • Astra Daihatsu DSO Lampung',

  // 5 Cabang Resmi Operasional Stockyard Astra Daihatsu Lampung (D660 s/d D664)
  BRANCH_LIST: [
    { code: 'D660', name: 'Ahmad Yani', label: 'D660 - Ahmad Yani' },
    { code: 'D661', name: 'Soekarno Hatta', label: 'D661 - Soekarno Hatta' },
    { code: 'D662', name: 'Bandar Jaya', label: 'D662 - Bandar Jaya' },
    { code: 'D663', name: 'Lampung Utara', label: 'D663 - Lampung Utara' },
    { code: 'D664', name: 'Lampung Timur', label: 'D664 - Lampung Timur' }
  ],

  // 6 Akun Resmi Sesuai Database Google Spreadsheet Tab UserPIC
  USER_ACCOUNTS: [
    {
      id: 'USR-001',
      username: 'DSO LAMPUNG',
      name: 'ADMIN HEAD / BRANCH MANAGER',
      branch: 'Sentra Lampung • Astra Daihatsu DSO Lampung',
      branchCode: 'ALL',
      role: 'ADMIN HEAD / BRANCH MANAGER',
      systemRole: 'Admin',
      password: 'daihatsu2026',
      email: 'syafirafira08162@gmail.com, nabila38148@gmail.com, andikaintan4@gmail.com, nabilatria044@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: 'USR-002',
      username: 'D660',
      name: 'SECURITY - D660',
      branch: 'D660 - Ahmad Yani',
      branchCode: 'D660',
      role: 'SECURITY',
      systemRole: 'User',
      password: 'daihatsu2026',
      email: 'syafirafira08162@gmail.com, nabila38148@gmail.com, andikaintan4@gmail.com, nabilatria044@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: 'USR-003',
      username: 'D661',
      name: 'SECURITY - D661',
      branch: 'D661 - Soekarno Hatta',
      branchCode: 'D661',
      role: 'SECURITY',
      systemRole: 'User',
      password: 'daihatsu2026',
      email: 'syafirafira08162@gmail.com, nabila38148@gmail.com, andikaintan4@gmail.com, nabilatria044@gmail.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: 'USR-004',
      username: 'D662',
      name: 'SECURITY - D662',
      branch: 'D662 - Bandar Jaya',
      branchCode: 'D662',
      role: 'SECURITY',
      systemRole: 'User',
      password: 'daihatsu2026',
      email: '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: 'USR-005',
      username: 'D663',
      name: 'SECURITY - D663',
      branch: 'D663 - Lampung Utara',
      branchCode: 'D663',
      role: 'SECURITY',
      systemRole: 'User',
      password: 'daihatsu2026',
      email: '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: 'USR-006',
      username: 'D664',
      name: 'SECURITY - D664',
      branch: 'D664 - Lampung Timur',
      branchCode: 'D664',
      role: 'SECURITY',
      systemRole: 'User',
      password: 'daihatsu2026',
      email: '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'
    }
  ],

  /**
   * Memformat kode BA menjadi nama cabang lengkap (misal: "D660" -> "D660 - Ahmad Yani")
   */
  formatBranch(ba) {
    if (!ba) return 'Sentra Lampung • Astra Daihatsu DSO Lampung';
    const s = String(ba).trim();
    // 1. Cek kode resmi D660 s/d D664
    const matchCode = s.match(/D66[0-4]/i);
    if (matchCode) {
      const code = matchCode[0].toUpperCase();
      const match = this.BRANCH_LIST.find(b => b.code === code);
      if (match) return match.label;
    }
    // 2. Cek nama spesifik cabang
    const lower = s.toLowerCase();
    if (lower.includes('ahmad yani') || lower.includes('yani')) return 'D660 - Ahmad Yani';
    if (lower.includes('soekarno') || lower.includes('hatta')) return 'D661 - Soekarno Hatta';
    if (lower.includes('bandar jaya') || lower.includes('jaya')) return 'D662 - Bandar Jaya';
    if (lower.includes('lampung utara') || lower.includes('kotabumi')) return 'D663 - Lampung Utara';
    if (lower.includes('lampung timur')) return 'D664 - Lampung Timur';
    if (lower.includes('sentra') || lower.includes('dso')) return 'Sentra Lampung • Astra Daihatsu DSO Lampung';
    // 3. Default resmi jika nama umum entitas ('Astra Daihatsu DSO Lampung')
    return 'Sentra Lampung • Astra Daihatsu DSO Lampung';
  },

  OPERATOR_NAME: 'ADMIN HEAD / BRANCH MANAGER',
  OPERATOR_ROLE: 'Admin',
  OPERATOR_BRANCH: 'Sentra Lampung • Astra Daihatsu DSO Lampung',
  OPERATOR_USERNAME: 'DSO LAMPUNG',
  OPERATOR_PHOTO: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',

  // Mode Koneksi Backend: 'proxy' (Vercel Serverless Reverse Proxy)
  API_MODE: 'proxy',

  // Endpoint Vercel Serverless Reverse Proxy (Keamanan Zero-Leakage: Token dikelola murni di server Vercel)
  PROXY_ENDPOINT: '/api/proxy',

  // Network Timeout & Realtime Polling Interval (milidetik)
  REQUEST_TIMEOUT: 20000,
  REALTIME_SYNC_INTERVAL: 15000,

  // LocalStorage Cache Key (v9 - Sinkronisasi Riil UserPIC & Target Email Per-Cabang)
  CACHE_KEYS: {
    AUTH_SESSION: 'daihatsu_auth_session_v9',
    INVENTORY: 'daihatsu_inventory_cache_v8',
    HISTORY: 'daihatsu_history_cache_v8',
    KPI: 'daihatsu_kpi_cache_v8',
    PROFILE: 'daihatsu_profile_cache_v9',
    AUTOMATION: 'daihatsu_automation_cache_v9',
    BRANCH_EMAILS: 'daihatsu_branch_emails_v9',
    REPORT_LOGS: 'daihatsu_report_logs_v9',
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
