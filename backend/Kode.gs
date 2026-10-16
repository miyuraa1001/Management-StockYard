/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT - MANAGEMENT SALVAGE DAIHATSU (PRO V2.5)
 * PT Astra Daihatsu Motor • DSO Sentra Lampung
 * ============================================================================
 * Fitur Lengkap Terhubung 100% Realtime ke Spreadsheet & Google Drive:
 * 1. Manajemen Profil Petugas PIC (Tab 'UserPIC') + Upload Avatar ke Drive
 * 2. Konfigurasi Otomatisasi Laporan & Jadwal Trigger (Tab 'SystemConfig')
 * 3. Pemindaian & Pencatatan Mutasi Fisik (Tab 'HistoryMutasi') + Foto Bukti
 * 4. Pembaruan Stok Kendaraan Realtime (Tab 'Inventory' - 13 Model Daihatsu)
 * 5. Pengiriman Laporan PDF Resmi via GmailApp ke Email Manajemen
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// KONFIGURASI GLOBAL & KEAMANAN
// ----------------------------------------------------------------------------
const API_SECRET_TOKEN = "DSO-SALVAGE-SECRET-KEY-982143";
const DEFAULT_TARGET_EMAIL = "syafirafira08162@gmail.com";
const TIMEZONE = "Asia/Jakarta";

// ID FOLDER GOOGLE DRIVE PENYIMPANAN BUKTI MUTASI & FOTO PROFIL
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
 * Helper membaca ID Folder Google Drive dari konfigurasi database
 */
function getDriveFolderId(ss) {
  if (!ss) ss = getSpreadsheet();
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

/**
 * Helper membaca Email Tujuan Laporan dari konfigurasi database
 */
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
 * Membaca seluruh parameter SystemConfig sebagai objek Key-Value
 */
function getSystemConfigData(ss) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return {};

  const sheet = ss.getSheetByName(TAB_CONFIG);
  if (!sheet) return {};

  const rows = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < rows.length; i++) {
    const key = String(rows[i][0] || "").trim();
    if (key) {
      config[key] = rows[i][1];
    }
  }
  return config;
}

/**
 * Memperbarui parameter di sheet SystemConfig dan menyinkronkan Google Apps Script Time Trigger
 */
function updateSystemConfig(ss, data) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return { success: false, message: "Spreadsheet database tidak ditemukan." };

  let sheet = ss.getSheetByName(TAB_CONFIG);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_CONFIG);
    sheet.appendRow(["Parameter Key", "Nilai / Value", "Deskripsi / Keterangan"]);
  }

  const rows = sheet.getDataRange().getValues();
  const configMap = {};
  for (let i = 1; i < rows.length; i++) {
    const k = String(rows[i][0] || "").trim();
    if (k) configMap[k] = i + 1; // row number (1-indexed)
  }

  const mappings = {
    "TARGET_EMAIL": data.email || data.TARGET_EMAIL,
    "AUTO_EMAIL_ENABLED": (data.AUTO_EMAIL_ENABLED !== undefined) 
      ? String(data.AUTO_EMAIL_ENABLED).toUpperCase() 
      : (data.enabled !== undefined ? (data.enabled ? "TRUE" : "FALSE") : undefined),
    "AUTO_SCHEDULE_TEXT": data.schedule || data.AUTO_SCHEDULE_TEXT,
    "REPORT_DOCUMENT_TYPE": data.type || data.REPORT_DOCUMENT_TYPE,
    "DAILY_REPORT_HOUR": data.DAILY_REPORT_HOUR || (data.schedule ? extractHourFromSchedule(data.schedule) : undefined),
    "DRIVE_FOLDER_ID": data.folderId || data.DRIVE_FOLDER_ID
  };

  const descriptions = {
    "TARGET_EMAIL": "Email penerima rekapitulasi PDF harian",
    "AUTO_EMAIL_ENABLED": "Status aktifasi otomatisasi email harian (TRUE / FALSE)",
    "AUTO_SCHEDULE_TEXT": "Deskripsi teks jadwal pengiriman laporan",
    "REPORT_DOCUMENT_TYPE": "Format template dokumen laporan",
    "DAILY_REPORT_HOUR": "Jam trigger pengiriman laporan otomatis (0-23)",
    "DRIVE_FOLDER_ID": "ID Folder Google Drive penyimpanan bukti foto"
  };

  for (const [key, val] of Object.entries(mappings)) {
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      const cleanVal = String(val).trim();
      if (configMap[key]) {
        sheet.getRange(configMap[key], 2).setValue(cleanVal);
      } else {
        sheet.appendRow([key, cleanVal, descriptions[key] || "Pengaturan sistem"]);
      }
    }
  }

  // Sinkronkan trigger jadwal Apps Script sesuai konfigurasi
  try {
    const autoEnabled = String(mappings["AUTO_EMAIL_ENABLED"] || getSystemConfigValue(sheet, "AUTO_EMAIL_ENABLED") || "TRUE").toUpperCase() === "TRUE";
    const reportHour = parseInt(mappings["DAILY_REPORT_HOUR"] || getSystemConfigValue(sheet, "DAILY_REPORT_HOUR") || "8", 10);
    syncAppsScriptScheduleTrigger(autoEnabled, reportHour);
  } catch (trigErr) {
    Logger.log("Peringatan saat sinkronisasi trigger: " + trigErr.toString());
  }

  return {
    success: true,
    message: "Konfigurasi otomatisasi berhasil diperbarui di database Google Sheets.",
    config: getSystemConfigData(ss)
  };
}

function getSystemConfigValue(sheet, keyName) {
  if (!sheet) return null;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === keyName) {
      return String(rows[i][1]).trim();
    }
  }
  return null;
}

function extractHourFromSchedule(scheduleStr) {
  if (!scheduleStr) return "8";
  const match = String(scheduleStr).match(/(\d{1,2})[:.](\d{2})/);
  if (match && match[1]) {
    return String(parseInt(match[1], 10));
  }
  return "8";
}

function syncAppsScriptScheduleTrigger(isEnabled, hour) {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sendDailyScheduledReport") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  if (isEnabled) {
    const validHour = (hour >= 0 && hour <= 23) ? hour : 8;
    ScriptApp.newTrigger("sendDailyScheduledReport")
      .timeBased()
      .atHour(validHour)
      .everyDays(1)
      .inTimezone(TIMEZONE)
      .create();
    Logger.log("✅ Trigger harian aktif jam " + validHour + ":00 WIB.");
  } else {
    Logger.log("ℹ️ Trigger harian dinonaktifkan.");
  }
}

/**
 * ----------------------------------------------------------------------------
 * 1. TES KONEKSI GOOGLE DRIVE (Jalankan 1x di Editor Apps Script untuk Otorisasi)
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

    const testFile = folder.createFile("uji_koneksi.txt", "Koneksi Google Apps Script berhasil pada " + new Date().toString());
    try {
      testFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {}
    Logger.log("🎉 Berhasil membuat file uji coba di folder Drive Anda! ID: " + testFile.getId());

    testFile.setTrashed(true);
    Logger.log("🧹 File uji coba telah dibersihkan. Izin Google Drive 100% AKTIF!");
  } catch (err) {
    Logger.log("❌ Gagal mengakses folder di Drive: " + err.toString());
  }
}

/**
 * ----------------------------------------------------------------------------
 * 2. HELPER UPLOAD GAMBAR BASE64 KE GOOGLE DRIVE (Robust & Anti-Crash)
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
 * 3. API GET HANDLER
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
      const config = getSystemConfigData(ss);
      const users = getUsersData(ss);
      const primaryUser = users.length > 0 ? users[0] : null;

      return createJsonResponse({
        success: true,
        data: {
          inventory: inventory,
          history: history,
          kpi: kpi,
          config: config,
          user: primaryUser,
          users: users
        }
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

    if (action === "getConfig") {
      return createJsonResponse({ success: true, data: getSystemConfigData(ss) });
    }

    return createJsonResponse({ success: false, message: "Action GET '" + action + "' tidak dikenali." });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * ----------------------------------------------------------------------------
 * 4. API POST HANDLER (Dengan Validasi Barcode Duplikat, Upload Drive & Config)
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

    // C. ACTION: UPDATE KONFIGURASI OTOMATISASI LAPORAN
    if (action === "updateConfig") {
      return createJsonResponse(updateSystemConfig(ss, data));
    }

    // D. ACTION: MENYIMPAN MUTASI BARU & UPLOAD FOTO KE GOOGLE DRIVE
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

    // E. ACTION: TRIGGER LAPORAN EMAIL REALTIME
    if (action === "triggerManualReport") {
      const reportRes = triggerReportEmail(ss, data);
      return createJsonResponse(reportRes);
    }

    return createJsonResponse({ success: false, message: "Action POST '" + action + "' tidak valid." });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * ----------------------------------------------------------------------------
 * 5. SETUP DATABASE SPREADSHEET (BERSIH DARI DATA DUMMY)
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

  // 3. TAB: Inventory (13 Model Resmi Daihatsu - Stok Awal 0 Murni dari Lapangan)
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
    ["AUTO_SCHEDULE_TEXT", "Setiap Hari 08:00 WIB", "Keterangan tampilan jadwal"],
    ["REPORT_DOCUMENT_TYPE", "Daily Digest PDF Rekap Mutasi Unit Masuk & Keluar", "Format berkas laporan"],
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

  const defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1");
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  Logger.log("✅ Database Spreadsheet berhasil disiapkan dengan data bersih!");
}

/**
 * ----------------------------------------------------------------------------
 * 6. SETUP TRIGGER TERJADWAL JAM 08:00 WIB
 * ----------------------------------------------------------------------------
 */
function setupDailyTrigger() {
  const ss = getSpreadsheet();
  const config = getSystemConfigData(ss);
  const hour = parseInt(config.DAILY_REPORT_HOUR || "8", 10);
  const isEnabled = String(config.AUTO_EMAIL_ENABLED || "TRUE").toUpperCase() === "TRUE";

  syncAppsScriptScheduleTrigger(isEnabled, hour);
  Logger.log("✅ Berhasil! Pengiriman rekapitulasi PDF harian aktif setiap jam " + hour + ":00 WIB ke " + getTargetEmail(ss));
}

/**
 * ----------------------------------------------------------------------------
 * 7. LOGIKA AUTHENTICATION & PROFIL PETUGAS
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
 * Memperbarui profil petugas di sheet UserPIC & mengunggah avatar Base64 ke Drive
 */
function updateUserProfile(ss, data) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return { success: false, message: "Spreadsheet database tidak ditemukan." };

  let sheet = ss.getSheetByName(TAB_USERS);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_USERS);
    sheet.appendRow([
      "ID User", "Username", "Password", "Nama Lengkap", "NPK", 
      "Cabang", "Jabatan", "Email", "URL Foto Profil", "Status Akun", "Terakhir Login"
    ]);
  }

  const driveFolderId = (data.folderId || getDriveFolderId(ss) || "").trim();

  // Simpan foto profil ke Google Drive jika berupa Base64
  let photoUrl = data.photo || "";
  if (photoUrl && photoUrl.startsWith("data:image")) {
    const fileSlug = "AVATAR_" + String(data.npk || "PIC").replace(/[^A-Za-z0-9]/g, "") + "_" + Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd-HHmmss") + ".jpg";
    photoUrl = saveBase64ImageToDrive(photoUrl, fileSlug, driveFolderId);
  }

  const rows = sheet.getDataRange().getValues();
  const searchNpk = String(data.oldNpk || data.npk || "").trim();
  const searchUsername = String(data.username || "").trim().toLowerCase();
  let foundRowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    const rowNpk = String(rows[i][4] || "").trim();
    const rowUsername = String(rows[i][1] || "").trim().toLowerCase();
    if ((searchNpk && rowNpk === searchNpk) || (searchUsername && rowUsername === searchUsername)) {
      foundRowIndex = i + 1; // 1-indexed
      break;
    }
  }

  // Jika tidak ditemukan berdasarkan NPK lama, periksa apakah ada row petugas pertama
  if (foundRowIndex === -1 && rows.length > 1) {
    foundRowIndex = 2; // update profil petugas utama
  }

  const nowFormatted = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy HH:mm") + " WIB";

  if (foundRowIndex > 1) {
    if (data.name) sheet.getRange(foundRowIndex, 4).setValue(data.name);
    if (data.npk) sheet.getRange(foundRowIndex, 5).setValue(data.npk);
    if (data.branch) sheet.getRange(foundRowIndex, 6).setValue(data.branch);
    if (data.role) sheet.getRange(foundRowIndex, 7).setValue(data.role);
    if (data.email) sheet.getRange(foundRowIndex, 8).setValue(data.email);
    if (photoUrl) sheet.getRange(foundRowIndex, 9).setValue(photoUrl);
    if (data.password) sheet.getRange(foundRowIndex, 3).setValue(data.password);
    sheet.getRange(foundRowIndex, 11).setValue(nowFormatted);

    const updatedUser = {
      name: data.name || sheet.getRange(foundRowIndex, 4).getValue(),
      npk: data.npk || sheet.getRange(foundRowIndex, 5).getValue(),
      branch: data.branch || sheet.getRange(foundRowIndex, 6).getValue(),
      role: data.role || sheet.getRange(foundRowIndex, 7).getValue(),
      photo: photoUrl || sheet.getRange(foundRowIndex, 9).getValue(),
      email: data.email || sheet.getRange(foundRowIndex, 8).getValue()
    };

    return {
      success: true,
      message: "Profil petugas berhasil disimpan ke database Google Sheets.",
      user: updatedUser
    };
  } else {
    const newId = "USR-" + (rows.length < 10 ? "00" : (rows.length < 100 ? "0" : "")) + rows.length;
    const newUsername = (data.username || "pic." + (data.npk || "user")).toLowerCase();
    const newRow = [
      newId,
      newUsername,
      data.password || "daihatsu2026",
      data.name || "Petugas Operasional",
      data.npk || "1000110",
      data.branch || "Sentra Lampung DSO",
      data.role || "Staff Operasional",
      data.email || DEFAULT_TARGET_EMAIL,
      photoUrl || "",
      "Active",
      nowFormatted
    ];
    sheet.appendRow(newRow);

    return {
      success: true,
      message: "Data petugas baru berhasil dibuat dan disimpan di database.",
      user: {
        name: newRow[3],
        npk: newRow[4],
        branch: newRow[5],
        role: newRow[6],
        photo: newRow[8],
        email: newRow[7]
      }
    };
  }
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

/**
 * Menormalisasi berbagai format tanggal (Date object, ISO string, "15 Oktober 2026", "15/10/2026", "2026-10-15")
 * Menjadi format standar "YYYY-MM-DD" untuk perbandingan akurat
 */
function normalizeDateToYmd(val) {
  if (!val) return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, TIMEZONE, "yyyy-MM-dd");
  }
  const str = String(val).trim();
  if (!str || str === "-") return "";

  // 1. Format ISO: 2026-10-15T04:13:57.257Z atau 2026-10-15
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[1] + "-" + isoMatch[2] + "-" + isoMatch[3];
  }

  // 2. Format slash: 15/10/2026
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    return slashMatch[3] + "-" + slashMatch[2].padStart(2, "0") + "-" + slashMatch[1].padStart(2, "0");
  }

  // 3. Format dash: 15-10-2026
  const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (dashMatch) {
    return dashMatch[3] + "-" + dashMatch[2].padStart(2, "0") + "-" + dashMatch[1].padStart(2, "0");
  }

  // 4. Format teks Indonesia: 15 Oktober 2026 atau 15 Okt 2026
  const monthMap = {
    "januari": "01", "jan": "01",
    "februari": "02", "feb": "02",
    "maret": "03", "mar": "03",
    "april": "04", "apr": "04",
    "mei": "05", "may": "05",
    "juni": "06", "jun": "06",
    "juli": "07", "jul": "07",
    "agustus": "08", "agu": "08", "agt": "08",
    "september": "09", "sep": "09",
    "oktober": "10", "okt": "10", "oct": "10",
    "november": "11", "nov": "11",
    "desember": "12", "des": "12", "dec": "12"
  };
  const indoMatch = str.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (indoMatch) {
    const m = monthMap[indoMatch[2].toLowerCase()] || "01";
    return indoMatch[3] + "-" + m + "-" + indoMatch[1].padStart(2, "0");
  }

  // 5. Fallback Date constructor
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
    }
  } catch (e) {}

  return "";
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
    const rawIso = r[1];
    const rawDate = r[2];
    const ymd = normalizeDateToYmd(rawIso) || normalizeDateToYmd(rawDate);

    history.push({
      id: r[0],
      timestamp: rawIso,
      fullDateStr: (rawDate instanceof Date) ? Utilities.formatDate(rawDate, TIMEZONE, "dd MMMM yyyy") : String(rawDate || ""),
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
      docPhoto: r[13] || "",
      ymd: ymd
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
        sheet.getRange(i + 1, 4).setValue(totalIn);
      } else if (mutationType === "Unit Keluar") {
        totalOut += 1;
        sheet.getRange(i + 1, 5).setValue(totalOut);
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

  const todayYmd = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  let todayIn = 0;
  let todayOut = 0;
  history.forEach(item => {
    if (item.ymd === todayYmd) {
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

function formatIndonesianDate(d) {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
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

/**
 * ----------------------------------------------------------------------------
 * 8. GENERATOR PDF RESMI ASTRA DAIHATSU & PENGIRIMAN EMAIL NYATA
 * ----------------------------------------------------------------------------
 */
function resolveImageBase64(imgData) {
  if (!imgData || typeof imgData !== 'string') return "";
  imgData = imgData.trim();
  if (imgData === "" || imgData === "-") return "";
  
  if (imgData.startsWith("data:image")) return imgData;

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
        <td colspan="9" style="padding: 24px; text-align: center; color: #64748b; font-style: italic; border: 1px solid #cbd5e1;">
          Belum ada riwayat mutasi fisik kendaraan pada database.
        </td>
      </tr>
    `;
  } else {
    safeRecords.forEach((item, idx) => {
      const isMasuk = item.type === "Unit Masuk";
      const badgeBg = isMasuk ? "#dcfce7" : "#fee2e2";
      const badgeColor = isMasuk ? "#166534" : "#991b1b";

      const unitImgHtml = item.unitPhotoBase64 
        ? `<img src="${item.unitPhotoBase64}" style="width: 55px; height: 42px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; display: block; margin: 0 auto;">` 
        : `<span style="color: #94a3b8; font-size: 9px; font-style: italic;">No Photo</span>`;

      const docImgHtml = item.docPhotoBase64 
        ? `<img src="${item.docPhotoBase64}" style="width: 55px; height: 42px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; display: block; margin: 0 auto;">` 
        : `<span style="color: #94a3b8; font-size: 9px; font-style: italic;">No Doc</span>`;

      rowsHtml += `
        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; page-break-inside: avoid;">
          <td style="padding: 8px 6px; text-align: center; border: 1px solid #cbd5e1; font-size: 10px; font-weight: bold;">${idx + 1}</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; font-size: 10px; font-family: monospace;">${item.id}</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; font-size: 9.5px;">${item.timeDisplay}</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; font-size: 10.5px; font-weight: bold; color: #0f172a;">${item.model}</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; font-size: 10px; font-family: monospace; font-weight: bold; color: #1e3a8a;">
            VIN: ${item.vin}<br>
            <span style="font-size: 9px; color: #64748b;">ENG: ${item.engine}</span>
          </td>
          <td style="padding: 8px 6px; text-align: center; border: 1px solid #cbd5e1;">
            <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 3px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; white-space: nowrap;">
              ${item.type}
            </span>
          </td>
          <td style="padding: 8px 6px; text-align: center; border: 1px solid #cbd5e1;">${unitImgHtml}</td>
          <td style="padding: 8px 6px; text-align: center; border: 1px solid #cbd5e1;">${docImgHtml}</td>
          <td style="padding: 8px 6px; border: 1px solid #cbd5e1; font-size: 9.5px; color: #334155;">
            <strong>${item.pic}</strong><br>
            <span style="font-size: 8.5px; color: #64748b;">${item.notes}</span>
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
      <title>Laporan Rekapitulasi Salvage - Astra Daihatsu</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #ffffff; }
        .header-box { border-bottom: 3px solid #dc2626; padding-bottom: 12px; margin-bottom: 16px; }
        .company-title { font-size: 16px; font-weight: 900; color: #dc2626; letter-spacing: 0.5px; text-transform: uppercase; margin: 0; }
        .company-sub { font-size: 12px; font-weight: 700; color: #0f172a; margin: 2px 0 0 0; }
        .company-desc { font-size: 9.5px; color: #64748b; margin-top: 3px; }
        .meta-grid { display: flex; justify-content: space-between; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
        .meta-col { font-size: 10px; }
        .meta-col strong { color: #0f172a; }
        .summary-cards { display: flex; gap: 12px; margin-bottom: 16px; }
        .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; background: #ffffff; }
        .kpi-label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
        .kpi-value { font-size: 18px; font-weight: 900; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #0f172a; color: #ffffff; padding: 9px 6px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; border: 1px solid #0f172a; }
        .footer-note { margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header-box">
        <h1 class="company-title">Astra Daihatsu • DSO Sentra Lampung</h1>
        <div class="company-sub">Laporan Rekapitulasi Mutasi Fisik Kendaraan (Salvage Logistics)</div>
        <div class="company-desc">Sentra Yard & Logistics Hub • Jl. Raya Soekarno Hatta No. 88, Bandar Lampung</div>
      </div>

      <div class="meta-grid">
        <div class="meta-col">
          <strong>Periode Laporan:</strong> ${reportDateStr}<br>
          <strong>Waktu Penerbitan:</strong> ${printDateStr}
        </div>
        <div class="meta-col" style="text-align: right;">
          <strong>Status Sistem:</strong> Terverifikasi Database Cloud<br>
          <strong>Total Transaksi:</strong> ${safeRecords.length} Unit
        </div>
      </div>

      <div class="summary-cards">
        <div class="kpi-card" style="border-left: 4px solid #2563eb;">
          <div class="kpi-label">Total Unit Diperiksa</div>
          <div class="kpi-value" style="color: #2563eb;">${safeRecords.length}</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid #16a34a;">
          <div class="kpi-label">Unit Masuk (Inbound)</div>
          <div class="kpi-value" style="color: #16a34a;">${masukCount}</div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid #dc2626;">
          <div class="kpi-label">Unit Keluar (Outbound)</div>
          <div class="kpi-value" style="color: #dc2626;">${keluarCount}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 28px;">No</th>
            <th style="width: 85px;">ID Mutasi</th>
            <th style="width: 90px;">Waktu</th>
            <th>Model Kendaraan</th>
            <th style="width: 140px;">No Rangka & Mesin</th>
            <th style="width: 75px;">Jenis</th>
            <th style="width: 60px;">Foto Unit</th>
            <th style="width: 60px;">Foto Doc</th>
            <th style="width: 120px;">Petugas & Catatan</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer-note">
        Dokumen ini dibuat secara otomatis oleh Sistem Management Salvage Astra Daihatsu DSO Lampung.<br>
        Seluruh foto fisik unit dan berkas serah terima tersimpan aman di Google Drive Perusahaan.
      </div>
    </body>
    </html>
  `;
}

function buildEmailHtmlTemplate(dateStr, totalCount, masukCount, keluarCount) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 24px; color: #ffffff;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700;">Astra Daihatsu DSO Lampung</div>
        <h2 style="margin: 6px 0 0 0; font-size: 18px; font-weight: 800; color: #ffffff;">Rekap Mutasi Fisik Kendaraan Salvage</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #cbd5e1;">Laporan Operasional Yard • Tanggal ${dateStr}</p>
      </div>

      <div style="padding: 24px;">
        <p style="font-size: 13px; color: #334155; line-height: 1.6; margin-top: 0;">
          Yth. Tim Operasional & Manajemen Logistik Daihatsu,<br><br>
          Berikut terlampir dokumen PDF rekapitulasi pemeriksaan dan mutasi fisik kendaraan yang tercatat di pool yard. Berkas PDF lengkap dengan dokumentasi foto fisik unit dan bukti serah terima dapat Anda unduh pada lampiran email ini.
        </p>

        <div style="display: flex; gap: 12px; margin: 20px 0; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="flex: 1; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Unit</div>
            <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 2px;">${totalCount}</div>
          </div>
          <div style="flex: 1; text-align: center; border-left: 1px solid #cbd5e1;">
            <div style="font-size: 10px; font-weight: 700; color: #16a34a; text-transform: uppercase;">Unit Masuk</div>
            <div style="font-size: 20px; font-weight: 900; color: #16a34a; margin-top: 2px;">${masukCount}</div>
          </div>
          <div style="flex: 1; text-align: center; border-left: 1px solid #cbd5e1;">
            <div style="font-size: 10px; font-weight: 700; color: #dc2626; text-transform: uppercase;">Unit Keluar</div>
            <div style="font-size: 20px; font-weight: 900; color: #dc2626; margin-top: 2px;">${keluarCount}</div>
          </div>
        </div>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
          Data di atas diambil langsung secara realtime dari database Google Spreadsheet pool yard Sentra Lampung.
        </p>
      </div>

      <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 10.5px; color: #94a3b8;">
        Sentra Yard & Logistics Hub • Jl. Raya Soekarno Hatta No. 88, Bandar Lampung<br>
        Dokumen ini diterbitkan otomatis oleh Sistem Management Salvage Astra Daihatsu - DSO Lampung.
      </div>
    </div>
  `;
}

/**
 * Memicu pembuatan PDF dan pengiriman email nyata via GmailApp
 */
function triggerReportEmail(ss, data) {
  if (!ss) ss = getSpreadsheet();
  const targetEmail = (data && data.email) ? data.email : getTargetEmail(ss);

  let records = [];
  try {
    records = getHistoryData(ss);
  } catch (e) {
    Logger.log("Peringatan saat mengambil riwayat: " + e.toString());
  }

  const todayStr = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy");
  const nowStr = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy HH:mm 'WIB'");

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

  GmailApp.sendEmail(targetEmail, subject, emailBodyText, {
    attachments: [pdfBlob],
    name: "Astra Daihatsu-Dso Lampung",
    htmlBody: emailBodyHtml
  });

  return {
    success: true,
    message: "Laporan harian PDF resmi berhasil diproses dan dikirim via email ke " + targetEmail,
    targetEmail: targetEmail,
    timestamp: nowStr,
    totalRecords: totalCount
  };
}

/**
 * Uji coba langsung pengiriman email dari editor Google Apps Script
 */
function testKirimEmailSekarang() {
  Logger.log("🚀 Memulai pengujian pengiriman email...");
  const res = triggerReportEmail();
  Logger.log("Hasil: " + JSON.stringify(res));
}

/**
 * Eksekusi harian otomatis oleh Time-Driven Trigger jam 08:00 WIB
 * Mengirimkan laporan PDF rekapitulasi mutasi kendaraan tanggal kemarin (24 jam terakhir)
 */
function sendDailyScheduledReport() {
  const ss = getSpreadsheet();
  const config = getSystemConfigData(ss);
  const isEnabled = String(config.AUTO_EMAIL_ENABLED || "TRUE").toUpperCase() === "TRUE";

  if (!isEnabled) {
    Logger.log("ℹ️ Otomatisasi email harian dinonaktifkan di SystemConfig.");
    return;
  }

  const targetEmail = getTargetEmail(ss);
  const now = new Date();
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  const yesterdayYmd = Utilities.formatDate(yesterday, TIMEZONE, "yyyy-MM-dd");
  const yesterdayDisplayStr = Utilities.formatDate(yesterday, TIMEZONE, "dd/MM/yyyy");
  const nowPrintStr = Utilities.formatDate(now, TIMEZONE, "dd/MM/yyyy HH:mm 'WIB'");

  Logger.log("🔍 [sendDailyScheduledReport] Memeriksa mutasi tanggal kemarin: " + yesterdayYmd + " (" + yesterdayDisplayStr + ")...");

  const allHistory = getHistoryData(ss);
  Logger.log("📁 Total catatan di HistoryMutasi: " + allHistory.length + " transaksi");

  // Filter mutasi tanggal kemarin menggunakan normalisasi tanggal YMD
  let targetRecords = allHistory.filter(item => item.ymd === yesterdayYmd);
  Logger.log("📊 Ditemukan " + targetRecords.length + " transaksi untuk tanggal " + yesterdayDisplayStr);

  let reportPeriodStr = yesterdayDisplayStr;

  // Jika kemarin kosong (misal hari libur/Minggu atau pengujian langsung saat baru setup):
  if (targetRecords.length === 0) {
    const todayYmd = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
    const todayDisplayStr = Utilities.formatDate(now, TIMEZONE, "dd/MM/yyyy");

    const todayRecords = allHistory.filter(item => item.ymd === todayYmd);
    if (todayRecords.length > 0) {
      Logger.log("ℹ️ Tanggal kemarin (" + yesterdayDisplayStr + ") tidak ada transaksi. Menggunakan transaksi hari ini (" + todayRecords.length + " unit pada " + todayDisplayStr + ").");
      targetRecords = todayRecords;
      reportPeriodStr = todayDisplayStr;
    } else if (allHistory.length > 0) {
      Logger.log("ℹ️ Menggunakan seluruh catatan transaksi terkini (" + allHistory.length + " unit).");
      targetRecords = allHistory;
      reportPeriodStr = "Rekap Operasional Terkini (" + yesterdayDisplayStr + ")";
    } else {
      Logger.log("⚠️ Tidak ada aktivitas mutasi fisik pada database Spreadsheet. PDF tidak dikirim.");
      return;
    }
  }

  const htmlContent = buildHtmlReport(targetRecords, reportPeriodStr, nowPrintStr);
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent);
  const pdfBlob = htmlOutput.getAs("application/pdf").setName("Laporan_Mutasi_Daihatsu_" + reportPeriodStr.replace(/[^a-zA-Z0-9]/g, "-") + ".pdf");

  const totalCount = targetRecords.length;
  const masukCount = targetRecords.filter(r => (r.type || r[7]) === "Unit Masuk").length;
  const keluarCount = targetRecords.filter(r => (r.type || r[7]) === "Unit Keluar").length;

  const subject = "Laporan Rekapitulasi Mutasi Fisik Kendaraan Yard Lampung - " + reportPeriodStr;
  const emailBodyText = 
    "Yth. Tim Operasional & Manajemen Logistik Daihatsu,\n\n" +
    "Berikut terlampir berkas PDF rekapitulasi operasional fisik kendaraan (Salvage Logistics) pada tanggal " + reportPeriodStr + ".\n\n" +
    "Ringkasan Operasional Lapangan:\n" +
    "- Total Unit Diperiksa : " + totalCount + " Unit\n" +
    "- Unit Masuk (Inbound) : " + masukCount + " Unit\n" +
    "- Unit Keluar (Outbound): " + keluarCount + " Unit\n\n" +
    "Salam hormat,\n" +
    "Sistem Management Salvage Daihatsu\n" +
    "Astra Daihatsu - DSO Lampung";

  const emailBodyHtml = buildEmailHtmlTemplate(reportPeriodStr, totalCount, masukCount, keluarCount);

  GmailApp.sendEmail(targetEmail, subject, emailBodyText, {
    attachments: [pdfBlob],
    name: "Astra Daihatsu-Dso Lampung",
    htmlBody: emailBodyHtml
  });

  Logger.log("🎉 BERHASIL! Laporan PDF resmi tanggal " + reportPeriodStr + " (" + totalCount + " transaksi) berhasil dikirimkan ke: " + targetEmail);
}

