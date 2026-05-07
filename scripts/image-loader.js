// Two paths exist because CSP `connect-src` blocks `fetch()` to arbitrary origins
// (see index.html). The direct path uses <img> (governed by the broader img-src) and
// detects CORS-tainted canvases. When taint blocks toBlob, the proxy is the only way
// to get the raw bytes — its origin is explicitly listed in connect-src.

const PROXY_RAW = 'https://api.allorigins.win/raw';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_IMAGE_PIXELS = 4096 * 4096; // matches renderer's bitmap size limit

export async function loadImageFromUrl(url) {
    try {
        return await loadDirect(url);
    } catch (directError) {
        // Some failures aren't worth retrying via proxy (e.g. image is too big regardless of transport)
        if (directError.skipProxyFallback) throw directError;
        try {
            return await loadViaProxy(url);
        } catch (proxyError) {
            throw new Error(`Direct: ${directError.message}. Proxy: ${proxyError.message}`);
        }
    }
}

async function loadDirect(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await Promise.race([
        img.decode(),
        rejectAfter(REQUEST_TIMEOUT_MS, 'Image load timed out'),
    ]);

    // Fail fast before allocating a potentially huge canvas backing store
    if (img.naturalWidth * img.naturalHeight > MAX_IMAGE_PIXELS) {
        const err = new Error(`Image too large. Maximum 4096x4096 pixels (got ${img.naturalWidth}x${img.naturalHeight}).`);
        err.skipProxyFallback = true;
        throw err;
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);

    return await new Promise((resolve, reject) => {
        try {
            canvas.toBlob(
                blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null')),
                'image/png'
            );
        } catch (err) {
            // toBlob throws synchronously on a CORS-tainted canvas in some browsers
            reject(err);
        }
    });
}

async function loadViaProxy(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const proxyUrl = `${PROXY_RAW}?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`Proxy fetch failed: ${response.status} ${response.statusText}`);
        }
        return await response.blob();
    } finally {
        clearTimeout(timer);
    }
}

function rejectAfter(ms, message) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}
