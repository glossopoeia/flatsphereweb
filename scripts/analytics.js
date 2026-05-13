// Thin wrapper over the analytics provider so the rest of the app never
// names a vendor. Swap providers by editing only this file (and the script
// tag + CSP in index.html).
export function trackEvent(name, props) {
    const u = typeof window !== 'undefined' ? window.umami : undefined;
    if (!u || typeof u.track !== 'function') return;
    try {
        if (props && typeof props === 'object') {
            u.track(name, props);
        } else {
            u.track(name);
        }
    } catch (_) {
        // Never let analytics break the app.
    }
}
