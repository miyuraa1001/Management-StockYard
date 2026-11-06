/**
 * ============================================================================
 * State Management Module - Daihatsu Vehicle Logistics Tracker
 * ============================================================================
 * Menyimpan dan mengelola single source of truth untuk seluruh data aplikasi.
 */

const AppState = {
  // Navigation & View
  currentTab: 'dashboard',
  inventoryFilter: 'all',
  historyTabFilter: 'all',

  // Optical Hardware & Scanner
  cameraStream: null,
  codeReader: null,
  isScanningActive: false,
  facingMode: 'environment',
  isTorchOn: false,

  // Dual Image Upload Cache & Document Type
  uploadedUnitPhotoUrl: null,
  uploadedDocPhotoUrl: null,
  selectedDocType: 'SPPDC',

  // Network & Sync Indicators
  isLoading: false,
  isOnline: navigator.onLine,

  // Status Autentikasi & Sesi Enterprise Login
  isAuthenticated: false,
  authSession: null,

  // Profil Petugas Operator & Otomatisasi Sesuai Sheet UserPIC (Kolom F: Jabatan)
  userProfile: {
    id: 'USR-001',
    username: CONFIG.OPERATOR_USERNAME || 'DSO LAMPUNG',
    name: CONFIG.OPERATOR_NAME || 'ADMIN HEAD / BRANCH MANAGER',
    branch: CONFIG.OPERATOR_BRANCH || 'Sentra Lampung • Astra Daihatsu DSO Lampung',
    role: CONFIG.OPERATOR_ROLE || 'Admin',
    position: 'ADMIN HEAD / BRANCH MANAGER',
    photo: CONFIG.OPERATOR_PHOTO || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'
  },

  // Target Email Per-Cabang (Sesuai Tab UserPIC Kolom G di Google Sheets)
  branchEmails: {
    'DSO LAMPUNG': 'syafirafira08162@gmail.com, nabila38148@gmail.com, andikaintan4@gmail.com, nabilatria044@gmail.com',
    'D660': 'syafirafira08162@gmail.com, nabila38148@gmail.com, andikaintan4@gmail.com, nabilatria044@gmail.com',
    'D661': 'syafirafira08162@gmail.com, nabila38148@gmail.com, andikaintan4@gmail.com, nabilatria044@gmail.com',
    'D662': '',
    'D663': '',
    'D664': ''
  },

  /**
   * Mengambil daftar email target untuk cabang tertentu secara akurat
   * (Tidak pernah fallback ke email cabang lain jika cabang tersebut belum memiliki target email di database)
   */
  getBranchTargetEmails(branchKey) {
    if (!branchKey) {
      branchKey = this.isAdmin() ? 'DSO LAMPUNG' : this.getUserBranchCode();
    }
    const cleanKey = String(branchKey).trim();
    const m = cleanKey.match(/D66[0-4]/i);
    const key = m ? m[0].toUpperCase() : (cleanKey.toUpperCase().includes('DSO') || cleanKey.toUpperCase().includes('SENTRA') ? 'DSO LAMPUNG' : cleanKey);
    
    // Ambil khusus data email cabang terkait
    const raw = this.branchEmails[key];
    if (raw && typeof raw === 'string' && raw.trim()) {
      const parsed = raw.split(/[,;\n\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
      if (parsed.length > 0) return parsed;
    }

    // Jika ini adalah DSO LAMPUNG / ALL (Admin), boleh fallback ke automationConfig
    if (key === 'DSO LAMPUNG' || key === 'ALL') {
      const autoRaw = this.automationConfig?.email || '';
      return String(autoRaw).split(/[,;\n\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    }

    // Cabang yang belum didaftarkan emailnya di database (misal D662, D663, D664) mengembalikan array kosong []
    return [];
  },

  /**
   * Menyimpan daftar target email untuk cabang tertentu
   */
  setBranchTargetEmails(branchKey, emailList) {
    const cleanKey = String(branchKey).trim();
    const m = cleanKey.match(/D66[0-4]/i);
    const key = m ? m[0].toUpperCase() : (cleanKey.toUpperCase().includes('DSO') || cleanKey.toUpperCase().includes('SENTRA') ? 'DSO LAMPUNG' : cleanKey);
    const str = Array.isArray(emailList) ? emailList.join(', ') : String(emailList || '');
    this.branchEmails[key] = str;
    if (key === 'DSO LAMPUNG' || key === 'ALL') {
      this.automationConfig.email = str;
      this.automationConfig.emails = Array.isArray(emailList) ? emailList : str.split(/[,;\n\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    }
    this.saveToCache();
  },

  /**
   * Cek apakah role petugas saat ini adalah Admin (akses semua cabang)
   */
  isAdmin() {
    const u = String(this.userProfile?.username || '').trim().toUpperCase();
    if (u && (u.startsWith('D66') || u.match(/^D66[0-4]/))) {
      return false;
    }
    if (u.includes('DSO')) {
      return true;
    }
    const r = String(this.userProfile?.role || this.userProfile?.systemRole || CONFIG.OPERATOR_ROLE || 'Admin').trim().toLowerCase();
    return r === 'admin' || r.includes('administrator') || r.includes('head') || r.includes('manager');
  },

  /**
   * Dapatkan nama cabang resmi penugasan user saat ini
   */
  getUserBranch() {
    const b = this.userProfile?.branch || CONFIG.OPERATOR_BRANCH || 'Sentra Lampung • Astra Daihatsu DSO Lampung';
    if (typeof CONFIG !== 'undefined' && typeof CONFIG.formatBranch === 'function') {
      return CONFIG.formatBranch(b);
    }
    return b;
  },

  /**
   * Dapatkan kode cabang resmi (D660 s/d D664 atau ALL untuk DSO Lampung)
   */
  getUserBranchCode() {
    const b = this.getUserBranch();
    const match = b.match(/D66[0-4]/i);
    if (match) return match[0].toUpperCase();
    if (b.toLowerCase().includes('sentra') || b.toLowerCase().includes('dso')) return 'ALL';
    return 'D660';
  },
  automationConfig: {
    schedule: 'Setiap Hari 08:00 WIB',
    email: 'syafirafira08162@gmail.com, nabila38148@gmail.com, andikaintan4@gmail.com, nabilatria044@gmail.com',
    type: 'Daily Digest PDF Rekap Mutasi Unit Masuk & Keluar',
    enabled: true
  },

  // Riwayat Pengiriman Notifikasi Laporan Email (Tersinkronisasi Nyata)
  emailNotificationLogs: [],
  reportLogs: [],

  // KPI Metrics (Mulai dari 0 - Dihitung Realtime dari Riwayat & Stok)
  kpi: {
    masuk: 0,
    keluar: 0,
    totalStok: 0,
    stokKosong: 0
  },

  // Master Katalog 13 Model Kendaraan Daihatsu (Sesuai 100% dengan Database Spreadsheet Inventory)
  vehicleCatalog: [
    {
      catalogId: 'CAT-01',
      model: 'Rocky e-Smart Hybrid',
      category: 'Smart Hybrid SUV',
      spec: '1.2L WA-VEX e-Smart Hybrid',
      defaultLocation: 'Yard A - Blok 1 (Hybrid)',
      photo: 'assets/images/Inventory_Rocky e-Smart Hybrid.jpeg',
      heroPhoto: 'assets/images/hero-rocky-hybrid.jpg'
    },
    {
      catalogId: 'CAT-02',
      model: 'Gran Max Pick Up',
      category: 'Niaga & Logistik Tangguh',
      spec: '1.5L 2NR-VE Heavy Duty Deck',
      defaultLocation: 'Yard D - Blok 3 (Niaga)',
      photo: 'assets/images/Inventory_Gran Max Pick Up.jpeg',
      heroPhoto: 'assets/images/hero-granmax-pickup.jpg'
    },
    {
      catalogId: 'CAT-03',
      model: 'New Terios',
      category: '7-Seater Adventure SUV',
      spec: '1.5L 2NR-VE Dual VVT-i',
      defaultLocation: 'Yard A - Blok 2 (SUV)',
      photo: 'assets/images/Inventory_New Terios.jpeg',
      heroPhoto: 'assets/images/hero-new-terios.jpg'
    },
    {
      catalogId: 'CAT-04',
      model: 'New Sigra',
      category: 'LCGC 7-Seater Family MPV',
      spec: '1.2L 3NR-VE Dual VVT-i',
      defaultLocation: 'Yard B - Blok 2 (MPV)',
      photo: 'assets/images/Inventory_New Sigra.jpeg',
      heroPhoto: 'assets/images/hero-new-sigra.jpg'
    },
    {
      catalogId: 'CAT-05',
      model: 'All New Xenia',
      category: 'The Next Level MPV',
      spec: '1.5L 2NR-VE D-CVT FWD',
      defaultLocation: 'Yard B - Blok 1 (MPV)',
      photo: 'assets/images/Inventory_All New Xenia.jpeg',
      heroPhoto: 'assets/images/hero-all-new-xenia.jpg'
    },
    {
      catalogId: 'CAT-06',
      model: 'All New Ayla',
      category: 'Compact Hatchback Urban',
      spec: '1.2L WA-VE D-CVT',
      defaultLocation: 'Yard C - Blok 1 (Hatchback)',
      photo: 'assets/images/Inventory_All New Ayla.jpeg',
      heroPhoto: 'assets/images/hero-all-new-ayla.jpg'
    },
    {
      catalogId: 'CAT-07',
      model: 'New Rocky',
      category: 'Compact Turbo SUV',
      spec: '1.0L 1KR-VET Turbocharged',
      defaultLocation: 'Yard A - Blok 3 (SUV)',
      photo: 'assets/images/Inventory_New Rocky.jpeg',
      heroPhoto: 'assets/images/hero-new-rocky.jpg'
    },
    {
      catalogId: 'CAT-08',
      model: 'Sirion',
      category: 'Stylish City Car',
      spec: '1.3L 1NR-VE Dual VVT-i D-CVT',
      defaultLocation: 'Yard C - Blok 2 (City Car)',
      photo: 'assets/images/Inventory_New Sirion.jpeg',
      heroPhoto: 'assets/images/hero-new-sirion.jpg'
    },
    {
      catalogId: 'CAT-09',
      model: 'Luxio',
      category: 'Spacious Elegant Van',
      spec: '1.5L 3SZ-VE DOHC VVT-i',
      defaultLocation: 'Yard D - Blok 1 (Commercial)',
      photo: 'assets/images/Inventory_Luxio.jpeg',
      heroPhoto: 'assets/images/hero-luxio.jpg'
    },
    {
      catalogId: 'CAT-10',
      model: 'Rocky',
      category: 'Compact SUV',
      spec: '1.2L WA-VE ADS Styling',
      defaultLocation: 'Yard A - Blok 3 (SUV)',
      photo: 'assets/images/Inventory_Rocky.jpeg',
      heroPhoto: 'assets/images/hero-rocky.jpg'
    },
    {
      catalogId: 'CAT-11',
      model: 'Gran Max Minibus',
      category: 'Family & Commercial Transport',
      spec: '1.5L 2NR-VE / 1.3L DOHC',
      defaultLocation: 'Yard D - Blok 2 (Commercial)',
      photo: 'assets/images/Inventory_Gran Max Minibus.jpeg',
      heroPhoto: 'assets/images/hero-granmax-minibus.jpg'
    },
    {
      catalogId: 'CAT-12',
      model: 'Terios Special Edition',
      category: 'Limited Edition Sport SUV',
      spec: '1.5L 2NR-VE Special Edition',
      defaultLocation: 'Yard A - Blok 2 (SUV)',
      photo: 'assets/images/Inventory_Terios SE.jpeg',
      heroPhoto: 'assets/images/hero-terios-se.jpg'
    },
    {
      catalogId: 'CAT-13',
      model: 'New Sigra (Prod Old)',
      category: 'LCGC 7-Seater MPV',
      spec: '1.2L 3NR-VE MT/AT',
      defaultLocation: 'Yard B - Blok 3 (MPV)',
      photo: 'assets/images/Inventory_New Sigra (Prod Old).jpeg',
      heroPhoto: 'assets/images/hero-sigra-old.jpg'
    }
  ],

  // Helper untuk mencari foto katalog resmi berdasarkan nama model
  getModelCatalogItem(modelName) {
    if (!modelName) return this.vehicleCatalog[0];
    const clean = modelName.toLowerCase().trim();
    // 1. Exact match
    let found = this.vehicleCatalog.find(c => c.model.toLowerCase() === clean);
    if (found) return found;
    // 2. Disambiguations & Aliases
    if (clean.includes('hybrid')) return this.vehicleCatalog[0];
    if (clean.includes('minibus') || clean.includes('blind van')) return this.vehicleCatalog[10];
    if (clean.includes('pick') || clean.includes('pu') || clean.includes('pickup')) return this.vehicleCatalog[1];
    if (clean.includes('special edition') || clean.includes('terios se') || clean.includes('da3se')) return this.vehicleCatalog[11];
    if (clean.includes('terios')) return this.vehicleCatalog[2];
    if (clean.includes('xenia')) return this.vehicleCatalog[4];
    if (clean.includes('old') || clean.includes('prod old') || clean.includes('salvage')) return this.vehicleCatalog[12];
    if (clean.includes('sigra')) return this.vehicleCatalog[3];
    if (clean.includes('ayla')) return this.vehicleCatalog[5];
    if (clean.includes('new rocky') || clean.includes('turbo')) return this.vehicleCatalog[6];
    if (clean.includes('rocky')) return this.vehicleCatalog[9];
    if (clean.includes('sirion')) return this.vehicleCatalog[7];
    if (clean.includes('luxio')) return this.vehicleCatalog[8];
    if (clean.includes('gran max') || clean.includes('granmax')) return this.vehicleCatalog[1];
    return this.vehicleCatalog[0];
  },

  // Dataset Inventory Unit Fisik Kendaraan (Mulai dari Kosong / Sesuai Realtime Scan Lapangan)
  inventoryData: [],

  // Log Mutasi & Riwayat Audit Fisik (Mulai dari Kosong / Sesuai Realtime Scan Lapangan)
  historyData: [],

  /**
   * Mengambil status mutasi terakhir dari nomor VIN / Mesin tertentu
   * Mengembalikan objek { type, date, time, model, pic, vin, engine } atau null jika belum pernah tercatat
   */
  getUnitCurrentStatus(vin, engine) {
    const cleanVin = String(vin || '').trim().toUpperCase();
    const cleanEngine = String(engine || '').trim().toUpperCase();
    if (!cleanVin && !cleanEngine) return null;

    // 1. Cek di historyData (riwayat mutasi audit terurut dari terbaru ke terlama)
    const matches = (this.historyData || []).filter(item => {
      const v = String(item.vin || '').trim().toUpperCase();
      const eng = String(item.engine || '').trim().toUpperCase();
      const vinMatch = cleanVin && v && v === cleanVin;
      const engMatch = cleanEngine && eng && eng === cleanEngine;
      return vinMatch || engMatch;
    });

    if (matches.length > 0) {
      const latest = matches[0];
      const typeStr = String(latest.type || '').trim();
      const isMasuk = typeStr.toLowerCase().includes('masuk') || typeStr.toLowerCase() === 'in';
      return {
        type: isMasuk ? 'Unit Masuk' : 'Unit Keluar',
        rawType: typeStr,
        date: latest.fullDateStr || (latest.date ? `${latest.date}/${latest.month || ''}/${latest.year || ''}` : ''),
        time: latest.time || '',
        model: latest.model || '',
        pic: latest.pic || '',
        vin: latest.vin || cleanVin,
        engine: latest.engine || cleanEngine
      };
    }

    // 2. Fallback: Cek di inventoryData fisik yang sedang aktif di yard
    const invItem = (this.inventoryData || []).find(item => {
      const v = String(item.vin || '').trim().toUpperCase();
      const eng = String(item.engine || '').trim().toUpperCase();
      const vinMatch = cleanVin && v && v === cleanVin;
      const engMatch = cleanEngine && eng && eng === cleanEngine;
      return vinMatch || engMatch;
    });

    if (invItem) {
      const isKeluar = invItem.status === 'Keluar' || String(invItem.status || '').toLowerCase().includes('keluar');
      return {
        type: isKeluar ? 'Unit Keluar' : 'Unit Masuk',
        rawType: invItem.status || 'Unit Masuk',
        date: invItem.date || '',
        time: invItem.time || '',
        model: invItem.model || '',
        pic: invItem.pic || '',
        vin: invItem.vin || cleanVin,
        engine: invItem.engine || cleanEngine
      };
    }

    return null;
  },

  /**
   * Memeriksa apakah unit dengan nomor VIN / Mesin ini sedang berada di dalam Stockyard (Status aktif: Unit Masuk)
   */
  isUnitCurrentlyInYard(vin, engine) {
    const status = this.getUnitCurrentStatus(vin, engine);
    if (!status) return false;
    return status.type === 'Unit Masuk' || String(status.rawType || '').toLowerCase().includes('masuk') || String(status.rawType || '').toLowerCase() === 'in';
  },

  /**
   * Helper pemeriksaan duplikat: bernilai true HANYA jika unit saat ini masih berstatus Unit Masuk di yard
   */
  isVinDuplicate(vin, engine) {
    return this.isUnitCurrentlyInYard(vin, engine);
  },

  // Inisialisasi Cache dari LocalStorage jika ada
  loadFromCache() {
    try {
      // Bersihkan seluruh cache lama (v1 s/d v5) yang mungkin berisi data dummy/mock
      ['v1', 'v2', 'v3', 'v4', 'v5'].forEach(v => {
        ['inventory', 'history', 'kpi', 'profile', 'automation'].forEach(k => {
          localStorage.removeItem(`daihatsu_${k}_cache_${v}`);
        });
      });

      const cachedInv = localStorage.getItem(CONFIG.CACHE_KEYS.INVENTORY);
      const cachedHist = localStorage.getItem(CONFIG.CACHE_KEYS.HISTORY);
      const cachedKpi = localStorage.getItem(CONFIG.CACHE_KEYS.KPI);

      if (cachedInv) {
        const parsedInv = JSON.parse(cachedInv);
        if (Array.isArray(parsedInv)) {
          this.inventoryData = parsedInv;
        }
      }
      if (cachedHist) {
        const parsedHist = JSON.parse(cachedHist);
        if (Array.isArray(parsedHist)) {
          this.historyData = parsedHist;
        }
      }
      if (cachedKpi) {
        this.kpi = JSON.parse(cachedKpi);
      } else {
        this.updateKpiCounts();
      }

      // 1. Baca cache profil umum jika ada
      const cachedProfile = localStorage.getItem(CONFIG.CACHE_KEYS.PROFILE);
      if (cachedProfile) {
        try {
          const parsedProfile = JSON.parse(cachedProfile);
          if (parsedProfile && typeof parsedProfile === 'object') {
            this.userProfile = Object.assign({}, this.userProfile, parsedProfile);
          }
        } catch (e) {}
      }

      // 2. Baca sesi autentikasi enterprise aktif (PRIORITAS TERTINGGI: Sesi login aktif mengesampingkan profil umum)
      const cachedAuth = localStorage.getItem(CONFIG.CACHE_KEYS.AUTH_SESSION);
      if (cachedAuth) {
        try {
          const parsedAuth = JSON.parse(cachedAuth);
          if (parsedAuth && parsedAuth.user && parsedAuth.user.username) {
            this.isAuthenticated = true;
            this.authSession = parsedAuth;
            this.userProfile = Object.assign({}, this.userProfile, parsedAuth.user);
          }
        } catch (e) {}
      }

      // 3. Normalisasi Sesuai Database Tab UserPIC (Kolom F: Jabatan & Kolom D: Nama)
      if (this.userProfile) {
        if (this.userProfile.name) {
          this.userProfile.name = String(this.userProfile.name).replace(/DISTRICT/gi, 'BRANCH');
        }
        const uName = String(this.userProfile.username || '').trim().toUpperCase();
        const isBranch = uName.startsWith('D66') || !!uName.match(/^D66[0-4]/);
        if (isBranch) {
          this.userProfile.role = 'User';
          this.userProfile.position = 'SECURITY';
        } else {
          const isAdm = this.isAdmin() || uName.includes('DSO');
          if (isAdm) {
            this.userProfile.role = 'Admin';
            this.userProfile.position = 'ADMIN HEAD / BRANCH MANAGER';
          }
        }
        if (this.userProfile.position) {
          this.userProfile.position = String(this.userProfile.position).replace(/DISTRICT/gi, 'BRANCH');
        }
      }

      const cachedAutomation = localStorage.getItem(CONFIG.CACHE_KEYS.AUTOMATION);
      if (cachedAutomation) {
        this.automationConfig = Object.assign({}, this.automationConfig, JSON.parse(cachedAutomation));
      }

      const cachedBranchEmails = localStorage.getItem(CONFIG.CACHE_KEYS.BRANCH_EMAILS);
      if (cachedBranchEmails) {
        this.branchEmails = Object.assign({}, this.branchEmails, JSON.parse(cachedBranchEmails));
      }

      // Bersihkan email fiktif lama jika tersimpan di cache lokal untuk cabang D662, D663, D664
      ['D662', 'D663', 'D664'].forEach(bCode => {
        if (this.branchEmails[bCode] && this.branchEmails[bCode].includes('syafirafira08162')) {
          this.branchEmails[bCode] = '';
        }
      });

      const cachedReportLogs = localStorage.getItem(CONFIG.CACHE_KEYS.REPORT_LOGS || 'daihatsu_report_logs_v8');
      if (cachedReportLogs) {
        try {
          const parsedReports = JSON.parse(cachedReportLogs);
          if (Array.isArray(parsedReports)) {
            this.reportLogs = parsedReports;
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[AppState] Gagal membaca cache local storage:', e);
    }
  },

  /**
   * Menetapkan sesi autentikasi pengguna enterprise aktif
   */
  setAuthSession(user, remember = true) {
    if (!user) return;
    this.isAuthenticated = true;
    this.userProfile = Object.assign({}, this.userProfile, user);

    const uName = String(this.userProfile.username || '').trim().toUpperCase();
    const isBranch = uName.startsWith('D66') || !!uName.match(/^D66[0-4]/);

    if (isBranch) {
      this.userProfile.role = 'User';
      this.userProfile.position = 'SECURITY';
    } else {
      this.userProfile.role = 'Admin';
      this.userProfile.position = 'ADMIN HEAD / BRANCH MANAGER';
    }

    if (this.userProfile.name) {
      this.userProfile.name = String(this.userProfile.name).replace(/DISTRICT/gi, 'BRANCH');
    }
    if (this.userProfile.position) {
      this.userProfile.position = String(this.userProfile.position).replace(/DISTRICT/gi, 'BRANCH');
    }

    this.authSession = {
      user: Object.assign({}, this.userProfile),
      loginTime: new Date().toISOString()
    };
    if (remember) {
      try {
        localStorage.setItem(CONFIG.CACHE_KEYS.AUTH_SESSION, JSON.stringify(this.authSession));
      } catch (e) {}
    }
    this.saveToCache();
  },

  /**
   * Menghapus sesi autentikasi (Logout Petugas)
   */
  clearAuthSession() {
    this.isAuthenticated = false;
    this.authSession = null;
    try {
      localStorage.removeItem(CONFIG.CACHE_KEYS.AUTH_SESSION);
      localStorage.removeItem(CONFIG.CACHE_KEYS.PROFILE);
    } catch (e) {}

    // Kembalikan profil ke default aman
    this.userProfile = {
      id: 'USR-001',
      username: CONFIG.OPERATOR_USERNAME || 'DSO LAMPUNG',
      name: CONFIG.OPERATOR_NAME || 'ADMIN HEAD / BRANCH MANAGER',
      branch: CONFIG.OPERATOR_BRANCH || 'Sentra Lampung • Astra Daihatsu DSO Lampung',
      role: CONFIG.OPERATOR_ROLE || 'Admin',
      position: 'ADMIN HEAD / BRANCH MANAGER',
      photo: CONFIG.OPERATOR_PHOTO || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'
    };
  },

  // Simpan State ke LocalStorage
  saveToCache() {
    try {
      localStorage.setItem(CONFIG.CACHE_KEYS.INVENTORY, JSON.stringify(this.inventoryData));
      localStorage.setItem(CONFIG.CACHE_KEYS.HISTORY, JSON.stringify(this.historyData));
      localStorage.setItem(CONFIG.CACHE_KEYS.KPI, JSON.stringify(this.kpi));
      localStorage.setItem(CONFIG.CACHE_KEYS.PROFILE, JSON.stringify(this.userProfile));
      localStorage.setItem(CONFIG.CACHE_KEYS.AUTOMATION, JSON.stringify(this.automationConfig));
      localStorage.setItem(CONFIG.CACHE_KEYS.BRANCH_EMAILS, JSON.stringify(this.branchEmails));
      if (Array.isArray(this.reportLogs)) {
        localStorage.setItem(CONFIG.CACHE_KEYS.REPORT_LOGS || 'daihatsu_report_logs_v8', JSON.stringify(this.reportLogs));
      }
    } catch (e) {
      console.warn('[AppState] Gagal menyimpan ke cache local storage:', e);
    }
  },

  // Update KPI secara dinamis 100% Realtime dari Database & Scan Lapangan (Tanpa Data Fiktif)
  // Mendukung Role Admin (Semua Cabang) & User Cabang (Khusus Cabang Saja)
  updateKpiCounts() {
    let masukCount = 0;
    let keluarCount = 0;
    
    const isUserRole = !this.isAdmin();
    const userBranchCode = this.getUserBranchCode();

    const targetHistory = isUserRole
      ? (this.historyData || []).filter(item => {
          const ba = (item.noBa || item.branch || item.location || '').toUpperCase();
          return ba.includes(userBranchCode);
        })
      : (this.historyData || []);

    const targetInventory = isUserRole
      ? (this.inventoryData || []).filter(item => {
          const ba = (item.noBa || item.branch || item.location || '').toUpperCase();
          return ba.includes(userBranchCode);
        })
      : (this.inventoryData || []);

    targetHistory.forEach(item => {
      if (item && item.type === 'Unit Masuk') masukCount++;
      if (item && item.type === 'Unit Keluar') keluarCount++;
    });

    const catalog = this.vehicleCatalog || [];
    let totalStokCount = 0;
    let kosongCount = 0;

    catalog.forEach(cat => {
      const units = targetInventory.filter(u => {
        if (!u) return false;
        const uModel = String(u.model || u.name || '').toLowerCase();
        if (uModel === cat.model.toLowerCase()) return true;
        const matched = this.getModelCatalogItem ? this.getModelCatalogItem(uModel) : null;
        return matched && matched.catalogId === cat.catalogId;
      });

      const sheetYardStock = units.reduce((acc, u) => acc + (parseInt(u.stockYard, 10) || 0), 0);
      const unitInYard = units.filter(u => typeof u.stockYard !== 'number' && (u.status === 'In-Yard' || u.status === 'Tersedia' || !u.status)).length;

      const matchingHistory = targetHistory.filter(h => {
        if (!h || !h.model) return false;
        const hModel = String(h.model || '').toLowerCase();
        if (hModel === cat.model.toLowerCase()) return true;
        const matched = this.getModelCatalogItem ? this.getModelCatalogItem(hModel) : null;
        return matched && matched.catalogId === cat.catalogId;
      });

      const histMasuk = matchingHistory.filter(h => h.type === 'Unit Masuk').length;
      const histKeluar = matchingHistory.filter(h => h.type === 'Unit Keluar').length;
      const netFromHistory = Math.max(0, histMasuk - histKeluar);
      const modelStock = netFromHistory;

      totalStokCount += modelStock;
      if (modelStock === 0) {
        kosongCount++;
      }
    });

    if (totalStokCount === 0 && (masukCount - keluarCount) > 0) {
      totalStokCount = Math.max(0, masukCount - keluarCount);
    }

    this.kpi.masuk = masukCount;
    this.kpi.keluar = keluarCount;
    this.kpi.totalStok = totalStokCount;
    this.kpi.stokKosong = kosongCount;
    this.kpi.inYard = totalStokCount; // Compatibility alias

    this.saveToCache();
  }
};

// Export ke window
window.AppState = AppState;

