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

  // Dual Image Upload Cache
  uploadedUnitPhotoUrl: null,
  uploadedDocPhotoUrl: null,

  // Network & Sync Indicators
  isLoading: false,
  isOnline: navigator.onLine,

  // Profil Petugas Operator & Otomatisasi
  userProfile: {
    name: CONFIG.OPERATOR_NAME || 'Andi Pratama',
    npk: CONFIG.OPERATOR_NPK || '21040889',
    branch: CONFIG.OPERATOR_BRANCH || 'Sentra Lampung • Astra Daihatsu DSO Lampung',
    role: CONFIG.OPERATOR_ROLE || 'Staff Operasional',
    photo: CONFIG.OPERATOR_PHOTO || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80'
  },
  automationConfig: {
    schedule: 'Setiap Hari 08:00 WIB',
    email: 'syafirafira08162@gmail.com',
    type: 'Daily Digest PDF Rekap Mutasi Unit Masuk & Keluar'
  },

  // KPI Metrics (Mulai dari 0 - Dihitung Realtime dari Riwayat & Stok)
  kpi: {
    masuk: 0,
    keluar: 0,
    intransit: 0
  },

  // Master Katalog 13 Model Kendaraan Daihatsu (Tetap tampil meski stok 0 / kosong)
  vehicleCatalog: [
    {
      catalogId: 'CAT-01',
      model: 'Rocky e-Smart Hybrid',
      category: 'Smart Hybrid SUV',
      spec: '1.2L WA-VEX e-Smart Hybrid',
      defaultLocation: 'Yard A - Blok 1 (Hybrid)',
      photo: 'assets/images/Inventory_Rocky e-Smart Hybrid.jpeg',
      heroPhoto: 'assets/images/hero-rocky-hybrid.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-02',
      model: 'New Terios',
      category: '7-Seater Adventure SUV',
      spec: '1.5L 2NR-VE Dual VVT-i',
      defaultLocation: 'Yard A - Blok 2 (SUV)',
      photo: 'assets/images/Inventory_New Terios.jpeg',
      heroPhoto: 'assets/images/hero-new-terios.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-03',
      model: 'Terios SE',
      category: 'Limited Sporty Edition SUV',
      spec: '1.5L 2NR-VE Special Edition',
      defaultLocation: 'Yard A - Blok 2 (SUV)',
      photo: 'assets/images/Inventory_Terios SE.jpeg',
      heroPhoto: 'assets/images/hero-terios-se.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-04',
      model: 'All New Xenia',
      category: 'Executive Family MPV',
      spec: '1.5L 2NR-VE D-CVT FWD',
      defaultLocation: 'Yard B - Blok 1 (MPV)',
      photo: 'assets/images/Inventory_All New Xenia.jpeg',
      heroPhoto: 'assets/images/hero-all-new-xenia.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-05',
      model: 'New Sigra',
      category: 'LCGC 7-Seater Family MPV',
      spec: '1.2L 3NR-VE Dual VVT-i',
      defaultLocation: 'Yard B - Blok 2 (MPV)',
      photo: 'assets/images/Inventory_New Sigra.jpeg',
      heroPhoto: 'assets/images/hero-new-sigra.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-06',
      model: 'New Sigra (Prod Old)',
      category: 'Reliable Value MPV',
      spec: '1.2L 3NR-VE MT/AT',
      defaultLocation: 'Yard B - Blok 3 (MPV)',
      photo: 'assets/images/Inventory_New Sigra (Prod Old).jpeg',
      heroPhoto: 'assets/images/hero-sigra-old.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-07',
      model: 'All New Ayla',
      category: 'Dynamic City Hatchback',
      spec: '1.2L WA-VE D-CVT',
      defaultLocation: 'Yard C - Blok 1 (Hatchback)',
      photo: 'assets/images/Inventory_All New Ayla.jpeg',
      heroPhoto: 'assets/images/hero-all-new-ayla.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-08',
      model: 'New Rocky',
      category: 'Compact Turbo SUV',
      spec: '1.0L 1KR-VET Turbocharged',
      defaultLocation: 'Yard A - Blok 3 (SUV)',
      photo: 'assets/images/Inventory_New Rocky.jpeg',
      heroPhoto: 'assets/images/hero-new-rocky.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-09',
      model: 'Rocky',
      category: 'Sporty Compact SUV (ADS)',
      spec: '1.2L WA-VE ADS Styling',
      defaultLocation: 'Yard A - Blok 3 (SUV)',
      photo: 'assets/images/Inventory_Rocky.jpeg',
      heroPhoto: 'assets/images/hero-rocky.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-10',
      model: 'New Sirion',
      category: 'Dynamic Hatchback City Car',
      spec: '1.3L 1NR-VE Dual VVT-i D-CVT',
      defaultLocation: 'Yard C - Blok 2 (City Car)',
      photo: 'assets/images/Inventory_New Sirion.jpeg',
      heroPhoto: 'assets/images/hero-new-sirion.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-11',
      model: 'Luxio',
      category: 'Prestigious Business Van',
      spec: '1.5L 3SZ-VE DOHC VVT-i',
      defaultLocation: 'Yard D - Blok 1 (Commercial)',
      photo: 'assets/images/Inventory_Luxio.jpeg',
      heroPhoto: 'assets/images/hero-luxio.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-12',
      model: 'Gran Max Minibus',
      category: 'Spacious Passenger & Blind Van',
      spec: '1.5L 2NR-VE / 1.3L DOHC',
      defaultLocation: 'Yard D - Blok 2 (Commercial)',
      photo: 'assets/images/Inventory_Gran Max Minibus.jpeg',
      heroPhoto: 'assets/images/hero-granmax-minibus.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    },
    {
      catalogId: 'CAT-13',
      model: 'Gran Max Pick Up',
      category: 'Niaga & Logistik Tangguh',
      spec: '1.5L 2NR-VE Heavy Duty Deck',
      defaultLocation: 'Yard D - Blok 3 (Niaga)',
      photo: 'assets/images/Inventory_Gran Max Pick Up.jpeg',
      heroPhoto: 'assets/images/hero-granmax-pickup.jpg',
      baseStock: { inYard: 0, intransit: 0, allocated: 0 }
    }
  ],

  // Helper untuk mencari foto katalog resmi berdasarkan nama model
  getModelCatalogItem(modelName) {
    if (!modelName) return this.vehicleCatalog[0];
    const clean = modelName.toLowerCase().trim();
    // 1. Exact match
    let found = this.vehicleCatalog.find(c => c.model.toLowerCase() === clean);
    if (found) return found;
    // 2. Specific disambiguations
    if (clean.includes('hybrid')) return this.vehicleCatalog[0];
    if (clean.includes('terios se')) return this.vehicleCatalog[2];
    if (clean.includes('terios')) return this.vehicleCatalog[1];
    if (clean.includes('xenia')) return this.vehicleCatalog[3];
    if (clean.includes('old')) return this.vehicleCatalog[5];
    if (clean.includes('sigra')) return this.vehicleCatalog[4];
    if (clean.includes('ayla')) return this.vehicleCatalog[6];
    if (clean.includes('new rocky') || clean.includes('turbo')) return this.vehicleCatalog[7];
    if (clean.includes('rocky')) return this.vehicleCatalog[8];
    if (clean.includes('sirion')) return this.vehicleCatalog[9];
    if (clean.includes('luxio')) return this.vehicleCatalog[10];
    if (clean.includes('minibus') || clean.includes('van')) return this.vehicleCatalog[11];
    if (clean.includes('pick') || clean.includes('gran max') || clean.includes('granmax')) return this.vehicleCatalog[12];
    return this.vehicleCatalog[0];
  },

  // Dataset Inventory Unit Fisik Kendaraan (Mulai dari Kosong / Sesuai Realtime Scan Lapangan)
  inventoryData: [],

  // Log Mutasi & Riwayat Audit Fisik (Mulai dari Kosong / Sesuai Realtime Scan Lapangan)
  historyData: [],

  /**
   * Helper untuk memeriksa apakah kode Barcode / VIN sudah pernah tersimpan sebelumnya
   * Mengembalikan true jika duplikat (sudah ada di historyData)
   */
  isVinDuplicate(vin) {
    if (!vin) return false;
    const cleanVin = String(vin).trim().toUpperCase();
    return this.historyData.some(item => (item.vin && String(item.vin).trim().toUpperCase() === cleanVin));
  },

  // Inisialisasi Cache dari LocalStorage jika ada
  loadFromCache() {
    try {
      // Bersihkan seluruh cache lama (v1, v2, v3) yang berisi data dummy/mock
      ['v1', 'v2', 'v3'].forEach(v => {
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

      const cachedProfile = localStorage.getItem(CONFIG.CACHE_KEYS.PROFILE);
      if (cachedProfile) {
        this.userProfile = Object.assign({}, this.userProfile, JSON.parse(cachedProfile));
      }

      const cachedAutomation = localStorage.getItem(CONFIG.CACHE_KEYS.AUTOMATION);
      if (cachedAutomation) {
        this.automationConfig = Object.assign({}, this.automationConfig, JSON.parse(cachedAutomation));
      }
    } catch (e) {
      console.warn('[AppState] Gagal membaca cache local storage:', e);
    }
  },

  // Simpan State ke LocalStorage
  saveToCache() {
    try {
      localStorage.setItem(CONFIG.CACHE_KEYS.INVENTORY, JSON.stringify(this.inventoryData));
      localStorage.setItem(CONFIG.CACHE_KEYS.HISTORY, JSON.stringify(this.historyData));
      localStorage.setItem(CONFIG.CACHE_KEYS.KPI, JSON.stringify(this.kpi));
      localStorage.setItem(CONFIG.CACHE_KEYS.PROFILE, JSON.stringify(this.userProfile));
      localStorage.setItem(CONFIG.CACHE_KEYS.AUTOMATION, JSON.stringify(this.automationConfig));
    } catch (e) {
      console.warn('[AppState] Gagal menyimpan ke cache local storage:', e);
    }
  },

  // Update KPI secara dinamis 100% Realtime dari Data Lapangan
  updateKpiCounts() {
    let masukCount = 0;
    let keluarCount = 0;
    
    this.historyData.forEach(item => {
      if (item.type === 'Unit Masuk') masukCount++;
      if (item.type === 'Unit Keluar') keluarCount++;
    });

    let intransitCount = 0;
    this.inventoryData.forEach(item => {
      if (item.status === 'Intransit') intransitCount++;
    });

    this.kpi.masuk = masukCount;
    this.kpi.keluar = keluarCount;
    this.kpi.intransit = intransitCount;

    this.saveToCache();
  }
};

// Export ke window
window.AppState = AppState;

