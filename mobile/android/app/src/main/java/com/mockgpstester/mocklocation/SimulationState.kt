package com.mockgpstester.mocklocation

import android.content.Context
import android.location.LocationManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.CopyOnWriteArraySet

object SimulationState {
    var state = "stopped"
        private set
    var error: String? = null
        private set
    var frame: SimulationFrame? = null
        private set
    var config: SimulationConfig? = null
        private set
    var timestamp = 0L
        private set
    val observers = CopyOnWriteArraySet<() -> Unit>()

    fun publish(context: Context, nextState: String, nextFrame: SimulationFrame? = frame, nextConfig: SimulationConfig? = config, message: String? = null) {
        state = nextState
        frame = nextFrame
        config = nextConfig
        error = message
        if (nextState == "running" || nextState == "completed") timestamp = System.currentTimeMillis()
        val active = nextState in listOf("starting", "running", "paused")
        val preferences = context.getSharedPreferences("simulation", Context.MODE_PRIVATE)
        if (preferences.getBoolean("active", false) != active) preferences.edit().putBoolean("active", active).apply()
        observers.forEach { it() }
    }

    fun recover(context: Context) {
        val preferences = context.getSharedPreferences("simulation", Context.MODE_PRIVATE)
        if (state in listOf("stopped", "error") && preferences.getBoolean("active", false)) {
            val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            var cleanupFailed = false
            for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
                try { manager.removeTestProvider(provider) }
                catch (_: IllegalArgumentException) { }
                catch (_: SecurityException) { cleanupFailed = true }
            }
            publish(context, "error", message = if (cleanupFailed) "Provider recovery needs mock-app permission. Select this app in Developer Options and reopen it, or disable mock locations manually." else "Simulation stopped unexpectedly. Providers were cleaned up; start again from the app.")
            if (cleanupFailed) preferences.edit().putBoolean("active", true).apply()
        }
    }

    fun snapshot(): WritableMap = Arguments.createMap().apply {
        putString("state", state)
        putString("error", error)
        putDouble("timestamp", timestamp.toDouble())
        config?.let { putString("kind", if (it.points.size > 1) "route" else "point") }
        frame?.let { sample ->
            putDouble("progress", sample.progress)
            putInt("currentWaypoint", sample.waypoint)
            putDouble("remainingMeters", sample.remainingMeters)
            putDouble("elapsedSeconds", sample.elapsedSeconds)
            putMap("location", Arguments.createMap().apply {
                putDouble("latitude", sample.coordinate.latitude)
                putDouble("longitude", sample.coordinate.longitude)
                putDouble("bearing", sample.bearing)
                putDouble("accuracy", config?.accuracy ?: 5.0)
                putDouble("altitude", config?.altitude ?: 0.0)
                putDouble("speed", sample.speed)
                putDouble("timestamp", timestamp.toDouble())
                putString("provider", "gps")
            })
        }
    }
}