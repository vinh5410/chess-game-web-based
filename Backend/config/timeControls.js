// Backend/config/timeControls.js
const TIME_CONTROLS = {
    BLITZ_3: {
        name: 'Blitz 3min',
        icon: '⚡',
        initial: 180,  // 3 minutes
        increment: 0
    },
    BLITZ_5: {
        name: 'Blitz 5min',
        icon: '⚡⚡',
        initial: 300,  // 5 minutes
        increment: 0
    },
    RAPID_10: {
        name: 'Rapid 10min',
        icon: '⏱️',
        initial: 600,  // 10 minutes
        increment: 0
    },
    RAPID_15: {
        name: 'Rapid 15min',
        icon: '🕐',
        initial: 900,  // 15 minutes
        increment: 0
    },
    CLASSICAL_30: {
        name: 'Classical 30min',
        icon: '🕰️',
        initial: 1800, // 30 minutes
        increment: 0
    },
    UNLIMITED: {
        name: 'Unlimited',
        icon: '♾️',
        initial: 0,    // No time limit
        increment: 0
    }
};

const DEFAULT_TIME_CONTROL = TIME_CONTROLS.BLITZ_5;

module.exports = {
    TIME_CONTROLS,
    DEFAULT_TIME_CONTROL
};