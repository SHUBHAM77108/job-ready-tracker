import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  signOut
} from "firebase/auth";
import { auth, firebaseEnabled } from "../firebase";

const GOOGLE_REDIRECT_PENDING = "job-ready-google-redirect-pending";

export async function registerWithEmail(name, email, password) {
  if (!firebaseEnabled) throw new Error("Firebase config is missing. Add your .env values first.");
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (name?.trim()) await updateProfile(result.user, {displayName:name.trim()});
  return result.user;
}
export async function loginWithEmail(email, password) {
  if (!firebaseEnabled) throw new Error("Firebase config is missing. Add your .env values first.");
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}
export async function loginWithGoogle() {
  if (!firebaseEnabled) throw new Error("Firebase config is missing. Add your .env values first.");
  const provider = new GoogleAuthProvider();
  if (isMobileBrowser()) {
    try { window.sessionStorage.setItem(GOOGLE_REDIRECT_PENDING, "1"); } catch { /* Redirect still works if storage is unavailable. */ }
    try { return await signInWithRedirect(auth, provider); }
    catch (error) {
      try { window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING); } catch { /* Ignore unavailable storage. */ }
      throw error;
    }
  }
  return (await signInWithPopup(auth, provider)).user;
}
function isMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
}
let redirectResultPromise;
export function getGoogleRedirectResult() {
  if (!firebaseEnabled) return Promise.resolve(null);
  // Share the read across React StrictMode's development effect remount.
  redirectResultPromise ||= (async () => {
    let pending = false;
    try {
      pending = window.sessionStorage.getItem(GOOGLE_REDIRECT_PENDING) === "1";
      window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING);
    } catch { /* Redirect result can still be read when storage is unavailable. */ }
    const result = await getRedirectResult(auth);
    if (pending && !result) {
      const error = new Error("Google sign-in was cancelled before it completed.");
      error.code = "auth/redirect-cancelled-by-user";
      throw error;
    }
    return result;
  })();
  return redirectResultPromise;
}
export async function logout() {
  if (firebaseEnabled && auth) await signOut(auth);
}
export async function resetPassword(email) {
  if (!firebaseEnabled) throw new Error("Firebase config is missing.");
  await sendPasswordResetEmail(auth, email.trim());
}
