// js/utils/helpers.js
// Utility functions used across the application

/**
 * Calculate ISO week number for a date
 */
function isoWeek(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return d.getUTCFullYear() + "-W" + Math.ceil(((d - y) / 86400000 + 1) / 7);
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

/**
 * Format date as DD/MM
 */
function formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

/**
 * Format date as DD/MM/YYYY
 */
function formatDateFull(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString("en-GB");
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1, date2) {
    const MS_PER_DAY = 86400000;
    const d1 = date1 instanceof Date ? date1 : new Date(date1);
    const d2 = date2 instanceof Date ? date2 : new Date(date2);
    return Math.floor((d2 - d1) / MS_PER_DAY);
}

/**
 * Calculate days ago from now
 */
function daysAgo(date) {
    return daysBetween(date, new Date());
}

/**
 * Validate that a number is finite and within a range
 */
function isValidNumber(value, min = -Infinity, max = Infinity) {
    return (
        typeof value === "number" &&
        isFinite(value) &&
        value >= min &&
        value <= max
    );
}

/**
 * Clamp a value between min and max
 */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/**
 * Debounce function calls
 */
function debounce(func, wait = 400) {
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

/**
 * Format duration in minutes to human-readable string
 */
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}

/**
 * Format pace (min/km)
 */
function formatPace(minutes, distance) {
    if (!distance || distance === 0) return "-";
    const pace = minutes / distance;
    const paceMinutes = Math.floor(pace);
    const paceSeconds = Math.round((pace - paceMinutes) * 60);
    return `${paceMinutes}:${paceSeconds.toString().padStart(2, "0")}`;
}

/**
 * Safe array access with default value
 */
function safeGet(array, index, defaultValue = null) {
    return array && array[index] !== undefined ? array[index] : defaultValue;
}

/**
 * Group array by a key function
 */
function groupBy(array, keyFn) {
    return array.reduce((groups, item) => {
        const key = keyFn(item);
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {});
}

/**
 * Sum array of numbers
 */
function sum(array) {
    return array.reduce((total, num) => total + num, 0);
}

/**
 * Average of array of numbers
 */
function average(array) {
    return array.length > 0 ? sum(array) / array.length : 0;
}

/**
 * Round to specified decimal places
 */
function roundTo(value, decimals = 1) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

function calculateAveragePace(run) {
    if (run.paceStream && run.paceStream.pace) {
        const valid = run.paceStream.pace.filter((p) => p > 0 && p < 20);
        if (valid.length) return average(valid);
    }
    if (run.distance > 0 && run.duration > 0) {
        return run.duration / 60 / run.distance; // min/km
    }
    return null;
}

function calculateAverageSpeed(ride) {
    if (ride.paceStream && ride.paceStream.pace) {
        const valid = ride.paceStream.pace.filter((p) => p > 0 && p < 20);
        const speedKmh = valid.map((pace) => 60 / pace);
        if (valid.length) return average(speedKmh);
    }
    if (ride.distance > 0 && ride.duration > 0) {
        return ride.distance / 1000 / ride.duration; // km/h
    }
    return null;
}

// Export to global scope
window.helpers = {
    isoWeek,
    getWeekStart,
    formatDate,
    formatDateFull,
    daysBetween,
    daysAgo,
    isValidNumber,
    clamp,
    debounce,
    formatDuration,
    formatPace,
    safeGet,
    groupBy,
    sum,
    average,
    roundTo,
    calculateAveragePace,
    calculateAverageSpeed,
};
