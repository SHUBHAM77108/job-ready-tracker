package com.buildskills.jobreadytracker

import java.net.URI

internal enum class TrackerLinkTarget { IN_APP, GOOGLE_AUTH, BROWSER_GOOGLE_SIGN_IN, EXTERNAL_HTTPS, BLOCK }

/** Strictly separates URLs allowed inside the trusted tracker WebView from external destinations. */
internal object TrackerWebNavigation {
    const val TRUSTED_HOST = "build-skills-9320a.web.app"
    private val googleAuthHosts = setOf("accounts.google.com", "accounts.googleusercontent.com", "oauth2.googleapis.com")

    fun classify(rawUrl: String): TrackerLinkTarget {
        val uri = runCatching { URI(rawUrl) }.getOrNull() ?: return TrackerLinkTarget.BLOCK
        val scheme = uri.scheme?.lowercase() ?: return TrackerLinkTarget.BLOCK
        val host = uri.host?.lowercase() ?: return TrackerLinkTarget.BLOCK
        if (scheme == "jobreadytracker") {
            return if (host == "google-sign-in" && uri.userInfo == null && uri.port == -1 &&
                (uri.path.isNullOrEmpty() || uri.path == "/") && uri.query == null && uri.fragment == null
            ) TrackerLinkTarget.BROWSER_GOOGLE_SIGN_IN else TrackerLinkTarget.BLOCK
        }
        if (uri.userInfo != null || uri.port !in setOf(-1, 443)) return TrackerLinkTarget.BLOCK
        if (scheme == "https" && host == TRUSTED_HOST && uri.path == "/__/auth/handler") {
            return TrackerLinkTarget.GOOGLE_AUTH
        }
        if (scheme == "https" && host == "build-skills-9320a.firebaseapp.com" && uri.path == "/__/auth/handler") {
            return TrackerLinkTarget.GOOGLE_AUTH
        }
        if (scheme == "https" && host == TRUSTED_HOST) return TrackerLinkTarget.IN_APP
        if (scheme != "https") return TrackerLinkTarget.BLOCK
        if (host in googleAuthHosts) return TrackerLinkTarget.GOOGLE_AUTH
        return TrackerLinkTarget.EXTERNAL_HTTPS
    }
}
