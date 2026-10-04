/**
 * MeghDrishti AI — Provider-Agnostic Scientific Meteorological Data Architecture
 * 
 * Strict Scientific Requirements:
 * 1. DO NOT fabricate observations.
 * 2. DO NOT label simulated data as LIVE.
 * 3. Every dataset contains: source, timestamp, validTime, spatialResolution,
 *    temporalResolution, latitude, longitude, quality, processingLevel, provenance.
 * 4. Distinct provenance types: OBSERVATION, ANALYSIS, NOWCAST, FORECAST,
 *    MODEL OUTPUT, AI/ML ESTIMATE, SIMULATION/DEMO.
 */

import { DEFAULT_LOCATIONS } from '../storage.js';

export const ProvenanceType = {
    OBSERVATION: 'OBSERVATION',
    ANALYSIS: 'ANALYSIS',
    NOWCAST: 'NOWCAST',
    FORECAST: 'FORECAST',
    MODEL_OUTPUT: 'MODEL OUTPUT',
    AIML_ESTIMATE: 'AI/ML ESTIMATE',
    SIMULATION_DEMO: 'SIMULATION/DEMO',
    UNAVAILABLE: 'UNAVAILABLE'
};

export const QualityStatus = {
    GOOD: 'GOOD',
    STALE: 'STALE',
    MISSING: 'MISSING',
    SUSPECT: 'SUSPECT'
};

export const DataMode = {
    LIVE: 'live',
    DEMO: 'demo'
};

/** Base Metadata Container */
export class ProvenanceRecord {
    constructor({
        source,
        timestamp = new Date().toISOString(),
        validTime = new Date().toISOString(),
        spatialResolution = 'N/A',
        temporalResolution = 'N/A',
        latitude,
        longitude,
        quality = QualityStatus.GOOD,
        processingLevel = 'L2',
        provenanceType = ProvenanceType.OBSERVATION,
        modelVersion = null,
        notes = ''
    }) {
        this.source = source;
        this.timestamp = timestamp;
        this.validTime = validTime;
        this.spatialResolution = spatialResolution;
        this.temporalResolution = temporalResolution;
        this.latitude = latitude;
        this.longitude = longitude;
        this.quality = quality;
        this.processingLevel = processingLevel;
        this.provenanceType = provenanceType;
        this.modelVersion = modelVersion;
        this.notes = notes;
    }
}

/** 1. WeatherDataProvider */
export class WeatherDataProvider {
    constructor(mode = DataMode.LIVE) {
        this.mode = mode;
    }

    async getCurrentWeather(lat, lon, timezone = 'UTC') {
        const nowIso = new Date().toISOString();
        if (this.mode === DataMode.LIVE) {
            try {
                const params = new URLSearchParams({
                    latitude: lat.toFixed(4),
                    longitude: lon.toFixed(4),
                    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
                    hourly: 'temperature_2m,precipitation_probability,precipitation,rain,weather_code,surface_pressure,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index',
                    daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max',
                    timezone: timezone || 'auto'
                });
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
                if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
                const data = await res.json();
                
                return {
                    isDemo: false,
                    raw: data,
                    provenance: new ProvenanceRecord({
                        source: 'Open-Meteo Forecast API',
                        timestamp: nowIso,
                        validTime: data.current?.time || nowIso,
                        spatialResolution: 'Provider-dependent grid',
                        temporalResolution: 'Provider-dependent forecast step',
                        latitude: lat,
                        longitude: lon,
                        quality: QualityStatus.GOOD,
                        processingLevel: 'Open-Meteo API response',
                        provenanceType: ProvenanceType.FORECAST,
                        notes: 'Third-party forecast data; not an official IMD observation feed.'
                    })
                };
            } catch (err) {
                console.warn('Live weather provider unavailable:', err);
                return {
                    isDemo: false,
                    available: false,
                    raw: { current: {}, hourly: {}, daily: {} },
                    provenance: new ProvenanceRecord({
                        source: 'Open-Meteo Forecast API',
                        timestamp: null,
                        validTime: null,
                        latitude: lat,
                        longitude: lon,
                        quality: QualityStatus.MISSING,
                        processingLevel: 'Unavailable',
                        provenanceType: ProvenanceType.FORECAST,
                        notes: 'The live request failed; weather values are unavailable.'
                    })
                };
            }
        } else {
            return this._getDemoCurrentWeather(lat, lon, timezone, QualityStatus.GOOD);
        }
    }

    _getDemoCurrentWeather(lat, lon, timezone, quality = QualityStatus.GOOD) {
        const baseTemp = 28.5 + (Math.sin(lat) * 4);
        return {
            isDemo: true,
            raw: {
                current: {
                    time: null,
                    temperature_2m: parseFloat(baseTemp.toFixed(1)),
                    relative_humidity_2m: 82,
                    apparent_temperature: parseFloat((baseTemp + 3.2).toFixed(1)),
                    precipitation: 14.2,
                    rain: 14.2,
                    weather_code: 65,
                    cloud_cover: 92,
                    surface_pressure: 1004.8,
                    wind_speed_10m: 34.2,
                    wind_direction_10m: 235,
                    wind_gusts_10m: 52.6
                }
            },
            provenance: new ProvenanceRecord({
                source: 'MeghDrishti Simulated Atmospheric Generator',
                timestamp: null,
                validTime: null,
                spatialResolution: '3.0 km synthetic grid',
                temporalResolution: '15 min simulation step',
                latitude: lat,
                longitude: lon,
                quality: quality,
                processingLevel: 'L0 Synthetic Simulation',
                provenanceType: ProvenanceType.SIMULATION_DEMO,
                notes: 'Strictly simulated data for testbed/offline verification.'
            })
        };
    }
}

/** 2. SatelliteDataProvider (INSAT-3DS / INSAT-3DR / Meteosat / GOES) */
export class SatelliteDataProvider {
    constructor(mode = DataMode.LIVE) {
        this.mode = mode;
    }

    async getSatelliteProducts(lat, lon) {
        return {
            available: false,
            satellite: null,
            channels: [],
            provenance: new ProvenanceRecord({
                source: 'No satellite provider connected',
                timestamp: null,
                validTime: null,
                latitude: lat,
                longitude: lon,
                quality: QualityStatus.MISSING,
                processingLevel: 'Unavailable',
                provenanceType: ProvenanceType.UNAVAILABLE,
                notes: 'Satellite imagery and derived products are unavailable.'
            })
        };
    }
}

/** 3. RadarDataProvider (IMD Doppler Weather Radar Network) */
export class RadarDataProvider {
    constructor(mode = DataMode.LIVE) {
        this.mode = mode;
    }

    async getRadarTelemetry(lat, lon) {
        return {
            available: false,
            rainfallRateEstimated: null,
            provenance: new ProvenanceRecord({
                source: 'No radar provider connected',
                timestamp: null,
                validTime: null,
                latitude: lat,
                longitude: lon,
                quality: QualityStatus.MISSING,
                processingLevel: 'Unavailable',
                provenanceType: ProvenanceType.UNAVAILABLE,
                notes: 'Radar imagery and radar-derived rainfall estimates are unavailable.'
            })
        };
    }
}

/** 4. ObservationProvider (Ground Automatic Weather Stations - AWS & ARG) */
export class ObservationProvider {
    constructor(mode = DataMode.LIVE) {
        this.mode = mode;
    }

    async getGroundObservations(lat, lon) {
        return {
            available: false,
            network: null,
            accumulations: null,
            provenance: new ProvenanceRecord({
                source: 'No ground-observation provider connected',
                timestamp: null,
                validTime: null,
                latitude: lat,
                longitude: lon,
                quality: QualityStatus.MISSING,
                processingLevel: 'Unavailable',
                provenanceType: ProvenanceType.UNAVAILABLE,
                notes: 'Ground-station observations and accumulations are unavailable.'
            })
        };
    }
}

/** 5. NWPProvider (Numerical Weather Prediction Multi-Model Ensemble) */
export class NWPProvider {
    constructor(mode = DataMode.LIVE) {
        this.mode = mode;
    }

    async getModelEnsemble(lat, lon) {
        return {
            available: false,
            models: [],
            provenance: new ProvenanceRecord({
                source: 'No dedicated NWP comparison provider connected',
                timestamp: null,
                validTime: null,
                latitude: lat,
                longitude: lon,
                quality: QualityStatus.MISSING,
                processingLevel: 'Unavailable',
                provenanceType: ProvenanceType.UNAVAILABLE,
                notes: 'Named model outputs and comparisons are unavailable.'
            })
        };
    }
}

/** 6. HydrologyProvider & TerrainProvider */
export class HydrologyTerrainProvider {
    async getHydroTerrainProfile(lat, lon) {
        return {
            available: false,
            provenance: new ProvenanceRecord({
                source: 'No hydrology or terrain provider connected',
                timestamp: null,
                validTime: null,
                latitude: lat,
                longitude: lon,
                quality: QualityStatus.MISSING,
                processingLevel: 'Unavailable',
                provenanceType: ProvenanceType.UNAVAILABLE,
                notes: 'Terrain, drainage, soil-moisture, and inundation data are unavailable.'
            })
        };
    }
}

/** 7. AlertProvider */
export class AlertProvider {
    constructor(mode = DataMode.LIVE) {
        this.mode = mode;
    }

    async getAlerts(lat, lon, locationName = 'Nellore') {
        return {
            officialFeedAvailable: false,
            officialAlerts: [],
            aiEarlyWarnings: [],
            operatorAlerts: []
        };
    }
}

/** 8. Rainfall Nowcast Engine (15, 30, 60, 120, 180 Minutes) */
export class RainfallNowcastEngine {
    generateNowcast(currentRainfallRate, lat, lon) {
        return {
            available: false,
            nowcastSteps: [],
            provenance: new ProvenanceRecord({
                source: 'No radar-based nowcast provider connected',
                timestamp: null,
                validTime: null,
                latitude: lat,
                longitude: lon,
                quality: QualityStatus.MISSING,
                processingLevel: 'Unavailable',
                provenanceType: ProvenanceType.UNAVAILABLE,
                modelVersion: null,
                notes: 'Short-term precipitation nowcast is unavailable.'
            })
        };
    }
}

/** Unified Master Data Coordinator */
export class MeghDrishtiDataCoordinator {
    constructor() {
        this.mode = DataMode.LIVE;
        this.weatherProvider = new WeatherDataProvider(this.mode);
        this.satelliteProvider = new SatelliteDataProvider(this.mode);
        this.radarProvider = new RadarDataProvider(this.mode);
        this.observationProvider = new ObservationProvider(this.mode);
        this.nwpProvider = new NWPProvider(this.mode);
        this.hydroTerrainProvider = new HydrologyTerrainProvider();
        this.alertProvider = new AlertProvider(this.mode);
        this.nowcastEngine = new RainfallNowcastEngine();
        
        // Observability Metrics
        this.observability = {
            totalIngestionRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            avgLatencyMs: null,
            qcSummary: {
                goodCount: 0,
                staleCount: 0,
                missingCount: 0,
                suspectCount: 0
            },
            activeNode: 'Local demo; no ingestion service connected'
        };
    }

    setMode(mode) {
        this.mode = mode;
        this.weatherProvider.mode = mode;
        this.satelliteProvider.mode = mode;
        this.radarProvider.mode = mode;
        this.observationProvider.mode = mode;
        this.nwpProvider.mode = mode;
        this.alertProvider.mode = mode;
    }
}

export const dataCoordinator = new MeghDrishtiDataCoordinator();
