/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT - MANAGEMENT SALVAGE DAIHATSU
 * PT Astra Daihatsu Motor • DSO Sentra Lampung
 * ============================================================================
 * 
 * FITUR UTAMA:
 * 1. REST API (doGet & doPost) untuk sinkronisasi data dengan Frontend Web.
 * 2. Database Spreadsheet multi-tab (HistoryMutasi, Inventory, SystemConfig).
 * 3. Otomatisasi Terjadwal Harian (Cron Trigger) setiap jam 08:00 WIB.
 * 4. Generator PDF Resmi Kop Daihatsu dari data hasil scan H-1.
 * 5. Pengiriman Email Otomatis dengan Attachment PDF ke Tim Logistik.
 */

// Konfigurasi Nama Tab Spreadsheet
const TAB_HISTORY = "HistoryMutasi";
const TAB_INVENTORY = "Inventory";
const TAB_CONFIG = "SystemConfig";

// Zona Waktu Operasional
const TIMEZONE = "Asia/Jakarta";

/**
 * ----------------------------------------------------------------------------
 * 1. API GET HANDLER (Mengambil Data untuk Tampilan Dashboard, Stok, & Riwayat)
 * ----------------------------------------------------------------------------
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getInitialData";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

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

    return createJsonResponse({ success: false, message: "Action tidak dikenali" });
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
      body = JSON.parse(e.postData.contents);
    }

    const action = body.action || "saveMutation";
    const data = body.data || body;

    if (action === "saveMutation") {
      const sheetHistory = ss.getSheetByName(TAB_HISTORY) || createHistorySheet(ss);
      
      const now = new Date();
      const id = data.id || ("MUT-" + Utilities.formatDate(now, TIMEZONE, "yyyyMMdd-HHmmss"));
      const timestampIso = now.toISOString();
      const dateFormatted = Utilities.formatDate(now, TIMEZONE, "d MMMM yyyy");
      const timeFormatted = Utilities.formatDate(now, TIMEZONE, "HH:mm") + " WIB";
      
      const model = data.model || "-";
      const vin = data.vin || "-";
      const engine = data.engine || "-";
      const type = data.type || "Unit Masuk"; // 'Unit Masuk' atau 'Unit Keluar'
      const pic = data.pic || "Staff Lapangan";
      const npk = data.npk || "-";
      const branch = data.branch || "Sentra Lampung DSO";
      const notes = data.notes || "-";
      const unitPhoto = data.unitPhoto || "";
      const docPhoto = data.docPhoto || "";

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
        unitPhoto,
        docPhoto
      ]);

      // Perbarui stok di Tab Inventory jika model cocok
      updateInventoryStock(ss, model, type);

      return createJsonResponse({
        success: true,
        message: "Data mutasi berhasil disimpan ke Google Sheets",
        id: id
      });
    }

    return createJsonResponse({ success: false, message: "Action POST tidak valid" });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * ----------------------------------------------------------------------------
 * 3. CRON JOB: PENGIRIMAN REKAP PDF OTOMATIS SETIAP JAM 08:00 WIB
 * ----------------------------------------------------------------------------
 * Fungsi ini otomatis dipicu oleh Google Time-driven Trigger setiap pagi.
 * Logika: Mengambil semua data scan H-1 (kemarin), dibuatkan PDF, dan dikirim via email.
 */
function sendDailyScheduledReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetHistory = ss.getSheetByName(TAB_HISTORY);
  const sheetConfig = ss.getSheetByName(TAB_CONFIG);

  if (!sheetHistory) {
    Logger.log("Error: Tab HistoryMutasi tidak ditemukan.");
    return;
  }

  // 1. Tentukan tanggal kemarin (H-1)
  const today = new Date();
  const yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));
  
  // Format pembanding tanggal
  const yesterdayDateStr = Utilities.formatDate(yesterday, TIMEZONE, "d MMMM yyyy");
  const fileDateSlug = Utilities.formatDate(yesterday, TIMEZONE, "dd-MM-yyyy");
  const printDateStr = Utilities.formatDate(today, TIMEZONE, "d MMMM yyyy, HH:mm") + " WIB";

  // 2. Ambil seluruh data riwayat mutasi
  const allRows = sheetHistory.getDataRange().getValues();
  if (allRows.length <= 1) {
    Logger.log("Tidak ada data mutasi yang tersimpan di sistem.");
    return;
  }

  const headers = allRows[0];
  // Filter baris yang dicatat kemarin (berdasarkan kolom Tanggal / index 2)
  const yesterdayRecords = [];
  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i];
    const rowDateStr = String(row[2]).trim(); // Kolom C: fullDateStr
    if (rowDateStr === yesterdayDateStr) {
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

  // Jika kemarin tidak ada aktivitas scan sama sekali
  if (yesterdayRecords.length === 0) {
    Logger.log("Tidak ada aktivitas mutasi pada tanggal " + yesterdayDateStr + ". Pengiriman PDF dilewati.");
    return;
  }

  Logger.log("Ditemukan " + yesterdayRecords.length + " transaksi untuk tanggal " + yesterdayDateStr + ". Memproses pembuatan PDF...");

  // 3. Baca Konfigurasi Tujuan Email
  let targetEmail = "report.logistik@daihatsu.co.id";
  if (sheetConfig) {
    const configData = sheetConfig.getDataRange().getValues();
    for (let i = 1; i < configData.length; i++) {
      if (configData[i][0] === "TARGET_EMAIL" && configData[i][1]) {
        targetEmail = String(configData[i][1]).trim();
        break;
      }
    }
  }

  // 4. Render HTML Report Berstandar Kop Astra Daihatsu
  const htmlContent = buildHtmlReport(yesterdayRecords, yesterdayDateStr, printDateStr);

  // 5. Konversi HTML ke Dokumen PDF Resmi
  const fileName = "Laporan_Mutasi_Daihatsu_Sentra_Lampung_" + fileDateSlug + ".pdf";
  const pdfBlob = Utilities.newBlob(htmlContent, "text/html", "report.html")
                           .getAs("application/pdf")
                           .setName(fileName);

  // 6. Kirim Email Otomatis Menggunakan Akun Gmail
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

  Logger.log("✅ Berhasil mengirim rekap PDF ke " + targetEmail + " pada " + new Date().toString());
}

/**
 * ----------------------------------------------------------------------------
 * 4. SATU KLIK SETUP TRIGGER (Jalankan Sekali Saja untuk Mengaktifkan Jam 08.00)
 * ----------------------------------------------------------------------------
 */
function setupDailyTrigger() {
  // Hapus trigger lama jika ada agar tidak dobel
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "sendDailyScheduledReport") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Buat trigger otomatis harian setiap jam 08:00 WIB (Waktu Jakarta)
  ScriptApp.newTrigger("sendDailyScheduledReport")
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone(TIMEZONE)
    .create();

  Logger.log("✅ Trigger harian berhasil dibuat! Rekap PDF akan dikirim otomatis setiap jam 08:00 WIB.");
}

/**
 * ----------------------------------------------------------------------------
 * 5. TEMPLATE DOKUMEN HTML UNTUK GENERATOR PDF RESMI DAIHATSU
 * ----------------------------------------------------------------------------
 */
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

/**
 * ----------------------------------------------------------------------------
 * 6. HELPER FUNCTIONS & DATABASE UTILITIES
 * ----------------------------------------------------------------------------
 */
function getInventoryData(ss) {
  const sheet = ss.getSheetByName(TAB_INVENTORY);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const inventory = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1]) continue;
    inventory.push({
      id: r[0] || ("INV-" + i),
      name: r[1],
      category: r[2] || "Passenger Car",
      stockYard: parseInt(r[3], 10) || 0,
      stockTransit: parseInt(r[4], 10) || 0,
      totalIn: parseInt(r[5], 10) || 0,
      totalOut: parseInt(r[6], 10) || 0,
      photo: r[7] || ""
    });
  }
  return inventory;
}

function getHistoryData(ss) {
  const sheet = ss.getSheetByName(TAB_HISTORY);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const history = [];
  // Urutkan dari transaksi paling baru
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
  const sheet = ss.getSheetByName(TAB_INVENTORY);
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).toLowerCase().trim() === String(modelName).toLowerCase().trim()) {
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
      break;
    }
  }
}

function calculateKpis(inventory, history) {
  let inYard = 0;
  let inTransit = 0;
  inventory.forEach(item => {
    inYard += (item.stockYard || 0);
    inTransit += (item.stockTransit || 0);
  });

  const todayStr = Utilities.formatDate(new Date(), TIMEZONE, "d MMMM yyyy");
  let todayIn = 0;
  let todayOut = 0;
  history.forEach(item => {
    if (item.fullDateStr === todayStr) {
      if (item.type === "Unit Masuk") todayIn++;
      if (item.type === "Unit Keluar") todayOut++;
    }
  });

  return {
    inYard: inYard,
    inTransit: inTransit,
    todayIn: todayIn,
    todayOut: todayOut,
    totalStock: inYard + inTransit
  };
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
                       .setMimeType(ContentService.MimeType.JSON);
}

function createHistorySheet(ss) {
  const sheet = ss.insertSheet(TAB_HISTORY);
  sheet.appendRow([
    "ID Mutasi", "Timestamp", "Tanggal", "Jam", "Model", "VIN", "No Mesin", 
    "Jenis Mutasi", "Petugas PIC", "NPK", "Cabang", "Catatan", "Foto Unit", "Foto Dokumen"
  ]);
  sheet.setFrozenRows(1);
  return sheet;
}
