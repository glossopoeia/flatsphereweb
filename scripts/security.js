/**
 * @fileoverview Security enhancements and configuration
 */

export class SecurityManager {
  /**
   * Content Security Policy configuration
   */
  static getCSPDirectives() {
    return {
      'default-src': "'self'",
      'script-src': "'self' https://cdn.jsdelivr.net",
      'style-src': "'self' 'unsafe-inline'", // Required for CSS custom properties
      'img-src': "'self' data: blob: https:",
      'connect-src': "'self' https://api.allorigins.win",
      'worker-src': "'self'",
      'object-src': "'none'",
      'base-uri': "'self'",
      'form-action': "'self'",
      'frame-ancestors': "'none'"
    };
  }

  /**
   * Validates image URLs for security
   * @param {string} url - URL to validate
   * @returns {boolean} Whether URL is safe
   */
  static validateImageURL(url) {
    try {
      const parsedURL = new URL(url);
      
      // Only allow HTTPS and data URLs
      if (!['https:', 'data:'].includes(parsedURL.protocol)) {
        return false;
      }
      
      // Block known malicious domains (example list)
      const blockedDomains = [
        'malicious-site.com',
        // Add more as needed
      ];
      
      if (blockedDomains.includes(parsedURL.hostname)) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sanitizes text input to prevent XSS
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Rate limiting for API calls
   */
  static createRateLimiter(maxCalls = 10, windowMs = 60000) {
    const calls = [];
    
    return function() {
      const now = Date.now();
      
      // Remove old calls outside the window
      while (calls.length > 0 && calls[0] <= now - windowMs) {
        calls.shift();
      }
      
      if (calls.length >= maxCalls) {
        throw new Error('Rate limit exceeded. Please wait before making another request.');
      }
      
      calls.push(now);
      return true;
    };
  }
}