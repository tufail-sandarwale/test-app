package com.mockgpstester.mocklocation

import android.Manifest
import android.app.AppOpsManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Criteria
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.Process
import android.os.SystemClock
import android.util.Log
import com.mockgpstester.BuildConfig
import com.mockgpstester.MainActivity
import org.json.JSONObject

class MockLocationService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var manager: LocationManager
    private var simulator: LocationSimulator? = null
    private var previousTick = 0L
    private val ownedProviders = mutableSetOf<String>()
    private var wakeLock: PowerManager.WakeLock? = null
    private val tick = object : Runnable {
        override fun run() {
            val engine = simulator ?: return
            if (engine.state != "running") return
            try {
                verifyRequirements(this@MockLocationService)
                val now = SystemClock.elapsedRealtime()
                val frame = engine.advance((now - previousTick) / 1000.0)
                previousTick = now
                inject(frame, engine.config)
                SimulationState.publish(this@MockLocationService, engine.state, frame, engine.config)
                if (engine.state == "completed") finish("completed")
                else handler.postDelayed(this, engine.config.intervalMs)
            } catch (error: Exception) { fail(error) }
        }
    }

    override fun onCreate() {
        super.onCreate()
        manager = getSystemService(LOCATION_SERVICE) as LocationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val notifications = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            notifications.createNotificationChannel(NotificationChannel(CHANNEL, "GPS testing simulation", NotificationManager.IMPORTANCE_LOW))
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            when (intent?.action) {
                START -> {
                    if (simulator != null) return START_NOT_STICKY
                    val configuration = parseConfig(JSONObject(requireNotNull(intent.getStringExtra("config"))))
                    verifyRequirements(this)
                    val notification = notification(false)
                    if (Build.VERSION.SDK_INT >= 29) startForeground(1001, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
                    else startForeground(1001, notification)
                    simulator = LocationSimulator(configuration)
                    setupProviders()
                    acquireWakeLock()
                    previousTick = SystemClock.elapsedRealtime()
                    handler.post(tick)
                    log("Service started")
                }
                PAUSE -> {
                    val engine = simulator ?: return START_NOT_STICKY
                    if (engine.state != "running") return START_NOT_STICKY
                    engine.advance((SystemClock.elapsedRealtime() - previousTick) / 1000.0)
                    if (engine.state == "completed") { finish("completed"); return START_NOT_STICKY }
                    engine.pause()
                    handler.removeCallbacks(tick)
                    val cleanupError = releaseProviders()
                    check(cleanupError == null) { cleanupError ?: "Provider cleanup failed." }
                    releaseWakeLock()
                    SimulationState.publish(this, "paused")
                    updateNotification(true)
                }
                RESUME -> {
                    val engine = simulator ?: return START_NOT_STICKY
                    if (engine.state != "paused") return START_NOT_STICKY
                    verifyRequirements(this)
                    setupProviders()
                    engine.resume()
                    acquireWakeLock()
                    previousTick = SystemClock.elapsedRealtime()
                    updateNotification(false)
                    handler.post(tick)
                }
                STOP -> finish("stopped")
                else -> finish("stopped")
            }
        } catch (error: Exception) { fail(error) }
        return START_NOT_STICKY
    }

    private fun setupProviders() {
        for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
            manager.addTestProvider(provider, false, false, false, false, true, true, true, Criteria.POWER_LOW, Criteria.ACCURACY_FINE)
            ownedProviders.add(provider)
            manager.setTestProviderEnabled(provider, true)
        }
    }

    private fun inject(frame: SimulationFrame, config: SimulationConfig) {
        ownedProviders.forEach { provider ->
            val location = Location(provider).apply {
                latitude = frame.coordinate.latitude
                longitude = frame.coordinate.longitude
                accuracy = config.accuracy.toFloat()
                altitude = config.altitude
                bearing = frame.bearing.toFloat()
                speed = config.speed.toFloat()
                time = System.currentTimeMillis()
                elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
                if (Build.VERSION.SDK_INT >= 26) {
                    verticalAccuracyMeters = config.accuracy.toFloat()
                    speedAccuracyMetersPerSecond = 0.1f
                    bearingAccuracyDegrees = 1f
                }
            }
            manager.setTestProviderLocation(provider, location)
        }
    }

    private fun releaseProviders(): String? {
        var failed = false
        ownedProviders.toList().forEach { provider ->
            try { manager.removeTestProvider(provider); ownedProviders.remove(provider) }
            catch (_: IllegalArgumentException) { ownedProviders.remove(provider) }
            catch (error: Exception) { failed = true; log("Provider cleanup failed: ${error.javaClass.simpleName}") }
        }
        return if (failed) "Mock provider cleanup failed. Restore mock-app selection and stop again, or turn mock locations off in Developer Options." else null
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        wakeLock = (getSystemService(POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MockGPSTester:simulation").apply {
            setReferenceCounted(false)
            acquire(25L * 60 * 60 * 1000)
        }
    }

    private fun releaseWakeLock() { wakeLock?.let { if (it.isHeld) it.release() }; wakeLock = null }

    private fun finish(state: String, message: String? = null) {
        handler.removeCallbacks(tick)
        simulator?.stop()
        simulator = null
        val cleanupError = releaseProviders()
        releaseWakeLock()
        SimulationState.publish(this, if (cleanupError == null) state else "error", message = cleanupError ?: message)
        if (cleanupError != null) getSharedPreferences("simulation", MODE_PRIVATE).edit().putBoolean("active", true).apply()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        log("Service stopped")
    }

    private fun fail(error: Exception) {
        val message = if (error is SecurityException) MOCK_MESSAGE else error.message ?: "Simulation service failed."
        log("Service failure: ${error.javaClass.simpleName}")
        finish("error", message)
    }

    override fun onDestroy() {
        handler.removeCallbacks(tick)
        val cleanupError = releaseProviders()
        releaseWakeLock()
        if (cleanupError != null || SimulationState.state in listOf("running", "paused", "starting")) {
            SimulationState.publish(this, "error", message = cleanupError ?: "Simulation stopped unexpectedly. Start it again from the app.")
            if (cleanupError != null) getSharedPreferences("simulation", MODE_PRIVATE).edit().putBoolean("active", true).apply()
        }
        super.onDestroy()
    }

    private fun notification(paused: Boolean): Notification {
        fun action(action: String, request: Int) = PendingIntent.getService(this, request, Intent(this, MockLocationService::class.java).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
        return builder.setContentTitle("Mock GPS Tester")
            .setContentText(if (paused) "Simulation paused" else "Mock location testing is running")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true)
            .addAction(Notification.Action.Builder(null, if (paused) "Resume" else "Pause", action(if (paused) RESUME else PAUSE, 1)).build())
            .addAction(Notification.Action.Builder(null, "Stop", action(STOP, 2)).build()).build()
    }

    private fun updateNotification(paused: Boolean) { (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(1001, notification(paused)) }
    private fun log(message: String) { if (BuildConfig.DEBUG) Log.d("MockLocation", "[MockLocation] $message") }

    companion object {
        const val START = "com.mockgpstester.START"
        const val PAUSE = "com.mockgpstester.PAUSE"
        const val RESUME = "com.mockgpstester.RESUME"
        const val STOP = "com.mockgpstester.STOP"
        const val CHANNEL = "mock-location"
        const val MOCK_MESSAGE = "Mock location is not enabled for this application. Select this application as the mock location app in Android Developer Options."

        fun verifyRequirements(context: Context) {
            require(context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) { "Precise location permission is required." }
            val appOps = context.getSystemService(APP_OPS_SERVICE) as AppOpsManager
            if (appOps.checkOpNoThrow(AppOpsManager.OPSTR_MOCK_LOCATION, Process.myUid(), context.packageName) != AppOpsManager.MODE_ALLOWED) throw SecurityException(MOCK_MESSAGE)
            val manager = context.getSystemService(LOCATION_SERVICE) as LocationManager
            require(if (Build.VERSION.SDK_INT >= 28) manager.isLocationEnabled else manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) { "Location services are disabled." }
        }

        fun parseConfig(json: JSONObject): SimulationConfig {
            val route = json.optJSONArray("points")
            val points = if (route != null) (0 until route.length()).map { index ->
                val point = route.getJSONObject(index)
                Coordinate(point.getDouble("latitude"), point.getDouble("longitude"))
            } else listOf(Coordinate(json.getDouble("latitude"), json.getDouble("longitude")))
            if (route != null) require(points.size >= 2) { "A route requires at least two waypoints." }
            return SimulationConfig(points, json.optDouble("accuracy", 5.0), json.optDouble("altitude", 0.0), json.optDouble("bearing", 0.0),
                if (route != null) json.getDouble("speedKmh") / 3.6 else json.optDouble("speed", 0.0),
                json.optLong("updateIntervalMs", 1000), json.optDouble("durationSeconds", 0.0), json.optString("routeMode", "once") == "loop")
        }
    }
}