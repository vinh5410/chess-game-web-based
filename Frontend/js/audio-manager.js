// Frontend/js/audio-manager.js

class AudioManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.5;
        
        // Load preference từ localStorage
        const savedEnabled = localStorage.getItem('chess-audio-enabled');
        const savedVolume = localStorage.getItem('chess-audio-volume');
        
        if (savedEnabled !== null) this.enabled = savedEnabled === 'true';
        if (savedVolume !== null) this.volume = parseFloat(savedVolume);
        
        this.loadSounds();
    }
    
    loadSounds() {
        const soundFiles = {
            move: './assets/sounds/move.mp3',
            capture: './assets/sounds/capture.mp3',
            check: './assets/sounds/check.mp3',
            checkmate: './assets/sounds/checkmate.webm',
            castle: './assets/sounds/move.mp3', // Dùng move.mp3 cho castle
            promote: './assets/sounds/promote.mp3'
        };
        
        for (const [key, path] of Object.entries(soundFiles)) {
            try {
                const audio = new Audio(path);
                audio.volume = this.volume;
                audio.preload = 'auto';
                this.sounds[key] = audio;
            } catch (error) {
                console.warn(`⚠️ Failed to load sound: ${key}`);
            }
        }
        
        console.log('🔊 Audio Manager initialized');
    }
    
    play(soundName) {
        if (!this.enabled) return;
        
        const sound = this.sounds[soundName];
        if (sound) {
            // Clone để có thể phát nhiều âm thanh cùng lúc
            const clone = sound.cloneNode();
            clone.volume = this.volume;
            clone.play().catch(err => console.warn('Audio play failed:', err));
        }
    }
    
    playMove(move, gameState) {
        if (!move) return;
        
        // Checkmate (ưu tiên cao nhất)
        if (gameState && gameState.isCheckmate && gameState.isCheckmate()) {
            this.play('checkmate');
            return;
        }
        
        // Check
        if (move.san && move.san.includes('+')) {
            this.play('check');
            return;
        }
        
        // Castle
        if (move.san === 'O-O' || move.san === 'O-O-O') {
            this.play('castle');
            return;
        }
        
        // Promotion
        if (move.promotion) {
            this.play('promote');
            return;
        }
        
        // Capture
        if (move.captured || (move.san && move.san.includes('x'))) {
            this.play('capture');
            return;
        }
        
        // Normal move
        this.play('move');
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        localStorage.setItem('chess-audio-volume', this.volume);
        
        for (const sound of Object.values(this.sounds)) {
            sound.volume = this.volume;
        }
    }
    
    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('chess-audio-enabled', this.enabled);
        return this.enabled;
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
        localStorage.setItem('chess-audio-enabled', this.enabled);
    }
}

// Export global instance
if (typeof window !== 'undefined') {
    window.audioManager = new AudioManager();
}