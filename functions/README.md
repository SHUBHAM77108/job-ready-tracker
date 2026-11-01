# Native Android SSO endpoints

The Android app sends its Firebase ID token only in the HTTPS `Authorization` header to `createNativeSsoCode`. The function verifies the token and revocation state with Firebase Admin, stores only a SHA-256 hash of a random 256-bit code, and pins that code to the verified UID and the production Hosting origin. The browser receives the short-lived code in a URL fragment; page JavaScript removes it from history before exchanging it. `exchangeNativeSsoCode` atomically marks the code used, then returns a Firebase custom token over HTTPS for `signInWithCustomToken`.

No UID or redirect URL from the native client is trusted. Firestore Admin access to `nativeSsoCodes` is server-only; current Firestore rules do not grant clients access to that collection.

## Local tests

From this directory, run `npm test`. Tests use an in-memory code store and cover invalid native ID tokens, expiry, replay, a different active website account, and the verified UID success path.

## Deployment prerequisites

Deployment is deliberately separate from this code change. Firebase Cloud Functions deployment requires the Firebase project to use the Blaze plan and have a linked Cloud Billing account. Configure billing and budget alerts in the Firebase/Google Cloud Console before deploying. Cloud Functions has a published no-cost quota, but usage beyond free quotas, Firestore reads/writes/storage, build artifacts, and network transfer may be billed. Do not set a minimum instance count for this low-traffic handoff endpoint.

Before first production token mint, confirm the Cloud Functions v2 runtime service account has `roles/iam.serviceAccountTokenCreator` on itself so the Admin SDK can sign custom tokens. No service-account key file is needed or should be committed. Enable Firestore TTL on the `nativeSsoCodes.expiresAt` field if automatic deletion of expired records is desired; expiry checks do not depend on TTL.

After reviewing billing and IAM, deploy with `firebase deploy --only functions,hosting` from the project root. The Hosting rewrites target `https://build-skills-9320a.web.app`; no code path accepts an arbitrary redirect origin.
