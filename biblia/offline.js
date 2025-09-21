(function () {
    const DB_NAME = 'notasSbsBibleOffline';
    const DB_VERSION = 1;
    const FILE_STORE = 'files';
    const LAST_DOWNLOAD_KEY = 'biblia-offline:last-download';
    const LAST_COUNT_KEY = 'biblia-offline:last-count';
    const LAST_SIZE_KEY = 'biblia-offline:last-size';

    const supportIndexedDB = typeof indexedDB !== 'undefined';
    let dbPromise = null;

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
        return openDb().then(db => new Promise((resolve, reject) => {
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
            // Ignore storage errors (modo privado, etc.)
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
            default:
                return 'text/plain; charset=utf-8';
        }
    }

    function normalizePath(input) {
        if (!input) return null;
        try {
            const url = new URL(input, window.location.href);
            if (url.origin !== window.location.origin) return null;
            let pathname = url.pathname || '';
            if (pathname.startsWith('/')) pathname = pathname.slice(1);
            return decodeURIComponent(pathname);
        } catch (e) {
            return null;
        }
    }

    async function putRecord(record) {
        return withStore('readwrite', store => store.put(record));
    }

    async function getRecord(path) {
        return withStore('readonly', store => store.get(path));
    }

    async function countRecords() {
        return withStore('readonly', store => store.count());
    }

    async function buildResponseForPath(path) {
        if (!supportIndexedDB) return null;
        try {
            const record = await getRecord(path);
            if (!record || !record.blob) return null;
            const headers = new Headers();
            headers.set('Content-Type', record.contentType || guessContentType(path));
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

        const fetchFn = BibleOffline._originalFetch || window.fetch.bind(window);
        const manifestAbsolute = new URL(manifestUrl, window.location.href);
        const baseUrl = manifestAbsolute.href.slice(0, manifestAbsolute.href.lastIndexOf('/') + 1);

        const manifestResponse = await fetchFn(manifestAbsolute.href, { cache: 'no-store' });
        if (!manifestResponse.ok) {
            throw new Error(`Não foi possível carregar o manifesto de conteúdo bíblico (status ${manifestResponse.status}).`);
        }

        const manifestData = await manifestResponse.json();
        if (!Array.isArray(manifestData)) {
            throw new Error('Manifesto de conteúdo bíblico inválido.');
        }

        const files = manifestData
            .filter(path => typeof path === 'string')
            .map(path => path.replace(/^\/+/, ''))
            .filter(path => path.startsWith('biblia/'));

        const total = files.length;
        if (progressCallback) {
            progressCallback({ completed: 0, total });
        }

        let completed = 0;
        let totalBytes = 0;

        for (const path of files) {
            const relativePath = path.replace(/^biblia\//, '');
            const fileUrl = new URL(relativePath, baseUrl).href;
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
                progressCallback({ completed, total });
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

    const BibleOffline = {
        isSupported: supportIndexedDB,
        downloadAll,
        getInfo,
        formatBytes,
        normalizePath,
        async getResponse(path) {
            const normalized = (path || '').replace(/^\/+/, '');
            return buildResponseForPath(normalized);
        }
    };

    window.BibleOffline = BibleOffline;

    if (supportIndexedDB && !BibleOffline._fetchPatched) {
        const originalFetch = window.fetch.bind(window);

        window.fetch = async function (input, init) {
            const request = typeof input === 'string' ? input : input.url;
            const normalized = normalizePath(request);

            if (!normalized || !normalized.startsWith('biblia/')) {
                return originalFetch(input, init);
            }

            try {
                const response = await originalFetch(input, init);
                if (response.ok) {
                    return response;
                }

                const offlineResponse = await BibleOffline.getResponse(normalized);
                if (offlineResponse) {
                    return offlineResponse;
                }

                return response;
            } catch (networkError) {
                const offlineResponse = await BibleOffline.getResponse(normalized);
                if (offlineResponse) {
                    return offlineResponse;
                }
                throw networkError;
            }
        };

        BibleOffline._fetchPatched = true;
        BibleOffline._originalFetch = originalFetch;
    }
})();
