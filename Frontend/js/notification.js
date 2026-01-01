/**
 * Custom Notification System
 * Replaces browser alert() with a custom modal
 */

class NotificationManager {
    constructor() {
        this.overlay = null;
        this.modal = null;
        this.titleEl = null;
        this.messageEl = null;
        this.iconEl = null;
        this.buttonsEl = null;
        this.currentCallback = null;
        this.init();
    }

    init() {
        this.overlay = document.getElementById('notificationOverlay');
        this.modal = document.getElementById('notificationModal');
        this.titleEl = document.getElementById('notificationTitle');
        this.messageEl = document.getElementById('notificationMessage');
        this.iconEl = document.getElementById('notificationIcon');
        this.buttonsEl = document.getElementById('notificationButtons');

        // Close notification when clicking overlay
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close();
                }
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay?.classList.contains('show')) {
                this.close();
            }
        });
    }

    show(options = {}) {
        const {
            title = 'Thông báo',
            message = '',
            type = 'info', // info, success, error, warning
            buttons = [{ text: 'OK', onClick: null, primary: true }],
            onClose = null
        } = options;

        this.currentCallback = onClose;

        // Set title and message
        if (this.titleEl) this.titleEl.textContent = title;
        if (this.messageEl) this.messageEl.textContent = message;

        // Set icon and colors based on type
        this.setIcon(type);
        this.setModalType(type);

        // Set buttons
        this.setButtons(buttons);

        // Show overlay and modal
        if (this.overlay) {
            this.overlay.classList.add('show');
        }

        // Focus first button for accessibility
        setTimeout(() => {
            const firstBtn = this.buttonsEl?.querySelector('.notification-btn');
            if (firstBtn) firstBtn.focus();
        }, 100);
    }

    setIcon(type) {
        if (!this.iconEl) return;

        const icons = {
            info: 'fas fa-info-circle',
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle'
        };

        const iconClass = icons[type] || icons.info;
        this.iconEl.innerHTML = `<i class="${iconClass}"></i>`;
        this.iconEl.className = `notification-icon ${type}`;
    }

    setModalType(type) {
        if (!this.modal) return;

        // Remove all type classes
        this.modal.classList.remove('error', 'success', 'warning', 'info');
        if (type !== 'info') {
            this.modal.classList.add(type);
        }
    }

    setButtons(buttons) {
        if (!this.buttonsEl) return;

        this.buttonsEl.innerHTML = '';

        buttons.forEach((btnConfig, index) => {
            const button = document.createElement('button');
            button.className = btnConfig.primary ? 
                'notification-btn notification-btn-primary' : 
                'notification-btn notification-btn-secondary';
            button.textContent = btnConfig.text;

            button.addEventListener('click', () => {
                if (btnConfig.onClick) {
                    btnConfig.onClick();
                }
                this.close();
            });

            this.buttonsEl.appendChild(button);
        });
    }

    close() {
        if (this.overlay) {
            this.overlay.classList.remove('show');
        }
        if (this.currentCallback) {
            this.currentCallback();
            this.currentCallback = null;
        }
    }

    // Shortcut methods
    info(title, message, onClose) {
        this.show({
            title,
            message,
            type: 'info',
            onClose
        });
    }

    success(title, message, onClose) {
        this.show({
            title,
            message,
            type: 'success',
            onClose
        });
    }

    error(title, message, onClose) {
        this.show({
            title,
            message,
            type: 'error',
            onClose
        });
    }

    warning(title, message, onClose) {
        this.show({
            title,
            message,
            type: 'warning',
            onClose
        });
    }

    // Confirm dialog
    confirm(title, message, onConfirm, onCancel) {
        this.show({
            title,
            message,
            type: 'warning',
            buttons: [
                { text: 'Hủy', onClick: onCancel, primary: false },
                { text: 'Xác nhận', onClick: onConfirm, primary: true }
            ]
        });
    }
}

// Initialize notification manager globally
let notificationManager = null;

document.addEventListener('DOMContentLoaded', () => {
    notificationManager = new NotificationManager();
});

// Convenience function to show notification
function showNotification(options) {
    if (notificationManager) {
        notificationManager.show(options);
    }
}

// Function to close notification
function closeNotification() {
    if (notificationManager) {
        notificationManager.close();
    }
}
