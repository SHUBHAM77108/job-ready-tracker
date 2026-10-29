import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

// Firebase web config. These values are not secrets (they only identify the project) — security comes from the
// Firestore rules in firestore.rules and from the "Authorized domains" list in Firebase Authentication.
// A .env file (VITE_FIREBASE_*) overrides these defaults.
const env = import.meta.env;
const DEFAULT_AUTH_DOMAIN = "build-skills-9320a.firebaseapp.com";
export const isMobileBrowser = () => typeof navigator !== "undefined" && (/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));
// Phones sign in with a redirect. Modern mobile browsers block the cookies/storage a redirect needs when the sign-in
// page lives on a different domain, so on Firebase Hosting we use the app's own domain (Hosting serves /__/auth/* itself).
function pickAuthDomain() {
  if (typeof window === "undefined") return DEFAULT_AUTH_DOMAIN;
  const host = window.location.host;
  const onHosting = /\.(web\.app|firebaseapp\.com)$/.test(host);
  return isMobileBrowser() && onHosting ? host : DEFAULT_AUTH_DOMAIN;
}
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyBfinDa9-vOFuj77w9csTiPLZz8ac7VDig",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || pickAuthDomain(),
  projectId: env.VITE_FIREBASE_PROJECT_ID || "build-skills-9320a",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "build-skills-9320a.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "119462712511",
  appId: env.VITE_FIREBASE_APP_ID || "1:119462712511:web:d1767613468c997c70e20a",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "G-L0NMCFEDPE",
};
export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
const app = firebaseEnabled ? (getApps().length ? getApps()[0] : initializeApp(config)) : null;
export const auth = app ? getAuth(app) : null;
// ignoreUndefinedProperties: an empty field in imported CSV data can never make a save fail.
// AutoDetectLongPolling: falls back automatically on networks / browsers that block Firestore's default connection.
const makeDb = () => { try { return initializeFirestore(app, { ignoreUndefinedProperties: true, experimentalAutoDetectLongPolling: true }); } catch { return getFirestore(app); } };
export const db = app ? makeDb() : null;

// Analytics only works in browsers that support it (and not in private/blocked contexts), so load it lazily and safely.
if (app && config.measurementId && typeof window !== "undefined") {
  import("firebase/analytics").then(({ getAnalytics, isSupported }) => isSupported().then(ok => { if (ok) getAnalytics(app); })).catch(() => {});
}
