package com.buildskills.jobreadytracker

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters
import java.time.DayOfWeek

class HeatmapRendererTest {
    @Test
    fun gridStartsAtTopLeftWithFirstVisibleMondayAndRunsAcrossThenDown() {
        val monday = LocalDate.of(2026, 9, 28)
        assertEquals(monday, HeatmapRenderer.dateAt(monday, 0, 0))
        assertEquals(LocalDate.of(2026, 10, 4), HeatmapRenderer.dateAt(monday, 0, 6))
        assertEquals(LocalDate.of(2026, 10, 5), HeatmapRenderer.dateAt(monday, 1, 0))
    }

    @Test
    fun visibleWindowMatchesWebsiteCalendarColumnAndRowForSameDate() {
        val planStart = LocalDate.of(2026, 9, 30) // Wednesday
        val today = LocalDate.of(2026, 10, 29)
        val weeks = 9
        val widgetFirstMonday = HeatmapRenderer.visibleWeekStart(today, weeks)
        val date = LocalDate.of(2026, 10, 12) // Monday

        // Website PlanGlance starts at the Monday before roadmap day one and uses week columns,
        // Monday-through-Sunday rows. Android must locate this exact calendar date identically.
        val websiteFirstMonday = planStart.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        val websiteOffset = java.time.temporal.ChronoUnit.DAYS.between(websiteFirstMonday, date).toInt()
        val websiteColumn = websiteOffset / 7
        val websiteRow = websiteOffset % 7
        val widgetOffset = java.time.temporal.ChronoUnit.DAYS.between(widgetFirstMonday, date).toInt()
        val widgetColumn = widgetOffset / 7
        val widgetRow = widgetOffset % 7
        val data = HeatmapData(planStart, 365, emptyMap())

        assertEquals(date, HeatmapRenderer.dateAt(widgetFirstMonday, widgetColumn, widgetRow))
        assertEquals(websiteRow, widgetRow)
        assertEquals(13, data.dayNumberFor(date)) // website Day 13 is also rendered on this calendar date
        assertEquals(date, planStart.plusDays(data.dayNumberFor(date)!!.toLong() - 1))
        assertEquals(websiteOffset / 7, websiteColumn)
    }

    @Test
    fun widgetWindowEndsOnCurrentMondayWeekAndCanResize() {
        val today = LocalDate.of(2026, 10, 29)
        val first = HeatmapRenderer.visibleWeekStart(today, 1)
        assertEquals(LocalDate.of(2026, 10, 26), first)
        assertEquals(LocalDate.of(2026, 10, 26), HeatmapRenderer.dateAt(first, 0, 0))
    }
}
