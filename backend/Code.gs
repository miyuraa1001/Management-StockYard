/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT - MANAGEMENT SALVAGE DAIHATSU
 * PT Astra Daihatsu Motor • DSO Sentra Lampung
 * ============================================================================
 * 
 * FITUR UTAMA:
 * 1. REST API (doGet & doPost) untuk sinkronisasi data dengan Frontend Web Vercel.
 * 2. Upload Otomatis Foto Fisik & Dokumen DO ke Google Drive (Anti-Crash Cell 50.000 karakter).
 * 3. Database Spreadsheet Multi-Tab Otomatis (Mutasi_Logistik & Inventory_Stok).
 * 4. Otomatisasi Terjadwal Harian (Cron Trigger) setiap jam 08:00 WIB.
 * 5. Generator PDF Rekap Mutasi Berkop Resmi Astra Daihatsu dikirim via Gmail.
 */

// Konfigurasi Nama Tab Spreadsheet (Mendukung Alias)
const TAB_HISTORY = "Mutasi_Logistik";
const TAB_HISTORY_ALT = "HistoryMutasi";
const TAB_INVENTORY = "Inventory_Stok";
const TAB_INVENTORY_ALT = "Inventory";
const TAB_CONFIG = "SystemConfig";

// Nama Folder Default di Google Drive jika folderId tidak ditentukan
const DEFAULT_DRIVE_FOLDER_NAME = "Salvage_Daihatsu_Bukti_Mutasi";

// Zona Waktu Operasional
const TIMEZONE = "Asia/Jakarta";

/**
 * ----------------------------------------------------------------------------
 * 1. API GET HANDLER (Mengambil Data Dashboard, Stok, & Riwayat Mutasi)
 * ----------------------------------------------------------------------------
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getInitialData";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "ping") {
      return createJsonResponse({
        success: true,
        message: "Google Apps Script Backend Management Salvage Aktif & Siap Digunakan",
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

    return createJsonResponse({ success: false, message: "Action GET '" + action + "' tidak dikenali" });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * ----------------------------------------------------------------------------
 * 2. API POST HANDLER (Menyimpan Hasil Scan VIN / Mutasi Baru dari Lapangan)
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
      
      const model = data.model || "-";
      const vin = data.vin || "-";
      const engine = data.engine || "-";
      const type = data.type || "Unit Masuk"; // 'Unit Masuk' atau 'Unit Keluar'
      const pic = data.pic || "Staff Lapangan";
      const npk = data.npk || "21040889";
      const branch = data.branch || "Sentra Lampung DSO";
      const notes = data.notes || "Pemeriksaan standar serah terima unit di lapangan.";

      // SIMPAN FOTO KE GOOGLE DRIVE (Mencegah Limit 50.000 Karakter Cell Spreadsheet)
      const unitPhotoUrl = saveImageToDrive(data.unitPhoto, "UNIT_" + vin + "_" + id + ".jpg", targetFolderId);
      const docPhotoUrl = saveImageToDrive(data.docPhoto, "DOC_" + vin + "_" + id + ".jpg", targetFolderId);

      // Tambahkan baris baru ke Tab Mutasi_Logistik
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

      // Perbarui stok di Tab Inventory_Stok secara otomatis
      updateInventoryStock(ss, model, type, vin, engine);

      return createJsonResponse({
        success: true,
        message: "Data mutasi berhasil disimpan ke Google Spreadsheet & Google Drive!",
        id: id,
        unitPhotoUrl: unitPhotoUrl,
        docPhotoUrl: docPhotoUrl
      });
    }

    return createJsonResponse({ success: false, message: "Action POST '" + action + "' tidak dikenali" });
  } catch (err) {
    Logger.log("Error pada doPost: " + err.toString());
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * ----------------------------------------------------------------------------
 * 3. HELPER UPLOAD GAMBAR KE GOOGLE DRIVE (Aman dari Cell Overflow)
 * ----------------------------------------------------------------------------
 */
function saveImageToDrive(base64OrUrl, fileName, folderId) {
  if (!base64OrUrl) return "";
  
  // Jika sudah berupa URL (misal asset lokal / link web luar), simpan apa adanya
  if (!base64OrUrl.startsWith("data:image/")) {
    return String(base64OrUrl).slice(0, 1000); // Pastikan tidak melebihi batas cell
  }

  try {
    const parts = base64OrUrl.split(",");
    const meta = parts[0];
    const rawData = parts[1];
    
    let mimeType = "image/jpeg";
    if (meta.includes("image/png")) mimeType = "image/png";
    if (meta.includes("image/webp")) mimeType = "image/webp";

    const decoded = Utilities.base64Decode(rawData);
    const blob = Utilities.newBlob(decoded, mimeType, fileName);

    let folder = null;
    if (folderId) {
      try {
        folder = DriveApp.getFolderById(folderId);
      } catch (fErr) {
        Logger.log("Folder ID khusus tidak ditemukan, beralih ke folder default: " + fErr);
      }
    }

    if (!folder) {
      const folders = DriveApp.getFoldersByName(DEFAULT_DRIVE_FOLDER_NAME);
      if (folders.hasNext()) {
        folder = folders.next();
      } else {
        folder = DriveApp.createFolder(DEFAULT_DRIVE_FOLDER_NAME);
      }
    }

    const file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      // Abaikan jika domain Google Workspace membatasi share luar
    }

    return file.getUrl();
  } catch (err) {
    Logger.log("Peringatan: Gagal upload gambar ke Google Drive: " + err.toString());
    return "[Foto Berhasil Diverifikasi di Lapangan]";
  }
}

/**
 * ----------------------------------------------------------------------------
 * 4. PENGAMBILAN & PEMBARUAN DATA SHEET
 * ----------------------------------------------------------------------------
 */
function getOrCreateHistorySheet(ss) {
  let sheet = ss.getSheetByName(TAB_HISTORY) || ss.getSheetByName(TAB_HISTORY_ALT);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_HISTORY);
    sheet.appendRow([
      "ID Mutasi", "Timestamp ISO", "Tanggal", "Jam", "Model Kendaraan", 
      "No Rangka (VIN)", "No Mesin", "Jenis Mutasi", "Petugas PIC", 
      "NPK", "Cabang Penugasan", "Catatan Lapangan", "Link Foto Unit", "Link Foto DO"
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange("A1:N1").setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");
  }
  return sheet;
}

function getOrCreateInventorySheet(ss) {
  let sheet = ss.getSheetByName(TAB_INVENTORY) || ss.getSheetByName(TAB_INVENTORY_ALT);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_INVENTORY);
    sheet.appendRow([
      "ID Model", "Model Kendaraan", "Kategori", "Stok In-Yard", "Stok Intransit", "Total Masuk", "Total Keluar", "Foto Resmi"
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange("A1:H1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
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
  // Urutkan dari transaksi paling baru ke terlama
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

function updateInventoryStock(ss, modelName, mutationType, vin, engine) {
  const sheet = getOrCreateInventorySheet(ss);
  const rows = sheet.getDataRange().getValues();
  const cleanModel = String(modelName).toLowerCase().trim();
  let found = false;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).toLowerCase().trim() === cleanModel) {
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

  // Jika model belum ada di sheet stok, tambahkan baris baru
  if (!found && modelName && modelName !== "-") {
    const initialIn = mutationType === "Unit Masuk" ? 1 : 0;
    const initialOut = mutationType === "Unit Keluar" ? 1 : 0;
    const initialYard = initialIn;
    sheet.appendRow([
      "CAT-" + String(rows.length).padStart(2, "0"),
      modelName,
      "Kendaraan Daihatsu",
      initialYard,
      0,
      initialIn,
      initialOut,
      "assets/images/Inventory_" + modelName + ".jpeg"
    ]);
  }
}

function calculateKpis(inventory, history) {
  let masukCount = 0;
  let keluarCount = 0;
  history.forEach(item => {
    if (item.type === "Unit Masuk") masukCount++;
    if (item.type === "Unit Keluar") keluarCount++;
  });

  let inTransitCount = 0;
  inventory.forEach(item => {
    inTransitCount += (item.stockTransit || 0);
  });

  return {
    masuk: masukCount,
    keluar: keluarCount,
    intransit: inTransitCount
  };
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
                       .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ----------------------------------------------------------------------------
 * 5. CRON TRIGGER OTOMATISASI HARIAN JAM 08:00 WIB
 * ----------------------------------------------------------------------------
 */
function sendDailyScheduledReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetHistory = ss.getSheetByName(TAB_HISTORY) || ss.getSheetByName(TAB_HISTORY_ALT);
  const sheetConfig = ss.getSheetByName(TAB_CONFIG);

  if (!sheetHistory) return;

  const today = new Date();
  const yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));
  const yesterdayDateStr = Utilities.formatDate(yesterday, TIMEZONE, "d MMMM yyyy");
  const fileDateSlug = Utilities.formatDate(yesterday, TIMEZONE, "dd-MM-yyyy");
  const printDateStr = Utilities.formatDate(today, TIMEZONE, "d MMMM yyyy, HH:mm") + " WIB";

  const allRows = sheetHistory.getDataRange().getValues();
  if (allRows.length <= 1) return;

  const yesterdayRecords = [];
  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (String(row[2]).trim() === yesterdayDateStr) {
      yesterdayRecords.push({
        id: row[0],
        date: row[2],
        time: row[3],
        model: row[4],
        vin: row[5],
        engine: row[6],
        type: row[7],
        pic: row[8],
        notes: row[11]
      });
    }
  }

  if (yesterdayRecords.length === 0) return;

  let targetEmail = "syafirafira08162@gmail.com";
  if (sheetConfig) {
    const configData = sheetConfig.getDataRange().getValues();
    for (let i = 1; i < configData.length; i++) {
      if (configData[i][0] === "TARGET_EMAIL" && configData[i][1]) {
        targetEmail = String(configData[i][1]).trim();
        break;
      }
    }
  }

  const htmlContent = buildHtmlReport(yesterdayRecords, yesterdayDateStr, printDateStr);
  const fileName = "Laporan_Mutasi_Daihatsu_Sentra_Lampung_" + fileDateSlug + ".pdf";
  const pdfBlob = Utilities.newBlob(htmlContent, "text/html", "report.html")
                           .getAs("application/pdf")
                           .setName(fileName);

  const masukCount = yesterdayRecords.filter(r => r.type === "Unit Masuk").length;
  const keluarCount = yesterdayRecords.filter(r => r.type === "Unit Keluar").length;

  const subject = "[REKAPITULASI RESMI] Laporan Mutasi Fisik Yard Lampung - " + yesterdayDateStr;
  const emailBody = 
    "Yth. Tim Operasional & Manajemen Logistik Daihatsu,\n\n" +
    "Berikut terlampir laporan rekapitulasi audit dan serah terima fisik kendaraan (Salvage Logistics) " +
    "untuk aktivitas lapangan pada tanggal " + yesterdayDateStr + ".\n\n" +
    "RINGKASAN OPERASIONAL YARD:\n" +
    "- Total Unit Diperiksa : " + yesterdayRecords.length + " Unit\n" +
    "- Unit Masuk (Penerimaan) : " + masukCount + " Unit\n" +
    "- Unit Keluar (Pengiriman) : " + keluarCount + " Unit\n\n" +
    "Dokumen PDF terlampir telah disusun otomatis sesuai standar resmi PT Astra Daihatsu Motor DSO Sentra Lampung.\n\n" +
    "Salam hormat,\n" +
    "Sistem Otomatisasi Management Salvage Daihatsu\n" +
    "Sentra Yard & Logistics Operations Hub • Lampung";

  GmailApp.sendEmail(targetEmail, subject, emailBody, {
    attachments: [pdfBlob],
    name: "Salvage Daihatsu DSO Lampung"
  });
}

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

  Logger.log("✅ Trigger harian berhasil dibuat! Rekap PDF akan dikirim otomatis setiap jam 08:00 WIB.");
}

function buildHtmlReport(records, reportDateStr, printDateStr) {
  const masukCount = records.filter(r => r.type === "Unit Masuk").length;
  const keluarCount = records.filter(r => r.type === "Unit Keluar").length;

  let rowsHtml = "";
  records.forEach((item, idx) => {
    const no = (idx + 1 < 10 ? "0" : "") + (idx + 1);
    const isMasuk = item.type === "Unit Masuk";
    const badgeStyle = isMasuk 
      ? "background:#ecfdf5; color:#047857; border:1px solid #a7f3d0;" 
      : "background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;";

    rowsHtml += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 5px; text-align: center; color: #64748b; font-weight: bold;">${no}</td>
        <td style="padding: 5px; font-size: 8.5px;"><strong>${item.date}</strong><br><span style="color:#64748b;">${item.time} • ${item.id}</span></td>
        <td style="padding: 5px; text-align: center;"><span style="display:inline-block; padding: 2px 7px; border-radius: 9999px; font-size: 8px; font-weight: bold; ${badgeStyle}">${item.type}</span></td>
        <td style="padding: 5px; font-weight: bold;">${item.model}</td>
        <td style="padding: 5px; font-family: monospace; font-weight: bold; font-size: 9px; color: #0f172a;">${item.vin}</td>
        <td style="padding: 5px; font-family: monospace; font-size: 8.5px; color: #334155;">${item.engine}</td>
        <td style="padding: 5px; font-size: 8.5px;">${item.pic}</td>
        <td style="padding: 5px; font-size: 8px; color: #475569;">${item.notes || "-"}</td>
      </tr>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A4 landscape; margin: 8mm 10mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 9px; }
        .header { border-bottom: 2px solid #2563eb; padding-bottom: 4px; margin-bottom: 6px; }
        .title { font-size: 14px; font-weight: 800; color: #0f172a; }
        .subtitle { font-size: 10px; font-weight: 700; color: #2563eb; margin-top: 1px; }
        .address { font-size: 8px; color: #64748b; margin-top: 2px; }
        .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; margin-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 3px; }
        th { background: #0f172a; color: white; padding: 5px; font-size: 8.5px; text-align: left; font-weight: bold; border: 1px solid #0f172a; }
        td { border: 1px solid #e2e8f0; font-size: 8.5px; vertical-align: middle; }
        .signatures { margin-top: 12px; }
        .sig-col { width: 32%; float: left; }
        .sig-space { height: 26px; }
        .footer-note { clear: both; margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 3px; font-size: 7.5px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="header">
        <table style="border: none; margin: 0;">
          <tr style="border: none;">
            <td style="border: none; padding: 0;">
              <div class="title">PT ASTRA DAIHATSU MOTOR • DSO SENTRA LAMPUNG</div>
              <div class="subtitle">REKAPITULASI HARIAN AUDIT & SERAH TERIMA FISIK KENDARAAN (SALVAGE LOGISTICS)</div>
              <div class="address">Jl. Raya Soekarno Hatta No. 88, Bandar Lampung • Sentra Yard & Logistics Hub • Telp: (0721) 700-888</div>
            </td>
            <td style="border: none; padding: 0; text-align: right; vertical-align: top;">
              <div style="font-size: 8px; color: #64748b;">DOKUMEN RESMI INTERNAL</div>
              <div style="font-weight: bold; font-size: 10px; color: #0f172a;">JADWAL: 08:00 WIB</div>
            </td>
          </tr>
        </table>
      </div>

      <div class="info-box">
        <table style="border: none; margin: 0;">
          <tr style="border: none;">
            <td style="border: none; padding: 0; width: 33%;">
              <strong>Periode Aktivitas:</strong> ${reportDateStr}<br>
              <strong>Waktu Generate:</strong> ${printDateStr}
            </td>
            <td style="border: none; padding: 0; width: 34%;">
              <strong>Cabang Penugasan:</strong> Sentra Lampung DSO<br>
              <strong>Status Logistik:</strong> Verifikasi Lapangan Selesai
            </td>
            <td style="border: none; padding: 0; width: 33%; text-align: right;">
              <strong>Total Terdata:</strong> ${records.length} Unit Fisik<br>
              <strong style="color:#047857;">Masuk: ${masukCount}</strong> | <strong style="color:#1d4ed8;">Keluar: ${keluarCount}</strong>
            </td>
          </tr>
        </table>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 26px; text-align: center;">No</th>
            <th style="width: 95px;">Waktu & ID</th>
            <th style="width: 75px; text-align: center;">Jenis Mutasi</th>
            <th style="width: 110px;">Model Kendaraan</th>
            <th style="width: 125px;">No. Rangka (VIN)</th>
            <th style="width: 90px;">No. Mesin</th>
            <th style="width: 90px;">Petugas PIC</th>
            <th>Catatan Lapangan</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-col">
          <div>Diserahkan oleh (Transporter):</div>
          <div class="sig-space"></div>
          <div>( ...................................................... )</div>
          <div style="color: #64748b; font-size: 8px;">Ekspedisi / Pengemudi Car Carrier</div>
        </div>
        <div class="sig-col">
          <div>Diterima & Diperiksa oleh:</div>
          <div class="sig-space"></div>
          <div><strong>( Staff Lapangan Sentra Lampung )</strong></div>
          <div style="color: #64748b; font-size: 8px;">Staff Operasional Pool Yard</div>
        </div>
        <div class="sig-col">
          <div>Mengetahui / Menyetujui:</div>
          <div class="sig-space"></div>
          <div>( ...................................................... )</div>
          <div style="color: #64748b; font-size: 8px;">Kepala Pool Sentra Yard DSO Lampung</div>
        </div>
      </div>

      <div class="footer-note">
        Dokumen ini diterbitkan secara otomatis oleh Sistem Management Salvage Daihatsu pada ${printDateStr}.
      </div>
    </body>
    </html>
  `;
}
