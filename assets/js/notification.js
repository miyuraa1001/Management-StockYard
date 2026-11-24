/**
 * ============================================================================
 * NotificationService - Sistem Notifikasi Bawaan Android (Native Web & PWA Push)
 * PT Astra Daihatsu Motor • Astra Daihatsu DSO Lampung
 * ============================================================================
 * Fitur Utama:
 * 1. Notifikasi Scan Unit Masuk & Keluar:
 *    - Akun Admin: Menerima pemberitahuan untuk SEMUA cabang DSO Lampung.
 *    - Akun Security: Menerima pemberitahuan HANYA untuk cabang tempat bertugas.
 * 2. Notifikasi Keterlambatan Pengiriman Unit (Radar OKK SLA Delay):
 *    - Terpicu otomatis jika waktu tempuh unit melebihi target durasi SLA per cabang.
 *    - Admin: Memantau keterlambatan seluruh cabang.
 *    - Security: Memantau unit yang dikirim dari atau menuju cabangnya.
 * 3. Notifikasi Rekapitulasi Laporan Harian Email Terkirim.
 * 4. Integrasi Service Worker showNotification, Getar (Vibration), Badge, & Audio Beep.
 */

const NotificationService = {
  _initialized: false,
  _seenHistoryIds: new Set(),
  _seenReportIds: new Set(),
  _notifiedDelayMap: new Map(), // vin -> lastNotifiedTimestampMs
  STORAGE_KEY_PERMISSION: 'daihatsu_push_notif_enabled',
  STORAGE_KEY_SEEN_MUTATIONS: 'daihatsu_seen_mutation_ids',
  STORAGE_KEY_SEEN_REPORTS: 'daihatsu_seen_report_ids',
  STORAGE_KEY_NOTIFIED_DELAYS: 'daihatsu_notified_delays',

  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Muat ID mutasi & laporan yang telah dilihat agar tidak memunculkan notifikasi riwayat lama saat awal buka aplikasi
    try {
      const storedSeen = localStorage.getItem(this.STORAGE_KEY_SEEN_MUTATIONS);
      if (storedSeen) {
        const arr = JSON.parse(storedSeen);
        if (Array.isArray(arr)) {
          arr.forEach(id => this._seenHistoryIds.add(id));
        }
      }
      const storedSeenReports = localStorage.getItem(this.STORAGE_KEY_SEEN_REPORTS);
      if (storedSeenReports) {
        const arr = JSON.parse(storedSeenReports);
        if (Array.isArray(arr)) {
          arr.forEach(id => this._seenReportIds.add(id));
        }
      }
      const storedDelays = localStorage.getItem(this.STORAGE_KEY_NOTIFIED_DELAYS);
      if (storedDelays) {
        const obj = JSON.parse(storedDelays);
        if (typeof obj === 'object') {
          Object.keys(obj).forEach(vin => this._notifiedDelayMap.set(vin, obj[vin]));
        }
      }
    } catch (e) {}

    // Inisialisasi awal ID mutasi dari AppState saat ini (Tandai riwayat awal sebagai sudah dilihat)
    if (typeof AppState !== 'undefined' && Array.isArray(AppState.historyData)) {
      AppState.historyData.forEach(h => {
        if (h && (h.id || h.vin)) {
          this._seenHistoryIds.add(h.id || `${h.vin}_${h.type}_${h.timestamp}`);
        }
      });
      this._persistSeenMutations();
    }

    // Inisialisasi awal ID laporan dari AppState saat ini (Tandai log laporan lama sebagai sudah dilihat)
    if (typeof AppState !== 'undefined' && Array.isArray(AppState.reportLogs)) {
      AppState.reportLogs.forEach(r => {
        if (r && r.id) {
          this._seenReportIds.add(r.id);
        }
      });
      this._persistSeenReports();
    }

    // Perbarui status UI di halaman pengaturan
    this.updateUIStatus();

    // Pasang listener pesan dari Service Worker (untuk navigasi tab saat notifikasi diketuk)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.action === 'SWITCH_TAB' && event.data.tab) {
          if (typeof UI !== 'undefined' && typeof UI.switchTab === 'function') {
            UI.switchTab(event.data.tab);
            if (event.data.tab === 'inventory' && event.data.mode === 'branch' && typeof UI.switchInventoryView === 'function') {
              UI.switchInventoryView('branches');
            }
          }
        }
      });
    }

    // Pengecekan awal keterlambatan SLA transit saat inisialisasi aplikasi
    setTimeout(() => {
      if (this.isGranted()) {
        this.checkDelaysAndNotify();
      }
    }, 2000);

    // Jalankan pengecekan berkala keterlambatan SLA perjalanan unit in-transit (setiap 30 detik)
    setInterval(() => {
      if (this.isGranted()) {
        this.checkDelaysAndNotify();
      }
    }, 30000);

    console.log('[NotificationService] Inisialisasi notifikasi Android siap. Izin saat ini:', this.getPermission());
  },

  isSupported() {
    return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  },

  getPermission() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  },

  isGranted() {
    return this.getPermission() === 'granted';
  },

  async requestPermission() {
    if (!this.isSupported()) {
      if (typeof UI !== 'undefined') {
        UI.showToast('⚠️ Perangkat/Browser ini tidak mendukung notifikasi sistem web.');
      }
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      this.updateUIStatus();

      if (result === 'granted') {
        localStorage.setItem(this.STORAGE_KEY_PERMISSION, 'granted');
        const banner = document.getElementById('androidNotifPermissionBanner');
        if (banner) banner.classList.add('hidden');
        if (typeof UI !== 'undefined') {
          UI.showToast('🎉 Notifikasi Android aktif! Anda akan menerima update mutasi & keterlambatan.', 4500);
        }
        // Kirim notifikasi selamat datang / konfirmasi ke tray Android
        await this.show('🔔 Notifikasi Android Daihatsu Aktif', {
          body: 'Aplikasi Manajemen Stockyard kini terhubung langsung dengan status bar Android Anda.',
          tag: 'welcome-stockyard',
          vibrate: [200, 100, 200]
        });
        return true;
      } else if (result === 'denied') {
        localStorage.setItem(this.STORAGE_KEY_PERMISSION, 'denied');
        if (typeof UI !== 'undefined') {
          UI.showToast('🔒 Izin notifikasi diblokir di browser. Buka Setelan Situs di Chrome untuk mengizinkan.', 5000);
        }
        return false;
      }
    } catch (err) {
      console.warn('[NotificationService] Gagal meminta izin notifikasi:', err);
    }
    return false;
  },

  async show(title, options = {}) {
    if (!this.isGranted()) return false;

    const notifOptions = {
      body: options.body || '',
      icon: options.icon || './assets/icons/icon-apk.png',
      badge: options.badge || './assets/icons/badge-icon.png',
      image: options.image || undefined,
      tag: options.tag || 'daihatsu-alert-' + Date.now(),
      renotify: options.renotify !== false,
      vibrate: options.vibrate || [200, 100, 200],
      requireInteraction: options.requireInteraction || false,
      data: options.data || { url: './', tab: options.tab || 'dashboard' }
    };

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, notifOptions);
          return true;
        }
      }
      // Fallback untuk browser desktop standar
      new Notification(title, notifOptions);
      return true;
    } catch (err) {
      console.warn('[NotificationService] Gagal memicu showNotification:', err);
      try {
        new Notification(title, notifOptions);
        return true;
      } catch (e) {
        return false;
      }
    }
  },

  /**
   * Resolusi Thumbnail Foto Notifikasi Seragam & Konsisten:
   * Prioritas 1: Foto fisik dokumentasi asli security / laporan mutasi lapangan (unitPhoto)
   * Prioritas 2: Foto katalog resmi sistem sesuai model kendaraan (modelPhoto / findCatalogPhoto)
   * Fallback: Icon APK Stockyard
   */
  resolveUnitPhoto(record, modelName) {
    if (!record) return './assets/icons/icon-apk.png';
    const isClean = (url) => {
      if (!url || typeof url !== 'string') return false;
      const s = url.trim();
      return s !== '' && s !== '-' && s !== 'null' && s !== 'undefined' && !s.includes('placeholder');
    };

    // 1. Prioritas Utama: Foto fisik dokumentasi asli security
    if (isClean(record.unitPhoto)) {
      const u = record.unitPhoto.trim();
      // Bila merupakan base64 (upload kamera security), blob, atau URL Google Drive / hosting
      if (u.startsWith('data:image') || u.startsWith('blob:') || u.includes('google') || u.includes('lh3') || u.startsWith('http')) {
        return u;
      }
      // Jika bukan path katalog sistem, gunakan
      if (!u.includes('Inventory_') && !u.includes('assets/images/')) {
        return u;
      }
    }

    // 2. Fallback seragam: Foto katalog resmi sistem sesuai model
    if (isClean(record.modelPhoto)) {
      return record.modelPhoto.trim();
    }
    if (typeof AppState !== 'undefined' && typeof AppState.findCatalogPhoto === 'function') {
      const catPhoto = AppState.findCatalogPhoto(modelName || record.model);
      if (isClean(catPhoto)) return catPhoto.trim();
    }

    // 3. Fallback terakhir: Icon aplikasi APK
    return './assets/icons/icon-apk.png';
  },

  /**
   * Notifikasi Scan Unit Masuk / Keluar Baru, Antar-Cabang (OKK), & Pengiriman Luar Lampung
   * Filter RBAC & Skenario Lengkap:
   * 1. Luar Lampung Tiba / Selesai Diterima:
   *    - Admin & Cabang Asal: Menerima notif "🏁 Unit Tiba di Tujuan: [Model]"
   * 2. Luar Lampung Berangkat / Keluar:
   *    - Admin & Cabang Asal: Menerima notif "🚛 Pengiriman ke [Tujuan]: [Model]"
   * 3. Transit Antar-Cabang (OKK Keluar / OTW):
   *    - Cabang Asal: Menerima notif "Unit Berangkat (Radar OKK)"
   *    - Cabang Tujuan: Menerima notif "Unit OTW Menuju Cabang Anda!"
   *    - Admin DSO: Menerima notif "Mutasi OKK: Asal -> Tujuan"
   * 4. Kedatangan Transit (OKK Masuk di Pos Tujuan):
   *    - Cabang Penerima: Menerima notif "Unit Diterima di Pool!"
   *    - Cabang Pengirim: Menerima notif "Unit Tiba di Tujuan!"
   *    - Admin DSO: Menerima notif "OKK Selesai: Tiba di Tujuan"
   * 5. Mutasi Standar Harian (SPPDC/BSTKB)
   */
  notifyMutation(record) {
    if (!record || !this.isGranted()) return;

    const isAdmin = typeof AppState !== 'undefined' && typeof AppState.isAdmin === 'function' ? AppState.isAdmin() : true;
    const userBranchCode = typeof AppState !== 'undefined' && typeof AppState.getUserBranchCode === 'function' ? AppState.getUserBranchCode() : 'D660';
    const recBranch = record.noBa || record.branch || record.location || '';
    const destBranch = record.destinationBranch || record.destination || record.cabangTujuan || '';
    const originBranch = record.originBranch || '';
    const originCode = (recBranch.match(/D66[0-4]/i)?.[0] || (originBranch.match(/D66[0-4]/i)?.[0] || '')).toUpperCase();
    const destCode = (destBranch.match(/D66[0-4]/i)?.[0] || '').toUpperCase();

    const type = record.type || record.mutationType || 'Unit Masuk';
    const isMasuk = type === 'Unit Masuk' || type.toLowerCase().includes('masuk');
    const docType = String(record.docType || record.documentType || 'SPPDC').toUpperCase();
    const isOkk = docType === 'OKK';
    const model = record.model || 'Unit Kendaraan';
    const vin = record.vin || '-';
    const officer = record.officerName || record.pic || record.sender || 'Petugas Lapangan';
    const branchLabel = record.noBa || record.branch || 'Stockyard';
    const displayBranch = originCode || branchLabel.split('-')[0].trim() || 'D660';

    // Evaluasi Pengiriman Luar Lampung / Destinasi Eksternal
    const isLuarLampung = (str) => {
      if (!str || typeof str !== 'string') return false;
      const s = str.toLowerCase();
      return s.includes('luar lampung') || s.includes('luar') || s.includes('palembang') || s.includes('jakarta') || s.includes('bengkulu') || s.includes('jambi') || s.includes('serang') || s.includes('bandung');
    };

    const isExternalArrival = Boolean(
      record.isExternalArrival ||
      (record.adminValidated && (isLuarLampung(destBranch) || isLuarLampung(recBranch) || (record.notes && isLuarLampung(record.notes)))) ||
      (isMasuk && (isLuarLampung(destBranch) || isLuarLampung(recBranch) || (record.notes && record.notes.toLowerCase().includes('selesai diterima'))))
    );

    const isExternalExit = Boolean(
      !isMasuk && (isLuarLampung(destBranch) || isLuarLampung(recBranch) || (destBranch && !destCode && destBranch.trim() !== ''))
    );

    // Format Nama Kota / Destinasi Bersih
    let cleanDest = destBranch || recBranch || 'Luar Lampung';
    let targetCity = 'Luar Lampung';
    const cityMatch = cleanDest.match(/\(([^)]+)\)/);
    if (cityMatch && cityMatch[1]) {
      targetCity = cityMatch[1].trim();
    } else {
      const parts = cleanDest.replace(/Luar Lampung\s*[-–:]?\s*/i, '').trim();
      targetCity = parts || cleanDest;
    }

    // Evaluasi Otorisasi & Peran
    if (!isAdmin) {
      if (isExternalArrival || isExternalExit) {
        // Pada mutasi Luar Lampung: cabang asal pengirim menerima update
        const isOriginMatch = originCode && originCode === userBranchCode;
        if (!isOriginMatch) return;
      } else if (isOkk) {
        // Pada mutasi OKK, libatkan cabang asal MAUPUN cabang tujuan
        const isOriginMatch = originCode && originCode === userBranchCode;
        const isDestMatch = destCode && destCode === userBranchCode;
        if (!isOriginMatch && !isDestMatch) {
          return; // Cabang tidak terafiliasi dengan pengiriman OKK ini
        }
      } else {
        // Mutasi reguler (SPPDC/BSTKB): hanya cabang yang bersangkutan
        const matchBranch = typeof UI !== 'undefined' && typeof UI.isBranchMatch === 'function'
          ? UI.isBranchMatch(recBranch, userBranchCode)
          : recBranch.toUpperCase().includes(userBranchCode.toUpperCase());
        if (!matchBranch) return;
      }
    }

    let title = '';
    let body = '';
    let notifTag = `mutasi-${record.id || vin}`;
    let notifTab = 'history';
    let vibratePattern = [150, 100, 150];
    const unitPhotoThumbnail = this.resolveUnitPhoto(record, model);

    // SKENARIO 1: Konfirmasi Unit Tiba di Luar Lampung / Selesai Diterima (Validasi Admin / Sistem)
    if (isExternalArrival) {
      title = `🏁 Unit Tiba di ${targetCity}: ${model}`;
      body = `VIN: ${vin} • Tujuan: ${cleanDest}\nUnit resmi diterima & selesai diverifikasi (${officer}).`;
      notifTag = `arrival-ext-${vin}-${Date.now()}`;
      notifTab = 'history';
      vibratePattern = [200, 100, 200];
    }
    // SKENARIO 2: Pengiriman Unit Keluar ke Luar Lampung
    else if (isExternalExit) {
      title = `🚛 Pengiriman ke ${targetCity}: ${model}`;
      body = `VIN: ${vin} dari ${displayBranch}\nStatus: Dalam perjalanan ke ${targetCity} • Petugas: ${officer}`;
      notifTag = `exit-ext-${vin}-${Date.now()}`;
      notifTab = 'inventory';
      vibratePattern = [200, 100, 200, 100];
    }
    // SKENARIO 3: Pengiriman Transit Antar-Cabang (Unit Keluar + OKK)
    else if (!isMasuk && isOkk) {
      notifTab = 'inventory';
      notifTag = `transit-${vin}-${Date.now()}`;
      
      if (!isAdmin && userBranchCode === destCode) {
        // Bagi Petugas di Cabang Penerima (misal D660):
        title = `📍 Unit OTW ke ${destCode}: ${model}`;
        body = `VIN: ${vin} dari ${originCode || 'Asal'}\nMohon bersiap di pos gerbang penerimaan.`;
        vibratePattern = [300, 150, 300, 150, 300];
      } else if (!isAdmin && userBranchCode === originCode) {
        // Bagi Petugas di Cabang Pengirim (misal D661):
        title = `🚛 Unit Berangkat: ${model}`;
        body = `VIN: ${vin} menuju ${destCode || 'Tujuan'}\nStatus: Dalam perjalanan (Radar OKK).`;
        vibratePattern = [200, 100, 200];
      } else {
        // Bagi Administrator DSO (Akses Sentral):
        title = `🚛 Mutasi OKK: ${originCode || 'Asal'} ➔ ${destCode || 'Tujuan'}`;
        body = `${model} (${vin})\nPetugas: ${officer} • Menuju ${destCode || 'Tujuan'}.`;
        vibratePattern = [200, 100, 200];
      }
    }
    // SKENARIO 4: Penerimaan Transit Tiba (Unit Masuk + OKK)
    else if (isMasuk && isOkk) {
      notifTag = `arrival-${vin}-${Date.now()}`;

      if (!isAdmin && userBranchCode === originCode) {
        // Bagi Petugas Cabang Pengirim (konfirmasi unit tiba):
        title = `🏁 Unit Tiba di ${destCode || 'Tujuan'}: ${model}`;
        body = `VIN: ${vin} telah sampai dan diverifikasi dengan aman.`;
        notifTab = 'inventory';
        vibratePattern = [200, 100, 200];
      } else if (!isAdmin && userBranchCode === destCode) {
        // Bagi Petugas Cabang Penerima:
        title = `✅ Unit Diterima di Pool: ${model}`;
        body = `VIN: ${vin} dari ${originCode || 'Asal'}\nResmi diverifikasi masuk oleh ${officer}.`;
        notifTab = 'history';
        vibratePattern = [150, 100, 150];
      } else {
        // Bagi Admin DSO:
        title = `✅ OKK Selesai: Tiba di ${destCode || branchLabel.split('-')[0].trim()}`;
        body = `${model} (${vin}) dari ${originCode || 'Asal'} resmi diverifikasi.`;
        notifTab = 'history';
        vibratePattern = [150, 100, 150];
      }
    }
    // SKENARIO 5: Mutasi Standar Harian (Unit Masuk / Keluar biasa SPPDC / BSTKB)
    else {
      if (isMasuk) {
        title = `🚘 Unit Masuk: ${model}`;
        body = `VIN: ${vin} • ${displayBranch}\nDokumen ${docType} • Petugas: ${officer}`;
        vibratePattern = [150, 100, 150];
      } else {
        title = `🚛 Unit Keluar: ${model}`;
        body = `VIN: ${vin} • ${displayBranch}\nDokumen ${docType} • Petugas: ${officer}`;
        vibratePattern = [200, 100, 200, 100];
      }
      notifTag = `mutasi-${record.id || vin}`;
      notifTab = 'history';
    }

    this.show(title, {
      body: body,
      icon: unitPhotoThumbnail,
      badge: './assets/icons/badge-icon.png',
      tag: notifTag,
      tab: notifTab,
      data: { url: './', tab: notifTab, id: record.id },
      vibrate: vibratePattern
    });
  },

  /**
   * Pengecekan mutasi baru saat background sync berlangsung
   */
  checkNewMutationsAndNotify(historyList) {
    if (!Array.isArray(historyList) || !this.isGranted() || historyList.length === 0) return;

    // Jika ini inisialisasi awal (set masih kosong), tandai seluruh riwayat yang ada sebagai sudah dilihat
    if (this._seenHistoryIds.size === 0) {
      historyList.forEach(item => {
        const key = item.id || `${item.vin}_${item.type}_${item.timestamp}`;
        this._seenHistoryIds.add(key);
      });
      this._persistSeenMutations();
      return;
    }

    const now = Date.now();
    const maxAgeMs = 15 * 60 * 1000; // 15 menit batas kadaluarsa notifikasi

    // Ambil 5 transaksi terbaru
    const recent = historyList.slice(0, 5);
    recent.forEach(item => {
      const key = item.id || `${item.vin}_${item.type}_${item.timestamp}`;
      if (!this._seenHistoryIds.has(key)) {
        this._seenHistoryIds.add(key);

        // Validasi waktu kejadian: Abaikan jika transaksi terjadi lebih dari 15 menit lalu
        let itemTimeMs = 0;
        if (item.timestamp) {
          const t = new Date(item.timestamp).getTime();
          if (!isNaN(t)) itemTimeMs = t;
        }
        if (itemTimeMs > 0 && Math.abs(now - itemTimeMs) > maxAgeMs) {
          return;
        }

        this.notifyMutation(item);
      }
    });

    this._persistSeenMutations();
  },

  /**
   * Pengecekan Keterlambatan Pengiriman Unit OKK (In-Transit Radar)
   * Terpicu otomatis jika waktu tempuh in-transit melebihi target durasi SLA per cabang.
   * Filter RBAC:
   * - Admin: Mengetahui keterlambatan di seluruh cabang.
   * - Security: Hanya jika unit berasal dari atau menuju ke cabangnya.
   */
  checkDelaysAndNotify() {
    if (!this.isGranted() || typeof AppState === 'undefined' || typeof AppState.getInTransitUnits !== 'function') return;

    const inTransit = AppState.getInTransitUnits() || [];
    const isAdmin = typeof AppState.isAdmin === 'function' ? AppState.isAdmin() : true;
    const userBranchCode = typeof AppState.getUserBranchCode === 'function' ? AppState.getUserBranchCode() : 'D660';

    // Bersihkan unit yang sudah sampai di tujuan dari tracking notifikasi keterlambatan
    const activeVins = new Set(inTransit.map(u => String(u.vin || '').toUpperCase()));
    let delayMapCleaned = false;
    for (const vin of this._notifiedDelayMap.keys()) {
      if (!activeVins.has(vin.toUpperCase())) {
        this._notifiedDelayMap.delete(vin);
        delayMapCleaned = true;
      }
    }
    if (delayMapCleaned) this._persistNotifiedDelays();

    inTransit.forEach(unit => {
      if (!unit || !unit.isDelayed) return;

      // Filter hak akses peran (Admin vs Security)
      if (!isAdmin) {
        const isOriginMatch = unit.originCode === userBranchCode || (unit.originBranch && unit.originBranch.includes(userBranchCode));
        const isDestMatch = unit.destinationCode === userBranchCode || (unit.destinationBranch && unit.destinationBranch.includes(userBranchCode));
        if (!isOriginMatch && !isDestMatch) return; // Bukan urusan cabang ini
      }

      // Hindari spam: jangan kirim berulang-ulang untuk VIN yang sama dalam rentang 15 menit
      const lastNotified = this._notifiedDelayMap.get(unit.vin);
      const nowMs = Date.now();
      if (lastNotified && (nowMs - lastNotified < 15 * 60 * 1000)) {
        return;
      }

      this._notifiedDelayMap.set(unit.vin, nowMs);
      this._persistNotifiedDelays();

      const title = `⚠️ Keterlambatan Transit: ${unit.model}`;
      const body = `VIN: ${unit.vin} menuju ${unit.destinationCode || unit.destinationBranch.split('-')[0].trim()} (${unit.elapsedHuman})\n${unit.etaStatus} • Harap hubungi pengemudi/pos.`;
      const unitPhoto = this.resolveUnitPhoto(unit, unit.model);

      this.show(title, {
        body: body,
        icon: unitPhoto,
        badge: './assets/icons/badge-icon.png',
        tag: `delay-${unit.vin}`,
        tab: 'inventory',
        data: { url: './', tab: 'inventory', mode: 'branch' },
        vibrate: [300, 150, 300, 150, 300],
        requireInteraction: true
      });
    });
  },

  /**
   * Notifikasi Rekapitulasi Laporan Harian Email Berhasil Terkirim
   */
  notifyDailyReport(reportLog) {
    if (!reportLog || !this.isGranted()) return;

    if (reportLog.id) {
      this._seenReportIds.add(reportLog.id);
      this._persistSeenReports();
    }

    const title = `📊 Rekap Mutasi Harian Terkirim`;
    const body = `Total ${reportLog.totalUnits || 0} Unit (${reportLog.masuk || 0} Masuk, ${reportLog.keluar || 0} Keluar)\nLaporan PDF & Excel berhasil terkirim ke email manajemen.`;

    this.show(title, {
      body: body,
      icon: './assets/icons/icon-apk.png',
      badge: './assets/icons/badge-icon.png',
      tag: `report-${reportLog.id || Date.now()}`,
      tab: 'settings',
      data: { url: './', tab: 'settings' },
      vibrate: [200, 150, 200]
    });
  },

  /**
   * Pengecekan report logs baru dari backend
   * Validasi realtime ketat (Freshness check) agar tidak memunculkan notifikasi palsu saat awal buka aplikasi.
   */
  checkNewReportLogsAndNotify(reportLogs) {
    if (!Array.isArray(reportLogs) || !this.isGranted() || reportLogs.length === 0) return;

    // Jika ini inisialisasi awal (set masih kosong), tandai seluruh report log yang ada sebagai sudah dilihat
    if (this._seenReportIds.size === 0) {
      reportLogs.forEach(r => {
        if (r && r.id) this._seenReportIds.add(r.id);
      });
      this._persistSeenReports();
      return;
    }

    const latest = reportLogs[0];
    if (!latest || !latest.id) return;

    // Lewati jika sudah pernah dinotifikasikan
    if (this._seenReportIds.has(latest.id)) return;

    // Tandai langsung ke set & localStorage agar tidak terpicu ganda
    this._seenReportIds.add(latest.id);
    this._persistSeenReports();

    // Filter status: HANYA notifikasi jika pengiriman email berstatus SUCCESS
    const status = String(latest.status || '').toUpperCase();
    if (status !== 'SUCCESS' && status !== 'TERKIRIM') {
      return;
    }

    // VALIDASI REALTIME KETAT (Freshness Check):
    // Notifikasi mobile HANYA BOLEH ditembakkan jika laporan benar-benar baru dikirim dalam 15 menit terakhir!
    // Mencegah log riwayat lama (kemarin atau jam lalu) memicu notifikasi palsu saat aplikasi baru dibuka.
    let logTimeMs = 0;
    if (latest.timestampIso) {
      const t = new Date(latest.timestampIso).getTime();
      if (!isNaN(t)) logTimeMs = t;
    } else if (latest.timestamp) {
      const t = Date.parse(latest.timestamp);
      if (!isNaN(t)) logTimeMs = t;
    }

    const now = Date.now();
    const maxAgeMs = 15 * 60 * 1000; // 15 menit batas waktu realtime

    if (logTimeMs > 0) {
      const ageMs = Math.abs(now - logTimeMs);
      if (ageMs > maxAgeMs) {
        console.log(`[NotificationService] Report log ${latest.id} dilewati karena data lama (${Math.round(ageMs / 60000)} menit lalu).`);
        return;
      }
    }

    // Eksekusi notifikasi realtime jika benar-benar baru terkirim
    this.notifyDailyReport(latest);
  },

  /**
   * Tombol Tes Notifikasi Android
   */
  async testNotification() {
    if (!this.isGranted()) {
      const granted = await this.requestPermission();
      if (!granted) return;
    }

    const isAdmin = typeof AppState !== 'undefined' && typeof AppState.isAdmin === 'function' ? AppState.isAdmin() : true;
    const userRole = isAdmin ? 'Administrator DSO (Semua Cabang)' : `Security (${AppState.getUserBranchCode ? AppState.getUserBranchCode() : 'Cabang'})`;

    return this.show('🚗 Tes Notifikasi Stockyard Android', {
      body: `Notifikasi sistem aktif untuk akun: ${userRole}. Anda siap menerima peringatan mutasi, keterlambatan, dan laporan.`,
      tag: 'test-notification-' + Date.now(),
      tab: 'dashboard',
      vibrate: [200, 100, 200, 100, 200]
    });
  },

  updateUIStatus() {
    const statusText = document.getElementById('androidNotifStatusText');
    const statusDot = document.getElementById('androidNotifStatusDot');
    const btnEnable = document.getElementById('btnEnableAndroidNotif');
    const perm = this.getPermission();

    if (statusText) {
      if (perm === 'granted') {
        statusText.textContent = 'Aktif (Diizinkan)';
        statusText.className = 'text-[10.5px] font-extrabold text-emerald-700';
      } else if (perm === 'denied') {
        statusText.textContent = 'Diblokir di Browser';
        statusText.className = 'text-[10.5px] font-extrabold text-rose-700';
      } else {
        statusText.textContent = 'Belum Aktif (Perlu Izin)';
        statusText.className = 'text-[10.5px] font-extrabold text-amber-700';
      }
    }

    if (statusDot) {
      if (perm === 'granted') {
        statusDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
      } else if (perm === 'denied') {
        statusDot.className = 'w-2 h-2 rounded-full bg-rose-500';
      } else {
        statusDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
      }
    }

    if (btnEnable) {
      if (perm === 'granted') {
        btnEnable.classList.add('hidden');
      } else {
        btnEnable.classList.remove('hidden');
      }
    }

    const banner = document.getElementById('androidNotifPermissionBanner');
    if (banner) {
      if (perm === 'granted' || perm === 'denied') {
        banner.classList.add('hidden');
      } else {
        banner.classList.remove('hidden');
      }
    }
  },

  _persistSeenMutations() {
    try {
      const arr = Array.from(this._seenHistoryIds).slice(-100); // Simpan 100 ID terakhir
      localStorage.setItem(this.STORAGE_KEY_SEEN_MUTATIONS, JSON.stringify(arr));
    } catch (e) {}
  },

  _persistSeenReports() {
    try {
      const arr = Array.from(this._seenReportIds).slice(-100); // Simpan 100 ID laporan terakhir
      localStorage.setItem(this.STORAGE_KEY_SEEN_REPORTS, JSON.stringify(arr));
    } catch (e) {}
  },

  _persistNotifiedDelays() {
    try {
      const obj = {};
      this._notifiedDelayMap.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(this.STORAGE_KEY_NOTIFIED_DELAYS, JSON.stringify(obj));
    } catch (e) {}
  }
};

window.NotificationService = NotificationService;
