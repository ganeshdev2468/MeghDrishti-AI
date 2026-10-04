# MeghDrishti AI
### Android and static web demonstration for weather and flood-risk scenarios

---

## Project Status
MeghDrishti contains a Kotlin/Jetpack Compose Android app and a static HTML/CSS/JavaScript dashboard. It is a local demonstration, not an operational ISRO/IMD system.

The web client fetches current and forecast weather from Open-Meteo and searches a predefined list of 20 Andhra Pradesh cities with Nellore as the default. A location-data version migration updates only saved locations in browser localStorage, preserving profiles, preferences, and other app data. The web dashboard marks radar, satellite, ground observations, NWP comparison, flood-risk modeling, historical baselines, and official warning data unavailable because those providers are not connected. Its optional demo weather mode is clearly labelled and uses simulated values without observation timestamps. No public alert broadcast or project-owned API backend is connected. There is no service on port 8081 and no `/api/health` endpoint.

The Android app fetches station weather from Open-Meteo and has Firebase and Gemini integrations, but the checked-in Firebase configuration is a placeholder. Other Android radar, satellite, NWP, and inundation data is simulated. Alerts are local drills only.

---

## Web Dashboard
The dashboard is a static client-side application served by `serve.ps1`. Its app routes use URL hashes; missing files return HTTP 404. The responsive dashboard supports light and dark themes; the selected theme is stored with local browser preferences.

The browser makes direct requests to Open-Meteo's public forecast API using the selected city's coordinates; it does not use the geocoding API. Open-Meteo's forecast endpoint does not require an API key. Leaflet, OpenStreetMap tiles, fonts, and profile images are loaded from external hosts. Unconnected weather products and warning feeds display unavailable states; rule-based AI weather insights are advisory and use available forecast variables. Browser sign-in and profiles are local-only and are not production authentication.

---

## 📱 Android Application Architecture (Kotlin & Jetpack Compose)

```
.
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
├── web/                           # Static dashboard; main entry is index.html
│   ├── index.html
│   ├── style.css
│   ├── app.js                     # Legacy, not loaded by index.html
│   └── js/                        # Active browser modules
│       ├── app.js
│       ├── auth.js
│       ├── router.js
│       ├── storage.js
│       ├── weatherService.js
│       └── providers/dataProviders.js
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── firestore.rules
└── serve.ps1                      # Portable PowerShell HTTP server (default port 8080)
```

---

## Run the Web Dashboard
Clone the repository, then run the static server from its root in Windows PowerShell:
```powershell
git clone https://github.com/ganeshdev2468/MeghDrishti-AI.git
cd MeghDrishti-AI
```

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```
Open <http://localhost:8080/>. The server defaults to port 8080 and serves `web/index.html`; pass `-Port <port>` to override it. No Node.js, npm, frontend build step, or backend is required.

## Build the Android App
Requirements: Android Studio, JDK 17, Android SDK 35, and a compatible Gradle installation (the project uses Android Gradle Plugin 8.10.1). This repository does not include the Gradle wrapper; from the repository root, use an installed Gradle:
```powershell
gradle :app:assembleDebug
gradle :app:installDebug
```
Alternatively, open this repository in Android Studio and run the `app` configuration with a connected emulator/device.

`app/google-services.json` contains placeholder values. Replace it with the configuration downloaded for your Firebase Android app before using Firebase Auth or Firestore. The Google Sign-In client ID is generated from that file. Firestore uses the default database and the collections `emergency_alerts`, `responder_profiles`, `deployment_logs`, and `inundation_scenarios`; deploy `firestore.rules` to your own Firebase project.

Gemini is optional. Set `GEMINI_API_KEY` in the environment or as a Gradle project property before building. For example:
```powershell
$env:GEMINI_API_KEY = "your-development-key"
gradle :app:assembleDebug
```
The key is compiled into the Android client and can be extracted from an APK. Use only a restricted development key; production use requires a protected service. Open-Meteo needs no API key.

## Ports and Services
- Web static server: `http://localhost:8080/` (default).
- Backend/API server: none in this repository. Port 8081 and `/api/health` are not used or implemented.
- Android Firebase and Gemini integrations are remote services, not local backend listeners.
