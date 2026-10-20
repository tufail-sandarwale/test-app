# Mock GPS Tester

Android GPS testing application using React Native, TypeScript, native Kotlin, and supported Android mock-location APIs. Core simulation runs locally, independently of the optional FastAPI backend.

**Implementation and automated builds are available. Device execution was explicitly deferred by the user because no phone/emulator is connected. This is a development build, not a device-verified or production-certified release.**

## Implemented

- MapLibre map selection, draggable selected point, target circle, route preview, captured-real and simulated markers, retry and manual coordinate entry.
- Foreground Kotlin simulation service, start/pause/resume/stop, persistent notification controls, status events, precise-location/mock-app prerequisites, and provider cleanup/recovery.
- WGS84 route interpolation using GeographicLib, continuous return legs for loops, speed, duration, interval, progress, destination waypoint, and remaining distance.
- Default 100 m radius testing with strict `distance < radius`, optionally inclusive; Turf distance calculations and map circles.
- Validated local location CRUD, route CRUD, settings and selections persisted in AsyncStorage through Zustand. Invalid restored data is rejected with an error.
- Home, Map, Location Details, Saved Locations, Routes, Settings, and optional Cloud Presets screens with light/dark themes.
- FastAPI, SQLAlchemy, PostgreSQL-compatible Alembic migrations, Argon2 passwords, expiring JWTs, ownership-scoped location/route CRUD, rate limits, and request validation.
- Optional Axios cloud login/register, upload/download copies, paginated listing, and cloud deletion. Tokens stay in memory; cloud outages do not stop native simulation.

### Observed verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, no warnings |
| `npm test -- --runInBand` | Pass, 26 tests: navigation, geometry, persistence, native contract, status races, cloud |
| Gradle wrapper `--version` | Pass, Gradle 9.4.1 downloaded using Windows certificate trust |
| React Native Gradle plugins | Compiled using the approved Maven mirror |
| SDK tools, Platform 37.0, Build Tools 37.0.0, CMake 3.22.1 | Installed and verified |
| NDK 27.1.12297006 | Official archive checksum verified; compiler runs |
| `adb version` / `adb devices` | Platform-Tools 37.0.1 runs; no device connected |
| Android `:app:assembleDebug` | Pass; full native map, storage, service, and bridge |
| Kotlin `:app:testDebugUnitTest` | Pass, 5 tests: lifecycle, invalid inputs, date line, completion, continuous loops |
| `:app:assembleDebugAndroidTest` | Pass; device lifecycle test APK compiles; execution pending |
| Backend pytest | Pass, 7 tests: auth, ownership, CRUD, rate limits, validation, migrations |
| Metro production Android bundle | Pass; bundle and 22 asset files generated |
| Local development servers | Metro port 8081; API port 8000, health and OpenAPI checked |
| PostgreSQL | Migration SQL generated; no local server/Docker available for a live test |
| Debug APK signature | Pass; verified with Android apksigner |
| Run on emulator/device | No emulator installed or authorized device connected |
| Editor Python environment | Select `.venv/Scripts/python.exe`; system interpreter lacks backend packages |

## Supported mock locations only

Android's supported mock-location configuration is required. Enable Developer Options and select **Mock GPS Tester** under **Select mock location app**. Enable device Location and grant precise location permission. Allow notifications so foreground controls are visible.

The native implementation reports missing configuration with:

> Mock location is not enabled for this application. Select this application as the mock location app in Android Developer Options.

No Developer Options, root, Play Integrity, mock-location detection, anti-cheat, or third-party security bypasses are permitted. No hidden injection or modification of other apps. Test only devices and applications you are authorized to test.

## Prerequisites

Install Android Studio, Android SDK Manager, and an emulator or connect an authorized Android test device with USB debugging. Follow the [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment).

| Component | Selected version |
| --- | --- |
| React Native / React | 0.87.1 / 19.2.3 |
| Node | ^22.13.0, ^24.3.0, or >=26.0.0; tested with 24.20.0 |
| React Navigation native / native-stack | 7.3.18 / 7.18.10, stable rather than 8.x alpha |
| react-native-screens | 4.27.0 |
| Kotlin / Gradle wrapper | 2.2.0 / 9.4.1 |
| Android compile / target / minimum SDK | 37 / 36 / 24 |
| Build Tools / NDK | 37.0.0 / 27.1.12297006 |

Use JDK 17 as recommended by React Native, set `JAVA_HOME`, and select the same Gradle JDK in Android Studio. On the observed Java 26 installation, Gradle 9.4.1 successfully completed the debug APK build, including Kotlin and C++ compilation. `JAVA_HOME` was not changed; the verified build used Java from PATH.

Install the SDK platform, Build Tools, and NDK versions above, plus Platform-Tools, Command-line Tools, Android Emulator, and a system image. Accept SDK licenses yourself. Set `ANDROID_HOME` to the actual SDK location, usually `%LOCALAPPDATA%\Android\Sdk`, and add `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator` to `PATH`. Android Studio can alternatively generate `mobile/android/local.properties` with the actual SDK path; do not commit machine-specific paths.

### User-local SDK configuration

The Windows command-line tools (version 22.0) are installed at `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest`. Their official download was checked against Google's published SHA-256 before extraction. No administrator privileges or Android Studio installer were required.

`ANDROID_HOME` is configured at user scope. The existing user PATH was preserved with `platform-tools` and `cmdline-tools\latest\bin` appended. Fully restart VS Code after installation so new integrated terminals inherit those settings. The project also has an ignored `mobile/android/local.properties` pointing to this SDK; do not commit that machine-specific file.

Google's current API 37 package ID is **`platforms;android-37.0`**, not `platforms;android-37`. The project's integer `compileSdkVersion = 37` is unchanged. The required package installation command is:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" `
	"--sdk_root=$env:LOCALAPPDATA\Android\Sdk" --install `
	'platform-tools' 'platforms;android-37.0' 'build-tools;37.0.0' `
	'ndk;27.1.12297006' 'cmake;3.22.1'
```

If Java reports certificate errors, temporarily set `JAVA_OPTS` to use the existing Windows trusted roots as shown in the Gradle troubleshooting section, then restore it after installation. Never use `--no_https` or disable certificate validation. Review each license prompt yourself; the current SDK license prompt was accepted only after explicit user authorization. `sdkmanager` 22.0 warns that it is deprecated in favor of `android sdk`, but the command above remains supported by the installed tools.

This configures build tools only. An emulator/system image or connected authorized phone is still needed to run the app; no emulator is installed by this command.

NDK 27.1.12297006 is now installed and verified. The SDK Manager download stalled, so the official `android-ndk-r27b-windows.zip` was downloaded directly from Google and its size and published repository checksum checked before extraction. The subsequent full Android build validated the installed toolchain.

## Installation and running

From the workspace root in PowerShell:

```powershell
cd mobile
npm ci
npm run typecheck
npm test -- --runInBand
npm run lint
npm start
```

In a second terminal with an emulator or authorized device running:

```powershell
cd mobile
adb devices
npm run android
```

Metro serves JavaScript to the native application, not a browser app. Android Studio can open `mobile/android`. The generated iOS template is unverified and outside this Android-only scope.

### Run the existing debug APK

The normal `npm run android` command does not automatically apply the optional corporate Maven mirror. On this machine, use the approved-mirror build command below when rebuilding, or install the already-built APK without rerunning Gradle.

Connect an authorized USB-debugging phone or start an emulator. From the workspace root, start Metro in one terminal:

```powershell
npm --prefix mobile start
```

In a second terminal at the workspace root, with exactly one device connected:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r .\mobile\android\app\build\outputs\apk\debug\app-debug.apk
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
```

Open **Mock GPS Tester** on the device. Approve USB debugging on the phone if prompted. If multiple devices are attached, select the intended device with `adb -s SERIAL` for each command. The APK is debug-signed and requires Metro. Installation and launch have not yet been verified because no device was connected.

### Standalone test APK (no Expo or Metro)

Build `:app:assembleStandalone` using the same Gradle command and approved-mirror flags documented below. This variant bundles JavaScript, Hermes and assets, uses release dependencies with developer support disabled, and is signed with the development key. Production release signing is unchanged. This is for private testing only, not store distribution.

Verified on 2026-09-19: standalone build passes, APK v2 signature verifies, bundled JavaScript and Hermes are present for arm64-v8a, armeabi-v7a, x86 and x86_64. Version `1.0-test`, minimum SDK 24, size approximately 114 MB. The custom variant explicitly disables cleartext traffic.

Output: `mobile/android/app/build/outputs/apk/standalone/app-standalone.apk`. Transfer this APK to an Android 7.0+ phone, open it in the phone's file manager, and allow installation from that source if Android asks. Open **Mock GPS Tester** directly; no Expo, Metro, USB debugging or backend is required. Fresh map tiles still need internet. Optional cloud access requires an HTTPS server in this variant.

The standalone variant uses the same app ID and development signing key as the debug build, so it can replace that build while retaining saved presets. Device execution remains unverified until installed on a phone/emulator. Android mock-app selection and precise-location permission are still required for simulation.

### Test a location or route

1. Select this app as the mock app in Developer Options and enable device Location.
2. Capture Real Location before starting simulation. This is a timestamped snapshot, not a concurrent live real-GPS feed. Mock or stale readings are rejected; capture times out after 15 seconds.
3. Select Location on the map, drag the selected marker, or use Enter Location Details for manual coordinates. Save a named preset as needed.
4. Set Target to draw the radius. Settings defaults to 100 m and exclusive boundary; the Home screen compares the last simulated reading to this target.
5. Start Simulation. Home and the Android notification provide pause/resume/stop. Pausing removes test providers and releases the wake lock; elapsed route time is frozen. Stopping removes the foreground notification and providers.
6. For routes, add at least two distinct waypoints on the map, save from Routes, set speed in Settings, and Start Route. Loop mode includes travel back to the first point rather than teleporting.

Map markers: S selected, T target, R captured real, M last simulated. The native route uses WGS84 ellipsoidal geometry; Turf radius/distance uses a spherical geodesic approximation, so small differences can occur. Radius is an in-app comparison, not Android GeofencingClient registration. It does not infer another app's geofence result.

Settings apply to the next simulation, not an already running one. Interval is 200-10000 ms; duration is 0-86400 seconds. Zero duration uses a 24-hour safety cap. Routes require positive speed and 2-500 points. Speeds in Settings/routes are km/h; the location editor/native location API uses m/s. Bearing follows the route tangent during route playback. The service uses monotonic time and bounded scheduled updates; OEM battery restrictions may still stop it. There is no boot auto-start or hidden restart.

Coordinate entry, persisted presets, routes and simulation work without network. Fresh map tiles need connectivity. MapLibre 11.2.0 uses OpenFreeMap over HTTPS with attribution; no map key is required. `npm ci` applies the committed one-line React Native 0.87 compatibility patch via `patch-package`. Review tile-provider terms and availability for deployment.

## Environment configuration

The mobile Cloud Presets screen accepts an optional server URL; the core app needs no backend configuration or map key. HTTPS is required except localhost, 127.0.0.1 and Android emulator 10.0.2.2 in debug builds. Tokens and passwords are not persisted. No API_BASE_URL or MAP_API_KEY build variable is consumed.

Workspace access rules prevented creating `.env.example`. Backend environment variable names and commands are documented below instead. Never commit real credentials, database files, environment files, or signing keys.

## Building APKs

After resolving the prerequisites:

```powershell
cd mobile/android
.\gradlew.bat :app:assembleDebug
```

Built artifact: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Debug installs need Metro. **The debug build succeeded and its APK signature verified on 2026-09-18.** The successful build used the Windows certificate trust and approved-mirror options documented below. It included arm64-v8a, armeabi-v7a, x86, and x86_64.

Release signing no longer falls back to the public debug key. Supply `MOCK_GPS_KEYSTORE` (absolute private keystore path), `MOCK_GPS_STORE_PASSWORD`, `MOCK_GPS_KEY_ALIAS`, and `MOCK_GPS_KEY_PASSWORD` through your local terminal or CI secrets, never chat or source control. Then run `./gradlew.bat :app:assembleRelease` in `mobile/android`; output is under `app/build/outputs/apk/release`. Release bundles JavaScript and does not need Metro. No private release key was created and no signed production release has been verified. Device tests, dependency remediation, and performance checks remain required before distribution.

## Blockers and troubleshooting

1. The Gradle download's `SSLHandshakeException` / `PKIX path building failed` was resolved using Java's `Windows-ROOT` trust-store provider. Windows already trusts the required certificate chain. Maven Central then returned HTTP 403 from Zscaler; using the existing approved Nexus mirror from the local Maven settings resolved the tested plugin dependencies. See the opt-in command below. No TLS checks were disabled and no certificates or global settings were modified.
2. The SDK path is now configured at user scope and in the project's ignored local properties. Platform 37.0, Build Tools 37.0.0, CMake 3.22.1, Platform-Tools 37.0.1, and NDK 27.1.12297006 are installed and the debug APK builds successfully. Android Studio/emulator remain uninstalled and no device is connected, so runtime validation is still blocked.
3. The final `npm audit --omit=dev` reports 28 advisories: 1 low, 5 moderate, 22 high, 0 critical. These include React Native, CLI/Metro chains and MapLibre. The earlier full development audit reported 49. Run `npm audit` and `npm audit --omit=dev` for current details. Do not blindly use `npm audit fix --force`; compatible remediation and retesting are release requirements. Metro also emits a dependency private-featureflags export warning while successfully bundling.
4. Select the workspace TypeScript version for editor diagnostics. For backend imports, select `.venv/Scripts/python.exe` using Python: Select Interpreter; the tests use this environment explicitly. The generated TypeScript configuration is inaccessible to Copilot under workspace rules; no compiler workaround was applied.

For device discovery, check `adb devices`, USB authorization, and emulator startup. Android compilation is verified; device execution, screenshots, rotation/process restoration, and accessibility on real hardware remain unverified. The successful build emits dependency/template deprecation warnings, including APIs scheduled for removal in Gradle/AGP 10; do not upgrade that toolchain without compatibility testing.

### Windows certificate trust and approved Maven mirror

The optional `mobile/android/gradle/approved-mirror.init.gradle` redirects Maven Central repositories to an explicitly provided approved HTTPS mirror and makes it available for plugin dependencies. Google Maven and the Gradle Plugin Portal remain available for their specialized artifacts. Normal builds are unchanged unless you supply `-I`. The URL must not contain credentials, query parameters, or fragments.

The tested mirror was already configured in this machine's `%USERPROFILE%\.m2\settings.xml`. Gradle does not automatically use Maven's mirror configuration. Use that approved URL, or ask your administrator for one; do not substitute arbitrary mirrors or bypass corporate network policy.

From the workspace root, replace the placeholder below with your approved mirror URL:

```powershell
$approvedMirror = 'https://YOUR-APPROVED-MIRROR/repository/maven-public/'
$originalJavaOpts = $env:JAVA_OPTS
try {
	$env:JAVA_OPTS = "$originalJavaOpts -Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE"
	.\mobile\android\gradlew.bat -p .\mobile\android `
		-I "$PWD\mobile\android\gradle\approved-mirror.init.gradle" `
		'-Djavax.net.ssl.trustStoreType=Windows-ROOT' `
		'-Djavax.net.ssl.trustStore=NONE' `
		"-Dmockgpstester.mavenMirror=$approvedMirror" `
		:app:assembleDebug --no-daemon --console=plain
} finally {
	$env:JAVA_OPTS = $originalJavaOpts
}
```

`JAVA_OPTS` covers a fresh wrapper download; explicit `-D` options cover Gradle's build process. `NONE` selects a non-file trust store, not disabled verification. Java still validates certificate chains against existing Windows trusted roots. No global Java configuration is changed. On a machine where Windows does not trust the required CA, obtain approved administrator assistance instead of disabling verification. This Windows-specific command must not be copied unchanged to other operating systems.

The SDK directory and required tools are now installed. The command above completed `:app:assembleDebug` successfully in 17m 48s on the first full build (113 tasks). The debug APK exists and its signature verifies. Device installation and execution remain unverified.

## Architecture and phases

Core path: `React Native UI -> typed Kotlin module -> MockLocationService -> LocationManager test providers`. The native bridge uses RN's legacy-module interop in the new-architecture template. The native service is the authority for simulation status. Only selections/settings/presets persist in JS, never an assumption that simulation is still running.

- `mobile/src/screens`, `components`, `navigation`: presentation and typed navigation.
- `mobile/src/services`, `store`, `utils`, `types`: permissions/bridge, local and cloud state, validation, geometry, models.
- `mobile/android/app/src/main/java/com/mockgpstester/mocklocation`: bridge, foreground service, status, WGS84 engine.
- `backend/app`: configuration, models, schemas, repository, API, and application factory.
- `backend/migrations`: explicit schema history; no automatic production table creation.

Phases 1-8 are implemented with automated checks and Android builds. Phase 9 has backend/client tests and PostgreSQL-compatible migrations; a live PostgreSQL run is pending. Phase 10 includes automated tests and a compiled device integration test; real-device behavior, performance, dependency security remediation, and release signing remain unverified. Device gates were deferred only with explicit user authorization.

## Optional backend

Requires Python 3.13 (tested), PostgreSQL, and a database/user you control. Production uses a least-privilege database account and HTTPS. SQLite is supported for local development/tests only.

From the workspace root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --no-user -r backend/requirements.txt
$env:MOCK_GPS_DATABASE_URL = 'postgresql+psycopg://USER:PASSWORD@localhost:5432/mock_gps'
$secretBytes = New-Object byte[] 32
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($secretBytes)
$random.Dispose()
$env:MOCK_GPS_JWT_SECRET = [Convert]::ToBase64String($secretBytes)
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

The command generates a secret without printing it. It lasts only for that shell session; changing it invalidates prior tokens. For deployment, supply a stable cryptographically random secret through a secrets manager; do not reuse test keys. Environment variables can also come from a private `.env` in the process working directory. Pydantic settings use the `MOCK_GPS_` prefix; database URL and JWT secret are required. `MOCK_GPS_TOKEN_MINUTES` defaults to 30. `MOCK_GPS_RATE_LIMIT_STORAGE_URI` defaults to `memory://` for one process; use a supported shared limits backend plus its driver for multi-worker production rate limiting.

For local development without PostgreSQL, set `MOCK_GPS_DATABASE_URL=sqlite:///./backend/local.db` before migrations. API docs: `http://127.0.0.1:8000/docs`; health: `/health`. The health endpoint is liveness, not database readiness. For USB-connected debug phones run `adb reverse tcp:8000 tcp:8000`, then enter `http://127.0.0.1:8000` in Cloud Presets. The Android emulator uses `http://10.0.2.2:8000`. Do not send production credentials over HTTP.

### API

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`: JSON `{ "email": "...", "password": "..." }`; passwords 12-128 characters; Bearer JWT response.
- `GET/POST /api/v1/locations`, `GET/PUT/DELETE /api/v1/locations/{id}`.
- `GET/POST /api/v1/routes`, `GET/PUT/DELETE /api/v1/routes/{id}`.
- Collections accept `offset` and `limit` (1-100). Each token can access only its owner's records; inaccessible IDs return 404.
- Location fields: name, latitude, longitude, accuracy, altitude, bearing, speed (m/s).
- Route fields: name, points (2-500 latitude/longitude pairs), speedKmh. IDs and creation/update timestamps are server-managed.
- Registration/login limits are 5/10 per minute per remote address. Other routes use a default 120/minute per address. Configure trusted reverse proxies, shared limiter storage, ingress body-size limits and TLS before deployment. Do not trust arbitrary forwarded IP headers.

Cloud upload/download creates new copies and may create duplicates when repeated. It is not automatic bidirectional sync, and there is no merge/conflict resolution or refresh token. Sign in again after expiration/restart. Local edits do not change existing cloud records; the API supports PUT for explicit updates. No profile/password-reset feature is claimed. Presets are stored in app-private AsyncStorage, not encrypted storage; cloud databases/backups need deployment encryption and access controls.

### Tests

```powershell
npm --prefix mobile run typecheck
npm --prefix mobile run lint
npm --prefix mobile test -- --runInBand
.\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini backend/tests -q
.\mobile\android\gradlew.bat -p mobile/android :app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest
```

Use the approved-mirror flags above on this network. Backend tests isolate SQLite databases, exercise authentication/ownership and migrate up/down; PostgreSQL SQL generation is checked but does not substitute for a live PostgreSQL test.

The compiled `MockLocationServiceTest` is opt-in: manually select this app as the mock app, grant precise location, enable Location, and stop current simulation first. With a device connected, run `:app:connectedDebugAndroidTest` using the same build flags. It tests actual GPS mock readings and start/pause/resume/stop, and skips when prerequisites are absent; a skipped test is not a pass. It never changes Developer Options or AppOps for you.

## Device and release checklist

- Verify map tap/drag, offline manual entry, overlays, rotation, font scaling and both themes on small/large devices.
- Verify permission denied/approximate-only, services off, wrong mock app, notification denied, and recovery after permission revocation.
- Observe mock readings in your authorized test app, status events, pause freezing route time, foreground notification actions, and restoration of non-mock readings after stop/completion.
- Verify background/screen-off behavior, unexpected process death, reopening/recovery, and OEM battery restrictions. Last readings can remain cached by clients; clients must check timestamps/mock flags.
- Check boundary distances just below/at/above 100 m, varied route speeds, zero-length segments, loop return legs, duration completion, persistence and storage failure handling.
- Profile CPU, memory, battery and UI responsiveness at 200 ms and 1000 ms intervals, long routes and background operation. No performance measurements are claimed yet.
- Run live PostgreSQL migrations/API tests, review dependency audits, configure production TLS/rate limiting/backups, and sign using your private upload key before distribution.