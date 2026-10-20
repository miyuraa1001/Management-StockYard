/**
 * ============================================================================
 * Application Bootstrap & Controller - Daihatsu Vehicle Logistics Tracker
 * ============================================================================
 * Mengorkestrasi siklus hidup aplikasi, inisialisasi modul, sinkronisasi backend,
 * dan penanganan form verifikasi mutasi.
 */

const App = {
  /**
   * Titik masuk utama aplikasi saat halaman selesai dimuat
   */
  async init() {
    console.log('[App] Memulai Management StockYard (Astra Daihatsu DSO Lampung)...');

    // 1. Inisialisasi dropdown tanggal filter riwayat
    UI.populateDateDropdown();

    // 2. Muat data cache lokal jika tersedia
    AppState.loadFromCache();

    // Terapkan data profil operator & info otomatisasi
    if (UI.applyUserProfile) UI.applyUserProfile();
    if (UI.applyAutomationConfig) UI.applyAutomationConfig();
    if (UI.syncSettingsPreferences) UI.syncSettingsPreferences();

    // 3. Render awal komponen UI dari state
    if (typeof UI.initDashboardDateFilter === 'function') {
      UI.initDashboardDateFilter();
    } else {
      UI.renderDashboardActivities();
      UI.updateDashboardKpis();
    }
    UI.renderInventoryList();
    UI.renderHistoryList();
    UI.initHeroCarousel();
    if (UI.initPullToRefresh) UI.initPullToRefresh();

    // 4. Sinkronisasi data real-time dari Google Spreadsheet (Initial Sync)
    this.syncBackendData();

    // 5. Mulai Realtime Polling Timer (Interval sinkronisasi background)
    this.startRealtimeSync();

    // 6. Setup event listener koneksi online/offline & focus/visibility
    window.addEventListener('online', () => {
      AppState.isOnline = true;
      UI.showToast('🟢 Terhubung kembali ke jaringan');
      this.syncBackendData();
    });

    window.addEventListener('offline', () => {
      AppState.isOnline = false;
      UI.showToast('🟡 Mode offline aktif (Data tersimpan di perangkat)');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && AppState.isOnline) {
        this.syncBackendData(true);
      }
    });

    window.addEventListener('focus', () => {
      if (AppState.isOnline) {
        this.syncBackendData(true);
      }
    });
  },

  /**
   * Timer sinkronisasi otomatis realtime di background
   */
  _realtimeTimer: null,
  startRealtimeSync() {
    if (this._realtimeTimer) clearInterval(this._realtimeTimer);
    const intervalMs = (window.CONFIG && CONFIG.REALTIME_SYNC_INTERVAL) ? CONFIG.REALTIME_SYNC_INTERVAL : 15000;
    this._realtimeTimer = setInterval(() => {
      if (AppState.isOnline && !AppState.isLoading && !document.hidden) {
        this.syncBackendData(true);
      }
    }, intervalMs);
  },

  /**
   * Sinkronisasi data dari Google Spreadsheet via ApiService secara realtime
   */
  async syncBackendData(isSilent = false) {
    try {
      const isUpdated = await ApiService.fetchInitialData();
      if (isUpdated) {
        if (typeof UI.applyDashboardDateFilter === 'function') {
          UI.applyDashboardDateFilter();
        } else {
          UI.renderDashboardActivities();
          UI.updateDashboardKpis();
        }
        UI.renderInventoryList();
        UI.renderHistoryList();
        if (UI.applyUserProfile) UI.applyUserProfile();
        if (UI.applyAutomationConfig) UI.applyAutomationConfig();
        if (AppState.selectedModelCatalogId && typeof UI.renderModelDetailTable === 'function') {
          UI.renderModelDetailTable();
        }
        console.log('[App] Berhasil sinkronisasi data dari Google Spreadsheet secara realtime');
      }
    } catch (err) {
      console.warn('[App] Gagal sinkronisasi ke server Google Apps Script:', err);
    }
  },

  /**
   * Menyimpan dan memverifikasi data mutasi fisik kendaraan
   */
  async saveMutationData() {
    const vin = (document.getElementById('inputVin')?.value || document.getElementById('scanVinInput')?.value || '').trim();
    const engine = (document.getElementById('inputEngine')?.value || document.getElementById('scanEngineInput')?.value || '').trim();
    const mutationType = document.getElementById('inputMutationType')?.value;
    const model = document.getElementById('inputCarModel')?.value;
    const notes = document.getElementById('inputKeterangan')?.value.trim();

    if (!vin || !engine) {
      UI.showToast('Harap isi nomor VIN dan nomor mesin!');
      return;
    }

    const cleanVin = vin.trim().toUpperCase();
    const cleanEngine = engine.trim().toUpperCase();
    const currentStatus = typeof AppState.getUnitCurrentStatus === 'function' ? AppState.getUnitCurrentStatus(cleanVin, cleanEngine) : null;
    const isInYard = typeof AppState.isUnitCurrentlyInYard === 'function' ? AppState.isUnitCurrentlyInYard(cleanVin, cleanEngine) : (currentStatus ? currentStatus.type === 'Unit Masuk' : false);

    // Validasi Duplikat: Jika unit saat ini masih berada di dalam Stockyard dan dipilih 'Unit Masuk', TOLAK SIMPAN!
    if (isInYard && mutationType === 'Unit Masuk') {
      if (typeof ScannerService !== 'undefined') {
        ScannerService.playWarningBeep();
        ScannerService.triggerWarningHaptic();
      }
      UI.showToast(`⛔ Unit Masuk Ditolak! Unit [${cleanVin}] sudah tercatat berada di stockyard pada ${currentStatus?.date || ''}. Tidak bisa menyimpan duplikat Unit Masuk. Silakan pilih 'Unit Keluar'.`, 6000);
      if (typeof window.validateMutationFormDuplication === 'function') {
        window.validateMutationFormDuplication();
      }
      const alertContainer = document.getElementById('mutationDuplicateAlert');
      if (alertContainer) {
        alertContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const catalogItem = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(model) : null;
    const modelOfficialPhoto = catalogItem ? catalogItem.photo : 'assets/images/Inventory_Gran Max Pick Up.jpeg';
    const unitImg = AppState.uploadedUnitPhotoUrl || modelOfficialPhoto;
    const docImg = AppState.uploadedDocPhotoUrl || '';

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const timeFormatted = `${hours}:${minutes} WIB`;

    const newRecord = {
      id: 'MUT-' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + hours + minutes + String(now.getSeconds()).padStart(2, '0'),
      type: mutationType,
      time: timeFormatted,
      date: dateFormatted,
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      timestamp: now.toISOString(),
      fullDateStr: `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`,
      model: model,
      modelPhoto: modelOfficialPhoto,
      vin: cleanVin,
      engine: cleanEngine,
      pic: AppState.userProfile?.name || CONFIG.OPERATOR_NAME || 'Andi Pratama',
      picNpk: AppState.userProfile?.npk || CONFIG.OPERATOR_NPK || '-',
      location: AppState.userProfile?.branch || CONFIG.BRANCH_NAME || 'Sentra Lampung DSO',
      notes: notes || 'Pemeriksaan standar serah terima unit di lapangan.',
      unitPhoto: unitImg,
      docPhoto: docImg
    };

    // Optimistic UI Update: masukkan ke state lokal segera & amankan ke cache
    AppState.historyData.unshift(newRecord);
    AppState.saveToCache();

    // Update status di Inventory jika ada unit dengan VIN yang sama
    const existingInv = AppState.inventoryData.find(item => item.vin === cleanVin);
    if (existingInv) {
      existingInv.status = mutationType === 'Unit Masuk' ? 'Tersedia' : 'Keluar';
      existingInv.photo = modelOfficialPhoto;
      existingInv.docPhoto = docImg;
    } else {
      // Jika belum ada di inventory dan jenis mutasi adalah Unit Masuk, tambahkan ke inventory
      if (mutationType === 'Unit Masuk') {
        AppState.inventoryData.unshift({
          id: 'INV-' + Date.now().toString().slice(-4),
          model: catalogItem ? catalogItem.model : model,
          category: catalogItem ? catalogItem.category : 'Kendaraan Daihatsu',
          plate: '-',
          vin: cleanVin,
          engine: engine.toUpperCase(),
          status: 'Tersedia',
          location: catalogItem ? catalogItem.defaultLocation : 'Yard A - Receiving Bay',
          photo: modelOfficialPhoto,
          docPhoto: docImg
        });
      }
    }

    // Update KPI Counters secara dinamis dari data realtime
    AppState.updateKpiCounts();

    // Reset Form Input
    const keteranganEl = document.getElementById('inputKeterangan');
    if (keteranganEl) keteranganEl.value = '';
    UI.removeImagePreview('unitPhoto');
    UI.removeImagePreview('docPhoto');

    // Tutup Scanner Modal & Notifikasi Awal
    ScannerService.close();
    UI.showToast('⏳ Menyimpan mutasi ke Google Spreadsheet & Drive...', 2500);

    // Refresh UI & ganti tab ke Riwayat
    if (typeof UI.applyDashboardDateFilter === 'function') {
      UI.applyDashboardDateFilter();
    } else {
      UI.updateDashboardKpis();
      UI.renderDashboardActivities();
    }
    UI.renderInventoryList();
    UI.renderHistoryList();

    setTimeout(() => {
      UI.switchTab('history');
    }, 400);

    // Background Async: Kirim data ke Google Spreadsheet backend & verifikasi pengiriman email realtime
    try {
      const response = await ApiService.saveMutation(newRecord);
      const targetEmail = AppState.automationConfig?.email || 'admin.logistics@daihatsu.co.id';
      const nowFormatted = new Date().toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }) + ' WIB';

      if (response && response.success && !response.isFallback && !response.isOffline) {
        console.log('[App] Data mutasi berhasil tersinkron ke Google Spreadsheet backend:', response);

        // Evaluasi status pengiriman notifikasi email realtime
        const mailStatus = response.mailStatus;
        const isMailSuccess = mailStatus && (mailStatus.success === true || mailStatus.mode);

        // Catat ke riwayat log notifikasi frontend agar user tahu status pengiriman realtime
        const notifLog = {
          id: 'mail-' + (response.transactionId || Date.now()),
          trxId: response.transactionId || newRecord.id,
          timestamp: nowFormatted,
          targetEmail: targetEmail,
          status: isMailSuccess ? 'SUCCESS' : (mailStatus ? 'FAILED' : 'NO_CONFIG'),
          category: 'MUTATION',
          mutationType: newRecord.type, // 'Unit Masuk' atau 'Unit Keluar'
          model: newRecord.model,
          vin: newRecord.vin,
          subject: `[STOCKYARD REALTIME] ${newRecord.type}: ${newRecord.model} (${newRecord.vin})`,
          message: isMailSuccess
            ? `Notifikasi email mutasi ${newRecord.type} (${newRecord.model} • ${newRecord.vin}) berhasil dikirimkan ke ${targetEmail} via ${mailStatus?.mode === 'reply' ? 'Thread Gmail Harian' : 'Layanan Gmail'}.`
            : (mailStatus?.error 
                ? `Mutasi tersimpan, namun gagal mengirim notifikasi email ke ${targetEmail}: ${mailStatus.error}` 
                : `Notifikasi email dinonaktifkan di konfigurasi sistem.`),
          read: false
        };

        if (typeof UI !== 'undefined' && typeof UI.recordEmailNotificationLog === 'function') {
          UI.recordEmailNotificationLog(notifLog);
        }

        if (isMailSuccess) {
          UI.showToast(`🎉 Data tersimpan di Spreadsheet & ✉️ Notifikasi ${newRecord.type} terkirim ke ${targetEmail}!`, 5000);
        } else if (mailStatus && mailStatus.error) {
          UI.showToast(`✅ Mutasi tersimpan di Spreadsheet, namun ⚠️ email notifikasi gagal: ${mailStatus.error}`, 5500);
        } else {
          UI.showToast('✅ Berhasil tersimpan ke Google Spreadsheet & Google Drive!', 4500);
        }

        // Segera sinkronkan ulang database agar chart donat & stok unit yard langsung terupdate
        this.syncBackendData();
      } else {
        const reason = response?.message || response?.error || 'URL Web App belum terhubung';
        console.warn('[App] Mutasi tersimpan lokal (belum ke database Google):', reason);

        // Catat log offline pending
        const offlineLog = {
          id: 'mail-offline-' + Date.now(),
          trxId: newRecord.id,
          timestamp: nowFormatted,
          targetEmail: targetEmail,
          status: 'PENDING_OFFLINE',
          category: 'MUTATION',
          mutationType: newRecord.type,
          model: newRecord.model,
          vin: newRecord.vin,
          subject: `[OFFLINE] ${newRecord.type}: ${newRecord.model} (${newRecord.vin})`,
          message: `Data tersimpan lokal di perangkat. Notifikasi email akan dikirimkan otomatis saat terhubung ke server Google.`,
          read: false
        };
        if (typeof UI !== 'undefined' && typeof UI.recordEmailNotificationLog === 'function') {
          UI.recordEmailNotificationLog(offlineLog);
        }

        UI.showToast('⚠️ Data tersimpan di HP/Lokal (Offline / Proxy Vercel sedang proses). Periksa koneksi atau redeploy Vercel jika variabel belum aktif.', 6000);
      }
    } catch (e) {
      console.warn('[App] Gagal mengirim mutasi ke server (tersimpan lokal):', e);
      UI.showToast('⚠️ Data tersimpan di HP/Lokal (Koneksi offline). Periksa jaringan Anda.', 5000);
    }
  }
};

// Global bridging function untuk form button onclick="saveMutationData()"
window.App = App;
window.saveMutationData = () => App.saveMutationData();

/**
 * Memvalidasi duplikasi status unit di form Step 2 secara realtime
 * Menolak duplikasi Unit Masuk jika unit sudah berada di stockyard,
 * namun MENGIZINKAN mutasi Unit Keluar untuk unit tersebut.
 */
window.validateMutationFormDuplication = function() {
  const vinInput = document.getElementById('inputVin')?.value || document.getElementById('scanVinInput')?.value || '';
  const engineInput = document.getElementById('inputEngine')?.value || document.getElementById('scanEngineInput')?.value || '';
  const cleanVin = String(vinInput).trim().toUpperCase();
  const cleanEngine = String(engineInput).trim().toUpperCase();
  const mutationType = document.getElementById('inputMutationType')?.value || 'Unit Masuk';

  const alertContainer = document.getElementById('mutationDuplicateAlert');
  const alertIcon = document.getElementById('mutationDuplicateIcon');
  const alertTitle = document.getElementById('mutationDuplicateTitle');
  const alertMsg = document.getElementById('mutationDuplicateMessage');
  const submitBtn = document.getElementById('btnSubmitMutation');
  const submitText = document.getElementById('btnSubmitMutationText');

  if (!alertContainer) return true;

  if (!cleanVin && !cleanEngine) {
    alertContainer.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.className = 'w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center space-x-2 active:scale-98 transition cursor-pointer';
    }
    if (submitText) {
      submitText.textContent = 'Simpan & Verifikasi';
    }
    return true;
  }

  const currentStatus = typeof AppState.getUnitCurrentStatus === 'function' ? AppState.getUnitCurrentStatus(cleanVin, cleanEngine) : null;
  const isInYard = typeof AppState.isUnitCurrentlyInYard === 'function' ? AppState.isUnitCurrentlyInYard(cleanVin, cleanEngine) : (currentStatus ? currentStatus.type === 'Unit Masuk' : false);

  if (isInYard && mutationType === 'Unit Masuk') {
    // KASUS DUPLIKAT DITOLAK: Unit sudah ada di dalam stockyard, tidak boleh didaftarkan Masuk lagi!
    alertContainer.className = 'mt-2.5 p-3 rounded-2xl border text-xs flex items-start space-x-2.5 transition-all bg-rose-50 border-rose-300 text-rose-900 shadow-sm animate-pulse';
    if (alertIcon) alertIcon.textContent = '⛔';
    if (alertTitle) {
      alertTitle.textContent = 'Duplikasi Unit Masuk Ditolak!';
      alertTitle.className = 'font-black text-xs leading-tight text-rose-800';
    }
    if (alertMsg) {
      alertMsg.innerHTML = `Nomor VIN <b>${cleanVin}</b> sudah pernah tercatat sebagai <b>Unit Masuk</b> di stockyard pada <i>${currentStatus?.date || 'sebelumnya'} ${currentStatus?.time || ''}</i> oleh PIC <i>${currentStatus?.pic || 'Petugas'}</i>.<br><span class="text-rose-700 font-bold">Peringatan:</span> Unit ini tidak bisa disimpan lagi sebagai 'Unit Masuk'. Silakan ubah Jenis Mutasi menjadi <b>'Unit Keluar'</b> jika unit ini akan dikeluarkan dari stockyard.`;
    }
    alertContainer.classList.remove('hidden');

    // Ubah tombol submit menjadi tombol peringatan merah yang interaktif
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.className = 'w-full py-3.5 bg-gradient-to-r from-rose-600 via-rose-700 to-rose-600 hover:from-rose-700 hover:to-rose-800 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-rose-500/30 flex items-center justify-center space-x-2 active:scale-98 transition cursor-pointer border border-rose-400/40';
    }
    if (submitText) {
      submitText.textContent = '⛔ Unit Masuk Duplikat (Ditolak Simpan)';
    }
    return false;
  } else if (isInYard && mutationType === 'Unit Keluar') {
    // KASUS VALID: Unit memang ada di yard dan siap dikeluarkan
    alertContainer.className = 'mt-2.5 p-3 rounded-2xl border text-xs flex items-start space-x-2.5 transition-all bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm';
    if (alertIcon) alertIcon.textContent = '✅';
    if (alertTitle) {
      alertTitle.textContent = 'Unit Terverifikasi untuk Dikeluarkan';
      alertTitle.className = 'font-black text-xs leading-tight text-emerald-800';
    }
    if (alertMsg) {
      alertMsg.innerHTML = `Unit <b>${cleanVin}</b> (${currentStatus?.model || 'Daihatsu'}) terkonfirmasi sedang berada di stockyard sejak <i>${currentStatus?.date || ''} ${currentStatus?.time || ''}</i>. Data valid untuk mutasi <b>Unit Keluar</b>.`;
    }
    alertContainer.classList.remove('hidden');

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.className = 'w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center space-x-2 active:scale-98 transition cursor-pointer';
    }
    if (submitText) {
      submitText.textContent = 'Simpan & Verifikasi Keluar';
    }
    return true;
  } else if (!isInYard && currentStatus && mutationType === 'Unit Keluar') {
    // Unit tercatat pernah keluar sebelumnya
    alertContainer.className = 'mt-2.5 p-3 rounded-2xl border text-xs flex items-start space-x-2.5 transition-all bg-amber-50 border-amber-300 text-amber-900 shadow-sm';
    if (alertIcon) alertIcon.textContent = '⚠️';
    if (alertTitle) {
      alertTitle.textContent = 'Catatan Riwayat Unit';
      alertTitle.className = 'font-black text-xs leading-tight text-amber-800';
    }
    if (alertMsg) {
      alertMsg.innerHTML = `Unit <b>${cleanVin}</b> terakhir tercatat berstatus <b>Unit Keluar</b> pada <i>${currentStatus?.date || ''}</i>. Pastikan fisik unit benar-benar ada di yard jika akan dikeluarkan lagi.`;
    }
    alertContainer.classList.remove('hidden');

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.className = 'w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center space-x-2 active:scale-98 transition cursor-pointer';
    }
    if (submitText) {
      submitText.textContent = 'Simpan & Verifikasi Keluar';
    }
    return true;
  } else {
    // Normal / Brand New Unit
    alertContainer.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.className = 'w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center space-x-2 active:scale-98 transition cursor-pointer';
    }
    if (submitText) {
      submitText.textContent = 'Simpan & Verifikasi';
    }
    return true;
  }
};

// Jalankan aplikasi saat dokumen siap
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

