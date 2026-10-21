package com.mockgpstester

import android.content.Context
import android.os.Build
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Saves the last fatal error to app storage so the next launch can show it.
 * Lets testers report failures without USB debugging or logcat.
 */
object CrashRecorder {
    private const val FILE_NAME = "last-crash.txt"
    const val MAX_CHARS = 16_000

    @Volatile private var installed = false

    fun install(context: Context) {
        if (installed) return
        installed = true
        val appContext = context.applicationContext
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            record(appContext, "Uncaught exception on thread ${thread.name}", error)
            previous?.uncaughtException(thread, error)
        }
    }

    fun record(context: Context, source: String, error: Throwable) {
        try {
            val report = format(
                source,
                error,
                System.currentTimeMillis(),
                "${Build.MANUFACTURER} ${Build.MODEL}",
                Build.VERSION.SDK_INT,
                BuildConfig.VERSION_NAME,
            )
            File(context.filesDir, FILE_NAME).writeText(report)
        } catch (_: Throwable) {
            // Never let crash reporting cause another crash.
        }
    }

    fun read(context: Context): String? =
        File(context.filesDir, FILE_NAME).takeIf { it.isFile }?.readText()?.takeIf { it.isNotBlank() }

    fun clear(context: Context) {
        File(context.filesDir, FILE_NAME).delete()
    }

    fun format(source: String, error: Throwable, timeMillis: Long, device: String, sdk: Int, version: String): String {
        val time = SimpleDateFormat("yyyy-MM-dd HH:mm:ss 'UTC'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
        val trace = StringWriter().also { error.printStackTrace(PrintWriter(it)) }.toString()
        return buildString {
            appendLine("Time: ${time.format(Date(timeMillis))}")
            appendLine("App version: $version")
            appendLine("Device: $device (Android API $sdk)")
            appendLine("Source: $source")
            appendLine()
            append(trace)
        }.take(MAX_CHARS)
    }
}
