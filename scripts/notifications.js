/**
 * Notification Manager for the cartographic projection tool
 * Uses Pico CSS dialog modals to show notifications to users
 */
export class NotificationManager {
    constructor() {
        this.dialog = document.getElementById('notificationDialog');
        this.titleEl = document.getElementById('notificationTitle');
        this.messageEl = document.getElementById('notificationMessage');
        this.closeBtn = document.getElementById('notificationClose');
        this.currentTimeout = null;

        this.closeBtn.addEventListener('click', () => this.hide());

        // Close on click outside the article
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) {
                this.hide();
            }
        });
    }

    /**
     * Show a notification message via dialog
     * @param {string} message - The message to display
     * @param {string} type - The type of notification ('success', 'error')
     * @param {boolean} persistent - Whether the notification should stay visible until manually dismissed
     * @param {number} duration - Custom duration in milliseconds (overrides default)
     */
    show(message, type = 'error', persistent = false, duration = null) {
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }

        this.titleEl.textContent = type === 'success' ? 'Success' : 'Error';
        this.messageEl.textContent = message;

        this.dialog.showModal();

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
        this.dialog.close();
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
