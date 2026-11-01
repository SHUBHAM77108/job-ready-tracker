package com.buildskills.jobreadytracker

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TrackerUploadsTest {
    @Test
    fun normalizeSplitsLowercasesAndDropsBlanks() {
        assertEquals(
            listOf(".csv", ".xlsx", "image/*"),
            TrackerUploads.normalize(arrayOf(".CSV, .xlsx", "image/*", " ", ".csv")),
        )
        assertEquals(emptyList<String>(), TrackerUploads.normalize(null))
    }

    @Test
    fun pickerMimeTypesCoverCsvXlsxImagesAndPdf() {
        assertArrayEquals(arrayOf("*/*"), TrackerUploads.pickerMimeTypes(emptyList()))
        assertArrayEquals(arrayOf("image/*", "application/pdf"), TrackerUploads.pickerMimeTypes(listOf("image/*", "application/pdf")))
        val csv = TrackerUploads.pickerMimeTypes(listOf(".csv")).toList()
        assertTrue("text/csv" in csv)
        assertTrue("application/octet-stream" in csv)
        val xlsx = TrackerUploads.pickerMimeTypes(listOf(".xlsx")).toList()
        assertTrue("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in xlsx)
        assertArrayEquals(arrayOf("*/*"), TrackerUploads.pickerMimeTypes(listOf("*/*", ".csv")))
    }

    @Test
    fun pickedFilesAreRecheckedAgainstAccept() {
        val csvOnly = listOf(".csv")
        assertTrue(TrackerUploads.matches(csvOnly, "application/octet-stream", "Data.CSV"))
        assertTrue(TrackerUploads.matches(csvOnly, "text/csv", "export"))
        assertFalse(TrackerUploads.matches(csvOnly, "application/x-msdownload", "setup.exe"))
        assertTrue(TrackerUploads.matches(listOf("image/*"), "image/png", "a.png"))
        assertTrue(TrackerUploads.matches(listOf("image/*"), "application/octet-stream", "a.jpg"))
        assertFalse(TrackerUploads.matches(listOf("image/*"), "application/pdf", "a.pdf"))
        assertTrue(TrackerUploads.matches(listOf("text/csv"), "application/octet-stream", "a.csv"))
        assertTrue(TrackerUploads.matches(emptyList(), null, null))
        assertFalse(TrackerUploads.matches(csvOnly, null, null))
    }
}
