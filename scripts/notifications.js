/**
 * Notification Manager for the cartographic projection tool
 * Provides a centralized way to show notifications to users
 */
export class NotificationManager {
    constructor(notificationElement) {
        this.notificationDiv = notificationElement;
        this.currentTimeout = null;
    }

    /**
     * Show a notification message
     * @param {string} message - The message to display
     * @param {string} type - The type of notification ('success', 'error', 'warning', 'info')
     * @param {boolean} persistent - Whether the notification should stay visible until manually dismissed
     * @param {number} duration - Custom duration in milliseconds (overrides default)
     */
    show(message, type = 'error', persistent = false, duration = null) {
        // Clear any existing timeout
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }

        // Set the notification content and style
        this.notificationDiv.textContent = message;
        this.notificationDiv.className = `notification ${type}`;
        this.notificationDiv.style.display = 'block';

        // Auto-hide notification unless persistent
        if (!persistent) {
            const hideDelay = duration || this.getDefaultDuration(type);
            this.currentTimeout = setTimeout(() => {
                this.hide();
            }, hideDelay);
        }
    }

    /**
     * Hide the current notification
     */
    hide() {
        this.notificationDiv.style.display = 'none';
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
    }

    /**
     * Show a success notification
     * @param {string} message - The message to display
     * @param {number} duration - Custom duration (optional)
     */
    showSuccess(message, duration = null) {
        this.show(message, 'success', false, duration);
    }

    /**
     * Show an error notification
     * @param {string} message - The message to display
     * @param {boolean} persistent - Whether to keep visible until manually dismissed
     */
    showError(message, persistent = false) {
        this.show(message, 'error', persistent);
    }

    /**
     * Get default duration based on notification type
     * @param {string} type - The notification type
     * @returns {number} Duration in milliseconds
     */
    getDefaultDuration(type) {
        switch (type) {
            case 'success':
                return 4000;
            case 'error':
                return 8000;
            default:
                return 5000;
        }
    }
}