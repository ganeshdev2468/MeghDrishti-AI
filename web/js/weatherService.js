/**
 * Normalized Weather & Telemetry Service for MeghDrishti AI
 * Connects to Open-Meteo & data providers in dataProviders.js.
 * Strictly adheres to scientific requirements:
 * - Real observations vs Model Output vs AI/ML Estimate vs Simulation/Demo
 * - Complete data provenance and uncertainty metrics
 */

import {
    dataCoordinator,
    DataMode,
    ProvenanceType,
    QualityStatus
} from './providers/dataProviders.js';
import { DEFAULT_LOCATIONS } from './storage.js';

// WMO Weather Interpretation Codes
const WMO_CODE_MAP = {
    0: { label: 'Clear Sky', icon: '☀️', type: 'clear' },
    1: { label: 'Mainly Clear', icon: '🌤️', type: 'clear' },
    2: { label: 'Partly Cloudy', icon: '⛅', type: 'cloudy' },
    3: { label: 'Overcast', icon: '☁️', type: 'cloudy' },
    45: { label: 'Fog', icon: '🌫️', type: 'fog' },
    48: { label: 'Depositing Rime Fog', icon: '🌫️', type: 'fog' },
    51: { label: 'Light Drizzle', icon: '🌦️', type: 'rain' },
    53: { label: 'Moderate Drizzle', icon: '🌧️', type: 'rain' },
    55: { label: 'Dense Drizzle', icon: '🌧️', type: 'rain' },
    61: { label: 'Slight Rain', icon: '🌦️', type: 'rain' },
    63: { label: 'Moderate Rain', icon: '🌧️', type: 'rain' },
    65: { label: 'Heavy Rain', icon: '⛈️', type: 'rain' },
    66: { label: 'Light Freezing Rain', icon: '🌨️', type: 'snow' },
    67: { label: 'Heavy Freezing Rain', icon: '🌨️', type: 'snow' },
    71: { label: 'Slight Snow Fall', icon: '🌨️', type: 'snow' },
    73: { label: 'Moderate Snow Fall', icon: '❄️', type: 'snow' },
    75: { label: 'Heavy Snow Fall', icon: '❄️', type: 'snow' },
    77: { label: 'Snow Grains', icon: '❄️', type: 'snow' },
    80: { label: 'Slight Rain Showers', icon: '🌦️', type: 'rain' },
    81: { label: 'Moderate Showers', icon: '🌧️', type: 'rain' },
    82: { label: 'Violent Rain Showers', icon: '⛈️', type: 'severe' },
    85: { label: 'Slight Snow Showers', icon: '🌨️', type: 'snow' },
    86: { label: 'Heavy Snow Showers', icon: '❄️', type: 'snow' },
    95: { label: 'Thunderstorm', icon: '⛈️', type: 'thunderstorm' },
    96: { label: 'Thunderstorm with Slight Hail', icon: '⛈️', type: 'severe' },
    99: { label: 'Thunderstorm with Heavy Hail', icon: '⛈️', type: 'severe' }
};

export class WeatherService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 3 * 60 * 1000; // 3 minutes
        this.inFlightRequests = new Map();
        this.dataMode = DataMode.LIVE; // 'live' | 'demo'
    }

    setDataMode(mode) {
        this.dataMode = mode;
        dataCoordinator.setMode(mode);
        this.cache.clear(); // invalidate cache on mode switch
    }

    getDataMode() {
        return this.dataMode;
    }

    /** Search the supported Andhra Pradesh locations. */
    async searchLocations(query) {
        if (!query || query.trim().length < 2) return [];

        const normalizedQuery = query.trim().toLowerCase();
        return DEFAULT_LOCATIONS
            .filter(location => `${location.name} ${location.region} ${location.country}`
                .toLowerCase().includes(normalizedQuery))
            .map(location => ({
                ...location,
                countryCode: 'IN',
                elevation: 0
            }));
    }

    /**
     * Retrieve normalized real-time weather and comprehensive operations payload
     */
    async getWeather(location, { forceRefresh = false } = {}) {
        const { lat, lon, name, timezone } = location;
        const cacheKey = `weather:${this.dataMode}:${lat.toFixed(4)}_${lon.toFixed(4)}`;

        // Check active in-flight request
        if (this.inFlightRequests.has(cacheKey)) {
            return this.inFlightRequests.get(cacheKey);
        }

        if (forceRefresh) this.cache.delete(cacheKey);

        // Check memory cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }

        const requestPromise = (async () => {
            // 1. Ingest base synoptic weather
            const weatherResult = await dataCoordinator.weatherProvider.getCurrentWeather(lat, lon, timezone);
            const raw = weatherResult.raw;
            const weatherProvenance = weatherResult.provenance;

            // 2. Fetch specialized remote sensing & NWP telemetry
            const [
                satelliteData,
                radarData,
                groundObs,
                nwpEnsemble,
                hydroTerrain,
                alertsData
            ] = await Promise.all([
                dataCoordinator.satelliteProvider.getSatelliteProducts(lat, lon),
                dataCoordinator.radarProvider.getRadarTelemetry(lat, lon),
                dataCoordinator.observationProvider.getGroundObservations(lat, lon),
                dataCoordinator.nwpProvider.getModelEnsemble(lat, lon),
                dataCoordinator.hydroTerrainProvider.getHydroTerrainProfile(lat, lon),
                dataCoordinator.alertProvider.getAlerts(lat, lon, location.name)
            ]);

            // 3. Generate Rainfall Nowcast (15 to 180 min)
            const nowcastData = dataCoordinator.nowcastEngine.generateNowcast(null, lat, lon);

            // 4. Normalize synoptic data
            const cur = raw.current || {};
            const hourly = raw.hourly || {};
            const daily = raw.daily || {};
            const tz = raw.timezone || timezone || 'UTC';
            const wmoInfo = WMO_CODE_MAP[cur.weather_code] || { label: 'Unavailable', icon: '—', type: 'unavailable' };
            let forecastStartIndex = 0;
            if (Array.isArray(hourly.time) && cur.time) {
                const currentHour = cur.time.slice(0, 13);
                let matchingIndex = hourly.time.findIndex(time => time.startsWith(currentHour));
                if (matchingIndex < 0) matchingIndex = hourly.time.findIndex(time => time >= cur.time);
                if (matchingIndex >= 0) forecastStartIndex = matchingIndex;
            }

            const snapshot = {
                location: {
                    name: location.name,
                    region: location.region || '',
                    country: location.country || '',
                    lat: lat,
                    lon: lon,
                    elevation: raw.elevation ?? null
                },
                timezone: tz,
                timestamp: cur.time || null,
                available: weatherResult.available !== false && Object.entries(cur).some(([key, value]) => key !== 'time' && value != null),
                temperature: cur.temperature_2m ?? null,
                feelsLike: cur.apparent_temperature ?? null,
                humidity: cur.relative_humidity_2m ?? null,
                pressure: cur.surface_pressure ?? null,
                precipitation: cur.precipitation ?? null,
                rain: cur.rain ?? null,
                windSpeed: cur.wind_speed_10m ?? null,
                windDirection: cur.wind_direction_10m ?? null,
                windGust: cur.wind_gusts_10m ?? null,
                visibility: hourly.visibility?.[forecastStartIndex] != null ? hourly.visibility[forecastStartIndex] / 1000 : null,
                uvIndex: hourly.uv_index?.[forecastStartIndex] ?? null,
                cloudCover: cur.cloud_cover ?? null,
                isDay: cur.is_day === 1,
                sunrise: daily.sunrise && daily.sunrise[0] ? daily.sunrise[0] : null,
                sunset: daily.sunset && daily.sunset[0] ? daily.sunset[0] : null,
                condition: wmoInfo.label,
                conditionIcon: wmoInfo.icon,
                conditionCode: cur.weather_code ?? null,
                source: weatherProvenance.source,
                isDemo: weatherResult.isDemo || this.dataMode === DataMode.DEMO,
                provenance: weatherProvenance
            };

            // 5. Hourly Forecast
            const hourlyItems = [];
            if (hourly.time && hourly.time.length) {
                for (let i = forecastStartIndex; i < Math.min(forecastStartIndex + 24, hourly.time.length); i++) {
                    const code = hourly.weather_code ? hourly.weather_code[i] : 0;
                    const info = WMO_CODE_MAP[code] || { label: 'Unavailable', icon: '—' };
                    hourlyItems.push({
                        time: hourly.time[i],
                        temp: hourly.temperature_2m?.[i] ?? null,
                        humidity: hourly.relative_humidity_2m?.[i] ?? null,
                        precipitationProbability: hourly.precipitation_probability?.[i] ?? null,
                        rainAmount: hourly.precipitation?.[i] ?? null,
                        windSpeed: hourly.wind_speed_10m?.[i] ?? null,
                        windDirection: hourly.wind_direction_10m?.[i] ?? null,
                        condition: info.label,
                        icon: info.icon
                    });
                }
            }

            // 6. Daily Forecast
            const dailyItems = [];
            if (daily.time && daily.time.length) {
                for (let i = 0; i < Math.min(14, daily.time.length); i++) {
                    const code = daily.weather_code ? daily.weather_code[i] : 0;
                    const info = WMO_CODE_MAP[code] || { label: 'Unavailable', icon: '—' };
                    dailyItems.push({
                        date: daily.time[i],
                        maxTemp: daily.temperature_2m_max?.[i] ?? null,
                        minTemp: daily.temperature_2m_min?.[i] ?? null,
                        rainProbability: daily.precipitation_probability_max?.[i] ?? null,
                        precipitationSum: daily.precipitation_sum?.[i] ?? null,
                        uvMax: daily.uv_index_max?.[i] ?? null,
                        windMax: daily.wind_speed_10m_max?.[i] ?? null,
                        condition: info.label,
                        icon: info.icon
                    });
                }
            }

            const normalizedResult = {
                snapshot,
                hourly: hourlyItems,
                daily: dailyItems,
                groundObservations: groundObs,
                radar: radarData,
                satellite: satelliteData,
                nwp: nwpEnsemble,
                hydroTerrain: hydroTerrain,
                nowcast: nowcastData,
                stormCells: [],
                floodRisk: { available: false, reason: 'Live flood-risk modeling is not connected.' },
                alerts: alertsData,
                observability: dataCoordinator.observability,
                lastUpdated: new Date()
            };

            this.cache.set(cacheKey, { timestamp: Date.now(), data: normalizedResult });
            return normalizedResult;
        })();

        this.inFlightRequests.set(cacheKey, requestPromise);

        try {
            return await requestPromise;
        } finally {
            this.inFlightRequests.delete(cacheKey);
        }
    }

    /**
     * Format temperature according to preference
     */
    formatTemp(celsius, unit = 'celsius') {
        if (celsius === null || celsius === undefined || isNaN(celsius)) return '--';
        if (unit === 'fahrenheit') {
            return `${Math.round((celsius * 9/5) + 32)}°F`;
        }
        return `${Math.round(celsius)}°C`;
    }

    /**
     * Format wind speed according to preference
     */
    formatWind(kmh, unit = 'kmh') {
        if (kmh === null || kmh === undefined || isNaN(kmh)) return '--';
        if (unit === 'mph') {
            return `${(kmh * 0.621371).toFixed(0)} mph`;
        } else if (unit === 'ms') {
            return `${(kmh / 3.6).toFixed(1)} m/s`;
        }
        return `${Math.round(kmh)} km/h`;
    }

    /**
     * Format atmospheric pressure
     */
    formatPressure(hpa, unit = 'hpa') {
        if (hpa === null || hpa === undefined || isNaN(hpa)) return '--';
        if (unit === 'inhg') {
            return `${(hpa * 0.02953).toFixed(2)} inHg`;
        }
        return `${Math.round(hpa)} hPa`;
    }

    /**
     * Format precipitation
     */
    formatPrecip(mm, unit = 'mm') {
        if (mm === null || mm === undefined || isNaN(mm)) return '--';
        if (unit === 'inch') {
            return `${(mm * 0.03937).toFixed(2)} in`;
        }
        return `${mm.toFixed(1)} mm`;
    }

    /**
     * Convert wind degrees to cardinal direction
     */
    degToCompass(num) {
        const val = Math.floor((num / 22.5) + 0.5);
        const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
        return arr[(val % 16)];
    }
}

export const weatherService = new WeatherService();
