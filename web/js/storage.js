/**
 * Storage Manager for MeghDrishti AI
 * Handles localStorage persistence for user profiles, saved locations,
 * preferred units, and session cache.
 */

const STORAGE_KEYS = {
    AUTH_USER: 'meghdrishti_auth_user',
    SAVED_LOCATIONS: 'meghdrishti_saved_locations',
    DEFAULT_LOCATION: 'meghdrishti_default_location',
    LOCATION_DATA_VERSION: 'meghdrishti_location_data_version',
    USER_PREFERENCES: 'meghdrishti_preferences',
    WEATHER_CACHE: 'meghdrishti_weather_cache',
    CUSTOM_USERS: 'meghdrishti_registered_users'
};

const DEFAULT_PREFERENCES = {
    temperature: 'celsius', // 'celsius' | 'fahrenheit'
    windSpeed: 'kmh',       // 'kmh' | 'mph' | 'ms'
    pressure: 'hpa',        // 'hpa' | 'inhg'
    precipitation: 'mm',    // 'mm' | 'inch'
    theme: 'light'          // 'light' | 'dark'
};

const LOCATION_DATA_VERSION = 'andhra-pradesh-cities-v1';

export const DEFAULT_LOCATIONS = [
    { id: 'loc-1', name: 'Nellore', region: 'Andhra Pradesh', country: 'India', lat: 14.4426, lon: 79.9865, timezone: 'Asia/Kolkata', isDefault: true },
    { id: 'loc-2', name: 'Visakhapatnam', region: 'Andhra Pradesh', country: 'India', lat: 17.6868, lon: 83.2185, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-3', name: 'Vijayawada', region: 'Andhra Pradesh', country: 'India', lat: 16.5062, lon: 80.6480, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-4', name: 'Guntur', region: 'Andhra Pradesh', country: 'India', lat: 16.3067, lon: 80.4365, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-5', name: 'Kurnool', region: 'Andhra Pradesh', country: 'India', lat: 15.8281, lon: 78.0373, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-6', name: 'Rajamahendravaram', region: 'Andhra Pradesh', country: 'India', lat: 16.9891, lon: 81.7840, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-7', name: 'Tirupati', region: 'Andhra Pradesh', country: 'India', lat: 13.6288, lon: 79.4192, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-8', name: 'Kakinada', region: 'Andhra Pradesh', country: 'India', lat: 16.9891, lon: 82.2475, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-9', name: 'Kadapa', region: 'Andhra Pradesh', country: 'India', lat: 14.4674, lon: 78.8241, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-10', name: 'Anantapuramu', region: 'Andhra Pradesh', country: 'India', lat: 14.6819, lon: 77.6006, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-11', name: 'Mangalagiri', region: 'Andhra Pradesh', country: 'India', lat: 16.4308, lon: 80.5684, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-12', name: 'Eluru', region: 'Andhra Pradesh', country: 'India', lat: 16.7107, lon: 81.0952, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-13', name: 'Vizianagaram', region: 'Andhra Pradesh', country: 'India', lat: 18.1067, lon: 83.3956, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-14', name: 'Proddatur', region: 'Andhra Pradesh', country: 'India', lat: 14.7502, lon: 78.5482, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-15', name: 'Ongole', region: 'Andhra Pradesh', country: 'India', lat: 15.5057, lon: 80.0499, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-16', name: 'Nandyal', region: 'Andhra Pradesh', country: 'India', lat: 15.4786, lon: 78.4836, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-17', name: 'Machilipatnam', region: 'Andhra Pradesh', country: 'India', lat: 16.1875, lon: 81.1389, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-18', name: 'Tenali', region: 'Andhra Pradesh', country: 'India', lat: 16.2430, lon: 80.6400, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-19', name: 'Chittoor', region: 'Andhra Pradesh', country: 'India', lat: 13.2172, lon: 79.1003, timezone: 'Asia/Kolkata', isDefault: false },
    { id: 'loc-20', name: 'Srikakulam', region: 'Andhra Pradesh', country: 'India', lat: 18.2949, lon: 83.8938, timezone: 'Asia/Kolkata', isDefault: false }
];

export const StorageService = {
    ensureLocationData() {
        if (localStorage.getItem(STORAGE_KEYS.LOCATION_DATA_VERSION) !== LOCATION_DATA_VERSION) {
            localStorage.setItem(STORAGE_KEYS.SAVED_LOCATIONS, JSON.stringify(DEFAULT_LOCATIONS));
            localStorage.setItem(STORAGE_KEYS.LOCATION_DATA_VERSION, LOCATION_DATA_VERSION);
        }
    },

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
        this.ensureLocationData();
        try {
            const data = localStorage.getItem(STORAGE_KEYS.SAVED_LOCATIONS);
            return data ? JSON.parse(data) : DEFAULT_LOCATIONS.map(location => ({ ...location }));
        } catch {
            return DEFAULT_LOCATIONS.map(location => ({ ...location }));
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
