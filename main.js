import { ProjectionRenderer } from './renderer.js';

class ProjectionApp {
    constructor() {
        this.renderer = null;
        this.projectionSelect = document.getElementById('projectionSelect');

        // Internal camera state (no longer controlled by sliders)
        this.cameraLat = 45; // degrees
        this.cameraLon = 0;  // degrees
        this.zoom = 2.0; // Direct zoom value instead of slider
        this.tissotToggle = document.getElementById('tissotToggle');
        this.graticuleToggle = document.getElementById('graticuleToggle');
        this.canvas = document.getElementById('projectionCanvas');
        this.errorDiv = document.getElementById('errorDiv');
        this.controlsOverlay = document.getElementById('controlsOverlay');
        this.controlsContent = document.getElementById('controlsContent');
        this.toggleControls = document.getElementById('toggleControls');
        this.fullscreenButton = document.getElementById('fullscreenButton');
        this.zoomIndicator = document.getElementById('zoomIndicator');
        
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
        this.init();
    }
    
    setupEventListeners() {
        // Control event listeners
        this.projectionSelect.addEventListener('change', () => {
            this.render();
        });
        
        this.tissotToggle.addEventListener('change', () => {
            this.render();
        });
        
        this.graticuleToggle.addEventListener('change', () => {
            this.render();
        });

        // Controls visibility toggle
        this.toggleControls.addEventListener('click', () => {
            this.toggleControlsVisibility();
        });

        // Fullscreen toggle
        this.fullscreenButton.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Fullscreen change event
        document.addEventListener('fullscreenchange', () => {
            this.handleFullscreenChange();
        });
        
        // Add webkit prefix support for Safari
        document.addEventListener('webkitfullscreenchange', () => {
            this.handleFullscreenChange();
        });
        
        // Handle canvas resize
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

        // Mouse wheel zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
            this.zoom = Math.max(0.01, Math.min(10, this.zoom * zoomFactor));
            this.showZoomIndicator();
            this.render();
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
                    this.render();
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

    handleFullscreenChange() {
        this.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
        this.fullscreenButton.textContent = this.isFullscreen ? '⤫' : '⛶';
        this.fullscreenButton.title = this.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';
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
    
    async init() {
        try {
            this.renderer = new ProjectionRenderer();
            await this.renderer.initialize(this.canvas);
            this.resizeCanvas();
            this.render();
        } catch (error) {
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
            
            this.showError(message, true); // Persistent error for WebGPU initialization failure
        }
    }
    
    resizeCanvas() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        
        // Scale backing store by device pixel ratio for sharp rendering
        this.canvas.width = Math.floor(width * dpr);
        this.canvas.height = Math.floor(height * dpr);
        
        // Keep CSS size in logical (CSS) pixels to match the viewport
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        
        if (this.renderer) {
            this.renderer.resize(width, height);
        }
    }
    
    render() {
        if (!this.renderer) return;
        
        const projectionType = parseInt(this.projectionSelect.value);

        const cameraLat = this.cameraLat * Math.PI / 180;
        const cameraLon = this.cameraLon * Math.PI / 180;
        const zoom = this.zoom;
        const showTissot = this.tissotToggle.checked ? 1.0 : 0.0;
        const showGraticule = this.graticuleToggle.checked ? 1.0 : 0.0;
        
        this.renderer.render(projectionType, cameraLat, cameraLon, zoom, showTissot, showGraticule);
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
        
        // Re-render
        this.render();
    }
    
    showError(message, persistent = false) {
        this.errorDiv.textContent = message;
        this.errorDiv.style.display = 'block';
        
        // For persistent errors (like WebGPU not supported), don't auto-hide
        if (!persistent) {
            setTimeout(() => {
                this.errorDiv.style.display = 'none';
            }, 8000); // Longer timeout for detailed messages
        }
    }
}

// Enhanced WebGPU support detection
async function checkWebGPUSupport() {
    const errorDiv = document.getElementById('errorDiv');
    
    // Check if WebGPU is available at all
    if (!navigator.gpu) {
        errorDiv.textContent = 'WebGPU is not supported in this browser. Try Chrome 113+, Edge 113+, or Safari 18+ with WebGPU enabled.';
        errorDiv.style.display = 'block';
        return false;
    }
    
    try {
        // Try to get an adapter
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            errorDiv.textContent = 'WebGPU adapter not found. This may indicate hardware compatibility issues or that WebGPU is disabled.';
            errorDiv.style.display = 'block';
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
        
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        return false;
    }
}

// Initialize app only if WebGPU is supported
checkWebGPUSupport().then(supported => {
    if (supported) {
        new ProjectionApp();
    }
});