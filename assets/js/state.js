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

  // KPI Metrics
  kpi: {
    masuk: 48,
    keluar: 42,
    intransit: 16
  },

  // Dataset Inventory Kendaraan
  inventoryData: [
    {
      id: 'INV-001',
      model: 'Rocky e-Smart Hybrid',
      plate: 'BE 1001 RKY',
      vin: 'MHKP3FA1JXK001122',
      engine: 'WA-VEX1029384',
      status: 'In-Yard',
      location: 'Yard A - Blok 1 (Hybrid)',
      photo: 'assets/images/inventory-rocky-hybrid.png',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-002',
      model: 'Gran Max 1.5 D Pickup',
      plate: 'BE 1234 KZA',
      vin: 'MHKP3FA1JXK005678',
      engine: '2NRX1234567',
      status: 'In-Yard',
      location: 'Yard A - Blok 3',
      photo: 'assets/images/hero-granmax-pickup.jpg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-003',
      model: 'New Terios R 1.5 X',
      plate: 'BE 5678 TCD',
      vin: 'MHKDA3BA1RJ012345',
      engine: '3NRF2345678',
      status: 'Intransit',
      location: 'Rute Palembang → Lampung',
      photo: 'assets/images/inventory-new-terios.png',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-004',
      model: 'Sigra 1.2 R',
      plate: 'BE 9012 VBN',
      vin: 'MHKBR5DA3JJ056789',
      engine: '3NRD3456789',
      status: 'In-Yard',
      location: 'Yard B - Blok 1',
      photo: 'assets/images/hero-new-sigra.jpg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-005',
      model: 'All New Ayla 1.2 R',
      plate: 'BE 3456 FGH',
      vin: 'MHKAG5DA3KL078901',
      engine: '3NRH4567890',
      status: 'Intransit',
      location: 'Rute Jakarta → Lampung',
      photo: 'assets/images/hero-all-new-ayla.jpg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    },
    {
      id: 'INV-006',
      model: 'All New Xenia 1.5 R',
      plate: 'BE 7890 JKL',
      vin: 'MHKDA4BA1LM098765',
      engine: '3NRF5678901',
      status: 'Allocated',
      location: 'Alokasi DSO Lampung',
      photo: 'assets/images/hero-all-new-xenia.jpg',
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
      model: 'Gran Max 1.5 D Pickup',
      vin: 'MHKP3FA1JTK137533',
      engine: '2NR4F82393',
      pic: 'Andi Pratama',
      notes: 'Tarikan unit dari D600 ke D661, dokumen lengkap.',
      unitPhoto: 'assets/images/hero-granmax-pickup.jpg',
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
      model: 'Terios R 1.5 X',
      vin: 'MHKDA3BA1RJ012345',
      engine: '3NRF2345678',
      pic: 'Budi Santoso',
      notes: 'Kirim serah terima ke cabang Raden Intan.',
      unitPhoto: 'assets/images/hero-new-terios.jpg',
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
      model: 'Sigra 1.2 R',
      vin: 'MHKBR5DA3JJ056789',
      engine: '3NRD3456789',
      pic: 'Rina Marlina',
      notes: 'Unit baru tiba dari pabrik Jakarta.',
      unitPhoto: 'assets/images/hero-new-sigra.jpg',
      docPhoto: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80'
    }
  ],

  // Inisialisasi Cache dari LocalStorage jika ada
  loadFromCache() {
    try {
      const cachedInv = localStorage.getItem(CONFIG.CACHE_KEYS.INVENTORY);
      const cachedHist = localStorage.getItem(CONFIG.CACHE_KEYS.HISTORY);
      const cachedKpi = localStorage.getItem(CONFIG.CACHE_KEYS.KPI);

      if (cachedInv) this.inventoryData = JSON.parse(cachedInv);
      if (cachedHist) this.historyData = JSON.parse(cachedHist);
      if (cachedKpi) this.kpi = JSON.parse(cachedKpi);
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

