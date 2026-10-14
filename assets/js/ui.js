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

      if (btnEl) {
        if (t === target) {
          btnEl.classList.add('active');
        } else {
          btnEl.classList.remove('active');
        }
      }

      if (deskBtnEl) {
        if (t === target) {
          deskBtnEl.classList.add('active');
        } else {
          deskBtnEl.classList.remove('active');
        }
      }
    });

    if (target === 'dashboard') {
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
    const kpiMasuk = document.getElementById('kpiMasukVal');
    const kpiKeluar = document.getElementById('kpiKeluarVal');
    const kpiIntransit = document.getElementById('kpiIntransitVal');

    if (kpiMasuk) kpiMasuk.innerText = AppState.kpi.masuk;
    if (kpiKeluar) kpiKeluar.innerText = AppState.kpi.keluar;
    if (kpiIntransit) kpiIntransit.innerText = AppState.kpi.intransit;
  },

  /**
   * Render 6 aktivitas mutasi terbaru di bagian paling bawah Dashboard
   */
  renderDashboardActivities() {
    const container = document.getElementById('dashboardRecentList');
    if (!container) return;

    const recentItems = AppState.historyData.slice(0, 6);
    if (recentItems.length === 0) {
      container.innerHTML = `<p class="col-span-full text-xs text-slate-400 py-4 text-center">Belum ada aktivitas mutasi.</p>`;
      return;
    }

    container.innerHTML = recentItems.map((item, idx) => {
      const isMasuk = item.type === 'Unit Masuk';
      const badgeColor = isMasuk 
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200/80' 
        : 'bg-blue-50 text-blue-600 border-blue-200/80';
      const catalogItem = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(item.model) : null;
      const photoSrc = catalogItem ? catalogItem.photo : (item.modelPhoto || 'assets/images/Inventory_Gran Max Pick Up.jpeg');

      const shortDate = item.fullDateStr
        ? item.fullDateStr.replace('Oktober', 'Okt').replace('September', 'Sep').replace('November', 'Nov').replace('Desember', 'Des').replace('Januari', 'Jan').replace('Februari', 'Feb').replace('Agustus', 'Agu')
        : '9 Okt 2026';

      const delayMs = Math.min(idx * 45, 220);

      return `
        <div onclick="switchTab('history')" class="scroll-reveal bg-gradient-to-br from-white via-slate-50/85 to-slate-100/50 hover:bg-white rounded-2xl p-2.5 sm:p-3.5 border border-slate-200/75 hover:border-blue-200/90 shadow-[0_6px_18px_-6px_rgba(15,23,42,0.06)] transition flex items-center space-x-2.5 sm:space-x-3.5 cursor-pointer group" style="--reveal-delay: ${delayMs}ms;">
          <img src="${photoSrc}" alt="${item.model}" class="w-14 h-11 sm:w-16 sm:h-12 md:w-20 md:h-14 rounded-xl object-contain bg-white p-1 border border-slate-200/70 flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200">
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1.5">
              <span class="px-2 py-0.5 rounded-full text-[8.5px] sm:text-[9.5px] font-bold border ${badgeColor} flex-shrink-0 leading-none">
                ${isMasuk ? 'Unit Masuk' : 'Unit Keluar'}
              </span>
              <span class="text-[9px] sm:text-[10.5px] font-medium text-slate-400 whitespace-nowrap">${shortDate} • ${item.time}</span>
            </div>
            <h4 class="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight mt-1 truncate">${item.model}</h4>
            <div class="flex items-center justify-between gap-1.5 mt-1">
              <p class="text-[9px] sm:text-[11px] text-slate-400 font-mono leading-none truncate">VIN: ${item.vin}</p>
              <span class="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[8.5px] sm:text-[9.5px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/70 flex-shrink-0 leading-none">
                <svg class="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span>Terverifikasi</span>
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

    // Gabungkan data katalog 13 model dengan stok unit fisik aktual di AppState.inventoryData
    const catalogWithStock = catalog.map(cat => {
      const units = (AppState.inventoryData || []).filter(u => {
        if (!u || !u.model) return false;
        if (u.model.toLowerCase() === cat.model.toLowerCase()) return true;
        const matched = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(u.model) : null;
        return matched && matched.catalogId === cat.catalogId;
      });

      // Hitung unit tambahan hasil scan baru di luar sampel awal INV-001..INV-011
      const extraUnits = units.filter(u => !/^INV-0(0[1-9]|1[01])$/.test(String(u.id)));
      const baseInYard = cat.baseStock ? cat.baseStock.inYard : units.filter(u => u.status === 'In-Yard').length;
      const baseIntransit = cat.baseStock ? cat.baseStock.intransit : units.filter(u => u.status === 'Intransit').length;
      const baseAllocated = cat.baseStock ? cat.baseStock.allocated : units.filter(u => u.status === 'Allocated').length;

      const inYardCount = baseInYard + extraUnits.filter(u => u.status === 'In-Yard').length;
      const intransitCount = baseIntransit + extraUnits.filter(u => u.status === 'Intransit').length;
      const allocatedCount = baseAllocated + extraUnits.filter(u => u.status === 'Allocated').length;
      const totalUnits = inYardCount + intransitCount + allocatedCount;

      let primaryStatus = 'Kosong';
      if (inYardCount > 0) primaryStatus = 'In-Yard';
      else if (intransitCount > 0) primaryStatus = 'Intransit';
      else if (allocatedCount > 0) primaryStatus = 'Allocated';

      return {
        ...cat,
        units,
        totalUnits,
        inYardCount,
        intransitCount,
        allocatedCount,
        primaryStatus,
        primaryUnit: units[0] || null
      };
    });

    // Update KPI Ringkasan Inventory & Badge Counter pada Filter Chips
    const sumTotal = catalogWithStock.reduce((acc, item) => acc + item.totalUnits, 0);
    const sumInYard = catalogWithStock.reduce((acc, item) => acc + item.inYardCount, 0);
    const sumIntransit = catalogWithStock.reduce((acc, item) => acc + item.intransitCount, 0);
    const sumAllocated = catalogWithStock.reduce((acc, item) => acc + item.allocatedCount, 0);

    const elTotal = document.getElementById('invKpiTotalUnits');
    const elInYard = document.getElementById('invKpiInYard');
    const elIntransit = document.getElementById('invKpiIntransit');
    const elAllocated = document.getElementById('invKpiAllocated');

    if (elTotal) elTotal.textContent = sumTotal;
    if (elInYard) elInYard.textContent = sumInYard;
    if (elIntransit) elIntransit.textContent = sumIntransit;
    if (elAllocated) elAllocated.textContent = sumAllocated;

    const chipCounts = {
      'all': catalogWithStock.length,
      'In-Yard': catalogWithStock.filter(e => e.inYardCount > 0).length,
      'Intransit': catalogWithStock.filter(e => e.intransitCount > 0).length,
      'Allocated': catalogWithStock.filter(e => e.allocatedCount > 0).length,
      'Kosong': catalogWithStock.filter(e => e.totalUnits === 0).length
    };
    Object.keys(chipCounts).forEach(key => {
      const badge = document.getElementById(`chipCount-${key}`);
      if (badge) badge.textContent = chipCounts[key];
    });

    // Filter berdasarkan chip status & pencarian kata kunci
    const filtered = catalogWithStock.filter(entry => {
      let matchesStatus = true;
      if (AppState.inventoryFilter === 'In-Yard') matchesStatus = entry.inYardCount > 0;
      else if (AppState.inventoryFilter === 'Intransit') matchesStatus = entry.intransitCount > 0;
      else if (AppState.inventoryFilter === 'Allocated') matchesStatus = entry.allocatedCount > 0;
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
        (u.engine && u.engine.toLowerCase().includes(searchVal))
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

      let statusBadgeClass = 'bg-slate-100/95 text-slate-500 border-slate-200/90';
      let statusDotClass = 'bg-slate-400';
      let statusLabel = 'Stok Kosong (0)';

      if (!isEmpty) {
        if (entry.primaryStatus === 'In-Yard') {
          statusBadgeClass = 'bg-emerald-50/95 text-emerald-700 border-emerald-200/90';
          statusDotClass = 'bg-emerald-500';
          statusLabel = `Total ${entry.totalUnits} Unit`;
        } else if (entry.primaryStatus === 'Intransit') {
          statusBadgeClass = 'bg-amber-50/95 text-amber-700 border-amber-200/90';
          statusDotClass = 'bg-amber-500';
          statusLabel = `Total ${entry.totalUnits} Unit`;
        } else {
          statusBadgeClass = 'bg-blue-50/95 text-blue-700 border-blue-200/90';
          statusDotClass = 'bg-blue-500';
          statusLabel = `Total ${entry.totalUnits} Unit`;
        }
      }

      const u = entry.primaryUnit;
      const delayMs = Math.min((idx % 6) * 45, 200);

      return `
        <div class="scroll-reveal bg-white/95 hover:bg-white rounded-[24px] sm:rounded-[26px] p-3.5 sm:p-4 border ${isEmpty ? 'border-slate-200/80' : 'border-white'} shadow-saas-card flex flex-col justify-between transition duration-300 group" style="--reveal-delay: ${delayMs}ms;">
          <div>
            <!-- Top Showroom Studio Image Stage -->
            <div class="relative w-full h-38 sm:h-42 md:h-44 rounded-2xl bg-gradient-to-b from-slate-50/75 via-white to-slate-50/90 border border-slate-100 flex items-center justify-center overflow-hidden cursor-pointer group/img" onclick="openImagePreviewModal('${entry.photo}')">
              <!-- Subtle Studio Floor Shadow -->
              <div class="absolute inset-x-10 bottom-2.5 h-3 rounded-full bg-slate-900/[0.04] blur-xs pointer-events-none"></div>

              <!-- Jenis Kendaraan Badge (Top-Left) -->
              <span class="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-full text-[9.5px] font-extrabold bg-slate-900/80 text-white backdrop-blur-md shadow-xs tracking-wide">
                ${entry.category}
              </span>

              <!-- Status Stok Badge (Top-Right) -->
              <span class="absolute top-2.5 right-2.5 z-10 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[9.5px] font-extrabold border backdrop-blur-sm shadow-2xs ${statusBadgeClass}">
                <span class="w-1.5 h-1.5 rounded-full ${statusDotClass}"></span>
                <span>${statusLabel}</span>
              </span>

              <!-- Official Studio Car Image -->
              <img src="${entry.photo}" alt="${entry.model}" class="w-full h-full object-cover object-[center_74%] mix-blend-multiply transform scale-[1.02] group-hover/img:scale-[1.07] transition-transform duration-500 select-none">

              <!-- Bottom-Right Zoom Hint Pill -->
              <span class="absolute bottom-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/90 group-hover/img:bg-slate-900 text-slate-500 group-hover/img:text-white border border-slate-200/80 shadow-xs flex items-center justify-center transition" title="Perbesar Foto Katalog">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
              </span>
            </div>

            <!-- Model Title, Catalog ID & Technical Spec -->
            <div class="mt-3">
              <div class="flex items-center justify-between gap-2">
                <h4 class="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">${entry.model}</h4>
                <span class="text-[9.5px] font-extrabold text-blue-600 bg-blue-50/90 px-2 py-0.5 rounded-lg border border-blue-200/70 flex-shrink-0">${entry.catalogId}</span>
              </div>
              <div class="flex items-center justify-between gap-2 mt-1 text-[11px] text-slate-500 font-semibold">
                <span class="truncate flex items-center gap-1">
                  <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  <span class="truncate">${entry.spec}</span>
                </span>
                <span class="text-[10px] font-bold text-slate-600 bg-slate-100/90 px-2 py-0.5 rounded-md truncate max-w-[46%] flex-shrink-0">
                  ${entry.defaultLocation.split('(')[0].trim()}
                </span>
              </div>
            </div>

            <!-- Rincian Status Stok Per Model (3 Kolom Presisi) -->
            <div class="grid grid-cols-3 gap-1.5 sm:gap-2 mt-3 pt-2.5 border-t border-slate-100 text-center">
              <div class="rounded-xl py-1.5 px-1.5 ${entry.inYardCount > 0 ? 'bg-emerald-50/75 border border-emerald-200/80' : 'bg-slate-50/80 border border-slate-100'}">
                <span class="text-[8.5px] sm:text-[9px] font-extrabold ${entry.inYardCount > 0 ? 'text-emerald-600' : 'text-slate-400'} uppercase tracking-wider flex items-center justify-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${entry.inYardCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
                  <span>In-Yard</span>
                </span>
                <span class="text-xs font-black ${entry.inYardCount > 0 ? 'text-emerald-700' : 'text-slate-400'} block mt-0.5">${entry.inYardCount} <span class="text-[9.5px] font-bold">Unit</span></span>
              </div>
              <div class="rounded-xl py-1.5 px-1.5 ${entry.intransitCount > 0 ? 'bg-amber-50/75 border border-amber-200/80' : 'bg-slate-50/80 border border-slate-100'}">
                <span class="text-[8.5px] sm:text-[9px] font-extrabold ${entry.intransitCount > 0 ? 'text-amber-600' : 'text-slate-400'} uppercase tracking-wider flex items-center justify-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${entry.intransitCount > 0 ? 'bg-amber-500' : 'bg-slate-300'}"></span>
                  <span>Intransit</span>
                </span>
                <span class="text-xs font-black ${entry.intransitCount > 0 ? 'text-amber-700' : 'text-slate-400'} block mt-0.5">${entry.intransitCount} <span class="text-[9.5px] font-bold">Unit</span></span>
              </div>
              <div class="rounded-xl py-1.5 px-1.5 ${entry.allocatedCount > 0 ? 'bg-blue-50/75 border border-blue-200/80' : 'bg-slate-50/80 border border-slate-100'}">
                <span class="text-[8.5px] sm:text-[9px] font-extrabold ${entry.allocatedCount > 0 ? 'text-blue-600' : 'text-slate-400'} uppercase tracking-wider flex items-center justify-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${entry.allocatedCount > 0 ? 'bg-blue-500' : 'bg-slate-300'}"></span>
                  <span>Allocated</span>
                </span>
                <span class="text-xs font-black ${entry.allocatedCount > 0 ? 'text-blue-700' : 'text-slate-400'} block mt-0.5">${entry.allocatedCount} <span class="text-[9.5px] font-bold">Unit</span></span>
              </div>
            </div>
          </div>

          <!-- Detail Unit Aktif & Lokasi Yard (Tanpa Tombol Scan) -->
          <div class="mt-2.5 pt-2.5 border-t border-slate-100">
            ${!isEmpty && u ? `
              <div class="bg-slate-50/90 rounded-xl px-2.5 py-2 border border-slate-200/60 space-y-1.5">
                <div class="flex items-center justify-between gap-2 text-[10px]">
                  <span class="font-extrabold px-2 py-0.5 rounded-md bg-white text-slate-800 border border-slate-200/90 shadow-2xs flex-shrink-0">${u.plate || '-'}</span>
                  <span class="font-mono font-bold text-slate-600 truncate">VIN: ${u.vin}</span>
                </div>
                <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50 text-[10px]">
                  <span class="font-semibold text-slate-500 flex items-center truncate min-w-0">
                    <svg class="w-3.5 h-3.5 text-blue-500 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                    <span class="truncate">${u.location || entry.defaultLocation}</span>
                  </span>
                  <span class="font-mono text-[9.5px] font-semibold text-slate-400 flex-shrink-0">${u.engine || ''}</span>
                </div>
              </div>
            ` : `
              <div class="bg-slate-50/75 rounded-xl px-2.5 py-2 border border-dashed border-slate-200 flex items-center justify-between gap-2 text-[10px]">
                <span class="font-bold text-slate-500 truncate">Stok unit fisik kosong</span>
                <span class="text-slate-400 font-semibold flex items-center truncate flex-shrink-0">
                  <svg class="w-3 h-3 text-slate-400 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                  <span class="truncate">${entry.defaultLocation.split('(')[0].trim()}</span>
                </span>
              </div>
            `}
          </div>
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
    this.renderInventoryList();
  },

  filterInventoryByStatus(status) {
    AppState.inventoryFilter = status;
    const chips = ['all', 'In-Yard', 'Intransit', 'Allocated', 'Kosong'];
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
   * Mengambil data riwayat mutasi yang sedang difilter oleh pengguna
   */
  getFilteredHistoryData() {
    const fDate = document.getElementById('histFilterDate')?.value || 'all';
    const fMonth = document.getElementById('histFilterMonth')?.value || 'all';
    const fYear = document.getElementById('histFilterYear')?.value || 'all';
    const searchInput = document.getElementById('historySearchInput');
    const searchVal = (searchInput?.value || '').toLowerCase().trim();

    // Filter tahap 1: Berdasarkan Periode Waktu & Kata Kunci Pencarian (untuk counter tab)
    const baseFiltered = (AppState.historyData || []).filter(item => {
      const dateMatch = fDate === 'all' || item.date?.toString() === fDate;
      const monthMatch = fMonth === 'all' || item.month?.toString() === fMonth;
      const yearMatch = fYear === 'all' || item.year?.toString() === fYear;
      if (!dateMatch || !monthMatch || !yearMatch) return false;

      if (!searchVal) return true;
      return (
        (item.model && item.model.toLowerCase().includes(searchVal)) ||
        (item.vin && item.vin.toLowerCase().includes(searchVal)) ||
        (item.engine && item.engine.toLowerCase().includes(searchVal)) ||
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

    return { filtered, baseFiltered, fDate, fMonth, fYear, searchVal };
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
          <td colspan="7" class="py-10 px-6 text-center">
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
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/90'
        : 'bg-blue-50 text-blue-700 border-blue-200/90';
      const typeArrow = isMasuk ? '↓' : '↑';
      const catalogItem = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(item.model) : null;
      // Foto Kolom Kendaraan: selalu foto katalog resmi 13 model yang sama persis seperti di inventory
      const catalogPhotoSrc = catalogItem ? catalogItem.photo : (item.modelPhoto || 'assets/images/Inventory_Gran Max Pick Up.jpeg');
      // Foto Bukti Fisik Lapangan: foto aktual hasil jepretan kamera / upload mutasi
      const physicalPhotoSrc = (item.unitPhoto && !item.unitPhoto.includes('unsplash.com'))
        ? item.unitPhoto
        : catalogPhotoSrc;

      const rowNum = String(idx + 1).padStart(2, '0');

      return `
        <tr class="hover:bg-blue-50/35 transition-colors group">
          <!-- Kolom 1: Waktu & ID -->
          <td class="py-3 pl-4 sm:pl-5 pr-2.5 align-middle whitespace-nowrap">
            <div class="flex items-center space-x-1.5">
              <span class="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200/80">#${rowNum}</span>
              <span class="text-[10.5px] font-mono font-bold text-slate-700">${item.id || '-'}</span>
            </div>
            <div class="text-[11px] font-bold text-slate-800 mt-0.5">${item.fullDateStr} <span class="text-slate-400 font-semibold">• ${item.time}</span></div>
          </td>

          <!-- Kolom 2: Jenis Mutasi -->
          <td class="py-3 px-2.5 align-middle whitespace-nowrap">
            <span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold border shadow-2xs ${typeBadge}">
              <span class="font-black leading-none">${typeArrow}</span>
              <span>${item.type}</span>
            </span>
          </td>

          <!-- Kolom 3: Kendaraan (Foto Otomatis Sesuai Model & Sama dengan Inventory) -->
          <td class="py-3 px-2.5 align-middle">
            <div class="flex items-center space-x-2.5">
              <div onclick="openImagePreviewModal('${catalogPhotoSrc}')" class="w-11 h-8 rounded-lg bg-white border border-slate-200/80 p-0.5 flex items-center justify-center flex-shrink-0 cursor-pointer shadow-2xs hover:border-blue-400 transition" title="Perbesar Foto Katalog ${item.model}">
                <img src="${catalogPhotoSrc}" alt="${item.model}" class="w-full h-full object-contain">
              </div>
              <div class="min-w-0">
                <div class="text-xs font-black text-slate-900 truncate">${item.model}</div>
                <div class="text-[10px] font-semibold text-slate-400 truncate">
                  ${catalogItem ? catalogItem.category : 'Unit Daihatsu'}
                </div>
              </div>
            </div>
          </td>

          <!-- Kolom 4: No. Rangka (VIN) & Mesin -->
          <td class="py-3 px-2.5 align-middle whitespace-nowrap">
            <div class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100/90 border border-slate-200/70 font-mono text-[10px] font-bold text-slate-800">
              ${item.vin}
            </div>
            <div class="text-[9.5px] font-mono text-slate-400 mt-0.5">
              ENG: <span class="font-semibold text-slate-600">${item.engine}</span>
            </div>
          </td>

          <!-- Kolom 5: Petugas PIC & Catatan Audit -->
          <td class="py-3 px-2.5 align-middle">
            <div class="flex items-center space-x-1.5">
              <span class="w-4 h-4 rounded-full bg-blue-50 text-blue-600 border border-blue-200/70 flex items-center justify-center text-[9px] font-black flex-shrink-0">
                ${(item.pic || 'A').charAt(0).toUpperCase()}
              </span>
              <span class="text-[11px] font-extrabold text-slate-800">${item.pic}</span>
            </div>
            <p class="text-[10px] text-slate-500 font-medium mt-0.5 line-clamp-1 leading-snug max-w-[240px]" title="${item.notes || ''}">
              ${item.notes || 'Pemeriksaan standar serah terima unit di lapangan.'}
            </p>
          </td>

          <!-- Kolom 6: Bukti Fisik (Foto Mobil & Dokumen DO) -->
          <td class="py-3 px-2.5 align-middle whitespace-nowrap text-center">
            <div class="inline-flex items-center justify-center space-x-1">
              <button type="button" onclick="openImagePreviewModal('${physicalPhotoSrc}')" class="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200/90 hover:border-blue-200 text-[10px] font-bold transition cursor-pointer" title="Lihat Foto Fisik Mobil">
                <svg class="w-3 h-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg>
                <span>Mobil</span>
              </button>
              <button type="button" onclick="openImagePreviewModal('${item.docPhoto}')" class="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200/90 hover:border-blue-200 text-[10px] font-bold transition cursor-pointer" title="Lihat Dokumen Serah Terima DO">
                <svg class="w-3 h-3 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                <span>DO</span>
              </button>
            </div>
          </td>

          <!-- Kolom 7: Status Verifikasi -->
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
    if (d) d.value = 'all';
    if (m) m.value = 'all';
    if (y) y.value = 'all';
    this.renderHistoryList();
    this.showToast('Filter waktu berhasil di-reset!');
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
        // Kompresi gambar client-side (Max 1280px) agar lancar di HP dan tidak membebani local storage
        const maxDim = 1280;
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
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
   * Mengunduh Laporan Riwayat Mutasi Kendaraan dalam format PDF Resmi
   * Menggunakan jsPDF & AutoTable berstandar Kop Surat PT Astra Daihatsu Motor
   */
  async exportHistoryPDF() {
    const { filtered, fDate, fMonth, fYear } = this.getFilteredHistoryData();

    if (!filtered || filtered.length === 0) {
      this.showToast('⚠️ Tidak ada data mutasi untuk diekspor ke PDF!');
      return;
    }

    const btn = document.getElementById('exportHistoryPdfBtn');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('opacity-70', 'cursor-wait');
    }

    this.showToast('📄 Menyiapkan Dokumen PDF Resmi Daihatsu...');

    try {
      // Pastikan library jsPDF dan autoTable siap digunakan
      await this.ensurePdfLibraryLoaded();

      const hasJsPdf = window.jspdf && window.jspdf.jsPDF;
      if (hasJsPdf) {
        if (!window.jsPDF) window.jsPDF = window.jspdf.jsPDF;
        let canDirect = false;
        try {
          const testDoc = new window.jspdf.jsPDF();
          if (typeof testDoc.autoTable === 'function') {
            canDirect = true;
          }
        } catch (e) {
          canDirect = false;
        }

        if (canDirect) {
          this.generateDirectJsPDF(filtered, { fDate, fMonth, fYear });
          return;
        }
      }
      
      // Fallback: cetak / simpan PDF via browser dialog jika library eksternal terhalang
      this.generatePrintablePdfReport(filtered, { fDate, fMonth, fYear });
    } catch (err) {
      console.error('[UI] Error saat membuat PDF dengan jsPDF, beralih ke Fallback Print:', err);
      this.generatePrintablePdfReport(filtered, { fDate, fMonth, fYear });
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('opacity-70', 'cursor-wait');
      }
    }
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
            return;
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
   */
  generateDirectJsPDF(records, filterInfo) {
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
    let periodText = 'Seluruh Transaksi';
    if (filterInfo.fDate !== 'all' || filterInfo.fMonth !== 'all' || filterInfo.fYear !== 'all') {
      const dStr = filterInfo.fDate !== 'all' ? `${filterInfo.fDate} ` : '';
      const mStr = filterInfo.fMonth !== 'all' ? `${monthNames[filterInfo.fMonth] || filterInfo.fMonth} ` : '';
      const yStr = filterInfo.fYear !== 'all' ? `${filterInfo.fYear}` : '';
      periodText = `${dStr}${mStr}${yStr}`.trim();
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateFormatted = `${day}-${month}-${year}`; // Format DD-MM-YYYY untuk nama file sistem
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const printDateStr = `${now.getDate()} ${monthNames[now.getMonth() + 1]} ${now.getFullYear()}, ${timeStr} WIB`;
    const docNumber = `SALVAGE/MUT/${year}${month}/${Math.floor(1000 + Math.random() * 9000)}`;

    // ==========================================
    // 1. KOP SURAT RESMI ASTRA DAIHATSU
    // ==========================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('PT ASTRA DAIHATSU MOTOR • DSO SENTRA LAMPUNG', margin, 12);

    doc.setFontSize(9);
    doc.setTextColor(37, 99, 235); // brand-blue
    doc.text('REKAPITULASI AUDIT & SERAH TERIMA FISIK KENDARAAN (SALVAGE LOGISTICS)', margin, 16.5);

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
    doc.roundedRect(margin, 26, pageWidth - (margin * 2), 15, 2, 2, 'FD');

    // Kolom Kiri Dokumen Info
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('No. Dokumen', margin + 3, 30.5);
    doc.text('Periode Audit', margin + 3, 34.5);
    doc.text('Waktu Cetak', margin + 3, 38.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(`:  ${docNumber}`, margin + 33, 30.5);
    doc.text(`:  ${periodText}`, margin + 33, 34.5);
    doc.text(`:  ${printDateStr}`, margin + 33, 38.5);

    // Kolom Tengah Penugasan
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Petugas PIC', margin + 100, 30.5);
    doc.text('NPK Petugas', margin + 100, 34.5);
    doc.text('Cabang Penugasan', margin + 100, 38.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(`:  ${operatorName}`, margin + 130, 30.5);
    doc.text(`:  ${operatorNpk}`, margin + 130, 34.5);
    doc.text(`:  ${operatorBranch}`, margin + 130, 38.5);

    // Kolom Kanan KPI Badge
    const masukCount = records.filter(r => r.type === 'Unit Masuk').length;
    const keluarCount = records.filter(r => r.type === 'Unit Keluar').length;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('RINGKASAN MUTASI:', pageWidth - margin - 65, 30.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Total Terdata : ${records.length} Unit Fisik`, pageWidth - margin - 65, 34.5);
    doc.text(`Masuk: ${masukCount} | Keluar: ${keluarCount}`, pageWidth - margin - 65, 38.5);

    // ==========================================
    // 3. TABEL DATA MUTASI (AUTOTABLE)
    // ==========================================
    const tableColumns = [
      { header: 'No', dataKey: 'no' },
      { header: 'Waktu & ID', dataKey: 'datetime' },
      { header: 'Jenis Mutasi', dataKey: 'type' },
      { header: 'Model Kendaraan', dataKey: 'model' },
      { header: 'No. Rangka (VIN)', dataKey: 'vin' },
      { header: 'No. Mesin', dataKey: 'engine' },
      { header: 'Petugas PIC', dataKey: 'pic' },
      { header: 'Catatan & Hasil Pemeriksaan Fisik', dataKey: 'notes' }
    ];

    const tableRows = records.map((item, idx) => ({
      no: String(idx + 1).padStart(2, '0'),
      datetime: `${item.fullDateStr || `${now.getDate()} ${monthNames[now.getMonth() + 1]} ${year}`}\n${item.time || ''} • ${item.id || ''}`,
      type: item.type,
      model: item.model,
      vin: item.vin,
      engine: item.engine,
      pic: item.pic || operatorName,
      notes: item.notes || 'Pemeriksaan standar serah terima unit di lapangan.'
    }));

    doc.autoTable({
      columns: tableColumns,
      body: tableRows,
      startY: 44,
      margin: { left: margin, right: margin, bottom: 20 },
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42], // Slate-900
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        cellPadding: 1.8
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [30, 41, 59],
        valign: 'middle',
        cellPadding: 1.4
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // Slate-50
      },
      columnStyles: {
        no: { halign: 'center', cellWidth: 9 },
        datetime: { cellWidth: 32 },
        type: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
        model: { cellWidth: 36, fontStyle: 'bold' },
        vin: { cellWidth: 42, font: 'courier', fontStyle: 'bold' },
        engine: { cellWidth: 28, font: 'courier' },
        pic: { cellWidth: 28 },
        notes: { cellWidth: 'auto' }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.dataKey === 'type') {
          if (data.cell.raw === 'Unit Masuk') {
            data.cell.styles.textColor = [16, 120, 60];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [29, 78, 216];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    // ==========================================
    // 4. LEMBAR PENGESAHAN LAPANGAN (SIGNATURES)
    // ==========================================
    let finalY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 110) + 6;
    if (finalY > pageHeight - 28) {
      doc.addPage();
      finalY = 16;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);

    const sigW = (pageWidth - (margin * 2)) / 3;

    // Kolom 1: Transporter
    doc.text('Diserahkan oleh (Transporter):', margin, finalY);
    doc.text('( ...................................................... )', margin, finalY + 12);
    doc.text('Ekspedisi / Pengemudi Car Carrier', margin, finalY + 16);

    // Kolom 2: Staff Penerima
    doc.text('Diterima & Diperiksa oleh:', margin + sigW, finalY);
    doc.text(`( ${operatorName} )`, margin + sigW, finalY + 12);
    doc.text(`Staff Operasional Yard • NPK: ${operatorNpk}`, margin + sigW, finalY + 16);

    // Kolom 3: Head of Yard
    doc.text('Mengetahui / Menyetujui:', margin + (sigW * 2), finalY);
    doc.text('( ...................................................... )', margin + (sigW * 2), finalY + 12);
    doc.text('Kepala Pool Sentra Yard Lampung', margin + (sigW * 2), finalY + 16);

    // ==========================================
    // 5. FOOTER & NOMOR HALAMAN PADA SEMUA HALAMAN
    // ==========================================
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
      doc.text('Dokumen Resmi Logistik Lapangan • PT Astra Daihatsu Motor (Sentra Lampung) • Dicetak via Salvage Enterprise', margin, pageHeight - 5);
    }

    // ==========================================
    // 6. SIMPAN DAN DOWNLOAD FILE PDF KE PERANGKAT
    // ==========================================
    const fileName = `Laporan_Mutasi_Daihatsu_Sentra_Lampung_${dateFormatted}.pdf`;
    
    doc.save(fileName);
    this.showToast(`✅ Berhasil mengunduh ${fileName}`);
  },

  /**
   * Fallback Cetak / Simpan PDF jika jsPDF mengalami kendala
   */
  generatePrintablePdfReport(records, filterInfo) {
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
    const docNumber = `SALVAGE/MUT/${year}${month}/${Math.floor(1000 + Math.random() * 9000)}`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Izinkan pop-up di browser Anda untuk mengunduh laporan PDF.');
      return;
    }

    const rowsHtml = records.map((item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 8.5px;">
        <td style="padding: 3px 5px; text-align: center; font-weight: 700; color: #64748b;">${String(idx + 1).padStart(2, '0')}</td>
        <td style="padding: 3px 5px; white-space: nowrap;"><strong>${item.fullDateStr || `${now.getDate()} ${monthNames[now.getMonth() + 1]} ${year}`}</strong><br><span style="color:#64748b; font-size: 8px;">${item.time || ''} • ${item.id || ''}</span></td>
        <td style="padding: 3px 5px; text-align: center;"><span style="display:inline-block; padding: 1.5px 6px; border-radius: 9999px; font-weight: 700; font-size: 8px; background: ${item.type === 'Unit Masuk' ? '#ecfdf5' : '#eff6ff'}; color: ${item.type === 'Unit Masuk' ? '#047857' : '#1d4ed8'}; border: 1px solid ${item.type === 'Unit Masuk' ? '#a7f3d0' : '#bfdbfe'};">${item.type}</span></td>
        <td style="padding: 3px 5px;"><strong>${item.model}</strong></td>
        <td style="padding: 3px 5px; font-family: monospace; font-weight: 700; font-size: 8.5px; color: #0f172a;">${item.vin}</td>
        <td style="padding: 3px 5px; font-family: monospace; font-size: 8.5px; color: #334155;">${item.engine}</td>
        <td style="padding: 3px 5px; color: #1e293b;">${item.pic || operatorName}</td>
        <td style="padding: 3px 5px; color: #475569; font-size: 8px;">${item.notes || 'Pemeriksaan standar serah terima fisik.'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Laporan_Mutasi_Daihatsu_Sentra_Lampung_${dateFormatted}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm 10mm 8mm 10mm;
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
          .header {
            border-bottom: 2px solid #2563eb;
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
            font-size: 10px;
            font-weight: 700;
            color: #2563eb;
            margin-top: 1px;
            text-transform: uppercase;
          }
          .address {
            font-size: 8px;
            color: #64748b;
            margin-top: 2px;
          }
          .info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 5px 10px;
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
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
            font-size: 8.5px;
            text-align: left;
            font-weight: 700;
            border: 1px solid #0f172a;
          }
          td {
            padding: 3px 5px;
            font-size: 8.5px;
            line-height: 1.25;
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
          .signatures {
            margin-top: 10px;
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
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
            font-size: 7.5px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 3px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">PT Astra Daihatsu Motor • DSO Sentra Lampung</div>
            <div class="subtitle">Rekapitulasi Audit & Serah Terima Fisik Kendaraan (Salvage Logistics)</div>
            <div class="address">Jl. Raya Soekarno Hatta No. 88, Bandar Lampung • Sentra Yard & Logistics Operations Hub • Telp: (0721) 700-888</div>
          </div>
          <div style="text-align: right; font-size: 8px; color: #64748b;">
            <div>Dokumen Resmi Internal</div>
            <div style="font-weight: 700; color: #0f172a;">${docNumber}</div>
          </div>
        </div>

        <div class="info-box">
          <div>
            <strong>Waktu Cetak:</strong> ${printDateStr}<br>
            <strong>Total Rekaman:</strong> ${records.length} Unit Fisik Terdata
          </div>
          <div>
            <strong>Petugas PIC:</strong> ${operatorName} (NPK: ${operatorNpk})<br>
            <strong>Cabang Penugasan:</strong> ${operatorBranch}
          </div>
          <div>
            <strong>Status Logistik:</strong> Verifikasi Lapangan Selesai<br>
            <strong>Format Arsip:</strong> Dokumen PDF / Cetak Fisik
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 26px; text-align: center;">No</th>
              <th style="width: 100px;">Waktu & ID</th>
              <th style="width: 75px; text-align: center;">Jenis Mutasi</th>
              <th style="width: 110px;">Model Kendaraan</th>
              <th style="width: 130px;">No. Rangka (VIN)</th>
              <th style="width: 90px;">No. Mesin</th>
              <th style="width: 90px;">Petugas PIC</th>
              <th>Catatan Lapangan & Fisik</th>
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
            <div style="color: #64748b; font-size: 8px;">Pengemudi / Ekspedisi Car Carrier</div>
          </div>
          <div class="sig-col">
            <div>Diterima & Diperiksa oleh:</div>
            <div class="sig-space"></div>
            <div><strong>( ${operatorName} )</strong></div>
            <div style="color: #64748b; font-size: 8px;">Staff Operasional Yard • NPK: ${operatorNpk}</div>
          </div>
          <div class="sig-col">
            <div>Mengetahui / Menyetujui:</div>
            <div class="sig-space"></div>
            <div>( ...................................................... )</div>
            <div style="color: #64748b; font-size: 8px;">Kepala Sentra Yard Lampung DSO</div>
          </div>
        </div>

        <div class="footer-note">
          <div>Dokumen Resmi Sistem Management Salvage • PT Astra Daihatsu Motor (Sentra Lampung)</div>
          <div>Dicetak secara otomatis via sistem Management Salvage</div>
        </div>

        <script>
          window.addEventListener('DOMContentLoaded', function() {
            setTimeout(function() {
              window.print();
            }, 300);
          });
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
    this.showToast('✅ Membuka dialog cetak / Simpan sebagai PDF.');
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
    this.initCustomDropdowns();
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
    if (centerVal) centerVal.textContent = '89';
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
    const dateSelectCheck = document.getElementById('histFilterDate');
    if (dateSelectCheck && dateSelectCheck.options.length <= 1) {
      dateSelectCheck.innerHTML = '<option value="all">Semua Tgl</option>';
      for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        dateSelectCheck.appendChild(opt);
      }
    }

    const selectIds = [
      'histFilterDate',
      'histFilterMonth',
      'histFilterYear',
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

      const isCompactFilter = id.startsWith('histFilter');
      const isDateGrid = id === 'histFilterDate';
      const isMonthGrid = id === 'histFilterMonth';
      const isYearFilter = id === 'histFilterYear';

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

      // Buat panel menu pop-up dengan latar belakang SOLID PUTIH (#FFFFFF) agar tabel di bawahnya tidak tembus
      const menu = document.createElement('div');
      menu.style.backgroundColor = '#ffffff';
      if (isDateGrid) {
        menu.className = 'custom-select-menu hidden absolute top-full mt-2 left-0 w-[252px] sm:w-[268px] z-50 bg-white border border-slate-200 rounded-2xl p-3';
      } else if (isMonthGrid) {
        menu.className = 'custom-select-menu hidden absolute top-full mt-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-[232px] sm:w-[244px] z-50 bg-white border border-slate-200 rounded-2xl p-3';
      } else if (isYearFilter) {
        menu.className = 'custom-select-menu hidden absolute top-full mt-2 right-0 min-w-[132px] w-full z-50 bg-white border border-slate-200 rounded-2xl p-1.5';
      } else {
        menu.className = 'custom-select-menu hidden absolute top-full mt-2 left-0 right-0 w-full z-50 bg-white border border-slate-200 rounded-2xl py-1.5 max-h-56 overflow-y-auto';
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

        renderMenuOptions();
        wrapper.classList.remove('z-10');
        wrapper.classList.add('z-50');
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
          } else if (entry.boundingClientRect.top > 40) {
            // Re-animate secara halus ketika di-scroll kembali dari atas ke bawah
            entry.target.classList.remove('is-visible');
          }
        });
      }, {
        root: vp || null,
        rootMargin: '0px 0px -24px 0px',
        threshold: 0.08
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
    if (npkEl) npkEl.innerText = `NPK: ${profile.npk}`;
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
      email: 'syafirafira08162@gmail.com',
      type: 'Daily Digest PDF Rekap Mutasi Unit Masuk & Keluar'
    };

    const schedEl = document.getElementById('autoScheduleDisplay');
    const emailEl = document.getElementById('autoEmailDisplay');
    if (schedEl) schedEl.innerText = auto.schedule;
    if (emailEl) emailEl.innerText = auto.email;

    const inputSched = document.getElementById('inputAutoSchedule');
    const inputEmail = document.getElementById('inputAutoEmail');
    const inputType = document.getElementById('inputAutoType');
    if (inputSched) inputSched.value = auto.schedule;
    if (inputEmail) inputEmail.value = auto.email;
    if (inputType) inputType.value = auto.type;
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
   * Simpan perubahan profil operator (nama, NPK, cabang, jabatan, foto)
   */
  saveProfileData() {
    const name = (document.getElementById('inputProfileName')?.value || '').trim();
    const npk = (document.getElementById('inputProfileNpk')?.value || '').trim();
    const branch = (document.getElementById('inputProfileBranch')?.value || '').trim();
    const role = (document.getElementById('inputProfileRole')?.value || '').trim();

    if (!name || !npk) {
      this.showToast('Nama petugas dan NPK wajib diisi!');
      return;
    }

    AppState.userProfile.name = name;
    AppState.userProfile.npk = npk;
    if (branch) AppState.userProfile.branch = branch;
    if (role) AppState.userProfile.role = role;

    if (AppState._tempProfilePhoto) {
      AppState.userProfile.photo = AppState._tempProfilePhoto;
      AppState._tempProfilePhoto = null;
    }

    AppState.saveToCache();
    this.applyUserProfile();
    this.closeEditProfilePage();
    this.showToast('✅ Profil & NPK berhasil diperbarui!');
  },

  /**
   * Buka modal pembaruan informasi otomatisasi laporan
   */
  openEditAutomationModal() {
    this.applyAutomationConfig();
    const modal = document.getElementById('editAutomationModal');
    if (modal) modal.classList.remove('hidden');
  },

  /**
   * Tutup modal pembaruan otomatisasi
   */
  closeEditAutomationModal() {
    const modal = document.getElementById('editAutomationModal');
    if (modal) modal.classList.add('hidden');
  },

  /**
   * Simpan pembaruan otomatisasi laporan
   */
  saveAutomationData() {
    const sched = document.getElementById('inputAutoSchedule')?.value;
    const email = (document.getElementById('inputAutoEmail')?.value || '').trim();
    const type = (document.getElementById('inputAutoType')?.value || '').trim();

    if (!email) {
      this.showToast('Email penerima laporan wajib diisi!');
      return;
    }

    AppState.automationConfig = {
      schedule: sched || AppState.automationConfig.schedule,
      email: email,
      type: type || AppState.automationConfig.type
    };

    AppState.saveToCache();
    this.applyAutomationConfig();
    this.closeEditAutomationModal();
    this.showToast('✅ Info otomatisasi laporan berhasil diperbarui!');
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
   * Eksekusi konfirmasi keluar sistem
   */
  confirmLogout() {
    this.closeLogoutModal();
    this.showToast('🔒 Anda telah berhasil keluar dari sesi sistem.');
    setTimeout(() => {
      this.switchTab('dashboard');
    }, 400);
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
window.resetDonutSelection = (ev) => UI.resetDonutSelection ? UI.resetDonutSelection(ev) : null;
window.closeDonutPopupOnOutside = (ev) => UI.closeDonutPopupOnOutside ? UI.closeDonutPopupOnOutside(ev) : null;

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
});
