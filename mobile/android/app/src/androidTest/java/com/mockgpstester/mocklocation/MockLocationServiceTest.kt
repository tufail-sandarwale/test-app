package com.mockgpstester.mocklocation

import android.Manifest
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Process
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.mockgpstester.MainActivity
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

@RunWith(AndroidJUnit4::class)
class MockLocationServiceTest {
    @Test fun injectsPausesResumesAndStops() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        assumeTrue("Manually select Mock GPS Tester in Developer Options before this test.", appOps.checkOpNoThrow(AppOpsManager.OPSTR_MOCK_LOCATION, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED)
        assumeTrue("Grant precise location and enable location services first.", context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED && manager.isProviderEnabled(LocationManager.GPS_PROVIDER))
        assumeTrue("Stop any current simulation first.", SimulationState.state !in listOf("starting", "running", "paused"))
        val handler = Handler(Looper.getMainLooper())
        val reading = AtomicReference<Location>()
        val received = CountDownLatch(1)
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (location.isFromMockProvider) { reading.set(location); received.countDown() }
            }
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        }
        fun command(action: String, expected: String) {
            val latch = CountDownLatch(1)
            val observer: () -> Unit = { if (SimulationState.state == expected) latch.countDown() }
            SimulationState.observers.add(observer)
            try {
                val intent = Intent(context, MockLocationService::class.java).setAction(action)
                if (action == MockLocationService.START) intent.putExtra("config", """{"latitude":19.076,"longitude":72.8777,"updateIntervalMs":200,"durationSeconds":30}""")
                handler.post { if (action == MockLocationService.START && Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent) }
                assertTrue("Expected $expected, got ${SimulationState.state}: ${SimulationState.error}", latch.await(10, TimeUnit.SECONDS))
            } finally { SimulationState.observers.remove(observer) }
        }
        ActivityScenario.launch(MainActivity::class.java).use {
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0L, 0f, listener, Looper.getMainLooper())
            try {
                command(MockLocationService.START, "running")
                assertTrue("No mock GPS reading received.", received.await(10, TimeUnit.SECONDS))
                assertEquals(19.076, reading.get().latitude, 0.00001)
                command(MockLocationService.PAUSE, "paused")
                command(MockLocationService.RESUME, "running")
                command(MockLocationService.STOP, "stopped")
                assertNull(SimulationState.error)
            } finally {
                manager.removeUpdates(listener)
                handler.post { context.stopService(Intent(context, MockLocationService::class.java)) }
            }
        }
    }
}