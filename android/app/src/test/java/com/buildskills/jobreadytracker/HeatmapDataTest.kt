package com.buildskills.jobreadytracker

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class HeatmapDataTest {

    @Test
    fun testDay1IsPlacedCorrectlyAndMatchesLevel() {
        val startDate = LocalDate.of(2026, 3, 1) // Sunday -> offset = 6
        val dailyTasks = mapOf(
            1 to DayInfo(total = 2, done = 2), // Day 1: 100% completed
            2 to DayInfo(total = 2, done = 1), // Day 2: 50% completed
            3 to DayInfo(total = 2, done = 0)  // Day 3: 0% completed
        )
        val data = HeatmapData(planStart = startDate, planDays = 60, dailyTasks = dailyTasks)

        val today = LocalDate.of(2026, 3, 2) // Today is Day 2
        assertEquals(HeatmapLevel.L3, data.levelForDay(1, today))
        assertEquals(HeatmapLevel.L2, data.levelForDay(2, today))
        assertEquals(HeatmapLevel.PLANNED, data.levelForDay(3, today)) // Day 3 is in future
    }

    @Test
    fun testOutAndNoneLevels() {
        val startDate = LocalDate.of(2026, 3, 1)
        val data = HeatmapData(planStart = startDate, planDays = 30, dailyTasks = emptyMap())
        val today = LocalDate.of(2026, 3, 1)

        assertEquals(HeatmapLevel.NONE, data.levelForDay(1, today))
        assertEquals(HeatmapLevel.OUT, data.levelForDay(31, today))
    }

    @Test
    fun testMondayOffsetCalculation() {
        val sunday = LocalDate.of(2026, 3, 1) // Sunday -> dayOfWeek = 7 -> (7 - 1) % 7 = 6
        val monday = LocalDate.of(2026, 3, 2) // Monday -> dayOfWeek = 1 -> (1 - 1) % 7 = 0

        assertEquals(6, (sunday.dayOfWeek.value - 1) % 7)
        assertEquals(0, (monday.dayOfWeek.value - 1) % 7)
    }

    @Test
    fun testVisibleWidgetDatesUseMondayFirstCalendarMapping() {
        val startDate = LocalDate.of(2026, 3, 1) // Sunday
        val data = HeatmapData(planStart = startDate, planDays = 365, dailyTasks = emptyMap())
        val visibleWeekStart = LocalDate.of(2026, 3, 2) // Monday

        assertEquals(2, data.dayNumberFor(visibleWeekStart))
        assertEquals(8, data.dayNumberFor(visibleWeekStart.plusDays(6)))
    }
}
