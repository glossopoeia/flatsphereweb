import { SecurityManager } from './security.js'
import { ProjectionRenderer } from './renderer.js';
import { NotificationManager } from './notifications.js';
import { InteractionManager } from './interaction.js';

export class ProjectionApp {
    constructor(notifications = new NotificationManager()) {
        this.canvas = document.getElementById('projectionCanvas');
        
        this.interactionManager = new InteractionManager(this.canvas);
        this.notifications = notifications;
        
        this.setupInteractionEventListeners();
        this.init();
    }
    
    setupInteractionEventListeners() {
        this.interactionManager.addEventListener('destinationProjectionChanged', (e) => {
            this.renderer.setDestinationProjection(this.interactionManager.destinationProjection);
            this.render();
        });
        
        this.interactionManager.addEventListener('tissotToggled', (e) => {
            this.render();
        });
        
        this.interactionManager.addEventListener('graticuleToggled', (e) => {
            this.render();
        });
        
        this.interactionManager.addEventListener('imageLoaded', (e) => {
            const { file, imageUrl, sourceProjection } = e.detail;
            if (file) {
                this.loadUserFile(file, sourceProjection);
            } else {
                this.loadUserImage(imageUrl, sourceProjection);
            }
        });
        
        this.interactionManager.addEventListener('sourceProjectionChanged', (e) => {
            if (this.renderer) {
                this.renderer.setSourceProjection(this.interactionManager.sourceProjection);
                this.render();
            }
        });
        
        this.interactionManager.addEventListener('lookAtChanged', (e) => {
            this.render();
        });
        
        this.interactionManager.addEventListener('zoomChanged', (e) => {
            this.render();
        });

        this.interactionManager.addEventListener('aspectRatioChanged', (e) => {
            this.render();
        });
        
        this.interactionManager.addEventListener('fileError', (e) => {
            this.notifications.showError(e.detail.message);
        });

        this.interactionManager.addEventListener('canvasResize', () => {
            this.resizeCanvas();
            this.render();
        });
    }
    
    async init() {
        try {
            this.renderer = new ProjectionRenderer();
            await this.renderer.initialize(this.canvas);
            this.resizeCanvas();
            this.render();
            
            // Hide loading screen once initialization is complete
            this.interactionManager.setLoadingState(false);
        } catch (error) {
            // Hide loading screen on error
            this.interactionManager.setLoadingState(false);
            
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
            
            this.notifications.showError(message, true); // Persistent error for WebGPU initialization failure
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
    }
    
    async loadUserFile(file, sourceProjection) {
        try {
            this.interactionManager.setLoadingState(true);
            
            // Convert file to blob and load
            await this.renderer.loadCustomTexture(file);
            this.renderer.setSourceProjection(sourceProjection);
            this.render();
            this.notifications.showSuccess(`Loaded local file: ${file.name}`);
            
        } catch (error) {
            console.error('File loading failed:', error);
            this.notifications.showError(`Failed to load file: ${error.message}`);
            // Reset UI on error
            this.interactionManager.resetDragDropDisplay();
        } finally {
            this.interactionManager.setLoadingState(false);
        }
    }
    
    async loadUserImage(imageUrl, sourceProjection) {
        if (!imageUrl) {
            // Reset to default image
            try {
                await this.renderer.loadDefaultTexture(false);
                this.renderer.setSourceProjection(0); // Default is equirectangular
                this.render();
                this.notifications.showSuccess('Loaded default image');
            } catch (error) {
                this.notifications.showError(`Failed to load default image: ${error.message}`);
            }
            return;
        }
        
        // Input validation for security
        if (!SecurityManager.validateImageURL(imageUrl)) {
            this.notifications.showError('Invalid URL. Please use HTTPS URLs only.');
            return;
        }
        
        try {
            this.interactionManager.setLoadingState(true);
            
            // Try direct loading first (works for same-origin or CORS-enabled images)
            await this.loadImageDirect(imageUrl, sourceProjection);
            
        } catch (directError) {
            console.log('Direct loading failed, trying proxy:', directError.message);
            
            try {
                // Fallback to proxy service for CORS issues
                await this.loadImageWithProxy(imageUrl, sourceProjection);
            } catch (proxyError) {
                console.error('Both direct and proxy loading failed:', proxyError);
                this.notifications.showError(`Failed to load image. Direct: ${directError.message}. Proxy: ${proxyError.message}. Try a different URL or use a CORS-enabled image.`);
            }
        } finally {
            this.interactionManager.setLoadingState(false);
        }
    }
    
    async loadImageDirect(imageUrl, sourceProjection) {
        console.log('Attempting direct load of:', imageUrl);
        // Create an image element to handle the loading
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Enable CORS
        
        return new Promise((resolve, reject) => {
            img.onload = async () => {
                try {
                    // Create canvas to extract image data
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
                            this.notifications.showSuccess('Image loaded successfully!');
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
                reject(new Error('Failed to load image - check URL or CORS policy'));
            };
            
            // Set timeout for loading
            setTimeout(() => {
                reject(new Error('Image loading timed out'));
            }, 30000);
            
            img.src = imageUrl;
        });
    }
    
    async loadImageWithProxy(imageUrl, sourceProjection) {
        // Use AllOrigins as a fallback proxy
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(imageUrl)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Proxy fetch failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.contents) {
            throw new Error('No image data received from proxy');
        }
        
        // Convert base64 data to blob
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
            this.notifications.showSuccess('Image loaded via proxy successfully!');
        } catch (error) {
            throw new Error(`Failed to process proxy data: ${error.message}`);
        }
    }
    
    render() {
        if (!this.renderer) return;
        
        const lookAt = this.interactionManager.currentLookAt;
        const cameraLat = lookAt.lat * Math.PI / 180;
        const cameraLon = lookAt.lon * Math.PI / 180;
        const zoom = this.interactionManager.currentZoom;
        const showTissot = this.interactionManager.tissotEnabled ? 1.0 : 0.0;
        const showGraticule = this.interactionManager.graticuleEnabled ? 1.0 : 0.0;
        const aspectRatioMultiplier = this.interactionManager.aspectRatioMultiplier;
        
        this.renderer.render(cameraLat, cameraLon, zoom, showTissot, showGraticule, aspectRatioMultiplier);
    }
}