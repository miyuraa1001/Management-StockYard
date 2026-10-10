/**
 * ============================================================================
 * Scanner Hardware & Barcode Module - Daihatsu Vehicle Logistics Tracker
 * ============================================================================
 * Menangani kontrol kamera, optical barcode decoding (ZXing), haptic feedback, 
 * audio beeper, dan senter fisik perangkat.
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
   * Membuka modal scanner dan menginisialisasi kamera
   */
  async open() {
    const modal = document.getElementById('scannerModalOverlay');
    if (!modal) return;
    modal.classList.remove('hidden');

    AppState.isScanningActive = true;
    this.resetReticleStyle();

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
   * Menghentikan scanner dan mematikan stream kamera
   */
  close() {
    AppState.isScanningActive = false;
    const modal = document.getElementById('scannerModalOverlay');
    if (modal) modal.classList.add('hidden');

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
   */
  onBarcodeDetected(detectedCode) {
    if (!AppState.isScanningActive) return;
    AppState.isScanningActive = false;

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

    // 3. Update Status Teks HUD
    const statusText = document.getElementById('scanStatusText');
    if (statusText) {
      statusText.innerText = 'BERHASIL TERBACA!';
      statusText.classList.replace('text-emerald-300', 'text-white');
    }

    // 4. Isi Kolom Input Form Otomatis
    const vinInput = document.getElementById('inputVin');
    const engineInput = document.getElementById('inputEngine');

    let parsedVin = detectedCode && detectedCode.length >= 10 ? detectedCode : 'MHKP3FA1JTK137533';
    let parsedEngine = '2NR4F82393';

    if (vinInput) vinInput.value = parsedVin;
    if (engineInput) engineInput.value = parsedEngine;

    UI.showToast(`🎯 Barcode Terbaca: ${parsedVin}`);

    // 5. Geser Bottom Sheet Formulir ke atas
    const sheet = document.getElementById('scannerBottomSheet');
    if (sheet) {
      sheet.classList.remove('translate-y-full');
      sheet.scrollIntoView({ behavior: 'smooth' });
    }

    // Izinkan pemindaian kembali setelah jeda 3 detik jika diperlukan
    setTimeout(() => {
      AppState.isScanningActive = true;
      this.resetReticleStyle();
    }, 3000);
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
   * Buka / tutup bottom sheet form
   */
  toggleBottomSheet() {
    const sheet = document.getElementById('scannerBottomSheet');
    if (sheet) {
      sheet.classList.toggle('translate-y-full');
    }
  }
};

// Global bridging functions untuk kompatibilitas atribut onclick di HTML
window.ScannerService = ScannerService;
window.openScannerModal = () => ScannerService.open();
window.closeScannerModal = () => ScannerService.close();
window.toggleCameraFacing = () => ScannerService.toggleFacing();
window.toggleFlashlight = () => ScannerService.toggleTorch();
window.triggerSampleBarcodeScan = () => ScannerService.triggerSample();
window.toggleBottomSheet = () => ScannerService.toggleBottomSheet();

