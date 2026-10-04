/**
 * Client-Side Router for MeghDrishti AI
 * Handles public and protected routes, redirects, URL query params,
 * and browser history synchronization.
 */

import { AuthService } from './auth.js';

const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password'];
const AUTH_ROUTES = [
    '/dashboard',
    '/weather',
    '/rainfall',
    '/radar',
    '/satellite',
    '/nwp',
    '/flood-risk',
    '/storm-tracking',
    '/alerts',
    '/map',
    '/forecast',
    '/history',
    '/compare',
    '/ai-analysis',
    '/operations',
    '/settings'
];

export class Router {
    constructor(onRouteChange) {
        this.onRouteChange = onRouteChange;
        this.currentRoute = null;
        this.currentParams = {};

        window.addEventListener('popstate', () => this.handleLocationChange());
        window.addEventListener('hashchange', () => this.handleLocationChange());
    }

    init() {
        this.handleLocationChange();
    }

    /**
     * Parse current route and search params from window.location
     */
    parseCurrentLocation() {
        let path = window.location.pathname;
        let search = window.location.search;

        // If hash routing is used (e.g. #/dashboard?lat=...)
        if (window.location.hash && window.location.hash.startsWith('#/')) {
            const rawHash = window.location.hash.slice(1); // e.g. /dashboard?lat=...
            const parts = rawHash.split('?');
            path = parts[0];
            search = parts[1] ? `?${parts[1]}` : '';
        }

        // Clean trailing slashes except root
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }

        const params = new URLSearchParams(search);
        const query = {};
        for (const [key, value] of params.entries()) {
            query[key] = value;
        }

        return { path, query };
    }

    /**
     * Navigate to a path with optional query params
     */
    navigate(path, query = null, replace = false) {
        const currentLoc = this.parseCurrentLocation();

        // If query is omitted, inherit current coordinates if navigating between app screens
        const targetQuery = query !== null ? query : (
            AUTH_ROUTES.includes(path) ? { lat: currentLoc.query.lat, lon: currentLoc.query.lon, name: currentLoc.query.name } : {}
        );

        // Remove undefined keys
        const cleanQuery = {};
        for (const [k, v] of Object.entries(targetQuery)) {
            if (v !== undefined && v !== null && v !== '') {
                cleanQuery[k] = v;
            }
        }

        const searchParams = new URLSearchParams(cleanQuery);
        const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
        const currentPath = window.location.pathname;
        const basePath = currentPath.endsWith('/')
            ? currentPath
            : `${currentPath.slice(0, currentPath.lastIndexOf('/') + 1)}`;
        const fullUrl = `${basePath || '/'}#${path}${queryString}`;

        if (replace) {
            window.history.replaceState({}, '', fullUrl);
        } else {
            window.history.pushState({}, '', fullUrl);
        }

        this.handleLocationChange();
    }

    /**
     * Main route resolution with authentication guards
     */
    handleLocationChange() {
        const { path, query } = this.parseCurrentLocation();
        const isAuth = AuthService.isAuthenticated();

        // 1. Root path handling
        if (path === '/' || path === '') {
            if (isAuth) {
                this.navigate('/dashboard', query, true);
            } else {
                this.navigate('/login', {}, true);
            }
            return;
        }

        // 2. Protected Route Guard
        if (AUTH_ROUTES.includes(path)) {
            if (!isAuth) {
                // Save intended destination for post-login redirect
                const returnQuery = new URLSearchParams(query).toString();
                const returnUrl = encodeURIComponent(`${path}${returnQuery ? `?${returnQuery}` : ''}`);
                this.navigate('/login', { redirect: returnUrl }, true);
                return;
            }
        }

        // 3. Guest Only Route Guard
        if (PUBLIC_ROUTES.includes(path)) {
            if (isAuth) {
                // If user is already logged in, redirect away from login/signup to dashboard
                const redirectTarget = new URL(query.redirect || '/dashboard', window.location.origin);
                this.navigate(redirectTarget.pathname, Object.fromEntries(redirectTarget.searchParams.entries()), true);
                return;
            }
        }

        // 4. Unknown Route Fallback
        if (!PUBLIC_ROUTES.includes(path) && !AUTH_ROUTES.includes(path)) {
            this.navigate(isAuth ? '/dashboard' : '/login', {}, true);
            return;
        }

        this.currentRoute = path;
        this.currentParams = query;

        if (this.onRouteChange) {
            this.onRouteChange(path, query);
        }
    }
}
