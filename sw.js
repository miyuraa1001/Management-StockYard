/**
 * ============================================================================
 * Service Worker (sw.js) - Management StockYard Astra Daihatsu DSO Lampung
 * ============================================================================
 * Menyediakan kapabilitas Progressive Web App (PWA):
 * 1. Offline support & App Shell pre-caching
 * 2. Stale-While-Revalidate untuk aset statis (HTML, CSS, JS, Gambar)
 * 3. Network-First / Network-Only untuk API Google Apps Script & Google Drive
 * 4. Otomatis membersihkan cache versi lama saat pembaruan dideploy
 */

const CACHE_NAME = 'stockyard-pwa-v1.6.6';

// Daftar aset inti App Shell untuk pre-caching
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/js/config.js',
  './assets/js/state.js',
  './assets/js/api.js',
  './assets/js/notification.js',
  './assets/js/scanner.js',
  './assets/js/ui.js',
  './assets/js/app.js',
  './assets/images/daihatsu-logo.png',
  './assets/icons/icon-apk.png',
  './assets/icons/badge-icon.png'
];

// Domain / URL dinamis yang TIDAK BOLEH dicache (selalu real-time network)
const DYNAMIC_API_HOSTS = [
  'script.google.com',
  'script.googleusercontent.com',
  'drive.google.com',
  'lh3.googleusercontent.com'
];

/**
 * 1. LIFECYCLE: INSTALL
 * Mengunduh dan menyimpan aset statis ke dalam Cache Storage
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Gunakan Promise.allSettled agar jika 1 aset opsional gagal, install tetap sukses
        return Promise.allSettled(
          STATIC_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[SW] Gagal pre-cache ${url}:`, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

/**
 * 2. LIFECYCLE: ACTIVATE
 * Membersihkan cache versi lama dan mengambil alih client secara langsung
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log('[SW] Menghapus cache usang:', name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * 3. LIFECYCLE: FETCH
 * Strategi caching cerdas:
 * - Request API / Backend: Network-Only (selalu data terbaru)
 * - Navigasi HTML: Network-First dengan fallback Cache
 * - Aset statis (CSS, JS, Gambar): Stale-While-Revalidate
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Hanya handle request HTTP / HTTPS
  if (!req.url.startsWith('http')) return;

  // Lewatkan request non-GET (POST, PUT, DELETE selalu ke network)
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // A. Request API dinamis Google Spreadsheet / Apps Script / Drive -> Selalu Network
  const isApiRequest = DYNAMIC_API_HOSTS.some((host) => url.hostname.includes(host));
  if (isApiRequest) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Offline: Tidak dapat terhubung ke server backend.',
            isOffline: true
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          }
        );
      })
    );
    return;
  }

  // B. Navigasi Dokumen HTML (index.html) -> Network-First dengan Offline Cache Fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match('./index.html').then((cachedHtml) => {
            return cachedHtml || caches.match(req);
          });
        })
    );
    return;
  }

  // C. Aset Statis (CSS, JS, Fonts, Images) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Jika offline dan tidak ada di cache
          return null;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

/**
 * 4. LIFECYCLE: NOTIFICATION CLICK
 * Membuka / memfokuskan aplikasi saat notifikasi Android status bar diketuk oleh pengguna
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Jika tab/jendela aplikasi sudah terbuka, fokuskan dan navigasikan tab
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if (notifData.tab && client.postMessage) {
            client.postMessage({ action: 'SWITCH_TAB', tab: notifData.tab });
          }
          return client.focus();
        }
      }
      // Jika belum terbuka, buka jendela baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});


