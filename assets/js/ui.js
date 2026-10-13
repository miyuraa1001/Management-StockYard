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
      const photoSrc = (item.unitPhoto && !item.unitPhoto.includes('unsplash.com'))
        ? item.unitPhoto
        : (catalogItem ? catalogItem.photo : item.unitPhoto);

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
        <div class="scroll-reveal bg-white/95 hover:bg-white rounded-[26px] p-3.5 sm:p-4 md:p-5 border ${isEmpty ? 'border-slate-200/80' : 'border-white'} shadow-saas-card flex flex-col justify-between transition duration-300 group" style="--reveal-delay: ${delayMs}ms;">
          <div>
            <!-- Top Showroom Studio Image Stage -->
            <div class="relative w-full h-40 sm:h-44 md:h-48 rounded-2xl bg-gradient-to-b from-slate-50/75 via-white to-slate-50/90 border border-slate-100 flex items-center justify-center overflow-hidden cursor-pointer group/img" onclick="openImagePreviewModal('${entry.photo}')">
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

              <!-- Official Studio Car Image (Cropped vertically to trim top empty square margin & blend white studio background) -->
              <img src="${entry.photo}" alt="${entry.model}" class="w-full h-full object-cover object-[center_74%] mix-blend-multiply transform scale-[1.02] group-hover/img:scale-[1.08] transition-transform duration-500 select-none">

              <!-- Bottom-Right Zoom Hint Pill -->
              <span class="absolute bottom-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/90 group-hover/img:bg-slate-900 text-slate-500 group-hover/img:text-white border border-slate-200/80 shadow-xs flex items-center justify-center transition" title="Perbesar Foto Katalog">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
              </span>
            </div>

            <!-- Model Title, Catalog ID & Technical Spec -->
            <div class="mt-3.5">
              <div class="flex items-center justify-between gap-2">
                <h4 class="text-base font-black text-slate-900 tracking-tight truncate">${entry.model}</h4>
                <span class="text-[10px] font-extrabold text-blue-600 bg-blue-50/90 px-2 py-0.5 rounded-lg border border-blue-200/70 flex-shrink-0">${entry.catalogId}</span>
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
            <div class="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-slate-100 text-center">
              <div class="rounded-xl py-1.5 px-2 ${entry.inYardCount > 0 ? 'bg-emerald-50/75 border border-emerald-200/80' : 'bg-slate-50/80 border border-slate-100'}">
                <span class="text-[9px] font-extrabold ${entry.inYardCount > 0 ? 'text-emerald-600' : 'text-slate-400'} uppercase tracking-wider flex items-center justify-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${entry.inYardCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
                  <span>In-Yard</span>
                </span>
                <span class="text-xs sm:text-sm font-black ${entry.inYardCount > 0 ? 'text-emerald-700' : 'text-slate-400'} block mt-0.5">${entry.inYardCount} <span class="text-[10px] font-bold">Unit</span></span>
              </div>
              <div class="rounded-xl py-1.5 px-2 ${entry.intransitCount > 0 ? 'bg-amber-50/75 border border-amber-200/80' : 'bg-slate-50/80 border border-slate-100'}">
                <span class="text-[9px] font-extrabold ${entry.intransitCount > 0 ? 'text-amber-600' : 'text-slate-400'} uppercase tracking-wider flex items-center justify-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${entry.intransitCount > 0 ? 'bg-amber-500' : 'bg-slate-300'}"></span>
                  <span>Intransit</span>
                </span>
                <span class="text-xs sm:text-sm font-black ${entry.intransitCount > 0 ? 'text-amber-700' : 'text-slate-400'} block mt-0.5">${entry.intransitCount} <span class="text-[10px] font-bold">Unit</span></span>
              </div>
              <div class="rounded-xl py-1.5 px-2 ${entry.allocatedCount > 0 ? 'bg-blue-50/75 border border-blue-200/80' : 'bg-slate-50/80 border border-slate-100'}">
                <span class="text-[9px] font-extrabold ${entry.allocatedCount > 0 ? 'text-blue-600' : 'text-slate-400'} uppercase tracking-wider flex items-center justify-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full ${entry.allocatedCount > 0 ? 'bg-blue-500' : 'bg-slate-300'}"></span>
                  <span>Allocated</span>
                </span>
                <span class="text-xs sm:text-sm font-black ${entry.allocatedCount > 0 ? 'text-blue-700' : 'text-slate-400'} block mt-0.5">${entry.allocatedCount} <span class="text-[10px] font-bold">Unit</span></span>
              </div>
            </div>
          </div>

          <!-- Detail Unit Aktif atau Status Katalog Stok Kosong (Equal Height Footer) -->
          <div class="mt-3 pt-3 border-t border-slate-100">
            ${!isEmpty && u ? `
              <div class="bg-slate-50/90 rounded-2xl p-2.5 sm:p-3 border border-slate-200/60 space-y-2">
                <div class="flex items-center justify-between gap-2 text-[10.5px]">
                  <span class="font-extrabold px-2 py-0.5 rounded-md bg-white text-slate-800 border border-slate-200/90 shadow-2xs flex-shrink-0">${u.plate || '-'}</span>
                  <span class="font-mono font-bold text-slate-600 truncate">VIN: ${u.vin}</span>
                </div>
                <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50">
                  <span class="text-[10px] font-semibold text-slate-500 flex items-center truncate min-w-0">
                    <svg class="w-3.5 h-3.5 text-blue-500 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                    <span class="truncate">${u.location || entry.defaultLocation}</span>
                  </span>
                  <button type="button" onclick="openScannerForModel('${entry.model}')" class="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200/90 hover:border-blue-600 text-[10px] font-extrabold whitespace-nowrap shadow-2xs transition active:scale-95 flex-shrink-0 cursor-pointer">
                    + Scan Mutasi
                  </button>
                </div>
              </div>
            ` : `
              <div class="bg-slate-50/75 rounded-2xl p-2.5 sm:p-3 border border-dashed border-slate-200 flex items-center justify-between gap-2.5">
                <div class="min-w-0">
                  <span class="text-[10.5px] font-extrabold text-slate-600 block truncate">Stok unit fisik kosong (0 Unit)</span>
                  <span class="text-[10px] text-slate-400 font-medium flex items-center truncate mt-1">
                    <svg class="w-3.5 h-3.5 text-slate-400 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                    <span class="truncate">${entry.defaultLocation}</span>
                  </span>
                </div>
                <button type="button" onclick="openScannerForModel('${entry.model}')" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold whitespace-nowrap shadow-xs transition active:scale-95 flex-shrink-0 cursor-pointer">
                  + Scan Masuk
                </button>
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
          chipEl.className = 'inv-chip active px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white whitespace-nowrap shadow-xs flex items-center space-x-1.5 transition cursor-pointer';
          if (countEl) countEl.className = 'px-1.5 py-0.2 rounded-md text-[10px] font-extrabold bg-white/20 text-white';
        } else {
          chipEl.className = 'inv-chip px-3 sm:px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 whitespace-nowrap flex items-center space-x-1.5 transition cursor-pointer';
          if (countEl) countEl.className = 'px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-slate-200/80 text-slate-600';
        }
      }
    });
    this.renderInventoryList();
  },

  /**
   * Render riwayat audit serah terima unit
   */
  renderHistoryList() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;

    const fDate = document.getElementById('histFilterDate')?.value || 'all';
    const fMonth = document.getElementById('histFilterMonth')?.value || 'all';
    const fYear = document.getElementById('histFilterYear')?.value || 'all';

    let filtered = AppState.historyData.filter(item => {
      let tabMatch = true;
      if (AppState.historyTabFilter === 'in') tabMatch = item.type === 'Unit Masuk';
      if (AppState.historyTabFilter === 'out') tabMatch = item.type === 'Unit Keluar';

      let dateMatch = fDate === 'all' || item.date.toString() === fDate;
      let monthMatch = fMonth === 'all' || item.month.toString() === fMonth;
      let yearMatch = fYear === 'all' || item.year.toString() === fYear;

      return tabMatch && dateMatch && monthMatch && yearMatch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm">
          <p class="text-xs font-bold text-slate-600">Tidak ada transaksi ditemukan</p>
          <p class="text-[10px] text-slate-400 mt-1">Coba sesuaikan filter waktu atau pilih tab Semua.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((item, idx) => {
      const isMasuk = item.type === 'Unit Masuk';
      const typeBadge = isMasuk 
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
        : 'bg-blue-50 text-blue-600 border-blue-200';
      const catalogItem = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(item.model) : null;
      const unitPhotoSrc = (item.unitPhoto && !item.unitPhoto.includes('unsplash.com'))
        ? item.unitPhoto
        : (catalogItem ? catalogItem.photo : item.unitPhoto);

      const delayMs = Math.min((idx % 6) * 45, 200);

      return `
        <div class="scroll-reveal bg-white/95 rounded-3xl p-4 border border-white shadow-saas-card space-y-3" style="--reveal-delay: ${delayMs}ms;">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <div class="flex items-center space-x-2">
              <span class="px-2 py-0.5 rounded-lg text-[9px] font-black border ${typeBadge}">${item.type}</span>
              <span class="text-[11px] font-bold text-slate-700">${item.fullDateStr} • ${item.time} WIB</span>
            </div>
            <span class="inline-flex items-center text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              Terverifikasi
            </span>
          </div>

          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center space-x-1.5">
                <h4 class="text-xs font-black text-slate-900">${item.model}</h4>
                ${catalogItem ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${catalogItem.category}</span>` : ''}
              </div>
              <p class="text-[10px] font-mono text-slate-500 mt-0.5">VIN: <span class="font-bold text-slate-800">${item.vin}</span></p>
              <p class="text-[10px] font-mono text-slate-400 mt-0.5">ENG: ${item.engine}</p>
              <p class="text-[10px] text-slate-500 font-medium mt-1">PIC: <span class="font-bold text-slate-700">${item.pic}</span></p>
            </div>
          </div>

          ${item.notes ? `
            <div class="bg-slate-50 rounded-xl p-2 text-[10px] text-slate-600 border border-slate-100 flex items-start space-x-1.5">
              <svg class="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
              <span>${item.notes}</span>
            </div>
          ` : ''}

          <div class="grid grid-cols-2 gap-2 pt-1">
            <div class="flex items-center space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition" onclick="openImagePreviewModal('${unitPhotoSrc}')">
              <img src="${unitPhotoSrc}" alt="Foto Unit" class="w-10 h-10 rounded-lg object-contain bg-white p-0.5 flex-shrink-0 border border-slate-200">
              <div class="min-w-0">
                <span class="text-[10px] font-bold text-slate-800 block truncate">Foto Mobil</span>
                <span class="text-[9px] text-blue-600 font-semibold">Lihat Gambar &rarr;</span>
              </div>
            </div>

            <div class="flex items-center space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition" onclick="openImagePreviewModal('${item.docPhoto}')">
              <img src="${item.docPhoto}" alt="Foto DO" class="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200">
              <div class="min-w-0">
                <span class="text-[10px] font-bold text-slate-800 block truncate">Dokumen DO</span>
                <span class="text-[9px] text-blue-600 font-semibold">Lihat Dokumen &rarr;</span>
              </div>
            </div>
          </div>
        </div>
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
      if (el) {
        if (t === tabKey) {
          el.className = 'py-1.5 rounded-xl bg-white text-slate-900 shadow-sm transition font-bold';
        } else {
          el.className = 'py-1.5 rounded-xl text-slate-500 hover:text-slate-800 transition font-bold';
        }
      }
    });
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
  triggerFileInput(inputId) {
    const fileInput = document.getElementById(inputId);
    if (fileInput) fileInput.click();
  },

  handleFileSelected(event, targetType) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (targetType === 'unitPhoto') {
        AppState.uploadedUnitPhotoUrl = dataUrl;
        document.getElementById('unitPhotoPreview').src = dataUrl;
        document.getElementById('unitPhotoPreview').classList.remove('hidden');
        document.getElementById('unitPhotoPlaceholder').classList.add('hidden');
        document.getElementById('unitPhotoRemoveBtn').classList.remove('hidden');
      } else {
        AppState.uploadedDocPhotoUrl = dataUrl;
        document.getElementById('docPhotoPreview').src = dataUrl;
        document.getElementById('docPhotoPreview').classList.remove('hidden');
        document.getElementById('docPhotoPlaceholder').classList.add('hidden');
        document.getElementById('docPhotoRemoveBtn').classList.remove('hidden');
      }
      this.showToast('Foto berhasil diunggah!');
    };
    reader.readAsDataURL(file);
  },

  removeImagePreview(targetType) {
    if (targetType === 'unitPhoto') {
      AppState.uploadedUnitPhotoUrl = null;
      document.getElementById('unitPhotoPreview').src = '';
      document.getElementById('unitPhotoPreview').classList.add('hidden');
      document.getElementById('unitPhotoPlaceholder').classList.remove('hidden');
      document.getElementById('unitPhotoRemoveBtn').classList.add('hidden');
      document.getElementById('unitPhotoInput').value = '';
    } else {
      AppState.uploadedDocPhotoUrl = null;
      document.getElementById('docPhotoPreview').src = '';
      document.getElementById('docPhotoPreview').classList.add('hidden');
      document.getElementById('docPhotoPlaceholder').classList.remove('hidden');
      document.getElementById('docPhotoRemoveBtn').classList.add('hidden');
      document.getElementById('docPhotoInput').value = '';
    }
  },

  exportHistoryPDF() {
    this.showToast('Mengunduh Laporan Riwayat Mutasi PDF...');
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
   * agar di perangkat mobile tidak memunculkan picker layar penuh bawaan OS
   */
  initCustomDropdowns() {
    const selectIds = [
      'histFilterDate',
      'histFilterMonth',
      'histFilterYear',
      'inputMutationType',
      'inputCarModel'
    ];

    const nativeValueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');

    selectIds.forEach(id => {
      const selectEl = document.getElementById(id);
      if (!selectEl || selectEl.dataset.customEnhanced === 'true') return;
      selectEl.dataset.customEnhanced = 'true';

      const isCompactFilter = id.startsWith('histFilter');
      const isRightAligned = id === 'histFilterYear';

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
      wrapper.className = 'custom-select-wrapper relative w-full select-none';

      // Buat tombol trigger
      const triggerBtn = document.createElement('button');
      triggerBtn.type = 'button';
      triggerBtn.className = isCompactFilter
        ? 'w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 flex items-center justify-between gap-1 transition focus:outline-none focus:ring-2 focus:ring-blue-500/30'
        : 'w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl py-2.5 px-3.5 text-xs font-bold text-slate-800 flex items-center justify-between gap-2 transition focus:outline-none focus:ring-2 focus:ring-blue-500/30';

      const triggerLabel = document.createElement('span');
      triggerLabel.className = 'truncate text-left';

      const triggerArrow = document.createElement('span');
      triggerArrow.className = 'text-slate-400 flex-shrink-0 transition-transform duration-200';
      triggerArrow.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.3" d="M19 9l-7 7-7-7"/></svg>`;

      triggerBtn.appendChild(triggerLabel);
      triggerBtn.appendChild(triggerArrow);

      // Buat panel menu pop-up ringkas (tidak memenuhi layar)
      const menu = document.createElement('div');
      const alignClass = isRightAligned
        ? 'right-0 min-w-[120px] w-full'
        : (isCompactFilter ? 'left-0 min-w-[130px] w-full' : 'left-0 right-0 w-full');

      menu.className = `custom-select-menu hidden absolute top-full mt-1.5 z-50 ${alignClass} bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-[0_12px_32px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/5 py-1.5 max-h-48 overflow-y-auto`;

      const renderMenuOptions = () => {
        menu.innerHTML = '';
        const currentVal = nativeValueDesc ? nativeValueDesc.get.call(selectEl) : selectEl.value;
        const options = Array.from(selectEl.options);
        const selectedOpt = options.find(o => o.value === String(currentVal)) || options[0];

        if (selectedOpt) {
          triggerLabel.textContent = selectedOpt.textContent;
        }

        options.forEach(opt => {
          const isSelected = String(opt.value) === String(currentVal);
          const itemBtn = document.createElement('button');
          itemBtn.type = 'button';
          itemBtn.dataset.val = opt.value;
          itemBtn.className = `w-[calc(100%-10px)] mx-[5px] my-0.5 px-2.5 py-2 rounded-xl text-left text-xs flex items-center justify-between gap-2 transition ${
            isSelected
              ? 'bg-blue-50 text-blue-600 font-extrabold'
              : 'text-slate-700 hover:bg-slate-100/80 font-semibold'
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
            selectEl.value = opt.value;
            closeMenu();
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          });

          menu.appendChild(itemBtn);
        });
      };

      const openMenu = () => {
        // Tutup semua custom dropdown lain yang sedang terbuka
        document.querySelectorAll('.custom-select-menu').forEach(m => {
          if (m !== menu) m.classList.add('hidden');
        });
        document.querySelectorAll('.custom-select-wrapper').forEach(w => {
          if (w !== wrapper) {
            const arr = w.querySelector('button > span:last-child');
            if (arr) arr.style.transform = 'rotate(0deg)';
          }
        });

        renderMenuOptions();
        menu.classList.remove('hidden');
        triggerArrow.style.transform = 'rotate(180deg)';

        // Scroll otomatis ke item yang sedang terpilih di dalam menu
        const activeItem = menu.querySelector(`[data-val="${CSS.escape(String(selectEl.value))}"]`);
        if (activeItem) {
          activeItem.scrollIntoView({ block: 'nearest' });
        }
      };

      const closeMenu = () => {
        menu.classList.add('hidden');
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
        document.querySelectorAll('.custom-select-wrapper button > span:last-child').forEach(arr => {
          arr.style.transform = 'rotate(0deg)';
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
  }
};

// Global bridging functions untuk kompatibilitas HTML
window.UI = UI;
window.switchTab = (tab) => UI.switchTab(tab);
window.filterInventory = () => UI.filterInventory();
window.clearInventorySearch = () => UI.clearInventorySearch();
window.filterInventoryByStatus = (status) => UI.filterInventoryByStatus(status);
window.filterHistoryTab = (tabKey) => UI.filterHistoryTab(tabKey);
window.applyHistoryDateFilter = () => UI.applyHistoryDateFilter();
window.resetHistoryDateFilter = () => UI.resetHistoryDateFilter();
window.showToast = (msg) => UI.showToast(msg);
window.openImagePreviewModal = (src) => UI.openImagePreview(src);
window.closeImagePreviewModal = () => UI.closeImagePreview();
window.triggerFileInput = (id) => UI.triggerFileInput(id);
window.handleFileSelected = (e, type) => UI.handleFileSelected(e, type);
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

// Pastikan event touchmove pada grafik donat bersifat non-passive, custom dropdown & animasi scroll terinisialisasi
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
});
