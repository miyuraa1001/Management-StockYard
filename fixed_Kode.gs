/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT - MANAGEMENT STOCKYARD DAIHATSU (PRO V2.6)
 * PT Astra Daihatsu Motor • Astra Daihatsu DSO Lampung
 * ============================================================================
 * Fitur Lengkap Terhubung 100% Realtime ke Spreadsheet & Google Drive:
 * 1. Manajemen Profil Petugas PIC (Tab 'UserPIC') + Upload Avatar ke Drive
 * 2. Konfigurasi Otomatisasi Laporan & Jadwal Trigger (Tab 'SystemConfig')
 * 3. Pemindaian & Pencatatan Mutasi Fisik (Tab 'HistoryMutasi') + Foto Bukti
 * 4. Pembaruan Stok Kendaraan Realtime (Tab 'Inventory' - 13 Model Daihatsu)
 * 5. Pengiriman Laporan Langsung di Badan Email (Tabel Lengkap Tanpa Lampiran PDF)
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// KONFIGURASI GLOBAL & KEAMANAN (ZERO-LEAKAGE: TOKEN DIKELOLA VIA SPREADSHEET / SCRIPT PROPERTIES)
// ----------------------------------------------------------------------------
const DEFAULT_TARGET_EMAIL = "admin.logistics@daihatsu.co.id";
const TIMEZONE = "Asia/Jakarta";

// ID FOLDER GOOGLE DRIVE PENYIMPANAN BUKTI MUTASI & FOTO PROFIL
const DEFAULT_DRIVE_FOLDER_ID = "1qQR4cxbBGB2DNi9mML9l3TZzKC6992A2";

// ID Spreadsheet
const SPREADSHEET_ID = "1q1iPsiObbjVy1xkumnNOFG2mfHpU48glIrN7HfaZieQ";

// NAMA SHEET DATABASE
const TAB_USERS     = "UserPIC";
const TAB_HISTORY   = "HistoryMutasi";
const TAB_INVENTORY = "Inventory";
const TAB_CONFIG    = "SystemConfig";

/**
 * Mengambil Token Rahasia API secara dinamis dari Script Properties atau Spreadsheet
 * (Mencegah kebocoran token rahasia ke publik atau git repository)
 */
function getApiSecretToken(ss) {
  try {
    const scriptProp = PropertiesService.getScriptProperties().getProperty("API_SECRET_TOKEN");
    if (scriptProp && scriptProp.trim() !== "") {
      return scriptProp.trim();
    }
  } catch (err) {
    Logger.log("Peringatan ScriptProperties: " + err.toString());
  }

  try {
    if (!ss) ss = getSpreadsheet();
    if (ss) {
      const sheet = ss.getSheetByName(TAB_CONFIG);
      if (sheet) {
        const val = getSystemConfigValue(sheet, "API_SECRET_TOKEN");
        if (val && String(val).trim() !== "") {
          return String(val).trim();
        }
      }
    }
  } catch (e) {
    Logger.log("Peringatan pembacaan token dari SystemConfig: " + e.toString());
  }
  return "";
}

/**
 * Mendapatkan referensi Spreadsheet aktif
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Validasi Hak Akses Token API (Zero-Leakage Security Verification)
 */
function isAuthorized(e, body) {
  const ss = getSpreadsheet();
  const expectedToken = getApiSecretToken(ss);

  if (!expectedToken) return true;

  const queryToken = (e && e.parameter && e.parameter.token) ? String(e.parameter.token).trim() : null;
  if (queryToken && queryToken === expectedToken) return true;

  const bodyToken = (body && body.token) ? String(body.token).trim() : null;
  if (bodyToken && bodyToken === expectedToken) return true;

  const dataToken = (body && body.data && body.data.token) ? String(body.data.token).trim() : null;
  if (dataToken && dataToken === expectedToken) return true;

  return false;
}

/**
 * Mendapatkan ID Folder Google Drive Aktif dari Tab SystemConfig
 */
function getDriveFolderId(ss) {
  try {
    const sheet = ss.getSheetByName(TAB_CONFIG);
    if (!sheet) return DEFAULT_DRIVE_FOLDER_ID;
    const folderId = getSystemConfigValue(sheet, "DRIVE_FOLDER_ID");
    return (folderId && folderId.trim() !== "") ? folderId.trim() : DEFAULT_DRIVE_FOLDER_ID;
  } catch (e) {
    return DEFAULT_DRIVE_FOLDER_ID;
  }
}

/**
 * Normalisasi Penerima Email (Mendukung multi-email dipisahkan koma atau spasi)
 */
function normalizeRecipientEmails(rawEmail) {
  if (!rawEmail) return "";
  let parts = [];
  if (Array.isArray(rawEmail)) {
    parts = rawEmail;
  } else if (typeof rawEmail === 'string') {
    parts = rawEmail.split(/[,;\n\r\t]+/);
  }
  const cleaned = parts
    .map(e => String(e).trim())
    .filter(e => e.length > 0 && e.includes("@") && e.includes("."));
  
  const unique = Array.from(new Set(cleaned));
  return unique.join(", ");
}

/**
 * Mendapatkan Email Sasaran Laporan dari Tab SystemConfig
 */
function getTargetEmail(ss) {
  try {
    const sheet = ss.getSheetByName(TAB_CONFIG);
    if (!sheet) return DEFAULT_TARGET_EMAIL;
    const email = getSystemConfigValue(sheet, "TARGET_EMAIL");
    const normalized = normalizeRecipientEmails(email);
    return (normalized && normalized.trim() !== "") ? normalized.trim() : DEFAULT_TARGET_EMAIL;
  } catch (e) {
    return DEFAULT_TARGET_EMAIL;
  }
}

/**
 * Mengambil seluruh data konfigurasi sistem dari tab SystemConfig
 */
function getSystemConfigData(ss) {
  const sheet = ss.getSheetByName(TAB_CONFIG);
  const config = {
    DRIVE_FOLDER_ID: DEFAULT_DRIVE_FOLDER_ID,
    TARGET_EMAIL: DEFAULT_TARGET_EMAIL,
    AUTO_EMAIL_ENABLED: "TRUE",
    DAILY_REPORT_HOUR: "8",
    AUTO_SCHEDULE_TEXT: "Setiap Hari 08:00 WIB",
    REPORT_DOCUMENT_TYPE: "Tabel Rekapitulasi Rinci Mutasi Unit di Badan Email"
  };

  if (!sheet) return config;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][0]).trim();
    const val = String(data[i][1]).trim();
    if (key) {
      config[key] = val;
    }
  }

  config.TARGET_EMAIL = normalizeRecipientEmails(config.TARGET_EMAIL) || DEFAULT_TARGET_EMAIL;
  return config;
}

/**
 * Memperbarui data konfigurasi sistem di tab SystemConfig
 */
function updateSystemConfig(ss, data) {
  let sheet = ss.getSheetByName(TAB_CONFIG);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_CONFIG);
    sheet.appendRow(["Parameter Key", "Nilai / Value", "Deskripsi / Keterangan"]);
  }

  const targetEmailNormalized = normalizeRecipientEmails(data.email || data.TARGET_EMAIL || (Array.isArray(data.emails) ? data.emails.join(", ") : ""));
  const reportHourVal = (data.DAILY_REPORT_HOUR !== undefined && data.DAILY_REPORT_HOUR !== null)
    ? String(data.DAILY_REPORT_HOUR)
    : (data.schedule ? extractHourFromSchedule(data.schedule) : undefined);

  const mappings = {
    "TARGET_EMAIL": targetEmailNormalized || undefined,
    "AUTO_EMAIL_ENABLED": (data.AUTO_EMAIL_ENABLED !== undefined) 
      ? String(data.AUTO_EMAIL_ENABLED).toUpperCase() 
      : (data.enabled !== undefined ? (data.enabled ? "TRUE" : "FALSE") : undefined),
    "AUTO_SCHEDULE_TEXT": data.schedule || data.AUTO_SCHEDULE_TEXT,
    "REPORT_DOCUMENT_TYPE": data.type || data.REPORT_DOCUMENT_TYPE,
    "DAILY_REPORT_HOUR": reportHourVal,
    "DRIVE_FOLDER_ID": data.folderId || data.DRIVE_FOLDER_ID
  };

  const values = sheet.getDataRange().getValues();
  for (const key in mappings) {
    if (mappings[key] !== undefined && mappings[key] !== null) {
      let found = false;
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim().toUpperCase() === key.toUpperCase()) {
          sheet.getRange(i + 1, 2).setValue(mappings[key]);
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow([key, mappings[key], "Dikonfigurasi otomatis melalui antarmuka web"]);
      }
    }
  }

  SpreadsheetApp.flush();

  try {
    const autoEnabled = String(mappings["AUTO_EMAIL_ENABLED"] || getSystemConfigValue(sheet, "AUTO_EMAIL_ENABLED") || "TRUE").toUpperCase() === "TRUE";
    const rawHour = mappings["DAILY_REPORT_HOUR"] !== undefined ? mappings["DAILY_REPORT_HOUR"] : getSystemConfigValue(sheet, "DAILY_REPORT_HOUR");
    const reportHour = parseInt(rawHour !== undefined && rawHour !== null ? rawHour : "8", 10);
    const schedText = String(mappings["AUTO_SCHEDULE_TEXT"] || getSystemConfigValue(sheet, "AUTO_SCHEDULE_TEXT") || "");
    syncAppsScriptScheduleTrigger(autoEnabled, reportHour, schedText);
  } catch (trigErr) {
    Logger.log("Peringatan sinkronisasi trigger: " + trigErr.toString());
  }

  return getSystemConfigData(ss);
}

/**
 * Mengambil nilai spesifik dari tab SystemConfig
 */
function getSystemConfigValue(sheet, keyName) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === keyName.toUpperCase()) {
      return String(data[i][1]).trim();
    }
  }
  return "";
}

/**
 * Ekstraksi angka jam (0-23) dari teks jadwal
 */
function extractHourFromSchedule(scheduleStr) {
  if (!scheduleStr) return 8;
  const match = scheduleStr.match(/(\d{1,2})[:.](\d{2})/);
  if (match) {
    const h = parseInt(match[1], 10);
    if (!isNaN(h) && h >= 0 && h <= 23) return h;
  }
  return 8;
}

/**
 * Sinkronisasi Time-Driven Trigger Google Apps Script dengan jadwal di SystemConfig
 */
function syncAppsScriptScheduleTrigger(isEnabled, hour, scheduleText) {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    const fn = triggers[i].getHandlerFunction();
    if (fn === "sendDailyScheduledReport" || fn === "triggerReportEmail" || fn.toLowerCase().includes("report") || fn.toLowerCase().includes("daily")) {
      try {
        ScriptApp.deleteTrigger(triggers[i]);
      } catch (delErr) {
        Logger.log("Gagal hapus trigger lama: " + delErr.toString());
      }
    }
  }

  if (isEnabled) {
    const validHour = (hour !== undefined && hour !== null && !isNaN(hour) && hour >= 0 && hour <= 23) ? parseInt(hour, 10) : 8;
    const lower = String(scheduleText || "").toLowerCase();

    // 1. MINGGUAN (Weekly)
    if (lower.includes("minggu") || lower.includes("week")) {
      ScriptApp.newTrigger("sendDailyScheduledReport")
        .timeBased()
        .onWeekDay(ScriptApp.WeekDay.MONDAY)
        .atHour(validHour)
        .inTimezone(TIMEZONE)
        .create();
      Logger.log("✅ Trigger mingguan aktif setiap Senin jam " + validHour + ":00 WIB.");
    } 
    // 2. BULANAN (Monthly)
    else if (lower.includes("bulan") || lower.includes("month")) {
      ScriptApp.newTrigger("sendDailyScheduledReport")
        .timeBased()
        .onMonthDay(1)
        .atHour(validHour)
        .inTimezone(TIMEZONE)
        .create();
      Logger.log("✅ Trigger bulanan aktif setiap tanggal 1 jam " + validHour + ":00 WIB.");
    } 
    // 3. HARIAN (Daily - Default)
    else {
      ScriptApp.newTrigger("sendDailyScheduledReport")
        .timeBased()
        .everyDays(1)
        .atHour(validHour)
        .inTimezone(TIMEZONE)
        .create();
      Logger.log("✅ Trigger harian aktif jam " + validHour + ":00 WIB.");
    }
  } else {
    Logger.log("ℹ️ Trigger dinonaktifkan sesuai konfigurasi.");
  }
}

/**
 * Manual Trigger Sync dari dropdown editor Apps Script
 */
function manualSyncSystemConfigAndTrigger() {
  const ss = getSpreadsheet();
  if (!ss) {
    Logger.log("❌ Spreadsheet tidak ditemukan!");
    return;
  }
  const config = getSystemConfigData(ss);
  Logger.log("📋 Konfigurasi saat ini di SystemConfig: " + JSON.stringify(config));
  
  const isEnabled = String(config.AUTO_EMAIL_ENABLED || "TRUE").toUpperCase() === "TRUE";
  const hour = parseInt(config.DAILY_REPORT_HOUR || "8", 10);
  const schedText = String(config.AUTO_SCHEDULE_TEXT || "");
  
  syncAppsScriptScheduleTrigger(isEnabled, hour, schedText);
  
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log("🎉 Sinkronisasi Berhasil! Jumlah pemicu aktif saat ini: " + triggers.length);
  for (let i = 0; i < triggers.length; i++) {
    Logger.log("👉 Trigger #" + (i + 1) + ": Handler=" + triggers[i].getHandlerFunction() + ", TriggerSource=" + triggers[i].getTriggerSource());
  }
}

/**
 * Tes koneksi ke folder Google Drive
 */
function testDriveFolderConnection() {
  const ss = getSpreadsheet();
  const folderId = getDriveFolderId(ss);
  try {
    const folder = DriveApp.getFolderById(folderId);
    Logger.log("✅ Akses Berhasil ke Google Drive! Folder: " + folder.getName() + " (ID: " + folder.getId() + ")");
    return { success: true, folderName: folder.getName(), folderId: folder.getId() };
  } catch (err) {
    Logger.log("❌ Gagal Mengakses Folder Google Drive: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Menyimpan Foto Base64 langsung ke Google Drive Folder
 */
function saveBase64ImageToDrive(base64Data, filenamePrefix, customFolderId) {
  if (!base64Data || typeof base64Data !== 'string') return "";
  base64Data = base64Data.trim();
  if (!base64Data.startsWith("data:image")) return base64Data;

  try {
    const folderId = customFolderId || getDriveFolderId(getSpreadsheet());
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (fErr) {
      Logger.log("Folder tidak ditemukan via ID, beralih ke Root: " + fErr.toString());
      folder = DriveApp.getRootFolder();
    }

    const commaIdx = base64Data.indexOf(",");
    if (commaIdx === -1) return "";
    const headerPart = base64Data.substring(0, commaIdx);
    const base64Content = base64Data.substring(commaIdx + 1).replace(/\s+/g, "");

    let mimeType = "image/jpeg";
    const mimeMatch = headerPart.match(/data:([^;]+)/);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1].trim();
    }
    const rawData = Utilities.base64Decode(base64Content);
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const timestamp = Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd_HHmmss");
    const filename = (filenamePrefix || "IMG") + "_" + timestamp + "." + ext;

    const blob = Utilities.newBlob(rawData, mimeType, filename);
    const file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log("Peringatan public sharing Drive (kebijakan domain): " + shareErr.toString());
    }

    const fileId = file.getId();
    return "https://drive.google.com/file/d/" + fileId + "/view?usp=drivesdk";
  } catch (err) {
    Logger.log("Error menyimpan gambar ke Google Drive: " + err.toString());
    return "";
  }
}

/**
 * ----------------------------------------------------------------------------
 * 4. API HANDLER (doGet & doPost)
 * ----------------------------------------------------------------------------
 */
function doGet(e) {
  try {
    const ss = getSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getAll";

    if (action === "health" || action === "ping") {
      const config = getSystemConfigData(ss);
      const secret = getApiSecretToken(ss);
      return createJsonResponse({
        success: true,
        status: "online",
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        hasSecretToken: !!secret,
        driveFolderId: getDriveFolderId(ss),
        targetEmail: config.TARGET_EMAIL,
        autoEmailEnabled: config.AUTO_EMAIL_ENABLED,
        dailyReportHour: config.DAILY_REPORT_HOUR,
        autoScheduleText: config.AUTO_SCHEDULE_TEXT,
        timestamp: new Date().toISOString()
      });
    }

    if (!isAuthorized(e, null)) {
      return createJsonResponse({ error: "Unauthorized: Token Rahasia API tidak valid atau tidak disertakan." }, 401);
    }

    if (action === "getConfig") {
      return createJsonResponse(getSystemConfigData(ss));
    }

    if (action === "getUsers") {
      return createJsonResponse(getUsersData(ss));
    }

    if (action === "getInventory") {
      return createJsonResponse(getInventoryData(ss));
    }

    if (action === "getHistory") {
      return createJsonResponse(getHistoryData(ss));
    }

    // Default: Ambil seluruh data aplikasi
    const inventory = getInventoryData(ss);
    const history = getHistoryData(ss);
    const users = getUsersData(ss);
    const config = getSystemConfigData(ss);
    const kpis = calculateKpis(inventory, history);

    return createJsonResponse({
      inventory: inventory,
      history: history,
      users: users,
      config: config,
      kpis: kpis,
      serverTime: Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss")
    });

  } catch (err) {
    return createJsonResponse({ error: err.toString() }, 500);
  }
}

function doPost(e) {
  try {
    let body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        body = e.parameter || {};
      }
    } else if (e && e.parameter) {
      body = e.parameter;
    }

    const ss = getSpreadsheet();
    const action = body.action || (e && e.parameter ? e.parameter.action : null);
    const data = body.data || body;

    // Respon instan untuk health check / ping tanpa validasi token
    if (action === "ping" || action === "health") {
      const config = getSystemConfigData(ss);
      return createJsonResponse({
        success: true,
        status: "online",
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        targetEmail: config.TARGET_EMAIL,
        timestamp: new Date().toISOString()
      });
    }

    if (!isAuthorized(e, body)) {
      return createJsonResponse({ error: "Unauthorized: Akses ditolak. Token rahasia tidak sesuai." }, 401);
    }

    // A. Otentikasi Petugas PIC
    if (action === "login") {
      return createJsonResponse(verifyUserCredentials(ss, data.username, data.password));
    }

    // B. Perbarui Profil Petugas PIC (Foto disimpan ke Drive)
    if (action === "updateProfile") {
      return createJsonResponse(updateUserProfile(ss, data));
    }

    // C. Perbarui Konfigurasi Sistem (Target Email, Jadwal, Drive Folder)
    if (action === "updateConfig") {
      const updatedConfig = updateSystemConfig(ss, data);
      return createJsonResponse({ success: true, config: updatedConfig });
    }

    // D. Pengiriman Laporan Manual / On-Demand via GmailApp (Tabel Langsung di Email)
    if (action === "sendReportEmail" || action === "triggerReportEmail" || action === "triggerManualReport") {
      const emailResult = triggerReportEmail(ss, data);
      return createJsonResponse(emailResult);
    }

    // E. Mutasi Fisik Kendaraan Baru (Scan In/Out + Foto ke Drive + Stok Realtime)
    if (action === "recordMutation" || action === "addMutation" || action === "saveMutation") {
      const sheetHistory = ss.getSheetByName(TAB_HISTORY) || createHistorySheet(ss);
      
      const trxId = data.id || ("MUT-" + Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd-HHmmss"));
      const now = new Date();
      const dateObj = (data.timestamp) ? new Date(data.timestamp) : now;
      const formattedDateStr = (data.fullDateStr && data.fullDateStr.includes(" ")) 
        ? data.fullDateStr 
        : formatIndonesianDate(dateObj);
      const timeStr = data.time || Utilities.formatDate(now, TIMEZONE, "HH:mm 'WIB'");
      const isoStr = data.timestamp || now.toISOString();
      
      // Simpan Foto Bukti Fisik ke Folder Google Drive Resmi
      let unitPhotoUrl = data.unitPhoto || "";
      if (unitPhotoUrl.startsWith("data:image")) {
        unitPhotoUrl = saveBase64ImageToDrive(unitPhotoUrl, "UNIT_" + trxId);
      }
      let docPhotoUrl = data.docPhoto || "";
      if (docPhotoUrl.startsWith("data:image")) {
        docPhotoUrl = saveBase64ImageToDrive(docPhotoUrl, "DOC_" + trxId);
      }

      // Format rowData sesuai urutan kolom tabel HistoryMutasi resmi:
      // ["ID Mutasi", "Timestamp ISO", "Tanggal", "Jam", "Model", "No Rangka (VIN)", "No Mesin", "Jenis Mutasi", "Petugas PIC", "NPK", "Lokasi", "Catatan", "Foto Unit", "Foto Dokumen"]
      const rowData = [
        trxId,                                   // Col A: ID Mutasi
        isoStr,                                  // Col B: Timestamp ISO
        formattedDateStr,                        // Col C: Tanggal (contoh: 20 Oktober 2026)
        timeStr,                                 // Col D: Jam (contoh: 09:26 WIB)
        data.model || "Unknown Model",           // Col E: Model
        data.vin || data.chassis || "-",         // Col F: No Rangka (VIN)
        data.engine || "-",                      // Col G: No Mesin
        data.type || "Unit Masuk",               // Col H: Jenis Mutasi
        data.pic || "Petugas Lapangan",          // Col I: Petugas PIC
        data.picNpk || "-",                      // Col J: NPK
        data.location || "Sentra Lampung DSO",   // Col K: Cabang
        data.notes || "-",                       // Col L: Catatan Lapangan
        unitPhotoUrl,                            // Col M: Foto Unit
        docPhotoUrl                              // Col N: Foto Dokumen
      ];

      sheetHistory.appendRow(rowData);

      // Perbarui stok kendaraan di tab Inventory
      const newStock = updateInventoryStock(ss, data.model, data.type);

      // Kirim Notifikasi Realtime ke Thread Email Tunggal (Tersinkronisasi 1 Email tanpa Menumpuk)
      let mailResult = null;
      try {
        mailResult = sendRealtimeMutationThreadNotification(ss, {
          id: trxId,
          type: data.type || "Unit Masuk",
          model: data.model || "Unknown Model",
          vin: data.vin || data.chassis || "-",
          engine: data.engine || "-",
          pic: data.pic || "Petugas Lapangan",
          picNpk: data.picNpk || "-",
          location: data.location || "Sentra Lampung DSO",
          notes: data.notes || "-",
          time: timeStr,
          date: formattedDateStr,
          unitPhotoUrl: unitPhotoUrl,
          docPhotoUrl: docPhotoUrl,
          newStock: newStock,
          targetEmail: data.targetEmail || config.TARGET_EMAIL
        });
      } catch (mailErr) {
        Logger.log("Peringatan notifikasi email mutasi: " + mailErr.toString());
        mailResult = { success: false, error: mailErr.toString() };
      }

      return createJsonResponse({
        success: true,
        transactionId: trxId,
        newStock: newStock,
        unitPhotoUrl: unitPhotoUrl,
        docPhotoUrl: docPhotoUrl,
        mailStatus: mailResult,
        timestamp: now.toISOString()
      });
    }

    return createJsonResponse({ error: "Action tidak dikenali: " + action }, 400);

  } catch (err) {
    return createJsonResponse({ error: err.toString() }, 500);
  }
}

/**
 * ----------------------------------------------------------------------------
 * 5. INISIALISASI DATABASE SPREADSHEET RESMI ASTRA DAIHATSU
 * ----------------------------------------------------------------------------
 */
function setupDatabaseSpreadsheet() {
  const ss = getSpreadsheet();
  
  // 1. TAB: UserPIC
  let sheetUsers = ss.getSheetByName(TAB_USERS) || ss.insertSheet(TAB_USERS);
  sheetUsers.clear();
  const userHeaders = ["ID", "Username", "Password", "Full Name", "NPK", "Branch", "Role", "Email", "Avatar", "Status", "Last Login"];
  sheetUsers.appendRow(userHeaders);

  const initialUsers = [
    [
      "USR-001", "andi.pratama", "daihatsu2026", "Andi Pratama", "21040889", 
      "Sentra Lampung • Astra Daihatsu DSO Lampung", "Staff Operasional Yard", 
      "admin.logistics@daihatsu.co.id", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80", 
      "Active", "-"
    ],
    [
      "USR-002", "admin.salvage", "salvage2026", "Admin Logistik", "21040890", 
      "Sentra Lampung • Astra Daihatsu DSO Lampung", "Admin Logistik Yard", 
      "admin.logistics@daihatsu.co.id", "", "Active", "-"
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

  // 2. TAB: HistoryMutasi
  let sheetHistory = ss.getSheetByName(TAB_HISTORY) || ss.insertSheet(TAB_HISTORY);
  sheetHistory.clear();
  const historyHeaders = [
    "ID Mutasi", "Timestamp ISO", "Tanggal", "Jam",
    "Model", "No Rangka (VIN)", "No Mesin", "Jenis Mutasi",
    "Petugas PIC", "NPK", "Lokasi", "Catatan",
    "Foto Unit", "Foto Dokumen"
  ];
  sheetHistory.appendRow(historyHeaders);
  sheetHistory.getRange(1, 1, 1, historyHeaders.length)
              .setBackground("#00205B")
              .setFontColor("#ffffff")
              .setFontWeight("bold")
              .setHorizontalAlignment("center")
              .setVerticalAlignment("middle");
  sheetHistory.setRowHeight(1, 35);
  sheetHistory.setFrozenRows(1);

  // 3. TAB: Inventory (13 Model Resmi Daihatsu)
  let sheetInventory = ss.getSheetByName(TAB_INVENTORY) || ss.insertSheet(TAB_INVENTORY);
  sheetInventory.clear();
  const inventoryHeaders = ["Model ID", "Nama Model Unit", "Kategori Kendaraan", "Stok Tersedia (Unit)", "Total Riwayat Masuk (Unit)", "Keterangan"];
  sheetInventory.appendRow(inventoryHeaders);

  const inventoryModels = [
    ["INV-001", "All New Xenia", "Low MPV Keluarga (7-Seater)", 0, 0, ""],
    ["INV-002", "New Terios", "Compact SUV Tangguh (7-Seater)", 0, 0, ""],
    ["INV-003", "Sigra", "Best Selling LCGC MPV (7-Seater)", 0, 0, ""],
    ["INV-004", "Ayla", "Hatchback City Car Lincah", 0, 0, ""],
    ["INV-005", "Gran Max Pick Up", "Kendaraan Niaga Pick Up Handal", 0, 0, ""],
    ["INV-006", "Gran Max Minibus", "Van Penumpang & Bisnis", 0, 0, ""],
    ["INV-007", "Gran Max Blind Van", "Armada Logistik & Kargo", 0, 0, ""],
    ["INV-008", "Rocky", "Modern Compact Compact Turbo SUV", 0, 0, ""],
    ["INV-009", "Luxio", "Spacious Elegant Van MPV", 0, 0, ""],
    ["INV-010", "Sirion", "Stylish Urban Smart Hatchback", 0, 0, ""],
    ["INV-011", "Gran Max Cargo", "Spesialis Muatan Tertutup", 0, 0, ""],
    ["INV-012", "All New Terios (Facelift)", "SUV Petualang Modern", 0, 0, ""],
    ["INV-013", "New Sigra (Prod Old)", "LCGC 7-Seater MPV", 0, 0, ""]
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
    ["TARGET_EMAIL", DEFAULT_TARGET_EMAIL, "Email penerima rekapitulasi harian setiap jam 08:00 WIB"],
    ["API_SECRET_TOKEN", getApiSecretToken(ss) || "", "Token rahasia otentikasi API antara web frontend dan Google Apps Script"],
    ["AUTO_EMAIL_ENABLED", "TRUE", "Status aktifasi otomatisasi email harian (TRUE / FALSE)"],
    ["DAILY_REPORT_HOUR", "8", "Jam pengiriman rekapitulasi harian (08:00 WIB)"],
    ["AUTO_SCHEDULE_TEXT", "Setiap Hari 08:00 WIB", "Keterangan tampilan jadwal"],
    ["REPORT_DOCUMENT_TYPE", "Tabel Rekapitulasi Rinci Mutasi Unit di Badan Email", "Format berkas laporan"],
    ["COMPANY_NAME", "PT ASTRA DAIHATSU MOTOR • ASTRA DAIHATSU DSO LAMPUNG", "Nama institusi pada kop surat laporan"],
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
  Logger.log("✅ Berhasil! Pengiriman rekapitulasi harian aktif setiap jam " + hour + ":00 WIB ke " + getTargetEmail(ss));
}

/**
 * ----------------------------------------------------------------------------
 * 7. LOGIKA AUTHENTICATION & PROFIL PETUGAS
 * ----------------------------------------------------------------------------
 */
function verifyUserCredentials(ss, username, password) {
  const sheet = ss.getSheetByName(TAB_USERS);
  if (!sheet) return { success: false, message: "Database User tidak ditemukan" };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[1]).trim().toLowerCase() === String(username).trim().toLowerCase()) {
      if (String(row[2]) === String(password)) {
        sheet.getRange(i + 1, 11).setValue(new Date().toISOString());
        return {
          success: true,
          user: {
            id: row[0],
            username: row[1],
            name: row[3],
            npk: row[4],
            branch: row[5],
            role: row[6],
            email: row[7],
            avatar: row[8],
            status: row[9]
          }
        };
      } else {
        return { success: false, message: "Kata sandi yang Anda masukkan salah" };
      }
    }
  }
  return { success: false, message: "Username petugas tidak terdaftar di sistem" };
}

function updateUserProfile(ss, data) {
  const sheet = ss.getSheetByName(TAB_USERS);
  if (!sheet) return { success: false, message: "Database User tidak ditemukan" };

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row[0] === data.id || row[1] === data.username) {
      if (data.name)   sheet.getRange(i + 1, 4).setValue(data.name);
      if (data.npk)    sheet.getRange(i + 1, 5).setValue(data.npk);
      if (data.branch) sheet.getRange(i + 1, 6).setValue(data.branch);
      if (data.role)   sheet.getRange(i + 1, 7).setValue(data.role);
      if (data.email)  sheet.getRange(i + 1, 8).setValue(data.email);
      
      let avatarUrl = data.avatar || "";
      if (avatarUrl.startsWith("data:image")) {
        avatarUrl = saveBase64ImageToDrive(avatarUrl, "AVATAR_" + (data.username || "USER"));
        sheet.getRange(i + 1, 9).setValue(avatarUrl);
      } else if (avatarUrl !== "") {
        sheet.getRange(i + 1, 9).setValue(avatarUrl);
      }

      if (data.newPassword && data.newPassword.trim() !== "") {
        sheet.getRange(i + 1, 3).setValue(data.newPassword);
      }

      return {
        success: true,
        message: "Profil petugas berhasil diperbarui di Google Spreadsheet & Drive",
        avatarUrl: avatarUrl || row[8]
      };
    }
  }
  return { success: false, message: "User tidak ditemukan" };
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
    const stockYard = parseInt(r[3], 10) || 0;
    const totalIn = parseInt(r[4], 10) || 0;
    const totalOut = Math.max(0, totalIn - stockYard);
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
 * Menormalisasi berbagai format tanggal (Date object, ISO string, "16 Oktober 2026", "16/10/2026", "2026-10-16")
 * Menjadi format standar "YYYY-MM-DD" untuk perbandingan akurat
 */
function normalizeDateToYmd(val) {
  if (!val) return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, TIMEZONE, "yyyy-MM-dd");
  }
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
    }
  }
  const str = String(val).trim();
  if (!str || str === "-") return "";

  // 1. Ekstrak dari ID Mutasi jika ada format MUT-YYYYMMDD
  const mutMatch = str.match(/MUT-(\d{4})(\d{2})(\d{2})/i);
  if (mutMatch) {
    return mutMatch[1] + "-" + mutMatch[2] + "-" + mutMatch[3];
  }

  // 2. Format ISO atau YYYY-MM-DD atau YYYY/MM/DD
  const isoMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return isoMatch[1] + "-" + isoMatch[2].padStart(2, "0") + "-" + isoMatch[3].padStart(2, "0");
  }

  // 3. Format teks Indonesia ("16 Oktober 2026", "Jumat, 16 Oktober 2026")
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
  const indoMatch = str.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (indoMatch) {
    const m = monthMap[indoMatch[2].toLowerCase()];
    if (m) {
      return indoMatch[3] + "-" + m + "-" + indoMatch[1].padStart(2, "0");
    }
  }

  // 4. Format DD/MM/YYYY atau DD-MM-YYYY
  const slashMatch = str.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (slashMatch) {
    return slashMatch[3] + "-" + slashMatch[2].padStart(2, "0") + "-" + slashMatch[1].padStart(2, "0");
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

/**
 * Mengambil riwayat mutasi fisik kendaraan secara cerdas sesuai susunan header sheet
 */
function getHistoryData(ss) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return [];

  const sheet = ss.getSheetByName(TAB_HISTORY);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const headers = rows[0].map(h => String(h || "").toLowerCase().trim());
  function colIndex(keywords, defaultIdx) {
    for (let k = 0; k < keywords.length; k++) {
      const idx = headers.findIndex(h => h.includes(keywords[k]));
      if (idx !== -1) return idx;
    }
    return defaultIdx;
  }

  const idxId       = colIndex(["id mutasi", "transaction id", "id"], 0);
  const idxIso      = colIndex(["timestamp iso", "iso", "timestamp"], 1);
  const idxDate     = colIndex(["tanggal", "date"], 2);
  const idxTime     = colIndex(["jam", "waktu", "time"], 3);
  const idxModel    = colIndex(["model", "unit"], 4);
  const idxVin      = colIndex(["rangka", "vin", "chassis"], 5);
  const idxEngine   = colIndex(["mesin", "engine"], 6);
  const idxType     = colIndex(["jenis", "type"], 7);
  const idxPic      = colIndex(["pic", "petugas", "nama"], 8);
  const idxNpk      = colIndex(["npk"], 9);
  const idxLocation = colIndex(["lokasi", "branch", "pool", "yard"], 10);
  const idxNotes    = colIndex(["catatan", "notes", "kondisi"], 11);
  const idxUnitImg  = colIndex(["foto fisik", "foto unit", "unitphoto", "unit"], 12);
  const idxDocImg   = colIndex(["foto doc", "foto berkas", "docphoto", "dokumen", "berkas"], 13);

  const history = [];
  for (let i = rows.length - 1; i >= 1; i--) {
    const r = rows[i];
    if (!r[idxId] && !r[idxVin]) continue;

    const valIso = r[idxIso];
    const valDate = r[idxDate];
    const valId = r[idxId];
    const ymd = normalizeDateToYmd(valIso) || normalizeDateToYmd(valDate) || normalizeDateToYmd(valId);

    let dateDisplay = "";
    if (valDate instanceof Date) {
      dateDisplay = Utilities.formatDate(valDate, TIMEZONE, "dd/MM/yyyy");
    } else if (valDate) {
      dateDisplay = String(valDate);
    } else if (ymd) {
      const parts = ymd.split("-");
      if (parts.length === 3) dateDisplay = parts[2] + "/" + parts[1] + "/" + parts[0];
    }

    let timeDisplay = "";
    const valTime = r[idxTime];
    if (valTime instanceof Date) {
      timeDisplay = Utilities.formatDate(valTime, TIMEZONE, "HH:mm 'WIB'");
    } else if (valTime) {
      timeDisplay = String(valTime);
    }

    history.push({
      id: r[idxId] || "MUT-TRX",
      timestamp: valIso || "",
      date: dateDisplay,
      fullDateStr: dateDisplay,
      time: timeDisplay,
      model: r[idxModel] || "Unit Daihatsu",
      vin: r[idxVin] || "-",
      engine: r[idxEngine] || "-",
      type: r[idxType] || "Unit Masuk",
      pic: r[idxPic] || "Petugas Lapangan",
      npk: r[idxNpk] || "-",
      branch: r[idxLocation] || "Sentra Lampung DSO",
      location: r[idxLocation] || "Sentra Lampung DSO",
      notes: r[idxNotes] || "-",
      unitPhoto: r[idxUnitImg] || "",
      docPhoto: r[idxDocImg] || "",
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

  function normalizeModelKey(m) {
    const s = String(m || "").toLowerCase().trim();
    if (s.includes("special edition") || s === "terios se" || s.includes("da3se")) return "terios special edition";
    if (s === "new sirion" || s.includes("sirion")) return "sirion";
    if (s.includes("minibus") || s.includes("mini bus") || s.includes("blind van") || s.includes("blindvan")) return "gran max minibus";
    if (s.includes("pick up") || s.includes("pickup") || s.includes("pu")) return "gran max pick up";
    if (s.includes("prod old") || s.includes("salvage") || s.includes("old model")) return "new sigra (prod old)";
    if (s.includes("hybrid")) return "rocky e-smart hybrid";
    if (s.includes("new rocky") || s.includes("turbo")) return "new rocky";
    if (s === "rocky" || s.includes("rocky ads") || s.includes("a250") || s.includes("a251")) return "rocky";
    if (s.includes("xenia")) return "all new xenia";
    if (s.includes("ayla")) return "all new ayla";
    if (s.includes("sigra")) return "new sigra";
    if (s.includes("terios")) return "new terios";
    if (s.includes("luxio")) return "luxio";
    if (s.includes("gran max") || s.includes("granmax")) return "gran max pick up";
    return s;
  }

  const targetKey = normalizeModelKey(cleanModel);

  for (let i = 1; i < rows.length; i++) {
    const rowModel = String(rows[i][1] || "").toLowerCase().trim();
    const rowKey = normalizeModelKey(rowModel);

    if (rowKey === targetKey || rowModel.includes(cleanModel) || cleanModel.includes(rowModel)) {
      let currentStock = parseInt(rows[i][3], 10) || 0;
      let totalIn = parseInt(rows[i][4], 10) || 0;

      if (mutationType === "Unit Masuk") {
        totalIn += 1;
        currentStock += 1;
      } else if (mutationType === "Unit Keluar") {
        currentStock = Math.max(0, currentStock - 1);
      }

      sheet.getRange(i + 1, 4).setValue(currentStock);
      sheet.getRange(i + 1, 5).setValue(totalIn);
      return currentStock;
    }
  }

  if (mutationType === "Unit Masuk") {
    const newId = "INV-" + ("00" + rows.length).slice(-3);
    sheet.appendRow([newId, modelName, "Model Tambahan", 1, 1, "Ditambahkan otomatis"]);
    return 1;
  }
  return 0;
}

function calculateKpis(inventory, history) {
  let totalStock = 0;
  inventory.forEach(item => {
    totalStock += (item.stockYard || item.stock || 0);
  });

  const todayStr = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  let todayIn = 0;
  let todayOut = 0;

  history.forEach(trx => {
    let trxYmd = trx.ymd;
    if (!trxYmd && trx.date) trxYmd = normalizeDateToYmd(trx.date);
    if (trxYmd === todayStr) {
      if (trx.type === "Unit Masuk") todayIn++;
      if (trx.type === "Unit Keluar") todayOut++;
    }
  });

  return {
    totalStock: totalStock,
    todayIn: todayIn,
    todayOut: todayOut,
    totalTransactions: history.length
  };
}

function formatIndonesianDate(date) {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return date.getDate() + " " + months[date.getMonth()] + " " + date.getFullYear();
}

function createJsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function createHistorySheet(ss) {
  const sheet = ss.insertSheet(TAB_HISTORY);
  const historyHeaders = [
    "ID Mutasi", "Timestamp ISO", "Tanggal", "Jam",
    "Model", "No Rangka (VIN)", "No Mesin", "Jenis Mutasi",
    "Petugas PIC", "NPK", "Lokasi", "Catatan",
    "Foto Unit", "Foto Dokumen"
  ];
  sheet.appendRow(historyHeaders);
  sheet.getRange(1, 1, 1, historyHeaders.length)
       .setBackground("#00205B")
       .setFontColor("#ffffff")
       .setFontWeight("bold")
       .setHorizontalAlignment("center")
       .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);
  return sheet;
}

/**
 * ----------------------------------------------------------------------------
 * 8. EMAIL DENGAN TABEL MUTASI LANGSUNG (TANPA LAMPIRAN PDF)
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
    Logger.log("Peringatan konversi foto Drive: " + err.toString());
  }
  return "";
}

/**
 * Membangun template email HTML dengan TABEL LENGKAP di dalam badan email
 * (Desain responsif, kompatibel dengan Gmail Desktop, Android, iOS, & Outlook)
 */
function buildEmailHtmlTemplate(records, reportDateStr, printDateStr, totalCount, masukCount, keluarCount) {
  if (!records) records = [];

  const safeRecords = records.map(r => {
    let timePart = r.time ? String(r.time).replace(/\s*WIB/i, "").trim() : "08:00";
    let datePart = "";
    if (r.ymd) {
      const p = r.ymd.split("-");
      if (p.length === 3) datePart = p[2] + "/" + p[1] + "/" + p[0];
    } else if (r.date && String(r.date).includes("/")) {
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
    const fullTimeStr = timePart + " WIB, " + datePart;

    const rawUnitPhoto = r.unitPhoto || (Array.isArray(r) ? r[12] : "") || "";
    const rawDocPhoto = r.docPhoto || (Array.isArray(r) ? r[13] : "") || "";

    return {
      id: r.id || (Array.isArray(r) ? r[0] : "MUT-TRX"),
      timeDisplay: fullTimeStr,
      model: r.model || (Array.isArray(r) ? r[4] : "Unit Daihatsu"),
      vin: r.vin || r.chassis || (Array.isArray(r) ? r[5] : "-"),
      engine: r.engine || (Array.isArray(r) ? r[6] : "-"),
      type: r.type || (Array.isArray(r) ? r[7] : "Unit Masuk"),
      pic: r.pic || (Array.isArray(r) ? r[8] : "Petugas PIC"),
      notes: r.notes || (Array.isArray(r) ? r[11] : "Kondisi fisik terverifikasi") || "-",
      unitPhotoUrl: rawUnitPhoto,
      docPhotoUrl: rawDocPhoto
    };
  });

  let rowsHtml = "";
  if (safeRecords.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="8" style="padding: 24px; text-align: center; color: #64748b; font-size: 12px; font-weight: bold; border: 1px solid #cbd5e1; background: #ffffff;">
          Tidak ada data transaksi mutasi fisik kendaraan pada periode ini.
        </td>
      </tr>
    `;
  } else {
    safeRecords.forEach((item, idx) => {
      const isMasuk = item.type === "Unit Masuk";
      const badgeBg = isMasuk ? "#dcfce7" : "#fee2e2";
      const badgeColor = isMasuk ? "#15803d" : "#b91c1c";
      const badgeBorder = isMasuk ? "#86efac" : "#fca5a5";

      function renderPhotoLink(url, label) {
        if (!url || url === "-" || String(url).trim() === "") {
          return '<span style="color: #94a3b8; font-size: 11px;">-</span>';
        }
        const cleanUrl = String(url).trim();
        if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
          return '<a href="' + cleanUrl + '" target="_blank" style="display: inline-block; padding: 4px 8px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 6px; text-decoration: none; font-size: 10px; font-weight: bold; white-space: nowrap;">📷 ' + label + ' ↗</a>';
        }
        return '<span style="color: #64748b; font-size: 10px; font-weight: bold;">Tersimpan</span>';
      }

      const unitPhotoHtml = renderPhotoLink(item.unitPhotoUrl, "Foto Unit");
      const docPhotoHtml = renderPhotoLink(item.docPhotoUrl, "Dokumen");

      rowsHtml += `
        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 10px 6px; text-align: center; border: 1px solid #cbd5e1; font-size: 11px; font-weight: 800; color: #1e293b;">${idx + 1}</td>
          <td style="padding: 10px 8px; border: 1px solid #cbd5e1; font-size: 10.5px; font-family: monospace; font-weight: 700; color: #0284c7; white-space: nowrap;">${item.id}</td>
          <td style="padding: 10px 8px; border: 1px solid #cbd5e1; font-size: 10.5px; color: #475569; font-weight: 600; white-space: nowrap;">${item.timeDisplay}</td>
          <td style="padding: 10px 8px; border: 1px solid #cbd5e1; font-size: 11.5px; font-weight: 800; color: #0f172a;">${item.model}</td>
          <td style="padding: 10px 8px; border: 1px solid #cbd5e1; font-size: 10.5px; color: #1e293b;">
            <div style="font-family: monospace; font-weight: 800; color: #0f172a;">VIN: ${item.vin}</div>
            <div style="font-size: 9.5px; color: #64748b; font-weight: 600; margin-top: 2px;">ENG: ${item.engine}</div>
          </td>
          <td style="padding: 10px 6px; text-align: center; border: 1px solid #cbd5e1; white-space: nowrap;">
            <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; display: inline-block;">
              ${item.type}
            </span>
          </td>
          <td style="padding: 8px 6px; text-align: center; border: 1px solid #cbd5e1;">${unitPhotoHtml}</td>
          <td style="padding: 8px 6px; text-align: center; border: 1px solid #cbd5e1;">${docPhotoHtml}</td>
          <td style="padding: 10px 8px; border: 1px solid #cbd5e1; font-size: 10.5px; color: #1e293b;">
            <strong style="color: #0f172a; font-size: 11px;">${item.pic}</strong><br>
            <span style="font-size: 9.5px; color: #64748b; font-weight: 500;">${item.notes}</span>
          </td>
        </tr>
      `;
    });
  }

  return `
    <div style="background-color: #f1f5f9; padding: 25px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 860px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);">
        
        <!-- HEADER KARTU RESMI (BIRU TUA ASTRA + AKSEN MERAH DAIHATSU) -->
        <div style="background: #00205B; padding: 22px 24px; border-bottom: 4px solid #E60012;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td>
                <h1 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase;">
                  ASTRA DAIHATSU • DSO SENTRA LAMPUNG
                </h1>
                <p style="margin: 4px 0 0 0; color: #93c5fd; font-size: 13px; font-weight: 700;">
                  Management StockYard — Laporan Rekapitulasi Mutasi Fisik Kendaraan
                </p>
                <p style="margin: 2px 0 0 0; color: #cbd5e1; font-size: 11px; font-weight: 500;">
                  Sentra Yard & Logistics Hub • Jl. Raya Soekarno Hatta No. 88, Bandar Lampung
                </p>
              </td>
            </tr>
          </table>
        </div>

        <!-- ISI EMAIL -->
        <div style="padding: 24px; color: #1e293b; line-height: 1.6; font-size: 13px;">
          <p style="margin-top: 0; font-size: 13.5px;">Yth. Tim Operasional & Manajemen Logistik Daihatsu,</p>
          
          <p style="margin-bottom: 18px;">
            Berikut adalah rekapitulasi data mutasi fisik kendaraan di <strong>Management StockYard Astra Daihatsu DSO Lampung</strong> pada periode tanggal <strong>${reportDateStr}</strong>:
          </p>

          <!-- META INFORMASI & KPI RINGKASAN -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="width: 32%; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Total Transaksi</div>
                <div style="font-size: 22px; font-weight: 900; color: #00205B; margin-top: 4px;">${totalCount} <span style="font-size: 13px; font-weight: 700;">Unit</span></div>
              </td>
              <td style="width: 2%;"></td>
              <td style="width: 32%; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; text-align: center;">
                <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Unit Masuk (Inbound)</div>
                <div style="font-size: 22px; font-weight: 900; color: #15803d; margin-top: 4px;">${masukCount} <span style="font-size: 13px; font-weight: 700;">Unit</span></div>
              </td>
              <td style="width: 2%;"></td>
              <td style="width: 32%; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; text-align: center;">
                <div style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Unit Keluar (Outbound)</div>
                <div style="font-size: 22px; font-weight: 900; color: #1d4ed8; margin-top: 4px;">${keluarCount} <span style="font-size: 13px; font-weight: 700;">Unit</span></div>
              </td>
            </tr>
          </table>

          <!-- HEADER TABEL & KETERANGAN -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
              📋 Rincian Audit Mutasi Fisik Kendaraan
            </div>
          </div>

          <!-- TABEL LENGKAP DI DALAM BADAN EMAIL -->
          <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #cbd5e1; border-radius: 10px; margin-bottom: 22px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; min-width: 720px; background: #ffffff;">
              <thead>
                <tr style="background: #00205B; color: #ffffff;">
                  <th style="padding: 10px 6px; border: 1px solid #00205B; text-align: center; font-size: 10px; font-weight: 800; text-transform: uppercase; width: 32px;">No</th>
                  <th style="padding: 10px 8px; border: 1px solid #00205B; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; width: 95px;">ID Mutasi</th>
                  <th style="padding: 10px 8px; border: 1px solid #00205B; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; width: 100px;">Waktu</th>
                  <th style="padding: 10px 8px; border: 1px solid #00205B; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase;">Model Unit</th>
                  <th style="padding: 10px 8px; border: 1px solid #00205B; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; width: 140px;">No Rangka & Mesin</th>
                  <th style="padding: 10px 6px; border: 1px solid #00205B; text-align: center; font-size: 10px; font-weight: 800; text-transform: uppercase; width: 85px;">Jenis</th>
                  <th style="padding: 10px 6px; border: 1px solid #00205B; text-align: center; font-size: 10px; font-weight: 800; text-transform: uppercase; width: 75px;">Foto Fisik</th>
                  <th style="padding: 10px 6px; border: 1px solid #00205B; text-align: center; font-size: 10px; font-weight: 800; text-transform: uppercase; width: 75px;">Foto DO</th>
                  <th style="padding: 10px 8px; border: 1px solid #00205B; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; width: 125px;">Petugas & Catatan</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
              <tfoot>
                <tr style="background: #e2e8f0; font-weight: 900; color: #0f172a;">
                  <td colspan="5" style="padding: 10px 8px; text-align: right; border: 1px solid #cbd5e1; font-size: 11px; text-transform: uppercase;">
                    TOTAL REKAPITULASI:
                  </td>
                  <td style="padding: 10px 6px; text-align: center; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 900; color: #00205B; background: #cbd5e1;">
                    ${totalCount} Unit
                  </td>
                  <td colspan="3" style="padding: 10px 8px; text-align: center; border: 1px solid #cbd5e1; font-size: 10.5px; font-weight: 800;">
                    <span style="color: #15803d;">MASUK: ${masukCount}</span> &nbsp;|&nbsp; 
                    <span style="color: #b91c1c;">KELUAR: ${keluarCount}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- CATATAN PENJELASAN -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
            <div style="color: #475569; font-size: 11.5px; line-height: 1.5;">
              💡 <em>Catatan: Sesuai kebijakan operasional terbaru, dokumen rekapitulasi disajikan langsung pada badan email dalam bentuk tabel interaktif sehingga Anda tidak perlu lagi mengunduh lampiran PDF. Klik tombol foto untuk melihat bukti fisik unit dan berkas DO secara langsung di Google Drive.</em>
            </div>
          </div>

          <!-- SALAM HORMAT -->
          <p style="margin-bottom: 0; color: #475569; font-size: 12px;">
            Salam hormat,<br>
            <strong style="color: #00205B; font-size: 13px;">Management StockYard</strong><br>
            <span style="color: #64748b; font-size: 12px;">Astra Daihatsu DSO Lampung</span>
          </p>
        </div>

        <!-- FOOTER RESMI -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
          Sentra Yard & Logistics Hub • Jl. Raya Soekarno Hatta No. 88, Bandar Lampung<br>
          Dokumen rekapitulasi ini diterbitkan otomatis oleh Sistem Management StockYard Astra Daihatsu DSO Lampung.
        </div>

      </div>
    </div>
  `;
}

/**
 * Memicu pengiriman email dengan tabel mutasi lengkap langsung di badan email (Tanpa Lampiran PDF)
 */
function triggerReportEmail(ss, data) {
  if (!ss) ss = getSpreadsheet();
  const rawTarget = (data && (data.email || data.emails)) ? (data.email || data.emails) : getTargetEmail(ss);
  const targetEmail = normalizeRecipientEmails(rawTarget) || DEFAULT_TARGET_EMAIL;

  let allHistory = [];
  try {
    allHistory = getHistoryData(ss);
  } catch (e) {
    Logger.log("Peringatan saat mengambil riwayat: " + e.toString());
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  const yesterdayYmd = Utilities.formatDate(yesterday, TIMEZONE, "yyyy-MM-dd");
  const yesterdayDisplayStr = Utilities.formatDate(yesterday, TIMEZONE, "dd/MM/yyyy");
  const nowPrintStr = Utilities.formatDate(now, TIMEZONE, "dd/MM/yyyy HH:mm 'WIB'");

  // Tentukan target tanggal rekap (Default: KEMARIN / YESTERDAY)
  let targetYmd = yesterdayYmd;
  let reportPeriodStr = yesterdayDisplayStr;

  if (data && data.targetDate) {
    const parsed = normalizeDateToYmd(data.targetDate);
    if (parsed) {
      targetYmd = parsed;
      const parts = parsed.split("-");
      if (parts.length === 3) reportPeriodStr = parts[2] + "/" + parts[1] + "/" + parts[0];
    }
  }

  // Filter HANYA data mutasi fisik pada tanggal target
  let targetRecords = allHistory.filter(item => item.ymd === targetYmd);
  Logger.log("🔍 Rekapitulasi mutasi tanggal " + reportPeriodStr + " (" + targetYmd + "): ditemukan " + targetRecords.length + " transaksi dari total " + allHistory.length + " riwayat.");

  // Jika tanggal kemarin kosong, periksa apakah ada mutasi tercatat hari ini (misal saat uji coba sistem)
  if (targetRecords.length === 0 && allHistory.length > 0) {
    const todayYmd = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd");
    const todayDisplayStr = Utilities.formatDate(now, TIMEZONE, "dd/MM/yyyy");
    const todayRecords = allHistory.filter(item => item.ymd === todayYmd);
    
    if (todayRecords.length > 0 && (!data || !data.targetDate)) {
      Logger.log("ℹ️ Tanggal target (" + targetYmd + ") tidak memiliki transaksi. Mengalihkan rekapitulasi ke aktivitas hari ini (" + todayYmd + ") sebanyak " + todayRecords.length + " unit.");
      targetRecords = todayRecords;
      targetYmd = todayYmd;
      reportPeriodStr = todayDisplayStr;
    } else if (data && data.forceAll) {
      targetRecords = allHistory;
      reportPeriodStr = "Rekap Operasional Terkini (" + yesterdayDisplayStr + ")";
    }
  }

  const totalCount = targetRecords.length;
  const masukCount = targetRecords.filter(r => (r.type || r[7]) === "Unit Masuk").length;
  const keluarCount = targetRecords.filter(r => (r.type || r[7]) === "Unit Keluar").length;

  const subject = "Laporan Rekapitulasi Mutasi Stockyard Daihatsu Lampung - " + reportPeriodStr;

  let textList = "";
  targetRecords.forEach((r, i) => {
    textList += (i + 1) + ". [" + r.type + "] " + r.model + " | VIN: " + r.vin + " | Waktu: " + r.time + " | PIC: " + r.pic + "\n";
  });
  if (!textList) textList = "Tidak ada mutasi unit tercatat pada periode ini.\n";

  const emailBodyText = 
    "Yth. Tim Operasional & Manajemen Logistik Daihatsu,\n\n" +
    "Berikut rekapitulasi operasional fisik kendaraan (Stockyard Logistics) pada tanggal " + reportPeriodStr + ":\n\n" +
    "RINGKASAN OPERASIONAL:\n" +
    "- Total Unit Diperiksa : " + totalCount + " Unit\n" +
    "- Unit Masuk (Inbound) : " + masukCount + " Unit\n" +
    "- Unit Keluar (Outbound): " + keluarCount + " Unit\n\n" +
    "RINCIAN MUTASI UNIT:\n" +
    textList + "\n" +
    "Salam hormat,\n" +
    "Management StockYard\n" +
    "Astra Daihatsu DSO Lampung";

  // Bangun badan email HTML dengan tabel lengkap interaktif
  const emailBodyHtml = buildEmailHtmlTemplate(targetRecords, reportPeriodStr, nowPrintStr, totalCount, masukCount, keluarCount);

  // Opsi pengiriman email: Bebas lampiran PDF (isi tabel disajikan langsung di badan email)
  const emailOptions = {
    name: "Management StockYard - Astra Daihatsu",
    htmlBody: emailBodyHtml
  };

  // Jika suatu saat ingin menyertakan lampiran PDF secara opsional, bisa lewat parameter data.attachPdf === true
  if (data && data.attachPdf === true) {
    try {
      const htmlOutput = HtmlService.createHtmlOutput(emailBodyHtml);
      const pdfBlob = htmlOutput.getAs("application/pdf").setName("Laporan_Mutasi_Daihatsu_" + reportPeriodStr.replace(/[^a-zA-Z0-9]/g, "-") + ".pdf");
      emailOptions.attachments = [pdfBlob];
    } catch (pdfErr) {
      Logger.log("Peringatan pembuatan lampiran PDF opsional: " + pdfErr.toString());
    }
  }

  let sendSuccess = false;
  let sendError = "";
  try {
    GmailApp.sendEmail(targetEmail, subject, emailBodyText, emailOptions);
    sendSuccess = true;
  } catch (gmailErr) {
    Logger.log("Peringatan GmailApp.sendEmail pada triggerReportEmail: " + gmailErr.toString());
    try {
      MailApp.sendEmail({
        to: targetEmail,
        subject: subject,
        body: emailBodyText,
        htmlBody: emailOptions.htmlBody,
        name: emailOptions.name,
        attachments: emailOptions.attachments
      });
      sendSuccess = true;
    } catch (mailErr) {
      Logger.log("Gagal MailApp.sendEmail pada triggerReportEmail: " + mailErr.toString());
      sendError = mailErr.toString();
    }
  }

  if (!sendSuccess) {
    return {
      success: false,
      error: "Gagal mengirimkan laporan email ke " + targetEmail + ": " + sendError,
      targetEmail: targetEmail
    };
  }

  return {
    success: true,
    message: "Laporan rekapitulasi mutasi tanggal " + reportPeriodStr + " (" + totalCount + " unit) berhasil dikirim via email langsung ke " + targetEmail + " (tabel langsung di badan email, tanpa lampiran PDF)",
    targetEmail: targetEmail,
    reportDate: reportPeriodStr,
    timestamp: nowPrintStr,
    totalRecords: totalCount
  };
}

/**
 * Uji coba langsung pengiriman email dari editor Google Apps Script
 */
function testKirimEmailSekarang() {
  Logger.log("🚀 Memulai pengujian pengiriman email laporan rekapitulasi...");
  const res = triggerReportEmail();
  Logger.log("Hasil: " + JSON.stringify(res));
}

/**
 * Eksekusi harian otomatis oleh Time-Driven Trigger
 */
function sendDailyScheduledReport() {
  const ss = getSpreadsheet();
  const config = getSystemConfigData(ss);
  const isEnabled = String(config.AUTO_EMAIL_ENABLED || "TRUE").toUpperCase() === "TRUE";

  if (!isEnabled) {
    Logger.log("ℹ️ Otomatisasi email harian dinonaktifkan di SystemConfig.");
    return;
  }

  const res = triggerReportEmail(ss);
  Logger.log("Eksekusi laporan harian terjadwal selesai: " + JSON.stringify(res));
}

/**
 * ----------------------------------------------------------------------------
 * NOTIFIKASI REALTIME MUTASI UNIT DALAM 1 THREAD EMAIL TUNGGAL (SINGLE THREAD)
 * ----------------------------------------------------------------------------
 * Fitur:
 * - Mengirim pemberitahuan instan begitu petugas selesai scan & simpan unit baru
 * - Tidak membuat email baru yang berserakan (Inbox klien tetap hanya 1 email thread per hari)
 * - Menyertakan detail PIC, Jenis (Masuk/Keluar), Model, VIN, Mesin, Waktu, & Foto Dokumentasi
 * - Foto bukti fisik (Unit & Stiker/DO) langsung ditampilkan sebagai thumbnail yang bisa diklik
 */
function sendRealtimeMutationThreadNotification(ss, item) {
  if (!ss) ss = getSpreadsheet();

  // Jika dijalankan langsung dari tombol "Jalankan" di editor Apps Script tanpa argumen
  if (!item || typeof item !== "object") {
    item = getLatestMutationOrDummy(ss);
  }

  const config = getSystemConfigData(ss);
  const targetEmail = normalizeRecipientEmails(item.targetEmail || config.TARGET_EMAIL || DEFAULT_TARGET_EMAIL);
  if (!targetEmail) {
    Logger.log("⚠️ Peringatan: TARGET_EMAIL belum dikonfigurasi atau tidak valid di tab SystemConfig.");
    return { success: false, error: "TARGET_EMAIL tidak valid" };
  }

  const isAutoEnabled = String(config.AUTO_EMAIL_ENABLED || "TRUE").toUpperCase() === "TRUE";
  if (!isAutoEnabled) {
    Logger.log("ℹ️ Info: AUTO_EMAIL_ENABLED bernilai FALSE di tab SystemConfig.");
    return { success: false, error: "AUTO_EMAIL_ENABLED nonaktif" };
  }

  const now = new Date();
  const dateStr = item.date || Utilities.formatDate(now, TIMEZONE, "dd/MM/yyyy");
  const timeStr = item.time || Utilities.formatDate(now, TIMEZONE, "HH:mm 'WIB'");
  const todayFormatted = Utilities.formatDate(now, TIMEZONE, "dd MMMM yyyy");

  // Subjek yang konsisten untuk hari ini memastikan Gmail menggabungkannya ke dalam 1 thread percakapan
  const threadSubject = "[STOCKYARD REALTIME] Aktivitas Mutasi Unit - " + todayFormatted;

  const isMasuk = item.type === "Unit Masuk";
  const badgeColor = isMasuk ? "#047857" : "#1d4ed8";
  const badgeBg = isMasuk ? "#ecfdf5" : "#eff6ff";
  const badgeBorder = isMasuk ? "#a7f3d0" : "#bfdbfe";
  const typeText = isMasuk ? "↓ UNIT MASUK (PENERIMAAN)" : "↑ UNIT KELUAR (PENGIRIMAN)";
  const actionLead = isMasuk ? "MENAMBAHKAN" : "MENGELUARKAN";

  const plainTextSummary = (isMasuk ? "🚘 UNIT MASUK" : "🚚 UNIT KELUAR") + 
    ": " + (item.model || "Unit") + 
    " [" + (item.vin || "-") + "] - PIC: " + (item.pic || "Petugas Lapangan") + 
    " (" + timeStr + ", " + dateStr + ")";

  // Format Thumbnail Foto Google Drive
  const formatImgThumb = (url) => {
    if (!url || typeof url !== "string" || url.trim() === "" || url === "-") return "";
    url = url.trim();
    if (url.startsWith("data:image")) return url;
    const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w400";
    }
    return url;
  };

  const unitPhotoSrc = item.unitPhotoUrl || item.unitPhoto || "";
  const docPhotoSrc = item.docPhotoUrl || item.docPhoto || "";
  const unitThumb = formatImgThumb(unitPhotoSrc);
  const docThumb = formatImgThumb(docPhotoSrc);

  const unitPhotoHtml = unitThumb ? `
    <div style="display: inline-block; margin-right: 12px; margin-top: 6px; text-align: center;">
      <a href="${unitPhotoSrc}" target="_blank" style="text-decoration: none;">
        <div style="width: 135px; height: 95px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; background: #f1f5f9;">
          <img src="${unitThumb}" alt="Foto Unit" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <div style="font-size: 10px; color: #475569; font-weight: bold; margin-top: 4px;">📸 Buka Foto Unit</div>
      </a>
    </div>
  ` : '';

  const docPhotoHtml = docThumb ? `
    <div style="display: inline-block; margin-top: 6px; text-align: center;">
      <a href="${docPhotoSrc}" target="_blank" style="text-decoration: none;">
        <div style="width: 135px; height: 95px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; background: #f1f5f9;">
          <img src="${docThumb}" alt="Foto Stiker/DO" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <div style="font-size: 10px; color: #475569; font-weight: bold; margin-top: 4px;">📄 Buka Foto Stiker / DO</div>
      </a>
    </div>
  ` : '';

  const mediaSectionHtml = (unitPhotoHtml || docPhotoHtml) ? `
    <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
      <div style="font-size: 11px; font-weight: bold; color: #334155; margin-bottom: 6px;">DOKUMENTASI FOTO LAPANGAN:</div>
      <div>
        ${unitPhotoHtml}
        ${docPhotoHtml}
      </div>
    </div>
  ` : '';

  // Badan pesan HTML untuk mutasi ini
  const messageHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 620px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 16px; background: #ffffff;">
      <!-- Header Notifikasi -->
      <div style="background: ${badgeBg}; border-bottom: 1px solid ${badgeBorder}; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 800; font-size: 12px; color: ${badgeColor}; letter-spacing: 0.5px;">
          ${typeText}
        </span>
        <span style="font-size: 11px; font-weight: 600; color: #64748b;">
          ${timeStr} &bull; ${dateStr}
        </span>
      </div>

      <!-- Konten Rincian Mutasi -->
      <div style="padding: 14px;">
        <div style="font-size: 13.5px; line-height: 1.4; color: #1e293b; margin-bottom: 10px;">
          Petugas PIC <strong>${item.pic || "Petugas Lapangan"}</strong> (${item.picNpk || item.npk || "PIC Yard"}) baru saja <strong>${actionLead}</strong> unit <strong>${item.model || "Unit Daihatsu"}</strong> di area <em>${item.location || item.branch || "Sentra Lampung DSO"}</em>.
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; background: #f8fafc; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 6px 10px; color: #64748b; width: 130px; border-bottom: 1px solid #e2e8f0;">No. Transaksi ID</td>
            <td style="padding: 6px 10px; font-weight: bold; font-family: monospace; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${item.id || "-"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Model Kendaraan</td>
            <td style="padding: 6px 10px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${item.model || "-"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; color: #64748b; border-bottom: 1px solid #e2e8f0;">No. Rangka (VIN)</td>
            <td style="padding: 6px 10px; font-weight: bold; font-family: monospace; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${item.vin || "-"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; color: #64748b; border-bottom: 1px solid #e2e8f0;">No. Mesin</td>
            <td style="padding: 6px 10px; font-weight: bold; font-family: monospace; color: #334155; border-bottom: 1px solid #e2e8f0;">${item.engine || "-"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Sisa Stok Terkini</td>
            <td style="padding: 6px 10px; font-weight: bold; color: #0284c7; border-bottom: 1px solid #e2e8f0;">${item.newStock !== undefined ? item.newStock + " Unit" : "Terverifikasi Realtime"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; color: #64748b;">Catatan Lapangan</td>
            <td style="padding: 6px 10px; color: #334155;">${item.notes || "-"}</td>
          </tr>
        </table>

        <!-- Dokumentasi Foto Lapangan -->
        ${mediaSectionHtml}

        <div style="margin-top: 12px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px;">
          Dokumen Log Otomatis &bull; Sistem Management StockYard &bull; PT Astra Daihatsu Motor (Sentra Lampung)
        </div>
      </div>
    </div>
  `;

  // Coba cari thread email hari ini untuk pengelompokan 1 thread di Inbox
  let threadFound = false;
  try {
    const existingThreads = GmailApp.search('subject:"' + threadSubject + '"', 0, 1);
    if (existingThreads && existingThreads.length > 0) {
      existingThreads[0].replyAll(plainTextSummary, {
        htmlBody: messageHtml,
        name: "Stockyard Management Astra Daihatsu"
      });
      Logger.log("✅ Berhasil membalas ke thread email yang sama: " + threadSubject);
      threadFound = true;
      return { success: true, mode: "reply", subject: threadSubject };
    }
  } catch (replyErr) {
    Logger.log("Peringatan reply thread Gmail: " + replyErr.toString());
  }

  // Jika ini mutasi pertama hari ini atau reply gagal, buat thread email baru
  if (!threadFound) {
    const initialThreadHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 620px;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-bottom: 14px;">
          <h3 style="margin: 0; color: #0f172a; font-size: 15px;">PT ASTRA DAIHATSU MOTOR &bull; DSO SENTRA LAMPUNG</h3>
          <p style="margin: 3px 0 0; color: #2563eb; font-weight: bold; font-size: 11px;">LOG NOTIFIKASI REALTIME MUTASI STOCKYARD (${todayFormatted})</p>
          <p style="margin: 2px 0 0; color: #64748b; font-size: 9.5px;">Thread email ini secara otomatis mengumpulkan seluruh pembaruan mutasi unit fisik hari ini tanpa menumpuk email baru.</p>
        </div>
        ${messageHtml}
      </div>
    `;

    try {
      GmailApp.sendEmail(targetEmail, threadSubject, plainTextSummary, {
        htmlBody: initialThreadHtml,
        name: "Stockyard Management Astra Daihatsu"
      });
      Logger.log("✅ Thread email baru hari ini berhasil dibuat via GmailApp: " + threadSubject);
      return { success: true, mode: "sendEmail", subject: threadSubject };
    } catch (gmailErr) {
      Logger.log("Peringatan GmailApp.sendEmail, beralih ke MailApp: " + gmailErr.toString());
      try {
        MailApp.sendEmail({
          to: targetEmail,
          subject: threadSubject,
          body: plainTextSummary,
          htmlBody: initialThreadHtml,
          name: "Stockyard Management Astra Daihatsu"
        });
        Logger.log("✅ Thread email berhasil dikirim via MailApp fallback: " + threadSubject);
        return { success: true, mode: "mailApp", subject: threadSubject };
      } catch (mailAppErr) {
        Logger.log("❌ Gagal mengirim email via MailApp: " + mailAppErr.toString());
        return { success: false, error: mailAppErr.toString() };
      }
    }
  }
}

/**
 * Mengambil transaksi mutasi terbaru dari sheet HistoryMutasi untuk pengujian,
 * atau menghasilkan data dummy jika sheet masih kosong.
 */
function getLatestMutationOrDummy(ss) {
  if (!ss) ss = getSpreadsheet();
  try {
    const list = getHistoryData(ss);
    if (list && list.length > 0) {
      const latest = list[0]; // Baris mutasi paling baru
      return {
        id: latest.id || "MUT-TEST-001",
        type: latest.type || "Unit Masuk",
        model: latest.model || "All New Xenia 1.5 R CVT",
        vin: latest.vin || "MHKM1BA3JPK123456",
        engine: latest.engine || "2NR-VE-987654",
        pic: latest.pic || "Syafirafira (PIC Yard)",
        picNpk: latest.npk || "ADM-2024-001",
        location: latest.location || "Pool Sentra Lampung",
        notes: latest.notes || "Pengujian Notifikasi Realtime Berhasil",
        time: latest.time || Utilities.formatDate(new Date(), TIMEZONE, "HH:mm 'WIB'"),
        date: latest.date || Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy"),
        unitPhotoUrl: latest.unitPhoto || "",
        docPhotoUrl: latest.docPhoto || "",
        newStock: 12
      };
    }
  } catch (e) {
    Logger.log("Peringatan getLatestMutationOrDummy: " + e.toString());
  }

  // Fallback dummy jika belum ada data mutasi di spreadsheet
  const now = new Date();
  return {
    id: "MUT-TEST-" + Utilities.formatDate(now, TIMEZONE, "HHmmss"),
    type: "Unit Masuk",
    model: "All New Xenia 1.5 R CVT",
    vin: "MHKM1BA3JPK123456",
    engine: "2NR-VE-987654",
    pic: "Petugas Lapangan PIC",
    picNpk: "ADM-2024-001",
    location: "Pool Sentra Lampung",
    notes: "Pengujian Notifikasi Otomatis Berhasil",
    time: Utilities.formatDate(now, TIMEZONE, "HH:mm 'WIB'"),
    date: Utilities.formatDate(now, TIMEZONE, "dd/MM/yyyy"),
    unitPhotoUrl: "",
    docPhotoUrl: "",
    newStock: 15
  };
}

/**
 * ============================================================================
 * FUNGSI PENGUJIAN MANUAL LANGSUNG DARI APPS SCRIPT EDITOR
 * ============================================================================
 * Petunjuk:
 * 1. Di toolbar Apps Script atas, pilih dropdown fungsi: 'testNotifikasiRealtimeSekarang'
 * 2. Klik tombol '▷ Jalankan'
 * 3. Log eksekusi akan menampilkan status sukses dan email langsung masuk ke target email Anda!
 */
function testNotifikasiRealtimeSekarang() {
  const ss = getSpreadsheet();
  const testData = getLatestMutationOrDummy(ss);
  Logger.log("🚀 Menjalankan testNotifikasiRealtimeSekarang dengan data:");
  Logger.log(JSON.stringify(testData, null, 2));
  sendRealtimeMutationThreadNotification(ss, testData);
  Logger.log("✅ Pengujian notifikasi realtime selesai! Silakan periksa inbox email sasaran Anda.");
}

/**
 * Memperbaiki posisi kolom pada baris-baris riwayat mutasi yang sebelumnya bergeser di tab HistoryMutasi
 */
function fixShiftedHistoryRows() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(TAB_HISTORY);
  if (!sheet) return "Sheet tidak ditemukan";
  const rows = sheet.getDataRange().getValues();
  let fixedCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const valColB = String(rows[i][1] || "");
    const valColC = String(rows[i][2] || "");
    const valColD = String(rows[i][3] || "");

    // Deteksi jika Kolom B berisi tanggal (DD/MM/YYYY) dan Kolom D berisi ISO string
    if (valColB.includes("/") && valColD.includes("T") && valColD.includes("Z")) {
      const realIso = valColD;
      const realTime = valColC;
      const realDate = formatIndonesianDate(new Date(realIso));

      sheet.getRange(i + 1, 2).setValue(realIso);
      sheet.getRange(i + 1, 3).setValue(realDate);
      sheet.getRange(i + 1, 4).setValue(realTime);
      fixedCount++;
    }
  }
  Logger.log("Selesai memperbaiki " + fixedCount + " baris data mutasi.");
  return "Berhasil memperbaiki " + fixedCount + " baris data.";
}
