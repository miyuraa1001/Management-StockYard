/**
 * ============================================================================
 * Scanner Hardware & Barcode Module - Daihatsu Vehicle Logistics Tracker
 * ============================================================================
 * Menangani kontrol kamera, optical barcode decoding (ZXing), haptic feedback, 
 * audio beeper, senter fisik perangkat, dan alur 2-Step Scanner -> Form Mutasi.
 */

const ScannerService = {
  /**
   * Menghasilkan audio beep frekuensi tinggi (A6 / 1760 Hz) khas scanner logistik industri
   */
  playBeep() {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.14);
    } catch (e) {
      console.warn('[ScannerService] AudioContext belum diizinkan atau tidak didukung:', e);
    }
  },

  /**
   * Menjalankan getaran haptik ganda pada smartphone fisik
   */
  triggerHaptic() {
    if (navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
    }
  },

  /**
   * Menyelaraskan nilai nomor VIN dan Engine antara Step 1 (Scanner) dan Step 2 (Form Mutasi)
   */
  syncVinEngine() {
    const scanVinEl = document.getElementById('scanVinInput');
    const scanEngineEl = document.getElementById('scanEngineInput');
    const inputVinEl = document.getElementById('inputVin');
    const inputEngineEl = document.getElementById('inputEngine');
    const displayVinEl = document.getElementById('displaySummaryVin');
    const displayEngineEl = document.getElementById('displaySummaryEngine');

    const currentVin = (scanVinEl?.value || inputVinEl?.value || 'MHKP3FA1JTK137533').trim().toUpperCase();
    const currentEngine = (scanEngineEl?.value || inputEngineEl?.value || '2NR4F82393').trim().toUpperCase();

    if (scanVinEl && scanVinEl.value !== currentVin) scanVinEl.value = currentVin;
    if (scanEngineEl && scanEngineEl.value !== currentEngine) scanEngineEl.value = currentEngine;
    if (inputVinEl) inputVinEl.value = currentVin;
    if (inputEngineEl) inputEngineEl.value = currentEngine;
    if (displayVinEl) displayVinEl.textContent = currentVin || '-';
    if (displayEngineEl) displayEngineEl.textContent = currentEngine || '-';
  },

  /**
   * Mengembalikan tampilan chip feedback scan di Step 1 ke status awal
   */
  resetScanFeedbackChip() {
    const feedbackTitle = document.getElementById('scanFeedbackTitle');
    const feedbackSub = document.getElementById('scanFeedbackSubtitle');
    const feedbackBadge = document.getElementById('scanFeedbackBadgeIcon');
    const feedbackPill = document.getElementById('scanFeedbackPill');
    const chipContainer = document.getElementById('scanFeedbackChip');

    if (feedbackTitle) feedbackTitle.textContent = 'Siap Memindai Barcode';
    if (feedbackSub) feedbackSub.textContent = 'Arahkan kamera atau periksa nomor di bawah';
    if (feedbackBadge) {
      feedbackBadge.textContent = '🔍';
      feedbackBadge.className = 'w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-black flex-shrink-0';
    }
    if (feedbackPill) {
      feedbackPill.textContent = 'READY';
      feedbackPill.className = 'text-[9px] font-extrabold text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded-lg border border-blue-500/30 uppercase tracking-wide';
    }
    if (chipContainer) {
      chipContainer.className = 'p-2.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl flex items-center justify-between transition-colors';
    }
  },

  /**
   * Membuka modal scanner dan selalu memulai dari Tahap 1 (Kamera & Nomor VIN/Mesin)
   */
  async open() {
    const modal = document.getElementById('scannerModalOverlay');
    if (!modal) return;

    // Selalu reset ke Tahap 1 saat baru dibuka
    const step1 = document.getElementById('scanStep1_Camera');
    const step2 = document.getElementById('scanStep2_Form');
    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');

    this.resetScanFeedbackChip();
    this.resetReticleStyle();
    this.syncVinEngine();

    modal.classList.remove('hidden');
    AppState.isScanningActive = true;

    try {
      if (typeof ZXing !== 'undefined') {
        AppState.codeReader = new ZXing.BrowserMultiFormatReader();
        const videoInputDevices = await AppState.codeReader.listVideoInputDevices();

        // Utamakan kamera belakang (rear/back/environment)
        let selectedDeviceId = undefined;
        if (videoInputDevices && videoInputDevices.length > 0) {
          const backCam = videoInputDevices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('environment')
          );
          selectedDeviceId = backCam ? backCam.deviceId : videoInputDevices[0].deviceId;
        }

        AppState.codeReader.decodeFromVideoDevice(selectedDeviceId, 'scannerVideo', (result, err) => {
          if (result && AppState.isScanningActive) {
            this.onBarcodeDetected(result.getText());
          }
        });
      } else {
        // Fallback HTML5 MediaStream
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          AppState.cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: AppState.facingMode }
          });
          const videoEl = document.getElementById('scannerVideo');
          if (videoEl) {
            videoEl.srcObject = AppState.cameraStream;
            videoEl.play();
          }
        }
      }
    } catch (err) {
      console.warn('[ScannerService] Akses kamera gagal atau ditolak browser:', err);
      UI.showToast('Kamera tidak dapat diakses di browser ini');
    }
  },

  /**
   * Menghentikan scanner dan menutup modal
   */
  close() {
    AppState.isScanningActive = false;
    const modal = document.getElementById('scannerModalOverlay');
    if (modal) modal.classList.add('hidden');

    // Reset posisi step ke Step 1 untuk pembukaan berikutnya
    const step1 = document.getElementById('scanStep1_Camera');
    const step2 = document.getElementById('scanStep2_Form');
    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');

    if (AppState.codeReader) {
      try {
        AppState.codeReader.reset();
      } catch (e) {}
      AppState.codeReader = null;
    }

    if (AppState.cameraStream) {
      AppState.cameraStream.getTracks().forEach(track => track.stop());
      AppState.cameraStream = null;
    }
  },

  /**
   * Callback saat barcode berhasil terbaca oleh kamera atau simulasi
   * Menampilkan hasil VIN dan Engine di kartu bawah Step 1 agar operator dapat mengecek
   */
  onBarcodeDetected(detectedCode) {
    if (!AppState.isScanningActive) return;

    // 1. Audio & Haptic Feedback
    this.playBeep();
    this.triggerHaptic();

    // 2. Animasikan Reticle ke Warna Hijau Terkunci
    const reticle = document.getElementById('scannerReticle');
    const corners = ['cornerTL', 'cornerTR', 'cornerBL', 'cornerBR'];
    if (reticle) reticle.classList.add('scanner-locked');
    corners.forEach(id => {
      const c = document.getElementById(id);
      if (c) {
        c.classList.remove('border-blue-500');
        c.classList.add('border-emerald-400');
      }
    });

    // 3. Update Status Teks HUD Kamera
    const statusText = document.getElementById('scanStatusText');
    if (statusText) {
      statusText.innerText = 'BERHASIL TERBACA!';
      statusText.classList.replace('text-emerald-300', 'text-white');
    }

    // 4. Parsing VIN & Engine Number
    let parsedVin = detectedCode && detectedCode.length >= 8 ? detectedCode.trim().toUpperCase() : 'MHKP3FA1JTK137533';
    let parsedEngine = '2NR4F82393';

    // Cek kecocokan di database inventori atau riwayat jika unit sudah terdaftar
    if (AppState && AppState.inventoryData) {
      const matchedUnit = AppState.inventoryData.find(u => u.vin.toUpperCase() === parsedVin) ||
                          AppState.historyData?.find(h => h.vin.toUpperCase() === parsedVin);
      if (matchedUnit) {
        if (matchedUnit.engine) parsedEngine = matchedUnit.engine;
        if (matchedUnit.model) {
          const modelDropdown = document.getElementById('inputCarModel');
          if (modelDropdown) modelDropdown.value = matchedUnit.model;
        }
      }
    }

    // 5. Isi Kolom Input di Step 1
    const scanVinEl = document.getElementById('scanVinInput');
    const scanEngineEl = document.getElementById('scanEngineInput');
    if (scanVinEl) scanVinEl.value = parsedVin;
    if (scanEngineEl) scanEngineEl.value = parsedEngine;

    // Sinkronkan ke Step 2
    this.syncVinEngine();

    // 6. Update Visual Chip Status di Step 1 (Hijau Terverifikasi)
    const feedbackTitle = document.getElementById('scanFeedbackTitle');
    const feedbackSub = document.getElementById('scanFeedbackSubtitle');
    const feedbackBadge = document.getElementById('scanFeedbackBadgeIcon');
    const feedbackPill = document.getElementById('scanFeedbackPill');
    const chipContainer = document.getElementById('scanFeedbackChip');

    if (feedbackTitle) feedbackTitle.textContent = '✓ Barcode Terbaca!';
    if (feedbackSub) feedbackSub.textContent = 'Periksa nomor VIN & Mesin di bawah, lalu klik Lanjut';
    if (feedbackBadge) {
      feedbackBadge.textContent = '✓';
      feedbackBadge.className = 'w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xs font-black flex-shrink-0 animate-bounce';
    }
    if (feedbackPill) {
      feedbackPill.textContent = 'TERVERIFIKASI';
      feedbackPill.className = 'text-[9px] font-extrabold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-500/50 uppercase tracking-wide';
    }
    if (chipContainer) {
      chipContainer.className = 'p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center justify-between transition-colors shadow-sm';
    }

    UI.showToast(`🎯 Barcode Terbaca: ${parsedVin}`);

    // Beri jeda 3 detik sebelum kamera boleh membaca kode baru jika belum lanjut
    setTimeout(() => {
      this.resetReticleStyle();
    }, 3000);
  },

  /**
   * Pindah dari Tahap 1 (Kamera & Nomor) ke Tahap 2 (Formulir Mutasi & Verifikasi)
   */
  goToStep2Form() {
    const scanVinEl = document.getElementById('scanVinInput');
    const scanEngineEl = document.getElementById('scanEngineInput');
    const vin = (scanVinEl?.value || '').trim();
    const engine = (scanEngineEl?.value || '').trim();

    if (!vin || !engine) {
      UI.showToast('Harap periksa nomor VIN dan nomor Mesin terlebih dahulu!');
      return;
    }

    // Selaraskan nilai ke form Tahap 2
    this.syncVinEngine();

    const step1 = document.getElementById('scanStep1_Camera');
    const step2 = document.getElementById('scanStep2_Form');

    if (step1) step1.classList.add('hidden');
    if (step2) step2.classList.remove('hidden');

    // Hentikan sementara deteksi scanner agar tidak trigger di background saat mengetik form
    AppState.isScanningActive = false;
  },

  /**
   * Kembali dari Tahap 2 (Form Mutasi) ke Tahap 1 (Kamera Scanner)
   */
  backToStep1Scanner() {
    const step1 = document.getElementById('scanStep1_Camera');
    const step2 = document.getElementById('scanStep2_Form');

    if (step2) step2.classList.add('hidden');
    if (step1) step1.classList.remove('hidden');

    // Aktifkan kembali deteksi scanner
    AppState.isScanningActive = true;
    this.resetReticleStyle();
  },

  /**
   * Mereset tampilan visual garis bidik reticle ke warna biru
   */
  resetReticleStyle() {
    const reticle = document.getElementById('scannerReticle');
    if (reticle) reticle.classList.remove('scanner-locked');
    const corners = ['cornerTL', 'cornerTR', 'cornerBL', 'cornerBR'];
    corners.forEach(id => {
      const c = document.getElementById(id);
      if (c) {
        c.classList.remove('border-emerald-400');
        c.classList.add('border-blue-500');
      }
    });
    const statusText = document.getElementById('scanStatusText');
    if (statusText) {
      statusText.innerText = 'Live Camera Barcode';
      statusText.className = 'text-[10px] font-black uppercase tracking-wider text-emerald-300';
    }
  },

  /**
   * Simulasi pembacaan stiker kaca barcode (berguna untuk desktop testing)
   */
  triggerSample() {
    this.onBarcodeDetected('MHKP3FA1JTK137533');
  },

  /**
   * Toggle posisi kamera depan / belakang
   */
  async toggleFacing() {
    AppState.facingMode = AppState.facingMode === 'environment' ? 'user' : 'environment';
    this.close();
    setTimeout(() => {
      this.open();
      UI.showToast(`Lensa kamera dialihkan ke ${AppState.facingMode === 'environment' ? 'Belakang' : 'Depan'}`);
    }, 300);
  },

  /**
   * Toggle senter lampu flash fisik kamera smartphone
   */
  async toggleTorch() {
    try {
      const video = document.getElementById('scannerVideo');
      const stream = video ? video.srcObject : null;
      if (!stream) {
        UI.showToast('Nyalakan kamera terlebih dahulu!');
        return;
      }
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.torch) {
        AppState.isTorchOn = !AppState.isTorchOn;
        await track.applyConstraints({ advanced: [{ torch: AppState.isTorchOn }] });
        UI.showToast(AppState.isTorchOn ? '⚡ Senter aktif' : 'Senter dimatikan');
      } else {
        UI.showToast('Fitur senter tidak didukung pada sensor ini');
      }
    } catch (e) {
      UI.showToast('Senter tidak didukung pada browser ini');
    }
  },

  /**
   * Dummy compatibility function
   */
  toggleBottomSheet() {}
};

// Global bridging functions untuk kompatibilitas atribut onclick di HTML
window.ScannerService = ScannerService;
window.openScannerModal = () => ScannerService.open();
window.closeScannerModal = () => ScannerService.close();
window.goToMutationFormStep = () => ScannerService.goToStep2Form();
window.backToScannerStep = () => ScannerService.backToStep1Scanner();
window.syncVinEngineValues = () => ScannerService.syncVinEngine();
window.toggleCameraFacing = () => ScannerService.toggleFacing();
window.toggleFlashlight = () => ScannerService.toggleTorch();
window.triggerSampleBarcodeScan = () => ScannerService.triggerSample();
window.toggleBottomSheet = () => ScannerService.toggleBottomSheet();
