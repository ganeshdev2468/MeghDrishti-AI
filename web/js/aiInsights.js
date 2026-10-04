const isNumber = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));
const formatTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

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
    const probabilities = hourly.slice(0, 6)
        .map(item => item?.precipitationProbability)
        .filter(isNumber)
        .map(Number);
    return probabilities.length ? Math.max(...probabilities) : null;
};

export function buildAiAssessment(data) {
    const snapshot = data?.snapshot || {};
    const hourly = Array.isArray(data?.hourly) ? data.hourly : [];
    const insights = [];
    const recommendations = [];
    if (!snapshot.available || snapshot.isDemo) {
        return {
            available: false,
            summary: snapshot.isDemo ? 'AI weather insights require live Open-Meteo data.' : 'AI weather insights are unavailable until live weather data is retrieved.',
            insights,
            recommendations,
            keyTakeaways: []
        };
    }

    const humidity = isNumber(snapshot.humidity) ? Number(snapshot.humidity) : null;
    const windSpeed = isNumber(snapshot.windSpeed) ? Number(snapshot.windSpeed) : null;
    const temperature = isNumber(snapshot.temperature) ? Number(snapshot.temperature) : null;
    const feelsLike = isNumber(snapshot.feelsLike) ? Number(snapshot.feelsLike) : null;
    const uvIndex = isNumber(snapshot.uvIndex) ? Number(snapshot.uvIndex) : null;
    const rainProbability = getMaxRainProbability(data);

    if (rainProbability !== null && rainProbability >= 60) {
        const forecast = hourly.slice(0, 6).find(item => Number(item?.precipitationProbability) === rainProbability);
        insights.push({
            icon: '🌧️',
            title: 'Rain probability is elevated',
            detail: `Open-Meteo forecasts a ${rainProbability}% precipitation probability${formatTime(forecast?.time) ? ` around ${formatTime(forecast.time)}` : ' in the next six hours'}.`,
            basis: ['Hourly precipitation probability'],
            period: formatTime(forecast?.time) || 'Next six hours'
        });
    }

    if (humidity !== null && humidity >= 75) {
        insights.push({
            icon: '💧',
            title: 'Humidity is high',
            detail: `Relative humidity is ${humidity}% in the current Open-Meteo data.`,
            basis: ['Current relative humidity'],
            period: 'Current conditions'
        });
    }

    if (windSpeed !== null && windSpeed >= 25) {
        insights.push({
            icon: '💨',
            title: 'Wind speed is elevated',
            detail: `Open-Meteo reports a current wind speed of ${windSpeed} km/h.`,
            basis: ['Current 10 m wind speed'],
            period: 'Current conditions'
        });
    }

    if (feelsLike !== null && temperature !== null && feelsLike - temperature >= 3) {
        insights.push({
            icon: '🌡️',
            title: 'Apparent temperature is higher',
            detail: `The forecast apparent temperature is ${feelsLike}°C versus ${temperature}°C air temperature.`,
            basis: ['Air temperature', 'Apparent temperature'],
            period: 'Current conditions'
        });
    }

    if (uvIndex !== null && uvIndex >= 7) {
        insights.push({
            icon: '☀️',
            title: 'UV index is high',
            detail: `The current hourly forecast reports a UV index of ${uvIndex}.`,
            basis: ['Hourly UV index'],
            period: 'Current forecast hour'
        });
    }

    if (rainProbability !== null && rainProbability >= 60) {
        recommendations.push('Consider keeping rain protection available during the forecast period with elevated precipitation probability.');
    }
    if (uvIndex !== null && uvIndex >= 7) {
        recommendations.push('Consider sun protection during hours with a high forecast UV index.');
    }

    return {
        available: true,
        summary: 'Rule-based observations from available Open-Meteo weather variables. These insights are advisory and are not official warnings.',
        insights,
        recommendations,
        keyTakeaways: insights.map(insight => insight.detail)
    };
}

export function buildWeatherStory(data) {
    const snapshot = data?.snapshot || {};
    if (!snapshot.available || snapshot.isDemo) {
        return {
            headline: "TODAY'S WEATHER STORY",
            summary: 'Live Open-Meteo weather data is required for this analysis.',
            why: [],
            expected: []
        };
    }
    const humidity = isNumber(snapshot.humidity) ? Number(snapshot.humidity) : null;
    const rainProbability = getMaxRainProbability(data);
    const windSpeed = isNumber(snapshot.windSpeed) ? Number(snapshot.windSpeed) : null;
    const uvIndex = isNumber(snapshot.uvIndex) ? Number(snapshot.uvIndex) : null;

    const why = [];
    if (humidity !== null) why.push(`Relative humidity: ${humidity}%`);
    if (rainProbability !== null) why.push(`Maximum hourly precipitation probability in next six hours: ${rainProbability}%`);
    if (windSpeed !== null) why.push(`Current wind speed: ${windSpeed} km/h`);
    if (uvIndex !== null) why.push(`Current hourly UV index: ${uvIndex}`);

    const expected = [];
    if (rainProbability !== null) expected.push(`Hourly precipitation probability peaks at ${rainProbability}% within the next six hours`);
    if (windSpeed !== null) expected.push(`Current forecast wind speed is ${windSpeed} km/h`);
    if (uvIndex !== null) expected.push(`Current hourly UV index is ${uvIndex}`);
    if (!expected.length) expected.push('No current weather variables are available for a summary.');

    return {
        headline: "TODAY'S WEATHER STORY",
        summary: snapshot.isDemo ? 'Live weather data is required for this analysis.' : `${snapshot?.condition || 'Current weather'} for ${snapshot?.location?.name || 'this location'}, based only on available Open-Meteo variables.`,
        why,
        expected
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

    if (now && snapshot.available && !snapshot.isDemo) {
        sections.push({
            title: 'NOW',
            text: `Current conditions are ${snapshot.condition || 'unavailable'}${isNumber(snapshot.temperature) ? `, with ${Number(snapshot.temperature).toFixed(0)}°C` : ''}${isNumber(snapshot.humidity) ? ` and ${Number(snapshot.humidity)}% humidity` : ''}.`,
            source: 'Current snapshot'
        });
    }

    if (nextHours.length) {
        const first = nextHours[0];
        const last = nextHours[nextHours.length - 1];
        if (first.condition || last.condition) sections.push({
            title: 'NEXT FEW HOURS',
            text: `${first.condition || 'Conditions unavailable'}${last.condition && last.condition !== first.condition ? `, changing to ${last.condition.toLowerCase()} later in the forecast period` : ''}.`,
            source: 'Hourly forecast'
        });
    }

    if (today && (isNumber(today.maxTemp) || isNumber(today.rainProbability))) {
        sections.push({
            title: 'TODAY',
            text: `${isNumber(today.maxTemp) ? `Maximum temperature is expected near ${Number(today.maxTemp).toFixed(0)}°C` : ''}${isNumber(today.maxTemp) && isNumber(today.rainProbability) ? ' with ' : ''}${isNumber(today.rainProbability) ? `${Number(today.rainProbability)}% precipitation probability` : ''}.`,
            source: 'Daily forecast'
        });
    }

    if (hourly.length > 12) {
        const evening = hourly[Math.min(12, hourly.length - 1)] || hourly[hourly.length - 1];
        if (evening.condition || isNumber(evening.precipitationProbability)) sections.push({
            title: 'LATER FORECAST',
            text: `${evening.condition || 'Conditions unavailable'}${isNumber(evening.precipitationProbability) ? ` with ${Number(evening.precipitationProbability)}% precipitation probability` : ''}.`,
            source: 'Hourly forecast'
        });
    }

    if (tomorrow && (isNumber(tomorrow.maxTemp) || isNumber(tomorrow.rainProbability))) {
        sections.push({
            title: 'TOMORROW',
            text: `${isNumber(tomorrow.maxTemp) ? `Forecast high ${Number(tomorrow.maxTemp).toFixed(0)}°C` : ''}${isNumber(tomorrow.maxTemp) && isNumber(tomorrow.rainProbability) ? '; ' : ''}${isNumber(tomorrow.rainProbability) ? `${Number(tomorrow.rainProbability)}% precipitation probability` : ''}.`,
            source: 'Daily forecast'
        });
    }

    return { sections };
}

export function buildNwpModelCenter(data) {
    const models = Array.isArray(data?.nwp?.models) ? data.nwp.models.filter(Boolean) : [];
    if (data?.nwp?.available !== true || !models.length || !data?.nwp?.provenance?.source || !data?.nwp?.provenance?.timestamp ||
        !models.every(model => isNumber(model.tempC) && isNumber(model.precip24hMm))) {
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

    const temps = models.map(m => Number(m.tempC));
    const precip = models.map(m => Number(m.precip24hMm));
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
        disagreement: disagreement ? 'Ranges calculated from connected model outputs.' : 'Model differences unavailable',
        uncertainty,
        explanation: 'Model comparison requires model-specific forecast data.'
    };
}

export function buildHistoricalAnalytics(data) {
    const historical = data?.historical;
    const daily = Array.isArray(historical?.daily) ? historical.daily : [];
    if (!daily.length || !historical?.provenance?.source) {
        return {
            available: false,
            message: 'Historical baseline unavailable',
            detail: 'Historical comparison requires a connected historical weather dataset; forecast data is not a historical baseline.'
        };
    }

    const average = (key) => {
        const values = daily.map(item => item?.[key]).filter(isNumber).map(Number);
        return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : null;
    };

    return {
        available: true,
        headline: 'HISTORY & CLIMATE ANALYTICS',
        metrics: {
            avgTemp: average('maxTemp'),
            avgRain: average('precipitationSum'),
            avgHumidity: average('humidity'),
            avgWind: average('windMax')
        },
        message: 'Current period data is available for trend review.',
        detail: historical.provenance.source
    };
}

export function buildSmartAlerts(data) {
    const snapshot = data?.snapshot || {};
    const rainProbability = getMaxRainProbability(data);
    const windSpeed = isNumber(snapshot.windSpeed) ? Number(snapshot.windSpeed) : null;
    const uvIndex = isNumber(snapshot.uvIndex) ? Number(snapshot.uvIndex) : null;
    const temperature = isNumber(snapshot.temperature) ? Number(snapshot.temperature) : null;
    const alerts = [];
    if (!snapshot.available || snapshot.isDemo) return alerts;

    const timestamp = snapshot.provenance?.timestamp || null;
    const location = snapshot?.location?.name || 'Current location';
    const addInsight = (entry) => alerts.push({
        ...entry,
        category: 'AI WEATHER INSIGHT',
        location,
        source: 'Open-Meteo weather data',
        timestamp,
        expectedEffect: 'Advisory analysis only; this is not an official emergency warning.'
    });

    if (rainProbability !== null && rainProbability >= 60) {
        const forecast = (data.hourly || []).slice(0, 6).find(item => Number(item?.precipitationProbability) === rainProbability);
        addInsight({
            id: 'insight-rain-probability',
            severity: 'INFO',
            title: 'Rain probability is elevated',
            reason: `Precipitation probability reaches ${rainProbability}%${formatTime(forecast?.time) ? ` around ${formatTime(forecast.time)}` : ' in the next six hours'}.`,
            timeWindow: formatTime(forecast?.time) || 'Next six hours',
            icon: '🌧️'
        });
    }

    if (windSpeed !== null && windSpeed >= alertThresholds.strongWind) {
        addInsight({
            id: 'insight-wind-speed',
            severity: 'INFO',
            title: 'Wind speed is elevated',
            reason: `The current forecast wind speed is ${windSpeed} km/h.`,
            timeWindow: 'Current conditions',
            icon: '💨'
        });
    }

    if (uvIndex !== null && uvIndex >= alertThresholds.highUv) {
        addInsight({
            id: 'insight-uv-index',
            severity: 'INFO',
            title: 'UV index is high',
            reason: `The current hourly forecast reports a UV index of ${uvIndex}.`,
            timeWindow: 'Current forecast hour',
            icon: '☀️'
        });
    }

    if (temperature !== null && temperature >= alertThresholds.extremeHeat) {
        addInsight({
            id: 'insight-temperature',
            severity: 'INFO',
            title: 'Air temperature is elevated',
            reason: `The current forecast air temperature is ${temperature}°C.`,
            timeWindow: 'Current conditions',
            icon: '🌡️'
        });
    }

    return alerts;
}

export function buildLocationComparison(data) {
    const snapshot = data?.snapshot;
    if (!snapshot?.available || snapshot.isDemo) return [];
    const rainProbability = getMaxRainProbability(data);
    return [{
        name: snapshot.location?.name || 'Current location',
        temperature: isNumber(snapshot.temperature) ? Number(snapshot.temperature) : null,
        rain: rainProbability,
        humidity: isNumber(snapshot.humidity) ? Number(snapshot.humidity) : null,
        wind: isNumber(snapshot.windSpeed) ? Number(snapshot.windSpeed) : null,
        uv: isNumber(snapshot.uvIndex) ? Number(snapshot.uvIndex) : null
    }];
}
