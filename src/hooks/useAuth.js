import { useEffect, useState } from "react";
import { getRedirectResult, onAuthStateChanged } from "firebase/auth";
import { auth, firebaseEnabled } from "../firebase";

export const AUTH_ERROR_KEY = "jr-auth-error";
const AUTH_INIT_TIMEOUT_MS = 10000;   // safety net only: the normal path is onAuthStateChanged answering in well under a second

const rememberAuthError = (code, message) => { try { sessionStorage.setItem(AUTH_ERROR_KEY, JSON.stringify({ code, message })); } catch { /* ignore */ } };

export function useAuth() {
  const [user,setUser] = useState(undefined);   // undefined = still starting, null = signed out
  useEffect(() => {
    if (!firebaseEnabled || !auth) { setUser(null); return undefined; }
    let settled = false;
    const settle = (next) => { settled = true; window.clearTimeout(timer); setUser(next); };
    // if Firebase Auth never answers (blocked network, broken config) fall back to the login screen with an explanation
    const timer = window.setTimeout(() => {
      if (settled) return;
      rememberAuthError("jr/auth-timeout", "Sign-in service did not respond.");
      setUser(prev => (prev === undefined ? null : prev));
    }, AUTH_INIT_TIMEOUT_MS);
    // finishing a Google sign-in that used a redirect (phones); onAuthStateChanged then delivers the user
    getRedirectResult(auth).catch(err => rememberAuthError(err?.code || "", err?.message || ""));
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, settle, err => { rememberAuthError(err?.code || "jr/auth-init", err?.message || ""); settle(null); });
    } catch (err) {
      rememberAuthError(err?.code || "jr/auth-init", err?.message || "");
      settle(null);
    }
    return () => { window.clearTimeout(timer); unsubscribe(); };
  },[]);
  return {user, setUser, loading:user===undefined, firebaseEnabled};
}
