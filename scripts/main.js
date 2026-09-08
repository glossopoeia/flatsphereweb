import Alpine from 'https://cdn.jsdelivr.net/npm/@alpinejs/csp@3/dist/module.esm.js';
import { MAX_RINGS, convertRingRadius, defaultRings, nextRingColor, formatRingLabel, ringUnit } from './rings.js';
import { ProjectionApp } from './app.js';
import { createAppComponent } from './app-component.js';
import { trackEvent } from './analytics.js';
import projections from '/data/projections.json' with { type: 'json' };

// Make Alpine available globally (for console debugging)
window.Alpine = Alpine;

// Seed per-projection parameter values from the declarative `parameters` arrays in projections.json.
// Returns a Map<ShaderName, { [paramKey]: defaultValue }>. Projections with no parameters get an empty object.
const initialProjParams = {};
for (const p of projections) {
    if (Array.isArray(p.parameters)) {
        initialProjParams[p.shader] = {};
        for (const param of p.parameters) {
            initialProjParams[p.shader][param.key] = param.default;
        }
    }
}

// Register store before Alpine starts
Alpine.store('app', {
    // Projection state
    destinationProjection: 0,
    sourceProjection: 0,

    // Per-projection extra-parameter values, a Map<ShaderName, { [paramKey]: value }>.
    projParams: initialProjParams,

    // Display toggles
    tissot: false,
    graticule: false,
    graticuleWidth: 1.0,
    fullscreen: false,

    // Range rings overlay
    rangeRings: false,
    rangeRingWidth: 1.0,
    rangeRingUnit: 'km',
    rangeRingCenterLat: 0,
    rangeRingCenterLon: 0,
    rangeRingShowCenter: true,
    rangeRingLegend: true,
    rangeRingLegendTheme: 'auto',
    rings: [],
    nextRingId: 1,

    // Sliders
    aspectRatio: 1.0,
    zoomSlider: 0,      // log10 value for the slider
    zoom: 1.0,          // actual zoom value (10^zoomSlider)
    rotation: 0,        // rotation in degrees (-180 to 180)

    // Oblique view (camera) state in degrees
    obliqueLat: 90,     // -90 to 90
    obliqueLon: 0,      // -180 to 180

    // Image loading
    imageUrl: '',
    currentFile: null,
    isLoading: true,

    // Sidebar
    sidebarCollapsed: false,
    sidebarRight: false,

    // Active tool
    activeTool: 'rotate',

    // Pan offset (projection-space coordinates)
    panX: 0.0,
    panY: 0.0,

    // Export state
    exportFormat: 'png',
    exportPreset: '1920x1080',
    exportWidth: 1920,
    exportHeight: 1080,
    exportTransparent: false,
    exportBackgroundColor: '#000000',
    exportQuality: 92,
    exportFilename: '',
    exportInProgress: false,

    // Projection info dialog
    projectionInfo: {
        visible: false,
    },

    showProjectionInfo() {
        this.projectionInfo.visible = true;
    },

    hideProjectionInfo() {
        this.projectionInfo.visible = false;
    },

    // Notifications
    notification: {
        visible: false,
        title: '',
        message: '',
        persistent: false,
        _timeout: null,
    },

    showNotification(message, type = 'error', persistent = false, duration = null) {
        const n = this.notification;
        if (n._timeout) {
            clearTimeout(n._timeout);
            n._timeout = null;
        }
        n.title = type === 'success' ? 'Success' : 'Error';
        n.message = message;
        n.visible = true;
        n.persistent = persistent;

        if (!persistent) {
            const delay = duration || (type === 'success' ? 4000 : 8000);
            n._timeout = setTimeout(() => {
                this.hideNotification();
            }, delay);
        }
    },

    hideNotification() {
        const n = this.notification;
        n.visible = false;
        if (n._timeout) {
            clearTimeout(n._timeout);
            n._timeout = null;
        }
    },

    showSuccess(message, duration = null) {
        this.showNotification(message, 'success', false, duration);
    },

    showError(message, persistent = false) {
        this.showNotification(message, 'error', persistent);
    },

    // Single mutators for clamped/wrapped state. All input sources (sliders, wheel, touch, drag)
    // go through these so the clamp/wrap rules live in one place and zoom ↔ zoomSlider stays in sync.
    setZoom(zoom) {
        this.zoom = Math.max(0.01, Math.min(10, zoom));
        this.zoomSlider = Math.log10(this.zoom);
    },

    setZoomFromSlider(sliderValue) {
        this.zoomSlider = sliderValue;
        this.zoom = Math.pow(10, sliderValue);
    },

    setRotation(deg) {
        let v = ((deg % 360) + 360) % 360;
        if (v > 180) v -= 360;
        this.rotation = v;
    },

    setObliqueLat(deg) {
        this.obliqueLat = Math.max(-90, Math.min(90, deg));
    },

    setObliqueLon(deg) {
        let v = ((deg % 360) + 360) % 360;
        if (v > 180) v -= 360;
        this.obliqueLon = v;
    },

    get ringMax() { return ringUnit(this.rangeRingUnit).max; },
    get ringStep() { return ringUnit(this.rangeRingUnit).step; },
    get ringUnitSuffix() { return ringUnit(this.rangeRingUnit).suffix.trim(); },
    get canAddRing() { return this.rings.length < MAX_RINGS; },

    setRingCenterLat(deg) {
        this.rangeRingCenterLat = Math.max(-90, Math.min(90, deg));
    },

    setRingCenterLon(deg) {
        let v = ((deg % 360) + 360) % 360;
        if (v > 180) v -= 360;
        this.rangeRingCenterLon = v;
    },

    // Enabling the overlay with nothing configured would be a silent no-op, so seed a usable set
    // the first time it is switched on. Later toggles leave the user's rings alone.
    setRangeRings(enabled) {
        this.rangeRings = enabled;
        if (enabled && this.rings.length === 0) {
            this.rings = defaultRings(this.rangeRingUnit);
            this.nextRingId = this.rings.length + 1;
        }
    },

    addRing() {
        if (this.rings.length >= MAX_RINGS) return;
        // Step out from the current outermost ring so a new ring is visible rather than landing on
        // top of an existing one.
        const outermost = this.rings.reduce((m, r) => Math.max(m, r.radius || 0), 0);
        const u = ringUnit(this.rangeRingUnit);
        const radius = Math.min(outermost > 0 ? outermost * 2 : (this.rangeRingUnit === 'deg' ? 10 : 1000), u.max);
        const ring = {
            id: this.nextRingId++,
            enabled: true,
            radius: +radius.toFixed(u.decimals),
            color: nextRingColor(this.rings),
            label: formatRingLabel(+radius.toFixed(u.decimals), this.rangeRingUnit),
        };
        this.rings.push(ring);
    },

    removeRing(index) {
        if (index >= 0 && index < this.rings.length) this.rings.splice(index, 1);
    },

    // Used when committing a ring radius. The input's max and step only flag the field invalid;
    // they do not stop x-model storing whatever was typed, so we need to clamp and round here.
    clampRingRadius(index) {
        const ring = this.rings[index];
        if (!ring || !Number.isFinite(ring.radius)) return;
        const u = ringUnit(this.rangeRingUnit);
        ring.radius = +Math.max(0, Math.min(u.max, ring.radius)).toFixed(u.decimals);
    },

    // Re-express every radius so switching units preserves the distance rather than reinterpreting
    // the number. Labels that still match the auto-generated form are regenerated too; anything the
    // user typed is left untouched.
    setRingUnit(unit) {
        const from = this.rangeRingUnit;
        if (from === unit) return;
        for (const ring of this.rings) {
            const wasAuto = ring.label === formatRingLabel(ring.radius, from);
            ring.radius = convertRingRadius(ring.radius, from, unit);
            if (wasAuto) ring.label = formatRingLabel(ring.radius, unit);
        }
        this.rangeRingUnit = unit;
    },

    // Set a projection's extra-parameter value (see projections.json `parameters`).
    setProjParam(projShader, key, value) {
        if (!this.projParams[projShader]) {
            this.projParams[projShader] = {};
        }
        this.projParams[projShader][key] = value;
    },
});

// Register the main app component (CSP build requires named components)
Alpine.data('app', createAppComponent);

// Start Alpine
Alpine.start();

const store = Alpine.store('app');

// Enhanced WebGPU support detection
async function checkWebGPUSupport() {

    // Check if WebGPU is available at all
    if (!navigator.gpu) {
        store.showError('WebGPU is not supported in this browser. Try Chrome 113+, Edge 113+, or Safari 18+ with WebGPU enabled.', true);
        trackEvent('webgpu_init_failed', { reason: 'no_webgpu_api' });
        return false;
    }

    try {
        // Try to get an adapter
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            store.showError('WebGPU adapter not found. This may indicate hardware compatibility issues or that WebGPU is disabled.', true);
            trackEvent('webgpu_init_failed', { reason: 'no_adapter' });
            return false;
        }

        // Adapter exists, defer device creation to the renderer
        return true;

    } catch (error) {
        let message = 'WebGPU initialization failed: ';

        if (error.name === 'TypeError') {
            message += 'API not properly implemented. Try updating your browser or enabling WebGPU in settings.';
        } else if (error.message.includes('adapter')) {
            message += 'No compatible graphics adapter found. Your device may not support WebGPU.';
        } else if (error.message.includes('device')) {
            message += 'Graphics device unavailable. Try closing other graphics-intensive applications.';
        } else {
            message += `${error.message}. Please check your browser supports WebGPU and it's enabled.`;
        }

        // Add browser-specific hints
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
            message += ' \n\nFor Safari: Enable WebGPU in Safari > Settings > Advanced > Feature Flags > WebGPU.';
        } else if (userAgent.includes('Firefox')) {
            message += ' \n\nFor Firefox: WebGPU support is experimental. Try about:config and set dom.webgpu.enabled to true.';
        }

        store.showError(message, true);
        trackEvent('webgpu_init_failed', { reason: 'init_error', error_name: error.name });
        return false;
    }
}

// Initialize app only if WebGPU is supported
checkWebGPUSupport().then(supported => {
    if (supported) {
        store.app = new ProjectionApp();
    }
});
