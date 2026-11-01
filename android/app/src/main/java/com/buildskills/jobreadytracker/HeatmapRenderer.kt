package com.buildskills.jobreadytracker

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.Bundle
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters
import java.util.Locale
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

internal object HeatmapRenderer {
    private const val ROWS = 7
    private const val MAX_WEEKS = 52

    private val LIGHT_COLORS = mapOf(
        HeatmapLevel.OUT to 0x00000000,
        HeatmapLevel.NONE to 0xFF26332D.toInt(),
        HeatmapLevel.PLANNED to 0xFF52697A.toInt(),
        HeatmapLevel.L0 to 0xFF9B6653.toInt(),
        HeatmapLevel.L1 to 0xFFA7D3B6.toInt(),
        HeatmapLevel.L2 to 0xFF55AF7C.toInt(),
        HeatmapLevel.L3 to 0xFF087A56.toInt(),
    )
    private val DARK_COLORS = mapOf(
        HeatmapLevel.OUT to 0x00000000,
        HeatmapLevel.NONE to 0xFF28362F.toInt(),
        HeatmapLevel.PLANNED to 0xFF30465A.toInt(),
        HeatmapLevel.L0 to 0xFF7D4937.toInt(),
        HeatmapLevel.L1 to 0xFF317354.toInt(),
        HeatmapLevel.L2 to 0xFF3D9C6D.toInt(),
        HeatmapLevel.L3 to 0xFF62E0A8.toInt(),
    )

    fun render(context: Context, data: HeatmapData, options: Bundle): Bitmap {
        val density = context.resources.displayMetrics.density
        val widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH).takeIf { it > 0 }
            ?: options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH).takeIf { it > 0 } ?: 110
        val heightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT).takeIf { it > 0 }
            ?: options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT).takeIf { it > 0 } ?: 40
        val width = max(1, (widthDp * density).roundToInt())
        val height = max(1, (heightDp * density).roundToInt())
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        // The lightly translucent tile gives cells enough contrast on busy launchers.
        val dark = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val inset = 4f * density
        val background = if (dark) 0x88111D18.toInt() else 0xB8F2F7F3.toInt()
        val backgroundRadius = min(11f * density, min(width, height) * 0.24f)
        paint.color = background
        paint.style = Paint.Style.FILL
        canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), backgroundRadius, backgroundRadius, paint)

        val gap = max(1f * density, 1f)
        val availableWidth = width - inset * 2
        val labelHeight = if (heightDp >= 48) 9f * density else 7f * density
        val availableHeight = height - inset * 2 - labelHeight
        if (availableWidth <= 0 || availableHeight <= 0) return bitmap

        val cellSize = (availableHeight - gap * (ROWS - 1)) / ROWS
        if (cellSize <= 0f) return bitmap
        val weeks = floor((availableWidth + gap) / (cellSize + gap)).toInt().coerceIn(1, MAX_WEEKS)
        val gridWidth = weeks * cellSize + (weeks - 1) * gap
        val gridHeight = ROWS * cellSize + (ROWS - 1) * gap
        val left = (width - gridWidth) / 2f
        val top = inset + labelHeight + max(0f, (availableHeight - gridHeight) / 2f)
        val radius = min(cellSize * 0.26f, 4f * density)
        val today = LocalDate.now()
        val firstDate = visibleWeekStart(today, weeks)
        val colors = if (dark) DARK_COLORS else LIGHT_COLORS
        val start = data.planStart

        val monthPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (dark) 0xB9E7F1EB.toInt() else 0xB9284939.toInt()
            textSize = 6.5f * density
            typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
        }
        var lastMonth: java.time.YearMonth? = null
        var lastLabelColumn = -4
        for (column in 0 until weeks) {
            val weekDate = firstDate.plusWeeks(column.toLong())
            // Put a month label on the column containing day 1, matching website PlanGlance.
            val monthDate = (0L..6L).map(weekDate::plusDays).firstOrNull { it.dayOfMonth == 1 } ?: weekDate
            val month = java.time.YearMonth.from(monthDate)
            if (month != lastMonth && column - lastLabelColumn >= 3) {
                val label = month.month.getDisplayName(java.time.format.TextStyle.SHORT, Locale.ENGLISH)
                canvas.drawText(label, left + column * (cellSize + gap), inset + monthPaint.textSize, monthPaint)
                lastLabelColumn = column
            }
            lastMonth = month
        }

        for (index in 0 until weeks * ROWS) {
            val column = index / ROWS
            val row = index % ROWS // Monday first, matching PlanGlance.
            val date = dateAt(firstDate, column, row)
            val dayNumber = data.dayNumberFor(date) ?: 0
            val level = if (start == null || data.planDays <= 0 || dayNumber < 1) {
                HeatmapLevel.NONE
            } else {
                data.levelForDay(dayNumber, today)
            }
            val x = left + column * (cellSize + gap)
            val y = top + row * (cellSize + gap)
            val rect = RectF(x, y, x + cellSize, y + cellSize)
            val color = colors[level] ?: colors.getValue(HeatmapLevel.NONE)
            if (color != 0) {
                paint.style = Paint.Style.FILL
                paint.color = color
                canvas.drawRoundRect(rect, radius, radius, paint)
            }
        }
        return bitmap
    }

    internal fun visibleWeekStart(today: LocalDate, weeks: Int): LocalDate =
        today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks((weeks.coerceAtLeast(1) - 1).toLong())

    /** Column zero starts at the first visible Monday; rows progress Monday through Sunday. */
    internal fun dateAt(firstMonday: LocalDate, column: Int, row: Int): LocalDate =
        firstMonday.plusDays(column * ROWS.toLong() + row)
}
