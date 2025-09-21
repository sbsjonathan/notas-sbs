const CACHE_VERSION = 'v2';
const OFFLINE_CACHE = `content-offline-${CACHE_VERSION}`;
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;

const APP_SHELL_FILES = [
  'index.html',
  'styles.css',
  'main.js',
  'dias-config.js',
  'navbar/navbar-unified.css',
  'navbar/navbar-unified.js',
  'richtext/offline-manifest.json',
  'save/auth-supabase.html',
  'save/config.js',
  'save/auto-save.js',
  'save/sentinela-sync.js',
  'save/supabase.js',
  'save/unified-load.js'
];

const APP_SHELL_FILES_SET = new Set(APP_SHELL_FILES);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await precacheAppShell();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const expectedCaches = new Set([OFFLINE_CACHE, APP_SHELL_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.map(key => {
      if (!expectedCaches.has(key)) {
        return caches.delete(key);
      }
      return undefined;
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const relativePath = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) {
      return cached;
    }

    if (APP_SHELL_FILES_SET.has(relativePath)) {
      return cacheFirst(request, APP_SHELL_CACHE);
    }

    return networkFirst(request, relativePath);
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (!data.type) {
    return;
  }

  if (data.type === 'CACHE_OFFLINE_MANIFEST' && Array.isArray(data.urls)) {
    const clientId = event.source && event.source.id;
    event.waitUntil(cacheOfflineResources(data.urls, clientId));
  }

  if (data.type === 'CLEAR_OFFLINE_CACHE') {
    event.waitUntil(caches.delete(OFFLINE_CACHE));
  }
});

async function precacheAppShell() {
  const cache = await caches.open(APP_SHELL_CACHE);
  await Promise.all(APP_SHELL_FILES.map(async (path) => {
    try {
      const request = new Request(path, { cache: 'reload' });
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response);
      }
    } catch (error) {
      console.warn('[ServiceWorker] Falha ao pré-carregar', path, error);
    }
  }));
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, relativePath) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cacheName = APP_SHELL_FILES_SET.has(relativePath) ? APP_SHELL_CACHE : OFFLINE_CACHE;
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) {
      return cached;
    }
    const fallback = await caches.match('index.html', { ignoreSearch: true });
    if (fallback) {
      return fallback;
    }
    throw error;
  }
}

async function cacheOfflineResources(urls, clientId) {
  const cache = await caches.open(OFFLINE_CACHE);
  const total = urls.length;
  let completed = 0;
  let errors = 0;

  for (const path of urls) {
    try {
      const request = new Request(path, { cache: 'reload' });
      const response = await fetch(request);
      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }
      await cache.put(request, response.clone());
      completed += 1;
      await notifyClient(clientId, {
        type: 'CACHE_PROGRESS',
        url: path,
        completed,
        total
      });
    } catch (error) {
      errors += 1;
      await notifyClient(clientId, {
        type: 'CACHE_PROGRESS',
        url: path,
        completed,
        total,
        error: error.message || 'Erro desconhecido'
      });
    }
  }

  await notifyClient(clientId, {
    type: 'CACHE_COMPLETE',
    total,
    errors
  });
}

async function notifyClient(clientId, message) {
  if (!clientId) {
    return;
  }

  const client = await self.clients.get(clientId);
  if (client) {
    client.postMessage(message);
  }
}
