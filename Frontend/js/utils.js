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

// =========================
// SOUND MANAGER
// =========================
class SoundManager {
    constructor() {
        this.enabled = true;
        this.volume = 0.6;
        this.audioMap = {
            move: this.createAudio('./assets/sounds/move.mp3'),
            capture: this.createAudio('./assets/sounds/capture.mp3'),
            check: this.createAudio('./assets/sounds/check.mp3'),
            checkmate: this.createAudio('./assets/sounds/checkmate.mp3'),
            promote: this.createAudio('./assets/sounds/promote.mp3'),
            castle: this.createAudio('./assets/sounds/castle.mp3')
        };
        this._unlockBound = this._unlockAudio.bind(this);
        document.addEventListener('click', this._unlockBound, { once: true });
        document.addEventListener('touchstart', this._unlockBound, { once: true });
    }

    createAudio(src) {
        try {
            const a = new Audio(src);
            a.preload = 'auto';
            a.volume = this.volume;
            return a;
        } catch {
            return null;
        }
    }

    _unlockAudio() {
        // Attempt to play a silent sound to unlock iOS/Chrome
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.0001;
            osc.frequency.value = 200;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            setTimeout(() => { osc.stop(); ctx.close(); }, 30);
        } catch {}
    }

    setEnabled(on) { this.enabled = !!on; }
    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        Object.values(this.audioMap).forEach(a => { if (a) a.volume = this.volume; });
    }

    play(type) {
        if (!this.enabled) {
            console.log('🔇 Sound disabled');
            return;
        }
        const audio = this.audioMap[type];
        console.log('🔊 Playing sound:', type, 'audio exists:', !!audio);
        if (audio) {
            try {
                // Clone to allow overlapping plays
                const inst = audio.cloneNode();
                inst.volume = this.volume;
                inst.play().then(() => {
                    console.log('🔊 Sound played successfully:', type);
                }).catch((err) => {
                    console.warn('🔇 Sound play failed:', type, err.message);
                    this._beep(type);
                });
            } catch (e) {
                console.warn('🔇 Sound error:', e);
                this._beep(type);
            }
        } else {
            console.log('🔊 No audio, using beep for:', type);
            this._beep(type);
        }
    }

    playMove(move, game) {
        if (!move) return;
        const san = move.san || '';
        const flags = move.flags || '';
        const captured = move.captured;
        
        console.log('🔊 playMove:', { san, flags, captured });
        
        // Checkmate has highest priority
        if (san.includes('#')) {
            console.log('🔊 Playing: checkmate');
            return this.play('checkmate');
        }
        // Check
        if (san.includes('+')) {
            console.log('🔊 Playing: check');
            return this.play('check');
        }
        // Promotion (flag 'p')
        if (flags.includes('p')) {
            console.log('🔊 Playing: promote');
            return this.play('promote');
        }
        // Capture (captured piece exists, or en passant flag 'e')
        if (captured || flags.includes('e')) {
            console.log('🔊 Playing: capture');
            return this.play('capture');
        }
        // Castling (kingside 'k' or queenside 'q')
        if (flags.includes('k') || flags.includes('q')) {
            console.log('🔊 Playing: castle');
            return this.play('castle');
        }
        // Normal move
        console.log('🔊 Playing: move');
        return this.play('move');
    }

    _beep(type) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const map = {
                move: 440,
                capture: 220,
                check: 660,
                checkmate: 880,
                promote: 550,
                castle: 500
            };
            osc.frequency.value = map[type] || 400;
            gain.gain.value = 0.04;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            setTimeout(() => { osc.stop(); ctx.close(); }, 120);
        } catch {}
    }
}

// Global instance
window.Sound = new SoundManager();
console.log('✅ SoundManager loaded');