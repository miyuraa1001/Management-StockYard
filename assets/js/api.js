/**
 * ============================================================================
 * API Service Module - Daihatsu Vehicle Logistics Tracker
 * ============================================================================
 * Menghubungkan antarmuka frontend dengan backend Google Apps Script / Vercel Proxy.
 */

const ApiService = {
  /**
   * Mengirim request HTTP dengan mode proxy atau direct ke Google Apps Script
   */
  async request(action, method = 'GET', data = null) {
    const isProxy = CONFIG.API_MODE === 'proxy' || (!CONFIG.DIRECT_APPSCRIPT_URL && CONFIG.API_MODE !== 'mock');
    let url = isProxy ? CONFIG.PROXY_ENDPOINT : CONFIG.DIRECT_APPSCRIPT_URL;

    // Jika mode mock atau endpoint belum diset sama sekali, return mock fallback
    if (CONFIG.API_MODE === 'mock' || (!url && !isProxy)) {
      console.log(`[ApiService] Mode Mock/Offline: Menjalankan action '${action}' secara lokal.`);
      return { success: true, isMock: true };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

    try {
      let options = {
        method: method,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      };

      if (method === 'GET') {
        const queryParams = new URLSearchParams({ action: action });
        if (!isProxy && CONFIG.API_TOKEN) {
          queryParams.append('token', CONFIG.API_TOKEN);
        }
        url += (url.includes('?') ? '&' : '?') + queryParams.toString();
      } else {
        options.headers['Content-Type'] = 'application/json';
        const payload = {
          action: action,
          data: data,
          timestamp: new Date().toISOString()
        };
        if (!isProxy && CONFIG.API_TOKEN) {
          payload.token = CONFIG.API_TOKEN;
        }
        options.body = JSON.stringify(payload);
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[ApiService] Gagal request ke server (${action}):`, err.message);
      // Return safe fallback agar UI tetap responsif
      return {
        success: false,
        error: err.message,
        isFallback: true
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
          AppState.inventoryData = res.data.inventory;
        }
        if (Array.isArray(res.data.history) && res.data.history.length > 0) {
          AppState.historyData = res.data.history;
        }
        if (res.data.kpi) {
          AppState.kpi = res.data.kpi;
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
   * Menyimpan data mutasi hasil pemindaian VIN ke Google Spreadsheet
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

