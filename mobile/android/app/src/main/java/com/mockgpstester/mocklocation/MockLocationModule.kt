package com.mockgpstester.mocklocation

import android.Manifest
import android.app.AppOpsManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.os.Bundle
import android.os.SystemClock
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.common.LifecycleState
import com.mockgpstester.CrashRecorder
import org.json.JSONObject

class MockLocationModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val handler = Handler(Looper.getMainLooper())
    private val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val captures = mutableMapOf<LocationListener, Runnable>()
    private val observer: () -> Unit = {
        if (context.hasActiveReactInstance()) {
            context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("MockLocationStatus", SimulationState.snapshot())
        }
    }

    override fun initialize() {
        super.initialize()
        SimulationState.observers.add(observer)
    }

    @ReactMethod fun addListener(event: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    @ReactMethod fun getStatus(promise: Promise) {
        handler.post {
            SimulationState.recover(context)
            promise.resolve(SimulationState.snapshot())
        }
    }

    @ReactMethod fun start(options: ReadableMap, promise: Promise) = begin(options, promise)
    @ReactMethod fun startRoute(options: ReadableMap, promise: Promise) = begin(options, promise)

    private fun begin(options: ReadableMap, promise: Promise) {
        handler.post {
            try {
                check(context.lifecycleState == LifecycleState.RESUMED) { "Start simulation while the application is visible." }
                check(SimulationState.state !in listOf("starting", "running", "paused")) { "Simulation is already running. Stop it before starting another." }
                check(captures.isEmpty()) { "Wait for real location capture to finish before starting simulation." }
                MockLocationService.verifyRequirements(context)
                val json = JSONObject(options.toHashMap())
                val configuration = MockLocationService.parseConfig(json)
                LocationSimulator(configuration)
                val intent = Intent(context, MockLocationService::class.java).setAction(MockLocationService.START).putExtra("config", json.toString())
                SimulationState.publish(context, "starting", null, configuration)
                try {
                    if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
                } catch (error: Exception) {
                    SimulationState.publish(context, "error", message = error.message ?: "Could not start foreground service.")
                    throw error
                }
                promise.resolve(SimulationState.snapshot())
            } catch (error: Exception) { promise.reject("START_FAILED", error.message, error) }
        }
    }

    @ReactMethod fun pause(promise: Promise) = command(MockLocationService.PAUSE, listOf("running"), promise)
    @ReactMethod fun resume(promise: Promise) = command(MockLocationService.RESUME, listOf("paused"), promise)
    @ReactMethod fun stop(promise: Promise) = command(MockLocationService.STOP, listOf("starting", "running", "paused"), promise)

    @ReactMethod fun steer(bearing: Double, speedMetersPerSecond: Double, promise: Promise) {
        handler.post {
            try {
                require(bearing.isFinite() && bearing >= 0 && bearing < 360) { "Bearing must be 0 to less than 360." }
                require(speedMetersPerSecond.isFinite() && speedMetersPerSecond in 0.0..LocationSimulator.MAX_SPEED) { "Speed must be 0 to 300 m/s." }
                requireSingleLocation()
                context.startService(Intent(context, MockLocationService::class.java).setAction(MockLocationService.STEER)
                    .putExtra("bearing", bearing).putExtra("speed", speedMetersPerSecond))
                promise.resolve(SimulationState.snapshot())
            } catch (error: Exception) { promise.reject("STEER_FAILED", error.message, error) }
        }
    }

    @ReactMethod fun moveTo(latitude: Double, longitude: Double, promise: Promise) {
        handler.post {
            try {
                Coordinate(latitude, longitude)
                requireSingleLocation()
                context.startService(Intent(context, MockLocationService::class.java).setAction(MockLocationService.MOVE)
                    .putExtra("latitude", latitude).putExtra("longitude", longitude))
                promise.resolve(SimulationState.snapshot())
            } catch (error: Exception) { promise.reject("MOVE_FAILED", error.message, error) }
        }
    }

    private fun requireSingleLocation() {
        check(SimulationState.state in listOf("running", "paused")) { "Start a location simulation first." }
        check(SimulationState.config?.points?.size == 1) { "Joystick and move are only available for single-location simulations, not routes." }
    }

    @ReactMethod fun getLastCrashReport(promise: Promise) {
        try { promise.resolve(CrashRecorder.read(context)) }
        catch (error: Exception) { promise.reject("CRASH_REPORT", error.message, error) }
    }

    @ReactMethod fun clearLastCrashReport(promise: Promise) {
        try { CrashRecorder.clear(context); promise.resolve(null) }
        catch (error: Exception) { promise.reject("CRASH_REPORT", error.message, error) }
    }

    private fun command(action: String, allowed: List<String>, promise: Promise) {
        handler.post {
            try {
                if (action == MockLocationService.STOP && SimulationState.state !in allowed) {
                    promise.resolve(SimulationState.snapshot())
                    return@post
                }
                check(SimulationState.state in allowed) { "Command is unavailable while simulation is ${SimulationState.state}." }
                context.startService(Intent(context, MockLocationService::class.java).setAction(action))
                promise.resolve(SimulationState.snapshot())
            } catch (error: Exception) { promise.reject("COMMAND_FAILED", error.message, error) }
        }
    }

    override fun getName() = "MockLocation"

    @ReactMethod
    fun getPrerequisites(promise: Promise) {
        try {
            val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val result = Arguments.createMap()
            result.putBoolean("permissionGranted", context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED)
            result.putBoolean("locationEnabled", if (Build.VERSION.SDK_INT >= 28) manager.isLocationEnabled else manager.isProviderEnabled(LocationManager.GPS_PROVIDER))
            result.putBoolean("mockAppSelected", appOps.checkOpNoThrow(AppOpsManager.OPSTR_MOCK_LOCATION, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED)
            result.putBoolean("developerOptionsEnabled", Settings.Global.getInt(context.contentResolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1)
            result.putBoolean("notificationsEnabled", (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).areNotificationsEnabled())
            promise.resolve(result)
        } catch (error: Exception) { promise.reject("PREREQUISITES", error.message, error) }
    }

    // Apps cannot toggle Developer Options; only open the screen where the user can.
    @ReactMethod
    fun openSystemSettings(screen: String, promise: Promise) {
        val intent = when (screen) {
            "about" -> Intent(Settings.ACTION_DEVICE_INFO_SETTINGS)
            "developer" -> Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS)
            "location" -> Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
            "app" -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
            else -> {
                promise.reject("SETTINGS", "Unsupported settings screen.")
                return
            }
        }
        try {
            val target = if (intent.resolveActivity(context.packageManager) != null) intent else Intent(Settings.ACTION_SETTINGS)
            context.startActivity(target.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            promise.resolve(target === intent)
        } catch (error: Exception) { promise.reject("SETTINGS", "Open Android Settings manually.", error) }
    }

    @ReactMethod
    fun captureRealLocation(promise: Promise) {
        handler.post {
            SimulationState.recover(context)
            if (SimulationState.state in listOf("starting", "running", "paused")) {
                promise.reject("SIMULATION_ACTIVE", "Stop simulation before capturing a real location.")
                return@post
            }
            if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION", "Precise location permission is required.")
                return@post
            }
            var completed = false
            lateinit var listener: LocationListener
            fun finish(location: Location?, message: String? = null) {
                if (completed) return
                completed = true
                captures.remove(listener)?.let { handler.removeCallbacks(it) }
                manager.removeUpdates(listener)
                if (location != null) promise.resolve(locationMap(location))
                else promise.reject("REAL_LOCATION", message ?: "A fresh non-mock location was not available. Move outdoors and try again before simulation.")
            }
            listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    val mocked = if (Build.VERSION.SDK_INT >= 31) location.isMock else location.isFromMockProvider
                    val ageNanos = SystemClock.elapsedRealtimeNanos() - location.elapsedRealtimeNanos
                    if (!mocked && ageNanos in 0L..15_000_000_000L && location.hasAccuracy() && location.latitude.isFinite() && location.longitude.isFinite()) finish(location)
                }
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            }
            val timeout = Runnable { finish(null) }
            captures[listener] = timeout
            handler.postDelayed(timeout, 15000)
            try {
                val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER).filter { manager.isProviderEnabled(it) }
                if (providers.isEmpty()) finish(null, "Location services are disabled.")
                else providers.forEach { manager.requestLocationUpdates(it, 1000L, 0f, listener, Looper.getMainLooper()) }
            } catch (error: Exception) { finish(null, error.message) }
        }
    }

    private fun locationMap(location: Location): WritableMap = Arguments.createMap().apply {
        putDouble("latitude", location.latitude)
        putDouble("longitude", location.longitude)
        putDouble("accuracy", location.accuracy.toDouble())
        putDouble("altitude", location.altitude)
        putDouble("bearing", location.bearing.toDouble())
        putDouble("speed", location.speed.toDouble())
        putDouble("timestamp", location.time.toDouble())
        putString("provider", location.provider)
    }

    override fun invalidate() {
        SimulationState.observers.remove(observer)
        handler.post {
            captures.forEach { (listener, timeout) ->
                handler.removeCallbacks(timeout)
                manager.removeUpdates(listener)
            }
            captures.clear()
        }
        super.invalidate()
    }
}