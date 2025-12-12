// Frontend/js/time-controls-config.js
const TIME_CONTROLS = {
    BLITZ_3: {
        name: 'Blitz 3min',
        icon: '⚡',
        minutes: 3,
        seconds: 180,
        description: 'Fast-paced'
    },
    BLITZ_5: {
        name: 'Blitz 5min',
        icon: '⚡⚡',
        minutes: 5,
        seconds: 300,
        description: 'Quick game'
    },
    RAPID_10: {
        name: 'Rapid 10min',
        icon: '⏱️',
        minutes: 10,
        seconds: 600,
        description: 'Standard'
    },
    RAPID_15: {
        name: 'Rapid 15min',
        icon: '🕐',
        minutes: 15,
        seconds: 900,
        description: 'Relaxed'
    },
    CLASSICAL_30: {
        name: 'Classical 30min',
        icon: '🕰️',
        minutes: 30,
        seconds: 1800,
        description: 'Strategic'
    }
};

const DEFAULT_TIME_CONTROL = TIME_CONTROLS.BLITZ_5;