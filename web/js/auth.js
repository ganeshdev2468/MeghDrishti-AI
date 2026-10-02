/**
 * Authentication Service for MeghDrishti AI
 * Supports email/password, Google OAuth, session persistence,
 * registration with password strength, and demo credentials.
 */

import { StorageService } from './storage.js';

// Pre-seeded primary operator account
const DEMO_USER = {
    id: 'usr-isro-001',
    full_name: 'Dr. Anand Sharma',
    email: 'dr.sharma@isro.gov.in',
    password: 'MeghDrishti2026!',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    country: 'India',
    organization: 'ISRO Space Applications Centre',
    timezone: 'Asia/Kolkata',
    preferred_units: 'metric',
    created_at: '2026-01-15T08:00:00Z',
    updated_at: '2026-10-01T12:00:00Z'
};

export const AuthService = {
    init() {
        // Ensure default user exists in registered database
        if (!StorageService.findUserByEmail(DEMO_USER.email)) {
            StorageService.saveRegisteredUser(DEMO_USER);
        }
    },

    getCurrentUser() {
        return StorageService.getUser();
    },

    isAuthenticated() {
        return !!this.getCurrentUser();
    },

    /**
     * Authenticate with email & password
     */
    async login(email, password) {
        await this.delay(350); // realistic network delay

        const cleanEmail = email.trim().toLowerCase();
        const user = StorageService.findUserByEmail(cleanEmail);

        if (!user) {
            throw new Error('No responder account found with this email address.');
        }

        if (user.password !== password) {
            throw new Error('Invalid security credentials. Please verify your password.');
        }

        // Strip password before storing session
        const sessionUser = { ...user };
        delete sessionUser.password;
        sessionUser.updated_at = new Date().toISOString();

        StorageService.setUser(sessionUser);
        return sessionUser;
    },

    /**
     * Register a new user
     */
    async signup(userData) {
        await this.delay(400);

        const cleanEmail = userData.email.trim().toLowerCase();
        if (StorageService.findUserByEmail(cleanEmail)) {
            throw new Error('An account is already registered with this email.');
        }

        if (userData.password.length < 8) {
            throw new Error('Password must be at least 8 characters long.');
        }

        const newUser = {
            id: 'usr-' + Date.now(),
            full_name: userData.fullName.trim(),
            email: cleanEmail,
            password: userData.password,
            avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanEmail)}`,
            country: userData.country || 'India',
            organization: userData.organization || 'Meteorological Operations',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
            preferred_units: 'metric',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        StorageService.saveRegisteredUser(newUser);

        // Auto login on successful signup
        const sessionUser = { ...newUser };
        delete sessionUser.password;
        StorageService.setUser(sessionUser);

        return sessionUser;
    },

    /**
     * Google OAuth Simulation
     */
    async loginWithGoogle() {
        await this.delay(500);

        const googleUser = {
            id: 'usr-google-' + Date.now(),
            full_name: 'ISRO Field Scientist',
            email: 'scientist.isro@gmail.com',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
            country: 'India',
            organization: 'National Remote Sensing Centre',
            timezone: 'Asia/Kolkata',
            preferred_units: 'metric',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        StorageService.saveRegisteredUser({ ...googleUser, password: 'OAuthProviderUser' });
        StorageService.setUser(googleUser);
        return googleUser;
    },

    /**
     * Send password reset request
     */
    async resetPassword(email) {
        await this.delay(400);
        const cleanEmail = email.trim().toLowerCase();
        const user = StorageService.findUserByEmail(cleanEmail);
        if (!user) {
            throw new Error('No registered account matches this email.');
        }
        return { success: true, email: cleanEmail };
    },

    /**
     * Sign out current session
     */
    logout() {
        StorageService.setUser(null);
    },

    /**
     * Compute password strength score (0 to 100)
     */
    calculatePasswordStrength(password) {
        if (!password) return { score: 0, label: 'None', color: '#64748b' };
        let score = 0;
        if (password.length >= 8) score += 25;
        if (password.length >= 12) score += 15;
        if (/[A-Z]/.test(password)) score += 20;
        if (/[0-9]/.test(password)) score += 20;
        if (/[^A-Za-z0-9]/.test(password)) score += 20;

        if (score < 40) return { score, label: 'Weak', color: '#ef4444' };
        if (score < 80) return { score, label: 'Medium', color: '#f59e0b' };
        return { score, label: 'Strong', color: '#10b981' };
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

AuthService.init();
