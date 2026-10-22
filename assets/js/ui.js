/**
 * ============================================================================
 * UI & Render Service Module - Daihatsu Vehicle Logistics Tracker
 * ============================================================================
 * Menangani rendering komponen visual, navigasi tab, pemfilteran data,
 * modal dialog, dan toast notifications.
 */

const UI = {
  toastTimeout: null,

  /**
   * Mengganti tab tampilan utama
   */
  switchTab(tabName) {
    const tabs = ['dashboard', 'inventory', 'history', 'settings'];
    const target = tabName.toLowerCase();
    AppState.currentTab = target;

    const detailView = document.getElementById('viewModelDetail');
    if (detailView && target !== 'modeldetail') {
      detailView.classList.add('hidden');
    }

    tabs.forEach(t => {
      const viewEl = document.getElementById(`view${this.capitalize(t)}`);
      const btnEl = document.getElementById(`nav-${t}`);
      const deskBtnEl = document.getElementById(`desk-nav-${t}`);

      if (viewEl) {
        if (t === target) {
          viewEl.classList.remove('hidden');
        } else {
          viewEl.classList.add('hidden');
        }
      }

      const isNavActive = (t === target) || (target === 'modeldetail' && t === 'inventory');
      if (btnEl) {
        if (isNavActive) {
          btnEl.classList.add('active');
        } else {
          btnEl.classList.remove('active');
        }
      }

      if (deskBtnEl) {
        if (isNavActive) {
          deskBtnEl.classList.add('active');
        } else {
          deskBtnEl.classList.remove('active');
        }
      }
    });

    if (target === 'dashboard') {
      if (typeof this.applyDashboardDateFilter === 'function') {
        this.applyDashboardDateFilter();
      }
      this.renderDashboardActivities();
      this.updateDashboardKpis();
      if (typeof this.startHeroAutoScroll === 'function') {
        this.startHeroAutoScroll();
      }
    } else {
      if (typeof this.stopHeroAutoScroll === 'function') {
        this.stopHeroAutoScroll();
      }
    }
    if (target === 'inventory') this.renderInventoryList();
    if (target === 'history') this.renderHistoryList();
    if (target === 'settings') {
      if (typeof this.checkCloudHealth === 'function') {
        this.checkCloudHealth();
      }
      if (typeof this.applyUserProfile === 'function') {
        this.applyUserProfile();
      }
      if (typeof this.syncSettingsPreferences === 'function') {
        this.syncSettingsPreferences();
      }
    }

    // Trigger realtime sync di background saat berganti menu
    if (window.App && typeof App.syncBackendData === 'function') {
      App.syncBackendData(true);
    }

    const vp = document.getElementById('appMainViewport');
    if (vp) vp.scrollTop = 0;

    if (typeof this.refreshScrollReveal === 'function') {
      this.refreshScrollReveal();
    }
  },

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Render kartu KPI ringkasan mutasi di beranda
   */
  updateDashboardKpis() {
    if (typeof AppState.updateKpiCounts === 'function') {
      AppState.updateKpiCounts();
    }

    const kpiMasuk = document.getElementById('kpiMasukVal');
    const kpiKeluar = document.getElementById('kpiKeluarVal');
    const kpiTotalStok = document.getElementById('kpiTotalStokVal') || document.getElementById('kpiIntransitVal');

    if (kpiMasuk) kpiMasuk.innerText = AppState.kpi.masuk;
    if (kpiKeluar) kpiKeluar.innerText = AppState.kpi.keluar;
    if (kpiTotalStok) kpiTotalStok.innerText = AppState.kpi.totalStok;

    if (typeof this.renderDashboardDonut === 'function') {
      this.renderDashboardDonut();
    }
    if (typeof this.updateDashboardYardStatus === 'function') {
      this.updateDashboardYardStatus();
    }
    if (typeof this.updateHeroSlidesData === 'function') {
      this.updateHeroSlidesData();
    }
  },

  /**
   * Format kode / nama cabang resmi (misal: "D660" -> "D660 - Ahmad Yani")
   */
  formatBranchName(ba) {
    if (typeof CONFIG !== 'undefined' && typeof CONFIG.formatBranch === 'function') {
      return CONFIG.formatBranch(ba);
    }
    if (!ba) return 'D660 - Ahmad Yani';
    const s = String(ba).trim();
    if (s.includes(' - ')) return s;
    const map = {
      'D660': 'D660 - Ahmad Yani',
      'D661': 'D661 - Soekarno Hatta',
      'D662': 'D662 - Bandar Jaya',
      'D663': 'D663 - Lampung Utara',
      'D664': 'D664 - Lampung Timur'
    };
    return map[s.toUpperCase()] || s;
  },

  /**
   * Pengecekan kecocokan filter cabang (mendukung kode "D660", nama cabang, atau gabungan)
   */
  isBranchMatch(itemBa, filterBa) {
    if (!filterBa || filterBa === 'all') return true;
    const rawItem = String(itemBa || 'D660 - Ahmad Yani').toUpperCase();
    const rawFilter = String(filterBa).toUpperCase();

    const filterCode = rawFilter.match(/D66[0-4]/);
    const itemCode = rawItem.match(/D66[0-4]/);
    if (filterCode && itemCode) {
      return filterCode[0] === itemCode[0];
    }
    return rawItem.includes(rawFilter) || rawFilter.includes(rawItem);
  },

  /**
   * Mengambil data riwayat mutasi yang sedang difilter khusus untuk Dashboard
   */
  getFilteredDashboardData() {
    const fDate = document.getElementById('dashFilterDate')?.value || 'all';
    const fMonth = document.getElementById('dashFilterMonth')?.value || 'all';
    const fYear = document.getElementById('dashFilterYear')?.value || 'all';
    const fBa = document.getElementById('dashFilterBa')?.value || 'all';

    const filtered = (AppState.historyData || []).filter(item => {
      const parts = this.parseItemDate(item);
      const dateMatch = (fDate === 'all') || (parts.date === String(fDate));
      const monthMatch = (fMonth === 'all') || (parts.month === String(fMonth));
      const yearMatch = (fYear === 'all') || (parts.year === String(fYear));
      const baMatch = this.isBranchMatch(item.noBa, fBa);
      return dateMatch && monthMatch && yearMatch && baMatch;
    });

    return { filtered, fDate, fMonth, fYear, fBa };
  },

  /**
   * Inisialisasi awal filter Dashboard agar otomatis menampilkan hari ini
   */
  initDashboardDateFilter() {
    const now = new Date();
    const todayDate = String(now.getDate());
    const todayMonth = String(now.getMonth() + 1);
    const todayYear = String(now.getFullYear());

    const d = document.getElementById('dashFilterDate');
    const m = document.getElementById('dashFilterMonth');
    const y = document.getElementById('dashFilterYear');

    if (d && (!d.value || d.value === 'all')) d.value = todayDate;
    if (m && (!m.value || m.value === 'all')) m.value = todayMonth;
    if (y && (!y.value || y.value === 'all')) y.value = todayYear;

    if (typeof this.initCustomDropdowns === 'function') {
      this.initCustomDropdowns();
    }
    this.applyDashboardDateFilter();
  },

  /**
   * Terapkan filter tanggal dashboard & perbarui semua indikator & list aktivitas
   */
  applyDashboardDateFilter() {
    const { filtered, fDate, fMonth, fYear } = this.getFilteredDashboardData();

    // 1. Update status badge & deskripsi di card filter dashboard
    const badgeEl = document.getElementById('dashPeriodStatusBadge');
    const descEl = document.getElementById('dashPeriodDesc');

    const totalMutasi = filtered.length;
    const shortMonths = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const now = new Date();
    const isToday = (fDate === String(now.getDate()) && fMonth === String(now.getMonth() + 1) && fYear === String(now.getFullYear()));

    if (badgeEl) {
      if (isToday) {
        badgeEl.textContent = `Hari Ini (${now.getDate()} ${shortMonths[now.getMonth() + 1]} ${now.getFullYear()})`;
        badgeEl.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-blue-50 text-blue-600 border border-blue-200/80 leading-none';
      } else if (fDate === 'all' && fMonth === 'all' && fYear === 'all') {
        badgeEl.textContent = 'Semua Waktu';
        badgeEl.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 leading-none';
      } else {
        const dStr = fDate === 'all' ? 'Semua Tgl' : `Tgl ${fDate}`;
        const mStr = fMonth === 'all' ? 'Semua Bln' : shortMonths[parseInt(fMonth, 10)] || fMonth;
        const yStr = fYear === 'all' ? '' : fYear;
        badgeEl.textContent = `${dStr} ${mStr} ${yStr}`.trim();
        badgeEl.className = 'inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/80 leading-none';
      }
    }

    if (descEl) {
      if (isToday) {
        descEl.textContent = totalMutasi > 0
          ? `Menampilkan ${totalMutasi} log mutasi unit tercatat hari ini.`
          : 'Belum ada transaksi mutasi tercatat hari ini.';
      } else if (fDate === 'all' && fMonth === 'all' && fYear === 'all') {
        descEl.textContent = `Menampilkan seluruh riwayat audit (${totalMutasi} transaksi) di pool yard.`;
      } else {
        descEl.textContent = `Menampilkan ${totalMutasi} transaksi mutasi pada periode yang dipilih.`;
      }
    }

    // 2. Re-render aktivitas mutasi terbaru sesuai filter tanggal
    this.renderDashboardActivities();

    // 3. Re-render Distribusi Donut & KPI agar data unit masuk langsung terbaca
    this.updateDashboardKpis();
  },

  /**
   * Setel filter dashboard kembali ke Hari Ini
   */
  setDashboardDateFilterToToday() {
    const now = new Date();
    const d = document.getElementById('dashFilterDate');
    const m = document.getElementById('dashFilterMonth');
    const y = document.getElementById('dashFilterYear');
    if (d) d.value = String(now.getDate());
    if (m) m.value = String(now.getMonth() + 1);
    if (y) y.value = String(now.getFullYear());
    if (typeof this.initCustomDropdowns === 'function') {
      this.initCustomDropdowns();
    }
    this.applyDashboardDateFilter();
    this.showToast('Filter dashboard disetel ke Hari Ini');
  },

  /**
   * Reset filter dashboard ke Semua Waktu
   */
  resetDashboardDateFilter() {
    const d = document.getElementById('dashFilterDate');
    const m = document.getElementById('dashFilterMonth');
    const y = document.getElementById('dashFilterYear');
    const b = document.getElementById('dashFilterBa');
    if (d) d.value = 'all';
    if (m) m.value = 'all';
    if (y) y.value = 'all';
    if (b) b.value = 'all';
    if (typeof this.initCustomDropdowns === 'function') {
      this.initCustomDropdowns();
    }
    this.applyDashboardDateFilter();
    this.showToast('Filter dashboard di-reset (Semua Waktu & BA)');
  },

  setDashboardDateFilterToAll() {
    this.resetDashboardDateFilter();
  },

  /**
   * Render aktivitas mutasi terbaru di Dashboard sesuai filter tanggal
   * Didesain khusus agar sangat rapi, proporsional, dan tidak berantakan di layar mobile
   */
  renderDashboardActivities() {
    const container = document.getElementById('dashboardRecentList');
    if (!container) return;

    const { filtered, fDate, fMonth, fYear } = this.getFilteredDashboardData();
    const recentItems = filtered.slice(0, 8);
    if (recentItems.length === 0) {
      const now = new Date();
      const shortMonths = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      let periodLabel = 'hari ini';
      if (fDate === String(now.getDate()) && fMonth === String(now.getMonth() + 1) && fYear === String(now.getFullYear())) {
        periodLabel = `hari ini (${now.getDate()} ${shortMonths[now.getMonth() + 1]} ${now.getFullYear()})`;
      } else if (fDate === 'all' && fMonth === 'all' && fYear === 'all') {
        periodLabel = 'semua riwayat';
      } else {
        const dStr = fDate === 'all' ? 'Semua Tgl' : `Tgl ${fDate}`;
        const mStr = fMonth === 'all' ? 'Semua Bln' : shortMonths[parseInt(fMonth, 10)] || fMonth;
        const yStr = fYear === 'all' ? '' : fYear;
        periodLabel = `${dStr} ${mStr} ${yStr}`.trim();
      }

      container.innerHTML = `
        <div class="col-span-full py-8 px-4 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
          <div class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2 border border-blue-100 shadow-2xs">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <p class="text-xs sm:text-sm font-extrabold text-slate-800">Belum ada aktivitas mutasi untuk ${periodLabel}</p>
          <p class="text-[11px] text-slate-400 mt-1">Belum ada unit masuk atau keluar yang tercatat pada periode ini.</p>
          <div class="flex items-center justify-center gap-2 mt-3.5">
            <button type="button" onclick="UI.resetDashboardDateFilter()" class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition cursor-pointer shadow-xs active:scale-95">
              <span>Tampilkan Semua Data</span>
            </button>
            <button type="button" onclick="switchTab('scanner')" class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/80 text-[11px] font-bold transition cursor-pointer active:scale-95">
              <span>+ Catat Mutasi Baru</span>
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = recentItems.map((item, idx) => {
      const isMasuk = item.type === 'Unit Masuk';
      const badgeColor = isMasuk 
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/90' 
        : 'bg-blue-50 text-blue-700 border-blue-200/90';
      const catalogItem = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(item.model) : null;
      const photoSrc = catalogItem ? catalogItem.photo : (item.modelPhoto || 'assets/images/Inventory_Gran Max Pick Up.jpeg');

      // Format Waktu & Tanggal ringkas & rapi untuk mobile
      let cleanTime = (item.time || '08:00').replace(/\s*WIB/i, '').trim();
      let cleanDate = '';
      if (item.date && item.month) {
        const shortMonths = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        const mStr = shortMonths[parseInt(item.month, 10)] || 'Okt';
        cleanDate = `${parseInt(item.date, 10)} ${mStr}`;
      } else if (item.fullDateStr) {
        cleanDate = item.fullDateStr
          .replace('Oktober', 'Okt').replace('September', 'Sep').replace('November', 'Nov')
          .replace('Desember', 'Des').replace('Januari', 'Jan').replace('Februari', 'Feb')
          .replace('Agustus', 'Agu').replace(/ 20\d\d/, '').trim();
      } else {
        cleanDate = 'Hari ini';
      }

      const dateTimeDisplay = `${cleanDate} • ${cleanTime}`;
      const delayMs = Math.min(idx * 40, 200);
      const rowId = item.id ? item.id.replace('MUT-', '') : String(idx + 1).padStart(2, '0');

      return `
        <div onclick="switchTab('history')" class="scroll-reveal bg-white hover:bg-slate-50/80 active:scale-[0.99] rounded-2xl p-2.5 sm:p-3 md:p-3.5 border border-slate-200/80 hover:border-blue-200 shadow-saas-card transition flex items-center gap-2.5 sm:gap-3.5 cursor-pointer group" style="--reveal-delay: ${delayMs}ms;">
          <!-- Foto Mobil Studio (Box Proporsional & Rapi) -->
          <div class="w-16 h-12 sm:w-20 sm:h-14 md:w-22 md:h-16 rounded-xl bg-slate-50/90 border border-slate-200/70 p-1 flex items-center justify-center flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200 overflow-hidden">
            <img src="${photoSrc}" alt="${item.model}" loading="lazy" decoding="async" class="w-full h-full object-contain">
          </div>

          <!-- Rincian Konten -->
          <div class="flex-1 min-w-0">
            <!-- Baris 1: Badge Mutasi + ID + Waktu Singkat -->
            <div class="flex items-center justify-between gap-1.5">
              <div class="flex items-center space-x-1.5 min-w-0">
                <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[8.5px] sm:text-[9.5px] font-bold border ${badgeColor} flex-shrink-0 leading-none">
                  <span class="w-1.5 h-1.5 rounded-full ${isMasuk ? 'bg-emerald-500' : 'bg-blue-500'}"></span>
                  <span>${item.type}</span>
                </span>
                <span class="text-[9px] font-mono font-bold text-slate-400 truncate">#${rowId}</span>
              </div>
              <span class="text-[9px] sm:text-[10px] font-semibold text-slate-400 whitespace-nowrap flex-shrink-0">${dateTimeDisplay}</span>
            </div>

            <!-- Baris 2: Nama Model & Kategori -->
            <div class="mt-1 flex items-baseline justify-between gap-1">
              <h4 class="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight truncate">${item.model}</h4>
              <span class="hidden sm:inline text-[9.5px] font-semibold text-slate-400 truncate flex-shrink-0">${catalogItem ? catalogItem.category : 'Unit Daihatsu'}</span>
            </div>

            <!-- Baris 3: VIN Tag Monospace + No. BA D660 + Badge Valid -->
            <div class="flex items-center justify-between gap-1.5 mt-1 pt-1 border-t border-slate-100/90">
              <div class="inline-flex items-center space-x-1.5 font-mono text-[9px] sm:text-[10px] text-slate-600 min-w-0 truncate">
                <span class="inline-flex items-center space-x-1 truncate">
                  <span class="text-[8px] font-bold text-slate-400 uppercase tracking-wider select-none">VIN</span>
                  <span class="font-extrabold text-slate-800 truncate">${item.vin || '-'}</span>
                </span>
                <span class="inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200/80 font-mono text-[8px] sm:text-[8.5px] font-black truncate flex-shrink-0" title="Cabang: ${this.formatBranchName(item.noBa)}">
                  <span class="text-[7px] text-amber-600 font-bold uppercase">Cabang:</span>
                  <span>${this.formatBranchName(item.noBa)}</span>
                </span>
              </div>
              <span class="inline-flex items-center space-x-0.5 text-[8.5px] sm:text-[9.5px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70 flex-shrink-0 leading-none">
                <svg class="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                <span>Valid</span>
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (typeof this.refreshScrollReveal === 'function') {
      this.refreshScrollReveal();
    }
  },

  /**
   * Render katalog & stok inventory 13 model kendaraan Daihatsu
   * Menampilkan seluruh jenis mobil & foto resminya walaupun stok masih kosong (0 unit)
   */
  renderInventoryList() {
    const container = document.getElementById('inventoryContainer');
    const searchInput = document.getElementById('inventorySearchInput');
    const clearBtn = document.getElementById('inventorySearchClearBtn');
    const searchVal = (searchInput?.value || '').toLowerCase().trim();

    if (clearBtn) {
      if (searchVal.length > 0) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }

    if (!container) return;

    const catalog = AppState.vehicleCatalog || [];
    const fBa = document.getElementById('invFilterBa')?.value || 'all';

    // Gabungkan data katalog 13 model dengan stok unit fisik aktual di AppState.inventoryData & riwayat mutasi
    const hasRealHistory = (AppState.historyData || []).length > 0;
    const hasRealInventory = (AppState.inventoryData || []).length > 0;

    const catalogWithStock = catalog.map(cat => {
      const units = (AppState.inventoryData || []).filter(u => {
        if (!u) return false;
        const uModel = String(u.model || u.name || '').toLowerCase();
        if (uModel !== cat.model.toLowerCase()) {
          const matched = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(uModel) : null;
          if (!matched || matched.catalogId !== cat.catalogId) return false;
        }
        if (!this.isBranchMatch(u.noBa, fBa)) {
          return false;
        }
        return true;
      });

      // Hitung dari data stok spreadsheet
      const sheetYardStock = units.reduce((acc, u) => acc + (parseInt(u.stockYard, 10) || 0), 0);
      const unitInYard = units.filter(u => typeof u.stockYard !== 'number' && (u.status === 'In-Yard' || u.status === 'Tersedia' || !u.status)).length;

      // Cek mutasi masuk & keluar dari riwayat audit
      const matchingHistory = (AppState.historyData || []).filter(h => {
        if (!h || !h.model) return false;
        const hModel = String(h.model || '').toLowerCase();
        if (hModel !== cat.model.toLowerCase()) {
          const matched = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(hModel) : null;
          if (!matched || matched.catalogId !== cat.catalogId) return false;
        }
        if (!this.isBranchMatch(h.noBa, fBa)) {
          return false;
        }
        return true;
      });

      const histMasuk = matchingHistory.filter(h => h.type === 'Unit Masuk').length;
      const histKeluar = matchingHistory.filter(h => h.type === 'Unit Keluar').length;
      const netFromHistory = Math.max(0, histMasuk - histKeluar);
      const totalUnits = Math.max(sheetYardStock + unitInYard, netFromHistory);

      return {
        ...cat,
        units,
        totalUnits,
        histMasuk,
        histKeluar,
        primaryUnit: units[0] || null
      };
    });

    // Update KPI Ringkasan Inventory (Total Stok, Stok Masuk, Stok Keluar, Stok Kosong)
    const sumTotal = catalogWithStock.reduce((acc, item) => acc + item.totalUnits, 0);
    const sumMasuk = catalogWithStock.reduce((acc, item) => acc + item.histMasuk, 0);
    const sumKeluar = catalogWithStock.reduce((acc, item) => acc + item.histKeluar, 0);
    const countKosong = catalogWithStock.filter(item => item.totalUnits === 0).length;

    const elTotal = document.getElementById('invKpiTotalUnits');
    const elMasuk = document.getElementById('invKpiMasukUnits');
    const elKeluar = document.getElementById('invKpiKeluarUnits');
    const elKosong = document.getElementById('invKpiKosongUnits');

    if (elTotal) elTotal.textContent = sumTotal;
    if (elMasuk) elMasuk.textContent = sumMasuk;
    if (elKeluar) elKeluar.textContent = sumKeluar;
    if (elKosong) elKosong.textContent = countKosong;

    // Update Counter pada Filter Chips
    const chipCounts = {
      'all': catalogWithStock.length,
      'Total-Stok': catalogWithStock.filter(e => e.totalUnits > 0).length,
      'Stok-Masuk': catalogWithStock.filter(e => e.histMasuk > 0).length,
      'Stok-Keluar': catalogWithStock.filter(e => e.histKeluar > 0).length,
      'Kosong': countKosong
    };
    Object.keys(chipCounts).forEach(key => {
      const badge = document.getElementById(`chipCount-${key}`);
      if (badge) badge.textContent = chipCounts[key];
    });

    // Filter berdasarkan chip status & pencarian kata kunci
    const filtered = catalogWithStock.filter(entry => {
      let matchesStatus = true;
      if (AppState.inventoryFilter === 'Total-Stok') matchesStatus = entry.totalUnits > 0;
      else if (AppState.inventoryFilter === 'Stok-Masuk') matchesStatus = entry.histMasuk > 0;
      else if (AppState.inventoryFilter === 'Stok-Keluar') matchesStatus = entry.histKeluar > 0;
      else if (AppState.inventoryFilter === 'Kosong') matchesStatus = entry.totalUnits === 0;

      if (!searchVal) return matchesStatus;

      const matchesCatalog =
        entry.model.toLowerCase().includes(searchVal) ||
        entry.category.toLowerCase().includes(searchVal) ||
        entry.spec.toLowerCase().includes(searchVal) ||
        entry.defaultLocation.toLowerCase().includes(searchVal) ||
        entry.catalogId.toLowerCase().includes(searchVal);

      const matchesUnit = entry.units.some(u =>
        (u.vin && u.vin.toLowerCase().includes(searchVal)) ||
        (u.plate && u.plate.toLowerCase().includes(searchVal)) ||
        (u.engine && u.engine.toLowerCase().includes(searchVal)) ||
        (u.noBa && u.noBa.toLowerCase().includes(searchVal))
      );

      return matchesStatus && (matchesCatalog || matchesUnit);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white/95 rounded-[26px] p-8 sm:p-10 text-center border border-white shadow-saas-card">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <p class="text-sm font-extrabold text-slate-700">Tidak ada model atau unit yang cocok</p>
          <p class="text-xs text-slate-400 mt-1">Coba kata kunci lain atau tekan tombol di bawah untuk menampilkan seluruh 13 model.</p>
          <button type="button" onclick="clearInventorySearch(); filterInventoryByStatus('all')" class="mt-4 inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer">
            Tampilkan Semua Model (13)
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((entry, idx) => {
      const isEmpty = entry.totalUnits === 0;

      let statusBadgeClass = 'bg-emerald-50/95 text-emerald-700 border-emerald-200/90';
      let statusDotClass = 'bg-emerald-500 animate-pulse';
      let statusLabel = `Total Stok: ${entry.totalUnits} Unit`;

      if (isEmpty) {
        statusBadgeClass = 'bg-rose-50/95 text-rose-700 border-rose-200/90';
        statusDotClass = 'bg-rose-500';
        statusLabel = 'Stok Kosong';
      }

      const u = entry.primaryUnit;
      const delayMs = Math.min((idx % 6) * 45, 200);

      return `
        <div class="scroll-reveal heavy-section-deferred bg-white/95 hover:bg-white rounded-[24px] sm:rounded-[26px] p-3.5 sm:p-4 border ${isEmpty ? 'border-rose-100/80' : 'border-white'} shadow-saas-card flex flex-col justify-between transition duration-300 group" style="--reveal-delay: ${delayMs}ms;">
          <div>
            <!-- Top Showroom Studio Image Stage (Proporsional & Bebas Terpotong di Desktop & Mobile) -->
            <div class="relative w-full aspect-[16/10] sm:aspect-[16/10] md:h-52 lg:h-56 rounded-2xl bg-gradient-to-b from-slate-50/80 via-white to-slate-50/95 border border-slate-100 flex items-center justify-center overflow-hidden cursor-pointer group/img" onclick="openImagePreviewModal('${entry.photo}')">
              <!-- Subtle Studio Floor Shadow -->
              <div class="absolute inset-x-10 sm:inset-x-12 bottom-3 h-3 rounded-full bg-slate-900/[0.05] blur-xs pointer-events-none"></div>

              <!-- Jenis Kendaraan Badge (Top-Left) -->
              <span class="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-full text-[9.5px] font-extrabold bg-slate-900/80 text-white backdrop-blur-md shadow-xs tracking-wide">
                ${entry.category}
              </span>

              <!-- Status Stok Badge (Top-Right: Total Stok / Stok Kosong) -->
              <span class="absolute top-2.5 right-2.5 z-10 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[9.5px] font-extrabold border backdrop-blur-sm shadow-2xs ${statusBadgeClass}">
                <span class="w-1.5 h-1.5 rounded-full ${statusDotClass}"></span>
                <span>${statusLabel}</span>
              </span>

              <!-- Official Studio Car Image (1:1 Square Fully Contained, Never Cropped) -->
              <img src="${entry.photo}" alt="${entry.model}" loading="lazy" decoding="async" class="w-full h-full object-contain p-2 sm:p-3 mix-blend-multiply transition-transform duration-500 select-none group-hover/img:scale-105">

              <!-- Bottom-Right Zoom Hint Pill -->
              <span class="absolute bottom-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/90 group-hover/img:bg-slate-900 text-slate-500 group-hover/img:text-white border border-slate-200/80 shadow-xs flex items-center justify-center transition" title="Perbesar Foto Katalog">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
              </span>
            </div>

            <!-- Model Title & Catalog ID (Klik untuk Buka Riwayat) -->
            <div class="mt-3 flex items-center justify-between gap-2 cursor-pointer hover:opacity-85 transition" onclick="openModelDetail('${entry.catalogId}')" title="Klik untuk membuka riwayat mutasi ${entry.model}">
              <h4 class="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate hover:text-blue-600 transition-colors">${entry.model}</h4>
              <span class="text-[9.5px] font-extrabold text-blue-600 bg-blue-50/90 px-2 py-0.5 rounded-lg border border-blue-200/70 flex-shrink-0">${entry.catalogId}</span>
            </div>

            <!-- Rincian Status Stok Per Model (3 Kolom: Stok Masuk, Stok Keluar, Total Stok - Bisa Dipencet) -->
            <div class="grid grid-cols-3 gap-1.5 sm:gap-2 mt-3 pt-2.5 border-t border-slate-100 text-center cursor-pointer hover:opacity-90 active:scale-[0.98] transition group/kpi" onclick="openModelDetail('${entry.catalogId}')" title="Klik untuk membuka rincian mutasi ${entry.model}">
              <div class="rounded-xl py-1.5 px-1.5 ${entry.histMasuk > 0 ? 'bg-emerald-50/75 border border-emerald-200/80' : 'bg-slate-50/80 border border-slate-100'}">
                <span class="text-[8.5px] sm:text-[9px] font-extrabold ${entry.histMasuk > 0 ? 'text-emerald-600' : 'text-slate-400'} uppercase tracking-wider flex items-center justify-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${entry.histMasuk > 0 ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
                  <span>Stok Masuk</span>
                </span>
                <span class="text-xs font-black ${entry.histMasuk > 0 ? 'text-emerald-700' : 'text-slate-400'} block mt-0.5">${entry.histMasuk} <span class="text-[9.5px] font-bold">Unit</span></span>
              </div>
              <div class="rounded-xl py-1.5 px-1.5 ${entry.histKeluar > 0 ? 'bg-blue-50/75 border border-blue-200/80' : 'bg-slate-50/80 border border-slate-100'}">
                <span class="text-[8.5px] sm:text-[9px] font-extrabold ${entry.histKeluar > 0 ? 'text-blue-600' : 'text-slate-400'} uppercase tracking-wider flex items-center justify-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${entry.histKeluar > 0 ? 'bg-blue-500' : 'bg-slate-300'}"></span>
                  <span>Stok Keluar</span>
                </span>
                <span class="text-xs font-black ${entry.histKeluar > 0 ? 'text-blue-700' : 'text-slate-400'} block mt-0.5">${entry.histKeluar} <span class="text-[9.5px] font-bold">Unit</span></span>
              </div>
              <div class="rounded-xl py-1.5 px-1.5 ${entry.totalUnits > 0 ? 'bg-slate-900 text-white' : 'bg-rose-50/75 border border-rose-200/80'}">
                <span class="text-[8.5px] sm:text-[9px] font-extrabold ${entry.totalUnits > 0 ? 'text-slate-300' : 'text-rose-600'} uppercase tracking-wider flex items-center justify-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${entry.totalUnits > 0 ? 'bg-emerald-400' : 'bg-rose-500'}"></span>
                  <span>Total Stok</span>
                </span>
                <span class="text-xs font-black ${entry.totalUnits > 0 ? 'text-white' : 'text-rose-700'} block mt-0.5">${entry.totalUnits > 0 ? `${entry.totalUnits} <span class="text-[9.5px] font-bold">Unit</span>` : 'Kosong'}</span>
              </div>
            </div>

            <!-- Tombol Buka Rincian Mutasi Model -->
            <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
              <span class="font-bold text-slate-400 text-[9.5px] flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span>Audit Mutasi</span>
              </span>
              <button type="button" onclick="openModelDetail('${entry.catalogId}')" class="inline-flex items-center space-x-1 font-extrabold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/90 px-2.5 py-1 rounded-lg border border-blue-200/70 transition active:scale-95 cursor-pointer shadow-2xs">
                <span>Rincian Mutasi</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>

          <!-- Unit Info Footer (Hanya jika unit fisik spesifik terdaftar) -->
          ${!isEmpty && u && (u.plate || u.vin) ? `
            <div class="mt-2.5 pt-2 border-t border-slate-100">
              <div class="bg-slate-50/90 rounded-xl px-2.5 py-1.5 border border-slate-200/60 flex items-center justify-between gap-2 text-[10px]">
                <span class="font-extrabold px-2 py-0.5 rounded-md bg-white text-slate-800 border border-slate-200/90 shadow-2xs flex-shrink-0">${u.plate || '-'}</span>
                <span class="font-mono font-bold text-slate-600 truncate">VIN: ${u.vin}</span>
                ${u.engine ? `<span class="font-mono text-[9.5px] font-semibold text-slate-400 flex-shrink-0">${u.engine}</span>` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    if (typeof this.refreshScrollReveal === 'function') {
      this.refreshScrollReveal();
    }
  },

  filterInventory() {
    this.renderInventoryList();
  },

  clearInventorySearch() {
    const input = document.getElementById('inventorySearchInput');
    if (input) input.value = '';
    const ba = document.getElementById('invFilterBa');
    if (ba) ba.value = 'all';
    this.renderInventoryList();
  },

  filterInventoryByStatus(status) {
    AppState.inventoryFilter = status;
    const chips = ['all', 'Total-Stok', 'Stok-Masuk', 'Stok-Keluar', 'Kosong'];
    chips.forEach(c => {
      const chipEl = document.getElementById(`chip-${c}`);
      const countEl = document.getElementById(`chipCount-${c}`);
      if (chipEl) {
        if (c === status) {
          chipEl.className = 'inv-chip active px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white whitespace-nowrap shadow-xs flex items-center space-x-1.5 transition cursor-pointer';
          if (countEl) countEl.className = 'px-1.5 py-0.2 rounded-md text-[10px] font-extrabold bg-white/20 text-white';
        } else {
          chipEl.className = 'inv-chip px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 whitespace-nowrap flex items-center space-x-1.5 transition cursor-pointer';
          if (countEl) countEl.className = 'px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-slate-200/80 text-slate-600';
        }
      }
    });
    this.renderInventoryList();
  },

  /**
  /**
   * Helper untuk mengekstrak komponen tanggal, bulan, dan tahun dari item mutasi secara konsisten
   */
  parseItemDate(item) {
    let d = item.date;
    let m = item.month;
    let y = item.year;

    // 1. Ekstrak dari timestamp ISO jika ada
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

    // 2. Ekstrak dari fullDateStr (contoh: '15/10/2026' atau '15 Oktober 2026')
    if ((!d || !m || !y) && item.fullDateStr) {
      const str = String(item.fullDateStr).trim();
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
          d = d || parseInt(parts[0], 10);
          m = m || parseInt(parts[1], 10);
          y = y || parseInt(parts[2], 10);
        }
      } else if (str.includes('-')) {
        const parts = str.split('-');
        if (parts.length === 3) {
          d = d || parseInt(parts[0], 10);
          m = m || parseInt(parts[1], 10);
          y = y || parseInt(parts[2], 10);
        }
      } else {
        const parts = str.split(/\s+/);
        if (parts.length >= 3) {
          d = d || parseInt(parts[0], 10);
          const monthMap = {
            'januari': 1, 'februari': 2, 'maret': 3, 'april': 4, 'mei': 5, 'juni': 6,
            'juli': 7, 'agustus': 8, 'september': 9, 'oktober': 10, 'november': 11, 'desember': 12
          };
          const mName = parts[1].toLowerCase();
          m = m || monthMap[mName] || 1;
          y = y || parseInt(parts[2], 10);
        }
      }
    }

    // Fallback ke tanggal hari ini jika tidak terbaca
    if (!y) y = new Date().getFullYear();
    if (!m) m = new Date().getMonth() + 1;
    if (!d) d = new Date().getDate();

    return {
      date: String(d),
      month: String(m),
      year: String(y)
    };
  },

  /**
   * Mengambil data riwayat mutasi yang sedang difilter oleh pengguna
   */
  getFilteredHistoryData() {
    const fDate = document.getElementById('histFilterDate')?.value || 'all';
    const fMonth = document.getElementById('histFilterMonth')?.value || 'all';
    const fYear = document.getElementById('histFilterYear')?.value || 'all';
    const fBa = document.getElementById('histFilterBa')?.value || 'all';
    const searchInput = document.getElementById('historySearchInput');
    const searchVal = (searchInput?.value || '').toLowerCase().trim();

    // Filter tahap 1: Periode Waktu, Kode BA & Pencarian
    const baseFiltered = (AppState.historyData || []).filter(item => {
      const parts = this.parseItemDate(item);

      const dateMatch = (fDate === 'all') || (parts.date === String(fDate));
      const monthMatch = (fMonth === 'all') || (parts.month === String(fMonth));
      const yearMatch = (fYear === 'all') || (parts.year === String(fYear));
      const baMatch = this.isBranchMatch(item.noBa, fBa);

      if (!dateMatch || !monthMatch || !yearMatch || !baMatch) return false;

      if (!searchVal) return true;
      return (
        (item.model && item.model.toLowerCase().includes(searchVal)) ||
        (item.vin && item.vin.toLowerCase().includes(searchVal)) ||
        (item.engine && item.engine.toLowerCase().includes(searchVal)) ||
        (item.noBa && item.noBa.toLowerCase().includes(searchVal)) ||
        (item.pic && item.pic.toLowerCase().includes(searchVal)) ||
        (item.notes && item.notes.toLowerCase().includes(searchVal)) ||
        (item.id && item.id.toLowerCase().includes(searchVal))
      );
    });

    // Filter tahap 2: Berdasarkan Tab Jenis Mutasi (Semua / Masuk / Keluar)
    const filtered = baseFiltered.filter(item => {
      if (AppState.historyTabFilter === 'in') return item.type === 'Unit Masuk';
      if (AppState.historyTabFilter === 'out') return item.type === 'Unit Keluar';
      return true;
    });

    return { filtered, baseFiltered, fDate, fMonth, fYear, fBa, searchVal };
  },

  /**
   * Render riwayat audit serah terima unit dalam format Tabel Enterprise
   */
  renderHistoryList() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;

    const { filtered, baseFiltered, searchVal } = this.getFilteredHistoryData();
    const clearBtn = document.getElementById('historySearchClearBtn');

    if (clearBtn) {
      if (searchVal.length > 0) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }

    // Update Counter pada Tab Filter
    const totalAll = baseFiltered.length;
    const totalIn = baseFiltered.filter(i => i.type === 'Unit Masuk').length;
    const totalOut = baseFiltered.filter(i => i.type === 'Unit Keluar').length;

    const countAllEl = document.getElementById('histCount-all');
    const countInEl = document.getElementById('histCount-in');
    const countOutEl = document.getElementById('histCount-out');
    if (countAllEl) countAllEl.textContent = totalAll;
    if (countInEl) countInEl.textContent = totalIn;
    if (countOutEl) countOutEl.textContent = totalOut;

    const showingBadge = document.getElementById('historyShowingBadge');
    if (showingBadge) {
      showingBadge.textContent = `${filtered.length} Data`;
    }

    const footerSummary = document.getElementById('historyFooterSummary');
    if (footerSummary) {
      footerSummary.textContent = `Menampilkan ${filtered.length} dari ${AppState.historyData.length} total rekaman audit mutasi kendaraan.`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="8" class="py-10 px-6 text-center">
            <div class="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <p class="text-xs sm:text-sm font-extrabold text-slate-700">Tidak ada transaksi mutasi yang ditemukan</p>
            <p class="text-[11px] text-slate-400 mt-1">Coba sesuaikan filter periode waktu, kata kunci pencarian, atau pilih tab "Semua".</p>
            <button type="button" onclick="clearHistorySearch(); resetHistoryDateFilter(); filterHistoryTab('all')" class="mt-3 inline-flex items-center px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition cursor-pointer">
              Reset Semua Filter
            </button>
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = filtered.map((item, idx) => {
      const isMasuk = item.type === 'Unit Masuk';
      const typeBadge = isMasuk
        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
        : 'bg-blue-50 text-blue-700 border-blue-300';
      const typeArrow = isMasuk ? '↓' : '↑';
      const catalogItem = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(item.model) : null;
      // Foto Kolom Kendaraan: selalu foto katalog resmi 13 model
      const catalogPhotoSrc = catalogItem ? catalogItem.photo : (item.modelPhoto || 'assets/images/Inventory_Gran Max Pick Up.jpeg');
      
      // Helper format Google Drive URL agar bisa di-embed langsung di browser tanpa terblokir 403
      const formatDriveThumb = (url) => {
        if (!url || typeof url !== 'string') return '';
        url = url.trim();
        if (url === '' || url === '-') return '';
        if (url.startsWith('data:image')) return url;
        const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w600`;
        }
        return url;
      };

      const rawUnitPhoto = item.unitPhoto || '';
      const rawDocPhoto = item.docPhoto || '';

      const unitPhotoSrc = formatDriveThumb(rawUnitPhoto) || catalogPhotoSrc;
      const docPhotoSrc = formatDriveThumb(rawDocPhoto);

      const rowNum = String(idx + 1).padStart(2, '0');

      // Format Waktu sesuai request: jam,DD/MM/YYYY (contoh: 10:45, 15/10/2026)
      let timeFormatted = item.time || '08:00';
      timeFormatted = timeFormatted.replace(/\s*WIB/i, '').trim();

      let dateFormatted = '';
      if (item.date && item.month && item.year) {
        dateFormatted = `${String(item.date).padStart(2, '0')}/${String(item.month).padStart(2, '0')}/${item.year}`;
      } else if (item.timestamp) {
        const dObj = new Date(item.timestamp);
        if (!isNaN(dObj.getTime())) {
          dateFormatted = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
          const hh = String(dObj.getHours()).padStart(2, '0');
          const mm = String(dObj.getMinutes()).padStart(2, '0');
          timeFormatted = `${hh}:${mm}`;
        }
      }
      if (!dateFormatted && item.fullDateStr) {
        if (item.fullDateStr.includes('/')) {
          dateFormatted = item.fullDateStr;
        } else {
          const parts = item.fullDateStr.split(' ');
          if (parts.length === 3) {
            const months = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
            const mIdx = months.indexOf(parts[1].toLowerCase());
            dateFormatted = `${parts[0].padStart(2, '0')}/${String(mIdx !== -1 ? mIdx + 1 : 1).padStart(2, '0')}/${parts[2]}`;
          }
        }
      }
      if (!dateFormatted) {
        const now = new Date();
        dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      }

      const fullTimeDisplay = `${timeFormatted}, ${dateFormatted}`;

      // Thumbnail Bukti Fisik Langsung Tampil (Dengan Fallback Anti-Rusak)
      const unitThumbnailHtml = `
        <div onclick="openImagePreviewModal('${unitPhotoSrc}')" class="group/thumb relative w-12 h-9 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 flex-shrink-0 cursor-pointer shadow-2xs hover:border-blue-500 hover:ring-2 hover:ring-blue-400/40 transition" title="Klik untuk memperbesar Foto Unit">
          <img src="${unitPhotoSrc}" alt="Foto Unit" loading="lazy" referrerpolicy="no-referrer"
               onerror="this.onerror=null; this.src='${catalogPhotoSrc}';"
               class="w-full h-full object-cover group-hover/thumb:scale-110 transition duration-200">
          <span class="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[7.5px] font-bold text-center py-0.2">Unit</span>
        </div>
      `;

      const docThumbnailHtml = (docPhotoSrc && !docPhotoSrc.includes('unsplash.com'))
        ? `<div onclick="openImagePreviewModal('${docPhotoSrc}')" class="group/thumb relative w-12 h-9 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 flex-shrink-0 cursor-pointer shadow-2xs hover:border-indigo-500 hover:ring-2 hover:ring-indigo-400/40 transition" title="Klik untuk memperbesar Foto Dokumen DO / Stiker">
             <img src="${docPhotoSrc}" alt="Foto Dokumen" loading="lazy" referrerpolicy="no-referrer"
                  onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
                  class="w-full h-full object-cover group-hover/thumb:scale-110 transition duration-200">
             <div class="doc-fallback hidden w-full h-full items-center justify-center bg-indigo-50 text-[7.5px] text-indigo-700 font-bold text-center">Stiker</div>
             <span class="absolute bottom-0 inset-x-0 bg-indigo-900/80 text-white text-[7.5px] font-bold text-center py-0.2">Stiker</span>
           </div>`
        : `<div class="w-12 h-9 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[7.5px] text-slate-400 font-semibold text-center leading-tight">No Doc</div>`;

      return `
        <tr class="hover:bg-blue-50/40 transition-colors group border-b border-slate-200">
          <!-- Kolom 1: ID Mutasi (TERPISAH) -->
          <td class="py-3 pl-4 sm:pl-5 pr-2.5 align-middle whitespace-nowrap border-r border-slate-200">
            <div class="flex items-center space-x-1.5">
              <span class="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300">#${rowNum}</span>
              <span class="text-[11px] font-mono font-bold text-slate-800 tracking-tight">${item.id || '-'}</span>
            </div>
          </td>

          <!-- Kolom 2: Waktu Mutasi (TERPISAH - Format: jam,DD/MM/YYYY) -->
          <td class="py-3 px-3 align-middle whitespace-nowrap border-r border-slate-200">
            <div class="inline-flex items-center space-x-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/80 font-mono text-[11px] font-extrabold text-slate-800">
              <svg class="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span>${fullTimeDisplay}</span>
            </div>
          </td>

          <!-- Kolom 3: Jenis Mutasi -->
          <td class="py-3 px-2.5 align-middle whitespace-nowrap text-center border-r border-slate-200">
            <span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border shadow-2xs ${typeBadge}">
              <span class="font-black leading-none">${typeArrow}</span>
              <span>${item.type}</span>
            </span>
          </td>

          <!-- Kolom 4: Kendaraan -->
          <td class="py-3 px-3 align-middle border-r border-slate-200">
            <div class="flex items-center space-x-2.5">
              <div onclick="openImagePreviewModal('${catalogPhotoSrc}')" class="w-10 h-7 rounded-md bg-white border border-slate-200/80 p-0.5 flex items-center justify-center flex-shrink-0 cursor-pointer shadow-2xs hover:border-blue-400 transition" title="Perbesar Foto Katalog ${item.model}">
                <img src="${catalogPhotoSrc}" alt="${item.model}" loading="lazy" decoding="async" class="w-full h-full object-contain">
              </div>
              <div class="min-w-0">
                <div class="text-xs font-black text-slate-900 truncate">${item.model}</div>
                <div class="text-[10px] font-semibold text-slate-400 truncate">
                  ${catalogItem ? catalogItem.category : 'Unit Daihatsu'}
                </div>
              </div>
            </div>
          </td>

          <!-- Kolom 5: No. Rangka (VIN), Mesin & No. BA -->
          <td class="py-3 px-3 align-middle whitespace-nowrap border-r border-slate-200">
            <div class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100/90 border border-slate-200/80 font-mono text-[10.5px] font-extrabold text-slate-900">
              ${item.vin}
            </div>
            <div class="text-[9.5px] font-mono text-slate-500 mt-0.5">
              ENG: <span class="font-bold text-slate-700">${item.engine}</span>
            </div>
            <div class="inline-flex items-center space-x-1 font-mono text-[9px] text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded font-black mt-1" title="Cabang: ${this.formatBranchName(item.noBa)}">
              <span class="text-[7.5px] text-amber-600 font-bold uppercase">Cabang:</span>
              <span>${this.formatBranchName(item.noBa)}</span>
            </div>
          </td>

          <!-- Kolom 6: Petugas PIC & Catatan Audit -->
          <td class="py-3 px-3 align-middle border-r border-slate-200">
            <div class="flex items-center space-x-1.5">
              <span class="w-4 h-4 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center text-[9px] font-black flex-shrink-0">
                ${(item.pic || 'A').charAt(0).toUpperCase()}
              </span>
              <span class="text-[11px] font-extrabold text-slate-800">${item.pic}</span>
            </div>
            <p class="text-[10px] text-slate-500 font-medium mt-0.5 line-clamp-1 leading-snug max-w-[200px]" title="${item.notes || ''}">
              ${item.notes || 'Pemeriksaan standar unit.'}
            </p>
          </td>

          <!-- Kolom 7: Bukti Fisik (FOTO LANGSUNG TAMPIL) -->
          <td class="py-2.5 px-3 align-middle whitespace-nowrap text-center border-r border-slate-200">
            <div class="flex items-center justify-center space-x-2">
              ${unitThumbnailHtml}
              ${docThumbnailHtml}
            </div>
          </td>

          <!-- Kolom 8: Status -->
          <td class="py-3 pl-2.5 pr-4 sm:pr-5 align-middle whitespace-nowrap text-right">
            <span class="inline-flex items-center space-x-1 text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
              <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              <span>Valid</span>
            </span>
          </td>
        </tr>
      `;
    }).join('');

    if (typeof this.refreshScrollReveal === 'function') {
      this.refreshScrollReveal();
    }
  },

  filterHistoryTab(tabKey) {
    AppState.historyTabFilter = tabKey;
    const tabs = ['all', 'in', 'out'];
    tabs.forEach(t => {
      const el = document.getElementById(`histTab-${t}`);
      const countEl = document.getElementById(`histCount-${t}`);
      if (el) {
        if (t === tabKey) {
          el.className = 'py-2 rounded-xl bg-white text-slate-900 shadow-xs transition cursor-pointer flex items-center justify-center space-x-1 font-bold';
          if (countEl) countEl.className = 'text-[10px] px-1.5 py-0.2 rounded-md bg-slate-900 text-white font-extrabold';
        } else {
          el.className = 'py-2 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer flex items-center justify-center space-x-1 font-bold';
          if (countEl) countEl.className = 'text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200/80 text-slate-600 font-bold';
        }
      }
    });
    this.renderHistoryList();
  },

  clearHistorySearch() {
    const input = document.getElementById('historySearchInput');
    if (input) input.value = '';
    this.renderHistoryList();
  },

  applyHistoryDateFilter() {
    this.renderHistoryList();
  },

  resetHistoryDateFilter() {
    const d = document.getElementById('histFilterDate');
    const m = document.getElementById('histFilterMonth');
    const y = document.getElementById('histFilterYear');
    const b = document.getElementById('histFilterBa');
    if (d) d.value = 'all';
    if (m) m.value = 'all';
    if (y) y.value = 'all';
    if (b) b.value = 'all';
    this.renderHistoryList();
    this.showToast('Filter waktu & kode BA berhasil di-reset!');
  },

  /**
   * Menampilkan toast notification
   */
  showToast(message) {
    const toast = document.getElementById('toastNotification');
    const msg = document.getElementById('toastMsg');
    if (!toast || !msg) return;

    msg.innerText = message;
    toast.classList.remove('-translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('-translate-y-20', 'opacity-0');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, 2600);
  },

  /**
   * Preview foto besar
   */
  openImagePreview(imgSrc) {
    const modal = document.getElementById('imagePreviewModal');
    const img = document.getElementById('enlargedPreviewImg');
    if (modal && img) {
      img.referrerPolicy = 'no-referrer';
      img.src = imgSrc;
      modal.classList.remove('hidden');
    }
  },

  closeImagePreview() {
    const modal = document.getElementById('imagePreviewModal');
    if (modal) modal.classList.add('hidden');
  },

  /**
   * Unggah berkas gambar unit / DO
   */
  /**
   * Unggah berkas gambar unit / DO dengan kompresi otomatis & snapshot kamera
   */
  triggerFileInput(inputId) {
    const fileInput = document.getElementById(inputId);
    if (fileInput) {
      fileInput.click();
    }
  },

  setPhotoPreview(targetType, dataUrl) {
    if (targetType === 'unitPhoto') {
      AppState.uploadedUnitPhotoUrl = dataUrl;
      const preview = document.getElementById('unitPhotoPreview');
      const placeholder = document.getElementById('unitPhotoPlaceholder');
      const removeBtn = document.getElementById('unitPhotoRemoveBtn');
      if (preview) {
        preview.src = dataUrl;
        preview.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');
    } else {
      AppState.uploadedDocPhotoUrl = dataUrl;
      const preview = document.getElementById('docPhotoPreview');
      const placeholder = document.getElementById('docPhotoPlaceholder');
      const removeBtn = document.getElementById('docPhotoRemoveBtn');
      if (preview) {
        preview.src = dataUrl;
        preview.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (removeBtn) removeBtn.classList.remove('hidden');
    }
  },

  handleFileSelected(event, targetType) {
    const file = event.target && event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        // Kompresi gambar client-side (Max 960px, JPEG 0.72) agar transmisi super cepat & hemat kuota
        const maxDim = 960;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.72);
        this.setPhotoPreview(targetType, optimizedDataUrl);
        this.showToast(targetType === 'unitPhoto' ? '✅ Foto fisik unit berhasil dipasang!' : '✅ Foto dokumen DO berhasil dipasang!');
      };
      img.onerror = () => {
        this.setPhotoPreview(targetType, rawDataUrl);
        this.showToast('✅ Foto berhasil dipasang!');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  },

  /**
   * Jepret foto langsung dari live feed kamera scanner yang sedang aktif
   */
  captureFromScanner(targetType) {
    const videoEl = document.getElementById('scannerVideo');
    if (!videoEl || !videoEl.videoWidth || videoEl.videoWidth === 0) {
      // Jika kamera video belum aktif atau ditutup, arahkan ke file picker kamera bawaan HP
      this.triggerFileInput(targetType === 'unitPhoto' ? 'unitPhotoInput' : 'docPhotoInput');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
      this.setPhotoPreview(targetType, dataUrl);
      this.showToast(targetType === 'unitPhoto' ? '📸 Berhasil jepret foto unit dari scanner!' : '📄 Berhasil jepret dokumen DO dari scanner!');
    } catch (e) {
      console.warn('[UI] Gagal capture dari video scanner, fallback ke input file:', e);
      this.triggerFileInput(targetType === 'unitPhoto' ? 'unitPhotoInput' : 'docPhotoInput');
    }
  },

  removeImagePreview(targetType) {
    if (targetType === 'unitPhoto') {
      AppState.uploadedUnitPhotoUrl = null;
      const preview = document.getElementById('unitPhotoPreview');
      const placeholder = document.getElementById('unitPhotoPlaceholder');
      const removeBtn = document.getElementById('unitPhotoRemoveBtn');
      const input = document.getElementById('unitPhotoInput');
      if (preview) { preview.src = ''; preview.classList.add('hidden'); }
      if (placeholder) placeholder.classList.remove('hidden');
      if (removeBtn) removeBtn.classList.add('hidden');
      if (input) input.value = '';
    } else {
      AppState.uploadedDocPhotoUrl = null;
      const preview = document.getElementById('docPhotoPreview');
      const placeholder = document.getElementById('docPhotoPlaceholder');
      const removeBtn = document.getElementById('docPhotoRemoveBtn');
      const input = document.getElementById('docPhotoInput');
      if (preview) { preview.src = ''; preview.classList.add('hidden'); }
      if (placeholder) placeholder.classList.remove('hidden');
      if (removeBtn) removeBtn.classList.add('hidden');
      if (input) input.value = '';
    }
  },

  /**
   * Mengunduh Laporan Riwayat Mutasi Kendaraan Langsung ke Perangkat (Direct File Download)
   * Menampilkan tabel persis seperti tabel frontend (dengan foto katalog, foto fisik unit & stiker)
   * Menyertakan baris Total Rekapitulasi di bagian bawah tabel serta filter aktif.
   * Langsung mengunduh file .pdf tanpa membuka dialog print browser dan tidak pernah blank/kosong.
   */
  async exportHistoryPDF() {
    const { filtered, fDate, fMonth, fYear, fBa, searchVal } = this.getFilteredHistoryData();
    const tabFilter = AppState.historyTabFilter || 'all';

    if (!filtered || filtered.length === 0) {
      this.showToast('⚠️ Tidak ada data mutasi untuk diekspor ke PDF!');
      return;
    }

    const btn = document.getElementById('exportHistoryPdfBtn');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('opacity-70', 'cursor-wait');
    }

    this.showToast('⏳ Memproses data & foto mutasi untuk PDF...');

    try {
      await this.ensurePdfLibraryLoaded();
      await this.generateDirectJsPDF(filtered, { fDate, fMonth, fYear, fBa, searchVal, tabFilter });
    } catch (err) {
      console.error('[UI] Gagal mengunduh file PDF:', err);
      this.showToast('❌ Terjadi kendala saat mengunduh PDF.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('opacity-70', 'cursor-wait');
      }
    }
  },

  /**
   * Membantu memuat gambar (katalog lokal maupun bukti fisik) menjadi format Base64 yang aman untuk jsPDF
   */
  loadImageAsBase64(url) {
    return new Promise((resolve) => {
      if (!url || typeof url !== 'string' || url.trim() === '' || url === '-') {
        return resolve(null);
      }
      url = url.trim();
      if (url.startsWith('data:image')) {
        return resolve(url);
      }

      let targetUrl = url;
      const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        targetUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200`;
      }

      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 100;
          canvas.height = img.naturalHeight || img.height || 75;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = targetUrl;
      setTimeout(() => resolve(null), 1500);
    });
  },

  /**
   * Memastikan skrip jsPDF & jspdf-autotable termuat
   */
  ensurePdfLibraryLoaded() {
    return new Promise((resolve) => {
      if (window.jspdf && window.jspdf.jsPDF) {
        if (!window.jsPDF) window.jsPDF = window.jspdf.jsPDF;
        return resolve(true);
      }

      const loadScript = (src) => {
        return new Promise((res, rej) => {
          const existing = document.querySelector(`script[src="${src}"]`);
          if (existing) {
            existing.addEventListener('load', () => res());
            existing.addEventListener('error', () => rej());
            return res();
          }
          const s = document.createElement('script');
          s.src = src;
          s.onload = () => res();
          s.onerror = () => rej();
          document.head.appendChild(s);
        });
      };

      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
        .then(() => {
          if (window.jspdf && window.jspdf.jsPDF && !window.jsPDF) {
            window.jsPDF = window.jspdf.jsPDF;
          }
          return loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.autotable.min.js');
        })
        .then(() => {
          if (window.jspdf && window.jspdf.jsPDF && !window.jsPDF) {
            window.jsPDF = window.jspdf.jsPDF;
          }
          resolve(true);
        })
        .catch(() => resolve(false));
    });
  },

  /**
   * Pembuatan file PDF langsung di browser (Client-Side Vector Download)
   * Menyertakan Foto Mobil Katalog, Foto Bukti Fisik Unit & Stiker, Filter Aktif, dan Total Rekapitulasi di bawah tabel.
   */
  async generateDirectJsPDF(records, filterInfo = {}) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
    const margin = 12;

    const profile = AppState.userProfile || {};
    const operatorName = profile.name || CONFIG.OPERATOR_NAME || 'Andi Pratama';
    const operatorNpk = profile.npk || CONFIG.OPERATOR_NPK || '21040889';
    const operatorBranch = profile.branch || CONFIG.OPERATOR_BRANCH || 'Sentra Lampung • Astra Daihatsu DSO Lampung';

    const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    let periodText = 'Seluruh Waktu';
    if (filterInfo.fDate !== 'all' || filterInfo.fMonth !== 'all' || filterInfo.fYear !== 'all') {
      const dStr = (filterInfo.fDate && filterInfo.fDate !== 'all') ? `Tgl ${filterInfo.fDate} ` : '';
      const mStr = (filterInfo.fMonth && filterInfo.fMonth !== 'all') ? `${monthNames[filterInfo.fMonth] || filterInfo.fMonth} ` : '';
      const yStr = (filterInfo.fYear && filterInfo.fYear !== 'all') ? `${filterInfo.fYear}` : '';
      periodText = `${dStr}${mStr}${yStr}`.trim() || 'Seluruh Waktu';
    }

    let typeFilterText = 'Semua Mutasi (Masuk & Keluar)';
    if (filterInfo.tabFilter === 'in') typeFilterText = 'Hanya Unit Masuk';
    if (filterInfo.tabFilter === 'out') typeFilterText = 'Hanya Unit Keluar';

    const searchFilterText = filterInfo.searchVal ? `"${filterInfo.searchVal}"` : 'Semua Data';

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateFormatted = `${day}-${month}-${year}`; // Format DD-MM-YYYY untuk nama file sistem
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const printDateStr = `${now.getDate()} ${monthNames[now.getMonth() + 1]} ${now.getFullYear()}, ${timeStr} WIB`;
    const docNumber = `STOCKYARD/MUT/${year}${month}/${Math.floor(1000 + Math.random() * 9000)}`;

    // ==========================================
    // 1. KOP SURAT RESMI ASTRA DAIHATSU
    // ==========================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('PT ASTRA DAIHATSU MOTOR • DSO SENTRA LAMPUNG', margin, 12);

    doc.setFontSize(8.5);
    doc.setTextColor(37, 99, 235); // brand-blue
    doc.text('REKAPITULASI AUDIT & SERAH TERIMA FISIK KENDARAAN (STOCKYARD LOGISTICS)', margin, 16.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text('Jl. Raya Soekarno Hatta No. 88, Bandar Lampung • Sentra Yard & Logistics Operations Hub • Telp: (0721) 700-888', margin, 20.5);

    // Garis Kop Surat
    doc.setDrawColor(37, 99, 235); // Blue
    doc.setLineWidth(0.6);
    doc.line(margin, 22.5, pageWidth - margin, 22.5);

    doc.setDrawColor(237, 27, 36); // Daihatsu Red
    doc.setLineWidth(0.3);
    doc.line(margin, 23.5, pageWidth - margin, 23.5);

    // ==========================================
    // 2. METADATA DOKUMEN & KPI SUMMARY
    // ==========================================
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(margin, 26, pageWidth - (margin * 2), 16, 2, 2, 'FD');

    // Kolom Kiri Dokumen Info
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('No. Dokumen', margin + 3, 30.5);
    doc.text('Filter Periode', margin + 3, 34.5);
    doc.text('Filter Mutasi', margin + 3, 38.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(`:  ${docNumber}`, margin + 25, 30.5);
    doc.text(`:  ${periodText}`, margin + 25, 34.5);
    doc.text(`:  ${typeFilterText}`, margin + 25, 38.5);

    // Kolom Tengah Penugasan
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Petugas PIC', margin + 95, 30.5);
    doc.text('Cabang Penugasan', margin + 95, 34.5);
    doc.text('Filter Pencarian', margin + 95, 38.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(`:  ${operatorName} (${operatorNpk})`, margin + 125, 30.5);
    doc.text(`:  ${operatorBranch}`, margin + 125, 34.5);
    doc.text(`:  ${searchFilterText}`, margin + 125, 38.5);

    // Kolom Kanan KPI Badge
    const masukCount = records.filter(r => r.type === 'Unit Masuk').length;
    const keluarCount = records.filter(r => r.type === 'Unit Keluar').length;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('RINGKASAN AUDIT:', pageWidth - margin - 65, 30.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Total Terdata : ${records.length} Unit Fisik`, pageWidth - margin - 65, 34.5);
    doc.text(`Masuk: ${masukCount} Unit | Keluar: ${keluarCount} Unit`, pageWidth - margin - 65, 38.5);

    // ==========================================
    // 3. PRE-LOAD FOTO (KATALOG, FISIK UNIT, DOKUMEN)
    // ==========================================
    const imgCache = new Map();
    const loadCached = async (u) => {
      if (!u) return null;
      if (imgCache.has(u)) return imgCache.get(u);
      const b64 = await this.loadImageAsBase64(u);
      imgCache.set(u, b64);
      return b64;
    };

    const preloadPromises = records.map(async (item) => {
      const catalogItem = (typeof AppState !== 'undefined' && AppState.getModelCatalogItem) ? AppState.getModelCatalogItem(item.model) : null;
      const catalogPhotoSrc = catalogItem ? catalogItem.photo : (item.modelPhoto || 'assets/images/Inventory_Gran Max Pick Up.jpeg');
      const catB64 = await loadCached(catalogPhotoSrc);
      const unitB64 = await loadCached(item.unitPhoto);
      const docB64 = await loadCached(item.docPhoto);
      return { catB64, unitB64, docB64, catalogItem };
    });
    const preloadedMedia = await Promise.all(preloadPromises);

    // ==========================================
    // 4. SUSUN TABEL AUTOTABLE (IDENTIK FRONTEND)
    // ==========================================
    const tableColumns = [
      { header: 'No & ID', dataKey: 'no' },
      { header: 'Waktu Mutasi', dataKey: 'datetime' },
      { header: 'Jenis Mutasi', dataKey: 'type' },
      { header: 'Kendaraan (Model & Katalog)', dataKey: 'vehicle' },
      { header: 'No. Rangka, Mesin & Cabang', dataKey: 'vin' },
      { header: 'Petugas PIC & Catatan', dataKey: 'pic' },
      { header: 'Bukti Fisik (Unit & Stiker)', dataKey: 'evidence' },
      { header: 'Status', dataKey: 'status' }
    ];

    const tableRows = records.map((item, idx) => {
      const rowNum = String(idx + 1).padStart(2, '0');
      const media = preloadedMedia[idx] || {};

      let timeFormatted = item.time || '08:00';
      timeFormatted = timeFormatted.replace(/\s*WIB/i, '').trim();

      let dateFormattedRow = '';
      if (item.date && item.month && item.year) {
        dateFormattedRow = `${String(item.date).padStart(2, '0')}/${String(item.month).padStart(2, '0')}/${item.year}`;
      } else if (item.timestamp) {
        const dObj = new Date(item.timestamp);
        if (!isNaN(dObj.getTime())) {
          dateFormattedRow = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
          const hh = String(dObj.getHours()).padStart(2, '0');
          const mm = String(dObj.getMinutes()).padStart(2, '0');
          timeFormatted = `${hh}:${mm}`;
        }
      }
      if (!dateFormattedRow && item.fullDateStr) {
        if (item.fullDateStr.includes('/')) {
          dateFormattedRow = item.fullDateStr;
        } else {
          const parts = item.fullDateStr.split(' ');
          if (parts.length === 3) {
            const months = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
            const mIdx = months.indexOf(parts[1].toLowerCase());
            dateFormattedRow = `${parts[0].padStart(2, '0')}/${String(mIdx !== -1 ? mIdx + 1 : 1).padStart(2, '0')}/${parts[2]}`;
          }
        }
      }
      if (!dateFormattedRow) {
        dateFormattedRow = `${day}/${month}/${year}`;
      }

      const categoryName = media.catalogItem ? media.catalogItem.category : 'Unit Daihatsu';

      return {
        no: `#${rowNum}\n${item.id || '-'}`,
        datetime: `${timeFormatted}\n${dateFormattedRow}`,
        type: `${item.type === 'Unit Masuk' ? '↓ Masuk' : '↑ Keluar'}`,
        vehicle: `${item.model}\n${categoryName}`,
        vin: `${item.vin}\nENG: ${item.engine}\n${this.formatBranchName(item.noBa)}`,
        pic: `${item.pic || operatorName}\n${item.notes || 'Pemeriksaan standar.'}`,
        evidence: ' ',
        status: '✓ Valid',
        catalogBase64: media.catB64,
        unitBase64: media.unitB64,
        docBase64: media.docB64
      };
    });

    doc.autoTable({
      columns: tableColumns,
      body: tableRows,
      startY: 45,
      margin: { left: margin, right: margin, bottom: 22 },
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 2
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [30, 41, 59],
        valign: 'middle',
        minCellHeight: 12,
        cellPadding: 1.5
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        no: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
        datetime: { halign: 'center', cellWidth: 26, font: 'courier' },
        type: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
        vehicle: { cellWidth: 50, fontStyle: 'bold', cellPadding: { top: 2, right: 2, bottom: 2, left: 14 } },
        vin: { cellWidth: 42, font: 'courier' },
        pic: { cellWidth: 52 },
        evidence: { halign: 'center', cellWidth: 44 },
        status: { halign: 'center', cellWidth: 17, fontStyle: 'bold' }
      },
      foot: [[
        { content: 'TOTAL REKAPITULASI AUDIT', colSpan: 3, styles: { halign: 'left', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } },
        { content: `${records.length} Unit Fisik Terdata`, colSpan: 2, styles: { halign: 'left', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [56, 189, 248] } },
        { content: `↓ Masuk: ${masukCount} Unit   |   ↑ Keluar: ${keluarCount} Unit`, colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }
      ]],
      footStyles: {
        fillColor: [15, 23, 42],
        fontSize: 8,
        textColor: [255, 255, 255],
        cellPadding: 2.2
      },
      didParseCell: function(data) {
        if (data.section === 'body') {
          if (data.column.dataKey === 'type') {
            if (data.cell.raw && data.cell.raw.includes('Masuk')) {
              data.cell.styles.textColor = [4, 120, 87];
              data.cell.styles.fillColor = [236, 253, 245];
            } else {
              data.cell.styles.textColor = [29, 78, 216];
              data.cell.styles.fillColor = [239, 246, 255];
            }
          }
          if (data.column.dataKey === 'status') {
            data.cell.styles.textColor = [5, 150, 105];
            data.cell.styles.fillColor = [236, 253, 245];
          }
        }
      },
      didDrawCell: function(data) {
        if (data.section === 'body') {
          // Gambar Mobil Katalog pada Kolom Kendaraan
          if (data.column.dataKey === 'vehicle') {
            const raw = data.row.raw;
            if (raw.catalogBase64) {
              try {
                const imgW = 10;
                const imgH = 7.5;
                const imgX = data.cell.x + 2;
                const imgY = data.cell.y + (data.cell.height - imgH) / 2;
                doc.addImage(raw.catalogBase64, 'JPEG', imgX, imgY, imgW, imgH);
              } catch (e) {}
            }
          }

          // Gambar Foto Unit & Stiker pada Kolom Bukti Fisik
          if (data.column.dataKey === 'evidence') {
            const raw = data.row.raw;
            const imgW = 10;
            const imgH = 7.5;
            const imgY = data.cell.y + (data.cell.height - imgH) / 2;

            if (raw.unitBase64) {
              try {
                const imgX = data.cell.x + 5;
                doc.addImage(raw.unitBase64, 'JPEG', imgX, imgY, imgW, imgH);
                doc.setFontSize(4.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(100, 116, 139);
                doc.text('UNIT', imgX + 2, imgY + imgH + 2);
              } catch (e) {}
            } else {
              doc.setFontSize(5.5);
              doc.setTextColor(148, 163, 184);
              doc.text('No Unit', data.cell.x + 5, imgY + 4);
            }

            if (raw.docBase64) {
              try {
                const imgX = data.cell.x + 22;
                doc.addImage(raw.docBase64, 'JPEG', imgX, imgY, imgW, imgH);
                doc.setFontSize(4.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(100, 116, 139);
                doc.text('STIKER', imgX + 1.5, imgY + imgH + 2);
              } catch (e) {}
            } else {
              doc.setFontSize(5.5);
              doc.setTextColor(148, 163, 184);
              doc.text('No Doc', data.cell.x + 22, imgY + 4);
            }
          }
        }
      }
    });

    // ==========================================
    // 5. LEMBAR PENGESAHAN LAPANGAN (SIGNATURES)
    // ==========================================
    let finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 110) + 7;
    if (finalY > pageHeight - 32) {
      doc.addPage();
      finalY = 16;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);

    const sigW = (pageWidth - (margin * 2)) / 3;

    // Kolom 1: Transporter
    doc.text('Diserahkan oleh (Transporter):', margin, finalY);
    doc.text('( ...................................................... )', margin, finalY + 13);
    doc.setFontSize(6.5);
    doc.text('Pengemudi / Ekspedisi Car Carrier', margin, finalY + 17);

    // Kolom 2: Staff Penerima
    doc.setFontSize(7);
    doc.text('Diterima & Diperiksa oleh:', margin + sigW, finalY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`( ${operatorName} )`, margin + sigW, finalY + 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Staff Operasional Yard • NPK: ${operatorNpk}`, margin + sigW, finalY + 17);

    // Kolom 3: Head of Yard
    doc.setFontSize(7);
    doc.text('Mengetahui / Menyetujui:', margin + (sigW * 2), finalY);
    doc.text('( ...................................................... )', margin + (sigW * 2), finalY + 13);
    doc.setFontSize(6.5);
    doc.text('Kepala Sentra Yard Lampung DSO', margin + (sigW * 2), finalY + 17);

    // ==========================================
    // 6. FOOTER & NOMOR HALAMAN PADA SEMUA HALAMAN
    // ==========================================
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
      doc.text('Dokumen Resmi Sistem Management StockYard • PT Astra Daihatsu Motor (Sentra Lampung) • Dicetak via Management StockYard Enterprise', margin, pageHeight - 5);
    }

    // ==========================================
    // 7. SIMPAN DAN DOWNLOAD FILE PDF KE PERANGKAT
    // ==========================================
    const fileName = `Laporan_Mutasi_Stockyard_Daihatsu_Lampung_${dateFormatted}.pdf`;
    doc.save(fileName);
    this.showToast(`✅ Berhasil mengunduh ${fileName}`);
  },

  /**
   * Cetak / Simpan PDF dengan tampilan persis seperti tabel frontend
   * Menampilkan foto katalog, bukti fisik (foto unit & stiker), filter aktif, serta baris total rekapitulasi.
   */
  generatePrintablePdfReport(records, filterInfo = {}, existingWindow = null) {
    const profile = AppState.userProfile || {};
    const operatorName = profile.name || CONFIG.OPERATOR_NAME || 'Andi Pratama';
    const operatorNpk = profile.npk || CONFIG.OPERATOR_NPK || '21040889';
    const operatorBranch = profile.branch || CONFIG.OPERATOR_BRANCH || 'Sentra Lampung • Astra Daihatsu DSO Lampung';

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateFormatted = `${day}-${month}-${year}`; // DD-MM-YYYY untuk judul & nama file simpan
    const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const printDateStr = `${now.getDate()} ${monthNames[now.getMonth() + 1]} ${year}, ${timeStr} WIB`;
    const docNumber = `STOCKYARD/MUT/${year}${month}/${Math.floor(1000 + Math.random() * 9000)}`;

    // Hitung ringkasan filter aktif
    let periodText = 'Seluruh Waktu';
    if (filterInfo.fDate !== 'all' || filterInfo.fMonth !== 'all' || filterInfo.fYear !== 'all') {
      const dStr = (filterInfo.fDate && filterInfo.fDate !== 'all') ? `Tgl ${filterInfo.fDate} ` : '';
      const mStr = (filterInfo.fMonth && filterInfo.fMonth !== 'all') ? `${monthNames[filterInfo.fMonth] || filterInfo.fMonth} ` : '';
      const yStr = (filterInfo.fYear && filterInfo.fYear !== 'all') ? `${filterInfo.fYear}` : '';
      periodText = `${dStr}${mStr}${yStr}`.trim() || 'Seluruh Waktu';
    }

    let typeFilterText = 'Semua Mutasi (Masuk & Keluar)';
    if (filterInfo.tabFilter === 'in') typeFilterText = 'Hanya Unit Masuk';
    if (filterInfo.tabFilter === 'out') typeFilterText = 'Hanya Unit Keluar';

    const searchFilterText = filterInfo.searchVal ? `"${filterInfo.searchVal}"` : 'Semua Data';

    // Hitung Total Akumulasi
    const masukCount = records.filter(r => r.type === 'Unit Masuk').length;
    const keluarCount = records.filter(r => r.type === 'Unit Keluar').length;

    const baseHref = window.location.href.split('#')[0].split('?')[0];

    const printWindow = existingWindow || window.open('', '_blank');
    if (!printWindow) {
      alert('Izinkan pop-up di browser Anda untuk mengunduh laporan PDF.');
      return;
    }

    const formatDriveThumb = (url) => {
      if (!url || typeof url !== 'string') return '';
      url = url.trim();
      if (url === '' || url === '-') return '';
      if (url.startsWith('data:image')) return url;
      const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w600`;
      }
      return url;
    };

    const rowsHtml = records.map((item, idx) => {
      const rowNum = String(idx + 1).padStart(2, '0');
      const isMasuk = item.type === 'Unit Masuk';
      const typeBadgeStyle = isMasuk
        ? 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;'
        : 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;';
      const typeArrow = isMasuk ? '↓' : '↑';

      const catalogItem = (typeof AppState !== 'undefined' && AppState.getModelCatalogItem) ? AppState.getModelCatalogItem(item.model) : null;
      const catalogPhotoSrc = catalogItem ? catalogItem.photo : (item.modelPhoto || 'assets/images/Inventory_Gran Max Pick Up.jpeg');
      const modelCategory = catalogItem ? catalogItem.category : 'Unit Daihatsu';

      const rawUnitPhoto = item.unitPhoto || '';
      const rawDocPhoto = item.docPhoto || '';
      const unitPhotoSrc = formatDriveThumb(rawUnitPhoto) || catalogPhotoSrc;
      const docPhotoSrc = formatDriveThumb(rawDocPhoto);

      // Format Waktu: jam, DD/MM/YYYY
      let timeFormatted = item.time || '08:00';
      timeFormatted = timeFormatted.replace(/\s*WIB/i, '').trim();

      let dateFormattedRow = '';
      if (item.date && item.month && item.year) {
        dateFormattedRow = `${String(item.date).padStart(2, '0')}/${String(item.month).padStart(2, '0')}/${item.year}`;
      } else if (item.timestamp) {
        const dObj = new Date(item.timestamp);
        if (!isNaN(dObj.getTime())) {
          dateFormattedRow = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
          const hh = String(dObj.getHours()).padStart(2, '0');
          const mm = String(dObj.getMinutes()).padStart(2, '0');
          timeFormatted = `${hh}:${mm}`;
        }
      }
      if (!dateFormattedRow && item.fullDateStr) {
        if (item.fullDateStr.includes('/')) {
          dateFormattedRow = item.fullDateStr;
        } else {
          const parts = item.fullDateStr.split(' ');
          if (parts.length === 3) {
            const months = ['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
            const mIdx = months.indexOf(parts[1].toLowerCase());
            dateFormattedRow = `${parts[0].padStart(2, '0')}/${String(mIdx !== -1 ? mIdx + 1 : 1).padStart(2, '0')}/${parts[2]}`;
          }
        }
      }
      if (!dateFormattedRow) {
        dateFormattedRow = `${day}/${month}/${year}`;
      }

      const fullTimeDisplay = `${timeFormatted}, ${dateFormattedRow}`;

      // Thumbnail Bukti Fisik Persis Frontend
      const unitThumbnailHtml = `
        <div style="display:inline-block; position:relative; width:44px; height:32px; border-radius:4px; overflow:hidden; border:1px solid #cbd5e1; background:#f1f5f9; vertical-align:middle; margin-right:3px;">
          <img src="${unitPhotoSrc}" alt="Unit" referrerpolicy="no-referrer" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='${catalogPhotoSrc}';">
          <span style="position:absolute; bottom:0; left:0; right:0; background:rgba(15,23,42,0.78); color:#fff; font-size:6.5px; font-weight:700; text-align:center; padding:1px 0; line-height:1;">Unit</span>
        </div>
      `;

      const docThumbnailHtml = (docPhotoSrc && !docPhotoSrc.includes('unsplash.com'))
        ? `<div style="display:inline-block; position:relative; width:44px; height:32px; border-radius:4px; overflow:hidden; border:1px solid #cbd5e1; background:#f1f5f9; vertical-align:middle;">
             <img src="${docPhotoSrc}" alt="Stiker" referrerpolicy="no-referrer" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
             <span style="display:none; width:100%; height:100%; align-items:center; justify-content:center; font-size:7px; color:#4338ca; font-weight:700; background:#e0e7ff;">Stiker</span>
             <span style="position:absolute; bottom:0; left:0; right:0; background:rgba(30,58,138,0.85); color:#fff; font-size:6.5px; font-weight:700; text-align:center; padding:1px 0; line-height:1;">Stiker</span>
           </div>`
        : `<div style="display:inline-flex; align-items:center; justify-content:center; width:44px; height:32px; border-radius:4px; border:1px dashed #cbd5e1; background:#f8fafc; font-size:7px; color:#94a3b8; font-weight:700; vertical-align:middle;">No Doc</div>`;

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 8px;">
          <!-- Kolom 1: No & ID Mutasi -->
          <td style="padding: 4px 6px; text-align: center; white-space: nowrap;">
            <span style="display:inline-block; padding: 1px 4px; border-radius: 4px; background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: 800; font-size: 7.5px; color: #475569; margin-right: 2px;">#${rowNum}</span>
            <span style="font-family: monospace; font-weight: 700; font-size: 8px; color: #0f172a;">${item.id || '-'}</span>
          </td>

          <!-- Kolom 2: Waktu Mutasi -->
          <td style="padding: 4px 6px; white-space: nowrap;">
            <div style="font-family: monospace; font-size: 8px; font-weight: 700; color: #0f172a; background: #f8fafc; padding: 2px 5px; border-radius: 4px; border: 1px solid #e2e8f0; display: inline-block;">
              ${fullTimeDisplay}
            </div>
          </td>

          <!-- Kolom 3: Jenis Mutasi -->
          <td style="padding: 4px 6px; text-align: center; white-space: nowrap;">
            <span style="display:inline-block; padding: 2px 7px; border-radius: 9999px; font-weight: 800; font-size: 7.5px; ${typeBadgeStyle}">
              ${typeArrow} ${item.type}
            </span>
          </td>

          <!-- Kolom 4: Kendaraan (Foto Katalog + Model + Kategori) -->
          <td style="padding: 4px 6px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="width: 38px; height: 26px; border-radius: 4px; background: #ffffff; border: 1px solid #e2e8f0; padding: 1px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <img src="${catalogPhotoSrc}" alt="${item.model}" style="width: 100%; height: 100%; object-fit: contain;">
              </div>
              <div style="min-width: 0;">
                <div style="font-weight: 800; font-size: 8.5px; color: #0f172a; line-height: 1.1;">${item.model}</div>
                <div style="font-size: 7px; color: #64748b; margin-top: 1px;">${modelCategory}</div>
              </div>
            </div>
          </td>

          <!-- Kolom 5: No. Rangka, Mesin & No. BA -->
          <td style="padding: 4px 6px; white-space: nowrap;">
            <div style="font-family: monospace; font-weight: 800; font-size: 8px; color: #0f172a; background: #f1f5f9; padding: 1.5px 5px; border-radius: 4px; border: 1px solid #e2e8f0; display: inline-block;">
              ${item.vin}
            </div>
            <div style="font-family: monospace; font-size: 7.5px; color: #64748b; margin-top: 2px;">
              ENG: <strong style="color: #334155;">${item.engine}</strong>
            </div>
            <div style="font-family: monospace; font-size: 7px; color: #b45309; font-weight: 800; margin-top: 2px; background: #fef3c7; border: 1px solid #fde68a; padding: 1px 4px; border-radius: 3px; display: inline-block;">
              Cabang: ${this.formatBranchName(item.noBa)}
            </div>
          </td>

          <!-- Kolom 6: Petugas PIC & Catatan -->
          <td style="padding: 4px 6px;">
            <div style="font-weight: 700; font-size: 8px; color: #0f172a; display: flex; align-items: center; gap: 4px;">
              <span style="display: inline-flex; width: 14px; height: 14px; border-radius: 50%; background: #dbeafe; color: #1e40af; font-size: 7.5px; font-weight: 800; align-items: center; justify-content: center;">
                ${(item.pic || 'A').charAt(0).toUpperCase()}
              </span>
              <span>${item.pic || operatorName}</span>
            </div>
            <div style="font-size: 7px; color: #64748b; margin-top: 2px; line-height: 1.2;">
              ${item.notes || 'Pemeriksaan standar serah terima fisik.'}
            </div>
          </td>

          <!-- Kolom 7: Bukti Fisik (FOTO LANGSUNG TAMPIL) -->
          <td style="padding: 4px 6px; text-align: center; white-space: nowrap;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 3px;">
              ${unitThumbnailHtml}
              ${docThumbnailHtml}
            </div>
          </td>

          <!-- Kolom 8: Status -->
          <td style="padding: 4px 6px; text-align: center; white-space: nowrap;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 9999px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; font-weight: 800; font-size: 7.5px;">
              ✓ Valid
            </span>
          </td>
        </tr>
      `;
    }).join('');

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <base href="${baseHref}">
        <title>Laporan_Mutasi_Stockyard_Daihatsu_Lampung_${dateFormatted}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm 8mm 8mm 8mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
          .no-print {
            position: sticky;
            top: 0;
            z-index: 9999;
            background: #0f172a;
            color: #ffffff;
            padding: 8px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 11px;
          }
          .no-print button {
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 11px;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          .no-print button:hover {
            opacity: 0.9;
          }
          .header {
            border-bottom: 2.5px solid #2563eb;
            padding-bottom: 4px;
            margin-bottom: 6px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title {
            font-size: 13.5px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.2px;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 9.5px;
            font-weight: 700;
            color: #2563eb;
            margin-top: 1px;
            text-transform: uppercase;
          }
          .address {
            font-size: 7.5px;
            color: #64748b;
            margin-top: 2px;
          }
          .info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 5px 8px;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            margin-bottom: 6px;
            line-height: 1.35;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 2px;
          }
          th {
            background: #0f172a !important;
            color: #ffffff !important;
            padding: 4px 6px;
            font-size: 8px;
            text-align: left;
            font-weight: 700;
            border: 1px solid #0f172a;
          }
          td {
            padding: 3px 5px;
            font-size: 8px;
            line-height: 1.2;
            border: 1px solid #e2e8f0;
            vertical-align: middle;
          }
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          tfoot tr td {
            background: #0f172a !important;
            color: #ffffff !important;
            border: 1px solid #1e293b;
          }
          .signatures {
            margin-top: 10px;
            display: flex;
            justify-content: space-between;
            font-size: 8px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .sig-col {
            width: 30%;
            text-align: left;
          }
          .sig-space {
            height: 24px;
          }
          .footer-note {
            margin-top: 8px;
            display: flex;
            justify-content: space-between;
            font-size: 7px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 3px;
          }
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
            }
          }
        </style>
      </head>
      <body>
        <!-- Top Toolbar untuk Tampilan Layar (Otomatis disembunyikan saat dicetak / disimpan ke PDF) -->
        <div class="no-print">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 800; color: #38bdf8;">Management StockYard</span>
            <span style="color: #cbd5e1;">• Dokumen PDF Rekapitulasi Mutasi</span>
            <span style="background: rgba(255,255,255,0.12); padding: 2px 6px; border-radius: 4px; font-size: 10px;">💡 Tip: Pilih printer "Save as PDF" / "Simpan sebagai PDF"</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button onclick="window.print()" style="background: #2563eb; color: #ffffff;">🖨️ Cetak / Simpan sebagai PDF</button>
            <button onclick="window.close()" style="background: #475569; color: #ffffff;">✕ Tutup</button>
          </div>
        </div>

        <div style="padding: 6px 8px;">
          <!-- KOP SURAT RESMI DAIHATSU -->
          <div class="header">
            <div>
              <div class="title">PT Astra Daihatsu Motor • DSO Sentra Lampung</div>
              <div class="subtitle">Rekapitulasi Audit & Serah Terima Fisik Kendaraan (Stockyard Logistics)</div>
              <div class="address">Jl. Raya Soekarno Hatta No. 88, Bandar Lampung • Sentra Yard & Logistics Operations Hub • Telp: (0721) 700-888</div>
            </div>
            <div style="text-align: right; font-size: 8px; color: #64748b;">
              <div>Dokumen Resmi Internal</div>
              <div style="font-weight: 800; font-size: 8.5px; color: #0f172a;">${docNumber}</div>
            </div>
          </div>

          <!-- METADATA DOKUMEN & STATUS FILTER AKTIF -->
          <div class="info-box">
            <div>
              <strong>No. Dokumen:</strong> ${docNumber}<br>
              <strong>Waktu Cetak:</strong> ${printDateStr}<br>
              <strong>Total Terdata:</strong> <span style="color: #0284c7; font-weight: 800;">${records.length} Unit Fisik</span>
            </div>
            <div>
              <strong>Filter Periode:</strong> <span style="font-weight: 700; color: #0f172a;">${periodText}</span><br>
              <strong>Filter Mutasi:</strong> <span style="font-weight: 700; color: #0f172a;">${typeFilterText}</span><br>
              <strong>Pencarian:</strong> <span style="font-weight: 700; color: #0f172a;">${searchFilterText}</span>
            </div>
            <div>
              <strong>Petugas PIC:</strong> ${operatorName} (NPK: ${operatorNpk})<br>
              <strong>Cabang Penugasan:</strong> ${operatorBranch}<br>
              <strong>Status Logistik:</strong> <span style="color: #059669; font-weight: 800;">✓ Verifikasi Lapangan Lengkap</span>
            </div>
          </div>

          <!-- TABEL PERSIS SEPERTI FRONTEND (DENGAN FOTO & TOTAL) -->
          <table>
            <thead>
              <tr>
                <th style="width: 75px; text-align: center;">No & ID Mutasi</th>
                <th style="width: 95px;">Waktu Mutasi</th>
                <th style="width: 75px; text-align: center;">Jenis Mutasi</th>
                <th style="width: 135px;">Kendaraan</th>
                <th style="width: 130px;">No. Rangka, Mesin & BA</th>
                <th style="width: 145px;">Petugas PIC & Catatan</th>
                <th style="width: 105px; text-align: center;">Bukti Fisik (Foto)</th>
                <th style="width: 55px; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 6px 8px; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase;">
                  TOTAL REKAPITULASI UNIT
                </td>
                <td colspan="2" style="padding: 6px 8px; font-weight: 800;">
                  <span style="color: #38bdf8; font-size: 9px;">${records.length} Unit Fisik Terdata</span>
                </td>
                <td colspan="3" style="padding: 6px 8px; text-align: right;">
                  <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; background: #065f46; color: #a7f3d0; margin-right: 6px; font-size: 7.5px; font-weight: 800;">
                    ↓ Masuk: ${masukCount} Unit
                  </span>
                  <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; background: #1e40af; color: #bfdbfe; font-size: 7.5px; font-weight: 800;">
                    ↑ Keluar: ${keluarCount} Unit
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>

          <!-- LEMBAR PENGESAHAN LAPANGAN -->
          <div class="signatures">
            <div class="sig-col">
              <div>Diserahkan oleh (Transporter):</div>
              <div class="sig-space"></div>
              <div>( ...................................................... )</div>
              <div style="color: #64748b; font-size: 7.5px;">Pengemudi / Ekspedisi Car Carrier</div>
            </div>
            <div class="sig-col">
              <div>Diterima & Diperiksa oleh:</div>
              <div class="sig-space"></div>
              <div><strong>( ${operatorName} )</strong></div>
              <div style="color: #64748b; font-size: 7.5px;">Staff Operasional Yard • NPK: ${operatorNpk}</div>
            </div>
            <div class="sig-col">
              <div>Mengetahui / Menyetujui:</div>
              <div class="sig-space"></div>
              <div>( ...................................................... )</div>
              <div style="color: #64748b; font-size: 7.5px;">Kepala Sentra Yard Lampung DSO</div>
            </div>
          </div>

          <!-- FOOTER DOKUMEN -->
          <div class="footer-note">
            <div>Dokumen Resmi Sistem Management StockYard • PT Astra Daihatsu Motor (Sentra Lampung)</div>
            <div>Dicetak secara otomatis via sistem Management StockYard Enterprise</div>
          </div>
        </div>

        <script>
          // Preload seluruh gambar sebelum memicu dialog print agar tidak ada foto yang kosong
          window.addEventListener('load', function() {
            var images = Array.prototype.slice.call(document.images);
            var promises = images.map(function(img) {
              if (img.complete) return Promise.resolve();
              return new Promise(function(resolve) {
                img.addEventListener('load', resolve);
                img.addEventListener('error', resolve);
              });
            });
            Promise.all(promises).then(function() {
              setTimeout(function() {
                window.print();
              }, 300);
            });
          });
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
    this.showToast('✅ Dokumen PDF Riwayat Mutasi siap dicetak / disimpan!');
  },

  /**
   * Inisialisasi dropdown tanggal secara dinamis (menggantikan document.write)
   */
  populateDateDropdown() {
    const dateSelect = document.getElementById('histFilterDate');
    if (dateSelect) {
      dateSelect.innerHTML = '<option value="all">Semua Tgl</option>';
      for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        dateSelect.appendChild(opt);
      }
    }
    const modelDateSelect = document.getElementById('modelFilterDate');
    if (modelDateSelect) {
      modelDateSelect.innerHTML = '<option value="all">Semua Tgl</option>';
      for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        modelDateSelect.appendChild(opt);
      }
    }
    const dashDateSelect = document.getElementById('dashFilterDate');
    if (dashDateSelect) {
      dashDateSelect.innerHTML = '<option value="all">Semua Tgl</option>';
      for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        dashDateSelect.appendChild(opt);
      }
    }
    this.initCustomDropdowns();
    if (typeof this.initDashboardDateFilter === 'function') {
      this.initDashboardDateFilter();
    }
  },

  /**
   * Hero Carousel Controller (Auto-Scroll, Glassmorphic Dots & GPU Transform)
   */
  heroTimer: null,
  heroCurrentIndex: 0,

  initHeroCarousel() {
    const track = document.getElementById('heroCarouselTrack');
    if (!track) return;

    const slides = track.querySelectorAll('.hero-slide');
    const totalSlides = slides.length;
    if (totalSlides === 0) return;

    UI.heroCurrentIndex = 0;
    let lastManualAction = 0;

    const updateDots = (index) => {
      const dots = document.querySelectorAll('.hero-dot');
      dots.forEach((dot, idx) => {
        if (idx === index) {
          dot.className = 'hero-dot w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs transition-all scale-110';
        } else {
          dot.className = 'hero-dot w-2 h-2 rounded-full bg-slate-300 hover:bg-slate-400 transition-all';
        }
      });

      const counter = document.getElementById('heroSlideCounter');
      if (counter) {
        counter.textContent = index + 1;
      }
    };

    const goToSlide = (index, immediate = false) => {
      index = parseInt(index, 10);
      if (isNaN(index)) index = 0;
      if (index >= totalSlides) index = 0;
      if (index < 0) index = totalSlides - 1;
      UI.heroCurrentIndex = index;

      track.scrollLeft = 0;
      track.style.transition = immediate ? 'none' : 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
      track.style.transform = `translate3d(-${index * 100}%, 0, 0)`;

      updateDots(index);
    };

    UI.nextHeroSlide = (isAuto = false) => {
      const now = Date.now();
      if (!isAuto && now - lastManualAction < 180) return;
      if (!isAuto) lastManualAction = now;
      const curr = (typeof UI.heroCurrentIndex === 'number' && !isNaN(UI.heroCurrentIndex)) ? UI.heroCurrentIndex : 0;
      goToSlide(curr + 1);
    };

    UI.prevHeroSlide = () => {
      const now = Date.now();
      if (now - lastManualAction < 180) return;
      lastManualAction = now;
      const curr = (typeof UI.heroCurrentIndex === 'number' && !isNaN(UI.heroCurrentIndex)) ? UI.heroCurrentIndex : 0;
      goToSlide(curr - 1);
    };

    UI.goToHeroSlide = (idx) => {
      const now = Date.now();
      if (now - lastManualAction < 180) return;
      lastManualAction = now;
      goToSlide(idx);
    };

    window.nextHeroSlide = () => {
      UI.stopHeroAutoScroll();
      UI.nextHeroSlide(false);
      setTimeout(() => UI.startHeroAutoScroll(), 4000);
    };
    window.prevHeroSlide = () => {
      UI.stopHeroAutoScroll();
      UI.prevHeroSlide();
      setTimeout(() => UI.startHeroAutoScroll(), 4000);
    };
    window.goToHeroSlide = (idx) => {
      UI.stopHeroAutoScroll();
      UI.goToHeroSlide(idx);
      setTimeout(() => UI.startHeroAutoScroll(), 4000);
    };

    UI.startHeroAutoScroll = () => {
      UI.stopHeroAutoScroll();
      UI.heroTimer = setInterval(() => {
        UI.nextHeroSlide(true);
      }, 4500);
    };

    UI.stopHeroAutoScroll = () => {
      if (UI.heroTimer) {
        clearInterval(UI.heroTimer);
        UI.heroTimer = null;
      }
    };

    // Touch swipe support untuk Mobile & Tablet
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDeltaX = 0;
    let isSwiping = false;

    track.addEventListener('touchstart', (e) => {
      UI.stopHeroAutoScroll();
      if (!e.touches || e.touches.length === 0) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchDeltaX = 0;
      isSwiping = true;
      track.style.transition = 'none';
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
      if (!isSwiping || !e.touches || e.touches.length === 0) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - touchStartX;
      const diffY = currentY - touchStartY;

      if (Math.abs(diffX) > Math.abs(diffY)) {
        touchDeltaX = diffX;
        const width = track.clientWidth || window.innerWidth || 1;
        const dragPercent = (touchDeltaX / width) * 100;
        const basePercent = -(UI.heroCurrentIndex * 100);
        track.style.transform = `translate3d(${basePercent + dragPercent}%, 0, 0)`;
      }
    }, { passive: true });

    const finishTouchSwipe = () => {
      if (!isSwiping) return;
      isSwiping = false;
      const threshold = 28;
      if (touchDeltaX < -threshold) {
        goToSlide(UI.heroCurrentIndex + 1);
      } else if (touchDeltaX > threshold) {
        goToSlide(UI.heroCurrentIndex - 1);
      } else {
        goToSlide(UI.heroCurrentIndex);
      }
      touchDeltaX = 0;
      setTimeout(() => UI.startHeroAutoScroll(), 4000);
    };

    track.addEventListener('touchend', finishTouchSwipe, { passive: true });
    track.addEventListener('touchcancel', finishTouchSwipe, { passive: true });

    track.addEventListener('mouseenter', () => UI.stopHeroAutoScroll());
    track.addEventListener('mouseleave', () => UI.startHeroAutoScroll());

    // Mouse drag support untuk Desktop
    let isMouseDown = false;
    let startMouseX = 0;
    let mouseDeltaX = 0;

    track.addEventListener('mousedown', (e) => {
      if (e.target && e.target.closest('button')) return;
      isMouseDown = true;
      startMouseX = e.pageX;
      mouseDeltaX = 0;
      track.style.cursor = 'grabbing';
      track.style.transition = 'none';
      UI.stopHeroAutoScroll();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      mouseDeltaX = e.pageX - startMouseX;
      const width = track.clientWidth || window.innerWidth || 1;
      const dragPercent = (mouseDeltaX / width) * 100;
      const basePercent = -(UI.heroCurrentIndex * 100);
      track.style.transform = `translate3d(${basePercent + dragPercent}%, 0, 0)`;
    });

    window.addEventListener('mouseup', () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      track.style.cursor = 'grab';
      const threshold = 35;
      if (mouseDeltaX < -threshold) {
        goToSlide(UI.heroCurrentIndex + 1);
      } else if (mouseDeltaX > threshold) {
        goToSlide(UI.heroCurrentIndex - 1);
      } else {
        goToSlide(UI.heroCurrentIndex);
      }
      mouseDeltaX = 0;
      setTimeout(() => UI.startHeroAutoScroll(), 4000);
    });

    // Pasang tombol panah navigasi kiri dan kanan
    const prevBtn = document.getElementById('heroPrevBtn');
    const nextBtn = document.getElementById('heroNextBtn');

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.nextHeroSlide();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.prevHeroSlide();
      });
    }

    // Pasang handler untuk dots indikator
    const dotsContainer = document.getElementById('heroDotsContainer');
    if (dotsContainer) {
      dotsContainer.addEventListener('click', (e) => {
        const dot = e.target.closest('.hero-dot');
        if (dot) {
          const dots = Array.from(document.querySelectorAll('.hero-dot'));
          const idx = dots.indexOf(dot);
          if (idx >= 0) {
            window.goToHeroSlide(idx);
          }
        }
      });
    }

    // Adaptasi posisi saat resize layar
    window.addEventListener('resize', () => {
      goToSlide(UI.heroCurrentIndex || 0, true);
    });

    // Inisialisasi awal
    goToSlide(0, true);
    UI.startHeroAutoScroll();
  },

  filterInventoryByModel(modelKeyword) {
    this.filterInventoryByStatus('all');
    this.switchTab('inventory');
    const searchInput = document.getElementById('inventorySearchInput');
    if (searchInput) {
      searchInput.value = modelKeyword;
      this.filterInventory();
      this.showToast(`🔍 Menampilkan katalog & stok: ${modelKeyword}`);
    }
  },

  filterHistoryByModelAndType(modelKeyword, mutationType) {
    this.switchTab('history');
    const tabKey = mutationType === 'Unit Masuk' ? 'in' : (mutationType === 'Unit Keluar' ? 'out' : 'all');
    this.filterHistoryTab(tabKey);
    const label = mutationType === 'Unit Masuk' ? 'Penerimaan (Masuk)' : 'Pengiriman (Keluar)';
    this.showToast(`📋 Riwayat ${label}: ${modelKeyword}`);
  },

  openScannerForModel(modelName) {
    if (typeof window.openScannerModal === 'function') {
      window.openScannerModal();
    } else if (typeof ScannerService !== 'undefined') {
      ScannerService.open();
    }
    const selectEl = document.getElementById('inputCarModel');
    if (selectEl && modelName) {
      selectEl.value = modelName;
    }
  },

  /**
   * Render grafik donat distribusi model kendaraan di Dashboard
   * Dihitung secara dinamis dari database AppState.inventoryData & AppState.historyData
   */
  renderDashboardDonut() {
    const svg = document.getElementById('vehicleDonutSvg');
    const totalEl = document.getElementById('donutHeaderTotalUnits');
    const modelCountEl = document.getElementById('donutHeaderModelCount');
    const centerVal = document.getElementById('donutCenterValue');
    const centerSub = document.getElementById('donutCenterSub');
    const centerLabel = document.getElementById('donutCenterLabel');

    if (!svg) return;

    const modelColors = {
      'Rocky e-Smart Hybrid': '#10b981',
      'Gran Max Pick Up': '#f43f5e',
      'New Terios': '#3b82f6',
      'New Sigra': '#6366f1',
      'All New Xenia': '#f59e0b',
      'All New Ayla': '#14b8a6',
      'New Rocky': '#ec4899',
      'Sirion': '#06b6d4',
      'Luxio': '#a855f7',
      'Rocky': '#8b5cf6',
      'Gran Max Minibus': '#f97316',
      'Terios Special Edition': '#ef4444',
      'New Sigra (Prod Old)': '#0ea5e9'
    };

    const catalog = AppState.vehicleCatalog || [];
    const { filtered: filteredHistory, fDate, fMonth, fYear } = (typeof this.getFilteredDashboardData === 'function')
      ? this.getFilteredDashboardData()
      : { filtered: AppState.historyData || [], fDate: 'all', fMonth: 'all', fYear: 'all' };
    const isFiltered = (fDate !== 'all' || fMonth !== 'all' || fYear !== 'all');

    // Tentukan sumber data riwayat mutasi aktif:
    // 1. Jika filter tanggal aktif (misal Tgl 20 Oktober 2026), gunakan HANYA mutasi pada periode tersebut!
    // 2. Jika "Semua Waktu", gunakan seluruh riwayat mutasi riil di database (tab HistoryMutasi).
    const activeHistory = isFiltered ? (filteredHistory || []) : (AppState.historyData || []);

    const modelStats = catalog.map(cat => {
      const matchingHistory = activeHistory.filter(h => {
        if (!h || !h.model) return false;
        const hModel = String(h.model || '').toLowerCase();
        if (hModel === cat.model.toLowerCase()) return true;
        const matched = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(hModel) : null;
        return matched && matched.catalogId === cat.catalogId;
      });

      const masuk = matchingHistory.filter(h => h.type === 'Unit Masuk').length;
      const keluar = matchingHistory.filter(h => h.type === 'Unit Keluar').length;
      
      // Stok dihitung 100% murni dan nyata dari riwayat transaksi mutasi fisik di database (HistoryMutasi)
      const count = Math.max(0, masuk - keluar);

      return {
        catalogId: cat.catalogId,
        model: cat.model,
        category: cat.category,
        photo: cat.photo,
        color: modelColors[cat.model] || '#3b82f6',
        count: count,
        masuk: masuk,
        keluar: keluar
      };
    });

    const totalUnits = modelStats.reduce((sum, m) => sum + m.count, 0);
    AppState._totalDonutUnits = totalUnits;

    const modelsWithUnits = modelStats.filter(m => m.count > 0).sort((a, b) => b.count - a.count);
    const distinctModelCount = modelsWithUnits.length;

    if (totalEl) totalEl.textContent = `${totalUnits} Unit`;
    if (modelCountEl) modelCountEl.textContent = `${distinctModelCount} Model`;

    if (centerLabel) centerLabel.textContent = 'TOTAL';
    if (centerVal) centerVal.textContent = String(totalUnits);
    if (centerSub) centerSub.textContent = 'Unit';

    const bgTrack = `<path class="text-slate-100" stroke-width="6" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />`;

    if (totalUnits === 0) {
      svg.innerHTML = bgTrack;
      this.updateDonutPreviewCard(null);
      return;
    }

    let cumulativeOffset = 0;
    const segmentsHtml = modelsWithUnits.map(item => {
      const pctRaw = (item.count / totalUnits) * 100;
      const len = pctRaw;
      const pctDisplay = Math.round(pctRaw) + '%';
      const offset = cumulativeOffset;
      cumulativeOffset += len;

      return `
        <path class="donut-segment cursor-pointer transition-all duration-150" 
          stroke-dasharray="${len.toFixed(2)}, 100" 
          stroke-dashoffset="-${offset.toFixed(2)}" 
          stroke-width="6" 
          stroke="${item.color}" 
          fill="none"
          data-model="${item.model}" 
          data-units="${item.count} Unit" 
          data-percent="${pctDisplay}" 
          data-color="${item.color}" 
          data-filter="${item.model}" 
          data-offset="${offset.toFixed(2)}" 
          data-len="${len.toFixed(2)}"
          data-photo="${item.photo}" 
          data-category="${item.category}" 
          data-masuk="${item.masuk}" 
          data-keluar="${item.keluar}"
          onmouseenter="showDonutCapsule(this, event)" 
          onmousemove="moveDonutCapsule(this, event)"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
      `;
    }).join('');

    svg.innerHTML = bgTrack + segmentsHtml;
    this.updateDonutPreviewCard(modelsWithUnits[0]);
  },

  /**
   * Perbarui Kartu Preview Mobil Dinamis di samping kanan grafik donat
   */
  updateDonutPreviewCard(item) {
    const prevDot = document.getElementById('donutPreviewDot');
    const prevCategory = document.getElementById('donutPreviewCategory');
    const prevBadge = document.getElementById('donutPreviewPercentBadge');
    const prevImg = document.getElementById('donutPreviewImg');
    const prevModel = document.getElementById('donutPreviewModel');
    const prevBar = document.getElementById('donutPreviewBar');
    const prevUnits = document.getElementById('donutPreviewUnits');
    const prevMasuk = document.getElementById('donutPreviewMasuk');
    const prevKeluar = document.getElementById('donutPreviewKeluar');
    const prevMasukBtn = document.getElementById('donutPreviewMasukBtn');
    const prevKeluarBtn = document.getElementById('donutPreviewKeluarBtn');
    const prevBtn = document.getElementById('donutPreviewBtn');

    if (!item) {
      if (prevDot) prevDot.style.backgroundColor = '#94a3b8';
      if (prevCategory) prevCategory.textContent = 'Menunggu Data Unit';
      if (prevBadge) {
        prevBadge.textContent = '0%';
        prevBadge.style.backgroundColor = '#94a3b8';
      }
      if (prevImg) {
        prevImg.src = 'assets/images/Inventory_Gran Max Pick Up.jpeg';
        prevImg.alt = 'Unit Daihatsu';
      }
      if (prevModel) prevModel.textContent = 'Belum Ada Unit';
      if (prevBar) {
        prevBar.style.width = '0%';
        prevBar.style.backgroundColor = '#94a3b8';
      }
      if (prevUnits) prevUnits.textContent = '0 Unit';
      if (prevMasuk) prevMasuk.textContent = 'Masuk 0';
      if (prevKeluar) prevKeluar.textContent = 'Keluar 0';
      if (prevMasukBtn) prevMasukBtn.onclick = () => this.filterHistoryTab('in');
      if (prevKeluarBtn) prevKeluarBtn.onclick = () => this.filterHistoryTab('out');
      if (prevBtn) prevBtn.onclick = () => this.switchTab('inventory');
      return;
    }

    const total = AppState._totalDonutUnits || 1;
    const pct = Math.round((item.count / total) * 100) + '%';

    if (prevDot) prevDot.style.backgroundColor = item.color;
    if (prevCategory) prevCategory.textContent = item.category;
    if (prevBadge) {
      prevBadge.textContent = pct;
      prevBadge.style.backgroundColor = item.color;
    }
    if (prevImg) {
      prevImg.src = item.photo;
      prevImg.alt = item.model;
    }
    if (prevModel) prevModel.textContent = item.model;
    if (prevBar) {
      prevBar.style.width = pct;
      prevBar.style.backgroundColor = item.color;
    }
    if (prevUnits) prevUnits.textContent = `${item.count} Unit`;
    if (prevMasuk) prevMasuk.textContent = `Masuk ${item.masuk || 0}`;
    if (prevKeluar) prevKeluar.textContent = `Keluar ${item.keluar || 0}`;
    if (prevMasukBtn) {
      prevMasukBtn.onclick = () => this.filterHistoryByModelAndType(item.model, 'Unit Masuk');
    }
    if (prevKeluarBtn) {
      prevKeluarBtn.onclick = () => this.filterHistoryByModelAndType(item.model, 'Unit Keluar');
    }
    if (prevBtn) {
      prevBtn.onclick = () => this.filterInventoryByModel(item.model);
    }
  },

  /**
   * Perbarui Status Operasional Yard & Kartu Peringatan Fisik
   * Sinkron 100% dengan kapasitas dan status unit di AppState
   */
  updateDashboardYardStatus() {
    const textEl = document.getElementById('yardOccupancyText');
    const barEl = document.getElementById('yardOccupancyBar');
    const slotsEl = document.getElementById('yardAvailableSlots');
    const doReadyEl = document.getElementById('yardDoReadyCount');
    const bastkValidEl = document.getElementById('yardBastkValidCount');
    const alertTitle = document.getElementById('yardAttentionTitle');
    const alertDesc = document.getElementById('yardAttentionDesc');
    const alertCard = document.getElementById('yardAttentionCard');
    const alertIconBox = document.getElementById('yardAttentionIconBox');

    const totalCapacity = 120;
    let inYardUnits = 0;
    const hasSummaryStock = (AppState.inventoryData || []).some(u => typeof u.stockYard === 'number');
    if (hasSummaryStock) {
      inYardUnits = (AppState.inventoryData || []).reduce((acc, u) => acc + (parseInt(u.stockYard, 10) || 0), 0);
    } else {
      inYardUnits = (AppState.inventoryData || []).filter(u => u && (u.status === 'In-Yard' || !u.status)).length;
    }
    if (inYardUnits === 0 && (AppState.historyData || []).length > 0) {
      const masuk = (AppState.historyData || []).filter(h => h.type === 'Unit Masuk').length;
      const keluar = (AppState.historyData || []).filter(h => h.type === 'Unit Keluar').length;
      inYardUnits = Math.max(0, masuk - keluar);
    }
    const occupancyPct = totalCapacity > 0 ? ((inYardUnits / totalCapacity) * 100).toFixed(1) : 0;
    const availableSlots = Math.max(0, totalCapacity - inYardUnits);

    if (textEl) textEl.textContent = `${inYardUnits} / ${totalCapacity} Unit (${occupancyPct}%)`;
    if (barEl) {
      barEl.style.width = `${Math.min(100, Math.max(0, occupancyPct))}%`;
      if (occupancyPct >= 85) {
        barEl.className = 'bg-rose-500 h-full rounded-full transition-all duration-500';
      } else if (occupancyPct >= 70) {
        barEl.className = 'bg-amber-500 h-full rounded-full transition-all duration-500';
      } else {
        barEl.className = 'bg-indigo-600 h-full rounded-full transition-all duration-500';
      }
    }
    if (slotsEl) slotsEl.textContent = `Tersedia: ${availableSlots} Slot`;

    // DO Siap Verifikasi: Unit yang masih menunggu verifikasi DO dan fisik yard
    let doReadyCount = 0;
    const hasTransitStock = (AppState.inventoryData || []).some(u => typeof u.stockTransit === 'number');
    if (hasTransitStock) {
      doReadyCount = (AppState.inventoryData || []).reduce((acc, u) => acc + (parseInt(u.stockTransit, 10) || 0), 0);
    } else {
      doReadyCount = (AppState.inventoryData || []).filter(u => u && (u.status === 'Intransit' || u.status === 'Pending')).length;
    }
    if (doReadyEl) doReadyEl.textContent = `${doReadyCount} Unit`;

    // BASTK Valid: Mutasi pengiriman unit keluar / BASTK yang sudah terverifikasi
    const bastkCount = (AppState.historyData || []).filter(h => h && (h.type === 'Unit Keluar' || h.type === 'BASTK')).length;
    if (bastkValidEl) bastkValidEl.textContent = `${bastkCount} Unit`;

    // Alert Card Dinamis
    if (alertTitle && alertDesc) {
      if (doReadyCount > 0) {
        alertTitle.textContent = `${doReadyCount} Unit Memerlukan Verifikasi Fisik`;
        alertDesc.textContent = `${doReadyCount} unit mutasi masuk perlu inspeksi dokumen DO dan fisik lapangan.`;
        if (alertCard) alertCard.className = 'bg-gradient-to-r from-rose-50 via-rose-50/90 to-orange-50 border border-rose-200/90 rounded-3xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:border-rose-300 transition scroll-reveal flex-shrink-0';
        if (alertIconBox) alertIconBox.className = 'w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 flex items-center justify-center flex-shrink-0 border border-rose-200/60';
      } else if (inYardUnits > 0) {
        alertTitle.textContent = 'Operasional Pool Yard Optimal';
        alertDesc.textContent = `${inYardUnits} total unit terdata di pool yard. Seluruh dokumen fisik sinkron.`;
        if (alertCard) alertCard.className = 'bg-gradient-to-r from-emerald-50 via-teal-50/90 to-emerald-50 border border-emerald-200/90 rounded-3xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:border-emerald-300 transition scroll-reveal flex-shrink-0';
        if (alertIconBox) alertIconBox.className = 'w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-200/60';
      } else {
        alertTitle.textContent = 'Monitoring Pool Yard Aktif';
        alertDesc.textContent = 'Kapasitas 120 slot tersedia. Siap menerima pemindaian barcode unit baru.';
        if (alertCard) alertCard.className = 'bg-gradient-to-r from-slate-50 to-slate-100/90 border border-slate-200/90 rounded-3xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:border-slate-300 transition scroll-reveal flex-shrink-0';
        if (alertIconBox) alertIconBox.className = 'w-10 h-10 rounded-2xl bg-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0 border border-slate-300';
      }
    }
  },

  /**
   * Perbarui statistik stok & mutasi pada setiap slide Hero Carousel di Dashboard
   */
  updateHeroSlidesData() {
    const slides = document.querySelectorAll('.hero-slide');
    if (!slides || slides.length === 0) return;

    slides.forEach(slide => {
      const titleEl = slide.querySelector('h3');
      if (!titleEl) return;
      const modelName = titleEl.textContent.trim();
      const catalogItem = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(modelName) : null;
      if (!catalogItem) return;

      const matchingUnits = (AppState.inventoryData || []).filter(u => {
        if (!u) return false;
        const uModel = String(u.model || u.name || '').toLowerCase();
        if (uModel === catalogItem.model.toLowerCase()) return true;
        const m = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(uModel) : null;
        return m && m.catalogId === catalogItem.catalogId;
      });

      const matchingHistory = (AppState.historyData || []).filter(h => {
        if (!h || !h.model) return false;
        const hModel = String(h.model || '').toLowerCase();
        if (hModel === catalogItem.model.toLowerCase()) return true;
        const m = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(hModel) : null;
        return m && m.catalogId === catalogItem.catalogId;
      });

      const masuk = matchingHistory.filter(h => h.type === 'Unit Masuk').length;
      const keluar = matchingHistory.filter(h => h.type === 'Unit Keluar').length;

      let totalStock = 0;
      const hasSummary = matchingUnits.some(u => typeof u.stockYard === 'number');
      if (hasSummary) {
        totalStock = matchingUnits.reduce((acc, u) => acc + (parseInt(u.stockYard, 10) || 0), 0);
      } else {
        totalStock = matchingUnits.filter(u => u.status === 'Tersedia' || u.status === 'In-Yard' || !u.status).length;
      }
      if (totalStock === 0 && (masuk - keluar) > 0) {
        totalStock = Math.max(0, masuk - keluar);
      }

      // Update pills masuk & keluar
      const spans = slide.querySelectorAll('span');
      spans.forEach(span => {
        const text = span.textContent.trim();
        if (/^\d+\s+Masuk$/i.test(text)) {
          span.textContent = `${masuk} Masuk`;
        } else if (/^\d+\s+Keluar$/i.test(text)) {
          span.textContent = `${keluar} Keluar`;
        }
      });

      // Update badge Total Stok / Stok Kosong
      const heroStockEl = slide.querySelector('.hero-total-stock');
      if (heroStockEl) {
        if (totalStock > 0) {
          heroStockEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 mr-1.5"></span>Total Stok: <strong class="ml-1 font-extrabold text-white">${totalStock} Unit</strong>`;
        } else {
          heroStockEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400 mr-1.5"></span><strong class="font-extrabold text-white">Stok Kosong</strong>`;
        }
      }
    });
  },

  /**
   * Menampilkan kapsul glassmorphism kecil di LUAR lingkaran donat dan memperbarui Kartu Preview Mobil Dinamis saat kursor diarahkan (hover / touch)
   */
  showDonutCapsule(segmentEl, event) {
    if (!segmentEl) return;

    const wrapper = document.getElementById('donutChartWrapper');
    const svg = document.getElementById('vehicleDonutSvg');
    const popup = document.getElementById('donutSegmentPopup');
    if (!wrapper || !svg || !popup) return;

    const model = segmentEl.dataset.model || '-';
    const units = segmentEl.dataset.units || '0 Unit';
    const percent = segmentEl.dataset.percent || '0%';
    const color = segmentEl.dataset.color || '#3b82f6';
    const filterKey = segmentEl.dataset.filter || model;
    const photo = segmentEl.dataset.photo || 'assets/images/Inventory_Gran Max Pick Up.jpeg';
    const category = segmentEl.dataset.category || 'Unit Kendaraan Daihatsu';
    const masuk = segmentEl.dataset.masuk || '0';
    const keluar = segmentEl.dataset.keluar || '0';

    // Highlight segmen yang sedang di-hover dan redupkan segmen lain sedikit
    const allSegments = svg.querySelectorAll('.donut-segment');
    allSegments.forEach(seg => {
      seg.dataset.active = 'false';
      seg.setAttribute('stroke-width', '5.5');
      seg.style.opacity = '0.45';
    });

    segmentEl.dataset.active = 'true';
    segmentEl.setAttribute('stroke-width', '7.4');
    segmentEl.style.opacity = '1';

    // Update label tengah donat
    const centerLabel = document.getElementById('donutCenterLabel');
    const centerVal = document.getElementById('donutCenterValue');
    const centerSub = document.getElementById('donutCenterSub');
    if (centerLabel) centerLabel.textContent = 'PORSI';
    if (centerVal) centerVal.textContent = percent;
    if (centerSub) centerSub.textContent = units;

    // 1. Isi konten kapsul glassmorphism di luar donat
    const dotEl = document.getElementById('donutPopupDot');
    const modelEl = document.getElementById('donutPopupModel');
    const unitsEl = document.getElementById('donutPopupUnits');
    const percentEl = document.getElementById('donutPopupPercent');

    if (dotEl) dotEl.style.backgroundColor = color;
    if (modelEl) modelEl.textContent = model;
    if (unitsEl) unitsEl.textContent = units;
    if (percentEl) percentEl.textContent = percent;

    // 2. Perbarui Kartu Preview Foto Mobil Dinamis di sebelah kanan donat
    const prevDot = document.getElementById('donutPreviewDot');
    const prevCategory = document.getElementById('donutPreviewCategory');
    const prevBadge = document.getElementById('donutPreviewPercentBadge');
    const prevImg = document.getElementById('donutPreviewImg');
    const prevModel = document.getElementById('donutPreviewModel');
    const prevBar = document.getElementById('donutPreviewBar');
    const prevUnits = document.getElementById('donutPreviewUnits');
    const prevMasuk = document.getElementById('donutPreviewMasuk');
    const prevKeluar = document.getElementById('donutPreviewKeluar');
    const prevMasukBtn = document.getElementById('donutPreviewMasukBtn');
    const prevKeluarBtn = document.getElementById('donutPreviewKeluarBtn');
    const prevBtn = document.getElementById('donutPreviewBtn');

    if (prevDot) prevDot.style.backgroundColor = color;
    if (prevCategory) prevCategory.textContent = category;
    if (prevBadge) {
      prevBadge.textContent = percent;
      prevBadge.style.backgroundColor = color;
    }
    if (prevImg) {
      prevImg.src = photo;
      prevImg.alt = model;
    }
    if (prevModel) prevModel.textContent = model;
    if (prevBar) {
      prevBar.style.width = percent;
      prevBar.style.backgroundColor = color;
    }
    if (prevUnits) prevUnits.textContent = units;
    if (prevMasuk) prevMasuk.textContent = `Masuk ${masuk}`;
    if (prevKeluar) prevKeluar.textContent = `Keluar ${keluar}`;
    if (prevMasukBtn) {
      prevMasukBtn.onclick = () => this.filterHistoryByModelAndType(filterKey, 'Unit Masuk');
    }
    if (prevKeluarBtn) {
      prevKeluarBtn.onclick = () => this.filterHistoryByModelAndType(filterKey, 'Unit Keluar');
    }
    if (prevBtn) {
      prevBtn.onclick = () => this.filterInventoryByModel(filterKey);
    }

    popup.classList.remove('hidden');
    this.positionDonutCapsuleOutside(segmentEl, event);
  },

  /**
   * Memperbarui posisi kapsul glassmorphism tetap di LUAR lingkaran donat mengikuti posisi segmen/kursor
   */
  moveDonutCapsule(segmentEl, event) {
    if (!segmentEl) return;
    this.positionDonutCapsuleOutside(segmentEl, event);
  },

  positionDonutCapsuleOutside(segmentEl, event) {
    const wrapper = document.getElementById('donutChartWrapper');
    const svg = document.getElementById('vehicleDonutSvg');
    const popup = document.getElementById('donutSegmentPopup');
    if (!wrapper || !svg || !popup) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();

    const cx = (svgRect.left - wrapperRect.left) + (svgRect.width / 2);
    const cy = (svgRect.top - wrapperRect.top) + (svgRect.height / 2);
    const outerRadius = svgRect.width / 2;

    // Hitung sudut dari titik tengah donat ke kursor (atau sudut tengah segmen jika touch/fallback)
    let angleRad;
    let clientX = null;
    let clientY = null;
    if (event) {
      if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        clientX = event.clientX;
        clientY = event.clientY;
      } else if (event.touches && event.touches[0]) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      }
    }

    if (clientX !== null && clientY !== null) {
      const svgCenterX = svgRect.left + (svgRect.width / 2);
      const svgCenterY = svgRect.top + (svgRect.height / 2);
      angleRad = Math.atan2(clientY - svgCenterY, clientX - svgCenterX);
    } else {
      const offset = parseFloat(segmentEl.dataset.offset || '0');
      const len = parseFloat(segmentEl.dataset.len || '5');
      const midPct = offset + (len / 2);
      angleRad = (midPct / 100) * Math.PI * 2 - (Math.PI / 2);
    }

    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    const popupW = popup.offsetWidth || 165;
    const popupH = popup.offsetHeight || 30;
    const gap = 10;

    // Posisi pusat kapsul di luar tepi lingkaran donat
    const rawCenterX = cx + (outerRadius + gap + (popupW / 2)) * cosA;
    const rawCenterY = cy + (outerRadius + gap + (popupH / 2)) * sinA;

    const minLeft = 6;
    const maxLeft = Math.max(minLeft, wrapperRect.width - popupW - 6);
    const minTop = 2;
    const maxTop = Math.max(minTop, wrapperRect.height - popupH - 2);

    let left = Math.min(maxLeft, Math.max(minLeft, rawCenterX - (popupW / 2)));
    let top = Math.min(maxTop, Math.max(minTop, rawCenterY - (popupH / 2)));

    // Pastikan di layar sempit (mobile) kapsul tetap berada di LUAR lingkaran donat (tidak menutupi donat)
    const nearestX = Math.max(left, Math.min(cx, left + popupW));
    const nearestY = Math.max(top, Math.min(cy, top + popupH));
    const distToDonutCenter = Math.hypot(nearestX - cx, nearestY - cy);

    if (distToDonutCenter < outerRadius + 4) {
      if (sinA < 0) {
        top = Math.max(minTop, cy - outerRadius - popupH - 8);
      } else {
        top = Math.min(maxTop, cy + outerRadius + 8);
      }
    }

    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
  },

  /**
   * Menyembunyikan kapsul glassmorphism saat kursor keluar dari area donat
   */
  hideDonutCapsule() {
    const svg = document.getElementById('vehicleDonutSvg');
    const popup = document.getElementById('donutSegmentPopup');
    if (svg) {
      svg.querySelectorAll('.donut-segment').forEach(seg => {
        seg.dataset.active = 'false';
        seg.setAttribute('stroke-width', '6');
        seg.style.opacity = '1';
      });
    }
    if (popup) {
      popup.classList.add('hidden');
    }
    const centerLabel = document.getElementById('donutCenterLabel');
    const centerVal = document.getElementById('donutCenterValue');
    const centerSub = document.getElementById('donutCenterSub');
    if (centerLabel) centerLabel.textContent = 'TOTAL';
    if (centerVal) centerVal.textContent = String(AppState._totalDonutUnits != null ? AppState._totalDonutUnits : 0);
    if (centerSub) centerSub.textContent = 'Unit';
  },

  /**
   * Menangani gestur sentuh & geser jari (swipe/glide) memutar di atas grafik donat pada layar mobile
   * Mencegah layar ikut tergeser (scroll) dan mencari segmen warna berdasarkan sudut jari terhadap titik tengah donat
   */
  handleDonutTouch(event) {
    if (!event) return;
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();

    const svg = document.getElementById('vehicleDonutSvg');
    if (!svg) return;

    const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0]);
    if (!touch) return;

    const svgRect = svg.getBoundingClientRect();
    const svgCenterX = svgRect.left + (svgRect.width / 2);
    const svgCenterY = svgRect.top + (svgRect.height / 2);

    // Hitung sudut jari dari titik pusat donat (12 o'clock = 0%, searah jarum jam hingga 100%)
    const angleRad = Math.atan2(touch.clientY - svgCenterY, touch.clientX - svgCenterX);
    const degFromTop = ((angleRad * 180 / Math.PI) + 90 + 360) % 360;
    const pct = (degFromTop / 360) * 100;

    const segments = Array.from(svg.querySelectorAll('.donut-segment'));
    if (segments.length === 0) return;

    const matchedSeg = segments.find(seg => {
      const off = parseFloat(seg.dataset.offset || '0');
      const len = parseFloat(seg.dataset.len || '0');
      return pct >= off && pct <= (off + len + 0.15);
    }) || segments[segments.length - 1];

    this.showDonutCapsule(matchedSeg, event);
  },

  selectDonutSegment(segmentEl, event) {
    this.showDonutCapsule(segmentEl, event);
  },

  resetDonutSelection() {
    this.hideDonutCapsule();
  },

  closeDonutPopupOnOutside(event) {
    if (event && event.target && event.target.closest('#vehicleDonutSvg')) return;
    this.hideDonutCapsule();
  },

  /**
   * Menggantikan semua <select> bawaan browser dengan Custom Website Dropdown
   * agar di perangkat mobile tidak memunculkan picker layar penuh bawaan OS,
   * serta menampilkan Popover Kalender Tanggal (7 kolom) & Grid Bulan (3 kolom) yang rapi di History
   */
  initCustomDropdowns() {
    // Pastikan opsi tanggal 1..31 sudah terisi sebelum membangun custom dropdown
    ['histFilterDate', 'modelFilterDate', 'dashFilterDate'].forEach(dateId => {
      const dateSelectCheck = document.getElementById(dateId);
      if (dateSelectCheck && dateSelectCheck.options.length <= 1) {
        dateSelectCheck.innerHTML = '<option value="all">Semua Tgl</option>';
        for (let i = 1; i <= 31; i++) {
          const opt = document.createElement('option');
          opt.value = i;
          opt.textContent = i;
          dateSelectCheck.appendChild(opt);
        }
      }
    });

    const selectIds = [
      'dashFilterDate',
      'dashFilterMonth',
      'dashFilterYear',
      'histFilterDate',
      'histFilterMonth',
      'histFilterYear',
      'modelFilterDate',
      'modelFilterMonth',
      'modelFilterYear',
      'inputMutationType',
      'inputCarModel'
    ];

    const nativeValueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    const shortMonths = {
      '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr',
      '5': 'Mei', '6': 'Jun', '7': 'Jul', '8': 'Agu',
      '9': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Des'
    };

    selectIds.forEach(id => {
      const selectEl = document.getElementById(id);
      if (!selectEl) return;
      if (selectEl.dataset.customEnhanced === 'true') {
        if (typeof selectEl._refreshCustomDropdown === 'function') {
          selectEl._refreshCustomDropdown();
        }
        return;
      }
      selectEl.dataset.customEnhanced = 'true';

      const isCompactFilter = id.startsWith('histFilter') || id.startsWith('modelFilter') || id.startsWith('dashFilter');
      const isDateGrid = id === 'histFilterDate' || id === 'modelFilterDate' || id === 'dashFilterDate';
      const isMonthGrid = id === 'histFilterMonth' || id === 'modelFilterMonth' || id === 'dashFilterMonth';
      const isYearFilter = id === 'histFilterYear' || id === 'modelFilterYear' || id === 'dashFilterYear';

      // Sembunyikan ikon panah SVG bawaan di sebelah select jika ada
      const parentEl = selectEl.parentElement;
      if (parentEl && parentEl.classList.contains('relative')) {
        const siblingSvg = parentEl.querySelector('svg');
        if (siblingSvg) siblingSvg.classList.add('hidden');
      }

      // Sembunyikan elemen <select> asli agar browser mobile tidak membuka native picker
      selectEl.classList.add('hidden');

      // Buat wrapper custom dropdown
      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select-wrapper relative z-10 w-full select-none';

      // Buat tombol trigger yang rapi untuk mobile & desktop (tidak terpotong "...")
      const triggerBtn = document.createElement('button');
      triggerBtn.type = 'button';
      const baseTriggerClass = isCompactFilter
        ? 'w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold text-slate-700 flex items-center justify-between gap-1 shadow-2xs transition cursor-pointer focus:outline-none'
        : 'w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl py-2.5 px-3.5 text-xs font-bold text-slate-800 flex items-center justify-between gap-2 transition cursor-pointer focus:outline-none';
      triggerBtn.className = baseTriggerClass;

      const triggerLabel = document.createElement('span');
      triggerLabel.className = 'truncate text-left leading-tight';

      const triggerArrow = document.createElement('span');
      triggerArrow.className = 'text-slate-400 flex-shrink-0 transition-transform duration-200';
      triggerArrow.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3" d="M19 9l-7 7-7-7"/></svg>`;

      triggerBtn.appendChild(triggerLabel);
      triggerBtn.appendChild(triggerArrow);

      // Buat panel menu pop-up dengan latar belakang SOLID PUTIH (#FFFFFF) agar tabel/kartu di bawahnya tidak tembus
      const menu = document.createElement('div');
      menu.style.backgroundColor = '#ffffff';
      if (isDateGrid) {
        menu.className = 'custom-select-menu hidden absolute top-full mt-2 left-0 w-[252px] sm:w-[268px] z-50 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xl ring-1 ring-black/5';
      } else if (isMonthGrid) {
        menu.className = 'custom-select-menu hidden absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[232px] sm:w-[244px] z-50 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xl ring-1 ring-black/5';
      } else if (isYearFilter) {
        menu.className = 'custom-select-menu hidden absolute top-full mt-2 right-0 min-w-[132px] w-full z-50 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-2xl ring-1 ring-black/5';
      } else {
        menu.className = 'custom-select-menu hidden absolute top-full mt-2 left-0 right-0 w-full z-50 bg-white border border-slate-200 rounded-2xl py-1.5 max-h-56 overflow-y-auto shadow-2xl ring-1 ring-black/5';
      }

      const selectValueAndClose = (val) => {
        selectEl.value = val;
        closeMenu();
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const renderMenuOptions = () => {
        menu.innerHTML = '';
        const currentVal = String(nativeValueDesc ? nativeValueDesc.get.call(selectEl) : selectEl.value);
        const options = Array.from(selectEl.options);
        const selectedOpt = options.find(o => String(o.value) === currentVal) || options[0];

        // Update label tombol trigger agar ringkas & tidak terpotong di layar mobile
        if (selectedOpt) {
          if (isDateGrid) {
            triggerLabel.textContent = currentVal === 'all' ? 'Semua Tgl' : `Tgl ${selectedOpt.textContent}`;
          } else if (isMonthGrid) {
            triggerLabel.textContent = currentVal === 'all' ? 'Semua Bln' : selectedOpt.textContent;
          } else if (isYearFilter) {
            triggerLabel.textContent = currentVal === 'all' ? 'Semua Thn' : selectedOpt.textContent;
          } else {
            triggerLabel.textContent = selectedOpt.textContent;
          }
        }

        // 1. Tampilan Popover Grid Kalender Tanggal (7 Kolom) untuk histFilterDate
        if (isDateGrid) {
          const allOpt = options.find(o => o.value === 'all');
          if (allOpt) {
            const isAllSelected = currentVal === 'all';
            const allBtn = document.createElement('button');
            allBtn.type = 'button';
            allBtn.dataset.val = 'all';
            allBtn.className = `w-full py-2 px-3 mb-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
              isAllSelected
                ? 'bg-slate-900 text-white font-extrabold shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold'
            }`;
            allBtn.innerHTML = `
              <span>Semua Tanggal (1 - 31)</span>
              ${isAllSelected ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-white/20 text-white">Aktif</span>' : ''}
            `;
            allBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              selectValueAndClose('all');
            });
            menu.appendChild(allBtn);
          }

          const grid = document.createElement('div');
          grid.className = 'grid grid-cols-7 gap-1 pt-1 border-t border-slate-100';

          options.filter(o => o.value !== 'all').forEach(opt => {
            const isSelected = String(opt.value) === currentVal;
            const dayBtn = document.createElement('button');
            dayBtn.type = 'button';
            dayBtn.dataset.val = opt.value;
            dayBtn.className = `h-8 rounded-lg text-[11px] flex items-center justify-center transition cursor-pointer ${
              isSelected
                ? 'bg-blue-600 text-white font-black shadow-xs'
                : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-bold border border-slate-200/70'
            }`;
            dayBtn.textContent = opt.textContent;
            dayBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              selectValueAndClose(opt.value);
            });
            grid.appendChild(dayBtn);
          });

          menu.appendChild(grid);
          return;
        }

        // 2. Tampilan Popover Grid Bulan (3 Kolom) untuk histFilterMonth
        if (isMonthGrid) {
          const allOpt = options.find(o => o.value === 'all');
          if (allOpt) {
            const isAllSelected = currentVal === 'all';
            const allBtn = document.createElement('button');
            allBtn.type = 'button';
            allBtn.dataset.val = 'all';
            allBtn.className = `w-full py-2 px-3 mb-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
              isAllSelected
                ? 'bg-slate-900 text-white font-extrabold shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold'
            }`;
            allBtn.innerHTML = `
              <span>Semua Bulan (Jan - Des)</span>
              ${isAllSelected ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-white/20 text-white">Aktif</span>' : ''}
            `;
            allBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              selectValueAndClose('all');
            });
            menu.appendChild(allBtn);
          }

          const grid = document.createElement('div');
          grid.className = 'grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100';

          options.filter(o => o.value !== 'all').forEach(opt => {
            const isSelected = String(opt.value) === currentVal;
            const mBtn = document.createElement('button');
            mBtn.type = 'button';
            mBtn.dataset.val = opt.value;
            mBtn.className = `py-2 px-2 rounded-xl text-xs flex items-center justify-center transition cursor-pointer ${
              isSelected
                ? 'bg-blue-600 text-white font-extrabold shadow-xs'
                : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 font-bold border border-slate-200/80'
            }`;
            mBtn.textContent = shortMonths[String(opt.value)] || opt.textContent;
            mBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              selectValueAndClose(opt.value);
            });
            grid.appendChild(mBtn);
          });

          menu.appendChild(grid);
          return;
        }

        // 3. Tampilan Daftar Standar untuk Tahun & Input Modal
        options.forEach(opt => {
          const isSelected = String(opt.value) === currentVal;
          const itemBtn = document.createElement('button');
          itemBtn.type = 'button';
          itemBtn.dataset.val = opt.value;
          itemBtn.className = `w-full my-0.5 px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
            isSelected
              ? 'bg-blue-50 text-blue-600 font-extrabold'
              : 'text-slate-700 hover:bg-slate-100 font-semibold'
          }`;

          const rawText = opt.textContent || '';
          const textWrap = document.createElement('div');
          textWrap.className = 'min-w-0 flex-1';

          if (rawText.includes(' — ')) {
            const parts = rawText.split(' — ');
            textWrap.innerHTML = `
              <span class="block text-xs font-extrabold leading-tight truncate">${parts[0]}</span>
              <span class="block text-[10px] ${isSelected ? 'text-blue-500' : 'text-slate-400'} font-medium leading-tight truncate mt-0.5">${parts[1]}</span>
            `;
          } else {
            textWrap.innerHTML = `<span class="block leading-tight truncate">${rawText}</span>`;
          }

          itemBtn.appendChild(textWrap);

          if (isSelected) {
            const checkIcon = document.createElement('span');
            checkIcon.className = 'text-blue-600 flex-shrink-0';
            checkIcon.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`;
            itemBtn.appendChild(checkIcon);
          }

          itemBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectValueAndClose(opt.value);
          });

          menu.appendChild(itemBtn);
        });
      };

      const openMenu = () => {
        // Tutup semua custom dropdown lain yang sedang terbuka & reset z-index
        document.querySelectorAll('.custom-select-menu').forEach(m => {
          if (m !== menu) m.classList.add('hidden');
        });
        document.querySelectorAll('.custom-select-wrapper').forEach(w => {
          w.classList.remove('z-50');
          w.classList.add('z-10');
          if (w !== wrapper) {
            const arr = w.querySelector('button > span:last-child');
            if (arr) arr.style.transform = 'rotate(0deg)';
            const btn = w.querySelector('button');
            if (btn) btn.classList.remove('border-blue-500', 'ring-2', 'ring-blue-500/15', 'bg-white');
          }
        });
        document.querySelectorAll('.filter-card-elevated').forEach(c => {
          c.classList.remove('filter-card-elevated');
          c.style.zIndex = '';
        });

        renderMenuOptions();
        wrapper.classList.remove('z-10');
        wrapper.classList.add('z-50');

        // Dynamically elevate parent card so no sibling card or transform stacking context can paint above it
        const parentCard = wrapper.closest('.scroll-reveal, #viewDashboard > div, #viewHistory > div, #viewModelDetail > div');
        if (parentCard) {
          parentCard.classList.add('filter-card-elevated');
          parentCard.style.zIndex = '45';
        }

        triggerBtn.classList.add('border-blue-500', 'ring-2', 'ring-blue-500/15', 'bg-white');
        menu.classList.remove('hidden');
        triggerArrow.style.transform = 'rotate(180deg)';

        if (!isDateGrid && !isMonthGrid) {
          const activeItem = menu.querySelector(`[data-val="${CSS.escape(String(selectEl.value))}"]`);
          if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest' });
          }
        }
      };

      const closeMenu = () => {
        menu.classList.add('hidden');
        wrapper.classList.remove('z-50');
        wrapper.classList.add('z-10');
        const parentCard = wrapper.closest('.filter-card-elevated');
        if (parentCard) {
          parentCard.classList.remove('filter-card-elevated');
          parentCard.style.zIndex = '';
        }
        triggerBtn.classList.remove('border-blue-500', 'ring-2', 'ring-blue-500/15', 'bg-white');
        triggerArrow.style.transform = 'rotate(0deg)';
      };

      triggerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (menu.classList.contains('hidden')) {
          openMenu();
        } else {
          closeMenu();
        }
      });

      // Hook setter .value pada selectEl agar perubahan dari kode JS (misal reset / scan barcode) langsung memperbarui tampilan tombol
      if (nativeValueDesc) {
        Object.defineProperty(selectEl, 'value', {
          get() {
            return nativeValueDesc.get.call(this);
          },
          set(newVal) {
            nativeValueDesc.set.call(this, newVal);
            renderMenuOptions();
          }
        });
      }

      selectEl._refreshCustomDropdown = renderMenuOptions;

      wrapper.appendChild(triggerBtn);
      wrapper.appendChild(menu);
      selectEl.insertAdjacentElement('afterend', wrapper);

      renderMenuOptions();
    });

    // Tutup dropdown saat klik di luar
    if (!this._customDropdownOutsideBound) {
      this._customDropdownOutsideBound = true;
      document.addEventListener('click', (e) => {
        if (e.target && e.target.closest('.custom-select-wrapper')) return;
        document.querySelectorAll('.custom-select-menu').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.custom-select-wrapper').forEach(w => {
          w.classList.remove('z-50');
          w.classList.add('z-10');
          const arr = w.querySelector('button > span:last-child');
          if (arr) arr.style.transform = 'rotate(0deg)';
          const btn = w.querySelector('button');
          if (btn) btn.classList.remove('border-blue-500', 'ring-2', 'ring-blue-500/15', 'bg-white');
        });
        document.querySelectorAll('.filter-card-elevated').forEach(c => {
          c.classList.remove('filter-card-elevated');
          c.style.zIndex = '';
        });
      });
    }
  },

  /**
   * Menginisialisasi animasi scroll profesional (IntersectionObserver compositor-friendly)
   */
  initScrollAnimations() {
    const vp = document.getElementById('appMainViewport');
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.scroll-reveal').forEach(el => el.classList.add('is-visible'));
      return;
    }

    if (!this._scrollObserver) {
      this._scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            // Unobserve setelah tampil agar browser tidak terus-menerus kalkulasi ulang saat scrolling (mencegah lag)
            this._scrollObserver.unobserve(entry.target);
          }
        });
      }, {
        root: vp || null,
        rootMargin: '50px 0px 50px 0px',
        threshold: 0.05
      });
    }

    this.refreshScrollReveal();
  },

  refreshScrollReveal() {
    const elements = document.querySelectorAll('.scroll-reveal');
    if (!this._scrollObserver) {
      elements.forEach(el => el.classList.add('is-visible'));
      return;
    }
    elements.forEach(el => {
      this._scrollObserver.observe(el);
    });
  },

  // ==========================================================================
  // PROFILE & SETTINGS SUB-PAGES & DIALOGS
  // ==========================================================================

  /**
   * Terapkan data profil operator ke elemen UI (header & kartu pengaturan)
   */
  applyUserProfile() {
    const profile = AppState.userProfile || {
      name: CONFIG.OPERATOR_NAME,
      npk: CONFIG.OPERATOR_NPK,
      branch: CONFIG.OPERATOR_BRANCH,
      role: CONFIG.OPERATOR_ROLE,
      photo: CONFIG.OPERATOR_PHOTO
    };

    // Update Profile Card in Settings
    const avatarEl = document.getElementById('profileCardAvatar');
    const nameEl = document.getElementById('profileCardName');
    const roleEl = document.getElementById('profileCardRole');
    const npkEl = document.getElementById('profileCardNpk');
    const branchEl = document.getElementById('profileCardBranch');

    if (avatarEl && profile.photo) avatarEl.src = profile.photo;
    if (nameEl) nameEl.innerText = profile.name;
    if (roleEl) roleEl.innerText = profile.role;
    if (npkEl) npkEl.innerText = profile.npk || '-';
    if (branchEl) {
      branchEl.innerText = profile.branch;
      branchEl.title = profile.branch;
    }

    // Update Header Avatar & Info (Desktop)
    const headerAvatar = document.getElementById('headerAvatarImg');
    const headerName = document.getElementById('headerOperatorName');
    const headerRole = document.getElementById('headerOperatorRole');

    if (headerAvatar && profile.photo) headerAvatar.src = profile.photo;
    if (headerName) headerName.innerText = profile.name;
    if (headerRole) headerRole.innerText = profile.role;

    // Update Sub-Page Edit Form
    const inputName = document.getElementById('inputProfileName');
    const inputNpk = document.getElementById('inputProfileNpk');
    const inputBranch = document.getElementById('inputProfileBranch');
    const inputRole = document.getElementById('inputProfileRole');
    const editPreview = document.getElementById('editProfileAvatarPreview');

    if (inputName) inputName.value = profile.name;
    if (inputNpk) inputNpk.value = profile.npk;
    if (inputBranch) inputBranch.value = profile.branch;
    if (inputRole) inputRole.value = profile.role;
    if (editPreview && profile.photo) editPreview.src = profile.photo;

    // Sync CONFIG operator name for recording PIC
    if (profile.name) CONFIG.OPERATOR_NAME = profile.name;
    if (profile.npk) CONFIG.OPERATOR_NPK = profile.npk;
  },

  /**
   * Terapkan data konfigurasi otomatisasi laporan
   */
  applyAutomationConfig() {
    const auto = AppState.automationConfig || {
      schedule: 'Setiap Hari 08:00 WIB',
      email: 'admin.logistics@daihatsu.co.id',
      type: 'Daily Digest PDF Rekap Mutasi Unit Masuk & Keluar'
    };

    const schedEl = document.getElementById('autoScheduleDisplay');
    const emailEl = document.getElementById('autoEmailDisplay');
    if (schedEl) schedEl.innerText = auto.schedule || 'Setiap Hari 08:00 WIB';

    // Parse daftar email
    let emailList = [];
    if (Array.isArray(auto.emails) && auto.emails.length > 0) {
      emailList = auto.emails;
    } else if (auto.email) {
      emailList = String(auto.email).split(/[,;\n\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    }
    if (emailList.length === 0) emailList = ['admin.logistics@daihatsu.co.id'];

    if (emailEl) {
      if (emailList.length > 1) {
        emailEl.innerText = `${emailList[0]} (+${emailList.length - 1} lainnya)`;
        emailEl.title = emailList.join(', ');
      } else {
        emailEl.innerText = emailList[0] || 'admin.logistics@daihatsu.co.id';
        emailEl.title = emailList[0] || '';
      }
    }

    const inputSched = document.getElementById('inputAutoSchedule');
    const inputEmail = document.getElementById('inputAutoEmail');
    const inputType = document.getElementById('inputAutoType');
    if (inputSched) inputSched.value = auto.schedule || 'Setiap Hari 08:00 WIB';
    if (inputEmail) inputEmail.value = emailList.join(', ');
    if (inputType) inputType.value = auto.type || 'Daily Digest PDF Rekap Mutasi Unit Masuk & Keluar';

    if (this.updateNotificationTargetEmailDisplay) {
      this.updateNotificationTargetEmailDisplay();
    }
  },

  /**
   * Buka sub-halaman edit profil operator
   */
  openEditProfilePage() {
    const mainView = document.getElementById('settingsMainView');
    const editView = document.getElementById('settingsEditProfileView');
    if (mainView && editView) {
      mainView.classList.add('hidden');
      editView.classList.remove('hidden');
    }
    this.applyUserProfile();

    const vp = document.getElementById('appMainViewport');
    if (vp) vp.scrollTop = 0;
  },

  /**
   * Tutup sub-halaman edit profil dan kembali ke tampilan utama pengaturan
   */
  closeEditProfilePage() {
    const mainView = document.getElementById('settingsMainView');
    const editView = document.getElementById('settingsEditProfileView');
    if (mainView && editView) {
      editView.classList.add('hidden');
      mainView.classList.remove('hidden');
    }
    AppState._tempProfilePhoto = null;
  },

  /**
   * Tangani pemilihan foto profil baru
   */
  handleProfilePhotoSelected(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('Pilih file gambar yang valid!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      AppState._tempProfilePhoto = dataUrl;
      const previewEl = document.getElementById('editProfileAvatarPreview');
      if (previewEl) previewEl.src = dataUrl;
      this.showToast('Foto profil dipilih. Klik Simpan untuk menerapkan.');
    };
    reader.readAsDataURL(file);
  },

  /**
   * Simpan perubahan profil operator (nama, NPK, cabang, jabatan, foto) ke database Google Sheets
   */
  async saveProfileData() {
    const name = (document.getElementById('inputProfileName')?.value || '').trim();
    const npk = (document.getElementById('inputProfileNpk')?.value || '').trim();
    const branch = (document.getElementById('inputProfileBranch')?.value || '').trim();
    const role = (document.getElementById('inputProfileRole')?.value || '').trim();

    if (!name || !npk) {
      this.showToast('Nama petugas dan NPK wajib diisi!');
      return;
    }

    const saveBtn = document.querySelector('button[onclick*="saveProfileData"]');
    const originalBtnHtml = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin text-white inline-block mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span>Menyimpan ke Database...</span>
      `;
    }

    const oldNpk = AppState.userProfile.npk;
    const newPhoto = AppState._tempProfilePhoto || null;

    // Terapkan ke state lokal terlebih dahulu
    AppState.userProfile.name = name;
    AppState.userProfile.npk = npk;
    if (branch) AppState.userProfile.branch = branch;
    if (role) AppState.userProfile.role = role;
    if (newPhoto) AppState.userProfile.photo = newPhoto;

    AppState.saveToCache();
    this.applyUserProfile();

    try {
      this.showToast('⏳ Menyinkronkan profil ke database Google Sheets...');
      const payload = {
        oldNpk: oldNpk,
        npk: npk,
        name: name,
        branch: branch,
        role: role,
        photo: newPhoto || AppState.userProfile.photo
      };

      const res = await ApiService.updateProfile(payload);
      if (res && res.success) {
        if (res.user) {
          if (res.user.photo) AppState.userProfile.photo = res.user.photo;
          if (res.user.name) AppState.userProfile.name = res.user.name;
          if (res.user.npk) AppState.userProfile.npk = res.user.npk;
          if (res.user.branch) AppState.userProfile.branch = res.user.branch;
          if (res.user.role) AppState.userProfile.role = res.user.role;
        }
        AppState._tempProfilePhoto = null;
        AppState.saveToCache();
        this.applyUserProfile();
        this.closeEditProfilePage();
        this.showToast('✅ Berhasil! Perubahan profil tersimpan di database Google Sheets!');
      } else {
        this.closeEditProfilePage();
        this.showToast('⚠️ Tersimpan di browser. Database: ' + (res?.message || 'Gagal tersambung'));
      }
    } catch (err) {
      console.error('[UI] Gagal simpan profil ke backend:', err);
      this.closeEditProfilePage();
      this.showToast('⚠️ Tersimpan di perangkat (Mode Offline).');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnHtml;
      }
    }
  },

  automationState: {
    frequency: 'daily', // 'daily' | 'weekly' | 'monthly'
    dayOfWeek: 'Senin',
    dayOfMonth: 'Akhir Bulan',
    period: 'pagi', // 'pagi' | 'siang' | 'sore' | 'malam'
    hour12: 8,
    minute: 0,
    emails: ['admin.logistics@daihatsu.co.id']
  },

  /**
   * Menginisialisasi state modal otomatisasi dari AppState saat dibuka
   */
  initAutomationModal() {
    const auto = AppState.automationConfig || {};
    const schedStr = auto.schedule || 'Setiap Hari 08:00 WIB';
    const lowerSched = schedStr.toLowerCase();

    // 1. Ekstrak Frekuensi
    if (lowerSched.includes('senin') || lowerSched.includes('selasa') || lowerSched.includes('rabu') || lowerSched.includes('kamis') || lowerSched.includes('jumat') || lowerSched.includes('sabtu') || lowerSched.includes('minggu')) {
      this.automationState.frequency = 'weekly';
      if (lowerSched.includes('selasa')) this.automationState.dayOfWeek = 'Selasa';
      else if (lowerSched.includes('rabu')) this.automationState.dayOfWeek = 'Rabu';
      else if (lowerSched.includes('kamis')) this.automationState.dayOfWeek = 'Kamis';
      else if (lowerSched.includes('jumat')) this.automationState.dayOfWeek = 'Jumat';
      else if (lowerSched.includes('sabtu')) this.automationState.dayOfWeek = 'Sabtu';
      else if (lowerSched.includes('minggu')) this.automationState.dayOfWeek = 'Minggu';
      else this.automationState.dayOfWeek = 'Senin';
    } else if (lowerSched.includes('bulan') || lowerSched.includes('tgl') || lowerSched.includes('tanggal')) {
      this.automationState.frequency = 'monthly';
      if (lowerSched.includes('15')) this.automationState.dayOfMonth = 'Tanggal 15';
      else if (lowerSched.includes('25')) this.automationState.dayOfMonth = 'Tanggal 25';
      else if (lowerSched.includes('28')) this.automationState.dayOfMonth = 'Tanggal 28';
      else if (lowerSched.includes(' 1') || lowerSched.includes('01')) this.automationState.dayOfMonth = 'Tanggal 1';
      else this.automationState.dayOfMonth = 'Akhir Bulan';
    } else {
      this.automationState.frequency = 'daily';
    }

    // 2. Ekstrak Jam & Menit
    const timeMatch = schedStr.match(/(\d{1,2})[:.](\d{2})/);
    let h24 = 8;
    let m = 0;
    if (timeMatch) {
      h24 = parseInt(timeMatch[1], 10);
      m = parseInt(timeMatch[2], 10);
    }
    if (isNaN(h24) || h24 < 0 || h24 > 23) h24 = 8;
    this.automationState.minute = [0, 15, 30, 45].includes(m) ? m : 0;

    // Mapping 24h ke period dan hour12
    if (h24 >= 0 && h24 < 12) {
      this.automationState.period = 'pagi';
      this.automationState.hour12 = h24 === 0 ? 12 : h24;
    } else if (h24 >= 12 && h24 <= 14) {
      this.automationState.period = 'siang';
      this.automationState.hour12 = h24 === 12 ? 12 : (h24 - 12);
    } else if (h24 >= 15 && h24 <= 18) {
      this.automationState.period = 'sore';
      this.automationState.hour12 = (h24 - 12);
    } else {
      this.automationState.period = 'malam';
      this.automationState.hour12 = (h24 - 12);
    }

    // 3. Ekstrak Daftar Target Email
    let emailList = [];
    if (Array.isArray(auto.emails) && auto.emails.length > 0) {
      emailList = [...auto.emails];
    } else if (auto.email) {
      emailList = String(auto.email).split(/[,;\n\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    }
    if (emailList.length === 0) emailList = ['admin.logistics@daihatsu.co.id'];
    this.automationState.emails = Array.from(new Set(emailList));

    // Update Tipe Dokumen
    const inputType = document.getElementById('inputAutoType');
    if (inputType) inputType.value = auto.type || 'Daily Digest PDF Rekap Mutasi Unit Masuk & Keluar';

    // Update Seluruh Komponen Tampilan Modal
    this.updateFrequencyUI();
    this.updateClockUI();
    this.renderEmailChips();
    this.syncHiddenScheduleInput();
    this.syncHiddenEmailInput();
  },

  /**
   * Buka modal pengaturan Jadwal Pengiriman (Analog Clock Face "Jam Bulet" & Frekuensi)
   */
  openEditScheduleModal() {
    this.initAutomationModal();
    const modal = document.getElementById('editScheduleModal');
    if (modal) modal.classList.remove('hidden');
  },

  /**
   * Tutup modal pengaturan Jadwal Pengiriman
   */
  closeEditScheduleModal() {
    const modal = document.getElementById('editScheduleModal');
    if (modal) modal.classList.add('hidden');
  },

  /**
   * Buka modal pengaturan Target Email Penerima (Multi-Email Tags/Chips)
   */
  openEditTargetEmailModal() {
    this.initAutomationModal();
    const modal = document.getElementById('editTargetEmailModal');
    if (modal) modal.classList.remove('hidden');
  },

  /**
   * Tutup modal pengaturan Target Email Penerima
   */
  closeEditTargetEmailModal() {
    const modal = document.getElementById('editTargetEmailModal');
    if (modal) modal.classList.add('hidden');
  },

  /**
   * Buka modal pembaruan informasi otomatisasi laporan (Backward compatibility alias)
   */
  openEditAutomationModal() {
    this.openEditScheduleModal();
  },

  /**
   * Tutup modal pembaruan otomatisasi (Backward compatibility alias)
   */
  closeEditAutomationModal() {
    this.closeEditScheduleModal();
    this.closeEditTargetEmailModal();
  },

  /**
   * Ganti Frekuensi (Harian, Mingguan, Bulanan)
   */
  setFrequency(freq) {
    this.automationState.frequency = freq;
    this.updateFrequencyUI();
    this.syncHiddenScheduleInput();
  },

  /**
   * Pilih Hari Mingguan (Senin - Minggu)
   */
  setDayOfWeek(day) {
    this.automationState.dayOfWeek = day;
    this.updateFrequencyUI();
    this.syncHiddenScheduleInput();
  },

  /**
   * Pilih Tanggal Bulanan (Akhir Bulan, Tgl 1, dsb)
   */
  setDayOfMonth(mday) {
    this.automationState.dayOfMonth = mday;
    this.updateFrequencyUI();
    this.syncHiddenScheduleInput();
  },

  /**
   * Render Tab Frekuensi dan opsi hari/tanggal yang sesuai
   */
  updateFrequencyUI() {
    const f = this.automationState.frequency;
    const tabDaily = document.getElementById('tabFreqDaily');
    const tabWeekly = document.getElementById('tabFreqWeekly');
    const tabMonthly = document.getElementById('tabFreqMonthly');
    const weeklyContainer = document.getElementById('weeklyDayContainer');
    const monthlyContainer = document.getElementById('monthlyDayContainer');

    const activeTabClasses = ['bg-white', 'text-indigo-600', 'shadow-xs', 'font-black'];
    const inactiveTabClasses = ['text-slate-600', 'hover:text-slate-900', 'font-bold'];

    [tabDaily, tabWeekly, tabMonthly].forEach(btn => {
      if (btn) {
        btn.classList.remove(...activeTabClasses);
        btn.classList.add(...inactiveTabClasses);
      }
    });

    if (f === 'weekly') {
      if (tabWeekly) {
        tabWeekly.classList.remove(...inactiveTabClasses);
        tabWeekly.classList.add(...activeTabClasses);
      }
      if (weeklyContainer) weeklyContainer.classList.remove('hidden');
      if (monthlyContainer) monthlyContainer.classList.add('hidden');

      // Highlight tombol hari
      document.querySelectorAll('.day-btn').forEach(btn => {
        const isMatch = btn.getAttribute('data-day') === this.automationState.dayOfWeek;
        btn.className = `day-btn py-1.5 text-[11px] font-bold rounded-xl transition cursor-pointer text-center ${
          isMatch ? 'border border-indigo-200 bg-indigo-50 text-indigo-700 font-black' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`;
      });
    } else if (f === 'monthly') {
      if (tabMonthly) {
        tabMonthly.classList.remove(...inactiveTabClasses);
        tabMonthly.classList.add(...activeTabClasses);
      }
      if (weeklyContainer) weeklyContainer.classList.add('hidden');
      if (monthlyContainer) monthlyContainer.classList.remove('hidden');

      // Highlight tombol tanggal bulanan
      document.querySelectorAll('.month-day-btn').forEach(btn => {
        const isMatch = btn.getAttribute('data-mday') === this.automationState.dayOfMonth;
        btn.className = `month-day-btn py-1.5 text-[11px] font-bold rounded-xl transition cursor-pointer text-center ${
          isMatch ? 'border border-indigo-200 bg-indigo-50 text-indigo-700 font-black' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`;
      });
    } else {
      if (tabDaily) {
        tabDaily.classList.remove(...inactiveTabClasses);
        tabDaily.classList.add(...activeTabClasses);
      }
      if (weeklyContainer) weeklyContainer.classList.add('hidden');
      if (monthlyContainer) monthlyContainer.classList.add('hidden');
    }
  },

  /**
   * Set Periode Waktu (Pagi, Siang, Sore, Malam)
   */
  setTimePeriod(p) {
    this.automationState.period = p;
    // Sesuaikan default hour12 jika tidak pas dengan periode
    if (p === 'pagi' && (this.automationState.hour12 < 1 || this.automationState.hour12 > 11)) {
      this.automationState.hour12 = 8;
    } else if (p === 'siang' && ![12, 1, 2].includes(this.automationState.hour12)) {
      this.automationState.hour12 = 12;
    } else if (p === 'sore' && ![3, 4, 5, 6].includes(this.automationState.hour12)) {
      this.automationState.hour12 = 5;
    } else if (p === 'malam' && ![7, 8, 9, 10, 11].includes(this.automationState.hour12)) {
      this.automationState.hour12 = 8;
    }
    this.updateClockUI();
    this.syncHiddenScheduleInput();
  },

  /**
   * Set Jam dari klik jam bulet analog
   */
  setHourFromClock(h) {
    this.automationState.hour12 = h;
    // Otomatis sesuaikan periode jika user memilih jam yang khas
    if (h >= 7 && h <= 11) {
      if (this.automationState.period !== 'malam') this.automationState.period = 'pagi';
    } else if (h === 12 || h === 1 || h === 2) {
      if (this.automationState.period === 'pagi' && h === 12) this.automationState.period = 'siang';
      else if (this.automationState.period === 'sore' || this.automationState.period === 'malam') this.automationState.period = 'siang';
    } else if (h >= 3 && h <= 6) {
      this.automationState.period = 'sore';
    }
    this.updateClockUI();
    this.syncHiddenScheduleInput();
  },

  /**
   * Set Menit (:00, :15, :30, :45)
   */
  setMinute(m) {
    this.automationState.minute = parseInt(m, 10) || 0;
    this.updateClockUI();
    this.syncHiddenScheduleInput();
  },

  /**
   * Dapatkan Jam Format 24 Jam
   */
  getHour24() {
    const h = this.automationState.hour12;
    const p = this.automationState.period;
    if (p === 'pagi') {
      return (h === 12) ? 0 : h;
    } else if (p === 'siang') {
      if (h === 12) return 12;
      return (h <= 3) ? h + 12 : 12;
    } else if (p === 'sore') {
      return (h <= 6) ? h + 12 : 17;
    } else { // malam
      return (h < 12) ? h + 12 : 20;
    }
  },

  /**
   * Update Jarum Jam, Tombol Angka Jam, dan Tampilan Digital
   */
  updateClockUI() {
    const h12 = this.automationState.hour12;
    const h24 = this.getHour24();
    const m = this.automationState.minute;
    const period = this.automationState.period;

    // 1. Putar Jarum Jam (Needle)
    const needle = document.getElementById('clockNeedle');
    if (needle) {
      const rot = (h12 % 12) * 30;
      needle.style.transform = `translateX(-50%) rotate(${rot}deg)`;
    }

    // 2. Highlight Angka Jam yang terpilih di jam bulet
    document.querySelectorAll('.clock-num-btn').forEach(btn => {
      const btnHour = parseInt(btn.getAttribute('data-hour'), 10);
      if (btnHour === h12) {
        btn.className = 'clock-num-btn absolute w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white bg-indigo-600 shadow-md shadow-indigo-500/40 scale-110 transition cursor-pointer z-15';
      } else {
        btn.className = 'clock-num-btn absolute w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition cursor-pointer z-15';
      }
    });

    // 3. Highlight Tombol Periode (Pagi, Siang, Sore, Malam)
    const periods = ['pagi', 'siang', 'sore', 'malam'];
    periods.forEach(p => {
      const cap = p.charAt(0).toUpperCase() + p.slice(1);
      const btn = document.getElementById('btnPeriod' + cap);
      if (btn) {
        if (p === period) {
          btn.className = 'period-btn py-1.5 text-[11px] font-black rounded-xl transition cursor-pointer bg-white text-indigo-600 shadow-xs';
        } else {
          btn.className = 'period-btn py-1.5 text-[11px] font-bold rounded-xl transition cursor-pointer text-slate-600 hover:text-slate-900';
        }
      }
    });

    // 4. Highlight Menit
    document.querySelectorAll('.min-btn').forEach(btn => {
      const minVal = parseInt(btn.getAttribute('data-min'), 10);
      if (minVal === m) {
        btn.className = 'min-btn px-2.5 py-1 text-[11px] font-black rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 transition cursor-pointer';
      } else {
        btn.className = 'min-btn px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition cursor-pointer';
      }
    });

    // 5. Digital Preview Readout
    const digitalEl = document.getElementById('clockDigitalDisplay');
    const badgeEl = document.getElementById('clockPeriodTextBadge');
    if (digitalEl) {
      digitalEl.innerText = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (badgeEl) {
      const labelMap = { pagi: 'Pagi', siang: 'Siang', sore: 'Sore', malam: 'Malam' };
      badgeEl.innerText = labelMap[period] || 'WIB';
    }
  },

  /**
   * Susun string teks jadwal alami (contoh: "Setiap Hari 08:00 WIB", "Setiap Senin 17:00 WIB")
   */
  buildScheduleString() {
    const h24 = String(this.getHour24()).padStart(2, '0');
    const m = String(this.automationState.minute).padStart(2, '0');
    const timeStr = `${h24}:${m} WIB`;

    if (this.automationState.frequency === 'weekly') {
      return `Setiap ${this.automationState.dayOfWeek} ${timeStr}`;
    } else if (this.automationState.frequency === 'monthly') {
      if (this.automationState.dayOfMonth === 'Akhir Bulan') {
        return `Akhir Bulan ${timeStr}`;
      } else {
        return `Setiap ${this.automationState.dayOfMonth} ${timeStr}`;
      }
    } else {
      return `Setiap Hari ${timeStr}`;
    }
  },

  /**
   * Sinkronkan teks jadwal ke hidden input #inputAutoSchedule dan ringkasan jadwal
   */
  syncHiddenScheduleInput() {
    const schedStr = this.buildScheduleString();
    const inputSched = document.getElementById('inputAutoSchedule');
    if (inputSched) inputSched.value = schedStr;
    const previewSummary = document.getElementById('schedulePreviewSummary');
    if (previewSummary) previewSummary.innerText = schedStr;
  },

  /**
   * Tambah Email Penerima (Mendukung > 5 email)
   */
  addEmailRecipient(rawInput = null) {
    const inputEl = document.getElementById('inputNewEmailRecipient');
    const text = (rawInput !== null ? rawInput : (inputEl ? inputEl.value : '')).trim();
    if (!text) return;

    // Pisahkan jika pengguna memasukkan koma, spasi, atau titik koma
    const parts = text.split(/[,;\n\s]+/).map(e => e.trim().toLowerCase()).filter(e => e);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let addedCount = 0;

    parts.forEach(em => {
      if (emailRegex.test(em)) {
        if (!this.automationState.emails.includes(em)) {
          this.automationState.emails.push(em);
          addedCount++;
        }
      }
    });

    if (addedCount === 0 && parts.length > 0) {
      this.showToast('Format email tidak valid! Gunakan format nama@domain.com');
    } else if (inputEl) {
      inputEl.value = '';
    }

    this.renderEmailChips();
    this.syncHiddenEmailInput();
  },

  /**
   * Hapus Email Penerima dari chips
   */
  removeEmailRecipient(idx) {
    if (this.automationState.emails.length <= 1) {
      this.showToast('Minimal harus ada 1 target email penerima laporan!');
      return;
    }
    this.automationState.emails.splice(idx, 1);
    this.renderEmailChips();
    this.syncHiddenEmailInput();
  },

  /**
   * Handle keydown pada input email (Enter atau koma otomatis tambah)
   */
  handleEmailInputKeydown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      this.addEmailRecipient();
    }
  },

  /**
   * Render Tag Chips untuk seluruh email target
   */
  renderEmailChips() {
    const container = document.getElementById('emailChipsList');
    const badge = document.getElementById('emailChipsCountBadge');
    if (!container) return;

    const emails = this.automationState.emails || [];

    if (badge) {
      badge.innerText = `${emails.length} Email Terdaftar${emails.length > 5 ? ' (Bisa > 5 email)' : ''}`;
    }

    if (emails.length === 0) {
      container.innerHTML = `
        <div class="w-full text-center py-2 text-slate-400 text-xs italic">
          Belum ada target email. Silakan tambahkan email penerima di bawah.
        </div>
      `;
      return;
    }

    container.innerHTML = emails.map((em, idx) => `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 shadow-2xs text-[11px] font-bold text-slate-800 transition hover:border-slate-300">
        <svg class="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/></svg>
        <span class="truncate max-w-[190px] sm:max-w-[260px]">${em}</span>
        <button type="button" onclick="UI.removeEmailRecipient(${idx})" class="w-4 h-4 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center text-xs font-black transition cursor-pointer" title="Hapus email">&times;</button>
      </span>
    `).join('');
  },

  /**
   * Sinkronkan daftar email ke hidden input #inputAutoEmail
   */
  syncHiddenEmailInput() {
    const inputEmail = document.getElementById('inputAutoEmail');
    if (inputEmail) inputEmail.value = (this.automationState.emails || []).join(', ');
  },

  /**
   * Simpan khusus Jadwal Pengiriman Laporan ke Google Sheets & State
   */
  async saveScheduleData() {
    const sched = this.buildScheduleString();
    const saveBtn = document.querySelector('button[onclick*="saveScheduleData"]');
    const originalBtnHtml = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin text-white inline-block mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span>Menyimpan Jadwal...</span>
      `;
    }

    if (!AppState.automationConfig) AppState.automationConfig = {};
    AppState.automationConfig.schedule = sched;
    AppState.saveToCache();
    this.applyAutomationConfig();

    try {
      this.showToast('⏳ Menyimpan jadwal ke database cloud...');
      const payload = {
        schedule: sched,
        AUTO_SCHEDULE_TEXT: sched,
        DAILY_REPORT_HOUR: this.getHour24()
      };

      console.log('[UI] Mengirim data jadwal ke backend:', payload);
      let res = await ApiService.updateConfig(payload);
      console.log('[UI] Hasil respons update jadwal:', res);

      let usedFallback = false;

      if (!res || !res.success) {
        console.warn('[UI] updateConfig belum aktif di live Apps Script, mencoba fallback updateProfile...', res);
        const profileRes = await ApiService.updateProfile({ 
          schedule: sched, 
          AUTO_SCHEDULE_TEXT: sched,
          DAILY_REPORT_HOUR: this.getHour24() 
        });
        console.log('[UI] Hasil respons fallback updateProfile:', profileRes);
        if (profileRes && profileRes.success) {
          usedFallback = true;
          res = { success: true, message: 'Jadwal berhasil diperbarui di database.' };
        }
      }

      if (res && res.success) {
        if (res.config && res.config.AUTO_SCHEDULE_TEXT) {
          AppState.automationConfig.schedule = res.config.AUTO_SCHEDULE_TEXT;
        }
        if (res.config && res.config.DAILY_REPORT_HOUR !== undefined) {
          AppState.automationConfig.DAILY_REPORT_HOUR = res.config.DAILY_REPORT_HOUR;
        }
        AppState.saveToCache();
        this.applyAutomationConfig();
        this.closeEditScheduleModal();
        this.showToast('✅ Berhasil! Jadwal pengiriman laporan tersimpan di database Google Sheets!');
      } else {
        const errMsg = (res && (res.message || res.error)) ? res.message || res.error : '';
        this.closeEditScheduleModal();
        if (errMsg && errMsg.includes('401')) {
          this.showToast('⚠️ Token API tidak cocok. Pastikan Apps Script telah diperbarui.');
        } else {
          this.showToast('⚠️ Tersimpan di HP. Untuk sinkron cloud: Terapkan Deployment Versi Baru di Apps Script.');
        }
      }
    } catch (err) {
      console.error('[UI] Gagal simpan jadwal ke backend:', err);
      this.closeEditScheduleModal();
      this.showToast('⚠️ Tersimpan di perangkat (Mode Offline).');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnHtml;
      }
    }
  },

  /**
   * Simpan khusus Target Email Penerima Laporan ke Google Sheets & State
   */
  async saveTargetEmailData() {
    const emailList = (this.automationState.emails && this.automationState.emails.length > 0)
      ? this.automationState.emails
      : (document.getElementById('inputAutoEmail')?.value || '').split(/[,;\n\s]+/).filter(e => e.includes('@'));
    const emailStr = emailList.join(', ');
    const type = (document.getElementById('inputAutoType')?.value || '').trim() || 'Daily Digest PDF Rekap Mutasi Unit Masuk & Keluar';

    if (emailList.length === 0) {
      this.showToast('Minimal harus ada 1 email penerima laporan!');
      return;
    }

    const saveBtn = document.querySelector('button[onclick*="saveTargetEmailData"]');
    const originalBtnHtml = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin text-white inline-block mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span>Menyimpan Target Email...</span>
      `;
    }

    if (!AppState.automationConfig) AppState.automationConfig = {};
    AppState.automationConfig.email = emailStr;
    AppState.automationConfig.emails = emailList;
    AppState.automationConfig.type = type;
    AppState.saveToCache();
    this.applyAutomationConfig();
    this.updateNotificationTargetEmailDisplay();
    this.renderEmailNotifications();

    try {
      this.showToast('⏳ Menyimpan target email ke database cloud...');
      const payload = {
        email: emailStr,
        emails: emailList,
        TARGET_EMAIL: emailStr,
        type: type,
        REPORT_DOCUMENT_TYPE: type
      };

      console.log('[UI] Mengirim data target email ke backend:', payload);
      let res = await ApiService.updateConfig(payload);
      console.log('[UI] Hasil respons update email:', res);

      let usedFallback = false;

      if (!res || !res.success) {
        console.warn('[UI] updateConfig belum aktif di live Apps Script, mencoba fallback updateProfile...', res);
        const profileRes = await ApiService.updateProfile({ 
          email: emailStr, 
          emails: emailList,
          TARGET_EMAIL: emailStr,
          type: type 
        });
        console.log('[UI] Hasil respons fallback updateProfile email:', profileRes);
        if (profileRes && profileRes.success) {
          usedFallback = true;
          res = { success: true, message: 'Target email berhasil diperbarui di database.' };
        }
      }

      if (res && res.success) {
        if (res.config && res.config.TARGET_EMAIL) {
          AppState.automationConfig.email = res.config.TARGET_EMAIL;
          AppState.automationConfig.emails = String(res.config.TARGET_EMAIL).split(/[,;\n\s]+/).filter(e => e.includes('@'));
        }
        if (res.config && res.config.REPORT_DOCUMENT_TYPE) {
          AppState.automationConfig.type = res.config.REPORT_DOCUMENT_TYPE;
        }
        AppState.saveToCache();
        this.applyAutomationConfig();
        this.updateNotificationTargetEmailDisplay();
        this.renderEmailNotifications();
        this.closeEditTargetEmailModal();
        this.showToast('✅ Berhasil! Target email penerima laporan tersimpan di database Google Sheets!');
      } else {
        const errMsg = (res && (res.message || res.error)) ? res.message || res.error : '';
        this.closeEditTargetEmailModal();
        if (errMsg && errMsg.includes('401')) {
          this.showToast('⚠️ Token API tidak cocok. Pastikan Apps Script telah diperbarui.');
        } else {
          this.showToast('⚠️ Tersimpan di HP. Untuk sinkron cloud: Terapkan Deployment Versi Baru di Apps Script.');
        }
      }
    } catch (err) {
      console.error('[UI] Gagal simpan target email ke backend:', err);
      this.closeEditTargetEmailModal();
      this.showToast('⚠️ Tersimpan di perangkat (Mode Offline).');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnHtml;
      }
    }
  },

  /**
   * Simpan pembaruan otomatisasi laporan (Jadwal & Email bersamaan - Backward compatibility)
   */
  async saveAutomationData() {
    await this.saveScheduleData();
    await this.saveTargetEmailData();
  },

  /**
   * Periksa status kesehatan koneksi cloud & sinkronisasi data offline dari Google Spreadsheet
   */
  async checkCloudHealth() {
    const dotEl = document.getElementById('cloudGasStatusDot');
    const textEl = document.getElementById('cloudGasStatusText');
    const tipEl = document.getElementById('cloudGasStatusTip');

    if (dotEl) dotEl.className = 'w-2 h-2 rounded-full bg-blue-500 animate-pulse';
    if (textEl) textEl.textContent = 'Memeriksa & Sinkronisasi...';
    if (tipEl) tipEl.textContent = 'Menghubungi database Google Sheets...';

    this.showToast('🔄 Memeriksa koneksi & menyinkronkan data database...', 2000);

    try {
      const health = await ApiService.checkHealth();
      if (health && health.success) {
        if (dotEl) dotEl.className = 'w-2 h-2 rounded-full bg-emerald-500';
        if (textEl) textEl.textContent = health.mode === 'direct' ? 'Database Terhubung (Direct Web App)' : 'Database Cloud Terhubung (Vercel)';
        if (tipEl) tipEl.textContent = `Host: ${health.appScriptHost || 'Google Apps Script'} ✓`;

        await ApiService.fetchInitialData();
        const invCount = AppState.inventoryData?.length || 0;
        const histCount = AppState.historyData?.length || 0;
        this.showToast(`✅ Database Terhubung! ${invCount} Model, ${histCount} Mutasi tersinkronisasi.`);
        return;
      }

      if (dotEl) dotEl.className = 'w-2 h-2 rounded-full bg-amber-500';
      if (textEl) textEl.textContent = 'Menunggu Konfigurasi URL';
      if (tipEl) tipEl.textContent = health?.tip || 'Variabel APPSCRIPT_URL belum aktif di Vercel atau direct URL belum diisi.';
      this.showToast('⚠️ Belum terhubung ke backend. Periksa konfigurasi URL Google Apps Script.');
    } catch (err) {
      if (dotEl) dotEl.className = 'w-2 h-2 rounded-full bg-rose-500';
      if (textEl) textEl.textContent = 'Mode Offline (Lokal)';
      if (tipEl) tipEl.textContent = 'Aplikasi berjalan secara lokal tanpa koneksi cloud.';
      this.showToast('⚠️ Perangkat dalam mode offline atau server tidak terjangkau.');
    }
  },

  /**
   * Buka dialog konfirmasi logout
   */
  openLogoutModal() {
    const modal = document.getElementById('logoutModal');
    if (modal) modal.classList.remove('hidden');
  },

  /**
   * Tutup dialog konfirmasi logout
   */
  closeLogoutModal() {
    const modal = document.getElementById('logoutModal');
    if (modal) modal.classList.add('hidden');
  },

  /**
   * Eksekusi konfirmasi keluar sistem (Logout Sesi Petugas)
   */
  confirmLogout() {
    this.closeLogoutModal();
    try {
      localStorage.removeItem('daihatsu_auth_user');
      localStorage.removeItem('daihatsu_cached_user_profile');
    } catch (e) {}

    this.showToast('ℹ️ Sesi petugas berhasil diakhiri.');

    // Kembali ke tab beranda (dashboard)
    this.switchTab('dashboard');

    // Re-sync profil dari database secara fresh
    if (typeof ApiService !== 'undefined' && ApiService.fetchInitialData) {
      ApiService.fetchInitialData().then(() => {
        this.renderDashboard();
      });
    }
  },
  /**
   * Toggle Default Camera Setting (Rear / Front Camera)
   */
  toggleDefaultCameraSetting() {
    const current = AppState.facingMode || 'environment';
    const next = current === 'environment' ? 'user' : 'environment';
    AppState.facingMode = next;

    try {
      localStorage.setItem('daihatsu_camera_facing', next);
    } catch (e) {}

    const label = document.getElementById('settingDefaultCameraLabel');
    if (label) {
      label.textContent = next === 'environment' ? 'Rear Camera' : 'Front Camera';
    }

    this.showToast('📷 Kamera default diatur ke: ' + (next === 'environment' ? 'Rear Camera (Belakang)' : 'Front Camera (Depan)'));
  },

  /**
   * Toggle Auto Flashlight Setting
   */
  toggleAutoTorchSetting(isChecked) {
    try {
      localStorage.setItem('daihatsu_auto_torch', isChecked ? 'true' : 'false');
    } catch (e) {}

    this.showToast(isChecked ? '⚡ Auto Flashlight aktif saat scan' : 'Auto Flashlight dinonaktifkan');
  },

  /**
   * Toggle Daily Digest Email Setting
   */
  async toggleDailyDigestSetting(isChecked) {
    if (!AppState.automationConfig) AppState.automationConfig = {};
    AppState.automationConfig.enabled = isChecked;

    try {
      await ApiService.updateConfig({
        AUTO_EMAIL_ENABLED: isChecked ? 'TRUE' : 'FALSE'
      });
    } catch (e) {}

    this.showToast(isChecked ? '✅ Email Daily Digest diaktifkan' : 'Email Daily Digest dinonaktifkan');
  },

  /**
   * Inisialisasi status toggle preferensi pada Menu Settings
   */
  syncSettingsPreferences() {
    // 1. Default Camera
    const savedFacing = localStorage.getItem('daihatsu_camera_facing') || 'environment';
    AppState.facingMode = savedFacing;
    const label = document.getElementById('settingDefaultCameraLabel');
    if (label) {
      label.textContent = savedFacing === 'environment' ? 'Rear Camera' : 'Front Camera';
    }

    // 2. Auto Flashlight
    const savedTorch = localStorage.getItem('daihatsu_auto_torch') === 'true';
    const torchToggle = document.getElementById('settingAutoTorchToggle');
    if (torchToggle) torchToggle.checked = savedTorch;

    // 3. Daily Digest Toggle
    const digestToggle = document.getElementById('settingDailyDigestToggle');
    if (digestToggle && AppState.automationConfig) {
      digestToggle.checked = AppState.automationConfig.enabled !== false;
    }

    // 4. Update notification badge dot
    this.updateNotificationBadge();

    // 5. Pre-fill Direct AppScript URL in Settings
    const inputSettings = document.getElementById('directAppScriptUrlInputSettings');
    if (inputSettings) {
      inputSettings.value = localStorage.getItem('daihatsu_direct_appscript_url') || '';
    }
  },

  /**
   * Memperbarui badge dot merah pada lonceng notifikasi email (Header & Settings)
   */
  updateNotificationBadge() {
    const badges = [
      document.getElementById('notifBadgeDot'),
      document.getElementById('headerNotifBadgeDot')
    ].filter(Boolean);

    if (badges.length === 0) return;

    let logs = [];
    try {
      const stored = localStorage.getItem('daihatsu_email_notifications');
      if (stored) logs = JSON.parse(stored);
    } catch (e) {}

    const hasUnread = logs.some(l => l.read === false);
    badges.forEach(badge => {
      if (hasUnread) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    });
  },

  /**
   * Buka Modal Notifikasi Pengiriman Laporan Email Realtime
   */
  /**
   * Buka Modal Notifikasi Pengiriman Laporan Email Realtime & Riwayat Database
   */
  openNotificationModal() {
    const modal = document.getElementById('emailNotificationModal');
    if (!modal) return;

    modal.classList.remove('hidden');

    // Tampilkan email target penerima aktif dalam bentuk chip & badge
    this.updateNotificationTargetEmailDisplay();

    // Isi input direct url jika ada di localStorage
    const inputModal = document.getElementById('directAppScriptUrlInputModal');
    if (inputModal) {
      inputModal.value = localStorage.getItem('daihatsu_direct_appscript_url') || '';
    }

    // Render riwayat mutasi dari database & email logs
    this.renderEmailNotifications();

    // Periksa status koneksi server secara otomatis saat modal dibuka
    this.checkEmailConnectionNow();

    // Tandai semua notifikasi telah dibaca
    try {
      let logs = [];
      const stored = localStorage.getItem('daihatsu_email_notifications');
      if (stored) logs = JSON.parse(stored);
      logs.forEach(l => { l.read = true; });
      localStorage.setItem('daihatsu_email_notifications', JSON.stringify(logs));
    } catch (e) {}

    this.updateNotificationBadge();
  },

  /**
   * Perbarui tampilan target email penerima di modal notifikasi & laporan secara reaktif
   */
  updateNotificationTargetEmailDisplay() {
    const auto = AppState.automationConfig || {};
    let emailList = [];
    if (Array.isArray(auto.emails) && auto.emails.length > 0) {
      emailList = auto.emails;
    } else if (auto.email) {
      emailList = String(auto.email).split(/[,;\n\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    }
    if (emailList.length === 0) emailList = ['admin.logistics@daihatsu.co.id'];

    // Update Badge Jumlah Email
    const badgeEl = document.getElementById('notifModalEmailCountBadge');
    if (badgeEl) {
      badgeEl.textContent = `${emailList.length} Email Terdaftar`;
    }

    // Update Chips Kontainer (Setiap email ditampilkan utuh sebagai chip tanpa terpotong)
    const chipsContainer = document.getElementById('notifModalEmailChips');
    if (chipsContainer) {
      chipsContainer.innerHTML = emailList.map(email => `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/95 border border-blue-200/80 text-[10.5px] font-mono font-bold text-slate-800 shadow-2xs">
          <span class="text-blue-500">@</span>
          <span>${email}</span>
        </span>
      `).join('');
    }

    // Backward compatibility untuk elemen teks single
    const targetEmailEl = document.getElementById('notifModalTargetEmail');
    if (targetEmailEl) {
      targetEmailEl.textContent = emailList.join(', ');
    }
  },

  /**
   * Tutup Modal Notifikasi
   */
  closeNotificationModal() {
    const modal = document.getElementById('emailNotificationModal');
    if (modal) modal.classList.add('hidden');
  },

  emailNotifFilter: 'ALL',

  /**
   * Toggle box konfigurasi direct URL di modal notifikasi
   */
  toggleDirectConnectionBox() {
    const box = document.getElementById('directConnectionModalBox');
    if (!box) return;
    box.classList.toggle('hidden');
    const input = document.getElementById('directAppScriptUrlInputModal');
    if (input && !box.classList.contains('hidden')) {
      input.value = localStorage.getItem('daihatsu_direct_appscript_url') || '';
      input.focus();
    }
  },

  /**
   * Simpan URL Web App langsung dari modal notifikasi
   */
  async saveDirectUrlFromModal() {
    const input = document.getElementById('directAppScriptUrlInputModal');
    const url = input ? input.value.trim() : '';
    if (!url) {
      this.showToast('⚠️ Masukkan URL Web App Google Apps Script.');
      return;
    }
    if (!url.startsWith('http')) {
      this.showToast('⚠️ Format URL harus diawali https://...');
      return;
    }

    this.showToast('⏳ Menguji & menghubungkan ke Google Spreadsheet...');
    const ok = ApiService.saveDirectAppScriptUrl(url);
    if (!ok) {
      this.showToast('⛔ Gagal menyimpan URL ke memori browser.');
      return;
    }

    // Uji koneksi segera & sinkronkan database
    await this.checkEmailConnectionNow();
    await this.checkCloudHealth();
  },

  /**
   * Simpan URL Web App langsung dari tab Pengaturan
   */
  async saveDirectUrlFromSettings() {
    const input = document.getElementById('directAppScriptUrlInputSettings');
    const url = input ? input.value.trim() : '';
    if (!url) {
      this.showToast('⚠️ Masukkan URL Web App Google Apps Script.');
      return;
    }
    if (!url.startsWith('http')) {
      this.showToast('⚠️ Format URL harus diawali https://...');
      return;
    }

    this.showToast('⏳ Menguji koneksi & menyimpan URL...');
    const ok = ApiService.saveDirectAppScriptUrl(url);
    if (!ok) {
      this.showToast('⛔ Gagal menyimpan konfigurasi.');
      return;
    }

    await this.checkCloudHealth();
    await this.checkEmailConnectionNow();
  },

  /**
   * Reset ke Vercel Serverless Reverse Proxy (/api/proxy)
   */
  async resetToVercelProxy() {
    ApiService.clearDirectAppScriptUrl();
    const inputModal = document.getElementById('directAppScriptUrlInputModal');
    if (inputModal) inputModal.value = '';
    const inputSettings = document.getElementById('directAppScriptUrlInputSettings');
    if (inputSettings) inputSettings.value = '';

    this.showToast('ℹ️ Beralih ke Vercel Serverless Reverse Proxy (/api/proxy).');
    await this.checkEmailConnectionNow();
    await this.checkCloudHealth();
  },

  /**
   * Filter riwayat notifikasi email (Semua, Unit Masuk, Unit Keluar, Laporan Harian)
   */
  setEmailNotifFilter(filter) {
    this.emailNotifFilter = filter || 'ALL';

    const buttons = [
      { id: 'notifFilterAll', key: 'ALL' },
      { id: 'notifFilterMasuk', key: 'MASUK' },
      { id: 'notifFilterKeluar', key: 'KELUAR' },
      { id: 'notifFilterDaily', key: 'DAILY' }
    ];

    const activeCls = 'flex-1 min-w-[70px] py-1.5 px-2 rounded-xl text-[11px] font-black text-center transition active:scale-95 cursor-pointer whitespace-nowrap bg-blue-600 text-white shadow-xs';
    const inactiveCls = 'flex-1 min-w-[72px] py-1.5 px-2 rounded-xl text-[11px] font-bold text-center transition active:scale-95 cursor-pointer whitespace-nowrap bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80';

    buttons.forEach(b => {
      const el = document.getElementById(b.id);
      if (el) {
        el.className = (this.emailNotifFilter === b.key) ? activeCls : inactiveCls;
      }
    });

    this.renderEmailNotifications();
  },

  /**
   * Catat entri riwayat pengiriman email realtime (Mutasi atau Daily Report)
   */
  recordEmailNotificationLog(log) {
    if (!log) return;
    let logs = [];
    try {
      const stored = localStorage.getItem('daihatsu_email_notifications');
      if (stored) logs = JSON.parse(stored);
    } catch (e) {}

    logs.unshift(log);
    if (logs.length > 50) logs = logs.slice(0, 50);
    try {
      localStorage.setItem('daihatsu_email_notifications', JSON.stringify(logs));
    } catch (e) {}

    this.renderEmailNotifications();
    this.updateNotificationBadge();
  },

  /**
   * Menguji koneksi live ke backend Google Apps Script & Layanan Email Gmail
   */
  async checkEmailConnectionNow() {
    const btn = document.getElementById('btnCheckEmailConn');
    const dot = document.getElementById('emailLiveStatusDot');
    const text = document.getElementById('emailLiveStatusText');
    const modeBadge = document.getElementById('emailLiveStatusMode');
    const refreshIcon = document.getElementById('iconRefreshConn');

    if (btn) btn.disabled = true;
    if (refreshIcon) refreshIcon.classList.add('animate-spin');
    if (text) text.textContent = 'Memeriksa status koneksi server...';
    if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping flex-shrink-0';

    try {
      const conn = await ApiService.checkEmailConnection();
      const isOk = conn && conn.success;
      const targetEmail = conn?.targetEmail || AppState.automationConfig?.email || 'admin.logistics@daihatsu.co.id';
      const modeText = conn?.mode === 'direct' ? 'DIRECT WEB APP' : (conn?.mode === 'proxy' ? 'VERCEL PROXY' : 'OFFLINE');

      if (modeBadge) modeBadge.textContent = modeText;

      if (isOk) {
        if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0';
        if (text) text.textContent = `Terhubung: ${conn.host || 'Google Apps Script & Gmail'} ✓`;
        this.showToast(`✅ Server Terhubung! Mode: ${modeText} • Target: ${targetEmail}`, 4000);

        // Jika terhubung, sembunyikan kotak konfigurasi manual
        const directBox = document.getElementById('directConnectionModalBox');
        if (directBox && !directBox.classList.contains('hidden')) {
          directBox.classList.add('hidden');
        }

        // Sinkronisasi data mutasi terbaru dari Google Spreadsheet
        await ApiService.fetchInitialData();
        this.renderEmailNotifications();
      } else {
        if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 flex-shrink-0';
        if (text) text.textContent = 'Belum Terhubung ke Database Cloud';
        if (modeBadge) modeBadge.textContent = 'OFFLINE';

        // Tampilkan kotak konfigurasi URL langsung agar user tahu cara menghubungkannya
        const directBox = document.getElementById('directConnectionModalBox');
        if (directBox) directBox.classList.remove('hidden');

        const tipMsg = conn?.details?.tip || conn?.error || 'Pastikan variabel APPSCRIPT_URL di Vercel aktif atau tempel URL Web App langsung.';
        this.showToast(`⚠️ Server belum terhubung: ${tipMsg}`, 6500);
      }
    } catch (err) {
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 flex-shrink-0';
      if (text) text.textContent = 'Koneksi: KESALAHAN JARINGAN';
      if (modeBadge) modeBadge.textContent = 'OFFLINE';
      this.showToast(`⛔ Gagal memeriksa koneksi: ${err.message}`, 5000);
    } finally {
      if (btn) btn.disabled = false;
      if (refreshIcon) refreshIcon.classList.remove('animate-spin');
    }
  },

  /**
   * Render daftar notifikasi laporan email yang rapi, modern, dan sinkron 100% dengan database HistoryMutasi
   */
  renderEmailNotifications() {
    const container = document.getElementById('emailNotifListContainer');
    if (!container) return;

    let localLogs = [];
    try {
      const stored = localStorage.getItem('daihatsu_email_notifications');
      if (stored) localLogs = JSON.parse(stored);
    } catch (e) {}

    const targetEmail = AppState.automationConfig?.email || 'admin.logistics@daihatsu.co.id';
    const dbHistory = Array.isArray(AppState.historyData) ? AppState.historyData : [];

    // Buat synthesized log dari riwayat mutasi nyata di database Google Sheets (tab HistoryMutasi)
    const dbLogs = dbHistory.map((item, idx) => {
      const isMasuk = (item.status === 'Unit Masuk' || item.type === 'Unit Masuk' || String(item.status || '').toLowerCase().includes('masuk'));
      const mutationType = isMasuk ? 'Unit Masuk' : 'Unit Keluar';
      const cleanTime = String(item.time || '').replace(/\s*WIB\s*/gi, '').trim();
      const timeStr = cleanTime ? `${cleanTime} WIB` : '';
      const formattedDate = item.fullDateStr || (item.date ? `${item.date}/${item.month || ''}/${item.year || ''}` : '');
      const timeDisplay = [formattedDate, timeStr].filter(Boolean).join(' • ') || 'Tercatat di Database';

      return {
        id: item.id || `db-${item.vin || idx}-${item.date || idx}`,
        trxId: item.id || `TRX-${idx}`,
        timestamp: timeDisplay,
        targetEmail: item.targetEmail || targetEmail,
        status: 'SUCCESS',
        category: 'MUTATION',
        mutationType: mutationType,
        model: item.model || item.name || 'Daihatsu',
        vin: item.vin || '-',
        engine: item.engine || '-',
        operator: item.operator || item.pic || 'Petugas Stockyard',
        location: item.location || item.destination || '-',
        notes: item.notes || item.keterangan || '-',
        read: true,
        fromDatabase: true
      };
    });

    // Gabungkan data database dengan log pengiriman lokal
    const combinedMap = new Map();

    // 1. Masukkan mutasi dari database terlebih dahulu (database sebagai single source of truth)
    dbLogs.forEach((l, idx) => {
      const key = (l.id && l.id !== 'MUT-TRX') ? l.id : `${l.vin}_${l.mutationType}_${l.timestamp}_${idx}`;
      combinedMap.set(key, l);
    });

    // 2. Tambahkan/timpa dari log pengiriman lokal
    localLogs.forEach(l => {
      if (l.category === 'MUTATION' && l.vin) {
        // Cari entri yang cocok berdasarkan VIN dan jenis mutasi
        let matchedKey = null;
        for (const [k, v] of combinedMap.entries()) {
          if (v.vin === l.vin && v.mutationType === l.mutationType) {
            matchedKey = k;
            break;
          }
        }

        if (matchedKey) {
          const existing = combinedMap.get(matchedKey);
          combinedMap.set(matchedKey, {
            ...existing,
            ...l,
            engine: l.engine || existing?.engine || '-',
            operator: l.operator || existing?.operator || 'Petugas Stockyard',
            fromDatabase: true
          });
        } else {
          combinedMap.set(l.id || `local-${Math.random()}`, l);
        }
      } else {
        combinedMap.set(l.id || `local-${Math.random()}`, l);
      }
    });

    const allCombined = Array.from(combinedMap.values());

    // Update Counter Badges di Tab Filter
    const countAllEl = document.getElementById('notifCountAll');
    const countMasukEl = document.getElementById('notifCountMasuk');
    const countKeluarEl = document.getElementById('notifCountKeluar');
    const countDailyEl = document.getElementById('notifCountDaily');

    const totalMasuk = allCombined.filter(l => l.mutationType === 'Unit Masuk').length;
    const totalKeluar = allCombined.filter(l => l.mutationType === 'Unit Keluar').length;
    const totalDaily = allCombined.filter(l => l.category === 'DAILY_REPORT' || !l.category).length;

    if (countAllEl) countAllEl.textContent = allCombined.length;
    if (countMasukEl) countMasukEl.textContent = totalMasuk;
    if (countKeluarEl) countKeluarEl.textContent = totalKeluar;
    if (countDailyEl) countDailyEl.textContent = totalDaily;

    // Filter daftar sesuai tab aktif
    const filter = this.emailNotifFilter || 'ALL';
    let filteredLogs = allCombined;
    if (filter === 'MASUK') {
      filteredLogs = allCombined.filter(l => l.mutationType === 'Unit Masuk');
    } else if (filter === 'KELUAR') {
      filteredLogs = allCombined.filter(l => l.mutationType === 'Unit Keluar');
    } else if (filter === 'MUTATION') {
      filteredLogs = allCombined.filter(l => l.category === 'MUTATION');
    } else if (filter === 'DAILY') {
      filteredLogs = allCombined.filter(l => l.category === 'DAILY_REPORT' || !l.category);
    }

    if (!filteredLogs || filteredLogs.length === 0) {
      let emptyMsg = `Target email aktif saat ini adalah <strong class="text-slate-800 font-mono">${targetEmail}</strong>. Setiap ada unit masuk atau keluar, mutasi database dan pengiriman email akan otomatis tercatat di sini secara realtime.`;
      if (filter === 'MUTATION') emptyMsg = 'Belum ada data mutasi unit masuk atau keluar di database HistoryMutasi.';
      else if (filter === 'DAILY') emptyMsg = 'Belum ada laporan harian yang dikirimkan. Tekan tombol "Kirim Laporan" di atas untuk memicu laporan.';

      container.innerHTML = `
        <div class="p-8 text-center text-slate-400 space-y-3 bg-slate-50/60 rounded-2xl border border-slate-200/60">
          <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 mx-auto flex items-center justify-center shadow-2xs">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </div>
          <div>
            <h4 class="text-xs font-black text-slate-800">Belum Ada Riwayat ${filter === 'MUTATION' ? 'Mutasi Database' : (filter === 'DAILY' ? 'Laporan Harian' : 'Notifikasi')}</h4>
            <p class="text-[11px] text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
              ${emptyMsg}
            </p>
          </div>
        </div>
      `;
      return;
    }

    // Desain Card Notifikasi: Rapi, Modern, Tidak Membosankan, Mobile-Friendly
    container.innerHTML = filteredLogs.map(item => {
      const isSuccess = item.status === 'SUCCESS';
      const isOffline = item.status === 'PENDING_OFFLINE';
      const isMasuk = item.mutationType === 'Unit Masuk';
      const isKeluar = item.mutationType === 'Unit Keluar';
      const isDaily = item.category === 'DAILY_REPORT' || (!isMasuk && !isKeluar);

      // Aksen card tepi kiri
      let leftAccent = 'border-l-4 border-l-slate-300';
      let typeBadge = '';

      if (isDaily) {
        leftAccent = 'border-l-4 border-l-indigo-500 bg-white';
        typeBadge = `
          <span class="inline-flex items-center gap-1 text-[9.5px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/80 uppercase">
            <span>📄</span>
            <span>Laporan Rekap Harian</span>
          </span>
        `;
      } else if (isMasuk) {
        leftAccent = 'border-l-4 border-l-emerald-500 bg-white';
        typeBadge = `
          <span class="inline-flex items-center gap-1 text-[9.5px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 uppercase">
            <svg class="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
            <span>Unit Masuk</span>
          </span>
        `;
      } else if (isKeluar) {
        leftAccent = 'border-l-4 border-l-blue-500 bg-white';
        typeBadge = `
          <span class="inline-flex items-center gap-1 text-[9.5px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/80 uppercase">
            <svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
            <span>Unit Keluar</span>
          </span>
        `;
      }

      // Status Pengiriman / Database Badge
      let statusBadge = '';
      if (item.fromDatabase) {
        statusBadge = `<span class="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50/90 px-1.5 py-0.5 rounded border border-emerald-200">Spreadsheet Sync ✓</span>`;
      } else if (isSuccess) {
        statusBadge = `<span class="inline-flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-50/90 px-1.5 py-0.5 rounded border border-blue-200">Email Terkirim ✓</span>`;
      } else if (isOffline) {
        statusBadge = `<span class="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Pending Sync ⏳</span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center gap-1 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Gagal ⚠️</span>`;
      }

      // Unit info line
      let unitDetailsHtml = '';
      if (isDaily) {
        unitDetailsHtml = `
          <div class="text-[11.5px] text-slate-700 leading-snug">
            <span class="font-extrabold text-slate-900 block">Rekapitulasi Mutasi Stockyard DSO Lampung</span>
            <span class="text-[10.5px] text-slate-500">${item.message || 'Laporan ringkasan mutasi dan pergerakan stok unit kendaraan.'}</span>
          </div>
        `;
      } else {
        unitDetailsHtml = `
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-black text-slate-900 text-[12.5px] tracking-tight">${item.model || 'Unit Kendaraan'}</span>
              ${item.operator ? `<span class="text-[10px] text-slate-500 font-medium">Petugas: <strong class="text-slate-800">${item.operator}</strong></span>` : ''}
            </div>
            <div class="flex flex-wrap items-center gap-1.5 text-[10.5px] font-mono">
              <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/60 font-bold">
                <span class="text-slate-400 font-sans text-[9.5px]">VIN: </span><span class="text-blue-700">${item.vin || '-'}</span>
              </span>
              ${item.engine && item.engine !== '-' ? `
                <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60 font-semibold">
                  <span class="text-slate-400 font-sans text-[9.5px]">Mesin: </span>${item.engine}
                </span>
              ` : ''}
              ${item.location && item.location !== '-' ? `
                <span class="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200/50">
                  <span class="text-slate-400 font-sans text-[9.5px]">Lokasi: </span>${item.location}
                </span>
              ` : ''}
            </div>
          </div>
        `;
      }

      // Render Daftar Target Email Penerima (Multi-Email Tags Responsive)
      const rawTarget = item.targetEmail || targetEmail;
      const recipientList = String(rawTarget)
        .split(/[,;\n\s]+/)
        .map(e => e.trim())
        .filter(e => e.includes('@'));

      let recipientsHtml = '';
      if (recipientList.length <= 1) {
        const singleEmail = recipientList[0] || 'admin.logistics@daihatsu.co.id';
        recipientsHtml = `
          <div class="pt-1.5 flex items-center justify-between text-[10px] border-t border-slate-100 font-medium">
            <span class="flex items-center gap-1.5 min-w-0 text-slate-500">
              <svg class="w-3 h-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              <span class="text-slate-400 text-[9.5px]">Tujuan:</span>
              <strong class="font-mono text-slate-700 truncate">${singleEmail}</strong>
            </span>
          </div>
        `;
      } else {
        recipientsHtml = `
          <div class="pt-1.5 space-y-1 border-t border-slate-100">
            <div class="flex items-center justify-between text-[10px] text-slate-500">
              <span class="flex items-center gap-1.5 font-medium">
                <svg class="w-3 h-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <span class="text-slate-400 text-[9.5px]">Tujuan (${recipientList.length} Penerima Terdaftar):</span>
              </span>
            </div>
            <div class="flex flex-wrap gap-1">
              ${recipientList.map(em => `
                <span class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[9.5px] font-bold border border-slate-200/80">
                  <span class="text-blue-500">@</span>
                  <span class="truncate max-w-[200px]">${em}</span>
                </span>
              `).join('')}
            </div>
          </div>
        `;
      }

      return `
        <div class="p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs ${leftAccent} transition hover:border-slate-300 space-y-2">
          <!-- Top Row: Type, Status, Timestamp (Responsive No Overlap) -->
          <div class="flex items-start justify-between gap-1.5">
            <div class="flex flex-wrap items-center gap-1 min-w-0">
              ${typeBadge}
              ${statusBadge}
            </div>
            <span class="text-[9.5px] font-bold text-slate-400 whitespace-nowrap flex-shrink-0 text-right pt-0.5">${item.timestamp}</span>
          </div>

          <!-- Body: Unit Information -->
          ${unitDetailsHtml}

          <!-- Footer: Email Destination -->
          ${recipientsHtml}
        </div>
      `;
    }).join('');
  },

  /**
   * Picu Pengiriman Laporan Email Nyata Sekarang & Catat ke Log Notifikasi
   */
  async triggerRealEmailReportNow() {
    const btn = document.getElementById('btnTestSendEmail');
    const textEl = document.getElementById('btnTestSendEmailText');
    const targetEmail = AppState.automationConfig?.email || 'admin.logistics@daihatsu.co.id';

    if (btn) btn.disabled = true;
    if (textEl) textEl.textContent = 'Mengirim...';

    this.showToast(`⏳ Mengirimkan laporan email ke ${targetEmail}...`);

    try {
      const res = await ApiService.triggerEmailReport();
      const isSuccess = res && (res.success === true || !res.error);

      const timestampStr = new Date().toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' WIB';

      const newLog = {
        id: 'email-' + Date.now(),
        timestamp: timestampStr,
        targetEmail: targetEmail,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        category: 'DAILY_REPORT',
        subject: 'Rekap Laporan Mutasi Stockyard • Astra Daihatsu - DSO Lampung',
        message: isSuccess
          ? `Laporan rekapitulasi mutasi kendaraan berhasil diproses dan dikirimkan secara langsung ke alamat ${targetEmail}.`
          : `Gagal mengirimkan laporan email ke ${targetEmail}: ${res?.error || res?.message || 'Koneksi terputus'}`,
        read: true
      };

      this.recordEmailNotificationLog(newLog);

      if (isSuccess) {
        this.showToast(`🎉 Sukses! Laporan telah terkirim ke ${targetEmail}!`, 4500);
      } else {
        this.showToast(`⛔ Pengiriman email gagal: ${res?.error || res?.message || 'Server sibuk'}`, 5000);
      }
    } catch (err) {
      console.error('[UI] Gagal memicu pengiriman email:', err);
      this.showToast(`⛔ Kesalahan jaringan saat mengirim email: ${err.message}`, 4500);
    } finally {
      if (btn) btn.disabled = false;
      if (textEl) textEl.textContent = 'Kirim Laporan';
    }
  },

  /**
   * Bersihkan riwayat log notifikasi email
   */
  clearEmailNotificationLogs() {
    try {
      localStorage.removeItem('daihatsu_email_notifications');
    } catch (e) {}

    this.renderEmailNotifications();
    this.updateNotificationBadge();
    this.showToast('🧹 Riwayat notifikasi email telah dibersihkan.');
  },

  /**
   * Mobile Pull-to-Refresh Controller
   * Mengaktifkan gestur scroll/tarik ke bawah dari posisi paling atas untuk me-reload aplikasi secara native
   */
  initPullToRefresh() {
    const viewport = document.getElementById('appMainViewport');
    const indicator = document.getElementById('pullToRefreshIndicator');
    const arrow = document.getElementById('pullToRefreshArrow');
    const spinner = document.getElementById('pullToRefreshSpinner');
    const label = document.getElementById('pullToRefreshText');

    if (!viewport || !indicator) return;

    let startY = 0;
    let startX = 0;
    let currentY = 0;
    let isTracking = false;
    let isPulling = false;
    let isRefreshing = false;
    let pullArmed = false;
    let hasVibrated = false;

    const PULL_THRESHOLD = 60; // Ambang jarak tarik (px) untuk trigger reload
    const MAX_PULL = 95;      // Jarak visual maksimum indikator

    const isAnyModalOpen = () => {
      const openModal = document.querySelector('#scannerModalOverlay:not(.hidden), #logoutModal:not(.hidden), #customSelectModal:not(.hidden), #imagePreviewModal:not(.hidden)');
      return !!openModal;
    };

    const resetIndicator = () => {
      indicator.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
      indicator.style.transform = 'translateY(-80px)';
      indicator.style.opacity = '0';
      setTimeout(() => {
        if (arrow) {
          arrow.classList.remove('hidden');
          arrow.style.transform = 'rotate(0deg)';
          arrow.classList.remove('text-emerald-600');
          arrow.classList.add('text-blue-600');
        }
        if (spinner) spinner.classList.add('hidden');
        if (label) label.textContent = 'Tarik ke bawah untuk reload';
      }, 250);
    };

    const triggerReload = () => {
      isRefreshing = true;
      indicator.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
      indicator.style.transform = 'translateY(55px)';

      if (arrow) arrow.classList.add('hidden');
      if (spinner) spinner.classList.remove('hidden');
      if (label) label.textContent = 'Memuat ulang...';

      // Berikan animasi spinner yang halus selama 300ms agar user mendapat konfirmasi visual
      setTimeout(() => {
        window.location.reload();
      }, 300);
    };

    const handleStart = (clientY, clientX) => {
      if (isRefreshing || isAnyModalOpen()) return;
      if (viewport.scrollTop <= 2) {
        startY = clientY;
        startX = clientX;
        currentY = clientY;
        isTracking = true;
        isPulling = false;
        pullArmed = false;
        hasVibrated = false;
      }
    };

    const handleMove = (clientY, clientX, e) => {
      if (!isTracking || isRefreshing) return;

      if (viewport.scrollTop > 2) {
        if (isPulling) {
          isPulling = false;
          resetIndicator();
        }
        isTracking = false;
        return;
      }

      currentY = clientY;
      const dy = currentY - startY;
      const dx = clientX - startX;

      // Jika geseran horizontal lebih dominan (e.g. geser carousel/tabel), abaikan pull to refresh
      if (Math.abs(dx) > dy && dy > 0) {
        isTracking = false;
        isPulling = false;
        return;
      }

      if (dy > 6) {
        isPulling = true;
        const pullDistance = Math.min(Math.pow(dy, 0.85) * 1.5, MAX_PULL);
        const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);

        indicator.style.transition = 'none';
        indicator.style.transform = `translateY(${pullDistance}px)`;
        indicator.style.opacity = String(Math.min(progress * 1.3, 1));

        if (arrow) {
          arrow.style.transform = `rotate(${progress * 180}deg)`;
        }

        if (pullDistance >= PULL_THRESHOLD) {
          pullArmed = true;
          if (!hasVibrated) {
            if (navigator.vibrate) navigator.vibrate(15);
            hasVibrated = true;
          }
          if (label) label.textContent = 'Lepaskan untuk memuat ulang';
          if (arrow) {
            arrow.classList.add('text-emerald-600');
            arrow.classList.remove('text-blue-600');
          }
        } else {
          pullArmed = false;
          hasVibrated = false;
          if (label) label.textContent = 'Tarik ke bawah untuk reload';
          if (arrow) {
            arrow.classList.remove('text-emerald-600');
            arrow.classList.add('text-blue-600');
          }
        }

        if (e && e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleEnd = () => {
      if (!isTracking || isRefreshing) return;
      isTracking = false;

      if (isPulling) {
        isPulling = false;
        if (pullArmed) {
          triggerReload();
        } else {
          resetIndicator();
        }
      }
    };

    // Touch events listener (untuk smartphone & tablet)
    viewport.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) {
        handleStart(e.touches[0].clientY, e.touches[0].clientX);
      }
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length === 1) {
        handleMove(e.touches[0].clientY, e.touches[0].clientX, e);
      }
    }, { passive: false });

    viewport.addEventListener('touchend', handleEnd, { passive: true });
    viewport.addEventListener('touchcancel', handleEnd, { passive: true });

    // Desktop/DevTools mouse drag support
    let isMouseDown = false;
    viewport.addEventListener('mousedown', (e) => {
      if (e.button === 0 && viewport.scrollTop <= 2) {
        isMouseDown = true;
        handleStart(e.clientY, e.clientX);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isMouseDown) {
        handleMove(e.clientY, e.clientX, e);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isMouseDown) {
        isMouseDown = false;
        handleEnd();
      }
    });
  },

  /**
   * ============================================================================
   * MODUL DETAIL MODEL KENDARAAN (REKAPAN MUTASI & AUDIT PER MODEL)
   * ============================================================================
   */

  /**
   * Buka Halaman Khusus Detail & Rekapan Mutasi Per Model Mobil
   */
  openModelDetail(identifier) {
    let catalogItem = null;
    const catalog = AppState.vehicleCatalog || [];
    if (identifier) {
      catalogItem = catalog.find(c => c.catalogId === identifier || c.model.toLowerCase() === String(identifier).toLowerCase());
      if (!catalogItem && AppState.getModelCatalogItem) {
        catalogItem = AppState.getModelCatalogItem(identifier);
      }
    }
    if (!catalogItem) catalogItem = catalog[0];
    if (!catalogItem) return;

    AppState.selectedModelCatalogId = catalogItem.catalogId;
    AppState.modelDetailTypeFilter = 'all';

    // Buka tampilan viewModelDetail dan sembunyikan tampilan lainnya
    ['viewDashboard', 'viewInventory', 'viewHistory', 'viewSettings'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    const detailView = document.getElementById('viewModelDetail');
    if (detailView) detailView.classList.remove('hidden');

    // Tetap aktifkan highlight menu Inventaris di navigasi bawah & atas
    const navInv = document.getElementById('nav-inventory');
    const deskNavInv = document.getElementById('desk-nav-inventory');
    document.querySelectorAll('.nav-btn, .desk-nav-btn').forEach(btn => btn.classList.remove('active'));
    if (navInv) navInv.classList.add('active');
    if (deskNavInv) deskNavInv.classList.add('active');

    // Isi data judul, kategori, dan foto model
    const titleEl = document.getElementById('modelDetailTitle');
    const catIdEl = document.getElementById('modelDetailCatalogId');
    const categoryEl = document.getElementById('modelDetailCategory');
    const photoEl = document.getElementById('modelDetailPhoto');
    const tableTitleName = document.getElementById('modelTableTitleName');

    if (titleEl) titleEl.textContent = catalogItem.model;
    if (catIdEl) catIdEl.textContent = catalogItem.catalogId;
    if (categoryEl) categoryEl.textContent = `${catalogItem.category} • Laporan Rincian Mutasi & Stok Fisik`;
    if (photoEl) {
      photoEl.src = catalogItem.photo;
      photoEl.alt = catalogItem.model;
    }
    if (tableTitleName) tableTitleName.textContent = catalogItem.model;

    // Pastikan dropdown tanggal 1-31 terisi
    const fDate = document.getElementById('modelFilterDate');
    if (fDate && fDate.options.length <= 1) {
      fDate.innerHTML = '<option value="all">Semua Tgl</option>';
      for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        fDate.appendChild(opt);
      }
    }

    // Reset dropdown tanggal, bulan, tahun & kolom pencarian
    const fMonth = document.getElementById('modelFilterMonth');
    const fYear = document.getElementById('modelFilterYear');
    const sInput = document.getElementById('modelDetailSearchInput');
    const sClearBtn = document.getElementById('modelDetailSearchClearBtn');

    if (fDate) fDate.value = 'all';
    if (fMonth) fMonth.value = 'all';
    if (fYear) fYear.value = 'all';
    if (sInput) sInput.value = '';
    if (sClearBtn) sClearBtn.classList.add('hidden');

    // Inisialisasi atau refresh custom popover dropdown untuk filter tanggal, bulan, tahun
    this.initCustomDropdowns();

    // Reset tab filter mutasi ke 'all'
    this.updateModelTypeTabButtons('all');

    // Scroll ke bagian paling atas halaman
    const appViewport = document.getElementById('appMainViewport');
    if (appViewport) appViewport.scrollTop = 0;
    else window.scrollTo({ top: 0, behavior: 'smooth' });

    // Render tabel mutasi model
    this.renderModelDetailTable();
  },

  /**
   * Tutup Halaman Detail Model dan Kembali ke Halaman Inventaris
   */
  closeModelDetail() {
    this.switchTab('inventory');
    const appViewport = document.getElementById('appMainViewport');
    if (appViewport) appViewport.scrollTop = 0;
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /**
   * Update styling tombol filter jenis mutasi pada halaman detail model
   */
  updateModelTypeTabButtons(activeType) {
    const tabs = ['all', 'in', 'out'];
    tabs.forEach(t => {
      const btn = document.getElementById(`modelTypeTab-${t}`);
      const countBadge = document.getElementById(`modelTypeCount-${t}`);
      if (btn) {
        if (t === activeType) {
          btn.className = 'py-2 rounded-xl bg-white text-slate-900 shadow-xs transition cursor-pointer flex items-center justify-center space-x-1';
          if (countBadge) countBadge.className = 'text-[10px] px-1.5 py-0.2 rounded-md bg-slate-900 text-white font-extrabold';
        } else {
          btn.className = 'py-2 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer flex items-center justify-center space-x-1';
          if (countBadge) countBadge.className = 'text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200/80 text-slate-600 font-bold';
        }
      }
    });
  },

  /**
   * Filter jenis mutasi (Semua / Masuk / Keluar) pada halaman detail model
   */
  filterModelMutasiType(type) {
    AppState.modelDetailTypeFilter = type;
    this.updateModelTypeTabButtons(type);
    this.renderModelDetailTable();
  },

  /**
   * Filter tanggal/bulan/tahun pada halaman detail model
   */
  applyModelDateFilter() {
    const sInput = document.getElementById('modelDetailSearchInput');
    const sClearBtn = document.getElementById('modelDetailSearchClearBtn');
    if (sClearBtn) {
      if (sInput && sInput.value.trim().length > 0) sClearBtn.classList.remove('hidden');
      else sClearBtn.classList.add('hidden');
    }
    this.renderModelDetailTable();
  },

  /**
   * Reset filter waktu pada halaman detail model
   */
  resetModelDateFilter() {
    const fDate = document.getElementById('modelFilterDate');
    const fMonth = document.getElementById('modelFilterMonth');
    const fYear = document.getElementById('modelFilterYear');
    const fBa = document.getElementById('modelFilterBa');
    if (fDate) fDate.value = 'all';
    if (fMonth) fMonth.value = 'all';
    if (fYear) fYear.value = 'all';
    if (fBa) fBa.value = 'all';
    this.renderModelDetailTable();
  },

  /**
   * Bersihkan input pencarian pada halaman detail model
   */
  clearModelDetailSearch() {
    const sInput = document.getElementById('modelDetailSearchInput');
    const sClearBtn = document.getElementById('modelDetailSearchClearBtn');
    if (sInput) sInput.value = '';
    if (sClearBtn) sClearBtn.classList.add('hidden');
    this.renderModelDetailTable();
  },

  /**
   * Render tabel riwayat mutasi untuk model yang sedang dibuka
   */
  renderModelDetailTable() {
    const container = document.getElementById('modelDetailListContainer');
    if (!container) return;

    const catalog = AppState.vehicleCatalog || [];
    const catalogItem = catalog.find(c => c.catalogId === AppState.selectedModelCatalogId) || catalog[0];
    if (!catalogItem) return;

    // Ambil data mutasi yang cocok dari riwayat audit AppState.historyData
    let modelHistory = (AppState.historyData || []).filter(h => {
      if (!h || !h.model) return false;
      const hModel = String(h.model).toLowerCase();
      if (hModel === catalogItem.model.toLowerCase()) return true;
      const m = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(hModel) : null;
      return m && m.catalogId === catalogItem.catalogId;
    });

    // Hitung KPI model dari akumulasi mutasi murni database
    const totalMasukAll = modelHistory.filter(i => i.type === 'Unit Masuk').length;
    const totalKeluarAll = modelHistory.filter(i => i.type === 'Unit Keluar').length;
    const totalStokCurrent = Math.max(0, totalMasukAll - totalKeluarAll);

    const kpiTotalEl = document.getElementById('modelKpiTotal');
    const kpiMasukEl = document.getElementById('modelKpiMasuk');
    const kpiKeluarEl = document.getElementById('modelKpiKeluar');
    const kpiStatusEl = document.getElementById('modelKpiStatus');
    const kpiStatusCard = document.getElementById('modelKpiStatusCard');

    if (kpiTotalEl) kpiTotalEl.textContent = totalStokCurrent;
    if (kpiMasukEl) kpiMasukEl.textContent = totalMasukAll;
    if (kpiKeluarEl) kpiKeluarEl.textContent = totalKeluarAll;

    if (kpiStatusEl) {
      if (totalStokCurrent > 0) {
        kpiStatusEl.textContent = 'Tersedia';
        kpiStatusEl.className = 'text-xs sm:text-sm font-black text-emerald-700 mt-0.5 block leading-tight';
        if (kpiStatusCard) kpiStatusCard.className = 'bg-emerald-50/70 border border-emerald-200/70 rounded-xl px-2.5 sm:px-3 py-1.5 text-center sm:text-left';
      } else {
        kpiStatusEl.textContent = 'Stok Kosong';
        kpiStatusEl.className = 'text-xs sm:text-sm font-black text-rose-700 mt-0.5 block leading-tight';
        if (kpiStatusCard) kpiStatusCard.className = 'bg-rose-50/70 border border-rose-200/70 rounded-xl px-2.5 sm:px-3 py-1.5 text-center sm:text-left';
      }
    }

    // Filter tanggal, bulan, tahun, kode BA & pencarian
    const fDate = document.getElementById('modelFilterDate')?.value || 'all';
    const fMonth = document.getElementById('modelFilterMonth')?.value || 'all';
    const fYear = document.getElementById('modelFilterYear')?.value || 'all';
    const fBa = document.getElementById('modelFilterBa')?.value || 'all';
    const sInput = document.getElementById('modelDetailSearchInput');
    const searchVal = (sInput?.value || '').toLowerCase().trim();

    const baseFiltered = modelHistory.filter(item => {
      const parts = this.parseItemDate(item);
      const dateMatch = (fDate === 'all') || (parts.date === String(fDate));
      const monthMatch = (fMonth === 'all') || (parts.month === String(fMonth));
      const yearMatch = (fYear === 'all') || (parts.year === String(fYear));
      const baMatch = this.isBranchMatch(item.noBa, fBa);

      if (!dateMatch || !monthMatch || !yearMatch || !baMatch) return false;

      if (!searchVal) return true;
      return (
        (item.vin && item.vin.toLowerCase().includes(searchVal)) ||
        (item.plate && item.plate.toLowerCase().includes(searchVal)) ||
        (item.engine && item.engine.toLowerCase().includes(searchVal)) ||
        (item.noBa && item.noBa.toLowerCase().includes(searchVal)) ||
        (item.pic && item.pic.toLowerCase().includes(searchVal)) ||
        (item.notes && item.notes.toLowerCase().includes(searchVal)) ||
        (item.id && item.id.toLowerCase().includes(searchVal))
      );
    });

    // Update counter tabs filter jenis mutasi
    const countAll = baseFiltered.length;
    const countIn = baseFiltered.filter(i => i.type === 'Unit Masuk').length;
    const countOut = baseFiltered.filter(i => i.type === 'Unit Keluar').length;

    const elCountAll = document.getElementById('modelTypeCount-all');
    const elCountIn = document.getElementById('modelTypeCount-in');
    const elCountOut = document.getElementById('modelTypeCount-out');
    if (elCountAll) elCountAll.textContent = countAll;
    if (elCountIn) elCountIn.textContent = countIn;
    if (elCountOut) elCountOut.textContent = countOut;

    // Filter tahap 2: jenis mutasi
    const typeFilter = AppState.modelDetailTypeFilter || 'all';
    const filtered = baseFiltered.filter(item => {
      if (typeFilter === 'in') return item.type === 'Unit Masuk';
      if (typeFilter === 'out') return item.type === 'Unit Keluar';
      return true;
    });

    // Update Showing Badge
    const showingBadge = document.getElementById('modelTableShowingBadge');
    if (showingBadge) showingBadge.textContent = `${filtered.length} Data`;

    // Update Baris Total Paling Bawah Tabel (tfoot)
    const footMasuk = filtered.filter(i => i.type === 'Unit Masuk').length;
    const footKeluar = filtered.filter(i => i.type === 'Unit Keluar').length;
    const footNet = Math.max(0, footMasuk - footKeluar);

    const elFootMasuk = document.getElementById('modelTableFootMasuk');
    const elFootKeluar = document.getElementById('modelTableFootKeluar');
    const elFootTotalStok = document.getElementById('modelTableFootTotalStok');
    const elFootRowCount = document.getElementById('modelTableFootRowCount');

    if (elFootMasuk) elFootMasuk.textContent = footMasuk;
    if (elFootKeluar) elFootKeluar.textContent = footKeluar;
    if (elFootTotalStok) elFootTotalStok.textContent = `${footNet} Unit`;
    if (elFootRowCount) elFootRowCount.textContent = `${filtered.length} Data`;

    const footerSummary = document.getElementById('modelDetailFooterSummary');
    if (footerSummary) {
      footerSummary.textContent = `Menampilkan ${filtered.length} dari ${modelHistory.length} total rekaman mutasi untuk model ${catalogItem.model}.`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="8" class="py-12 px-6 text-center">
            <div class="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            </div>
            <p class="text-xs sm:text-sm font-extrabold text-slate-700">Tidak ada rekaman mutasi untuk model ${catalogItem.model}</p>
            <p class="text-[11px] text-slate-400 mt-1">Coba sesuaikan filter periode waktu, kata kunci pencarian, atau pilih tab "Semua".</p>
            <button type="button" onclick="resetModelDateFilter(); filterModelMutasiType('all')" class="mt-3 inline-flex items-center px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition cursor-pointer">
              Reset Semua Filter
            </button>
          </td>
        </tr>
      `;
      return;
    }

    // Helper format Google Drive URL
    const formatDriveThumb = (url) => {
      if (!url || typeof url !== 'string') return '';
      url = url.trim();
      if (url === '' || url === '-') return '';
      if (url.startsWith('data:image')) return url;
      const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w600`;
      }
      return url;
    };

    container.innerHTML = filtered.map((item, idx) => {
      const isMasuk = item.type === 'Unit Masuk';
      const typeBadge = isMasuk
        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
        : 'bg-blue-50 text-blue-700 border-blue-300';
      const typeArrow = isMasuk ? '↓' : '↑';
      const catalogPhotoSrc = catalogItem.photo || 'assets/images/Inventory_Gran Max Pick Up.jpeg';

      const unitPhotoSrc = formatDriveThumb(item.unitPhoto) || catalogPhotoSrc;
      const docPhotoSrc = formatDriveThumb(item.docPhoto);

      const rowNum = String(idx + 1).padStart(2, '0');

      let timeFormatted = item.time || '08:00';
      timeFormatted = timeFormatted.replace(/\s*WIB/i, '').trim();

      let dateFormatted = '';
      if (item.date && item.month && item.year) {
        dateFormatted = `${String(item.date).padStart(2, '0')}/${String(item.month).padStart(2, '0')}/${item.year}`;
      } else if (item.timestamp) {
        const dObj = new Date(item.timestamp);
        if (!isNaN(dObj.getTime())) {
          dateFormatted = `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}`;
          const hh = String(dObj.getHours()).padStart(2, '0');
          const mm = String(dObj.getMinutes()).padStart(2, '0');
          timeFormatted = `${hh}:${mm}`;
        }
      }
      if (!dateFormatted && item.fullDateStr) {
        dateFormatted = item.fullDateStr;
      }
      if (!dateFormatted) {
        const now = new Date();
        dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      }
      const fullTimeDisplay = `${timeFormatted}, ${dateFormatted}`;

      const unitThumbnailHtml = `
        <div onclick="openImagePreviewModal('${unitPhotoSrc}')" class="group/thumb relative w-12 h-9 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 flex-shrink-0 cursor-pointer shadow-2xs hover:border-blue-500 hover:ring-2 hover:ring-blue-400/40 transition" title="Klik untuk memperbesar Foto Unit">
          <img src="${unitPhotoSrc}" alt="Foto Unit" loading="lazy" referrerpolicy="no-referrer"
               onerror="this.onerror=null; this.src='${catalogPhotoSrc}';"
               class="w-full h-full object-cover group-hover/thumb:scale-110 transition duration-200">
          <span class="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[7.5px] font-bold text-center py-0.2">Unit</span>
        </div>
      `;

      const docThumbnailHtml = (docPhotoSrc && !docPhotoSrc.includes('unsplash.com'))
        ? `<div onclick="openImagePreviewModal('${docPhotoSrc}')" class="group/thumb relative w-12 h-9 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 flex-shrink-0 cursor-pointer shadow-2xs hover:border-indigo-500 hover:ring-2 hover:ring-indigo-400/40 transition" title="Klik untuk memperbesar Foto Dokumen DO / Stiker">
             <img src="${docPhotoSrc}" alt="Foto Dokumen" loading="lazy" referrerpolicy="no-referrer"
                  onerror="this.onerror=null; this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
                  class="w-full h-full object-cover group-hover/thumb:scale-110 transition duration-200">
             <div class="doc-fallback hidden w-full h-full items-center justify-center bg-indigo-50 text-[7.5px] text-indigo-700 font-bold text-center">Stiker</div>
             <span class="absolute bottom-0 inset-x-0 bg-indigo-900/80 text-white text-[7.5px] font-bold text-center py-0.2">Stiker</span>
           </div>`
        : `<div class="w-12 h-9 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-[7.5px] text-slate-400 font-semibold text-center leading-tight">No Doc</div>`;

      return `
        <tr class="hover:bg-blue-50/40 transition-colors group border-b border-slate-200">
          <!-- Kolom 1: ID Mutasi -->
          <td class="py-3 pl-4 sm:pl-5 pr-2.5 align-middle whitespace-nowrap border-r border-slate-200">
            <div class="flex items-center space-x-1.5">
              <span class="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300">#${rowNum}</span>
              <span class="font-mono font-extrabold text-slate-800 text-[11px] truncate" title="${item.id || '-'}">${item.id || '-'}</span>
            </div>
          </td>

          <!-- Kolom 2: Waktu -->
          <td class="py-3 px-3 align-middle whitespace-nowrap border-r border-slate-200">
            <div class="font-mono text-xs font-bold text-slate-800">${fullTimeDisplay}</div>
            <div class="text-[10px] text-slate-400 font-medium">WIB • Sentra Lampung</div>
          </td>

          <!-- Kolom 3: Jenis Mutasi -->
          <td class="py-3 px-2.5 text-center align-middle whitespace-nowrap border-r border-slate-200">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border shadow-2xs ${typeBadge}">
              <span class="mr-1 text-xs leading-none">${typeArrow}</span>
              <span>${item.type}</span>
            </span>
          </td>

          <!-- Kolom 4: Kendaraan -->
          <td class="py-3 px-3 align-middle border-r border-slate-200">
            <div class="flex items-center space-x-2.5 min-w-0">
              <div class="w-10 h-7 rounded-md bg-slate-50 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center p-0.5">
                <img src="${catalogPhotoSrc}" alt="${item.model}" class="w-full h-full object-contain mix-blend-multiply">
              </div>
              <div class="min-w-0">
                <div class="font-black text-slate-900 text-xs truncate">${item.model}</div>
                <div class="text-[10.5px] font-extrabold text-blue-600 truncate mt-0.5">${item.plate || '-'}</div>
              </div>
            </div>
          </td>

          <!-- Kolom 5: No. Rangka, Mesin & No. BA -->
          <td class="py-3 px-3 align-middle whitespace-nowrap border-r border-slate-200">
            <div class="font-mono text-[11px] font-bold text-slate-900 truncate" title="VIN: ${item.vin || '-'}">${item.vin || '-'}</div>
            <div class="font-mono text-[10px] text-slate-500 font-medium truncate mt-0.5" title="Mesin: ${item.engine || '-'}">No. Mesin: ${item.engine || '-'}</div>
            <div class="inline-flex items-center space-x-1 font-mono text-[9px] text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded font-black mt-1" title="Cabang: ${this.formatBranchName(item.noBa)}">
              <span class="text-[7.5px] text-amber-600 font-bold uppercase">Cabang:</span>
              <span>${this.formatBranchName(item.noBa)}</span>
            </div>
          </td>

          <!-- Kolom 6: PIC & Catatan -->
          <td class="py-3 px-3 align-middle border-r border-slate-200">
            <div class="text-xs font-bold text-slate-800 truncate">${item.pic || 'Petugas Pool'}</div>
            <div class="text-[10px] text-slate-500 truncate mt-0.5" title="${item.notes || '-'}">${item.notes || '-'}</div>
          </td>

          <!-- Kolom 7: Bukti Fisik (Foto) -->
          <td class="py-3 px-3 align-middle text-center whitespace-nowrap border-r border-slate-200">
            <div class="flex items-center justify-center space-x-2">
              ${unitThumbnailHtml}
              ${docThumbnailHtml}
            </div>
          </td>

          <!-- Kolom 8: Status -->
          <td class="py-3 pl-2.5 pr-4 sm:pr-5 align-middle text-right whitespace-nowrap">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              <span>Terverifikasi</span>
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }
};

// Global bridging functions untuk kompatibilitas HTML
window.UI = UI;
window.switchTab = (tab) => UI.switchTab(tab);
window.filterInventory = () => UI.filterInventory();
window.clearInventorySearch = () => UI.clearInventorySearch();
window.openEditProfilePage = () => UI.openEditProfilePage();
window.closeEditProfilePage = () => UI.closeEditProfilePage();
window.handleProfilePhotoSelected = (e) => UI.handleProfilePhotoSelected(e);
window.saveProfileData = () => UI.saveProfileData();
window.openEditAutomationModal = () => UI.openEditAutomationModal();
window.closeEditAutomationModal = () => UI.closeEditAutomationModal();
window.saveAutomationData = () => UI.saveAutomationData();
window.openEditScheduleModal = () => UI.openEditScheduleModal();
window.closeEditScheduleModal = () => UI.closeEditScheduleModal();
window.saveScheduleData = () => UI.saveScheduleData();
window.openEditTargetEmailModal = () => UI.openEditTargetEmailModal();
window.closeEditTargetEmailModal = () => UI.closeEditTargetEmailModal();
window.saveTargetEmailData = () => UI.saveTargetEmailData();
window.setFrequency = (f) => UI.setFrequency(f);
window.setDayOfWeek = (d) => UI.setDayOfWeek(d);
window.setDayOfMonth = (m) => UI.setDayOfMonth(m);
window.setTimePeriod = (p) => UI.setTimePeriod(p);
window.setHourFromClock = (h) => UI.setHourFromClock(h);
window.setMinute = (m) => UI.setMinute(m);
window.addEmailRecipient = (e) => UI.addEmailRecipient(e);
window.removeEmailRecipient = (i) => UI.removeEmailRecipient(i);
window.handleEmailInputKeydown = (e) => UI.handleEmailInputKeydown(e);
window.openLogoutModal = () => UI.openLogoutModal();
window.closeLogoutModal = () => UI.closeLogoutModal();
window.confirmLogout = () => UI.confirmLogout();
window.filterInventoryByStatus = (status) => UI.filterInventoryByStatus(status);
window.filterHistoryTab = (tabKey) => UI.filterHistoryTab(tabKey);
window.clearHistorySearch = () => UI.clearHistorySearch();
window.applyHistoryDateFilter = () => UI.applyHistoryDateFilter();
window.resetHistoryDateFilter = () => UI.resetHistoryDateFilter();
window.showToast = (msg) => UI.showToast(msg);
window.openImagePreviewModal = (src) => UI.openImagePreview(src);
window.closeImagePreviewModal = () => UI.closeImagePreview();
window.triggerFileInput = (id) => UI.triggerFileInput(id);
window.handleFileSelected = (e, type) => UI.handleFileSelected(e, type);
window.captureFromScanner = (type) => UI.captureFromScanner(type);
window.removeImagePreview = (type) => UI.removeImagePreview(type);
window.exportHistoryPDF = () => UI.exportHistoryPDF();
window.nextHeroSlide = () => UI.nextHeroSlide ? UI.nextHeroSlide() : null;
window.prevHeroSlide = () => UI.prevHeroSlide ? UI.prevHeroSlide() : null;
window.goToHeroSlide = (idx) => UI.goToHeroSlide ? UI.goToHeroSlide(idx) : null;
window.filterInventoryByModel = (m) => UI.filterInventoryByModel ? UI.filterInventoryByModel(m) : null;
window.filterHistoryByModelAndType = (m, t) => UI.filterHistoryByModelAndType ? UI.filterHistoryByModelAndType(m, t) : null;
window.openScannerForModel = (m) => UI.openScannerForModel ? UI.openScannerForModel(m) : null;
window.showDonutCapsule = (el, ev) => UI.showDonutCapsule ? UI.showDonutCapsule(el, ev) : null;
window.moveDonutCapsule = (el, ev) => UI.moveDonutCapsule ? UI.moveDonutCapsule(el, ev) : null;
window.hideDonutCapsule = (ev) => UI.hideDonutCapsule ? UI.hideDonutCapsule(ev) : null;
window.handleDonutTouch = (ev) => UI.handleDonutTouch ? UI.handleDonutTouch(ev) : null;
window.selectDonutSegment = (el, ev) => UI.selectDonutSegment ? UI.selectDonutSegment(el, ev) : null;
window.closeDonutPopupOnOutside = (ev) => UI.closeDonutPopupOnOutside ? UI.closeDonutPopupOnOutside(ev) : null;
window.checkCloudHealth = () => UI.checkCloudHealth ? UI.checkCloudHealth() : null;
window.openModelDetail = (m) => UI.openModelDetail(m);
window.closeModelDetail = () => UI.closeModelDetail();
window.filterModelMutasiType = (t) => UI.filterModelMutasiType(t);
window.applyModelDateFilter = () => UI.applyModelDateFilter();
window.resetModelDateFilter = () => UI.resetModelDateFilter();
window.clearModelDetailSearch = () => UI.clearModelDetailSearch();
window.toggleDefaultCameraSetting = () => UI.toggleDefaultCameraSetting ? UI.toggleDefaultCameraSetting() : null;
window.toggleAutoTorchSetting = (c) => UI.toggleAutoTorchSetting ? UI.toggleAutoTorchSetting(c) : null;
window.toggleDailyDigestSetting = (c) => UI.toggleDailyDigestSetting ? UI.toggleDailyDigestSetting(c) : null;
window.openNotificationModal = () => UI.openNotificationModal ? UI.openNotificationModal() : null;
window.closeNotificationModal = () => UI.closeNotificationModal ? UI.closeNotificationModal() : null;
window.triggerRealEmailReportNow = () => UI.triggerRealEmailReportNow ? UI.triggerRealEmailReportNow() : null;
window.checkEmailConnectionNow = () => UI.checkEmailConnectionNow ? UI.checkEmailConnectionNow() : null;
window.setEmailNotifFilter = (f) => UI.setEmailNotifFilter ? UI.setEmailNotifFilter(f) : null;
window.clearEmailNotificationLogs = () => UI.clearEmailNotificationLogs ? UI.clearEmailNotificationLogs() : null;
window.applyDashboardDateFilter = () => UI.applyDashboardDateFilter();
window.resetDashboardDateFilter = () => UI.resetDashboardDateFilter();
window.setDashboardDateFilterToToday = () => UI.setDashboardDateFilterToToday();

// Pastikan event touchmove pada grafik donat bersifat non-passive, custom dropdown, animasi scroll & pull to refresh terinisialisasi
document.addEventListener('DOMContentLoaded', () => {
  const donutSvg = document.getElementById('vehicleDonutSvg');
  if (donutSvg) {
    donutSvg.addEventListener('touchstart', (e) => UI.handleDonutTouch(e), { passive: false });
    donutSvg.addEventListener('touchmove', (e) => UI.handleDonutTouch(e), { passive: false });
  }
  if (UI && typeof UI.initCustomDropdowns === 'function') {
    UI.initCustomDropdowns();
  }
  if (UI && typeof UI.initScrollAnimations === 'function') {
    UI.initScrollAnimations();
  }
  if (UI && typeof UI.initPullToRefresh === 'function') {
    UI.initPullToRefresh();
  }
  if (UI && typeof UI.syncSettingsPreferences === 'function') {
    UI.syncSettingsPreferences();
  }
});
