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

    // Periksa status autentikasi sesi enterprise (Tampilkan portal login jika belum terautentikasi)
    if (!AppState.isAuthenticated) {
      if (typeof UI !== 'undefined' && UI.showLoginScreen) {
        UI.showLoginScreen();
      }
    }

    // Terapkan data profil operator & info otomatisasi
    if (UI.applyUserProfile) UI.applyUserProfile();
    if (UI.applyAutomationConfig) UI.applyAutomationConfig();
    if (UI.syncSettingsPreferences) UI.syncSettingsPreferences();

    // 3. Render awal komponen UI dari state
    if (typeof UI.initDashboardDateFilter === 'function') {
      UI.initDashboardDateFilter();
    }
    if (typeof UI.applyDashboardDateFilter === 'function') {
      UI.applyDashboardDateFilter();
    }
    UI.updateDashboardKpis();
    UI.renderDashboardActivities();
    UI.renderInventoryList();
    UI.renderHistoryList();
    UI.initHeroCarousel();
    if (UI.initPullToRefresh) UI.initPullToRefresh();
    if (typeof UI.syncAllFormTriggers === 'function') UI.syncAllFormTriggers();

    // 4. Pasang listener reaktif untuk validasi ketat formulir mutasi 11 kolom
    this.setupMutationFormListeners();

    // 5. Sinkronisasi data real-time dari Google Spreadsheet (Initial Sync)
    this.syncBackendData();

    // 6. Mulai Realtime Polling Timer (Interval sinkronisasi background)
    this.startRealtimeSync();

    // 7. Setup event listener koneksi online/offline & focus/visibility
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
   * Menghubungkan event listener reaktif pada 11 input formulir mutasi
   */
  setupMutationFormListeners() {
    const fieldIds = [
      'inputVin', 'scanVinInput', 'inputEngine', 'scanEngineInput',
      'inputMutationType', 'inputCarModel', 'inputCarColor', 'inputOfficerName',
      'inputNoBa', 'inputMutationDocType', 'inputKeterangan'
    ];
    fieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          if (typeof window.checkMutationFormCompleteness === 'function') {
            window.checkMutationFormCompleteness();
          }
        });
        el.addEventListener('change', () => {
          if (typeof window.checkMutationFormCompleteness === 'function') {
            window.checkMutationFormCompleteness();
          }
        });
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
        }
        UI.updateDashboardKpis();
        UI.renderDashboardActivities();
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
   * Flag penguncian (mutex lock) untuk mencegah submit ganda saat tombol ditekan berulang kali
   */
  _isSavingMutation: false,

  /**
   * Mengembalikan tombol Simpan & Verifikasi ke status aktif semula
   */
  resetSubmitMutationButton() {
    this._isSavingMutation = false;
    const submitBtn = document.getElementById('btnSubmitMutation');
    if (submitBtn) {
      submitBtn.innerHTML = `
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        <span id="btnSubmitMutationText">Simpan & Verifikasi</span>
      `;
    }
    if (typeof window.checkMutationFormCompleteness === 'function') {
      window.checkMutationFormCompleteness();
    }
  },

  /**
   * Menyimpan dan memverifikasi data mutasi fisik kendaraan
   */
  async saveMutationData() {
    // 1. Guard anti-klik ganda: jika sedang memproses simpan, cegah pemanggilan berulang
    if (this._isSavingMutation) {
      console.warn('[App] Proses simpan mutasi sedang berjalan, abaikan klik ganda.');
      return;
    }

    const vin = (document.getElementById('inputVin')?.value || document.getElementById('scanVinInput')?.value || '').trim();
    const engine = (document.getElementById('inputEngine')?.value || document.getElementById('scanEngineInput')?.value || '').trim();
    const mutationType = (document.getElementById('inputMutationType')?.value || 'Unit Masuk').trim();
    const docType = (document.getElementById('inputMutationDocType')?.value || 'SPPDC').trim();
    const model = (document.getElementById('inputCarModel')?.value || '').trim();
    const carColor = (document.getElementById('inputCarColor')?.value || '').trim();
    const officerName = (document.getElementById('inputOfficerName')?.value || '').trim();
    const noBaInput = (document.getElementById('inputNoBa')?.value || '').trim();
    const noBa = (!AppState.isAdmin() && AppState.getUserBranch) ? AppState.getUserBranch() : (noBaInput || 'D660 - Ahmad Yani');
    const notes = (document.getElementById('inputKeterangan')?.value || '').trim();
    const hasUnitPhoto = !!AppState.uploadedUnitPhotoUrl;
    const hasDocPhoto = !!AppState.uploadedDocPhotoUrl;
    const isOkkExit = mutationType === 'Unit Keluar' && docType === 'OKK';
    const destBranchInput = (document.getElementById('inputDestinationBranch')?.value || '').trim();
    const destinationBranch = isOkkExit ? (destBranchInput || 'D661 - Soekarno Hatta') : '-';

    // Strict validation: wajib kolom terisi lengkap (tidak boleh ada yang kosong)
    if (!vin || !engine || !mutationType || !model || !carColor || !officerName || !noBa || !docType || !hasUnitPhoto || !hasDocPhoto || !notes || (isOkkExit && !destinationBranch)) {
      let missingFields = [];
      if (!vin) missingFields.push('Nomor VIN');
      if (!engine) missingFields.push('Nomor Mesin');
      if (!mutationType) missingFields.push('Jenis Mutasi');
      if (!model) missingFields.push('Model Kendaraan');
      if (!carColor) missingFields.push('Warna Mobil');
      if (!officerName) missingFields.push('Nama Petugas Lapangan');
      if (!noBa) missingFields.push('Cabang');
      if (!docType) missingFields.push('Jenis Dokumen');
      if (isOkkExit && !destinationBranch) missingFields.push('Cabang Tujuan');
      if (!hasUnitPhoto) missingFields.push('Foto Fisik Unit');
      if (!hasDocPhoto) missingFields.push('Foto Dokumen');
      if (!notes) missingFields.push('Catatan Kondisi');
      UI.showToast(`⚠️ Lengkapi seluruh kolom formulir & foto! Kurang: ${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? '...' : ''}`, 4000);
      this.resetSubmitMutationButton();
      return;
    }

    const cleanVin = vin.toUpperCase();
    const cleanEngine = engine.toUpperCase();

    // Validasi siklus mutasi antar-cabang berdasarkan status transaksi terakhir (Last State)
    const evalRes = typeof AppState.evaluateMutationAllowed === 'function'
      ? AppState.evaluateMutationAllowed(cleanVin, cleanEngine, mutationType, noBa)
      : { allowed: true };

    if (!evalRes.allowed) {
      if (typeof ScannerService !== 'undefined') {
        ScannerService.playWarningBeep();
        ScannerService.triggerWarningHaptic();
      }
      UI.showToast(`⛔ Mutasi Ditolak! ${evalRes.reason}`, 6500);
      if (typeof window.checkMutationFormCompleteness === 'function') {
        window.checkMutationFormCompleteness();
      }
      const alertContainer = document.getElementById('mutationDuplicateAlert');
      if (alertContainer) {
        alertContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      this.resetSubmitMutationButton();
      return;
    }

    // 2. Kunci submit dan ubah tampilan tombol menjadi disabled & loading spinner
    this._isSavingMutation = true;
    const submitBtn = document.getElementById('btnSubmitMutation');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-60', 'pointer-events-none', 'cursor-not-allowed');
      submitBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span id="btnSubmitMutationText">Menyimpan & Memverifikasi...</span>
      `;
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
      color: carColor,
      officerName: officerName, // Nama Petugas Lapangan yang diketik (misal: "Rico")
      modelPhoto: modelOfficialPhoto,
      vin: cleanVin,
      engine: cleanEngine,
      noBa: noBa,
      pic: noBa || (AppState.getUserBranch ? AppState.getUserBranch() : null) || AppState.userProfile?.branch || AppState.userProfile?.name || 'Petugas Security', // PIC Security Cabang (misal: "D661 - Soekarno Hatta" / "D660 - Ahmad Yani")
      location: AppState.userProfile?.branch || CONFIG.BRANCH_NAME || 'Sentra Lampung DSO',
      notes: notes,
      unitPhoto: unitImg,
      docPhoto: docImg,
      docType: docType,
      destinationBranch: destinationBranch,
      destination: destinationBranch,
      cabangTujuan: destinationBranch,
      targetEmail: (AppState.getBranchTargetEmails(noBa) || []).join(', ')
    };

    // 3. Optimistic UI Update: masukkan ke state lokal jika belum ada entri yang sama
    const isAlreadyInHistory = AppState.historyData.some(h => 
      h.id === newRecord.id || 
      (h.vin === cleanVin && h.type === mutationType && Math.abs(new Date(h.timestamp || 0) - now) < 20000)
    );
    if (!isAlreadyInHistory) {
      AppState.historyData.unshift(newRecord);
      AppState.saveToCache();
    }

    // Update status di Inventory jika ada unit dengan VIN yang sama
    const existingInv = AppState.inventoryData.find(item => item.vin === cleanVin);
    if (existingInv) {
      existingInv.status = mutationType === 'Unit Masuk' ? 'Tersedia' : 'Keluar';
      existingInv.photo = modelOfficialPhoto;
      existingInv.docPhoto = docImg;
      existingInv.docType = docType;
      existingInv.noBa = noBa;
      existingInv.color = carColor;
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
          noBa: noBa,
          status: 'Tersedia',
          location: catalogItem ? catalogItem.defaultLocation : 'Yard A - Receiving Bay',
          photo: modelOfficialPhoto,
          docPhoto: docImg,
          docType: docType,
          color: carColor
        });
      }
    }

    // Update KPI Counters secara dinamis dari data realtime
    AppState.updateKpiCounts();

    // Reset Form Input
    const colorEl = document.getElementById('inputCarColor');
    if (colorEl) colorEl.value = '';
    const officerEl = document.getElementById('inputOfficerName');
    if (officerEl) officerEl.value = '';
    const keteranganEl = document.getElementById('inputKeterangan');
    if (keteranganEl) keteranganEl.value = '';
    const noBaEl = document.getElementById('inputNoBa');
    if (noBaEl) noBaEl.value = 'D660 - Ahmad Yani';
    const destBranchEl = document.getElementById('inputDestinationBranch');
    if (destBranchEl) destBranchEl.value = 'D661 - Soekarno Hatta';
    const docTypeEl = document.getElementById('inputMutationDocType');
    if (docTypeEl) docTypeEl.value = 'SPPDC';
    if (typeof window.onMutationDocTypeChanged === 'function') {
      window.onMutationDocTypeChanged();
    }
    UI.removeImagePreview('unitPhoto');
    UI.removeImagePreview('docPhoto');
    if (typeof UI !== 'undefined' && typeof UI.syncAllFormTriggers === 'function') {
      UI.syncAllFormTriggers();
    }

    // Tutup Scanner Modal & Notifikasi Awal
    ScannerService.close();
    UI.showToast('⏳ Menyimpan mutasi ke Google Spreadsheet & Drive...', 2500);

    // Refresh UI & ganti tab ke Riwayat
    if (typeof UI.applyDashboardDateFilter === 'function') {
      UI.applyDashboardDateFilter();
    }
    UI.updateDashboardKpis();
    UI.renderDashboardActivities();
    UI.renderInventoryList();
    if (typeof UI.renderInventoryBranchesView === 'function') {
      UI.renderInventoryBranchesView();
    }
    UI.renderHistoryList();

    setTimeout(() => {
      UI.switchTab('history');
    }, 400);

    // Background Async: Kirim data ke Google Spreadsheet backend & verifikasi pengiriman email realtime
    try {
      const response = await ApiService.saveMutation(newRecord);
      const targetEmail = (AppState.getBranchTargetEmails(noBa) || []).join(', ') || AppState.automationConfig?.email || '';
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
          engine: newRecord.engine || '-',
          operator: newRecord.pic || newRecord.operator || AppState.userProfile?.name || 'Petugas Yard',
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
          engine: newRecord.engine || '-',
          operator: newRecord.pic || newRecord.operator || AppState.userProfile?.name || 'Petugas Yard',
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
    } finally {
      // Pastikan tombol dipulihkan setelah jeda singkat (mencegah klik ganda / touch bounce)
      setTimeout(() => {
        this.resetSubmitMutationButton();
      }, 600);
    }
  }
};

// Global bridging function untuk form button onclick="saveMutationData()"
window.App = App;
window.saveMutationData = () => App.saveMutationData();

/**
 * Memvalidasi kelengkapan formulir mutasi ketat (Strict Validation) & Siklus Mutasi Antar-Cabang:
 * Tombol "Simpan & Verifikasi" WAJIB dalam kondisi disabled (tidak bisa diklik)
 * selama masih ada satu saja dari 11 kolom yang kosong:
 * 1. Nomor VIN
 * 2. Nomor Mesin
 * 3. Jenis Mutasi
 * 4. Model Kendaraan
 * 5. Warna Mobil
 * 6. Nama Petugas Lapangan
 * 7. Cabang / Kode BA
 * 8. Jenis Dokumen
 * 9. Foto Fisik Unit
 * 10. Foto Dokumen
 * 11. Catatan Kondisi Unit
 *
 * Serta memvalidasi status transaksi terakhir (Last State) untuk mendukung alur:
 * - D661 Masuk (SPPDC) -> D661 Keluar (OKK) -> D660 Masuk (OKK) -> D660 Keluar (BSTKB)
 */
window.checkMutationFormCompleteness = function() {
  const vinInput = document.getElementById('inputVin')?.value || document.getElementById('scanVinInput')?.value || '';
  const engineInput = document.getElementById('inputEngine')?.value || document.getElementById('scanEngineInput')?.value || '';
  const cleanVin = String(vinInput).trim().toUpperCase();
  const cleanEngine = String(engineInput).trim().toUpperCase();
  const mutationType = (document.getElementById('inputMutationType')?.value || 'Unit Masuk').trim();
  const model = (document.getElementById('inputCarModel')?.value || '').trim();
  const carColor = (document.getElementById('inputCarColor')?.value || '').trim();
  const officerName = (document.getElementById('inputOfficerName')?.value || '').trim();
  const noBa = (document.getElementById('inputNoBa')?.value || '').trim();
  const docType = (document.getElementById('inputMutationDocType')?.value || '').trim();
  const notes = (document.getElementById('inputKeterangan')?.value || '').trim();
  const hasUnitPhoto = !!(AppState && AppState.uploadedUnitPhotoUrl);
  const hasDocPhoto = !!(AppState && AppState.uploadedDocPhotoUrl);

  const alertContainer = document.getElementById('mutationDuplicateAlert');
  const alertIcon = document.getElementById('mutationDuplicateIcon');
  const alertTitle = document.getElementById('mutationDuplicateTitle');
  const alertMsg = document.getElementById('mutationDuplicateMessage');
  const submitBtn = document.getElementById('btnSubmitMutation');
  const submitText = document.getElementById('btnSubmitMutationText');

  // 1. Evaluasi siklus mutasi & deteksi duplikasi berdasarkan transaksi terakhir (Last State)
  let isCycleValid = true;
  if (cleanVin || cleanEngine) {
    const evalRes = typeof AppState.evaluateMutationAllowed === 'function'
      ? AppState.evaluateMutationAllowed(cleanVin, cleanEngine, mutationType, noBa)
      : { allowed: true };

    if (!evalRes.allowed) {
      isCycleValid = false;
      if (alertContainer) {
        alertContainer.className = 'mt-2.5 p-3 rounded-2xl border text-xs flex items-start space-x-2.5 transition-all bg-rose-50 border-rose-300 text-rose-900 shadow-sm animate-pulse';
        if (alertIcon) alertIcon.textContent = '⛔';
        if (alertTitle) {
          alertTitle.textContent = 'Duplikasi Mutasi Ditolak!';
          alertTitle.className = 'font-black text-xs leading-tight text-rose-800';
        }
        if (alertMsg) {
          alertMsg.innerHTML = evalRes.reason;
        }
        alertContainer.classList.remove('hidden');
      }
    } else {
      if (alertContainer) {
        if (evalRes.lastStatus) {
          alertContainer.className = 'mt-2.5 p-3 rounded-2xl border text-xs flex items-start space-x-2.5 transition-all bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm';
          if (alertIcon) alertIcon.textContent = '✅';
          if (alertTitle) {
            alertTitle.textContent = 'Status Alur Mutasi Valid';
            alertTitle.className = 'font-black text-xs leading-tight text-emerald-800';
          }
          if (alertMsg) {
            alertMsg.innerHTML = evalRes.reason || `Unit <b>${cleanVin}</b> valid untuk diproses sebagai <b>${mutationType}</b>.`;
          }
          alertContainer.classList.remove('hidden');
        } else {
          alertContainer.classList.add('hidden');
        }
      }
    }
  } else {
    if (alertContainer) alertContainer.classList.add('hidden');
  }

  // 2. Evaluasi Kolom Wajib
  const isOkkExit = mutationType === 'Unit Keluar' && docType === 'OKK';
  const destBranch = (document.getElementById('inputDestinationBranch')?.value || '').trim();

  const missing = [];
  if (!cleanVin) missing.push('Nomor VIN');
  if (!cleanEngine) missing.push('Nomor Mesin');
  if (!mutationType) missing.push('Jenis Mutasi');
  if (!model) missing.push('Model Kendaraan');
  if (!carColor) missing.push('Warna Mobil');
  if (!officerName) missing.push('Nama Petugas Lapangan');
  if (!noBa) missing.push('Cabang');
  if (!docType) missing.push('Jenis Dokumen');
  if (isOkkExit && !destBranch) missing.push('Cabang Tujuan');
  if (!hasUnitPhoto) missing.push('Foto Fisik Unit');
  if (!hasDocPhoto) missing.push('Foto Dokumen');
  if (!notes) missing.push('Catatan Kondisi');

  const totalRequired = isOkkExit ? 12 : 11;
  const isFormComplete = missing.length === 0;

  if (!submitBtn) return isFormComplete && isCycleValid;

  // Jika terjadi pelanggaran siklus mutasi (duplikat): Tombol disabled tegas
  if (!isCycleValid) {
    submitBtn.disabled = true;
    submitBtn.className = 'w-full py-3.5 bg-rose-100 text-rose-600 border border-rose-300 text-xs font-black uppercase tracking-wider rounded-2xl shadow-none flex items-center justify-center space-x-2 opacity-60 pointer-events-none cursor-not-allowed transition';
    if (submitText) submitText.textContent = '⛔ Mutasi Ditolak (Duplikasi)';
    return false;
  }

  // Jika masih ada kolom yang kosong: Tombol wajib disabled (strict validation)
  if (!isFormComplete) {
    submitBtn.disabled = true;
    submitBtn.className = 'w-full py-3.5 bg-slate-200 text-slate-400 text-xs font-black uppercase tracking-wider rounded-2xl shadow-none flex items-center justify-center space-x-2 opacity-60 pointer-events-none cursor-not-allowed transition';
    if (submitText) {
      if (missing.length === 1) {
        submitText.textContent = `Isi: ${missing[0]}`;
      } else {
        submitText.textContent = `Lengkapi Form (${totalRequired - missing.length}/${totalRequired} Terisi)`;
      }
    }
    return false;
  }

  // Jika SEMUA KOLOM terisi LENGKAP dan lolos validasi siklus mutasi: Aktifkan tombol
  submitBtn.disabled = false;
  submitBtn.className = 'w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center space-x-2 active:scale-98 transition cursor-pointer';
  if (submitText) {
    submitText.textContent = mutationType === 'Unit Masuk' ? 'Simpan & Verifikasi Masuk' : 'Simpan & Verifikasi Keluar';
  }
  return true;
};

/**
 * Handler reaktif ketika jenis dokumen atau jenis mutasi berubah:
 * Menampilkan / menyembunyikan input Cabang Tujuan Pengiriman khusus Unit Keluar + OKK
 */
window.onMutationDocTypeChanged = function() {
  const docType = (document.getElementById('inputMutationDocType')?.value || '').trim();
  const mutationType = (document.getElementById('inputMutationType')?.value || 'Unit Masuk').trim();
  const boxDest = document.getElementById('boxDestinationBranch');

  if (mutationType === 'Unit Keluar' && docType === 'OKK') {
    if (boxDest) boxDest.classList.remove('hidden');
  } else {
    if (boxDest) boxDest.classList.add('hidden');
  }

  if (typeof window.checkMutationFormCompleteness === 'function') {
    window.checkMutationFormCompleteness();
  }
};

// Alias kompatibilitas
window.validateMutationFormDuplication = window.checkMutationFormCompleteness;

// Jalankan aplikasi saat dokumen siap
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

