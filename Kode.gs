/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT - MANAGEMENT SALVAGE DAIHATSU (FIXED V2.2)
 * PT Astra Daihatsu Motor • DSO Sentra Lampung
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// KONFIGURASI GLOBAL & KEAMANAN
// ----------------------------------------------------------------------------
const API_SECRET_TOKEN = "DSO-SALVAGE-SECRET-KEY-982143";
const DEFAULT_TARGET_EMAIL = "syafirafira08162@gmail.com";
const TIMEZONE = "Asia/Jakarta";

// ID FOLDER GOOGLE DRIVE ANDA
const DEFAULT_DRIVE_FOLDER_ID = "1qQR4cxbBGB2DNi9mML9l3TZzKC6992A2";

// ID Spreadsheet (Opsional: Jika skrip dibuat dari menu Ekstensi > Apps Script, kosongkan saja)
const SPREADSHEET_ID = "1q1ipsiObbjVy1xkumnNOFG2mfHpU48glIrN7HfaZieQ";

// NAMA SHEET DATABASE
const TAB_USERS = "UserPIC";
const TAB_HISTORY = "HistoryMutasi";
const TAB_INVENTORY = "Inventory";
const TAB_CONFIG = "SystemConfig";

/**
 * Helper untuk mendapatkan objek Spreadsheet aktif secara aman
 */
function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } catch (e) {
      Logger.log("Gagal membuka Spreadsheet via ID: " + e.toString());
    }
  }
  return null;
}

/**
 * Validasi otentikasi Secret Token
 */
function isAuthorized(e, body) {
  if (!API_SECRET_TOKEN || API_SECRET_TOKEN.trim() === "") return true;
  const queryToken = (e && e.parameter && e.parameter.token) ? e.parameter.token : null;
  if (queryToken && queryToken === API_SECRET_TOKEN) return true;
  if (body && body.token && body.token === API_SECRET_TOKEN) return true;
  return false;
}

/**
 * ----------------------------------------------------------------------------
 * 1. FUNGSI AMBIL ID FOLDER GOOGLE DRIVE (Aman Dijalankan Langsung)
 * ----------------------------------------------------------------------------
 */
function getDriveFolderId(ss) {
  if (!ss) {
    ss = getSpreadsheet();
  }

  if (ss) {
    try {
      const sheetConfig = ss.getSheetByName(TAB_CONFIG);
      if (sheetConfig) {
        const rows = sheetConfig.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][0] === "DRIVE_FOLDER_ID" && rows[i][1]) {
            const val = String(rows[i][1]).trim();
            if (val !== "") return val;
          }
        }
      }
    } catch (err) {
      Logger.log("Peringatan saat membaca config sheet: " + err.toString());
    }
  }

  return DEFAULT_DRIVE_FOLDER_ID;
}

function getTargetEmail(ss) {
  if (!ss) ss = getSpreadsheet();
  if (ss) {
    try {
      const sheetConfig = ss.getSheetByName(TAB_CONFIG);
      if (sheetConfig) {
        const rows = sheetConfig.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][0] === "TARGET_EMAIL" && rows[i][1]) {
            const val = String(rows[i][1]).trim();
            if (val !== "") return val;
          }
        }
      }
    } catch (err) {
      Logger.log("Peringatan saat membaca config target email: " + err.toString());
    }
  }
  return DEFAULT_TARGET_EMAIL;
}


/**
 * ----------------------------------------------------------------------------
 * 2. TES KONEKSI GOOGLE DRIVE (Jalankan Fungsi Ini 1x di Editor untuk Otorisasi)
 * ----------------------------------------------------------------------------
 */
function testDriveFolderConnection() {
  const folderId = getDriveFolderId();
  Logger.log("🔍 Memeriksa Folder ID: " + folderId);

  if (!folderId || folderId.trim() === "") {
    Logger.log("⚠️ Folder ID belum terisi!");
    return;
  }

  try {
    const folder = DriveApp.getFolderById(folderId.trim());
    Logger.log("✅ BERHASIL TERHUBUNG KE GOOGLE DRIVE!");
    Logger.log("📁 Nama Folder: " + folder.getName());
    Logger.log("🔗 URL Folder: " + folder.getUrl());

    // Buat file tes kecil untuk memastikan hak akses tulis
    const testFile = folder.createFile("uji_koneksi.txt", "Koneksi Google Apps Script berhasil pada " + new Date().toString());
    try {
      testFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {}
    Logger.log("🎉 Berhasil membuat file uji coba di folder Drive Anda! ID: " + testFile.getId());

    // Hapus file tes kembali agar folder tetap rapi
    testFile.setTrashed(true);
    Logger.log("🧹 File uji coba telah dibersihkan. Izin Google Drive 100% AKTIF!");
  } catch (err) {
    Logger.log("❌ Gagal mengakses folder di Drive: " + err.toString());
  }
}

/**
 * ----------------------------------------------------------------------------
 * 3. HELPER UPLOAD GAMBAR BASE64 KE GOOGLE DRIVE (Robust & Anti-Crash)
 * ----------------------------------------------------------------------------
 */
function saveBase64ImageToDrive(base64Data, fileName, folderId) {
  if (!base64Data || typeof base64Data !== 'string') return "";
  
  // Jika sudah berupa link URL luar/lokal (bukan base64), langsung kembalikan
  if (!base64Data.startsWith('data:image')) {
    return base64Data;
  }

  try {
    let targetFolder = null;
    const cleanId = (folderId || getDriveFolderId() || "").trim();

    // 1. Prioritas utama: buka berdasarkan folderId yang dikonfigurasi
    if (cleanId !== "") {
      try {
        targetFolder = DriveApp.getFolderById(cleanId);
      } catch (errFolder) {
        Logger.log("Peringatan: Gagal membuka folder ID (" + cleanId + "): " + errFolder.toString());
      }
    }

    // 2. Jika folder ID tidak bisa dibuka, cari folder berdasarkan nama
    if (!targetFolder) {
      const folderNames = ["Dokumentasi Salvage Daihatsu", "Daihatsu_Logistics_Bukti_Mutasi", "Salvage_Daihatsu_Bukti_Mutasi"];
      for (let i = 0; i < folderNames.length; i++) {
        const existing = DriveApp.getFoldersByName(folderNames[i]);
        if (existing.hasNext()) {
          targetFolder = existing.next();
          break;
        }
      }
    }

    // 3. Jika belum ada, buat folder baru
    if (!targetFolder) {
      targetFolder = DriveApp.createFolder("Dokumentasi Salvage Daihatsu");
    }

    // Ekstraksi data base64 dengan split (lebih aman dari kegagalan regex pada string besar)
    const commaIndex = base64Data.indexOf(",");
    if (commaIndex === -1) return "";

    const metaPart = base64Data.substring(0, commaIndex);
    const rawBase64 = base64Data.substring(commaIndex + 1);

    let mimeType = "image/jpeg";
    if (metaPart.includes("image/png")) mimeType = "image/png";
    else if (metaPart.includes("image/webp")) mimeType = "image/webp";

    const decodedBytes = Utilities.base64Decode(rawBase64);
    const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    const file = targetFolder.createFile(blob);

    // Atur hak akses agar foto bisa diakses dengan aman
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eShare) {
      Logger.log("Catatan hak akses file: " + eShare.toString());
    }

    // Kembalikan URL Google CDN Thumbnail resmi (Aman dari blokir 403 / CORS)
    return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";

  } catch (err) {
    Logger.log("Gagal mengunggah foto ke Google Drive: " + err.toString());
    return "";
  }
}

/**
 * ----------------------------------------------------------------------------
 * 4. API GET HANDLER
 * ----------------------------------------------------------------------------
 */
function doGet(e) {
  try {
    if (!isAuthorized(e, null)) {
      return createJsonResponse({ success: false, error: "401 Unauthorized: Secret Token tidak valid." });
    }

    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getInitialData";
    const ss = getSpreadsheet();

    if (action === "ping") {
      return createJsonResponse({ 
        success: true, 
        message: "PONG - Backend Management Salvage Daihatsu Aktif!", 
        timestamp: new Date().toISOString() 
      });
    }

    if (action === "getInitialData") {
      const inventory = getInventoryData(ss);
      const history = getHistoryData(ss);
      const kpi = calculateKpis(inventory, history);
      return createJsonResponse({
        success: true,
        data: { inventory, history, kpi }
      });
    }

    if (action === "getInventory") {
      return createJsonResponse({ success: true, data: getInventoryData(ss) });
    }

    if (action === "getHistory") {
      return createJsonResponse({ success: true, data: getHistoryData(ss) });
    }

    if (action === "getUsers") {
      return createJsonResponse({ success: true, data: getUsersData(ss) });
    }

    return createJsonResponse({ success: false, message: "Action GET '" + action + "' tidak dikenali." });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * ----------------------------------------------------------------------------
 * 5. API POST HANDLER (Dengan Pencegahan Barcode Duplikat & Upload Foto)
 * ----------------------------------------------------------------------------
 */
function doPost(e) {
  try {
    const ss = getSpreadsheet();
    let body = {};

    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        body = { raw: e.postData.contents };
      }
    }

    if (!isAuthorized(e, body)) {
      return createJsonResponse({ success: false, error: "401 Unauthorized: Secret Token tidak valid." });
    }

    const action = body.action || "saveMutation";
    const data = body.data || body;

    // A. ACTION: LOGIN PETUGAS PIC
    if (action === "login") {
      const usernameInput = String(data.username || "").trim().toLowerCase();
      const passwordInput = String(data.password || "").trim();

      const user = verifyUserCredentials(ss, usernameInput, passwordInput);
      if (user) {
        return createJsonResponse({ success: true, message: "Login berhasil!", user: user });
      } else {
        return createJsonResponse({ success: false, message: "Username atau Password salah." });
      }
    }

    // B. ACTION: UPDATE PROFIL PIC
    if (action === "updateProfile") {
      return createJsonResponse(updateUserProfile(ss, data));
    }

    // C. ACTION: MENYIMPAN MUTASI BARU & UPLOAD FOTO KE GOOGLE DRIVE
    if (action === "saveMutation") {
      const sheetHistory = (ss && ss.getSheetByName(TAB_HISTORY)) || createHistorySheet(ss);
      const driveFolderId = (data.folderId || body.folderId || getDriveFolderId(ss) || "").trim();

      const vin = String(data.vin || data.vinNumber || "-").trim().toUpperCase();

      // VALIDASI DUPLIKAT: Satu kode barcode (VIN) hanya bisa 1x tersimpan!
      if (sheetHistory && vin !== "-") {
        const historyRows = sheetHistory.getDataRange().getValues();
        for (let i = 1; i < historyRows.length; i++) {
          const recordedVin = String(historyRows[i][5]).trim().toUpperCase();
          if (recordedVin !== "-" && recordedVin === vin) {
            return createJsonResponse({
              success: false,
              error: "Duplikat ditolak: Barcode/VIN [" + vin + "] sudah pernah tersimpan pada transaksi " + historyRows[i][0] + "."
            });
          }
        }
      }

      const now = new Date();
      const id = data.id || ("MUT-" + Utilities.formatDate(now, TIMEZONE, "yyyyMMdd-HHmmss"));
      const timestampIso = data.timestamp || now.toISOString();
      const dateFormatted = data.fullDateStr || formatIndonesianDate(now);
      const timeFormatted = data.time ? (data.time + (data.time.includes("WIB") ? "" : " WIB")) : (Utilities.formatDate(now, TIMEZONE, "HH:mm") + " WIB");

      const model = data.model || data.name || "-";
      const engine = (data.engine || data.engineNumber || "-").trim().toUpperCase();
      const type = data.type || data.mutationType || "Unit Masuk";
      const pic = data.pic || data.driverName || "Staff Lapangan";
      const npk = data.npk || "-";
      const branch = data.branch || "Sentra Lampung DSO";
      const notes = data.notes || data.keterangan || "-";

      // Upload Foto Unit ke Folder Google Drive jika berupa Base64
      let unitPhotoUrl = data.unitPhoto || data.photoUnit || data.photo || "";
      if (unitPhotoUrl.startsWith("data:image")) {
        const fileSlug = "UNIT_" + vin.replace(/[^A-Za-z0-9]/g, "") + "_" + Utilities.formatDate(now, TIMEZONE, "yyyyMMdd-HHmmss") + ".jpg";
        unitPhotoUrl = saveBase64ImageToDrive(unitPhotoUrl, fileSlug, driveFolderId);
      }

      // Upload Foto Dokumen Serah Terima ke Folder Google Drive jika berupa Base64
      let docPhotoUrl = data.docPhoto || data.photoDoc || data.docImg || "";
      if (docPhotoUrl.startsWith("data:image")) {
        const fileSlug = "DOKUMEN_" + vin.replace(/[^A-Za-z0-9]/g, "") + "_" + Utilities.formatDate(now, TIMEZONE, "yyyyMMdd-HHmmss") + ".jpg";
        docPhotoUrl = saveBase64ImageToDrive(docPhotoUrl, fileSlug, driveFolderId);
      }

      if (sheetHistory) {
        sheetHistory.appendRow([
          id, timestampIso, dateFormatted, timeFormatted,
          model, vin, engine, type, pic, npk, branch, notes,
          unitPhotoUrl, docPhotoUrl
        ]);
      }

      // Perbarui stok di sheet Inventory
      updateInventoryStock(ss, model, type);

      return createJsonResponse({
        success: true,
        message: "Data mutasi fisik berhasil diverifikasi dan disimpan.",
        id: id,
        unitPhotoUrl: unitPhotoUrl,
        docPhotoUrl: docPhotoUrl
      });
    }

    // D. ACTION: TRIGGER LAPORAN MANUAL
    if (action === "triggerManualReport") {
      sendDailyScheduledReport();
      return createJsonResponse({ success: true, message: "Laporan harian PDF berhasil diproses dan dikirim via email." });
    }

    return createJsonResponse({ success: false, message: "Action POST '" + action + "' tidak valid." });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * ----------------------------------------------------------------------------
 * 6. SETUP DATABASE SPREADSHEET (BERSIH DARI DATA DUMMY)
 * ----------------------------------------------------------------------------
 */
function setupDatabaseSpreadsheet() {
  const ss = getSpreadsheet();
  if (!ss) {
    Logger.log("Error: Spreadsheet tidak ditemukan. Buka skrip ini dari menu Ekstensi > Apps Script di Google Sheets Anda.");
    return;
  }

  // 1. TAB: UserPIC
  let sheetUsers = ss.getSheetByName(TAB_USERS) || ss.insertSheet(TAB_USERS);
  sheetUsers.clear();
  const userHeaders = [
    "ID User", "Username", "Password", "Nama Lengkap", "NPK", 
    "Cabang", "Jabatan", "Email", "URL Foto Profil", "Status Akun", "Terakhir Login"
  ];
  sheetUsers.appendRow(userHeaders);

  const initialUsers = [
    [
      "USR-001", "andi.pratama", "daihatsu2026", "Andi Pratama", "21040889", 
      "Sentra Lampung • Astra Daihatsu DSO Lampung", "Staff Operasional Yard", 
      "syafirafira08162@gmail.com", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80", 
      "Active", "-"
    ],
    [
      "USR-002", "syafira", "salvage2026", "Syafira Fira", "21040890", 
      "Sentra Lampung • Astra Daihatsu DSO Lampung", "Admin Logistik Yard", 
      "syafirafira08162@gmail.com", "", "Active", "-"
    ]
  ];
  initialUsers.forEach(u => sheetUsers.appendRow(u));

  sheetUsers.getRange(1, 1, 1, userHeaders.length)
            .setBackground("#0f172a")
            .setFontColor("#ffffff")
            .setFontWeight("bold")
            .setHorizontalAlignment("center")
            .setVerticalAlignment("middle");
  sheetUsers.setRowHeight(1, 35);
  sheetUsers.setFrozenRows(1);

  // 2. TAB: HistoryMutasi (KOSONG / BERSIH)
  let sheetHistory = ss.getSheetByName(TAB_HISTORY) || ss.insertSheet(TAB_HISTORY);
  sheetHistory.clear();
  const historyHeaders = [
    "ID Mutasi", "Timestamp ISO", "Tanggal", "Jam", "Model", 
    "No Rangka (VIN)", "No Mesin", "Jenis Mutasi", "Petugas PIC", 
    "NPK", "Cabang", "Catatan Lapangan", "Foto Unit", "Foto Dokumen"
  ];
  sheetHistory.appendRow(historyHeaders);

  sheetHistory.getRange(1, 1, 1, historyHeaders.length)
              .setBackground("#1e293b")
              .setFontColor("#ffffff")
              .setFontWeight("bold")
              .setHorizontalAlignment("center")
              .setVerticalAlignment("middle");
  sheetHistory.setRowHeight(1, 35);
  sheetHistory.setFrozenRows(1);

  // 3. TAB: Inventory (13 Model Resmi Daihatsu - Stok Awal 0)
  let sheetInventory = ss.getSheetByName(TAB_INVENTORY) || ss.insertSheet(TAB_INVENTORY);
  sheetInventory.clear();
  const inventoryHeaders = [
    "ID Model", "Nama Model Kendaraan", "Kategori", "Total Masuk", "Total Keluar", "URL Foto"
  ];
  sheetInventory.appendRow(inventoryHeaders);

  const inventoryModels = [
    ["INV-001", "Rocky e-Smart Hybrid", "Smart Hybrid SUV", 0, 0, ""],
    ["INV-002", "Gran Max Pick Up", "Niaga & Logistik Tangguh", 0, 0, ""],
    ["INV-003", "New Terios", "7-Seater Adventure SUV", 0, 0, ""],
    ["INV-004", "New Sigra", "LCGC 7-Seater Family MPV", 0, 0, ""],
    ["INV-005", "All New Xenia", "The Next Level MPV", 0, 0, ""],
    ["INV-006", "All New Ayla", "Compact Hatchback Urban", 0, 0, ""],
    ["INV-007", "New Rocky", "Compact Turbo SUV", 0, 0, ""],
    ["INV-008", "Sirion", "Stylish City Car", 0, 0, ""],
    ["INV-009", "Luxio", "Spacious Elegant Van", 0, 0, ""],
    ["INV-010", "Gran Max Blind Van", "Commercial Cargo Van", 0, 0, ""],
    ["INV-011", "Gran Max Minibus", "Family & Commercial Transport", 0, 0, ""],
    ["INV-012", "Terios Special Edition", "Limited Edition Sport SUV", 0, 0, ""],
    ["INV-013", "Old Model Salvage Part", "Komponen & Suku Cadang Salvage", 0, 0, ""]
  ];
  inventoryModels.forEach(m => sheetInventory.appendRow(m));

  sheetInventory.getRange(1, 1, 1, inventoryHeaders.length)
                .setBackground("#1d4ed8")
                .setFontColor("#ffffff")
                .setFontWeight("bold")
                .setHorizontalAlignment("center")
                .setVerticalAlignment("middle");
  sheetInventory.setRowHeight(1, 35);
  sheetInventory.setFrozenRows(1);

  // 4. TAB: SystemConfig
  let sheetConfig = ss.getSheetByName(TAB_CONFIG) || ss.insertSheet(TAB_CONFIG);
  sheetConfig.clear();
  const configHeaders = ["Parameter Key", "Nilai / Value", "Deskripsi / Keterangan"];
  sheetConfig.appendRow(configHeaders);

  const configRows = [
    ["DRIVE_FOLDER_ID", DEFAULT_DRIVE_FOLDER_ID, "ID Folder Google Drive tempat foto fisik unit & dokumen bukti scan disimpan"],
    ["TARGET_EMAIL", DEFAULT_TARGET_EMAIL, "Email penerima rekapitulasi PDF harian setiap jam 08:00 WIB"],
    ["API_SECRET_TOKEN", API_SECRET_TOKEN, "Token rahasia otentikasi API antara web frontend dan Google Apps Script"],
    ["AUTO_EMAIL_ENABLED", "TRUE", "Status aktifasi otomatisasi email harian (TRUE / FALSE)"],
    ["DAILY_REPORT_HOUR", "8", "Jam pengiriman rekapitulasi harian (08:00 WIB)"],
    ["COMPANY_NAME", "PT ASTRA DAIHATSU MOTOR • DSO SENTRA LAMPUNG", "Nama institusi pada kop surat dokumen resmi PDF"],
    ["BRANCH_NAME", "Sentra Lampung DSO", "Nama cabang dan pool yard operasional"],
    ["BRANCH_ADDRESS", "Jl. Raya Soekarno Hatta No. 88, Bandar Lampung • Sentra Yard & Logistics Hub", "Alamat pool yard"]
  ];
  configRows.forEach(r => sheetConfig.appendRow(r));

  sheetConfig.getRange(1, 1, 1, configHeaders.length)
             .setBackground("#334155")
             .setFontColor("#ffffff")
             .setFontWeight("bold")
             .setHorizontalAlignment("center")
             .setVerticalAlignment("middle");
  sheetConfig.setRowHeight(1, 35);
  sheetConfig.setFrozenRows(1);

  // Hapus sheet default Sheet1 jika ada
  const defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  Logger.log("✅ Database Spreadsheet berhasil disiapkan dengan data bersih!");
}

/**
 * ----------------------------------------------------------------------------
 * 7. SETUP TRIGGER TERJADWAL JAM 08:00 WIB
 * ----------------------------------------------------------------------------
 */
function setupDailyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sendDailyScheduledReport") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("sendDailyScheduledReport")
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone(TIMEZONE)
    .create();

  Logger.log("✅ Berhasil! Pengiriman rekapitulasi PDF harian aktif setiap jam 08:00 WIB ke " + DEFAULT_TARGET_EMAIL);
}

/**
 * ============================================================================
 * BAGIAN: GENERATOR PDF PROFESIONAL ASTRA DAIHATSU + DOKUMENTASI FOTO
 * ============================================================================
 */

/**
 * Helper: Mengonversi URL Google Drive / Base64 menjadi format gambar yang valid untuk PDF
 */
function resolveImageBase64(imgData) {
  if (!imgData || typeof imgData !== 'string') return "";
  imgData = imgData.trim();
  if (imgData === "" || imgData === "-") return "";
  
  // Jika sudah format data:image base64
  if (imgData.startsWith("data:image")) return imgData;

  // Jika berupa URL Google Drive atau File ID Drive
  try {
    let fileId = "";
    const idMatch = imgData.match(/id=([a-zA-Z0-9_-]+)/) || imgData.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      fileId = idMatch[1];
    } else if (imgData.length >= 25 && !imgData.includes("/") && !imgData.includes("http")) {
      fileId = imgData;
    }

    if (fileId) {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      const b64 = Utilities.base64Encode(blob.getBytes());
      const mime = blob.getContentType() || "image/jpeg";
      return "data:" + mime + ";base64," + b64;
    }
  } catch (err) {
    Logger.log("Peringatan konversi foto Drive ke PDF: " + err.toString());
  }
  return "";
}

/**
 * ============================================================================
 * LAPORAN RESMI: ASTRA DAIHATSU - DSO LAMPUNG (TANPA KATA MOTOR)
 * ============================================================================
 */

/**
 * 1. Template PDF Resmi Astra Daihatsu - DSO Sentra Lampung
 */
function buildHtmlReport(records, reportDateStr, printDateStr) {
  if (!records) records = [];

  const safeRecords = records.map(r => {
    const rawUnitPhoto = r.unitPhoto || (Array.isArray(r) ? r[12] : "") || "";
    const rawDocPhoto = r.docPhoto || (Array.isArray(r) ? r[13] : "") || "";

    let timePart = r.time ? String(r.time).replace(/\s*WIB/i, "").trim() : "08:00";
    let datePart = "";
    if (r.date && String(r.date).includes("/")) {
      datePart = r.date;
    } else if (r.fullDateStr && String(r.fullDateStr).includes("/")) {
      datePart = r.fullDateStr;
    } else if (r.timestamp) {
      try {
        const d = new Date(r.timestamp);
        if (!isNaN(d.getTime())) {
          datePart = Utilities.formatDate(d, TIMEZONE, "dd/MM/yyyy");
          timePart = Utilities.formatDate(d, TIMEZONE, "HH:mm");
        }
      } catch (e) {}
    }
    if (!datePart) datePart = reportDateStr;
    const fullTimeStr = timePart + ", " + datePart;

    return {
      id: r.id || (Array.isArray(r) ? r[0] : "MUT-TRX"),
      timeDisplay: fullTimeStr,
      model: r.model || (Array.isArray(r) ? r[4] : "Unit Daihatsu"),
      vin: r.vin || r.chassis || (Array.isArray(r) ? r[5] : "-"),
      engine: r.engine || (Array.isArray(r) ? r[6] : "-"),
      type: r.type || (Array.isArray(r) ? r[7] : "Unit Masuk"),
      pic: r.pic || (Array.isArray(r) ? r[8] : "Petugas PIC"),
      notes: r.notes || (Array.isArray(r) ? r[11] : "Kondisi fisik terverifikasi") || "-",
      unitPhotoBase64: resolveImageBase64(rawUnitPhoto),
      docPhotoBase64: resolveImageBase64(rawDocPhoto)
    };
  });

  const masukCount = safeRecords.filter(r => r.type === "Unit Masuk").length;
  const keluarCount = safeRecords.filter(r => r.type === "Unit Keluar").length;

  let rowsHtml = "";
  if (safeRecords.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="9" style="padding: 20px; text-align: center; color: #475569; font-style: italic; border: 1.5px solid #334155;">
          Tidak ada data mutasi fisik kendaraan pada periode ini.
        </td>
      </tr>
    `;
  } else {
    safeRecords.forEach((item, idx) => {
      const no = (idx + 1 < 10 ? "0" : "") + (idx + 1);
      const isMasuk = item.type === "Unit Masuk";
      const badgeBg = isMasuk ? "#dcfce7" : "#dbeafe";
      const badgeColor = isMasuk ? "#15803d" : "#1d4ed8";
      const badgeBorder = isMasuk ? "#86efac" : "#93c5fd";

      let unitPhotoHtml = item.unitPhotoBase64 
        ? `<div style="text-align:center;"><img src="${item.unitPhotoBase64}" style="width: 58px; height: 42px; object-fit: cover; border-radius: 4px; border: 1.5px solid #1e293b; display: block; margin: 0 auto 2px auto;" /><span style="font-size: 7px; color: #1e293b; font-weight: bold;">Foto Unit</span></div>`
        : `<div style="width: 58px; height: 42px; border: 1.5px dashed #64748b; border-radius: 4px; display: table-cell; vertical-align: middle; text-align: center; font-size: 7.5px; color: #64748b; font-weight: bold; background: #f1f5f9;">Tanpa Unit</div>`;

      let docPhotoHtml = item.docPhotoBase64 
        ? `<div style="text-align:center;"><img src="${item.docPhotoBase64}" style="width: 58px; height: 42px; object-fit: cover; border-radius: 4px; border: 1.5px solid #1e293b; display: block; margin: 0 auto 2px auto;" /><span style="font-size: 7px; color: #1e293b; font-weight: bold;">Stiker/DO</span></div>`
        : `<div style="width: 58px; height: 42px; border: 1.5px dashed #64748b; border-radius: 4px; display: table-cell; vertical-align: middle; text-align: center; font-size: 7.5px; color: #64748b; font-weight: bold; background: #f1f5f9;">Tanpa Doc</div>`;

      rowsHtml += `
        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 6px 3px; text-align: center; color: #0f172a; font-weight: bold; border: 1.5px solid #334155; font-size: 8px;">${no}</td>
          
          <td style="padding: 6px 5px; text-align: center; border: 1.5px solid #334155;">
            <span style="font-family: monospace, Courier; font-weight: bold; font-size: 8px; color: #0f172a; background: #e2e8f0; padding: 2px 4px; border-radius: 3px; border: 1px solid #cbd5e1; display: inline-block;">
              ${item.id}
            </span>
          </td>

          <td style="padding: 6px 5px; border: 1.5px solid #334155; font-family: monospace, Courier; font-size: 8px; font-weight: bold; color: #0f172a; text-align: center; white-space: nowrap;">
            ${item.timeDisplay}
          </td>

          <td style="padding: 6px 4px; text-align: center; border: 1.5px solid #334155; white-space: nowrap;">
            <span style="display:inline-block; padding: 3px 6px; border-radius: 4px; font-size: 8px; font-weight: bold; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder};">
              ${item.type}
            </span>
          </td>

          <td style="padding: 6px 6px; font-weight: bold; font-size: 8.5px; color: #0f172a; border: 1.5px solid #334155;">
            ${item.model}
          </td>

          <td style="padding: 6px 5px; border: 1.5px solid #334155;">
            <div style="font-family: monospace, Courier; font-weight: bold; font-size: 8.5px; color: #0f172a; letter-spacing: 0.5px;">${item.vin}</div>
            <div style="font-family: monospace, Courier; font-size: 7.5px; color: #475569; margin-top: 1px;">No. Mesin: ${item.engine}</div>
          </td>

          <td style="padding: 6px 5px; font-size: 8px; color: #0f172a; border: 1.5px solid #334155;">
            <strong style="color: #0f172a;">${item.pic}</strong><br>
            <span style="color: #64748b; font-size: 7.5px;">Sentra Lampung</span>
          </td>

          <td style="padding: 4px; border: 1.5px solid #334155; text-align: center;">
            <table style="width: 100%; border: none; margin: 0;">
              <tr>
                <td style="border: none; padding: 0 2px; text-align: center; vertical-align: middle;">${unitPhotoHtml}</td>
                <td style="border: none; padding: 0 2px; text-align: center; vertical-align: middle;">${docPhotoHtml}</td>
              </tr>
            </table>
          </td>

          <td style="padding: 6px 5px; font-size: 8px; color: #334155; border: 1.5px solid #334155;">
            ${item.notes}
          </td>
        </tr>
      `;
    });
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A4 landscape; margin: 8mm 10mm; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 8.5px; line-height: 1.25; }
        
        .header-bar { border-bottom: 2.5px solid #00205B; padding-bottom: 5px; margin-bottom: 6px; width: 100%; }
        .corp-title { font-size: 14px; font-weight: 900; color: #00205B; letter-spacing: 0.5px; }
        .corp-subtitle { font-size: 10px; font-weight: bold; color: #E60012; margin-top: 1px; letter-spacing: 0.3px; }
        .corp-address { font-size: 7.5px; color: #64748b; margin-top: 2px; }
        
        .kpi-container { width: 100%; margin-bottom: 6px; }
        .kpi-card { background: #f8fafc; border: 1.5px solid #334155; border-radius: 4px; padding: 5px 8px; }
        
        table.report-table { width: 100%; border-collapse: collapse; border: 2px solid #00205B; margin-top: 3px; }
        table.report-table th { background: #00205B; color: #ffffff; padding: 6px 4px; font-size: 8px; text-align: left; font-weight: bold; border: 1.5px solid #00205B; border-right: 1.5px solid #334155; text-transform: uppercase; }
        
        table.sig-table { width: 100%; margin-top: 12px; border: none; }
        table.sig-table td { width: 33.3%; text-align: center; vertical-align: top; border: none; }
        .sig-box { height: 32px; }
        
        .footer-bar { margin-top: 8px; border-top: 1.5px solid #334155; padding-top: 3px; font-size: 7px; color: #64748b; }
      </style>
    </head>
    <body>
      <table class="header-bar">
        <tr>
          <td style="vertical-align: top;">
            <div class="corp-title">ASTRA DAIHATSU - DSO SENTRA LAMPUNG</div>
            <div class="corp-subtitle">BERITA ACARA REKAPITULASI MUTASI FISIK & AUDIT SALVAGE YARD</div>
            <div class="corp-address">Sentra Logistics & Salvage Yard Operations Hub • Jl. Soekarno Hatta No. 88, Bandar Lampung</div>
          </td>
          <td style="text-align: right; vertical-align: top; width: 180px;">
            <div style="display: inline-block; background: #00205B; color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 7.5px; font-weight: bold;">DOKUMEN RESMI LOGISTIK</div>
            <div style="font-size: 8px; color: #0f172a; margin-top: 3px; font-weight: bold;">JADWAL: 08:00 WIB (DAILY)</div>
          </td>
        </tr>
      </table>

      <table class="kpi-container" style="border: none;">
        <tr>
          <td style="width: 32%; padding-right: 4px; border: none;">
            <div class="kpi-card">
              <span style="color: #475569; font-size: 7px; text-transform: uppercase; font-weight: bold;">Periode Laporan:</span><br>
              <strong style="font-size: 9px; color: #00205B;">${reportDateStr}</strong><br>
              <span style="color: #64748b; font-size: 7.5px;">Yard Sentra Lampung DSO</span>
            </div>
          </td>
          <td style="width: 36%; padding: 0 4px; border: none;">
            <div class="kpi-card">
              <span style="color: #475569; font-size: 7px; text-transform: uppercase; font-weight: bold;">Verifikasi Fisik:</span><br>
              <strong style="font-size: 9px; color: #15803d;">100% Validasi Fisik & Stiker</strong><br>
              <span style="color: #64748b; font-size: 7.5px;">Waktu Generate: ${printDateStr}</span>
            </div>
          </td>
          <td style="width: 32%; padding-left: 4px; border: none;">
            <div class="kpi-card" style="text-align: right;">
              <span style="color: #475569; font-size: 7px; text-transform: uppercase; font-weight: bold;">Rekapitulasi Unit:</span><br>
              <strong style="font-size: 9.5px; color: #00205B;">Total: ${safeRecords.length} Unit</strong><br>
              <span style="color: #15803d; font-weight: bold;">Masuk: ${masukCount}</span> | 
              <span style="color: #1d4ed8; font-weight: bold;">Keluar: ${keluarCount}</span>
            </div>
          </td>
        </tr>
      </table>

      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 22px; text-align: center;">No</th>
            <th style="width: 75px; text-align: center;">ID Mutasi</th>
            <th style="width: 95px; text-align: center;">Waktu (Jam, Tgl)</th>
            <th style="width: 68px; text-align: center;">Mutasi</th>
            <th style="width: 105px;">Model Kendaraan</th>
            <th style="width: 130px;">Identitas No. Rangka</th>
            <th style="width: 80px;">Petugas PIC</th>
            <th style="width: 130px; text-align: center;">Bukti Fisik (Foto)</th>
            <th>Catatan Yard</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <table class="sig-table">
        <tr>
          <td>
            <div style="font-size: 7.5px; color: #0f172a; font-weight: bold;">1. Diserahkan Oleh (Transporter):</div>
            <div class="sig-box"></div>
            <div style="font-size: 8px; font-weight: bold; color: #0f172a;">( .................................................... )</div>
            <div style="color: #64748b; font-size: 7px;">Driver Car Carrier / Ekspedisi</div>
          </td>
          <td>
            <div style="font-size: 7.5px; color: #0f172a; font-weight: bold;">2. Diterima & Diperiksa Oleh:</div>
            <div class="sig-box"></div>
            <div style="font-size: 8px; font-weight: bold; color: #0f172a;">( Staff Operasional Sentra Lampung )</div>
            <div style="color: #64748b; font-size: 7px;">Petugas Lapangan Pool Yard</div>
          </td>
          <td>
            <div style="font-size: 7.5px; color: #0f172a; font-weight: bold;">3. Mengetahui / Menyetujui:</div>
            <div class="sig-box"></div>
            <div style="font-size: 8px; font-weight: bold; color: #0f172a;">( .................................................... )</div>
            <div style="color: #64748b; font-size: 7px;">Kepala Pool Sentra Yard DSO Lampung</div>
          </td>
        </tr>
      </table>

      <div class="footer-bar">
        Dokumen ini diterbitkan secara otomatis oleh Sistem Management Salvage Astra Daihatsu - DSO Lampung pada ${printDateStr}.
      </div>
    </body>
    </html>
  `;
}

/**
 * 2. Helper Template Email HTML Super Bersih & Profesional (Astra Daihatsu - DSO Lampung)
 */
function buildEmailHtmlTemplate(todayStr, totalCount, masukCount, keluarCount) {
  return `
    <div style="background-color: #f1f5f9; padding: 25px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
        
        <!-- HEADER KARTU RESMI (BIRU TUA ASTRA + AKSEN MERAH DAIHATSU) -->
        <div style="background: #00205B; padding: 20px 24px; border-bottom: 3.5px solid #E60012;">
          <h2 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase;">
            ASTRA DAIHATSU - DSO LAMPUNG
          </h2>
          <p style="margin: 4px 0 0 0; color: #cbd5e1; font-size: 11.5px; font-weight: 500;">
            Laporan Resmi Audit Serah Terima Fisik & Mutasi Kendaraan Yard
          </p>
        </div>

        <!-- ISI EMAIL -->
        <div style="padding: 24px; color: #1e293b; line-height: 1.6; font-size: 13px;">
          <p style="margin-top: 0;">Yth. Tim Operasional & Manajemen Logistik Daihatsu,</p>
          
          <p>
            Berikut terlampir berkas <strong>PDF</strong> rekapitulasi operasional fisik kendaraan (<em>Salvage Logistics</em>) pada tanggal <strong>${todayStr}</strong>.
          </p>

          <!-- RINGKASAN OPERASIONAL LAPANGAN -->
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
            <div style="font-weight: 800; font-size: 12.5px; color: #00205B; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
              Ringkasan Operasional Lapangan:
            </div>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Total Unit Diperiksa:</td>
                <td style="padding: 5px 0; font-weight: 800; color: #0f172a; text-align: right; font-size: 13px;">${totalCount} Unit</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #15803d; font-weight: 600;">Unit Masuk (Inbound):</td>
                <td style="padding: 5px 0; font-weight: 800; color: #15803d; text-align: right; font-size: 13px;">${masukCount} Unit</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #1d4ed8; font-weight: 600;">Unit Keluar (Outbound):</td>
                <td style="padding: 5px 0; font-weight: 800; color: #1d4ed8; text-align: right; font-size: 13px;">${keluarCount} Unit</td>
              </tr>
            </table>
          </div>

          <!-- INSTRUKSI PENGUNDUHAN PDF -->
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <div style="color: #1e40af; font-size: 12px; font-weight: bold; margin-bottom: 3px;">
              Dokumen PDF Terlampir
            </div>
            <div style="color: #475569; font-size: 11.5px; line-height: 1.5;">
              Silakan unduh lampiran berkas PDF pada email ini untuk melihat rincian nomor rangka (VIN), nomor mesin, dokumentasi foto fisik unit & stiker, serta tanda tangan serah terima.
            </div>
          </div>

          <!-- SALAM HORMAT -->
          <p style="margin-bottom: 0; color: #475569; font-size: 12px;">
            Salam hormat,<br>
            <strong style="color: #00205B; font-size: 12.5px;">Sistem Management Salvage Daihatsu</strong><br>
            <span style="color: #64748b; font-size: 11.5px;">Astra Daihatsu - DSO Lampung</span>
          </p>
        </div>

        <!-- FOOTER RESMI -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 10.5px; color: #94a3b8;">
          Sentra Yard & Logistics Hub • Jl. Raya Soekarno Hatta No. 88, Bandar Lampung<br>
          Dokumen ini diterbitkan otomatis oleh Sistem Management Salvage Astra Daihatsu - DSO Lampung.
        </div>

      </div>
    </div>
  `;
}

/**
 * 3. Fungsi Uji Coba Pengiriman Sekarang (Nama Pengirim: Astra Daihatsu-Dso Lampung)
 */
function testKirimEmailSekarang() {
  Logger.log("🚀 Memulai pengujian email Astra Daihatsu-Dso Lampung...");

  const ss = getSpreadsheet();
  const targetEmail = DEFAULT_TARGET_EMAIL || "syafirafira08162@gmail.com";

  let records = [];
  try {
    records = getHistoryData(ss);
  } catch (e) {
    Logger.log("Info history: " + e.toString());
  }

  const todayStr = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy");
  const nowStr = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy HH:mm 'WIB'");

  // Render PDF Asli
  const htmlReport = buildHtmlReport(records, todayStr, nowStr);
  const htmlOutput = HtmlService.createHtmlOutput(htmlReport);
  const pdfBlob = htmlOutput.getAs("application/pdf").setName("Laporan_Mutasi_Daihatsu_" + todayStr.replace(/\//g, "-") + ".pdf");

  const totalCount = records ? records.length : 0;
  const masukCount = records ? records.filter(r => (r.type || r[7]) === "Unit Masuk").length : 0;
  const keluarCount = records ? records.filter(r => (r.type || r[7]) === "Unit Keluar").length : 0;

  const subject = "Laporan Rekapitulasi Mutasi Fisik Kendaraan Yard Lampung - " + todayStr;
  const emailBodyText = 
    "Yth. Tim Operasional & Manajemen Logistik Daihatsu,\n\n" +
    "Berikut terlampir berkas PDF rekapitulasi operasional fisik kendaraan (Salvage Logistics) pada tanggal " + todayStr + ".\n\n" +
    "Ringkasan Operasional Lapangan:\n" +
    "- Total Unit Diperiksa : " + totalCount + " Unit\n" +
    "- Unit Masuk (Inbound) : " + masukCount + " Unit\n" +
    "- Unit Keluar (Outbound): " + keluarCount + " Unit\n\n" +
    "Salam hormat,\n" +
    "Sistem Management Salvage Daihatsu\n" +
    "Astra Daihatsu - DSO Lampung";

  const emailBodyHtml = buildEmailHtmlTemplate(todayStr, totalCount, masukCount, keluarCount);

  // KIRIM DENGAN NAMA PENGIRIM RESMI: Astra Daihatsu-Dso Lampung
  GmailApp.sendEmail(targetEmail, subject, emailBodyText, {
    attachments: [pdfBlob],
    name: "Astra Daihatsu-Dso Lampung",
    htmlBody: emailBodyHtml
  });

  Logger.log("🎉 BERHASIL! Email resmi 'Astra Daihatsu-Dso Lampung' telah terkirim ke: " + targetEmail);
}

/**
 * 4. Fungsi Otomatisasi Harian Jam 08:00 WIB (Besok Pagi)
 */
function sendDailyScheduledReport() {
  const ss = getSpreadsheet();
  const targetEmail = getTargetEmail(ss);

  const now = new Date();
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  const yesterdayDateStr = Utilities.formatDate(yesterday, TIMEZONE, "dd/MM/yyyy");
  const nowPrintStr = Utilities.formatDate(now, TIMEZONE, "dd/MM/yyyy HH:mm 'WIB'");

  const allHistory = getHistoryData(ss);
  const yesterdayRecords = allHistory.filter(item => {
    if (!item.timestamp && !item.date) return false;
    const itemDate = item.date || item.fullDateStr || (item.timestamp ? String(item.timestamp).split(' ')[0] : "");
    return itemDate === yesterdayDateStr;
  });

  if (yesterdayRecords.length === 0) {
    Logger.log("Tidak ada aktivitas mutasi pada tanggal " + yesterdayDateStr + ". PDF tidak dikirim.");
    return;
  }

  const htmlContent = buildHtmlReport(yesterdayRecords, yesterdayDateStr, nowPrintStr);
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent);
  const pdfBlob = htmlOutput.getAs("application/pdf").setName("Laporan_Mutasi_Daihatsu_" + yesterdayDateStr.replace(/\//g, "-") + ".pdf");

  const totalCount = yesterdayRecords.length;
  const masukCount = yesterdayRecords.filter(r => r.type === "Unit Masuk").length;
  const keluarCount = yesterdayRecords.filter(r => r.type === "Unit Keluar").length;

  const subject = "Laporan Rekapitulasi Mutasi Fisik Kendaraan Yard Lampung - " + yesterdayDateStr;
  const emailBodyText = 
    "Yth. Tim Operasional & Manajemen Logistik Daihatsu,\n\n" +
    "Berikut terlampir berkas PDF rekapitulasi operasional fisik kendaraan (Salvage Logistics) pada tanggal " + yesterdayDateStr + ".\n\n" +
    "Total Unit: " + totalCount + " (Masuk: " + masukCount + ", Keluar: " + keluarCount + ")\n\n" +
    "Salam hormat,\n" +
    "Astra Daihatsu - DSO Lampung";

  const emailBodyHtml = buildEmailHtmlTemplate(yesterdayDateStr, totalCount, masukCount, keluarCount);

  GmailApp.sendEmail(targetEmail, subject, emailBodyText, {
    attachments: [pdfBlob],
    name: "Astra Daihatsu-Dso Lampung",
    htmlBody: emailBodyHtml
  });

  Logger.log("Laporan harian PDF resmi berhasil dikirim ke: " + targetEmail);
}

/**
 * ----------------------------------------------------------------------------
 * 10. LOGIKA AUTHENTICATION & DATABASE UTILITIES
 * ----------------------------------------------------------------------------
 */
function verifyUserCredentials(ss, username, password) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return null;

  const sheet = ss.getSheetByName(TAB_USERS);
  if (!sheet) return null;
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const u = String(row[1]).trim().toLowerCase();
    const p = String(row[2]).trim();
    const status = String(row[9]).trim();

    if ((u === username || String(row[4]).trim() === username) && p === password) {
      if (status.toLowerCase() === "suspended" || status.toLowerCase() === "nonaktif") return null;

      sheet.getRange(i + 1, 11).setValue(formatIndonesianDate(new Date()) + " " + Utilities.formatDate(new Date(), TIMEZONE, "HH:mm") + " WIB");

      return {
        id: row[0],
        username: row[1],
        name: row[3],
        npk: row[4],
        branch: row[5],
        role: row[6],
        email: row[7],
        photo: row[8]
      };
    }
  }
  return null;
}


/**
 * Helper untuk mengambil seluruh konfigurasi sistem dari tab SystemConfig
 */
function getSystemConfigData(ss) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return {};

  const sheet = ss.getSheetByName(TAB_CONFIG);
  if (!sheet) return {};
  const rows = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < rows.length; i++) {
    const k = String(rows[i][0]).trim();
    const v = rows[i][1];
    if (k) config[k] = v;
  }
  return config;
}

/**
 * Helper untuk mengambil data profil user/petugas aktif dari sheet UserPIC
 */
function getActiveUserProfile(ss) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return null;

  const sheet = ss.getSheetByName(TAB_USERS);
  if (!sheet) return null;
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return null;

  for (let i = 1; i < rows.length; i++) {
    const status = String(rows[i][9] || "").toLowerCase().trim();
    if (status !== "suspended" && status !== "nonaktif") {
      return {
        id: rows[i][0],
        username: rows[i][1],
        name: rows[i][3],
        npk: rows[i][4],
        branch: rows[i][5],
        role: rows[i][6],
        email: rows[i][7],
        photo: rows[i][8] || ""
      };
    }
  }
  return null;
}

/**
 * Helper untuk memperbarui konfigurasi sistem di tab SystemConfig
 */
function updateSystemConfig(ss, data) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return { success: false, message: "Spreadsheet tidak ditemukan." };

  let sheet = ss.getSheetByName(TAB_CONFIG);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_CONFIG);
    sheet.appendRow(["Parameter Key", "Nilai / Value", "Deskripsi / Keterangan"]);
  }

  const rows = sheet.getDataRange().getValues();

  const email = (data.email || data.targetEmail || "").trim();
  const schedule = (data.schedule || data.sched || "").trim();
  const type = (data.type || data.reportType || "").trim();

  // Ekstrak jam pengiriman (misal "Setiap Hari 08:00 WIB" -> "8")
  let hour = "";
  if (schedule) {
    const match = schedule.match(/(\d{1,2}):00/);
    if (match && match[1]) {
      hour = String(parseInt(match[1], 10));
    }
  }

  let emailUpdated = false;
  let hourUpdated = false;
  let scheduleUpdated = false;
  let typeUpdated = false;

  for (let i = 1; i < rows.length; i++) {
    const key = String(rows[i][0]).trim();
    if (key === "TARGET_EMAIL" && email) {
      sheet.getRange(i + 1, 2).setValue(email);
      emailUpdated = true;
    }
    if (key === "DAILY_REPORT_HOUR" && hour) {
      sheet.getRange(i + 1, 2).setValue(hour);
      hourUpdated = true;
    }
    if (key === "AUTO_SCHEDULE_TEXT" && schedule) {
      sheet.getRange(i + 1, 2).setValue(schedule);
      scheduleUpdated = true;
    }
    if (key === "REPORT_TYPE_DESC" && type) {
      sheet.getRange(i + 1, 2).setValue(type);
      typeUpdated = true;
    }
  }

  // Jika parameter belum ada di baris manapun, append baris baru
  if (!emailUpdated && email) {
    sheet.appendRow(["TARGET_EMAIL", email, "Email penerima rekapitulasi PDF harian"]);
  }
  if (!hourUpdated && hour) {
    sheet.appendRow(["DAILY_REPORT_HOUR", hour, "Jam pengiriman rekapitulasi harian WIB"]);
  }
  if (!scheduleUpdated && schedule) {
    sheet.appendRow(["AUTO_SCHEDULE_TEXT", schedule, "Label jadwal pengiriman laporan otomatis"]);
  }
  if (!typeUpdated && type) {
    sheet.appendRow(["REPORT_TYPE_DESC", type, "Jenis format rekapitulasi mutasi"]);
  }

  return {
    success: true,
    message: "Konfigurasi otomatisasi laporan berhasil disimpan ke database SystemConfig.",
    config: {
      TARGET_EMAIL: email || DEFAULT_TARGET_EMAIL,
      DAILY_REPORT_HOUR: hour || "8",
      AUTO_SCHEDULE_TEXT: schedule || "Setiap Hari 08:00 WIB",
      REPORT_TYPE_DESC: type || "Daily Digest PDF Rekap Mutasi Unit Masuk & Keluar"
    }
  };
}

function updateUserProfile(ss, data) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return { success: false, message: "Spreadsheet tidak ditemukan." };

  let sheet = ss.getSheetByName(TAB_USERS);
  if (!sheet) return { success: false, message: "Sheet UserPIC tidak ditemukan." };
  const rows = sheet.getDataRange().getValues();

  const searchNpk = String(data.oldNpk || data.npk || "").trim();
  const searchUsername = String(data.username || "").trim().toLowerCase();
  const searchId = String(data.id || "").trim();

  // Simpan foto profil ke Google Drive jika berupa data Base64
  let photoUrl = data.photo || "";
  if (photoUrl && photoUrl.startsWith("data:image")) {
    try {
      const driveFolderId = (data.folderId || getDriveFolderId(ss) || "").trim();
      const cleanNpk = (data.npk || data.oldNpk || "PIC").replace(/[^A-Za-z0-9]/g, "");
      const fileSlug = "AVATAR_" + cleanNpk + "_" + Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd-HHmmss") + ".jpg";
      photoUrl = saveBase64ImageToDrive(photoUrl, fileSlug, driveFolderId);
    } catch (uploadErr) {
      Logger.log("Peringatan upload avatar: " + uploadErr.toString());
    }
  }

  let userMatched = false;
  for (let i = 1; i < rows.length; i++) {
    const rowId = String(rows[i][0]).trim();
    const rowUser = String(rows[i][1]).trim().toLowerCase();
    const rowNpk = String(rows[i][4]).trim();

    const isMatch = (searchNpk && rowNpk === searchNpk) ||
                    (searchUsername && rowUser === searchUsername) ||
                    (searchId && rowId === searchId);

    if (isMatch) {
      if (data.name) sheet.getRange(i + 1, 4).setValue(data.name);
      if (data.npk) sheet.getRange(i + 1, 5).setValue(data.npk); // Update Kolom NPK
      if (data.branch) sheet.getRange(i + 1, 6).setValue(data.branch);
      if (data.role) sheet.getRange(i + 1, 7).setValue(data.role);
      if (data.email) sheet.getRange(i + 1, 8).setValue(data.email);
      if (photoUrl) sheet.getRange(i + 1, 9).setValue(photoUrl);
      if (data.password) sheet.getRange(i + 1, 3).setValue(data.password);

      userMatched = true;
      return { 
        success: true, 
        message: "Profil petugas berhasil diperbarui di database Google Sheets (UserPIC).",
        user: {
          id: rowId,
          username: rowUser,
          name: data.name || rows[i][3],
          npk: data.npk || rowNpk,
          branch: data.branch || rows[i][5],
          role: data.role || rows[i][6],
          email: data.email || rows[i][7],
          photo: photoUrl || rows[i][8]
        }
      };
    }
  }

  // Fallback: jika user belum cocok tetapi ada data baris operator pertama, update baris tersebut
  if (!userMatched && rows.length > 1) {
    if (data.name) sheet.getRange(2, 4).setValue(data.name);
    if (data.npk) sheet.getRange(2, 5).setValue(data.npk);
    if (data.branch) sheet.getRange(2, 6).setValue(data.branch);
    if (data.role) sheet.getRange(2, 7).setValue(data.role);
    if (photoUrl) sheet.getRange(2, 9).setValue(photoUrl);
    return { 
      success: true, 
      message: "Profil operator utama berhasil diperbarui di database UserPIC.",
      user: {
        id: rows[1][0],
        username: rows[1][1],
        name: data.name || rows[1][3],
        npk: data.npk || rows[1][4],
        branch: data.branch || rows[1][5],
        role: data.role || rows[1][6],
        photo: photoUrl || rows[1][8]
      }
    };
  }

  return { success: false, message: "Petugas tidak ditemukan di sheet UserPIC." };
}

function getUsersData(ss) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return [];

  const sheet = ss.getSheetByName(TAB_USERS);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < rows.length; i++) {
    users.push({
      id: rows[i][0],
      username: rows[i][1],
      name: rows[i][3],
      npk: rows[i][4],
      branch: rows[i][5],
      role: rows[i][6],
      email: rows[i][7],
      photo: rows[i][8],
      status: rows[i][9]
    });
  }
  return users;
}

function formatIndonesianDate(d) {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}

function getInventoryData(ss) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return [];

  const sheet = ss.getSheetByName(TAB_INVENTORY);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const inventory = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1]) continue;
    const totalIn = parseInt(r[3], 10) || 0;
    const totalOut = parseInt(r[4], 10) || 0;
    const stockYard = Math.max(0, totalIn - totalOut);
    const photoUrl = r[5] ? String(r[5]).trim() : "";

    inventory.push({
      id: r[0] || ("INV-" + (i < 10 ? "00" : (i < 100 ? "0" : "")) + i),
      name: String(r[1]).trim(),
      model: String(r[1]).trim(),
      category: r[2] || "Passenger Car",
      totalIn: totalIn,
      totalOut: totalOut,
      stockYard: stockYard,
      inYard: stockYard,
      stockTransit: 0,
      inTransit: 0,
      totalStock: stockYard,
      status: stockYard > 0 ? "Tersedia" : "Kosong",
      photo: photoUrl
    });
  }
  return inventory;
}

function getHistoryData(ss) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return [];

  const sheet = ss.getSheetByName(TAB_HISTORY);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const history = [];
  for (let i = rows.length - 1; i >= 1; i--) {
    const r = rows[i];
    if (!r[0]) continue;
    history.push({
      id: r[0],
      timestamp: r[1],
      fullDateStr: r[2],
      time: r[3],
      model: r[4],
      vin: r[5],
      engine: r[6],
      type: r[7],
      pic: r[8],
      npk: r[9],
      branch: r[10],
      notes: r[11],
      unitPhoto: r[12] || "",
      docPhoto: r[13] || ""
    });
  }
  return history;
}

function updateInventoryStock(ss, modelName, mutationType) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return;

  const sheet = ss.getSheetByName(TAB_INVENTORY);
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  const cleanModel = String(modelName || "").toLowerCase().trim();

  for (let i = 1; i < rows.length; i++) {
    const rowModel = String(rows[i][1] || "").toLowerCase().trim();
    if (rowModel === cleanModel || cleanModel.includes(rowModel) || rowModel.includes(cleanModel)) {
      let totalIn = parseInt(rows[i][3], 10) || 0;
      let totalOut = parseInt(rows[i][4], 10) || 0;

      if (mutationType === "Unit Masuk") {
        totalIn += 1;
        sheet.getRange(i + 1, 4).setValue(totalIn); // Kolom D: Total Masuk
      } else if (mutationType === "Unit Keluar") {
        totalOut += 1;
        sheet.getRange(i + 1, 5).setValue(totalOut); // Kolom E: Total Keluar
      }
      break;
    }
  }
}

function calculateKpis(inventory, history) {
  let totalIn = 0;
  let totalOut = 0;
  let totalYard = 0;
  let stokKosong = 0;

  inventory.forEach(item => {
    const sIn = parseInt(item.totalIn, 10) || 0;
    const sOut = parseInt(item.totalOut, 10) || 0;
    const sYard = item.stockYard != null ? item.stockYard : Math.max(0, sIn - sOut);
    totalIn += sIn;
    totalOut += sOut;
    totalYard += sYard;
    if (sYard === 0) {
      stokKosong++;
    }
  });

  const todayIndo = formatIndonesianDate(new Date());
  const todaySlash = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy");
  let todayIn = 0;
  let todayOut = 0;
  history.forEach(item => {
    const d = String(item.fullDateStr || item.date || item.timestamp || "").trim();
    if (d.includes(todayIndo) || d.includes(todaySlash) || d.startsWith(todaySlash)) {
      if (item.type === "Unit Masuk") todayIn++;
      if (item.type === "Unit Keluar") todayOut++;
    }
  });

  return {
    totalStock: totalYard,
    inYard: totalYard,
    stockYard: totalYard,
    stokKosong: stokKosong,
    todayIn: todayIn,
    todayOut: todayOut,
    totalIn: totalIn,
    totalOut: totalOut
  };
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
                       .setMimeType(ContentService.MimeType.JSON);
}

function createHistorySheet(ss) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return null;
  const sheet = ss.insertSheet(TAB_HISTORY);
  sheet.appendRow([
    "ID Mutasi", "Timestamp ISO", "Tanggal", "Jam", "Model", 
    "No Rangka (VIN)", "No Mesin", "Jenis Mutasi", "Petugas PIC", 
    "NPK", "Cabang", "Catatan Lapangan", "Foto Unit", "Foto Dokumen"
  ]);
  sheet.setFrozenRows(1);
  return sheet;
}
