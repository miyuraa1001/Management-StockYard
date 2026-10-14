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
    email: 'report.logistik@daihatsu.co.id',
    type: 'Daily Digest PDF Rekap Mutasi Unit Masuk & Keluar'
  },

  // KPI Metrics
  kpi: {
    masuk: 48,
    keluar: 42,
    intransit: 16
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
      baseStock: { inYard: 5, intransit: 2, allocated: 1 }
    },
    {
      catalogId: 'CAT-02',
      model: 'New Terios',
      category: '7-Seater Adventure SUV',
      spec: '1.5L 2NR-VE Dual VVT-i',
      defaultLocation: 'Yard A - Blok 2 (SUV)',
      photo: 'assets/images/Inventory_New Terios.jpeg',
      heroPhoto: 'assets/images/hero-new-terios.jpg',
      baseStock: { inYard: 9, intransit: 3, allocated: 2 }
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
      baseStock: { inYard: 8, intransit: 2, allocated: 2 }
    },
    {
      catalogId: 'CAT-05',
      model: 'New Sigra',
      category: 'LCGC 7-Seater Family MPV',
      spec: '1.2L 3NR-VE Dual VVT-i',
      defaultLocation: 'Yard B - Blok 2 (MPV)',
      photo: 'assets/images/Inventory_New Sigra.jpeg',
      heroPhoto: 'assets/images/hero-new-sigra.jpg',
      baseStock: { inYard: 11, intransit: 3, allocated: 2 }
    },
    {
      catalogId: 'CAT-06',
      model: 'New Sigra (Prod Old)',
      category: 'Reliable Value MPV',
      spec: '1.2L 3NR-VE MT/AT',
      defaultLocation: 'Yard B - Blok 3 (MPV)',
      photo: 'assets/images/Inventory_New Sigra (Prod Old).jpeg',
      heroPhoto: 'assets/images/hero-sigra-old.jpg',
      baseStock: { inYard: 6, intransit: 2, allocated: 1 }
    },
    {
      catalogId: 'CAT-07',
      model: 'All New Ayla',
      category: 'Dynamic City Hatchback',
      spec: '1.2L WA-VE D-CVT',
      defaultLocation: 'Yard C - Blok 1 (Hatchback)',
      photo: 'assets/images/Inventory_All New Ayla.jpeg',
      heroPhoto: 'assets/images/hero-all-new-ayla.jpg',
      baseStock: { inYard: 10, intransit: 3, allocated: 1 }
    },
    {
      catalogId: 'CAT-08',
      model: 'New Rocky',
      category: 'Compact Turbo SUV',
      spec: '1.0L 1KR-VET Turbocharged',
      defaultLocation: 'Yard A - Blok 3 (SUV)',
      photo: 'assets/images/Inventory_New Rocky.jpeg',
      heroPhoto: 'assets/images/hero-new-rocky.jpg',
      baseStock: { inYard: 6, intransit: 1, allocated: 1 }
    },
    {
      catalogId: 'CAT-09',
      model: 'Rocky',
      category: 'Sporty Compact SUV (ADS)',
      spec: '1.2L WA-VE ADS Styling',
      defaultLocation: 'Yard A - Blok 3 (SUV)',
      photo: 'assets/images/Inventory_Rocky.jpeg',
      heroPhoto: 'assets/images/hero-rocky.jpg',
      baseStock: { inYard: 4, intransit: 1, allocated: 0 }
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
      baseStock: { inYard: 3, intransit: 1, allocated: 1 }
    },
    {
      catalogId: 'CAT-12',
      model: 'Gran Max Minibus',
      category: 'Spacious Passenger & Blind Van',
      spec: '1.5L 2NR-VE / 1.3L DOHC',
      defaultLocation: 'Yard D - Blok 2 (Commercial)',
      photo: 'assets/images/Inventory_Gran Max Minibus.jpeg',
      heroPhoto: 'assets/images/hero-granmax-minibus.jpg',
      baseStock: { inYard: 7, intransit: 2, allocated: 1 }
    },
    {
      catalogId: 'CAT-13',
      model: 'Gran Max Pick Up',
      category: 'Niaga & Logistik Tangguh',
      spec: '1.5L 2NR-VE Heavy Duty Deck',
      defaultLocation: 'Yard D - Blok 3 (Niaga)',
      photo: 'assets/images/Inventory_Gran Max Pick Up.jpeg',
      heroPhoto: 'assets/images/hero-granmax-pickup.jpg',
      baseStock: { inYard: 14, intransit: 4, allocated: 3 }
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

  // Dataset Inventory Unit Fisik Kendaraan (Unit sampel/terbaru per model)
  inventoryData: [
    {
      id: 'INV-001',
      model: 'Rocky e-Smart Hybrid',
      category: 'Smart Hybrid SUV',
      plate: 'BE 1001 RKY',
      vin: 'MHKP3FA1JXK001122',
      engine: 'WA-VEX1029384',
      status: 'In-Yard',
      location: 'Yard A - Blok 1 (Hybrid)',
      photo: 'assets/images/Inventory_Rocky e-Smart Hybrid.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-002',
      model: 'Gran Max Pick Up',
      category: 'Niaga & Logistik Tangguh',
      plate: 'BE 1234 KZA',
      vin: 'MHKP3FA1JXK005678',
      engine: '2NRX1234567',
      status: 'In-Yard',
      location: 'Yard D - Blok 3 (Niaga)',
      photo: 'assets/images/Inventory_Gran Max Pick Up.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-003',
      model: 'New Terios',
      category: '7-Seater Adventure SUV',
      plate: 'BE 5678 TCD',
      vin: 'MHKDA3BA1RJ012345',
      engine: '3NRF2345678',
      status: 'In-Yard',
      location: 'Yard A - Blok 2 (SUV)',
      photo: 'assets/images/Inventory_New Terios.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-004',
      model: 'New Sigra',
      category: 'LCGC 7-Seater Family MPV',
      plate: 'BE 9012 VBN',
      vin: 'MHKBR5DA3JJ056789',
      engine: '3NRD3456789',
      status: 'In-Yard',
      location: 'Yard B - Blok 2 (MPV)',
      photo: 'assets/images/Inventory_New Sigra.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-005',
      model: 'All New Ayla',
      category: 'Dynamic City Hatchback',
      plate: 'BE 3456 FGH',
      vin: 'MHKAG5DA3KL078901',
      engine: '3NRH4567890',
      status: 'In-Yard',
      location: 'Yard C - Blok 1 (Hatchback)',
      photo: 'assets/images/Inventory_All New Ayla.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-006',
      model: 'All New Xenia',
      category: 'Executive Family MPV',
      plate: 'BE 7890 JKL',
      vin: 'MHKDA4BA1LM098765',
      engine: '3NRF5678901',
      status: 'In-Yard',
      location: 'Yard B - Blok 1 (MPV)',
      photo: 'assets/images/Inventory_All New Xenia.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-007',
      model: 'New Rocky',
      category: 'Compact Turbo SUV',
      plate: 'BE 2468 RKT',
      vin: 'MHKP3FA1JXK009876',
      engine: '1KRVET88291',
      status: 'In-Yard',
      location: 'Yard A - Blok 3 (SUV)',
      photo: 'assets/images/Inventory_New Rocky.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-008',
      model: 'Gran Max Minibus',
      category: 'Spacious Passenger & Blind Van',
      plate: 'BE 1357 GMB',
      vin: 'MHKP3FA1JXK004321',
      engine: '2NRVE77412',
      status: 'In-Yard',
      location: 'Yard D - Blok 2 (Commercial)',
      photo: 'assets/images/Inventory_Gran Max Minibus.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-009',
      model: 'New Sigra (Prod Old)',
      category: 'Reliable Value MPV',
      plate: 'BE 4120 SGR',
      vin: 'MHKBR5DA2HJ019283',
      engine: '3NRVE661920',
      status: 'In-Yard',
      location: 'Yard B - Blok 3 (MPV)',
      photo: 'assets/images/Inventory_New Sigra (Prod Old).jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-010',
      model: 'Rocky',
      category: 'Sporty Compact SUV (ADS)',
      plate: 'BE 8821 RKA',
      vin: 'MHKP3FA1JXK011409',
      engine: 'WAVE449102',
      status: 'In-Yard',
      location: 'Yard A - Blok 3 (SUV)',
      photo: 'assets/images/Inventory_Rocky.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-011',
      model: 'Luxio',
      category: 'Prestigious Business Van',
      plate: 'BE 6090 LUX',
      vin: 'MHKW2CA1JLK008812',
      engine: '3SZVE330192',
      status: 'In-Yard',
      location: 'Yard D - Blok 1 (Commercial)',
      photo: 'assets/images/Inventory_Luxio.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    }
  ],

  // Log Mutasi & Riwayat Audit Fisik
  historyData: [
    {
      id: 'HIST-101',
      type: 'Unit Masuk',
      time: '14:32',
      date: 9,
      month: 10,
      year: 2026,
      fullDateStr: '9 Oktober 2026',
      model: 'Gran Max Pick Up',
      vin: 'MHKP3FA1JTK137533',
      engine: '2NR4F82393',
      pic: 'Andi Pratama',
      notes: 'Tarikan unit dari D600 ke D661, dokumen lengkap.',
      unitPhoto: 'assets/images/Inventory_Gran Max Pick Up.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'HIST-102',
      type: 'Unit Keluar',
      time: '10:15',
      date: 9,
      month: 10,
      year: 2026,
      fullDateStr: '9 Oktober 2026',
      model: 'New Terios',
      vin: 'MHKDA3BA1RJ012345',
      engine: '3NRF2345678',
      pic: 'Budi Santoso',
      notes: 'Kirim serah terima ke cabang Raden Intan.',
      unitPhoto: 'assets/images/Inventory_New Terios.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'HIST-103',
      type: 'Unit Masuk',
      time: '08:47',
      date: 8,
      month: 10,
      year: 2026,
      fullDateStr: '8 Oktober 2026',
      model: 'New Sigra',
      vin: 'MHKBR5DA3JJ056789',
      engine: '3NRD3456789',
      pic: 'Rina Marlina',
      notes: 'Unit baru tiba dari pabrik Jakarta.',
      unitPhoto: 'assets/images/Inventory_New Sigra.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'HIST-104',
      type: 'Unit Keluar',
      time: '16:20',
      date: 7,
      month: 10,
      year: 2026,
      fullDateStr: '7 Oktober 2026',
      model: 'All New Ayla',
      vin: 'MHKAA1BA2PK089112',
      engine: '1KRVE994120',
      pic: 'Hendra Wijaya',
      notes: 'Pengiriman unit alokasi dealer DSO Pringsewu.',
      unitPhoto: 'assets/images/Inventory_All New Ayla.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'HIST-105',
      type: 'Unit Masuk',
      time: '13:05',
      date: 7,
      month: 10,
      year: 2026,
      fullDateStr: '7 Oktober 2026',
      model: 'Rocky e-Smart Hybrid',
      vin: 'MHKR1EA1JSK002145',
      engine: 'WAVEX771209',
      pic: 'Andi Pratama',
      notes: 'Penerimaan unit display & alokasi cabang utama.',
      unitPhoto: 'assets/images/Inventory_Rocky e-Smart Hybrid.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'HIST-106',
      type: 'Unit Keluar',
      time: '09:30',
      date: 6,
      month: 10,
      year: 2026,
      fullDateStr: '6 Oktober 2026',
      model: 'All New Xenia',
      vin: 'MHKDA4BA1LM098765',
      engine: '2NRVE558192',
      pic: 'Budi Santoso',
      notes: 'Serah terima BASTK ke pelanggan fleet.',
      unitPhoto: 'assets/images/Inventory_All New Xenia.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'HIST-107',
      type: 'Unit Masuk',
      time: '15:10',
      date: 5,
      month: 10,
      year: 2026,
      fullDateStr: '5 Oktober 2026',
      model: 'Gran Max Minibus',
      vin: 'MHKP3FA1JXK004321',
      engine: '2NRVE774120',
      pic: 'Rina Marlina',
      notes: 'Unit tiba dari pabrik Sunter, kondisi bodi & segel baik.',
      unitPhoto: 'assets/images/Inventory_Gran Max Minibus.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'HIST-108',
      type: 'Unit Masuk',
      time: '11:40',
      date: 4,
      month: 10,
      year: 2026,
      fullDateStr: '4 Oktober 2026',
      model: 'New Rocky',
      vin: 'MHKP3FA1JXK009876',
      engine: '1KRVET88291',
      pic: 'Hendra Wijaya',
      notes: 'Penerimaan unit alokasi Yard A - Blok 3 (SUV).',
      unitPhoto: 'assets/images/Inventory_New Rocky.jpeg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    }
  ],

  // Inisialisasi Cache dari LocalStorage jika ada
  loadFromCache() {
    try {
      const defaultInv = [...this.inventoryData];
      const defaultHist = [...this.historyData];
      const cachedInv = localStorage.getItem(CONFIG.CACHE_KEYS.INVENTORY);
      const cachedHist = localStorage.getItem(CONFIG.CACHE_KEYS.HISTORY);
      const cachedKpi = localStorage.getItem(CONFIG.CACHE_KEYS.KPI);

      if (cachedInv) {
        const parsedInv = JSON.parse(cachedInv);
        if (Array.isArray(parsedInv)) {
          const existingInvIds = new Set(parsedInv.map(i => i.id));
          defaultInv.forEach(di => {
            if (!existingInvIds.has(di.id)) parsedInv.push(di);
          });
          this.inventoryData = parsedInv;
        }
      }
      if (cachedHist) {
        const parsedHist = JSON.parse(cachedHist);
        if (Array.isArray(parsedHist)) {
          const existingIds = new Set(parsedHist.map(h => h.id));
          defaultHist.forEach(dh => {
            if (!existingIds.has(dh.id)) parsedHist.push(dh);
          });
          this.historyData = parsedHist;
        }
      }
      if (cachedKpi) this.kpi = JSON.parse(cachedKpi);

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

  // Update KPI secara dinamis
  updateKpiCounts() {
    let masukCount = 0;
    let keluarCount = 0;
    
    this.historyData.forEach(item => {
      if (item.type === 'Unit Masuk') masukCount++;
      if (item.type === 'Unit Keluar') keluarCount++;
    });

    let inYardCount = 0;
    let intransitCount = 0;
    this.inventoryData.forEach(item => {
      if (item.status === 'In-Yard') inYardCount++;
      if (item.status === 'Intransit') intransitCount++;
    });

    this.kpi.masuk = Math.max(48, masukCount);
    this.kpi.keluar = Math.max(42, keluarCount);
    this.kpi.intransit = intransitCount || 16;

    this.saveToCache();
  }
};

// Export ke window
window.AppState = AppState;

