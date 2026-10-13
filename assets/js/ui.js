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
   * Render 4 aktivitas mutasi terbaru di Dashboard
   */
  renderDashboardActivities() {
    const container = document.getElementById('dashboardRecentList');
    if (!container) return;

    const recentItems = AppState.historyData.slice(0, 4);
    if (recentItems.length === 0) {
      container.innerHTML = `<p class="text-xs text-slate-400 py-3 text-center">Belum ada aktivitas mutasi.</p>`;
      return;
    }

    container.innerHTML = recentItems.map(item => {
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

      return `
        <div class="bg-slate-50/70 hover:bg-slate-50 rounded-2xl p-2.5 sm:p-3 border border-slate-200/70 transition flex items-center justify-between gap-2">
          <div class="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <img src="${photoSrc}" alt="${item.model}" class="w-14 h-11 sm:w-16 sm:h-12 rounded-xl object-contain bg-white p-0.5 border border-slate-200/70 flex-shrink-0">
            <div class="min-w-0">
              <div class="flex items-center space-x-1.5">
                <span class="px-2 py-0.5 rounded-full text-[9px] sm:text-[9.5px] font-bold border ${badgeColor} flex-shrink-0">
                  ${isMasuk ? 'Unit Masuk' : 'Unit Keluar'}
                </span>
                <span class="text-xs sm:text-sm font-extrabold text-slate-900 truncate">${item.model}</span>
              </div>
              <p class="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-1 truncate">VIN: ${item.vin}</p>
            </div>
          </div>
          <div class="text-right flex-shrink-0 pl-1">
            <span class="text-[9.5px] sm:text-[10.5px] font-medium text-slate-400 block whitespace-nowrap">${shortDate} • ${item.time}</span>
            <span class="inline-flex items-center space-x-1 mt-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[9.5px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/70">
              <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
              <span>Terverifikasi</span>
            </span>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Render katalog & stok inventory 13 model kendaraan Daihatsu
   * Menampilkan seluruh jenis mobil & foto resminya walaupun stok masih kosong (0 unit)
   */
  renderInventoryList() {
    const container = document.getElementById('inventoryContainer');
    const searchVal = (document.getElementById('inventorySearchInput')?.value || '').toLowerCase().trim();
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

      const inYardCount = units.filter(u => u.status === 'In-Yard').length;
      const intransitCount = units.filter(u => u.status === 'Intransit').length;
      const allocatedCount = units.filter(u => u.status === 'Allocated').length;
      const totalUnits = units.length;

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
        entry.defaultLocation.toLowerCase().includes(searchVal);

      const matchesUnit = entry.units.some(u =>
        (u.vin && u.vin.toLowerCase().includes(searchVal)) ||
        (u.plate && u.plate.toLowerCase().includes(searchVal)) ||
        (u.engine && u.engine.toLowerCase().includes(searchVal))
      );

      return matchesStatus && (matchesCatalog || matchesUnit);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-sm">
          <p class="text-xs font-bold text-slate-600">Tidak ada model atau unit yang cocok</p>
          <p class="text-[10px] text-slate-400 mt-1">Coba kata kunci lain atau pilih filter "Semua (13 Model)".</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(entry => {
      const isEmpty = entry.totalUnits === 0;

      let statusBadgeClass = 'bg-slate-100 text-slate-500 border-slate-200';
      let statusLabel = 'Stok Kosong (0 Unit)';

      if (!isEmpty) {
        if (entry.primaryStatus === 'In-Yard') {
          statusBadgeClass = 'bg-emerald-50 text-emerald-600 border-emerald-200';
          statusLabel = `Tersedia • ${entry.totalUnits} Unit`;
        } else if (entry.primaryStatus === 'Intransit') {
          statusBadgeClass = 'bg-amber-50 text-amber-600 border-amber-200';
          statusLabel = `Intransit • ${entry.totalUnits} Unit`;
        } else {
          statusBadgeClass = 'bg-blue-50 text-blue-600 border-blue-200';
          statusLabel = `Allocated • ${entry.totalUnits} Unit`;
        }
      }

      const u = entry.primaryUnit;

      return `
        <div class="bg-white rounded-3xl p-3.5 sm:p-4 border ${isEmpty ? 'border-slate-200/80' : 'border-slate-100'} shadow-saas-card hover:shadow-md transition flex flex-col justify-between">
          <div>
            <!-- Top Studio Catalog Image Showcase -->
            <div class="relative w-full h-36 sm:h-40 rounded-2xl bg-white border border-slate-100 flex items-center justify-center p-2 overflow-hidden cursor-pointer group/img" onclick="openImagePreviewModal('${entry.photo}')">
              <!-- Jenis Kendaraan Badge (Top-Left) -->
              <span class="absolute top-2 left-2 z-10 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-900/85 text-white backdrop-blur-sm shadow-xs">
                ${entry.category}
              </span>

              <!-- Status Stok Badge (Top-Right) -->
              <span class="absolute top-2 right-2 z-10 px-2.5 py-0.5 rounded-full text-[9px] font-black border ${statusBadgeClass}">
                ${statusLabel}
              </span>

              <!-- Official Studio Car Image -->
              <img src="${entry.photo}" alt="${entry.model}" class="w-full h-full object-contain transform group-hover/img:scale-105 transition-transform duration-300 select-none">
            </div>

            <!-- Model Title & Jenis/Spesifikasi -->
            <div class="mt-3">
              <div class="flex items-center justify-between gap-2">
                <h4 class="text-sm font-black text-slate-900 truncate">${entry.model}</h4>
                <span class="text-[9.5px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 flex-shrink-0">${entry.catalogId}</span>
              </div>
              <p class="text-[10.5px] text-slate-500 font-semibold mt-0.5 truncate">
                Jenis: <span class="text-slate-700 font-bold">${entry.category}</span> • ${entry.spec}
              </p>
            </div>

            <!-- Rincian Status Stok Per Model -->
            <div class="grid grid-cols-3 gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-center">
              <div class="rounded-xl py-1 px-1.5 ${entry.inYardCount > 0 ? 'bg-emerald-50/80 border border-emerald-200/70' : 'bg-slate-50 border border-slate-100'}">
                <span class="text-[8.5px] font-bold ${entry.inYardCount > 0 ? 'text-emerald-600' : 'text-slate-400'} block uppercase">In-Yard</span>
                <span class="text-xs font-black ${entry.inYardCount > 0 ? 'text-emerald-700' : 'text-slate-400'}">${entry.inYardCount} Unit</span>
              </div>
              <div class="rounded-xl py-1 px-1.5 ${entry.intransitCount > 0 ? 'bg-amber-50/80 border border-amber-200/70' : 'bg-slate-50 border border-slate-100'}">
                <span class="text-[8.5px] font-bold ${entry.intransitCount > 0 ? 'text-amber-600' : 'text-slate-400'} block uppercase">Intransit</span>
                <span class="text-xs font-black ${entry.intransitCount > 0 ? 'text-amber-700' : 'text-slate-400'}">${entry.intransitCount} Unit</span>
              </div>
              <div class="rounded-xl py-1 px-1.5 ${entry.allocatedCount > 0 ? 'bg-blue-50/80 border border-blue-200/70' : 'bg-slate-50 border border-slate-100'}">
                <span class="text-[8.5px] font-bold ${entry.allocatedCount > 0 ? 'text-blue-600' : 'text-slate-400'} block uppercase">Allocated</span>
                <span class="text-xs font-black ${entry.allocatedCount > 0 ? 'text-blue-700' : 'text-slate-400'}">${entry.allocatedCount} Unit</span>
              </div>
            </div>
          </div>

          <!-- Detail Unit Aktif atau Status Katalog Stok Kosong -->
          <div class="mt-2.5 pt-2.5 border-t border-slate-100">
            ${!isEmpty && u ? `
              <div class="bg-slate-50/90 rounded-2xl p-2.5 border border-slate-100 space-y-1">
                <div class="flex items-center justify-between text-[10px]">
                  <span class="font-bold px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-200/80 shadow-2xs">${u.plate || '-'}</span>
                  <span class="font-mono font-bold text-slate-600 truncate ml-2">VIN: ${u.vin}</span>
                </div>
                <div class="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span class="font-mono text-slate-400 truncate">ENG: ${u.engine}</span>
                  <span class="font-semibold text-slate-600 flex items-center truncate ml-2">
                    <svg class="w-3 h-3 text-blue-500 mr-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                    ${u.location || entry.defaultLocation}
                  </span>
                </div>
              </div>
            ` : `
              <div class="bg-slate-50/70 rounded-2xl p-2.5 border border-dashed border-slate-200 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <span class="text-[10px] font-bold text-slate-500 block truncate">Stok unit fisik saat ini kosong (0)</span>
                  <span class="text-[9.5px] text-slate-400 flex items-center truncate mt-0.5">
                    <svg class="w-3 h-3 text-slate-400 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                    ${entry.defaultLocation}
                  </span>
                </div>
                <button type="button" onclick="openScannerForModel('${entry.model}')" class="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/80 text-[10px] font-extrabold whitespace-nowrap transition active:scale-95 flex-shrink-0">
                  + Scan Unit
                </button>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');
  },

  filterInventory() {
    this.renderInventoryList();
  },

  filterInventoryByStatus(status) {
    AppState.inventoryFilter = status;
    const chips = ['all', 'In-Yard', 'Intransit', 'Allocated', 'Kosong'];
    chips.forEach(c => {
      const chipEl = document.getElementById(`chip-${c}`);
      if (chipEl) {
        if (c === status) {
          chipEl.className = 'inv-chip active px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white whitespace-nowrap shadow-sm';
        } else {
          chipEl.className = 'inv-chip px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap';
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

    container.innerHTML = filtered.map(item => {
      const isMasuk = item.type === 'Unit Masuk';
      const typeBadge = isMasuk 
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
        : 'bg-blue-50 text-blue-600 border-blue-200';
      const catalogItem = AppState.getModelCatalogItem ? AppState.getModelCatalogItem(item.model) : null;
      const unitPhotoSrc = (item.unitPhoto && !item.unitPhoto.includes('unsplash.com'))
        ? item.unitPhoto
        : (catalogItem ? catalogItem.photo : item.unitPhoto);

      return `
        <div class="bg-white rounded-3xl p-4 border border-slate-100 shadow-saas-card space-y-3">
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
    if (!dateSelect) return;

    dateSelect.innerHTML = '<option value="all">Semua Tgl</option>';
    for (let i = 1; i <= 31; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      dateSelect.appendChild(opt);
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
   * Menampilkan kapsul glassmorphism kecil di LUAR lingkaran donat saat kursor diarahkan (hover / touch)
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
    if (centerLabel) centerLabel.textContent = 'KOMPOSISI';
    if (centerVal) centerVal.textContent = percent;
    if (centerSub) centerSub.textContent = units;

    // Isi konten kapsul glassmorphism
    const dotEl = document.getElementById('donutPopupDot');
    const modelEl = document.getElementById('donutPopupModel');
    const unitsEl = document.getElementById('donutPopupUnits');
    const percentEl = document.getElementById('donutPopupPercent');

    if (dotEl) dotEl.style.backgroundColor = color;
    if (modelEl) modelEl.textContent = model;
    if (unitsEl) unitsEl.textContent = units;
    if (percentEl) percentEl.textContent = percent;

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

  selectDonutSegment(segmentEl, event) {
    this.showDonutCapsule(segmentEl, event);
  },

  resetDonutSelection() {
    this.hideDonutCapsule();
  },

  closeDonutPopupOnOutside(event) {
    if (event && event.target && event.target.closest('.donut-segment')) return;
    this.hideDonutCapsule();
  }
};

// Global bridging functions untuk kompatibilitas HTML
window.UI = UI;
window.switchTab = (tab) => UI.switchTab(tab);
window.filterInventory = () => UI.filterInventory();
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
window.openScannerForModel = (m) => UI.openScannerForModel ? UI.openScannerForModel(m) : null;
window.showDonutCapsule = (el, ev) => UI.showDonutCapsule ? UI.showDonutCapsule(el, ev) : null;
window.moveDonutCapsule = (el, ev) => UI.moveDonutCapsule ? UI.moveDonutCapsule(el, ev) : null;
window.hideDonutCapsule = (ev) => UI.hideDonutCapsule ? UI.hideDonutCapsule(ev) : null;
window.selectDonutSegment = (el, ev) => UI.selectDonutSegment ? UI.selectDonutSegment(el, ev) : null;
window.resetDonutSelection = (ev) => UI.resetDonutSelection ? UI.resetDonutSelection(ev) : null;
window.closeDonutPopupOnOutside = (ev) => UI.closeDonutPopupOnOutside ? UI.closeDonutPopupOnOutside(ev) : null;
