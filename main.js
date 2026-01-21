import { ProjectionRenderer } from './renderer.js';

class ProjectionApp {
    constructor() {
        this.renderer = null;
        this.projectionSelect = document.getElementById('projectionSelect');
        this.renderModeSelect = document.getElementById('renderModeSelect');
        this.cameraLatSlider = document.getElementById('cameraLatSlider');
        this.cameraLonSlider = document.getElementById('cameraLonSlider');
        this.zoomSlider = document.getElementById('zoomSlider');
        this.zoomGroup = document.getElementById('zoomGroup');
        this.canvas = document.getElementById('projectionCanvas');
        this.errorDiv = document.getElementById('errorDiv');
        
        this.setupEventListeners();
        this.init();
    }
    
    setupEventListeners() {
        this.projectionSelect.addEventListener('change', () => {
            this.updateZoomVisibility();
            this.render();
        });
        
        this.renderModeSelect.addEventListener('change', () => {
            this.render();
        });
        
        this.cameraLatSlider.addEventListener('input', (e) => {
            document.getElementById('cameraLatValue').textContent = `${e.target.value}°`;
            this.render();
        });
        
        this.cameraLonSlider.addEventListener('input', (e) => {
            document.getElementById('cameraLonValue').textContent = `${e.target.value}°`;
            this.render();
        });
        
        this.zoomSlider.addEventListener('input', (e) => {
            document.getElementById('zoomValue').textContent = parseFloat(e.target.value).toFixed(2);
            this.render();
        });
        
        // Handle canvas resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.render();
        });
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
        const renderMode = parseInt(this.renderModeSelect.value);
        const cameraLat = parseFloat(this.cameraLatSlider.value) * Math.PI / 180;
        const cameraLon = parseFloat(this.cameraLonSlider.value) * Math.PI / 180;
        const zoom = parseFloat(this.zoomSlider.value);
        
        this.renderer.render(projectionType, renderMode, cameraLat, cameraLon, zoom);
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