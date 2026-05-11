import Alpine from 'https://cdn.jsdelivr.net/npm/@alpinejs/csp@3/dist/module.esm.js';
import { SecurityManager } from './security.js'
import { ProjectionRenderer } from './renderer.js';
import { projections } from './projections.js';
import { loadImageFromUrl } from './image-loader.js';
import { triggerDownload, hexToRgbNormalized, generateAutoBasename, withImageExtension,
         serializeProjectionState, embedPngMetadata, embedJpegMetadata, embedWebpMetadata } from './export.js';

export class ProjectionApp {
    constructor() {
        this.canvas = document.getElementById('projectionCanvas');

        // Drag state
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;

        // Touch zoom state
        this.lastTouchDistance = 0;
        this.initialZoom = 1.0;

        this.setupCanvasInteraction();
        this.ready = this.init();
    }

    setupCanvasInteraction() {
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.render();
        }, { signal });

        // Mouse interaction
        this.canvas.addEventListener('mousedown', (e) => {
            this.startDrag(e.clientX, e.clientY);
            e.preventDefault();
        }, { signal });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.updateDrag(e.clientX, e.clientY);
            e.preventDefault();
        }, { signal });

        this.canvas.addEventListener('mouseup', () => {
            this.endDrag();
        }, { signal });

        this.canvas.addEventListener('mouseleave', () => {
            this.endDrag();
        }, { signal });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const store = Alpine.store('app');

            if (store.activeTool === 'pan') {
                // Pan/Zoom mode: scroll controls zoom
                const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
                store.setZoom(store.zoom * zoomFactor);
            } else {
                // Rotate mode: scroll drives the rotation slider
                const delta = e.deltaY > 0 ? 1 : -1;
                store.setRotation(store.rotation + delta);
            }
        }, { signal });

        // Touch interaction
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.startDrag(touch.clientX, touch.clientY);
            } else if (e.touches.length === 2) {
                this.endDrag();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                this.lastTouchDistance = this.getTouchDistance(touch1, touch2);
                this.initialZoom = Alpine.store('app').zoom;
            }
            e.preventDefault();
        }, { signal });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.isDragging) {
                const touch = e.touches[0];
                this.updateDrag(touch.clientX, touch.clientY);
            } else if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = this.getTouchDistance(touch1, touch2);

                if (this.lastTouchDistance > 0) {
                    const store = Alpine.store('app');

                    if (store.activeTool === 'pan') {
                        // Pan/Zoom mode: pinch controls zoom
                        const zoomFactor = this.lastTouchDistance / currentDistance;
                        store.setZoom(this.initialZoom * zoomFactor);
                    } else {
                        // Rotate mode: pinch drives rotation
                        const rotationDelta = (currentDistance - this.lastTouchDistance) * 0.2;
                        store.setRotation(store.rotation + rotationDelta);
                        this.lastTouchDistance = currentDistance;
                    }
                }
            }
            e.preventDefault();
        }, { signal });

        this.canvas.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                this.endDrag();
                this.lastTouchDistance = 0;
            } else if (e.touches.length === 1) {
                this.lastTouchDistance = 0;
                const touch = e.touches[0];
                this.startDrag(touch.clientX, touch.clientY);
            }
        }, { signal });

        this.canvas.addEventListener('touchcancel', () => {
            this.endDrag();
            this.lastTouchDistance = 0;
        }, { signal });

        this.canvas.style.cursor = 'grab';
    }

    startDrag(x, y) {
        this.isDragging = true;
        this.lastX = x;
        this.lastY = y;
        this.canvas.style.cursor = 'grabbing';
    }

    updateDrag(x, y) {
        const deltaX = x - this.lastX;
        const deltaY = y - this.lastY;
        const store = Alpine.store('app');

        if (store.activeTool === 'rotate') {
            // Rotate mode: drag changes oblique view (camera lat/lon)
            const sensitivity = 0.5 * Math.sqrt(store.zoom);
            store.setObliqueLat(store.obliqueLat + deltaY * sensitivity);
            store.setObliqueLon(store.obliqueLon + deltaX * sensitivity);
        } else {
            // Pan mode: drag pans the projection plane
            // X axis must account for aspect ratio since the shader scales x by aspect
            const canvasWidth = this.canvas.clientWidth;
            const canvasHeight = this.canvas.clientHeight;
            const aspect = (canvasWidth / canvasHeight) * store.aspectRatio;
            store.panX -= (deltaX / canvasWidth) * 2.0 * store.zoom * aspect;
            store.panY += (deltaY / canvasHeight) * 2.0 * store.zoom;
        }

        this.lastX = x;
        this.lastY = y;

        this.render();
    }

    endDrag() {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }

    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    async init() {
        try {
            this.renderer = new ProjectionRenderer();
            this.renderer.onPipelineReady = () => this.render();
            this.renderer.onPipelineError = (err, dst, src) => {
                console.error('Pipeline compile failed for', { dst, src }, err);
                const name = projections.find(p => p.id === dst)?.name ?? `projection #${dst}`;
                Alpine.store('app').showError(`Could not compile ${name}: ${err.message}`, true);
            };
            await this.renderer.initialize(this.canvas);
            const store = Alpine.store('app');
            this.resizeCanvas();
            await this.renderer.ensurePipeline(store.destinationProjection, store.sourceProjection);
            this.setupAlpineEffects();
            this.render();

            // Hide loading screen once initialization is complete
            store.isLoading = false;
        } catch (error) {
            // Hide loading screen on error
            Alpine.store('app').isLoading = false;

            let message = 'Failed to initialize WebGPU renderer: ';

            if (error.message.includes('adapter')) {
                message += 'Graphics adapter not found or incompatible.';
            } else if (error.message.includes('device')) {
                message += 'Could not create graphics device.';
            } else if (error.message.includes('context')) {
                message += 'Canvas context creation failed.';
            } else if (error.message.includes('pipeline')) {
                message += 'Shader compilation or pipeline creation failed.';
            } else if (error.message.includes('texture')) {
                message += 'Texture loading or creation failed.';
            } else {
                message += error.message;
            }

            message += '\n\nPlease ensure your device supports WebGPU and it is enabled in your browser settings.';

            Alpine.store('app').showError(message, true);
        }
    }

    setupAlpineEffects() {
        const store = Alpine.store('app');

        // React to projection changes and reset pan offsets
        let lastDst = store.destinationProjection;
        let lastSrc = store.sourceProjection;
        Alpine.effect(() => {
            const dst = store.destinationProjection;
            const src = store.sourceProjection;
            if (dst !== lastDst || src !== lastSrc) {
                lastDst = dst;
                lastSrc = src;
                // Reset pan outside this effect to avoid tracking panX/panY as dependencies
                queueMicrotask(() => {
                    store.panX = 0.0;
                    store.panY = 0.0;
                });
            }
            this.render();
        });

        // React to display toggle, slider, pan, and oblique view changes
        Alpine.effect(() => {
            // Read all reactive properties that should trigger a re-render
            void (store.tissot, store.graticule, store.graticuleWidth);
            void (store.zoom, store.aspectRatio, store.rotation);
            void (store.panX, store.panY);
            void (store.obliqueLat, store.obliqueLon);
            this.render();
        });
    }

    resizeCanvas() {
        const headerHeight = document.getElementById('app-header')?.offsetHeight || 0;
        const footerHeight = document.getElementById('app-footer')?.offsetHeight || 0;
        const width = window.innerWidth;
        const height = window.innerHeight - headerHeight - footerHeight;
        const dpr = window.devicePixelRatio || 1;

        // Scale backing store by device pixel ratio for sharp rendering
        this.canvas.width = Math.floor(width * dpr);
        this.canvas.height = Math.floor(height * dpr);

        // Keep CSS size in logical (CSS) pixels to match the viewport
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
    }

    async loadUserFile(file) {
        await this.ready;
        try {
            Alpine.store('app').isLoading = true;

            await this.renderer.loadCustomTexture(file);
            this.render();
            Alpine.store('app').showSuccess(`Loaded local file: ${file.name}`);

        } catch (error) {
            console.error('File loading failed:', error);
            Alpine.store('app').showError(`Failed to load file: ${error.message}`);
            const store = Alpine.store('app');
            store.currentFile = null;
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.value = '';
        } finally {
            Alpine.store('app').isLoading = false;
        }
    }

    async loadUserImage(imageUrl) {
        await this.ready;
        if (!imageUrl) {
            return this.loadDefaultImage();
        }
        if (!SecurityManager.validateImageURL(imageUrl)) {
            Alpine.store('app').showError('Invalid URL. Please use HTTPS URLs only.');
            return;
        }
        const store = Alpine.store('app');
        try {
            store.isLoading = true;
            const blob = await loadImageFromUrl(imageUrl);
            await this.renderer.loadCustomTexture(blob);
            this.render();
            store.showSuccess('Image loaded successfully!');
        } catch (error) {
            store.showError(`Failed to load image: ${error.message}. Try a different URL or use a CORS-enabled image.`);
        } finally {
            store.isLoading = false;
        }
    }

    async loadDefaultImage() {
        const store = Alpine.store('app');
        try {
            await this.renderer.loadDefaultTexture(false);
            // Default world map is plate-carrée; sync the store so the UI matches what we render
            store.sourceProjection = 0;
            this.render();
            store.showSuccess('Loaded default image');
        } catch (error) {
            store.showError(`Failed to load default image: ${error.message}`);
        }
    }

    render() {
        if (!this.renderer) return;

        const store = Alpine.store('app');
        const dst = store.destinationProjection;
        const src = store.sourceProjection;
        const cameraLat = store.obliqueLat * Math.PI / 180;
        const cameraLon = store.obliqueLon * Math.PI / 180;
        const zoom = store.zoom;
        const showTissot = store.tissot ? 1.0 : 0.0;
        const showGraticule = store.graticule ? 1.0 : 0.0;
        const aspectRatioMultiplier = store.aspectRatio;
        const rotation = store.rotation * Math.PI / 180;
        const panX = store.panX;
        const panY = store.panY;
        const graticuleWidth = store.graticuleWidth;

        this.renderer.render(dst, src, cameraLat, cameraLon, zoom, showTissot, showGraticule, aspectRatioMultiplier, rotation, panX, panY, graticuleWidth);
    }

    async exportImage() {
        await this.ready;
        const store = Alpine.store('app');
        if (store.exportInProgress) return;
        store.exportInProgress = true;
        const [bgR, bgG, bgB] = hexToRgbNormalized(store.exportBackgroundColor);
        const bgA = store.exportTransparent ? 0.0 : 1.0;
        try {
            let blob = await this.renderer.exportToBlob({
                dst: store.destinationProjection,
                src: store.sourceProjection,
                width: store.exportWidth,
                height: store.exportHeight,
                cameraLat: store.obliqueLat * Math.PI / 180,
                cameraLon: store.obliqueLon * Math.PI / 180,
                zoom: store.zoom,
                showTissot: store.tissot ? 1.0 : 0.0,
                showGraticule: store.graticule ? 1.0 : 0.0,
                aspectRatioMultiplier: store.aspectRatio,
                rotation: store.rotation * Math.PI / 180,
                panX: store.panX,
                panY: store.panY,
                graticuleWidth: store.graticuleWidth,
                backgroundColor: [bgR, bgG, bgB, bgA],
                format: store.exportFormat,
                quality: store.exportQuality / 100,
            });
            const payload = serializeProjectionState(store, projections);
            if (store.exportFormat === 'png') {
                blob = await embedPngMetadata(blob, payload);
            } else if (store.exportFormat === 'jpeg') {
                blob = await embedJpegMetadata(blob, payload);
            } else if (store.exportFormat === 'webp') {
                blob = await embedWebpMetadata(blob, payload);
            }
            const ext = store.exportFormat === 'jpeg' ? 'jpg' : store.exportFormat;
            const basename = store.exportFilename.trim() || generateAutoBasename(store, projections);
            const filename = withImageExtension(basename, ext);
            triggerDownload(blob, filename);
            store.showSuccess(`Exported ${filename}`);
        } catch (error) {
            console.error('Export failed:', error);
            store.showError(`Export failed: ${error.message}`);
        } finally {
            store.exportInProgress = false;
            // Restore viewport uniforms (export overwrote them)
            this.render();
        }
    }
}