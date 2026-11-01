package com.buildskills.jobreadytracker

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.ValueCallback
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.firebase.auth.FirebaseAuth
import java.util.concurrent.Executors

/** Hosts the existing React app inside an in-app WebView with native status bar blending. */
class TrackerWebActivity : ComponentActivity() {
    private lateinit var root: FrameLayout
    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var navigationBarBackdrop: View
    private lateinit var progress: ProgressBar
    private lateinit var errorPanel: LinearLayout
    private var mainFrameFailed = false
    private val themedTextViews = mutableListOf<TextView>()
    private val themeHandler = Handler(Looper.getMainLooper())
    private val downloads by lazy { TrackerDownloads(this) }
    private var leavingToLogin = false

    // Native -> web sign-in hand-off (see NativeSso.kt). The flag remembers which account the WebView was already signed in as.
    private val ssoExecutor = Executors.newSingleThreadExecutor()
    private var ssoInFlight = false
    private val ssoPrefs by lazy { getSharedPreferences("native_sso", MODE_PRIVATE) }

    // If the native Firebase session ends (sign-out, revoked account), leave the WebView for the login screen.
    private val authStateListener = FirebaseAuth.AuthStateListener { auth ->
        if (auth.currentUser == null) returnToLogin()
    }

    // File upload: exactly one pending WebView callback at a time; it is always settled, with null on cancel.
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var fileChooserAccept: List<String> = emptyList()
    private val pickSingleFile = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        finishFileChooser(listOfNotNull(uri))
    }
    private val pickMultipleFiles = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        finishFileChooser(uris)
    }

    private val syncTheme = object : Runnable {
        override fun run() {
            if (!::webView.isInitialized || isFinishing) return
            // Read only the web theme preference. No JavaScript bridge or credentials are exposed.
            webView.evaluateJavascript("document.documentElement.dataset.theme || ''") { raw ->
                val mode = raw?.trim('"')
                val dark = when (mode) {
                    "dark" -> true
                    "light" -> false
                    else -> (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
                }
                applySystemBarTheme(dark)
            }
            themeHandler.postDelayed(this, THEME_POLL_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        buildScreen()
        val restored = savedInstanceState?.let { webView.restoreState(it) != null } ?: false
        if (!restored) startInitialLoad()
        ViewCompat.requestApplyInsets(root)

        // Android 16 / targetSdk 36 no longer calls onBackPressed(); back is handled through the dispatcher.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else showExitOptions()
            }
        })
        downloads.register()
        FirebaseAuth.getInstance().addAuthStateListener(authStateListener)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::webView.isInitialized) webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
        themeHandler.removeCallbacks(syncTheme)
        themeHandler.post(syncTheme)
    }

    override fun onPause() {
        themeHandler.removeCallbacks(syncTheme)
        if (::webView.isInitialized) webView.onPause()
        super.onPause()
    }

    private fun showExitOptions() {
        AlertDialog.Builder(this)
            .setTitle("Leave tracker?")
            .setMessage("You can close the tracker or sign out of the native app on this device.")
            .setNegativeButton("Stay", null)
            .setNeutralButton("Exit") { _, _ -> finish() }
            .setPositiveButton("Sign out") { _, _ -> signOutNativeAccount() }
            .show()
    }

    private fun signOutNativeAccount() {
        FirebaseAuth.getInstance().signOut()
        ssoPrefs.edit().remove(KEY_HANDED_OFF_UID).apply()
        HeatmapRefreshWork.cancelPeriodic(this)
        ActivityHeatmapWidgetProvider.widgetIds(this).forEach { widgetId ->
            ActivityHeatmapWidgetProvider.show(
                this,
                android.appwidget.AppWidgetManager.getInstance(this),
                widgetId,
                HeatmapData.empty(),
            )
        }
        returnToLogin()
    }

    private fun returnToLogin() {
        if (leavingToLogin || isFinishing) return
        leavingToLogin = true
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    override fun onDestroy() {
        FirebaseAuth.getInstance().removeAuthStateListener(authStateListener)
        downloads.unregister()
        ssoExecutor.shutdownNow()
        // Never leave a WebView file-chooser request unanswered.
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        themeHandler.removeCallbacksAndMessages(null)
        if (::webView.isInitialized) {
            (webView.parent as? android.view.ViewGroup)?.removeView(webView)
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildScreen() {
        val initialDark = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
        val pageBg = if (initialDark) DARK_BG else LIGHT_BG
        val ink = if (initialDark) DARK_INK else LIGHT_INK
        val muted = if (initialDark) DARK_MUTED else LIGHT_MUTED
        val line = if (initialDark) DARK_LINE else LIGHT_LINE
        val accent = if (initialDark) DARK_ACCENT else LIGHT_ACCENT

        root = FrameLayout(this).apply { setBackgroundColor(pageBg) }

        webView = WebView(this).apply {
            setBackgroundColor(pageBg)
            overScrollMode = View.OVER_SCROLL_NEVER
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = false
                allowFileAccess = false
                allowContentAccess = false
                allowFileAccessFromFileURLs = false
                allowUniversalAccessFromFileURLs = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                userAgentString = "$userAgentString JobReadyTrackerAndroidWebView"
                javaScriptCanOpenWindowsAutomatically = false
                setSupportMultipleWindows(false)
                cacheMode = WebSettings.LOAD_DEFAULT
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) safeBrowsingEnabled = true
            }
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            webViewClient = trackerWebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onProgressChanged(view: WebView, newProgress: Int) {
                    this@TrackerWebActivity.progress.progress = newProgress
                    this@TrackerWebActivity.progress.visibility = if (newProgress >= 100 || mainFrameFailed) View.GONE else View.VISIBLE
                }

                override fun onShowFileChooser(
                    view: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: WebChromeClient.FileChooserParams?,
                ): Boolean = this@TrackerWebActivity.showFileChooser(view?.url, filePathCallback, fileChooserParams)
            }
            setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
                downloads.onDownloadStart(url, userAgent, contentDisposition, mimeType)
            }
        }
        // Pull down from the top of the page to reload it.
        swipeRefresh = SwipeRefreshLayout(this).apply {
            setColorSchemeColors(accent)
            setProgressBackgroundColorSchemeColor(if (initialDark) DARK_SURFACE else LIGHT_SURFACE)
            setDistanceToTriggerSync(dp(120))
            setOnRefreshListener { reloadPage() }
            addView(webView, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        root.addView(swipeRefresh, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

        // Continue the site's bottom-nav surface behind Android's gesture/navigation area.
        // The WebView itself stops at that inset, so no website controls sit under the system bar.
        val navigationSurface = if (initialDark) DARK_SURFACE else LIGHT_SURFACE
        navigationBarBackdrop = View(this).apply { setBackgroundColor(navigationSurface) }
        root.addView(navigationBarBackdrop, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.BOTTOM))

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progressTintList = android.content.res.ColorStateList.valueOf(accent)
            progressBackgroundTintList = android.content.res.ColorStateList.valueOf(line)
            visibility = View.VISIBLE
            contentDescription = "Loading tracker"
        }
        root.addView(progress, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(3)))

        errorPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(28), dp(24), dp(28), dp(24))
            setBackgroundColor(pageBg)
            visibility = View.GONE
            addView(themedLabel("Can't load the tracker", ink, 21f, true).apply {
                gravity = Gravity.CENTER
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            addView(themedLabel("Check your internet connection, then try again.", muted, 14f, false).apply {
                gravity = Gravity.CENTER
                setPadding(0, dp(8), 0, dp(18))
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            addView(Button(this@TrackerWebActivity).apply {
                text = "Retry"
                isAllCaps = false
                setTextColor(Color.WHITE)
                backgroundTintList = android.content.res.ColorStateList.valueOf(accent)
                setOnClickListener {
                    mainFrameFailed = false
                    errorPanel.visibility = View.GONE
                    webView.visibility = View.VISIBLE
                    progress.visibility = View.VISIBLE
                    webView.loadUrl(TRACKER_URL)
                }
            }, LinearLayout.LayoutParams(dp(160), dp(48)))
        }
        root.addView(errorPanel, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val navigationBars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            val cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            val left = maxOf(bars.left, cutout.left)
            val right = maxOf(bars.right, cutout.right)
            val top = maxOf(bars.top, cutout.top)
            val bottom = maxOf(bars.bottom, cutout.bottom, if (imeVisible) ime.bottom else 0)
            val navigationBottom = maxOf(navigationBars.bottom, cutout.bottom)

            (navigationBarBackdrop.layoutParams as FrameLayout.LayoutParams).apply {
                height = navigationBottom
                leftMargin = left
                rightMargin = right
                navigationBarBackdrop.layoutParams = this
            }

            (progress.layoutParams as FrameLayout.LayoutParams).apply {
                topMargin = top
                leftMargin = left
                rightMargin = right
                progress.layoutParams = this
            }

            (swipeRefresh.layoutParams as FrameLayout.LayoutParams).apply {
                topMargin = top
                bottomMargin = bottom
                leftMargin = left
                rightMargin = right
                swipeRefresh.layoutParams = this
            }

            (errorPanel.layoutParams as FrameLayout.LayoutParams).apply {
                topMargin = top
                bottomMargin = bottom
                leftMargin = left
                rightMargin = right
                errorPanel.layoutParams = this
            }

            insets
        }

        setContentView(root)
        applySystemBarTheme(initialDark)
    }

    private fun trackerWebViewClient() = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = routeNavigation(view, request.url)

        @Suppress("DEPRECATION")
        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = routeNavigation(view, Uri.parse(url))

        override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
            mainFrameFailed = false
            errorPanel.visibility = View.GONE
            view.visibility = View.VISIBLE
            progress.progress = 0
            progress.visibility = View.VISIBLE
        }

        override fun onPageFinished(view: WebView, url: String?) {
            if (!mainFrameFailed) progress.visibility = View.GONE
            swipeRefresh.isRefreshing = false
            // The one-time-code page replaces itself once signed in; drop the history before it so Back
            // doesn't return to the login screen.
            val page = url?.let { Uri.parse(it) }
            if (page?.host == TrackerWebNavigation.TRUSTED_HOST && page?.path == NativeSso.CALLBACK_PATH) view.clearHistory()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) showLoadError()
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
            if (request.isForMainFrame && response.statusCode >= 500) showLoadError()
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: android.net.http.SslError) {
            handler.cancel()
            showLoadError()
        }
    }

    private fun routeNavigation(view: WebView, uri: Uri): Boolean = when (TrackerWebNavigation.classify(uri.toString())) {
        TrackerLinkTarget.IN_APP -> false
        // Google refuses OAuth inside a WebView, so the page is never sent there. The account already signed in
        // natively is handed to the page with a one-time code instead.
        TrackerLinkTarget.GOOGLE_AUTH, TrackerLinkTarget.BROWSER_GOOGLE_SIGN_IN -> {
            view.stopLoading()
            startNativeSsoHandoff(initialLoad = false)
            true
        }
        TrackerLinkTarget.EXTERNAL_HTTPS -> {
            openExternal(uri)
            true
        }
        TrackerLinkTarget.BLOCK -> {
            Toast.makeText(this, "This link isn't available in the in-app tracker.", Toast.LENGTH_SHORT).show()
            true
        }
    }

    private fun startInitialLoad() {
        val uid = FirebaseAuth.getInstance().currentUser?.uid
        // First open for this account: sign the page in before it shows a login form. Later opens reuse the
        // WebView's own persisted session.
        if (uid != null && ssoPrefs.getString(KEY_HANDED_OFF_UID, null) != uid) {
            startNativeSsoHandoff(initialLoad = true)
        } else {
            webView.loadUrl(TRACKER_URL)
        }
    }

    private fun startNativeSsoHandoff(initialLoad: Boolean) {
        val user = FirebaseAuth.getInstance().currentUser
        if (user == null) {
            returnToLogin()
            return
        }
        if (ssoInFlight) return
        ssoInFlight = true
        progress.visibility = View.VISIBLE
        val uid = user.uid
        user.getIdToken(false).addOnCompleteListener { task ->
            if (isFinishing || isDestroyed) {
                ssoInFlight = false
                return@addOnCompleteListener
            }
            val token = if (task.isSuccessful) task.result?.token else null
            if (token.isNullOrEmpty()) {
                finishNativeSsoHandoff(SsoResult.Failure(SsoFailure.NETWORK), uid, initialLoad)
                return@addOnCompleteListener
            }
            // The ID token only travels inside this HTTPS request; it is never given to the page.
            ssoExecutor.execute {
                val result = NativeSsoClient.requestCode(token)
                runOnUiThread { finishNativeSsoHandoff(result, uid, initialLoad) }
            }
        }
    }

    private fun finishNativeSsoHandoff(result: SsoResult, uid: String, initialLoad: Boolean) {
        ssoInFlight = false
        if (isFinishing || isDestroyed) return
        when (result) {
            is SsoResult.Code -> {
                ssoPrefs.edit().putString(KEY_HANDED_OFF_UID, uid).apply()
                mainFrameFailed = false
                errorPanel.visibility = View.GONE
                webView.visibility = View.VISIBLE
                webView.loadUrl(NativeSso.callbackUrl(result.code))
            }
            is SsoResult.Failure -> {
                progress.visibility = View.GONE
                if (initialLoad) {
                    // Quiet fallback: open the page normally (Email/Password still works there).
                    webView.loadUrl(TRACKER_URL)
                } else {
                    Toast.makeText(this, ssoFailureMessage(result.reason), Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun ssoFailureMessage(reason: SsoFailure): String = when (reason) {
        SsoFailure.UNAUTHORIZED -> "Your app session needs a fresh sign-in. Sign out from the app menu and log in again."
        SsoFailure.BACKEND_UNAVAILABLE -> "Secure sign-in isn't available yet. Please try again later."
        SsoFailure.NETWORK -> "Check your internet connection and try again."
        SsoFailure.UNEXPECTED -> "Secure sign-in failed. Please try again."
    }

    private fun reloadPage() {
        mainFrameFailed = false
        errorPanel.visibility = View.GONE
        webView.visibility = View.VISIBLE
        // The one-time-code page can't be reloaded (its code is already used), so go to the tracker instead.
        val currentPath = webView.url?.let { Uri.parse(it).path }
        if (currentPath == NativeSso.CALLBACK_PATH) webView.loadUrl(TRACKER_URL) else webView.reload()
        // Safety net: never leave the spinner stuck if the page never reports finishing.
        swipeRefresh.postDelayed({ swipeRefresh.isRefreshing = false }, 15_000)
    }

    private fun showFileChooser(
        pageUrl: String?,
        callback: ValueCallback<Array<Uri>>?,
        params: WebChromeClient.FileChooserParams?,
    ): Boolean {
        if (callback == null) return false
        // A new request settles any older one first; WebView stops offering the chooser if a callback is left hanging.
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        val trustedPage = pageUrl != null && TrackerWebNavigation.classify(pageUrl) == TrackerLinkTarget.IN_APP
        if (!trustedPage || params?.mode == WebChromeClient.FileChooserParams.MODE_SAVE) {
            callback.onReceiveValue(null)
            return true
        }
        val accept = TrackerUploads.normalize(params?.acceptTypes)
        fileChooserCallback = callback
        fileChooserAccept = accept
        val mimeTypes = TrackerUploads.pickerMimeTypes(accept)
        try {
            // System document picker: no storage permission needed.
            if (params?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) pickMultipleFiles.launch(mimeTypes)
            else pickSingleFile.launch(mimeTypes)
        } catch (_: Exception) {
            fileChooserCallback = null
            callback.onReceiveValue(null)
            Toast.makeText(this, "No file picker is available on this device.", Toast.LENGTH_LONG).show()
        }
        return true
    }

    private fun finishFileChooser(picked: List<Uri>) {
        val callback = fileChooserCallback ?: return
        fileChooserCallback = null
        // Only content:// URIs from the picker are passed on, and each file is re-checked against the page's accept list.
        val allowed = picked.filter { it.scheme == "content" && matchesAccept(it) }
        if (picked.isNotEmpty() && allowed.size < picked.size) {
            Toast.makeText(this, "Some files were skipped because their type isn't accepted here.", Toast.LENGTH_LONG).show()
        }
        callback.onReceiveValue(if (allowed.isEmpty()) null else allowed.toTypedArray())
    }

    private fun matchesAccept(uri: Uri): Boolean {
        val accept = fileChooserAccept
        if (accept.isEmpty()) return true
        val name = runCatching {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            }
        }.getOrNull()
        val mime = runCatching { contentResolver.getType(uri) }.getOrNull()
        return TrackerUploads.matches(accept, mime, name)
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: Exception) {
            Toast.makeText(this, "No browser is available to open this link.", Toast.LENGTH_LONG).show()
        }
    }

    private fun showLoadError() {
        mainFrameFailed = true
        swipeRefresh.isRefreshing = false
        progress.visibility = View.GONE
        webView.visibility = View.GONE
        errorPanel.visibility = View.VISIBLE
    }

    private fun applySystemBarTheme(dark: Boolean) {
        val background = if (dark) DARK_BG else LIGHT_BG
        val ink = if (dark) DARK_INK else LIGHT_INK
        navigationBarBackdrop.setBackgroundColor(if (dark) DARK_SURFACE else LIGHT_SURFACE)
        val accent = if (dark) DARK_ACCENT else LIGHT_ACCENT
        val line = if (dark) DARK_LINE else LIGHT_LINE

        root.setBackgroundColor(background)
        errorPanel.setBackgroundColor(background)
        webView.setBackgroundColor(background)

        themedTextViews.forEach { it.setTextColor(ink) }
        progress.progressTintList = android.content.res.ColorStateList.valueOf(accent)
        progress.progressBackgroundTintList = android.content.res.ColorStateList.valueOf(line)
        swipeRefresh.setColorSchemeColors(accent)
        swipeRefresh.setProgressBackgroundColorSchemeColor(if (dark) DARK_SURFACE else LIGHT_SURFACE)

        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = !dark
            isAppearanceLightNavigationBars = !dark
        }
    }

    private fun themedLabel(text: String, color: Int, size: Float, medium: Boolean) = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(color)
        if (medium) typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        themedTextViews += this
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    companion object {
        private const val TRACKER_URL = "https://${TrackerWebNavigation.TRUSTED_HOST}/"
        private const val KEY_HANDED_OFF_UID = "handed_off_uid"
        private const val THEME_POLL_MS = 900L
        private val DARK_BG = Color.rgb(7, 43, 33)      // #072b21 matching web app header
        private val DARK_SURFACE = Color.rgb(23, 34, 29)
        private val DARK_INK = Color.rgb(231, 241, 235)
        private val DARK_MUTED = Color.rgb(161, 179, 168)
        private val DARK_LINE = Color.rgb(43, 59, 50)
        private val DARK_ACCENT = Color.rgb(85, 213, 165)
        private val LIGHT_BG = Color.rgb(245, 247, 246)
        private val LIGHT_SURFACE = Color.WHITE
        private val LIGHT_INK = Color.rgb(23, 43, 37)
        private val LIGHT_MUTED = Color.rgb(113, 128, 120)
        private val LIGHT_LINE = Color.rgb(229, 235, 231)
        private val LIGHT_ACCENT = Color.rgb(11, 122, 91)
    }
}
