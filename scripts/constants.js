/**
 * @fileoverview Configuration and constants for the projection tool
 */

// Projection types
export const PROJECTION_TYPES = {
  STEREOGRAPHIC: 0,
  POLAR: 1,
  ORTHOGRAPHIC: 2,
  VERTICAL_PERSPECTIVE: 3,
  MERCATOR: 4,
  PLATE_CARREE: 5
};

// Source projection types
export const SOURCE_PROJECTION_TYPES = {
  EQUIRECTANGULAR: 0,
  STEREOGRAPHIC: 1,
  POLAR: 2,
  ORTHOGRAPHIC: 3,
  MERCATOR: 4
};

// UI Constants
export const UI_CONSTANTS = {
  MOBILE_BREAKPOINT: 768,
  ZOOM_INDICATOR_TIMEOUT: 2000,
  MOBILE_CONTROLS_HIDE_TIMEOUT: 3000,
  ERROR_DISPLAY_TIMEOUT: 8000,
  
  // Touch interaction
  TOUCH_TARGET_SIZE: 44, // iOS minimum
  
  // Image loading
  MAX_IMAGE_SIZE: 4096 * 4096, // 16MP
  IMAGE_LOAD_TIMEOUT: 30000,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  
  // Zoom limits
  MIN_ZOOM: 0.01,
  MAX_ZOOM: 10,
  
  // Camera limits
  MIN_LATITUDE: -90,
  MAX_LATITUDE: 90
};

// WebGPU constants
export const WEBGPU_CONSTANTS = {
  UNIFORM_BUFFER_SIZE: 36, // 9 floats * 4 bytes
  VERTEX_COUNT: 4, // Triangle strip quad
};

// Shader constants
export const SHADER_CONSTANTS = {
  PI: Math.PI,
  HALF_PI: Math.PI / 2,
  TWO_PI: Math.PI * 2
};

// Error messages
export const ERROR_MESSAGES = {
  WEBGPU_NOT_SUPPORTED: 'WebGPU is not supported in this browser. Try Chrome 113+, Edge 113+, or Safari 18+ with WebGPU enabled.',
  WEBGPU_ADAPTER_NOT_FOUND: 'WebGPU adapter not found. This may indicate hardware compatibility issues or that WebGPU is disabled.',
  WEBGPU_DEVICE_UNAVAILABLE: 'Graphics device unavailable. Try closing other graphics-intensive applications.',
  IMAGE_TOO_LARGE: 'Image too large. Maximum size: 4096x4096',
  IMAGE_LOAD_FAILED: 'Failed to load image - check URL or CORS policy',
  IMAGE_LOAD_TIMEOUT: 'Image loading timed out',
  INVALID_IMAGE_FORMAT: 'Invalid image format. Supported: JPEG, PNG, WebP'
};