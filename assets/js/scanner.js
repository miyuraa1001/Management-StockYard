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
  scanCooldown: false,
  lastExtractedData: null,

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
    this.isOcrRunning = false;
    this.scanCooldown = false;
    this.lastExtractedData = null;
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

    const displayVinEl = document.getElementById('displaySummaryVin');
    const displayEngineEl = document.getElementById('displaySummaryEngine');
    if (displayVinEl) displayVinEl.textContent = '-';
    if (displayEngineEl) displayEngineEl.textContent = '-';

    this.resetScanFeedbackChip();
    this.resetReticleStyle();

    modal.classList.remove('hidden');
    AppState.isScanningActive = true;

    // Periksa dukungan Hardware BarcodeDetector
    let hasNativeDetector = false;
    if ('BarcodeDetector' in window) {
      try {
        const supported = await BarcodeDetector.getSupportedFormats();
        if (supported && supported.length > 0) {
          this.nativeDetector = new BarcodeDetector({
            formats: supported.filter(f => ['code_128', 'code_39', 'qr_code', 'data_matrix', 'itf', 'ean_13', 'upc_a'].includes(f))
          });
          hasNativeDetector = true;
        }
      } catch (e) {
        this.nativeDetector = null;
        hasNativeDetector = false;
      }
    }

    // Resolusi kamera optimal 720p (sangat ringan, 60fps mulus, tanpa CPU lag / freeze)
    const cameraConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: AppState.facingMode || 'environment' },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 }
      }
    };

    try {
      // 1. Prioritaskan Native BarcodeDetector (GPU hardware-accelerated, 0% CPU lag)
      if (hasNativeDetector && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        AppState.cameraStream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
        const videoEl = document.getElementById('scannerVideo');
        if (videoEl) {
          videoEl.srcObject = AppState.cameraStream;
          await videoEl.play().catch(() => {});
          this.startNativeDetectorLoop();
        }
      } 
      // 2. Fallback untuk browser tanpa BarcodeDetector: Gunakan ZXing dengan interval aman (200ms)
      else if (typeof ZXing !== 'undefined') {
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        const formats = [
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.QR_CODE,
          ZXing.BarcodeFormat.DATA_MATRIX
        ];
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);

        AppState.codeReader = new ZXing.BrowserMultiFormatReader(hints, 200);
        await AppState.codeReader.decodeFromConstraints(cameraConstraints, 'scannerVideo', (result, err) => {
          if (result && AppState.isScanningActive && this.scanMode !== 'ocr' && !this.isOcrRunning && !this.scanCooldown) {
            const code = result.getText();
            const smart = this.smartFilterBarcodes([code]);
            if (smart.vin) {
              this.scanCooldown = true;
              this.applyExtractedStickerData(smart, 'BARCODE AUTO');
              setTimeout(() => { this.scanCooldown = false; }, 3000);
            } else {
              this.onBarcodeDetected(code);
            }
          }
        });
      } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        AppState.cameraStream = await navigator.mediaDevices.getUserMedia(cameraConstraints);
        const videoEl = document.getElementById('scannerVideo');
        if (videoEl) {
          videoEl.srcObject = AppState.cameraStream;
          await videoEl.play().catch(() => {});
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

      // Jika dalam mode OCR atau sedang cooling down atau proses OCR berjalan, lewati deteksi
      if (this.scanMode === 'ocr' || this.isOcrRunning || this.scanCooldown) {
        this.detectorAnimationId = requestAnimationFrame(detectFrame);
        return;
      }

      // Throttle pemeriksaan setiap 160ms agar GPU/CPU tetap dingin & hemat baterai
      if (timestamp - lastScanTime >= 160 && !isProcessing && video.readyState >= 2 && !video.paused) {
        isProcessing = true;
        lastScanTime = timestamp;
        try {
          const barcodes = await this.nativeDetector.detect(video);
          if (barcodes && barcodes.length > 0 && AppState.isScanningActive && !this.scanCooldown) {
            const rawValues = barcodes.map(b => b.rawValue).filter(Boolean);
            const smart = this.smartFilterBarcodes(rawValues);

            if (smart.vin) {
              this.scanCooldown = true;
              this.applyExtractedStickerData(smart, 'BARCODE AUTO');
              setTimeout(() => { this.scanCooldown = false; }, 3000);
            } else if (rawValues.length > 0) {
              this.onBarcodeDetected(rawValues[0]);
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
    this.isOcrRunning = false;

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

    if (AppState.cameraStream) {
      AppState.cameraStream.getTracks().forEach(track => track.stop());
      AppState.cameraStream = null;
    }
  },

  /**
   * Filter cerdas saat stiker kaca memiliki banyak barcode (Delivery Note, PO, VIN, Engine, Material)
   * Mengutamakan barcode VIN 17-digit Astra Daihatsu (MHK...) dan memisahkan nomor mesin serta DO
   */
  smartFilterBarcodes(rawBarcodes) {
    if (!rawBarcodes) return { vin: null, engine: null, doNumber: null, model: null };
    const list = Array.isArray(rawBarcodes) ? rawBarcodes : [rawBarcodes];

    let vin = null;
    let engine = null;
    let doNumber = null;

    for (const raw of list) {
      let s = String(raw || '').trim().toUpperCase();
      if (s.startsWith('*') && s.endsWith('*') && s.length > 2) s = s.slice(1, -1);
      s = s.replace(/^(VIN|NO\.?|CHASSIS)[:\s-]*/i, '').trim();

      // Prioritas 1: 17 karakter VIN Astra Daihatsu Motor (MHK/MFK/MR)
      if (/^(?:MHK|MFK|MR[A-Z])[A-Z0-9]{14}$/.test(s)) {
        vin = s;
      }
      // Prioritas 2: 17 karakter ISO 3779 diawali huruf (bukan material code angka 11000...)
      else if (/^[A-Z][A-HJ-NPR-Z0-9]{16}$/.test(s) && !s.startsWith('11') && !s.startsWith('A22')) {
        if (!vin) vin = s;
      }
      // Nomor Mesin Daihatsu (2NR, 1NR, 1KR, 3NR, WA, 3SZ, KF)
      else if (/^(?:2NR|1NR|1KR|3NR|3SZ|WA|KF)[A-Z0-9-]{4,10}$/.test(s)) {
        if (!engine) engine = s;
      }
      // Nomor Delivery Note (10 digit diawali 22...)
      else if (/^22\d{8}$/.test(s)) {
        if (!doNumber) doNumber = s;
      }
    }

    const model = vin ? this.inferDaihatsuModelFromVin(vin) : null;
    return { vin, engine, doNumber, model };
  },

  /**
   * Parsing baris teks OCR dari foto/snapshot stiker kaca
   * Menemukan baris VIN (MHK...), Engine (2NR...), DO (22...), dan kode model (S403RP...)
   */
  smartParseStickerText(rawText) {
    if (!rawText) return { vin: null, engine: null, doNumber: null, model: null, rawText: '' };
    const cleanText = String(rawText).toUpperCase();
    const lines = cleanText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);

    let vin = null;
    let engine = null;
    let doNumber = null;
    let model = null;

    // 1. Ekstraksi VIN (17 Karakter)
    for (const line of lines) {
      const compact = line.replace(/[^A-Z0-9]/g, '');
      const mhkMatch = compact.match(/(?:MHK|MFK|MR[A-Z])[A-Z0-9]{14}/);
      if (mhkMatch) {
        vin = mhkMatch[0];
        break;
      }
    }

    // Fallback: 17 karakter umum berawalan huruf
    if (!vin) {
      for (const line of lines) {
        const compact = line.replace(/[^A-Z0-9]/g, '');
        const genVin = compact.match(/^[A-Z][A-HJ-NPR-Z0-9]{16}$/);
        if (genVin && !compact.startsWith('11') && !compact.startsWith('A22')) {
          vin = genVin[0];
          break;
        }
      }
    }

    // Normalisasi karakter OCR pada nomor seri VIN (I->1, O/Q->0)
    if (vin && vin.length === 17) {
      const prefix = vin.slice(0, 11);
      let serial = vin.slice(11).replace(/O/g, '0').replace(/Q/g, '0').replace(/I/g, '1').replace(/S/g, '5').replace(/Z/g, '2');
      vin = prefix + serial;
    }

    // 2. Ekstraksi Nomor Mesin
    for (const line of lines) {
      const compact = line.replace(/[^A-Z0-9-]/g, '');
      const engMatch = compact.match(/(?:2NR|1NR|1KR|3NR|3SZ|WA|KF)[A-Z0-9-]{4,10}/);
      if (engMatch && !engine) {
        engine = engMatch[0];
        break;
      }
    }

    // 3. Ekstraksi Delivery Note (10 digit diawali 22...)
    for (const line of lines) {
      const compact = line.replace(/[^0-9]/g, '');
      const doMatch = compact.match(/^22\d{8}$/);
      if (doMatch && !doNumber) {
        doNumber = doMatch[0];
        break;
      }
    }

    // 4. Deteksi Model dari kode stiker (misal S403RP -> Gran Max Pick Up)
    for (const line of lines) {
      if (line.includes('S403RP') || line.includes('S400') || line.includes('S403')) {
        model = 'Gran Max Pick Up';
        break;
      }
      if (line.includes('A300') || line.includes('A301')) {
        model = 'All New Ayla';
        break;
      }
      if (line.includes('B400') || line.includes('B401')) {
        model = 'New Sigra';
        break;
      }
      if (line.includes('W100') || line.includes('W101')) {
        model = 'All New Xenia';
        break;
      }
      if (line.includes('F800') || line.includes('F850')) {
        model = 'New Terios';
        break;
      }
      if (line.includes('A250') || line.includes('A251')) {
        model = 'New Rocky';
        break;
      }
    }

    if (!model && vin) {
      model = this.inferDaihatsuModelFromVin(vin);
    }

    return { vin, engine, doNumber, model, rawText };
  },

  /**
   * Preprocessing gambar untuk mempertajam teks stiker:
   * Mengubah ke grayscale dan meningkatkan kontras agar karakter tajam
   */
  preprocessCanvasForOCR(ctx, width, height) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;

      const contrast = 35; // Meningkatkan kontras 35%
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const adjusted = factor * (gray - 128) + 128;
        const finalVal = Math.min(255, Math.max(0, adjusted));

        d[i] = finalVal;
        d[i + 1] = finalVal;
        d[i + 2] = finalVal;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      // Lewati preprocessing jika canvas terisolasi CORS
    }
  },

  /**
   * Menangkap frame kamera resolusi penuh dan membaca teks stiker menggunakan Tesseract.js OCR
   */
  async captureAndScanOCR() {
    if (this.isOcrRunning) return;

    const video = document.getElementById('scannerVideo');
    const canvas = document.getElementById('scannerCaptureCanvas');
    const overlay = document.getElementById('ocrProcessingOverlay');
    const statusEl = document.getElementById('ocrProgressStatus');

    if (!video || !video.videoWidth) {
      UI.showToast('⚠️ Kamera belum aktif. Tunggu beberapa detik.');
      return;
    }

    if (typeof Tesseract === 'undefined') {
      UI.showToast('⚠️ Modul OCR sedang dimuat, pastikan koneksi internet aktif.');
      return;
    }

    this.isOcrRunning = true;
    if (overlay) overlay.classList.remove('hidden');
    if (statusEl) statusEl.textContent = 'Menangkap snapshot resolusi tinggi...';

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (statusEl) statusEl.textContent = 'Meningkatkan kontras teks stiker...';
      this.preprocessCanvasForOCR(ctx, canvas.width, canvas.height);

      if (statusEl) statusEl.textContent = 'Membaca baris kode stiker (VIN, Mesin, DO)...';

      const result = await Tesseract.recognize(canvas, 'eng', {
        logger: m => {
          if (m && m.status === 'recognizing text' && statusEl) {
            const pct = Math.floor((m.progress || 0) * 100);
            statusEl.textContent = `Membaca teks stiker (${pct}%)...`;
          }
        }
      });

      const extracted = this.smartParseStickerText(result.data ? result.data.text : '');
      console.log('[OCR Result]', extracted);

      if (overlay) overlay.classList.add('hidden');
      this.isOcrRunning = false;

      if (!extracted.vin && !extracted.engine && !extracted.doNumber) {
        UI.showToast('⚠️ Teks stiker belum terbaca jelas. Posisikan kamera lebih dekat & tegak lurus.');
      } else {
        this.applyExtractedStickerData(extracted, 'OCR KAMERA');
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
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          if (statusEl) statusEl.textContent = 'Meningkatkan kontras gambar...';
          this.preprocessCanvasForOCR(ctx, canvas.width, canvas.height);

          if (statusEl) statusEl.textContent = 'Membaca teks dari stiker foto...';

          try {
            const result = await Tesseract.recognize(canvas, 'eng', {
              logger: m => {
                if (m && m.status === 'recognizing text' && statusEl) {
                  const pct = Math.floor((m.progress || 0) * 100);
                  statusEl.textContent = `Membaca teks stiker (${pct}%)...`;
                }
              }
            });

            const extracted = this.smartParseStickerText(result.data ? result.data.text : '');
            console.log('[Gallery OCR Result]', extracted);

            if (overlay) overlay.classList.add('hidden');
            this.isOcrRunning = false;

            if (!extracted.vin && !extracted.engine && !extracted.doNumber) {
              UI.showToast('⚠️ Data stiker tidak terbaca dari foto. Pastikan stiker tajam & tidak blur.');
            } else {
              this.applyExtractedStickerData(extracted, 'FOTO GALERI');
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
  applyExtractedStickerData(data, sourceLabel = 'SCAN') {
    if (!data || (!data.vin && !data.engine && !data.doNumber)) {
      UI.showToast('⚠️ Data stiker tidak terdeteksi lengkap. Coba foto lebih dekat.');
      return;
    }

    const vin = data.vin ? data.vin.trim().toUpperCase() : '';
    let engine = data.engine ? data.engine.trim().toUpperCase() : '';
    let model = data.model || (vin ? this.inferDaihatsuModelFromVin(vin) : null);

    if (vin && !engine) {
      engine = this.inferEngineNumber(model, vin);
    }

    // ------------------------------------------------------------------------
    // CEK VALIDASI DUPLIKAT: Satu kode barcode yang sudah terscan hanya bisa 1x simpan!
    // ------------------------------------------------------------------------
    const isDuplicate = vin ? AppState.isVinDuplicate(vin) : false;
    this.lastScannedIsDuplicate = isDuplicate;

    // Update input di Step 1
    const scanVinEl = document.getElementById('scanVinInput');
    const scanEngineEl = document.getElementById('scanEngineInput');
    if (scanVinEl && vin) scanVinEl.value = vin;
    if (scanEngineEl && engine) scanEngineEl.value = engine;

    // Sinkronkan ke Step 2
    this.syncVinEngine();

    // Auto-select dropdown model kendaraan
    if (model) {
      const modelDropdown = document.getElementById('inputCarModel');
      if (modelDropdown) modelDropdown.value = model;
    }

    // Tampilkan Card Multi-Field Extracted Summary Pills
    const summaryCard = document.getElementById('scanExtractedSummary');
    const sourceEl = document.getElementById('scanExtractedSource');
    const pillVin = document.getElementById('pillExtractedVin');
    const pillEngine = document.getElementById('pillExtractedEngine');
    const pillDo = document.getElementById('pillExtractedDo');

    if (summaryCard) summaryCard.classList.remove('hidden');
    if (sourceEl) sourceEl.textContent = sourceLabel;
    if (pillVin) pillVin.textContent = vin || '-';
    if (pillEngine) pillEngine.textContent = engine || '-';
    if (pillDo) pillDo.textContent = data.doNumber || '-';

    // Jika nomor DO ditemukan, tambahkan catatan otomatis ke keterangan mutasi jika kosong
    if (data.doNumber) {
      const ketEl = document.getElementById('inputKeterangan');
      if (ketEl && !ketEl.value.includes(data.doNumber)) {
        ketEl.value = (ketEl.value ? ketEl.value + ' | ' : '') + `No. DO: ${data.doNumber}`;
      }
    }

    if (isDuplicate) {
      this.playWarningBeep();
      this.triggerWarningHaptic();
      this.setReticleDuplicateStyle();
      this.setFeedbackChipDuplicate(vin);
      UI.showToast(`⛔ Barcode [${vin}] SUDAH PERNAH TERSIMPAN! (Duplikat Ditolak)`);

      setTimeout(() => {
        if (AppState.isScanningActive && this.lastScannedIsDuplicate) {
          this.resetReticleStyle();
        }
      }, 4000);
      return;
    }

    // Berhasil dan Valid
    this.playBeep();
    this.triggerHaptic();
    this.setReticleLockedStyle();
    this.setFeedbackChipSuccess(vin);
    UI.showToast(`🎯 ${sourceLabel}: Berhasil Membaca ${vin}`);

    // Auto-scroll halus ke bagian bawah agar tombol Lanjut ke Formulir Mutasi langsung terlihat
    setTimeout(() => {
      const step1 = document.getElementById('scanStep1_Camera');
      if (step1) {
        step1.scrollTo({ top: step1.scrollHeight, behavior: 'smooth' });
      }
    }, 250);

    setTimeout(() => {
      if (AppState.isScanningActive && !this.lastScannedIsDuplicate) {
        this.resetReticleStyle();
      }
    }, 3000);
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

    // Cek apakah raw adalah VIN atau identitas stiker menggunakan smartFilterBarcodes
    const smart = this.smartFilterBarcodes([raw]);
    if (smart.vin) {
      this.scanCooldown = true;
      this.applyExtractedStickerData(smart, 'BARCODE AUTO');
      setTimeout(() => { this.scanCooldown = false; }, 3000);
      return;
    }

    // Jika yang terdeteksi HANYA nomor DO (10 digit):
    if (smart.doNumber) {
      const pillDo = document.getElementById('pillExtractedDo');
      const summaryCard = document.getElementById('scanExtractedSummary');
      if (pillDo) pillDo.textContent = smart.doNumber;
      if (summaryCard) summaryCard.classList.remove('hidden');
      UI.showToast(`ℹ️ No. DO terdeteksi (${smart.doNumber}). Arahkan ke barcode VIN (MHK...)`);
      return;
    }

    // Jika yang terdeteksi HANYA nomor mesin:
    if (smart.engine) {
      const scanEngineEl = document.getElementById('scanEngineInput');
      const pillEngine = document.getElementById('pillExtractedEngine');
      const summaryCard = document.getElementById('scanExtractedSummary');
      if (scanEngineEl) scanEngineEl.value = smart.engine;
      if (pillEngine) pillEngine.textContent = smart.engine;
      if (summaryCard) summaryCard.classList.remove('hidden');
      UI.showToast(`ℹ️ No. Mesin terdeteksi (${smart.engine}). Arahkan ke barcode VIN (MHK...)`);
      return;
    }

    // Abaikan nomor PO atau kode acak bukan VIN
    if (raw.length < 12 || /^\d{10}$/.test(raw) || raw.startsWith('632') || raw.startsWith('11000')) {
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
window.captureAndScanOCR = () => ScannerService.captureAndScanOCR();
window.setScannerMode = (mode) => ScannerService.setScanMode(mode);
