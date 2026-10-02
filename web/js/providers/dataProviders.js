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
    SIMULATION_DEMO: 'SIMULATION/DEMO'
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
                        validTime: data.current?.time ? `${data.current.time}:00Z` : nowIso,
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
                console.warn('Live weather provider fallback to demo mode:', err);
                return this._getDemoCurrentWeather(lat, lon, timezone, QualityStatus.SUSPECT);
            }
        } else {
            return this._getDemoCurrentWeather(lat, lon, timezone, QualityStatus.GOOD);
        }
    }

    _getDemoCurrentWeather(lat, lon, timezone, quality = QualityStatus.GOOD) {
        const now = new Date();
        const baseTemp = 28.5 + (Math.sin(lat) * 4);
        return {
            isDemo: true,
            raw: {
                current: {
                    time: now.toISOString().slice(0, 16),
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
                timestamp: now.toISOString(),
                validTime: now.toISOString(),
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
        const timestamp = new Date().toISOString();
        const isIndia = (lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98);
        const satelliteName = isIndia ? 'INSAT-3DS (ISRO-SAC / IMD)' : 'Meteosat-9 / GOES-16 Global';

        const channels = [
            {
                id: 'tir1',
                name: 'Thermal Infrared (TIR1 - 10.8 µm)',
                product: 'Cloud Top Brightness Temperature',
                value: '-68.4 °C',
                status: 'Deep Convective Core Detected',
                resolution: '4.0 km',
                processingLevel: 'L1B Radiance Corrected'
            },
            {
                id: 'wv',
                name: 'Water Vapour (WV - 6.8 µm)',
                product: 'Middle/Upper Tropospheric Moisture Flux',
                value: '58.2 kg/m²',
                status: 'Strong Tropopause Moisture Advection',
                resolution: '4.0 km',
                processingLevel: 'L2G Geophysical Flux'
            },
            {
                id: 'vis',
                name: 'Visible Channel (VIS - 0.65 µm)',
                product: 'Solar Albedo & Cloud Optical Thickness',
                value: '0.88 Albedo',
                status: 'High Optical Depth Cirrus/Cumulonimbus',
                resolution: '1.0 km',
                processingLevel: 'L1B Calibrated'
            },
            {
                id: 'qpe',
                name: 'Hydro-Estimator QPE',
                product: 'Satellite Quantitative Precipitation Estimation',
                value: '28.5 mm/hr',
                status: 'Severe Localized Rain Cell',
                resolution: '4.0 km',
                processingLevel: 'L3 Gridded QPE'
            },
            {
                id: 'cmv',
                name: 'Cloud Motion Vectors (CMV)',
                product: 'Upper-Level Wind Vector Advection',
                value: '240° @ 28 kts',
                status: 'Southwesterly Divergence',
                resolution: '25 km grid',
                processingLevel: 'L2Derived Winds'
            },
            {
                id: 'olr',
                name: 'Outgoing Longwave Radiation (OLR)',
                product: 'Convective Proxy Energy',
                value: '142 W/m²',
                status: 'Intense Mesoscale Convective System (<160 W/m²)',
                resolution: '8.0 km',
                processingLevel: 'L3 Daily/Sub-daily'
            }
        ];

        return {
            satellite: `${satelliteName} (demo example)`,
            sensor: 'Advanced Imager (IMAGER) & 19-Channel Sounder',
            coverage: isIndia ? 'Indian Subcontinent & Northern Indian Ocean' : 'Global Tropical Belt',
            channels,
            provenance: new ProvenanceRecord({
                source: 'Static demo example; no satellite provider connected',
                timestamp: timestamp,
                validTime: timestamp,
                spatialResolution: '1.0 km (VIS) to 4.0 km (TIR1/WV)',
                temporalResolution: '15-minute rapid scan',
                latitude: lat,
                longitude: lon,
                quality: QualityStatus.GOOD,
                processingLevel: 'L2G / L3 Science Calibrated',
                provenanceType: ProvenanceType.SIMULATION_DEMO,
                notes: 'Static illustrative product; no satellite feed is connected.'
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
        const timestamp = new Date().toISOString();
        const radarStations = DEFAULT_LOCATIONS.map(location => ({
            name: location.name,
            lat: location.lat,
            lon: location.lon,
            maxRangeKm: 250
        }));

        let nearest = radarStations[0];
        let minDist = 999999;
        radarStations.forEach(st => {
            const dist = Math.hypot(st.lat - lat, st.lon - lon) * 111;
            if (dist < minDist) {
                minDist = dist;
                nearest = st;
            }
        });

        // Compute simulated or live reflectivity
        const maxReflectivity = minDist < 80 ? 54.5 : (minDist < 160 ? 42.0 : 28.5);
        const rainRate = Math.pow(10, (maxReflectivity - 16) / 16); // Marshall-Palmer Z-R relation: Z = 200 * R^1.6

        return {
            stationName: `${nearest.name} (demo example)`,
            distanceKm: Math.round(minDist),
            sweepAngle: '0.5° PPI Elevation Scan',
            maxReflectivityDbz: parseFloat(maxReflectivity.toFixed(1)),
            radialVelocity: '-18.4 m/s (Inbound meso-cyclonic shear)',
            spectralWidth: '4.8 m/s',
            rainfallRateEstimated: parseFloat(Math.min(180, rainRate).toFixed(1)),
            echoTopKm: 14.8,
            vilKgM2: 48.2, // Vertically Integrated Liquid
            stormCellsDetected: 3,
            provenance: new ProvenanceRecord({
                source: `Synthetic radar scenario near ${nearest.name}`,
                timestamp: timestamp,
                validTime: timestamp,
                spatialResolution: '250 m bin length, 1.0° azimuth',
                temporalResolution: '10-minute volume scan',
                latitude: nearest.lat,
                longitude: nearest.lon,
                quality: minDist < 250 ? QualityStatus.GOOD : QualityStatus.SUSPECT,
                processingLevel: 'L2 Polarimetric QC Refined',
                provenanceType: ProvenanceType.SIMULATION_DEMO,
                notes: 'Synthetic radar values; no IMD radar feed is connected.'
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
        const timestamp = new Date().toISOString();
        return {
            network: 'Synthetic ground-observation examples',
            stationId: `AWS-${Math.abs(Math.round(lat * 100))}-${Math.abs(Math.round(lon * 100))}`,
            surfaceTempC: 27.8,
            relativeHumidity: 88,
            barometricPressureHpa: 1003.4,
            pressureTendencyHpa3h: -2.8, // falling rapidly -> severe convective indicator
            windSpeedKmh: 38,
            windDirectionDeg: 240,
            accumulations: {
                r15m: 8.5,
                r1h: 32.4,
                r3h: 68.0,
                r6h: 114.5,
                r24h: 182.0
            },
            qcFlags: {
                temperature: QualityStatus.GOOD,
                rainfall: QualityStatus.GOOD,
                pressure: QualityStatus.GOOD,
                wind: QualityStatus.GOOD
            },
            provenance: new ProvenanceRecord({
                source: 'MeghDrishti static ground-station demo',
                timestamp: timestamp,
                validTime: timestamp,
                spatialResolution: 'Point In-Situ Observation',
                temporalResolution: '15-minute continuous sampling',
                latitude: lat,
                longitude: lon,
                quality: QualityStatus.GOOD,
                processingLevel: 'L1 Quality Controlled In-Situ',
                provenanceType: ProvenanceType.SIMULATION_DEMO,
                notes: 'Static example values; no AWS/ARG telemetry is connected.'
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
        const now = new Date();
        const initTime = new Date(now.getTime() - 4 * 3600 * 1000).toISOString().slice(0, 13) + ':00:00Z'; // 00Z or 12Z cycle
        const validTime = new Date(now.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 13) + ':00:00Z';

        const models = [
            {
                id: 'imd-wrf',
                name: 'IMD High-Resolution WRF',
                agency: 'India Meteorological Department (IMD)',
                resolution: '3 km convective-permitting',
                initTime: initTime,
                validTime: validTime,
                tempC: 26.8,
                precip24hMm: 165.0,
                capeJkg: 2850,
                cinJkg: -18,
                pwatMm: 62.4,
                cloudburstProbability: 64,
                confidence: 'High (convection resolved)'
            },
            {
                id: 'ncmrwf-ncum',
                name: 'NCMRWF Unified Model (NCUM)',
                agency: 'National Centre for Medium Range Weather Forecasting',
                resolution: '12 km regional deterministic',
                initTime: initTime,
                validTime: validTime,
                tempC: 27.2,
                precip24hMm: 142.0,
                capeJkg: 2400,
                cinJkg: -24,
                pwatMm: 58.0,
                cloudburstProbability: 48,
                confidence: 'High'
            },
            {
                id: 'ecmwf-hres',
                name: 'ECMWF Integrated Forecasting System (HRES)',
                agency: 'European Centre for Medium-Range Weather Forecasts',
                resolution: '9 km global deterministic',
                initTime: initTime,
                validTime: validTime,
                tempC: 27.0,
                precip24hMm: 154.0,
                capeJkg: 2620,
                cinJkg: -20,
                pwatMm: 60.2,
                cloudburstProbability: 56,
                confidence: 'Very High'
            },
            {
                id: 'noaa-gfs',
                name: 'NOAA Global Forecast System (GFS)',
                agency: 'National Oceanic and Atmospheric Administration (NWS)',
                resolution: '25 km global',
                initTime: initTime,
                validTime: validTime,
                tempC: 27.5,
                precip24hMm: 128.0,
                capeJkg: 2100,
                cinJkg: -35,
                pwatMm: 55.0,
                cloudburstProbability: 38,
                confidence: 'Moderate'
            },
            {
                id: 'meghdrishti-ens',
                name: 'MeghDrishti Multi-Model Weighted Ensemble',
                agency: 'MeghDrishti AI Data Fusion Engine',
                resolution: '3 km multi-model fused',
                initTime: initTime,
                validTime: validTime,
                tempC: 27.0,
                precip24hMm: 151.2,
                capeJkg: 2610,
                cinJkg: -21,
                pwatMm: 59.8,
                cloudburstProbability: 54,
                confidence: 'Consensus High'
            }
        ];

        return {
            models,
            synopticDiagnosis: 'High atmospheric moisture column (PWAT > 58 mm) coupled with strong convective instability (CAPE > 2500 J/kg) indicates high likelihood of mesoscale convective cloudburst formation along coastal or orographic boundaries.',
            provenance: new ProvenanceRecord({
                source: 'MeghDrishti static NWP scenario examples',
                timestamp: now.toISOString(),
                validTime: validTime,
                spatialResolution: '3 km to 25 km multi-grid',
                temporalResolution: '3-hour forecast steps',
                latitude: lat,
                longitude: lon,
                quality: QualityStatus.GOOD,
                processingLevel: 'L4 Post-Processed Model Output',
                provenanceType: ProvenanceType.SIMULATION_DEMO,
                notes: 'Illustrative values only; no named-agency model feeds are connected.'
            })
        };
    }
}

/** 6. HydrologyProvider & TerrainProvider */
export class HydrologyTerrainProvider {
    async getHydroTerrainProfile(lat, lon) {
        const timestamp = new Date().toISOString();
        return {
            basinName: 'Ulhas / Mithi / Urban Watershed Corridor',
            cartoDemElevationM: 14.2,
            averageSlopeDeg: 1.8, // low-lying flat terrain
            drainageDensity: '0.42 km/km² (Highly restricted urban concrete drainage)',
            soilMoistureSaturationPct: 91.5, // Antecedent rainfall saturated
            imperviousSurfaceFraction: 0.78, // 78% concrete/asphalt
            peakRunoffDischargeM3s: 412.5, // Q = CIA
            inundationChokePoints: [
                { name: 'Underpass A (Subway Connector)', depthEstM: 1.45, status: 'Impassable' },
                { name: 'Low-Lying Rail Junction', depthEstM: 0.65, status: 'Submerged Track' },
                { name: 'Main Storm Outfall Sluice', depthEstM: 2.10, status: 'Tidal Lock Choke' }
            ],
            provenance: new ProvenanceRecord({
                source: 'MeghDrishti synthetic terrain and runoff scenario',
                timestamp: timestamp,
                validTime: timestamp,
                spatialResolution: '10m CartoDEM spatial grid',
                temporalResolution: 'Static elevation with dynamic runoff update',
                latitude: lat,
                longitude: lon,
                quality: QualityStatus.GOOD,
                processingLevel: 'L3 Hydrodynamic GIS Grid',
                provenanceType: ProvenanceType.SIMULATION_DEMO,
                notes: 'Illustrative terrain and runoff values; no DEM or hydrology feed is connected.'
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
        const now = new Date();
        const validUntil = new Date(now.getTime() + 6 * 3600 * 1000).toISOString();

        return {
            officialAlerts: [],
            aiEarlyWarnings: [
                {
                    id: 'MD-AI-EW-902',
                    category: 'SIMULATED SCENARIO',
                    engine: 'Static MeghDrishti demo values',
                    headline: `Illustrative flood-risk scenario for ${locationName}`,
                    riskLevel: 'VERY HIGH',
                    riskScore: 88,
                    confidence: '84% (Uncertainty ±6 mm/hr)',
                    timeWindow: 'Next 60 - 180 Minutes',
                    affectedAreaEstKm2: 42.5,
                    majorContributingFactors: [
                        'Sustained rainfall intensity > 45 mm/hr detected on DWR sweep',
                        'Antecedent 24h rainfall 182 mm causing complete soil saturation (91.5%)',
                        'Low-lying coastal topography (CartoDEM elevation < 15m) with 1.8° average slope',
                        'High impervious surface fraction (78%) preventing natural soil infiltration',
                        'Forecast convergence line indicating persistent convective cell stagnation'
                    ],
                    provenance: new ProvenanceRecord({
                        source: 'MeghDrishti static scenario example',
                        timestamp: now.toISOString(),
                        validTime: validUntil,
                        spatialResolution: '500m Urban Cell Grid',
                        temporalResolution: '15-minute inference cycle',
                        latitude: lat,
                        longitude: lon,
                        quality: QualityStatus.GOOD,
                        processingLevel: 'L4 AI Derived Inundation Risk',
                        provenanceType: ProvenanceType.SIMULATION_DEMO,
                        modelVersion: null,
                        notes: 'Illustrative static values; not an AI model result or government warning.'
                    })
                }
            ],
            operatorAlerts: [
                {
                    id: 'OPS-INC-401',
                    category: 'LOCAL DEMO SCENARIO',
                    priority: 'CRITICAL',
                    sector: 'Municipal Storm Drainage & Traffic Transit',
                    summary: 'Pumping Station Choke Point #3 operating at 95% capacity. Sluice gates open for low-tide gravity outflow.',
                    status: 'INVESTIGATING', // ACKNOWLEDGED, INVESTIGATING, DISPATCHED, RESOLVED
                    assignedTeam: 'Sample team; no dispatch',
                    timestamp: now.toISOString()
                },
                {
                    id: 'OPS-INC-402',
                    category: 'LOCAL DEMO SCENARIO',
                    priority: 'HIGH',
                    sector: 'Railway Overhead Power & Track Submersion',
                    summary: 'Water level at low-line railway track reached 180 mm above sleeper level. Speed restriction 15 km/h enforced.',
                    status: 'DISPATCHED',
                    assignedTeam: 'Sample team; no dispatch',
                    timestamp: now.toISOString()
                }
            ]
        };
    }
}

/** 8. Rainfall Nowcast Engine (15, 30, 60, 120, 180 Minutes) */
export class RainfallNowcastEngine {
    generateNowcast(currentRainfallRate, lat, lon) {
        const baseRate = Math.max(0, currentRainfallRate || 12.0);
        const intervals = [
            { minutes: 15, multiplier: 1.15, prob: 94, confLow: -2.0, confHigh: 3.5 },
            { minutes: 30, multiplier: 1.35, prob: 88, confLow: -4.0, confHigh: 5.5 },
            { minutes: 60, multiplier: 1.50, prob: 82, confLow: -6.5, confHigh: 8.0 },
            { minutes: 120, multiplier: 1.10, prob: 74, confLow: -9.0, confHigh: 11.0 },
            { minutes: 180, multiplier: 0.75, prob: 65, confLow: -12.0, confHigh: 14.0 }
        ];

        const steps = intervals.map(item => {
            const expRain = parseFloat((baseRate * item.multiplier).toFixed(1));
            const lowBound = Math.max(0, parseFloat((expRain + item.confLow).toFixed(1)));
            const highBound = parseFloat((expRain + item.confHigh).toFixed(1));
            return {
                leadTimeMinutes: item.minutes,
                label: `+${item.minutes} min`,
                expectedRainfallMmHr: expRain,
                probabilityPct: item.prob,
                confidenceInterval: `[${lowBound} - ${highBound} mm/hr]`,
                intensityClassification: expRain > 50 ? 'Extremely Heavy' : (expRain > 25 ? 'Very Heavy' : (expRain > 10 ? 'Heavy' : 'Moderate'))
            };
        });

        return {
            currentRateMmHr: baseRate,
            nowcastSteps: steps,
            provenance: new ProvenanceRecord({
                source: 'MeghDrishti illustrative nowcast scenario',
                timestamp: new Date().toISOString(),
                validTime: new Date(Date.now() + 180 * 60 * 1000).toISOString(),
                spatialResolution: '1.0 km nowcasting grid',
                temporalResolution: '15-minute lead intervals',
                latitude: lat,
                longitude: lon,
                quality: QualityStatus.GOOD,
                processingLevel: 'L3 Nowcast Product',
                provenanceType: ProvenanceType.SIMULATION_DEMO,
                modelVersion: null,
                notes: 'Illustrative multipliers; no radar motion vectors or nowcast model are connected.'
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
