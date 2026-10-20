package com.mockgpstester.mocklocation

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
}