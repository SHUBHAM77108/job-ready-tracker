package com.buildskills.jobreadytracker

import org.junit.Assert.assertEquals
import org.junit.Test

class TrackerDownloadsTest {
    @Test
    fun classifiesDownloadUrlsByScheme() {
        assertEquals(DownloadKind.HTTPS, classifyDownloadUrl("https://example.com/a.csv"))
        assertEquals(DownloadKind.HTTPS, classifyDownloadUrl("  HTTPS://example.com/a.csv"))
        assertEquals(DownloadKind.BLOB, classifyDownloadUrl("blob:https://build-skills-9320a.web.app/1234"))
        assertEquals(DownloadKind.DATA, classifyDownloadUrl("data:text/csv;base64,YQ=="))
        assertEquals(DownloadKind.UNSUPPORTED, classifyDownloadUrl("http://example.com/a.csv"))
        assertEquals(DownloadKind.UNSUPPORTED, classifyDownloadUrl("file:///sdcard/a.csv"))
        assertEquals(DownloadKind.UNSUPPORTED, classifyDownloadUrl(null))
    }

    @Test
    fun fileNamesCannotEscapeTheDownloadsFolder() {
        assertEquals("report.csv", safeDownloadFileName("report.csv"))
        assertEquals("_evil.csv", safeDownloadFileName("../evil.csv"))
        assertEquals("a_b_c.csv", safeDownloadFileName("a/b\\c.csv"))
        assertEquals("download", safeDownloadFileName("..."))
        assertEquals("download", safeDownloadFileName(null))
    }
}
