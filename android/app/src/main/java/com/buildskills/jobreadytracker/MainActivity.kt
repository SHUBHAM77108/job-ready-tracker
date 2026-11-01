package com.buildskills.jobreadytracker

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.UserProfileChangeRequest
import kotlin.math.min
import kotlin.math.roundToInt

class MainActivity : Activity() {
    private lateinit var auth: FirebaseAuth
    private lateinit var name: EditText
    private lateinit var email: EditText
    private lateinit var password: EditText
    private lateinit var nameLabel: TextView
    private lateinit var emailLabel: TextView
    private lateinit var passwordLabel: TextView
    private lateinit var status: TextView
    private lateinit var loginButton: Button
    private lateinit var googleButton: Button
    private lateinit var progress: ProgressBar
    private lateinit var loginTab: Button
    private lateinit var signupTab: Button
    private lateinit var forgotButton: Button
    private lateinit var loginScroll: ScrollView
    private lateinit var startupProgress: ProgressBar
    private lateinit var authStateListener: FirebaseAuth.AuthStateListener
    private var isSignup = false
    private var initialAuthStateResolved = false
    private var trackerLaunchStarted = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        auth = FirebaseAuth.getInstance()
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        // A restored native session goes straight to the tracker: no login UI is built and no landing screen shows.
        if (auth.currentUser != null && launchTracker()) return
        // Otherwise (signed out, or Firebase still restoring its session) wait for the first auth callback;
        // the login form only appears once that callback confirms there is no user.
        buildScreen()
        authStateListener = FirebaseAuth.AuthStateListener { firebaseAuth ->
            onNativeAuthStateChanged(firebaseAuth.currentUser != null)
        }
        auth.addAuthStateListener(authStateListener)
    }

    override fun onDestroy() {
        if (::authStateListener.isInitialized) auth.removeAuthStateListener(authStateListener)
        super.onDestroy()
    }

    private fun buildScreen() {
        val dark = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
        val bg = if (dark) Color.rgb(16, 25, 22) else Color.rgb(245, 247, 246)
        val surface = if (dark) Color.rgb(23, 34, 29) else Color.WHITE
        val fieldBg = if (dark) bg else Color.rgb(245, 247, 246)
        val ink = if (dark) Color.rgb(231, 241, 235) else Color.rgb(23, 43, 37)
        val muted = if (dark) Color.rgb(161, 179, 168) else Color.rgb(113, 128, 120)
        val line = if (dark) Color.rgb(43, 59, 50) else Color.rgb(229, 235, 231)
        val green = if (dark) Color.rgb(85, 213, 165) else Color.rgb(11, 122, 91)

        window.statusBarColor = bg
        window.navigationBarColor = bg
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = !dark
            isAppearanceLightNavigationBars = !dark
        }

        loginScroll = ScrollView(this).apply { isFillViewport = true; clipToPadding = false; setBackgroundColor(bg); visibility = View.GONE }
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(16), dp(16), dp(16), dp(20))
            setBackgroundColor(bg)
        }
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(22), dp(20), dp(20))
            background = rounded(surface, 24, line)
        }
        page.addView(card, LinearLayout.LayoutParams(min(dp(440), resources.displayMetrics.widthPixels - dp(32)), LinearLayout.LayoutParams.WRAP_CONTENT).apply { gravity = Gravity.CENTER })

        val brand = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        brand.addView(ImageView(this).apply {
            setImageResource(R.drawable.plan_glance_login)
            contentDescription = "Job-Ready Tracker logo"
            scaleType = ImageView.ScaleType.FIT_CENTER
        }, LinearLayout.LayoutParams(dp(96), dp(48)).apply { rightMargin = dp(10) })
        brand.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(label("Job-Ready", 16f, ink, true), matchWrap())
            addView(label("Tracker", 12f, muted, false), matchWrap())
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        card.addView(brand, matchWrap().apply { bottomMargin = dp(16) })

        val heading = label("Welcome back", 30f, ink, true)
        card.addView(heading, matchWrap())
        val lede = label("Pick up right where you left off — on any device.", 14f, muted, false)
        card.addView(lede, matchWrap().apply { bottomMargin = dp(16) })

        val tabs = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(4), dp(4), dp(4), dp(4))
            background = rounded(if (dark) Color.rgb(27, 47, 38) else Color.rgb(240, 247, 243), 11, line)
        }
        loginTab = tabButton("Login", surface, ink, line) { selectMode(false, heading, lede, surface, ink, muted) }
        signupTab = tabButton("Sign up", Color.TRANSPARENT, muted, null) { selectMode(true, heading, lede, surface, ink, muted) }
        tabs.addView(loginTab, LinearLayout.LayoutParams(0, dp(38), 1f))
        tabs.addView(signupTab, LinearLayout.LayoutParams(0, dp(38), 1f))
        card.addView(tabs, matchWrap().apply { bottomMargin = dp(14) })

        googleButton = button("Continue with Google", surface, ink, line) { signInWithGoogle() }.apply {
            compoundDrawablePadding = dp(9)
            setCompoundDrawablesWithIntrinsicBounds(R.drawable.ic_google_g, 0, 0, 0)
        }
        card.addView(googleButton, buttonParams().apply { bottomMargin = dp(8) })

        val divider = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        divider.addView(View(this).apply { setBackgroundColor(line) }, LinearLayout.LayoutParams(0, dp(1), 1f))
        divider.addView(label("or with email", 12f, muted, false).apply { gravity = Gravity.CENTER }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(10); rightMargin = dp(10) })
        divider.addView(View(this).apply { setBackgroundColor(line) }, LinearLayout.LayoutParams(0, dp(1), 1f))
        card.addView(divider, matchWrap().apply { bottomMargin = dp(12); topMargin = dp(2) })

        nameLabel = fieldLabel("Full name", muted)
        nameLabel.visibility = View.GONE
        card.addView(nameLabel, matchWrap().apply { bottomMargin = dp(5) })
        name = editField("Your name", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PERSON_NAME, ink, muted, fieldBg, line, green).apply {
            visibility = View.GONE
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) setAutofillHints(View.AUTOFILL_HINT_NAME)
        }
        card.addView(name, fieldParams().apply { bottomMargin = dp(10) })

        emailLabel = fieldLabel("Email", muted)
        card.addView(emailLabel, matchWrap().apply { bottomMargin = dp(5) })
        email = editField("you@example.com", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, ink, muted, fieldBg, line, green).apply {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) setAutofillHints(View.AUTOFILL_HINT_EMAIL_ADDRESS)
        }
        card.addView(email, fieldParams().apply { bottomMargin = dp(10) })

        passwordLabel = fieldLabel("Password", muted)
        card.addView(passwordLabel, matchWrap().apply { bottomMargin = dp(5) })
        password = editField("At least 6 characters", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD, ink, muted, fieldBg, line, green).apply {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) setAutofillHints(View.AUTOFILL_HINT_PASSWORD)
        }
        val passwordRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; background = rounded(fieldBg, 9, line) }
        password.background = null
        password.setOnFocusChangeListener(null)
        passwordRow.addView(password, LinearLayout.LayoutParams(0, dp(46), 1f))
        val showPassword = button("Show", Color.TRANSPARENT, green, null) {}.apply {
            minHeight = dp(40); textSize = 12f; setPadding(0, 0, dp(8), 0)
            setOnClickListener {
                val visible = password.inputType == (InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
                password.inputType = if (visible) InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD else InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                password.setSelection(password.text.length)
                text = if (visible) "Hide" else "Show"
            }
        }
        passwordRow.addView(showPassword, LinearLayout.LayoutParams(dp(58), dp(46)))
        password.setOnFocusChangeListener { _, focused -> passwordRow.background = rounded(fieldBg, 9, if (focused) green else line) }
        card.addView(passwordRow, fieldParams().apply { bottomMargin = dp(6) })

        forgotButton = button("Forgot password?", Color.TRANSPARENT, green, null) { resetPassword() }.apply {
            gravity = Gravity.START or Gravity.CENTER_VERTICAL
            textSize = 12f
            minHeight = dp(34)
            setPadding(0, 0, 0, 0)
        }
        status = label("", 13f, Color.rgb(186, 51, 39), false).apply {
            setPadding(dp(11), dp(9), dp(11), dp(9))
            background = rounded(if (dark) Color.rgb(67, 35, 31) else Color.rgb(255, 240, 237), 9, if (dark) Color.rgb(113, 65, 54) else Color.rgb(242, 201, 193))
            visibility = View.GONE
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        card.addView(status, matchWrap().apply { bottomMargin = dp(8) })
        progress = ProgressBar(this).apply { visibility = View.GONE; indeterminateTintList = android.content.res.ColorStateList.valueOf(green) }
        card.addView(progress, LinearLayout.LayoutParams(dp(24), dp(24)).apply { gravity = Gravity.CENTER; bottomMargin = dp(7) })

        loginButton = button("Login", green, Color.WHITE, null) { submit(isSignup) }
        card.addView(loginButton, buttonParams().apply { bottomMargin = dp(10) })
        card.addView(forgotButton, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(34)).apply { bottomMargin = dp(5) })

        card.addView(label("Your progress stays yours — synced to your account.", 11f, muted, false), matchWrap().apply { topMargin = dp(7) })

        loginScroll.addView(page)
        ViewCompat.setOnApplyWindowInsetsListener(loginScroll) { view, insets ->
            val safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
            insets
        }
        val root = FrameLayout(this).apply { setBackgroundColor(bg) }
        root.addView(loginScroll, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        startupProgress = ProgressBar(this).apply { indeterminateTintList = android.content.res.ColorStateList.valueOf(green) }
        root.addView(startupProgress, FrameLayout.LayoutParams(dp(36), dp(36), Gravity.CENTER))
        setContentView(root)
    }

    private fun selectMode(signup: Boolean, heading: TextView, lede: TextView, surface: Int, ink: Int, muted: Int) {
        isSignup = signup
        heading.text = if (signup) "Create your account" else "Welcome back"
        lede.text = if (signup) "Start tracking your learning, projects and applications." else "Pick up right where you left off — on any device."
        nameLabel.visibility = if (signup) View.VISIBLE else View.GONE
        name.visibility = if (signup) View.VISIBLE else View.GONE
        forgotButton.visibility = if (signup) View.GONE else View.VISIBLE
        loginButton.text = if (signup) "Create account" else "Login"
        loginTab.background = rounded(if (signup) Color.TRANSPARENT else surface, 8)
        loginTab.setTextColor(if (signup) muted else ink)
        signupTab.background = rounded(if (signup) surface else Color.TRANSPARENT, 8)
        signupTab.setTextColor(if (signup) ink else muted)
        status.visibility = View.GONE
    }

    private fun onNativeAuthStateChanged(signedIn: Boolean) {
        if (!initialAuthStateResolved) {
            initialAuthStateResolved = true
            startupProgress.visibility = View.GONE
        }
        if (!signedIn) {
            trackerLaunchStarted = false
            loginScroll.visibility = View.VISIBLE
            return
        }
        loginScroll.visibility = View.GONE
        launchTracker()
    }

    private fun launchTracker(): Boolean {
        HeatmapRefreshWork.schedulePeriodic(this)
        HeatmapRefreshWork.refresh(this)
        return openTrackerWeb()
    }

    /** Returns true when the tracker screen was started. Touches the login UI only if it was built. */
    private fun openTrackerWeb(): Boolean {
        if (trackerLaunchStarted || isFinishing || isDestroyed || auth.currentUser == null) return false
        trackerLaunchStarted = true
        return try {
            startActivity(Intent(this, TrackerWebActivity::class.java))
            finish()
            true
        } catch (error: Exception) {
            trackerLaunchStarted = false
            if (::loginScroll.isInitialized) {
                loginScroll.visibility = View.VISIBLE
                showError("Could not open the in-app tracker. Please try again.")
            }
            false
        }
    }

    private fun submit(createAccount: Boolean) {
        val address = email.text.toString().trim()
        val secret = password.text.toString()
        val displayName = name.text.toString().trim()
        if (createAccount && displayName.isBlank()) { showError("Please enter your full name."); return }
        if (address.isBlank() || secret.isBlank()) { showError("Enter your email and password."); return }
        setBusy(true)
        val task = if (createAccount) auth.createUserWithEmailAndPassword(address, secret) else auth.signInWithEmailAndPassword(address, secret)
        task.addOnCompleteListener { result ->
            if (result.isSuccessful) {
                if (createAccount) result.result?.user?.updateProfile(UserProfileChangeRequest.Builder().setDisplayName(displayName).build())
                    ?.addOnCompleteListener { finishNativeSignIn() } ?: finishNativeSignIn()
                else finishNativeSignIn()
            } else {
                setBusy(false)
                showError(authMessage(result.exception))
            }
        }
    }

    private fun finishNativeSignIn() {
        if (isFinishing || isDestroyed) return
        setBusy(false)
        if (auth.currentUser == null) showError("Sign-in finished, but the account could not be loaded. Please retry.")
    }

    private fun resetPassword() {
        val address = email.text.toString().trim()
        if (address.isBlank()) { showError("Pehle upar email likho, phir 'Forgot password' dabao."); return }
        setBusy(true)
        auth.sendPasswordResetEmail(address).addOnCompleteListener { task ->
            setBusy(false)
            if (task.isSuccessful) showMessage("Password reset email bhej diya. Inbox (aur spam) check karo.")
            else showError(authMessage(task.exception))
        }
    }

    private fun signInWithGoogle() {
        setBusy(true)
        try {
            val option = GetGoogleIdOption.Builder().setServerClientId(getString(R.string.default_web_client_id)).setFilterByAuthorizedAccounts(false).build()
            val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
            CredentialManager.create(this).getCredentialAsync(this, request, null, java.util.concurrent.Executor { command -> runOnUiThread(command) },
                object : androidx.credentials.CredentialManagerCallback<androidx.credentials.GetCredentialResponse, GetCredentialException> {
                    override fun onResult(result: androidx.credentials.GetCredentialResponse) {
                        if (isFinishing || isDestroyed) return
                        val credential = result.credential as? CustomCredential
                        if (credential?.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) { setBusy(false); showError("Google did not return a sign-in credential. Try again."); return }
                        try {
                            val google = GoogleIdTokenCredential.createFrom(credential.data)
                            auth.signInWithCredential(GoogleAuthProvider.getCredential(google.idToken, null)).addOnCompleteListener { task ->
                                if (isFinishing || isDestroyed) return@addOnCompleteListener
                                setBusy(false)
                                if (!task.isSuccessful) showError(authMessage(task.exception))
                            }
                        } catch (error: Exception) { setBusy(false); showError("Could not read the Google sign-in response.") }
                    }
                    override fun onError(error: GetCredentialException) {
                        if (isFinishing || isDestroyed) return
                        setBusy(false)
                        showError(if (error is androidx.credentials.exceptions.GetCredentialCancellationException) "Google sign-in was cancelled." else "Google sign-in failed. Check Firebase Android setup and try again.")
                    }
                })
        } catch (error: Exception) { setBusy(false); showError("Google sign-in is not configured yet.") }
    }

    private fun setBusy(busy: Boolean) {
        listOf(loginButton, googleButton, forgotButton, loginTab, signupTab).forEach { it.isEnabled = !busy; it.alpha = if (busy) 0.62f else 1f }
        progress.visibility = if (busy) View.VISIBLE else View.GONE
    }

    private fun showError(message: String) {
        status.text = message
        val dark = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
        status.setTextColor(if (dark) Color.rgb(255, 177, 159) else Color.rgb(163, 50, 36))
        status.background = rounded(if (dark) Color.rgb(48, 30, 26) else Color.rgb(255, 240, 237), 9, if (dark) Color.rgb(113, 65, 54) else Color.rgb(242, 201, 193))
        status.visibility = View.VISIBLE
    }

    private fun showMessage(message: String) {
        status.text = message
        val dark = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
        status.setTextColor(if (dark) Color.rgb(115, 229, 184) else Color.rgb(18, 122, 91))
        status.background = rounded(if (dark) Color.rgb(17, 49, 37) else Color.rgb(229, 245, 237), 9, if (dark) Color.rgb(38, 101, 73) else Color.rgb(190, 225, 207))
        status.visibility = View.VISIBLE
    }

    private fun label(text: String, size: Float, color: Int, bold: Boolean) = TextView(this).apply {
        this.text = text; textSize = size; setTextColor(color); if (bold) typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    }
    private fun fieldLabel(text: String, color: Int) = label(text, 12f, color, true)
    private fun editField(hintText: String, type: Int, ink: Int, muted: Int, fill: Int, border: Int, focus: Int) = EditText(this).apply {
        hint = hintText
        setHintTextColor(muted)
        setTextColor(ink)
        textSize = 14f
        inputType = type
        setSingleLine(true)
        setPadding(dp(11), 0, dp(11), 0)
        background = rounded(fill, 9, border)
        setOnFocusChangeListener { view, focused -> view.background = rounded(fill, 9, if (focused) focus else border) }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
    }
    private fun tabButton(text: String, fill: Int, color: Int, stroke: Int?, action: () -> Unit) = button(text, fill, color, stroke, action).apply {
        minHeight = dp(38)
        textSize = 13f
    }
    private fun button(textValue: String, backgroundColor: Int, textColor: Int, stroke: Int?, action: () -> Unit) = Button(this).apply {
        text = textValue; textSize = 15f; isAllCaps = false; typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        setTextColor(textColor); background = rounded(backgroundColor, 14, stroke); backgroundTintList = null; minHeight = dp(54); stateListAnimator = null
        setOnClickListener { action() }
    }
    private fun rounded(color: Int, radius: Int, stroke: Int? = null) = GradientDrawable().apply {
        setColor(color); cornerRadius = dp(radius).toFloat(); stroke?.let { setStroke(dp(1), it) }
    }
    private fun fieldParams() = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56))
    private fun buttonParams() = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(54)).apply { bottomMargin = dp(10) }
    private fun matchWrap() = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    private fun dp(value: Int) = (value * resources.displayMetrics.density).roundToInt()
    private fun authMessage(error: Exception?): String = when ((error as? com.google.firebase.auth.FirebaseAuthException)?.errorCode) {
        "ERROR_INVALID_EMAIL" -> "Sahi email address likho."
        "ERROR_WRONG_PASSWORD", "ERROR_USER_NOT_FOUND", "ERROR_INVALID_CREDENTIAL" -> "Email ya password match nahi hua. Details check karo."
        "ERROR_EMAIL_ALREADY_IN_USE" -> "Is email ka account already hai. Login try karo."
        "ERROR_WEAK_PASSWORD" -> "Password kam se kam 6 characters ka rakho."
        "ERROR_NETWORK_REQUEST_FAILED" -> "Sign-in service se connect nahi ho paaya. Internet check karo aur dobara try karo."
        "ERROR_TOO_MANY_REQUESTS" -> "Bahut zyada koshish ho gayi. Thodi der baad try karo."
        else -> "Sign-in failed. Please try again."
    }

}
