/* ═══════════════════════════════════════════════════════════
   MeghDrishti AI — ISRO/IMD Operational Web Application Logic
   ═══════════════════════════════════════════════════════════ */

// ── Station Telemetry Data ──
const STATIONS = [
    { name: "Mumbai (Colaba DWR)", lat: 18.9068, lon: 72.8073, precip: 85.4, wind: "34 km/h (WSW)", press: 998.4, temp: 27.8, hum: 94, alert: "ORANGE" },
    { name: "Chennai (Nungambakkam DWR)", lat: 13.0674, lon: 80.2376, precip: 24.2, wind: "18 km/h (NE)", press: 1004.1, temp: 31.2, hum: 82, alert: "YELLOW" },
    { name: "Wayanad (Kalpetta Ghats)", lat: 11.6854, lon: 76.0781, precip: 142.8, wind: "48 km/h (SW)", press: 992.6, temp: 21.4, hum: 98, alert: "RED" },
    { name: "Guwahati (Borjhar Radar)", lat: 26.1158, lon: 91.5860, precip: 38.6, wind: "22 km/h (SE)", press: 1001.2, temp: 29.5, hum: 88, alert: "YELLOW" },
    { name: "Delhi NCR (Safdarjung)", lat: 28.5844, lon: 77.2088, precip: 12.0, wind: "14 km/h (NW)", press: 1008.3, temp: 33.1, hum: 68, alert: "GREEN" },
    { name: "Uttarakhand (Dehradun DWR)", lat: 30.3165, lon: 78.0322, precip: 185.0, wind: "52 km/h (N)", press: 989.1, temp: 19.8, hum: 99, alert: "RED" }
];

let activeStationIndex = 0;
let simulationRainfall = 120;
let activeReturnPeriod = 10;
let radarSweepAngle = 0;

// ── Radar Reflectivity Cells ──
let radarCells = [];
let stormCells = [
    { id: "CELL-A", az: 42, r: 85, dbz: 58, hdg: 65, spd: 38 },
    { id: "CELL-B", az: 195, r: 120, dbz: 62, hdg: 45, spd: 42 },
    { id: "CELL-C", az: 310, r: 160, dbz: 46, hdg: 80, spd: 26 }
];

function initRadarCells() {
    radarCells = [];
    for (let i = 0; i < 200; i++) {
        radarCells.push({
            az: Math.random() * 360,
            r: Math.random() * 210 + 20,
            dbz: Math.random() * 55 + 10
        });
    }
}
initRadarCells();

// ── Tab Switching ──
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetTab = btn.getAttribute('data-tab');
        document.getElementById(`tab-${targetTab}`).classList.add('active');
    });
});

// ── Station Switcher ──
const stationSelect = document.getElementById('station-select');
stationSelect.addEventListener('change', (e) => {
    activeStationIndex = parseInt(e.target.value);
    updateStationUI();
});

function updateStationUI() {
    const st = STATIONS[activeStationIndex];
    document.getElementById('active-station-name').textContent = st.name.toUpperCase();
    document.getElementById('telemetry-precip').textContent = `${st.precip} mm/hr`;
    document.getElementById('telemetry-wind').textContent = st.wind;
    document.getElementById('telemetry-pressure').textContent = `${st.press} hPa`;
    document.getElementById('telemetry-temp').textContent = `${st.temp} °C`;
    document.getElementById('telemetry-humidity').textContent = `${st.hum}%`;

    // Update Ribbon
    const ribbon = document.getElementById('alert-ribbon');
    const title = document.getElementById('ribbon-title');
    const desc = document.getElementById('ribbon-desc');

    ribbon.className = `alert-ribbon alert-${st.alert.toLowerCase()}`;
    title.textContent = `IMD ${st.alert} ALERT — ${st.name.toUpperCase()}`;
    desc.textContent = `Observational precipitation: ${st.precip} mm/hr. Barometric pressure: ${st.press} hPa. Ground saturation threshold approaching critical runoff level.`;

    updateStormTable();
    updateInundationStats();
}

function updateStormTable() {
    const tbody = document.getElementById('storm-table-body');
    tbody.innerHTML = '';
    stormCells.forEach(cell => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${cell.id}</strong></td>
            <td>${cell.az.toFixed(0)}°</td>
            <td>${cell.r.toFixed(0)} km</td>
            <td><span class="dbz-tag ${cell.dbz >= 55 ? 'dbz-55' : 'dbz-45'}">${cell.dbz.toFixed(0)}</span></td>
            <td>${cell.spd.toFixed(0)} km/h → ${cell.hdg}°</td>
            <td><span style="color:#00e5ff; font-weight:700;">TRACKED</span></td>
        `;
        tbody.appendChild(tr);
    });
}
updateStormTable();

// ── Radar PPI Scope Canvas Animation ──
const radarCanvas = document.getElementById('radar-canvas');
const rCtx = radarCanvas.getContext('2d');

function drawRadarScope() {
    const w = radarCanvas.width;
    const h = radarCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = w * 0.44;

    rCtx.fillStyle = '#040a14';
    rCtx.fillRect(0, 0, w, h);

    // Range rings
    rCtx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
    rCtx.lineWidth = 1;
    for (let r = 1; r <= 5; r++) {
        rCtx.beginPath();
        rCtx.arc(cx, cy, (maxR / 5) * r, 0, Math.PI * 2);
        rCtx.stroke();
    }

    // Cross-hairs
    rCtx.beginPath();
    rCtx.moveTo(cx - maxR, cy); rCtx.lineTo(cx + maxR, cy);
    rCtx.moveTo(cx, cy - maxR); rCtx.lineTo(cx, cy + maxR);
    rCtx.stroke();

    // Range labels
    rCtx.fillStyle = '#00e5ff';
    rCtx.font = '10px JetBrains Mono';
    rCtx.fillText('50km', cx + 5, cy - (maxR / 5) * 1 + 10);
    rCtx.fillText('100km', cx + 5, cy - (maxR / 5) * 2 + 10);
    rCtx.fillText('150km', cx + 5, cy - (maxR / 5) * 3 + 10);
    rCtx.fillText('200km', cx + 5, cy - (maxR / 5) * 4 + 10);
    rCtx.fillText('250km', cx + 5, cy - maxR + 10);

    // Reflectivity Cells
    radarCells.forEach(cell => {
        const rad = (cell.az * Math.PI) / 180;
        const dist = (cell.r / 250) * maxR;
        const x = cx + dist * Math.sin(rad);
        const y = cy - dist * Math.cos(rad);

        rCtx.fillStyle = getDbzColor(cell.dbz);
        rCtx.beginPath();
        rCtx.arc(x, y, 3 + cell.dbz / 14, 0, Math.PI * 2);
        rCtx.fill();
    });

    // Storm Vectors
    stormCells.forEach(s => {
        const rad = (s.az * Math.PI) / 180;
        const dist = (s.r / 250) * maxR;
        const sx = cx + dist * Math.sin(rad);
        const sy = cy - dist * Math.cos(rad);

        // Circle
        rCtx.strokeStyle = '#ff1744';
        rCtx.lineWidth = 2;
        rCtx.beginPath();
        rCtx.arc(sx, sy, 8, 0, Math.PI * 2);
        rCtx.stroke();

        // Vector arrow
        const hRad = (s.hdg * Math.PI) / 180;
        const vLen = s.spd * 0.6;
        rCtx.strokeStyle = '#ff9100';
        rCtx.lineWidth = 2.5;
        rCtx.beginPath();
        rCtx.moveTo(sx, sy);
        rCtx.lineTo(sx + vLen * Math.sin(hRad), sy - vLen * Math.cos(hRad));
        rCtx.stroke();
    });

    // Radar Beam Sweep
    const sweepRad = (radarSweepAngle * Math.PI) / 180;
    const bx = cx + maxR * Math.sin(sweepRad);
    const by = cy - maxR * Math.cos(sweepRad);

    // Glow sector trail
    const grad = rCtx.createRadialGradient(cx, cy, 10, cx, cy, maxR);
    grad.addColorStop(0, 'rgba(29, 233, 182, 0.4)');
    grad.addColorStop(1, 'rgba(29, 233, 182, 0.0)');

    rCtx.strokeStyle = '#1de9b6';
    rCtx.lineWidth = 2;
    rCtx.beginPath();
    rCtx.moveTo(cx, cy);
    rCtx.lineTo(bx, by);
    rCtx.stroke();

    radarSweepAngle = (radarSweepAngle + 1.2) % 360;
    requestAnimationFrame(drawRadarScope);
}
drawRadarScope();

function getDbzColor(dbz) {
    if (dbz >= 60) return '#8B008B';
    if (dbz >= 50) return '#DC143C';
    if (dbz >= 40) return '#FF0000';
    if (dbz >= 30) return '#FF8C00';
    if (dbz >= 20) return '#FFFF00';
    if (dbz >= 10) return '#00FF00';
    return '#00BFFF';
}

// ── Inundation Simulation & CartoDEM Cross-Section ──
const topoCanvas = document.getElementById('topo-canvas');
const tCtx = topoCanvas.getContext('2d');
let wavePhase = 0;

function drawTopoCrossSection() {
    const w = topoCanvas.width;
    const h = topoCanvas.height;
    const baseY = h * 0.88;

    tCtx.fillStyle = '#03080f';
    tCtx.fillRect(0, 0, w, h);

    // Grid lines
    tCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let y = 20; y < h; y += 30) {
        tCtx.beginPath();
        tCtx.moveTo(0, y); tCtx.lineTo(w, y);
        tCtx.stroke();
    }

    // Terrain Path
    tCtx.beginPath();
    tCtx.moveTo(0, baseY);
    tCtx.lineTo(w * 0.06, baseY - h * 0.55); // Ridge
    tCtx.lineTo(w * 0.14, baseY - h * 0.48);
    tCtx.lineTo(w * 0.22, baseY - h * 0.35);
    tCtx.lineTo(w * 0.30, baseY - h * 0.28); // Hill plateau
    tCtx.lineTo(w * 0.36, baseY - h * 0.12); // Underpass choke point
    tCtx.lineTo(w * 0.42, baseY - h * 0.08); // Lowest depression
    tCtx.lineTo(w * 0.48, baseY - h * 0.12);
    tCtx.lineTo(w * 0.56, baseY - h * 0.22); // Urban road
    tCtx.lineTo(w * 0.64, baseY - h * 0.20);
    tCtx.lineTo(w * 0.70, baseY - h * 0.05); // River channel bed
    tCtx.lineTo(w * 0.76, baseY - h * 0.14);
    tCtx.lineTo(w * 0.86, baseY - h * 0.16);
    tCtx.lineTo(w * 0.94, baseY - h * 0.06); // Outfall
    tCtx.lineTo(w, baseY);
    tCtx.lineTo(w, h);
    tCtx.lineTo(0, h);
    tCtx.closePath();

    const terrainGrad = tCtx.createLinearGradient(0, baseY - h * 0.6, 0, h);
    terrainGrad.addColorStop(0, '#2e7d32');
    terrainGrad.addColorStop(0.4, '#4e342e');
    terrainGrad.addColorStop(1, '#211714');
    tCtx.fillStyle = terrainGrad;
    tCtx.fill();

    tCtx.strokeStyle = 'rgba(29, 233, 182, 0.6)';
    tCtx.lineWidth = 1.5;
    tCtx.stroke();

    // Animated Flood Water Layer
    const floodFrac = Math.min(simulationRainfall / 220, 1.0);
    if (floodFrac > 0.05) {
        const waterY = baseY - (h * 0.45 * floodFrac);
        tCtx.beginPath();
        tCtx.moveTo(0, h);
        for (let x = 0; x <= w; x += 6) {
            const wy = waterY + Math.sin(x * 0.025 + wavePhase) * 3.5;
            if (x === 0) tCtx.moveTo(x, wy); else tCtx.lineTo(x, wy);
        }
        tCtx.lineTo(w, h);
        tCtx.closePath();

        const waterGrad = tCtx.createLinearGradient(0, waterY, 0, h);
        if (floodFrac > 0.65) {
            waterGrad.addColorStop(0, 'rgba(211, 47, 47, 0.7)');
            waterGrad.addColorStop(1, 'rgba(74, 20, 140, 0.8)');
        } else {
            waterGrad.addColorStop(0, 'rgba(21, 101, 192, 0.65)');
            waterGrad.addColorStop(1, 'rgba(13, 71, 161, 0.75)');
        }
        tCtx.fillStyle = waterGrad;
        tCtx.fill();
    }

    // Choke Point Markers
    tCtx.fillStyle = '#ff1744';
    tCtx.font = '10px Outfit';
    tCtx.fillText('⚠️ Underpass (Submerged)', w * 0.32, baseY - h * 0.16);
    tCtx.fillText('🌊 River Tidal Outfall', w * 0.66, baseY - h * 0.20);

    wavePhase += 0.04;
    requestAnimationFrame(drawTopoCrossSection);
}
drawTopoCrossSection();

// ── Slider Listener ──
const rainfallSlider = document.getElementById('rainfall-slider');
rainfallSlider.addEventListener('input', (e) => {
    simulationRainfall = parseFloat(e.target.value);
    document.getElementById('slider-display-val').textContent = `${simulationRainfall} mm/hr`;
    updateInundationStats();
});

// ── Return Period Selector ──
document.querySelectorAll('.rp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.rp-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeReturnPeriod = parseInt(btn.getAttribute('data-rp'));
        updateInundationStats();
    });
});

function updateInundationStats() {
    const scaleFactor = Math.log(activeReturnPeriod + 1) / Math.log(101);
    const depth = (simulationRainfall * 0.02 * (1 + scaleFactor)).toFixed(2);
    const area = (depth * 8.2).toFixed(1);
    const discharge = (simulationRainfall * area * 0.28).toFixed(0);

    document.getElementById('flood-depth').textContent = `${depth} m`;
    document.getElementById('flood-area').textContent = `${area} km²`;
    document.getElementById('flood-discharge').textContent = `${discharge} m³/s`;
    drawGisCanvas(parseFloat(depth), parseFloat(area));
}

// ── 2D GIS Inundation Map Canvas ──
const gisCanvas = document.getElementById('gis-canvas');
const gCtx = gisCanvas.getContext('2d');

function drawGisCanvas(depth, area) {
    const w = gisCanvas.width;
    const h = gisCanvas.height;
    gCtx.fillStyle = '#071220';
    gCtx.fillRect(0, 0, w, h);

    // Contours
    gCtx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
    for (let i = 1; i <= 4; i++) {
        gCtx.beginPath();
        gCtx.ellipse(w * 0.5, h * 0.45, w * 0.15 * i, h * 0.12 * i, 0, 0, Math.PI * 2);
        gCtx.stroke();
    }

    // River
    gCtx.strokeStyle = '#448aff';
    gCtx.lineWidth = 3;
    gCtx.beginPath();
    gCtx.moveTo(w * 0.1, h * 0.15);
    gCtx.bezierCurveTo(w * 0.3, h * 0.35, w * 0.5, h * 0.5, w * 0.85, h * 0.85);
    gCtx.stroke();

    // Flooded Polygon Extent
    const radius = Math.min(30 + area * 2.5, w * 0.35);
    gCtx.fillStyle = depth >= 1.5 ? 'rgba(211, 47, 47, 0.55)' : 'rgba(21, 101, 192, 0.5)';
    gCtx.strokeStyle = depth >= 1.5 ? '#ff1744' : '#00e5ff';
    gCtx.lineWidth = 1.5;
    gCtx.beginPath();
    gCtx.arc(w * 0.5, h * 0.48, radius, 0, Math.PI * 2);
    gCtx.fill();
    gCtx.stroke();

    // Infrastructure Markers
    gCtx.fillStyle = '#ffeb3b';
    gCtx.font = '10px JetBrains Mono';
    gCtx.fillText('🏥 Hospital', w * 0.28, h * 0.32);
    gCtx.fillText('🚇 Metro Sub-Level', w * 0.55, h * 0.62);
    gCtx.fillText('⚡ Power Substation', w * 0.42, h * 0.75);
}
updateInundationStats();

// ── Export GeoJSON ──
document.getElementById('btn-export-geojson').addEventListener('click', () => {
    const st = STATIONS[activeStationIndex];
    const geoJson = {
        type: "FeatureCollection",
        name: "MeghDrishti_GIS_Inundation_Export",
        crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::4326" } },
        features: [
            {
                type: "Feature",
                properties: {
                    station: st.name,
                    return_period_years: activeReturnPeriod,
                    simulation_rainfall_mmhr: simulationRainfall,
                    max_flood_depth_m: parseFloat(document.getElementById('flood-depth').textContent),
                    flooded_area_sqkm: parseFloat(document.getElementById('flood-area').textContent),
                    peak_discharge_m3s: parseFloat(document.getElementById('flood-discharge').textContent),
                    issuing_authority: "ISRO Space Applications Centre & IMD"
                },
                geometry: {
                    type: "Polygon",
                    coordinates: [[
                        [st.lon - 0.02, st.lat - 0.02],
                        [st.lon + 0.02, st.lat - 0.02],
                        [st.lon + 0.02, st.lat + 0.02],
                        [st.lon - 0.02, st.lat + 0.02],
                        [st.lon - 0.02, st.lat - 0.02]
                    ]]
                }
            }
        ]
    };

    const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MeghDrishti_${st.name.split(' ')[0]}_Inundation.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    alert('RFC 7946 GeoJSON downloaded! Directly importable into QGIS, ArcGIS, or ISRO Bhuvan.');
});

// ── NWP Ensemble Populate ──
const nwpContainer = document.getElementById('nwp-cards-container');
const NWP_MODELS = [
    { name: "IMD High-Res WRF", res: "3 km", precip: "164.2 mm", cape: "3,250 J/kg", pwat: "68.4 mm", risk: "88% (High)" },
    { name: "NCMRWF NCUM", res: "12 km", precip: "148.5 mm", cape: "2,840 J/kg", pwat: "64.1 mm", risk: "74% (Elevated)" },
    { name: "ECMWF HRES", res: "9 km", precip: "135.0 mm", cape: "2,910 J/kg", pwat: "61.8 mm", risk: "68% (Moderate)" },
    { name: "NOAA GFS", res: "25 km", precip: "118.4 mm", cape: "2,420 J/kg", pwat: "58.2 mm", risk: "55% (Moderate)" }
];

NWP_MODELS.forEach(m => {
    const card = document.createElement('div');
    card.className = 'nwp-card';
    card.innerHTML = `
        <div class="nwp-header">
            <span class="nwp-name">${m.name}</span>
            <span class="nwp-badge">${m.res}</span>
        </div>
        <div class="nwp-metrics">
            <div class="m-box">
                <span class="m-lbl">24H ACCUMULATED</span>
                <span class="m-val" style="color:#00e5ff">${m.precip}</span>
            </div>
            <div class="m-box">
                <span class="m-lbl">CONVECTIVE CAPE</span>
                <span class="m-val" style="color:#ff5252">${m.cape}</span>
            </div>
            <div class="m-box">
                <span class="m-lbl">PRECIPITABLE WATER</span>
                <span class="m-val" style="color:#1de9b6">${m.pwat}</span>
            </div>
            <div class="m-box">
                <span class="m-lbl">CLOUDBURST RISK</span>
                <span class="m-val" style="color:#ffab40">${m.risk}</span>
            </div>
        </div>
    `;
    nwpContainer.appendChild(card);
});

// ── Alert Dispatch & Audit Log ──
const auditTbody = document.getElementById('audit-log-body');
let auditLogs = [
    { level: "RED", time: "17:45 IST", loc: "Mumbai (Colaba)", stats: "145 mm/hr | 1.85m", msg: "Immediate evacuation ordered for Gandhi Market lowlands", status: "ACKNOWLEDGED" },
    { level: "ORANGE", time: "16:30 IST", loc: "Wayanad (Kalpetta)", stats: "92 mm/hr | 1.10m", msg: "Debris flow & flash flood warning across tea estate valleys", status: "DISPATCHED" }
];

function renderAuditLogs() {
    auditTbody.innerHTML = '';
    auditLogs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color:${log.level === 'RED' ? '#ff5252' : '#ffab40'}">${log.level}</strong></td>
            <td>${log.time}</td>
            <td>${log.loc}</td>
            <td>${log.stats}</td>
            <td>${log.msg}</td>
            <td><span class="res-status active">${log.status}</span></td>
        `;
        auditTbody.appendChild(tr);
    });
}
renderAuditLogs();

document.querySelectorAll('.dispatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const level = btn.getAttribute('data-level');
        const st = STATIONS[activeStationIndex];
        const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST';
        auditLogs.unshift({
            level: level,
            time: now,
            loc: st.name,
            stats: `${simulationRainfall} mm/hr | ${document.getElementById('flood-depth').textContent}`,
            msg: `OASIS CAP v1.2 broadcast triggered: IMD ${level} alert for ${st.name}`,
            status: "DISPATCHED"
        });
        renderAuditLogs();
        alert(`🚨 Tiered OASIS CAP v1.2 Alert (${level}) dispatched to NDMA Sachet & Municipal Sirens for ${st.name}!`);
    });
});

// ── AI Scientist Bulletin Generator ──
document.getElementById('btn-generate-ai').addEventListener('click', () => {
    const aiOutput = document.getElementById('ai-output');
    aiOutput.textContent = "Synthesizing real-time Doppler radar reflectivity, INSAT-3DS multi-spectral channels, and 10m CartoDEM flood vectors...";

    setTimeout(() => {
        const st = STATIONS[activeStationIndex];
        const now = new Date();
        const istStr = now.toISOString().replace(/T/, ' ').replace(/\..+/, '') + ' IST';
        aiOutput.textContent = `╔═══════════════════════════════════════════════════════════════════════════════╗
║   INDIA METEOROLOGICAL DEPARTMENT — SPECIAL SYNOPTIC BULLETIN                ║
║   ISRO Space Applications Centre (SAC), Satellite Meteorology Division        ║
╚═══════════════════════════════════════════════════════════════════════════════╝

BULLETIN NO: IMD/SAC/SWB/${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate()}-${now.getHours()}00-IST
ISSUING AUTHORITY: Chief Meteorological Scientist & Cyclone Warning Division
TARGET SECTOR: ${st.name.toUpperCase()} (Lat ${st.lat}°N, Lon ${st.lon}°E)

1. SYNOPTIC METEOROLOGICAL DIAGNOSIS:
Current surface observational telemetry registers precipitation at ${st.precip} mm/hr with
barometric core drop to ${st.press} hPa and south-westerly wind shear at ${st.wind}.
Intense boundary layer moisture convergence supported by 850 hPa Low-Level Jet.

2. DWR & INSAT-3DR REMOTE SENSING INTEGRATION:
- Doppler Radar PPI: Multiple embedded multi-cell convective clusters with maximum core
  reflectivity peaking above 58 dBZ. Echo tops measured at 13.8 km with steep VIL (Vertically
  Integrated Liquid) gradient indicating imminent localized downburst risk.
- INSAT-3DR TIR Brightness Temperature: Cloud top temperatures dropping below -68.4 °C.
  Satellite Quantitative Precipitation Estimation (Hydro-Estimator) indicates 92 mm/hr rain rate.

3. 10M CARTODEM HYDRODYNAMIC FLOOD ROUTING:
Hydraulic simulation for return period T=${activeReturnPeriod} Years indicates maximum surface water
depth reaching ${document.getElementById('flood-depth').textContent} over low-lying choke points.
Projected flooded surface footprint: ${document.getElementById('flood-area').textContent}.
Peak runoff discharge rate: ${document.getElementById('flood-discharge').textContent}.

4. DIRECTIVES FOR CIVIL DEFENSE & EMERGENCY FORCES:
- Common Alerting Protocol (CAP v1.2) alert dispatched across municipal and cell broadcast towers.
- NDRF Battalion commanders to position inflatable motorized search-and-rescue teams at low points.
- Municipal pump operators to maintain 100% capacity dewatering at railway underpasses.
- State Disaster Management Authority (SDMA) advised to activate designated relief shelters.

VALIDITY: Valid for next 12 hours from issue time.`;
    }, 800);
});
