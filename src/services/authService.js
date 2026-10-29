import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  signOut
} from "firebase/auth";
import { auth, firebaseEnabled } from "../firebase";

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
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
}
export async function logout() {
  if (firebaseEnabled && auth) await signOut(auth);
}
export async function resetPassword(email) {
  if (!firebaseEnabled) throw new Error("Firebase config is missing.");
  await sendPasswordResetEmail(auth, email.trim());
}
