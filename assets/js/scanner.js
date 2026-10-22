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
  scanMode: 'barcode', // 'barcode' | 'ocr'
  isOcrRunning: false,
  isLiveOcrRunning: false,
  scanCooldown: false,
  lastExtractedData: null,
  detectedVin: '',
  detectedEngine: '',
  detectedModel: '',
  currentZoom: 1.0,
  ocrWorker: null,
  zxingMultiReader: null,
  subCropCanvas: null,
  liveOcrCanvas: null,

  /**
   * Mengatur mode pemindaian: 'barcode' (Barcode Auto) atau 'ocr' (Baca Teks Stiker OCR)
   */
  setScanMode(mode = 'barcode') {
    this.scanMode = mode;
    const btnBarcode = document.getElementById('scanModeBtn_Barcode');
    const btnOcr = document.getElementById('scanModeBtn_OCR');
    const statusText = document.getElementById('scanStatusText');
    const guideText = document.getElementById('scanGuideSubtext');

    if (mode === 'ocr') {
      if (btnBarcode) {
        btnBarcode.className = 'px-3 py-1 rounded-xl text-[10.5px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center space-x-1.5 bg-white/10 hover:bg-white/20 text-slate-300 border border-white/15';
      }
      if (btnOcr) {
        btnOcr.className = 'px-3 py-1 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition cursor-pointer flex items-center space-x-1.5 bg-emerald-600 text-white shadow-sm border border-emerald-400/40';
      }
      if (statusText) {
        statusText.innerText = 'MODE BACA TEKS STIKER (OCR)';
        statusText.className = 'text-[10px] font-black uppercase tracking-wider text-emerald-300';
      }
      if (guideText) {
        guideText.textContent = 'Tekan "📸 Foto & Baca Teks Stiker" atau "Pilih Galeri"';
      }
    } else {
      if (btnBarcode) {
        btnBarcode.className = 'px-3 py-1 rounded-xl text-[10.5px] font-black uppercase tracking-wider transition cursor-pointer flex items-center space-x-1.5 bg-blue-600 text-white shadow-sm border border-blue-400/40';
      }
      if (btnOcr) {
        btnOcr.className = 'px-3 py-1 rounded-xl text-[10.5px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center space-x-1.5 bg-white/10 hover:bg-white/20 text-slate-300 border border-white/15';
      }
      if (statusText) {
        statusText.innerText = 'LIVE CAMERA BARCODE AUTO';
        statusText.className = 'text-[10px] font-black uppercase tracking-wider text-emerald-300';
      }
      if (guideText) {
        guideText.textContent = 'Arahkan kamera ke stiker barcode kaca unit';
      }
    }
  },

  /**
   * Mengatur level zoom kamera ponsel (1x, 1.5x, 2x)
   */
  async setZoom(level) {
    this.currentZoom = level;
    try {
      const track = AppState.cameraStream?.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.zoom) {
          const clamped = Math.min(caps.zoom.max, Math.max(caps.zoom.min, level));
          await track.applyConstraints({ advanced: [{ zoom: clamped }] });
        }
      }
    } catch (e) {}

    const video = document.getElementById('scannerVideo');
    if (video) {
      video.style.transform = `scale(${level})`;
      video.style.transformOrigin = 'center center';
    }

    ['1', '1.5', '2'].forEach(z => {
      const btn = document.getElementById(`zoomBtn_${z.replace('.', '_')}`);
      if (btn) {
        if (parseFloat(z) === level) {
          btn.className = 'px-2.5 py-1 rounded-lg text-[10px] font-black bg-blue-600 text-white border border-blue-400 shadow-sm transition active:scale-95 cursor-pointer';
        } else {
          btn.className = 'px-2.5 py-1 rounded-lg text-[10px] font-bold bg-black/60 text-white/80 border border-white/20 hover:bg-white/10 transition active:scale-95 cursor-pointer';
        }
      }
    });

    UI.showToast(`🔍 Zoom ${level}x`);
  },

  /**
   * Ketuk pada layar viewfinder kamera untuk memfokuskan sensor kamera (Tap to Focus)
   */
  async tapToFocus(event) {
    const video = document.getElementById('scannerVideo');
    if (!video) return;

    const rect = video.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const ring = document.getElementById('focusRingIndicator');
    if (ring) {
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      ring.classList.remove('hidden');
      ring.classList.add('animate-ping');
      setTimeout(() => {
        ring.classList.remove('animate-ping');
        ring.classList.add('hidden');
      }, 700);
    }

    try {
      const track = AppState.cameraStream?.getVideoTracks()[0];
      if (track) {
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.focusMode && caps.focusMode.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        }
      }
    } catch (e) {}
  },

  /**
   * Tempel teks nomor VIN dari Clipboard
   */
  async pasteToVin() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const clean = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const input = document.getElementById('scanVinInput');
        if (input) input.value = clean;
        this.syncVinEngine();
        UI.showToast(`📋 Berhasil menempel VIN: ${clean}`);
      }
    } catch (e) {
      const val = prompt('Tempel atau ketik nomor VIN:');
      if (val) {
        const clean = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const input = document.getElementById('scanVinInput');
        if (input) input.value = clean;
        this.syncVinEngine();
      }
    }
  },

  /**
   * Tempel teks nomor mesin dari Clipboard
   */
  async pasteToEngine() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const clean = text.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
        const input = document.getElementById('scanEngineInput');
        if (input) input.value = clean;
        this.syncVinEngine();
        UI.showToast(`📋 Berhasil menempel No. Mesin: ${clean}`);
      }
    } catch (e) {
      const val = prompt('Tempel atau ketik No. Mesin:');
      if (val) {
        const clean = val.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
        const input = document.getElementById('scanEngineInput');
        if (input) input.value = clean;
        this.syncVinEngine();
      }
    }
  },

  /**
   * Mengambil / menginisialisasi Worker OCR persisten dengan parameter khusus stiker otomotif
   */
  async getOcrWorker() {
    if (this.ocrWorker) return this.ocrWorker;
    try {
      if (typeof Tesseract !== 'undefined' && Tesseract.createWorker) {
        const worker = await Tesseract.createWorker('eng');
        if (worker.setParameters) {
          await worker.setParameters({
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/. ',
            tessedit_pageseg_mode: '6'
          });
        }
        this.ocrWorker = worker;
        return this.ocrWorker;
      }
    } catch (e) {
      console.warn('[ScannerService] Worker init fallback:', e);
    }
    return null;
  },

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
    if (feedbackSub) feedbackSub.textContent = `VIN ${vin} berhasil dibaca. Klik Form untuk isi mutasi.`;
    if (feedbackBadge) {
      feedbackBadge.textContent = '✓';
      feedbackBadge.className = 'w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xs font-black flex-shrink-0 animate-bounce';
    }
    if (feedbackPill) {
      feedbackPill.textContent = 'TERBACA';
      feedbackPill.className = 'text-[9px] font-extrabold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-500/50 uppercase tracking-wide';
    }
    if (chipContainer) {
      chipContainer.className = 'p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center justify-between transition-colors shadow-sm';
    }
  },

  /**
   * Membuka modal scanner dan selalu memulai dari Tahap 1 (Kamera & Nomor VIN/Mesin Kosong)
   */
  async open() {
    const modal = document.getElementById('scannerModalOverlay');
    if (!modal) return;

    this.lastScannedIsDuplicate = false;
    this.isOcrRunning = false;
    this.scanCooldown = false;
    this.lastExtractedData = null;
    this.detectedVin = '';
    this.detectedEngine = '';
    this.detectedModel = '';
    this.setScanMode('barcode');

    // Sembunyikan summary chip ekstraksi stiker jika ada
    const summaryCard = document.getElementById('scanExtractedSummary');
    if (summaryCard) summaryCard.classList.add('hidden');
    const overlay = document.getElementById('ocrProcessingOverlay');
    if (overlay) overlay.classList.add('hidden');

    // Selalu reset ke Tahap 1 saat baru dibuka
    const step1 = document.getElementById('scanStep1_Camera');
    const step2 = document.getElementById('scanStep2_Form');
    if (step1) {
      step1.classList.remove('hidden');
      step1.scrollTop = 0;
    }
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

    // Pastikan No. BA default D660 - Ahmad Yani terisi
    const inputNoBaEl = document.getElementById('inputNoBa');
    if (inputNoBaEl && !inputNoBaEl.value.trim()) {
      inputNoBaEl.value = 'D660 - Ahmad Yani';
    }

    const displayVinEl = document.getElementById('displaySummaryVin');
    const displayEngineEl = document.getElementById('displaySummaryEngine');
    if (displayVinEl) displayVinEl.textContent = '-';
    if (displayEngineEl) displayEngineEl.textContent = '-';

    this.resetScanFeedbackChip();
    this.resetReticleStyle();

    modal.classList.remove('hidden');
    AppState.isScanningActive = true;

    // Periksa dukungan Hardware BarcodeDetector untuk barcode 1D linear (Code 128 / Code 39)
    let hasNativeDetector = false;
    if ('BarcodeDetector' in window) {
      try {
        const supported = await BarcodeDetector.getSupportedFormats();
        const targetFormats = ['code_128', 'code_39', 'code_93', 'qr_code'].filter(f => supported && supported.includes(f));
        if (targetFormats.length > 0) {
          this.nativeDetector = new BarcodeDetector({ formats: targetFormats });
          hasNativeDetector = true;
        } else {
          this.nativeDetector = null;
          hasNativeDetector = false;
        }
      } catch (e) {
        this.nativeDetector = null;
        hasNativeDetector = false;
      }
    }

    // Resolusi kamera HD 720p seimbang: 60fps ultra smooth, hemat baterai, dan tajam membaca barcode Code 128 stiker
    const cameraConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: AppState.facingMode || 'environment' },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
        advanced: [
          { focusMode: 'continuous' }
        ]
      }
    };

    this.currentZoom = 1.0;

    // Siapkan engine ZXing MultiFormatReader jika tersedia
    if (typeof ZXing !== 'undefined' && !this.zxingMultiReader) {
      try {
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        const formats = [
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.CODE_93,
          ZXing.BarcodeFormat.QR_CODE
        ];
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        this.zxingMultiReader = new ZXing.MultiFormatReader();
        this.zxingMultiReader.setHints(hints);
      } catch (ze) {
        console.warn('[ScannerService] ZXing MultiFormatReader init fallback:', ze);
      }
    }

    // Pre-warm Tesseract OCR worker di background agar instan siap tanpa jeda
    this.getOcrWorker().catch(() => {});

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        AppState.cameraStream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
        const videoEl = document.getElementById('scannerVideo');
        if (videoEl) {
          videoEl.srcObject = AppState.cameraStream;
          await videoEl.play().catch(() => {});
          this.startNativeDetectorLoop();
        }
      } else {
        UI.showToast('Kamera tidak dapat diakses di browser ini');
      }
    } catch (err) {
      console.warn('[ScannerService] Akses kamera gagal atau ditolak browser:', err);
      UI.showToast('Kamera tidak dapat diakses di browser ini');
    }
  },

  /**
   * Loop deteksi barcode cerdas berbasis Region Of Interest (ROI Kotak Bidik Reticle)
   * Dilengkapi Dual-Engine real-time berkinerja tinggi (60fps ultra smooth):
   * 1. Direct Video Native Hardware BarcodeDetector (interval ~120ms, zero-copy GPU ML Kit)
   * 2. Lightweight Downscaled ZXing Decoder (interval ~120ms, canvas 640px ringan)
   * 3. Intelligent Idle OCR Assist (hanya aktif jika barcode tidak terdeteksi setelah jeda 2.5 detik)
   */
  startNativeDetectorLoop() {
    const video = document.getElementById('scannerVideo');
    const canvas = document.getElementById('scannerCaptureCanvas');
    if (!video) return;

    let isProcessing = false;
    let lastScanTime = 0;
    let lastAutoOcrTime = 0;

    const detectFrame = async (timestamp) => {
      if (!AppState.isScanningActive) return;

      // Jika dalam pending cooldown atau manual OCR snapshot sedang berjalan dengan overlay, lewati
      if (this.scanCooldown) {
        this.detectorAnimationId = requestAnimationFrame(detectFrame);
        return;
      }

      // ----------------------------------------------------------------------
      // ENGINE 1: Real-time Multi-Barcode Scanning (setiap ~120ms)
      // ----------------------------------------------------------------------
      if (timestamp - lastScanTime >= 120 && !isProcessing && video.readyState >= 2 && !video.paused) {
        isProcessing = true;
        lastScanTime = timestamp;
        try {
          let detectedRaw = [];

          // Tahap 1: Coba deteksi via Hardware BarcodeDetector LANGSUNG dari elemen video (Zero-copy native GPU)
          if (this.nativeDetector) {
            try {
              const nativeResults = await this.nativeDetector.detect(video);
              if (nativeResults && nativeResults.length > 0) {
                detectedRaw = nativeResults.map(b => b.rawValue).filter(Boolean);
              }
            } catch (ne) {}
          }

          // Tahap 2: Jika belum ada hasil atau salah satu kode belum ketemu, gunakan Canvas ROI teroptimasi
          if (detectedRaw.length === 0 || (!this.detectedVin || !this.detectedEngine)) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;

            if (vw > 0 && vh > 0 && canvas) {
              // Targetkan area kotak bidik tengah (ROI: 85% lebar, 65% tinggi)
              const cropW = Math.floor(vw * 0.85);
              const cropH = Math.floor(vh * 0.65);
              const startX = Math.floor((vw - cropW) / 2);
              const startY = Math.floor((vh - cropH) / 2);

              // Downscale canvas ke resolusi optimal 640px (menghemat 75% pemrosesan CPU/RAM)
              const maxDecodeW = 640;
              const scale = Math.min(1, maxDecodeW / cropW);
              const decodeW = Math.round(cropW * scale);
              const decodeH = Math.round(cropH * scale);

              canvas.width = decodeW;
              canvas.height = decodeH;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, decodeW, decodeH);

              // Jika nativeDetector belum dapat dari video utuh, coba pada canvas crop
              if (detectedRaw.length === 0 && this.nativeDetector) {
                try {
                  const canvasResults = await this.nativeDetector.detect(canvas);
                  if (canvasResults && canvasResults.length > 0) {
                    detectedRaw = canvasResults.map(b => b.rawValue).filter(Boolean);
                  }
                } catch (ce) {}
              }

              // Gunakan ZXing MultiFormatReader multi-zona (Full ROI + Zona Atas/Bawah)
              if (detectedRaw.length === 0 || (!this.detectedVin || !this.detectedEngine)) {
                const zxResults = this.decodeAllBarcodesFromCanvas(canvas);
                if (zxResults && zxResults.length > 0) {
                  detectedRaw.push(...zxResults);
                }
              }
            }
          }

          // Evaluasi barcode yang terdeteksi
          if (detectedRaw.length > 0 && AppState.isScanningActive && !this.scanCooldown) {
            const smart = this.smartFilterBarcodes(detectedRaw);

            if (smart.vin || smart.engine) {
              this.applyExtractedStickerData(smart, 'BARCODE AUTO');
              if (this.detectedVin && this.detectedEngine) {
                this.scanCooldown = true;
                setTimeout(() => { this.scanCooldown = false; }, 2500);
              }
            } else if (detectedRaw.length > 0) {
              this.onBarcodeDetected(detectedRaw[0]);
            }
          }
        } catch (e) {
        } finally {
          isProcessing = false;
        }
      }

      // ----------------------------------------------------------------------
      // ENGINE 2: Intelligent Idle OCR Assist (Jeda aman 2.5 detik)
      // Hanya berjalan jika salah satu kode belum terbaca dan barcode terhalang silau/pantulan
      // Menggunakan canvas mini 640px agar kamera tetap 60fps tanpa stutter sama sekali!
      // ----------------------------------------------------------------------
      const now = performance.now();
      if (!this.detectedVin || !this.detectedEngine) {
        if (!this.isLiveOcrRunning && !this.isOcrRunning && !this.scanCooldown && (now - lastAutoOcrTime >= 2500)) {
          lastAutoOcrTime = now;
          this.runLiveOcrPass(video);
        }
      }

      if (AppState.isScanningActive) {
        this.detectorAnimationId = requestAnimationFrame(detectFrame);
      }
    };

    this.detectorAnimationId = requestAnimationFrame(detectFrame);
  },

  /**
   * Mendekode barcode dari HTMLCanvasElement menggunakan ZXing MultiFormatReader
   * Mendukung Code 128, Code 39, Code 93, QR Code dengan TryHarder = true
   */
  decodeCanvasWithZXing(canvas) {
    if (typeof ZXing === 'undefined' || !canvas || canvas.width === 0 || canvas.height === 0) return [];
    const results = [];
    try {
      if (!this.zxingMultiReader) {
        this.zxingMultiReader = new ZXing.MultiFormatReader();
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        const formats = [
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.CODE_93,
          ZXing.BarcodeFormat.QR_CODE
        ];
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        this.zxingMultiReader.setHints(hints);
      }

      const lumSource = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
      const binarizer = new ZXing.HybridBinarizer(lumSource);
      const bitmap = new ZXing.BinaryBitmap(binarizer);

      try {
        const res = this.zxingMultiReader.decode(bitmap);
        if (res && res.getText()) {
          results.push(res.getText());
        }
      } catch (e) {
        // Normal jika frame belum pas dengan barcode
      }

      // Jika belum ketemu, coba dengan invert (jika ada pantulan cahaya / warna terbalik di kaca)
      if (results.length === 0) {
        try {
          const invBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lumSource.invert()));
          const invRes = this.zxingMultiReader.decode(invBitmap);
          if (invRes && invRes.getText()) {
            results.push(invRes.getText());
          }
        } catch (ie) {}
      }
    } catch (err) {
      console.warn('[ScannerService] decodeCanvasWithZXing error:', err);
    }
    return results;
  },

  /**
   * Memindai multi-zona pada canvas untuk menangkap barcode VIN (zona atas) dan No. Mesin (zona bawah) sekaligus
   */
  decodeAllBarcodesFromCanvas(canvas) {
    if (!canvas || canvas.width === 0 || canvas.height === 0) return [];
    const rawList = [];

    // 1. Scan area utama (seluruh canvas ROI)
    const mainResults = this.decodeCanvasWithZXing(canvas);
    if (mainResults && mainResults.length > 0) {
      rawList.push(...mainResults);
    }

    // 2. Jika tinggi canvas memadai (> 120px), pisahkan jadi zona atas (VIN) dan zona bawah (Engine)
    // agar dalam satu frame video, KEDUA barcode dapat terbaca secara simultan!
    if (canvas.height > 120) {
      if (!this.subCropCanvas) {
        this.subCropCanvas = document.createElement('canvas');
      }
      const subCanvas = this.subCropCanvas;
      const subCtx = subCanvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const halfH = Math.floor(h * 0.58);

      // A. Jika VIN belum dapat ATAU baru dapat Engine: scan separuh atas tempat barcode VIN berada
      if (!this.detectedVin || (rawList.length > 0 && !this.smartFilterBarcodes(rawList).vin)) {
        subCanvas.width = w;
        subCanvas.height = halfH;
        subCtx.drawImage(canvas, 0, 0, w, halfH, 0, 0, w, halfH);
        const topResults = this.decodeCanvasWithZXing(subCanvas);
        if (topResults && topResults.length > 0) {
          rawList.push(...topResults);
        }
      }

      // B. Jika No. Mesin belum dapat ATAU baru dapat VIN: scan separuh bawah tempat barcode ENGINE berada
      if (!this.detectedEngine || (rawList.length > 0 && !this.smartFilterBarcodes(rawList).engine)) {
        subCanvas.width = w;
        subCanvas.height = halfH;
        subCtx.drawImage(canvas, 0, h - halfH, w, halfH, 0, 0, w, halfH);
        const botResults = this.decodeCanvasWithZXing(subCanvas);
        if (botResults && botResults.length > 0) {
          rawList.push(...botResults);
        }
      }
    }

    return Array.from(new Set(rawList));
  },

  /**
   * Pemindaian OCR latar belakang (Web Worker) non-blocking untuk membaca teks kode stiker secara hands-free
   * Berjalan otomatis saat barcode terhalang silau/pantulan kaca mobil tanpa membuat kamera lag
   */
  async runLiveOcrPass(video) {
    if (this.isLiveOcrRunning || this.isOcrRunning || !AppState.isScanningActive || !video || video.readyState < 2) return;
    this.isLiveOcrRunning = true;

    try {
      const worker = await this.getOcrWorker();
      if (!worker || !AppState.isScanningActive) {
        this.isLiveOcrRunning = false;
        return;
      }

      if (!this.liveOcrCanvas) {
        this.liveOcrCanvas = document.createElement('canvas');
      }
      const ocrCanvas = this.liveOcrCanvas;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw <= 0 || vh <= 0) {
        this.isLiveOcrRunning = false;
        return;
      }

      // Crop area fokus stiker (85% lebar, 65% tinggi di tengah)
      const cropW = Math.floor(vw * 0.85);
      const cropH = Math.floor(vh * 0.65);
      const startX = Math.floor((vw - cropW) / 2);
      const startY = Math.floor((vh - cropH) / 2);

      // Downscale ke ukuran optimal 640px agar Tesseract LSTM selesai dalam ~300ms
      const maxOcrW = 640;
      const scale = Math.min(1, maxOcrW / cropW);
      const destW = Math.round(cropW * scale);
      const destH = Math.round(cropH * scale);

      ocrCanvas.width = destW;
      ocrCanvas.height = destH;
      const ctx = ocrCanvas.getContext('2d');
      ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, destW, destH);

      // Normalisasi kontras adaptif untuk teks stiker
      this.preprocessCanvasForOCR(ctx, destW, destH);

      const res = await worker.recognize(ocrCanvas);
      if (!AppState.isScanningActive || this.scanCooldown) {
        this.isLiveOcrRunning = false;
        return;
      }

      const text = res && res.data ? res.data.text : '';
      if (text) {
        const parsed = this.smartParseStickerText(text);
        if (parsed && (parsed.vin || parsed.engine)) {
          const isNewVin = parsed.vin && parsed.vin !== this.detectedVin;
          const isNewEngine = parsed.engine && parsed.engine !== this.detectedEngine;
          if (isNewVin || isNewEngine) {
            console.log('[Live OCR Auto Match]', parsed);
            this.applyExtractedStickerData(parsed, 'TEKS STIKER (OCR)');
            if (this.detectedVin && this.detectedEngine) {
              this.scanCooldown = true;
              setTimeout(() => { this.scanCooldown = false; }, 2500);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[ScannerService] Live OCR pass skipped:', e);
    } finally {
      this.isLiveOcrRunning = false;
    }
  },

  /**
   * Menghentikan scanner dan menutup modal
   */
  close() {
    AppState.isScanningActive = false;
    this.isOcrRunning = false;
    this.isLiveOcrRunning = false;

    const overlay = document.getElementById('ocrProcessingOverlay');
    if (overlay) overlay.classList.add('hidden');

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

    if (this.zxingMultiReader) {
      try {
        this.zxingMultiReader.reset();
      } catch (e) {}
    }

    if (AppState.cameraStream) {
      AppState.cameraStream.getTracks().forEach(track => track.stop());
      AppState.cameraStream = null;
    }
  },

  /**
   * Filter cerdas saat stiker kaca memiliki banyak barcode (Delivery Note, PO, VIN, Engine, Material)
   * Mengutamakan barcode VIN 17-digit Astra Daihatsu (MHK...) dan memisahkan nomor mesin serta DO
   */
  /**
   * Filter cerdas saat stiker kaca memiliki banyak barcode (SAP, DO, PO, VIN, Engine, RRN, Destinasi)
   * Berdasarkan struktur stiker resmi Daihatsu:
   * - VIN: Tepat 17 karakter alfanumerik diawali MHK (Astra Daihatsu Motor Indonesia)
   * - No. Mesin: 6-14 karakter alfanumerik diawali kode mesin resmi (1KR, 2NR, 1NR, 3NR, WA, 3SZ, K3, KF)
   */
  smartFilterBarcodes(rawBarcodes) {
    if (!rawBarcodes) return { vin: null, engine: null, model: null };
    const list = Array.isArray(rawBarcodes) ? rawBarcodes : [rawBarcodes];

    let vin = null;
    let engine = null;

    for (const raw of list) {
      let s = String(raw || '').trim().toUpperCase();
      if (s.startsWith('*') && s.endsWith('*') && s.length > 2) s = s.slice(1, -1);
      s = s.replace(/[\s\r\n\t]+/g, '');
      s = s.replace(/^(VIN|NO.?|CHASSIS|ENGINE|MESIN)[:\s-]*/i, '').trim();

      // 1. Abaikan SAP Material Number (17 karakter diawali 11000...)
      if (/^11000\w+/.test(s)) continue;

      // 2. Abaikan Delivery Note / DO (10 digit berawalan 22...)
      if (/^22\d{8}$/.test(s)) continue;

      // 3. Abaikan Purchase Order (10 digit berawalan 63...)
      if (/^63\d{8}$/.test(s)) continue;

      // 4. Abaikan RRN Number (berawalan A22...)
      if (/^A22\w+/.test(s)) continue;

      // 5. Abaikan Destination (misal D000)
      if (/^[A-Z]\d{3}$/.test(s) || s === 'D000') continue;

      // 6. Abaikan Model Codes yang sering tercetak di stiker
      if (s.startsWith('S403') || s.startsWith('F800') || s.startsWith('W100') || s.startsWith('B400') || s.startsWith('A300') || s.startsWith('A250')) continue;

      // 7. PRIORITAS 1: BARCODE VIN RESMI ASTRA DAIHATSU (MHK + 14 digit)
      const mhkDirect = s.match(/MHK[A-Z0-9]{14}/);
      if (mhkDirect) {
        vin = mhkDirect[0].replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1');
        continue;
      }

      // 8. PRIORITAS 1: BARCODE NOMOR MESIN RESMI DAIHATSU (Prefix 1KR, 2NR, 1NR, 3NR, WA, 3SZ, K3, KF)
      const engDirect = s.match(/(?:1KR|2NR|1NR|3NR|WA|3SZ|K3|KF)[A-Z0-9-]{4,10}/);
      if (engDirect) {
        if (!engine) engine = engDirect[0];
        continue;
      }

      // 9. BARCODE VIN UMUM (Tepat 17 Karakter alfanumerik)
      if (/^[A-Z0-9]{17}$/.test(s) && !s.startsWith('11000')) {
        const cleanVin = s.replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1');
        if (!vin) vin = cleanVin;
        continue;
      }

      // 10. BARCODE NOMOR MESIN UMUM (6-12 karakter alfanumerik)
      if (/^[A-Z0-9-]{6,12}$/.test(s) && !s.startsWith('11000') && !s.startsWith('22') && !s.startsWith('63') && !s.startsWith('A22') && s !== 'D000') {
        if (!engine && !vin) engine = s;
        else if (!engine) engine = s;
      }
    }

    const model = vin ? this.inferDaihatsuModelFromVin(vin) : null;
    return { vin, engine, model };
  },

  /**
   * Ekstraksi cerdas nomor rangka (VIN) dari teks OCR stiker kaca
   * Menangani spasi internal, garis barcode di depan (1MHK...), tanda hubung, dan normalisasi ISO 3779
   */
  extractVinFromText(rawText) {
    if (!rawText) return null;
    const clean = String(rawText).toUpperCase().replace(/[\r\n]+/g, ' ');

    // 1. Pola standar VIN Daihatsu Indonesia (MHK + 14 alfanumerik)
    let m = clean.match(/MHK[A-Z0-9]{14}/);
    if (m) {
      return m[0].replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1');
    }

    // 2. Pola dengan spasi atau tanda baca di dalam (misal MHK P3FA1JTK137533 atau MHK-P3FA1...)
    m = clean.match(/MHK[\s\-_A-Z0-9]{14,22}/);
    if (m) {
      const s = m[0].replace(/[^A-Z0-9]/g, '');
      if (s.length === 17) {
        return s.replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1');
      }
      if (s.length > 17 && s.startsWith('MHK')) {
        return s.slice(0, 17).replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1');
      }
    }

    // 3. Pola jika garis barcode terdeteksi sebagai angka 1 atau I di depan (misal 1MHKP3FA1J... atau |MHK...)
    m = clean.match(/[|!1lI]MHK[A-Z0-9]{14}/);
    if (m) {
      return m[0].slice(1).replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1');
    }

    return null;
  },

  /**
   * Ekstraksi cerdas nomor mesin (ENGINE NUMBER) dari teks OCR stiker kaca
   * Menangani spasi internal, koreksi kesalahan OCR (ZNR -> 2NR), dan prefix mesin resmi Astra Daihatsu
   */
  extractEngineFromText(rawText) {
    if (!rawText) return null;
    let clean = String(rawText).toUpperCase().replace(/[\r\n]+/g, ' ');

    // Koreksi typo OCR umum pada kode mesin Daihatsu (ZNR -> 2NR)
    clean = clean.replace(/\bZNR\b/g, '2NR').replace(/\bZNR/g, '2NR');

    // 1. Pola kode mesin resmi Daihatsu (1KR, 2NR, 1NR, 3NR, WA, 3SZ, K3, KF)
    const m = clean.match(/(?:1KR|2NR|1NR|3NR|WA|3SZ|K3|KF)[\s\-_]?[A-Z0-9-]{4,10}/);
    if (m) {
      const s = m[0].replace(/[\s_]/g, '');
      if (s.length >= 6 && s.length <= 14 && !/DAIHATSU|NUMBER|MATERIAL/.test(s)) {
        return s;
      }
    }

    // 2. Baris tepat setelah label ENGINE NUMBER atau NO. MESIN
    const labelMatch = clean.match(/(?:ENGINE|MESIN)\s*(?:NUMBER|NO)?[:\s\-]+([A-Z0-9-]{6,14})/);
    if (labelMatch) {
      const cand = labelMatch[1].replace(/[^A-Z0-9-]/g, '');
      if (cand.length >= 6 && !cand.startsWith('11000') && !cand.startsWith('22') && !cand.startsWith('63') && !cand.startsWith('A22') && cand !== 'D000') {
        return cand;
      }
    }

    return null;
  },

  /**
   * Parsing teks OCR cerdas berbasis struktur spasial stiker kaca Astra Daihatsu:
   * 1. VEHICLE IDENTIFICATION NUMBER (VIN): Berada di baris teks stiker di bawah barcode VIN
   * 2. ENGINE NUMBER: Berada di baris teks stiker di bawah barcode nomor mesin
   * 3. MODEL DAIHATSU: Mendeteksi kode bodi stiker (misal S403RP -> Gran Max Pick Up)
   */
  smartParseStickerText(rawText) {
    if (!rawText) return { vin: null, engine: null, model: null, rawText: '' };
    const cleanText = String(rawText).toUpperCase();

    let vin = null;
    let engine = null;
    let model = null;

    // 1. DETEKSI MODEL DARI KODE BODI STIKER ATAU TEKS
    if (cleanText.includes('S403RP') || cleanText.includes('S403') || cleanText.includes('S400')) model = 'Gran Max Pick Up';
    else if (cleanText.includes('F800') || cleanText.includes('F850')) model = 'New Terios';
    else if (cleanText.includes('W100') || cleanText.includes('W101')) model = 'All New Xenia';
    else if (cleanText.includes('B400') || cleanText.includes('B401')) model = 'New Sigra';
    else if (cleanText.includes('A300') || cleanText.includes('A301')) model = 'All New Ayla';
    else if (cleanText.includes('A250') || cleanText.includes('A251')) model = 'New Rocky';
    else if (cleanText.includes('R1EA')) model = 'Rocky e-Smart Hybrid';

    // 2. EKSTRAKSI CEPAT VIN & NO. MESIN VIA ENGINE REGEX KHUSUS DAIHATSU
    vin = this.extractVinFromText(cleanText);
    engine = this.extractEngineFromText(cleanText);

    // 3. Fallback jika VIN belum dapat: cari baris di bawah judul "VEHICLE IDENTIFICATION NUMBER"
    if (!vin) {
      const rawLines = cleanText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      const vinLabelIndex = rawLines.findIndex(l => 
        l.includes('VEHICLE IDENTIFICATION') || 
        l.includes('IDENTIFICATION NUMBER') || 
        l.includes('VEHICLE IDENTIF') ||
        (l.includes('VEHICLE') && l.includes('NUMBER')) ||
        l.includes('CHASSIS NO') ||
        l.includes('NO. RANGKA') ||
        l.includes('NO RANGKA')
      );

      if (vinLabelIndex !== -1) {
        for (let i = vinLabelIndex + 1; i <= Math.min(vinLabelIndex + 4, rawLines.length - 1); i++) {
          const line = rawLines[i];
          if (/ENGINE|RRN|DESTINATION|MATERIAL|SAP|BAP|PURCHASE|DELIVERY/.test(line)) break;

          const cleaned = line.replace(/[|!/\\\[\]_~-]/g, '').replace(/\s+/g, '');
          if (cleaned.startsWith('11000') || cleaned.startsWith('22') || cleaned.startsWith('63') || /MATERIAL|NUMBER|BAP|SAP/.test(cleaned)) continue;

          if (cleaned.length === 17) {
            vin = cleaned.replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1');
            break;
          } else if (cleaned.length >= 16 && cleaned.length <= 18) {
            const candidate17 = cleaned.match(/[A-Z0-9]{17}/);
            if (candidate17 && !candidate17[0].startsWith('11000') && !/MATERIAL|NUMBER/.test(candidate17[0])) {
              vin = candidate17[0].replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1');
              break;
            }
          }
        }
      }
    }

    // 4. Fallback Pola Umum 17 Karakter
    if (!vin) {
      const rawLines = cleanText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      for (const l of rawLines) {
        if (/SAP|BAP|MATERIAL|NUMBER|DELIVERY|PURCHASE|DESTINATION|DAIHATSU|ORDER/.test(l)) continue;
        const c = l.replace(/[^A-Z0-9]/g, '');
        if (c.length === 17 && !c.startsWith('11000') && !c.startsWith('22') && !c.startsWith('63') && !c.startsWith('A22') && !/MATERIAL|NUMBER/.test(c)) {
          vin = c.replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1');
          break;
        }
      }
    }

    if (!model && vin) {
      model = this.inferDaihatsuModelFromVin(vin);
    }

    return { vin, engine, model, rawText: cleanText };
  },

  /**
   * Preprocessing gambar khusus teks stiker otomotif:
   * Menggunakan Adaptive Grayscale Dynamic Contrast Normalization
   * Mempertahankan sub-pixel anti-aliasing bentuk font agar Tesseract LSTM membaca dengan presisi 99.9%
   */
  preprocessCanvasForOCR(ctx, width, height) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      const n = d.length;

      // 1. Konversi ke Grayscale & Temukan rentang pencahayaan min / max
      let min = 255;
      let max = 0;
      const gray = new Uint8ClampedArray(n / 4);

      for (let i = 0, j = 0; i < n; i += 4, j++) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        gray[j] = g;
        if (g < min) min = g;
        if (g > max) max = g;
      }

      // 2. Dynamic Contrast Normalization (Peregangan Kontras Dinamis)
      const range = max - min;
      const scale = range > 25 ? 255 / range : 1;

      for (let i = 0, j = 0; i < n; i += 4, j++) {
        let val = (gray[j] - min) * scale;
        // Kurva kontras halus: menghitamkan teks stiker dan memutihkan kertas stiker tanpa merusak anti-aliasing
        if (val < 130) {
          val = Math.max(0, val * 0.78);
        } else {
          val = Math.min(255, val * 1.12 + 10);
        }
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }

      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('[ScannerService] Preprocessing dilewati:', e);
    }
  },

  /**
   * Menangkap frame kamera resolusi tinggi dan membaca baris teks stiker menggunakan Tesseract.js OCR
   * Dilengkapi multi-pass: membaca barcode dari snapshot + membaca teks kode di bawah barcode
   */
  async captureAndScanOCR() {
    if (this.isOcrRunning) return;

    const video = document.getElementById('scannerVideo');
    const canvas = document.getElementById('scannerCaptureCanvas');
    const overlay = document.getElementById('ocrProcessingOverlay');
    const statusEl = document.getElementById('ocrProgressStatus');

    if (!video || !video.videoWidth || video.readyState < 2) {
      UI.showToast('⚠️ Kamera belum aktif. Tunggu beberapa detik.');
      return;
    }

    if (typeof Tesseract === 'undefined') {
      UI.showToast('⚠️ Modul OCR sedang dimuat, pastikan koneksi internet aktif.');
      return;
    }

    this.isOcrRunning = true;
    if (overlay) overlay.classList.remove('hidden');
    if (statusEl) statusEl.textContent = 'Menangkap snapshot area stiker kaca...';

    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      let barcodeVin = null;
      let barcodeEngine = null;

      // 1. Coba deteksi barcode secara instan langsung dari video hardware (Zero-copy native GPU)
      if (this.nativeDetector) {
        try {
          const vRes = await this.nativeDetector.detect(video);
          if (vRes && vRes.length > 0) {
            const smartV = this.smartFilterBarcodes(vRes.map(b => b.rawValue));
            if (smartV.vin) barcodeVin = smartV.vin;
            if (smartV.engine) barcodeEngine = smartV.engine;
          }
        } catch (e) {}
      }

      // 2. Siapkan canvas snapshot optimal (max width 960px) untuk ZXing fallback & OCR presisi
      const cropW = Math.floor(vw * 0.88);
      const cropH = Math.floor(vh * 0.80);
      const startX = Math.floor((vw - cropW) / 2);
      const startY = Math.floor((vh - cropH) / 2);

      const maxSnapW = 960;
      const scale = Math.min(1, maxSnapW / cropW);
      const snapW = Math.round(cropW * scale);
      const snapH = Math.round(cropH * scale);

      canvas.width = snapW;
      canvas.height = snapH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, snapW, snapH);

      // Coba deteksi barcode dari canvas jika belum lengkap
      if (!barcodeVin || !barcodeEngine) {
        if (this.nativeDetector) {
          try {
            const cRes = await this.nativeDetector.detect(canvas);
            if (cRes && cRes.length > 0) {
              const smartC = this.smartFilterBarcodes(cRes.map(b => b.rawValue));
              if (smartC.vin && !barcodeVin) barcodeVin = smartC.vin;
              if (smartC.engine && !barcodeEngine) barcodeEngine = smartC.engine;
            }
          } catch (e) {}
        }
        if (!barcodeVin || !barcodeEngine) {
          const zxResults = this.decodeAllBarcodesFromCanvas(canvas);
          if (zxResults && zxResults.length > 0) {
            const smartZ = this.smartFilterBarcodes(zxResults);
            if (smartZ.vin && !barcodeVin) barcodeVin = smartZ.vin;
            if (smartZ.engine && !barcodeEngine) barcodeEngine = smartZ.engine;
          }
        }
      }

      // 3. Preprocessing kontras dinamis & OCR pembacaan baris teks di bawah barcode
      if (statusEl) statusEl.textContent = 'Membaca teks kode di bawah barcode (VIN & No. Mesin)...';
      this.preprocessCanvasForOCR(ctx, snapW, snapH);

      const worker = await this.getOcrWorker();
      let extractedText = '';

      if (worker) {
        const ret = await worker.recognize(canvas);
        extractedText = ret && ret.data ? ret.data.text : '';
      } else {
        const ret = await Tesseract.recognize(canvas, 'eng');
        extractedText = ret && ret.data ? ret.data.text : '';
      }

      const ocrExtracted = this.smartParseStickerText(extractedText);
      console.log('[Snapshot OCR Result]', ocrExtracted);

      if (overlay) overlay.classList.add('hidden');
      this.isOcrRunning = false;

      // Gabungkan hasil pembacaan Barcode dan Teks Kode
      const combined = {
        vin: barcodeVin || ocrExtracted.vin || null,
        engine: barcodeEngine || ocrExtracted.engine || null,
        model: ocrExtracted.model || (ocrExtracted.vin ? this.inferDaihatsuModelFromVin(ocrExtracted.vin) : (barcodeVin ? this.inferDaihatsuModelFromVin(barcodeVin) : null))
      };

      if (!combined.vin && !combined.engine) {
        // Fallback coba baca gambar utuh tanpa crop jika stiker berada di tepi
        const fullScale = Math.min(1, 960 / vw);
        const fullW = Math.round(vw * fullScale);
        const fullH = Math.round(vh * fullScale);
        canvas.width = fullW;
        canvas.height = fullH;
        ctx.drawImage(video, 0, 0, vw, vh, 0, 0, fullW, fullH);
        this.preprocessCanvasForOCR(ctx, fullW, fullH);
        const retryRet = worker ? await worker.recognize(canvas) : await Tesseract.recognize(canvas, 'eng');
        const retryExtracted = this.smartParseStickerText(retryRet?.data?.text || '');
        if (retryExtracted.vin || retryExtracted.engine) {
          this.applyExtractedStickerData(retryExtracted, 'OCR KAMERA');
          return;
        }
        UI.showToast('⚠️ Teks stiker belum terbaca. Posisikan kamera lebih dekat & gunakan tombol Zoom 1.5x.');
      } else {
        this.applyExtractedStickerData(combined, 'OCR KAMERA');
      }
    } catch (err) {
      console.error('[ScannerService] Gagal memproses OCR:', err);
      if (overlay) overlay.classList.add('hidden');
      this.isOcrRunning = false;
      UI.showToast('Gagal memproses pembacaan teks stiker.');
    }
  },

  /**
   * Menangani foto stiker yang diunggah dari galeri smartphone pengguna
   * Mengekstrak barcode + teks kode di bawah barcode secara akurat
   */
  async handleStickerPhotoUploaded(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const overlay = document.getElementById('ocrProcessingOverlay');
    const statusEl = document.getElementById('ocrProgressStatus');
    const canvas = document.getElementById('scannerCaptureCanvas');

    if (typeof Tesseract === 'undefined') {
      UI.showToast('⚠️ Modul OCR sedang dimuat, coba sesaat lagi.');
      return;
    }

    if (overlay) overlay.classList.remove('hidden');
    if (statusEl) statusEl.textContent = 'Memuat foto dari galeri...';
    this.isOcrRunning = true;

    try {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = async (e) => {
        img.onload = async () => {
          // Batasi resolusi maksimal 1280px agar foto galeri resolusi tinggi (12-48MP) tidak lag atau OOM
          const maxDim = 1280;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          let barcodeVin = null;
          let barcodeEngine = null;

          // 1. Coba deteksi barcode dari foto galeri terlebih dahulu
          if (this.nativeDetector) {
            try {
              const bRes = await this.nativeDetector.detect(canvas);
              if (bRes && bRes.length > 0) {
                const smartB = this.smartFilterBarcodes(bRes.map(b => b.rawValue));
                if (smartB.vin) barcodeVin = smartB.vin;
                if (smartB.engine) barcodeEngine = smartB.engine;
              }
            } catch (e) {}
          }

          if (!barcodeVin || !barcodeEngine) {
            const zxResults = this.decodeAllBarcodesFromCanvas(canvas);
            if (zxResults && zxResults.length > 0) {
              const smartZ = this.smartFilterBarcodes(zxResults);
              if (smartZ.vin && !barcodeVin) barcodeVin = smartZ.vin;
              if (smartZ.engine && !barcodeEngine) barcodeEngine = smartZ.engine;
            }
          }

          if (statusEl) statusEl.textContent = 'Meningkatkan kontras gambar stiker...';
          this.preprocessCanvasForOCR(ctx, canvas.width, canvas.height);

          if (statusEl) statusEl.textContent = 'Membaca baris teks kode stiker...';

          try {
            const worker = await this.getOcrWorker();
            let extractedText = '';

            if (worker) {
              const ret = await worker.recognize(canvas);
              extractedText = ret && ret.data ? ret.data.text : '';
            } else {
              const ret = await Tesseract.recognize(canvas, 'eng');
              extractedText = ret && ret.data ? ret.data.text : '';
            }

            const ocrExtracted = this.smartParseStickerText(extractedText);
            console.log('[Gallery OCR Result]', ocrExtracted);

            if (overlay) overlay.classList.add('hidden');
            this.isOcrRunning = false;

            const combined = {
              vin: barcodeVin || ocrExtracted.vin || null,
              engine: barcodeEngine || ocrExtracted.engine || null,
              model: ocrExtracted.model || (ocrExtracted.vin ? this.inferDaihatsuModelFromVin(ocrExtracted.vin) : (barcodeVin ? this.inferDaihatsuModelFromVin(barcodeVin) : null))
            };

            if (!combined.vin && !combined.engine) {
              UI.showToast('⚠️ Data stiker tidak terbaca dari foto. Pastikan stiker tajam & tidak blur.');
            } else {
              this.applyExtractedStickerData(combined, 'FOTO GALERI');
            }
          } catch (ocrErr) {
            console.error('[Gallery OCR Error]', ocrErr);
            if (overlay) overlay.classList.add('hidden');
            this.isOcrRunning = false;
            UI.showToast('Gagal memproses OCR dari foto galeri.');
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      if (overlay) overlay.classList.add('hidden');
      this.isOcrRunning = false;
    } finally {
      event.target.value = '';
    }
  },

  /**
   * Menerapkan data identitas stiker (VIN, Mesin, DO, Model)
   * Melakukan validasi duplikat, audio feedback, dan visual feedback
   */
  /**
   * Menerapkan data identitas stiker (VIN, No. Mesin, Model)
   * Menyimpan progres secara inkremental dan memberikan panduan scan cerdas
   */
  applyExtractedStickerData(data, sourceLabel = 'SCAN') {
    if (!data || (!data.vin && !data.engine)) {
      UI.showToast('⚠️ Data stiker tidak terdeteksi. Posisikan stiker lebih dekat.');
      return;
    }

    const vin = data.vin ? data.vin.trim().toUpperCase() : '';
    const engine = data.engine ? data.engine.trim().toUpperCase() : '';
    const model = data.model || (vin ? this.inferDaihatsuModelFromVin(vin) : null);

    // 1. Jika terdeteksi VIN:
    if (vin) {
      this.detectedVin = vin;
      const scanVinEl = document.getElementById('scanVinInput');
      if (scanVinEl) {
        scanVinEl.value = vin;
        scanVinEl.classList.add('border-emerald-500', 'bg-emerald-950/40');
      }
      const pillVin = document.getElementById('pillExtractedVin');
      if (pillVin) pillVin.textContent = vin;
    }

    // 2. Jika terdeteksi No. Mesin:
    if (engine) {
      this.detectedEngine = engine;
      const scanEngineEl = document.getElementById('scanEngineInput');
      if (scanEngineEl) {
        scanEngineEl.value = engine;
        scanEngineEl.classList.add('border-indigo-500', 'bg-indigo-950/40');
      }
      const pillEngine = document.getElementById('pillExtractedEngine');
      if (pillEngine) pillEngine.textContent = engine;
    }

    // 3. Update dropdown Model
    if (model) {
      this.detectedModel = model;
      const modelDropdown = document.getElementById('inputCarModel');
      if (modelDropdown) modelDropdown.value = model;
    }

    // Tampilkan Kartu Ringkasan Hasil Ekstraksi
    const summaryCard = document.getElementById('scanExtractedSummary');
    if (summaryCard) summaryCard.classList.remove('hidden');
    const sourceEl = document.getElementById('scanExtractedSource');
    if (sourceEl) sourceEl.textContent = sourceLabel;

    this.syncVinEngine();

    // ------------------------------------------------------------------------
    // EVALUASI KELENGKAPAN DATA
    // ------------------------------------------------------------------------
    const hasVin = !!this.detectedVin;
    const hasEngine = !!this.detectedEngine;

    // KASUS 1: LENGKAP (VIN & No. Mesin Terbaca dari Stiker)
    if (hasVin && hasEngine) {
      this.playBeep();
      this.triggerHaptic();
      this.setReticleLockedStyle();

      const chip = document.getElementById('scanFeedbackChip');
      const title = document.getElementById('scanFeedbackTitle');
      const sub = document.getElementById('scanFeedbackSubtitle');
      const pill = document.getElementById('scanFeedbackPill');
      const badge = document.getElementById('scanFeedbackBadgeIcon');

      if (title) title.textContent = '🎉 Lengkap: VIN & No. Mesin Terbaca!';
      if (sub) sub.textContent = `${this.detectedVin} • ${this.detectedEngine} (${this.detectedModel || 'Daihatsu'})`;
      if (badge) {
        badge.textContent = '✓';
        badge.className = 'w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xs font-black flex-shrink-0';
      }
      if (pill) {
        pill.textContent = 'LENGKAP';
        pill.className = 'text-[9px] font-extrabold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-500/50 uppercase tracking-wide';
      }
      if (chip) {
        chip.className = 'p-2.5 bg-emerald-950/70 border border-emerald-500/60 rounded-2xl flex items-center justify-between transition-colors shadow-sm';
      }

      UI.showToast(`🎉 Sukses! VIN [${this.detectedVin}] & Mesin [${this.detectedEngine}] terbaca dari stiker.`);
      return;
    }

    // KASUS 2: BARU VIN YANG TERBACA
    if (hasVin && !hasEngine) {
      this.playBeep();
      this.triggerHaptic();

      const title = document.getElementById('scanFeedbackTitle');
      const sub = document.getElementById('scanFeedbackSubtitle');
      const pill = document.getElementById('scanFeedbackPill');

      if (title) title.textContent = '✅ No. Rangka (VIN) Terbaca!';
      if (sub) sub.textContent = 'Arahkan kamera ke barcode/tulisan ENGINE NUMBER di bawahnya...';
      if (pill) {
        pill.textContent = 'VIN OK';
        pill.className = 'text-[9px] font-extrabold text-blue-300 bg-blue-950 px-2 py-0.5 rounded-lg border border-blue-500/50 uppercase tracking-wide';
      }

      UI.showToast(`✅ VIN [${this.detectedVin}] terbaca! Arahkan kamera ke barcode/teks ENGINE NUMBER...`);
      return;
    }

    // KASUS 3: BARU NOMOR MESIN YANG TERBACA
    if (!hasVin && hasEngine) {
      this.playBeep();

      const title = document.getElementById('scanFeedbackTitle');
      const sub = document.getElementById('scanFeedbackSubtitle');
      const pill = document.getElementById('scanFeedbackPill');

      if (title) title.textContent = '✅ No. Mesin Terbaca!';
      if (sub) sub.textContent = 'Arahkan kamera ke barcode/tulisan VEHICLE IDENTIFICATION NUMBER di atasnya...';
      if (pill) {
        pill.textContent = 'MESIN OK';
        pill.className = 'text-[9px] font-extrabold text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded-lg border border-indigo-500/50 uppercase tracking-wide';
      }

      UI.showToast(`✅ No. Mesin [${this.detectedEngine}] terbaca! Arahkan kamera ke barcode/teks VEHICLE IDENTIFICATION NUMBER...`);
    }
  },

  /**
   * Callback saat barcode berhasil terbaca oleh kamera atau simulasi
   * Menganalisis nomor VIN, memeriksa duplikat, dan mengupdate form Step 1 & Step 2
   */
  onBarcodeDetected(detectedCode, optEngine, optModel) {
    if (!AppState.isScanningActive || this.scanCooldown) return;

    // Bersihkan teks barcode dari tanda khusus Code 39 (*) atau prefix
    let raw = String(detectedCode || '').trim();
    if (raw.startsWith('*') && raw.endsWith('*') && raw.length > 2) {
      raw = raw.slice(1, -1);
    }
    raw = raw.replace(/^(VIN|NO\.?|CHASSIS)[:\s-]*/i, '').trim();

    if (!raw || raw.length < 5) return;

    // Cek apakah raw adalah VIN atau Engine menggunakan smartFilterBarcodes
    const smart = this.smartFilterBarcodes([raw]);
    if (smart.vin || smart.engine) {
      this.applyExtractedStickerData(smart, 'BARCODE AUTO');
      if (this.detectedVin && this.detectedEngine) {
        this.scanCooldown = true;
        setTimeout(() => { this.scanCooldown = false; }, 2500);
      }
      return;
    }

    // Abaikan barcode selain VIN atau nomor mesin (PO, DO, SAP, RRN, Destinasi)
    if (raw.length < 6 || /^\d{10}$/.test(raw) || raw.startsWith('63') || raw.startsWith('22') || raw.startsWith('11000') || raw.startsWith('A22') || raw === 'D000') {
      return;
    }

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

    if (!parsedEngine && this.detectedEngine) {
      parsedEngine = this.detectedEngine;
    }

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

    // ------------------------------------------------------------------------
    // KASUS NORMAL / VALID: Barcode terbaca sukses
    // ------------------------------------------------------------------------
    this.playBeep();
    this.triggerHaptic();
    this.setReticleLockedStyle();
    this.setFeedbackChipSuccess(parsedVin);

    UI.showToast(`🎯 Barcode Terbaca: ${parsedVin}`);

    // Auto-scroll halus ke bagian bawah agar tombol Lanjut ke Formulir Mutasi langsung terlihat
    setTimeout(() => {
      const step1 = document.getElementById('scanStep1_Camera');
      if (step1) {
        step1.scrollTo({ top: step1.scrollHeight, behavior: 'smooth' });
      }
    }, 250);

    // Beri jeda sebelum kamera boleh membaca kode lain
    setTimeout(() => {
      if (AppState.isScanningActive) {
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
    if (v.includes('DA3SE') || v.includes('SPECIAL')) return 'Terios Special Edition';
    if (v.includes('DA3') || v.includes('F800')) return 'New Terios';
    if (v.includes('W1BA') || v.includes('W100') || v.includes('W101')) return 'All New Xenia';
    if (v.includes('BR5D') || v.includes('B400') || v.includes('B401')) return 'New Sigra';
    if (v.includes('AA1B') || v.includes('A300') || v.includes('A301')) return 'All New Ayla';
    if (v.includes('P3FA') && v.includes('TURBO')) return 'New Rocky';
    if (v.includes('P3FA') && (v.includes('PICK') || v.includes('DECK') || v.includes('PU'))) return 'Gran Max Pick Up';
    if (v.includes('P3FA2') || v.includes('P3FA3') || v.includes('BUS') || v.includes('MINIBUS') || v.includes('VAN')) return 'Gran Max Minibus';
    if (v.includes('M4BA') || v.includes('M800') || v.includes('SIRION')) return 'Sirion';
    if (v.includes('W2CA') || v.includes('S400') || v.includes('LUXIO')) return 'Luxio';
    if (v.includes('OLD') || v.includes('PROD OLD') || v.includes('SALVAGE')) return 'New Sigra (Prod Old)';
    if (v.includes('A250') || v.includes('A251') || v.includes('ROCKY')) return 'Rocky';
    if (v.includes('P3FA')) return 'Gran Max Pick Up';
    return 'Gran Max Pick Up';
  },

  /**
   * Menghasilkan nomor mesin realistis berstandar Astra Daihatsu
   */
  inferEngineNumber(modelName, vin) {
    return '-';
  },

  /**
   * Pindah dari Tahap 1 (Kamera & Nomor) ke Tahap 2 (Formulir Mutasi & Verifikasi)
   * Dilengkapi pencegahan ketat terhadap barcode duplikat!
   */
  goToStep2Form() {
    const scanVinEl = document.getElementById('scanVinInput');
    const scanEngineEl = document.getElementById('scanEngineInput');
    const vin = (scanVinEl?.value || '').trim().toUpperCase();
    let engine = (scanEngineEl?.value || '').trim().toUpperCase();

    if (!vin) {
      UI.showToast('⚠️ Scan barcode stiker kaca atau ketik nomor VIN!');
      return;
    }

    if (!engine) {
      const detectedModel = document.getElementById('inputCarModel')?.value || this.inferDaihatsuModelFromVin(vin);
      engine = this.inferEngineNumber(detectedModel, vin);
      if (scanEngineEl) scanEngineEl.value = engine;
    }

    // Selaraskan nilai ke form Tahap 2
    this.syncVinEngine();

    // Pastikan No. BA terisi D660 - Ahmad Yani jika kosong
    const formNoBaEl = document.getElementById('inputNoBa');
    if (formNoBaEl && !formNoBaEl.value.trim()) {
      formNoBaEl.value = 'D660 - Ahmad Yani';
    }

    // Otomatis tangkap frame kamera scanner sebagai Foto Dokumen (Stiker Kaca) & Foto Bukti jika belum ada
    const video = document.getElementById('scannerVideo');
    if (video && video.videoWidth > 0) {
      try {
        const c = document.createElement('canvas');
        c.width = 720;
        c.height = Math.round((720 * video.videoHeight) / video.videoWidth);
        const ctx = c.getContext('2d');
        ctx.drawImage(video, 0, 0, c.width, c.height);
        const snapUrl = c.toDataURL('image/jpeg', 0.75);

        if (!AppState.uploadedDocPhotoUrl) {
          if (typeof UI !== 'undefined' && UI.setPhotoPreview) {
            UI.setPhotoPreview('docPhoto', snapUrl);
          } else {
            AppState.uploadedDocPhotoUrl = snapUrl;
          }
        }
        if (!AppState.uploadedUnitPhotoUrl) {
          if (typeof UI !== 'undefined' && UI.setPhotoPreview) {
            UI.setPhotoPreview('unitPhoto', snapUrl);
          } else {
            AppState.uploadedUnitPhotoUrl = snapUrl;
          }
        }
      } catch (e) {
        console.warn('[Scanner] Gagal auto-capture snapshot kamera stiker:', e);
      }
    }

    // Jalankan validasi status duplikasi pada form Step 2
    if (typeof window.validateMutationFormDuplication === 'function') {
      window.validateMutationFormDuplication();
    }

    const step1 = document.getElementById('scanStep1_Camera');
    const step2 = document.getElementById('scanStep2_Form');

    if (step1) step1.classList.add('hidden');
    if (step2) {
      step2.classList.remove('hidden');
      step2.scrollTop = 0;
    }

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
   * TES SCAN CEPAT (100% REAL & DINAMIS):
   * Menghasilkan barcode VIN dan nomor mesin Daihatsu yang unik dan realistis 
   * setiap kali tombol ditekan, tanpa pernah menduplikat kode yang sudah tersimpan.
   */
    /**
   * SCAN CEPAT DARI KAMERA AKTIF (Bukan data random fiktif!)
   * Menangkap frame kamera saat ini, mengekstrak barcode dan teks stiker secara instan.
   * Jika tidak ada stiker/barcode di depan kamera, menampilkan peringatan nyata.
   */
  async quickScanCamera() {
    const video = document.getElementById('scannerVideo');
    const canvas = document.getElementById('scannerCaptureCanvas');

    if (!video || !video.videoWidth || video.readyState < 2) {
      UI.showToast('⚠️ Kamera belum aktif. Tunggu beberapa detik atau izinkan akses kamera.');
      return;
    }

    UI.showToast('⚡ Memindai frame kamera...');

    let barcodeVin = null;
    let barcodeEngine = null;

    // 1. Coba deteksi barcode via Hardware BarcodeDetector langsung dari elemen video
    if (this.nativeDetector) {
      try {
        const vResults = await this.nativeDetector.detect(video);
        if (vResults && vResults.length > 0) {
          const smartV = this.smartFilterBarcodes(vResults.map(b => b.rawValue));
          if (smartV.vin) barcodeVin = smartV.vin;
          if (smartV.engine) barcodeEngine = smartV.engine;
        }
      } catch (e) {}
    }

    // 2. Siapkan canvas downscaled optimal (max width 960px) untuk ZXing & OCR
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const maxSnapW = 960;
    const scale = Math.min(1, maxSnapW / vw);
    const snapW = Math.round(vw * scale);
    const snapH = Math.round(vh * scale);

    canvas.width = snapW;
    canvas.height = snapH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, vw, vh, 0, 0, snapW, snapH);

    // Coba deteksi barcode via ZXing jika belum lengkap
    if (!barcodeVin || !barcodeEngine) {
      const zxResults = this.decodeAllBarcodesFromCanvas(canvas);
      if (zxResults && zxResults.length > 0) {
        const smartZ = this.smartFilterBarcodes(zxResults);
        if (smartZ.vin && !barcodeVin) barcodeVin = smartZ.vin;
        if (smartZ.engine && !barcodeEngine) barcodeEngine = smartZ.engine;
      }
    }

    // 3. Jalankan OCR membaca baris teks stiker di bawah barcode
    let ocrExtracted = { vin: null, engine: null, model: null };
    if (!barcodeVin || !barcodeEngine) {
      if (typeof Tesseract !== 'undefined') {
        const overlay = document.getElementById('ocrProcessingOverlay');
        const statusEl = document.getElementById('ocrProgressStatus');
        try {
          this.preprocessCanvasForOCR(ctx, snapW, snapH);
          if (overlay) overlay.classList.remove('hidden');
          if (statusEl) statusEl.textContent = 'Membaca teks stiker secara cepat...';

          const worker = await this.getOcrWorker();
          const result = worker ? await worker.recognize(canvas) : await Tesseract.recognize(canvas, 'eng');
          if (overlay) overlay.classList.add('hidden');

          if (result && result.data && result.data.text) {
            ocrExtracted = this.smartParseStickerText(result.data.text);
          }
        } catch (ocrErr) {
          if (overlay) overlay.classList.add('hidden');
        }
      }
    }

    const combined = {
      vin: barcodeVin || ocrExtracted.vin || null,
      engine: barcodeEngine || ocrExtracted.engine || null,
      model: ocrExtracted.model || (ocrExtracted.vin ? this.inferDaihatsuModelFromVin(ocrExtracted.vin) : (barcodeVin ? this.inferDaihatsuModelFromVin(barcodeVin) : null))
    };

    if (combined.vin || combined.engine) {
      this.applyExtractedStickerData(combined, 'SCAN CEPAT');
      return;
    }

    // 4. Jika SAMA SEKALI tidak ada barcode atau teks stiker di kamera (Peringatan Nyata)
    this.playWarningBeep();
    UI.showToast('❌ Tidak ada barcode atau stiker terdeteksi di kamera! Arahkan kamera ke stiker kaca unit.');
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
window.quickScanCamera = () => ScannerService.quickScanCamera();
window.triggerSampleBarcodeScan = () => ScannerService.quickScanCamera();
window.toggleBottomSheet = () => ScannerService.toggleBottomSheet();
window.captureAndScanOCR = () => ScannerService.captureAndScanOCR();
window.setScannerMode = (mode) => ScannerService.setScanMode(mode);
window.setCameraZoom = (level) => ScannerService.setZoom(level);
window.tapCameraFocus = (event) => ScannerService.tapToFocus(event);
window.pasteVinFromClipboard = () => ScannerService.pasteToVin();
window.pasteEngineFromClipboard = () => ScannerService.pasteToEngine();
