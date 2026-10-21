package com.mockgpstester

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CrashRecorderTest {
    @Test fun formatsAReadableReport() {
        val report = CrashRecorder.format("React Native", IllegalStateException("Map failed"), 0L, "Acme Phone", 34, "1.0-test")
        val lines = report.lines()
        assertEquals("Time: 1970-01-01 00:00:00 UTC", lines[0])
        assertEquals("App version: 1.0-test", lines[1])
        assertEquals("Device: Acme Phone (Android API 34)", lines[2])
        assertEquals("Source: React Native", lines[3])
        assertTrue(report.contains("java.lang.IllegalStateException: Map failed"))
        assertTrue(report.contains("CrashRecorderTest.formatsAReadableReport"))
    }

    @Test fun capsVeryLongReports() {
        val report = CrashRecorder.format("Test", RuntimeException("x".repeat(50_000)), 0L, "Device", 24, "1")
        assertEquals(CrashRecorder.MAX_CHARS, report.length)
    }
}
