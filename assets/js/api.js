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
      if (res && res.success && res.data) {
        if (Array.isArray(res.data.inventory)) {
          AppState.inventoryData = res.data.inventory.map(item => ({
            ...item,
            model: item.model || item.name || '',
            name: item.name || item.model || '',
            stockYard: parseInt(item.stockYard != null ? item.stockYard : (item.inYard || 0), 10) || 0,
            stockTransit: parseInt(item.stockTransit != null ? item.stockTransit : (item.inTransit || 0), 10) || 0,
            status: (parseInt(item.stockYard != null ? item.stockYard : 0, 10) > 0) ? 'Tersedia' : 'Kosong'
          }));
        }
        if (Array.isArray(res.data.history)) {
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

          AppState.historyData = res.data.history.map(item => {
            let d = item.date;
            let m = item.month;
            let y = item.year;

            if ((!d || !m || !y) && item.timestamp) {
              try {
                const dt = new Date(item.timestamp);
                if (!isNaN(dt.getTime())) {
                  d = d || dt.getDate();
                  m = m || (dt.getMonth() + 1);
                  y = y || dt.getFullYear();
                }
              } catch (e) {}
            }

            if ((!d || !m || !y) && item.fullDateStr) {
              const str = String(item.fullDateStr).trim();
              if (str.includes('/')) {
                const parts = str.split('/');
                if (parts.length === 3) {
                  d = d || parseInt(parts[0], 10);
                  m = m || parseInt(parts[1], 10);
                  y = y || parseInt(parts[2], 10);
                }
              } else {
                const parts = str.split(/\s+/);
                if (parts.length >= 3) {
                  d = d || parseInt(parts[0], 10);
                  const mName = parts[1].toLowerCase();
                  m = m || monthMap[mName] || 1;
                  y = y || parseInt(parts[2], 10);
                }
              }
            }

            return {
              ...item,
              date: d ? parseInt(d, 10) : new Date().getDate(),
              month: m ? parseInt(m, 10) : (new Date().getMonth() + 1),
              year: y ? parseInt(y, 10) : new Date().getFullYear(),
              unitPhoto: formatDriveThumb(item.unitPhoto),
              docPhoto: formatDriveThumb(item.docPhoto)
            };
          });
        }
        // Sinkronisasi data User PIC jika dikembalikan oleh database
        if (res.data.user) {
          const u = res.data.user;
          if (u.name) AppState.userProfile.name = u.name;
          if (u.npk) AppState.userProfile.npk = u.npk;
          if (u.branch) AppState.userProfile.branch = u.branch;
          if (u.role) AppState.userProfile.role = u.role;
          if (u.photo) {
            AppState.userProfile.photo = formatDriveThumb(u.photo);
          }
          if (typeof UI !== 'undefined' && UI.applyUserProfile) {
            UI.applyUserProfile();
          }
        }

        // Sinkronisasi data SystemConfig (Email & Jadwal) jika dikembalikan oleh database
        if (res.data.config) {
          const c = res.data.config;
          if (c.TARGET_EMAIL) AppState.automationConfig.email = c.TARGET_EMAIL;
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
            if (UI.syncSettingsPreferences) UI.syncSettingsPreferences();
          }
        }

        if (typeof AppState.updateKpiCounts === 'function') {
          AppState.updateKpiCounts();
        }
        AppState.saveToCache();
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
      const res = await this.request('saveMutation', 'POST', mutationRecord);
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
      return await this.request('triggerManualReport', 'POST', { email: email });
    } catch (e) {
      console.error('[ApiService] Gagal memicu pengiriman laporan email:', e);
      return { success: false, error: e.message };
    }
  }
};

window.ApiService = ApiService;
