export class InteractionManager extends EventTarget {
    constructor(canvas) {
        super();
        
        this.canvas = canvas;
        
        // DOM control elements
        this.projectionSelect = document.getElementById('projectionSelect');
        this.imageUrlInput = document.getElementById('imageUrl');
        this.sourceProjectionSelect = document.getElementById('sourceProjection');
        this.loadImageButton = document.getElementById('loadImageButton');
        this.tissotToggle = document.getElementById('tissotToggle');
        this.graticuleToggle = document.getElementById('graticuleToggle');
        this.controlsOverlay = document.getElementById('controlsOverlay');
        this.controlsContent = document.getElementById('controlsContent');
        this.toggleControls = document.getElementById('toggleControls');
        this.fullscreenButton = document.getElementById('fullscreenButton');
        this.zoomIndicator = document.getElementById('zoomIndicator');
        
        // Camera state
        this.cameraLat = 90; // degrees
        this.cameraLon = 0;  // degrees
        this.zoom = 1.0;
        
        // Interaction state
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.controlsVisible = true;
        this.isFullscreen = false;
        this.zoomIndicatorTimeout = null;
        
        // Touch zoom state
        this.lastTouchDistance = 0;
        this.initialZoom = this.zoom;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Control event listeners
        this.projectionSelect.addEventListener('change', () => {
            this.dispatchEvent(new CustomEvent('destinationProjectionChanged', {
                detail: { projectionType: parseInt(this.projectionSelect.value) }
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
            const sourceProjection = parseInt(this.sourceProjectionSelect.value);
            this.dispatchEvent(new CustomEvent('imageLoaded', {
                detail: { imageUrl, sourceProjection }
            }));
        });

        this.imageUrlInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const imageUrl = this.imageUrlInput.value.trim();
                const sourceProjection = parseInt(this.sourceProjectionSelect.value);
                this.dispatchEvent(new CustomEvent('imageLoaded', {
                    detail: { imageUrl, sourceProjection }
                }));
            }
        });

        this.sourceProjectionSelect.addEventListener('change', () => {
            this.dispatchEvent(new CustomEvent('sourceProjectionChanged', {
                detail: { sourceProjection: parseInt(this.sourceProjectionSelect.value) }
            }));
        });

        // Controls visibility toggle
        this.toggleControls.addEventListener('click', () => {
            this.toggleControlsVisibility();
        });

        // Fullscreen toggle
        this.fullscreenButton.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Fullscreen change events
        document.addEventListener('fullscreenchange', () => {
            this.handleFullscreenChange();
        });
        
        // Add webkit prefix support for Safari
        document.addEventListener('webkitfullscreenchange', () => {
            this.handleFullscreenChange();
        });
        
        // Handle canvas resize
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

        // Mouse wheel zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
            this.zoom = Math.max(0.01, Math.min(10, this.zoom * zoomFactor));
            this.showZoomIndicator();
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
                // Start pinch zoom
                this.endDrag(); // End any dragging
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
                // Handle pinch zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = this.getTouchDistance(touch1, touch2);
                
                if (this.lastTouchDistance > 0) {
                    const zoomFactor = this.lastTouchDistance / currentDistance;
                    this.zoom = Math.max(0.01, Math.min(10, this.initialZoom * zoomFactor));
                    this.showZoomIndicator();
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
                // Switch from pinch to drag if one finger remains
                this.lastTouchDistance = 0;
                const touch = e.touches[0];
                this.startDrag(touch.clientX, touch.clientY);
            }
        });

        this.canvas.addEventListener('touchcancel', () => {
            this.endDrag();
            this.lastTouchDistance = 0;
        });
        
        // Set initial cursor
        this.canvas.style.cursor = 'grab';

        // Hide controls after inactivity on mobile
        let hideTimeout;
        const resetHideTimeout = () => {
            clearTimeout(hideTimeout);
            if (window.innerWidth <= 768) {
                hideTimeout = setTimeout(() => {
                    if (this.controlsVisible) {
                        this.controlsOverlay.classList.add('controls-collapsed');
                    }
                }, 3000);
            }
        };

        this.canvas.addEventListener('touchstart', resetHideTimeout);
        this.canvas.addEventListener('touchmove', resetHideTimeout);
        this.controlsOverlay.addEventListener('touchstart', () => {
            clearTimeout(hideTimeout);
            this.controlsOverlay.classList.remove('controls-collapsed');
        });
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
        
        // Base sensitivity (degrees per pixel)
        let baseSensitivity = 0.5;
        
        // Scale sensitivity based on zoom level for all projections
        // Adjust sensitivity using the square root of zoom: higher zoom (> 1) increases sensitivity,
        // while zoom values between 0 and 1 decrease it, smoothing interaction across the slider range.
        let sensitivity = baseSensitivity * Math.sqrt(zoom);
        
        // Calculate new camera position
        let newLon = this.cameraLon + (deltaX * sensitivity);
        let newLat = this.cameraLat + (deltaY * sensitivity);
        
        // Clamp values to valid ranges
        newLat = Math.max(-90, Math.min(90, newLat));
        newLon = ((newLon % 360) + 360) % 360; // Wrap longitude to 0-360
        if (newLon > 180) newLon -= 360; // Convert to -180 to 180 range
        
        // Update internal state
        this.cameraLat = newLat;
        this.cameraLon = newLon;
        
        // Dispatch look at change event
        this.dispatchEvent(new CustomEvent('lookAtChanged', {
            detail: { lat: this.cameraLat, lon: this.cameraLon }
        }));
    }

    showZoomIndicator() {
        this.zoomIndicator.textContent = `${this.zoom.toFixed(1)}x`;
        this.zoomIndicator.classList.add('visible');
        
        clearTimeout(this.zoomIndicatorTimeout);
        this.zoomIndicatorTimeout = setTimeout(() => {
            this.zoomIndicator.classList.remove('visible');
        }, 2000);
    }

    toggleControlsVisibility() {
        this.controlsVisible = !this.controlsVisible;
        
        if (this.controlsVisible) {
            this.controlsContent.style.display = 'grid';
            this.toggleControls.textContent = 'Hide';
            this.controlsOverlay.classList.remove('controls-collapsed');
        } else {
            this.controlsContent.style.display = 'none';
            this.toggleControls.textContent = 'Show';
        }
    }

    async toggleFullscreen() {
        try {
            if (!this.isFullscreen) {
                // Try standard API first
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                } 
                // Try webkit prefixed API for Safari
                else if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen();
                }
                // Try mobile Safari specific approach
                else if (document.documentElement.webkitEnterFullscreen) {
                    document.documentElement.webkitEnterFullscreen();
                }
                else {
                    throw new Error('Fullscreen not supported');
                }
            } else {
                // Try standard exit
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                }
                // Try webkit prefixed exit
                else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
                else if (document.webkitCancelFullScreen) {
                    document.webkitCancelFullScreen();
                }
                else {
                    throw new Error('Exit fullscreen not supported');
                }
            }
        } catch (error) {
            console.warn('Fullscreen operation failed:', error);
            // For Safari mobile that doesn't support true fullscreen,
            // try to at least hide the address bar by scrolling
            if (/iPhone|iPad|iPod|Safari/.test(navigator.userAgent)) {
                window.scrollTo(0, 1);
            }
        }
    }

    handleFullscreenChange() {
        this.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
        this.fullscreenButton.textContent = this.isFullscreen ? '⤫' : '⛶';
        this.fullscreenButton.title = this.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';
    }

    // Getters for current state
    get currentZoom() {
        return this.zoom;
    }

    get currentLookAt() {
        return { lat: this.cameraLat, lon: this.cameraLon };
    }

    get destinationProjection() {
        return parseInt(this.projectionSelect.value);
    }

    get sourceProjection() {
        return parseInt(this.sourceProjectionSelect.value);
    }

    get tissotEnabled() {
        return this.tissotToggle.checked;
    }

    get graticuleEnabled() {
        return this.graticuleToggle.checked;
    }

    // Methods to update UI state
    setLoadingState(isLoading) {
        this.loadImageButton.textContent = isLoading ? 'Loading...' : 'Load Image';
        this.loadImageButton.disabled = isLoading;
    }
}