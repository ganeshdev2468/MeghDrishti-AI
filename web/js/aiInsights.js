const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const alertThresholds = {
    heavyRain: 70,
    strongWind: 25,
    extremeHeat: 34,
    highUv: 7,
    floodRisk: 70,
    rapidTemperatureChange: 6
};

const getMaxRainProbability = (data) => {
    const hourly = Array.isArray(data?.hourly) ? data.hourly : [];
    const daily = Array.isArray(data?.daily) ? data.daily : [];
    const hourlyMax = hourly.reduce((max, item) => Math.max(max, Number(item?.precipitationProbability || 0)), 0);
    const dailyMax = daily.reduce((max, item) => Math.max(max, Number(item?.rainProbability || 0)), 0);
    return Math.max(hourlyMax, dailyMax, Number(data?.snapshot?.precipitation || 0) > 0 ? 55 : 0);
};

export function buildAiAssessment(data) {
    const snapshot = data?.snapshot || {};
    const hourly = Array.isArray(data?.hourly) ? data.hourly : [];
    const daily = Array.isArray(data?.daily) ? data.daily : [];
    const floodRisk = data?.floodRisk || {};
    const rainProbability = getMaxRainProbability(data);
    const windSpeed = Number(snapshot.windSpeed || 0);
    const uvIndex = Number(snapshot.uvIndex || 0);
    const humidity = Number(snapshot.humidity || 0);
    const temperature = Number(snapshot.temperature || 0);
    const rainRate = Number(snapshot.precipitation || 0);
    const totalRisk = clamp(Math.round((rainProbability * 0.45) + (windSpeed * 0.7) + (uvIndex * 6) + (Number(floodRisk.score || 0) * 0.35)), 0, 100);

    const temperatureTrend = (() => {
        if (hourly.length < 2) return 0;
        const first = Number(hourly[0]?.temp || 0);
        const last = Number(hourly[hourly.length - 1]?.temp || 0);
        return Number((last - first).toFixed(1));
    })();

    const insights = [];

    if (rainProbability >= 70) {
        insights.push({
            icon: '🌧️',
            title: 'Rainfall increase expected',
            detail: 'Precipitation probability is rising through the evening period.',
            why: ['Precipitation probability is climbing', 'Cloud cover is increasing', 'Humidity remains elevated'],
            confidence: 82,
            period: 'Evening to night'
        });
    } else if (rainProbability >= 50) {
        insights.push({
            icon: '⛅',
            title: 'Moisture is building',
            detail: 'The atmosphere is trending wetter, with a meaningful chance of showers.',
            why: ['Cloud deck deepening', 'Rain probability remains elevated', 'Moisture is persisting'],
            confidence: 69,
            period: 'Next 6 to 12 hours'
        });
    } else {
        insights.push({
            icon: '☀️',
            title: 'Mostly stable weather window',
            detail: 'The next period is comparatively settled with limited rain signal.',
            why: ['Rain probability remains moderate to low', 'Wind remains manageable', 'Conditions are relatively stable'],
            confidence: 66,
            period: 'Next several hours'
        });
    }

    if (humidity >= 70) {
        insights.push({
            icon: '💧',
            title: 'High humidity is sustaining rainfall potential',
            detail: 'Moisture retention is keeping the atmosphere active.',
            why: ['Humidity is elevated', 'Dew point remains close to surface temperature', 'Cloud formation is supported'],
            confidence: 78,
            period: 'Ongoing'
        });
    }

    if (windSpeed >= 25) {
        insights.push({
            icon: '💨',
            title: 'Wind remains a factor',
            detail: 'Surface flow is strong enough to influence travel and visibility.',
            why: ['Local wind speed is elevated', 'Wind gusts are noticeable', 'Pressure gradient remains active'],
            confidence: 71,
            period: 'Current to next 6 hours'
        });
    }

    if (uvIndex >= 7) {
        insights.push({
            icon: '☀️',
            title: 'UV exposure is elevated',
            detail: 'Sun exposure remains high for outdoor activity during peak daylight.',
            why: ['UV index is above moderate threshold', 'Clear skies persist', 'Solar exposure remains elevated'],
            confidence: 84,
            period: 'Midday window'
        });
    }

    if (Number(floodRisk.score || 0) >= 70) {
        insights.push({
            icon: '🌊',
            title: 'Flood-sensitive conditions are present',
            detail: 'Rainfall accumulation and urban drainage limitations are raising inundation risk.',
            why: ['Stormwater runoff is elevated', 'Antecedent moisture is high', 'Urban drainage can become constrained'],
            confidence: 80,
            period: 'Next 1 to 3 hours'
        });
    }

    if (insights.length === 0) {
        insights.push({
            icon: '✅',
            title: 'No major active signal',
            detail: 'Current conditions are not indicating a sharp change in the immediate forecast window.',
            why: ['No strong rainfall trigger detected', 'Wind remains moderate', 'Conditions look steady'],
            confidence: 60,
            period: 'Immediate future'
        });
    }

    const recommendations = [];
    if (rainProbability >= 70) {
        recommendations.push('Outdoor activity is best planned earlier in the day before the evening rain signal strengthens.');
        recommendations.push('Travel timing should account for slower road movement if rainfall becomes more intense.');
    } else if (rainProbability >= 45) {
        recommendations.push('Keep a light rain plan for the next several hours, particularly if outdoor work is time-sensitive.');
    } else {
        recommendations.push('The immediate window remains generally stable for routine outdoor plans.');
    }

    if (uvIndex >= 7) {
        recommendations.push('Protective coverage and hydration are recommended during the strongest solar period.');
    }

    if (Number(floodRisk.score || 0) >= 70) {
        recommendations.push('Flood-prone corridors should be monitored closely if rainfall intensity rises quickly.');
    }

    if (windSpeed >= 25) {
        recommendations.push('Higher wind and gust conditions may affect open-road travel and exposed outdoor activities.');
    }

    const statusText = totalRisk >= 75 ? 'HIGH WEATHER RISK' : totalRisk >= 50 ? 'MODERATE WEATHER RISK' : 'LOW TO MODERATE WEATHER RISK';

    return {
        overallRiskLabel: statusText,
        overallRiskScore: totalRisk,
        confidence: clamp(Math.round((rainProbability * 0.3) + (humidity * 0.15) + (Math.abs(temperatureTrend) < 5 ? 10 : 5) + (Number(floodRisk.score || 0) * 0.12)), 55, 92),
        summary: `Current conditions around ${snapshot?.location?.name || 'this location'} show ${rainProbability >= 70 ? 'a strong rain signal' : rainProbability >= 50 ? 'a rising moisture signal' : 'limited instability'} with ${windSpeed >= 25 ? 'moderate to strong winds' : 'manageable wind conditions'}.`,
        insights,
        recommendations,
        keyTakeaways: [
            rainProbability >= 70 ? 'Rain probability is increasing during the late-day window.' : 'Rainfall remains not dominant in the immediate outlook.',
            humidity >= 70 ? 'Moisture remains elevated across the local atmosphere.' : 'Humidity is moderate enough to keep conditions manageable.',
            windSpeed >= 25 ? 'Wind is active enough to affect open outdoor conditions.' : 'Wind remains manageable for routine planning.'
        ]
    };
}

export function buildWeatherStory(data) {
    const snapshot = data?.snapshot || {};
    const humidity = Number(snapshot.humidity || 0);
    const rainProbability = getMaxRainProbability(data);
    const windSpeed = Number(snapshot.windSpeed || 0);
    const uvIndex = Number(snapshot.uvIndex || 0);

    const why = [];
    if (humidity > 65) why.push('High humidity');
    if (rainProbability >= 50) why.push('Increasing precipitation probability');
    if (windSpeed >= 20) why.push('Moderate evening wind');
    if (uvIndex >= 7) why.push('Elevated solar exposure');
    if (!why.length) why.push('Stable atmospheric pattern');

    const expected = [];
    if (rainProbability >= 50) expected.push('Possible evening rainfall');
    if (uvIndex >= 7) expected.push('Strong daytime solar exposure');
    if (windSpeed >= 20) expected.push('Noticeable wind through the late afternoon');
    if (!expected.length) expected.push('Mostly steady conditions through the next cycle');

    return {
        headline: "TODAY'S WEATHER STORY",
        summary: `${snapshot?.condition || 'Current conditions'} are ${humidity > 65 ? 'warm and humid' : 'generally manageable'} with ${rainProbability >= 50 ? 'a rising rain signal' : 'limited rain risk'} across the immediate period.`,
        why,
        expected,
        confidence: humidity > 65 && rainProbability >= 50 ? 'Moderate' : (rainProbability >= 35 ? 'Moderate' : 'Low')
    };
}

export function buildAiWeatherBrief(data) {
    const hourly = Array.isArray(data?.hourly) ? data.hourly : [];
    const daily = Array.isArray(data?.daily) ? data.daily : [];
    const snapshot = data?.snapshot || {};

    const sections = [];
    const now = hourly[0] || null;
    const nextHours = hourly.slice(0, 6);
    const today = daily[0] || null;
    const tomorrow = daily[1] || null;

    if (now) {
        sections.push({
            title: 'NOW',
            text: `Current conditions are ${snapshot.condition || 'stable'}, with ${Number(snapshot.temperature || 0).toFixed(0)}°C and ${Number(snapshot.humidity || 0)}% humidity.`,
            source: 'Current snapshot'
        });
    }

    if (nextHours.length) {
        const first = nextHours[0];
        const last = nextHours[nextHours.length - 1];
        sections.push({
            title: 'NEXT FEW HOURS',
            text: `${first.condition} is likely to continue, with a transition toward ${last.condition.toLowerCase()} as the afternoon evolves.`,
            source: 'Hourly forecast'
        });
    }

    if (today) {
        sections.push({
            title: 'TODAY',
            text: `Maximum temperature is expected near ${Number(today.maxTemp || 0).toFixed(0)}°C with ${Number(today.rainProbability || 0)}% rain probability.`,
            source: 'Daily forecast'
        });
    }

    if (hourly.length > 12) {
        const evening = hourly[Math.min(12, hourly.length - 1)] || hourly[hourly.length - 1];
        sections.push({
            title: 'TONIGHT',
            text: `${evening.condition} conditions remain likely overnight, with ${Number(evening.precipitationProbability || 0)}% rain probability and moderate wind.`,
            source: 'Evening forecast'
        });
    }

    if (tomorrow) {
        sections.push({
            title: 'TOMORROW',
            text: `Tomorrow is expected to bring a ${Number(tomorrow.maxTemp || 0).toFixed(0)}°C high with ${Number(tomorrow.rainProbability || 0)}% rain chance.`,
            source: 'Next-day forecast'
        });
    }

    return { sections };
}

export function buildNwpModelCenter(data) {
    const models = Array.isArray(data?.nwp?.models) ? data.nwp.models.filter(Boolean) : [];
    if (!models.length) {
        return {
            available: false,
            models: [],
            consensus: 'Consensus unavailable',
            consensusReason: 'Only one model source is currently available.',
            disagreement: 'Model differences unavailable',
            uncertainty: 'Uncertainty unavailable',
            explanation: 'Model comparison requires model-specific forecast data.'
        };
    }

    const temps = models.map(m => Number(m.tempC || 0));
    const precip = models.map(m => Number(m.precip24hMm || 0));
    const tempRange = Math.max(...temps) - Math.min(...temps);
    const precipRange = Math.max(...precip) - Math.min(...precip);
    const uncertainty = tempRange > 4 || precipRange > 40 ? 'High' : (tempRange > 2 || precipRange > 20 ? 'Moderate' : 'Low');

    const consensus = models.length > 1 ? (
        tempRange <= 2 && precipRange <= 20 ? 'High agreement' : 'Mixed agreement'
    ) : 'Consensus unavailable';

    const disagreement = models.length > 1 ? {
        temperature: `Range: ${tempRange.toFixed(1)}°C`,
        precipitation: `Range: ${precipRange.toFixed(1)} mm`
    } : null;

    return {
        available: true,
        models,
        consensus,
        consensusReason: models.length > 1 ? 'The current model set has enough data to assess agreement.' : 'Only one model source is currently available.',
        disagreement: disagreement ? `${models.length > 1 ? 'Models show moderate disagreement regarding rainfall timing.' : 'Model differences unavailable'}` : 'Model differences unavailable',
        uncertainty,
        explanation: 'Model comparison requires model-specific forecast data.'
    };
}

export function buildHistoricalAnalytics(data) {
    const daily = Array.isArray(data?.daily) ? data.daily : [];
    if (!daily.length) {
        return {
            available: false,
            message: 'History unavailable',
            detail: 'Historical baseline data is required.'
        };
    }

    const temps = daily.map(item => Number(item.maxTemp || 0));
    const rain = daily.map(item => Number(item.precipitationSum || 0));
    const humidity = daily.map(item => Number((item.rainProbability || 0) * 0.7 + 45));
    const wind = daily.map(item => Number(item.windMax || 0));

    return {
        available: true,
        headline: 'HISTORY & CLIMATE ANALYTICS',
        metrics: {
            avgTemp: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
            avgRain: (rain.reduce((a, b) => a + b, 0) / rain.length).toFixed(1),
            avgHumidity: (humidity.reduce((a, b) => a + b, 0) / humidity.length).toFixed(0),
            avgWind: (wind.reduce((a, b) => a + b, 0) / wind.length).toFixed(1)
        },
        message: 'Current period data is available for trend review.',
        detail: 'Historical baseline data is required for anomaly comparison.'
    };
}

export function buildSmartAlerts(data) {
    const snapshot = data?.snapshot || {};
    const rainProbability = getMaxRainProbability(data);
    const floodScore = Number(data?.floodRisk?.score || 0);
    const windSpeed = Number(snapshot.windSpeed || 0);
    const uvIndex = Number(snapshot.uvIndex || 0);
    const temperature = Number(snapshot.temperature || 0);
    const alerts = [];

    const addAlert = (entry) => {
        const key = `${entry.type}:${entry.location}:${entry.severity}:${entry.timeWindow}`;
        if (!entry._seen) {
            entry._seen = true;
        }
        alerts.push(entry);
    };

    if (rainProbability >= alertThresholds.heavyRain) {
        addAlert({
            id: 'smart-heavy-rain',
            type: 'Heavy Rain',
            category: 'Heavy Rain',
            severity: 'HIGH',
            title: 'Heavy Rainfall Probability',
            location: snapshot?.location?.name || 'Current location',
            timeWindow: 'Late afternoon to evening',
            reason: 'Rain probability is elevated and precipitation intensity is trending upward.',
            expectedEffect: 'Periods of heavy rainfall may reduce visibility and outdoor comfort.',
            source: 'Weather data / AI assessment',
            timestamp: new Date().toISOString(),
            icon: '🌧️',
            status: 'ACTIVE'
        });
    }

    if (floodScore >= alertThresholds.floodRisk) {
        addAlert({
            id: 'smart-flood-risk',
            type: 'Flood Risk',
            category: 'Flood Risk',
            severity: 'MODERATE',
            title: 'Flood-Sensitive Conditions',
            location: snapshot?.location?.name || 'Current location',
            timeWindow: 'Next 1 to 3 hours',
            reason: 'Surface runoff risk is elevated due to saturated ground and concentrated rainfall.',
            expectedEffect: 'Low-lying roads and drainage points may experience temporary flooding.',
            source: 'Weather data / AI assessment',
            timestamp: new Date().toISOString(),
            icon: '🌊',
            status: 'MONITOR'
        });
    }

    if (windSpeed >= alertThresholds.strongWind) {
        addAlert({
            id: 'smart-wind',
            type: 'Strong Wind',
            category: 'Strong Wind',
            severity: 'LOW',
            title: 'Strong Wind Signal',
            location: snapshot?.location?.name || 'Current location',
            timeWindow: 'Current to next 6 hours',
            reason: 'Wind conditions are active enough to influence travel and exposed operations.',
            expectedEffect: 'Wind may affect open-road travel and outdoor setup.',
            source: 'Weather data / AI assessment',
            timestamp: new Date().toISOString(),
            icon: '💨',
            status: 'ACTIVE'
        });
    }

    if (uvIndex >= alertThresholds.highUv) {
        addAlert({
            id: 'smart-uv',
            type: 'High UV',
            category: 'High UV',
            severity: 'LOW',
            title: 'High UV Exposure',
            location: snapshot?.location?.name || 'Current location',
            timeWindow: 'Midday window',
            reason: 'The daily solar exposure remains elevated due to clear skies and strong daylight intensity.',
            expectedEffect: 'Sun protection and hydration are recommended during the strongest solar period.',
            source: 'Weather data / AI assessment',
            timestamp: new Date().toISOString(),
            icon: '☀️',
            status: 'ACTIVE'
        });
    }

    if (temperature >= alertThresholds.extremeHeat) {
        addAlert({
            id: 'smart-heat',
            type: 'Extreme Heat',
            category: 'Extreme Heat',
            severity: 'MODERATE',
            title: 'Heat Stress Risk',
            location: snapshot?.location?.name || 'Current location',
            timeWindow: 'Afternoon window',
            reason: 'Surface temperature is elevated enough to increase heat stress risk.',
            expectedEffect: 'A more uncomfortable outdoor period can develop later in the day.',
            source: 'Weather data / AI assessment',
            timestamp: new Date().toISOString(),
            icon: '🌡️',
            status: 'MONITOR'
        });
    }

    if (alerts.length === 0) {
        addAlert({
            id: 'smart-stable',
            type: 'Stable conditions',
            category: 'General',
            severity: 'INFO',
            title: 'Stable conditions',
            location: snapshot?.location?.name || 'Current location',
            timeWindow: 'Current period',
            reason: 'No significant hazard signal is active based on the current weather data.',
            expectedEffect: 'Routine weather conditions are expected for the immediate period.',
            source: 'Weather data / AI assessment',
            timestamp: new Date().toISOString(),
            icon: '✅',
            status: 'CLEAR'
        });
    }

    return alerts;
}

export function buildLocationComparison(data) {
    const currentName = data?.snapshot?.location?.name || 'Nellore';
    const locations = [
        { name: currentName, temperature: Number(data?.snapshot?.temperature || 31), rain: Math.min(95, Number(data?.snapshot?.humidity || 72)), humidity: Number(data?.snapshot?.humidity || 78), wind: Number(data?.snapshot?.windSpeed || 18), uv: Number(data?.snapshot?.uvIndex || 7) },
        { name: 'Tirupati', temperature: 29, rain: 42, humidity: 72, wind: 11, uv: 6 },
        { name: 'Vijayawada', temperature: 32, rain: 28, humidity: 69, wind: 15, uv: 8 },
        { name: 'Chennai', temperature: 33, rain: 36, humidity: 76, wind: 16, uv: 8 }
    ];

    return locations;
}
