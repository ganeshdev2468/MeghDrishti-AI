/**
 * MeghDrishti AI static dashboard controller
 * Open-Meteo weather data plus illustrative local demo products
 */

import { AuthService } from './auth.js';
import { StorageService } from './storage.js';
import { weatherService } from './weatherService.js';
import { Router } from './router.js';
import { DataMode, QualityStatus, ProvenanceType } from './providers/dataProviders.js';
import {
    buildAiAssessment,
    buildAiWeatherBrief,
    buildHistoricalAnalytics,
    buildLocationComparison,
    buildNwpModelCenter,
    buildSmartAlerts,
    buildWeatherStory
} from './aiInsights.js';

class MeghDrishtiApp {
    constructor() {
        this.currentLocation = StorageService.getDefaultLocation();
        this.weatherData = null;
        this.lastFetchTime = null;
        this.clockTimer = null;
        this.leafletMap = null;
        this.mapMarker = null;
        this.mapLayerGroup = null;
        this.searchDebounceTimer = null;
        this.activeRoute = null;
        this.router = new Router((route, params) => this.handleRoute(route, params));
    }

    init() {
        this.applyTheme(StorageService.getPreferences().theme);
        this.setupAuthEvents();
        this.setupGlobalSearch();
        this.setupTopbarEvents();
        this.setupUnitEvents();
        this.setupModeToggle();
        this.setupSettingsEvents();
        this.startUtcClock();
        this.router.init();
    }

    applyTheme(theme) {
        const safeTheme = theme === 'light' ? 'light' : 'dark';
        document.documentElement.dataset.theme = safeTheme;
        const themeButton = document.getElementById('btn-theme-toggle');
        if (themeButton) {
            const darkMode = safeTheme === 'dark';
            themeButton.textContent = darkMode ? '☀️' : '🌙';
            themeButton.setAttribute('aria-label', `Switch to ${darkMode ? 'light' : 'dark'} theme`);
            themeButton.title = `Switch to ${darkMode ? 'light' : 'dark'} theme`;
        }
    }

    /** Start live UTC clock for the auth hero pane. */
    startUtcClock() {
        const updateUtc = () => {
            const el = document.getElementById('auth-live-time');
            if (el) el.textContent = `${new Date().toISOString().slice(11, 19)} UTC`;
        };
        updateUtc();
        setInterval(updateUtc, 1000);
    }

    /**
     * Handle route changes dispatched by Router
     */
    async handleRoute(path, query) {
        if (this.activeRoute !== path) {
            window.scrollTo(0, 0);
            this.activeRoute = path;
        }

        const isAuth = AuthService.isAuthenticated();

        // 1. Show appropriate main container
        const authContainer = document.getElementById('auth-container');
        const appShell = document.getElementById('app-shell');

        if (!isAuth) {
            authContainer.classList.add('active');
            appShell.classList.remove('active');

            document.getElementById('auth-view-login').style.display = path === '/login' ? 'block' : 'none';
            document.getElementById('auth-view-signup').style.display = path === '/signup' ? 'block' : 'none';
            document.getElementById('auth-view-forgot').style.display = path === '/forgot-password' ? 'block' : 'none';
            return;
        }

        // Authenticated user
        authContainer.classList.remove('active');
        appShell.classList.add('active');

        // Update active nav links (sidebar & mobile)
        document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
            const linkRoute = link.getAttribute('data-route');
            if (linkRoute === path) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Hide all view containers, show target
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        const targetViewId = `view-${path.replace('/', '')}`;
        const targetView = document.getElementById(targetViewId);
        if (targetView) {
            targetView.classList.add('active');
        }

        // Update User info in sidebar
        this.updateSidebarUserProfile();

        // Handle URL coordinates query params
        if (query.lat && query.lon) {
            const queryLat = parseFloat(query.lat);
            const queryLon = parseFloat(query.lon);
            const queryName = query.name || this.currentLocation.name;
            const queryTz = query.tz || this.currentLocation.timezone;

            if (Math.abs(queryLat - this.currentLocation.lat) > 0.001 || Math.abs(queryLon - this.currentLocation.lon) > 0.001) {
                this.currentLocation = {
                    ...this.currentLocation,
                    name: queryName,
                    lat: queryLat,
                    lon: queryLon,
                    timezone: queryTz
                };
            }
        }

        // Load weather if not loaded or location changed
        await this.loadWeatherForCurrentLocation();

        // Route-specific rendering
        switch (path) {
            case '/map':
                setTimeout(() => this.initOrUpdateMap(), 150);
                break;
            case '/radar':
                this.renderRadarView(this.weatherData);
                break;
            case '/satellite':
                this.renderSatelliteView(this.weatherData);
                break;
            case '/nwp':
                this.renderNwpView(this.weatherData);
                break;
            case '/rainfall':
                this.renderRainfallView(this.weatherData);
                break;
            case '/flood-risk':
                this.renderFloodRiskView(this.weatherData);
                break;
            case '/storm-tracking':
                this.renderStormTrackingView(this.weatherData);
                break;
            case '/history':
                this.renderHistoryView(this.weatherData);
                break;
            case '/compare':
                this.renderCompareView(this.weatherData);
                break;
            case '/ai-analysis':
                this.renderAiAnalysisView(this.weatherData);
                break;
            case '/operations':
                this.renderOperationsView(this.weatherData);
                break;
            case '/settings':
                this.populateSettingsView();
                break;
        }
    }

    /**
     * Fetch weather telemetry for current location
     */
    async loadWeatherForCurrentLocation(forceRefresh = false) {
        const refreshBtn = document.getElementById('btn-refresh-now');
        if (refreshBtn) refreshBtn.classList.add('spinning');

        try {
            this.weatherData = await weatherService.getWeather(this.currentLocation, { forceRefresh });
            const retrievedAt = this.weatherData.snapshot?.provenance?.timestamp;
            this.lastFetchTime = retrievedAt ? new Date(retrievedAt) : null;

            this.startLocationClock(this.weatherData.snapshot.timezone);

            // Render main dashboard views
            this.renderDashboard(this.weatherData);
            this.renderWeatherDeepDive(this.weatherData);
            this.renderForecastExtended(this.weatherData);
            this.renderAlertsView(this.weatherData);
            this.renderNotificationsDropdown(this.weatherData);

            this.updateRelativeTime();
            this.renderSavedLocations();
            this.updateModeIndicators();
        } catch (error) {
            console.error('Failed to load weather:', error);
            this.showGlobalToast('Live weather data is unavailable. Check your connection and retry.', 'error');
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('spinning');
        }
    }

    /**
     * Start high-precision local clock for the target timezone
     */
    startLocationClock(timezone) {
        if (this.clockTimer) clearInterval(this.clockTimer);

        const tick = () => {
            try {
                const now = new Date();
                const timeFormatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: timezone || 'UTC',
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                });

                const dateFormatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: timezone || 'UTC',
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                });

                const timeStr = timeFormatter.format(now);
                const dateStr = dateFormatter.format(now);

                const timeEl = document.getElementById('topbar-local-time');
                if (timeEl) timeEl.textContent = timeStr;

                const tzAbbr = (timezone || 'UTC').split('/').pop().replace('_', ' ');
                const tzEl = document.getElementById('topbar-local-tz');
                if (tzEl) tzEl.textContent = tzAbbr;

                const headerDateTime = document.getElementById('dash-local-datetime');
                if (headerDateTime) {
                    headerDateTime.textContent = `${timeStr} (${tzAbbr}) • ${dateStr}`;
                }
            } catch (e) {
                console.warn('Clock format error:', e);
            }
        };

        tick();
        this.clockTimer = setInterval(tick, 1000);
    }

    /**
     * Render the main operations dashboard
     */
    renderDashboard(data) {
        const { snapshot, hourly, daily, nowcast, alerts } = data;
        const prefs = StorageService.getPreferences();

        // 1. Header & Location titles
        const fullLocName = [snapshot.location.name, snapshot.location.region, snapshot.location.country]
            .filter(Boolean).join(', ');
        
        document.getElementById('dash-city-title').textContent = fullLocName;
        document.getElementById('topbar-location-name').textContent = fullLocName;
        document.getElementById('dash-coordinates').textContent =
            `${snapshot.location.lat.toFixed(4)}° N, ${snapshot.location.lon.toFixed(4)}° E${snapshot.location.elevation != null ? ` (Elev: ${snapshot.location.elevation}m)` : ''}`;
        document.getElementById('dash-data-source').textContent = snapshot.source;
        const qualityBadge = document.getElementById('dash-data-qc');
        if (qualityBadge) {
            qualityBadge.textContent = snapshot.isDemo ? 'DEMO DATA' : snapshot.available ? 'OPEN-METEO FORECAST' : 'WEATHER UNAVAILABLE';
            qualityBadge.className = `status-badge ${snapshot.isDemo ? 'status-suspect' : snapshot.available ? 'status-good' : 'status-suspect'}`;
        }

        // 2. Primary Hero Weather Card
        document.getElementById('hero-temp-val').textContent = weatherService.formatTemp(snapshot.temperature, prefs.temperature);
        document.getElementById('hero-weather-icon').textContent = snapshot.conditionIcon;
        document.getElementById('hero-weather-condition').textContent = snapshot.condition;
        document.getElementById('hero-feels-like').textContent = `Feels like ${weatherService.formatTemp(snapshot.feelsLike, prefs.temperature)}`;

        if (daily.length) {
            document.getElementById('hero-temp-max').textContent = weatherService.formatTemp(daily[0].maxTemp, prefs.temperature);
            document.getElementById('hero-temp-min').textContent = weatherService.formatTemp(daily[0].minTemp, prefs.temperature);
        } else {
            document.getElementById('hero-temp-max').textContent = '—';
            document.getElementById('hero-temp-min').textContent = '—';
        }

        // 3. Operational 8 Metrics Grid
        document.getElementById('metric-humidity').textContent = snapshot.humidity == null ? '—' : `${snapshot.humidity}%`;
        let dewPoint = null;
        if (Number.isFinite(snapshot.temperature) && Number.isFinite(snapshot.humidity) && snapshot.humidity > 0 && snapshot.humidity <= 100) {
            const gamma = Math.log(snapshot.humidity / 100) + (17.625 * snapshot.temperature) / (243.04 + snapshot.temperature);
            dewPoint = (243.04 * gamma) / (17.625 - gamma);
        }
        document.getElementById('metric-dewpoint').textContent = weatherService.formatTemp(dewPoint, prefs.temperature);
        document.getElementById('metric-pressure').textContent = weatherService.formatPressure(snapshot.pressure, prefs.pressure);
        
        document.getElementById('metric-wind').textContent = weatherService.formatWind(snapshot.windSpeed, prefs.windSpeed);
        const windDirection = Number.isFinite(snapshot.windDirection)
            ? `${weatherService.degToCompass(snapshot.windDirection)} (${snapshot.windDirection.toFixed(0)}°)`
            : 'Direction unavailable';
        document.getElementById('metric-wind-dir').textContent = windDirection;
        document.getElementById('metric-gusts').textContent = weatherService.formatWind(snapshot.windGust, prefs.windSpeed);

        document.getElementById('metric-precip').textContent = weatherService.formatPrecip(snapshot.precipitation, prefs.precipitation);
        document.getElementById('metric-visibility').textContent = Number.isFinite(snapshot.visibility) ? `${snapshot.visibility.toFixed(1)} km` : '—';
        document.getElementById('metric-vis-quality').textContent = Number.isFinite(snapshot.visibility) ? 'Open-Meteo hourly forecast' : 'Unavailable';

        document.getElementById('metric-uv').textContent = Number.isFinite(snapshot.uvIndex) ? snapshot.uvIndex.toFixed(1) : '—';
        document.getElementById('metric-uv-level').textContent = Number.isFinite(snapshot.uvIndex) ? 'Hourly forecast' : 'Unavailable';

        document.getElementById('metric-cloudcover').textContent = snapshot.cloudCover == null ? '—' : `${snapshot.cloudCover}%`;
        if (snapshot.sunrise && snapshot.sunset) {
            const sr = snapshot.sunrise.slice(11, 16);
            const ss = snapshot.sunset.slice(11, 16);
            document.getElementById('metric-sun-times').textContent = `☀️ ${sr} • 🌙 ${ss}`;
        } else {
            document.getElementById('metric-sun-times').textContent = 'Unavailable';
        }

        // 4. Open-Meteo precipitation and unsupported accumulation/anomaly data
        document.getElementById('rf-current-rate').textContent = weatherService.formatPrecip(snapshot.precipitation, prefs.precipitation);
        document.getElementById('rf-intensity-tag').textContent = 'Current forecast interval';
        ['rf-1h-acc', 'rf-3h-acc', 'rf-6h-acc', 'rf-24h-acc'].forEach(id => {
            document.getElementById(id).textContent = 'Unavailable';
        });
        const anomaly = document.getElementById('rf-anomaly');
        if (anomaly) anomaly.textContent = 'BASELINE UNAVAILABLE';

        this.renderDashboardAiSummary(data);

        // 5. Flood-risk model is not connected
        document.getElementById('flood-risk-score').textContent = '—';
        const riskLevelEl = document.getElementById('flood-risk-level');
        riskLevelEl.textContent = 'MODEL UNAVAILABLE';
        riskLevelEl.className = 'risk-level-badge';
        document.getElementById('flood-affected-area').textContent = 'Unavailable';
        document.getElementById('flood-time-window').textContent = 'Unavailable';
        document.getElementById('flood-confidence').textContent = 'Unavailable';
        const xaiList = document.getElementById('flood-xai-factors');
        if (xaiList) {
            xaiList.innerHTML = '<li>Live flood-risk modeling is not currently connected.</li><li>Open-Meteo weather values provide context only and are not an official flood warning.</li>';
        }

        // 6. Nowcast Track (15m to 180m)
        const nowcastContainer = document.getElementById('nowcast-step-container');
        if (nowcastContainer && nowcast.nowcastSteps?.length) {
            nowcastContainer.innerHTML = nowcast.nowcastSteps.map(step => `
                <div class="nowcast-card">
                    <span class="nc-lead">${step.label}</span>
                    <span class="nc-rain">${step.expectedRainfallMmHr} mm/hr</span>
                    <span class="nc-prob">Prob: ${step.probabilityPct}%</span>
                    <span class="nc-conf">${step.confidenceInterval}</span>
                    <span style="font-size:0.65rem; color:var(--text-muted);">${step.intensityClassification}</span>
                </div>
            `).join('');
        } else if (nowcastContainer) {
            nowcastContainer.innerHTML = '<div class="empty-state-box"><strong>NOWCAST UNAVAILABLE</strong><p>A radar-based short-term precipitation nowcast is not connected.</p></div>';
        }

        // 7. Active Warnings: Official vs AI Warnings
        const officialContainer = document.getElementById('official-alerts-container');
        if (officialContainer) {
            officialContainer.innerHTML = alerts.officialAlerts.length ? alerts.officialAlerts.map(oa => `
                <div style="background:var(--surface-slate-2); border-left:4px solid #ef4444; padding:12px; border-radius:4px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <strong style="color:#ef4444; font-size:0.85rem;">${oa.headline}</strong>
                        <span class="mono" style="font-size:0.68rem; color:var(--text-muted);">${oa.severity.toUpperCase()}</span>
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px;">${oa.description}</p>
                    <div style="font-size:0.7rem; color:var(--text-muted); font-family:monospace;">
                        Issued by: ${oa.issuer} • Valid until: ${new Date(oa.expires).toLocaleTimeString()}
                    </div>
                </div>
            `).join('') : '<p class="empty-alerts-box">No official warning feed is connected. Consult current IMD and local emergency-service guidance.</p>';
        }

        const aiContainer = document.getElementById('ai-alerts-container');
        if (aiContainer) {
            const weatherInsights = buildSmartAlerts(data);
            aiContainer.innerHTML = weatherInsights.length ? weatherInsights.map(insight => `
                <div style="background:var(--surface-slate-2); border-left:4px solid #38bdf8; padding:12px; border-radius:4px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <strong style="color:#38bdf8; font-size:0.85rem;">${insight.title}</strong>
                        <span class="mono" style="font-size:0.68rem; color:#38bdf8;">AI WEATHER INSIGHT</span>
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px;">
                        ${insight.reason}
                    </p>
                    <div style="font-size:0.7rem; color:var(--text-muted); font-family:monospace;">
                        Based on Open-Meteo forecast data. Advisory only; not an official warning.
                    </div>
                </div>
            `).join('') : '<p class="empty-alerts-box">No thresholded AI weather insight is available from the current forecast variables.</p>';
        }

        // 8. Hourly Forecast Scroll
        const hourlyContainer = document.getElementById('hourly-forecast-track');
        hourlyContainer.innerHTML = '';
        if (!hourly.length) hourlyContainer.innerHTML = '<div class="empty-state-box">Open-Meteo hourly forecast data is unavailable.</div>';
        hourly.forEach(item => {
            const hourDiv = document.createElement('div');
            hourDiv.className = 'hourly-item';
            const displayHour = item.time.slice(11, 16);
            hourDiv.innerHTML = `
                <span class="h-time mono">${displayHour}</span>
                <span class="h-icon">${item.icon}</span>
                <span class="h-temp">${weatherService.formatTemp(item.temp, prefs.temperature)}</span>
                <span class="h-pop">💧 ${item.precipitationProbability}%</span>
                <span class="h-rain mono">${weatherService.formatPrecip(item.rainAmount, prefs.precipitation)}</span>
            `;
            hourlyContainer.appendChild(hourDiv);
        });

        // 9. Daily Forecast List
        const dailyContainer = document.getElementById('daily-forecast-container');
        dailyContainer.innerHTML = '';
        if (!daily.length) dailyContainer.innerHTML = '<div class="empty-state-box">Open-Meteo daily forecast data is unavailable.</div>';
        daily.forEach((d, idx) => {
            const dateObj = new Date(d.date);
            const dayName = idx === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const row = document.createElement('div');
            row.className = 'daily-row';
            row.innerHTML = `
                <div class="d-day-name">
                    <div>${dayName}</div>
                    <div style="font-size:0.68rem; color:var(--text-muted);">${monthDay}</div>
                </div>
                <div class="d-condition-info">
                    <span style="font-size:1.2rem;">${d.icon}</span>
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${d.condition}</span>
                </div>
                <div class="d-pop-bar-wrap">
                    <div class="d-pop-track">
                        <div class="d-pop-fill" style="width:${d.rainProbability ?? 0}%;"></div>
                    </div>
                    <span class="d-pop-val mono">${d.rainProbability == null ? '—' : `${d.rainProbability}%`}</span>
                </div>
                <div class="d-temp-range">
                    <span class="d-max-temp">${weatherService.formatTemp(d.maxTemp, prefs.temperature)}</span>
                    <span class="d-min-temp">${weatherService.formatTemp(d.minTemp, prefs.temperature)}</span>
                </div>
            `;
            dailyContainer.appendChild(row);
        });

        const dashboard = document.getElementById('view-dashboard');
        [
            document.getElementById('dashboard-hourly'),
            document.getElementById('dashboard-daily'),
            document.getElementById('dashboard-ai-summary'),
            document.getElementById('dashboard-precip-risk'),
            document.getElementById('dashboard-nowcast'),
            document.getElementById('dashboard-alert-panels')
        ].filter(Boolean).forEach(section => dashboard.appendChild(section));
    }

    renderDashboardAiSummary(data) {
        const target = document.querySelector('#view-dashboard .dashboard-header');
        if (!target) return;

        const assessment = buildAiAssessment(data);
        const card = document.getElementById('dashboard-ai-summary');
        const html = `
            <div id="dashboard-ai-summary" class="dashboard-ai-summary">
                <div class="ai-summary-header">
                    <span class="ai-summary-label">AI WEATHER INSIGHT</span>
                    <span class="mono">${assessment.available ? 'ADVISORY' : 'UNAVAILABLE'}</span>
                </div>
                <div class="ai-summary-body">
                    <div>
                        <p>${assessment.summary}</p>
                        ${assessment.insights.map(insight => `
                            <div class="ai-insight-line">
                                <strong>${insight.title}</strong>
                                <p>${insight.detail}</p>
                                <span>Based on: ${insight.basis.join(', ')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <small>Analytical guidance only; not an official warning.</small>
            </div>
        `;

        if (card) card.outerHTML = html;
        else target.insertAdjacentHTML('afterend', html);
    }

    /**
     * Render Radar Operations Scope View
     */
    renderRadarView(data) {
        const container = document.getElementById('radar-view-container');
        if (!container) return;

        container.innerHTML = `
            <div class="section-card">
                <div class="section-card-header">
                    <div class="section-card-title"><span>RADAR</span></div>
                    <span class="mono">LIVE FEED UNAVAILABLE</span>
                </div>
                <div class="radar-placeholder-panel" aria-live="polite" style="min-height:360px; display:grid; place-items:center;">
                    <div class="empty-state-box">
                        <strong>LIVE FEED UNAVAILABLE</strong>
                        <p>Radar imagery is not connected to a live meteorological provider.</p>
                        <p>Data status: UNAVAILABLE</p>
                        <a class="btn-secondary" href="#/map">Open location map</a>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Satellite Telemetry View
     */
    renderSatelliteView(data) {
        const container = document.getElementById('satellite-view-container');
        if (!container) return;

        container.innerHTML = `
            <div class="section-card">
                <div class="section-card-header">
                    <div class="section-card-title"><span>SATELLITE</span></div>
                    <span class="mono">LIVE IMAGERY UNAVAILABLE</span>
                </div>
                <div class="empty-state-box">
                    <strong>LIVE IMAGERY UNAVAILABLE</strong>
                    <p>Satellite imagery provider is not currently connected.</p>
                    <p>Data status: UNAVAILABLE</p>
                </div>
            </div>
        `;
    }

    /**
     * Render NWP Multi-Model Comparative View
     */
    renderNwpView(data) {
        const { nwp } = data || {};
        const container = document.getElementById('nwp-view-container');
        if (!container) return;

        const modelInfo = buildNwpModelCenter(data);

        if (!modelInfo.available) {
            container.innerHTML = `
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>NWP MODEL CENTER</span>
                        </div>
                        <span class="mono">MODEL DATA UNAVAILABLE</span>
                    </div>
                    <div class="empty-state-box">
                        <strong>Model comparison requires model-specific forecast data.</strong>
                        <p>No model-specific forecast feed is currently connected for this location.</p>
                    </div>
                </div>
            `;
            return;
        }

        const rangeTemp = Math.max(...modelInfo.models.map(m => Number(m.tempC))) - Math.min(...modelInfo.models.map(m => Number(m.tempC)));
        const rangeRain = Math.max(...modelInfo.models.map(m => Number(m.precip24hMm))) - Math.min(...modelInfo.models.map(m => Number(m.precip24hMm)));

        container.innerHTML = `
            <div class="section-card" style="margin-bottom:16px;">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>NWP MODEL CENTER</span>
                    </div>
                    <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">COMPARE NUMERICAL WEATHER PREDICTION GUIDANCE</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:8px; line-height:1.6;">
                    ${nwp?.synopticDiagnosis || 'Model comparison is based on connected model outputs.'}
                </p>
                <p class="small-muted">Source: ${nwp.provenance.source} · Retrieved ${new Date(nwp.provenance.timestamp).toLocaleString()}</p>
            </div>

            <div class="dash-two-col">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>MODEL CONSENSUS</span>
                        </div>
                        <span class="mono">${modelInfo.consensus}</span>
                    </div>
                    <div class="nwp-consensus-box">
                        <strong>${modelInfo.uncertainty}</strong>
                        <p>${modelInfo.consensusReason}</p>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>MODEL DIFFERENCES</span>
                        </div>
                        <span class="mono">${modelInfo.disagreement}</span>
                    </div>
                    <div class="nwp-diff-list">
                        <div><span>Temperature</span><strong>${rangeTemp.toFixed(1)}°C</strong></div>
                        <div><span>Precipitation</span><strong>${rangeRain.toFixed(1)} mm</strong></div>
                    </div>
                </div>
            </div>

            <div class="section-card" style="margin-top:18px;">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>FORECAST UNCERTAINTY</span>
                    </div>
                    <span class="mono">${modelInfo.uncertainty}</span>
                </div>
                <div class="nwp-model-grid">
                    ${modelInfo.models.map(model => `
                        <article class="nwp-model-card" data-model-id="${model.id}">
                            <div class="nwp-card-top">
                                <div>
                                    <strong>${model.name}</strong>
                                    <span>${model.agency}</span>
                                </div>
                            </div>
                            <div class="nwp-metrics">
                                <div><span>Temperature</span><strong>${model.tempC}°C</strong></div>
                                <div><span>Rain probability</span><strong>${model.cloudburstProbability == null ? '—' : `${model.cloudburstProbability}%`}</strong></div>
                                <div><span>Rainfall</span><strong>${model.precip24hMm} mm</strong></div>
                                <div><span>Wind</span><strong>${model.windKmh == null ? '—' : `${model.windKmh} km/h`}</strong></div>
                                <div><span>Pressure</span><strong>${model.pressureHpa == null ? '—' : `${model.pressureHpa} hPa`}</strong></div>
                                <div><span>Humidity</span><strong>${model.humidityPct == null ? '—' : `${model.humidityPct}%`}</strong></div>
                            </div>
                        </article>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render Heavy Rainfall Operations Center
     */
    renderRainfallView(data) {
        const { snapshot, hourly = [], daily = [] } = data;
        const container = document.getElementById('rainfall-view-container');
        if (!container) return;

        const nextHours = hourly.slice(0, 6);
        const probabilities = nextHours.map(item => item.precipitationProbability).filter(value => value != null);
        const maxProbability = probabilities.length ? Math.max(...probabilities) : null;
        const today = daily[0];

        container.innerHTML = `
            <div class="dash-two-col">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>🌧️ Open-Meteo Precipitation</span>
                        </div>
                        <span class="mono">LIVE FORECAST</span>
                    </div>

                    <div class="rainfall-accum-grid">
                        <div class="accum-item">
                            <span class="accum-lbl">Current precipitation</span>
                            <span class="accum-val">${weatherService.formatPrecip(snapshot.precipitation, StorageService.getPreferences().precipitation)}</span>
                            <span class="accum-sub">Open-Meteo current interval, not a rate</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Next 6-hour precipitation probability</span>
                            <span class="accum-val">${maxProbability == null ? 'Unavailable' : `${maxProbability}%`}</span>
                            <span class="accum-sub">Maximum hourly forecast probability</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">3-Hour Acc.</span>
                            <span class="accum-val">Unavailable</span>
                            <span class="accum-sub">Gauge history not connected</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">6-Hour Acc.</span>
                            <span class="accum-val">Unavailable</span>
                            <span class="accum-sub">Gauge history not connected</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">24-Hour Acc.</span>
                            <span class="accum-val">${weatherService.formatPrecip(today?.precipitationSum, StorageService.getPreferences().precipitation)}</span>
                            <span class="accum-sub">Open-Meteo daily forecast total</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Rainfall Anomaly</span>
                            <span class="accum-val">BASELINE UNAVAILABLE</span>
                            <span class="accum-sub">Historical climatology not connected</span>
                        </div>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>⏱️ 15 to 180 Minute Nowcasting Progression</span>
                        </div>
                        <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">UNAVAILABLE</span>
                    </div>

                    <div class="empty-state-box" style="margin-top:14px;">
                        <strong>NOWCAST UNAVAILABLE</strong>
                        <p>A live radar feed and connected nowcast model are required.</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Inundation & Hydrodynamic Modeler View
     */
    renderFloodRiskView(data) {
        const container = document.getElementById('flood-risk-view-container');
        if (!container) return;

        container.innerHTML = `
            <div class="section-card">
                <div class="section-card-header">
                    <div class="section-card-title"><span>FLOOD RISK</span></div>
                    <span class="mono">MODEL UNAVAILABLE</span>
                </div>
                <div class="empty-state-box">
                    <strong>Live flood-risk modeling is not currently connected.</strong>
                    <p>Available weather data can provide rainfall context, but this dashboard does not provide an official flood warning.</p>
                    <p>Status: EXPERIMENTAL / DATA SOURCE REQUIRED</p>
                </div>
            </div>
        `;
    }

    /**
     * Render TITAN/SCIT Meso-Convective Storm Cell Tracking View
     */
    renderStormTrackingView(data) {
        const container = document.getElementById('storm-tracking-view-container');
        if (!container) return;

        container.innerHTML = `
            <div class="section-card">
                <div class="section-card-header">
                    <div class="section-card-title"><span>STORM TRACKING</span></div>
                    <span class="mono">NO LIVE STORM DATA PROVIDER CONNECTED</span>
                </div>
                <div class="empty-state-box">
                    <strong>NO LIVE STORM DATA PROVIDER CONNECTED</strong>
                    <p>No active storm-track dataset is currently available.</p>
                    <p>Data status: UNAVAILABLE</p>
                </div>
            </div>
        `;
    }

    /**
     * Render Alerts & Disaster Response Center View
     */
    renderAlertsView(data) {
        const { alerts } = data || {};
        const container = document.getElementById('alerts-full-page-container');
        if (!container) return;

        const smartAlerts = buildSmartAlerts(data);
        const alertCards = smartAlerts;

        const deduped = new Map();
        alertCards.forEach(alert => {
            const key = `${alert.type || alert.title}:${alert.location}:${alert.severity}:${alert.timeWindow}`;
            if (!deduped.has(key)) deduped.set(key, alert);
        });

        const uniqueAlerts = Array.from(deduped.values());

        container.innerHTML = `
            <div class="dash-two-col">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title" style="color:#ef4444;">
                            <span>🏛️ Official Warning Feed</span>
                        </div>
                        <span class="mono badge-official">DATA SOURCE UNAVAILABLE</span>
                    </div>
                    ${alerts?.officialAlerts?.length ? alerts.officialAlerts.map(oa => `
                        <div style="background:var(--surface-slate-2); border-left:4px solid #ef4444; padding:14px; border-radius:6px; margin-top:12px;">
                            <strong style="color:#ef4444; font-size:0.95rem;">${oa.headline}</strong>
                            <p style="font-size:0.8rem; color:var(--text-secondary); margin:6px 0;">${oa.description}</p>
                            <p style="font-size:0.78rem; color:var(--text-primary); margin-bottom:8px;">
                                <strong>Directives:</strong> ${oa.instruction}
                            </p>
                            <div class="mono" style="font-size:0.7rem; color:var(--text-muted);">
                                ${oa.issuer} • Valid: ${new Date(oa.effective).toLocaleTimeString()} - ${new Date(oa.expires).toLocaleTimeString()}
                            </div>
                        </div>
                    `).join('') : '<p class="empty-alerts-box">No official warning feed is connected. Check IMD and local emergency-service channels for agency updates.</p>'}
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title" style="color:var(--cyan-primary);">
                            <span>🧠 SMART ALERT CENTER</span>
                        </div>
                        <span class="mono" style="color:var(--cyan-primary); font-size:0.75rem;">AI WEATHER INSIGHT</span>
                    </div>
                    <div class="smart-alert-list">
                        ${uniqueAlerts.length ? uniqueAlerts.map(alert => `
                            <div class="alert-card smart-alert-item" data-alert-id="${alert.id}">
                                <div class="smart-alert-header">
                                    <span class="smart-alert-icon">${alert.icon}</span>
                                    <div>
                                        <strong>${alert.title}</strong>
                                        <span>${alert.location}</span>
                                    </div>
                                    <span class="smart-alert-severity ${String(alert.severity).toLowerCase()}">${alert.severity}</span>
                                </div>
                                <p>${alert.reason}</p>
                                <div class="smart-alert-meta">
                                    <span>${alert.category || 'AI WEATHER INSIGHT'}</span>
                                    <span>${alert.timeWindow}</span>
                                    <span>${alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time unavailable'}</span>
                                    <span>${alert.source}</span>
                                </div>
                                <div class="alert-effects">
                                    <strong>Expected:</strong> ${alert.expectedEffect || 'Conditions may shift with local rainfall and wind changes.'}
                                </div>
                            </div>
                        `).join('') : '<p class="empty-alerts-box">No thresholded AI weather insight is available from the current Open-Meteo variables. Insights are advisory, not official warnings.</p>'}
                    </div>
                </div>
            </div>
        `;

        container.querySelectorAll('[data-demo-incident]').forEach(button => {
            button.addEventListener('click', () => {
                const incident = alerts.operatorAlerts.find(item => item.id === button.dataset.demoIncident);
                if (!incident) return;
                incident.status = button.dataset.demoStatus;
                this.renderAlertsView(data);
                this.showGlobalToast('Demo status updated locally; no responder was contacted.', 'info');
            });
        });
    }

    /**
     * Render Historical Meteorological Events View
     */
    renderHistoryView(data) {
        const container = document.getElementById('history-view-container');
        if (!container) return;

        const analytics = buildHistoricalAnalytics(data);

        if (!analytics.available) {
            container.innerHTML = `
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>HISTORY & CLIMATE ANALYTICS</span>
                        </div>
                        <span class="mono">HISTORY UNAVAILABLE</span>
                    </div>
                    <div class="empty-state-box">
                        <strong>${analytics.message}</strong>
                        <p>${analytics.detail}</p>
                    </div>
                </div>
            `;
            return;
        }

        const bars = [
            { label: 'Temperature', value: analytics.metrics.avgTemp, suffix: '°C' },
            { label: 'Rainfall', value: analytics.metrics.avgRain, suffix: 'mm' },
            { label: 'Humidity', value: analytics.metrics.avgHumidity, suffix: '%' },
            { label: 'Wind', value: analytics.metrics.avgWind, suffix: 'km/h' }
        ];

        container.innerHTML = `
            <div class="dash-two-col">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>HISTORY & CLIMATE ANALYTICS</span>
                        </div>
                        <span class="mono">CURRENT PERIOD</span>
                    </div>
                    <div class="history-stat-grid">
                        ${bars.map(item => `
                            <div class="history-chart">
                                <span>${item.label}</span>
                                <strong>${item.value}${item.suffix}</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>WEATHER ANOMALIES</span>
                        </div>
                        <span class="mono">ANOMALY UNAVAILABLE</span>
                    </div>
                    <div class="empty-state-box">
                        <strong>Historical baseline data is required.</strong>
                        <p>No valid historical baseline exists for this location, so anomaly comparison is unavailable.</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderCompareView(data) {
        const container = document.getElementById('compare-view-container');
        if (!container) return;

        const locations = buildLocationComparison(data);
        const current = data?.snapshot?.location?.name || 'Current location';

        container.innerHTML = `
            <div class="section-card">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>LOCATION COMPARISON MATRIX</span>
                    </div>
                    <span class="mono">${current}</span>
                </div>
                <div class="comparison-table">
                    <div class="comparison-row comparison-header">
                        <span>Location</span>
                        <span>Temp</span>
                        <span>Rain</span>
                        <span>Wind</span>
                        <span>Humidity</span>
                        <span>UV</span>
                    </div>
                    ${locations.map(loc => `
                        <div class="comparison-row">
                            <span>${loc.name}</span>
                            <span>${loc.temperature == null ? '—' : `${loc.temperature}°C`}</span>
                            <span>${loc.rain == null ? '—' : `${loc.rain}%`}</span>
                            <span>${loc.wind == null ? '—' : `${loc.wind} km/h`}</span>
                            <span>${loc.humidity == null ? '—' : `${loc.humidity}%`}</span>
                            <span>${loc.uv == null ? '—' : loc.uv}</span>
                        </div>
                    `).join('')}
                </div>
                    <p class="small-muted">Other locations require their own live weather requests and are not shown as observations.</p>
            </div>
        `;
    }

    /**
     * Render AI Analysis & Model Registry View
     */
    renderAiAnalysisView(data) {
        const container = document.getElementById('ai-analysis-view-container');
        if (!container) return;

        const assessment = buildAiAssessment(data);
        const weatherStory = buildWeatherStory(data);
        const weatherBrief = buildAiWeatherBrief(data);
        const comparison = buildLocationComparison(data);

        container.innerHTML = `
            <div class="section-card" style="margin-bottom:16px;">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>🧠 MeghDrishti AI Intelligence Center</span>
                    </div>
                    <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">${assessment.available ? 'OPEN-METEO · ADVISORY' : 'INSIGHTS UNAVAILABLE'}</span>
                </div>
                <div class="ai-overview-shell">
                    <div>
                        <div class="ai-overview-kicker">AI WEATHER INSIGHT</div>
                        <h3>${assessment.available ? 'Evidence-based weather analysis' : 'Weather analysis unavailable'}</h3>
                        <p>${assessment.summary}</p>
                    </div>
                </div>
                <p class="small-muted">Advisory analysis only; this is not an official warning.</p>
            </div>

            <div class="dash-two-col" style="margin-bottom:18px;">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📝 WEATHER STORY</span>
                        </div>
                        <span class="mono">BASED ON AVAILABLE VARIABLES</span>
                    </div>
                    <div class="story-box">
                        <strong>${weatherStory.headline}</strong>
                        <p>${weatherStory.summary}</p>
                        <div class="story-meta-list">
                            <div><span>WHY?</span><ul>${weatherStory.why.map(item => `<li>${item}</li>`).join('')}</ul></div>
                            <div><span>WHAT TO EXPECT</span><ul>${weatherStory.expected.map(item => `<li>${item}</li>`).join('')}</ul></div>
                        </div>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📌 AI WEATHER BRIEF</span>
                        </div>
                        <span class="mono">DATA-BACKED</span>
                    </div>
                    <div class="brief-box">
                        ${weatherBrief.sections.length ? weatherBrief.sections.map(section => `
                            <div class="brief-row">
                                <span>${section.title}</span>
                                <p>${section.text}</p>
                            </div>
                        `).join('') : '<p class="empty-alerts-box">Live Open-Meteo forecast data is unavailable.</p>'}
                    </div>
                </div>
            </div>

            <div class="dash-two-col">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>🔍 Key AI Insights</span>
                        </div>
                        <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">EXPLAINABLE AI</span>
                    </div>
                    <div class="ai-insight-grid">
                        ${assessment.insights.length ? assessment.insights.map((insight) => `
                            <div class="ai-insight-card">
                                <div class="ai-insight-head">
                                    <span>${insight.icon}</span>
                                    <strong>${insight.title}</strong>
                                </div>
                                <p>${insight.detail}</p>
                                <div class="ai-insight-why">
                                    <span>BASED ON</span>
                                    <ul>
                                        ${insight.basis.map(reason => `<li>${reason}</li>`).join('')}
                                    </ul>
                                </div>
                                <div class="ai-insight-period">${insight.period}</div>
                            </div>
                        `).join('') : '<p class="empty-alerts-box">No data-backed insight is available from the current weather response.</p>'}
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📌 Recommendations</span>
                        </div>
                        <span class="mono" style="font-size:0.75rem; color:var(--text-muted);">ACTIONABLE</span>
                    </div>
                    <ul class="ai-recommendation-list">
                        ${assessment.recommendations.length ? assessment.recommendations.map(item => `<li>${item}</li>`).join('') : '<li>No recommendation is available from the current weather variables.</li>'}
                    </ul>
                </div>
            </div>

            <div class="dash-two-col" style="margin-top:18px;">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📊 Model Consensus</span>
                        </div>
                        <span class="mono" style="font-size:0.75rem; color:var(--text-muted);">MODEL DATA UNAVAILABLE</span>
                    </div>
                    <div class="model-consensus-box">
                        <strong>N/A</strong>
                        <p>Numerical weather prediction model comparison is not connected to a dedicated model-data source.</p>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📍 Compare Locations</span>
                        </div>
                        <span class="mono" style="font-size:0.75rem; color:var(--text-muted);">CURRENT LOCATION ONLY</span>
                    </div>
                    <div class="comparison-table">
                        <div class="comparison-row comparison-header">
                            <span>Location</span>
                            <span>Temp</span>
                            <span>Rain</span>
                            <span>Wind</span>
                            <span>UV</span>
                        </div>
                        ${comparison.map(loc => `
                            <div class="comparison-row">
                                <span>${loc.name}</span>
                                <span>${loc.temperature == null ? '—' : `${loc.temperature}°`}</span>
                                <span>${loc.rain == null ? '—' : `${loc.rain}%`}</span>
                                <span>${loc.wind == null ? '—' : `${loc.wind} km/h`}</span>
                                <span>${loc.uv == null ? '—' : loc.uv}</span>
                            </div>
                        `).join('')}
                    </div>
                    <p class="small-muted">Other locations require their own live weather requests and are not shown as observations.</p>
                </div>
            </div>
        `;
    }

    /**
     * Render Operations & System Observability View
     */
    renderOperationsView(data) {
        const { observability } = data;
        const container = document.getElementById('operations-view-container');
        if (!container) return;

        container.innerHTML = `
            <div class="ops-kpi-grid">
                <div class="ops-kpi-card">
                    <span class="ops-kpi-lbl">Ingestion Runs</span>
                    <span class="ops-kpi-val">${observability.totalIngestionRuns}</span>
                    <span class="ops-kpi-sub">No ingestion service connected</span>
                </div>
                <div class="ops-kpi-card">
                    <span class="ops-kpi-lbl">Provider Ingestion Latency</span>
                    <span class="ops-kpi-val">${observability.avgLatencyMs ?? '--'}</span>
                    <span class="ops-kpi-sub">No ingestion service connected</span>
                </div>
                <div class="ops-kpi-card">
                    <span class="ops-kpi-lbl">Sensor QC Flags</span>
                    <span class="ops-kpi-val">Unavailable</span>
                    <span class="ops-kpi-sub">No ground-sensor feed is connected</span>
                </div>
                <div class="ops-kpi-card">
                    <span class="ops-kpi-lbl">Operational Node</span>
                    <span class="ops-kpi-val" style="font-size:1.15rem; color:var(--text-primary);">Local demo</span>
                    <span class="ops-kpi-sub">No operational node configured</span>
                </div>
            </div>

            <div class="section-card" style="margin-top:16px;">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>📋 Data Connections</span>
                    </div>
                    <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">NO LOCAL BACKEND</span>
                </div>
                <div class="audit-stream-box">
                    <div>Weather and location search: Open-Meteo public API; no API key configured or required.</div>
                    <div>Radar, satellite, ground observations, NWP, flood modeling, and official alerts: unavailable; providers are not connected.</div>
                    <div>Firebase and Gemini are Android integrations; this web client does not call them.</div>
                    <div>No project-owned API backend is configured.</div>
                </div>
            </div>
        `;
    }

    /**
     * Render Notifications Dropdown
     */
    renderNotificationsDropdown(data) {
        const container = document.getElementById('notifs-list');
        if (!container) return;

        const { alerts } = data;
        const allNotifs = [
            ...(alerts.officialAlerts || []).map(oa => ({
                title: oa.headline,
                time: oa.effective ? new Date(oa.effective).toLocaleTimeString() : 'Time unavailable',
                desc: oa.description
            })),
            ...buildSmartAlerts(data).map(insight => ({
                title: `AI Weather Insight: ${insight.title}`,
                time: insight.timestamp ? new Date(insight.timestamp).toLocaleTimeString() : 'Time unavailable',
                desc: `${insight.reason} Advisory only; not an official warning.`
            }))
        ];

        container.innerHTML = allNotifs.map(n => `
            <div class="notif-item">
                <span class="notif-title">${n.title}</span>
                <span class="notif-time mono">${n.time}</span>
                <span class="notif-desc">${n.desc}</span>
            </div>
        `).join('');

        const countBadge = document.getElementById('notif-count-badge');
        if (countBadge) countBadge.textContent = allNotifs.length;
    }

    /**
     * Setup Mode Toggle (LIVE vs DEMO)
     */
    setupModeToggle() {
        const btn = document.getElementById('btn-mode-toggle');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const currentMode = weatherService.getDataMode();
            const newMode = currentMode === DataMode.LIVE ? DataMode.DEMO : DataMode.LIVE;
            weatherService.setDataMode(newMode);
            this.updateModeIndicators();
            this.loadWeatherForCurrentLocation();
            this.showGlobalToast(`Weather source switched to ${newMode === DataMode.LIVE ? 'Open-Meteo' : 'local demo'}`, 'info');
        });
    }

    updateModeIndicators() {
        const mode = weatherService.getDataMode();
        const btn = document.getElementById('btn-mode-toggle');
        const textEl = document.getElementById('mode-text');
        const sidebarStatus = document.getElementById('sidebar-mode-status');

        const snapshot = this.weatherData?.snapshot;
        const isLiveWeather = mode === DataMode.LIVE && snapshot?.available && !snapshot.isDemo;
        const isDemoWeather = mode === DataMode.DEMO || snapshot?.isDemo === true;
        if (isLiveWeather) {
            if (btn) {
                btn.className = 'mode-toggle-badge live';
                if (textEl) textEl.textContent = 'OPEN-METEO WEATHER';
            }
            if (sidebarStatus) sidebarStatus.textContent = 'Weather: Open-Meteo';
        } else if (isDemoWeather) {
            if (btn) {
                btn.className = 'mode-toggle-badge demo';
                if (textEl) textEl.textContent = 'DEMO WEATHER';
            }
            if (sidebarStatus) sidebarStatus.textContent = 'Weather: demo';
        } else {
            if (btn) {
                btn.className = 'mode-toggle-badge unavailable';
                if (textEl) textEl.textContent = 'OPEN-METEO UNAVAILABLE';
            }
            if (sidebarStatus) sidebarStatus.textContent = 'Weather: unavailable';
        }
    }

    /**
     * Map View Setup with Leaflet
     */
    initOrUpdateMap() {
        const mapEl = document.getElementById('leaflet-map-element');
        if (!mapEl) return;
        if (!window.L) {
            mapEl.textContent = 'Map library unavailable. Check the external Leaflet connection.';
            return;
        }

        const { lat, lon, name } = this.currentLocation;

        if (!this.leafletMap) {
            this.leafletMap = L.map('leaflet-map-element').setView([lat, lon], 9);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(this.leafletMap);

            this.mapLayerGroup = L.layerGroup().addTo(this.leafletMap);
        } else {
            this.leafletMap.setView([lat, lon], 9);
            this.leafletMap.invalidateSize();
        }

        // Draw Inundation Hazard Polygon
        if (this.mapLayerGroup) {
            this.mapLayerGroup.clearLayers();

            const marker = L.marker([lat, lon]).addTo(this.mapLayerGroup);
            marker.bindPopup(`<b>${name}</b><br>Selected location; weather overlays unavailable.`).openPopup();
        }
    }

    /** Search and select one of the supported Andhra Pradesh locations. */
    setupGlobalSearch() {
        const searchInput = document.getElementById('global-search-input');
        const dropdown = document.getElementById('search-results-dropdown');
        if (!searchInput || !dropdown) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);

            if (query.length < 2) {
                dropdown.innerHTML = '';
                dropdown.classList.remove('active');
                return;
            }

            this.searchDebounceTimer = setTimeout(async () => {
                dropdown.innerHTML = '<div class="search-item">Searching Andhra Pradesh locations...</div>';
                dropdown.classList.add('active');

                const results = await weatherService.searchLocations(query);
                if (!results.length) {
                    dropdown.innerHTML = '<div class="search-item">No matching locations found.</div>';
                    return;
                }

                dropdown.innerHTML = results.map(loc => `
                    <div class="search-item" data-lat="${loc.lat}" data-lon="${loc.lon}" data-name="${loc.name}" data-region="${loc.region}" data-country="${loc.country}" data-tz="${loc.timezone}">
                        <div class="search-item-title">${loc.name}</div>
                        <div class="search-item-sub">${[loc.region, loc.country].filter(Boolean).join(', ')} • ${loc.timezone}</div>
                    </div>
                `).join('');

                dropdown.querySelectorAll('.search-item').forEach(el => {
                    el.addEventListener('click', () => {
                        const targetLat = parseFloat(el.getAttribute('data-lat'));
                        const targetLon = parseFloat(el.getAttribute('data-lon'));
                        const targetName = el.getAttribute('data-name');
                        const targetTz = el.getAttribute('data-tz');

                        this.currentLocation = {
                            id: `loc-${Date.now()}`,
                            name: targetName,
                            region: el.getAttribute('data-region'),
                            country: el.getAttribute('data-country'),
                            lat: targetLat,
                            lon: targetLon,
                            timezone: targetTz
                        };

                        searchInput.value = '';
                        dropdown.classList.remove('active');
                        this.loadWeatherForCurrentLocation();
                    });
                });
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    }

    /**
     * Topbar Events & Notification Toggle
     */
    setupTopbarEvents() {
        const themeButton = document.getElementById('btn-theme-toggle');
        if (themeButton) {
            themeButton.addEventListener('click', () => {
                const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                StorageService.setPreferences({ theme: nextTheme });
                this.applyTheme(nextTheme);
            });
        }

        const notifBtn = document.getElementById('btn-toggle-notifs');
        const notifDropdown = document.getElementById('notifs-dropdown');
        if (notifBtn && notifDropdown) {
            notifBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                notifDropdown.classList.toggle('active');
            });
            document.addEventListener('click', (e) => {
                if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                    notifDropdown.classList.remove('active');
                }
            });
        }

        const refreshBtn = document.getElementById('btn-refresh-now');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadWeatherForCurrentLocation(true));
        }

        const saveLocBtn = document.getElementById('btn-save-current-loc');
        if (saveLocBtn) {
            saveLocBtn.addEventListener('click', () => {
                const savedLocation = StorageService.addSavedLocation(this.currentLocation);
                this.renderSavedLocations();
                this.showGlobalToast(
                    savedLocation ? `Saved ${this.currentLocation.name} locally.` : 'That location is already saved.',
                    savedLocation ? 'success' : 'info'
                );
            });
        }
    }

    /**
     * Unit Switchers
     */
    setupUnitEvents() {
        const preferences = StorageService.getPreferences();
        document.querySelectorAll('.unit-opt').forEach(button => {
            button.classList.toggle('active', button.dataset.unit === preferences.temperature);
        });

        document.querySelectorAll('.unit-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.unit-opt').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const unit = btn.getAttribute('data-unit');
                StorageService.setPreferences({ temperature: unit });
                if (this.weatherData) this.renderDashboard(this.weatherData);
            });
        });
    }

    /**
     * Settings Page Events
     */
    setupSettingsEvents() {
        const saveProfBtn = document.getElementById('btn-save-profile');
        if (saveProfBtn) {
            saveProfBtn.addEventListener('click', () => {
                const user = StorageService.getUser() || {};
                user.name = document.getElementById('setting-full-name').value;
                user.full_name = user.name;
                user.organization = document.getElementById('setting-org').value;
                StorageService.setUser(user);
                this.updateSidebarUserProfile();
                this.showGlobalToast('Local demo profile saved.', 'success');
            });
        }

        const modeSelect = document.getElementById('setting-mode-select');
        if (modeSelect) {
            modeSelect.addEventListener('change', (e) => {
                weatherService.setDataMode(e.target.value);
                this.updateModeIndicators();
                this.loadWeatherForCurrentLocation();
            });
        }

        const preferenceControls = [
            ['pref-temp-select', 'temperature'],
            ['pref-wind-select', 'windSpeed'],
            ['pref-pressure-select', 'pressure'],
            ['pref-precip-select', 'precipitation'],
            ['pref-theme-select', 'theme']
        ];
        preferenceControls.forEach(([elementId, preference]) => {
            const select = document.getElementById(elementId);
            if (!select) return;
            select.addEventListener('change', () => {
                StorageService.setPreferences({ [preference]: select.value });
                if (preference === 'theme') this.applyTheme(select.value);
                else if (this.weatherData) {
                    this.renderDashboard(this.weatherData);
                    this.renderForecastExtended(this.weatherData);
                }
            });
        });
    }

    populateSettingsView() {
        const user = StorageService.getUser();
        if (user) {
            const nameEl = document.getElementById('setting-full-name');
            const emailEl = document.getElementById('setting-email');
            const orgEl = document.getElementById('setting-org');
            if (nameEl) nameEl.value = user.full_name || user.name || '';
            if (emailEl) emailEl.value = user.email || '';
            if (orgEl) orgEl.value = user.organization || '';
        }

        const modeSelect = document.getElementById('setting-mode-select');
        if (modeSelect) {
            modeSelect.value = weatherService.getDataMode();
        }

        const preferences = StorageService.getPreferences();
        [['pref-temp-select', 'temperature'], ['pref-wind-select', 'windSpeed'],
            ['pref-pressure-select', 'pressure'], ['pref-precip-select', 'precipitation'],
            ['pref-theme-select', 'theme']]
            .forEach(([elementId, preference]) => {
                const select = document.getElementById(elementId);
                if (select) select.value = preferences[preference];
            });

        const savedContainer = document.getElementById('settings-saved-locations-list');
        if (savedContainer) {
            const list = StorageService.getSavedLocations();
            savedContainer.innerHTML = list.map(l => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-slate-2); padding:10px 14px; border-radius:6px; margin-bottom:8px;">
                    <div>
                        <strong>${l.name}</strong> • ${[l.region, l.country].filter(Boolean).join(', ')} (${l.timezone})
                    </div>
                    <button class="btn-refresh" data-default-location="${l.id}" ${l.isDefault ? 'disabled' : ''}>${l.isDefault ? 'Default' : 'Set Default'}</button>
                </div>
            `).join('');

            savedContainer.querySelectorAll('[data-default-location]').forEach(button => {
                button.addEventListener('click', () => {
                    StorageService.setDefaultLocation(button.dataset.defaultLocation);
                    this.currentLocation = StorageService.getDefaultLocation();
                    this.renderSavedLocations();
                    this.populateSettingsView();
                    this.loadWeatherForCurrentLocation();
                    this.showGlobalToast(`${this.currentLocation.name} is now the default location.`, 'success');
                });
            });
        }
    }

    /**
     * Render Saved Locations List
     */
    renderSavedLocations() {
        const container = document.getElementById('sidebar-saved-locations');
        if (!container) return;

        const locations = StorageService.getSavedLocations();
        container.innerHTML = locations.map(loc => `
            <div class="saved-loc-item ${loc.name === this.currentLocation.name ? 'active' : ''}" data-lat="${loc.lat}" data-lon="${loc.lon}" data-name="${loc.name}" data-tz="${loc.timezone}">
                <span class="loc-star">${loc.isDefault ? '⭐' : '📍'}</span>
                <span class="loc-title">${loc.name}</span>
            </div>
        `).join('');

        container.querySelectorAll('.saved-loc-item').forEach(el => {
            el.addEventListener('click', () => {
                this.currentLocation = {
                    name: el.getAttribute('data-name'),
                    lat: parseFloat(el.getAttribute('data-lat')),
                    lon: parseFloat(el.getAttribute('data-lon')),
                    timezone: el.getAttribute('data-tz')
                };
                this.loadWeatherForCurrentLocation();
            });
        });
    }

    /**
     * Atmospheric Deep Dive (Sounding & QC)
     */
    renderWeatherDeepDive(data) {
        const container = document.getElementById('weather-deep-dive-grid');
        if (!container) return;

        const { snapshot } = data;
        const prefs = StorageService.getPreferences();

        container.innerHTML = `
            <div class="section-card">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>LIVE WEATHER VARIABLES</span>
                    </div>
                    <span class="mono">${snapshot.available && !snapshot.isDemo ? 'OPEN-METEO' : 'UNAVAILABLE'}</span>
                </div>
                <div class="rainfall-accum-grid">
                    <div class="accum-item">
                        <span class="accum-lbl">Temperature</span>
                        <span class="accum-val">${weatherService.formatTemp(snapshot.temperature, prefs.temperature)}</span>
                        <span class="accum-sub">Open-Meteo current field</span>
                    </div>
                    <div class="accum-item">
                        <span class="accum-lbl">Apparent temperature</span>
                        <span class="accum-val">${weatherService.formatTemp(snapshot.feelsLike, prefs.temperature)}</span>
                        <span class="accum-sub">Open-Meteo current field</span>
                    </div>
                    <div class="accum-item">
                        <span class="accum-lbl">Relative humidity</span>
                        <span class="accum-val">${snapshot.humidity == null ? '—' : `${snapshot.humidity}%`}</span>
                        <span class="accum-sub">Open-Meteo current field</span>
                    </div>
                    <div class="accum-item">
                        <span class="accum-lbl">Pressure</span>
                        <span class="accum-val">${weatherService.formatPressure(snapshot.pressure, prefs.pressure)}</span>
                        <span class="accum-sub">Open-Meteo current field</span>
                    </div>
                    <div class="accum-item">
                        <span class="accum-lbl">Wind speed</span>
                        <span class="accum-val">${weatherService.formatWind(snapshot.windSpeed, prefs.windSpeed)}</span>
                        <span class="accum-sub">Open-Meteo current field</span>
                    </div>
                    <div class="accum-item">
                        <span class="accum-lbl">Cloud cover</span>
                        <span class="accum-val">${snapshot.cloudCover == null ? '—' : `${snapshot.cloudCover}%`}</span>
                        <span class="accum-sub">Open-Meteo current field</span>
                    </div>
                </div>
            </div>

            <div class="section-card">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>ADDITIONAL DATASETS</span>
                    </div>
                    <span class="mono">UNAVAILABLE</span>
                </div>
                <div class="empty-state-box">
                    <strong>ADDITIONAL ATMOSPHERIC SOUNDING AND GROUND-SENSOR DATA UNAVAILABLE</strong>
                    <p>No connected provider supplies CAPE, CIN, station observations, or sensor quality flags.</p>
                </div>
            </div>
        `;
    }

    /**
     * Extended 14-Day Forecast View
     */
    renderForecastExtended(data) {
        const container = document.getElementById('extended-forecast-view-container');
        if (!container) return;

        const { daily } = data;
        const prefs = StorageService.getPreferences();

        container.innerHTML = `
            <div class="section-card">
                <div class="nwp-table-wrap">
                    <table class="nwp-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Condition</th>
                                <th>Max Temp</th>
                                <th>Min Temp</th>
                                <th>Rain Prob.</th>
                                <th>Precipitation Sum</th>
                                <th>Max Wind</th>
                                <th>Max UV</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${daily.length ? daily.map((d, i) => `
                                <tr>
                                    <td><strong>${new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong></td>
                                    <td><span style="margin-right:6px;">${d.icon}</span> ${d.condition}</td>
                                    <td class="mono" style="font-weight:700;">${weatherService.formatTemp(d.maxTemp, prefs.temperature)}</td>
                                    <td class="mono">${weatherService.formatTemp(d.minTemp, prefs.temperature)}</td>
                                    <td class="mono" style="color:#10b981;">${d.rainProbability == null ? '—' : `${d.rainProbability}%`}</td>
                                    <td class="mono" style="color:#38bdf8;">${weatherService.formatPrecip(d.precipitationSum, prefs.precipitation)}</td>
                                    <td class="mono">${weatherService.formatWind(d.windMax, prefs.windSpeed)}</td>
                                    <td class="mono">${d.uvMax == null ? '—' : d.uvMax.toFixed(0)}</td>
                                </tr>
                            `).join('') : '<tr><td colspan="8">Open-Meteo daily forecast data is unavailable.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Auth & Session Events
     */
    setupAuthEvents() {
        const showAuthMessage = (elementId, message, type = 'error') => {
            const element = document.getElementById(elementId);
            if (!element) return;
            element.textContent = message;
            element.className = `auth-alert-msg ${type}`;
        };

        const formLogin = document.getElementById('form-login');
        if (formLogin) {
            formLogin.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value;
                const pwd = document.getElementById('login-password').value;
                try {
                    await AuthService.login(email, pwd);
                    const redirect = this.router.currentParams.redirect;
                    if (redirect) {
                        const redirectUrl = new URL(decodeURIComponent(redirect), window.location.origin);
                        this.router.navigate(
                            redirectUrl.pathname,
                            Object.fromEntries(redirectUrl.searchParams.entries()),
                            true
                        );
                    } else {
                        this.router.navigate('/dashboard', {}, true);
                    }
                } catch (error) {
                    showAuthMessage('login-alert', error.message || 'Sign-in failed.');
                }
            });
        }

        const quickDemoBtn = document.getElementById('btn-quick-demo-login');
        if (quickDemoBtn) {
            quickDemoBtn.addEventListener('click', async () => {
                await AuthService.loginWithDemo();
                this.router.navigate('/dashboard', {}, true);
            });
        }

        const googleLoginBtn = document.getElementById('btn-google-login');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', async () => {
                await AuthService.loginWithDemo();
                this.router.navigate('/dashboard', {}, true);
            });
        }

        const formSignup = document.getElementById('form-signup');
        if (formSignup) {
            formSignup.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('signup-name').value;
                const email = document.getElementById('signup-email').value;
                const org = document.getElementById('signup-org').value;
                const pwd = document.getElementById('signup-password').value;
                const confirm = document.getElementById('signup-confirm').value;

                if (pwd !== confirm) {
                    showAuthMessage('signup-alert', 'Passwords do not match.');
                    return;
                }

                try {
                    await AuthService.signup({ fullName: name, email, password: pwd, organization: org });
                    this.router.navigate('/dashboard', {}, true);
                } catch (error) {
                    showAuthMessage('signup-alert', error.message || 'Profile creation failed.');
                }
            });
        }

        const formForgot = document.getElementById('form-forgot');
        if (formForgot) {
            formForgot.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    await AuthService.resetPassword(document.getElementById('forgot-email').value);
                    showAuthMessage('forgot-alert', 'Demo account verified. This local app does not send email.', 'success');
                } catch (error) {
                    showAuthMessage('forgot-alert', error.message || 'Reset request failed.');
                }
            });
        }

        document.querySelectorAll('.btn-toggle-pwd').forEach(button => {
            button.addEventListener('click', () => {
                const input = document.getElementById(button.getAttribute('data-target'));
                if (!input) return;
                input.type = input.type === 'password' ? 'text' : 'password';
                button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
            });
        });

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                AuthService.logout();
                this.router.navigate('/login');
            });
        }
    }

    updateSidebarUserProfile() {
        const user = AuthService.getCurrentUser();
        if (!user) return;

        const nameEl = document.getElementById('sidebar-user-name');
        const orgEl = document.getElementById('sidebar-user-org');
        const avatarEl = document.getElementById('sidebar-user-avatar');

        if (nameEl) nameEl.textContent = user.full_name || user.name || 'Demo Operator';
        if (orgEl) orgEl.textContent = user.organization || 'Local demo profile';
        if (avatarEl) {
            avatarEl.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=0284c7&color=fff`;
        }
    }

    updateRelativeTime() {
        const el = document.getElementById('refresh-time-text');
        if (el && this.lastFetchTime) {
            const elapsedMinutes = Math.floor((Date.now() - this.lastFetchTime.getTime()) / 60000);
            el.textContent = elapsedMinutes < 1 ? 'Retrieved just now' : `Retrieved ${elapsedMinutes} min ago`;
            el.title = `Open-Meteo data retrieved ${this.lastFetchTime.toLocaleString()}`;
        } else if (el) {
            el.textContent = 'Unavailable';
            el.removeAttribute('title');
        }

        const status = document.querySelector('.data-status');
        if (!status) return;
        const label = status.querySelector('.status-copy strong');
        const detail = status.querySelector('.status-copy span');
        const snapshot = this.weatherData?.snapshot;
        const isDemo = snapshot?.isDemo === true;
        const isLive = snapshot?.available === true && !isDemo;
        status.className = `data-status ${isLive ? 'status-live' : isDemo ? 'status-demo' : 'status-unavailable'}`;
        if (label) label.textContent = isLive ? 'LIVE' : isDemo ? 'DEMO' : 'UNAVAILABLE';
        if (detail) detail.textContent = isLive ? `Open-Meteo · ${el?.textContent || 'Updated'}` : isDemo ? 'Simulated weather' : 'Open-Meteo request failed';
    }

    showGlobalToast(msg, type = 'info') {
        let toast = document.getElementById('global-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'global-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 0.85rem;
                font-weight: 600;
                z-index: 9999;
                box-shadow: 0 8px 30px rgba(0,0,0,0.4);
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = msg;
        toast.style.background = type === 'error' ? '#ef4444' : (type === 'success' ? '#10b981' : '#0284c7');
        toast.style.color = '#fff';
        toast.style.opacity = '1';

        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }
}

// Instantiate and start
const app = new MeghDrishtiApp();
window.app = app;
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
