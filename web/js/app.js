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
    buildWeatherStory,
    alertThresholds
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
        this.radarAnimationTimer = null;
        this.radarAngle = 0;
        this.searchDebounceTimer = null;
        this.activeRoute = null;

        // Interactive stress-test values
        this.stressRainRate = 65; // mm/hr
        this.stressReturnPeriod = 25; // years

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

    /**
     * Start live UTC clock for the auth hero pane
     */
    startUtcClock() {
        const updateUtc = () => {
            const el = document.getElementById('auth-live-time');
            if (el) {
                const now = new Date();
                el.textContent = `${now.toISOString().slice(11, 19)} UTC`;
            }
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
                setTimeout(() => this.initRadarScope(), 150);
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
    async loadWeatherForCurrentLocation() {
        const refreshBtn = document.getElementById('btn-refresh-now');
        if (refreshBtn) refreshBtn.classList.add('spinning');

        try {
            this.weatherData = await weatherService.getWeather(this.currentLocation);
            this.lastFetchTime = new Date();

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
            this.showGlobalToast('Telemetry temporarily unavailable. Using calibrated fallback.', 'error');
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
        const { snapshot, hourly, daily, nowcast, floodRisk, alerts, groundObservations, radar } = data;
        const prefs = StorageService.getPreferences();

        // 1. Header & Location titles
        const fullLocName = [snapshot.location.name, snapshot.location.region, snapshot.location.country]
            .filter(Boolean).join(', ');
        
        document.getElementById('dash-city-title').textContent = fullLocName;
        document.getElementById('topbar-location-name').textContent = fullLocName;
        document.getElementById('dash-coordinates').textContent = 
            `${snapshot.location.lat.toFixed(4)}° N, ${snapshot.location.lon.toFixed(4)}° E (Elev: ${snapshot.location.elevation}m)`;
        document.getElementById('dash-data-source').textContent = snapshot.source;
        const qualityBadge = document.getElementById('dash-data-qc');
        if (qualityBadge) {
            qualityBadge.textContent = snapshot.isDemo ? 'DEMO / FALLBACK' : 'OPEN-METEO FORECAST';
            qualityBadge.className = `status-badge ${snapshot.isDemo ? 'status-suspect' : 'status-good'}`;
        }

        // 2. Primary Hero Weather Card
        document.getElementById('hero-temp-val').textContent = weatherService.formatTemp(snapshot.temperature, prefs.temperature);
        document.getElementById('hero-weather-icon').textContent = snapshot.conditionIcon;
        document.getElementById('hero-weather-condition').textContent = snapshot.condition;
        document.getElementById('hero-feels-like').textContent = `Feels like ${weatherService.formatTemp(snapshot.feelsLike, prefs.temperature)}`;

        if (daily.length) {
            document.getElementById('hero-temp-max').textContent = weatherService.formatTemp(daily[0].maxTemp, prefs.temperature);
            document.getElementById('hero-temp-min').textContent = weatherService.formatTemp(daily[0].minTemp, prefs.temperature);
        }

        // 3. Operational 8 Metrics Grid
        document.getElementById('metric-humidity').textContent = `${snapshot.humidity}%`;
        document.getElementById('metric-dewpoint').textContent = weatherService.formatTemp(snapshot.temperature - ((100 - snapshot.humidity) / 5), prefs.temperature);
        document.getElementById('metric-pressure').textContent = weatherService.formatPressure(snapshot.pressure, prefs.pressure);
        
        const windCompass = weatherService.degToCompass(snapshot.windDirection);
        document.getElementById('metric-wind').textContent = weatherService.formatWind(snapshot.windSpeed, prefs.windSpeed);
        document.getElementById('metric-wind-dir').textContent = `${windCompass} (${snapshot.windDirection.toFixed(0)}°)`;
        document.getElementById('metric-gusts').textContent = weatherService.formatWind(snapshot.windGust, prefs.windSpeed);
        
        document.getElementById('metric-precip').textContent = weatherService.formatPrecip(snapshot.precipitation, prefs.precipitation) + '/hr';
        document.getElementById('metric-visibility').textContent = `${snapshot.visibility.toFixed(1)} km`;
        document.getElementById('metric-vis-quality').textContent = snapshot.visibility > 5 ? 'High transparency' : 'Reduced visibility';
        
        document.getElementById('metric-uv').textContent = snapshot.uvIndex ? snapshot.uvIndex.toFixed(1) : '0';
        document.getElementById('metric-uv-level').textContent = snapshot.uvIndex > 7 ? 'High / Protective cover' : 'Moderate solar risk';
        
        document.getElementById('metric-cloudcover').textContent = `${snapshot.cloudCover}%`;
        if (snapshot.sunrise && snapshot.sunset) {
            const sr = snapshot.sunrise.slice(11, 16);
            const ss = snapshot.sunset.slice(11, 16);
            document.getElementById('metric-sun-times').textContent = `☀️ ${sr} • 🌙 ${ss}`;
        }

        // 4. Heavy Rainfall Monitor
        const curRate = snapshot.precipitation > 0 ? snapshot.precipitation : radar.rainfallRateEstimated;
        document.getElementById('rf-current-rate').textContent = `${curRate.toFixed(1)} mm/hr`;
        document.getElementById('rf-1h-acc').textContent = `${groundObservations.accumulations.r1h.toFixed(1)} mm`;
        document.getElementById('rf-3h-acc').textContent = `${groundObservations.accumulations.r3h.toFixed(1)} mm`;
        document.getElementById('rf-6h-acc').textContent = `${groundObservations.accumulations.r6h.toFixed(1)} mm`;
        document.getElementById('rf-24h-acc').textContent = `${groundObservations.accumulations.r24h.toFixed(1)} mm`;
        
        const intensityTag = curRate > 50 ? 'Extremely Heavy' : (curRate > 25 ? 'Very Heavy' : (curRate > 10 ? 'Heavy Rain' : 'Moderate'));
        document.getElementById('rf-intensity-tag').textContent = intensityTag;

        this.renderDashboardAiSummary(data);

        // 5. Inundation & Hydrodynamic Flood Risk Card
        document.getElementById('flood-risk-score').textContent = floodRisk.score;
        const riskLevelEl = document.getElementById('flood-risk-level');
        riskLevelEl.textContent = `${floodRisk.level} RISK`;
        riskLevelEl.className = `risk-level-badge level-${floodRisk.level.toLowerCase().replace(' ', '-')}`;
        document.getElementById('flood-affected-area').textContent = `${floodRisk.affectedAreaKm2} km²`;
        document.getElementById('flood-time-window').textContent = floodRisk.timeWindow;
        document.getElementById('flood-confidence').textContent = floodRisk.confidence;

        const xaiList = document.getElementById('flood-xai-factors');
        if (xaiList) {
            xaiList.innerHTML = floodRisk.contributingFactors.map(f => `<li>${f}</li>`).join('');
        }

        // 6. Nowcast Track (15m to 180m)
        const nowcastContainer = document.getElementById('nowcast-step-container');
        if (nowcastContainer && nowcast.nowcastSteps) {
            nowcastContainer.innerHTML = nowcast.nowcastSteps.map(step => `
                <div class="nowcast-card">
                    <span class="nc-lead">${step.label}</span>
                    <span class="nc-rain">${step.expectedRainfallMmHr} mm/hr</span>
                    <span class="nc-prob">Prob: ${step.probabilityPct}%</span>
                    <span class="nc-conf">${step.confidenceInterval}</span>
                    <span style="font-size:0.65rem; color:var(--text-muted);">${step.intensityClassification}</span>
                </div>
            `).join('');
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
            aiContainer.innerHTML = alerts.aiEarlyWarnings.map(aw => `
                <div style="background:var(--surface-slate-2); border-left:4px solid #38bdf8; padding:12px; border-radius:4px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <strong style="color:#38bdf8; font-size:0.85rem;">${aw.headline}</strong>
                        <span class="mono" style="font-size:0.68rem; color:#38bdf8;">SCORE ${aw.riskScore}</span>
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px;">
                        Confidence: ${aw.confidence} • Expected Window: ${aw.timeWindow}
                    </p>
                    <div style="font-size:0.7rem; color:var(--text-muted); font-family:monospace;">
                        Scenario source: ${aw.engine} (illustrative demo values, not a model output)
                    </div>
                </div>
            `).join('');
        }

        // 8. Hourly Forecast Scroll
        const hourlyContainer = document.getElementById('hourly-forecast-track');
        hourlyContainer.innerHTML = '';
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
                        <div class="d-pop-fill" style="width:${d.rainProbability}%;"></div>
                    </div>
                    <span class="d-pop-val mono">${d.rainProbability}%</span>
                </div>
                <div class="d-temp-range">
                    <span class="d-max-temp">${weatherService.formatTemp(d.maxTemp, prefs.temperature)}</span>
                    <span class="d-min-temp">${weatherService.formatTemp(d.minTemp, prefs.temperature)}</span>
                </div>
            `;
            dailyContainer.appendChild(row);
        });
    }

    renderDashboardAiSummary(data) {
        const target = document.querySelector('#view-dashboard .dashboard-header');
        if (!target) return;

        const assessment = buildAiAssessment(data);
        const card = document.getElementById('dashboard-ai-summary');
        const html = `
            <div id="dashboard-ai-summary" class="dashboard-ai-summary">
                <div class="ai-summary-header">
                    <span class="ai-summary-label">MEGHDRISHTI AI INSIGHT</span>
                    <span class="ai-summary-score">${assessment.overallRiskScore}/100</span>
                </div>
                <div class="ai-summary-body">
                    <div>
                        <div class="ai-summary-status">${assessment.overallRiskLabel}</div>
                        <p>${assessment.summary}</p>
                    </div>
                    <div class="ai-confidence-block">
                        <span>Confidence</span>
                        <strong>${assessment.confidence}%</strong>
                        <div class="ai-confidence-bar">
                            <span style="width:${assessment.confidence}%"></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (card) {
            card.outerHTML = html;
        } else {
            target.insertAdjacentHTML('afterend', html);
        }
    }

    /**
     * Render Radar Operations Scope View
     */
    renderRadarView(data) {
        const { radar } = data;
        const container = document.getElementById('radar-view-container');
        if (!container) return;

        const statusLabel = radar?.provenance?.source ? radar.provenance.source : 'DEMO DATA';

        container.innerHTML = `
            <div class="dash-two-col">
                <div class="section-card radar-placeholder-shell">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>Weather Radar</span>
                        </div>
                        <div class="data-status status-demo">
                            <span class="status-dot"></span>
                            <span>DEMO DATA</span>
                        </div>
                    </div>

                    <div class="radar-placeholder-panel" aria-live="polite">
                        <div class="radar-preview-surface" aria-label="Radar preview placeholder">
                            <div class="radar-grid"></div>
                            <span class="radar-ring ring-one"></span>
                            <span class="radar-ring ring-two"></span>
                            <span class="radar-ring ring-three"></span>
                            <span class="radar-ring ring-four"></span>
                            <span class="radar-sweep"></span>
                            <span class="radar-core"></span>
                            <span class="radar-bubble bubble-a"></span>
                            <span class="radar-bubble bubble-b"></span>
                            <span class="radar-bubble bubble-c"></span>
                            <span class="radar-bubble bubble-d"></span>
                            <span class="radar-overlay-label">Radar feed not connected</span>
                        </div>

                        <div class="radar-placeholder-meta">
                            <div>
                                <span class="meta-label">Status</span>
                                <strong>Awaiting live feed</strong>
                            </div>
                            <div>
                                <span class="meta-label">Last update</span>
                                <strong>${new Date(radar?.provenance?.validTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                            </div>
                            <div>
                                <span class="meta-label">Source</span>
                                <strong>${statusLabel}</strong>
                            </div>
                        </div>

                        <div class="empty-state-actions">
                            <button class="btn-secondary" type="button" onclick="window.location.hash = '#/map';">Explore Weather Map</button>
                        </div>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>Radar readiness</span>
                        </div>
                        <span class="mono small-muted">Phase 1 placeholder</span>
                    </div>

                    <div class="rainfall-accum-grid">
                        <div class="accum-item">
                            <span class="accum-lbl">Feed status</span>
                            <span class="accum-val">Offline</span>
                            <span class="accum-sub">No live radar connected</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Coverage</span>
                            <span class="accum-val">250 km</span>
                            <span class="accum-sub">Prepared for future feed</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Refresh</span>
                            <span class="accum-val">N/A</span>
                            <span class="accum-sub">Awaiting source</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Data note</span>
                            <span class="accum-val">Demo</span>
                            <span class="accum-sub">Illustrative only</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Animate interactive PPI Doppler Radar Canvas
     */
    initRadarScope() {
        const canvas = document.getElementById('radar-canvas-element');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (this.radarAnimationTimer) cancelAnimationFrame(this.radarAnimationTimer);

        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = width / 2 - 10;

        const animate = () => {
            this.radarAngle = (this.radarAngle + 0.025) % (Math.PI * 2);

            ctx.clearRect(0, 0, width, height);

            // 1. Draw Range Rings (50km, 100km, 150km, 200km)
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
            ctx.lineWidth = 1;
            for (let r = 50; r <= radius; r += radius / 4) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
                ctx.stroke();
            }

            // 2. Azimuth Crosshairs
            ctx.beginPath();
            ctx.moveTo(centerX - radius, centerY);
            ctx.lineTo(centerX + radius, centerY);
            ctx.moveTo(centerX, centerY - radius);
            ctx.lineTo(centerX, centerY + radius);
            ctx.stroke();

            // 3. Draw Synthetic/Observed Convective Reflectivity Blobs
            const clusters = [
                { x: centerX + 50, y: centerY - 45, r: 42, color: 'rgba(239, 68, 68, 0.75)' },
                { x: centerX + 75, y: centerY - 30, r: 26, color: 'rgba(249, 115, 22, 0.65)' },
                { x: centerX - 60, y: centerY + 50, r: 35, color: 'rgba(234, 179, 8, 0.6)' },
                { x: centerX - 30, y: centerY - 70, r: 28, color: 'rgba(16, 185, 129, 0.5)' }
            ];

            clusters.forEach(c => {
                const grad = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r);
                grad.addColorStop(0, c.color);
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
                ctx.fill();
            });

            // 4. Rotating Radar Sweep Beam
            const beamX = centerX + Math.cos(this.radarAngle) * radius;
            const beamY = centerY + Math.sin(this.radarAngle) * radius;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, this.radarAngle - 0.25, this.radarAngle);
            ctx.closePath();

            const sweepGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            sweepGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
            sweepGrad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
            ctx.fillStyle = sweepGrad;
            ctx.fill();

            // Leading Sweep Line
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(beamX, beamY);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Center Radar Beacon
            ctx.beginPath();
            ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#38bdf8';
            ctx.fill();

            this.radarAnimationTimer = requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     * Render Satellite Telemetry View
     */
    renderSatelliteView(data) {
        const { satellite } = data;
        const container = document.getElementById('satellite-view-container');
        if (!container) return;

        container.innerHTML = `
            <div class="section-card" style="margin-bottom:16px;">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>🛰️ ${satellite.satellite}</span>
                    </div>
                    <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">${satellite.sensor}</span>
                </div>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:6px;">
                    Spatial Coverage: <strong>${satellite.coverage}</strong> • Spatial Resolution: <strong>${satellite.provenance.spatialResolution}</strong> • Repeat Scan: <strong>${satellite.provenance.temporalResolution}</strong>
                </p>
            </div>

            <div class="satellite-grid">
                ${satellite.channels.map(ch => `
                    <div class="sat-channel-card">
                        <div class="sat-channel-header">
                            <span class="sat-channel-title">${ch.name}</span>
                            <span class="sat-channel-badge">${ch.processingLevel}</span>
                        </div>
                        <div class="sat-value-row">${ch.value}</div>
                        <div class="sat-desc">${ch.product}: <strong>${ch.status}</strong></div>
                        <div style="font-size:0.7rem; color:var(--text-muted); font-family:monospace; margin-top:auto;">
                            Native Grid: ${ch.resolution}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="section-card" style="margin-top:16px;">
                <div style="font-size:0.8rem; font-weight:700; color:var(--cyan-primary); margin-bottom:6px;">
                    SATELLITE DATA ATTRIBUTION & SCIENTIFIC PROVENANCE
                </div>
                <div class="mono" style="font-size:0.75rem; color:var(--text-secondary); line-height:1.6;">
                    Source: ${satellite.provenance.source}<br>
                    Processing Level: ${satellite.provenance.processingLevel}<br>
                    Acquisition Time: ${new Date(satellite.provenance.timestamp).toUTCString()} (Radiance Calibrated)<br>
                    Provenance Category: ${satellite.provenance.provenanceType}
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

        const rangeTemp = Math.max(...modelInfo.models.map(m => Number(m.tempC || 0))) - Math.min(...modelInfo.models.map(m => Number(m.tempC || 0)));
        const rangeRain = Math.max(...modelInfo.models.map(m => Number(m.precip24hMm || 0))) - Math.min(...modelInfo.models.map(m => Number(m.precip24hMm || 0)));

        container.innerHTML = `
            <div class="section-card" style="margin-bottom:16px;">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>NWP MODEL CENTER</span>
                    </div>
                    <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">COMPARE NUMERICAL WEATHER PREDICTION GUIDANCE</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:8px; line-height:1.6;">
                    ${nwp?.synopticDiagnosis || 'Model comparison is based on the currently available local forecast ensemble.'}
                </p>
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
                                <em>${model.confidence}</em>
                            </div>
                            <div class="nwp-metrics">
                                <div><span>Temperature</span><strong>${model.tempC}°C</strong></div>
                                <div><span>Rain probability</span><strong>${model.cloudburstProbability}%</strong></div>
                                <div><span>Rainfall</span><strong>${model.precip24hMm} mm</strong></div>
                                <div><span>Wind</span><strong>${model.windKmh || 18} km/h</strong></div>
                                <div><span>Pressure</span><strong>${model.pressureHpa || 1006} hPa</strong></div>
                                <div><span>Humidity</span><strong>${model.humidityPct || 78}%</strong></div>
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
        const { snapshot, groundObservations, nowcast, radar } = data;
        const container = document.getElementById('rainfall-view-container');
        if (!container) return;

        const curRain = snapshot.precipitation > 0 ? snapshot.precipitation : radar.rainfallRateEstimated;

        container.innerHTML = `
            <div class="dash-two-col">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>🌧️ Illustrative Rainfall Examples</span>
                        </div>
                        <span class="mono badge-ai">STATIC DEMO VALUES</span>
                    </div>

                    <div class="rainfall-accum-grid">
                        <div class="accum-item">
                            <span class="accum-lbl">Current Rate</span>
                            <span class="accum-val" style="color:#ef4444;">${curRain.toFixed(1)} mm/hr</span>
                            <span class="accum-sub">Instantaneous telemetry</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">1-Hour Acc.</span>
                            <span class="accum-val">${groundObservations.accumulations.r1h} mm</span>
                            <span class="accum-sub">Past 60 min</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">3-Hour Acc.</span>
                            <span class="accum-val">${groundObservations.accumulations.r3h} mm</span>
                            <span class="accum-sub">Active cell cluster</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">6-Hour Acc.</span>
                            <span class="accum-val">${groundObservations.accumulations.r6h} mm</span>
                            <span class="accum-sub">Synoptic epoch</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">24-Hour Acc.</span>
                            <span class="accum-val">${groundObservations.accumulations.r24h} mm</span>
                            <span class="accum-sub">Daily accumulation</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Climatological Anomaly</span>
                            <span class="accum-val" style="color:#f59e0b;">+185%</span>
                            <span class="accum-sub">Above normal for date</span>
                        </div>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>⏱️ 15 to 180 Minute Nowcasting Progression</span>
                        </div>
                        <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">Semi-Lagrangian Advection</span>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:10px; margin-top:14px;">
                        ${nowcast.nowcastSteps.map(step => `
                            <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface-slate-2); padding:10px 14px; border-radius:6px; border:1px solid var(--border-subtle);">
                                <span class="mono" style="font-weight:700; color:var(--cyan-primary); width:70px;">${step.label}</span>
                                <span class="mono" style="font-size:1.05rem; font-weight:700;">${step.expectedRainfallMmHr} mm/hr</span>
                                <span class="mono" style="font-size:0.78rem; color:#10b981;">Prob: ${step.probabilityPct}%</span>
                                <span class="mono" style="font-size:0.72rem; color:var(--text-muted);">${step.confidenceInterval}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Inundation & Hydrodynamic Modeler View
     */
    renderFloodRiskView(data) {
        const { hydroTerrain, floodRisk } = data;
        const container = document.getElementById('flood-risk-view-container');
        if (!container) return;

        // Peak runoff Q = C * I * A
        const runoffC = 0.85; // urban concrete runoff coefficient
        const peakDischarge = (runoffC * (this.stressRainRate / 360) * 42.5).toFixed(1);

        container.innerHTML = `
            <div class="dash-two-col">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>🌊 Hydrodynamic Urban Inundation Modeler</span>
                        </div>
                            <span class="mono badge-ai">Illustrative scenario</span>
                    </div>

                    <div class="slider-control-pane" style="margin-top:14px;">
                        <div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                                <label style="font-size:0.85rem; font-weight:700;">Precipitation Stress-Test Rate:</label>
                                <span class="mono" id="slider-val-disp" style="font-size:1.1rem; color:var(--cyan-primary); font-weight:700;">${this.stressRainRate} mm/hr</span>
                            </div>
                            <input type="range" id="flood-stress-slider" class="stress-slider" min="10" max="250" value="${this.stressRainRate}" step="5">
                        </div>

                        <div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                                <label style="font-size:0.85rem; font-weight:700;">Return Period (T-Years):</label>
                                <span class="mono" style="font-size:0.9rem; color:#f59e0b; font-weight:700;">T = ${this.stressReturnPeriod} Years</span>
                            </div>
                            <div style="display:flex; gap:8px;">
                                ${[2, 5, 10, 25, 50, 100].map(yr => `
                                    <button class="btn-triage ${yr === this.stressReturnPeriod ? 'active' : ''}" data-return-period="${yr}">
                                        ${yr}Y
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <div style="display:flex; gap:10px; margin-top:8px;">
                            <button id="btn-export-geojson" class="btn-primary" style="flex:1;">
                                <span>📥 Export RFC 7946 GeoJSON GIS Extents</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📊 Computed Hydrodynamic Risk Extents</span>
                        </div>
                        <span class="mono" style="color:#ef4444; font-size:0.75rem;">${floodRisk.level} RISK</span>
                    </div>

                    <div class="rainfall-accum-grid">
                        <div class="accum-item">
                            <span class="accum-lbl">Peak Runoff Discharge</span>
                            <span class="accum-val" id="peak-runoff-val">${peakDischarge} m³/s</span>
                            <span class="accum-sub">Q = CIA Model</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Flooded Area Estimate</span>
                            <span class="accum-val" id="flooded-area-val">${(this.stressRainRate * 0.58).toFixed(1)} km²</span>
                            <span class="accum-sub">CartoDEM Depression</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Soil Moisture Saturation</span>
                            <span class="accum-val">${hydroTerrain.soilMoistureSaturationPct}%</span>
                            <span class="accum-sub">Zero soil infiltration</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Impervious Urban Surface</span>
                            <span class="accum-val">${Math.round(hydroTerrain.imperviousSurfaceFraction * 100)}%</span>
                            <span class="accum-sub">Paved roads & concrete</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">CartoDEM Elevation</span>
                            <span class="accum-val">${hydroTerrain.cartoDemElevationM} m</span>
                            <span class="accum-sub">Mean terrain level</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Watershed Corridor</span>
                            <span class="accum-val" style="font-size:0.95rem;">Urban Mithi</span>
                            <span class="accum-sub">Outfall Sluice</span>
                        </div>
                    </div>

                    <div style="margin-top:16px;">
                        <div style="font-size:0.78rem; font-weight:700; color:var(--cyan-primary); margin-bottom:6px;">
                            CRITICAL URBAN CHOKE POINTS:
                        </div>
                        ${hydroTerrain.inundationChokePoints.map(cp => `
                            <div style="display:flex; justify-content:space-between; background:var(--surface-slate-2); padding:8px 12px; border-radius:4px; margin-bottom:6px; font-size:0.78rem;">
                                <span>${cp.name}</span>
                                <strong style="color:#ef4444;">${cp.depthEstM}m Depth (${cp.status})</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Slider events
        const slider = document.getElementById('flood-stress-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                this.stressRainRate = parseInt(e.target.value);
                const disp = document.getElementById('slider-val-disp');
                if (disp) disp.textContent = `${this.stressRainRate} mm/hr`;
                const qVal = document.getElementById('peak-runoff-val');
                if (qVal) qVal.textContent = `${(runoffC * (this.stressRainRate / 360) * 42.5).toFixed(1)} m³/s`;
                const aVal = document.getElementById('flooded-area-val');
                if (aVal) aVal.textContent = `${(this.stressRainRate * 0.58).toFixed(1)} km²`;
            });
        }

        // Return period buttons
        container.querySelectorAll('[data-return-period]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                container.querySelectorAll('[data-return-period]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.stressReturnPeriod = parseInt(btn.getAttribute('data-return-period'));
                this.showGlobalToast(`Simulating return period T = ${this.stressReturnPeriod} Years`, 'info');
            });
        });

        // GeoJSON export button
        const exportBtn = document.getElementById('btn-export-geojson');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.downloadGeoJsonFloodPolygon());
        }
    }

    /**
     * Download RFC 7946 GeoJSON Polygon for direct GIS import (QGIS, ArcGIS, Bhuvan)
     */
    downloadGeoJsonFloodPolygon() {
        const { snapshot } = this.weatherData;
        const lat = snapshot.location.lat;
        const lon = snapshot.location.lon;

        const geojson = {
            type: "FeatureCollection",
            properties: {
                platform: "MeghDrishti AI",
                analysis: "CartoDEM Hydrodynamic Inundation",
                stressRainRateMmHr: this.stressRainRate,
                returnPeriodYears: this.stressReturnPeriod,
                generatedAt: new Date().toISOString()
            },
            features: [
                {
                    type: "Feature",
                    properties: {
                        hazardCategory: "Urban Inundation",
                        floodDepthEstimatedM: 1.45,
                        riskSeverity: "VERY HIGH"
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [lon - 0.04, lat - 0.03],
                            [lon + 0.05, lat - 0.02],
                            [lon + 0.06, lat + 0.04],
                            [lon - 0.03, lat + 0.05],
                            [lon - 0.04, lat - 0.03]
                        ]]
                    }
                }
            ]
        };

        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MeghDrishti_Flood_Inundation_${snapshot.location.name}.geojson`;
        a.click();
        URL.revokeObjectURL(url);
        this.showGlobalToast('RFC 7946 GeoJSON export ready for GIS analysis', 'success');
    }

    /**
     * Render TITAN/SCIT Meso-Convective Storm Cell Tracking View
     */
    renderStormTrackingView(data) {
        const { stormCells } = data;
        const container = document.getElementById('storm-tracking-view-container');
        if (!container) return;

        container.innerHTML = `
            <div class="section-card" style="margin-bottom:16px;">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>⚡ Active Meso-Convective Storm Cells (TITAN/SCIT)</span>
                    </div>
                    <span class="mono badge-ai">3 EXAMPLE CELLS</span>
                </div>
                <div class="nwp-table-wrap">
                    <table class="nwp-table">
                        <thead>
                            <tr>
                                <th>Cell ID</th>
                                <th>Centroid Coordinates</th>
                                <th>Max dBZ</th>
                                <th>Echo Top</th>
                                <th>Velocity Vector</th>
                                <th>VIL Density</th>
                                <th>Hail Prob.</th>
                                <th>Classification</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stormCells.map(cell => `
                                <tr>
                                    <td class="mono" style="font-weight:700; color:var(--cyan-primary);">${cell.id}</td>
                                    <td class="mono">${cell.centroid}</td>
                                    <td class="mono" style="color:#ef4444; font-weight:700;">${cell.maxReflectivityDbz} dBZ</td>
                                    <td class="mono">${cell.echoTopKm} km</td>
                                    <td class="mono">${cell.azimuthDeg}° @ ${cell.speedKts} kts</td>
                                    <td class="mono">${cell.vilKgM2} kg/m²</td>
                                    <td class="mono" style="color:${cell.hailProbPct > 50 ? '#ef4444' : '#f59e0b'}; font-weight:700;">${cell.hailProbPct}%</td>
                                    <td><span class="status-badge ${cell.severity.includes('SEVERE') ? 'status-suspect' : 'status-good'}">${cell.severity}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
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
        const alertCards = [
            ...smartAlerts,
            ...((alerts?.aiEarlyWarnings || []).map(item => ({
                id: item.id,
                severity: item.riskLevel || 'MODERATE',
                title: item.headline,
                location: data?.snapshot?.location?.name || 'Current location',
                timeWindow: item.timeWindow || 'Current window',
                reason: `${item.confidence || 'Confidence unavailable'} • ${item.majorContributingFactors?.[0] || 'Scenario generated locally.'}`,
                source: item.engine || 'MeghDrishti AI',
                timestamp: item.provenance?.timestamp || new Date().toISOString(),
                icon: '🧠',
                category: 'AI WEATHER INSIGHT',
                expectedEffect: 'Conditions may change rapidly if the active rain cell intensifies.'
            })))
        ];

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
                        <span class="mono badge-official">NO OFFICIAL WARNINGS AVAILABLE</span>
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
                        ${uniqueAlerts.map(alert => `
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
                                    <span>${new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>${alert.source}</span>
                                </div>
                                <div class="alert-effects">
                                    <strong>Expected:</strong> ${alert.expectedEffect || 'Conditions may shift with local rainfall and wind changes.'}
                                </div>
                            </div>
                        `).join('')}
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
                            <span>${loc.temperature}°C</span>
                            <span>${loc.rain}%</span>
                            <span>${loc.wind} km/h</span>
                            <span>${loc.humidity}%</span>
                            <span>${loc.uv}</span>
                        </div>
                    `).join('')}
                </div>
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
                    <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">LIVE DATA + AI SUMMARY</span>
                </div>
                <div class="ai-overview-shell">
                    <div>
                        <div class="ai-overview-kicker">CURRENT ASSESSMENT</div>
                        <h3>${assessment.overallRiskLabel}</h3>
                        <p>${assessment.summary}</p>
                    </div>
                    <div class="ai-score-box">
                        <span>Weather Activity</span>
                        <strong>${assessment.overallRiskScore}/100</strong>
                        <div class="ai-confidence-bar"><span style="width:${assessment.overallRiskScore}%"></span></div>
                    </div>
                </div>
            </div>

            <div class="dash-two-col" style="margin-bottom:18px;">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📝 WEATHER STORY</span>
                        </div>
                        <span class="mono">${weatherStory.confidence}</span>
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
                        ${weatherBrief.sections.map(section => `
                            <div class="brief-row">
                                <span>${section.title}</span>
                                <p>${section.text}</p>
                            </div>
                        `).join('')}
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
                        ${assessment.insights.map((insight) => `
                            <div class="ai-insight-card">
                                <div class="ai-insight-head">
                                    <span>${insight.icon}</span>
                                    <strong>${insight.title}</strong>
                                </div>
                                <p>${insight.detail}</p>
                                <div class="ai-insight-why">
                                    <span>WHY?</span>
                                    <ul>
                                        ${insight.why.map(reason => `<li>${reason}</li>`).join('')}
                                    </ul>
                                </div>
                                <div class="ai-insight-foot">
                                    <span>Confidence</span>
                                    <strong>${insight.confidence}%</strong>
                                </div>
                                <div class="ai-insight-period">${insight.period}</div>
                            </div>
                        `).join('')}
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
                        ${assessment.recommendations.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="dash-two-col" style="margin-top:18px;">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📊 Model Consensus</span>
                        </div>
                        <span class="mono" style="font-size:0.75rem; color:var(--text-muted);">${data?.nwp?.models?.length > 1 ? 'CONSENSUS' : 'CONSENSUS UNAVAILABLE'}</span>
                    </div>
                    <div class="model-consensus-box">
                        <strong>${data?.nwp?.models?.length > 1 ? '88%' : 'N/A'}</strong>
                        <div class="model-consensus-bar"><span style="width:${data?.nwp?.models?.length > 1 ? 88 : 0}%"></span></div>
                        <p>${data?.nwp?.models?.length > 1 ? 'Most forecast pathways continue to point to similar rainfall and moisture behavior for the next 12 to 24 hours.' : 'Only one model source is currently available, so consensus cannot be calculated.'}</p>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📍 Compare Locations</span>
                        </div>
                        <span class="mono" style="font-size:0.75rem; color:var(--text-muted);">DATA-BASED / SEARCHABLE</span>
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
                                <span>${loc.temperature}°</span>
                                <span>${loc.rain}%</span>
                                <span>${loc.wind} km/h</span>
                                <span>${loc.uv}</span>
                            </div>
                        `).join('')}
                    </div>
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
                    <span class="ops-kpi-val" style="color:#10b981;">0 live sensors</span>
                    <span class="ops-kpi-sub">Static demo values are not sensor QC</span>
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
                    <div>Radar, satellite, AWS, NWP, inundation, and alert products: static demo examples.</div>
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
            ...alerts.officialAlerts.map(oa => ({
                title: oa.headline,
                time: new Date(oa.effective).toLocaleTimeString(),
                desc: oa.description
            })),
            ...alerts.aiEarlyWarnings.map(aw => ({
                title: `Demo scenario: ${aw.headline}`,
                time: new Date(aw.provenance.timestamp).toLocaleTimeString(),
                desc: `Illustrative score: ${aw.riskScore} • Not an official warning`
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

        const isDemoWeather = mode === DataMode.DEMO || this.weatherData?.snapshot.isDemo === true;
        if (!isDemoWeather) {
            if (btn) {
                btn.className = 'mode-toggle-badge live';
                if (textEl) textEl.textContent = 'OPEN-METEO WEATHER';
            }
            if (sidebarStatus) sidebarStatus.textContent = 'Weather: Open-Meteo';
        } else {
            if (btn) {
                btn.className = 'mode-toggle-badge demo';
                if (textEl) textEl.textContent = mode === DataMode.DEMO ? 'DEMO WEATHER' : 'DEMO FALLBACK';
            }
            if (sidebarStatus) sidebarStatus.textContent = mode === DataMode.DEMO ? 'Weather: demo' : 'Weather: fallback demo';
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
            marker.bindPopup(`<b>${name}</b><br>Illustrative demo location`).openPopup();

            // Flood polygon
            const floodPoly = L.polygon([
                [lat - 0.04, lon - 0.03],
                [lat + 0.05, lon - 0.02],
                [lat + 0.06, lon + 0.04],
                [lat - 0.03, lon + 0.05]
            ], {
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.35
            }).addTo(this.mapLayerGroup);

            floodPoly.bindPopup(`<b>CartoDEM Flood Extent</b><br>Precipitation Stress: ${this.stressRainRate} mm/hr<br>Risk: VERY HIGH`);
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
            refreshBtn.addEventListener('click', () => this.loadWeatherForCurrentLocation());
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

        const { snapshot, groundObservations } = data;

        container.innerHTML = `
            <div class="section-card">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>🧪 Thermodynamic Atmospheric Sounding</span>
                    </div>
                    <span class="mono badge-ai">DEMO EXAMPLES</span>
                </div>
                <div class="rainfall-accum-grid">
                    <div class="accum-item">
                        <span class="accum-lbl">Convective Available Potential Energy (CAPE)</span>
                        <span class="accum-val" style="color:#ef4444;">2610 J/kg</span>
                        <span class="accum-sub">Extreme Instability</span>
                    </div>
                    <div class="accum-item">
                        <span class="accum-lbl">Convective Inhibition (CIN)</span>
                        <span class="accum-val">-21 J/kg</span>
                        <span class="accum-sub">Weak capping lid</span>
                    </div>
                    <div class="accum-item">
                        <span class="accum-lbl">Precipitable Water (PWAT)</span>
                        <span class="accum-val">59.8 mm</span>
                        <span class="accum-sub">High Moisture Column</span>
                    </div>
                    <div class="accum-item">
                        <span class="accum-lbl">Lifting Condensation Level (LCL)</span>
                        <span class="accum-val">680 m</span>
                        <span class="accum-sub">Low cloud base</span>
                    </div>
                    <div class="accum-item">
                        <span class="accum-lbl">Freezing Level (0°C Isotherm)</span>
                        <span class="accum-val">4.8 km</span>
                        <span class="accum-sub">High freezing altitude</span>
                    </div>
                    <div class="accum-item">
                        <span class="accum-lbl">Dew Point Depression</span>
                        <span class="accum-val">2.2°C</span>
                        <span class="accum-sub">Near saturated air</span>
                    </div>
                </div>
            </div>

            <div class="section-card">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>📡 Ground-Station Demo Examples</span>
                    </div>
                    <span class="mono badge-ai">NOT LIVE SENSOR DATA</span>
                </div>
                <div style="margin-top:14px; display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; justify-content:space-between; background:var(--surface-slate-2); padding:10px 14px; border-radius:6px;">
                        <span>Surface Temperature Sensor</span>
                        <strong class="mono" style="color:#10b981;">${groundObservations.surfaceTempC}°C (DEMO)</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; background:var(--surface-slate-2); padding:10px 14px; border-radius:6px;">
                        <span>Tipping Bucket Rain Gauge</span>
                        <strong class="mono" style="color:#10b981;">SAMPLE VALUE</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; background:var(--surface-slate-2); padding:10px 14px; border-radius:6px;">
                        <span>Barometric Pressure Sensor</span>
                        <strong class="mono" style="color:#10b981;">${groundObservations.barometricPressureHpa} hPa (DEMO)</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; background:var(--surface-slate-2); padding:10px 14px; border-radius:6px;">
                        <span>Ultrasonic Anemometer</span>
                        <strong class="mono" style="color:#10b981;">${groundObservations.windSpeedKmh} km/h (DEMO)</strong>
                    </div>
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
                            ${daily.map((d, i) => `
                                <tr>
                                    <td><strong>${new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</strong></td>
                                    <td><span style="margin-right:6px;">${d.icon}</span> ${d.condition}</td>
                                    <td class="mono" style="font-weight:700;">${weatherService.formatTemp(d.maxTemp, prefs.temperature)}</td>
                                    <td class="mono">${weatherService.formatTemp(d.minTemp, prefs.temperature)}</td>
                                    <td class="mono" style="color:#10b981;">${d.rainProbability}%</td>
                                    <td class="mono" style="color:#38bdf8;">${weatherService.formatPrecip(d.precipitationSum, prefs.precipitation)}</td>
                                    <td class="mono">${weatherService.formatWind(d.windMax, prefs.windSpeed)}</td>
                                    <td class="mono">${d.uvMax.toFixed(0)}</td>
                                </tr>
                            `).join('')}
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
        if (el) el.textContent = 'Updated just now';
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
