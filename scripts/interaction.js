import { SecurityManager } from './security.js';

export class InteractionManager extends EventTarget {
    constructor(canvas) {
        super();
        
        this.canvas = canvas;
        
        // DOM control elements
        this.imageUrlInput = document.getElementById('imageUrl');
        this.loadImageButton = document.getElementById('loadImageButton');
        this.dragDropArea = document.getElementById('dragDropArea');
        this.fileInput = document.getElementById('fileInput');
        this.tissotToggle = document.getElementById('tissotToggle');
        this.graticuleToggle = document.getElementById('graticuleToggle');
        this.aspectRatioSlider = document.getElementById('aspectRatioSlider');
        this.aspectRatioValue = document.getElementById('aspectRatioValue');
        this.controlsOverlay = document.getElementById('controlsOverlay');
        this.controlsContent = document.getElementById('controlsContent');
        this.toggleControls = document.getElementById('toggleControls');
        this.fullscreenButton = document.getElementById('fullscreenButton');
        this.zoomIndicator = document.getElementById('zoomIndicator');
        
        // Projection and option buttons and panels
        this.projectionButton = document.getElementById('projectionButton');
        this.sourceButton = document.getElementById('sourceButton');
        this.optionsButton = document.getElementById('optionsButton');
        this.projectionPanel = document.getElementById('projectionPanel');
        this.sourcePanel = document.getElementById('sourcePanel');
        this.optionsPanel = document.getElementById('optionsPanel');
        this.projectionPanelClose = document.getElementById('projectionPanelClose');
        this.sourcePanelClose = document.getElementById('sourcePanelClose');
        this.optionsPanelClose = document.getElementById('optionsPanelClose');
        this.panelBackdrop = document.getElementById('panelBackdrop');
        this.loadingBackdrop = document.getElementById('loadingBackdrop');
        this.projectionGrid = document.getElementById('projectionGrid');
        this.sourceGrid = document.getElementById('sourceGrid');
        this.projectionPreview = document.getElementById('projectionPreview');
        this.sourcePreview = document.getElementById('sourcePreview');
        
        // Projection data
        this.projections = [
            { id: 0, name: 'Plate Carrée (Equirectangular)', description: 'Simple rectangular projection', emoji: '🗺️' },
            { id: 1, name: 'Mercator', description: 'Preserves angles, distorts area', emoji: '🧭' },
            { id: 2, name: 'Orthographic', description: 'Earth as seen from space', emoji: '🌍' },
            { id: 3, name: 'Vertical Perspective', description: 'Perspective from altitude', emoji: '🛰️' },
            { id: 4, name: 'Azimuthal Equidistant', description: 'Preserves distance from center', emoji: '📡' },
            { id: 5, name: 'Stereographic', description: 'Conformal azimuthal projection', emoji: '⭕' },
            { id: 6, name: 'Sinusoidal', description: 'Equal-area pseudocylindrical', emoji: '〰️' },
            { id: 7, name: 'Lambert Azimuthal Equal-Area', description: 'Preserves area', emoji: '🎯' },
            { id: 8, name: 'Gnomonic', description: 'Great circles as straight lines', emoji: '📐' },
            { id: 9, name: 'Mollweide', description: 'Equal-area elliptical projection', emoji: '🥚' }
        ];
        
        this.currentShownProjection = 0; // Index of the projection the user has selected to transform the image into
        this.currentSourceProjection = 0; // Index of the projection the user's source image is transformed from
        
        // Camera state
        this.cameraLat = 90; // degrees
        this.cameraLon = 0;  // degrees
        this.zoom = 1.0;
        this.aspectRatioScalar = 1.0;
        
        // Interaction state
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.controlsVisible = true;
        this.isFullscreen = false;
        this.zoomIndicatorTimeout = null;
        this.activePanelId = null;
        this.currentFile = null; // Currently selected local file
        
        // Touch zoom state
        this.lastTouchDistance = 0;
        this.initialZoom = this.zoom;
        
        this.setupEventListeners();
        this.populateProjectionGrid('destination');
        this.populateProjectionGrid('source');
    }
    
    setupEventListeners() {
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
            
            // Check if input matches current file name
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
                
                // Check if input matches current file name
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

        // Clear file reference when URL input changes
        this.imageUrlInput.addEventListener('input', (e) => {
            const currentValue = e.target.value.trim();
            if (this.currentFile && currentValue !== this.currentFile.name) {
                // User is typing something different than the file name
                this.currentFile = null;
                this.resetDragDropDisplay();
            }
        });

        // Drag and drop functionality
        this.setupDragAndDrop();

        this.aspectRatioSlider.addEventListener('input', () => {
            this.aspectRatioScalar = parseFloat(this.aspectRatioSlider.value);
            this.aspectRatioValue.textContent = `${this.aspectRatioScalar.toFixed(2)}x`;
            this.dispatchEvent(new CustomEvent('aspectRatioChanged', {
                detail: { aspectRatioMultiplier: this.aspectRatioScalar }
            }));
        });

        // Bottom control buttons
        this.projectionButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel('projection');
        });

        this.sourceButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel('source');
        });

        this.optionsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePanel('options');
        });

        // Panel close buttons
        this.projectionPanelClose.addEventListener('click', () => {
            this.closePanel('projection');
        });

        this.sourcePanelClose.addEventListener('click', () => {
            this.closePanel('source');
        });

        this.optionsPanelClose.addEventListener('click', () => {
            this.closePanel('options');
        });

        // Panel backdrop
        this.panelBackdrop.addEventListener('click', () => {
            this.closeAllPanels();
        });

        // Escape key to close panels
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activePanelId) {
                this.closeAllPanels();
            }
        });

        // Controls visibility toggle
        if (this.toggleControls) {
            this.toggleControls.addEventListener('click', () => {
                this.toggleControlsVisibility();
            });
        }

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

    // Methods to update UI state
    setLoadingState(isLoading) {
        this.loadImageButton.textContent = isLoading ? 'Loading...' : 'Load Image';
        this.loadImageButton.disabled = isLoading;
        
        // Show/hide loading backdrop
        if (isLoading) {
            this.loadingBackdrop.classList.add('open');
        } else {
            this.loadingBackdrop.classList.remove('open');
        }
    }

    // Panel management methods
    togglePanel(panelId) {
        if (this.activePanelId === panelId) {
            this.closePanel(panelId);
        } else {
            this.openPanel(panelId);
        }
    }

    openPanel(panelId) {
        // Close any currently open panel
        this.closeAllPanels();
        
        this.activePanelId = panelId;
        const panel = document.getElementById(`${panelId}Panel`);
        const button = document.getElementById(`${panelId}Button`);
        
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
        button.classList.add('active');
        this.panelBackdrop.classList.add('open');
        
        // Focus first interactive element in panel
        const firstInteractive = panel.querySelector('button, [tabindex="0"]');
        if (firstInteractive) {
            firstInteractive.focus();
        }
    }

    closePanel(panelId) {
        const panel = document.getElementById(`${panelId}Panel`);
        const button = document.getElementById(`${panelId}Button`);
        
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
        button.classList.remove('active');
        
        if (this.activePanelId === panelId) {
            this.activePanelId = null;
            this.panelBackdrop.classList.remove('open');
        }
    }

    closeAllPanels() {
        if (this.activePanelId) {
            this.closePanel(this.activePanelId);
        }
    }

    // Unified projection grid population
    populateProjectionGrid(panelType = 'destination') {
        const gridId = panelType === 'destination' ? 'projectionGrid' : 'sourceGrid';
        const grid = document.getElementById(gridId);
        const currentSelection = panelType === 'destination' ? this.currentShownProjection : this.currentSourceProjection;
        
        grid.innerHTML = '';
        
        this.projections.forEach(projection => {
            const item = document.createElement('button');
            item.className = 'projection-item';
            item.setAttribute('data-projection-id', projection.id);
            item.setAttribute('type', 'button');
            item.setAttribute('aria-pressed', projection.id === currentSelection);
            
            if (projection.id === currentSelection) {
                item.classList.add('selected');
            }
            
            item.innerHTML = `
                <div class="projection-item-preview">
                    ${projection.emoji}
                </div>
                <div class="projection-item-info">
                    <div class="projection-item-name">${projection.name}</div>
                    <div class="projection-item-description">${projection.description}</div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.selectProjection(projection.id, panelType);
            });
            
            grid.appendChild(item);
        });
    }

    // Unified projection selection
    selectProjection(projectionId, panelType = 'destination') {
        const isDestination = panelType === 'destination';
        
        if (isDestination) {
            this.currentShownProjection = projectionId;
        } else {
            this.currentSourceProjection = projectionId;
        }
        
        // Update grid selection
        const gridId = isDestination ? 'projectionGrid' : 'sourceGrid';
        const grid = document.getElementById(gridId);
        grid.querySelectorAll('.projection-item').forEach(item => {
            const itemId = parseInt(item.getAttribute('data-projection-id'));
            if (itemId === projectionId) {
                item.classList.add('selected');
                item.setAttribute('aria-pressed', 'true');
            } else {
                item.classList.remove('selected');
                item.setAttribute('aria-pressed', 'false');
            }
        });
        
        // Update button preview
        const selectedProjection = this.projections.find(p => p.id === projectionId);
        if (selectedProjection) {
            if (isDestination) {
                this.projectionPreview.textContent = selectedProjection.emoji;
                this.projectionButton.setAttribute('title', `Select Projection (Current: ${selectedProjection.name})`);
            } else {
                this.sourcePreview.textContent = selectedProjection.emoji;
                this.sourceButton.setAttribute('title', `Select Source Projection (Current: ${selectedProjection.name})`);
            }
        }
        
        // Dispatch appropriate event
        if (isDestination) {
            this.dispatchEvent(new CustomEvent('destinationProjectionChanged', {
                detail: { projectionType: projectionId }
            }));
        } else {
            this.dispatchEvent(new CustomEvent('sourceProjectionChanged', {
                detail: { sourceProjection: projectionId }
            }));
            
            // Close panel after selection
            this.closePanel('source');
        }
    }

    setupDragAndDrop() {
        // Drag and drop area events
        this.dragDropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            this.dragDropArea.classList.add('drag-over');
        });

        this.dragDropArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            // Only remove drag-over if leaving the entire drop zone
            if (!this.dragDropArea.contains(e.relatedTarget)) {
                this.dragDropArea.classList.remove('drag-over');
            }
        });

        this.dragDropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dragDropArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelection(files[0]);
            }
        });

        // Click to browse
        this.dragDropArea.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Keyboard accessibility
        this.dragDropArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.fileInput.click();
            }
        });

        // File input change
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelection(e.target.files[0]);
            }
        });
    }

    handleFileSelection(file) {
        // Validate file
        if (!SecurityManager.validateImageFile(file)) {
            this.showFileError('Invalid file. Please select a valid image file (JPEG, PNG, GIF, WebP, BMP) under 50MB.');
            return;
        }

        // Update UI to show file is selected
        this.currentFile = file;
        this.updateDragDropDisplay(file.name);
        this.imageUrlInput.value = file.name;

        // Auto-load the file
        this.dispatchEvent(new CustomEvent('imageLoaded', {
            detail: { 
                file: file,
                imageUrl: null, // Indicate this is a file, not URL
                sourceProjection: this.currentSourceProjection 
            }
        }));
    }

    updateDragDropDisplay(filename) {
        this.dragDropArea.classList.add('has-file');
        const content = this.dragDropArea.querySelector('.drag-drop-content');
        content.innerHTML = `
            <div class="drag-drop-icon" aria-hidden="true">✅</div>
            <div class="drag-drop-text">
                <strong>File selected</strong>
                <span>${filename}</span>
            </div>
        `;
    }

    showFileError(message) {
        // Reset UI state
        this.dragDropArea.classList.remove('has-file', 'drag-over');
        this.currentFile = null;
        
        // Show error in the drag drop area temporarily
        const content = this.dragDropArea.querySelector('.drag-drop-content');
        const originalContent = content.innerHTML;
        
        content.innerHTML = `
            <div class="drag-drop-icon" aria-hidden="true">❌</div>
            <div class="drag-drop-text">
                <strong class="error-text">Error</strong>
                <span style="error-text error-message">${message}</span>
            </div>
        `;
        
        // Reset after 3 seconds
        setTimeout(() => {
            content.innerHTML = originalContent;
        }, 3000);
    }

    resetDragDropDisplay() {
        this.dragDropArea.classList.remove('has-file', 'drag-over');
        this.currentFile = null;
        const content = this.dragDropArea.querySelector('.drag-drop-content');
        content.innerHTML = `
            <div class="drag-drop-icon" aria-hidden="true">📁</div>
            <div class="drag-drop-text">
                <strong>Drop image here</strong>
                <span>or click to browse</span>
            </div>
        `;
    }
}