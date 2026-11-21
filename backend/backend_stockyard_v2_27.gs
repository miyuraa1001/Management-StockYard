/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT - MANAGEMENT STOCKYARD DAIHATSU (PRO V2.27)
 * PT Astra Daihatsu Motor • Astra Daihatsu DSO Lampung
 * ============================================================================
 * Pembaruan Spesifik PRO V2.27 (Perbaikan Sinkronisasi Tanggal Laporan Harian):
 * 1. FIX TANGGAL REKAPITULASI HARIAN OTOMATIS (STRICT H-1 / KEMARIN):
 *    - Menghapus tuntas bug pengalihan tanggal ke hari ini (today redirection).
 *    - Laporan otomatis pukul 08:00 WIB SELALU dan PASTI merekap operasional KEMARIN (H-1).
 *    - Jika kemarin nihil transaksi (0 unit), sistem menerbitkan laporan resmi status NIHIL MUTASI untuk periode kemarin,
 *      dan TIDAK AKAN PERNAH membajak atau mencampuradukkan data mutasi hari ini yang belum selesai.
 * 2. STANDARISASI NORMALISASI TANGGAL DENGAN TIMEZONE ASIA/JAKARTA (WIB):
 *    - String ISO timestamp (mengandung T atau Z) di-parse ke objek Date dan diformat menggunakan TIMEZONE Asia/Jakarta.
 *    - Memprioritaskan pembacaan Tanggal Lokal (Kolom C) dari sheet HistoryMutasi agar identik dengan tanggal operasional.
 * 3. MATRIKS RUTE TRANSIT POINT-TO-POINT ANTAR-CABANG (TAB SystemConfig):
 *    - Menyimpan TRANSIT_ROUTES_JSON untuk durasi rute spesifik (Asal -> Tujuan)
 * 4. PEMISAHAN DEFINISI NAMA PETUGAS VS PIC SECURITY (TAB HistoryMutasi)
 * ============================================================================
 *    - Memungkinkan sinkronisasi/rebuild data stok secara otomatis melalui request web app.
 * 1. SINKRONISASI 100% STRUKTUR TAB UserPIC (10 KOLOM RESMI):
 *    - Col A (1): ID User (USR-001 s/d USR-006)
 *    - Col B (2): Username (DSO LAMPUNG, D660, D661, D662, D663, D664)
 *    - Col C (3): Password (daihatsu2026)
 *    - Col D (4): Nama Lengkap (ADMIN HEAD / BRANCH MANAGER, SECURITY - D660, dst)
 *    - Col E (5): Cabang (Sentra Lampung • Astra Daihatsu DSO Lampung, D660 - Ahmad Yani, dst)
 *    - Col F (6): Jabatan (ADMIN HEAD / BRANCH MANAGER, SECURITY)
 *    - Col G (7): TARGET_EMAIL (Email penerima rekap laporan khusus per cabang)
 *    - Col H (8): URL Foto Profil
 *    - Col I (9): Status Akun (Active)
 *    - Col J (10): Terakhir Login (Timestamp login otomatis terupdate)
 * 2. MULTI-BRANCH TARGET EMAIL MANAGEMENT:
 *    - Setiap cabang memiliki hak mengelola target email cabangnya sendiri (Kolom G).
 *    - Admin Head (DSO LAMPUNG) memiliki hak akses penuh memantau & mengubah target email seluruh 5 cabang + DSO.
 *    - Endpoint baru 'updateBranchTargetEmail' untuk pembaruan instan per cabang.
 * 3. ROUTING EMAIL NOTIFIKASI MUTASI REALTIME:
 *    - Notifikasi mutasi realtime otomatis dikirim ke Target Email Cabang terkait + tembusan ke Admin DSO Lampung.
 *    - Threading otomatis per hari agar email tersusun rapi tanpa spamming.
 * 4. JAMINAN BERKAS EXCEL (.XLSX) MURNI DENGAN FOTO NYATA EMBEDDED:
 *    - Foto unit dan dokumen (SPP DC / BSTKB / OKK) disematkan secara visual di dalam sel tabel Excel.
 *    - Tepat 2 tanda tangan resmi (Security Pool & ADH/BM).
 * 5. SINKRONISASI 15 KOLOM TAB HistoryMutasi:
 *    - Kolom M (13) menampung Jenis Dokumen (SPP DC / BSTKB / OKK) sinkron dengan database.
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. KONFIGURASI GLOBAL & KEAMANAN
// ----------------------------------------------------------------------------
const DEFAULT_TARGET_EMAIL = "";
const TIMEZONE = "Asia/Jakarta";

const DEFAULT_DRIVE_FOLDER_ID = "1qQR4cxbBGB2DNi9mML9l3TZzKC6992A2";
const SPREADSHEET_ID = "1q1iPsiObbjVy1xkumnNOFG2mfHpU48glIrN7HfaZieQ";

const TAB_USERS     = "UserPIC";
const TAB_HISTORY   = "HistoryMutasi";
const TAB_INVENTORY = "Inventory";
const TAB_CONFIG    = "SystemConfig";
const TAB_REPORT_LOGS = "ReportLogs";

/**
 * Logo Resmi Daihatsu (Base64 PNG Transparent) untuk Header Berkas PDF & Excel
 */
const DAIHATSU_LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAMkAAABWCAYAAABl9rKTAAAOZ0lEQVR4AezYv6ptVxUG8O0FbQRjFH0AtbCxiMEI1voUgo2FQoKlD2EhIhG0SCP4FLFSEAxEWwvNA2gRIYSQCMb7O+ELI9O59l57rz9773On8N0x5/g/vrnGOcc8+XD8bzAwGDjKwJPD+N9gYDBwlIGxJEfpGcbBwOEwlmR8BYOBEwyMJTlB0DAPBlZakkHkYODxMjCW5PG+7ZhsJQbGkqxE5EjzeBkYS/J433ZMthIDY0lWInKkebwM3NaSPF6ex2R3zMBYkjt+vNH6PgyMJdmH51HljhkYS3LHjzda34eBsST78Dyq3DEDi5bkw/ffP3z43ns3hyU9/fedd+74OUfrWzCwaEk++MMfD//6xguPCu/+/Bdb8Dxy3jEDi5bkjucerQ8GZjMwlmQ2VcPxWWVgLMmz+vJj7tkMjCWZpmpYBgMPDIwleaBh/DMYmGZgLMk0N8MyGHhgYNUl+fS3Xzp89ievPMAZcj8l+bZ46PCG/3n3l68e3v7+DybBDueMwD85nU/F8jnmX+38pvKxBR/8+Y0ptwd9/Ej5H5TlH/pzUOs5i/3n175+CNxP1RFXWvj4SC+PHB8rzzysuiT/eUquD91CPP+73z60kjvdMfBv8eW//+1Q8fmnOaHNo8ZDsSv8Y+YpeFjwSOSc9vgln7NHPhbHJ/5TvrGTPR86tmBuPf7qV/82F585kEOufz/9ocPfmwbubHLzC+grou9Jfj39HN2qS6KgITOMj743HL/Ahp+CHGBQCHmkhVEny9QuUersIdNDpN4Oh48q6x8+uvX/7dl7un709bR5bx185ulfE5k/svLAJ/pIdnMCu7s3DfjRyc2+N1ZfEgOcsyiIEOPjnwLyKuQP/JSGLJoc8mWBEAxIBra9oB6knhly7sn6scWeeXK/tuzN0NMt6dPbtfGVx9a29X2TJdG0jziPbhEQmTt7BXuPmOpz6uxjAnVAfcsD7uLV2Hth2se1zHrpQf/0fhuSwRRvse8lw6OZcJm66Tv3S2SdMXUuybNFzGZLolkfaoa3CIbPnb2CvRJfbUvP6oJ+LE3yZWFy30rOmUt/6vsA2z8rYmO/Feiz9jL1rtXn2Lnms3S3NPOmS4IUH2YItAiGz529gn3OB1VjLjnrAfxU9zh71EyfPoCcq2w5qT1NxdT4Pc44UwdnWy+yWt6n5UX9vbH5khjoFhfFR+ix9XcLH2F6SE+R+oMPnv6XQ3IpvIXfphV0p/L6aPnUvnBIB+nf+RJYuppbDjn1ltp018AuS2Iww+angt8YBs+dvYK9PkC1LTnL6e99UEMuP63ILeEDqPnbuXHBXj+SNiY+/JYABz1ckrP2K76di+4cyAdtjNmh1e91321JDLTnouRDsBDg/39YjHx8SNePn1Z62xLtx5MeUrO1R2+GnNfq00eIhwq61JmS+GKrvu0c8eF3KeT3Xm283FM8tb5r33ddEs37MDOshzo2PHv9UMT3wAeQC1kI8R4SxKnrN4ce1KW7BdQF0FfQ9qb/VrfHXT/q4Ni5gj6oc0R3ifRe3tDC1Hh1632v8+5LYjAfaR7ch2x4oCPBxwz8PU6AOIsAiAQ5ALkgJpBTHlB3rYdM/jmy1jRHjTFr7s4VNY4PG3kt6EcPFW0v+G51l969deVL/UtzLYm7ypJo2AcbQn3gdIAUQBB9C3qLAPx7kNdSgDrIhZ7v1jq91Bpt37Gby+K3wEXizRD/6M6Vl/hbCnFtb7mzBfHNfan0/lM5Kjdb8nK1JTG4RyfBR+IDqqCfAwSBpfBfba69GLXnOqNHNWfPTl9nz5m++u99zkevj/TUSnOlL/N6i9zXkDV/zaeneu+d9UM/x5dfD1dbEoNf2rhHgLoUWYzekHvp9BT4uPRHpn47b2ytPv49mZie7Vq6c/qf6tFcQfWhm/rQLavviD8fvvh3B3dwXoKrLclcYg0NPjjIb4pbWIqWeD0FHsfD8fGQ/r+TR3UPzJXzlBQjPnY558TFf6k0hxzH3kuPfILE5D5HmlEceOPAXbz64Fzhz7Ho+eJ/bmzNc+x8lSUxVEusJj0+WAYwrKHBxwH8bgXmmEL+XrccHrLXMw4S37NHJz5+pLjY3Cuij6w2PdXY+NDFr/p4C3q6+E5JfhXVzwLENpVLD7hijy/pDs41Zz2ziSUrxEVf/c89774khkCaB7D5lgFufSGmiDVPDx4dpuLoE+d8CvElq697MFXvlF2+no989CSfgv878gtaf/cpW5uo+opxh9avd+dfMTeul6vqdl8Si+E3Azj77QC1qXEeDNwSA7svyS0NP3oZDMxhYCzJHJaGzzPNwFiSZ/r5x/BzGBhLMoel4bMRA/eRdizJfbzT6PKKDCxakk+/9K3Dl95841Hhs6+8fMXnGKVvkYFFS/LkuecOn3ruc48KT774hVt8p9HTFRlYtCRX7HuUHgzsxsBYkt2oHoU2Y2DjxGNJNiZ4pL9/BsaS3P8bjgk2ZmAsycYEj/T3z8DdLMlrr791gK0o/8s/3t40/6m+1YeXf/3mQx9mhVNxU3a5lsQfyztlW0N/rGfcmGuNOufkWG1Jtm4eeXDOcOf4/vWtj5Zk6zl6PZnrld+8eYD0QRf0Yk7pkmfteeT9zk9/f6r8RfbM2+uZTu2LEs8MmnJbvCQIAw9M2nbDThWcq0eKXGSNae/VtuS8Vd5TPeEK+L3wlecPP/zeVz4GHduS3tb+sJb0Yp45ONbzMduc3Jf4LFoSD5iiHhgMQe8Dj+1SKReIl5vcCqmj961qHMtrOX714xc/XhD3P/3su4dXf/Ti4Ztfff5Y6FHbVh/1VnkNcyz3MZvYLfBkSdJ8uKQHBg/rgX10frNcmt+HkVyX5pgbVxcjfesdqs0DgR8AVT+3Ts9Pvp4+OjzkfEsST2v2g4dwKjfuoeW6tYlbs49erkVL0ktIZ0nA2ZBkhcHokQLVNucsHuSAqRz0x+xqnbLzAfX8SQkeSm6PSM8+hVP2xMmXXk7FsMdXXHJU6QdXvYvhm7hqy5nPMXv8SLnMXyGWrWJOTrnwWuNyxrUcuUdmvj1+iKyyJAZJ85GWxCBsdcgQQu8cJK7KGhc9MgM5QI7q6+zx6GN3p0+eSCTrM3fSnzhQf5OpyVZR43wgalS7szg25x7wBGzpVYxc+qevoGOPrztUn3rmJ5cYfu5k2xMdn9jF0NVcU+fwkNj4qdHm7L0B/+RwBndvAP5Coaugg6pTD6rO2Sw9PdscnLkkn0zpA/uk5pO3PH7IJoEXGzjTgXMFgjNcrxYi41/jxdHLj2RnqD7uwAfZyeWuFrC34Gd5QFzrVz+CnH08bZ7cxaupT1L+2PTrgZPHHdj5gjMdOJ9C8teexIJYfcSHLrXZQL9kwB8PiYm/2NTQZ+zeJj7JwV5z5K4W8It0PgY1a/6c6Y/FHbMtWpKaOM1UXQbTYLUjIQh5SK0+9Vxz5iwesR4pOlIeEvjoIT5tH3xapJ+qr73I4cO1vLVW/KtO7ehrjuiq5KtfM1lA59iTMznYgvQbn8S0kp+88seWfImVUx/VJ7bEVBn/qss5cXyC1pZ7pNo5n5LJ3/M7Zuv5n9ItXhLknyoSex6lxiAw9p70UbZ6MVD1rV+1V/IvIbDGp6Z6clkWutSjz5zsbNDLQT8F+epy85ObZCOh5k3dVu9eP3z3HmrevFFqxj9695zVjZ9+3NkhOenjT99D7DW++sVOh1twDlJLL8nhHPulcvGSpPCcZuKDsMRVGTtd9TFwJYh9bYRgfw605KvlpzD4cPkCvZ71p9/0mBz0fC6FnKdiU/OY35RPehc75cM2NUf6My8/wIu8zlM5Y+fTA3vvDVpfPvmtrkf9pKae2OnbuHPvi5dEY1NFNdmzTTU+pW9zhIhWLx7oI50rPMCULX76Rn7uVZrXhwDRy+lcdXL09PzmQo6eb+0/NfhN+bP1UPO0dnNGV2tER6qX36TufoCQc9CrrWbeVm5vUP3YkxvXQXQkHQlypPeqZzsHi5ckQ9VhNOCuSWcNGjC+r73+FvWh+lAYKDHu8XeeC7X4yiW/c83Zu9PpzyOrCcnDJt7HQLpDPcdXjpz5yCNn1dFXtHlj03tqtPFm48cHnIE+Me7qky16+horZ81Tz2ZMPnpx7uaMLfnZ5GIn3Z1BLNmizipPcvJzj+QX+FMyfiQ9PxCjt6qjPweLlyTFQgAyEODXXWwadU6jfP2U4OPMFoj14eRO8jG8cwv65I9f7vKrI2eN40ev16qXC+GQXmMXI484cGZr/dz9WQbyyMmvB/XbvHKD3sXIBzmTasdHPF3ABrkfk2L1l/zikreNo9cvffydce0jlMcdnONjDrEkW6A2fXJGLxZ3gL/oq+RT7+1ZbfH6kuOUfxvf3hcvSW3A0MhAtkII1Gx8SHdDxO5sGHAWw489d9KdjWwRe/SIiU4MyJ/abHSpk7gpyR/EVB86qLpzzuofi2eD5HTODHT6AbMBuzsbyF+lM+CHDMRB7nJAcrK5x+7Ophe5Uid2kg84g3h3cSTQ9WL598A38T17q+Pf6i65L14SRQ1LBu6GQWB0VSIoBDsbBpzFkPzp3J3BWV5698BdvsTRO9OJAT7Rs9G5z0Vi5Azo5sZP+ckhHwnmg+h6cfzYzQBmA3p3UhwpF+leIZ4tOj50IAckJ1vu8WfLeUqKkw/Eu4sjgW4qdkovfsq2lX6VJTEwwiGEbDXMVnm3InhuXhyC+WBu3Cm/Y7mO2U7lfZbsqywJsoM9yRu1BgN7MLDKkuzR6KgxGLgWA2NJrsX8qHs3DIwluZunGo1ei4GxJNdiftS9GwbGkhwOd/NYo9HrMDCW5Dq8j6p3xMBYkjt6rNHqdRgYS3Id3kfVO2JgLMkdPdZo9ToMjCVZjfeR6LEyMJbksb7smGs1BsaSrEblSPRYGRhL8lhfdsy1GgNjSVajciR6rAz8DwAA//+J61XOAAAABklEQVQDAGU8ZVtz2Gc1AAAAAElFTkSuQmCC";

/**
 * Pemetaan Resmi 5 Cabang Astra Daihatsu Lampung
 */
const BRANCH_MAP = {
  "D660": "D660 - Ahmad Yani",
  "D661": "D661 - Soekarno Hatta",
  "D662": "D662 - Bandar Jaya",
  "D663": "D663 - Lampung Utara",
  "D664": "D664 - Lampung Timur"
};

/**
 * Normalisasi Cerdas Nama Cabang:
 * Mengubah string apa pun menjadi nama cabang resmi lengkap (default: D660 - Ahmad Yani)
 */
function formatBranchLabel(rawBa) {
  if (!rawBa) return "D660 - Ahmad Yani";
  const str = String(rawBa).trim();

  // 1. Jika mengandung kode D660 s/d D664
  const codeMatch = str.match(/D66[0-4]/i);
  if (codeMatch) {
    const code = codeMatch[0].toUpperCase();
    return BRANCH_MAP[code] || str;
  }

  // 2. Deteksi berdasarkan nama wilayah/jalan
  const lower = str.toLowerCase();
  if (lower.includes("ahmad yani") || lower.includes("yani")) return "D660 - Ahmad Yani";
  if (lower.includes("soekarno") || lower.includes("hatta")) return "D661 - Soekarno Hatta";
  if (lower.includes("bandar jaya") || lower.includes("jaya")) return "D662 - Bandar Jaya";
  if (lower.includes("utara") || lower.includes("kotabumi")) return "D663 - Lampung Utara";
  if (lower.includes("timur")) return "D664 - Lampung Timur";

  if (lower.includes("dso") || lower.includes("sentra")) {
    return "Sentra Lampung • Astra Daihatsu DSO Lampung";
  }

  return "D660 - Ahmad Yani";
}

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

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

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

function getTargetEmail(ss) {
  try {
    const sheet = ss.getSheetByName(TAB_CONFIG);
    if (!sheet) return "";
    const email = getSystemConfigValue(sheet, "TARGET_EMAIL");
    const normalized = normalizeRecipientEmails(email);
    return (normalized && normalized.trim() !== "") ? normalized.trim() : "";
  } catch (e) {
    return "";
  }
}

function getSystemConfigData(ss) {
  const sheet = ss.getSheetByName(TAB_CONFIG);
  const config = {
    DRIVE_FOLDER_ID: DEFAULT_DRIVE_FOLDER_ID,
    TARGET_EMAIL: "",
    AUTO_EMAIL_ENABLED: "TRUE",
    DAILY_REPORT_HOUR: "8",
    AUTO_SCHEDULE_TEXT: "Setiap Hari 08:00 WIB",
    REPORT_DOCUMENT_TYPE: "Dokumen Resmi PDF & Excel XLSX Per Cabang (TTD Security & ADH/BM)",
    TRANSIT_TIME_DEFAULT: "90",
    TRANSIT_TIME_D660: "45",
    TRANSIT_TIME_D661: "30",
    TRANSIT_TIME_D662: "90",
    TRANSIT_TIME_D663: "150",
    TRANSIT_TIME_D664: "180"
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

  config.TARGET_EMAIL = normalizeRecipientEmails(config.TARGET_EMAIL) || "";
  return config;
}

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
    "REPORT_DOCUMENT_TYPE": data.type || data.REPORT_DOCUMENT_TYPE || "Dokumen Resmi PDF & Excel XLSX Per Cabang (TTD Security & ADH/BM)",
    "DAILY_REPORT_HOUR": reportHourVal,
    "DRIVE_FOLDER_ID": data.folderId || data.DRIVE_FOLDER_ID,
    "TRANSIT_TIME_DEFAULT": (data.TRANSIT_TIME_DEFAULT !== undefined && data.TRANSIT_TIME_DEFAULT !== null) ? String(data.TRANSIT_TIME_DEFAULT) : undefined,
    "TRANSIT_TIME_D660": (data.TRANSIT_TIME_D660 !== undefined && data.TRANSIT_TIME_D660 !== null) ? String(data.TRANSIT_TIME_D660) : undefined,
    "TRANSIT_TIME_D661": (data.TRANSIT_TIME_D661 !== undefined && data.TRANSIT_TIME_D661 !== null) ? String(data.TRANSIT_TIME_D661) : undefined,
    "TRANSIT_TIME_D662": (data.TRANSIT_TIME_D662 !== undefined && data.TRANSIT_TIME_D662 !== null) ? String(data.TRANSIT_TIME_D662) : undefined,
    "TRANSIT_TIME_D663": (data.TRANSIT_TIME_D663 !== undefined && data.TRANSIT_TIME_D663 !== null) ? String(data.TRANSIT_TIME_D663) : undefined,
    "TRANSIT_TIME_D664": (data.TRANSIT_TIME_D664 !== undefined && data.TRANSIT_TIME_D664 !== null) ? String(data.TRANSIT_TIME_D664) : undefined,
    "TRANSIT_ROUTES_JSON": (data.TRANSIT_ROUTES_JSON !== undefined && data.TRANSIT_ROUTES_JSON !== null) ? String(data.TRANSIT_ROUTES_JSON) : undefined
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
        const descMap = {
          "TARGET_EMAIL": "Daftar email master penerima laporan harian",
          "AUTO_EMAIL_ENABLED": "Status aktif otomatisasi email harian (TRUE/FALSE)",
          "AUTO_SCHEDULE_TEXT": "Keterangan jadwal laporan harian",
          "DAILY_REPORT_HOUR": "Jam eksekusi laporan harian (WIB)",
          "REPORT_DOCUMENT_TYPE": "Jenis berkas lampiran laporan",
          "DRIVE_FOLDER_ID": "ID Folder Google Drive penyimpanan arsip",
          "TRANSIT_TIME_DEFAULT": "Estimasi standar durasi perjalanan unit (menit)",
          "TRANSIT_TIME_D660": "Estimasi durasi perjalanan ke D660 - Ahmad Yani (menit)",
          "TRANSIT_TIME_D661": "Estimasi durasi perjalanan ke D661 - Soekarno Hatta (menit)",
          "TRANSIT_TIME_D662": "Estimasi durasi perjalanan ke D662 - Bandar Jaya (menit)",
          "TRANSIT_TIME_D663": "Estimasi durasi perjalanan ke D663 - Lampung Utara (menit)",
          "TRANSIT_TIME_D664": "Estimasi durasi perjalanan ke D664 - Lampung Timur / Tulang Bawang (menit)",
          "TRANSIT_ROUTES_JSON": "Matriks rute point-to-point durasi perjalanan antar cabang (JSON)"
        };
        sheet.appendRow([key, mappings[key], descMap[key] || "Dikonfigurasi otomatis melalui antarmuka web"]);
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

function getSystemConfigValue(sheet, keyName) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === keyName.toUpperCase()) {
      return String(data[i][1]).trim();
    }
  }
  return "";
}

function extractHourFromSchedule(scheduleStr) {
  if (!scheduleStr) return 8;
  const match = scheduleStr.match(/(\d{1,2})[:.](\d{2})/);
  if (match) {
    const h = parseInt(match[1], 10);
    if (!isNaN(h) && h >= 0 && h <= 23) return h;
  }
  return 8;
}

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

    if (lower.includes("minggu") || lower.includes("week")) {
      ScriptApp.newTrigger("sendDailyScheduledReport")
        .timeBased()
        .onWeekDay(ScriptApp.WeekDay.MONDAY)
        .atHour(validHour)
        .inTimezone(TIMEZONE)
        .create();
    } else if (lower.includes("bulan") || lower.includes("month")) {
      ScriptApp.newTrigger("sendDailyScheduledReport")
        .timeBased()
        .onMonthDay(1)
        .atHour(validHour)
        .inTimezone(TIMEZONE)
        .create();
    } else {
      ScriptApp.newTrigger("sendDailyScheduledReport")
        .timeBased()
        .everyDays(1)
        .atHour(validHour)
        .inTimezone(TIMEZONE)
        .create();
    }
  }
}

// ----------------------------------------------------------------------------
// 2. MANAGEMENT MULTI-BRANCH TARGET EMAIL & USER (TAB UserPIC)
// ----------------------------------------------------------------------------

/**
 * Mengambil daftar target email untuk setiap cabang dari tab UserPIC (Kolom G / Index 6)
 */
function getAllBranchEmails(ss) {
  if (!ss) ss = getSpreadsheet();
  const branchEmails = {
    "DSO LAMPUNG": "",
    "D660": "",
    "D661": "",
    "D662": "",
    "D663": "",
    "D664": ""
  };

  try {
    const sheet = ss.getSheetByName(TAB_USERS);
    if (!sheet) return branchEmails;
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const username = String(row[1] || "").trim().toUpperCase();
      const branchStr = String(row[4] || "").trim();
      const email = normalizeRecipientEmails(row[6]);
      if (!email) continue;

      if (username === "DSO LAMPUNG" || username.includes("ADMIN") || branchStr.toUpperCase().includes("DSO") || branchStr.toUpperCase().includes("SENTRA")) {
        branchEmails["DSO LAMPUNG"] = email;
      }

      // Cocokkan D660 s/d D664 dari username atau cabang
      const m = (username + " " + branchStr).match(/D66[0-4]/i);
      if (m) {
        branchEmails[m[0].toUpperCase()] = email;
      }
    }
  } catch (err) {
    Logger.log("Peringatan getAllBranchEmails: " + err.toString());
  }

  return branchEmails;
}

/**
 * Tab Database Riwayat Laporan Harian (ReportLogs)
 */
function getReportLogsSheet(ss) {
  if (!ss) ss = getSpreadsheet();
  let sheet = ss.getSheetByName(TAB_REPORT_LOGS);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_REPORT_LOGS);
    sheet.appendRow([
      "ID Laporan",
      "Timestamp ISO",
      "Waktu Kirim",
      "Periode Laporan",
      "Target Email Penerima",
      "Total Unit",
      "Unit Masuk",
      "Unit Keluar",
      "Lampiran Berkas",
      "Status",
      "Keterangan",
      "Cabang Terkait"
    ]);
  }
  return sheet;
}

function recordReportEmailLog(ss, logData) {
  try {
    const sheet = getReportLogsSheet(ss);
    const row = [
      logData.id || ("REP-" + Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd-HHmmss")),
      new Date().toISOString(),
      logData.timestamp || Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy HH:mm 'WIB'"),
      logData.reportDate || Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy"),
      logData.targetEmail || "",
      logData.totalUnits !== undefined ? logData.totalUnits : 0,
      logData.masuk !== undefined ? logData.masuk : 0,
      logData.keluar !== undefined ? logData.keluar : 0,
      logData.attachedFilesCount !== undefined ? logData.attachedFilesCount : 0,
      logData.status || "SUCCESS",
      logData.message || "Laporan rekapitulasi mutasi harian kendaraan berhasil diproses dan dikirimkan.",
      logData.branch || "ALL"
    ];
    sheet.appendRow(row);
    Logger.log("[SUKSES] Berhasil mencatat log pengiriman laporan ke tab " + TAB_REPORT_LOGS + ": " + row[0]);
  } catch (err) {
    Logger.log("Peringatan saat mencatat ReportLog: " + err.toString());
  }
}

function getReportLogsData(ss, limit) {
  if (!ss) ss = getSpreadsheet();
  let sheet = ss.getSheetByName(TAB_REPORT_LOGS);
  if (!sheet) {
    sheet = getReportLogsSheet(ss);
  }

  const values = sheet.getDataRange().getValues();
  const maxRows = limit || 50;
  const logs = [];

  for (let i = values.length - 1; i >= 1 && logs.length < maxRows; i--) {
    const r = values[i];
    if (!r[0] && !r[2]) continue;
    logs.push({
      id: String(r[0] || ""),
      timestampIso: String(r[1] || ""),
      timestamp: String(r[2] || ""),
      reportDate: String(r[3] || ""),
      targetEmail: String(r[4] || ""),
      totalUnits: parseInt(r[5] || 0, 10),
      masuk: parseInt(r[6] || 0, 10),
      keluar: parseInt(r[7] || 0, 10),
      attachmentsCount: parseInt(r[8] || 0, 10),
      status: String(r[9] || "SUCCESS"),
      message: String(r[10] || ""),
      branch: String(r[11] || "ALL")
    });
  }

  return logs;
}

/**
 * Mengambil email penerima gabungan untuk cabang tertentu + Admin DSO Lampung
 */
function getRecipientsForBranch(ss, branchLocation) {
  const branchEmails = getAllBranchEmails(ss);
  const emails = [];

  // 1. Email Admin DSO Lampung selalu disertakan agar Admin memantau mutasi seluruh cabang
  if (branchEmails["DSO LAMPUNG"]) {
    emails.push(branchEmails["DSO LAMPUNG"]);
  }

  // 2. Email cabang spesifik penugasan / lokasi transaksi
  const m = String(branchLocation || "").match(/D66[0-4]/i);
  if (m) {
    const code = m[0].toUpperCase();
    if (branchEmails[code]) {
      emails.push(branchEmails[code]);
    }
  }

  // 3. Fallback jika kosong, gunakan dari SystemConfig
  if (emails.length === 0) {
    emails.push(getTargetEmail(ss));
  }

  return normalizeRecipientEmails(emails.join(", "));
}

/**
 * Memperbarui TARGET_EMAIL khusus untuk cabang tertentu di tab UserPIC (Kolom G / Index 6)
 */
function updateBranchTargetEmail(ss, branchOrUsername, emailStr) {
  if (!ss) ss = getSpreadsheet();
  const normalizedEmail = normalizeRecipientEmails(emailStr);
  const sheet = ss.getSheetByName(TAB_USERS);
  if (!sheet) return { success: false, message: "Tab UserPIC tidak ditemukan" };

  const values = sheet.getDataRange().getValues();
  const targetKey = String(branchOrUsername || "").trim().toUpperCase();
  const mTarget = targetKey.match(/D66[0-4]/i);
  const codeTarget = mTarget ? mTarget[0].toUpperCase() : null;
  const isDsoTarget = targetKey === "DSO LAMPUNG" || targetKey.includes("DSO") || targetKey.includes("SENTRA") || targetKey.includes("ADMIN");

  let updatedCount = 0;
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const uName = String(row[1] || "").trim().toUpperCase();
    const branchName = String(row[4] || "").trim().toUpperCase();

    let isMatch = false;
    if (isDsoTarget && (uName === "DSO LAMPUNG" || branchName.includes("DSO") || branchName.includes("SENTRA"))) {
      isMatch = true;
    } else if (codeTarget && (uName.includes(codeTarget) || branchName.includes(codeTarget))) {
      isMatch = true;
    } else if (uName === targetKey || branchName === targetKey) {
      isMatch = true;
    }

    if (isMatch) {
      sheet.getRange(i + 1, 7).setValue(normalizedEmail); // Kolom G (Kolom ke-7): TARGET_EMAIL
      updatedCount++;
    }
  }

  // Jika DSO LAMPUNG diperbarui, sinkronkan juga SystemConfig TARGET_EMAIL
  if (isDsoTarget) {
    try {
      updateSystemConfig(ss, { TARGET_EMAIL: normalizedEmail });
    } catch (cfgErr) {
      Logger.log("Peringatan sinkronisasi SystemConfig TARGET_EMAIL: " + cfgErr.toString());
    }
  }

  SpreadsheetApp.flush();

  return {
    success: true,
    branch: branchOrUsername,
    targetEmail: normalizedEmail,
    updatedRows: updatedCount,
    message: "Target email untuk " + branchOrUsername + " berhasil diperbarui di tab UserPIC (Kolom G)."
  };
}

function verifyUserCredentials(ss, username, password) {
  if (!ss) ss = getSpreadsheet();
  const sheet = ss.getSheetByName(TAB_USERS);
  if (!sheet) return { success: false, message: "Database UserPIC tidak ditemukan di spreadsheet." };

  const data = sheet.getDataRange().getValues();
  const searchInput = String(username || "").trim().toLowerCase();
  const inputPass = String(password || "").trim();

  if (!searchInput) {
    return { success: false, message: "Harap masukkan Username atau Kode Cabang." };
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const colId = String(row[0] || "").trim().toLowerCase();       // Col A: ID User (USR-001)
    const colUsername = String(row[1] || "").trim().toLowerCase(); // Col B: Username (DSO LAMPUNG, D660)
    const colPass = String(row[2] || "").trim() || "daihatsu2026"; // Col C: Password
    const colName = String(row[3] || "").trim();                  // Col D: Nama Lengkap
    const colBranch = String(row[4] || "").trim();                // Col E: Cabang
    const colPosition = String(row[5] || "").trim();              // Col F: Jabatan
    const colEmail = String(row[6] || "").trim();                 // Col G: TARGET_EMAIL
    const colPhoto = String(row[7] || "").trim();                 // Col H: URL Foto Profil
    const colStatus = String(row[8] || "").trim() || "Aktif";     // Col I: Status

    // Pencocokan fleksibel: bisa berdasarkan Username (Col B) atau ID User (Col A)
    const isUserMatch = (colUsername === searchInput) || 
                        (colId === searchInput) ||
                        (searchInput.length >= 4 && colBranch.toLowerCase().includes(searchInput));

    if (isUserMatch) {
      if (inputPass === colPass) {
        const loginTimestamp = Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy HH:mm:ss 'WIB'");
        try {
          sheet.getRange(i + 1, 10).setValue(loginTimestamp); // Col J: Terakhir Login
        } catch (tsErr) {
          Logger.log("Peringatan update timestamp login: " + tsErr.toString());
        }

        const isAdmin = colPosition.toUpperCase().includes("ADMIN") || 
                        colPosition.toUpperCase().includes("MANAGER") || 
                        colUsername.toUpperCase().includes("DSO");

        return {
          success: true,
          message: "Autentikasi kredensial berhasil.",
          user: {
            id: row[0] || "USR-001",
            username: row[1],
            name: colName,
            branch: colBranch,
            role: isAdmin ? "Admin" : "User",
            position: colPosition,
            targetEmail: colEmail,
            email: colEmail,
            avatar: colPhoto || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80",
            photo: colPhoto || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80",
            status: colStatus,
            lastLogin: loginTimestamp
          }
        };
      } else {
        return { success: false, message: "Kata sandi / PIN yang Anda masukkan tidak sesuai." };
      }
    }
  }

  return { success: false, message: "Akun petugas '" + username + "' tidak terdaftar di tab UserPIC database." };
}

function deleteDriveFileByUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const fileId = extractDriveFileId(url);
    if (fileId) {
      const file = DriveApp.getFileById(fileId);
      if (file) {
        file.setTrashed(true);
        Logger.log("[HAPUS] Berhasil menghapus foto profil lama dari Google Drive: " + fileId);
        return true;
      }
    }
  } catch (err) {
    Logger.log("Peringatan saat menghapus foto lama di Drive: " + err.toString());
  }
  return false;
}

function updateUserProfile(ss, data) {
  const sheet = ss.getSheetByName(TAB_USERS);
  if (!sheet) return { success: false, message: "Database User tidak ditemukan" };

  const values = sheet.getDataRange().getValues();
  const targetId = String(data.id || "").trim();
  const targetUsername = String(data.username || "").trim().toLowerCase();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowId = String(row[0] || "").trim();
    const rowUsername = String(row[1] || "").trim().toLowerCase();

    const isMatch = (targetId && rowId === targetId) ||
                    (targetUsername && rowUsername === targetUsername);

    if (isMatch) {
      if (data.name) {
        const cleanName = String(data.name).replace(/DISTRICT/gi, "BRANCH");
        sheet.getRange(i + 1, 4).setValue(cleanName); // Col D (4): Nama Lengkap
      }
      if (data.branch) sheet.getRange(i + 1, 5).setValue(data.branch); // Col E (5): Cabang
      
      const isAdm = String(row[1]).toUpperCase().includes("DSO") || String(data.role || "").toUpperCase().includes("ADMIN");
      const officialPos = isAdm ? "ADMIN HEAD / BRANCH MANAGER" : (data.position || "SECURITY");
      sheet.getRange(i + 1, 6).setValue(officialPos); // Col F (6): Jabatan

      if (data.email || data.targetEmail) {
        const norm = normalizeRecipientEmails(data.email || data.targetEmail);
        sheet.getRange(i + 1, 7).setValue(norm); // Col G (7): TARGET_EMAIL
      }
      
      const oldPhotoUrl = String(row[7] || "").trim();
      let avatarUrl = data.avatar || data.photo || "";

      // Jika ada unggahan foto baru (Base64)
      if (avatarUrl.indexOf("data:image") === 0 || avatarUrl.indexOf(";base64,") !== -1) {
        const newDriveUrl = saveBase64ImageToDrive(avatarUrl, "AVATAR_" + (data.username || row[1] || "USER"));
        if (newDriveUrl) {
          // HAPUS FOTO PROFIL LAMA DARI GOOGLE DRIVE HANYA SETELAH FOTO BARU BERHASIL TERSIMPAN DI DRIVE
          if (oldPhotoUrl && oldPhotoUrl !== newDriveUrl) {
            deleteDriveFileByUrl(oldPhotoUrl);
          }
          avatarUrl = newDriveUrl;
          sheet.getRange(i + 1, 8).setValue(avatarUrl); // Col H (8): URL Foto Profil
        }
      } else if (avatarUrl !== "" && avatarUrl !== oldPhotoUrl) {
        sheet.getRange(i + 1, 8).setValue(avatarUrl);
      }

      if (data.newPassword && data.newPassword.trim() !== "") {
        sheet.getRange(i + 1, 3).setValue(data.newPassword); // Col C (3): Password
      }

      return {
        success: true,
        message: "Profil petugas berhasil diperbarui di Google Spreadsheet (Tab UserPIC)",
        avatarUrl: avatarUrl || oldPhotoUrl,
        user: {
          id: row[0],
          username: row[1],
          name: data.name ? String(data.name).replace(/DISTRICT/gi, "BRANCH") : row[3],
          branch: data.branch || row[4],
          position: officialPos,
          photo: avatarUrl || oldPhotoUrl,
          avatar: avatarUrl || oldPhotoUrl
        }
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
    const r = rows[i];
    if (!r[0] && !r[1]) continue;
    const isAdmin = String(r[5]).toUpperCase().includes("ADMIN") || String(r[1]).toUpperCase().includes("DSO");
    users.push({
      id: r[0],
      username: r[1],
      name: r[3],
      branch: r[4],
      role: isAdmin ? "Admin" : "User",
      position: r[5],
      targetEmail: r[6],
      email: r[6],
      photo: r[7],
      avatar: r[7],
      status: r[8],
      lastLogin: r[9]
    });
  }
  return users;
}

// ----------------------------------------------------------------------------
// 3. API ROUTING (doGet & doPost)
// ----------------------------------------------------------------------------
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
        version: "2.18",
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
      const config = getSystemConfigData(ss);
      config.branchEmails = getAllBranchEmails(ss);
      return createJsonResponse(config);
    }

    if (action === "getUsers") {
      return createJsonResponse(getUsersData(ss));
    }

    if (action === "login") {
      const u = (e && e.parameter && (e.parameter.username || e.parameter.id || e.parameter.user)) || "";
      const p = (e && e.parameter && (e.parameter.password || e.parameter.pin || e.parameter.pass)) || "";
      return createJsonResponse(verifyUserCredentials(ss, u, p));
    }

    if (action === "reconcileInventory" || action === "syncInventory") {
      return createJsonResponse(reconcileInventoryStock(ss));
    }

    if (action === "getInventory") {
      return createJsonResponse(getInventoryData(ss));
    }

    if (action === "getHistory") {
      return createJsonResponse(getHistoryData(ss));
    }

    if (action === "getReportLogs") {
      return createJsonResponse(getReportLogsData(ss));
    }

    const inventory = getInventoryData(ss);
    const history = getHistoryData(ss);
    const users = getUsersData(ss);
    const config = getSystemConfigData(ss);
    const branchEmails = getAllBranchEmails(ss);
    const reportLogs = getReportLogsData(ss);
    const kpis = calculateKpis(inventory, history);

    return createJsonResponse({
      inventory: inventory,
      history: history,
      users: users,
      config: config,
      branchEmails: branchEmails,
      reportLogs: reportLogs,
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

    if (action === "login") {
      return createJsonResponse(verifyUserCredentials(ss, data.username, data.password));
    }

    if (action === "updateProfile") {
      return createJsonResponse(updateUserProfile(ss, data));
    }

    if (action === "updateBranchTargetEmail") {
      const branchKey = data.branch || data.username || data.branchKey;
      const emailStr = data.email || data.TARGET_EMAIL || (Array.isArray(data.emails) ? data.emails.join(", ") : "");
      return createJsonResponse(updateBranchTargetEmail(ss, branchKey, emailStr));
    }

    if (action === "updateConfig") {
      const updatedConfig = updateSystemConfig(ss, data);
      return createJsonResponse({ success: true, config: updatedConfig });
    }

    if (action === "sendReportEmail" || action === "triggerReportEmail" || action === "triggerManualReport") {
      const emailResult = triggerReportEmail(ss, data);
      emailResult.reportLogs = getReportLogsData(ss);
      return createJsonResponse(emailResult);
    }

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

      // Prioritaskan cabang resmi (D660 - Ahmad Yani dst)
      const rawBranchInput = data.noBa || data.no_ba || data.cabang || data.branch || data.location || "D660 - Ahmad Yani";
      const branchName = formatBranchLabel(rawBranchInput);
      const targetVin = String(data.vin || data.chassis || "").trim().toUpperCase();
      const targetEngine = String(data.engine || "").trim().toUpperCase();
      const targetType = String(data.type || "Unit Masuk").trim();
      const normalizedTargetType = targetType.toLowerCase().includes("masuk") ? "Unit Masuk" : "Unit Keluar";

      // Cek Idempotensi & Validasi Status Transaksi Terakhir (Last-State Multi-Branch Cycle Validation)
      const lastRow = sheetHistory.getLastRow();
      if (lastRow > 1) {
        const historyValues = sheetHistory.getDataRange().getValues();
        const headerRow = historyValues[0].map(h => String(h || "").toLowerCase().trim());
        
        const colIdxVin = headerRow.findIndex(h => h.includes("rangka") || h.includes("vin"));
        const colIdxEngine = headerRow.findIndex(h => h.includes("mesin") || h.includes("engine"));
        const colIdxType = headerRow.findIndex(h => h.includes("jenis") || h.includes("type"));
        const colIdxBranch = headerRow.findIndex(h => h.includes("cabang") || h.includes("ba") || h.includes("lokasi"));
        const colIdxTrxId = headerRow.findIndex(h => h.includes("id mutasi") || h.includes("id"));

        let lastMutation = null;
        for (let r = historyValues.length - 1; r >= 1; r--) {
          const rowTrxId = String(historyValues[r][colIdxTrxId !== -1 ? colIdxTrxId : 0] || "").trim();
          const rowVin = String(historyValues[r][colIdxVin !== -1 ? colIdxVin : 5] || "").trim().toUpperCase();
          const rowEngine = String(historyValues[r][colIdxEngine !== -1 ? colIdxEngine : 6] || "").trim().toUpperCase();
          const rowRawType = String(historyValues[r][colIdxType !== -1 ? colIdxType : 7] || "").trim();
          const rowType = rowRawType.toLowerCase().includes("masuk") ? "Unit Masuk" : "Unit Keluar";
          const rowBranch = formatBranchLabel(String(historyValues[r][colIdxBranch !== -1 ? colIdxBranch : 9] || ""));

          // 1. Cek Exact Duplicate Idempotency (ID Transaksi sama persis)
          if (rowTrxId && rowTrxId === trxId) {
            Logger.log("Idempotent hit: " + trxId);
            return createJsonResponse({
              success: true,
              transactionId: rowTrxId,
              isDuplicatePrevented: true,
              message: "Data mutasi telah tersimpan sebelumnya (idempotent)",
              timestamp: now.toISOString()
            });
          }

          // Cek apakah baris ini adalah unit yang sama (VIN atau No Mesin cocok)
          const isSameUnit = (targetVin && targetVin !== "-" && rowVin === targetVin) ||
                             (targetEngine && targetEngine !== "-" && rowEngine === targetEngine);

          if (isSameUnit && !lastMutation) {
            lastMutation = {
              trxId: rowTrxId,
              type: rowType,
              branch: rowBranch,
              rawType: rowRawType
            };
            break;
          }
        }

        // Terapkan Aturan Siklus Antar-Cabang Berdasarkan Last State:
        // Unit hanya ditolak jika status terakhirnya sama dengan aksi baru di cabang yang sama
        if (lastMutation) {
          if (lastMutation.branch === branchName && lastMutation.type === normalizedTargetType) {
            const statusMsg = normalizedTargetType === "Unit Masuk" ? "SUDAH MASUK" : "SUDAH KELUAR";
            Logger.log("Blokir mutasi duplikat: " + targetVin + " " + statusMsg + " di " + branchName);
            return createJsonResponse({
              success: false,
              isDuplicatePrevented: true,
              error: "Unit (" + targetVin + ") tercatat " + statusMsg + " di cabang " + branchName + ". Silakan lakukan aksi " + (normalizedTargetType === "Unit Masuk" ? "Unit Keluar" : "Unit Masuk") + " terlebih dahulu.",
              lastState: lastMutation,
              timestamp: now.toISOString()
            }, 400);
          }
        }
      }
      
      let unitPhotoUrl = data.unitPhoto || "";
      if (unitPhotoUrl.startsWith("data:image")) {
        unitPhotoUrl = saveBase64ImageToDrive(unitPhotoUrl, "UNIT_" + trxId);
      }
      let docPhotoUrl = data.docPhoto || "";
      if (docPhotoUrl.startsWith("data:image")) {
        docPhotoUrl = saveBase64ImageToDrive(docPhotoUrl, "DOC_" + trxId);
      }

      const docType = (data.docType || data.doc_type || data.doctype || "SPP DC").toUpperCase().trim();
      const carColor = String(data.color || data.warna || data.carColor || data.warnaMobil || "-").trim();
      const officerName = String(data.officerName || data.namaPetugas || data.officer || "").trim();
      let picSecurity = String(data.pic || "").trim();
      // Sanitasi PIC Security: Pastikan mencatat identitas pos/cabang security (misal: "D660 - Ahmad Yani" / "D661 - Soekarno Hatta")
      // dan TIDAK menduplikasi nama personal petugas lapangan (misal: "Rico")
      if (!picSecurity || (officerName && picSecurity.toLowerCase() === officerName.toLowerCase()) || picSecurity.toLowerCase() === "petugas lapangan") {
        picSecurity = branchName || (data.noBa ? formatBranchLabel(data.noBa) : "Petugas Security");
      }
      const fullOfficerPic = officerName ? (officerName + " (" + picSecurity + ")") : picSecurity;
      const rawDestBranch = data.destinationBranch || data.destination || data.cabangTujuan || "";
      const destinationBranch = rawDestBranch ? formatBranchLabel(rawDestBranch) : "-";

      // Deteksi dinamis header sheet HistoryMutasi untuk kompatibilitas mutlak
      let historyHeaders = [];
      if (sheetHistory.getLastRow() >= 1 && sheetHistory.getLastColumn() >= 1) {
        historyHeaders = sheetHistory.getRange(1, 1, 1, sheetHistory.getLastColumn()).getValues()[0].map(h => String(h || "").toLowerCase().trim());
      }
      const hasColorCol = historyHeaders.some(h => h.includes("warna"));
      const hasOfficerCol = historyHeaders.some(h => h.includes("nama petugas") || h.includes("petugas lapangan"));
      const hasNpkColumn = historyHeaders.some(h => h.includes("npk"));

      let rowData = [];
      if (hasColorCol || hasOfficerCol) {
        // Struktur 17 Kolom Modern PRO V2.25 (Termasuk Cabang Tujuan OKK)
        rowData = [
          trxId,
          isoStr,
          formattedDateStr,
          timeStr,
          data.model || "Unknown Model",
          carColor,
          data.vin || data.chassis || "-",
          data.engine || "-",
          data.type || "Unit Masuk",
          officerName || "Petugas Lapangan", // Kolom J: Nama Petugas Lapangan (e.g. "Rico")
          picSecurity,                        // Kolom K: PIC Security (e.g. "D660 - Ahmad Yani" / "D661 - Soekarno Hatta")
          branchName,                         // Kolom L: Cabang / Kode BA
          data.notes || "-",
          docType,
          unitPhotoUrl,
          docPhotoUrl,
          destinationBranch
        ];
      } else {
        // Format 14 Kolom Kompatibel (Simpan nama petugas pada kolom PIC)
        rowData = [
          trxId,
          isoStr,
          formattedDateStr,
          timeStr,
          data.model || "Unknown Model",
          data.vin || data.chassis || "-",
          data.engine || "-",
          data.type || "Unit Masuk",
          fullOfficerPic
        ];
        if (hasNpkColumn) {
          rowData.push("-");
        }
        rowData.push(
          branchName,
          data.notes || "-",
          docType,
          unitPhotoUrl,
          docPhotoUrl,
          destinationBranch
        );
      }

      sheetHistory.appendRow(rowData);

      const newStock = updateInventoryStock(ss, data.model, data.type);

      // Kirim Notifikasi Realtime Threading: Otomatis ke Cabang Terkait + Tembusan Admin DSO Lampung
      let mailResult = null;
      try {
        mailResult = sendRealtimeMutationThreadNotification(ss, {
          id: trxId,
          type: data.type || "Unit Masuk",
          model: data.model || "Unknown Model",
          color: carColor,
          vin: data.vin || data.chassis || "-",
          engine: data.engine || "-",
          officerName: officerName,
          pic: data.pic || "Petugas Security",
          location: branchName,
          destination: destinationBranch,
          destinationBranch: destinationBranch,
          notes: data.notes || "-",
          docType: docType,
          time: timeStr,
          date: formattedDateStr,
          unitPhotoUrl: unitPhotoUrl,
          docPhotoUrl: docPhotoUrl,
          newStock: newStock
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
        docType: docType,
        destinationBranch: destinationBranch,
        mailStatus: mailResult,
        timestamp: now.toISOString()
      });
    }

    return createJsonResponse({ error: "Action tidak dikenali: " + action }, 400);

  } catch (err) {
    return createJsonResponse({ error: err.toString() }, 500);
  }
}

// ----------------------------------------------------------------------------
// 4. DATA ACCESS (TAB Inventory & HistoryMutasi)
// ----------------------------------------------------------------------------
function getInventoryData(ss) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return [];

  const sheet = ss.getSheetByName(TAB_INVENTORY);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const headers = rows[0].map(h => String(h || "").toLowerCase().trim());
  let idxIn = headers.findIndex(h => h.includes("masuk") || h.includes("in"));
  let idxOut = headers.findIndex(h => h.includes("keluar") || h.includes("out"));
  let idxPhoto = headers.findIndex(h => h.includes("foto") || h.includes("url") || h.includes("photo") || h.includes("gambar"));
  if (idxIn === -1) idxIn = 3;   // Kolom D (Total Masuk)
  if (idxOut === -1) idxOut = 4;  // Kolom E (Total Keluar)
  if (idxPhoto === -1) idxPhoto = 5; // Kolom F (URL Foto)

  const inventory = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1]) continue;
    const totalIn = parseInt(r[idxIn], 10) || 0;
    const totalOut = parseInt(r[idxOut], 10) || 0;
    const stockYard = Math.max(0, totalIn - totalOut);
    const photoUrl = r[idxPhoto] ? String(r[idxPhoto]).trim() : (r[5] ? String(r[5]).trim() : "");

    inventory.push({
      catalogId: r[0] || ("INV-" + (i < 10 ? "00" : (i < 100 ? "0" : "")) + i),
      id: r[0] || ("INV-" + (i < 10 ? "00" : (i < 100 ? "0" : "")) + i),
      name: String(r[1]).trim(),
      model: String(r[1]).trim(),
      category: r[2] || "Passenger Car",
      spec: r[2] || "-",
      totalIn: totalIn,
      totalOut: totalOut,
      stockYard: stockYard,
      inYard: stockYard,
      totalStock: stockYard,
      status: stockYard > 0 ? "Tersedia" : "Kosong",
      defaultLocation: "Yard",
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
  const idxVin      = colIndex(["rangka", "vin", "chassis"], 6);
  const idxEngine   = colIndex(["mesin", "engine"], 7);
  const idxType     = colIndex(["jenis", "type"], 8);
  const idxColor    = colIndex(["warna", "color"], 5);
  const idxOfficerName = colIndex(["nama petugas", "petugas lapangan", "nama_petugas", "officer"], 9);
  const idxPic      = colIndex(["pic security", "pic_security", "pic", "security"], 10);
  const idxLocation = colIndex(["cabang / kode ba", "cabang", "kode ba", "ba", "lokasi", "branch", "pool"], 11);
  const idxNotes    = colIndex(["catatan lapangan", "catatan", "notes", "kondisi"], 12);
  const idxDocType  = colIndex(["spp dc", "bstkb", "okk", "jenis dokumen", "tipe dokumen", "doctype"], 13);
  const idxUnitImg  = colIndex(["foto unit", "foto fisik", "unitphoto"], 14);
  const idxDocImg   = colIndex(["foto dokumen", "foto doc", "foto berkas", "docphoto"], 15);
  const idxDestination = colIndex(["cabang tujuan", "tujuan", "destination"], 16);

  const history = [];
  for (let i = rows.length - 1; i >= 1; i--) {
    const r = rows[i];
    if (!r[idxId] && !r[idxVin]) continue;

    const valIso = r[idxIso];
    const valDate = r[idxDate];
    const valId = r[idxId];
    // Prioritaskan valDate (Tanggal lokal operasional di Kolom C) atau valIso (terkonversi zona waktu Asia/Jakarta)
    const ymd = normalizeDateToYmd(valDate) || normalizeDateToYmd(valIso) || normalizeDateToYmd(valId);

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

    const rawBranch = r[idxLocation] || "D660 - Ahmad Yani";
    const branchLabel = formatBranchLabel(rawBranch);

    let docTypeVal = "SPP DC";
    if (idxDocType !== -1 && r[idxDocType] !== undefined && r[idxDocType] !== null) {
      const raw = String(r[idxDocType]).toUpperCase().trim();
      if (raw.includes("BSTKB")) docTypeVal = "BSTKB";
      else if (raw.includes("OKK")) docTypeVal = "OKK";
      else if (raw.includes("SPP")) docTypeVal = "SPP DC";
      else if (raw && !raw.startsWith("HTTP")) docTypeVal = raw;
    }

    const rawPic = String(r[idxPic] || "Petugas Security").trim();
    let officerVal = idxOfficerName !== -1 && r[idxOfficerName] ? String(r[idxOfficerName]).trim() : "";
    if (!officerVal && rawPic.includes(" — ")) {
      officerVal = rawPic.split(" — ")[0].trim();
    } else if (!officerVal && rawPic.includes(" (")) {
      officerVal = rawPic.split(" (")[0].trim();
    }
    const colorVal = idxColor !== -1 && r[idxColor] ? String(r[idxColor]).trim() : "";

    const destinationVal = (idxDestination !== -1 && r[idxDestination]) ? formatBranchLabel(r[idxDestination]) : "-";

    history.push({
      id: r[idxId] || "MUT-TRX",
      timestamp: valIso || "",
      date: dateDisplay,
      fullDateStr: dateDisplay,
      time: timeDisplay,
      model: r[idxModel] || "Unit Daihatsu",
      color: colorVal,
      warna: colorVal,
      vin: r[idxVin] || "-",
      engine: r[idxEngine] || "-",
      type: r[idxType] || "Unit Masuk",
      officerName: officerVal || "Petugas Lapangan",
      namaPetugas: officerVal || "Petugas Lapangan",
      pic: rawPic,
      picSecurity: rawPic,
      branch: branchLabel,
      location: branchLabel,
      noBa: branchLabel,
      destinationBranch: destinationVal,
      destination: destinationVal,
      cabangTujuan: destinationVal,
      notes: r[idxNotes] || "-",
      docType: docTypeVal,
      unitPhoto: r[idxUnitImg] || "",
      docPhoto: r[idxDocImg] || "",
      unitPhotoUrl: r[idxUnitImg] || "",
      docPhotoUrl: r[idxDocImg] || "",
      ymd: ymd
    });
  }
  return history;
}

function updateInventoryStock(ss, modelName, mutationType) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return 0;

  const sheet = ss.getSheetByName(TAB_INVENTORY);
  if (!sheet) return 0;
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return 0;

  const headers = rows[0].map(h => String(h || "").toLowerCase().trim());
  let idxIn = headers.findIndex(h => h.includes("masuk") || h.includes("in"));
  let idxOut = headers.findIndex(h => h.includes("keluar") || h.includes("out"));
  if (idxIn === -1) idxIn = 3;   // Kolom D (Total Masuk)
  if (idxOut === -1) idxOut = 4;  // Kolom E (Total Keluar)

  const cleanModel = String(modelName || "").toLowerCase().trim();

  function normalizeModelKey(m) {
    const s = String(m || "").toLowerCase().trim();
    if (s.includes("special edition") || s === "terios se" || s.includes("da3se")) return "terios special edition";
    if (s === "new sirion" || s.includes("sirion")) return "sirion";
    if (s.includes("minibus") || s.includes("mini bus") || s.includes("blind van") || s.includes("blindvan")) return "gran max minibus";
    if (s.includes("pick up") || s.includes("pickup") || s.includes("pu")) return "gran max pick up";
    if (s.includes("prod old") || s.includes("prod_old") || s.includes("old model")) return "new sigra (prod old)";
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
      let totalIn = parseInt(rows[i][idxIn], 10) || 0;
      let totalOut = parseInt(rows[i][idxOut], 10) || 0;

      if (mutationType === "Unit Masuk") {
        totalIn += 1;
        sheet.getRange(i + 1, idxIn + 1).setValue(totalIn);
      } else if (mutationType === "Unit Keluar") {
        totalOut += 1;
        sheet.getRange(i + 1, idxOut + 1).setValue(totalOut);
      }

      SpreadsheetApp.flush();
      return Math.max(0, totalIn - totalOut);
    }
  }

  if (mutationType === "Unit Masuk") {
    const newId = "INV-" + ("00" + rows.length).slice(-3);
    sheet.appendRow([newId, modelName, "Model Tambahan", 1, 0, "Ditambahkan otomatis"]);
    SpreadsheetApp.flush();
    return 1;
  }
  return 0;
}

// ----------------------------------------------------------------------------
// 4b. SINKRONISASI / REBUILD STOK INVENTORY BERDASARKAN RIWAYAT MUTASI
// ----------------------------------------------------------------------------
function reconcileInventoryStock(ss) {
  if (!ss) ss = getSpreadsheet();
  if (!ss) return { success: false, error: "Spreadsheet tidak ditemukan" };

  const sheetHist = ss.getSheetByName(TAB_HISTORY);
  const sheetInv = ss.getSheetByName(TAB_INVENTORY);
  if (!sheetHist || !sheetInv) {
    return { success: false, error: "Tab History atau Inventory tidak ditemukan" };
  }

  const histRows = sheetHist.getDataRange().getValues();
  const invRows = sheetInv.getDataRange().getValues();
  if (invRows.length <= 1) {
    return { success: false, error: "Tab Inventory kosong" };
  }

  // Header detection for Inventory
  const invHeaders = invRows[0].map(h => String(h || "").toLowerCase().trim());
  let idxIn = invHeaders.findIndex(h => h.includes("masuk") || h.includes("in"));
  let idxOut = invHeaders.findIndex(h => h.includes("keluar") || h.includes("out"));
  if (idxIn === -1) idxIn = 3;
  if (idxOut === -1) idxOut = 4;

  // Header detection for History
  const histHeaders = histRows.length > 0 ? histRows[0].map(h => String(h || "").toLowerCase().trim()) : [];
  let histModelIdx = histHeaders.findIndex(h => h.includes("model") || h.includes("unit"));
  let histTypeIdx = histHeaders.findIndex(h => h.includes("tipe") || h.includes("jenis") || h.includes("mutasi") || h.includes("type"));
  if (histModelIdx === -1) histModelIdx = 4;
  if (histTypeIdx === -1) histTypeIdx = 7;

  function normalizeModelKey(m) {
    const s = String(m || "").toLowerCase().trim();
    if (s.includes("special edition") || s === "terios se" || s.includes("da3se")) return "terios special edition";
    if (s === "new sirion" || s.includes("sirion")) return "sirion";
    if (s.includes("minibus") || s.includes("mini bus") || s.includes("blind van") || s.includes("blindvan")) return "gran max minibus";
    if (s.includes("pick up") || s.includes("pickup") || s.includes("pu")) return "gran max pick up";
    if (s.includes("prod old") || s.includes("prod_old") || s.includes("old model")) return "new sigra (prod old)";
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

  // Hitung jumlah mutasi masuk & keluar aktual per model dari HistoryMutasi
  const counts = {};
  for (let i = 1; i < histRows.length; i++) {
    const r = histRows[i];
    const m = String(r[histModelIdx] || "").trim();
    if (!m) continue;
    const key = normalizeModelKey(m);
    if (!counts[key]) counts[key] = { masuk: 0, keluar: 0 };
    const t = String(r[histTypeIdx] || "").trim();
    if (t.toLowerCase().includes("masuk")) {
      counts[key].masuk++;
    } else if (t.toLowerCase().includes("keluar")) {
      counts[key].keluar++;
    }
  }

  // Update seluruh baris di tab Inventory
  const updatedModels = [];
  for (let j = 1; j < invRows.length; j++) {
    const rowModel = String(invRows[j][1] || "").trim();
    if (!rowModel) continue;
    const rowKey = normalizeModelKey(rowModel);
    const modelStats = counts[rowKey] || { masuk: 0, keluar: 0 };

    sheetInv.getRange(j + 1, idxIn + 1).setValue(modelStats.masuk);
    sheetInv.getRange(j + 1, idxOut + 1).setValue(modelStats.keluar);
    updatedModels.push({
      model: rowModel,
      totalMasuk: modelStats.masuk,
      totalKeluar: modelStats.keluar,
      stokTersedia: Math.max(0, modelStats.masuk - modelStats.keluar)
    });
  }

  SpreadsheetApp.flush();
  return {
    success: true,
    message: "Stok Inventory berhasil disinkronisasi ulang dengan tab HistoryMutasi",
    updatedCount: updatedModels.length,
    models: updatedModels
  };
}

// ----------------------------------------------------------------------------
// 4c. TRIGGER MENU GOOGLE SHEETS
// ----------------------------------------------------------------------------
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("🚗 Daihatsu Stockyard")
      .addItem("🔄 Sinkronisasi / Rebuild Stok Inventory", "menuReconcileInventory")
      .addItem("⏱️ Inisialisasi Parameter Durasi & SystemConfig", "menuInitSystemConfig")
      .addToUi();
  } catch (e) {
    // Dipanggil saat di luar konteks Spreadsheet UI (misal execution via API Web App)
  }
}

function menuInitSystemConfig() {
  const ss = getSpreadsheet();
  if (!ss) return;
  const ui = SpreadsheetApp.getUi();
  const defData = {
    TRANSIT_TIME_DEFAULT: "90",
    TRANSIT_TIME_D660: "45",
    TRANSIT_TIME_D661: "30",
    TRANSIT_TIME_D662: "90",
    TRANSIT_TIME_D663: "150",
    TRANSIT_TIME_D664: "180"
  };
  updateSystemConfig(ss, defData);
  ui.alert("Berhasil", "✅ Parameter estimasi durasi perjalanan per cabang berhasil diinisialisasi pada tab SystemConfig.", ui.ButtonSet.OK);
}

function menuReconcileInventory() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    "Konfirmasi Sinkronisasi Stok",
    "Apakah Anda ingin merekap ulang kolom Total Masuk & Total Keluar pada tab Inventory berdasarkan data aktual di tab HistoryMutasi?",
    ui.ButtonSet.YES_NO
  );
  if (response === ui.Button.YES) {
    const res = reconcileInventoryStock();
    if (res.success) {
      ui.alert("Berhasil", "✅ " + res.message + " (" + res.updatedCount + " model diperbarui).", ui.ButtonSet.OK);
    } else {
      ui.alert("Gagal", "❌ Gagal: " + res.error, ui.ButtonSet.OK);
    }
  }
}

function calculateKpis(inventory, history) {
  let totalStock = 0;
  let stokKosong = 0;
  inventory.forEach(item => {
    const st = (item.stockYard || item.stock || 0);
    totalStock += st;
    if (st === 0) stokKosong++;
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
    masuk: todayIn,
    keluar: todayOut,
    totalStok: totalStock,
    stokKosong: stokKosong,
    totalStock: totalStock,
    todayIn: todayIn,
    todayOut: todayOut,
    totalTransactions: history.length
  };
}

// ----------------------------------------------------------------------------
// 5. EMAIL REALTIME MUTASI (THREADING & PER CABANG + ADMIN)
// ----------------------------------------------------------------------------
function sendRealtimeMutationThreadNotification(ss, item) {
  if (!ss) ss = getSpreadsheet();

  if (!item || typeof item !== "object") {
    item = getLatestMutationOrDummy(ss);
  }

  const config = getSystemConfigData(ss);
  // Email gabungan: Cabang lokasi transaksi + Admin DSO Lampung (+ Cabang Tujuan jika mutasi OKK)
  let targetEmail = getRecipientsForBranch(ss, item.location || item.branch || item.noBa);
  if (item.docType === "OKK" && item.destination && item.destination !== "-" && item.destination !== (item.location || item.branch)) {
    const destEmail = getRecipientsForBranch(ss, item.destination);
    if (destEmail) {
      targetEmail = normalizeRecipientEmails(targetEmail + ", " + destEmail);
    }
  }
  if (!targetEmail) {
    Logger.log("[PERINGATAN] Peringatan: TARGET_EMAIL belum dikonfigurasi.");
    return { success: false, error: "TARGET_EMAIL tidak valid" };
  }

  const isAutoEnabled = String(config.AUTO_EMAIL_ENABLED || "TRUE").toUpperCase() === "TRUE";
  if (!isAutoEnabled) {
    Logger.log("[INFO] Info: AUTO_EMAIL_ENABLED bernilai FALSE di tab SystemConfig.");
    return { success: false, error: "AUTO_EMAIL_ENABLED nonaktif" };
  }

  const now = new Date();
  const dateStr = item.date || Utilities.formatDate(now, TIMEZONE, "dd/MM/yyyy");
  const timeStr = item.time || Utilities.formatDate(now, TIMEZONE, "HH:mm 'WIB'");
  const todayFormatted = Utilities.formatDate(now, TIMEZONE, "dd MMMM yyyy");

  const threadSubject = "[STOCKYARD REALTIME] Aktivitas Mutasi Unit - " + todayFormatted;

  const isMasuk = item.type === "Unit Masuk";
  const badgeColor = isMasuk ? "#047857" : "#1d4ed8";
  const badgeBg = isMasuk ? "#ecfdf5" : "#eff6ff";
  const badgeBorder = isMasuk ? "#a7f3d0" : "#bfdbfe";
  const typeText = isMasuk ? "↓ UNIT MASUK (PENERIMAAN)" : "↑ UNIT KELUAR (PENGIRIMAN)";
  const actionLead = isMasuk ? "MENAMBAHKAN" : "MENGELUARKAN";

  const officerName = item.officerName || item.namaPetugas || "";
  const picRole = item.pic || "Security";
  const officerDisplay = officerName ? (officerName + " (" + picRole + ")") : picRole;
  const carColorDisplay = item.color || item.warna || "-";

  const plainTextSummary = (isMasuk ? "[MASUK] UNIT MASUK" : "[KELUAR] UNIT KELUAR") + 
    ": " + (item.model || "Unit") + (carColorDisplay !== "-" ? " (" + carColorDisplay + ")" : "") + 
    " [" + (item.vin || "-") + "] - Petugas: " + officerDisplay + 
    " (" + timeStr + ", " + dateStr + ")";

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

  const mediaSectionHtml = (unitThumb || docThumb) ? `
    <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
      <div style="font-size: 11px; font-weight: bold; color: #1e293b; margin-bottom: 8px;">DOKUMENTASI FOTO LAPANGAN (SIDE-BY-SIDE):</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout: fixed; width: 100%;">
        <tr>
          <td width="50%" align="center" valign="top" style="padding-right: 6px;">
            ${unitThumb ? `
              <a href="${unitPhotoSrc}" target="_blank" style="text-decoration: none; display: block;">
                <div style="width: 100%; max-width: 145px; height: 100px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; background: #f1f5f9; margin: 0 auto;">
                  <img src="${unitThumb}" alt="Foto Unit" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
                </div>
                <div style="font-size: 10px; color: #00205B; font-weight: bold; margin-top: 4px; text-align: center;">[Foto Fisik Unit]</div>
              </a>
            ` : '<div style="height: 100px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; line-height: 100px; font-size: 10px; color: #94a3b8;">Tidak Ada Foto</div>'}
          </td>
          <td width="50%" align="center" valign="top" style="padding-left: 6px;">
            ${docThumb ? `
              <a href="${docPhotoSrc}" target="_blank" style="text-decoration: none; display: block;">
                <div style="width: 100%; max-width: 145px; height: 100px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; background: #f1f5f9; margin: 0 auto;">
                  <img src="${docThumb}" alt="Foto Dokumen" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
                </div>
                <div style="font-size: 10px; color: #00205B; font-weight: bold; margin-top: 4px; text-align: center;">[Foto Dokumen (${item.docType || "SPPDC"})]</div>
              </a>
            ` : '<div style="height: 100px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; line-height: 100px; font-size: 10px; color: #94a3b8;">Tidak Ada Dokumen</div>'}
          </td>
        </tr>
      </table>
    </div>
  ` : '';

  const messageHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 620px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 16px; background: #ffffff;">
      <div style="background: ${badgeBg}; border-bottom: 1px solid ${badgeBorder}; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 800; font-size: 12px; color: ${badgeColor}; letter-spacing: 0.5px;">
          ${typeText}
        </span>
        <span style="font-size: 11px; font-weight: 600; color: #64748b;">
          ${timeStr} &bull; ${dateStr}
        </span>
      </div>

      <div style="padding: 14px;">
        <div style="font-size: 13.5px; line-height: 1.4; color: #1e293b; margin-bottom: 10px;">
          Petugas Security <strong>${item.pic || "Petugas Security"}</strong> baru saja <strong>${actionLead}</strong> unit <strong>${item.model || "Unit Daihatsu"}</strong> di area <em>${item.location || item.branch || "Sentra Lampung DSO"}</em>.
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
            <td style="padding: 6px 10px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Cabang Asal / BA</td>
            <td style="padding: 6px 10px; font-weight: bold; color: #b45309; border-bottom: 1px solid #e2e8f0;">${item.location || "-"}</td>
          </tr>
          ${(item.docType === "OKK" && item.destination && item.destination !== "-") ? `
          <tr>
            <td style="padding: 6px 10px; color: #b45309; font-weight: bold; border-bottom: 1px solid #e2e8f0; background: #fffbeb;">Cabang Tujuan (OKK)</td>
            <td style="padding: 6px 10px; font-weight: bold; color: #b45309; border-bottom: 1px solid #e2e8f0; background: #fffbeb;">${item.destination} [Transfer Antar-Cabang]</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 6px 10px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Jenis Dokumen</td>
            <td style="padding: 6px 10px; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${item.docType || "SPP DC"}</td>
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

        ${mediaSectionHtml}

        <div style="margin-top: 12px; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px;">
          Dokumen Log Otomatis &bull; Sistem Management StockYard &bull; PT Astra Daihatsu Motor (Sentra Lampung)
        </div>
      </div>
    </div>
  `;

  let threadFound = false;
  try {
    const existingThreads = GmailApp.search('subject:"' + threadSubject + '"', 0, 1);
    if (existingThreads && existingThreads.length > 0) {
      existingThreads[0].replyAll(plainTextSummary, {
        htmlBody: messageHtml,
        name: "Stockyard Management Astra Daihatsu"
      });
      Logger.log("[SUKSES] Berhasil membalas ke thread email yang sama: " + threadSubject);
      threadFound = true;
      return { success: true, mode: "reply", subject: threadSubject };
    }
  } catch (replyErr) {
    Logger.log("Peringatan reply thread Gmail: " + replyErr.toString());
  }

  if (!threadFound) {
    const initialThreadHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 620px;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-bottom: 14px;">
          <h3 style="margin: 0; color: #0f172a; font-size: 15px;">ASTRA DAIHATSU DSO LAMPUNG &bull; DSO SENTRA LAMPUNG</h3>
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
      Logger.log("[SUKSES] Thread email baru hari ini berhasil dibuat via GmailApp: " + threadSubject);
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
        Logger.log("[SUKSES] Thread email berhasil dikirim via MailApp fallback: " + threadSubject);
        return { success: true, mode: "mailApp", subject: threadSubject };
      } catch (mailAppErr) {
        Logger.log("[GAGAL] Gagal mengirim email via MailApp: " + mailAppErr.toString());
        return { success: false, error: mailAppErr.toString() };
      }
    }
  }

  return { success: true };
}

function sendDailyScheduledReport() {
  const ss = getSpreadsheet();
  const config = getSystemConfigData(ss);
  const isEnabled = String(config.AUTO_EMAIL_ENABLED || "TRUE").toUpperCase() === "TRUE";

  if (!isEnabled) {
    Logger.log("[INFO] Otomatisasi email harian dinonaktifkan di SystemConfig.");
    return;
  }

  // Laporan otomatis harian jam 08:00 WIB SELALU merekap operasional kemarin (H-1) secara ketat!
  const now = new Date();
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  const yesterdayYmd = Utilities.formatDate(yesterday, TIMEZONE, "yyyy-MM-dd");

  Logger.log("[START] Menjalankan sendDailyScheduledReport untuk periode kemarin: " + yesterdayYmd);
  const res = triggerReportEmail(ss, {
    targetDate: yesterdayYmd,
    isScheduled: true
  });
  Logger.log("Eksekusi laporan harian terjadwal (H-1: " + yesterdayYmd + ") selesai: " + JSON.stringify(res));
}

// ----------------------------------------------------------------------------
// 6. LAPORAN REKAPITULASI RESMI (PDF & EXCEL .XLSX PER CABANG)
// ----------------------------------------------------------------------------
function triggerReportEmail(ss, data) {
  if (!ss) ss = getSpreadsheet();
  
  // Ambil pemetaan target email cabang & admin dari tab UserPIC (Kolom G)
  const branchEmailsMap = getAllBranchEmails(ss);
  const adminTargetEmail = branchEmailsMap["DSO LAMPUNG"] || getTargetEmail(ss) || DEFAULT_TARGET_EMAIL;

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

  // Default target date: SELALU H-1 (Kemarin) kecuali secara eksplisit ditentukan dalam data.targetDate
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

  let targetRecords = allHistory.filter(item => item.ymd === targetYmd);
  Logger.log("[LIHAT] Rekapitulasi mutasi tanggal " + reportPeriodStr + " (" + targetYmd + "): ditemukan " + targetRecords.length + " transaksi dari total " + allHistory.length + " riwayat.");

  // JAMINAN INTEGRITAS AUDIT:
  // Jika targetRecords.length === 0, biarkan targetRecords kosong (0 unit) sehingga sistem
  // menerbitkan laporan resmi berstatus NIHIL MUTASI untuk periode tanggal yang diminta (H-1).
  // DILARANG KERAS mengalihkan/membajak rekapitulasi ke hari ini (todayRecords),
  // karena operasional hari ini belum selesai dan akan menyebabkan ketidaksinkronan data!

  const grandTotalCount = targetRecords.length;
  const grandMasukCount = targetRecords.filter(r => (r.type || r[7]) === "Unit Masuk").length;
  const grandKeluarCount = targetRecords.filter(r => (r.type || r[7]) === "Unit Keluar").length;

  // KELOMPOKKAN TRANSAKSI PER CABANG RESMI
  const branchGroups = {};
  targetRecords.forEach(item => {
    const bName = formatBranchLabel(item.branch || item.noBa || item.location || "D660 - Ahmad Yani");
    if (!branchGroups[bName]) {
      branchGroups[bName] = [];
    }
    branchGroups[bName].push(item);
  });

  const branchKeys = Object.keys(branchGroups);
  const masterAttachments = [];
  const branchSummaryList = [];
  const branchAttachmentsMap = {}; // Simpan file terpisah per cabang

  if (branchKeys.length > 0) {
    branchKeys.forEach(bName => {
      const bRecords = branchGroups[bName];
      const bTotal = bRecords.length;
      const bMasuk = bRecords.filter(r => (r.type || "") === "Unit Masuk").length;
      const bKeluar = bRecords.filter(r => (r.type || "") === "Unit Keluar").length;

      branchSummaryList.push({
        name: bName,
        total: bTotal,
        masuk: bMasuk,
        keluar: bKeluar
      });

      branchAttachmentsMap[bName] = [];

      // LAMPIRAN PDF & EXCEL HANYA DIBUAT JIKA ADA UNIT MASUK / KELUAR (bTotal > 0)
      if (bTotal > 0) {
        // 1. Lampiran PDF Resmi Khusus Cabang Ini
        try {
          const pdfHtml = buildPdfHtml(bRecords, bName, reportPeriodStr, nowPrintStr, bTotal, bMasuk, bKeluar);
          const cleanBName = bName.replace(/[^a-zA-Z0-9]/g, "_");
          const pdfBlob = HtmlService.createHtmlOutput(pdfHtml)
                                     .getAs("application/pdf")
                                     .setName("Laporan_Mutasi_" + cleanBName + "_" + reportPeriodStr.replace(/[^a-zA-Z0-9]/g, "-") + ".pdf");
          masterAttachments.push(pdfBlob);
          branchAttachmentsMap[bName].push(pdfBlob);
        } catch (pdfErr) {
          Logger.log("Peringatan pembuatan PDF cabang " + bName + ": " + pdfErr.toString());
        }

        // 2. Lampiran Excel (.xlsx) Murni Khusus Cabang Ini
        try {
          const excelBlob = buildExcelAttachment(bRecords, bName, reportPeriodStr, bTotal, bMasuk, bKeluar, nowPrintStr);
          if (excelBlob) {
            masterAttachments.push(excelBlob);
            branchAttachmentsMap[bName].push(excelBlob);
          }
        } catch (exErr) {
          Logger.log("Peringatan pembuatan Excel cabang " + bName + ": " + exErr.toString());
        }
      } else {
        Logger.log("[INFO] Cabang " + bName + " nihil mutasi. Lampiran berkas tidak dibuat.");
      }
    });
  } else {
    // KONDISI NIHIL MUTASI: Tidak ada unit masuk maupun keluar di seluruh cabang
    // Cukup isi email saja, TIDAK PERLU lampiran (masterAttachments tetap kosong [])
    const defaultBranch = "D660 - Ahmad Yani";
    branchSummaryList.push({ name: defaultBranch, total: 0, masuk: 0, keluar: 0 });
    branchAttachmentsMap[defaultBranch] = [];
    Logger.log("[INFO] Laporan harian periode " + reportPeriodStr + " nihil mutasi. Email akan dikirim tanpa berkas lampiran.");
  }

  // =========================================================================
  // BAGIAN 1: PENGIRIMAN EMAIL REKAP MASTER GABUNGAN KE ADMIN DSO LAMPUNG
  // (Admin Head / Branch Manager Menerima Laporan Seluruh Cabang 100%)
  // =========================================================================
  const explicitTarget = (data && (data.email || data.emails)) ? normalizeRecipientEmails(data.email || data.emails) : null;
  const adminRecipients = explicitTarget || adminTargetEmail;

  const isMasterZero = (grandTotalCount === 0);
  const masterSubject = isMasterZero
    ? "Laporan Harian Stockyard Daihatsu Lampung - " + reportPeriodStr + " (Nihil Mutasi)"
    : "Laporan Rekapitulasi Mutasi Stockyard Daihatsu Lampung - " + reportPeriodStr + " (" + (branchKeys.length || 1) + " Cabang)";

  const masterEmailHtml = buildExecutiveEmailHtml(reportPeriodStr, nowPrintStr, grandTotalCount, grandMasukCount, grandKeluarCount, branchSummaryList);
  
  const masterEmailText = isMasterZero
    ? "Yth. Tim Manajemen Logistik & Admin Head Daihatsu,\n\n" +
      "Berikut konfirmasi operasional harian fisik kendaraan (Management StockYard) gabungan seluruh cabang pada tanggal " + reportPeriodStr + ":\n\n" +
      "STATUS: NIHIL MUTASI (0 UNIT)\n" +
      "Pada tanggal " + reportPeriodStr + ", tidak tercatat adanya aktivitas pergerakan unit masuk (inbound) maupun unit keluar (outbound) di seluruh pool/yard cabang resmi.\n\n" +
      "Sesuai ketentuan operasional, email ini diterbitkan sebagai laporan pemantauan rutin harian tanpa lampiran berkas.\n\n" +
      "Salam hormat,\n" +
      "Management StockYard\n" +
      "Astra Daihatsu DSO Lampung"
    : "Yth. Tim Manajemen Logistik & Admin Head Daihatsu,\n\n" +
      "Berikut rekapitulasi operasional fisik kendaraan (Management StockYard) gabungan seluruh cabang pada tanggal " + reportPeriodStr + ":\n\n" +
      "RINGKASAN OPERASIONAL GABUNGAN:\n" +
      "- Total Unit Diperiksa : " + grandTotalCount + " Unit\n" +
      "- Unit Masuk (Inbound) : " + grandMasukCount + " Unit\n" +
      "- Unit Keluar (Outbound): " + grandKeluarCount + " Unit\n\n" +
      "RINCIAN PER CABANG:\n" +
      branchSummaryList.map(b => "- " + b.name + ": " + b.total + " Unit (Masuk: " + b.masuk + ", Keluar: " + b.keluar + ")").join("\n") + "\n\n" +
      "Seluruh berkas resmi PDF dan Excel (.xlsx) per cabang telah dilampirkan pada email ini.\n\n" +
      "Salam hormat,\n" +
      "Management StockYard\n" +
      "Astra Daihatsu DSO Lampung";

  let adminSendSuccess = false;
  let adminSendError = "";

  if (adminRecipients && adminRecipients.trim() !== "") {
    const adminEmailOpts = {
      name: "Management StockYard - Astra Daihatsu",
      htmlBody: masterEmailHtml
    };
    if (masterAttachments && masterAttachments.length > 0) {
      adminEmailOpts.attachments = masterAttachments;
    }

    try {
      GmailApp.sendEmail(adminRecipients, masterSubject, masterEmailText, adminEmailOpts);
      adminSendSuccess = true;
      Logger.log("[SUKSES] Berhasil kirim email master ke Admin DSO: " + adminRecipients + (masterAttachments.length > 0 ? " (dengan lampiran)" : " (tanpa lampiran - nihil mutasi)"));
    } catch (gmailErr) {
      try {
        MailApp.sendEmail({
          to: adminRecipients,
          subject: masterSubject,
          body: masterEmailText,
          htmlBody: masterEmailHtml,
          name: "Management StockYard - Astra Daihatsu",
          attachments: (masterAttachments && masterAttachments.length > 0) ? masterAttachments : []
        });
        adminSendSuccess = true;
        Logger.log("[SUKSES] Berhasil kirim email master ke Admin DSO (MailApp): " + adminRecipients);
      } catch (mailErr) {
        adminSendError = mailErr.toString();
        Logger.log("[GAGAL] Gagal kirim email master ke Admin DSO: " + adminSendError);
      }
    }
  }

  // =========================================================================
  // BAGIAN 2: PENGIRIMAN EMAIL TERISOLASI KHUSUS PER-CABANG (USER SCANNER)
  // (Penerima Cabang HANYA menerima data & lampiran PDF/Excel cabangnya sendiri)
  // =========================================================================
  const branchDispatchResults = [];

  // Daftar email admin (agar tidak menerima email cabang satuan berulang kali)
  const adminEmailList = (adminRecipients || "")
    .toLowerCase()
    .split(/[,;\s]+/)
    .map(e => e.trim())
    .filter(e => e.length > 0);

  const allOfficialBranchCodes = ["D660", "D661", "D662", "D663", "D664"];
  allOfficialBranchCodes.forEach(bCode => {
    const rawBranchTarget = branchEmailsMap[bCode];
    if (!rawBranchTarget || rawBranchTarget.trim() === "") return;

    // Ambil seluruh email yang terdaftar di baris cabang ini
    const allBranchList = rawBranchTarget
      .split(/[,;\s]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0 && e.includes("@"));

    // KECUALIKAN EMAIL ADMIN:
    // Email admin sudah menerima 1 email master gabungan yang berisi lampiran semua cabang.
    // Maka untuk email cabang satuan, hanya kirimkan ke email khusus cabang (email ke-2 dst) saja!
    const pureBranchRecipients = allBranchList.filter(e => !adminEmailList.includes(e.toLowerCase()));

    // Jika tidak ada email khusus cabang selain admin, tidak perlu kirim email duplikat
    if (pureBranchRecipients.length === 0) {
      Logger.log("[INFO] Cabang " + bCode + " tidak memiliki email khusus selain admin, lewati email pecahan.");
      return;
    }

    const branchEmailsOnly = Array.from(new Set(pureBranchRecipients)).join(", ");

    // Cari data cabang yang sesuai
    const matchedBranchName = Object.keys(branchAttachmentsMap).find(k => k.includes(bCode)) || (BRANCH_MAP[bCode] || bCode);
    const bSummary = branchSummaryList.find(b => b.name.includes(bCode)) || { name: matchedBranchName, total: 0, masuk: 0, keluar: 0 };
    const isBranchZero = (bSummary.total === 0);
    const branchFiles = isBranchZero ? [] : (branchAttachmentsMap[matchedBranchName] || []);

    const branchSubject = isBranchZero
      ? "Laporan Harian Mutasi Cabang " + bCode + " (" + matchedBranchName + ") - " + reportPeriodStr + " (Nihil Mutasi)"
      : "Laporan Rekapitulasi Mutasi Cabang " + bCode + " (" + matchedBranchName + ") - " + reportPeriodStr;

    const branchEmailHtml = buildBranchSpecificEmailHtml(matchedBranchName, reportPeriodStr, nowPrintStr, bSummary.total, bSummary.masuk, bSummary.keluar);
    
    const branchEmailText = isBranchZero
      ? "Yth. Petugas Security Yard & Pimpinan Cabang " + matchedBranchName + ",\n\n" +
        "Berikut konfirmasi operasional pergerakan fisik unit kendaraan pada tanggal " + reportPeriodStr + ":\n\n" +
        "- Cabang Resmi : " + matchedBranchName + "\n" +
        "- Status       : NIHIL MUTASI (0 Unit Masuk & 0 Unit Keluar)\n\n" +
        "Email ini diterbitkan sebagai konfirmasi pemantauan harian rutin tanpa lampiran berkas.\n\n" +
        "Salam hormat,\n" +
        "Management StockYard\n" +
        "Astra Daihatsu DSO Lampung"
      : "Yth. Petugas Security Yard & Pimpinan Cabang " + matchedBranchName + ",\n\n" + 
        "Berikut rekapitulasi mutasi fisik kendaraan khusus untuk cabang Anda pada tanggal " + reportPeriodStr + ":\n\n" + 
        "- Cabang Resmi : " + matchedBranchName + "\n" + 
        "- Total Unit   : " + bSummary.total + " Unit\n" + 
        "- Unit Masuk   : " + bSummary.masuk + " Unit\n" + 
        "- Unit Keluar  : " + bSummary.keluar + " Unit\n\n" + 
        "Berkas resmi PDF dan Excel (.xlsx) khusus cabang Anda telah dilampirkan pada email ini.\n\n" + 
        "Salam hormat,\n" + 
        "Management StockYard\n" + 
        "Astra Daihatsu DSO Lampung";

    const branchEmailOpts = {
      name: "Management StockYard - " + bCode,
      htmlBody: branchEmailHtml
    };
    if (branchFiles && branchFiles.length > 0) {
      branchEmailOpts.attachments = branchFiles;
    }

    try {
      GmailApp.sendEmail(branchEmailsOnly, branchSubject, branchEmailText, branchEmailOpts);
      branchDispatchResults.push({ branch: bCode, recipients: branchEmailsOnly, success: true });
      Logger.log("[SUKSES] Berhasil kirim email cabang ke " + bCode + " (" + branchEmailsOnly + ")" + (branchFiles.length > 0 ? " (dengan lampiran)" : " (tanpa lampiran - nihil mutasi)"));
    } catch (bErr) {
      try {
        MailApp.sendEmail({
          to: branchEmailsOnly,
          subject: branchSubject,
          body: branchEmailText,
          htmlBody: branchEmailHtml,
          name: "Management StockYard - " + bCode,
          attachments: (branchFiles && branchFiles.length > 0) ? branchFiles : []
        });
        branchDispatchResults.push({ branch: bCode, recipients: branchEmailsOnly, success: true });
      } catch (bMailErr) {
        branchDispatchResults.push({ branch: bCode, recipients: branchEmailsOnly, success: false, error: bMailErr.toString() });
        Logger.log("[GAGAL] Gagal kirim email cabang " + bCode + ": " + bMailErr.toString());
      }
    }
  });

  const isAnySuccess = adminSendSuccess || branchDispatchResults.some(b => b.success);
  const allRecipientsCombined = [adminRecipients].concat(branchDispatchResults.map(b => b.recipients)).filter(Boolean).join(", ");

  // Catat riwayat pengiriman laporan harian ke spreadsheet tab ReportLogs
  recordReportEmailLog(ss, {
    id: "REP-" + Utilities.formatDate(now, TIMEZONE, "yyyyMMdd-HHmmss"),
    timestamp: nowPrintStr,
    reportDate: reportPeriodStr,
    targetEmail: allRecipientsCombined || adminRecipients,
    totalUnits: grandTotalCount,
    masuk: grandMasukCount,
    keluar: grandKeluarCount,
    attachedFilesCount: masterAttachments.length,
    status: isAnySuccess ? "SUCCESS" : "FAILED",
    message: isAnySuccess 
      ? ("Laporan rekapitulasi mutasi tanggal " + reportPeriodStr + " berhasil dikirimkan ke email resmi Admin DSO & 5 Cabang (" + masterAttachments.length + " berkas PDF & Excel).")
      : "Gagal mengirimkan laporan email rekapitulasi.",
    branch: "ALL"
  });

  return {
    success: adminSendSuccess || branchDispatchResults.some(b => b.success),
    message: "Laporan rekapitulasi mutasi tanggal " + reportPeriodStr + " berhasil diproses. Admin DSO menerima rekap 5 cabang (" + masterAttachments.length + " file), dan masing-masing cabang menerima berkas eksklusif cabangnya sendiri.",
    adminRecipients: adminRecipients,
    branchDispatches: branchDispatchResults,
    reportDate: reportPeriodStr,
    timestamp: nowPrintStr,
    totalRecords: grandTotalCount,
    attachedFilesCount: masterAttachments.length,
    branchesCount: branchKeys.length
  };
}

// ----------------------------------------------------------------------------
// 7. BUILD EXCEL ATTACHMENT DENGAN FOTO NYATA EMBEDDED
// ----------------------------------------------------------------------------
function fetchImageBlob(photoUrl) {
  if (!photoUrl || typeof photoUrl !== "string") return null;
  const str = photoUrl.trim();
  if (str === "" || str === "-") return null;

  const driveId = extractDriveFileId(str);
  if (driveId) {
    try {
      const file = DriveApp.getFileById(driveId);
      if (file) {
        return file.getBlob();
      }
    } catch (eDrive) {
      Logger.log("DriveApp getBlob warning for ID " + driveId + ": " + eDrive.toString());
    }

    try {
      const thumbUrl = "https://drive.google.com/thumbnail?id=" + driveId + "&sz=w400";
      const res = UrlFetchApp.fetch(thumbUrl, {
        headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200 && res.getBlob().getBytes().length > 100) {
        return res.getBlob();
      }
    } catch (eThumb) {}
  }

  if (str.startsWith("data:image")) {
    try {
      const parts = str.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const decoded = Utilities.base64Decode(parts[1]);
      return Utilities.newBlob(decoded, mime, "photo.jpg");
    } catch (eB64) {}
  }

  if (str.startsWith("http://") || str.startsWith("https://")) {
    try {
      const resWeb = UrlFetchApp.fetch(str, { muteHttpExceptions: true });
      if (resWeb.getResponseCode() === 200 && resWeb.getBlob().getBytes().length > 100) {
        return resWeb.getBlob();
      }
    } catch (eWeb) {}
  }

  return null;
}

function buildExcelAttachment(records, branchName, reportPeriodStr, totalCount, masukCount, keluarCount, customPrintTimeStr) {
  const ss = getSpreadsheet();
  if (!ss) {
    Logger.log("[PERINGATAN] Spreadsheet utama tidak ditemukan untuk export Excel.");
    return null;
  }

  const cleanDate = reportPeriodStr.replace(/[^a-zA-Z0-9]/g, "_");
  const cleanBranch = branchName.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = "Laporan_Mutasi_" + cleanBranch + "_" + cleanDate + ".xlsx";

  const bCode = (branchName.split(" - ")[0] || "CAB").replace(/[^a-zA-Z0-9]/g, "");
  const tempSheetName = "TMP_" + bCode + "_" + Utilities.getUuid().substring(0, 5);
  const sheet = ss.insertSheet(tempSheetName);
  const sheetId = sheet.getSheetId();

  try {
    const headers = [
      "No", "ID Mutasi", "Waktu", "Tanggal", "Model Kendaraan", 
      "Cabang", "No. Rangka (VIN)", "No. Mesin", "Jenis Mutasi", 
      "Petugas Security", "Catatan", "Foto Fisik Unit", "Foto Dokumen"
    ];

    sheet.setColumnWidth(1, 40);   // No
    sheet.setColumnWidth(2, 135);  // ID Mutasi
    sheet.setColumnWidth(3, 75);   // Waktu
    sheet.setColumnWidth(4, 90);   // Tanggal
    sheet.setColumnWidth(5, 140);  // Model Kendaraan
    sheet.setColumnWidth(6, 130);  // Cabang
    sheet.setColumnWidth(7, 145);  // No. Rangka (VIN)
    sheet.setColumnWidth(8, 105);  // No. Mesin
    sheet.setColumnWidth(9, 85);   // Jenis Mutasi
    sheet.setColumnWidth(10, 115); // Petugas Security
    sheet.setColumnWidth(11, 135); // Catatan
    sheet.setColumnWidth(12, 110); // Foto Fisik Unit
    sheet.setColumnWidth(13, 110); // Foto Dokumen

    let currentRow = 1;
    const printTimeStr = customPrintTimeStr || (Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy HH:mm") + " WIB");

    // 1. Sisipkan Logo Resmi Daihatsu di Sel A1:B2 (Col 1-2, Row 1-2)
    try {
      const logoBytes = Utilities.base64Decode(DAIHATSU_LOGO_BASE64);
      const logoBlob = Utilities.newBlob(logoBytes, "image/png", "daihatsu_logo.png");
      const logoImg = sheet.insertImage(logoBlob, 1, currentRow, 8, 3);
      logoImg.setWidth(115);
      logoImg.setHeight(40);
    } catch (eLogo) {
      Logger.log("Peringatan insertImage logo Excel: " + eLogo.toString());
    }

    sheet.getRange(currentRow, 1, 2, 2).merge(); // Tempat logo di Col 1-2 (No & ID Mutasi = 40+135 = 175px lebar)

    // Row 1: KOP RESMI PERUSAHAAN (Kiri: PT Astra International Tbk - DSO Lampung, Kanan: Form ID & Klasifikasi)
    sheet.getRange(currentRow, 3, 1, 6).merge()
         .setValue("PT ASTRA INTERNATIONAL Tbk — DAIHATSU SALES OPERATION")
         .setFontWeight("bold").setFontSize(11.5).setFontColor("#00205B").setVerticalAlignment("middle");
    sheet.getRange(currentRow, 9, 1, 5).merge()
         .setValue("KODE FORM: ADM-YARD-BA-01")
         .setFontWeight("bold").setFontSize(8.5).setFontColor("#475569").setHorizontalAlignment("right").setVerticalAlignment("middle");
    sheet.setRowHeight(currentRow, 23);
    currentRow++;

    // Row 2: Sub-Kop Sentra Wilayah
    sheet.getRange(currentRow, 3, 1, 6).merge()
         .setValue("Sentra Distribusi & Manajemen Stockyard Area Lampung")
         .setFontWeight("bold").setFontSize(8.5).setFontColor("#64748b").setVerticalAlignment("top");
    sheet.getRange(currentRow, 9, 1, 5).merge()
         .setValue("Astra Daihatsu DSO Lampung")
         .setFontSize(8).setFontColor("#94a3b8").setHorizontalAlignment("right").setVerticalAlignment("top");
    sheet.setRowHeight(currentRow, 18);
    currentRow++;

    // Row 3: GARIS AKSEN KORPORAT ASTRA (Merah 54% & Navy 46%)
    sheet.getRange(currentRow, 1, 1, 7).merge().setBackground("#ED1B24");
    sheet.getRange(currentRow, 8, 1, 6).merge().setBackground("#00205B");
    sheet.setRowHeight(currentRow, 3.5);
    currentRow++;

    // Row 4: SPASI MINIMALIS
    sheet.setRowHeight(currentRow, 6);
    currentRow++;

    // Row 5: JUDUL DOKUMEN RESMI (REPORT REKAPITULASI MUTASI)
    sheet.getRange(currentRow, 1, 1, headers.length).merge()
         .setValue("REPORT REKAPITULASI MUTASI HARIAN KENDARAAN (STOCKYARD)")
         .setFontWeight("bold").setFontSize(11.5).setFontColor("#0f172a").setHorizontalAlignment("center").setVerticalAlignment("middle");
    sheet.setRowHeight(currentRow, 22);
    currentRow++;

    // Row 6: METADATA PANEL ELEGAN (Background Slate #F8FAFC, Border Rapi #CBD5E1, 4 Parameter Jelas)
    sheet.getRange(currentRow, 1, 1, 4).merge()
         .setValue("CABANG: " + branchName.toUpperCase())
         .setFontWeight("bold").setFontSize(8.5).setFontColor("#00205B").setHorizontalAlignment("left").setVerticalAlignment("middle");
    sheet.getRange(currentRow, 5, 1, 3).merge()
         .setValue("PERIODE: " + reportPeriodStr)
         .setFontWeight("bold").setFontSize(8.5).setFontColor("#0f172a").setHorizontalAlignment("center").setVerticalAlignment("middle");
    sheet.getRange(currentRow, 8, 1, 3).merge()
         .setValue("CETAK: " + printTimeStr)
         .setFontSize(8).setFontColor("#475569").setHorizontalAlignment("center").setVerticalAlignment("middle");
    sheet.getRange(currentRow, 11, 1, 3).merge()
         .setValue("STATUS: TERVERIFIKASI")
         .setFontWeight("bold").setFontSize(8).setFontColor("#15803d").setHorizontalAlignment("center").setVerticalAlignment("middle");
    
    sheet.getRange(currentRow, 1, 1, headers.length)
         .setBackground("#f8fafc")
         .setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeight(currentRow, 22);
    currentRow++;

    // Row 7: SPASI SEBELUM TABEL
    sheet.setRowHeight(currentRow, 6);
    currentRow++;

    // Row 8: HEADER TABEL
    const headerRowIdx = currentRow;
    sheet.getRange(headerRowIdx, 1, 1, headers.length).setValues([headers])
         .setBackground("#00205B")
         .setFontColor("#ffffff")
         .setFontWeight("bold")
         .setFontSize(9.5)
         .setHorizontalAlignment("center")
         .setVerticalAlignment("middle")
         .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.setRowHeight(headerRowIdx, 28);
    currentRow++;

    // Row 5+: ISI DATA TABEL MUTASI DENGAN FOTO NYATA EMBEDDED
    (records || []).forEach((r, idx) => {
      const rowIdx = currentRow;
      sheet.setRowHeight(rowIdx, 65);

      const unitPhotoUrl = r.unitPhotoUrl || r.unitPhoto || "";
      const docPhotoUrl = r.docPhotoUrl || r.docPhoto || "";

      const unitId = extractDriveFileId(unitPhotoUrl);
      const docId = extractDriveFileId(docPhotoUrl);

      const unitBlob = fetchImageBlob(unitPhotoUrl);
      const docBlob = fetchImageBlob(docPhotoUrl);

      const docLabel = (r.docType || "SPP DC").toUpperCase();
      const unitHyperlink = unitId 
        ? `=HYPERLINK("https://drive.google.com/file/d/${unitId}/view", "Foto Fisik Unit")`
        : (unitPhotoUrl ? "Foto Fisik Unit" : "-");
      const docHyperlink = docId 
        ? `=HYPERLINK("https://drive.google.com/file/d/${docId}/view", "${docLabel}")`
        : (docPhotoUrl ? docLabel : "-");

      const officerName = String(r.officerName || r.namaPetugas || "").trim();
      const bCode = (String(r.branch || branchName || "").match(/D66[0-4]/i)?.[0] || branchName.split(" - ")[0] || "CABANG").toUpperCase();
      let officerText = "";
      if (officerName) {
        officerText = officerName.toUpperCase() + "\nSecurity — " + bCode;
      } else {
        const cleanPic = String(r.pic || "Petugas Security").replace(/DISTRICT/gi, "BRANCH").trim();
        if (cleanPic.toUpperCase().includes("ADMIN")) {
          officerText = "ADMIN HEAD\nBranch Manager";
        } else if (cleanPic.includes(" — ")) {
          officerText = cleanPic.replace(" — ", "\nSecurity — ");
        } else if (cleanPic.includes(" - ")) {
          officerText = cleanPic.replace(" - ", "\nSecurity — ");
        } else {
          officerText = cleanPic.toUpperCase() + "\nSecurity — " + bCode;
        }
      }

      const carColor = String(r.color || r.warna || "").trim();
      const modelWithColor = (carColor && carColor !== "-") ? (r.model + " (" + carColor + ")") : (r.model || "-");

      const rowValues = [
        idx + 1,
        r.id || "-",
        r.time || "08:00",
        r.date || reportPeriodStr,
        modelWithColor,
        branchName,
        r.vin || "-",
        r.engine || "-",
        r.type || "Unit Masuk",
        officerText,
        r.notes || "-",
        unitHyperlink,
        docHyperlink
      ];

      const dataRange = sheet.getRange(rowIdx, 1, 1, headers.length);
      dataRange.setValues([rowValues])
               .setBackground(idx % 2 === 0 ? "#ffffff" : "#f8fafc")
               .setFontColor("#0f172a")
               .setFontWeight("normal")
               .setVerticalAlignment("middle")
               .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);

      sheet.getRange(rowIdx, 1).setHorizontalAlignment("center").setFontWeight("bold");
      sheet.getRange(rowIdx, 2).setFontFamily("Courier New").setFontColor("#0284c7").setFontWeight("bold");
      sheet.getRange(rowIdx, 3).setHorizontalAlignment("center").setFontFamily("Courier New");
      sheet.getRange(rowIdx, 4).setHorizontalAlignment("center");
      sheet.getRange(rowIdx, 5).setFontWeight("bold");
      sheet.getRange(rowIdx, 6).setFontColor("#92400e").setFontWeight("bold");
      sheet.getRange(rowIdx, 7).setFontFamily("Courier New").setFontWeight("bold");
      sheet.getRange(rowIdx, 8).setFontFamily("Courier New");
      sheet.getRange(rowIdx, 9).setHorizontalAlignment("center").setFontWeight("bold")
           .setFontColor(r.type === "Unit Masuk" ? "#15803d" : "#1d4ed8");
      sheet.getRange(rowIdx, 5).setWrap(true);
      sheet.getRange(rowIdx, 10).setFontSize(8.5).setWrap(true);
      sheet.getRange(rowIdx, 11).setFontSize(8.5).setFontColor("#475569");
      sheet.getRange(rowIdx, 12).setHorizontalAlignment("center").setVerticalAlignment("bottom").setFontSize(8).setFontWeight("bold").setFontColor("#475569");
      sheet.getRange(rowIdx, 13).setHorizontalAlignment("center").setVerticalAlignment("bottom").setFontSize(8).setFontWeight("bold").setFontColor("#00205B");

      if (unitBlob) {
        try {
          const imgUnit = sheet.insertImage(unitBlob, 12, rowIdx, 5, 4);
          imgUnit.setWidth(98);
          imgUnit.setHeight(46);
        } catch (eU) {
          Logger.log("Peringatan insertImage unit: " + eU.toString());
        }
      }

      if (docBlob) {
        try {
          const imgDoc = sheet.insertImage(docBlob, 13, rowIdx, 5, 4);
          imgDoc.setWidth(98);
          imgDoc.setHeight(46);
        } catch (eD) {
          Logger.log("Peringatan insertImage doc: " + eD.toString());
        }
      }

      currentRow++;
    });

    // BARIS JUMLAH / TOTAL DI EXCEL (IDENTIK DENGAN PDF)
    const totalRowIdx = currentRow;
    sheet.getRange(totalRowIdx, 1, 1, 8).merge()
         .setValue("TOTAL REKAPITULASI MUTASI KENDARAAN:")
         .setFontWeight("bold").setHorizontalAlignment("right").setBackground("#e2e8f0").setVerticalAlignment("middle");
    sheet.getRange(totalRowIdx, 9).setValue(totalCount + " Unit")
         .setFontWeight("bold").setHorizontalAlignment("center").setBackground("#cbd5e1").setFontColor("#00205B").setVerticalAlignment("middle");
    sheet.getRange(totalRowIdx, 10, 1, 4).merge()
         .setValue("MASUK: " + masukCount + " Unit  |  KELUAR: " + keluarCount + " Unit")
         .setFontWeight("bold").setHorizontalAlignment("center").setBackground("#e2e8f0").setFontColor("#15803d").setVerticalAlignment("middle");
    sheet.setRowHeight(totalRowIdx, 28);
    sheet.getRange(totalRowIdx, 1, 1, headers.length).setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    currentRow++;

    currentRow += 3;

    // BLOK 2 TANDA TANGAN (TTD)
    const ttdStartRow = currentRow;
    if (sheet.getMaxRows() < ttdStartRow + 15) {
      sheet.insertRowsAfter(sheet.getMaxRows(), 15);
    }

    // TTD 1: SECURITY (KIRI)
    sheet.getRange(ttdStartRow, 2, 1, 4).merge()
         .setValue("Petugas Pemeriksa & Pemindai:")
         .setFontWeight("bold").setFontSize(9).setFontColor("#475569").setHorizontalAlignment("center");
    sheet.getRange(ttdStartRow + 1, 2, 1, 4).merge()
         .setValue("SECURITY")
         .setFontWeight("bold").setFontSize(10.5).setFontColor("#00205B").setHorizontalAlignment("center");
    sheet.getRange(ttdStartRow + 2, 2, 1, 4).merge()
         .setValue(branchName)
         .setFontWeight("bold").setFontSize(8.5).setFontColor("#b45309").setHorizontalAlignment("center");

    for (let r = ttdStartRow + 3; r <= ttdStartRow + 6; r++) {
      sheet.setRowHeight(r, 16);
    }

    sheet.getRange(ttdStartRow + 7, 2, 1, 4).merge()
         .setValue("( Petugas Security )")
         .setFontWeight("bold").setFontSize(9.5).setHorizontalAlignment("center");
    sheet.getRange(ttdStartRow + 7, 2, 1, 4).setBorder(true, false, false, false, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);

    // TTD 2: ADH / BM (KANAN)
    sheet.getRange(ttdStartRow, 8, 1, 5).merge()
         .setValue("Mengetahui & Menyetujui:")
         .setFontWeight("bold").setFontSize(9).setFontColor("#475569").setHorizontalAlignment("center");
    sheet.getRange(ttdStartRow + 1, 8, 1, 5).merge()
         .setValue("ADH / BM (ADMIN HEAD / BRANCH MANAGER)")
         .setFontWeight("bold").setFontSize(10.5).setFontColor("#00205B").setHorizontalAlignment("center");

    sheet.getRange(ttdStartRow + 7, 8, 1, 5).merge()
         .setValue("( Admin Head / Branch Manager )")
         .setFontWeight("bold").setFontSize(9.5).setHorizontalAlignment("center");
    sheet.getRange(ttdStartRow + 7, 8, 1, 5).setBorder(true, false, false, false, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);

    SpreadsheetApp.flush();

    const exportUrl = "https://docs.google.com/spreadsheets/d/" + ss.getId() + "/export?format=xlsx&gid=" + sheetId;
    const token = ScriptApp.getOAuthToken();
    let excelBlob = null;

    try {
      const res1 = UrlFetchApp.fetch(exportUrl, {
        method: "get",
        headers: { Authorization: "Bearer " + token },
        followRedirects: false,
        muteHttpExceptions: true
      });
      const code1 = res1.getResponseCode();

      if (code1 === 302 || code1 === 301) {
        const headers1 = res1.getAllHeaders();
        const loc = headers1["Location"] || headers1["location"];
        if (loc) {
          let res2 = UrlFetchApp.fetch(loc, {
            method: "get",
            headers: { Authorization: "Bearer " + token },
            followRedirects: true,
            muteHttpExceptions: true
          });
          if (res2.getResponseCode() === 200 && isRealZipXlsx(res2.getBlob())) {
            excelBlob = res2.getBlob();
          } else {
            res2 = UrlFetchApp.fetch(loc, {
              method: "get",
              followRedirects: true,
              muteHttpExceptions: true
            });
            if (res2.getResponseCode() === 200 && isRealZipXlsx(res2.getBlob())) {
              excelBlob = res2.getBlob();
            }
          }
        }
      } else if (code1 === 200 && isRealZipXlsx(res1.getBlob())) {
        excelBlob = res1.getBlob();
      }
    } catch (e1) {
      Logger.log("Peringatan Strategi 1 Ekspor: " + e1.toString());
    }

    if (!excelBlob) {
      try {
        const resDirect = UrlFetchApp.fetch(exportUrl, {
          method: "get",
          headers: { Authorization: "Bearer " + token },
          followRedirects: true,
          muteHttpExceptions: true
        });
        if (resDirect.getResponseCode() === 200 && isRealZipXlsx(resDirect.getBlob())) {
          excelBlob = resDirect.getBlob();
        }
      } catch (e2) {
        Logger.log("Peringatan Strategi 2 Ekspor: " + e2.toString());
      }
    }

    if (excelBlob && isRealZipXlsx(excelBlob)) {
      excelBlob.setName(filename);
      excelBlob.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      Logger.log("[SUKSES] Berkas Excel " + filename + " BERHASIL dibuat (" + excelBlob.getBytes().length + " bytes)");
      return excelBlob;
    } else {
      Logger.log("[PERINGATAN] Gagal mengekspor berkas Excel biner valid untuk cabang " + branchName);
      return null;
    }
  } catch (errBuild) {
    Logger.log("Error buildExcelAttachment: " + errBuild.toString());
    return null;
  } finally {
    try {
      ss.deleteSheet(sheet);
    } catch (delErr) {
      Logger.log("Peringatan saat menghapus tab sementara: " + delErr.toString());
    }
  }
}

function isRealZipXlsx(blob) {
  if (!blob) return false;
  try {
    const bytes = blob.getBytes();
    if (!bytes || bytes.length < 500) return false;
    return bytes[0] === 0x50 && bytes[1] === 0x4B;
  } catch (e) {
    return false;
  }
}

// ----------------------------------------------------------------------------
// 8. TEMPLATE PDF & EXECUTIVE EMAIL SUMMARY
// ----------------------------------------------------------------------------
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
    Logger.log("Peringatan konversi foto Drive ke Base64: " + err.toString());
  }
  return "";
}

function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return "";
  url = url.trim();
  const m = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m && m[1]) return m[1];
  if (url.length >= 25 && !url.includes("/") && !url.includes("http")) return url;
  return "";
}

function buildPdfHtml(records, branchName, reportDateStr, printDateStr, totalCount, masukCount, keluarCount) {
  let rowsHtml = "";
  if (!records || records.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="13" bgcolor="#ffffff" style="padding: 18px; text-align: center; color: #64748b; font-size: 10px; border: 1px solid #000000; background-color: #ffffff !important;">
          Tidak ada data transaksi mutasi kendaraan pada cabang ini untuk periode terkait.
        </td>
      </tr>
    `;
  } else {
    records.forEach((item, idx) => {
      const isMasuk = (item.type || "") === "Unit Masuk";
      const typeBadge = isMasuk ? "Unit Masuk" : "Unit Keluar";

      const unitB64 = resolveImageBase64(item.unitPhotoUrl || item.unitPhoto);
      const docB64 = resolveImageBase64(item.docPhotoUrl || item.docPhoto);

      const renderImgTag = (b64, label) => {
        if (b64 && b64.startsWith("data:image")) {
          return `
            <div style="width: 62px; margin: 0 auto; text-align: center;">
              <img src="${b64}" alt="${label}" style="width: 58px; height: 42px; object-fit: cover; border-radius: 2px; border: 1px solid #cbd5e1; display: block; margin: 0 auto;" />
              <div style="font-size: 6px; font-weight: bold; color: #475569; text-align: center; margin-top: 1.5px; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${label}</div>
            </div>
          `;
        }
        return `
          <div style="width: 58px; height: 40px; background-color: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 2px; display: block; margin: 0 auto; text-align: center; padding-top: 14px; box-sizing: border-box;">
            <span style="color: #94a3b8; font-size: 7px; display: block;">Tidak Ada Foto</span>
          </div>
        `;
      };

      const unitImgHtml = renderImgTag(unitB64, "Foto Fisik Unit");
      const docTypeLabel = (item.docType || "SPP DC").toUpperCase();
      const docImgHtml = renderImgTag(docB64, docTypeLabel);

      const officerName = String(item.officerName || item.namaPetugas || "").trim();
      const bCode = (String(item.branch || branchName || "").match(/D66[0-4]/i)?.[0] || branchName.split(" - ")[0] || "CABANG").toUpperCase();
      let officerCellHtml = "";
      if (officerName) {
        officerCellHtml = `
          <div style="font-weight: 800; font-size: 8.5px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.2px;">${officerName.toUpperCase()}</div>
          <div style="font-size: 7px; color: #64748b; font-weight: 600; margin-top: 1.5px;">Security &mdash; ${bCode}</div>
        `;
      } else {
        const cleanPic = String(item.pic || "Petugas Security").replace(/DISTRICT/gi, "BRANCH").trim();
        if (cleanPic.toUpperCase().includes("ADMIN")) {
          officerCellHtml = `
            <div style="font-weight: 800; font-size: 8px; color: #0f172a;">ADMIN HEAD</div>
            <div style="font-size: 7px; color: #64748b; font-weight: 600; margin-top: 1px;">Branch Manager</div>
          `;
        } else if (cleanPic.includes(" — ")) {
          const parts = cleanPic.split(" — ");
          officerCellHtml = `
            <div style="font-weight: 800; font-size: 8px; color: #0f172a; text-transform: uppercase;">${parts[0].trim().toUpperCase()}</div>
            <div style="font-size: 7px; color: #64748b; font-weight: 600; margin-top: 1px;">Security &mdash; ${parts[1] ? parts[1].replace(/security\s*/i, '').trim() : bCode}</div>
          `;
        } else {
          officerCellHtml = `
            <div style="font-weight: 800; font-size: 8px; color: #0f172a;">PETUGAS SECURITY</div>
            <div style="font-size: 7px; color: #64748b; font-weight: 600; margin-top: 1px;">Security &mdash; ${bCode}</div>
          `;
        }
      }

      const carColor = String(item.color || item.warna || "").trim();
      const carColorHtml = (carColor && carColor !== "-") 
        ? `<div style="font-size: 7px; color: #64748b; font-weight: 600; margin-top: 1.5px;">Warna: ${carColor}</div>` 
        : "";

      const cleanNotes = item.notes || 'Pemeriksaan standar unit.';
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      rowsHtml += `
        <tr bgcolor="${rowBg}" style="background-color: ${rowBg} !important;">
          <td bgcolor="${rowBg}" style="padding: 4px 2px; text-align: center; border: 1px solid #000000; font-size: 8px; font-weight: bold; background-color: ${rowBg} !important;">${idx + 1}</td>
          <td bgcolor="${rowBg}" style="padding: 4px 2px; border: 1px solid #000000; font-size: 7px; font-weight: bold; color: #0284c7; text-align: center; word-break: break-all; line-height: 1.15; overflow: hidden; background-color: ${rowBg} !important;">${item.id || '-'}</td>
          <td bgcolor="${rowBg}" style="padding: 4px 2px; border: 1px solid #000000; font-size: 7.5px; text-align: center; white-space: nowrap; overflow: hidden; background-color: ${rowBg} !important;">${item.time || '08:00'}</td>
          <td bgcolor="${rowBg}" style="padding: 4px 2px; border: 1px solid #000000; font-size: 7.5px; text-align: center; white-space: nowrap; overflow: hidden; background-color: ${rowBg} !important;">${item.date || reportDateStr}</td>
          <td bgcolor="${rowBg}" style="padding: 4px 4px; border: 1px solid #000000; font-size: 8.5px; font-weight: bold; color: #0f172a; background-color: ${rowBg} !important;">
            <div>${item.model || '-'}</div>
            ${carColorHtml}
          </td>
          <td bgcolor="${rowBg}" style="padding: 4px 4px; border: 1px solid #000000; font-size: 8px; font-weight: bold; color: #92400e; background-color: ${rowBg} !important;">${branchName}</td>
          <td bgcolor="${rowBg}" style="padding: 4px 4px; border: 1px solid #000000; font-size: 8px; font-family: 'Courier New', monospace; font-weight: bold; color: #000000; background-color: ${rowBg} !important;">${item.vin || '-'}</td>
          <td bgcolor="${rowBg}" style="padding: 4px 4px; border: 1px solid #000000; font-size: 7.5px; font-family: 'Courier New', monospace; color: #475569; background-color: ${rowBg} !important;">${item.engine || '-'}</td>
          <td bgcolor="${rowBg}" style="padding: 4px 3px; text-align: center; border: 1px solid #000000; font-size: 8px; font-weight: bold; color: ${isMasuk ? '#15803d' : '#1d4ed8'}; background-color: ${rowBg} !important;">${typeBadge}</td>
          <td bgcolor="${rowBg}" style="padding: 4px 4px; border: 1px solid #000000; background-color: ${rowBg} !important;">${officerCellHtml}</td>
          <td bgcolor="${rowBg}" style="padding: 4px 4px; border: 1px solid #000000; font-size: 7.5px; color: #475569; background-color: ${rowBg} !important;">${cleanNotes}</td>
          <td bgcolor="${rowBg}" style="padding: 3px 2px; text-align: center; vertical-align: middle; border: 1px solid #000000; background-color: ${rowBg} !important;">${unitImgHtml}</td>
          <td bgcolor="${rowBg}" style="padding: 3px 2px; text-align: center; vertical-align: middle; border: 1px solid #000000; background-color: ${rowBg} !important;">${docImgHtml}</td>
        </tr>
      `;
    });
  }

  const branchCode = branchName.split(" - ")[0] || "CABANG";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Laporan Mutasi Stockyard Daihatsu</title>
      <style>
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          box-sizing: border-box;
        }
        @page {
          size: A4 landscape;
          margin: 7mm;
        }
        body {
          font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          font-size: 8px;
          background-color: #ffffff;
        }
        .header-container {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 2px;
        }
        .company-name {
          font-size: 11.5px;
          font-weight: bold;
          color: #00205B;
          letter-spacing: 0.3px;
        }
        .company-sub {
          font-size: 8.5px;
          font-weight: bold;
          color: #64748B;
          margin-top: 2px;
        }
        .accent-bar {
          width: 100%;
          border-collapse: collapse;
          margin: 3.5px 0 5px 0;
          height: 3.5px;
        }
        .doc-title-box {
          text-align: center;
          margin: 4px 0 5px 0;
        }
        .doc-main-title {
          font-size: 11.5px;
          font-weight: bold;
          color: #0f172a;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-top: 4px;
          margin-bottom: 10px;
        }
        .data-table th, .data-table td {
          overflow: hidden;
          box-sizing: border-box;
        }
        .data-table th {
          background-color: #00205B !important;
          color: #ffffff !important;
          font-weight: bold;
          text-align: center;
          vertical-align: middle;
          border: 1px solid #000000;
          text-transform: uppercase;
        }
        .ttd-container {
          width: 100%;
          border-collapse: collapse;
          margin-top: 16px;
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>

      <!-- Kop Surat Resmi (Sama Persis Format Excel) -->
      <table class="header-container" style="width: 100%; border-collapse: collapse; margin-bottom: 2px;">
        <tr>
          <td style="width: 110px; vertical-align: middle; padding-right: 12px;">
            <img src="data:image/png;base64,${DAIHATSU_LOGO_BASE64}" alt="Logo Daihatsu" style="height: 38px; width: auto; display: block;" />
          </td>
          <td style="vertical-align: middle; border-left: 2.5px solid #ED1B24; padding-left: 12px;">
            <div class="company-name">
              PT ASTRA INTERNATIONAL Tbk — DAIHATSU SALES OPERATION
            </div>
            <div class="company-sub">
              Sentra Distribusi & Manajemen Stockyard Area Lampung
            </div>
          </td>
          <td style="width: 220px; vertical-align: middle; text-align: right;">
            <div style="font-weight: bold; font-size: 8.5px; color: #475569; letter-spacing: 0.2px;">
              KODE FORM: ADM-YARD-BA-01
            </div>
            <div style="font-size: 8px; color: #94a3b8; margin-top: 2px;">
              Astra Daihatsu DSO Lampung
            </div>
          </td>
        </tr>
      </table>

      <!-- Garis Aksen Korporat Astra (Merah 54% & Navy 46%) -->
      <table class="accent-bar" style="width: 100%; border-collapse: collapse; margin: 3.5px 0 5px 0; height: 3.5px;">
        <tr>
          <td bgcolor="#ED1B24" style="width: 54%; background-color: #ED1B24 !important; height: 3.5px; font-size: 1px; line-height: 1px;">&nbsp;</td>
          <td bgcolor="#00205B" style="width: 46%; background-color: #00205B !important; height: 3.5px; font-size: 1px; line-height: 1px;">&nbsp;</td>
        </tr>
      </table>

      <!-- Judul Dokumen Resmi -->
      <div class="doc-title-box">
        <div class="doc-main-title">
          REPORT REKAPITULASI MUTASI HARIAN KENDARAAN (STOCKYARD)
        </div>
      </div>

      <!-- Metadata Strip (100% Identik Panel Row 6 Excel) -->
      <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border: 1px solid #cbd5e1; margin-bottom: 6px;">
        <tr bgcolor="#f8fafc">
          <td bgcolor="#f8fafc" style="width: 33%; padding: 5px 8px; border: 1px solid #cbd5e1; font-size: 8.5px; font-weight: bold; color: #00205B; vertical-align: middle;">
            CABANG: ${branchName.toUpperCase()}
          </td>
          <td bgcolor="#f8fafc" style="width: 23%; padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-size: 8.5px; font-weight: bold; color: #0f172a; vertical-align: middle;">
            PERIODE: ${reportDateStr}
          </td>
          <td bgcolor="#f8fafc" style="width: 24%; padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-size: 8px; color: #475569; vertical-align: middle;">
            CETAK: ${printDateStr}
          </td>
          <td bgcolor="#f8fafc" style="width: 20%; padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-size: 8px; font-weight: bold; color: #15803d; vertical-align: middle;">
            STATUS: TERVERIFIKASI
          </td>
        </tr>
      </table>

      <!-- Tabel Data Mutasi: Header Navy Solid & Border Hitam Sesuai Excel -->
      <table class="data-table">
        <thead>
          <tr bgcolor="#00205B" style="background-color: #00205B !important; color: #ffffff !important; height: 28px;">
            <th bgcolor="#00205B" style="width: 24px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">No</th>
            <th bgcolor="#00205B" style="width: 90px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">ID Mutasi</th>
            <th bgcolor="#00205B" style="width: 50px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">Waktu</th>
            <th bgcolor="#00205B" style="width: 54px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">Tanggal</th>
            <th bgcolor="#00205B" style="background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 4px;">Model Kendaraan</th>
            <th bgcolor="#00205B" style="width: 86px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">Cabang</th>
            <th bgcolor="#00205B" style="width: 98px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">No. Rangka (VIN)</th>
            <th bgcolor="#00205B" style="width: 68px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">No. Mesin</th>
            <th bgcolor="#00205B" style="width: 60px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">Jenis Mutasi</th>
            <th bgcolor="#00205B" style="width: 80px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">Petugas Security</th>
            <th bgcolor="#00205B" style="width: 86px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">Catatan</th>
            <th bgcolor="#00205B" style="width: 68px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">Foto Fisik Unit</th>
            <th bgcolor="#00205B" style="width: 68px; background-color: #00205B !important; color: #ffffff !important; font-size: 8px; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000000; padding: 6px 2px;">Foto Dokumen</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr bgcolor="#e2e8f0" style="background-color: #e2e8f0 !important; font-weight: bold; color: #0f172a;">
            <td colspan="8" bgcolor="#e2e8f0" style="padding: 5px 6px; text-align: right; border: 1px solid #000000; font-size: 8.5px; text-transform: uppercase; background-color: #e2e8f0 !important;">
              TOTAL REKAPITULASI MUTASI KENDARAAN:
            </td>
            <td bgcolor="#cbd5e1" style="padding: 5px 4px; text-align: center; border: 1px solid #000000; font-size: 9px; font-weight: bold; color: #00205B; background-color: #cbd5e1 !important;">
              ${totalCount} Unit
            </td>
            <td colspan="4" bgcolor="#e2e8f0" style="padding: 5px 6px; text-align: center; border: 1px solid #000000; font-size: 8.5px; font-weight: bold; background-color: #e2e8f0 !important;">
              <span style="color: #15803d;">MASUK: ${masukCount} Unit</span> &nbsp;|&nbsp; 
              <span style="color: #1d4ed8;">KELUAR: ${keluarCount} Unit</span>
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- Blok 2 Tanda Tangan Resmi Sesuai Excel -->
      <table class="ttd-container">
        <tr>
          <!-- TTD 1: PETUGAS SECURITY (KIRI) -->
          <td style="width: 44%; text-align: center; vertical-align: top;">
            <div style="font-size: 8.5px; font-weight: bold; color: #475569;">Petugas Pemeriksa & Pemindai:</div>
            <div style="font-size: 10px; font-weight: bold; color: #00205B; margin-top: 2px;">SECURITY</div>
            <div style="font-size: 8px; font-weight: bold; color: #b45309; margin-top: 1px;">${branchName}</div>
            <div style="height: 48px;"></div>
            <div style="border-top: 1px solid #000000; width: 75%; margin: 0 auto; font-weight: bold; font-size: 9px; padding-top: 4px;">
              ( Petugas Security )
            </div>
          </td>

          <td style="width: 12%;"></td>

          <!-- TTD 2: ADH / BM (KANAN) -->
          <td style="width: 44%; text-align: center; vertical-align: top;">
            <div style="font-size: 8.5px; font-weight: bold; color: #475569;">Mengetahui & Menyetujui:</div>
            <div style="font-size: 10px; font-weight: bold; color: #00205B; margin-top: 2px;">ADH / BM (ADMIN HEAD / BRANCH MANAGER)</div>
            <div style="height: 48px;"></div>
            <div style="border-top: 1px solid #000000; width: 75%; margin: 0 auto; font-weight: bold; font-size: 9px; padding-top: 4px;">
              ( Admin Head / Branch Manager )
            </div>
          </td>
        </tr>
      </table>

    </body>
    </html>
  `;
}

function buildBranchSpecificEmailHtml(branchName, reportDateStr, printDateStr, totalCount, masukCount, keluarCount) {
  const isZero = totalCount === 0;
  const statusBadge = isZero 
    ? '<span style="display: inline-block; padding: 4px 10px; background-color: #f1f5f9; color: #64748b; font-weight: bold; font-size: 11px; border-radius: 9999px; border: 1px solid #cbd5e1;">- Nihil Mutasi -</span>'
    : '<span style="display: inline-block; padding: 4px 10px; background-color: #ecfdf5; color: #047857; font-weight: bold; font-size: 11px; border-radius: 9999px; border: 1px solid #a7f3d0;">[OK] ' + totalCount + ' Unit Aktif</span>';

  const attachmentNoteHtml = isZero ? `
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #64748b; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 12.5px; color: #334155; line-height: 1.6;">
      <strong style="display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-size: 12px; color: #475569;">
        [INFO] STATUS OPERASIONAL CABANG (NIHIL MUTASI):
      </strong>
      <p style="margin: 0 0 6px 0; color: #475569; font-size: 11.5px;">
        Pada tanggal <strong>${reportDateStr}</strong>, tidak tercatat adanya aktivitas mutasi fisik unit, baik unit masuk (<em>inbound</em>) maupun unit keluar (<em>outbound</em>) pada pool/yard <strong>${branchName}</strong>.
      </p>
      <div style="margin-top: 6px; font-style: italic; color: #64748b; font-size: 11px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
        Sesuai kebijakan operasional sistem, berkas lampiran PDF & Excel (.xlsx) tidak disertakan karena tidak terdapat transaksi fisik kendaraan yang perlu diaudit.
      </div>
    </div>
  ` : `
    <div style="background-color: #f0f7ff; border-left: 4px solid #00205B; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 12.5px; color: #1e3a8a; line-height: 1.6;">
      <strong style="display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-size: 12px; color: #00205B;">
        INFORMASI KELENGKAPAN BERKAS LAMPIRAN (${branchName}):
      </strong>
      <p style="margin: 0 0 6px 0; color: #334155; font-size: 11.5px;">
        Dokumen rekapitulasi resmi khusus untuk cabang ini telah dilampirkan dalam format <strong>PDF & Microsoft Excel (.xlsx)</strong>, yang memuat:
      </p>
      <ul style="margin: 4px 0 6px 18px; padding: 0; color: #334155; font-size: 11.5px;">
        <li>Rincian lengkap mutasi fisik & nomor rangka/mesin unit cabang ini.</li>
        <li>Lampiran foto fisik kendaraan & surat jalan (SPP DC / BSTKB / OKK).</li>
        <li>Otorisasi tanda tangan resmi Petugas Security Yard On-Duty & ADH/BM.</li>
      </ul>
      <div style="margin-top: 6px; font-style: italic; color: #64748b; font-size: 11px;">
        Silakan mengunduh berkas PDF dan file Excel (.xlsx) terlampir di bawah email ini.
      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rekap Mutasi Cabang ${branchName}</title>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #0f172a; line-height: 1.5;">
      
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        
        <!-- HEADER KOP RESMI ASTRA DAIHATSU -->
        <div style="background-color: #00205B; padding: 22px 26px; border-bottom: 4px solid #E60012;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td>
                <span style="font-size: 10px; font-weight: 800; color: #93c5fd; letter-spacing: 1.5px; text-transform: uppercase;">
                  ASTRA DAIHATSU MOTOR • DSO LAMPUNG
                </span>
                <h1 style="margin: 4px 0 0; color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: -0.3px;">
                  REKAP MUTASI HARIAN KENDARAAN (STOCKYARD)
                </h1>
                <div style="margin-top: 6px; display: inline-block; background-color: rgba(255,255,255,0.15); padding: 3px 10px; border-radius: 6px; color: #ffffff; font-size: 11px; font-weight: bold;">
                  Cabang: ${branchName}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <div style="padding: 24px 26px;">

          <p style="margin-top: 0; font-size: 13.5px; color: #334155;">
            Yth. <strong>Petugas Security Yard & Pimpinan Cabang ${branchName}</strong>,
          </p>
          <p style="font-size: 13px; color: #475569; line-height: 1.6;">
            ${isZero 
              ? `Berikut konfirmasi pemantauan harian pergerakan fisik unit kendaraan (<em>Management StockYard</em>) pada tanggal <strong>${reportDateStr}</strong>:`
              : `Berikut laporan ringkasan transaksi pergerakan fisik unit kendaraan (<em>Management StockYard</em>) pada tanggal <strong>${reportDateStr}</strong>:`}
          </p>

          <!-- KARTU RINGKASAN CABANG -->
          <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden;">
            <tr>
              <td style="padding: 16px; border-bottom: 1px solid #e2e8f0;">
                <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Status Aktivitas Cabang</div>
                <div style="margin-top: 6px;">${statusBadge}</div>
              </td>
              <td style="padding: 16px; border-bottom: 1px solid #e2e8f0; text-align: right;">
                <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase;">Waktu Penerbitan</div>
                <div style="font-size: 12px; font-weight: bold; color: #0f172a; margin-top: 4px;">${printDateStr}</div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 16px;">
                <table style="width: 100%; text-align: center; border-collapse: collapse;">
                  <tr>
                    <td style="width: 33.3%; padding: 8px; border-right: 1px solid #e2e8f0;">
                      <div style="font-size: 11px; font-weight: bold; color: #475569;">TOTAL DIPERIKSA</div>
                      <div style="font-size: 22px; font-weight: 900; color: #00205B; margin-top: 2px;">${totalCount} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Unit</span></div>
                    </td>
                    <td style="width: 33.3%; padding: 8px; border-right: 1px solid #e2e8f0;">
                      <div style="font-size: 11px; font-weight: bold; color: #047857;">UNIT MASUK (IN)</div>
                      <div style="font-size: 22px; font-weight: 900; color: #047857; margin-top: 2px;">${masukCount} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Unit</span></div>
                    </td>
                    <td style="width: 33.3%; padding: 8px;">
                      <div style="font-size: 11px; font-weight: bold; color: #b91c1c;">UNIT KELUAR (OUT)</div>
                      <div style="font-size: 22px; font-weight: 900; color: #b91c1c; margin-top: 2px;">${keluarCount} <span style="font-size: 11px; font-weight: normal; color: #64748b;">Unit</span></div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- KOTAK CATATAN DOKUMEN RESMI CABANG -->
          ${attachmentNoteHtml}

          <p style="margin-bottom: 0; color: #475569; font-size: 12px;">
            Salam hormat,<br>
            <strong>Management StockYard</strong><br>
            Astra Daihatsu DSO Lampung
          </p>

        </div>

        <!-- FOOTER RESMI -->
        <div style="background-color: #f8fafc; padding: 14px 26px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10.5px; color: #64748b;">
          Email otomatis resmi diterbitkan oleh Sistem Management StockYard • Astra Daihatsu DSO Lampung
        </div>

      </div>

    </body>
    </html>
  `;
}

function buildExecutiveEmailHtml(reportDateStr, printDateStr, totalCount, masukCount, keluarCount, branchSummaryList) {
  const allOfficialBranches = [
    { code: "D660", name: "D660 - Ahmad Yani", area: "Bandar Lampung Sentral" },
    { code: "D661", name: "D661 - Soekarno Hatta", area: "By-Pass Soekarno Hatta" },
    { code: "D662", name: "D662 - Bandar Jaya", area: "Lampung Tengah" },
    { code: "D663", name: "D663 - Lampung Utara", area: "Kotabumi & Sekitarnya" },
    { code: "D664", name: "D664 - Lampung Timur", area: "Batanghari / Sukadana" }
  ];

  const summaryMap = {};
  (branchSummaryList || []).forEach(b => {
    const codeMatch = b.name.match(/D66[0-4]/i);
    if (codeMatch) {
      summaryMap[codeMatch[0].toUpperCase()] = b;
    } else {
      summaryMap[b.name] = b;
    }
  });

  const branchRowsHtml = allOfficialBranches.map(b => {
    const data = summaryMap[b.code] || { total: 0, masuk: 0, keluar: 0 };
    const hasActivity = data.total > 0;
    const badgeStatus = hasActivity 
      ? '<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:bold;background:#ecfdf5;color:#15803d;border:1px solid #bbf7d0;">[OK] Berkas PDF & XLSX Terlampir</span>'
      : '<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:bold;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;">- Nihil Mutasi -</span>';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${hasActivity ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 11px 14px; font-weight: bold; color: #00205B;">
          ${b.name}<br>
          <span style="font-size: 10px; color: #64748b; font-weight: normal;">${b.area}</span>
        </td>
        <td style="padding: 11px 14px; text-align: center; font-weight: bold; color: ${data.masuk > 0 ? '#15803d' : '#94a3b8'};">
          ${data.masuk} Unit
        </td>
        <td style="padding: 11px 14px; text-align: center; font-weight: bold; color: ${data.keluar > 0 ? '#1d4ed8' : '#94a3b8'};">
          ${data.keluar} Unit
        </td>
        <td style="padding: 11px 14px; text-align: center; font-weight: 900; color: ${hasActivity ? '#00205B' : '#94a3b8'}; font-size: 13px;">
          ${data.total} Unit
        </td>
        <td style="padding: 11px 14px; text-align: center;">
          ${badgeStatus}
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px; color: #0f172a;">
      <div style="max-width: 760px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 14px rgba(0,0,0,0.06);">
        
        <div style="background: #00205B; padding: 24px 26px; border-bottom: 4px solid #E60012;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td>
                <h1 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 900; letter-spacing: 0.6px; text-transform: uppercase;">
                  ASTRA DAIHATSU DSO LAMPUNG
                </h1>
                <p style="margin: 5px 0 0 0; color: #93c5fd; font-size: 13.5px; font-weight: 700;">
                  Management StockYard — Rekapitulasi Operasional Gabungan 5 Cabang Resmi
                </p>
                <div style="margin-top: 8px; font-size: 10px; color: #cbd5e1; line-height: 1.5;">
                  <strong>Wilayah Operasional:</strong> D660 (Ahmad Yani) &bull; D661 (Soekarno Hatta) &bull; D662 (Bandar Jaya) &bull; D663 (Lampung Utara) &bull; D664 (Lampung Timur)
                </div>
              </td>
            </tr>
          </table>
        </div>

        <div style="padding: 26px; color: #1e293b; line-height: 1.6; font-size: 13px;">
          <p style="margin-top: 0; font-size: 13.5px;">Yth. Tim Manajemen Logistik, Pimpinan Cabang & Kepala Wilayah Daihatsu Lampung,</p>
          
          <p style="margin-bottom: 20px;">
            ${totalCount === 0
              ? `Berikut laporan pemantauan operasional harian di seluruh <strong>5 Cabang Resmi Astra Daihatsu DSO Lampung</strong> pada periode tanggal <strong>${reportDateStr}</strong>. Pada periode ini <strong>tidak terdapat aktivitas mutasi fisik kendaraan (Nihil Mutasi)</strong>:`
              : `Berikut rekapitulasi audit dan mutasi fisik kendaraan di seluruh <strong>5 Cabang Resmi Astra Daihatsu DSO Lampung</strong> pada periode tanggal <strong>${reportDateStr}</strong>. Setiap cabang yang memiliki pergerakan unit diterbitkan berkas lampiran <strong>PDF dan Excel (.xlsx) terpisah</strong>:`}
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="width: 32%; padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; text-align: center;">
                <div style="font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Seluruh Cabang</div>
                <div style="font-size: 24px; font-weight: 900; color: #00205B; margin-top: 4px;">${totalCount} <span style="font-size: 13px; font-weight: 700;">Unit</span></div>
              </td>
              <td style="width: 2%;"></td>
              <td style="width: 32%; padding: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; text-align: center;">
                <div style="font-size: 10.5px; font-weight: 700; color: #166534; text-transform: uppercase;">Unit Masuk (Inbound)</div>
                <div style="font-size: 24px; font-weight: 900; color: #15803d; margin-top: 4px;">${masukCount} <span style="font-size: 13px; font-weight: 700;">Unit</span></div>
              </td>
              <td style="width: 2%;"></td>
              <td style="width: 32%; padding: 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; text-align: center;">
                <div style="font-size: 10.5px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Unit Keluar (Outbound)</div>
                <div style="font-size: 24px; font-weight: 900; color: #1d4ed8; margin-top: 4px;">${keluarCount} <span style="font-size: 13px; font-weight: 700;">Unit</span></div>
              </td>
            </tr>
          </table>

          <div style="border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #00205B; color: #ffffff;">
                  <th style="padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase;">Cabang Resmi (DSO Lampung)</th>
                  <th style="padding: 10px 14px; text-align: center; font-size: 11px; text-transform: uppercase;">Masuk</th>
                  <th style="padding: 10px 14px; text-align: center; font-size: 11px; text-transform: uppercase;">Keluar</th>
                  <th style="padding: 10px 14px; text-align: center; font-size: 11px; text-transform: uppercase;">Total Unit</th>
                  <th style="padding: 10px 14px; text-align: center; font-size: 11px; text-transform: uppercase;">Status Berkas</th>
                </tr>
              </thead>
              <tbody>
                ${branchRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- KOTAK CATATAN DOKUMEN RESMI (STANDAR KORPORAT EKSEKUTIF ASTRA) -->
          ${totalCount === 0 ? `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #64748b; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; font-size: 13px; color: #334155; line-height: 1.6;">
              <strong style="display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-size: 12.5px; color: #475569;">
                [INFO] STATUS OPERASIONAL GABUNGAN (NIHIL MUTASI):
              </strong>
              <p style="margin: 0 0 6px 0; color: #475569; font-size: 12px;">
                Pada tanggal <strong>${reportDateStr}</strong>, tidak tercatat adanya aktivitas pergerakan unit fisik, baik unit masuk (<em>inbound</em>) maupun unit keluar (<em>outbound</em>) di seluruh 5 cabang resmi Astra Daihatsu DSO Lampung.
              </p>
              <div style="margin-top: 6px; font-style: italic; color: #64748b; font-size: 11px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
                Sesuai kebijakan audit dan operasional sistem, berkas lampiran PDF & Excel (.xlsx) tidak diterbitkan karena tidak terdapat transaksi fisik kendaraan yang perlu diaudit.
              </div>
            </div>
          ` : `
            <div style="background-color: #f0f7ff; border-left: 4px solid #00205B; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; font-size: 13px; color: #1e3a8a; line-height: 1.6;">
              <strong style="display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-size: 12.5px; color: #00205B;">
                INFORMASI KELENGKAPAN BERKAS LAMPIRAN:
              </strong>
              <p style="margin: 0 0 8px 0; color: #334155; font-size: 12px;">
                Laporan rekapitulasi mutasi unit diterbitkan secara terpisah untuk masing-masing cabang dalam format <strong>PDF & Microsoft Excel (.xlsx)</strong> resmi, yang memuat:
              </p>
              <ul style="margin: 4px 0 8px 18px; padding: 0; color: #334155; font-size: 11.5px; line-height: 1.6;">
                <li style="margin-bottom: 4px;"><strong>Rincian Mutasi Fisik</strong>: Rekapitulasi pergerakan unit masuk (<em>inbound</em>) & keluar (<em>outbound</em>) harian.</li>
                <li style="margin-bottom: 4px;"><strong>Dokumentasi Lapangan</strong>: Lampiran foto aktual fisik unit dan bukti surat jalan (<em>SPP DC / BSTKB / OKK</em>).</li>
                <li style="margin-bottom: 4px;"><strong>Rekonsiliasi Stok</strong>: Rincian total unit per cabang guna pencocokan data fisik & sistem.</li>
                <li style="margin-bottom: 4px;"><strong>Otorisasi Resmi</strong>: Diverifikasi dan disahkan oleh petugas <strong>Security Pool / Yard</strong> serta <strong>ADH / Branch Manager</strong>.</li>
              </ul>
              <div style="margin-top: 8px; font-style: italic; color: #64748b; font-size: 11px; border-top: 1px dashed #cbd5e1; padding-top: 6px;">
                Silakan mengunduh berkas PDF dan Excel (.xlsx) yang terlampir di bawah email ini untuk kebutuhan arsip dan audit operasional.
              </div>
            </div>
          `}

          <p style="margin-bottom: 0; color: #475569; font-size: 12px;">
            Salam hormat,<br>
            <strong style="color: #00205B; font-size: 13px;">Management StockYard</strong><br>
            <span style="color: #64748b; font-size: 12px;">Astra Daihatsu DSO Lampung (Sentra Yard Hub)</span>
          </p>
        </div>

        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 20px; text-align: center; font-size: 10.5px; color: #94a3b8;">
          Waktu Cetak: ${printDateStr} &bull; Management StockYard &bull; Astra Daihatsu DSO Lampung
        </div>

      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// 9. HELPER UTILITIES: DRIVE & FORMATTERS
// ----------------------------------------------------------------------------
function saveBase64ImageToDrive(base64Data, fileNamePrefix) {
  try {
    if (!base64Data || typeof base64Data !== "string") return "";

    let contentType = "image/jpeg";
    let rawBase64 = base64Data;
    if (base64Data.indexOf("data:") === 0 && base64Data.indexOf(";base64,") !== -1) {
      const parts = base64Data.split(";base64,");
      contentType = parts[0].replace("data:", "").trim() || "image/jpeg";
      rawBase64 = parts[1];
    }
    rawBase64 = rawBase64.replace(/\s+/g, "");
    if (!rawBase64) return "";

    const decodedBytes = Utilities.base64Decode(rawBase64);

    let ext = "jpg";
    if (contentType.includes("png")) ext = "png";
    else if (contentType.includes("webp")) ext = "webp";

    const timestampStr = Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd_HHmmss");
    const fullFileName = fileNamePrefix + "_" + timestampStr + "." + ext;
    const blob = Utilities.newBlob(decodedBytes, contentType, fullFileName);

    let file = null;
    const ss = getSpreadsheet();
    const folderId = getDriveFolderId(ss);

    // 1. Coba simpan ke folder Drive spesifik jika ada
    if (folderId && folderId.trim() !== "") {
      try {
        const targetFolder = DriveApp.getFolderById(folderId.trim());
        if (targetFolder) {
          file = targetFolder.createFile(blob);
        }
      } catch (fErr) {
        Logger.log("Peringatan folder Drive khusus: " + fErr.toString());
      }
    }

    // 2. Fallback aman ke Root Drive jika folder khusus tidak dapat diakses
    if (!file) {
      try {
        file = DriveApp.getRootFolder().createFile(blob);
      } catch (rootErr) {
        try {
          file = DriveApp.createFile(blob);
        } catch (createErr) {
          Logger.log("Peringatan Root Drive createFile: " + createErr.toString());
        }
      }
    }

    if (!file) return "";

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      Logger.log("Peringatan setSharing foto profil: " + shareErr.toString());
    }

    const fileId = file.getId();
    // Return direct thumbnail URL resolusi tinggi yang dapat langsung dimuat oleh tag <img> di web & mobile
    return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1000";
  } catch (err) {
    Logger.log("Error fatal di saveBase64ImageToDrive: " + err.toString());
    return "";
  }
}

function formatIndonesianDate(dateObj) {
  if (!dateObj || !(dateObj instanceof Date)) return "-";
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const day = dateObj.getDate();
  const monthName = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  return `${day} ${monthName} ${year}`;
}

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

  // 1. Jika string ISO (mengandung T atau berakhiran Z), parse ke Date lalu konversi sesuai TIMEZONE Asia/Jakarta!
  if (str.includes("T") || str.endsWith("Z")) {
    const dIso = new Date(str);
    if (!isNaN(dIso.getTime())) {
      return Utilities.formatDate(dIso, TIMEZONE, "yyyy-MM-dd");
    }
  }

  // 2. Format MUT-YYYYMMDD
  const mutMatch = str.match(/MUT-(\d{4})(\d{2})(\d{2})/i);
  if (mutMatch) {
    return mutMatch[1] + "-" + mutMatch[2] + "-" + mutMatch[3];
  }

  // 3. Format Indonesia: "20 November 2026" atau "20 Nov 2026"
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

  // 4. Format DD/MM/YYYY atau DD-MM-YYYY: "20/11/2026" atau "20-11-2026"
  const slashMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (slashMatch) {
    return slashMatch[3] + "-" + slashMatch[2].padStart(2, "0") + "-" + slashMatch[1].padStart(2, "0");
  }

  // 5. Format YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return isoMatch[1] + "-" + isoMatch[2].padStart(2, "0") + "-" + isoMatch[3].padStart(2, "0");
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
    }
  } catch (e) {}

  return "";
}
    if (m) {
      return indoMatch[3] + "-" + m + "-" + indoMatch[1].padStart(2, "0");
    }
  }

  const slashMatch = str.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (slashMatch) {
    return slashMatch[3] + "-" + slashMatch[2].padStart(2, "0") + "-" + slashMatch[1].padStart(2, "0");
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
    }
  } catch (e) {}

  return "";
}

function getLatestMutationOrDummy(ss) {
  try {
    const list = getHistoryData(ss);
    if (list && list.length > 0) {
      const latest = list[0];
      return {
        id: latest.id || "MUT-TEST-001",
        type: latest.type || "Unit Masuk",
        model: latest.model || "All New Xenia 1.5 R CVT",
        vin: latest.vin || "MHKM1BA3JPK123456",
        engine: latest.engine || "2NR-VE-987654",
        pic: latest.pic || "Petugas Security",
        location: latest.location || "D660 - Ahmad Yani",
        notes: latest.notes || "Pengujian Notifikasi Realtime Berhasil",
        docType: latest.docType || "SPP DC",
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

  const now = new Date();
  return {
    id: "MUT-TEST-" + Utilities.formatDate(now, TIMEZONE, "HHmmss"),
    type: "Unit Masuk",
    model: "All New Xenia 1.5 R CVT",
    vin: "MHKM1BA3JPK123456",
    engine: "2NR-VE-987654",
    pic: "Petugas Security",
    location: "D660 - Ahmad Yani",
    notes: "Pengujian Notifikasi Otomatis Berhasil",
    docType: "SPP DC",
    time: Utilities.formatDate(now, TIMEZONE, "HH:mm 'WIB'"),
    date: Utilities.formatDate(now, TIMEZONE, "dd/MM/yyyy"),
    unitPhotoUrl: "",
    docPhotoUrl: "",
    newStock: 15
  };
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
    "Model", "Warna Mobil", "No Rangka (VIN)", "No Mesin", "Jenis Mutasi",
    "Nama Petugas", "Petugas PIC", "Cabang / Kode BA", "Catatan",
    "Dokumen (SPP DC / BSTKB / OKK)", "Foto Unit", "Foto Dokumen",
    "Cabang Tujuan"
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

// ----------------------------------------------------------------------------
// 10. FUNGSI PENGUJIAN MANDIRI DI APPS SCRIPT EDITOR
// ----------------------------------------------------------------------------
function testExportExcelSaja() {
  Logger.log("[TEST] Memulai pengujian ekspor Excel cabang D660 - Ahmad Yani...");
  const ss = getSpreadsheet();
  const dummyRecords = [
    {
      id: "MUT-TEST-001",
      time: "08:30 WIB",
      date: Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy"),
      model: "Rocky 1.2 X MT",
      vin: "MHKM2EA3SKJ0001",
      engine: "1KR-V0001",
      type: "Unit Masuk",
      pic: "Security Pool",
      notes: "Kondisi unit mulus, ban serep lengkap",
      docType: "SPP DC",
      unitPhoto: "",
      docPhoto: ""
    }
  ];
  const blob = buildExcelAttachment(dummyRecords, "D660 - Ahmad Yani", Utilities.formatDate(new Date(), TIMEZONE, "dd/MM/yyyy"), 1, 1, 0);
  if (blob) {
    Logger.log("[BERHASIL] SUKSES BESAR! Berkas Excel murni berhasil dibuat.");
    Logger.log("   - Nama Berkas: " + blob.getName());
    Logger.log("   - Ukuran: " + blob.getBytes().length + " bytes");
    Logger.log("   - Tipe Konten: " + blob.getContentType());
  } else {
    Logger.log("[GAGAL] Gagal membuat berkas Excel.");
  }
}

function testKirimEmailSekarang() {
  Logger.log("[START] Memulai pengujian pengiriman email laporan rekapitulasi per cabang...");
  const res = triggerReportEmail();
  Logger.log("Hasil: " + JSON.stringify(res));
}
