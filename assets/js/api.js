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
        if (Array.isArray(res.data.inventory) && res.data.inventory.length > 0) {
          AppState.inventoryData = res.data.inventory.map(item => ({
            ...item,
            model: item.model || item.name || '',
            name: item.name || item.model || '',
            stockYard: parseInt(item.stockYard != null ? item.stockYard : (item.inYard || 0), 10) || 0,
            stockTransit: parseInt(item.stockTransit != null ? item.stockTransit : (item.inTransit || 0), 10) || 0,
            status: (parseInt(item.stockYard != null ? item.stockYard : 0, 10) > 0) ? 'In-Yard' : 'Kosong'
          }));
        }
        if (Array.isArray(res.data.history)) {
          AppState.historyData = res.data.history;
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
  }
};

window.ApiService = ApiService;
