(function () {
    const DB_NAME = 'notasSbsOffline';
    const DB_VERSION = 1;
    const FILE_STORE = 'files';
    const LAST_DOWNLOAD_KEY = 'offline:last-download';
    const LAST_COUNT_KEY = 'offline:last-count';
    const LAST_SIZE_KEY = 'offline:last-size';

    const supportIndexedDB = typeof indexedDB !== 'undefined';
    const LEGACY_DB_NAME = 'notasSbsBibleOffline';
    let dbPromise = null;

    if (supportIndexedDB) {
        try {
            const legacyDelete = indexedDB.deleteDatabase(LEGACY_DB_NAME);
            legacyDelete.onerror = () => { /* ignora erros ao remover banco antigo */ };
        } catch (e) {
            // ignora falhas ao remover banco legado
        }
    }

    function openDb() {
        if (!supportIndexedDB) {
            return Promise.reject(new Error('IndexedDB não suportado'));
        }

        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(FILE_STORE)) {
                        db.createObjectStore(FILE_STORE, { keyPath: 'path' });
                    }
                };

                request.onsuccess = () => {
                    const db = request.result;
                    db.onversionchange = () => {
                        db.close();
                    };
                    resolve(db);
                };

                request.onerror = () => {
                    reject(request.error || new Error('Erro ao abrir IndexedDB'));
                };
            });
        }

        return dbPromise;
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

    function safeSetItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            // Ignora erros de armazenamento (modo privado, etc.)
        }
    }

    function safeGetItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
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

    function normalizeManifestPath(path) {
        if (typeof path !== 'string') return null;
        let normalized = path.trim();
        if (!normalized) return null;

        try {
            const url = new URL(normalized, window.location.href);
            if (url.origin === window.location.origin) {
                normalized = url.pathname + url.search;
            }
        } catch (error) {
            // Mantém caminho relativo
        }

        normalized = normalized.replace(/^\.+\//, '');
        normalized = normalized.replace(/^\/+/, '');
        if (!normalized || normalized === '.') {
            normalized = 'index.html';
        }

        if (normalized.startsWith('./')) {
            normalized = normalized.slice(2);
        }

        if (!normalized) {
            normalized = 'index.html';
        }

        const [pathname] = normalized.split('?');
        return decodeURIComponent(pathname);
    }

    function normalizeRequestPath(input, init = {}) {
        if (!input) return null;

        try {
            const method = (init && init.method) || (input instanceof Request ? input.method : 'GET');
            if (method && method.toUpperCase() !== 'GET') {
                return null;
            }

            const url = input instanceof Request
                ? new URL(input.url, window.location.href)
                : new URL(String(input), window.location.href);

            if (url.origin !== window.location.origin) {
                return null;
            }

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
        } catch (error) {
            return null;
        }
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

    async function putRecord(record) {
        return withStore('readwrite', (store) => store.put(record));
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
                    return record;
                }
            } catch (error) {
                // tenta próximo candidato
            }
        }
        return null;
    }

    async function countRecords() {
        return withStore('readonly', (store) => store.count());
    }

    async function buildResponseForPath(path) {
        if (!supportIndexedDB) return null;
        try {
            const record = await findRecordForPath(path);
            if (!record || !record.blob) return null;
            const headers = new Headers();
            headers.set('Content-Type', record.contentType || guessContentType(record.path || path));
            headers.set('X-Offline-Source', 'indexeddb');
            return new Response(record.blob, { status: 200, statusText: 'OK', headers });
        } catch (error) {
            return null;
        }
    }

    async function downloadAll(manifestUrl, progressCallback) {
        if (!supportIndexedDB) {
            throw new Error('IndexedDB não suportado neste navegador.');
        }

        const fetchFn = OfflineContent._originalFetch || window.fetch.bind(window);
        const manifestAbsolute = new URL(manifestUrl, window.location.href);
        const baseUrl = manifestAbsolute.href.slice(0, manifestAbsolute.href.lastIndexOf('/') + 1);

        const manifestResponse = await fetchFn(manifestAbsolute.href, { cache: 'no-store' });
        if (!manifestResponse.ok) {
            throw new Error(`Não foi possível carregar o manifesto offline (status ${manifestResponse.status}).`);
        }

        const manifestData = await manifestResponse.json();
        if (!Array.isArray(manifestData)) {
            throw new Error('Manifesto offline inválido.');
        }

        const files = [];
        const seen = new Set();
        for (const entry of manifestData) {
            const normalized = normalizeManifestPath(entry);
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);
            files.push(normalized);
        }

        const total = files.length;
        if (!total) {
            throw new Error('Manifesto offline está vazio.');
        }

        if (progressCallback) {
            progressCallback({ completed: 0, total });
        }

        let completed = 0;
        let totalBytes = 0;

        for (const path of files) {
            const fileUrl = new URL(path, baseUrl).href;
            const response = await fetchFn(fileUrl, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`Falha ao baixar ${path} (status ${response.status}).`);
            }

            const blob = await response.blob();
            const contentType = response.headers.get('Content-Type') || guessContentType(path);
            await putRecord({
                path,
                blob,
                contentType,
                updatedAt: Date.now()
            });

            completed += 1;
            totalBytes += blob.size || 0;

            if (progressCallback) {
                progressCallback({ completed, total, path });
            }
        }

        const timestamp = Date.now();
        safeSetItem(LAST_DOWNLOAD_KEY, String(timestamp));
        safeSetItem(LAST_COUNT_KEY, String(completed));
        safeSetItem(LAST_SIZE_KEY, String(totalBytes));

        return { total: completed, bytes: totalBytes, lastDownload: timestamp };
    }

    async function getInfo() {
        if (!supportIndexedDB) {
            return { supported: false, hasData: false };
        }

        const lastDownloadRaw = safeGetItem(LAST_DOWNLOAD_KEY);
        const lastDownload = lastDownloadRaw ? Number(lastDownloadRaw) : null;
        const storedCount = Number(safeGetItem(LAST_COUNT_KEY) || '0');
        const storedBytes = Number(safeGetItem(LAST_SIZE_KEY) || '0');

        let fileCount = storedCount;
        if (!fileCount) {
            try {
                fileCount = await countRecords();
            } catch (e) {
                fileCount = 0;
            }
        }

        return {
            supported: true,
            hasData: fileCount > 0,
            fileCount,
            bytes: storedBytes,
            lastDownload
        };
    }

    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = bytes;
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }

        const decimals = value < 10 && unitIndex > 0 ? 1 : 0;
        return `${value.toFixed(decimals)} ${units[unitIndex]}`;
    }

    async function ensureServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return;
        }

        try {
            const swUrl = new URL('/service-worker.js', window.location.origin).href;
            const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });

            if (registration.waiting && navigator.serviceWorker.controller) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        } catch (error) {
            console.warn('Falha ao registrar service worker offline:', error);
        }
    }

    const OfflineContent = {
        isSupported: supportIndexedDB,
        downloadAll,
        getInfo,
        formatBytes,
        normalizePath: normalizeRequestPath,
        async getResponse(path) {
            const normalized = (path || '').replace(/^\/+/, '');
            return buildResponseForPath(normalized);
        }
    };

    ensureServiceWorker();

    window.OfflineContent = OfflineContent;
    window.BibleOffline = OfflineContent;

    if (supportIndexedDB && !OfflineContent._fetchPatched) {
        const originalFetch = window.fetch.bind(window);

        window.fetch = async function (input, init) {
            const normalized = normalizeRequestPath(input, init);
            if (!normalized) {
                return originalFetch(input, init);
            }

            try {
                const response = await originalFetch(input, init);
                if (response && response.ok) {
                    return response;
                }

                const offlineResponse = await OfflineContent.getResponse(normalized);
                if (offlineResponse) {
                    return offlineResponse;
                }

                return response;
            } catch (networkError) {
                const offlineResponse = await OfflineContent.getResponse(normalized);
                if (offlineResponse) {
                    return offlineResponse;
                }

                throw networkError;
            }
        };

        OfflineContent._fetchPatched = true;
        OfflineContent._originalFetch = originalFetch;
    }
})();
