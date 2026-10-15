/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT - MANAGEMENT SALVAGE DAIHATSU
 * PT Astra Daihatsu Motor • DSO Sentra Lampung
 * ============================================================================
 * 
 * PETUNJUK INSTALASI:
 * 1. Buka Google Spreadsheet database Anda.
 * 2. Klik menu "Ekstensi" (Extensions) > "Apps Script".
 * 3. Hapus seluruh kode lama di file Code.gs, lalu paste seluruh isi file ini.
 * 4. PENTING (Otorisasi Google Drive):
 *    Pilih fungsi "izinkanAksesGoogleDrive" pada dropdown di toolbar atas, lalu klik "Jalankan" (Run).
 *    Klik "Tinjau Izin" (Review permissions) -> Pilih Akun -> "Lanjutan" -> "Buka ... (tidak aman)" -> "Izinkan".
 * 5. TERAPKAN SEBAGAI WEB APP (NEW VERSION):
 *    Klik tombol biru "Terapkan" (Deploy) di kanan atas > "Kelola Penerapan" (Manage Deployments).
 *    Klik ikon pensil (Edit) > Pada dropdown "Versi" pilih "Versi Baru" (New Version).
 *    Klik "Terapkan" (Deploy).
 */

// Konfigurasi Nama Tab Spreadsheet (Mendukung Multi-Alias)
const TAB_HISTORY = "HistoryMutasi";
const TAB_HISTORY_ALT = "Mutasi_Logistik";
const TAB_INVENTORY = "Inventory";
const TAB_INVENTORY_ALT = "Inventory_Stok";
const TAB_CONFIG = "SystemConfig";

// Zona Waktu Operasional
const TIMEZONE = "Asia/Jakarta";

/**
 * ----------------------------------------------------------------------------
 * 1. FUNGSI OTORISASI GOOGLE DRIVE (Jalankan 1x di Editor Apps Script)
 * ----------------------------------------------------------------------------
 */
function izinkanAksesGoogleDrive() {
  Logger.log("Memulai pengujian izin Google Drive...");
  try {
    const root = DriveApp.getRootFolder();
    Logger.log("✅ Izin Google Drive AKTIF 100%! Nama root: " + root.getName());
    
    const folder = getOrCreateDriveFolder();
    Logger.log("✅ Folder Penyimpanan Foto Siap: " + folder.getName() + " (ID: " + folder.getId() + ")");
    return "SUKSES: Izin Google Drive telah aktif!";
  } catch (err) {
    Logger.log("❌ Gagal otorisasi Drive: " + err.toString());
    throw err;
  }
}

/**
 * ----------------------------------------------------------------------------
 * 2. API GET HANDLER (Mengambil Data Dashboard, Stok, & Riwayat Mutasi)
 * ----------------------------------------------------------------------------
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getInitialData";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "ping") {
      return createJsonResponse({
        success: true,
        message: "PONG - Backend Management Salvage Daihatsu Aktif & Siap Digunakan!",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "getInitialData") {
      const inventory = getInventoryData(ss);
      const history = getHistoryData(ss);
      const kpi = calculateKpis(inventory, history);

      return createJsonResponse({
        success: true,
        data: {
          inventory: inventory,
          history: history,
          kpi: kpi
        }
      });
    }

    if (action === "getInventory") {
      return createJsonResponse({
        success: true,
        data: getInventoryData(ss)
      });
    }

    if (action === "getHistory") {
      return createJsonResponse({
        success: true,
        data: getHistoryData(ss)
      });
    }

    if (action === "getSummary") {
      const inventory = getInventoryData(ss);
      const history = getHistoryData(ss);
      return createJsonResponse({
        success: true,
        data: {
          kpi: calculateKpis(inventory, history),
          totalModels: inventory.length,
          totalHistory: history.length
        }
      });
    }

    return createJsonResponse({ success: false, message: "Action GET '" + action + "' tidak dikenali." });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * ----------------------------------------------------------------------------
 * 3. API POST HANDLER (Menyimpan Hasil Scan VIN / Mutasi Baru & Upload Foto)
 * ----------------------------------------------------------------------------
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let body = {};

    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        body = { raw: e.postData.contents };
      }
    }

    const action = body.action || "saveMutation";
    const data = body.data || body;
    const targetFolderId = body.folderId || data.folderId || "";

    if (action === "saveMutation") {
      const sheetHistory = getOrCreateHistorySheet(ss);
      
      const now = new Date();
      const id = data.id || ("MUT-" + Utilities.formatDate(now, TIMEZONE, "yyyyMMdd-HHmmss"));
      const timestampIso = now.toISOString();
      const dateFormatted = data.fullDateStr || Utilities.formatDate(now, TIMEZONE, "d MMMM yyyy");
      const timeFormatted = data.time || (Utilities.formatDate(now, TIMEZONE, "HH:mm") + " WIB");
      
      const model = data.model || data.name || "-";
      const vin = (data.vin || data.vinNumber || "-").trim().toUpperCase();
      const engine = (data.engine || data.engineNumber || "-").trim().toUpperCase();
      const type = data.type || data.mutationType || "Unit Masuk";
      const pic = data.pic || data.driverName || "Staff Lapangan";
      const npk = data.npk || "21040889";
      const branch = data.branch || "Sentra Lampung DSO";
      const notes = data.notes || data.keterangan || "Pemeriksaan standar serah terima unit di lapangan.";

      // SIMPAN FOTO KE GOOGLE DRIVE (Mencegah Limit 50.000 Karakter Cell Spreadsheet)
      const unitPhotoRaw = data.unitPhoto || data.photoUnit || data.photo || "";
      const docPhotoRaw = data.docPhoto || data.photoDoc || data.docImg || "";

      const unitPhotoUrl = saveImageToDrive(unitPhotoRaw, "UNIT_" + vin + "_" + id + ".jpg", targetFolderId);
      const docPhotoUrl = saveImageToDrive(docPhotoRaw, "DOC_" + vin + "_" + id + ".jpg", targetFolderId);

      // Tambahkan baris baru ke Tab HistoryMutasi
      sheetHistory.appendRow([
        id,
        timestampIso,
        dateFormatted,
        timeFormatted,
        model,
        vin,
        engine,
        type,
        pic,
        npk,
        branch,
        notes,
        unitPhotoUrl,
        docPhotoUrl
      ]);

      // Perbarui stok di Tab Inventory secara otomatis
      updateInventoryStock(ss, model, type);

      return createJsonResponse({
        success: true,
        message: "Data mutasi fisik berhasil diverifikasi dan disimpan.",
        id: id,
        unitPhotoUrl: unitPhotoUrl,
        docPhotoUrl: docPhotoUrl
      });
    }

    return createJsonResponse({ success: false, message: "Action POST '" + action + "' tidak valid." });
  } catch (err) {
    Logger.log("Error pada doPost: " + err.toString());
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * ----------------------------------------------------------------------------
 * 4. HELPER UPLOAD GAMBAR KE GOOGLE DRIVE (Anti-Cell Overflow 50.000 Karakter)
 * ----------------------------------------------------------------------------
 */
function saveImageToDrive(base64OrUrl, fileName, targetFolderId) {
  if (!base64OrUrl) return "";

  // Jika sudah berupa URL (misal asset lokal / link web luar), simpan URL langsung
  if (!base64OrUrl.startsWith("data:image/")) {
    return String(base64OrUrl).slice(0, 1000);
  }

  try {
    const parts = base64OrUrl.split(",");
    if (parts.length < 2) return "";
    
    const meta = parts[0];
    const rawData = parts[1];

    let mimeType = "image/jpeg";
    if (meta.includes("image/png")) mimeType = "image/png";
    if (meta.includes("image/webp")) mimeType = "image/webp";

    const decoded = Utilities.base64Decode(rawData);
    const blob = Utilities.newBlob(decoded, mimeType, fileName);

    const folder = getOrCreateDriveFolder(targetFolderId);
    const file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log("Peringatan share permissions: " + shareErr.toString());
    }

    return file.getUrl();
  } catch (err) {
    Logger.log("Error saveImageToDrive: " + err.toString());
    if (err.toString().includes("permission") || err.toString().includes("DriveApp")) {
      return "[Perlu Otorisasi Drive: Buka Apps Script & Jalankan izinkanAksesGoogleDrive]";
    }
    return "";
  }
}

/**
 * Mendapatkan atau membuat folder penyimpanan bukti foto di Google Drive
 */
function getOrCreateDriveFolder(targetFolderId) {
  // 1. Jika pengguna menentukan folderId khusus
  if (targetFolderId) {
    try {
      const f = DriveApp.getFolderById(targetFolderId);
      if (f) return f;
    } catch (e) {
      Logger.log("Folder ID khusus tidak ditemukan, mencari alternatif...");
    }
  }

  // 2. Cari folder dengan nama project yang sudah ada
  const possibleNames = [
    "Daihatsu_Logistics_Bukti_Mutasi",
    "Daihatsu_Logistics_Photos",
    "Daihatsu_Logistics_Tracker",
    "Daihatsu_Logistics",
    "Salvage_Daihatsu_Bukti_Mutasi"
  ];
  for (let i = 0; i < possibleNames.length; i++) {
    const folders = DriveApp.getFoldersByName(possibleNames[i]);
    if (folders.hasNext()) {
      return folders.next();
    }
  }

  // 3. Gunakan folder tempat Spreadsheet database ini berada
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ssFile = DriveApp.getFileById(ss.getId());
    const parents = ssFile.getParents();
    if (parents.hasNext()) {
      const parentFolder = parents.next();
      const subFolders = parentFolder.getFoldersByName("Bukti_Mutasi_Foto");
      if (subFolders.hasNext()) {
        return subFolders.next();
      }
      return parentFolder.createFolder("Bukti_Mutasi_Foto");
    }
  } catch (ssErr) {
    Logger.log("Tidak dapat membaca folder parent spreadsheet: " + ssErr.toString());
  }

  // 4. Default: Buat folder baru di Google Drive
  return DriveApp.createFolder("Daihatsu_Logistics_Bukti_Mutasi");
}

/**
 * ----------------------------------------------------------------------------
 * 5. PENGAMBILAN & PEMBARUAN DATA SPREADSHEET
 * ----------------------------------------------------------------------------
 */
function getOrCreateHistorySheet(ss) {
  let sheet = ss.getSheetByName(TAB_HISTORY) || ss.getSheetByName(TAB_HISTORY_ALT);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_HISTORY);
    sheet.appendRow([
      "ID Mutasi", "Timestamp ISO", "Tanggal", "Jam", "Model Kendaraan",
      "No. Rangka (VIN)", "No. Mesin", "Jenis Mutasi", "Nama PIC",
      "NPK", "Cabang", "Catatan Lapangan", "Foto Unit", "Foto Dokumen"
    ]);
    sheet.getRange(1, 1, 1, 14).setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateInventorySheet(ss) {
  let sheet = ss.getSheetByName(TAB_INVENTORY) || ss.getSheetByName(TAB_INVENTORY_ALT);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_INVENTORY);
    sheet.appendRow([
      "Kode Item", "Model Kendaraan", "Kategori", "Stok Pool Yard",
      "Stok Intransit", "Total Masuk", "Total Keluar", "Foto Referensi"
    ]);
    sheet.getRange(1, 1, 1, 8).setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
    
    // Inisialisasi 13 model katalog resmi Daihatsu
    const defaultCatalog = [
      ["INV-001", "Rocky e-Smart Hybrid", "Smart Hybrid SUV", 0, 0, 0, 0, "assets/images/Inventory_Rocky e-Smart Hybrid.jpeg"],
      ["INV-002", "Gran Max Pick Up", "Niaga & Logistik Tangguh", 0, 0, 0, 0, "assets/images/Inventory_Gran Max Pick Up.jpeg"],
      ["INV-003", "New Terios", "7-Seater Adventure SUV", 0, 0, 0, 0, "assets/images/Inventory_New Terios.jpeg"],
      ["INV-004", "New Sigra", "LCGC 7-Seater Family MPV", 0, 0, 0, 0, "assets/images/Inventory_New Sigra.jpeg"],
      ["INV-005", "All New Xenia", "The Next Level MPV", 0, 0, 0, 0, "assets/images/Inventory_All New Xenia.jpeg"],
      ["INV-006", "All New Ayla", "Compact Hatchback Urban", 0, 0, 0, 0, "assets/images/Inventory_All New Ayla.jpeg"],
      ["INV-007", "New Rocky", "Compact Turbo SUV", 0, 0, 0, 0, "assets/images/Inventory_New Rocky.jpeg"],
      ["INV-008", "Sirion", "Stylish City Car", 0, 0, 0, 0, "assets/images/Inventory_Sirion.jpeg"],
      ["INV-009", "Luxio", "Spacious Elegant Van", 0, 0, 0, 0, "assets/images/Inventory_Luxio.jpeg"],
      ["INV-010", "Gran Max Blind Van", "Commercial Cargo Van", 0, 0, 0, 0, "assets/images/Inventory_Gran Max Blind Van.jpeg"],
      ["INV-011", "Gran Max Minibus", "Family & Commercial Transport", 0, 0, 0, 0, "assets/images/Inventory_Gran Max Minibus.jpeg"],
      ["INV-012", "Terios Special Edition", "Limited Edition Sport SUV", 0, 0, 0, 0, "assets/images/Inventory_Terios Special Edition.jpeg"],
      ["INV-013", "Sigra (Prod Old)", "Reliable Value MPV", 0, 0, 0, 0, "assets/images/Inventory_New Sigra.jpeg"]
    ];
    defaultCatalog.forEach(row => sheet.appendRow(row));
  }
  return sheet;
}

function getInventoryData(ss) {
  const sheet = ss.getSheetByName(TAB_INVENTORY) || ss.getSheetByName(TAB_INVENTORY_ALT);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const inventory = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1]) continue;
    inventory.push({
      id: String(r[0] || ("INV-" + i)),
      name: String(r[1]),
      model: String(r[1]),
      category: String(r[2] || "Kendaraan Daihatsu"),
      stockYard: parseInt(r[3], 10) || 0,
      stockTransit: parseInt(r[4], 10) || 0,
      totalIn: parseInt(r[5], 10) || 0,
      totalOut: parseInt(r[6], 10) || 0,
      status: (parseInt(r[3], 10) || 0) > 0 ? "In-Yard" : "Kosong",
      photo: String(r[7] || "")
    });
  }
  return inventory;
}

function getHistoryData(ss) {
  const sheet = ss.getSheetByName(TAB_HISTORY) || ss.getSheetByName(TAB_HISTORY_ALT);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const history = [];
  for (let i = rows.length - 1; i >= 1; i--) {
    const r = rows[i];
    if (!r[0]) continue;
    history.push({
      id: String(r[0]),
      timestamp: String(r[1] || ""),
      fullDateStr: String(r[2] || ""),
      time: String(r[3] || ""),
      model: String(r[4] || "-"),
      vin: String(r[5] || "-"),
      engine: String(r[6] || "-"),
      type: String(r[7] || "Unit Masuk"),
      pic: String(r[8] || "-"),
      npk: String(r[9] || "-"),
      branch: String(r[10] || "-"),
      notes: String(r[11] || "-"),
      unitPhoto: String(r[12] || ""),
      docPhoto: String(r[13] || "")
    });
  }
  return history;
}

function updateInventoryStock(ss, modelName, mutationType) {
  const sheet = getOrCreateInventorySheet(ss);
  const rows = sheet.getDataRange().getValues();
  const cleanModel = String(modelName || "").toLowerCase().trim();
  let found = false;

  for (let i = 1; i < rows.length; i++) {
    const rowModel = String(rows[i][1] || "").toLowerCase().trim();
    if (rowModel === cleanModel || cleanModel.includes(rowModel) || rowModel.includes(cleanModel)) {
      let currentYard = parseInt(rows[i][3], 10) || 0;
      let totalIn = parseInt(rows[i][5], 10) || 0;
      let totalOut = parseInt(rows[i][6], 10) || 0;

      if (mutationType === "Unit Masuk") {
        currentYard += 1;
        totalIn += 1;
      } else {
        currentYard = Math.max(0, currentYard - 1);
        totalOut += 1;
      }

      sheet.getRange(i + 1, 4).setValue(currentYard);
      sheet.getRange(i + 1, 6).setValue(totalIn);
      sheet.getRange(i + 1, 7).setValue(totalOut);
      found = true;
      break;
    }
  }

  if (!found && modelName && modelName !== "-") {
    const initialIn = mutationType === "Unit Masuk" ? 1 : 0;
    const initialOut = mutationType === "Unit Keluar" ? 1 : 0;
    sheet.appendRow([
      "INV-" + String(rows.length).padStart(3, "0"),
      modelName,
      "Kendaraan Daihatsu",
      initialIn,
      0,
      initialIn,
      initialOut,
      "assets/images/Inventory_" + modelName + ".jpeg"
    ]);
  }
}

function calculateKpis(inventory, history) {
  const totalStock = inventory.reduce((acc, item) => acc + (item.stockYard || 0), 0);
  const inTransit = inventory.reduce((acc, item) => acc + (item.stockTransit || 0), 0);
  const todayIn = history.filter(h => h.type === "Unit Masuk").length;
  const todayOut = history.filter(h => h.type === "Unit Keluar").length;

  return {
    inYard: totalStock,
    inTransit: inTransit,
    todayIn: todayIn,
    todayOut: todayOut,
    totalStock: totalStock
  };
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
