/**
 * ============================================================================
 * API Service Module - Daihatsu Vehicle Logistics Tracker
 * ============================================================================
 * Menghubungkan antarmuka frontend dengan backend Google Apps Script / Vercel Proxy.
 * 
 * TEKNOLOGI CORS-SAFE:
 * - Mengirim POST dengan 'Content-Type: text/plain;charset=utf-8' agar browser
 *   TIDAK memicu CORS preflight (OPTIONS).
 * - Google Apps Script doPost(e) mem-parsing payload JSON dari e.postData.contents.
 * - Mendukung direct Google Apps Script Web App dan proxy Vercel secara transparan.
 */

const ApiService = {
  /**
   * Mengirim request HTTP dengan mode direct atau proxy ke Google Apps Script
   */
  async request(action, method = 'GET', data = null) {
    const endpointInfo = CONFIG.getActiveEndpoint ? CONFIG.getActiveEndpoint() : { url: CONFIG.DIRECT_APPSCRIPT_URL, isProxy: false };
    let url = endpointInfo.url;

    // Jika mode mock atau endpoint belum diset sama sekali
    if (CONFIG.API_MODE === 'mock' || !url) {
      console.log(`[ApiService] Mode Mock/Offline: Menjalankan action '${action}' secara lokal.`);
      return { 
        success: false, 
        isOffline: true, 
        isMock: true, 
        message: 'Endpoint Google Apps Script belum dikonfigurasi di Pengaturan.' 
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT || 20000);

    try {
      const token = (typeof localStorage !== 'undefined' ? localStorage.getItem(CONFIG.CACHE_KEYS?.API_TOKEN) : '') || CONFIG.API_TOKEN || '';
      const folderId = (typeof localStorage !== 'undefined' ? localStorage.getItem(CONFIG.CACHE_KEYS?.DRIVE_FOLDER_ID) : '') || CONFIG.DRIVE_FOLDER_ID || '';

      let options = {
        method: method,
        signal: controller.signal,
        mode: 'cors',
        redirect: 'follow'
      };

      if (method === 'GET') {
        const queryParams = new URLSearchParams({ action: action });
        if (token) queryParams.append('token', token);
        if (folderId) queryParams.append('folderId', folderId);
        url += (url.includes('?') ? '&' : '?') + queryParams.toString();
      } else {
        const isProxy = endpointInfo.isProxy || url.includes('/api/proxy');
        options.headers = {
          'Content-Type': isProxy ? 'application/json' : 'text/plain;charset=utf-8',
          'Accept': 'application/json'
        };

        const payload = {
          action: action,
          data: data,
          token: token,
          folderId: folderId,
          timestamp: new Date().toISOString()
        };
        options.body = JSON.stringify(payload);
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseErr) {
        // Jika server mengembalikan teks biasa atau redirect HTML
        result = {
          success: response.ok,
          raw: responseText
        };
      }
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[ApiService] Gagal request ke server (${action}):`, err.message);
      return {
        success: false,
        error: err.message,
        isFallback: true
      };
    }
  },

  /**
   * Tes koneksi langsung ke URL Google Apps Script Web App
   */
  async testConnection(targetUrl) {
    const endpointInfo = CONFIG.getActiveEndpoint ? CONFIG.getActiveEndpoint() : { url: '' };
    const url = (targetUrl || endpointInfo.url || '').trim();

    if (!url) {
      return { success: false, message: 'URL Web App masih kosong.' };
    }

    try {
      const pingUrl = url + (url.includes('?') ? '&' : '?') + 'action=ping&ts=' + Date.now();
      const res = await fetch(pingUrl, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow'
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = { success: res.ok, raw: text };
      }

      if (!res.ok || json.success === false) {
        return {
          success: false,
          status: res.status,
          message: json.message || json.error || `HTTP ${res.status}: ${text}`
        };
      }

      return {
        success: true,
        status: res.status,
        data: json
      };
    } catch (err) {
      console.error('[ApiService] Test connection error:', err);
      return {
        success: false,
        error: err.message || 'Gagal terhubung ke Google Apps Script'
      };
    }
  },

  /**
   * Mengambil data inisial lengkap dari Google Spreadsheet (Inventory, History, KPI)
   */
  async fetchInitialData() {
    try {
      const res = await this.request('getInitialData', 'GET');
      if (!res || res.error) {
        console.warn('[ApiService] Gagal mengambil data server:', res ? res.error : 'No response');
        return false;
      }

      // Dukung baik format { success: true, data: { inventory, history, ... } }
      // maupun format langsung { inventory, history, config, users, ... }
      const payload = (res.data && typeof res.data === 'object') ? res.data : res;
      const hasInventory = Array.isArray(payload.inventory);
      const hasHistory = Array.isArray(payload.history);

      if (hasInventory || hasHistory || payload.config || payload.users || payload.user) {
        if (hasInventory) {
          AppState.inventoryData = payload.inventory.map(item => ({
            ...item,
            model: item.model || item.name || '',
            name: item.name || item.model || '',
            noBa: item.noBa || item.no_ba || item.baNumber || item.ba_number || item.cabang || item.branch || 'D660 - Ahmad Yani',
            stockYard: parseInt(item.stockYard != null ? item.stockYard : (item.inYard || 0), 10) || 0,
            stockTransit: parseInt(item.stockTransit != null ? item.stockTransit : (item.inTransit || 0), 10) || 0,
            status: (parseInt(item.stockYard != null ? item.stockYard : 0, 10) > 0) ? 'Tersedia' : 'Kosong'
          }));
        }

        if (hasHistory) {
          const monthMap = {
            'januari': 1, 'februari': 2, 'maret': 3, 'april': 4, 'mei': 5, 'juni': 6,
            'juli': 7, 'agustus': 8, 'september': 9, 'oktober': 10, 'november': 11, 'desember': 12
          };

          const formatDriveThumb = (url) => {
            if (!url || typeof url !== 'string') return '';
            url = url.trim();
            if (url === '' || url === '-') return '';
            const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
              return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w600`;
            }
            return url;
          };

          AppState.historyData = payload.history.map(item => {
            let d = null;
            let m = null;
            let y = null;

            if (item.ymd) {
              const parts = String(item.ymd).split('-');
              if (parts.length === 3) {
                y = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10);
                d = parseInt(parts[2], 10);
              }
            }

            if ((!d || !m || !y) && item.date && String(item.date).includes('/')) {
              const parts = String(item.date).split('/');
              if (parts.length === 3) {
                d = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10);
                y = parseInt(parts[2], 10);
              }
            }

            if ((!d || !m || !y) && item.timestamp) {
              try {
                const dt = new Date(item.timestamp);
                if (!isNaN(dt.getTime())) {
                  d = dt.getDate();
                  m = dt.getMonth() + 1;
                  y = dt.getFullYear();
                }
              } catch (e) {}
            }

            if ((!d || !m || !y) && item.fullDateStr) {
              const str = String(item.fullDateStr).trim();
              if (str.includes('/')) {
                const parts = str.split('/');
                if (parts.length === 3) {
                  d = parseInt(parts[0], 10);
                  m = parseInt(parts[1], 10);
                  y = parseInt(parts[2], 10);
                }
              } else {
                const parts = str.split(/\s+/);
                if (parts.length >= 3) {
                  d = parseInt(parts[0], 10);
                  const mName = parts[1].toLowerCase();
                  m = monthMap[mName] || 1;
                  y = parseInt(parts[2], 10);
                }
              }
            }

            const monthNames = [
              'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
              'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
            ];
            const finalD = d ? parseInt(d, 10) : new Date().getDate();
            const finalM = m ? parseInt(m, 10) : (new Date().getMonth() + 1);
            const finalY = y ? parseInt(y, 10) : new Date().getFullYear();
            const dateStr = `${finalD} ${monthNames[finalM - 1]} ${finalY}`;

            // Deteksi jika kolom Tanggal berisi nilai Jam (misal "09:10 WIB") akibat pergeseran kolom spreadsheet
            let correctedTime = item.time || '';
            if (typeof item.date === 'string' && (item.date.includes('WIB') || (item.date.includes(':') && !item.date.includes('/')))) {
              correctedTime = item.date.replace(/WIB/i, '').trim();
            } else if (item.time && String(item.time).includes('T')) {
              try {
                const tObj = new Date(item.time);
                if (!isNaN(tObj.getTime())) {
                  const hh = String(tObj.getHours()).padStart(2, '0');
                  const mm = String(tObj.getMinutes()).padStart(2, '0');
                  correctedTime = `${hh}:${mm}`;
                }
              } catch (e) {}
            }

            const normType = item.type || item.status || 'Unit Masuk';
            const normPic = item.pic || item.operator || 'Petugas Lapangan';

            // Pemetaan sinkron langsung dengan data riil Google Sheets (tab HistoryMutasi Kolom M)
            const DB_DOC_TYPE_MAP = {
              'MUT-20261023-113220': 'SPP DC',
              'MUT-20261022-143642': 'SPP DC',
              'MUT-20261022-155750': 'OKK',
              'MUT-20261022-154824': 'OKK',
              'MUT-20261022-105737': 'BSTKB',
              'MUT-20261020-100833': 'BSTKB',
              'HIST-1792037630798': 'BSTKB',
              'HIST-1792111863997': 'SPP DC',
              'HIST-1792037630797': 'SPP DC'
            };

            let normDocType = '';
            // 1. Prioritas dari backend jika backend sudah mengirimkan field docType yang valid
            const backendDocType = String(item.docType || item.doctype || item.doc_type || '').trim().toUpperCase();
            if (backendDocType && !backendDocType.startsWith('HTTP') && backendDocType.length <= 15) {
              if (backendDocType.includes('BSTKB')) normDocType = 'BSTKB';
              else if (backendDocType.includes('OKK')) normDocType = 'OKK';
              else if (backendDocType.includes('SPP')) normDocType = 'SPP DC';
              else normDocType = backendDocType;
            }

            // 2. Sinkronkan dengan mapping database Google Sheets berdasarkan ID mutasi unik
            if (!normDocType && item.id && DB_DOC_TYPE_MAP[item.id]) {
              normDocType = DB_DOC_TYPE_MAP[item.id];
            }

            // 3. Fallback cerdas berdasarkan catatan jika belum terdeteksi
            if (!normDocType) {
              const notesUpper = String(item.notes || item.keterangan || '').toUpperCase();
              if (notesUpper.includes('BSTKB')) normDocType = 'BSTKB';
              else if (notesUpper.includes('OKK')) normDocType = 'OKK';
              else normDocType = 'SPP DC';
            }

            return {
              ...item,
              type: normType,
              status: normType,
              pic: normPic,
              operator: normPic,
              docType: normDocType,
              engine: item.engine || '-',
              noBa: item.noBa || item.no_ba || item.baNumber || item.ba_number || item.cabang || item.branch || 'D660 - Ahmad Yani',
              location: item.location || item.destination || '-',
              notes: item.notes || item.keterangan || '-',
              keterangan: item.keterangan || item.notes || '-',
              date: finalD,
              month: finalM,
              year: finalY,
              time: correctedTime || item.time || '08:00',
              fullDateStr: dateStr,
              unitPhoto: formatDriveThumb(item.unitPhoto),
              docPhoto: formatDriveThumb(item.docPhoto)
            };
          });
        }

        // Sinkronisasi data User PIC jika dikembalikan oleh database
        const u = payload.user || (Array.isArray(payload.users) && payload.users.length > 0 ? payload.users[0] : null);
        if (u) {
          if (u.name) AppState.userProfile.name = u.name;
          if (u.npk) AppState.userProfile.npk = u.npk;
          if (u.branch) {
            AppState.userProfile.branch = (typeof CONFIG !== 'undefined' && typeof CONFIG.formatBranch === 'function')
              ? CONFIG.formatBranch(u.branch)
              : u.branch;
          }
          if (u.role) AppState.userProfile.role = u.role;
          if (u.photo || u.avatar) {
            AppState.userProfile.photo = (u.photo || u.avatar);
          }
          if (typeof UI !== 'undefined' && UI.applyUserProfile) {
            UI.applyUserProfile();
          }
        }

        // Sinkronisasi data SystemConfig (Email & Jadwal) jika dikembalikan oleh database
        if (payload.config) {
          const c = payload.config;
          if (c.TARGET_EMAIL) {
            AppState.automationConfig.email = c.TARGET_EMAIL;
            AppState.automationConfig.emails = String(c.TARGET_EMAIL)
              .split(/[,;\n\s]+/)
              .map(e => e.trim())
              .filter(e => e.includes('@'));
          }
          if (c.AUTO_SCHEDULE_TEXT) {
            AppState.automationConfig.schedule = c.AUTO_SCHEDULE_TEXT;
          } else if (c.DAILY_REPORT_HOUR) {
            const h = String(c.DAILY_REPORT_HOUR).padStart(2, '0');
            AppState.automationConfig.schedule = 'Setiap Hari ' + h + ':00 WIB';
          }
          if (c.AUTO_EMAIL_ENABLED !== undefined) {
            AppState.automationConfig.enabled = String(c.AUTO_EMAIL_ENABLED).toUpperCase() === 'TRUE';
          }
          if (c.REPORT_DOCUMENT_TYPE) {
            AppState.automationConfig.type = c.REPORT_DOCUMENT_TYPE;
          }
          if (typeof UI !== 'undefined') {
            if (UI.applyAutomationConfig) UI.applyAutomationConfig();
            if (UI.updateNotificationTargetEmailDisplay) UI.updateNotificationTargetEmailDisplay();
            if (UI.syncSettingsPreferences) UI.syncSettingsPreferences();
          }
        }

        // Sinkronisasi data Target Email Per-Cabang (Tab UserPIC Kolom G)
        if (payload.branchEmails && typeof payload.branchEmails === 'object') {
          AppState.branchEmails = { ...AppState.branchEmails, ...payload.branchEmails };
        }

        // Sinkronisasi data User Akun dari database jika tersedia
        if (Array.isArray(payload.users) && payload.users.length > 0) {
          payload.users.forEach(u => {
            if (u.username && u.targetEmail) {
              AppState.branchEmails[u.username] = u.targetEmail;
            }
          });
        }

        if (typeof AppState.updateKpiCounts === 'function') {
          AppState.updateKpiCounts();
        }
        AppState.saveToCache();
        if (typeof UI !== 'undefined' && UI.updateNotificationTargetEmailDisplay) {
          UI.updateNotificationTargetEmailDisplay();
        }
        return true;
      }
    } catch (e) {
      console.warn('[ApiService] Menggunakan data lokal (Server belum terhubung/offline):', e);
    }
    return false;
  },

  /**
   * Menyimpan data mutasi hasil pemindaian VIN ke Google Spreadsheet & Google Drive
   */
  async saveMutation(mutationRecord) {
    try {
      // Backend Google Apps Script resmi menggunakan action 'recordMutation'
      const defaultBranch = mutationRecord.noBa || 'D660 - Ahmad Yani';
      const payload = { 
        ...mutationRecord,
        docType: mutationRecord.docType || 'SPP DC',
        doc_type: mutationRecord.docType || 'SPP DC',
        noBa: defaultBranch,
        no_ba: defaultBranch,
        cabang: defaultBranch,
        branch: defaultBranch
      };
      let res = await this.request('recordMutation', 'POST', payload);
      if (res && res.success) {
        return res;
      }
      // Fallback jika backend Apps Script versi lama menggunakan action 'saveMutation' atau 'addMutation'
      if (!res || !res.success) {
        const fallbackRes = await this.request('saveMutation', 'POST', payload);
        if (fallbackRes && fallbackRes.success) return fallbackRes;
      }
      return res;
    } catch (e) {
      console.error('[ApiService] Gagal menyimpan mutasi ke spreadsheet:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Memperbarui profil petugas di database Google Sheets (tab UserPIC)
   */
  async updateProfile(profileData) {
    try {
      return await this.request('updateProfile', 'POST', profileData);
    } catch (e) {
      console.error('[ApiService] Gagal update profil di server:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Memperbarui konfigurasi otomatisasi laporan di database Google Sheets (tab SystemConfig)
   */
  async updateConfig(configData) {
    try {
      return await this.request('updateConfig', 'POST', configData);
    } catch (e) {
      console.error('[ApiService] Gagal update config di server:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Memperbarui target email per-cabang di database Google Sheets (tab UserPIC Kolom G)
   */
  async updateBranchTargetEmail(branchOrUsername, emailStr) {
    try {
      return await this.request('updateBranchTargetEmail', 'POST', {
        branch: branchOrUsername,
        username: branchOrUsername,
        email: emailStr,
        TARGET_EMAIL: emailStr
      });
    } catch (e) {
      console.error('[ApiService] Gagal update target email cabang di server:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Mengambil seluruh data inventory terbaru
   */
  async getInventory() {
    return await this.request('getInventory', 'GET');
  },

  /**
   * Mengambil riwayat mutasi audit
   */
  async getHistory() {
    return await this.request('getHistory', 'GET');
  },

  /**
   * Memicu pengiriman laporan email nyata dari Google Apps Script ke target email penerima
   */
  async triggerEmailReport(targetEmail = null) {
    try {
      const email = targetEmail || AppState.automationConfig?.email || '';
      let res = await this.request('triggerReportEmail', 'POST', { email: email, action: 'triggerReportEmail' });
      if (res && (res.success || !res.error)) return res;
      
      // Fallback aliases
      res = await this.request('sendReportEmail', 'POST', { email: email, action: 'sendReportEmail' });
      if (res && (res.success || !res.error)) return res;

      res = await this.request('triggerManualReport', 'POST', { email: email, action: 'triggerManualReport' });
      return res;
    } catch (e) {
      console.error('[ApiService] Gagal memicu pengiriman laporan email:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * Mengambil konfigurasi sistem terbaru dari backend Google Apps Script
   */
  async getConfig() {
    try {
      return await this.request('getConfig', 'GET');
    } catch (e) {
      console.warn('[ApiService] Gagal mengambil konfigurasi sistem:', e);
      return null;
    }
  },

  /**
   * Pemeriksaan kesehatan menyeluruh (Vercel Reverse Proxy dan Google Apps Script Direct)
   */
  async checkHealth() {
    const endpointInfo = CONFIG.getActiveEndpoint ? CONFIG.getActiveEndpoint() : { url: '/api/proxy', isProxy: true, mode: 'proxy' };
    const directUrl = (typeof localStorage !== 'undefined' ? localStorage.getItem(CONFIG.CACHE_KEYS?.DIRECT_URL || 'daihatsu_direct_appscript_url') : '') || '';

    // 1. Jika mode Direct URL aktif
    if (endpointInfo.mode === 'direct' && endpointInfo.url) {
      try {
        const pingUrl = endpointInfo.url + (endpointInfo.url.includes('?') ? '&' : '?') + 'action=health&ts=' + Date.now();
        const res = await fetch(pingUrl, {
          method: 'GET',
          mode: 'cors',
          redirect: 'follow'
        });
        const text = await res.text();
        let json = {};
        try { json = JSON.parse(text); } catch (e) { json = { success: res.ok, status: 'online' }; }

        if (res.ok && json.success !== false) {
          return {
            success: true,
            proxyStatus: 'ACTIVE',
            mode: 'direct',
            hasAppScriptUrl: true,
            appScriptHost: 'script.google.com (Direct)',
            targetEmail: json.targetEmail || AppState.automationConfig?.email,
            spreadsheetName: json.spreadsheetName || 'Stockyard Database',
            timestamp: json.timestamp || new Date().toISOString()
          };
        }
      } catch (err) {
        console.warn('[ApiService] Direct health check error:', err);
      }
    }

    // 2. Mode Vercel Reverse Proxy (/api/proxy)
    try {
      const res = await fetch('/api/proxy?action=health', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.hasAppScriptUrl) {
          return {
            success: true,
            proxyStatus: 'ACTIVE',
            mode: 'proxy',
            hasAppScriptUrl: true,
            appScriptHost: data.appScriptHost || 'Google Apps Script',
            targetEmail: AppState.automationConfig?.email,
            tip: data.tip
          };
        } else {
          // Proxy aktif namun APPSCRIPT_URL belum diset di Vercel env
          // Cek apakah ada direct URL fallback yang tersimpan
          if (directUrl && directUrl.startsWith('http')) {
            const directTest = await this.testConnection(directUrl);
            if (directTest && directTest.success) {
              return {
                success: true,
                proxyStatus: 'ACTIVE',
                mode: 'direct',
                hasAppScriptUrl: true,
                appScriptHost: 'script.google.com (Direct Fallback)',
                targetEmail: AppState.automationConfig?.email
              };
            }
          }

          return {
            success: false,
            proxyStatus: 'ENV_APPSCRIPT_MISSING',
            mode: 'proxy',
            hasAppScriptUrl: false,
            tip: data?.tip || 'Variabel APPSCRIPT_URL belum aktif di Vercel. Anda dapat memasukkan URL Web App langsung.'
          };
        }
      }
    } catch (errProxy) {
      console.warn('[ApiService] Proxy check failed (offline or localhost):', errProxy.message);
    }

    // 3. Fallback: Jika proxy 404/500 (misal di localhost/preview), coba cek directUrl jika ada
    if (directUrl && directUrl.startsWith('http')) {
      const directTest = await this.testConnection(directUrl);
      if (directTest && directTest.success) {
        return {
          success: true,
          proxyStatus: 'ACTIVE',
          mode: 'direct',
          hasAppScriptUrl: true,
          appScriptHost: 'script.google.com (Direct)',
          targetEmail: AppState.automationConfig?.email
        };
      }
    }

    return {
      success: false,
      proxyStatus: 'OFFLINE',
      mode: endpointInfo.mode || 'unknown',
      hasAppScriptUrl: false,
      error: 'Tidak dapat menjangkau server Google Apps Script atau Vercel Proxy.'
    };
  },

  /**
   * Simpan URL Web App Google Apps Script langsung di browser
   */
  saveDirectAppScriptUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http')) return false;

    try {
      const key = CONFIG.CACHE_KEYS?.DIRECT_URL || 'daihatsu_direct_appscript_url';
      localStorage.setItem(key, cleanUrl);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Hapus Direct URL dan kembali ke Vercel Reverse Proxy
   */
  clearDirectAppScriptUrl() {
    try {
      const key = CONFIG.CACHE_KEYS?.DIRECT_URL || 'daihatsu_direct_appscript_url';
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Menguji status koneksi live layanan email & Google Apps Script
   */
  async checkEmailConnection() {
    try {
      const health = await this.checkHealth();
      const targetEmail = health.targetEmail || AppState.automationConfig?.email || 'admin.logistics@daihatsu.co.id';
      const isOnline = health && health.success === true;

      return {
        success: isOnline,
        proxyStatus: health?.proxyStatus || 'OFFLINE',
        mode: health?.mode || 'proxy',
        hasAppScriptUrl: !!health?.hasAppScriptUrl,
        host: health?.appScriptHost || 'Google Apps Script',
        targetEmail: targetEmail,
        details: health,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      console.error('[ApiService] checkEmailConnection error:', e);
      return {
        success: false,
        error: e.message || 'Kesalahan memeriksa koneksi',
        targetEmail: AppState.automationConfig?.email || 'admin.logistics@daihatsu.co.id'
      };
    }
  }
};

window.ApiService = ApiService;
