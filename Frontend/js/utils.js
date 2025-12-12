// 📁 Frontend/js/utils.js - Shared utilities for all game modes
class GameUtils {
    // ==================== DOM HELPERS ====================
    
    static getElement(id) {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`Element not found: ${id}`);
        }
        return el;
    }
    
    static getElements(...ids) {
        return ids.reduce((acc, id) => {
            acc[id] = this.getElement(id);
            return acc;
        }, {});
    }
    
    static setTextContent(id, text) {
        const el = this.getElement(id);
        if (el) el.textContent = text;
    }
    
    static setValue(id, value) {
        const el = this.getElement(id);
        if (el) el.value = value;
    }
    
    static getValue(id) {
        const el = this.getElement(id);
        return el ? el.value : '';
    }
    
    static toggleClass(id, className, force) {
        const el = this.getElement(id);
        if (el) el.classList.toggle(className, force);
    }
    
    static addClass(id, ...classNames) {
        const el = this.getElement(id);
        if (el) el.classList.add(...classNames);
    }
    
    static removeClass(id, ...classNames) {
        const el = this.getElement(id);
        if (el) el.classList.remove(...classNames);
    }
    
    static hasClass(id, className) {
        const el = this.getElement(id);
        return el ? el.classList.contains(className) : false;
    }
    
    static show(id) {
        this.removeClass(id, 'hidden');
    }
    
    static hide(id) {
        this.addClass(id, 'hidden');
    }
    
    static setHTML(id, html) {
        const el = this.getElement(id);
        if (el) el.innerHTML = html;
    }
    
    // ==================== TEXT UTILITIES ====================
    
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    static capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    static truncate(str, maxLength = 50) {
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    }
    
    // ==================== VALIDATION ====================
    
    static validateUsername(username) {
        if (!username || username.trim().length === 0) {
            return { valid: false, error: 'Username is required' };
        }
        if (username.length < 3) {
            return { valid: false, error: 'Username must be at least 3 characters' };
        }
        if (username.length > 20) {
            return { valid: false, error: 'Username must be less than 20 characters' };
        }
        return { valid: true };
    }
    
    static validateRoomCode(code) {
        if (!code || code.trim().length === 0) {
            return { valid: false, error: 'Room code is required' };
        }
        if (code.length !== 6) {
            return { valid: false, error: 'Room code must be 6 characters' };
        }
        return { valid: true };
    }
    
    static validateMessage(message, maxLength = 200) {
        if (!message || message.trim().length === 0) {
            return { valid: false, error: 'Message cannot be empty' };
        }
        if (message.length > maxLength) {
            return { valid: false, error: `Message too long (max ${maxLength} characters)` };
        }
        return { valid: true };
    }
    
    // ==================== ALERTS & CONFIRMS ====================
    
    static showAlert(message, type = 'info') {
        // Can be enhanced with custom modal later
        alert(message);
    }
    
    static showConfirm(message) {
        return confirm(message);
    }
    
    static showError(message) {
        console.error(message);
        this.showAlert(`Error: ${message}`, 'error');
    }
    
    // ==================== ARRAY UTILITIES ====================
    
    static shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    static randomElement(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
    
    // ==================== ASYNC UTILITIES ====================
    
    static async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // ==================== LOCAL STORAGE ====================
    
    static saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }
    
    static loadFromStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return defaultValue;
        }
    }
    
    static removeFromStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }
    
    // ==================== COPY TO CLIPBOARD ====================
    
    static async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                return true;
            }
        } catch (error) {
            console.error('Failed to copy:', error);
            return false;
        }
    }
}

// Make available globally
window.GameUtils = GameUtils;
console.log('✅ GameUtils loaded');