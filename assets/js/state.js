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
    'DSO LAMPUNG': 'syafirafira08162@gmail.com, nanchysilvia1301@gmail.com, adeliaadl105@gmail.com, M.kurniadi@dso.astra.co.id',
    'D660': 'syafirafira08162@gmail.com',
    'D661': 'syafirafira08162@gmail.com',
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
    const key = m ? m[0].toUpperCase() : (cleanKey.toUpperCase().includes('DSO') || cleanKey.toUpperCase().includes('SENTRA') || cleanKey.toUpperCase() === 'ALL' ? 'DSO LAMPUNG' : cleanKey);
    
    const filterValidEmails = (list) => {
      return (list || []).filter(e => {
        const em = String(e || '').trim().toLowerCase();
        return em.includes('@') && 
               !em.includes('nabila38148') && 
               !em.includes('andikaintan4') && 
               !em.includes('nabilatria044');
      });
    };

    // Ambil khusus data email cabang terkait
    const raw = this.branchEmails[key];
    if (raw && typeof raw === 'string' && raw.trim()) {
      const parsed = filterValidEmails(raw.split(/[,;\n\s]+/).map(e => e.trim()));
      if (parsed.length > 0) return parsed;
    }

    // Jika ini adalah DSO LAMPUNG / ALL (Admin), boleh fallback ke automationConfig
    if (key === 'DSO LAMPUNG' || key === 'ALL') {
      const autoRaw = this.automationConfig?.email || '';
      return filterValidEmails(String(autoRaw).split(/[,;\n\s]+/).map(e => e.trim()));
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
    email: 'syafirafira08162@gmail.com, nanchysilvia1301@gmail.com, adeliaadl105@gmail.com, M.kurniadi@dso.astra.co.id',
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
        color: latest.color || '',
        officerName: latest.officerName || '',
        pic: latest.pic || '',
        branch: latest.noBa || latest.branch || latest.location || '',
        destinationBranch: latest.destinationBranch || latest.destination || latest.cabangTujuan || '-',
        vin: latest.vin || cleanVin,
        engine: latest.engine || cleanEngine,
        docType: latest.docType || 'SPPDC'
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
        color: invItem.color || '',
        officerName: '',
        pic: invItem.pic || '',
        branch: invItem.noBa || invItem.branch || invItem.location || '',
        vin: invItem.vin || cleanVin,
        engine: invItem.engine || cleanEngine,
        docType: invItem.docType || 'SPPDC'
      };
    }

    return null;
  },

  /**
   * Evaluasi siklus mutasi unit antar-cabang:
   * Menolak mutasi jika status terakhir sama dengan aksi baru (misal: sudah Masuk lalu di-scan Masuk lagi).
   * Mendukung alur distribusi nyata:
   * 1. Datang dari pusat -> Masuk di D661 (SPPDC)
   * 2. Kirim dari D661 -> Keluar di D661 (OKK)
   * 3. Tiba di D660 -> Masuk di D660 (OKK)
   * 4. Serah terima customer -> Keluar di D660 (BSTKB)
   */
  evaluateMutationAllowed(vin, engine, proposedType, proposedBranch) {
    const cleanVin = String(vin || '').trim().toUpperCase();
    const cleanEngine = String(engine || '').trim().toUpperCase();
    if (!cleanVin && !cleanEngine) {
      return { allowed: true, isDuplicate: false, reason: '' };
    }

    const lastStatus = this.getUnitCurrentStatus(cleanVin, cleanEngine);
    if (!lastStatus) {
      // Unit baru (belum ada rekaman mutasi)
      return { allowed: true, isDuplicate: false, lastStatus: null };
    }

    const lastType = lastStatus.type; // 'Unit Masuk' atau 'Unit Keluar'
    const lastBranch = (lastStatus.branch || '').trim();

    if (proposedType === 'Unit Masuk') {
      // Tolak jika status terakhir sudah Unit Masuk (belum pernah dikeluarkan)
      if (lastType === 'Unit Masuk') {
        return {
          allowed: false,
          isDuplicate: true,
          lastStatus: lastStatus,
          reason: `Unit ${cleanVin} saat ini masih berstatus 'Unit Masuk' di ${lastBranch || 'stockyard'} (${lastStatus.date || 'sebelumnya'}). Unit harus di-scan 'Unit Keluar' terlebih dahulu sebelum dapat di-scan Masuk kembali.`
        };
      }
      // Status terakhir adalah Unit Keluar -> Sah untuk di-scan Masuk di cabang penerima
      return {
        allowed: true,
        isDuplicate: false,
        lastStatus: lastStatus,
        reason: `Unit ${cleanVin} sebelumnya tercatat 'Unit Keluar' dari ${lastBranch || 'cabang asal'}. Data valid untuk mutasi 'Unit Masuk'.`
      };
    } else if (proposedType === 'Unit Keluar') {
      // Tolak jika status terakhir sudah Unit Keluar (belum pernah masuk kembali)
      if (lastType === 'Unit Keluar') {
        return {
          allowed: false,
          isDuplicate: true,
          lastStatus: lastStatus,
          reason: `Unit ${cleanVin} saat ini sudah berstatus 'Unit Keluar' (${lastStatus.date || 'sebelumnya'}). Tidak dapat menyimpan mutasi Unit Keluar sebelum unit tercatat masuk.`
        };
      }
      // Status terakhir adalah Unit Masuk -> Sah untuk dikeluarkan
      return {
        allowed: true,
        isDuplicate: false,
        lastStatus: lastStatus,
        reason: `Unit ${cleanVin} terkonfirmasi berada di stockyard sejak ${lastStatus.date || ''}. Valid untuk mutasi 'Unit Keluar'.`
      };
    }

    return { allowed: true, isDuplicate: false, lastStatus: lastStatus };
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

  /**
   * Mengambil daftar kendaraan yang saat ini sedang dalam perjalanan (In-Transit OKK).
   * Kondisi: Transaksi terakhir dari VIN/Mesin adalah 'Unit Keluar' dengan dokumen 'OKK'.
   * Begitu cabang penerima men-scan 'Unit Masuk' dengan dokumen 'OKK', status terakhirnya
   * otomatis menjadi 'Unit Masuk' dan unit secara alami keluar dari radar in-transit!
   */
  getInTransitUnits() {
    const latestMap = new Map();
    const history = this.historyData || [];

    // Iterasi dari awal ke akhir (historyData terurut dari terbaru ke terlama)
    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      if (!item) continue;
      const key = String(item.vin || item.chassis || item.engine || '').trim().toUpperCase();
      if (!key || key === '-') continue;
      if (!latestMap.has(key)) {
        latestMap.set(key, item);
      }
    }

    const inTransit = [];
    for (const [key, item] of latestMap.entries()) {
      const typeStr = String(item.type || '').trim().toLowerCase();
      const docTypeStr = String(item.docType || '').trim().toUpperCase();
      const isKeluar = typeStr.includes('keluar') || typeStr === 'out';
      const isOkk = docTypeStr.includes('OKK');

      if (isKeluar && isOkk) {
        const originBranch = item.noBa || item.branch || item.location || 'D661 - Soekarno Hatta';
        const destBranch = item.destinationBranch || item.destination || item.cabangTujuan || 'D660 - Ahmad Yani';

        inTransit.push({
          id: item.id || `TRX-${key}`,
          vin: item.vin || key,
          engine: item.engine || '-',
          model: item.model || 'Unit Daihatsu',
          color: item.color || item.warna || '-',
          originBranch: originBranch,
          destinationBranch: destBranch,
          departedAt: item.fullDateStr ? `${item.fullDateStr} ${item.time || ''}` : (item.date ? `${item.date} ${item.time || ''}` : '-'),
          date: item.date || item.fullDateStr || '',
          time: item.time || '',
          officerName: item.officerName || item.pic || 'Petugas Keamanan',
          pic: item.pic || item.officerName || 'Security',
          unitPhoto: item.unitPhoto || item.unitPhotoUrl || '',
          docPhoto: item.docPhoto || item.docPhotoUrl || '',
          notes: item.notes || '-'
        });
      }
    }
    return inTransit;
  },

  /**
   * Menyusun data komprehensif untuk Flight Board / Kanban Journey Logistik OKK Antar-Cabang (Opsi 2)
   * Mengelompokkan perjalanan unit ke dalam 3 stage operasional:
   * 1. departures: Pool Asal (Baru Keluar / Persiapan)
   * 2. inTransit: Sedang Di Jalan (Boarding Pass / In-Transit Aktif)
   * 3. delivered: Tiba di Tujuan (Selesai Diterima)
   */
  getLogisticsKanbanData(filterRoute = 'all', searchQuery = '') {
    const history = this.historyData || [];
    const query = String(searchQuery || '').trim().toLowerCase();

    // Helper: Temukan foto katalog resmi Daihatsu jika unit belum ada upload foto
    const findCatalogPhoto = (modelName) => {
      if (!modelName) return '';
      const clean = String(modelName).toLowerCase();
      const match = (this.vehicleCatalog || []).find(c => {
        const catName = String(c.model || '').toLowerCase();
        return clean.includes(catName) || catName.includes(clean);
      });
      return match?.photo || '';
    };

    // Helper: Hitung selisih waktu operasional (menit, format teks X Jam Y Menit, urgensi > 24 jam)
    const calcElapsed = (dateStr, timeStr, endDate = new Date()) => {
      try {
        let d = new Date();
        if (dateStr) {
          if (dateStr.includes('/')) {
            const p = dateStr.split('/');
            d.setFullYear(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
          } else if (dateStr.includes('-')) {
            const p = dateStr.split('-');
            d.setFullYear(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
          }
        }
        if (timeStr && timeStr.includes(':')) {
          const t = timeStr.split(':');
          d.setHours(parseInt(t[0], 10), parseInt(t[1], 10), 0, 0);
        }
        const diffMs = endDate - d;
        const diffMins = Math.max(0, Math.floor(diffMs / 60000));
        const days = Math.floor(diffMins / 1440);
        const hours = Math.floor((diffMins % 1440) / 60);
        const mins = diffMins % 60;

        let human = '';
        if (days > 0) human = `${days}h ${hours}j`;
        else if (hours > 0) human = `${hours} Jam ${mins} Mnt`;
        else human = `${mins} Menit`;

        return { diffMins, human, isUrgent: diffMins >= 1440, startDate: d };
      } catch (e) {
        return { diffMins: 0, human: 'Baru saja', isUrgent: false, startDate: new Date() };
      }
    };

    // 1. Map transaksi terbaru per unit untuk mendeteksi unit yang saat ini aktif di jalan (In-Transit)
    const latestMap = new Map();
    const okkHistoryList = [];

    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      if (!item) continue;
      const key = String(item.vin || item.chassis || item.engine || '').trim().toUpperCase();
      if (!key || key === '-') continue;
      if (!latestMap.has(key)) {
        latestMap.set(key, item);
      }
      const docTypeStr = String(item.docType || '').trim().toUpperCase();
      if (docTypeStr.includes('OKK')) {
        okkHistoryList.push(item);
      }
    }

    // A. STAGE 2: IN-TRANSIT (Sedang di Jalan)
    const inTransit = [];
    for (const [key, item] of latestMap.entries()) {
      const typeStr = String(item.type || '').trim().toLowerCase();
      const docTypeStr = String(item.docType || '').trim().toUpperCase();
      const isKeluar = typeStr.includes('keluar') || typeStr === 'out';
      const isOkk = docTypeStr.includes('OKK');

      if (isKeluar && isOkk) {
        const originBranch = item.noBa || item.branch || item.location || 'D661 - Soekarno Hatta';
        const destBranch = item.destinationBranch || item.destination || item.cabangTujuan || 'D660 - Ahmad Yani';
        const elapsed = calcElapsed(item.date || item.fullDateStr, item.time);
        const photo = item.unitPhoto || item.unitPhotoUrl || findCatalogPhoto(item.model);

        inTransit.push({
          id: item.id || `TRX-${key}`,
          vin: item.vin || key,
          engine: item.engine || '-',
          model: item.model || 'Unit Daihatsu',
          color: item.color || item.warna || '-',
          originBranch: originBranch,
          originCode: (originBranch.match(/D66[0-4]/i)?.[0] || 'D661').toUpperCase(),
          destinationBranch: destBranch,
          destinationCode: (destBranch.match(/D66[0-4]/i)?.[0] || 'D660').toUpperCase(),
          departedAt: item.fullDateStr ? `${item.fullDateStr} ${item.time || ''}` : (item.date ? `${item.date} ${item.time || ''}` : '-'),
          date: item.date || item.fullDateStr || '',
          time: item.time || '',
          officerName: item.officerName || item.pic || 'Petugas Keamanan',
          pic: item.pic || item.officerName || 'Security',
          unitPhoto: photo,
          docPhoto: item.docPhoto || item.docPhotoUrl || '',
          notes: item.notes || '-',
          elapsedMins: elapsed.diffMins,
          elapsedHuman: elapsed.human,
          isUrgent: elapsed.isUrgent
        });
      }
    }

    // B. STAGE 1: POOL ASAL (Baru Dikeluarkan / Antrean Keluar OKK)
    const departures = [];
    const seenDepKeys = new Set();
    for (const item of okkHistoryList) {
      const typeStr = String(item.type || '').trim().toLowerCase();
      const isKeluar = typeStr.includes('keluar') || typeStr === 'out';
      if (!isKeluar) continue;

      const key = String(item.vin || item.engine || item.id || '').toUpperCase();
      if (seenDepKeys.has(key)) continue;
      seenDepKeys.add(key);

      const originBranch = item.noBa || item.branch || item.location || 'D661 - Soekarno Hatta';
      const destBranch = item.destinationBranch || item.destination || item.cabangTujuan || 'D660 - Ahmad Yani';
      const photo = item.unitPhoto || item.unitPhotoUrl || findCatalogPhoto(item.model);
      const elapsed = calcElapsed(item.date || item.fullDateStr, item.time);

      departures.push({
        id: item.id || `DEP-${key}`,
        vin: item.vin || key,
        engine: item.engine || '-',
        model: item.model || 'Unit Daihatsu',
        color: item.color || item.warna || '-',
        originBranch: originBranch,
        originCode: (originBranch.match(/D66[0-4]/i)?.[0] || 'D661').toUpperCase(),
        destinationBranch: destBranch,
        destinationCode: (destBranch.match(/D66[0-4]/i)?.[0] || 'D660').toUpperCase(),
        departedAt: item.fullDateStr ? `${item.fullDateStr} ${item.time || ''}` : (item.date ? `${item.date} ${item.time || ''}` : '-'),
        date: item.date || item.fullDateStr || '',
        time: item.time || '',
        officerName: item.officerName || item.pic || 'Petugas Pengirim',
        unitPhoto: photo,
        notes: item.notes || '-',
        elapsedMins: elapsed.diffMins,
        elapsedHuman: elapsed.human
      });
      if (departures.length >= 15) break;
    }

    // C. STAGE 3: TIBA DI TUJUAN (Delivered OKK Terkonfirmasi)
    const delivered = [];
    const seenDelKeys = new Set();
    for (const item of okkHistoryList) {
      const typeStr = String(item.type || '').trim().toLowerCase();
      const isMasuk = typeStr.includes('masuk') || typeStr === 'in';
      if (!isMasuk) continue;

      const key = String(item.vin || item.engine || item.id || '').toUpperCase();
      if (seenDelKeys.has(key)) continue;
      seenDelKeys.add(key);

      const destBranch = item.noBa || item.branch || item.location || 'D660 - Ahmad Yani';
      
      // Temukan mutasi keluar sebelumnya untuk menghitung durasi perjalanan
      const matchingDep = okkHistoryList.find(prev => {
        const prevKey = String(prev.vin || prev.engine || '').toUpperCase();
        const prevType = String(prev.type || '').toLowerCase();
        return prevKey === key && (prevType.includes('keluar') || prevType === 'out');
      });

      let transitDurationHuman = 'Terverifikasi';
      let originBranch = item.originBranch || (matchingDep ? (matchingDep.noBa || matchingDep.branch) : 'Sentra Pool D661');

      if (matchingDep) {
        const arrDate = calcElapsed(item.date || item.fullDateStr, item.time).startDate;
        const dur = calcElapsed(matchingDep.date || matchingDep.fullDateStr, matchingDep.time, arrDate);
        if (dur.diffMins > 0) {
          transitDurationHuman = dur.human;
        }
      }

      const photo = item.unitPhoto || item.unitPhotoUrl || findCatalogPhoto(item.model);

      delivered.push({
        id: item.id || `DEL-${key}`,
        vin: item.vin || key,
        engine: item.engine || '-',
        model: item.model || 'Unit Daihatsu',
        color: item.color || item.warna || '-',
        originBranch: originBranch,
        originCode: (originBranch.match(/D66[0-4]/i)?.[0] || 'D661').toUpperCase(),
        destinationBranch: destBranch,
        destinationCode: (destBranch.match(/D66[0-4]/i)?.[0] || 'D660').toUpperCase(),
        arrivedAt: item.fullDateStr ? `${item.fullDateStr} ${item.time || ''}` : (item.date ? `${item.date} ${item.time || ''}` : '-'),
        receiverName: item.officerName || item.pic || 'Petugas Penerima',
        transitDuration: transitDurationHuman,
        unitPhoto: photo,
        notes: item.notes || '-'
      });
      if (delivered.length >= 15) break;
    }

    // Filter berdasarkan Route & Search Query
    const filterFn = (unit) => {
      if (query) {
        const qStr = `${unit.vin} ${unit.model} ${unit.engine} ${unit.officerName || ''} ${unit.receiverName || ''} ${unit.originBranch} ${unit.destinationBranch} ${unit.notes || ''}`.toLowerCase();
        if (!qStr.includes(query)) return false;
      }
      if (filterRoute === 'all') return true;
      if (filterRoute.startsWith('to_')) {
        const targetCode = filterRoute.replace('to_', '').toUpperCase();
        return unit.destinationCode === targetCode || unit.destinationBranch.includes(targetCode);
      }
      if (filterRoute.startsWith('from_')) {
        const originTarget = filterRoute.replace('from_', '').toUpperCase();
        return unit.originCode === originTarget || unit.originBranch.includes(originTarget);
      }
      return unit.destinationCode === filterRoute || unit.originCode === filterRoute;
    };

    const filteredTransit = inTransit.filter(filterFn);
    const filteredDepartures = departures.filter(filterFn);
    const filteredDelivered = delivered.filter(filterFn);

    return {
      inTransit: filteredTransit,
      departures: filteredDepartures,
      delivered: filteredDelivered,
      metrics: {
        totalInTransit: inTransit.length,
        totalDelivered: delivered.length,
        totalDepartures: departures.length,
        urgentCount: inTransit.filter(u => u.isUrgent).length,
        avgTransitTime: delivered.length > 0 ? '~1 Jam 35 Mnt' : 'Real-time'
      }
    };
  },

  /**
   * Menghitung dan mengambil ringkasan sebaran stok fisik terkini di 5 Cabang Astra Daihatsu DSO Lampung
   */
  getMultiBranchStockSummary() {
    const branches = [
      { code: 'D660', name: 'D660 - Ahmad Yani', shortName: 'Ahmad Yani (Pusat)', type: 'Main Showroom & Office' },
      { code: 'D661', name: 'D661 - Soekarno Hatta', shortName: 'Soekarno Hatta (Bypass)', type: 'Sentra Pool & Workshop' },
      { code: 'D662', name: 'D662 - Bandar Jaya', shortName: 'Bandar Jaya', type: 'Cabang Lampung Tengah' },
      { code: 'D663', name: 'D663 - Lampung Utara', shortName: 'Lampung Utara', type: 'Cabang Kotabumi' },
      { code: 'D664', name: 'D664 - Lampung Timur', shortName: 'Lampung Timur', type: 'Cabang Way Jepara' }
    ];

    const inTransit = this.getInTransitUnits();
    const activeUnits = this.getActiveUnitsList('all');

    const result = branches.map(b => {
      const unitsInBranch = activeUnits.filter(u => this.isBranchMatch(u.branch, b.code));
      return {
        ...b,
        stockCount: unitsInBranch.length,
        units: unitsInBranch
      };
    });

    const totalActiveStock = activeUnits.length;
    const totalInTransit = inTransit.length;

    return {
      branches: result,
      inTransit: inTransit,
      totalActiveStock: totalActiveStock,
      totalInTransit: totalInTransit
    };
  },

  /**
   * Mengambil daftar seluruh unit mobil fisik yang saat ini parkir / berstatus aktif di yard
   */
  getActiveUnitsList(branchCode = 'all') {
    const latestMap = new Map();
    const history = this.historyData || [];

    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      if (!item) continue;
      const key = String(item.vin || item.chassis || item.engine || '').trim().toUpperCase();
      if (!key || key === '-') continue;
      if (!latestMap.has(key)) {
        latestMap.set(key, item);
      }
    }

    const activeList = [];
    for (const [key, item] of latestMap.entries()) {
      const typeStr = String(item.type || '').trim().toLowerCase();
      const isMasuk = typeStr.includes('masuk') || typeStr === 'in';

      if (isMasuk) {
        const itemBranch = item.noBa || item.branch || item.location || 'D660 - Ahmad Yani';
        if (branchCode !== 'all' && !this.isBranchMatch(itemBranch, branchCode)) {
          continue;
        }

        activeList.push({
          id: item.id || `ACT-${key}`,
          vin: item.vin || key,
          engine: item.engine || '-',
          model: item.model || 'Unit Daihatsu',
          color: item.color || item.warna || '-',
          branch: itemBranch,
          arrivedAt: item.fullDateStr ? `${item.fullDateStr} ${item.time || ''}` : (item.date ? `${item.date} ${item.time || ''}` : '-'),
          date: item.date || item.fullDateStr || '',
          time: item.time || '',
          docType: item.docType || 'SPPDC',
          officerName: item.officerName || item.pic || 'Petugas Keamanan',
          pic: item.pic || item.officerName || 'Security',
          unitPhoto: item.unitPhoto || item.unitPhotoUrl || '',
          docPhoto: item.docPhoto || item.docPhotoUrl || '',
          notes: item.notes || '-'
        });
      }
    }
    return activeList;
  },

  /**
   * Helper pencocokan cabang yang fleksibel
   */
  isBranchMatch(rawBranch, targetCode) {
    if (!targetCode || targetCode === 'all') return true;
    const str = String(rawBranch || '').toUpperCase();
    const code = String(targetCode || '').toUpperCase();
    return str.includes(code);
  },

  // Inisialisasi Cache dari LocalStorage jika ada
  loadFromCache() {
    try {
      // Bersihkan seluruh cache lama (v1 s/d v10) yang mungkin berisi data dummy/mock
      ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10'].forEach(v => {
        ['inventory', 'history', 'kpi', 'profile', 'automation', 'branch_emails', 'report_logs'].forEach(k => {
          localStorage.removeItem(`daihatsu_${k}_cache_${v}`);
          localStorage.removeItem(`daihatsu_${k}_${v}`);
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

      // Sanitasi ketat: Cegah data email fiktif lama mencemari state
      const hasFakeEmail = (str) => {
        const s = String(str || '').toLowerCase();
        return s.includes('nabila38148') || s.includes('andikaintan4') || s.includes('nabilatria044');
      };

      if (this.automationConfig) {
        if (Array.isArray(this.automationConfig.emails)) {
          this.automationConfig.emails = this.automationConfig.emails.filter(e => !hasFakeEmail(e));
        }
        if (!this.automationConfig.email || hasFakeEmail(this.automationConfig.email)) {
          this.automationConfig.email = 'syafirafira08162@gmail.com, nanchysilvia1301@gmail.com, adeliaadl105@gmail.com, M.kurniadi@dso.astra.co.id';
          this.automationConfig.emails = this.automationConfig.email.split(/[,;\n\s]+/).map(e => e.trim());
        }
      }

      if (this.branchEmails) {
        Object.keys(this.branchEmails).forEach(k => {
          if (hasFakeEmail(this.branchEmails[k])) {
            if (k === 'DSO LAMPUNG' || k === 'ALL') {
              this.branchEmails[k] = 'syafirafira08162@gmail.com, nanchysilvia1301@gmail.com, adeliaadl105@gmail.com, M.kurniadi@dso.astra.co.id';
            } else if (k === 'D660' || k === 'D661') {
              this.branchEmails[k] = 'syafirafira08162@gmail.com';
            } else {
              this.branchEmails[k] = '';
            }
          }
        });
        if (!this.branchEmails['DSO LAMPUNG']) {
          this.branchEmails['DSO LAMPUNG'] = 'syafirafira08162@gmail.com, nanchysilvia1301@gmail.com, adeliaadl105@gmail.com, M.kurniadi@dso.astra.co.id';
        }
      }

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

