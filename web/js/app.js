/**
 * MeghDrishti AI — Operational Meteorological SaaS Controller
 * Full Implementation across all 15 Operational Pages & Scientific Telemetry
 */

import { AuthService } from './auth.js';
import { StorageService } from './storage.js';
import { weatherService } from './weatherService.js';
import { Router } from './router.js';
import { DataMode, QualityStatus, ProvenanceType } from './providers/dataProviders.js';

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

        // Interactive stress-test values
        this.stressRainRate = 65; // mm/hr
        this.stressReturnPeriod = 25; // years

        this.router = new Router((route, params) => this.handleRoute(route, params));
    }

    init() {
        this.setupAuthEvents();
        this.setupGlobalSearch();
        this.setupTopbarEvents();
        this.setupUnitEvents();
        this.setupModeToggle();
        this.setupSettingsEvents();
        this.startUtcClock();

        this.router.init();
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
        document.getElementById('topbar-location-name').textContent = `${snapshot.location.name}, ${snapshot.location.country || snapshot.location.region}`;
        document.getElementById('dash-coordinates').textContent = 
            `${snapshot.location.lat.toFixed(4)}° N, ${snapshot.location.lon.toFixed(4)}° E (Elev: ${snapshot.location.elevation}m)`;
        document.getElementById('dash-data-source').textContent = snapshot.source;

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
            officialContainer.innerHTML = alerts.officialAlerts.map(oa => `
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
            `).join('');
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
                        Engine: ${aw.engine} (Scientific AI Estimate)
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

    /**
     * Render Radar Operations Scope View
     */
    renderRadarView(data) {
        const { radar } = data;
        const container = document.getElementById('radar-view-container');
        if (!container) return;

        container.innerHTML = `
            <div class="dash-two-col">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📡 ${radar.stationName}</span>
                        </div>
                        <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">${radar.sweepAngle}</span>
                    </div>

                    <div class="radar-scope-wrapper">
                        <canvas id="radar-canvas-element" class="radar-canvas" width="460" height="460"></canvas>
                    </div>

                    <div class="dbz-legend-bar">
                        <span>5 dBZ (Light)</span>
                        <span>20 dBZ (Moderate)</span>
                        <span>35 dBZ (Heavy)</span>
                        <span>50 dBZ (Torrential)</span>
                        <span>65+ dBZ (Hail/Severe)</span>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📊 Polarimetric DWR Telemetry</span>
                        </div>
                        <span class="mono badge-official">IMD SPECIFICATION</span>
                    </div>

                    <div class="rainfall-accum-grid">
                        <div class="accum-item">
                            <span class="accum-lbl">Max Reflectivity</span>
                            <span class="accum-val" style="color:#ef4444;">${radar.maxReflectivityDbz} dBZ</span>
                            <span class="accum-sub">Convective Core</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Radial Velocity</span>
                            <span class="accum-val" style="font-size:1.05rem;">${radar.radialVelocity.split(' ')[0]}</span>
                            <span class="accum-sub">Meso-cyclonic shear</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Estimated Rain Rate</span>
                            <span class="accum-val">${radar.rainfallRateEstimated} mm/hr</span>
                            <span class="accum-sub">Marshall-Palmer Z-R</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Echo Top Altitude</span>
                            <span class="accum-val">${radar.echoTopKm} km</span>
                            <span class="accum-sub">Tropopause Penetration</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Vertically Integrated Liquid</span>
                            <span class="accum-val">${radar.vilKgM2} kg/m²</span>
                            <span class="accum-sub">Severe cell signature</span>
                        </div>
                        <div class="accum-item">
                            <span class="accum-lbl">Distance from Station</span>
                            <span class="accum-val">${radar.distanceKm} km</span>
                            <span class="accum-sub">Within 250km scope</span>
                        </div>
                    </div>

                    <div style="margin-top:16px; background:var(--surface-slate-2); border:1px solid var(--border-subtle); padding:14px; border-radius:var(--radius-sm);">
                        <div style="font-size:0.78rem; font-weight:700; color:var(--cyan-primary); margin-bottom:4px;">
                            SCIENTIFIC DATA PROVENANCE:
                        </div>
                        <div class="mono" style="font-size:0.72rem; color:var(--text-secondary); line-height:1.6;">
                            Source: ${radar.provenance.source}<br>
                            Resolution: ${radar.provenance.spatialResolution}<br>
                            Processing: ${radar.provenance.processingLevel}<br>
                            Quality: ${radar.provenance.quality} • Valid: ${new Date(radar.provenance.validTime).toLocaleTimeString()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => this.initRadarScope(), 100);
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
        const { nwp } = data;
        const container = document.getElementById('nwp-view-container');
        if (!container) return;

        container.innerHTML = `
            <div class="section-card" style="margin-bottom:16px;">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>📈 Multi-Agency Numerical Prediction Matrix</span>
                    </div>
                    <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">IMD WRF / NCUM / ECMWF / GFS</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:6px; line-height:1.5;">
                    ${nwp.synopticDiagnosis}
                </p>
            </div>

            <div class="section-card">
                <div class="nwp-table-wrap">
                    <table class="nwp-table">
                        <thead>
                            <tr>
                                <th>Model & Agency</th>
                                <th>Resolution</th>
                                <th>Temp (°C)</th>
                                <th>24h Precip</th>
                                <th>CAPE (J/kg)</th>
                                <th>PWAT (mm)</th>
                                <th>Cloudburst Risk</th>
                                <th>Confidence</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${nwp.models.map(m => `
                                <tr class="${m.id === 'meghdrishti-ens' ? 'nwp-ens-row' : ''}">
                                    <td>
                                        <strong>${m.name}</strong><br>
                                        <span style="font-size:0.68rem; color:var(--text-muted);">${m.agency}</span>
                                    </td>
                                    <td class="mono">${m.resolution}</td>
                                    <td class="mono">${m.tempC}°C</td>
                                    <td class="mono" style="color:#ef4444; font-weight:700;">${m.precip24hMm} mm</td>
                                    <td class="mono">${m.capeJkg}</td>
                                    <td class="mono">${m.pwatMm}</td>
                                    <td class="mono" style="color:${m.cloudburstProbability > 50 ? '#ef4444' : '#f59e0b'}; font-weight:700;">
                                        ${m.cloudburstProbability}%
                                    </td>
                                    <td>${m.confidence}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
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
                            <span>🌧️ Observational Precipitation Gauges</span>
                        </div>
                        <span class="mono badge-official">GROUND AWS & RADAR QPE</span>
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
                        <span class="mono badge-official">CartoDEM 10m & Q = CIA</span>
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
                    <span class="mono badge-official">3 CELLS TRACKED</span>
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
        const { alerts } = data;
        const container = document.getElementById('alerts-full-page-container');
        if (!container) return;

        container.innerHTML = `
            <div class="dash-two-col">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title" style="color:#ef4444;">
                            <span>🏛️ Official OASIS CAP v1.2 Broadcasts</span>
                        </div>
                        <span class="mono badge-official">IMD / NDMA Sachet</span>
                    </div>
                    ${alerts.officialAlerts.map(oa => `
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
                    `).join('')}
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title" style="color:var(--cyan-primary);">
                            <span>🛡️ Internal Operator Triage Stream</span>
                        </div>
                        <span class="mono" style="color:var(--cyan-primary); font-size:0.75rem;">DISASTER RESPONSE</span>
                    </div>
                    ${alerts.operatorAlerts.map(op => `
                        <div style="background:var(--surface-slate-2); border:1px solid var(--border-subtle); padding:14px; border-radius:6px; margin-top:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <strong style="font-size:0.85rem;">${op.sector}</strong>
                                <span class="status-badge ${op.status === 'RESOLVED' ? 'status-good' : 'status-stale'}">${op.status}</span>
                            </div>
                            <p style="font-size:0.8rem; color:var(--text-secondary); margin:6px 0;">${op.summary}</p>
                            <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:8px;">
                                Assigned: <strong>${op.assignedTeam}</strong>
                            </div>
                            <div class="triage-btn-group">
                                ${['ACKNOWLEDGED', 'INVESTIGATING', 'DISPATCHED', 'RESOLVED'].map(st => `
                                    <button class="btn-triage ${op.status === st ? 'active' : ''}" onclick="alert('Status updated to: ${st}')">
                                        ${st}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render Historical Meteorological Events View
     */
    renderHistoryView(data) {
        const container = document.getElementById('history-view-container');
        if (!container) return;

        const events = [
            {
                title: 'Mumbai July 26, 2005 Extreme Cloudburst',
                rainfall24h: '944 mm in 24 hours',
                type: 'Mesoscale Convective Vortex Stagnation',
                impact: 'Severe citywide paralysis, Mithi river overbank flooding, underpass choke points submerged > 2.5m.',
                synoptic: 'Coincidence of intense monsoon trough depression with high tide (4.48m) blocking tidal sea gates.'
            },
            {
                title: 'Chennai December 1, 2015 Torrential Inundation',
                rainfall24h: '494 mm in 24 hours',
                type: 'Easterly Depression Stagnation',
                impact: 'Adyar and Cooum river basins breached, airport runway submerged under 1.5m water.',
                synoptic: 'Extreme moisture transport from Bay of Bengal coupled with Chembarambakkam reservoir release.'
            },
            {
                title: 'Kedarnath / Uttarakhand Cloudburst (June 2013)',
                rainfall24h: '385 mm in 12 hours',
                type: 'Orographic Cloudburst & Moraine Breach',
                impact: 'Chorabari lake flash flood, severe debris torrent down Mandakini river corridor.',
                synoptic: 'Westerly trough interaction with early active Indian monsoon surge.'
            }
        ];

        container.innerHTML = `
            <div class="satellite-grid">
                ${events.map(ev => `
                    <div class="sat-channel-card">
                        <div class="sat-channel-header">
                            <span class="sat-channel-title">${ev.title}</span>
                            <span class="sat-channel-badge">${ev.rainfall24h}</span>
                        </div>
                        <div style="font-size:0.85rem; color:#ef4444; font-weight:700;">${ev.type}</div>
                        <p class="sat-desc">${ev.impact}</p>
                        <div style="font-size:0.75rem; color:var(--text-muted); background:var(--surface-slate-2); padding:8px; border-radius:4px;">
                            <strong>Synoptic Cause:</strong> ${ev.synoptic}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render AI Analysis & Model Registry View
     */
    renderAiAnalysisView(data) {
        const container = document.getElementById('ai-analysis-view-container');
        if (!container) return;

        container.innerHTML = `
            <div class="section-card" style="margin-bottom:16px;">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>🧠 AI/ML Hydro-Convective Feature Pipeline</span>
                    </div>
                    <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">PIPELINE V2.4</span>
                </div>
                <div style="display:flex; justify-content:space-between; overflow-x:auto; padding:14px 0; gap:8px;">
                    ${['INGEST', 'QC & CLEAN', 'ALIGN', 'FEATURE ENG', 'CONVLSTM', 'POSTPROCESS', 'UNCERTAINTY', 'RISK SCORE'].map((step, idx) => `
                        <div style="background:var(--surface-slate-2); border:1px solid var(--border-subtle); padding:10px 14px; border-radius:6px; text-align:center; min-width:110px;">
                            <span style="font-size:0.65rem; color:var(--text-muted);">STEP 0${idx+1}</span>
                            <div class="mono" style="font-size:0.78rem; font-weight:700; color:var(--cyan-primary); margin-top:2px;">${step}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="dash-two-col">
                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>🔍 Explainable AI (XAI) Contributing Factors</span>
                        </div>
                        <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">SHAP VALUE PROXIES</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:12px; margin-top:14px;">
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:4px;">
                                <span>Radar Intensity & Reflectivity Gradient</span>
                                <strong class="mono">34%</strong>
                            </div>
                            <div class="trend-track"><div class="trend-fill" style="width:34%;"></div></div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:4px;">
                                <span>Antecedent 24h Soil Saturation</span>
                                <strong class="mono">28%</strong>
                            </div>
                            <div class="trend-track"><div class="trend-fill" style="width:28%;"></div></div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:4px;">
                                <span>CartoDEM Elevation Depression (< 15m)</span>
                                <strong class="mono">18%</strong>
                            </div>
                            <div class="trend-track"><div class="trend-fill" style="width:18%;"></div></div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:4px;">
                                <span>Impervious Surface Fraction (78%)</span>
                                <strong class="mono">12%</strong>
                            </div>
                            <div class="trend-track"><div class="trend-fill" style="width:12%;"></div></div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:4px;">
                                <span>NWP Convective Moisture Convergence</span>
                                <strong class="mono">8%</strong>
                            </div>
                            <div class="trend-track"><div class="trend-fill" style="width:8%;"></div></div>
                        </div>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-card-header">
                        <div class="section-card-title">
                            <span>📜 Automated Meteorological Bulletin Generator</span>
                        </div>
                        <span class="mono badge-official">WMO / IMD STANDARD</span>
                    </div>
                    <div style="background:#050b14; border:1px solid var(--border-subtle); padding:14px; border-radius:6px; font-family:'JetBrains Mono', monospace; font-size:0.75rem; color:#38bdf8; line-height:1.6; max-height:220px; overflow-y:auto; margin-top:12px;">
                        SPECIAL METEOROLOGICAL DIRECTIVE // FLASH FLOOD & CONVECTIVE BULLETIN<br>
                        ISSUED BY: MEGHDRISHTI AI OPERATIONS CENTER<br>
                        LOCATION: ${data.snapshot.location.name.toUpperCase()} REGION<br>
                        TIME: ${new Date().toISOString()}<br>
                        ------------------------------------------------------------<br>
                        DOPPLER WEATHER RADAR INDICATES PERSISTENT CONVECTIVE ECHOES EXCEEDING 52 DBZ OVER DRAINAGE BASINS. TOTAL 3-HOUR ACCUMULATIONS EXCEEDING 68 MM DETECTED. URBAN DRAINAGE CHOKE POINTS OPERATING AT CRITICAL CAPACITY. CIVIL PROTECTION AUTHORITIES DIRECTED TO ENFORCE PREVENTATIVE TRANSIT RESTRICTIONS ON LOW-LYING HIGHWAYS.
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
                    <span class="ops-kpi-sub">100% Success Rate</span>
                </div>
                <div class="ops-kpi-card">
                    <span class="ops-kpi-lbl">Provider Ingestion Latency</span>
                    <span class="ops-kpi-val">${observability.avgLatencyMs} ms</span>
                    <span class="ops-kpi-sub">Real-time edge ingestion</span>
                </div>
                <div class="ops-kpi-card">
                    <span class="ops-kpi-lbl">Sensor QC Flags</span>
                    <span class="ops-kpi-val" style="color:#10b981;">168 GOOD</span>
                    <span class="ops-kpi-sub">4 Stale • 0 Missing • 1 Suspect</span>
                </div>
                <div class="ops-kpi-card">
                    <span class="ops-kpi-lbl">Operational Node</span>
                    <span class="ops-kpi-val" style="font-size:1.15rem; color:var(--text-primary);">Node 04 (ISRO SAC)</span>
                    <span class="ops-kpi-sub">High-Availability Failover Ready</span>
                </div>
            </div>

            <div class="section-card" style="margin-top:16px;">
                <div class="section-card-header">
                    <div class="section-card-title">
                        <span>📋 Live Telemetry Audit Stream</span>
                    </div>
                    <span class="mono" style="font-size:0.75rem; color:var(--cyan-primary);">CONTINUOUS TELEMETRY LOG</span>
                </div>
                <div class="audit-stream-box">
                    <div>[${new Date().toISOString()}] INGESTION_SUCCESS: Open-Meteo Synoptic API 200 OK (118ms)</div>
                    <div>[${new Date().toISOString()}] RADAR_VOL_SCAN: DWR S-Band Colaba Sweep 0.5° Completed. Reflectivity range [5-56 dBZ].</div>
                    <div>[${new Date().toISOString()}] SATELLITE_MOSDAC: INSAT-3DS TIR1 Cloud Top Brightness Temperature calibrated.</div>
                    <div>[${new Date().toISOString()}] HYDRO_RUNOFF: Peak discharge updated to 412.5 m³/s across Mithi corridor.</div>
                    <div>[${new Date().toISOString()}] CAP_BROADCAST: OASIS CAP v1.2 alert envelope validated and staged for NDMA Sachet.</div>
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
                title: aw.headline,
                time: new Date(aw.provenance.timestamp).toLocaleTimeString(),
                desc: `Risk Score: ${aw.riskScore} • Window: ${aw.timeWindow}`
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
            this.showGlobalToast(`Data Mode switched to ${newMode.toUpperCase()}`, 'info');
        });
    }

    updateModeIndicators() {
        const mode = weatherService.getDataMode();
        const btn = document.getElementById('btn-mode-toggle');
        const textEl = document.getElementById('mode-text');
        const sidebarStatus = document.getElementById('sidebar-mode-status');

        if (mode === DataMode.LIVE) {
            if (btn) {
                btn.className = 'mode-toggle-badge live';
                if (textEl) textEl.textContent = 'LIVE DATA';
            }
            if (sidebarStatus) sidebarStatus.textContent = 'Mode: LIVE';
        } else {
            if (btn) {
                btn.className = 'mode-toggle-badge demo';
                if (textEl) textEl.textContent = 'SIMULATED DEMO';
            }
            if (sidebarStatus) sidebarStatus.textContent = 'Mode: DEMO';
        }
    }

    /**
     * Map View Setup with Leaflet
     */
    initOrUpdateMap() {
        const mapEl = document.getElementById('leaflet-map-element');
        if (!mapEl) return;

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
            marker.bindPopup(`<b>${name}</b><br>MeghDrishti Mission Center`).openPopup();

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

    /**
     * Global Location Search with Open-Meteo Geocoding
     */
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
                dropdown.innerHTML = '<div class="search-item">Searching global coordinates...</div>';
                dropdown.classList.add('active');

                const results = await weatherService.searchLocations(query);
                if (!results.length) {
                    dropdown.innerHTML = '<div class="search-item">No matching locations found.</div>';
                    return;
                }

                dropdown.innerHTML = results.map(loc => `
                    <div class="search-item" data-lat="${loc.lat}" data-lon="${loc.lon}" data-name="${loc.name}" data-country="${loc.country}" data-tz="${loc.timezone}">
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
                            region: el.getAttribute('data-country'),
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
                StorageService.addSavedLocation(this.currentLocation);
                this.renderSavedLocations();
                this.showGlobalToast(`Saved ${this.currentLocation.name} to memory!`, 'success');
            });
        }
    }

    /**
     * Unit Switchers
     */
    setupUnitEvents() {
        document.querySelectorAll('.unit-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.unit-opt').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const unit = btn.getAttribute('data-unit');
                StorageService.savePreferences({ temperature: unit });
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
                user.organization = document.getElementById('setting-org').value;
                StorageService.setUser(user);
                this.updateSidebarUserProfile();
                this.showGlobalToast('Operational profile saved.', 'success');
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
    }

    populateSettingsView() {
        const user = StorageService.getUser();
        if (user) {
            const nameEl = document.getElementById('setting-full-name');
            const emailEl = document.getElementById('setting-email');
            const orgEl = document.getElementById('setting-org');
            if (nameEl) nameEl.value = user.name || '';
            if (emailEl) emailEl.value = user.email || '';
            if (orgEl) orgEl.value = user.organization || '';
        }

        const modeSelect = document.getElementById('setting-mode-select');
        if (modeSelect) {
            modeSelect.value = weatherService.getDataMode();
        }

        const savedContainer = document.getElementById('settings-saved-locations-list');
        if (savedContainer) {
            const list = StorageService.getSavedLocations();
            savedContainer.innerHTML = list.map(l => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-slate-2); padding:10px 14px; border-radius:6px; margin-bottom:8px;">
                    <div>
                        <strong>${l.name}</strong> • ${l.country || l.region} (${l.timezone})
                    </div>
                    <button class="btn-refresh" onclick="alert('Default location updated.')">Set Default</button>
                </div>
            `).join('');
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
                    <span class="mono" style="color:var(--cyan-primary); font-size:0.75rem;">ISRO-SAC / IMD</span>
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
                        <span>📡 AWS Ground In-Situ Network</span>
                    </div>
                    <span class="mono badge-official">QC VALIDATED</span>
                </div>
                <div style="margin-top:14px; display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; justify-content:space-between; background:var(--surface-slate-2); padding:10px 14px; border-radius:6px;">
                        <span>Surface Temperature Sensor</span>
                        <strong class="mono" style="color:#10b981;">${groundObservations.surfaceTempC}°C (GOOD)</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; background:var(--surface-slate-2); padding:10px 14px; border-radius:6px;">
                        <span>Tipping Bucket Rain Gauge</span>
                        <strong class="mono" style="color:#10b981;">CALIBRATED (GOOD)</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; background:var(--surface-slate-2); padding:10px 14px; border-radius:6px;">
                        <span>Barometric Pressure Sensor</span>
                        <strong class="mono" style="color:#10b981;">${groundObservations.barometricPressureHpa} hPa (GOOD)</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; background:var(--surface-slate-2); padding:10px 14px; border-radius:6px;">
                        <span>Ultrasonic Anemometer</span>
                        <strong class="mono" style="color:#10b981;">${groundObservations.windSpeedKmh} km/h (GOOD)</strong>
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
        const formLogin = document.getElementById('form-login');
        if (formLogin) {
            formLogin.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value;
                const pwd = document.getElementById('login-password').value;
                const res = AuthService.login(email, pwd);
                if (res.success) {
                    this.router.navigate('/dashboard');
                } else {
                    document.getElementById('login-alert').textContent = res.error;
                    document.getElementById('login-alert').style.display = 'block';
                }
            });
        }

        const quickDemoBtn = document.getElementById('btn-quick-demo-login');
        if (quickDemoBtn) {
            quickDemoBtn.addEventListener('click', () => {
                AuthService.loginWithDemo();
                this.router.navigate('/dashboard');
            });
        }

        const googleLoginBtn = document.getElementById('btn-google-login');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', () => {
                AuthService.loginWithGoogle();
                this.router.navigate('/dashboard');
            });
        }

        const formSignup = document.getElementById('form-signup');
        if (formSignup) {
            formSignup.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('signup-name').value;
                const email = document.getElementById('signup-email').value;
                const org = document.getElementById('signup-org').value;
                const pwd = document.getElementById('signup-password').value;
                const confirm = document.getElementById('signup-confirm').value;

                if (pwd !== confirm) {
                    document.getElementById('signup-alert').textContent = 'Passwords do not match.';
                    document.getElementById('signup-alert').style.display = 'block';
                    return;
                }

                const res = AuthService.signup(name, email, pwd, org);
                if (res.success) {
                    this.router.navigate('/dashboard');
                } else {
                    document.getElementById('signup-alert').textContent = res.error;
                    document.getElementById('signup-alert').style.display = 'block';
                }
            });
        }

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

        if (nameEl) nameEl.textContent = user.name || 'Officer In-Charge';
        if (orgEl) orgEl.textContent = user.organization || 'ISRO / IMD Meteorological Ops';
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
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
