import { SecurityManager } from './security.js';
import { projections } from './projections.js';

export class InteractionManager extends EventTarget {
    constructor(canvas) {
        super();

        this.canvas = canvas;

        // DOM control elements
        this.imageUrlInput = document.getElementById('imageUrl');
        this.loadImageButton = document.getElementById('loadImageButton');
        this.fileInput = document.getElementById('fileInput');
        this.tissotToggle = document.getElementById('tissotToggle');
        this.graticuleToggle = document.getElementById('graticuleToggle');
        this.aspectRatioSlider = document.getElementById('aspectRatioSlider');
        this.aspectRatioValue = document.getElementById('aspectRatioValue');
        this.fullscreenToggle = document.getElementById('fullscreenToggle');
        this.zoomSlider = document.getElementById('zoomSlider');
        this.zoomValueLabel = document.getElementById('zoomValue');

        // Sidebar elements
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebarToggle');
        this.sidebarSideToggle = document.getElementById('sidebarSideToggle');
        this.loadingBackdrop = document.getElementById('loadingBackdrop');
        this.destinationSelect = document.getElementById('destinationProjection');
        this.sourceSelect = document.getElementById('sourceProjection');

        this.currentShownProjection = 0;
        this.currentSourceProjection = 0;

        // Camera state
        this.cameraLat = 90;
        this.cameraLon = 0;
        this.zoom = 1.0;
        this.aspectRatioScalar = 1.0;

        // Interaction state
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.isFullscreen = false;
        this.currentFile = null;

        // Touch zoom state
        this.lastTouchDistance = 0;
        this.initialZoom = this.zoom;

        this.setupEventListeners();
        this.populateProjectionSelect(this.destinationSelect);
        this.populateProjectionSelect(this.sourceSelect);
    }

    setupEventListeners() {
        // Sidebar toggle
        this.sidebarToggle.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Sidebar side toggle
        this.sidebarSideToggle.addEventListener('click', () => {
            this.toggleSidebarSide();
        });

        // Projection selects
        this.destinationSelect.addEventListener('change', () => {
            this.currentShownProjection = parseInt(this.destinationSelect.value);
            this.dispatchEvent(new CustomEvent('destinationProjectionChanged', {
                detail: { projectionType: this.currentShownProjection }
            }));
        });

        this.sourceSelect.addEventListener('change', () => {
            this.currentSourceProjection = parseInt(this.sourceSelect.value);
            this.dispatchEvent(new CustomEvent('sourceProjectionChanged', {
                detail: { sourceProjection: this.currentSourceProjection }
            }));
        });

        this.tissotToggle.addEventListener('change', () => {
            this.dispatchEvent(new CustomEvent('tissotToggled', {
                detail: { enabled: this.tissotToggle.checked }
            }));
        });

        this.graticuleToggle.addEventListener('change', () => {
            this.dispatchEvent(new CustomEvent('graticuleToggled', {
                detail: { enabled: this.graticuleToggle.checked }
            }));
        });

        this.loadImageButton.addEventListener('click', () => {
            const imageUrl = this.imageUrlInput.value.trim();
            const sourceProjection = this.currentSourceProjection;

            if (this.currentFile && imageUrl === this.currentFile.name) {
                this.dispatchEvent(new CustomEvent('imageLoaded', {
                    detail: {
                        file: this.currentFile,
                        imageUrl: null,
                        sourceProjection
                    }
                }));
            } else {
                this.dispatchEvent(new CustomEvent('imageLoaded', {
                    detail: { imageUrl, sourceProjection }
                }));
            }
        });

        this.imageUrlInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const imageUrl = this.imageUrlInput.value.trim();
                const sourceProjection = this.currentSourceProjection;

                if (this.currentFile && imageUrl === this.currentFile.name) {
                    this.dispatchEvent(new CustomEvent('imageLoaded', {
                        detail: {
                            file: this.currentFile,
                            imageUrl: null,
                            sourceProjection
                        }
                    }));
                } else {
                    this.dispatchEvent(new CustomEvent('imageLoaded', {
                        detail: { imageUrl, sourceProjection }
                    }));
                }
            }
        });

        this.imageUrlInput.addEventListener('input', (e) => {
            const currentValue = e.target.value.trim();
            if (this.currentFile && currentValue !== this.currentFile.name) {
                this.currentFile = null;
                if (this.fileInput) {
                    this.fileInput.value = '';
                }
            }
        });

        // File input change
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelection(e.target.files[0]);
            }
        });

        this.aspectRatioSlider.addEventListener('input', () => {
            this.aspectRatioScalar = parseFloat(this.aspectRatioSlider.value);
            this.aspectRatioValue.textContent = `${this.aspectRatioScalar.toFixed(2)}x`;
            this.dispatchEvent(new CustomEvent('aspectRatioChanged', {
                detail: { aspectRatioMultiplier: this.aspectRatioScalar }
            }));
        });

        this.zoomSlider.addEventListener('input', () => {
            this.zoom = Math.pow(10, parseFloat(this.zoomSlider.value));
            this.updateZoomDisplay();
            this.dispatchEvent(new CustomEvent('zoomChanged', {
                detail: { zoom: this.zoom }
            }));
        });

        // Fullscreen toggle
        this.fullscreenToggle.addEventListener('change', () => {
            this.toggleFullscreen();
        });

        document.addEventListener('fullscreenchange', () => {
            this.handleFullscreenChange();
        });

        document.addEventListener('webkitfullscreenchange', () => {
            this.handleFullscreenChange();
        });

        window.addEventListener('resize', () => {
            this.dispatchEvent(new CustomEvent('canvasResize'));
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
            const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
            this.zoom = Math.max(0.01, Math.min(10, this.zoom * zoomFactor));
            this.syncZoomSlider();
            this.dispatchEvent(new CustomEvent('zoomChanged', {
                detail: { zoom: this.zoom }
            }));
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
                this.initialZoom = this.zoom;
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
                    const zoomFactor = this.lastTouchDistance / currentDistance;
                    this.zoom = Math.max(0.01, Math.min(10, this.initialZoom * zoomFactor));
                    this.syncZoomSlider();
                    this.dispatchEvent(new CustomEvent('zoomChanged', {
                        detail: { zoom: this.zoom }
                    }));
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

    // Sidebar management
    toggleSidebar() {
        this.sidebar.classList.toggle('collapsed');
    }

    toggleSidebarSide() {
        this.sidebar.classList.toggle('right');
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

        this.updateCameraFromDrag(deltaX, deltaY);

        this.lastX = x;
        this.lastY = y;
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

    updateCameraFromDrag(deltaX, deltaY) {
        const zoom = this.zoom;
        let baseSensitivity = 0.5;
        let sensitivity = baseSensitivity * Math.sqrt(zoom);

        let newLon = this.cameraLon + (deltaX * sensitivity);
        let newLat = this.cameraLat + (deltaY * sensitivity);

        newLat = Math.max(-90, Math.min(90, newLat));
        newLon = ((newLon % 360) + 360) % 360;
        if (newLon > 180) newLon -= 360;

        this.cameraLat = newLat;
        this.cameraLon = newLon;

        this.dispatchEvent(new CustomEvent('lookAtChanged', {
            detail: { lat: this.cameraLat, lon: this.cameraLon }
        }));
    }

    syncZoomSlider() {
        this.zoomSlider.value = Math.log10(this.zoom);
        this.updateZoomDisplay();
    }

    updateZoomDisplay() {
        this.zoomValueLabel.textContent = `${this.zoom.toFixed(2)}x`;
    }

    async toggleFullscreen() {
        try {
            if (!this.isFullscreen) {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                } else if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen();
                } else if (document.documentElement.webkitEnterFullscreen) {
                    document.documentElement.webkitEnterFullscreen();
                } else {
                    throw new Error('Fullscreen not supported');
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.webkitCancelFullScreen) {
                    document.webkitCancelFullScreen();
                } else {
                    throw new Error('Exit fullscreen not supported');
                }
            }
        } catch (error) {
            console.warn('Fullscreen operation failed:', error);
            if (/iPhone|iPad|iPod|Safari/.test(navigator.userAgent)) {
                window.scrollTo(0, 1);
            }
        } finally {
            this.handleFullscreenChange();
        }
    }

    handleFullscreenChange() {
        this.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
        this.fullscreenToggle.checked = this.isFullscreen;
    }

    get currentZoom() {
        return this.zoom;
    }

    get currentLookAt() {
        return { lat: this.cameraLat, lon: this.cameraLon };
    }

    get destinationProjection() {
        return this.currentShownProjection;
    }

    get sourceProjection() {
        return this.currentSourceProjection;
    }

    get tissotEnabled() {
        return this.tissotToggle.checked;
    }

    get graticuleEnabled() {
        return this.graticuleToggle.checked;
    }

    get aspectRatioMultiplier() {
        return this.aspectRatioScalar;
    }

    setLoadingState(isLoading) {
        this.loadImageButton.value = isLoading ? 'Loading...' : 'Load';
        this.loadImageButton.disabled = isLoading;

        if (isLoading) {
            this.loadingBackdrop.classList.add('open');
        } else {
            this.loadingBackdrop.classList.remove('open');
        }
    }

    populateProjectionSelect(selectElement) {
        projections.forEach(projection => {
            const option = document.createElement('option');
            option.value = projection.id;
            option.textContent = projection.name;
            selectElement.appendChild(option);
        });
    }

    handleFileSelection(file) {
        if (!SecurityManager.validateImageFile(file)) {
            this.showFileError('Invalid file. Please select a valid image file (JPEG, PNG, GIF, WebP, BMP) under 50MB.');
            return;
        }

        this.currentFile = file;
        this.imageUrlInput.value = file.name;

        this.dispatchEvent(new CustomEvent('imageLoaded', {
            detail: {
                file: file,
                imageUrl: null,
                sourceProjection: this.currentSourceProjection
            }
        }));
    }

    showFileError(message) {
        this.currentFile = null;
        this.dispatchEvent(new CustomEvent('fileError', {
            detail: { message }
        }));
    }

    resetDragDropDisplay() {
        this.currentFile = null;
        if (this.fileInput) {
            this.fileInput.value = '';
        }
    }
}
