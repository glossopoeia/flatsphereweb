import Alpine from 'https://cdn.jsdelivr.net/npm/@alpinejs/csp@3/dist/module.esm.js';
import { ProjectionApp } from './app.js';
import { createAppComponent } from './app-component.js';
import { trackEvent } from './analytics.js';

// Make Alpine available globally (for console debugging)
window.Alpine = Alpine;

// Register store before Alpine starts
Alpine.store('app', {
    // Projection state
    destinationProjection: 0,
    sourceProjection: 0,

    // Display toggles
    tissot: false,
    graticule: false,
    graticuleWidth: 1.0,
    fullscreen: false,

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
