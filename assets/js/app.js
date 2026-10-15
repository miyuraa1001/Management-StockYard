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
    console.log('[App] Memulai Salvage (Management Salvage Sentra Lampung)...');

    // 1. Inisialisasi dropdown tanggal filter riwayat
    UI.populateDateDropdown();

    // 2. Muat data cache lokal jika tersedia
    AppState.loadFromCache();

    // Terapkan data profil operator & info otomatisasi
    if (UI.applyUserProfile) UI.applyUserProfile();
    if (UI.applyAutomationConfig) UI.applyAutomationConfig();

    // 3. Render awal komponen UI dari state
    UI.renderDashboardActivities();
    UI.updateDashboardKpis();
    UI.renderInventoryList();
    UI.renderHistoryList();
    UI.initHeroCarousel();
    if (UI.initPullToRefresh) UI.initPullToRefresh();

    // 4. Sinkronisasi data real-time dari Google Spreadsheet (Background Sync)
    this.syncBackendData();

    // 5. Setup event listener koneksi online/offline
    window.addEventListener('online', () => {
      AppState.isOnline = true;
      UI.showToast('🟢 Terhubung kembali ke jaringan');
      this.syncBackendData();
    });

    window.addEventListener('offline', () => {
      AppState.isOnline = false;
      UI.showToast('🟡 Mode offline aktif (Data tersimpan di perangkat)');
    });
  },

  /**
   * Sinkronisasi data dari Google Spreadsheet via ApiService
   */
  async syncBackendData() {
    try {
      const isUpdated = await ApiService.fetchInitialData();
      if (isUpdated) {
        UI.renderDashboardActivities();
        UI.updateDashboardKpis();
        UI.renderInventoryList();
        UI.renderHistoryList();
        console.log('[App] Berhasil sinkronisasi data dari Google Spreadsheet');
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
    // Validasi Duplikat: Satu kode barcode yang sudah terscan hanya bisa sekali tersimpan
    if (AppState.isVinDuplicate(cleanVin)) {
      UI.showToast(`⛔ Barcode / VIN [${cleanVin}] sudah pernah tersimpan sebelumnya! 1 Barcode hanya bisa 1x simpan.`);
      return;
    }

    const catalogItem = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(model) : null;
    const modelOfficialPhoto = catalogItem ? catalogItem.photo : 'assets/images/Inventory_Gran Max Pick Up.jpeg';
    const unitImg = AppState.uploadedUnitPhotoUrl || modelOfficialPhoto;
    const docImg = AppState.uploadedDocPhotoUrl || 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=260&q=80';

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const newRecord = {
      id: 'HIST-' + Date.now(),
      type: mutationType,
      time: `${hours}:${minutes}`,
      date: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      fullDateStr: `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`,
      model: model,
      modelPhoto: modelOfficialPhoto,
      vin: cleanVin,
      engine: engine.toUpperCase(),
      pic: CONFIG.OPERATOR_NAME || 'Andi Pratama',
      notes: notes || 'Pemeriksaan standar serah terima unit di lapangan.',
      unitPhoto: unitImg,
      docPhoto: docImg
    };

    // Optimistic UI Update: masukkan ke state lokal segera
    AppState.historyData.unshift(newRecord);

    // Update status di Inventory jika ada unit dengan VIN yang sama
    const existingInv = AppState.inventoryData.find(item => item.vin === cleanVin);
    if (existingInv) {
      existingInv.status = mutationType === 'Unit Masuk' ? 'In-Yard' : 'Allocated';
      existingInv.photo = modelOfficialPhoto;
      existingInv.docPhoto = docImg;
    } else {
      // Jika belum ada di inventory dan jenis mutasi adalah Unit Masuk, tambahkan ke inventory
      if (mutationType === 'Unit Masuk') {
        AppState.inventoryData.unshift({
          id: 'INV-' + Date.now().toString().slice(-4),
          model: catalogItem ? catalogItem.model : model,
          category: catalogItem ? catalogItem.category : 'Kendaraan Daihatsu',
          plate: 'BE ' + Math.floor(1000 + Math.random() * 9000) + ' DAA',
          vin: cleanVin,
          engine: engine.toUpperCase(),
          status: 'In-Yard',
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
    UI.updateDashboardKpis();
    UI.renderDashboardActivities();
    UI.renderInventoryList();
    UI.renderHistoryList();

    setTimeout(() => {
      UI.switchTab('history');
    }, 400);

    // Background Async: Kirim data ke Google Spreadsheet backend
    try {
      const response = await ApiService.saveMutation(newRecord);
      if (response && response.success && !response.isFallback && !response.isOffline) {
        console.log('[App] Data mutasi berhasil tersinkron ke Google Spreadsheet backend:', response);
        if (response.unitPhotoUrl) newRecord.unitPhoto = response.unitPhotoUrl;
        if (response.docPhotoUrl) newRecord.docPhoto = response.docPhotoUrl;
        AppState.saveToCache();
        UI.showToast('✅ Berhasil tersimpan ke Google Spreadsheet & Google Drive!', 4500);
        // Segera sinkronkan ulang database agar chart donat & stok unit yard langsung terupdate
        this.syncBackendData();
      } else {
        const reason = response?.message || response?.error || 'URL Web App belum terhubung';
        console.warn('[App] Mutasi tersimpan lokal (belum ke database Google):', reason);
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

// Jalankan aplikasi saat dokumen siap
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

