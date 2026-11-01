package com.buildskills.jobreadytracker

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeSsoTest {
    private val code = "A".repeat(43)

    @Test
    fun onlyServerShapedCodesAreAccepted() {
        assertTrue(NativeSso.isValidCode(code))
        assertTrue(NativeSso.isValidCode("aB3_-".repeat(9)))
        assertFalse(NativeSso.isValidCode(null))
        assertFalse(NativeSso.isValidCode("short"))
        assertFalse(NativeSso.isValidCode("A".repeat(65)))
        assertFalse(NativeSso.isValidCode("A".repeat(42) + "#"))
        assertFalse(NativeSso.isValidCode("A".repeat(42) + " "))
    }

    @Test
    fun callbackUrlPutsTheCodeOnlyInTheFragmentAndStaysInTheWebView() {
        val url = NativeSso.callbackUrl(code)
        assertEquals("https://build-skills-9320a.web.app/auth/native#code=$code", url)
        assertEquals(TrackerLinkTarget.IN_APP, TrackerWebNavigation.classify(url))
        assertFalse(url.substringBefore('#').contains(code))
    }

    @Test(expected = IllegalArgumentException::class)
    fun callbackUrlRejectsAMalformedCode() {
        NativeSso.callbackUrl("not a code&x=1")
    }

    @Test
    fun endpointIsHttpsOnTheTrustedHost() {
        assertEquals("https://build-skills-9320a.web.app/api/createNativeSsoCode", NativeSso.CREATE_CODE_URL)
    }

    @Test
    fun successResponseYieldsTheCode() {
        val result = NativeSso.classify(200, "application/json; charset=utf-8", """{"code":"$code","expiresInSeconds":120}""")
        assertTrue(result is SsoResult.Code)
        assertEquals(code, (result as SsoResult.Code).code)
    }

    @Test
    fun undeployedBackendIsRecognisedFromNonJsonResponses() {
        assertBackendUnavailable(NativeSso.classify(200, "text/html", "<!doctype html><html></html>"))
        assertBackendUnavailable(NativeSso.classify(404, "text/html; charset=utf-8", "Not Found"))
        assertBackendUnavailable(NativeSso.classify(405, "", ""))
        assertBackendUnavailable(NativeSso.classify(500, "application/json", """{"error":"sso_unavailable"}"""))
    }

    @Test
    fun otherFailuresAreMappedWithoutLeakingBodies() {
        assertEquals(SsoFailure.UNAUTHORIZED, failure(NativeSso.classify(401, "application/json", """{"error":"unauthorized"}""")))
        assertEquals(SsoFailure.UNEXPECTED, failure(NativeSso.classify(403, "application/json", """{"error":"origin_not_allowed"}""")))
        assertEquals(SsoFailure.UNEXPECTED, failure(NativeSso.classify(200, "application/json", """{"expiresInSeconds":120}""")))
        assertEquals(SsoFailure.UNEXPECTED, failure(NativeSso.classify(200, "application/json", """{"code":"short"}""")))
    }

    private fun failure(result: SsoResult): SsoFailure = (result as SsoResult.Failure).reason
    private fun assertBackendUnavailable(result: SsoResult) = assertEquals(SsoFailure.BACKEND_UNAVAILABLE, failure(result))
}
