import Alpine from 'https://cdn.jsdelivr.net/npm/@alpinejs/csp@3/dist/module.esm.js';
import { SecurityManager } from './security.js'
import { ProjectionRenderer } from './renderer.js';

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
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.render();
        });

        // Mouse interaction
        this.canvas.addEventListener('mousedown', (e) => {
            this.startDrag(e.clientX, e.clientY);
            e.preventDefault();
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.updateDrag(e.clientX, e.clientY);
            e.preventDefault();
        });

        this.canvas.addEventListener('mouseup', () => {
            this.endDrag();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.endDrag();
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const store = Alpine.store('app');

            if (store.activeTool === 'pan') {
                // Pan/Zoom mode: scroll controls zoom
                const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
                store.zoom = Math.max(0.01, Math.min(10, store.zoom * zoomFactor));
                store.zoomSlider = Math.log10(store.zoom);
            } else {
                // Rotate mode: scroll drives the rotation slider (with wrap-around)
                const delta = e.deltaY > 0 ? 1 : -1;
                let newRotation = store.rotation + delta;
                if (newRotation > 180) newRotation -= 360;
                if (newRotation < -180) newRotation += 360;
                store.rotation = newRotation;
            }
        });

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
        });

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
                        store.zoom = Math.max(0.01, Math.min(10, this.initialZoom * zoomFactor));
                        store.zoomSlider = Math.log10(store.zoom);
                    } else {
                        // Rotate mode: pinch drives rotation (with wrap-around)
                        const rotationDelta = (currentDistance - this.lastTouchDistance) * 0.2;
                        let newRotation = store.rotation + rotationDelta;
                        newRotation = ((newRotation + 180) % 360 + 360) % 360 - 180;
                        store.rotation = newRotation;
                        this.lastTouchDistance = currentDistance;
                    }
                }
            }
            e.preventDefault();
        });

        this.canvas.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                this.endDrag();
                this.lastTouchDistance = 0;
            } else if (e.touches.length === 1) {
                this.lastTouchDistance = 0;
                const touch = e.touches[0];
                this.startDrag(touch.clientX, touch.clientY);
            }
        });

        this.canvas.addEventListener('touchcancel', () => {
            this.endDrag();
            this.lastTouchDistance = 0;
        });

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

            let newLon = store.obliqueLon + (deltaX * sensitivity);
            let newLat = store.obliqueLat + (deltaY * sensitivity);

            newLat = Math.max(-90, Math.min(90, newLat));
            newLon = ((newLon % 360) + 360) % 360;
            if (newLon > 180) newLon -= 360;

            store.obliqueLat = newLat;
            store.obliqueLon = newLon;
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
            await this.renderer.initialize(this.canvas);
            this.setupAlpineEffects();
            this.resizeCanvas();
            this.render();

            // Hide loading screen once initialization is complete
            Alpine.store('app').isLoading = false;
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

        // React to projection changes (and reset pan offsets)
        let lastDst = store.destinationProjection;
        let lastSrc = store.sourceProjection;
        Alpine.effect(() => {
            const dst = store.destinationProjection;
            const src = store.sourceProjection;
            this.renderer.setDestinationProjection(dst);
            this.renderer.setSourceProjection(src);
            // Reset pan only when projection actually changes
            if (dst !== lastDst || src !== lastSrc) {
                lastDst = dst;
                lastSrc = src;
                store.panX = 0.0;
                store.panY = 0.0;
            }
            this.render();
        });

        // React to toggle changes
        Alpine.effect(() => {
            store.tissot;
            store.graticule;
            this.render();
        });

        // React to slider changes
        Alpine.effect(() => {
            store.zoom;
            store.aspectRatio;
            store.rotation;
            this.render();
        });

        // React to pan changes
        Alpine.effect(() => {
            store.panX;
            store.panY;
            this.render();
        });

        // React to oblique view changes (from sliders)
        Alpine.effect(() => {
            store.obliqueLat;
            store.obliqueLon;
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

    async loadUserFile(file, sourceProjection) {
        await this.ready;
        try {
            Alpine.store('app').isLoading = true;

            await this.renderer.loadCustomTexture(file);
            this.renderer.setSourceProjection(sourceProjection);
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

    async loadUserImage(imageUrl, sourceProjection) {
        await this.ready;
        if (!imageUrl) {
            try {
                await this.renderer.loadDefaultTexture(false);
                this.renderer.setSourceProjection(0);
                this.render();
                Alpine.store('app').showSuccess('Loaded default image');
            } catch (error) {
                Alpine.store('app').showError(`Failed to load default image: ${error.message}`);
            }
            return;
        }

        if (!SecurityManager.validateImageURL(imageUrl)) {
            Alpine.store('app').showError('Invalid URL. Please use HTTPS URLs only.');
            return;
        }

        try {
            Alpine.store('app').isLoading = true;
            await this.loadImageDirect(imageUrl, sourceProjection);
        } catch (directError) {
            console.log('Direct loading failed, trying proxy:', directError.message);
            try {
                await this.loadImageWithProxy(imageUrl, sourceProjection);
            } catch (proxyError) {
                console.error('Both direct and proxy loading failed:', proxyError);
                Alpine.store('app').showError(`Failed to load image. Direct: ${directError.message}. Proxy: ${proxyError.message}. Try a different URL or use a CORS-enabled image.`);
            }
        } finally {
            Alpine.store('app').isLoading = false;
        }
    }

    async loadImageDirect(imageUrl, sourceProjection) {
        console.log('Attempting direct load of:', imageUrl);
        const img = new Image();
        img.crossOrigin = 'anonymous';

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Image loading timed out'));
            }, 30000);

            img.onload = async () => {
                clearTimeout(timer);
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;

                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob(async (blob) => {
                        try {
                            await this.renderer.loadCustomTexture(blob);
                            this.renderer.setSourceProjection(sourceProjection);
                            this.render();
                            Alpine.store('app').showSuccess('Image loaded successfully!');
                            resolve();
                        } catch (error) {
                            reject(new Error(`Failed to process image: ${error.message}`));
                        }
                    }, 'image/png');
                } catch (error) {
                    reject(new Error(`Failed to draw image to canvas: ${error.message}`));
                }
            };

            img.onerror = () => {
                clearTimeout(timer);
                reject(new Error('Failed to load image - check URL or CORS policy'));
            };

            img.src = imageUrl;
        });
    }

    async loadImageWithProxy(imageUrl, sourceProjection) {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(imageUrl)}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Proxy fetch failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.contents) {
            throw new Error('No image data received from proxy');
        }

        try {
            const binaryString = atob(data.contents);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'image/jpeg' });

            await this.renderer.loadCustomTexture(blob);
            this.renderer.setSourceProjection(sourceProjection);
            this.render();
            Alpine.store('app').showSuccess('Image loaded via proxy successfully!');
        } catch (error) {
            throw new Error(`Failed to process proxy data: ${error.message}`);
        }
    }

    render() {
        if (!this.renderer) return;

        const store = Alpine.store('app');
        const cameraLat = store.obliqueLat * Math.PI / 180;
        const cameraLon = store.obliqueLon * Math.PI / 180;
        const zoom = store.zoom;
        const showTissot = store.tissot ? 1.0 : 0.0;
        const showGraticule = store.graticule ? 1.0 : 0.0;
        const aspectRatioMultiplier = store.aspectRatio;
        const rotation = store.rotation * Math.PI / 180;
        const panX = store.panX;
        const panY = store.panY;

        this.renderer.render(cameraLat, cameraLon, zoom, showTissot, showGraticule, aspectRatioMultiplier, rotation, panX, panY);
    }
}