const DB_NAME = 'notasSbsOffline';
const DB_VERSION = 1;
const FILE_STORE = 'files';
const supportIndexedDB = typeof indexedDB !== 'undefined';

function openDb() {
    if (!supportIndexedDB) {
        return Promise.reject(new Error('IndexedDB não suportado.'));
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(FILE_STORE)) {
                db.createObjectStore(FILE_STORE, { keyPath: 'path' });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error || new Error('Erro ao abrir IndexedDB.'));
        };
    });
}

function withStore(mode, callback) {
    return openDb().then((db) => new Promise((resolve, reject) => {
        const transaction = db.transaction(FILE_STORE, mode);
        const store = transaction.objectStore(FILE_STORE);
        const request = callback(store);

        transaction.oncomplete = () => resolve(request && 'result' in request ? request.result : undefined);
        transaction.onerror = () => reject(transaction.error || (request && request.error));
    }));
}

function guessContentType(path) {
    const extension = (path.split('.').pop() || '').toLowerCase();
    switch (extension) {
        case 'html':
        case 'htm':
            return 'text/html; charset=utf-8';
        case 'css':
            return 'text/css; charset=utf-8';
        case 'js':
            return 'application/javascript; charset=utf-8';
        case 'json':
            return 'application/json; charset=utf-8';
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'svg':
            return 'image/svg+xml';
        case 'webp':
            return 'image/webp';
        case 'ico':
            return 'image/x-icon';
        case 'txt':
            return 'text/plain; charset=utf-8';
        default:
            return 'application/octet-stream';
    }
}

function normalizePathFromUrl(url) {
    if (!url) return null;
    let pathname = url.pathname || '';

    if (pathname === '/' || pathname === '') {
        pathname = 'index.html';
    } else if (pathname.startsWith('/')) {
        pathname = pathname.slice(1);
    }

    pathname = decodeURIComponent(pathname);
    if (!pathname) {
        pathname = 'index.html';
    }

    return pathname;
}

function resolveFallbackPaths(path) {
    const normalized = (path || '').replace(/^\/+/, '');
    const candidates = [];

    if (!normalized) {
        candidates.push('index.html');
    } else {
        candidates.push(normalized);
    }

    if (!normalized.includes('.')) {
        const noSlash = normalized.replace(/\/+$/, '');
        if (noSlash) {
            candidates.push(`${noSlash}/index.html`);
            candidates.push(`${noSlash}.html`);
        }
    }

    if (normalized.endsWith('/')) {
        const trimmed = normalized.replace(/\/+$/, '');
        if (trimmed) {
            candidates.push(`${trimmed}/index.html`);
        }
    }

    if (normalized !== 'index.html') {
        candidates.push('index.html');
    }

    const seen = new Set();
    return candidates.filter((candidate) => {
        const key = candidate.replace(/^\/+/, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function getRecord(path) {
    return withStore('readonly', (store) => store.get(path));
}

async function findRecordForPath(path) {
    if (!supportIndexedDB) return null;
    const candidates = resolveFallbackPaths(path);
    for (const candidate of candidates) {
        try {
            const record = await getRecord(candidate);
            if (record && record.blob) {
                return { record, path: candidate };
            }
        } catch (error) {
            // tenta próxima opção
        }
    }
    return null;
}

async function buildOfflineResponse(path) {
    const match = await findRecordForPath(path);
    if (!match) return null;

    const headers = new Headers();
    headers.set('Content-Type', match.record.contentType || guessContentType(match.path));
    headers.set('X-Offline-Source', 'indexeddb');

    return new Response(match.record.blob, { status: 200, statusText: 'OK', headers });
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    if (event && event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (!request || request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    const normalizedPath = normalizePathFromUrl(url);
    if (!normalizedPath) {
        return;
    }

    event.respondWith((async () => {
        try {
            const networkResponse = await fetch(request);
            if (networkResponse && networkResponse.ok) {
                return networkResponse;
            }

            const offlineResponse = await buildOfflineResponse(normalizedPath);
            if (offlineResponse) {
                return offlineResponse;
            }

            return networkResponse;
        } catch (error) {
            const offlineResponse = await buildOfflineResponse(normalizedPath);
            if (offlineResponse) {
                return offlineResponse;
            }

            throw error;
        }
    })());
});
