/**
 * @fileoverview Security enhancements and configuration
 */

export class SecurityManager {
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

      // Basic size check for the URL itself
      if (url.length > 2048) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates local image files
   * @param {File} file - File to validate
   * @returns {boolean} Whether file is safe to load
   */
  static validateImageFile(file) {
    // Check if it's a valid File object
    if (!(file instanceof File)) {
      return false;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      return false;
    }

    // Check file size (limit to 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return false;
    }

    // Check filename for potentially dangerous patterns
    const filename = file.name.toLowerCase();
    if (filename.includes('..') || filename.includes('<script') || filename.includes('javascript:')) {
      return false;
    }

    return true;
  }
}