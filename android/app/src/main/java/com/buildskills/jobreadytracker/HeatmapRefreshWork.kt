package com.buildskills.jobreadytracker

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import android.appwidget.AppWidgetManager
import java.util.concurrent.TimeUnit

internal object HeatmapRefreshWork {
    private const val PERIODIC_NAME = "activity-heatmap-periodic-refresh"
    private const val ONE_TIME_NAME = "activity-heatmap-refresh"

    fun refresh(context: Context) {
        val request = OneTimeWorkRequestBuilder<HeatmapRefreshWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(ONE_TIME_NAME, ExistingWorkPolicy.REPLACE, request)
    }

    fun schedulePeriodic(context: Context) {
        val request = PeriodicWorkRequestBuilder<HeatmapRefreshWorker>(1, TimeUnit.HOURS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    fun cancelPeriodic(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_NAME)
        WorkManager.getInstance(context).cancelUniqueWork(ONE_TIME_NAME)
    }
}

class HeatmapRefreshWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val manager = AppWidgetManager.getInstance(applicationContext)
        val ids = ActivityHeatmapWidgetProvider.widgetIds(applicationContext)
        if (ids.isEmpty()) return Result.success()
        val data = try {
            ActivityHeatmapWidgetProvider.readData()
        } catch (error: Exception) {
            Log.w("TrackerHeatmap", "Widget refresh unavailable (${error.javaClass.simpleName})")
            HeatmapData.empty()
        }
        ids.forEach { ActivityHeatmapWidgetProvider.show(applicationContext, manager, it, data) }
        return Result.success()
    }
}
