/**
 * ============================================================================
 * Scanner Hardware & Barcode Module - Daihatsu Vehicle Logistics Tracker
 * ============================================================================
 * Menangani kontrol kamera resolusi tinggi (HD/Continuous Focus), dual barcode 
 * decoding (Hardware-accelerated Native BarcodeDetector + ZXing MultiFormat), 
 * validasi pencegahan duplikat (1 barcode hanya bisa 1x simpan), audio/haptics,
 * dan simulasi scan cepat realistis untuk 13 model Daihatsu.
 */

const ScannerService = {
  nativeDetector: null,
  detectorAnimationId: null,
  lastScannedIsDuplicate: false,

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
   * Audio nada peringatan untuk barcode duplikat (nada rendah berulang)
   */
  playWarningBeep() {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.setValueAtTime(330, audioCtx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.28);
    } catch (e) {}
  },

  /**
   * Getaran haptik standar untuk scan berhasil
   */
  triggerHaptic() {
    if (navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
    }
  },

  /**
   * Getaran haptik panjang untuk peringatan duplikat
   */
  triggerWarningHaptic() {
    if (navigator.vibrate) {
      navigator.vibrate([180, 80, 240]);
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

    const currentVin = (scanVinEl?.value !== undefined ? scanVinEl.value : (inputVinEl?.value || '')).trim().toUpperCase();
    const currentEngine = (scanEngineEl?.value !== undefined ? scanEngineEl.value : (inputEngineEl?.value || '')).trim().toUpperCase();

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
    if (feedbackSub) feedbackSub.textContent = 'Arahkan kamera ke barcode stiker kaca unit';
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
   * Tampilan feedback saat barcode berhasil & valid
   */
  setFeedbackChipSuccess(vin) {
    const feedbackTitle = document.getElementById('scanFeedbackTitle');
    const feedbackSub = document.getElementById('scanFeedbackSubtitle');
    const feedbackBadge = document.getElementById('scanFeedbackBadgeIcon');
    const feedbackPill = document.getElementById('scanFeedbackPill');
    const chipContainer = document.getElementById('scanFeedbackChip');

    if (feedbackTitle) feedbackTitle.textContent = '✓ Barcode Terbaca!';
    if (feedbackSub) feedbackSub.textContent = `VIN ${vin} terverifikasi baru. Klik Lanjut untuk isi formulir.`;
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
  },

  /**
   * Tampilan feedback saat barcode DUPLIKAT ditolak
   */
  setFeedbackChipDuplicate(vin) {
    const feedbackTitle = document.getElementById('scanFeedbackTitle');
    const feedbackSub = document.getElementById('scanFeedbackSubtitle');
    const feedbackBadge = document.getElementById('scanFeedbackBadgeIcon');
    const feedbackPill = document.getElementById('scanFeedbackPill');
    const chipContainer = document.getElementById('scanFeedbackChip');

    if (feedbackTitle) feedbackTitle.textContent = '❌ Barcode Duplikat Ditolak!';
    if (feedbackSub) feedbackSub.textContent = `Nomor VIN ${vin} sudah tersimpan di riwayat mutasi. 1 Barcode hanya 1x simpan!`;
    if (feedbackBadge) {
      feedbackBadge.textContent = '✕';
      feedbackBadge.className = 'w-7 h-7 rounded-xl bg-rose-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0 animate-pulse';
    }
    if (feedbackPill) {
      feedbackPill.textContent = 'DUPLIKAT (DITOLAK)';
      feedbackPill.className = 'text-[9px] font-extrabold text-rose-300 bg-rose-950 px-2 py-0.5 rounded-lg border border-rose-500/50 uppercase tracking-wide';
    }
    if (chipContainer) {
      chipContainer.className = 'p-2.5 bg-rose-950/70 border border-rose-500/50 rounded-2xl flex items-center justify-between transition-colors shadow-sm';
    }
  },

  /**
   * Membuka modal scanner dan selalu memulai dari Tahap 1 (Kamera & Nomor VIN/Mesin Kosong)
   */
  async open() {
    const modal = document.getElementById('scannerModalOverlay');
    if (!modal) return;

    this.lastScannedIsDuplicate = false;

    // Selalu reset ke Tahap 1 saat baru dibuka
    const step1 = document.getElementById('scanStep1_Camera');
    const step2 = document.getElementById('scanStep2_Form');
    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');

    // Kosongkan nilai VIN & Engine sebelum pemindaian barcode
    const scanVinEl = document.getElementById('scanVinInput');
    const scanEngineEl = document.getElementById('scanEngineInput');
    const inputVinEl = document.getElementById('inputVin');
    const inputEngineEl = document.getElementById('inputEngine');
    if (scanVinEl) scanVinEl.value = '';
    if (scanEngineEl) scanEngineEl.value = '';
    if (inputVinEl) inputVinEl.value = '';
    if (inputEngineEl) inputEngineEl.value = '';

    const displayVinEl = document.getElementById('displaySummaryVin');
    const displayEngineEl = document.getElementById('displaySummaryEngine');
    if (displayVinEl) displayVinEl.textContent = '-';
    if (displayEngineEl) displayEngineEl.textContent = '-';

    this.resetScanFeedbackChip();
    this.resetReticleStyle();

    modal.classList.remove('hidden');
    AppState.isScanningActive = true;

    // Inisialisasi Native BarcodeDetector jika didukung browser smartphone
    if ('BarcodeDetector' in window) {
      try {
        const supported = await BarcodeDetector.getSupportedFormats();
        if (supported && supported.length > 0) {
          this.nativeDetector = new BarcodeDetector({
            formats: supported.filter(f => ['code_128', 'code_39', 'qr_code', 'data_matrix', 'itf', 'ean_13', 'upc_a'].includes(f))
          });
        }
      } catch (e) {
        this.nativeDetector = null;
      }
    }

    try {
      // Setup ZXing dengan konfigurasi TryHarder & Automotive Barcode Formats
      if (typeof ZXing !== 'undefined') {
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

        // Prioritaskan format barcode otomotif (Code 128, Code 39, QR, Data Matrix)
        const formats = [
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.QR_CODE,
          ZXing.BarcodeFormat.DATA_MATRIX,
          ZXing.BarcodeFormat.ITF,
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.UPC_A,
          ZXing.BarcodeFormat.UPC_E,
          ZXing.BarcodeFormat.CODABAR
        ];
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);

        AppState.codeReader = new ZXing.BrowserMultiFormatReader(hints, 120);
        const videoInputDevices = await AppState.codeReader.listVideoInputDevices();

        // Cari kamera belakang utama
        let selectedDeviceId = undefined;
        if (videoInputDevices && videoInputDevices.length > 0) {
          const backCam = videoInputDevices.find(device => {
            const label = device.label.toLowerCase();
            return label.includes('back') || label.includes('rear') || label.includes('environment');
          });
          selectedDeviceId = backCam ? backCam.deviceId : videoInputDevices[0].deviceId;
        }

        // Panggil decode dengan resolusi tinggi (1080p / 720p) agar barcode kecil/tajam terbaca
        const cameraConstraints = {
          audio: false,
          video: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            facingMode: selectedDeviceId ? undefined : { ideal: AppState.facingMode || 'environment' },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 }
          }
        };

        try {
          await AppState.codeReader.decodeFromConstraints(cameraConstraints, 'scannerVideo', (result, err) => {
            if (result && AppState.isScanningActive) {
              this.onBarcodeDetected(result.getText());
            }
          });
        } catch (constraintErr) {
          // Fallback ke device ID standar jika constraints resolusi tinggi tidak didukung perangkat
          AppState.codeReader.decodeFromVideoDevice(selectedDeviceId, 'scannerVideo', (result, err) => {
            if (result && AppState.isScanningActive) {
              this.onBarcodeDetected(result.getText());
            }
          });
        }

        // Jalankan loop pembacaan Native BarcodeDetector secara paralel untuk respon instan
        this.startNativeDetectorLoop();
      } else {
        // Fallback standar getUserMedia
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          AppState.cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: AppState.facingMode,
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 }
            }
          });
          const videoEl = document.getElementById('scannerVideo');
          if (videoEl) {
            videoEl.srcObject = AppState.cameraStream;
            videoEl.play();
            this.startNativeDetectorLoop();
          }
        }
      }
    } catch (err) {
      console.warn('[ScannerService] Akses kamera gagal atau ditolak browser:', err);
      UI.showToast('Kamera tidak dapat diakses di browser ini');
    }
  },

  /**
   * Loop deteksi cepat menggunakan akselerasi perangkat keras Native BarcodeDetector
   */
  startNativeDetectorLoop() {
    if (!this.nativeDetector) return;
    const video = document.getElementById('scannerVideo');
    if (!video) return;

    let isProcessing = false;
    let lastScanTime = 0;

    const detectFrame = async (timestamp) => {
      if (!AppState.isScanningActive) return;

      // Throttle pemeriksaan setiap 140ms & pastikan proses sebelumnya selesai agar CPU/GPU tidak freeze
      if (timestamp - lastScanTime >= 140 && !isProcessing && video.readyState >= 2 && !video.paused) {
        isProcessing = true;
        lastScanTime = timestamp;
        try {
          const barcodes = await this.nativeDetector.detect(video);
          if (barcodes && barcodes.length > 0 && AppState.isScanningActive) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              this.onBarcodeDetected(rawValue);
            }
          }
        } catch (e) {
        } finally {
          isProcessing = false;
        }
      }

      if (AppState.isScanningActive) {
        this.detectorAnimationId = requestAnimationFrame(detectFrame);
      }
    };

    this.detectorAnimationId = requestAnimationFrame(detectFrame);
  },

  /**
   * Menghentikan scanner dan menutup modal
   */
  close() {
    AppState.isScanningActive = false;
    if (this.detectorAnimationId) {
      cancelAnimationFrame(this.detectorAnimationId);
      this.detectorAnimationId = null;
    }

    const modal = document.getElementById('scannerModalOverlay');
    if (modal) modal.classList.add('hidden');

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
   * Menganalisis nomor VIN, memeriksa duplikat, dan mengupdate form Step 1 & Step 2
   */
  onBarcodeDetected(detectedCode, optEngine, optModel) {
    if (!AppState.isScanningActive) return;

    // Bersihkan teks barcode dari tanda khusus Code 39 (*) atau prefix
    let raw = String(detectedCode || '').trim();
    if (raw.startsWith('*') && raw.endsWith('*') && raw.length > 2) {
      raw = raw.slice(1, -1);
    }
    raw = raw.replace(/^(VIN|NO\.?|CHASSIS)[:\s-]*/i, '').trim();

    if (!raw || raw.length < 5) return;

    let parsedVin = raw.toUpperCase();
    let parsedEngine = optEngine ? optEngine.trim().toUpperCase() : '';
    let detectedModel = optModel || null;

    // Jika barcode berisi pemisah (misal VIN;MESIN atau VIN|MESIN atau VIN/MESIN)
    const splitDelim = [';', '|', '/', ', '].find(d => parsedVin.includes(d));
    if (splitDelim) {
      const parts = parsedVin.split(splitDelim).map(p => p.trim());
      parsedVin = parts[0];
      if (parts[1] && !parsedEngine) parsedEngine = parts[1];
    }

    // Deteksi model Daihatsu secara otomatis berdasarkan kode sasis VIN
    if (!detectedModel) {
      detectedModel = this.inferDaihatsuModelFromVin(parsedVin);
    }

    // Berikan nomor mesin realistis jika belum terisi
    if (!parsedEngine) {
      parsedEngine = this.inferEngineNumber(detectedModel, parsedVin);
    }

    // ------------------------------------------------------------------------
    // CEK VALIDASI DUPLIKAT: Satu kode barcode yang sudah terscan hanya bisa 1x simpan!
    // ------------------------------------------------------------------------
    const isDuplicate = AppState.isVinDuplicate(parsedVin);
    this.lastScannedIsDuplicate = isDuplicate;

    // Isi Nilai Input di Step 1
    const scanVinEl = document.getElementById('scanVinInput');
    const scanEngineEl = document.getElementById('scanEngineInput');
    if (scanVinEl) scanVinEl.value = parsedVin;
    if (scanEngineEl) scanEngineEl.value = parsedEngine;

    // Sinkronkan ke Step 2
    this.syncVinEngine();

    if (detectedModel) {
      const modelDropdown = document.getElementById('inputCarModel');
      if (modelDropdown) modelDropdown.value = detectedModel;
    }

    if (isDuplicate) {
      // Respon visual & audio untuk BARCODE DUPLIKAT
      this.playWarningBeep();
      this.triggerWarningHaptic();
      this.setReticleDuplicateStyle();
      this.setFeedbackChipDuplicate(parsedVin);

      UI.showToast(`⛔ Barcode [${parsedVin}] SUDAH PERNAH TERSIMPAN! (Duplikat Ditolak)`);

      // Beri jeda 4 detik sebelum reticle kembali normal
      setTimeout(() => {
        if (AppState.isScanningActive && this.lastScannedIsDuplicate) {
          this.resetReticleStyle();
        }
      }, 4000);
      return;
    }

    // ------------------------------------------------------------------------
    // KASUS NORMAL / VALID: Barcode baru belum pernah tersimpan
    // ------------------------------------------------------------------------
    this.playBeep();
    this.triggerHaptic();
    this.setReticleLockedStyle();
    this.setFeedbackChipSuccess(parsedVin);

    UI.showToast(`🎯 Barcode Terbaca: ${parsedVin}`);

    // Beri jeda sebelum kamera boleh membaca kode lain
    setTimeout(() => {
      if (AppState.isScanningActive && !this.lastScannedIsDuplicate) {
        this.resetReticleStyle();
      }
    }, 3000);
  },

  /**
   * Deteksi model Daihatsu dari pola nomor rangka (VIN) Indonesia (MHK...)
   */
  inferDaihatsuModelFromVin(vin) {
    const v = String(vin).toUpperCase();
    if (v.includes('R1EA') || v.includes('HYBRID')) return 'Rocky e-Smart Hybrid';
    if (v.includes('DA3SE')) return 'Terios SE';
    if (v.includes('DA3') || v.includes('F800')) return 'New Terios';
    if (v.includes('W1BA') || v.includes('W100') || v.includes('W101')) return 'All New Xenia';
    if (v.includes('BR5D') || v.includes('B400') || v.includes('B401')) return 'New Sigra';
    if (v.includes('AA1B') || v.includes('A300') || v.includes('A301')) return 'All New Ayla';
    if (v.includes('P3FA') && v.includes('TURBO')) return 'New Rocky';
    if (v.includes('P3FA') && (v.includes('PICK') || v.includes('DECK') || v.includes('PU'))) return 'Gran Max Pick Up';
    if (v.includes('P3FA2') || v.includes('VAN')) return 'Gran Max Blind Van';
    if (v.includes('P3FA3') || v.includes('BUS')) return 'Gran Max Minibus';
    if (v.includes('M4BA') || v.includes('M800')) return 'New Sirion';
    if (v.includes('W2CA') || v.includes('S400')) return 'Luxio';
    if (v.includes('P3FA')) return 'Gran Max Pick Up';
    return 'Gran Max Pick Up';
  },

  /**
   * Menghasilkan nomor mesin realistis berstandar Astra Daihatsu
   */
  inferEngineNumber(modelName, vin) {
    const m = String(modelName || '').toLowerCase();
    let prefix = '2NR-VE';
    if (m.includes('hybrid')) prefix = 'WA-VEX';
    else if (m.includes('turbo')) prefix = '1KR-VET';
    else if (m.includes('ayla')) prefix = '1KR-VE';
    else if (m.includes('sigra')) prefix = '3NR-VE';
    else if (m.includes('sirion') || m.includes('xenia')) prefix = '1NR-VE';
    else if (m.includes('luxio')) prefix = '3SZ-VE';

    // Ambil 6-7 digit terakhir dari VIN atau generate nomor serial
    const digits = vin.replace(/\D/g, '');
    const serial = digits.length >= 6 ? digits.slice(-6) : Math.floor(100000 + Math.random() * 900000);
    return `${prefix}${serial}`;
  },

  /**
   * Pindah dari Tahap 1 (Kamera & Nomor) ke Tahap 2 (Formulir Mutasi & Verifikasi)
   * Dilengkapi pencegahan ketat terhadap barcode duplikat!
   */
  goToStep2Form() {
    const scanVinEl = document.getElementById('scanVinInput');
    const scanEngineEl = document.getElementById('scanEngineInput');
    const vin = (scanVinEl?.value || '').trim().toUpperCase();
    const engine = (scanEngineEl?.value || '').trim().toUpperCase();

    if (!vin || !engine) {
      UI.showToast('⚠️ Scan barcode stiker kaca atau ketik nomor VIN & Mesin!');
      return;
    }

    // PENCEGAHAN DUPLIKAT: Satu kode barcode hanya bisa sekali tersimpan!
    if (AppState.isVinDuplicate(vin)) {
      this.playWarningBeep();
      this.triggerWarningHaptic();
      this.setReticleDuplicateStyle();
      this.setFeedbackChipDuplicate(vin);
      UI.showToast(`⛔ Barcode / VIN [${vin}] sudah pernah tersimpan sebelumnya! 1 Barcode hanya bisa 1x simpan.`);
      return;
    }

    // Selaraskan nilai ke form Tahap 2
    this.syncVinEngine();

    const step1 = document.getElementById('scanStep1_Camera');
    const step2 = document.getElementById('scanStep2_Form');

    if (step1) step1.classList.add('hidden');
    if (step2) step2.classList.remove('hidden');

    // Hentikan sementara deteksi scanner agar tidak memicu deteksi di background
    AppState.isScanningActive = false;
    if (this.detectorAnimationId) {
      cancelAnimationFrame(this.detectorAnimationId);
      this.detectorAnimationId = null;
    }
  },

  /**
   * Kembali dari Tahap 2 (Form Mutasi) ke Tahap 1 (Kamera Scanner)
   */
  backToStep1Scanner() {
    const step1 = document.getElementById('scanStep1_Camera');
    const step2 = document.getElementById('scanStep2_Form');

    if (step2) step2.classList.add('hidden');
    if (step1) step1.classList.remove('hidden');

    AppState.isScanningActive = true;
    this.resetReticleStyle();
    this.startNativeDetectorLoop();
  },

  /**
   * Mereset tampilan visual garis bidik reticle ke warna biru standar
   */
  resetReticleStyle() {
    const reticle = document.getElementById('scannerReticle');
    if (reticle) {
      reticle.classList.remove('scanner-locked');
      reticle.style.borderColor = 'rgba(96, 165, 250, 0.8)';
    }
    const corners = ['cornerTL', 'cornerTR', 'cornerBL', 'cornerBR'];
    corners.forEach(id => {
      const c = document.getElementById(id);
      if (c) {
        c.classList.remove('border-emerald-400', 'border-rose-500');
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
   * Mengubah reticle menjadi hijau terkunci saat scan berhasil
   */
  setReticleLockedStyle() {
    const reticle = document.getElementById('scannerReticle');
    if (reticle) {
      reticle.classList.add('scanner-locked');
      reticle.style.borderColor = '#10b981';
    }
    const corners = ['cornerTL', 'cornerTR', 'cornerBL', 'cornerBR'];
    corners.forEach(id => {
      const c = document.getElementById(id);
      if (c) {
        c.classList.remove('border-blue-500', 'border-rose-500');
        c.classList.add('border-emerald-400');
      }
    });
    const statusText = document.getElementById('scanStatusText');
    if (statusText) {
      statusText.innerText = 'BERHASIL TERBACA!';
      statusText.className = 'text-[10px] font-black uppercase tracking-wider text-white';
    }
  },

  /**
   * Mengubah reticle menjadi merah menyala saat scan duplikat ditolak
   */
  setReticleDuplicateStyle() {
    const reticle = document.getElementById('scannerReticle');
    if (reticle) {
      reticle.classList.remove('scanner-locked');
      reticle.style.borderColor = '#f43f5e';
    }
    const corners = ['cornerTL', 'cornerTR', 'cornerBL', 'cornerBR'];
    corners.forEach(id => {
      const c = document.getElementById(id);
      if (c) {
        c.classList.remove('border-blue-500', 'border-emerald-400');
        c.classList.add('border-rose-500');
      }
    });
    const statusText = document.getElementById('scanStatusText');
    if (statusText) {
      statusText.innerText = 'DUPLIKAT! SUDAH PERNAH TERSIMPAN';
      statusText.className = 'text-[10px] font-black uppercase tracking-wider text-rose-400 animate-pulse';
    }
  },

  /**
   * TES SCAN CEPAT (100% REAL & DINAMIS):
   * Menghasilkan barcode VIN dan nomor mesin Daihatsu yang unik dan realistis 
   * setiap kali tombol ditekan, tanpa pernah menduplikat kode yang sudah tersimpan.
   */
  triggerSample() {
    const daihatsuCatalog = [
      { name: 'Rocky e-Smart Hybrid', vinPrefix: 'MHKR1EA1', enginePrefix: 'WA-VEX' },
      { name: 'Gran Max Pick Up', vinPrefix: 'MHKP3FA1', enginePrefix: '2NR-VE' },
      { name: 'New Terios', vinPrefix: 'MHKDA3BA', enginePrefix: '2NR-VE' },
      { name: 'New Sigra', vinPrefix: 'MHKBR5DA', enginePrefix: '3NR-VE' },
      { name: 'All New Xenia', vinPrefix: 'MHKW1BA1', enginePrefix: '1NR-VE' },
      { name: 'All New Ayla', vinPrefix: 'MHKAA1BA', enginePrefix: '1KR-VE' },
      { name: 'New Rocky', vinPrefix: 'MHKP3FA1', enginePrefix: '1KR-VET' },
      { name: 'New Sirion', vinPrefix: 'MHKM4BA1', enginePrefix: '1NR-VE' },
      { name: 'Luxio', vinPrefix: 'MHKW2CA1', enginePrefix: '3SZ-VE' },
      { name: 'Gran Max Blind Van', vinPrefix: 'MHKP3FA2', enginePrefix: '2NR-VE' },
      { name: 'Gran Max Minibus', vinPrefix: 'MHKP3FA3', enginePrefix: '2NR-VE' },
      { name: 'Terios SE', vinPrefix: 'MHKDA3SE', enginePrefix: '2NR-VE' }
    ];

    // Pilih model secara acak
    const randomModel = daihatsuCatalog[Math.floor(Math.random() * daihatsuCatalog.length)];
    const alphabet = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    const randLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
    const yearCodes = ['T', 'S', 'R', 'P']; // Kode tahun 2026, 2025, 2024, 2023
    const randYear = yearCodes[Math.floor(Math.random() * yearCodes.length)];

    // Pastikan VIN yang digenerate BELUM PERNAH tersimpan sebelumnya di sistem
    let generatedVin = '';
    let attempts = 0;
    do {
      const serialNumber = Math.floor(100000 + Math.random() * 900000);
      generatedVin = `${randomModel.vinPrefix}${randLetter}${randYear}${serialNumber}`;
      attempts++;
    } while (AppState.isVinDuplicate(generatedVin) && attempts < 50);

    const generatedEngine = `${randomModel.enginePrefix}${Math.floor(1000000 + Math.random() * 9000000)}`;

    // Panggil event scanner dengan unit baru yang nyata dan valid
    this.onBarcodeDetected(generatedVin, generatedEngine, randomModel.name);
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
   * Compatibility function
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
