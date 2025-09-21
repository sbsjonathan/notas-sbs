const CACHE_VERSION = 'v2';
const RICHTEXT_CACHE = `richtext-offline-${CACHE_VERSION}`;
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const OFFLINE_CONTENT_PREFIXES = ['richtext/', 'sentinela/', 'biblia/', 'navbar/', 'save/'];

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

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await precacheAppShell();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const expectedCaches = new Set([RICHTEXT_CACHE, APP_SHELL_CACHE]);
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

  if (OFFLINE_CONTENT_PREFIXES.some(prefix => relativePath.startsWith(prefix))) {
    event.respondWith(cacheFirst(request, RICHTEXT_CACHE));
    return;
  }

  if (APP_SHELL_FILES_SET.has(relativePath)) {
    event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
    return;
  }

  event.respondWith(networkFirst(request));
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (!data.type) {
    return;
  }

  if (data.type === 'CACHE_RICHTEXT_MANIFEST' && Array.isArray(data.urls)) {
    const clientId = event.source && event.source.id;
    event.waitUntil(cacheRichTextResources(data.urls, clientId));
  }

  if (data.type === 'CLEAR_RICHTEXT_CACHE') {
    event.waitUntil(caches.delete(RICHTEXT_CACHE));
  }
});

const APP_SHELL_FILES_SET = new Set(APP_SHELL_FILES);

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

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(APP_SHELL_CACHE);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheRichTextResources(urls, clientId) {
  const cache = await caches.open(RICHTEXT_CACHE);
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
