# MeghDrishti AI (मेघदृष्टि)
### ISRO-SAC & IMD Integrated Heavy Rainfall, Early Warning & Dynamic Inundation Prediction Platform

---

## 🛰️ Executive Overview
**MeghDrishti AI** is a mission-critical meteorological forecasting and automated disaster response platform engineered to ISRO (Space Applications Centre - SAC) and IMD (India Meteorological Department) operational standards.

The system integrates multi-source observational telemetry:
1. **Doppler Weather Radar (DWR)**: S-band and C-band PPI sweep reflectivity (dBZ) with TITAN/SCIT meso-convective storm cell tracking vectors.
2. **INSAT-3DR / INSAT-3DS Multi-Spectral Satellite Data**: Thermal Infrared (TIR1) cloud top brightness temperatures, water vapor flux, and Hydro-Estimator Quantitative Precipitation Estimation (QPE).
3. **Multi-Model Numerical Weather Prediction (NWP) Ensemble**: Real-time comparative matrices across IMD High-Resolution WRF (3 km), NCMRWF NCUM (12 km), ECMWF HRES (9 km), and NOAA GFS (25 km) with thermodynamic convective potential (CAPE, CIN, PWAT, and cloudburst probability).
4. **CartoDEM 10m Topographical Runoff & Hydrodynamic Inundation Modeling**: Animated elevation cross-section and dynamic 2D GIS flood extent mapping with multi-return period simulation ($T = 2, 5, 10, 25, 50, 100$ Years) and RFC 7946 GeoJSON export.
5. **Tiered Disaster Escalation Engine**: Automated OASIS Common Alerting Protocol (CAP v1.2) XML broadcast generation for NDMA Sachet, cell broadcast towers, and civil defense siren networks.
6. **ISRO/IMD Chief Meteorological Scientist AI**: Gemini-powered synoptic diagnosis and automated generation of formal WMO/IMD Special Weather Bulletins and Flash Flood Directives.

---

## 🌐 Live Web Application & Dashboard
A live, responsive web mission-control dashboard is running locally at:
👉 **`http://localhost:8080/`**

### Features on the Web Dashboard:
- **Interactive PPI Doppler Radar Scope**: Continuous animated beam sweep with IMD standard dBZ reflectivity color scale (5–65+ dBZ) and TITAN storm cell velocity vectors.
- **Precipitation Stress-Test Slider**: Interactive slider (10 to 250 mm/hr) dynamically modeling urban runoff, hydraulic head, underpass choke points, and flood water rise.
- **Return Period Selector**: Instantly computes flood depth ($m$), flooded area ($\text{km}^2$), and peak runoff discharge ($Q = CIA\ \text{m}^3/\text{s}$).
- **RFC 7946 GeoJSON Exporter**: One-click download of GIS flood polygons for direct import into QGIS, ArcGIS, or ISRO Bhuvan GIS.
- **CAP Alert Dispatcher & Logistics Tracker**: Live monitoring of deployed NDRF battalions, rescue boats, dewatering pumps, and relief shelters.
- **AI Scientist Terminal**: One-tap synthesis of real-time observations into formal meteorological bulletins.

---

## 📱 Android Application Architecture (Kotlin & Jetpack Compose)

```
c:\yugha\
├── app/
│   ├── build.gradle.kts           # Compose, Room, Retrofit, Firebase, Gemini AI
│   ├── google-services.json       # Firebase configuration
│   ├── proguard-rules.pro         # Proguard keep rules
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── java/com/meghdrishti/ai/
│       │   │   ├── MainActivity.kt                # Scaffold, BottomBar with badges, Navigation
│       │   │   ├── MeghDrishtiApplication.kt      # Notification channels & Firebase init
│       │   │   ├── data/
│       │   │   │   ├── local/
│       │   │   │   │   ├── AlertDao.kt            # Room DAO for audit logging
│       │   │   │   │   ├── AlertEntity.kt        # Local alert entity
│       │   │   │   │   └── MeghDrishtiDatabase.kt # Room database singleton
│       │   │   │   ├── model/
│       │   │   │   │   ├── FirestoreModels.kt     # Cloud synced alerts & responders
│       │   │   │   │   └── MeteorologicalModels.kt # Station, Radar, Satellite, NWP models
│       │   │   │   ├── remote/
│       │   │   │   │   ├── GeminiScientificService.kt # Chief scientist AI terminal
│       │   │   │   │   └── OpenMeteoService.kt    # Live station weather API
│       │   │   │   └── repository/
│       │   │   │       ├── FirestoreEmergencyRepository.kt # Cloud persistence
│       │   │   │       └── WeatherForecastRepository.kt    # Observational aggregation
│       │   │   ├── ui/
│       │   │   │   ├── components/
│       │   │   │   │   ├── EmergencyAlertBanner.kt         # Pulsing CAP alert card
│       │   │   │   │   ├── GisInundationMapCanvas.kt       # 2D GIS contour map
│       │   │   │   │   ├── RadarScanCanvas.kt              # Rotating PPI radar scope
│       │   │   │   │   └── TopographicalInundationCanvas.kt # CartoDEM cross-section
│       │   │   │   ├── screens/
│       │   │   │   │   ├── AiScientistScreen.kt           # WMO bulletin generator
│       │   │   │   │   ├── AuthScreen.kt                  # Credential Manager / Google Auth
│       │   │   │   │   ├── EmergencyResponseScreen.kt     # Tiered CAP dispatcher & logs
│       │   │   │   │   ├── InundationScreen.kt            # Hydrodynamic stress-testing
│       │   │   │   │   ├── NwpModelScreen.kt              # WRF/NCUM/ECMWF comparison
│       │   │   │   │   └── RadarSatelliteScreen.kt        # DWR sweep & INSAT telemetry
│       │   │   │   ├── theme/
│       │   │   │   │   ├── Color.kt                       # IMD alert & dBZ color scale
│       │   │   │   │   └── Theme.kt                       # Mission control dark theme
│       │   │   │   └── viewmodel/
│       │   │   │       └── MeghDrishtiViewModel.kt        # StateFlow & business logic
│       │   │   └── util/
│       │   │       ├── AuthHelper.kt                  # Google Sign-In helper
│       │   │       ├── EmergencyNotificationHelper.kt  # Android heads-up siren alerts
│       │   │       └── GisExportHelper.kt             # RFC 7946 GeoJSON generator
│       │   └── res/                                   # Drawables, strings, colors, styles
│       └── test/
│           └── java/com/meghdrishti/ai/
│               └── MeteorologicalSystemTest.kt        # Unit tests
├── gradle/
│   └── libs.versions.toml         # Version catalog
├── web/                           # Standalone live web dashboard
│   ├── index.html
│   ├── style.css
│   └── app.js
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── firestore.rules
└── serve.ps1                      # Built-in PowerShell HTTP server
```

---

## ⚡ How to Run
### 1. Web Application:
The dashboard is currently active at **`http://localhost:8080/`**.
To restart the server at any time:
```powershell
powershell -ExecutionPolicy Bypass -File c:\yugha\serve.ps1 -Port 8080
```

### 2. Android Studio Build:
Open `c:\yugha` in Android Studio (Ladybug or Hedgehog or newer).
Gradle will sync automatically using the included `libs.versions.toml` version catalog.
To run on an emulator or physical device:
```bash
./gradlew assembleDebug
```
