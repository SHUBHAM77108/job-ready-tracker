import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firebaseEnabled } from "../firebase";

const AUTH_INIT_TIMEOUT_MS = 10000;

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = still starting, null = signed out
  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setUser(null);
      return undefined;
    }
    let settled = false;
    const settle = (next) => {
      settled = true;
      window.clearTimeout(timer);
      setUser(next);
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      setUser(prev => (prev === undefined ? null : prev));
    }, AUTH_INIT_TIMEOUT_MS);

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, settle, () => {
        settle(null);
      });
    } catch {
      settle(null);
    }
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return { user, setUser, loading: user === undefined, firebaseEnabled };
}
