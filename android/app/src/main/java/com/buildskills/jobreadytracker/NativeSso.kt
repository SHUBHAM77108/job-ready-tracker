package com.buildskills.jobreadytracker

import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

internal sealed class SsoResult {
    /** Deliberately not a data class, so the one-time code can never end up in a log through toString(). */
    class Code(val code: String) : SsoResult()
    class Failure(val reason: SsoFailure) : SsoResult()
}

internal enum class SsoFailure { UNAUTHORIZED, BACKEND_UNAVAILABLE, NETWORK, UNEXPECTED }

/**
 * Protocol helpers for the web app's native sign-in hand-off (functions/sso-core.js and
 * src/pages/NativeSsoCallback.jsx). No Android types, so everything here is unit-testable on the JVM.
 *
 * Flow: the native Firebase ID token goes only in an HTTPS Authorization header to createNativeSsoCode; the
 * server returns a short-lived one-time code, and only that code is placed in the URL fragment of /auth/native.
 */
internal object NativeSso {
    private const val ORIGIN = "https://${TrackerWebNavigation.TRUSTED_HOST}"
    const val CREATE_CODE_URL = "$ORIGIN/api/createNativeSsoCode"
    const val CALLBACK_PATH = "/auth/native"
    private const val CALLBACK_URL = "$ORIGIN$CALLBACK_PATH"

    // Same shape the server accepts for a one-time code (functions/sso-core.js).
    private val codePattern = Regex("^[A-Za-z0-9_-]{40,64}$")
    private val codeField = Regex("\"code\"\\s*:\\s*\"([A-Za-z0-9_-]{40,64})\"")
    private val errorField = Regex("\"error\"\\s*:\\s*\"([a-z_]{1,48})\"")

    fun isValidCode(code: String?): Boolean = code != null && codePattern.matches(code)

    fun callbackUrl(code: String): String {
        require(isValidCode(code)) { "Invalid one-time code" }
        return "$CALLBACK_URL#code=$code"
    }

    fun parseCode(body: String): String? = codeField.find(body)?.groupValues?.get(1)

    fun parseError(body: String): String? = errorField.find(body)?.groupValues?.get(1)

    fun classify(status: Int, contentType: String, body: String): SsoResult {
        // Hosting's HTML fallback or a 404 means the functions aren't deployed on the live site yet.
        if (!contentType.lowercase().contains("application/json")) return SsoResult.Failure(SsoFailure.BACKEND_UNAVAILABLE)
        if (status == 200) {
            val code = parseCode(body)
            return if (code != null) SsoResult.Code(code) else SsoResult.Failure(SsoFailure.UNEXPECTED)
        }
        return when {
            parseError(body) == "unauthorized" -> SsoResult.Failure(SsoFailure.UNAUTHORIZED)
            status in 500..599 -> SsoResult.Failure(SsoFailure.BACKEND_UNAVAILABLE)
            else -> SsoResult.Failure(SsoFailure.UNEXPECTED)
        }
    }
}

internal object NativeSsoClient {
    private const val MAX_BODY_BYTES = 4096

    /** Blocking; call off the main thread. The ID token is sent only in the Authorization header and never logged. */
    fun requestCode(idToken: String): SsoResult = try {
        val connection = URL(NativeSso.CREATE_CODE_URL).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.useCaches = false
            connection.doOutput = true
            connection.setRequestProperty("Authorization", "Bearer $idToken")
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            connection.outputStream.use { it.write("{}".toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.use { readCapped(it) }.orEmpty()
            NativeSso.classify(status, connection.contentType.orEmpty(), body)
        } finally {
            connection.disconnect()
        }
    } catch (_: IOException) {
        SsoResult.Failure(SsoFailure.NETWORK)
    } catch (_: Exception) {
        SsoResult.Failure(SsoFailure.UNEXPECTED)
    }

    private fun readCapped(stream: InputStream): String {
        val buffer = ByteArray(MAX_BODY_BYTES)
        var length = 0
        while (length < MAX_BODY_BYTES) {
            val read = stream.read(buffer, length, MAX_BODY_BYTES - length)
            if (read < 0) break
            length += read
        }
        return String(buffer, 0, length, Charsets.UTF_8)
    }
}
