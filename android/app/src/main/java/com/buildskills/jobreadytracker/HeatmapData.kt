package com.buildskills.jobreadytracker

import com.google.firebase.firestore.DocumentSnapshot
import java.time.LocalDate
import java.time.temporal.ChronoUnit

internal enum class HeatmapLevel {
    OUT,       // Day > duration (outside the plan)
    NONE,      // No tasks scheduled for this day
    PLANNED,   // Future day with scheduled tasks
    L0,        // Past/today day with tasks, but 0 completed
    L1,        // Past/today day with < 50% completed
    L2,        // Past/today day with >= 50% completed
    L3         // Past/today day with 100% completed
}

internal data class DayInfo(
    val total: Int,
    val done: Int
)

internal data class HeatmapData(
    val planStart: LocalDate?,
    val planDays: Int,
    val dailyTasks: Map<Int, DayInfo>
) {
    /** Matches the website's 1-based day number for a real calendar date. */
    fun dayNumberFor(date: LocalDate): Int? = planStart?.let { ChronoUnit.DAYS.between(it, date).toInt() + 1 }

    companion object {
        fun empty() = HeatmapData(null, 0, emptyMap())

        fun from(snapshot: DocumentSnapshot): HeatmapData {
            if (!snapshot.exists()) return empty()
            val settings = snapshot.get("settings") as? Map<*, *> ?: return empty()
            val startStr = settings["startDate"] as? String
            val start = startStr?.let {
                runCatching { LocalDate.parse(it) }.getOrNull()
            }
            val duration = (settings["durationDays"] as? Number)?.toInt()?.coerceIn(1, 365) ?: 0
            val daysMap = snapshot.get("days") as? Map<*, *> ?: emptyMap<Any, Any>()

            val dailyTasks = mutableMapOf<Int, DayInfo>()
            daysMap.forEach { (dayKey, rawRecord) ->
                val dayNum = dayKey.toString().toIntOrNull() ?: return@forEach
                val dayRecord = rawRecord as? Map<*, *> ?: return@forEach
                val taskList = (dayRecord["tasks"] as? List<*>)
                    ?.mapNotNull { it as? Map<*, *> }
                    ?.filter { it["status"] != "skipped" }
                    .orEmpty()
                val total = taskList.size
                val done = taskList.count { it["status"] == "completed" }
                if (total > 0) {
                    dailyTasks[dayNum] = DayInfo(total, done)
                }
            }

            return HeatmapData(start, duration, dailyTasks)
        }
    }

    /** Returns today's 1-based roadmap day number. */
    fun currentRoadmapDay(today: LocalDate = LocalDate.now()): Int {
        val start = planStart ?: return 0
        return ChronoUnit.DAYS.between(start, today).toInt() + 1
    }

    /** Determines heatmap level for a given 1-based roadmap day. */
    fun levelForDay(day: Int, today: LocalDate = LocalDate.now()): HeatmapLevel {
        if (day > planDays) return HeatmapLevel.OUT
        val info = dailyTasks[day]
        if (info == null || info.total == 0) return HeatmapLevel.NONE
        val currentDay = currentRoadmapDay(today)
        if (day > currentDay) return HeatmapLevel.PLANNED
        if (info.done == 0) return HeatmapLevel.L0
        if (info.done == info.total) return HeatmapLevel.L3
        val ratio = info.done.toFloat() / info.total
        return if (ratio >= 0.5f) HeatmapLevel.L2 else HeatmapLevel.L1
    }
}
