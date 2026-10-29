import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  signOut
} from "firebase/auth";
import { auth, firebaseEnabled, isMobileBrowser } from "../firebase";

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
// Phones: full-page redirect (popups are blocked or closed by mobile browsers). Desktop: popup, with a redirect fallback
// when the browser blocks the popup. The result of a redirect is picked up in hooks/useAuth.js.
export async function loginWithGoogle() {
  if (!firebaseEnabled) throw new Error("Firebase config is missing. Add your .env values first.");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  if (isMobileBrowser()) { await signInWithRedirect(auth, provider); return null; }
  try {
    return (await signInWithPopup(auth, provider)).user;
  } catch (err) {
    if (["auth/popup-blocked", "auth/cancelled-popup-request", "auth/operation-not-supported-in-this-environment"].includes(err?.code)) { await signInWithRedirect(auth, provider); return null; }
    throw err;
  }
}
export async function logout() {
  if (firebaseEnabled && auth) await signOut(auth);
}
export async function resetPassword(email) {
  if (!firebaseEnabled) throw new Error("Firebase config is missing.");
  await sendPasswordResetEmail(auth, email.trim());
}
