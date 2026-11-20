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
  STORAGE_KEY_NOTIFIED_DELAYS: 'daihatsu_notified_delays',

  init() {
    if (this._initialized) return;
    this._initialized = true;

    // Muat ID mutasi yang telah dilihat agar tidak memunculkan notifikasi riwayat lama saat awal buka aplikasi
    try {
      const storedSeen = localStorage.getItem(this.STORAGE_KEY_SEEN_MUTATIONS);
      if (storedSeen) {
        const arr = JSON.parse(storedSeen);
        if (Array.isArray(arr)) {
          arr.forEach(id => this._seenHistoryIds.add(id));
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

    // Inisialisasi awal ID mutasi dari AppState saat ini
    if (typeof AppState !== 'undefined' && Array.isArray(AppState.historyData)) {
      AppState.historyData.forEach(h => {
        if (h && (h.id || h.vin)) {
          this._seenHistoryIds.add(h.id || `${h.vin}_${h.type}_${h.timestamp}`);
        }
      });
      this._persistSeenMutations();
    }

    // Perbarui status UI di halaman pengaturan
    this.updateUIStatus();

    // Pasang listener pesan dari Service Worker (untuk navigasi tab saat notifikasi diketuk)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.action === 'SWITCH_TAB' && event.data.tab) {
          if (typeof UI !== 'undefined' && typeof UI.switchTab === 'function') {
            UI.switchTab(event.data.tab);
          }
        }
      });
    }

    // Jalankan pengecekan berkala keterlambatan SLA perjalanan unit in-transit (setiap 60 detik)
    setInterval(() => {
      if (this.isGranted()) {
        this.checkDelaysAndNotify();
      }
    }, 60000);

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
      badge: options.badge || './assets/icons/icon-apk.png',
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
   * Notifikasi Scan Unit Masuk / Keluar Baru & Transit Antar-Cabang (OKK)
   * Filter RBAC & Skenario:
   * 1. Mutasi Scan Masuk/Keluar biasa (SPPDC/BSTKB):
   *    - Admin: Menerima mutasi seluruh cabang.
   *    - Security: Hanya menerima mutasi untuk cabangnya sendiri.
   * 2. Transit Antar-Cabang (OKK Keluar / OTW):
   *    - Cabang Asal (misal D661): Menerima notif "Unit Dalam Perjalanan (Transit OKK)"
   *    - Cabang Tujuan (misal D660): Menerima notif "Unit OTW Menuju Cabang Anda!"
   *    - Admin DSO: Menerima notif "Mutasi OKK Antar-Cabang (D661 -> D660)"
   * 3. Kedatangan Transit (OKK Masuk di Pos Tujuan):
   *    - Cabang Penerima (D660): Menerima notif "Unit OKK Berhasil Diterima di Pool!"
   *    - Cabang Pengirim (D661): Menerima notif "Unit Transit Tiba di Tujuan!"
   *    - Admin DSO: Menerima notif "OKK Selesai: Tiba di D660"
   */
  notifyMutation(record) {
    if (!record || !this.isGranted()) return;

    const isAdmin = typeof AppState !== 'undefined' && typeof AppState.isAdmin === 'function' ? AppState.isAdmin() : true;
    const userBranchCode = typeof AppState !== 'undefined' && typeof AppState.getUserBranchCode === 'function' ? AppState.getUserBranchCode() : 'D660';
    const recBranch = record.noBa || record.branch || record.location || '';
    const destBranch = record.destinationBranch || record.destination || '';
    const originCode = (recBranch.match(/D66[0-4]/i)?.[0] || '').toUpperCase();
    const destCode = (destBranch.match(/D66[0-4]/i)?.[0] || '').toUpperCase();

    const type = record.type || record.mutationType || 'Unit Masuk';
    const isMasuk = type === 'Unit Masuk' || type.toLowerCase().includes('masuk');
    const docType = String(record.docType || record.documentType || 'SPPDC').toUpperCase();
    const isOkk = docType === 'OKK';
    const model = record.model || 'Unit Kendaraan';
    const vin = record.vin || '-';
    const officer = record.officerName || record.pic || 'Petugas Lapangan';
    const branchLabel = record.noBa || record.branch || 'Stockyard';

    // Evaluasi Otorisasi & Peran
    if (!isAdmin) {
      if (isOkk) {
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

    // SKENARIO 1: Pengiriman Transit Antar-Cabang (Unit Keluar + OKK)
    if (!isMasuk && isOkk) {
      notifTab = 'inventory';
      notifTag = `transit-${vin}-${Date.now()}`;
      
      if (!isAdmin && userBranchCode === destCode) {
        // Bagi Petugas di Cabang Penerima (misal D660):
        title = `📍 Unit OTW Menuju Cabang Anda!`;
        body = `Unit ${model} (${vin}) sedang dikirim dari ${originCode || branchLabel} menuju cabang Anda (${destCode}). Siapkan gerbang penerimaan!`;
        vibratePattern = [300, 150, 300, 150, 300]; // Getar lebih tegas agar security sigap di gerbang
      } else if (!isAdmin && userBranchCode === originCode) {
        // Bagi Petugas di Cabang Pengirim (misal D661):
        title = `🚛 Unit Dalam Perjalanan (Transit OKK)`;
        body = `Unit ${model} (${vin}) resmi diberangkatkan menuju ${destCode || destBranch}.\nStatus: Dalam Perjalanan (Radar In-Transit).`;
        vibratePattern = [200, 100, 200];
      } else {
        // Bagi Administrator DSO (Akses Sentral):
        title = `🚛 Mutasi OKK Antar-Cabang (${originCode || 'Asal'} ➔ ${destCode || 'Tujuan'})`;
        body = `Unit ${model} (${vin}) diberangkatkan oleh ${officer} dari ${originCode} menuju ${destCode}. Pantau di Radar Logistik OKK.`;
        vibratePattern = [200, 100, 200];
      }
    }
    // SKENARIO 2: Penerimaan Transit Tiba (Unit Masuk + OKK)
    else if (isMasuk && isOkk) {
      notifTag = `arrival-${vin}-${Date.now()}`;

      if (!isAdmin && userBranchCode === originCode) {
        // Bagi Petugas Cabang Pengirim (mendapat konfirmasi bahwa unit yang dikirim sudah sampai):
        title = `🏁 Unit Transit Tiba di Tujuan!`;
        body = `Unit ${model} (${vin}) yang Anda kirim dari ${originCode} telah diverifikasi tiba oleh petugas ${destCode || branchLabel}.`;
        notifTab = 'inventory';
        vibratePattern = [200, 100, 200];
      } else if (!isAdmin && userBranchCode === destCode) {
        // Bagi Petugas Cabang Penerima:
        title = `✅ Unit OKK Berhasil Diterima di Pool!`;
        body = `Unit ${model} (${vin}) dari ${originCode || 'asal'} resmi diverifikasi masuk database ${branchLabel}. Stok fisik bertambah.`;
        notifTab = 'history';
        vibratePattern = [150, 100, 150];
      } else {
        // Bagi Admin DSO:
        title = `✅ OKK Selesai: Tiba di ${destCode || branchLabel}`;
        body = `Unit ${model} (${vin}) dari ${originCode || 'Asal'} resmi tiba dan diverifikasi masuk. Mutasi transit selesai.`;
        notifTab = 'history';
        vibratePattern = [150, 100, 150];
      }
    }
    // SKENARIO 3: Mutasi Standar Harian (Unit Masuk / Keluar biasa SPPDC / BSTKB)
    else {
      if (isMasuk) {
        title = `🚘 Unit Masuk Berhasil Tersimpan`;
        body = `${branchLabel} • ${model} (${vin})\nDokumen: ${docType} • Petugas: ${officer}\n✓ Tersimpan di Google Spreadsheet & Drive`;
        vibratePattern = [150, 100, 150];
      } else {
        title = `🚛 Unit Keluar Berhasil Tersimpan`;
        body = `${branchLabel} • ${model} (${vin})\nDokumen: ${docType} • Petugas: ${officer}\n✓ Tersimpan di Google Spreadsheet & Drive`;
        vibratePattern = [200, 100, 200, 100];
      }
      notifTag = `mutasi-${record.id || vin}`;
      notifTab = 'history';
    }

    this.show(title, {
      body: body,
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
    if (!Array.isArray(historyList) || !this.isGranted()) return;

    // Ambil 5 transaksi terbaru
    const recent = historyList.slice(0, 5);
    recent.forEach(item => {
      const key = item.id || `${item.vin}_${item.type}_${item.timestamp}`;
      if (!this._seenHistoryIds.has(key)) {
        this._seenHistoryIds.add(key);
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

    inTransit.forEach(unit => {
      if (!unit || !unit.isDelayed) return;

      // Filter hak akses peran (Admin vs Security)
      if (!isAdmin) {
        const isOriginMatch = unit.originCode === userBranchCode || (unit.originBranch && unit.originBranch.includes(userBranchCode));
        const isDestMatch = unit.destinationCode === userBranchCode || (unit.destinationBranch && unit.destinationBranch.includes(userBranchCode));
        if (!isOriginMatch && !isDestMatch) return; // Bukan urusan cabang ini
      }

      // Hindari spam: jangan kirim berulang-ulang untuk VIN yang sama dalam rentang 30 menit
      const lastNotified = this._notifiedDelayMap.get(unit.vin);
      const nowMs = Date.now();
      if (lastNotified && (nowMs - lastNotified < 30 * 60 * 1000)) {
        return;
      }

      this._notifiedDelayMap.set(unit.vin, nowMs);
      this._persistNotifiedDelays();

      const title = `⚠️ Peringatan Keterlambatan OKK!`;
      const body = `Unit ${unit.model} (${unit.vin}) melebihi SLA transit menuju ${unit.destinationBranch.split('-')[1] || unit.destinationBranch}.\n${unit.etaStatus} • Tolong hubungi pengemudi/pos tujuan.`;

      this.show(title, {
        body: body,
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

    const title = `📊 Rekapitulasi Mutasi Harian Terkirim!`;
    const body = `Laporan harian (${reportLog.totalUnits || 0} Unit: ${reportLog.masuk || 0} Masuk, ${reportLog.keluar || 0} Keluar) resmi terkirim ke email target. Berkas PDF & Excel telah tersinkronisasi.`;

    this.show(title, {
      body: body,
      tag: `report-${reportLog.id || Date.now()}`,
      tab: 'settings',
      data: { url: './', tab: 'settings' },
      vibrate: [200, 150, 200]
    });
  },

  /**
   * Pengecekan report logs baru dari backend
   */
  checkNewReportLogsAndNotify(reportLogs) {
    if (!Array.isArray(reportLogs) || !this.isGranted()) return;
    const latest = reportLogs[0];
    if (latest && latest.id && !this._seenReportIds.has(latest.id)) {
      this._seenReportIds.add(latest.id);
      this.notifyDailyReport(latest);
    }
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

  _persistNotifiedDelays() {
    try {
      const obj = {};
      this._notifiedDelayMap.forEach((v, k) => { obj[k] = v; });
      localStorage.setItem(this.STORAGE_KEY_NOTIFIED_DELAYS, JSON.stringify(obj));
    } catch (e) {}
  }
};

window.NotificationService = NotificationService;
