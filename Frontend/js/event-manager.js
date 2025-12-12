// 📁 Frontend/js/event-manager.js - Manage event listeners to prevent memory leaks
class EventManager {
    constructor() {
        this.listeners = new Map();
    }
    
    // Add event listener with tracking
    on(elementOrId, event, handler, options = false) {
        const element = typeof elementOrId === 'string' 
            ? GameUtils.getElement(elementOrId) 
            : elementOrId;
            
        if (!element) {
            console.warn('Element not found for event:', elementOrId, event);
            return;
        }
        
        const key = this.getKey(element, event);
        
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        
        element.addEventListener(event, handler, options);
        
        this.listeners.get(key).push({
            element,
            event,
            handler,
            options
        });
        
        return () => this.off(element, event, handler);
    }
    
    // Remove specific event listener
    off(elementOrId, event, handler) {
        const element = typeof elementOrId === 'string' 
            ? GameUtils.getElement(elementOrId) 
            : elementOrId;
            
        if (!element) return;
        
        element.removeEventListener(event, handler);
        
        const key = this.getKey(element, event);
        if (this.listeners.has(key)) {
            const listeners = this.listeners.get(key);
            const index = listeners.findIndex(l => l.handler === handler);
            if (index > -1) {
                listeners.splice(index, 1);
            }
            
            if (listeners.length === 0) {
                this.listeners.delete(key);
            }
        }
    }
    
    // Remove all listeners for an element
    removeAll(elementOrId) {
        const element = typeof elementOrId === 'string' 
            ? GameUtils.getElement(elementOrId) 
            : elementOrId;
            
        if (!element) return;
        
        const keysToRemove = [];
        
        this.listeners.forEach((listeners, key) => {
            listeners.forEach(({ element: el, event, handler }) => {
                if (el === element) {
                    el.removeEventListener(event, handler);
                }
            });
            
            if (key.startsWith(element.id || 'unknown')) {
                keysToRemove.push(key);
            }
        });
        
        keysToRemove.forEach(key => this.listeners.delete(key));
    }
    
    // Cleanup all listeners
    cleanup() {
        this.listeners.forEach((listeners) => {
            listeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
        });
        this.listeners.clear();
        console.log('✅ All event listeners cleaned up');
    }
    
    // Helper: Generate unique key
    getKey(element, event) {
        const id = element.id || `element_${Math.random().toString(36).substr(2, 9)}`;
        return `${id}_${event}`;
    }
    
    // Get listener count (for debugging)
    getListenerCount() {
        let count = 0;
        this.listeners.forEach(listeners => {
            count += listeners.length;
        });
        return count;
    }
}

// Create global instance
window.eventManager = new EventManager();
console.log('✅ EventManager loaded');