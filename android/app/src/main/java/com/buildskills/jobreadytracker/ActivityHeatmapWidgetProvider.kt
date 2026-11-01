package com.buildskills.jobreadytracker

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.RemoteViews
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.android.gms.tasks.Tasks
import java.util.concurrent.TimeUnit

class ActivityHeatmapWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { show(context, manager, it, HeatmapData.empty()) }
        HeatmapRefreshWork.refresh(context)
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, newOptions: Bundle) {
        super.onAppWidgetOptionsChanged(context, manager, id, newOptions)
        show(context, manager, id, HeatmapData.empty())
        HeatmapRefreshWork.refresh(context)
    }

    override fun onEnabled(context: Context) {
        HeatmapRefreshWork.schedulePeriodic(context)
        HeatmapRefreshWork.refresh(context)
    }

    override fun onDisabled(context: Context) {
        HeatmapRefreshWork.cancelPeriodic(context)
    }

    companion object {
        internal fun show(context: Context, manager: AppWidgetManager, widgetId: Int, data: HeatmapData) {
            val views = RemoteViews(context.packageName, R.layout.activity_heatmap_widget)
            views.setImageViewBitmap(R.id.heatmap_image, HeatmapRenderer.render(context, data, manager.getAppWidgetOptions(widgetId)))
            val open = Intent(context, MainActivity::class.java)
            val pending = PendingIntent.getActivity(
                context,
                widgetId,
                open,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.heatmap_image, pending)
            manager.updateAppWidget(widgetId, views)
        }

        internal fun widgetIds(context: Context): IntArray = AppWidgetManager.getInstance(context)
            .getAppWidgetIds(ComponentName(context, ActivityHeatmapWidgetProvider::class.java))

        internal fun readData(): HeatmapData {
            val user = FirebaseAuth.getInstance().currentUser ?: return HeatmapData.empty()
            val snapshot = Tasks.await(
                FirebaseFirestore.getInstance()
                    .collection("users").document(user.uid)
                    .collection("tracker").document("main")
                    .get(),
                20,
                TimeUnit.SECONDS,
            )
            return HeatmapData.from(snapshot)
        }

    }
}
