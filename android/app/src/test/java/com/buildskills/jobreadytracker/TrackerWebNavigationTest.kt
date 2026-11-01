package com.buildskills.jobreadytracker

import org.junit.Assert.assertEquals
import org.junit.Test

class TrackerWebNavigationTest {
    @Test
    fun onlyTheExactHttpsHostingOriginStaysInsideTheWebView() {
        assertEquals(TrackerLinkTarget.IN_APP, TrackerWebNavigation.classify("https://build-skills-9320a.web.app/"))
        assertEquals(TrackerLinkTarget.IN_APP, TrackerWebNavigation.classify("https://build-skills-9320a.web.app/daily?from=widget"))
        assertEquals(TrackerLinkTarget.EXTERNAL_HTTPS, TrackerWebNavigation.classify("https://build-skills-9320a.web.app.evil.test/"))
        assertEquals(TrackerLinkTarget.BLOCK, TrackerWebNavigation.classify("https://build-skills-9320a.web.app:444/"))
        assertEquals(TrackerLinkTarget.BLOCK, TrackerWebNavigation.classify("https://user@build-skills-9320a.web.app/"))
    }

    @Test
    fun googleOAuthGoesToExplicitBrowserFallbackAndOtherHttpsLinksAreExternal() {
        assertEquals(TrackerLinkTarget.GOOGLE_AUTH, TrackerWebNavigation.classify("https://accounts.google.com/o/oauth2/v2/auth"))
        assertEquals(TrackerLinkTarget.GOOGLE_AUTH, TrackerWebNavigation.classify("https://oauth2.googleapis.com/token"))
        assertEquals(TrackerLinkTarget.GOOGLE_AUTH, TrackerWebNavigation.classify("https://build-skills-9320a.web.app/__/auth/handler"))
        assertEquals(TrackerLinkTarget.GOOGLE_AUTH, TrackerWebNavigation.classify("https://build-skills-9320a.firebaseapp.com/__/auth/handler"))
        assertEquals(TrackerLinkTarget.EXTERNAL_HTTPS, TrackerWebNavigation.classify("https://developer.android.com/"))
        assertEquals(TrackerLinkTarget.BLOCK, TrackerWebNavigation.classify("http://example.com/"))
        assertEquals(TrackerLinkTarget.BLOCK, TrackerWebNavigation.classify("javascript:alert(1)"))
        assertEquals(TrackerLinkTarget.BLOCK, TrackerWebNavigation.classify("intent://example.com/#Intent;scheme=https;end"))
    }

    @Test
    fun googleSignInHandoffOpensOnlyTheFixedBrowserAction() {
        assertEquals(TrackerLinkTarget.BROWSER_GOOGLE_SIGN_IN, TrackerWebNavigation.classify("jobreadytracker://google-sign-in"))
        assertEquals(TrackerLinkTarget.BLOCK, TrackerWebNavigation.classify("jobreadytracker://google-sign-in?url=https://evil.test"))
        assertEquals(TrackerLinkTarget.BLOCK, TrackerWebNavigation.classify("jobreadytracker://other"))
    }
}
