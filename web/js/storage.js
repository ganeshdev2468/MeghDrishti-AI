/**
 * Storage Manager for MeghDrishti AI
 * Handles localStorage persistence for user profiles, saved locations,
 * preferred units, and session cache.
 */

const STORAGE_KEYS = {
    AUTH_USER: 'meghdrishti_auth_user',
    SAVED_LOCATIONS: 'meghdrishti_saved_locations',
    DEFAULT_LOCATION: 'meghdrishti_default_location',
    USER_PREFERENCES: 'meghdrishti_preferences',
    WEATHER_CACHE: 'meghdrishti_weather_cache',
    CUSTOM_USERS: 'meghdrishti_registered_users'
};

const DEFAULT_PREFERENCES = {
    temperature: 'celsius', // 'celsius' | 'fahrenheit'
    windSpeed: 'kmh',       // 'kmh' | 'mph' | 'ms'
    pressure: 'hpa',        // 'hpa' | 'inhg'
    precipitation: 'mm'     // 'mm' | 'inch'
};

const DEFAULT_LOCATIONS = [
    { id: 'loc-1', name: 'Mumbai', region: 'Maharashtra', country: 'India', lat: 19.0760, lon: 72.8777, timezone: 'Asia/Kolkata', isDefault: true },
    { id: 'loc-2', name: 'Bengaluru', region: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-3', name: 'London', region: 'Greater London', country: 'United Kingdom', lat: 51.5072, lon: -0.1276, timezone: 'Europe/London', isDefault: false },
    { id: 'loc-4', name: 'Tokyo', region: 'Tokyo Prefecture', country: 'Japan', lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo', isDefault: false }
];

export const StorageService = {
    // ── User Session ──
    getUser() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    setUser(user) {
        if (user) {
            localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
        } else {
            localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
        }
    },

    // ── Registered Users (Mock DB) ──
    getRegisteredUsers() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_USERS);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    saveRegisteredUser(user) {
        const users = this.getRegisteredUsers();
        const existingIdx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
        if (existingIdx >= 0) {
            users[existingIdx] = user;
        } else {
            users.push(user);
        }
        localStorage.setItem(STORAGE_KEYS.CUSTOM_USERS, JSON.stringify(users));
    },

    findUserByEmail(email) {
        return this.getRegisteredUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
    },

    // ── Saved Locations ──
    getSavedLocations() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.SAVED_LOCATIONS);
            return data ? JSON.parse(data) : DEFAULT_LOCATIONS;
        } catch {
            return DEFAULT_LOCATIONS;
        }
    },

    addSavedLocation(location) {
        const locations = this.getSavedLocations();
        // check if duplicate by lat/lon close match
        const exists = locations.some(l => 
            Math.abs(l.lat - location.lat) < 0.01 && Math.abs(l.lon - location.lon) < 0.01
        );
        if (!exists) {
            const newLoc = {
                id: 'loc-' + Date.now(),
                name: location.name,
                region: location.region || '',
                country: location.country || '',
                lat: Number(location.lat),
                lon: Number(location.lon),
                timezone: location.timezone || 'Asia/Kolkata',
                isDefault: locations.length === 0
            };
            locations.push(newLoc);
            localStorage.setItem(STORAGE_KEYS.SAVED_LOCATIONS, JSON.stringify(locations));
            return newLoc;
        }
        return null;
    },

    removeSavedLocation(id) {
        let locations = this.getSavedLocations();
        locations = locations.filter(l => l.id !== id);
        // If we removed default, mark the first one as default
        if (locations.length > 0 && !locations.some(l => l.isDefault)) {
            locations[0].isDefault = true;
        }
        localStorage.setItem(STORAGE_KEYS.SAVED_LOCATIONS, JSON.stringify(locations));
        return locations;
    },

    setDefaultLocation(id) {
        const locations = this.getSavedLocations().map(l => ({
            ...l,
            isDefault: l.id === id
        }));
        localStorage.setItem(STORAGE_KEYS.SAVED_LOCATIONS, JSON.stringify(locations));
        return locations;
    },

    getDefaultLocation() {
        const locations = this.getSavedLocations();
        return locations.find(l => l.isDefault) || locations[0] || DEFAULT_LOCATIONS[0];
    },

    // ── User Unit Preferences ──
    getPreferences() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
            return data ? { ...DEFAULT_PREFERENCES, ...JSON.parse(data) } : DEFAULT_PREFERENCES;
        } catch {
            return DEFAULT_PREFERENCES;
        }
    },

    setPreferences(prefs) {
        const updated = { ...this.getPreferences(), ...prefs };
        localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(updated));
        return updated;
    }
};
