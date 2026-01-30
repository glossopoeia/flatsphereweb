import { ProjectionApp } from './app.js';
import { NotificationManager } from './notifications.js';

// Enhanced WebGPU support detection
async function checkWebGPUSupport() {
    const notifications = new NotificationManager(document.getElementById('notificationDiv'));
    
    // Check if WebGPU is available at all
    if (!navigator.gpu) {
        notifications.showError('WebGPU is not supported in this browser. Try Chrome 113+, Edge 113+, or Safari 18+ with WebGPU enabled.', true);
        return false;
    }
    
    try {
        // Try to get an adapter
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            notifications.showError('WebGPU adapter not found. This may indicate hardware compatibility issues or that WebGPU is disabled.', true);
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
        
        notifications.showError(message, true);
        return false;
    }
}

// Initialize app only if WebGPU is supported
checkWebGPUSupport().then(supported => {
    if (supported) {
        new ProjectionApp();
    }
});