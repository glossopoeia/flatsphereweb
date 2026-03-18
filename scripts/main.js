import Alpine from 'https://cdn.jsdelivr.net/npm/@alpinejs/csp@3/dist/module.esm.js';
import { ProjectionApp } from './app.js';
import { SecurityManager } from './security.js';
import { projections } from './projections.js';

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
    fullscreen: false,

    // Sliders
    aspectRatio: 1.0,
    zoomSlider: 0,      // log10 value for the slider
    zoom: 1.0,          // actual zoom value (10^zoomSlider)
    rotation: 0,        // rotation in degrees (-180 to 180)

    // Image loading
    imageUrl: '',
    currentFile: null,
    isLoading: true,

    // Sidebar
    sidebarCollapsed: false,
    sidebarRight: false,

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
});

// Register the main app component (CSP build requires named components)
Alpine.data('app', () => ({
    init() {
        const store = Alpine.store('app');
        const optionsHtml = projections.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        this.$refs.dstProjection.innerHTML = optionsHtml;
        this.$refs.srcProjection.innerHTML = optionsHtml;

        // Sync fullscreen state when changed externally (e.g. Escape key)
        document.addEventListener('fullscreenchange', () => this.syncFullscreenState());

        // Sync loading state to button and backdrop
        Alpine.effect(() => {
            const isLoading = store.isLoading;
            const btn = this.$refs.loadImageButton;
            btn.value = isLoading ? 'Loading...' : 'Load';
            btn.disabled = isLoading;
            const backdrop = document.getElementById('loadingBackdrop');
            if (isLoading) {
                backdrop.classList.add('open');
            } else {
                backdrop.classList.remove('open');
            }
        });

        // Sync zoom slider and label when zoom changes (e.g. canvas wheel/pinch)
        Alpine.effect(() => {
            this.$refs.zoomSlider.value = store.zoomSlider;
            this.$refs.zoomLabel.textContent = `${store.zoom.toFixed(2)}x`;
        });

        // Sync notification dialog with store state
        Alpine.effect(() => {
            const n = store.notification;
            const dialog = this.$refs.notificationDialog;
            this.$refs.notificationTitle.textContent = n.title;
            this.$refs.notificationMessage.textContent = n.message;
            if (n.visible && !dialog.open) {
                dialog.showModal();
            } else if (!n.visible && dialog.open) {
                dialog.close();
            }
        });
    },

    onSidebarToggle() {
        this.$refs.sidebar.classList.toggle('collapsed');
    },

    onSidebarSideToggle() {
        this.$refs.sidebar.classList.toggle('right');
    },

    onDestinationChange() {
        Alpine.store('app').destinationProjection = parseInt(this.$refs.dstProjection.value, 10);
    },

    onSourceChange() {
        Alpine.store('app').sourceProjection = parseInt(this.$refs.srcProjection.value, 10);
    },

    onTissotChange() {
        Alpine.store('app').tissot = this.$refs.tissotToggle.checked;
    },

    onGraticuleChange() {
        Alpine.store('app').graticule = this.$refs.graticuleToggle.checked;
    },

    onFullscreenToggle() {
        this.toggleFullscreen();
    },

    async toggleFullscreen() {
        const store = Alpine.store('app');
        try {
            if (!store.fullscreen) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.warn('Fullscreen operation failed:', error);
        } finally {
            this.syncFullscreenState();
        }
    },

    syncFullscreenState() {
        const isFs = !!document.fullscreenElement;
        Alpine.store('app').fullscreen = isFs;
        this.$refs.fullscreenToggle.checked = isFs;
    },

    onAspectRatioInput() {
        const store = Alpine.store('app');
        store.aspectRatio = parseFloat(this.$refs.aspectRatioSlider.value);
        this.$refs.aspectRatioLabel.textContent = `${store.aspectRatio.toFixed(2)}x`;
    },

    onZoomSliderInput() {
        const store = Alpine.store('app');
        store.zoomSlider = parseFloat(this.$refs.zoomSlider.value);
        store.zoom = Math.pow(10, store.zoomSlider);
        this.$refs.zoomLabel.textContent = `${store.zoom.toFixed(2)}x`;
    },

    onRotationInput() {
        const store = Alpine.store('app');
        store.rotation = parseFloat(this.$refs.rotationSlider.value);
        this.$refs.rotationLabel.textContent = `${store.rotation.toFixed(0)}°`;
    },

    onLoadImage() {
        this.dispatchImageLoad();
    },

    onImageUrlKeyup(event) {
        if (event.key === 'Enter') {
            this.dispatchImageLoad();
        }
    },

    onImageUrlInput() {
        const store = Alpine.store('app');
        const currentValue = this.$refs.imageUrl.value.trim();
        if (store.currentFile && currentValue !== store.currentFile.name) {
            store.currentFile = null;
            this.$refs.fileInput.value = '';
        }
    },

    onFileInputChange() {
        const files = this.$refs.fileInput.files;
        if (files.length > 0) {
            const file = files[0];
            if (!SecurityManager.validateImageFile(file)) {
                Alpine.store('app').showError('Invalid file. Please select a valid image file (JPEG, PNG, GIF, WebP, BMP) under 50MB.');
                return;
            }
            const store = Alpine.store('app');
            store.currentFile = file;
            this.$refs.imageUrl.value = file.name;
            store.app.loadUserFile(file, store.sourceProjection);
        }
    },

    dispatchImageLoad() {
        const store = Alpine.store('app');
        const imageUrl = this.$refs.imageUrl.value.trim();
        const sourceProjection = store.sourceProjection;

        if (store.currentFile && imageUrl === store.currentFile.name) {
            store.app.loadUserFile(store.currentFile, sourceProjection);
        } else {
            store.app.loadUserImage(imageUrl, sourceProjection);
        }
    },

    onNotificationClose() {
        Alpine.store('app').hideNotification();
    },

    onDialogBackdropClick(event) {
        if (event.target === this.$refs.notificationDialog) {
            Alpine.store('app').hideNotification();
        }
    },
}));

// Start Alpine
Alpine.start();

const store = Alpine.store('app');

// Enhanced WebGPU support detection
async function checkWebGPUSupport() {

    // Check if WebGPU is available at all
    if (!navigator.gpu) {
        store.showError('WebGPU is not supported in this browser. Try Chrome 113+, Edge 113+, or Safari 18+ with WebGPU enabled.', true);
        return false;
    }

    try {
        // Try to get an adapter
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            store.showError('WebGPU adapter not found. This may indicate hardware compatibility issues or that WebGPU is disabled.', true);
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
        return false;
    }
}

// Initialize app only if WebGPU is supported
checkWebGPUSupport().then(supported => {
    if (supported) {
        store.app = new ProjectionApp();
    }
});
