# Android companion app and home-screen widget

This is a separate native Android companion for the existing React/Vite tracker. It does not replace or modify the web app. The 2×1 widget renders a recent GitHub-style heatmap and reads the current Firebase user's existing `users/{uid}/tracker/main` document. It never writes tracker data. Firebase Security Rules still enforce that the signed-in UID matches `{uid}`.

## One-time Firebase setup

1. In Firebase Console, open project `build-skills-9320a` and add an **Android app** with package name `com.buildskills.jobreadytracker`. Keep this exact package name; Firebase binds the Android app registration to it.
2. Enable Email/Password and Google in Authentication → Sign-in providers if they are not already enabled.
3. Add the debug signing certificate SHA-1 and SHA-256 fingerprints to the Android app registration. Android Studio's Gradle `signingReport` task prints them. Add release signing fingerprints later if you distribute a signed release build.
4. Download that Android app's `google-services.json` into `android/app/google-services.json`. It is ignored by Git. Do not substitute the web app config; Google sign-in needs the Android app registration and its generated web OAuth client ID.
5. Confirm Firestore Rules include the existing ownership rule for `/users/{userId}/tracker/{trackerId}`. The widget reads only the signed-in user's `tracker/main` document.

## Build and install

- Install Android Studio Panda 3 or newer, JDK 17, and Android SDK Platform 37 / Build Tools 36.0.0.
- Install Gradle 9.6.0, run `gradle wrapper --gradle-version 9.6.0` once from the `android` directory (wrapper scripts are not included yet), then open the `android` directory in Android Studio and sync Gradle.
- Build and install the `app` debug variant on an Android phone with Google Play services. Sign in with the same Firebase account used by the web tracker.
- Long-press an empty area of the Android home screen → **Widgets** → **Job-Ready Tracker** → drag **Activity heatmap** onto the launcher. Its default target is 2 columns × 1 row; resize handles adapt the grid when the launcher supports resizing.
- Tapping the widget opens the tracker site. If the companion app has not been signed in yet, it first asks you to sign in.

The companion app keeps a separate native Firebase Auth session from Chrome. Sign in once in this app; Firebase uses the same account UID across platforms. The widget refreshes when added/resized, when the companion app opens or signs in, and periodically through WorkManager. Android may defer periodic work while the device is idle; refresh is not an exact timer.

## Current verification limits

This workspace currently has no Android SDK, JDK, Gradle installation, emulator/device bridge, or Android Firebase config file. The Android app therefore has not been compiled or run here. Complete the Firebase registration/config steps above and build on a machine with Android Studio before installing it.
