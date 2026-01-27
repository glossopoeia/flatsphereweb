import { ProjectionRenderer } from './renderer.js';

class ProjectionApp {
    constructor() {
        this.renderer = null;
        this.projectionSelect = document.getElementById('projectionSelect');

        // Internal camera state (no longer controlled by sliders)
        this.cameraLat = 45; // degrees
        this.cameraLon = 0;  // degrees
        this.zoomSlider = document.getElementById('zoomSlider');
        this.zoomGroup = document.getElementById('zoomGroup');
        this.tissotToggle = document.getElementById('tissotToggle');
        this.canvas = document.getElementById('projectionCanvas');
        this.errorDiv = document.getElementById('errorDiv');
        
        // Mouse interaction state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        this.setupEventListeners();
        this.init();
    }
    
    setupEventListeners() {
        this.projectionSelect.addEventListener('change', () => {
            this.updateZoomVisibility();
            this.render();
        });
        

        

        
        this.zoomSlider.addEventListener('input', (e) => {
            document.getElementById('zoomValue').textContent = parseFloat(e.target.value).toFixed(2);
            this.render();
        });
        
        this.tissotToggle.addEventListener('change', () => {
            this.render();
        });
        
        // Handle canvas resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.render();
        });
        
        // Mouse drag controls
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;
            
            this.updateCameraFromMouseDrag(deltaX, deltaY);
            
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            e.preventDefault();
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });
        
        // Set initial cursor
        this.canvas.style.cursor = 'grab';
    }
    
    updateZoomVisibility() {
        const projectionType = parseInt(this.projectionSelect.value);
        // Show zoom for Orthographic (2) and Vertical Perspective (3)
        this.zoomGroup.style.display = (projectionType === 2 || projectionType === 3) ? 'block' : 'none';
    }
    
    async init() {
        try {
            this.renderer = new ProjectionRenderer();
            await this.renderer.initialize(this.canvas);
            this.resizeCanvas();
            this.updateZoomVisibility();
            this.render();
        } catch (error) {
            this.showError(`Failed to initialize WebGPU: ${error.message}`);
        }
    }
    
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const width = Math.floor(rect.width - 40); // Account for padding
        const height = Math.floor(width * 0.75); // 4:3 aspect ratio
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        if (this.renderer) {
            this.renderer.resize(width, height);
        }
    }
    
    render() {
        if (!this.renderer) return;
        
        const projectionType = parseInt(this.projectionSelect.value);

        const cameraLat = this.cameraLat * Math.PI / 180;
        const cameraLon = this.cameraLon * Math.PI / 180;
        const zoom = parseFloat(this.zoomSlider.value);
        const showTissot = this.tissotToggle.checked ? 1.0 : 0.0;
        
        this.renderer.render(projectionType, cameraLat, cameraLon, zoom, showTissot);
    }
    
    updateCameraFromMouseDrag(deltaX, deltaY) {
        const projectionType = parseInt(this.projectionSelect.value);
        const zoom = parseFloat(this.zoomSlider.value);
        
        // Base sensitivity (degrees per pixel)
        let baseSensitivity = 0.5;
        
        // Scale sensitivity based on zoom level for applicable projections
        let sensitivity = baseSensitivity;
        if (projectionType === 2 || projectionType === 3) { // Orthographic or Vertical Perspective
            // Adjust sensitivity using the square root of zoom: higher zoom (> 1) increases sensitivity,
            // while zoom values between 0 and 1 decrease it, smoothing interaction across the slider range.
            sensitivity = baseSensitivity * Math.sqrt(zoom);
        }
        
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
    
    showError(message) {
        this.errorDiv.textContent = message;
        this.errorDiv.style.display = 'block';
    }
}

// Check WebGPU support
if (!navigator.gpu) {
    document.getElementById('errorDiv').textContent = 'WebGPU is not supported in this browser.';
    document.getElementById('errorDiv').style.display = 'block';
} else {
    new ProjectionApp();
}