package com.buildskills.jobreadytracker

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.widget.Toast
import androidx.core.content.ContextCompat

internal enum class DownloadKind { HTTPS, BLOB, DATA, UNSUPPORTED }

internal fun classifyDownloadUrl(url: String?): DownloadKind {
    val lower = url?.trim()?.lowercase().orEmpty()
    return when {
        lower.startsWith("https://") -> DownloadKind.HTTPS
        lower.startsWith("blob:") -> DownloadKind.BLOB
        lower.startsWith("data:") -> DownloadKind.DATA
        else -> DownloadKind.UNSUPPORTED
    }
}

/** Keeps a server-suggested name usable as a single file name: no separators, control or reserved characters. */
internal fun safeDownloadFileName(raw: String?): String {
    val cleaned = raw.orEmpty()
        .replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), "_")
        .trim()
        .trimStart('.')
    return cleaned.ifBlank { "download" }
}

/**
 * Plain https downloads go to the system DownloadManager (cookies and user-agent forwarded, system notification).
 * blob: and data: exports are deliberately NOT handled yet: that needs the web app's export code and a vetted
 * bridge, so they only show a message.
 */
internal class TrackerDownloads(private val context: Context) {
    private val manager by lazy { context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager }
    private val enqueued = mutableSetOf<Long>()
    private var registered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(receiverContext: Context, intent: Intent) {
            if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
            val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
            // Only react to downloads this screen started; the real result is read back from DownloadManager.
            if (!enqueued.remove(id)) return
            showResult(id)
        }
    }

    fun register() {
        if (registered) return
        // DownloadManager's completion broadcast comes from another app, so the receiver must be exported.
        ContextCompat.registerReceiver(
            context,
            receiver,
            IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_EXPORTED,
        )
        registered = true
    }

    fun unregister() {
        if (!registered) return
        registered = false
        runCatching { context.unregisterReceiver(receiver) }
    }

    fun onDownloadStart(url: String?, userAgent: String?, contentDisposition: String?, mimeType: String?) {
        when (classifyDownloadUrl(url)) {
            DownloadKind.HTTPS -> enqueue(url.orEmpty(), userAgent, contentDisposition, mimeType)
            DownloadKind.BLOB, DownloadKind.DATA -> toast("Saving this kind of export isn't supported in the app yet.")
            DownloadKind.UNSUPPORTED -> toast("This download can't be saved from the app.")
        }
    }

    private fun enqueue(url: String, userAgent: String?, contentDisposition: String?, mimeType: String?) {
        val fileName = safeDownloadFileName(URLUtil.guessFileName(url, contentDisposition, mimeType))
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle(fileName)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        mimeType?.takeIf { it.isNotBlank() }?.let { request.setMimeType(it) }
        userAgent?.takeIf { it.isNotBlank() }?.let { request.addRequestHeader("User-Agent", it) }
        // CookieManager returns only the cookies that belong to this exact URL.
        CookieManager.getInstance().getCookie(url)?.takeIf { it.isNotBlank() }?.let { request.addRequestHeader("Cookie", it) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Public Downloads folder needs no storage permission through DownloadManager on Android 10+.
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
        } else {
            // Android 7-9 would need WRITE_EXTERNAL_STORAGE for the public folder; use the app's own folder instead.
            request.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, fileName)
        }
        try {
            enqueued += manager.enqueue(request)
            toast("Downloading $fileName")
        } catch (_: Exception) {
            toast("Couldn't start the download.")
        }
    }

    private fun showResult(id: Long) {
        val outcome = manager.query(DownloadManager.Query().setFilterById(id))?.use { cursor ->
            if (cursor.moveToFirst()) {
                cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) to
                    cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TITLE))
            } else null
        } ?: return
        val (status, title) = outcome
        toast(
            if (status == DownloadManager.STATUS_SUCCESSFUL) "Download finished: $title (see Downloads)"
            else "Download failed: $title"
        )
    }

    private fun toast(message: String) = Toast.makeText(context, message, Toast.LENGTH_LONG).show()
}
