package com.mockgpstester.mocklocation

import net.sf.geographiclib.Geodesic
import org.junit.Assert.*
import org.junit.Test

class LocationSimulatorTest {
    @Test fun lifecycleFreezesWhenPausedAndStops() {
        val engine = LocationSimulator(SimulationConfig(listOf(Coordinate(0.0, 0.0), Coordinate(0.0, 0.01)), speed = 10.0))
        val first = engine.advance(5.0)
        engine.pause()
        assertEquals(first, engine.advance(60.0))
        engine.resume()
        assertTrue(engine.advance(5.0).progress > first.progress)
        engine.stop()
        assertEquals("stopped", engine.state)
    }

    @Test fun interpolatesAcrossDateLine() {
        val engine = LocationSimulator(SimulationConfig(listOf(Coordinate(0.0, 179.9), Coordinate(0.0, -179.9)), speed = 100.0))
        val frame = engine.advance(engine.totalMeters / 200)
        assertEquals(180.0, kotlin.math.abs(frame.coordinate.longitude), 0.00001)
        assertEquals(50.0, frame.progress, 0.001)
    }

    @Test fun durationAndRouteComplete() {
        val engine = LocationSimulator(SimulationConfig(listOf(Coordinate(0.0, 0.0)), durationSeconds = 2.0))
        engine.advance(3.0)
        assertEquals("completed", engine.state)
        val route = LocationSimulator(SimulationConfig(listOf(Coordinate(0.0, 0.0), Coordinate(0.0, 0.001)), speed = 100.0))
        val frame = route.advance(5.0)
        assertEquals("completed", route.state)
        assertEquals(100.0, frame.progress, 0.001)
        assertEquals(0.0, frame.remainingMeters, 0.001)
    }

    @Test fun loopsAlongReturnLegWithoutTeleporting() {
        val engine = LocationSimulator(SimulationConfig(listOf(Coordinate(0.0, 0.0), Coordinate(0.0, 0.01)), speed = 10.0, loop = true))
        val frame = engine.advance(engine.totalMeters * 0.75 / 10.0)
        assertEquals(0.005, frame.coordinate.longitude, 0.00001)
        assertEquals(1, frame.waypoint)
        engine.advance(engine.totalMeters / 10.0)
        assertEquals("running", engine.state)
    }

    @Test fun rejectsInvalidInputs() {
        assertThrows(IllegalArgumentException::class.java) { Coordinate(Double.NaN, 0.0) }
        assertThrows(IllegalArgumentException::class.java) { Coordinate(0.0, 181.0) }
        assertThrows(IllegalArgumentException::class.java) { SimulationConfig(listOf(Coordinate(0.0, 0.0)), intervalMs = 0) }
        assertThrows(IllegalArgumentException::class.java) { LocationSimulator(SimulationConfig(listOf(Coordinate(0.0, 0.0), Coordinate(0.0, 0.0)), speed = 5.0)) }
    }

    @Test fun joystickSteersAndReportsSpeedAndBearing() {
        val engine = LocationSimulator(SimulationConfig(listOf(Coordinate(0.0, 0.0))))
        assertEquals(0.0, engine.advance(1.0).coordinate.longitude, 0.0)
        engine.steer(90.0, 10.0)
        val frame = engine.advance(2.0)
        assertEquals(20.0, Geodesic.WGS84.Inverse(0.0, 0.0, frame.coordinate.latitude, frame.coordinate.longitude).s12, 0.001)
        assertTrue(frame.coordinate.longitude > 0)
        assertEquals(90.0, frame.bearing, 0.0)
        assertEquals(10.0, frame.speed, 0.0)
        engine.steer(90.0, 0.0)
        assertEquals(frame.coordinate, engine.advance(5.0).coordinate)
    }

    @Test fun joystickStopsWhenCommandsStopArriving() {
        val engine = LocationSimulator(SimulationConfig(listOf(Coordinate(0.0, 0.0))))
        engine.steer(0.0, 10.0)
        val frame = engine.advance(10.0)
        val travelled = Geodesic.WGS84.Inverse(0.0, 0.0, frame.coordinate.latitude, frame.coordinate.longitude).s12
        assertEquals(10.0 * LocationSimulator.STEER_TIMEOUT_SECONDS, travelled, 0.001)
        assertEquals(0.0, frame.speed, 0.0)
        assertEquals(frame.coordinate, engine.advance(10.0).coordinate)
    }

    @Test fun pausedJoystickDoesNotMove() {
        val engine = LocationSimulator(SimulationConfig(listOf(Coordinate(0.0, 0.0))))
        engine.steer(180.0, 5.0)
        engine.pause()
        assertEquals(Coordinate(0.0, 0.0), engine.advance(30.0).coordinate)
    }

    @Test fun movesSingleLocationButNotRoutes() {
        val engine = LocationSimulator(SimulationConfig(listOf(Coordinate(0.0, 0.0))))
        engine.moveTo(Coordinate(10.0, 20.0))
        assertEquals(Coordinate(10.0, 20.0), engine.advance(1.0).coordinate)
        val route = LocationSimulator(SimulationConfig(listOf(Coordinate(0.0, 0.0), Coordinate(0.0, 0.01)), speed = 10.0))
        assertThrows(IllegalStateException::class.java) { route.moveTo(Coordinate(1.0, 1.0)) }
        assertThrows(IllegalStateException::class.java) { route.steer(0.0, 1.0) }
        assertThrows(IllegalArgumentException::class.java) { engine.steer(360.0, 1.0) }
        assertThrows(IllegalArgumentException::class.java) { engine.steer(0.0, 301.0) }
    }
}