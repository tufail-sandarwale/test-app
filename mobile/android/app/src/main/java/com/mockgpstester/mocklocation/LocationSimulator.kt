package com.mockgpstester.mocklocation

import net.sf.geographiclib.Geodesic

data class Coordinate(val latitude: Double, val longitude: Double) {
    init {
        require(latitude.isFinite() && latitude in -90.0..90.0) { "Latitude must be between -90 and 90." }
        require(longitude.isFinite() && longitude in -180.0..180.0) { "Longitude must be between -180 and 180." }
    }
}

data class SimulationConfig(
    val points: List<Coordinate>,
    val accuracy: Double = 5.0,
    val altitude: Double = 0.0,
    val bearing: Double = 0.0,
    val speed: Double = 0.0,
    val intervalMs: Long = 1000,
    val durationSeconds: Double = 0.0,
    val loop: Boolean = false,
) {
    init {
        require(points.isNotEmpty() && points.size <= 500) { "Use 1 to 500 coordinates." }
        require(accuracy.isFinite() && accuracy in 0.1..10000.0) { "Accuracy must be 0.1 to 10000 meters." }
        require(altitude.isFinite() && altitude in -12000.0..100000.0) { "Invalid altitude." }
        require(bearing.isFinite() && bearing >= 0 && bearing < 360) { "Bearing must be 0 to less than 360." }
        require(speed.isFinite() && speed in 0.0..300.0) { "Speed must be 0 to 300 m/s." }
        require(intervalMs in 200..10000) { "Update interval must be 200 to 10000 milliseconds." }
        require(durationSeconds.isFinite() && durationSeconds in 0.0..86400.0) { "Duration must be 0 to 86400 seconds." }
        require(points.size == 1 || speed > 0) { "Route speed must be greater than zero." }
    }
}

data class SimulationFrame(val coordinate: Coordinate, val bearing: Double, val progress: Double, val waypoint: Int, val remainingMeters: Double, val elapsedSeconds: Double)

class LocationSimulator(val config: SimulationConfig) {
    var state = "running"
        private set
    private var elapsedSeconds = 0.0
    private val path = if (config.loop && config.points.size > 1 && config.points.first() != config.points.last()) config.points + config.points.first() else config.points
    private val segments = path.zipWithNext().map { (origin, target) ->
        Geodesic.WGS84.Inverse(origin.latitude, origin.longitude, target.latitude, target.longitude)
    }
    val totalMeters = segments.sumOf { it.s12 }

    init { require(config.points.size == 1 || totalMeters > 0.01) { "A route must contain distinct waypoints." } }

    fun pause() { check(state == "running") { "Simulation is not running." }; state = "paused" }
    fun resume() { check(state == "paused") { "Simulation is not paused." }; state = "running" }
    fun stop() { state = "stopped" }

    fun advance(seconds: Double): SimulationFrame {
        require(seconds.isFinite() && seconds >= 0) { "Elapsed time must be nonnegative." }
        if (state == "running") elapsedSeconds += seconds
        val limit = if (config.durationSeconds > 0) config.durationSeconds else 86400.0
        if (state == "running" && elapsedSeconds >= limit) { elapsedSeconds = limit; state = "completed" }
        if (segments.isEmpty()) return SimulationFrame(config.points[0], config.bearing, 0.0, 0, 0.0, elapsedSeconds)
        val travelled = elapsedSeconds * config.speed
        val routeDistance = if (config.loop) travelled % totalMeters else travelled.coerceAtMost(totalMeters)
        if (state == "running" && !config.loop && travelled >= totalMeters) state = "completed"
        var segmentDistance = routeDistance
        var segmentIndex = 0
        while (segmentIndex < segments.lastIndex && segmentDistance >= segments[segmentIndex].s12) {
            segmentDistance -= segments[segmentIndex].s12
            segmentIndex++
        }
        val origin = path[segmentIndex]
        val sample = Geodesic.WGS84.Direct(origin.latitude, origin.longitude, segments[segmentIndex].azi1, segmentDistance)
        return SimulationFrame(Coordinate(sample.lat2, sample.lon2), (sample.azi2 + 360) % 360, routeDistance / totalMeters * 100, (segmentIndex + 1) % config.points.size + 1, totalMeters - routeDistance, elapsedSeconds)
    }
}