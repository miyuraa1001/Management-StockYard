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
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
        : 'bg-blue-50 text-blue-600 border-blue-200';

      return `
        <div class="bg-white rounded-2xl p-3 border border-slate-100 shadow-saas-card flex items-center justify-between">
          <div class="flex items-center space-x-3 min-w-0">
            <img src="${item.unitPhoto}" alt="${item.model}" class="w-11 h-11 rounded-xl object-cover border border-slate-100 flex-shrink-0">
            <div class="min-w-0">
              <div class="flex items-center space-x-1.5">
                <span class="text-xs font-extrabold text-slate-900 truncate">${item.model}</span>
              </div>
              <p class="text-[10px] text-slate-400 font-mono mt-0.5 truncate">VIN: ${item.vin}</p>
              <p class="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center truncate">
                <span class="w-1.5 h-1.5 rounded-full ${isMasuk ? 'bg-emerald-500' : 'bg-blue-500'} mr-1"></span>
                ${item.type} • PIC: ${item.pic}
              </p>
            </div>
          </div>
          <div class="text-right flex-shrink-0 pl-2">
            <span class="text-[10px] font-bold text-slate-400 block">${item.time}</span>
            <span class="inline-block mt-1 px-2 py-0.5 rounded-lg text-[9px] font-extrabold border ${badgeColor}">
              ${isMasuk ? 'Masuk' : 'Keluar'}
            </span>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Render daftar inventory unit kendaraan
   */
  renderInventoryList() {
    const container = document.getElementById('inventoryContainer');
    const searchVal = (document.getElementById('inventorySearchInput')?.value || '').toLowerCase();
    if (!container) return;

    let filtered = AppState.inventoryData.filter(item => {
      const matchesStatus = AppState.inventoryFilter === 'all' || item.status === AppState.inventoryFilter;
      const matchesSearch = item.model.toLowerCase().includes(searchVal) || 
                            item.vin.toLowerCase().includes(searchVal) || 
                            (item.plate && item.plate.toLowerCase().includes(searchVal));
      return matchesStatus && matchesSearch;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm">
          <p class="text-xs font-bold text-slate-600">Tidak ada unit yang cocok</p>
          <p class="text-[10px] text-slate-400 mt-1">Coba kata kunci lain atau ubah filter status.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => {
      let statusBadge = '';
      if (item.status === 'In-Yard') statusBadge = 'bg-emerald-50 text-emerald-600 border-emerald-200';
      else if (item.status === 'Intransit') statusBadge = 'bg-amber-50 text-amber-600 border-amber-200';
      else statusBadge = 'bg-blue-50 text-blue-600 border-blue-200';

      return `
        <div class="bg-white rounded-2xl p-3 border border-slate-100 shadow-saas-card flex items-start space-x-3">
          <img src="${item.photo}" alt="${item.model}" class="w-16 h-14 rounded-xl object-contain bg-slate-50 p-0.5 border border-slate-100 flex-shrink-0 mt-0.5">
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-extrabold text-slate-900 truncate">${item.model}</h4>
              <span class="px-2 py-0.5 rounded-lg text-[9px] font-black border ${statusBadge}">${item.status}</span>
            </div>
            <div class="flex items-center space-x-2 mt-1">
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">${item.plate || '-'}</span>
              <span class="text-[10px] font-mono text-slate-400 truncate">VIN: ${item.vin}</span>
            </div>
            <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-50 text-[10px]">
              <span class="text-slate-400 font-mono">ENG: ${item.engine}</span>
              <span class="text-slate-500 font-medium flex items-center">
                <svg class="w-3 h-3 text-slate-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                ${item.location || 'Sentra Hub'}
              </span>
            </div>
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
    const chips = ['all', 'In-Yard', 'Intransit', 'Allocated'];
    chips.forEach(c => {
      const chipEl = document.getElementById(`chip-${c}`);
      if (chipEl) {
        if (c === status) {
          chipEl.className = 'inv-chip active px-3.5 py-1.5 rounded-full text-[11px] font-bold bg-slate-900 text-white whitespace-nowrap shadow-sm';
        } else {
          chipEl.className = 'inv-chip px-3.5 py-1.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 whitespace-nowrap';
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
              <h4 class="text-xs font-black text-slate-900">${item.model}</h4>
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
            <div class="flex items-center space-x-2 bg-slate-50 p-2 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition" onclick="openImagePreviewModal('${item.unitPhoto}')">
              <img src="${item.unitPhoto}" alt="Foto Unit" class="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200">
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

    const updateDots = (index) => {
      const dots = document.querySelectorAll('.hero-dot');
      dots.forEach((dot, idx) => {
        if (idx === index) {
          dot.className = 'hero-dot w-3.5 sm:w-5 md:w-6 h-1 md:h-1.5 rounded-full bg-blue-500 shadow-sm transition-all';
        } else {
          dot.className = 'hero-dot w-1.5 sm:w-2 h-1 md:h-1.5 rounded-full bg-white/40 hover:bg-white/70 transition-all';
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

      const slideWidth = track.clientWidth || track.offsetWidth || window.innerWidth;
      const targetScrollLeft = index * slideWidth;

      if (immediate) {
        track.style.scrollBehavior = 'auto';
        track.scrollLeft = targetScrollLeft;
        track.style.scrollBehavior = 'smooth';
      } else {
        track.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth'
        });
      }
      updateDots(index);
    };

    UI.nextHeroSlide = () => {
      const curr = (typeof UI.heroCurrentIndex === 'number' && !isNaN(UI.heroCurrentIndex)) ? UI.heroCurrentIndex : 0;
      goToSlide(curr + 1);
    };

    UI.prevHeroSlide = () => {
      const curr = (typeof UI.heroCurrentIndex === 'number' && !isNaN(UI.heroCurrentIndex)) ? UI.heroCurrentIndex : 0;
      goToSlide(curr - 1);
    };

    UI.goToHeroSlide = (idx) => goToSlide(idx);

    window.nextHeroSlide = () => UI.nextHeroSlide();
    window.prevHeroSlide = () => UI.prevHeroSlide();
    window.goToHeroSlide = (idx) => UI.goToHeroSlide(idx);

    UI.startHeroAutoScroll = () => {
      UI.stopHeroAutoScroll();
      UI.heroTimer = setInterval(() => {
        UI.nextHeroSlide();
      }, 4500);
    };

    UI.stopHeroAutoScroll = () => {
      if (UI.heroTimer) {
        clearInterval(UI.heroTimer);
        UI.heroTimer = null;
      }
    };

    // Sinkronisasi otomatis dots dan counter saat pengguna swipe secara native pada layar sentuh
    let scrollTimeout = null;
    track.addEventListener('scroll', () => {
      UI.stopHeroAutoScroll();
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const slideWidth = track.clientWidth || track.offsetWidth || 1;
        const currentIndex = Math.round(track.scrollLeft / slideWidth);
        const validIndex = Math.max(0, Math.min(totalSlides - 1, currentIndex));
        UI.heroCurrentIndex = validIndex;
        updateDots(validIndex);
        UI.startHeroAutoScroll();
      }, 90);
    }, { passive: true });

    // Hentikan sementara auto-scroll saat disentuh oleh pengguna
    track.addEventListener('touchstart', () => UI.stopHeroAutoScroll(), { passive: true });
    track.addEventListener('touchend', () => {
      setTimeout(() => UI.startHeroAutoScroll(), 3500);
    }, { passive: true });
    track.addEventListener('mouseenter', () => UI.stopHeroAutoScroll());
    track.addEventListener('mouseleave', () => UI.startHeroAutoScroll());

    // Mouse drag support untuk desktop
    let isMouseDown = false;
    let startMouseX = 0;
    let scrollStart = 0;

    track.addEventListener('mousedown', (e) => {
      if (e.target && e.target.closest('button')) return;
      isMouseDown = true;
      startMouseX = e.pageX;
      scrollStart = track.scrollLeft;
      track.style.cursor = 'grabbing';
      track.style.scrollBehavior = 'auto';
      UI.stopHeroAutoScroll();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      e.preventDefault();
      const delta = e.pageX - startMouseX;
      track.scrollLeft = scrollStart - delta;
    });

    window.addEventListener('mouseup', () => {
      if (!isMouseDown) return;
      isMouseDown = false;
      track.style.cursor = 'grab';
      track.style.scrollBehavior = 'smooth';
      const slideWidth = track.clientWidth || track.offsetWidth || 1;
      const targetIndex = Math.round(track.scrollLeft / slideWidth);
      goToSlide(targetIndex);
      setTimeout(() => UI.startHeroAutoScroll(), 3500);
    });

    // Pasang tombol panah navigasi kiri dan kanan
    const prevBtn = document.getElementById('heroPrevBtn');
    const nextBtn = document.getElementById('heroNextBtn');

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        UI.stopHeroAutoScroll();
        UI.nextHeroSlide();
        setTimeout(() => UI.startHeroAutoScroll(), 3500);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        UI.stopHeroAutoScroll();
        UI.prevHeroSlide();
        setTimeout(() => UI.startHeroAutoScroll(), 3500);
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
            UI.stopHeroAutoScroll();
            goToSlide(idx);
            setTimeout(() => UI.startHeroAutoScroll(), 3500);
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
    this.switchTab('inventory');
    const searchInput = document.getElementById('inventorySearchInput');
    if (searchInput) {
      searchInput.value = modelKeyword;
      this.filterInventory();
      this.showToast(`🔍 Menampilkan stok: ${modelKeyword}`);
    }
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

